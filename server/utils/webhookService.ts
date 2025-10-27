import { db } from "../db";
import { webhookEndpoints, webhookDeliveries, type WebhookEndpoint, type InsertWebhookDelivery } from "../../shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import crypto from "crypto";

/**
 * Webhook Event Types
 * These are the events that can be subscribed to via webhooks
 */
export const WEBHOOK_EVENTS = {
  // Employee events
  EMPLOYEE_HIRED: "employee.hired",
  EMPLOYEE_STATUS_CHANGED: "employee.status_changed",
  
  // Screening events
  SCREENING_STARTED: "screening.started",
  SCREENING_COMPLETED: "screening.completed",
  SCREENING_CERTIFIED: "screening.certified",
  SCREENING_DENIED: "screening.denied",
  
  // Submission events
  SUBMISSION_SUBMITTED: "submission.submitted",
  SUBMISSION_CERTIFIED: "submission.certified",
  SUBMISSION_DENIED: "submission.denied",
  SUBMISSION_FAILED: "submission.failed",
  
  // Credit events
  CREDIT_CALCULATED: "credit.calculated",
  CREDIT_UPDATED: "credit.updated",
  
  // Billing events (for employers)
  INVOICE_GENERATED: "invoice.generated",
  PAYMENT_RECEIVED: "payment.received",
  PAYMENT_FAILED: "payment.failed",
} as const;

export type WebhookEvent = typeof WEBHOOK_EVENTS[keyof typeof WEBHOOK_EVENTS];

/**
 * Webhook Event Payload
 */
export interface WebhookEventPayload {
  event: WebhookEvent;
  eventId: string; // Unique ID for idempotency
  timestamp: string; // ISO 8601
  data: Record<string, any>;
  employerId: string;
}

/**
 * Generate HMAC-SHA256 signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Deliver a webhook to a single endpoint
 */
