import { Router } from "express";
import { db } from "../db";
import { apiKeys, users } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { ApiKeyService } from "../utils/apiKeyService";
import { insertApiKeySchema } from "../../shared/schema";

const router = Router();

// Get all API keys for an employer (without exposing the actual keys)
router.get("/", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only employers and admins can manage API keys
    if (user.role !== "employer" && user.role !== "admin") {
      return res.status(403).json({ error: "Only employers and admins can manage API keys" });
    }

    const employerId = user.role === "admin" ? req.query.employerId as string : user.employerId;
    if (!employerId) {
      return res.status(400).json({ error: "Employer ID required" });
    }

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        environment: apiKeys.environment,
        rateLimit: apiKeys.rateLimit,
        rateLimitWindow: apiKeys.rateLimitWindow,
        lastUsedAt: apiKeys.lastUsedAt,
        totalRequests: apiKeys.totalRequests,
        expiresAt: apiKeys.expiresAt,
        isActive: apiKeys.isActive,
        revokedAt: apiKeys.revokedAt,
        revokedReason: apiKeys.revokedReason,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.employerId, employerId))
      .orderBy(desc(apiKeys.createdAt));

    res.json(keys);
  } catch (error) {
    console.error("Error fetching API keys:", error);
    res.status(500).json({ error: "Failed to fetch API keys" });
  }
});

// Create a new API key
router.post("/", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only employers and admins can create API keys
    if (user.role !== "employer" && user.role !== "admin") {
      return res.status(403).json({ error: "Only employers and admins can create API keys" });
    }

    const employerId = user.role === "admin" && req.body.employerId 
      ? req.body.employerId 
      : user.employerId;

    if (!employerId) {
      return res.status(400).json({ error: "Employer ID required" });
    }

    const { name, scopes, environment, rateLimit, rateLimitWindow, expiresAt } = req.body;

    if (!name || !scopes || !Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ error: "Name and scopes are required" });
    }

    // Validate scopes
    const validScopes = [
      "employees:read",
      "employees:write",
      "employees:*",
      "screenings:read",
      "screenings:write",
      "screenings:*",
      "credits:read",
      "credits:*",
      "webhooks:read",
      "webhooks:write",
      "webhooks:*",
      "*", // Full access
    ];

    const invalidScopes = scopes.filter((scope: string) => !validScopes.includes(scope));
    if (invalidScopes.length > 0) {
      return res.status(400).json({ 
        error: "Invalid scopes", 
        invalidScopes,
        validScopes,
      });
    }

    // Generate the API key
    const { key, keyId } = await ApiKeyService.generateApiKey({
      employerId,
      createdBy: userId,
      name,
      scopes,
      environment,
      rateLimit,
      rateLimitWindow,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    // Return the full key ONLY on creation (this is the only time it will be shown)
    const [createdKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));

    res.status(201).json({
      ...createdKey,
      key, // Only returned on creation
      warning: "Save this key securely. It will not be shown again.",
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    res.status(500).json({ error: "Failed to create API key" });
  }
});

// Update API key (name, scopes, rate limits)
router.patch("/:keyId", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "employer" && user.role !== "admin") {
      return res.status(403).json({ error: "Only employers and admins can update API keys" });
    }

    const { keyId } = req.params;
    const { name, scopes, rateLimit, rateLimitWindow } = req.body;

    // Get existing key
    const [existingKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));

    if (!existingKey) {
      return res.status(404).json({ error: "API key not found" });
    }

    // Verify ownership
    if (user.role === "employer" && existingKey.employerId !== user.employerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (scopes !== undefined) updates.scopes = scopes;
    if (rateLimit !== undefined) updates.rateLimit = rateLimit;
    if (rateLimitWindow !== undefined) updates.rateLimitWindow = rateLimitWindow;

    const [updated] = await db
      .update(apiKeys)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(apiKeys.id, keyId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Error updating API key:", error);
    res.status(500).json({ error: "Failed to update API key" });
  }
});

// Revoke an API key
router.delete("/:keyId", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "employer" && user.role !== "admin") {
      return res.status(403).json({ error: "Only employers and admins can revoke API keys" });
    }

    const { keyId } = req.params;
    const { reason } = req.body;

    // Get existing key
    const [existingKey] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));

    if (!existingKey) {
      return res.status(404).json({ error: "API key not found" });
    }

    // Verify ownership
    if (user.role === "employer" && existingKey.employerId !== user.employerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    await ApiKeyService.revokeApiKey(
      keyId,
      userId,
      reason || "Revoked by user"
    );

    res.json({ message: "API key revoked successfully" });
  } catch (error) {
    console.error("Error revoking API key:", error);
    res.status(500).json({ error: "Failed to revoke API key" });
  }
});

// Get API key usage statistics
router.get("/:keyId/usage", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { keyId } = req.params;

    // Get API key
    const [key] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId));

    if (!key) {
      return res.status(404).json({ error: "API key not found" });
    }

    // Verify ownership
    if (user.role === "employer" && key.employerId !== user.employerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get aggregated usage across all endpoints
    const totalUsage = await ApiKeyService.checkRateLimitTotal(keyId);

    res.json({
      totalRequests: key.totalRequests,
      lastUsedAt: key.lastUsedAt,
      currentWindow: {
        limit: totalUsage.limit,
        used: totalUsage.totalUsed,
        remaining: Math.max(0, totalUsage.limit - totalUsage.totalUsed),
        resetAt: totalUsage.resetAt,
      },
    });
  } catch (error) {
    console.error("Error fetching API key usage:", error);
    res.status(500).json({ error: "Failed to fetch usage statistics" });
  }
});

export default router;
