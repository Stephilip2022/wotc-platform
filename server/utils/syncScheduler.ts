import { db } from "../db";
import { integrationConnections } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { syncGreenhouseCandidates, pushWotcResultsToGreenhouse } from "./atsConnectors";
import { syncBambooHREmployees, pushWotcResultsToBambooHR } from "./atsConnectors";
import { syncADPPayroll, syncGustoPayroll, syncQuickBooksPayroll } from "./payrollConnectors";
import type { SyncResult } from "./payrollConnectors";

// ============================================================================
// SYNC JOB TYPES
// ============================================================================

export type SyncJobType =
  | "greenhouse_candidates"
  | "greenhouse_results"
  | "bamboohr_employees"
  | "bamboohr_status"
  | "adp_payroll"
  | "gusto_payroll"
  | "quickbooks_payroll";

export type SyncSchedule = "realtime" | "hourly" | "daily" | "weekly" | "manual";

export interface SyncJobConfig {
  connectionId: string;
  employerId: string;
  jobType: SyncJobType;
  schedule: SyncSchedule;
  enabled: boolean;
  retryAttempts: number;
  retryDelay: number; // milliseconds
}

export interface SyncJobResult {
  jobId: string;
  success: boolean;
  startedAt: Date;
  completedAt: Date;
  result: SyncResult;
  retryCount: number;
}

// ============================================================================
// SYNC JOB EXECUTOR
// ============================================================================

/**
 * Execute a sync job based on its type
 */
export async function executeSyncJob(
  config: SyncJobConfig
): Promise<SyncJobResult> {
  const startedAt = new Date();
  let result: SyncResult;
  let retryCount = 0;
  let success = false;

  // Retry logic with exponential backoff
  while (retryCount <= config.retryAttempts && !success) {
    try {
      // Execute the appropriate sync based on job type
      switch (config.jobType) {
        case "greenhouse_candidates":
          result = await syncGreenhouseCandidates(
            config.connectionId,
            config.employerId
          );
          break;

        case "bamboohr_employees":
          // Get BambooHR subdomain from connection metadata
          const [bambooConnection] = await db
            .select()
            .from(integrationConnections)
            .where(eq(integrationConnections.id, config.connectionId))
            .limit(1);
          
          const bambooSubdomain = bambooConnection?.metadata?.subdomain || "";
          result = await syncBambooHREmployees(
            config.connectionId,
            config.employerId,
            bambooSubdomain
          );
          break;

        case "adp_payroll":
          const adpStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
          const adpEndDate = new Date();
          result = await syncADPPayroll(
            config.connectionId,
            config.employerId,
            adpStartDate,
            adpEndDate
          );
          break;

        case "gusto_payroll":
          const gustoStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
          const gustoEndDate = new Date();
          result = await syncGustoPayroll(
            config.connectionId,
            config.employerId,
            gustoStartDate,
            gustoEndDate
          );
          break;

        case "quickbooks_payroll":
          const qbStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
          const qbEndDate = new Date();
          result = await syncQuickBooksPayroll(
            config.connectionId,
            config.employerId,
            qbStartDate,
            qbEndDate
          );
          break;

        default:
          throw new Error(`Unknown sync job type: ${config.jobType}`);
      }

      success = result.success;

      if (!success && retryCount < config.retryAttempts) {
        // Exponential backoff: wait before retry
        const delay = config.retryDelay * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        retryCount++;
      } else {
        break;
      }
    } catch (error) {
      result = {
        success: false,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [(error as Error).message],
        syncedRecordIds: [],
      };

      if (retryCount < config.retryAttempts) {
        // Exponential backoff: wait before retry
        const delay = config.retryDelay * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));
        retryCount++;
      } else {
        break;
      }
    }
  }

  const completedAt = new Date();

  return {
    jobId: `${config.connectionId}-${config.jobType}-${Date.now()}`,
    success: success || false,
    startedAt,
    completedAt,
    result: result!,
    retryCount,
  };
}

// ============================================================================
// SCHEDULE MANAGEMENT
// ============================================================================

/**
 * In-memory store for scheduled jobs
 * In production, this would be Redis or a job queue like Bull
 */
const scheduledJobs = new Map<string, NodeJS.Timeout>();

/**
 * Schedule a recurring sync job
 */
export function scheduleSync(config: SyncJobConfig): void {
  if (!config.enabled) {
    return;
  }

  const jobKey = `${config.connectionId}-${config.jobType}`;

  // Cancel existing job if any
  if (scheduledJobs.has(jobKey)) {
    clearInterval(scheduledJobs.get(jobKey)!);
    scheduledJobs.delete(jobKey);
  }

  let intervalMs: number;

  switch (config.schedule) {
    case "hourly":
      intervalMs = 60 * 60 * 1000; // 1 hour
      break;
    case "daily":
      intervalMs = 24 * 60 * 60 * 1000; // 24 hours
      break;
    case "weekly":
      intervalMs = 7 * 24 * 60 * 60 * 1000; // 7 days
      break;
    case "realtime":
      // Realtime syncs are triggered by webhooks, not scheduled
      return;
    case "manual":
      // Manual syncs are triggered on demand
      return;
    default:
      console.warn(`Unknown schedule type: ${config.schedule}`);
      return;
  }

  // Schedule the job
  const intervalId = setInterval(async () => {
    console.log(`Running scheduled sync: ${jobKey}`);
    try {
      const result = await executeSyncJob(config);
      console.log(`Sync completed: ${jobKey}`, {
        success: result.success,
        recordsProcessed: result.result.recordsProcessed,
        retryCount: result.retryCount,
      });
    } catch (error) {
      console.error(`Sync failed: ${jobKey}`, error);
    }
  }, intervalMs);

  scheduledJobs.set(jobKey, intervalId);

  // Also run immediately on schedule
  executeSyncJob(config)
    .then((result) => {
      console.log(`Initial sync completed: ${jobKey}`, {
        success: result.success,
        recordsProcessed: result.result.recordsProcessed,
      });
    })
    .catch((error) => {
      console.error(`Initial sync failed: ${jobKey}`, error);
    });
}

