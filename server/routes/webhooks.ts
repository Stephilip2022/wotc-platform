import { Router } from "express";
import { db } from "../db";
import { webhookEndpoints, webhookDeliveries, type InsertWebhookEndpoint } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";
import { WEBHOOK_EVENTS, dispatchWebhookEvent } from "../utils/webhookService";

const router = Router();

// Create Zod enum from WEBHOOK_EVENTS for validation
const webhookEventEnum = z.enum(Object.values(WEBHOOK_EVENTS) as [string, ...string[]]);

/**
 * GET /api/webhooks
 * List all webhook endpoints for current employer
 */
router.get("/", async (req: any, res) => {
  try {
    const employerId = req.user.claims.employerId as string;
    
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }
    
    const endpoints = await db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.employerId, employerId))
      .orderBy(desc(webhookEndpoints.createdAt));
    
    res.json({ data: endpoints });
  } catch (error) {
    console.error("Error fetching webhook endpoints:", error);
    res.status(500).json({ error: "Failed to fetch webhook endpoints" });
  }
});

/**
 * POST /api/webhooks
 * Create a new webhook endpoint
 */
router.post("/", async (req: any, res) => {
  try {
    const employerId = req.user.claims.employerId as string;
    const userId = req.user.claims.sub;
    
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }
    
    // Validation schema with enum validation for events
    const schema = z.object({
      url: z.string().url("Invalid URL"),
      description: z.string().optional(),
      events: z.array(webhookEventEnum).min(1, "At least one event must be selected"),
      maxRetries: z.number().int().min(0).max(10).optional(),
      retryBackoffSeconds: z.number().int().min(1).max(3600).optional(),
    });
    
    const validated = schema.parse(req.body);
    
    // Generate webhook secret for HMAC signing
    const secret = crypto.randomBytes(32).toString("hex");
    
    const newEndpoint: InsertWebhookEndpoint = {
      employerId,
      createdBy: userId,
      url: validated.url,
      secret,
      description: validated.description,
      events: validated.events,
      maxRetries: validated.maxRetries,
      retryBackoffSeconds: validated.retryBackoffSeconds,
    };
    
    const [endpoint] = await db.insert(webhookEndpoints).values(newEndpoint).returning();
    
    res.status(201).json({
      data: endpoint,
      message: "Webhook endpoint created successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    
    console.error("Error creating webhook endpoint:", error);
    res.status(500).json({ error: "Failed to create webhook endpoint" });
  }
});

/**
 * GET /api/webhooks/events/list
 * Get list of available webhook events
 * NOTE: This route MUST be before /:id routes to avoid path conflicts
 */
router.get("/events/list", async (req, res) => {
  try {
    const events = Object.entries(WEBHOOK_EVENTS).map(([key, value]) => ({
      name: value,
      description: key.split("_").map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(" "),
    }));
    
    res.json({ data: events });
  } catch (error) {
    console.error("Error fetching webhook events:", error);
    res.status(500).json({ error: "Failed to fetch webhook events" });
  }
});

/**
 * GET /api/webhooks/:id
 * Get a single webhook endpoint
 */
router.get("/:id", async (req: any, res) => {
  try {
    const employerId = req.user.claims.employerId as string;
    const { id } = req.params;
    
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }
    
    const endpoint = await db.query.webhookEndpoints.findFirst({
      where: and(
        eq(webhookEndpoints.id, id),
        eq(webhookEndpoints.employerId, employerId)
      ),
    });
    
    if (!endpoint) {
      return res.status(404).json({ error: "Webhook endpoint not found" });
    }
    
    res.json({ data: endpoint });
  } catch (error) {
    console.error("Error fetching webhook endpoint:", error);
    res.status(500).json({ error: "Failed to fetch webhook endpoint" });
  }
});

/**
 * PATCH /api/webhooks/:id
 * Update a webhook endpoint
 */
router.patch("/:id", async (req: any, res) => {
  try {
    const employerId = req.user.claims.employerId as string;
    const { id } = req.params;
    
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }
    
    // Validation schema with enum validation for events
    const schema = z.object({
      url: z.string().url("Invalid URL").optional(),
      description: z.string().optional(),
      events: z.array(webhookEventEnum).min(1, "At least one event must be selected").optional(),
      isActive: z.boolean().optional(),
      maxRetries: z.number().int().min(0).max(10).optional(),
      retryBackoffSeconds: z.number().int().min(1).max(3600).optional(),
    });
    
    const validated = schema.parse(req.body);
    
    // Check if endpoint exists and belongs to this employer
    const existing = await db.query.webhookEndpoints.findFirst({
      where: and(
        eq(webhookEndpoints.id, id),
        eq(webhookEndpoints.employerId, employerId)
      ),
    });
    
    if (!existing) {
      return res.status(404).json({ error: "Webhook endpoint not found" });
    }
    
    // Update endpoint
    const [updated] = await db
      .update(webhookEndpoints)
      .set({
        ...validated,
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, id))
      .returning();
    
    res.json({
      data: updated,
      message: "Webhook endpoint updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
    }
    
    console.error("Error updating webhook endpoint:", error);
    res.status(500).json({ error: "Failed to update webhook endpoint" });
  }
});

