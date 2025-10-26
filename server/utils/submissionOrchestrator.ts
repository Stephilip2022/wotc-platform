import { db } from "../db";
import { stateSubmissionJobs, submissionQueue, screenings, statePortalConfigs, employees, employers } from "@shared/schema";
import { eq, and, sql, lt, or, inArray } from "drizzle-orm";
import { StatePortalBot } from "./playwrightBot";
import { generateStateCSV } from "./stateCsvGenerator";

/**
 * Configuration for the automated submission orchestrator
 */
export interface OrchestratorConfig {
  maxConcurrent: number; // Maximum concurrent submissions
  pollInterval: number; // How often to check for new jobs (ms)
  retryDelayBase: number; // Base delay for exponential backoff (ms)
  maxRetries: number; // Maximum number of retries
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  maxConcurrent: 5, // Process up to 5 submissions concurrently
  pollInterval: 60000, // Check every minute
  retryDelayBase: 5000, // 5 seconds base delay
  maxRetries: 3, // Retry up to 3 times
};

/**
 * Track currently running submissions to enforce concurrency limits
 */
let runningJobs = 0;
let orchestratorInterval: NodeJS.Timeout | null = null;

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attemptNumber: number, baseDelay: number): number {
  return baseDelay * Math.pow(2, attemptNumber - 1);
}

/**
 * Process a single submission job
 */
