import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "../db";
import {
  integrationConnections,
  integrationProviders,
  integrationSyncLogs,
  integrationSyncedRecords,
  users,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  syncGreenhouseCandidates,
  pushWotcResultsToGreenhouse,
  syncBambooHREmployees,
  pushWotcResultsToBambooHR,
} from "../utils/atsConnectors";
import crypto from "crypto";
import { z } from "zod";

const createConnectionSchema = z.object({
  providerId: z.string().min(1, "Provider ID is required"),
  name: z.string().min(1, "Connection name is required"),
  authType: z.enum(["api_key", "oauth2", "basic"]).default("api_key"),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  externalAccountId: z.string().optional(),
  externalAccountName: z.string().optional(),
  syncFrequency: z.enum(["realtime", "hourly", "daily", "manual"]).default("hourly"),
});

const updateConnectionSchema = z.object({
  name: z.string().min(1).optional(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  syncEnabled: z.boolean().optional(),
  syncFrequency: z.enum(["realtime", "hourly", "daily", "manual"]).optional(),
  externalAccountId: z.string().optional(),
  externalAccountName: z.string().optional(),
});

const router = Router();

// Get all available integration providers
router.get("/providers", async (req: any, res) => {
  try {
    const providers = await db.select().from(integrationProviders);
    res.json(providers);
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({ error: "Failed to fetch integration providers" });
  }
});

// Get employer's connected integrations
router.get("/connections", async (req: any, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const connections = await db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.employerId, employerId))
      .orderBy(desc(integrationConnections.createdAt));

    // Mask sensitive fields before returning
    const maskedConnections = connections.map((c) => ({
      ...c,
      accessToken: c.accessToken ? "••••••••" : null,
      refreshToken: c.refreshToken ? "••••••••" : null,
      apiKey: c.apiKey ? "••••••••" : null,
      apiSecret: c.apiSecret ? "••••••••" : null,
      webhookSecret: c.webhookSecret ? "••••••••" : null,
    }));

    res.json(maskedConnections);
  } catch (error) {
    console.error("Error fetching connections:", error);
    res.status(500).json({ error: "Failed to fetch integrations" });
  }
});

// Create new integration connection
router.post("/connections", async (req: any, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const parseResult = createConnectionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.flatten() 
      });
    }

    const { 
      providerId, 
      name,
      authType,
      apiKey,
      apiSecret,
      accessToken,
      refreshToken,
      externalAccountId,
      externalAccountName,
      syncFrequency,
    } = parseResult.data;

    // Encrypt credentials if provided
    const encryptedApiKey = apiKey ? encryptValue(apiKey) : null;
    const encryptedApiSecret = apiSecret ? encryptValue(apiSecret) : null;
    const encryptedAccessToken = accessToken ? encryptValue(accessToken) : null;
    const encryptedRefreshToken = refreshToken ? encryptValue(refreshToken) : null;

    const [connection] = await db
      .insert(integrationConnections)
      .values({
        employerId,
        providerId,
        name,
        authType,
        apiKey: encryptedApiKey,
        apiSecret: encryptedApiSecret,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        externalAccountId,
        externalAccountName,
        syncFrequency,
      } as any)
      .returning();

    res.status(201).json({
      ...connection,
      apiKey: apiKey ? "••••••••" : null,
      apiSecret: apiSecret ? "••••••••" : null,
      accessToken: accessToken ? "••••••••" : null,
      refreshToken: refreshToken ? "••••••••" : null,
    });
  } catch (error) {
    console.error("Error creating connection:", error);
    res.status(500).json({ error: "Failed to create integration" });
  }
});

// Update integration connection
router.patch("/connections/:id", async (req: any, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const { id } = req.params;
    
    const parseResult = updateConnectionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: parseResult.error.flatten() 
      });
    }

    const { 
      name, 
      apiKey,
      apiSecret,
      syncEnabled,
      syncFrequency,
      externalAccountId,
      externalAccountName,
    } = parseResult.data;

    const updateData: any = { updatedAt: new Date() };
    if (name) updateData.name = name;
    if (apiKey) updateData.apiKey = encryptValue(apiKey);
    if (apiSecret) updateData.apiSecret = encryptValue(apiSecret);
    if (typeof syncEnabled === "boolean") updateData.syncEnabled = syncEnabled;
    if (syncFrequency) updateData.syncFrequency = syncFrequency;
    if (externalAccountId) updateData.externalAccountId = externalAccountId;
    if (externalAccountName) updateData.externalAccountName = externalAccountName;

    const [updated] = await db
      .update(integrationConnections)
      .set(updateData)
      .where(
        and(
          eq(integrationConnections.id, id),
          eq(integrationConnections.employerId, employerId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Integration not found" });
    }

    res.json({
      ...updated,
      apiKey: updated.apiKey ? "••••••••" : null,
      apiSecret: updated.apiSecret ? "••••••••" : null,
      accessToken: updated.accessToken ? "••••••••" : null,
      refreshToken: updated.refreshToken ? "••••••••" : null,
    });
  } catch (error) {
    console.error("Error updating connection:", error);
    res.status(500).json({ error: "Failed to update integration" });
  }
});