/**
 * Cancel a scheduled sync job
 */
export function cancelScheduledSync(
  connectionId: string,
  jobType: SyncJobType
): void {
  const jobKey = `${connectionId}-${jobType}`;

  if (scheduledJobs.has(jobKey)) {
    clearInterval(scheduledJobs.get(jobKey)!);
    scheduledJobs.delete(jobKey);
    console.log(`Cancelled scheduled sync: ${jobKey}`);
  }
}

/**
 * Get all active scheduled jobs
 */
export function getActiveScheduledJobs(): string[] {
  return Array.from(scheduledJobs.keys());
}

// ============================================================================
// AUTO-SCHEDULING ON STARTUP
// ============================================================================

/**
 * Initialize all scheduled syncs from database on server startup
 */
export async function initializeScheduledSyncs(): Promise<void> {
  console.log("Initializing scheduled syncs...");

  // Get all active connections
  const activeConnections = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.status, "active"));

  for (const connection of activeConnections) {
    // Determine job types based on provider
    const jobConfigs: SyncJobConfig[] = [];

    // ATS integrations
    if (connection.providerId.includes("greenhouse")) {
      jobConfigs.push({
        connectionId: connection.id,
        employerId: connection.employerId,
        jobType: "greenhouse_candidates",
        schedule: "hourly",
        enabled: true,
        retryAttempts: 3,
        retryDelay: 5000,
      });
    }

    if (connection.providerId.includes("bamboohr")) {
      jobConfigs.push({
        connectionId: connection.id,
        employerId: connection.employerId,
        jobType: "bamboohr_employees",
        schedule: "hourly",
        enabled: true,
        retryAttempts: 3,
        retryDelay: 5000,
      });
    }

    // Payroll integrations
    if (connection.providerId.includes("adp")) {
      jobConfigs.push({
        connectionId: connection.id,
        employerId: connection.employerId,
        jobType: "adp_payroll",
        schedule: "daily",
        enabled: true,
        retryAttempts: 3,
        retryDelay: 5000,
      });
    }

    if (connection.providerId.includes("gusto")) {
      jobConfigs.push({
        connectionId: connection.id,
        employerId: connection.employerId,
        jobType: "gusto_payroll",
        schedule: "daily",
        enabled: true,
        retryAttempts: 3,
        retryDelay: 5000,
      });
    }

    if (connection.providerId.includes("quickbooks")) {
      jobConfigs.push({
        connectionId: connection.id,
        employerId: connection.employerId,
        jobType: "quickbooks_payroll",
        schedule: "daily",
        enabled: true,
        retryAttempts: 3,
        retryDelay: 5000,
      });
    }

    // Schedule all jobs for this connection
    for (const config of jobConfigs) {
      scheduleSync(config);
    }
  }

  console.log(`Initialized ${scheduledJobs.size} scheduled sync jobs`);
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

/**
 * Handle incoming webhooks from integration providers
 */
export async function handleWebhook(
  providerId: string,
  webhookData: any
): Promise<SyncJobResult | null> {
  console.log(`Received webhook from provider: ${providerId}`, webhookData);

  // Find connection for this provider
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.providerId, providerId),
        eq(integrationConnections.status, "active")
      )
    )
    .limit(1);

  if (!connection) {
    console.warn(`No active connection found for provider: ${providerId}`);
    return null;
  }

  // Determine job type based on webhook event
  let jobType: SyncJobType | null = null;

  // Greenhouse webhooks
  if (providerId.includes("greenhouse")) {
    if (webhookData.action === "candidate_hired") {
      jobType = "greenhouse_candidates";
    }
  }

  // BambooHR webhooks
  if (providerId.includes("bamboohr")) {
    if (webhookData.event === "employee_added") {
      jobType = "bamboohr_employees";
    }
  }

  // Gusto webhooks
  if (providerId.includes("gusto")) {
    if (webhookData.event_type === "payroll.processed") {
      jobType = "gusto_payroll";
    }
  }

  if (!jobType) {
    console.warn(`Unknown webhook event for provider: ${providerId}`, webhookData);
    return null;
  }

  // Execute sync job immediately
  const config: SyncJobConfig = {
    connectionId: connection.id,
    employerId: connection.employerId,
    jobType,
    schedule: "realtime",
    enabled: true,
    retryAttempts: 3,
    retryDelay: 5000,
  };

  return executeSyncJob(config);
}

// ============================================================================
// MANUAL SYNC TRIGGER
// ============================================================================

/**
 * Manually trigger a sync job on demand
 */
export async function triggerManualSync(
  connectionId: string,
  jobType: SyncJobType
): Promise<SyncJobResult> {
  const [connection] = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId))
    .limit(1);

  if (!connection) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  const config: SyncJobConfig = {
    connectionId: connection.id,
    employerId: connection.employerId,
    jobType,
    schedule: "manual",
    enabled: true,
    retryAttempts: 3,
    retryDelay: 5000,
  };

  return executeSyncJob(config);
}