/**
 * DELETE /api/webhooks/:id
 * Delete a webhook endpoint
 */
router.delete("/:id", async (req: any, res) => {
  try {
    const employerId = req.user.claims.employerId as string;
    const { id } = req.params;
    
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }
    
    // Check if endpoint exists and belongs to this employer
    const existing = await db.query.webhookEndpoints.findFirst({
      where: and(
        eq(webhookEndpoints.id, id),
        eq(webhookEndpoints.employerId, employerId)
      ),
    });
    
    if (!existing) {
      return res.status(404).json({ error: "Webhook endpoint not found" });
    }
    
    // Delete endpoint (cascades to deliveries)
    await db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
    
    res.json({ message: "Webhook endpoint deleted successfully" });
  } catch (error) {
    console.error("Error deleting webhook endpoint:", error);
    res.status(500).json({ error: "Failed to delete webhook endpoint" });
  }
});

/**
 * POST /api/webhooks/:id/regenerate-secret
 * Regenerate webhook secret
 */
router.post("/:id/regenerate-secret", async (req: any, res) => {
  try {
    const employerId = req.user.claims.employerId as string;
    const { id } = req.params;
    
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }
    
    // Check if endpoint exists and belongs to this employer
    const existing = await db.query.webhookEndpoints.findFirst({
      where: and(
        eq(webhookEndpoints.id, id),
        eq(webhookEndpoints.employerId, employerId)
      ),
    });
    
    if (!existing) {
      return res.status(404).json({ error: "Webhook endpoint not found" });
    }
    
    // Generate new secret
    const newSecret = crypto.randomBytes(32).toString("hex");
    
    // Update endpoint
    const [updated] = await db
      .update(webhookEndpoints)
      .set({
        secret: newSecret,
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, id))
      .returning();
    
    res.json({
      data: updated,
      message: "Webhook secret regenerated successfully",
    });
  } catch (error) {
    console.error("Error regenerating webhook secret:", error);
    res.status(500).json({ error: "Failed to regenerate webhook secret" });
  }
});

/**
 * GET /api/webhooks/:id/deliveries
 * Get webhook delivery history for an endpoint
 */
router.get("/:id/deliveries", async (req: any, res) => {
  try {
    const employerId = req.user.claims.employerId as string;
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;
    
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }
    
    // Check if endpoint exists and belongs to this employer
    const endpoint = await db.query.webhookEndpoints.findFirst({
      where: and(
        eq(webhookEndpoints.id, id),
        eq(webhookEndpoints.employerId, employerId)
      ),
    });
    
    if (!endpoint) {
      return res.status(404).json({ error: "Webhook endpoint not found" });
    }
    
    // Get deliveries
    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookEndpointId, id))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset);
    
    res.json({ data: deliveries });
  } catch (error) {
    console.error("Error fetching webhook deliveries:", error);
    res.status(500).json({ error: "Failed to fetch webhook deliveries" });
  }
});

/**
 * POST /api/webhooks/:id/test
 * Test a webhook endpoint with a sample event
 */
router.post("/:id/test", async (req: any, res) => {
  try {
    const employerId = req.user.claims.employerId as string;
    const { id } = req.params;
    
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }
    
    // Check if endpoint exists and belongs to this employer
    const endpoint = await db.query.webhookEndpoints.findFirst({
      where: and(
        eq(webhookEndpoints.id, id),
        eq(webhookEndpoints.employerId, employerId)
      ),
    });
    
    if (!endpoint) {
      return res.status(404).json({ error: "Webhook endpoint not found" });
    }
    
    // Send test webhook
    await dispatchWebhookEvent(employerId, "screening.completed", {
      id: "test-screening-id",
      status: "completed",
      testMode: true,
      message: "This is a test webhook delivery",
    });
    
    res.json({
      message: "Test webhook sent successfully",
      note: "Check the deliveries endpoint to see the result",
    });
  } catch (error) {
    console.error("Error testing webhook:", error);
    res.status(500).json({ error: "Failed to test webhook" });
  }
});

export default router;