// Delete integration connection
router.delete("/connections/:id", async (req: any, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const { id } = req.params;

    await db
      .delete(integrationConnections)
      .where(
        and(
          eq(integrationConnections.id, id),
          eq(integrationConnections.employerId, employerId)
        )
      );

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting connection:", error);
    res.status(500).json({ error: "Failed to delete integration" });
  }
});

// Trigger manual sync for an integration
router.post("/connections/:id/sync", async (req: any, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const { id } = req.params;

    // Get the connection
    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.id, id),
          eq(integrationConnections.employerId, employerId)
        )
      );

    if (!connection) {
      return res.status(404).json({ error: "Integration not found" });
    }

    let result;

    // Dispatch to appropriate sync handler based on provider
    switch (connection.providerId) {
      case "greenhouse":
        result = await syncGreenhouseCandidates(id, employerId);
        break;
      case "bamboohr":
        const subdomain = connection.externalAccountId || "";
        result = await syncBambooHREmployees(id, employerId, subdomain);
        break;
      default:
        return res.status(400).json({ error: "Unsupported integration type" });
    }

    // Update last sync time
    await db
      .update(integrationConnections)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(integrationConnections.id, id));

    res.json(result);
  } catch (error) {
    console.error("Error syncing integration:", error);
    res.status(500).json({ error: "Failed to sync integration" });
  }
});

// Get sync history for an integration
router.get("/connections/:id/logs", async (req: any, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const { id } = req.params;

    const logs = await db
      .select()
      .from(integrationSyncLogs)
      .where(eq(integrationSyncLogs.connectionId, id))
      .orderBy(desc(integrationSyncLogs.startedAt))
      .limit(50);

    res.json(logs);
  } catch (error) {
    console.error("Error fetching sync logs:", error);
    res.status(500).json({ error: "Failed to fetch sync logs" });
  }
});

// Get synced records for an integration
router.get("/connections/:id/records", async (req: any, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const { id } = req.params;

    const records = await db
      .select()
      .from(integrationSyncedRecords)
      .where(eq(integrationSyncedRecords.connectionId, id))
      .orderBy(desc(integrationSyncedRecords.lastSyncedAt))
      .limit(100);

    res.json(records);
  } catch (error) {
    console.error("Error fetching synced records:", error);
    res.status(500).json({ error: "Failed to fetch synced records" });
  }
});

// Push WOTC results back to integration
router.post("/connections/:id/push-results", async (req: any, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const { id } = req.params;
    const { externalRecordId, wotcData } = req.body;

    // Get the connection
    const [connection] = await db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.id, id),
          eq(integrationConnections.employerId, employerId)
        )
      );

    if (!connection) {
      return res.status(404).json({ error: "Integration not found" });
    }

    let success = false;

    // Dispatch to appropriate push handler
    switch (connection.providerId) {
      case "greenhouse":
        success = await pushWotcResultsToGreenhouse(id, externalRecordId, wotcData);
        break;
      case "bamboohr":
        const subdomain = connection.externalAccountId || "";
        success = await pushWotcResultsToBambooHR(id, subdomain, externalRecordId, wotcData);
        break;
      default:
        return res.status(400).json({ error: "Unsupported integration type" });
    }

    if (success) {
      res.json({ message: "WOTC results pushed successfully" });
    } else {
      res.status(500).json({ error: "Failed to push WOTC results" });
    }
  } catch (error) {
    console.error("Error pushing WOTC results:", error);
    res.status(500).json({ error: "Failed to push WOTC results" });
  }
});

// Helper function to encrypt a value
function encryptValue(value: string): string {
  const algorithm = "aes-256-gcm";
  const key = process.env.SESSION_SECRET
    ? crypto.scryptSync(process.env.SESSION_SECRET, "salt", 32)
    : crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("hex"),
    data: encrypted,
    tag: authTag.toString("hex"),
  });
}

export default router;
