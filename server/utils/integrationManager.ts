import { db } from "../db";
import {
  integrationConnections,
  integrationProviders,
  integrationSyncLogs,
  integrationFieldMappings,
  integrationSyncedRecords,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: string[];
  syncedRecordIds: string[];
}

/**
 * Encrypt sensitive data (OAuth tokens, API keys)
 */
export function encryptToken(token: string): string {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  
  const algorithm = "aes-256-gcm";
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex").slice(0, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  let encrypted = cipher.update(token, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  });
}

/**
 * Decrypt sensitive data
 */
export function decryptToken(encryptedData: string): string {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  
  const algorithm = "aes-256-gcm";
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex").slice(0, 32);

  const { encrypted, iv, authTag } = JSON.parse(encryptedData);
  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Store OAuth tokens securely
 */
export async function storeOAuthTokens(
  connectionId: string,
  tokens: OAuthTokens
): Promise<void> {
  const encryptedAccessToken = encryptToken(tokens.accessToken);
  const encryptedRefreshToken = tokens.refreshToken
    ? encryptToken(tokens.refreshToken)
    : null;

  await db
    .update(integrationConnections)
    .set({
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: tokens.expiresAt || null,
      lastSyncAt: new Date(),
    })
    .where(eq(integrationConnections.id, connectionId));
}

/**
 * Refresh OAuth access token
 */
export async function refreshOAuthToken(
  connectionId: string
): Promise<string> {
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId));

  if (!connection || !connection.refreshToken) {
    throw new Error("No refresh token available");
  }

  const [provider] = await db
    .select()
    .from(integrationProviders)
    .where(eq(integrationProviders.id, connection.providerId));

  if (!provider || !provider.oauthTokenUrl) {
    throw new Error("Provider not configured for OAuth");
  }

  const refreshToken = decryptToken(connection.refreshToken);

  // Make OAuth token refresh request
  const response = await fetch(provider.oauthTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env[`${provider.providerKey.toUpperCase()}_CLIENT_ID`] || "",
      client_secret: process.env[`${provider.providerKey.toUpperCase()}_CLIENT_SECRET`] || "",
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth refresh failed: ${response.statusText}`);
  }

  const data = await response.json();

  // Store new tokens
  await storeOAuthTokens(connectionId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined,
  });

  return data.access_token;
}

/**
 * Get valid access token (refresh if expired)
 */
export async function getValidAccessToken(
  connectionId: string
): Promise<string> {
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId));

  if (!connection) {
    throw new Error("Connection not found");
  }

  if (!connection.accessToken) {
    throw new Error("No access token available");
  }

  // Check if token is expired
  if (
    connection.tokenExpiresAt &&
    new Date() >= new Date(connection.tokenExpiresAt)
  ) {
    return await refreshOAuthToken(connectionId);
  }

  return decryptToken(connection.accessToken);
}

/**
 * Log integration sync activity
 */
export async function logSyncActivity(
  connectionId: string,
  employerId: string,
  syncType: string,
  result: SyncResult
): Promise<string> {
  const [log] = await db
    .insert(integrationSyncLogs)
    .values({
      employerId,
      connectionId,
      syncType,
      syncDirection: "inbound",
      status: result.success ? "completed" : "failed",
      startedAt: new Date(),
      completedAt: new Date(),
      recordsProcessed: result.recordsProcessed,
      recordsCreated: result.recordsCreated,
      recordsUpdated: result.recordsUpdated,
      recordsSkipped: result.recordsFailed,
      errorMessage: result.errors.length > 0 ? result.errors.join("; ") : null,
      errorDetails: result.errors.length > 0 ? { errors: result.errors } as any : null,
    })
    .returning();

  return log.id;
}

/**
 * Track synced record
 */
export async function trackSyncedRecord(
  connectionId: string,
  externalId: string,
  internalId: string,
  externalType: string,
  recordData: any
): Promise<void> {
  await db
    .insert(integrationSyncedRecords)
    .values({
      connectionId,
      externalId,
      internalId,
      externalType,
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        integrationSyncedRecords.connectionId,
        integrationSyncedRecords.externalId,
      ],
      set: {
        internalId,
        lastSyncedAt: new Date(),
      },
    });
}

/**
 * Get field mapping for a connection
 */
export async function getFieldMappings(
  connectionId: string
): Promise<Map<string, string>> {
  const [mapping] = await db
    .select()
    .from(integrationFieldMappings)
    .where(eq(integrationFieldMappings.connectionId, connectionId))
    .limit(1);

  const mappingMap = new Map<string, string>();
  
  if (mapping && mapping.fieldMappings) {
    const fieldMappings = mapping.fieldMappings as Record<string, string>;
    Object.entries(fieldMappings).forEach(([external, internal]) => {
      mappingMap.set(external, internal);
    });
  }

  return mappingMap;
}

/**
 * Apply field mappings to external data
 */
export function applyFieldMappings(
  externalData: any,
  mappings: Map<string, string>
): any {
  const mappedData: any = {};

  mappings.forEach((internalField, externalField) => {
    if (externalData[externalField] !== undefined) {
      mappedData[internalField] = externalData[externalField];
    }
  });

  return mappedData;
}

/**
 * Validate webhook signature
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

/**
 * Handle webhook retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Get connection health status
 */
export async function getConnectionHealth(
  connectionId: string
): Promise<{
  status: "healthy" | "warning" | "error";
  lastSyncAt?: Date;
  lastError?: string;
  syncStats: {
    last24h: number;
    successRate: number;
  };
}> {
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId));

  if (!connection) {
    return {
      status: "error",
      lastError: "Connection not found",
      syncStats: { last24h: 0, successRate: 0 },
    };
  }

  // Get recent sync logs
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentLogs = await db
    .select()
    .from(integrationSyncLogs)
    .where(
      and(
        eq(integrationSyncLogs.connectionId, connectionId),
        desc(integrationSyncLogs.startedAt)
      )
    )
    .limit(100);

  const last24hLogs = recentLogs.filter(
    (log) => log.startedAt && new Date(log.startedAt) >= twentyFourHoursAgo
  );
  const successfulSyncs = last24hLogs.filter((log) => log.status === "success");

  const successRate =
    last24hLogs.length > 0 ? successfulSyncs.length / last24hLogs.length : 0;

  let status: "healthy" | "warning" | "error" = "healthy";
  if (successRate < 0.5) {
    status = "error";
  } else if (successRate < 0.8) {
    status = "warning";
  }

  const lastSync = recentLogs[0];

  return {
    status,
    lastSyncAt: connection.lastSyncAt || undefined,
    lastError: lastSync?.errorMessage || undefined,
    syncStats: {
      last24h: last24hLogs.length,
      successRate: Math.round(successRate * 100),
    },
  };
}