async function processSubmissionJob(
  jobId: string,
  config: OrchestratorConfig
): Promise<void> {
  runningJobs++;
  
  try {
    // Get the job details
    const [job] = await db
      .select()
      .from(stateSubmissionJobs)
      .where(eq(stateSubmissionJobs.id, jobId));

    if (!job) {
      console.error(`Job ${jobId} not found`);
      return;
    }

    console.log(`[Orchestrator] Processing job ${jobId} for ${job.stateCode} (attempt ${(job.retryCount ?? 0) + 1})`);

    // Get portal configuration
    const [portalConfig] = await db
      .select()
      .from(statePortalConfigs)
      .where(eq(statePortalConfigs.stateCode, job.stateCode));

    if (!portalConfig) {
      throw new Error(`No portal configuration found for state ${job.stateCode}`);
    }

    // Check if automation is enabled
    if (!portalConfig.automationEnabled) {
      throw new Error(`Automation not enabled for state ${job.stateCode}`);
    }

    // Get screenings data
    const screeningIds = job.screeningIds ?? [];
    if (screeningIds.length === 0) {
      throw new Error("No screenings to submit");
    }

    // Get employer details
    const [employer] = await db
      .select()
      .from(employers)
      .where(eq(employers.id, job.employerId));

    if (!employer) {
      throw new Error(`Employer ${job.employerId} not found`);
    }

    // Get screenings with employee data
    const screeningsData = await db
      .select({
        screening: screenings,
        employee: employees,
      })
      .from(screenings)
      .innerJoin(employees, eq(screenings.employeeId, employees.id))
      .where(inArray(screenings.id, screeningIds));

    if (screeningsData.length === 0) {
      throw new Error("No valid screenings found");
    }

    // Format data for CSV generator
    const records = screeningsData.map(({ screening, employee }) => ({
      employee,
      screening,
      employerEin: employer.ein || "",
      employerName: employer.name,
      employerAddress: employer.address ?? undefined,
      employerCity: employer.city ?? undefined,
      employerState: employer.state ?? undefined,
      employerZip: employer.zipCode ?? undefined,
    }));

    // Generate CSV for submission
    const csvContent = generateStateCSV(job.stateCode, records);

    // Initialize Playwright bot and submit
    const bot = new StatePortalBot();
    let result: {
      success: boolean;
      message?: string;
      error?: string;
      confirmationNumber?: string;
      confirmationNumbers?: string[];
      submittedCount?: number;
    };
    
    try {
      await bot.initialize();
      
      const botResult = await bot.submitBulkCSV(
        portalConfig,
        csvContent,
        screeningIds.length
      );
      
      result = {
        success: botResult.success,
        message: botResult.message,
        error: botResult.success ? undefined : botResult.message,
        confirmationNumber: botResult.confirmationNumbers?.[0],
        submittedCount: botResult.success ? screeningIds.length : 0,
      };
    } finally {
      await bot.close();
    }

    // Update job and queue items based on result
    // Use transaction to ensure atomicity
    if (result.success) {
      console.log(`[Orchestrator] Job ${jobId} completed successfully`);
      
      await db.transaction(async (tx) => {
        // Update job status to "completed"
        await tx
          .update(stateSubmissionJobs)
          .set({
            status: "completed",
            completedAt: new Date(),
            confirmationNumber: result.confirmationNumber,
            successCount: result.submittedCount ?? 0,
            updatedAt: new Date(),
          })
          .where(eq(stateSubmissionJobs.id, jobId));

        // Update queue items to "submitted"
        await tx
          .update(submissionQueue)
          .set({
            status: "submitted",
            submittedAt: new Date(),
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(submissionQueue.assignedToJobId, jobId));
      });

    } else {
      // Submission failed - check if we should retry
      const retryCount = (job.retryCount ?? 0) + 1;
      
      if (retryCount < config.maxRetries) {
        // Schedule retry with exponential backoff
        const backoffDelay = calculateBackoffDelay(retryCount, config.retryDelayBase);
        const nextRetryAt = new Date(Date.now() + backoffDelay);
        
        console.log(`[Orchestrator] Job ${jobId} failed (attempt ${retryCount}). Retrying at ${nextRetryAt.toISOString()}`);
        
        await db.transaction(async (tx) => {
          // Update job to retry
          await tx
            .update(stateSubmissionJobs)
            .set({
              status: "pending", // Back to pending for retry
              retryCount,
              nextRetryAt,
              errorMessage: result.error,
              updatedAt: new Date(),
            })
            .where(eq(stateSubmissionJobs.id, jobId));

          // Update queue items back to ready for retry
          await tx
            .update(submissionQueue)
            .set({
              status: "ready",
              updatedAt: new Date(),
            })
            .where(eq(submissionQueue.assignedToJobId, jobId));
        });

      } else {
        // Max retries exceeded - mark as failed
        console.error(`[Orchestrator] Job ${jobId} failed after ${retryCount} attempts: ${result.error}`);
        
        await db.transaction(async (tx) => {
          // Update job to failed
          await tx
            .update(stateSubmissionJobs)
            .set({
              status: "failed",
              errorMessage: result.error,
              updatedAt: new Date(),
            })
            .where(eq(stateSubmissionJobs.id, jobId));

          // Update queue items to failed
          await tx
            .update(submissionQueue)
            .set({
              status: "failed",
              lastFailureReason: result.error,
              failureCount: sql`COALESCE(${submissionQueue.failureCount}, 0) + 1`,
              updatedAt: new Date(),
            })
            .where(eq(submissionQueue.assignedToJobId, jobId));
        });
      }
    }

  } catch (error) {
    console.error(`[Orchestrator] Error processing job ${jobId}:`, error);
    
    // Update job and queue items to failed status
    await db.transaction(async (tx) => {
      await tx
        .update(stateSubmissionJobs)
        .set({
          status: "failed",
          errorMessage: `Orchestrator error: ${(error as Error).message}`,
          updatedAt: new Date(),
        })
        .where(eq(stateSubmissionJobs.id, jobId));

      await tx
        .update(submissionQueue)
        .set({
          status: "failed",
          lastFailureReason: `Orchestrator error: ${(error as Error).message}`,
          failureCount: sql`COALESCE(${submissionQueue.failureCount}, 0) + 1`,
          updatedAt: new Date(),
        })
        .where(eq(submissionQueue.assignedToJobId, jobId));
    });

  } finally {
    runningJobs--;
  }
}

/**
 * Atomically claim a job AND its queue items by updating statuses to "in_progress"
 * Returns true if successfully claimed, false if already claimed by another worker
 */
async function claimJob(jobId: string): Promise<boolean> {
  try {
    let claimed = false;

    await db.transaction(async (tx) => {
      // Atomically claim the job by updating status to in_progress
      // Only succeeds if status is still "pending"
      const claimedJobs = await tx
        .update(stateSubmissionJobs)
        .set({
          status: "in_progress",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(stateSubmissionJobs.id, jobId),
            eq(stateSubmissionJobs.status, "pending")
          )
        )
        .returning({ id: stateSubmissionJobs.id });

      // If we successfully claimed the job, also update queue items
      if (claimedJobs.length > 0) {
        // Update associated queue items to "in_progress"
        await tx
          .update(submissionQueue)
          .set({
            status: "in_progress",
            updatedAt: new Date(),
          })
          .where(eq(submissionQueue.assignedToJobId, jobId));

        claimed = true;
      }
    });

    return claimed;
  } catch (error) {
    console.error(`[Orchestrator] Error claiming job ${jobId}:`, error);
    return false;
  }
}

/**
 * Poll for pending jobs and process them
 */
async function pollForJobs(config: OrchestratorConfig): Promise<void> {
  try {
    // Check how many slots are available
    const availableSlots = config.maxConcurrent - runningJobs;
    if (availableSlots <= 0) {
      console.log(`[Orchestrator] At max concurrency (${runningJobs}/${config.maxConcurrent}), skipping poll`);
      return;
    }

    const now = new Date();

    // Get pending jobs that are ready to run
    // Include jobs with no nextRetryAt, or jobs whose nextRetryAt has passed
    const pendingJobs = await db
      .select()
      .from(stateSubmissionJobs)
      .where(
        and(
          eq(stateSubmissionJobs.status, "pending"),
          or(
            sql`${stateSubmissionJobs.nextRetryAt} IS NULL`,
            lt(stateSubmissionJobs.nextRetryAt, now)
          )
        )
      )
      .orderBy(sql`${stateSubmissionJobs.createdAt} ASC`)
      .limit(availableSlots);

    if (pendingJobs.length === 0) {
      return; // No jobs to process
    }

    console.log(`[Orchestrator] Found ${pendingJobs.length} pending jobs, attempting to claim...`);

    // Atomically claim and process jobs
    for (const job of pendingJobs) {
      // Try to claim the job atomically
      const claimed = await claimJob(job.id);
      
      if (claimed) {
        // Successfully claimed - process it (don't await - let them run concurrently)
        processSubmissionJob(job.id, config).catch(error => {
          console.error(`[Orchestrator] Unhandled error processing job ${job.id}:`, error);
        });
      } else {
        console.log(`[Orchestrator] Job ${job.id} already claimed by another worker`);
      }
    }

  } catch (error) {
    console.error("[Orchestrator] Error in pollForJobs:", error);
  }
}

/**
 * Start the automated submission orchestrator
 */
export function startOrchestrator(config: Partial<OrchestratorConfig> = {}): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (orchestratorInterval) {
    console.log("[Orchestrator] Already running");
    return;
  }

  console.log(`[Orchestrator] Starting with maxConcurrent=${finalConfig.maxConcurrent}, pollInterval=${finalConfig.pollInterval}ms`);

  // Start polling interval
  orchestratorInterval = setInterval(() => {
    pollForJobs(finalConfig);
  }, finalConfig.pollInterval);

  // Run immediately on start
  pollForJobs(finalConfig);
}

/**
 * Stop the automated submission orchestrator
 */
export function stopOrchestrator(): void {
  if (orchestratorInterval) {
    clearInterval(orchestratorInterval);
    orchestratorInterval = null;
    console.log("[Orchestrator] Stopped");
  }
}

/**
 * Get orchestrator status
 */
export function getOrchestratorStatus(): {
  running: boolean;
  activeJobs: number;
} {
  return {
    running: orchestratorInterval !== null,
    activeJobs: runningJobs,
  };
}
