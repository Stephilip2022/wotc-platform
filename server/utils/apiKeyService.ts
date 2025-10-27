import crypto from "crypto";
import { db } from "../db";
import { apiKeys, apiKeyUsage } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface GenerateApiKeyOptions {
  employerId: string;
  createdBy: string;
  name: string;
  scopes: string[];
  environment?: "production" | "sandbox";
  rateLimit?: number;
  rateLimitWindow?: number;
  expiresAt?: Date | null;
}

export interface ValidateApiKeyResult {
  valid: boolean;
  keyId?: string;
  employerId?: string;
  scopes?: string[];
  error?: string;
}

export class ApiKeyService {
  private static readonly KEY_PREFIX_PRODUCTION = "wotc_live";
  private static readonly KEY_PREFIX_SANDBOX = "wotc_test";
  private static readonly KEY_LENGTH = 32; // bytes, will be 64 hex chars

  /**
   * Generate a new API key
   */
  static async generateApiKey(options: GenerateApiKeyOptions): Promise<{ key: string; keyId: string }> {
    const {
      employerId,
      createdBy,
      name,
      scopes,
      environment = "production",
      rateLimit = 1000,
      rateLimitWindow = 3600,
      expiresAt = null,
    } = options;

    // Generate a cryptographically secure random key
    const randomBytes = crypto.randomBytes(this.KEY_LENGTH);
    const keySecret = randomBytes.toString("hex");

    // Determine prefix based on environment
    const prefix = environment === "production" 
      ? this.KEY_PREFIX_PRODUCTION 
      : this.KEY_PREFIX_SANDBOX;

    // Construct full key: wotc_live_abc123...
    const fullKey = `${prefix}_${keySecret}`;

    // Hash the full key for storage (never store the actual key)
    const keyHash = crypto
      .createHash("sha256")
      .update(fullKey)
      .digest("hex");

    // Store prefix + first 8 chars of secret for identification: "wotc_live_abc12345"
    // This allows operators to distinguish keys without exposing the full secret
    const keyPrefix = fullKey.substring(0, prefix.length + 1 + 8);

    // Insert into database
    const [newKey] = await db
      .insert(apiKeys)
      .values({
        employerId,
        createdBy,
        name,
        keyPrefix,
        keyHash,
        scopes,
        environment,
        rateLimit,
        rateLimitWindow,
        expiresAt,
        isActive: true,
      })
      .returning();

    return {
      key: fullKey,
      keyId: newKey.id,
    };
  }

  /**
   * Validate an API key and check if it's active and not expired
   */
  static async validateApiKey(apiKey: string): Promise<ValidateApiKeyResult> {
    try {
      // Hash the provided key
      const keyHash = crypto
        .createHash("sha256")
        .update(apiKey)
        .digest("hex");

      // Look up the key in the database
      const [key] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash));

      if (!key) {
        return { valid: false, error: "Invalid API key" };
      }

      // Check if key is active
      if (!key.isActive) {
        return { valid: false, error: "API key has been revoked" };
      }

      // Check if key is expired
      if (key.expiresAt && new Date() > key.expiresAt) {
        return { valid: false, error: "API key has expired" };
      }

      // Update last used timestamp
      await db
        .update(apiKeys)
        .set({
          lastUsedAt: new Date(),
          totalRequests: sql`${apiKeys.totalRequests} + 1`,
        })
        .where(eq(apiKeys.id, key.id));

      return {
        valid: true,
        keyId: key.id,
        employerId: key.employerId,
        scopes: key.scopes,
      };
    } catch (error) {
      console.error("Error validating API key:", error);
      return { valid: false, error: "Internal server error" };
    }
  }

  /**
   * Check TOTAL rate limit for an API key across ALL endpoints (for stats)
   */
  static async checkRateLimitTotal(keyId: string): Promise<{ limit: number; totalUsed: number; resetAt: Date }> {
    try {
      const [key] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, keyId));

      if (!key) {
        return { limit: 0, totalUsed: 0, resetAt: new Date() };
      }

      const rateLimitWindow = key.rateLimitWindow || 3600;
      const rateLimit = key.rateLimit || 1000;
      
      const windowStart = new Date(Date.now() - (rateLimitWindow * 1000));
      
      // Count ALL requests in the current window across all endpoints
      const [result] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(apiKeyUsage)
        .where(
          and(
            eq(apiKeyUsage.apiKeyId, keyId),
            sql`${apiKeyUsage.timestamp} >= ${windowStart}`
          )
        );

      const totalUsed = Number(result?.count || 0);
      const resetAt = new Date(Date.now() + (rateLimitWindow * 1000));

      return {
        limit: rateLimit,
        totalUsed,
        resetAt,
      };
    } catch (error) {
      console.error("Error checking total rate limit:", error);
      return { limit: 0, totalUsed: 0, resetAt: new Date() };
    }
  }

  /**
   * Check rate limit for an API key on a specific endpoint
   */
  static async checkRateLimit(keyId: string, endpoint: string): Promise<{ allowed: boolean; limit: number; remaining: number; resetAt: Date }> {
    try {
      const [key] = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.id, keyId));

      if (!key) {
        return { allowed: false, limit: 0, remaining: 0, resetAt: new Date() };
      }

      const rateLimitWindow = key.rateLimitWindow || 3600;
      const rateLimit = key.rateLimit || 1000;
      
      const windowStart = new Date(Date.now() - (rateLimitWindow * 1000));
      
      // Count requests in the current window for this specific endpoint
      const [result] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(apiKeyUsage)
        .where(
          and(
            eq(apiKeyUsage.apiKeyId, keyId),
            eq(apiKeyUsage.endpoint, endpoint),
            sql`${apiKeyUsage.timestamp} >= ${windowStart}`
          )
        );

      const requestCount = Number(result?.count || 0);
      const remaining = Math.max(0, rateLimit - requestCount);
      const resetAt = new Date(Date.now() + (rateLimitWindow * 1000));

      return {
        allowed: requestCount < rateLimit,
        limit: rateLimit,
        remaining,
        resetAt,
      };
    } catch (error) {
      console.error("Error checking rate limit:", error);
      return { allowed: false, limit: 0, remaining: 0, resetAt: new Date() };
    }
  }

  /**
   * Log API key usage
   */
  static async logUsage(
    keyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number,
    ipAddress?: string,
    userAgent?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      await db.insert(apiKeyUsage).values({
        apiKeyId: keyId,
        endpoint,
        method,
        statusCode,
        responseTimeMs,
        ipAddress,
        userAgent,
        errorMessage,
      });
    } catch (error) {
      console.error("Error logging API usage:", error);
    }
  }

  /**
   * Revoke an API key
   */
  static async revokeApiKey(keyId: string, revokedBy: string, reason: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedBy,
        revokedReason: reason,
      })
      .where(eq(apiKeys.id, keyId));
  }

  /**
   * Check if API key has required scope
   */
  static hasScope(scopes: string[], requiredScope: string): boolean {
    // Support wildcard scopes: 'employees:*' matches 'employees:read' and 'employees:write'
    const [resource, action] = requiredScope.split(":");
    
    return scopes.some(scope => {
      if (scope === requiredScope) return true;
      if (scope === "*") return true; // Full access
      
      const [scopeResource, scopeAction] = scope.split(":");
      if (scopeResource === resource && scopeAction === "*") return true;
      
      return false;
    });
  }
}