async function deliverWebhook(
  endpoint: WebhookEndpoint,
  eventType: WebhookEvent,
  eventId: string,
  payload: Record<string, any>,
  attemptNumber: number = 1,
  existingDeliveryId?: string,
  storedPayload?: WebhookEventPayload
): Promise<void> {
  // For retries, use the exact stored payload to ensure consistent signatures
  // For first attempts, create a new payload
  const webhookPayload: WebhookEventPayload = storedPayload || {
    event: eventType,
    eventId,
    timestamp: new Date().toISOString(),
    data: payload,
    employerId: endpoint.employerId,
  };
  
  const payloadString = JSON.stringify(webhookPayload);
  const signature = generateSignature(payloadString, endpoint.secret);
  
  // Prepare headers
  const headers = {
    "Content-Type": "application/json",
    "X-Webhook-Signature": signature,
    "X-Webhook-Event": eventType,
    "X-Webhook-Event-Id": eventId,
    "X-Webhook-Attempt": attemptNumber.toString(),
    "User-Agent": "WOTC-Webhook/1.0",
  };
  
  // Create initial delivery record if this is the first attempt
  let deliveryId = existingDeliveryId;
  if (!deliveryId) {
    const [newDelivery] = await db.insert(webhookDeliveries).values({
      webhookEndpointId: endpoint.id,
      eventType,
      eventId,
      payload: webhookPayload,
      headers,
      attemptNumber,
      status: "pending",
    }).returning();
    deliveryId = newDelivery.id;
    
    // Increment totalDeliveries counter on first attempt (regardless of outcome)
    await db
      .update(webhookEndpoints)
      .set({
        totalDeliveries: sql`${webhookEndpoints.totalDeliveries} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(webhookEndpoints.id, endpoint.id));
  }
  
  let startTime = Date.now();
  
  try {
    // Make HTTP POST request to webhook URL
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
    
    const responseTimeMs = Date.now() - startTime;
    const responseBody = await response.text();
    
    const isSuccess = response.status >= 200 && response.status < 300;
    
    // Update delivery record
    await db
      .update(webhookDeliveries)
      .set({
        statusCode: response.status,
        responseBody: responseBody.slice(0, 1000), // Store first 1000 chars
        responseTimeMs,
        status: isSuccess ? "success" : "failed",
        deliveredAt: isSuccess ? new Date() : undefined,
        errorMessage: isSuccess ? undefined : `HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    
    // Update endpoint statistics using SQL atomic increments
    if (isSuccess) {
      await db
        .update(webhookEndpoints)
        .set({
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: "success",
          successfulDeliveries: sql`${webhookEndpoints.successfulDeliveries} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, endpoint.id));
      
      console.log(`[Webhook] Successfully delivered ${eventType} to ${endpoint.url}`);
    } else {
      // Schedule retry if under max attempts
      if (attemptNumber < (endpoint.maxRetries || 3)) {
        const retryBackoff = (endpoint.retryBackoffSeconds || 60) * attemptNumber;
        const nextRetryAt = new Date(Date.now() + retryBackoff * 1000);
        
        // Update to retrying status with next retry time
        await db
          .update(webhookDeliveries)
          .set({
            status: "retrying",
            nextRetryAt,
          })
          .where(eq(webhookDeliveries.id, deliveryId));
        
        console.log(`[Webhook] Failed delivery ${eventType} to ${endpoint.url}, retry ${attemptNumber + 1} scheduled at ${nextRetryAt}`);
      } else {
        // Max retries exhausted - increment failed counter only
        await db
          .update(webhookEndpoints)
          .set({
            lastDeliveryAt: new Date(),
            lastDeliveryStatus: "failed",
            failedDeliveries: sql`${webhookEndpoints.failedDeliveries} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(webhookEndpoints.id, endpoint.id));
        
        console.error(`[Webhook] Max retries exhausted for ${eventType} to ${endpoint.url}`);
      }
    }
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Update delivery record with error
    await db
      .update(webhookDeliveries)
      .set({
        responseTimeMs,
        status: "failed",
        errorMessage,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    
    // Schedule retry if under max attempts
    if (attemptNumber < (endpoint.maxRetries || 3)) {
      const retryBackoff = (endpoint.retryBackoffSeconds || 60) * attemptNumber;
      const nextRetryAt = new Date(Date.now() + retryBackoff * 1000);
      
      // Update to retrying status with next retry time
      await db
        .update(webhookDeliveries)
        .set({
          status: "retrying",
          nextRetryAt,
        })
        .where(eq(webhookDeliveries.id, deliveryId));
      
      console.log(`[Webhook] Exception delivering ${eventType} to ${endpoint.url}, retry ${attemptNumber + 1} scheduled at ${nextRetryAt}`);
    } else {
      // Max retries exhausted - increment failed counter only
      await db
        .update(webhookEndpoints)
        .set({
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: "failed",
          failedDeliveries: sql`${webhookEndpoints.failedDeliveries} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, endpoint.id));
      
      console.error(`[Webhook] Max retries exhausted for ${eventType} to ${endpoint.url} after error: ${errorMessage}`);
    }
  }
}

/**
 * Dispatch webhook event to all subscribed endpoints
 */
export async function dispatchWebhookEvent(
  employerId: string,
  eventType: WebhookEvent,
  payload: Record<string, any>
): Promise<void> {
  // Generate unique event ID for idempotency
  const eventId = crypto.randomUUID();
  
  try {
    // Find all active webhook endpoints subscribed to this event
    const endpoints = await db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.employerId, employerId),
          eq(webhookEndpoints.isActive, true)
        )
      );
    
    // Filter endpoints that are subscribed to this event type
    const subscribedEndpoints = endpoints.filter((endpoint: WebhookEndpoint) =>
      endpoint.events.includes(eventType)
    );
    
    if (subscribedEndpoints.length === 0) {
      console.log(`[Webhook] No active endpoints subscribed to ${eventType} for employer ${employerId}`);
      return;
    }
    
    // Deliver to all subscribed endpoints (fire and forget, retries handled separately)
    await Promise.allSettled(
      subscribedEndpoints.map((endpoint) =>
        deliverWebhook(endpoint, eventType, eventId, payload, 1)
      )
    );
    
    console.log(`[Webhook] Dispatched ${eventType} to ${subscribedEndpoints.length} endpoint(s) for employer ${employerId}`);
  } catch (error) {
    console.error(`[Webhook] Error dispatching event ${eventType}:`, error);
  }
}

/**
 * Process pending webhook retries
 * This should be called periodically (e.g., every minute) via a cron job or background worker
 */
export async function processWebhookRetries(): Promise<void> {
  try {
    // Find deliveries that are due for retry
    const pendingRetries = await db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.status, "retrying"),
          lte(webhookDeliveries.nextRetryAt!, new Date())
        )
      )
      .limit(100); // Process in batches
    
    if (pendingRetries.length === 0) {
      return;
    }
    
    console.log(`[Webhook] Processing ${pendingRetries.length} pending webhook retries`);
    
    // Process each retry
    for (const delivery of pendingRetries) {
      // Get the webhook endpoint
      const endpoint = await db.query.webhookEndpoints.findFirst({
        where: eq(webhookEndpoints.id, delivery.webhookEndpointId),
      });
      
      if (!endpoint || !endpoint.isActive) {
        // Endpoint was deleted or disabled, mark delivery as failed
        await db
          .update(webhookDeliveries)
          .set({ status: "failed", errorMessage: "Endpoint disabled or deleted" })
          .where(eq(webhookDeliveries.id, delivery.id));
        continue;
      }
      
      // Update attempt number before retry
      await db
        .update(webhookDeliveries)
        .set({ 
          attemptNumber: (delivery.attemptNumber || 1) + 1,
        })
        .where(eq(webhookDeliveries.id, delivery.id));
      
      // Attempt redelivery with the exact stored payload for consistent signatures
      await deliverWebhook(
        endpoint,
        delivery.eventType as WebhookEvent,
        delivery.eventId,
        {}, // Placeholder - won't be used since we pass storedPayload
        (delivery.attemptNumber || 1) + 1,
        delivery.id, // Pass existing delivery ID
        delivery.payload as WebhookEventPayload // Pass stored payload for retries
      );
    }
  } catch (error) {
    console.error("[Webhook] Error processing retries:", error);
  }
}

/**
 * Verify webhook signature (for testing or debugging)
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = generateSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Store interval ID to prevent duplicate workers on hot reload
let retryWorkerIntervalId: NodeJS.Timeout | null = null;

/**
 * Start webhook retry worker
 * Runs processWebhookRetries at regular intervals
 */
export function startWebhookRetryWorker(pollInterval: number = 60000): void {
  // Clear existing worker if present (hot reload protection)
  if (retryWorkerIntervalId) {
    console.log("[Webhook Worker] Clearing existing retry worker");
    clearInterval(retryWorkerIntervalId);
    retryWorkerIntervalId = null;
  }
  
  console.log(`[Webhook Worker] Starting retry worker with ${pollInterval}ms poll interval`);
  
  // Process immediately on startup
  processWebhookRetries().catch((error) => {
    console.error("[Webhook Worker] Error during initial retry processing:", error);
  });
  
  // Then run on interval and store the interval ID
  retryWorkerIntervalId = setInterval(() => {
    processWebhookRetries().catch((error) => {
      console.error("[Webhook Worker] Error during retry processing:", error);
    });
  }, pollInterval);
}
