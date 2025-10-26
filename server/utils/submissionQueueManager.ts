/**
 * Intelligent Submission Queue Manager
 * Handles batch optimization, priority escalation, and submission scheduling
 */

import { db } from "../db";
import {
  submissionQueue,
  stateSubmissionJobs,
  statePortalConfigs,
  screenings,
  employees,
  type SubmissionQueue,
  type StateSubmissionJob,
} from "@shared/schema";
import { eq, and, lte, sql, inArray } from "drizzle-orm";

export interface BatchGroup {
  stateCode: string;
  employerId: string;
  priority: number;
  submissionWindow: string;
  queueItems: SubmissionQueue[];
  totalRecords: number;
}

export interface SubmissionBatch {
  batchId: string;
  stateCode: string;
  employerId: string;
  queueItemIds: string[];
  screeningIds: string[];
  recordCount: number;
  priority: number;
  jobId?: string;
}

/**
 * Group ready queue items by state, employer, and submission window for batch optimization
 */
export async function groupQueueItemsForBatching(): Promise<BatchGroup[]> {
  const now = new Date();

  // Get all queue items that are ready and scheduled for submission
  const readyItems = await db
    .select()
    .from(submissionQueue)
    .where(
      and(
        eq(submissionQueue.status, "ready"),
        lte(submissionQueue.scheduledSubmissionDate, now),
        sql`${submissionQueue.assignedToJobId} IS NULL` // Not yet assigned to a job
      )
    )
    .orderBy(sql`${submissionQueue.priority} DESC, ${submissionQueue.scheduledSubmissionDate} ASC`);

  // Group by state, employer, and submission window
  const groups = new Map<string, BatchGroup>();

  for (const item of readyItems) {
    const key = `${item.stateCode}|${item.employerId}|${item.submissionWindow}`;
    
    if (!groups.has(key)) {
      groups.set(key, {
        stateCode: item.stateCode,
        employerId: item.employerId,
        priority: item.priority ?? 5, // Default to 5 if null
        submissionWindow: item.submissionWindow || "daily_batch",
        queueItems: [],
        totalRecords: 0,
      });
    }

    const group = groups.get(key)!;
    group.queueItems.push(item);
    group.totalRecords++;
    
    // Update group priority to highest priority in the group
    const itemPriority = item.priority ?? 5; // Default to 5 if null
    if (itemPriority > group.priority) {
      group.priority = itemPriority;
    }
  }

  return Array.from(groups.values());
}

/**
 * Create optimized submission batches respecting state portal limits
 */
export async function createOptimizedBatches(
  groups: BatchGroup[]
): Promise<SubmissionBatch[]> {
  const batches: SubmissionBatch[] = [];

  for (const group of groups) {
    // Get state portal config for max batch size
    const [portalConfig] = await db
      .select()
      .from(statePortalConfigs)
      .where(eq(statePortalConfigs.stateCode, group.stateCode))
      .limit(1);

    const maxBatchSize = portalConfig?.maxBatchSize || 100;

    // Split large groups into multiple batches
    const sortedItems = group.queueItems.sort((a, b) => {
      // Sort by priority DESC, then by scheduled date ASC
      const priorityA = a.priority ?? 5;
      const priorityB = b.priority ?? 5;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      const dateA = a.scheduledSubmissionDate?.getTime() || 0;
      const dateB = b.scheduledSubmissionDate?.getTime() || 0;
      return dateA - dateB;
    });

    // Create batches of maxBatchSize
    for (let i = 0; i < sortedItems.length; i += maxBatchSize) {
      const batchItems = sortedItems.slice(i, i + maxBatchSize);
      const batchId = `batch_${group.stateCode}_${group.employerId}_${Date.now()}_${i}`;
      
      // Get highest priority in this batch
      const batchPriority = Math.max(...batchItems.map(item => item.priority ?? 5));

      batches.push({
        batchId,
        stateCode: group.stateCode,
        employerId: group.employerId,
        queueItemIds: batchItems.map(item => item.id),
        screeningIds: batchItems.map(item => item.screeningId),
        recordCount: batchItems.length,
        priority: batchPriority,
      });
    }
  }

  // Sort batches by priority (highest first)
  batches.sort((a, b) => b.priority - a.priority);

  return batches;
}

/**
 * Create submission jobs from optimized batches
 */
export async function createSubmissionJobsFromBatches(
  batches: SubmissionBatch[],
  submittedBy: string
): Promise<{
  created: number;
  jobIds: string[];
  errors: string[];
}> {
  let created = 0;
  const jobIds: string[] = [];
  const errors: string[] = [];

  for (const batch of batches) {
    try {
      // Use transaction to atomically create job and claim queue items
      await db.transaction(async (tx) => {
        // Create state submission job
        const [job] = await tx
          .insert(stateSubmissionJobs)
          .values({
            employerId: batch.employerId,
            stateCode: batch.stateCode,
            jobType: "auto",
            batchId: batch.batchId,
            screeningIds: batch.screeningIds,
            recordCount: batch.recordCount,
            status: "pending",
            submittedBy,
          })
          .returning();

        // Update queue items to mark them as assigned to this job
        // Use conditional update to prevent race conditions
        const updatedRows = await tx
          .update(submissionQueue)
          .set({
            status: "queued",
            assignedToJobId: job.id,
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(submissionQueue.id, batch.queueItemIds),
              eq(submissionQueue.status, "ready"),
              sql`${submissionQueue.assignedToJobId} IS NULL`
            )
          )
          .returning({ id: submissionQueue.id });

        // Verify we claimed ALL items in the batch (prevent partial claims)
        if (updatedRows.length !== batch.queueItemIds.length) {
          // Partial or no claim - rollback transaction
          errors.push(
            `Batch ${batch.batchId}: Claimed ${updatedRows.length}/${batch.queueItemIds.length} items. ` +
            `Partial claim detected - another worker claimed some items. Transaction rolled back.`
          );
          throw new Error("Partial claim - aborting transaction");
        }

        // Success - transaction will commit
        jobIds.push(job.id);
        created++;
      });

    } catch (error) {
      // Transaction was rolled back - no orphaned data
      const errorMsg = error instanceof Error && error.message === "Partial claim - aborting transaction"
        ? "" // Already logged in errors array
        : `Failed to create job for batch ${batch.batchId}: ${(error as Error).message}`;
      
      if (errorMsg) {
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  }

  return {
    created,
    jobIds,
    errors,
  };
}

/**
 * Process submission queue and create batched jobs
 * This is the main entry point for the queue manager
 */
export async function processSubmissionQueue(
  submittedBy: string = "system"
): Promise<{
  urgentProcessed: number;
  urgentJobsCreated: number;
  groupsFound: number;
  batchesCreated: number;
  jobsCreated: number;
  errors: string[];
}> {
  const allErrors: string[] = [];

  // Step 1: Process urgent submissions first (priority >= 8)
  const urgentResult = await processUrgentSubmissions(submittedBy);
  allErrors.push(...urgentResult.errors);

  // Step 2: Group remaining ready items for batching
  const groups = await groupQueueItemsForBatching();

  if (groups.length === 0) {
    return {
      urgentProcessed: urgentResult.processed,
      urgentJobsCreated: urgentResult.jobsCreated,
      groupsFound: 0,
      batchesCreated: 0,
      jobsCreated: 0,
      errors: allErrors,
    };
  }

  // Step 3: Create optimized batches
  const batches = await createOptimizedBatches(groups);

  // Step 4: Create submission jobs
  const result = await createSubmissionJobsFromBatches(batches, submittedBy);
  allErrors.push(...result.errors);

  return {
    urgentProcessed: urgentResult.processed,
    urgentJobsCreated: urgentResult.jobsCreated,
    groupsFound: groups.length,
    batchesCreated: batches.length,
    jobsCreated: result.created,
    errors: allErrors,
  };
}

/**
 * Handle priority escalation for time-sensitive submissions
 * Items with priority >= 8 bypass batching and get immediate submission
 */
export async function processUrgentSubmissions(
  submittedBy: string = "system"
): Promise<{
  processed: number;
  jobsCreated: number;
  errors: string[];
}> {
  const jobsCreated: string[] = [];
  const errors: string[] = [];

  // Get all ready items with priority >= 8 (urgent)
  const urgentItems = await db
    .select()
    .from(submissionQueue)
    .where(
      and(
        eq(submissionQueue.status, "ready"),
        sql`${submissionQueue.priority} >= 8`,
        sql`${submissionQueue.assignedToJobId} IS NULL`
      )
    )
    .orderBy(sql`${submissionQueue.priority} DESC`);

  for (const item of urgentItems) {
    try {
      // Use transaction to atomically create job and claim queue item
      await db.transaction(async (tx) => {
        // Create individual job for urgent item
        const batchId = `urgent_${item.stateCode}_${Date.now()}`;
        
        const [job] = await tx
          .insert(stateSubmissionJobs)
          .values({
            employerId: item.employerId,
            stateCode: item.stateCode,
            jobType: "auto",
            batchId,
            screeningIds: [item.screeningId],
            recordCount: 1,
            status: "pending",
            submittedBy,
          })
          .returning();

        // Update queue item with conditional check to prevent race conditions
        const updatedRows = await tx
          .update(submissionQueue)
          .set({
            status: "queued",
            assignedToJobId: job.id,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(submissionQueue.id, item.id),
              eq(submissionQueue.status, "ready"),
              sql`${submissionQueue.assignedToJobId} IS NULL`
            )
          )
          .returning({ id: submissionQueue.id });

        // Verify we actually claimed the item
        if (updatedRows.length === 0) {
          // Another worker already claimed this item - rollback transaction
          errors.push(`Urgent item ${item.id} already claimed by another worker`);
          throw new Error("Item already claimed - aborting transaction");
        }

        // Success - transaction will commit
        jobsCreated.push(job.id);
      });

    } catch (error) {
      // Transaction was rolled back - no orphaned data
      const errorMsg = error instanceof Error && error.message === "Item already claimed - aborting transaction"
        ? "" // Already logged in errors array
        : `Failed to create urgent job for item ${item.id}: ${(error as Error).message}`;
      
      if (errorMsg) {
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
  }

  return {
    processed: urgentItems.length,
    jobsCreated: jobsCreated.length,
    errors,
  };
}

/**
 * Re-queue failed submissions for retry based on backoff strategy
 */
export async function requeueFailedSubmissions(): Promise<{
  requeued: number;
  cancelled: number;
}> {
  const now = new Date();
  let requeued = 0;
  let cancelled = 0;

  // Get failed items that are ready for retry
  const failedItems = await db
    .select()
    .from(submissionQueue)
    .where(
      and(
        eq(submissionQueue.status, "failed"),
        lte(submissionQueue.nextRetryAt, now)
      )
    );

  for (const item of failedItems) {
    const maxRetries = 5; // Maximum retry attempts
    const failureCount = item.failureCount ?? 0;
    
    if (failureCount >= maxRetries) {
      // Cancel after max retries
      await db
        .update(submissionQueue)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(submissionQueue.id, item.id));
      
      cancelled++;
    } else {
      // Re-queue for retry with exponential backoff
      const retryDelayMinutes = Math.pow(2, failureCount) * 30; // 30, 60, 120, 240, 480 minutes
      const nextRetry = new Date(now.getTime() + retryDelayMinutes * 60 * 1000);

      await db
        .update(submissionQueue)
        .set({
          status: "ready",
          assignedToJobId: null,
          nextRetryAt: nextRetry,
          updatedAt: new Date(),
        })
        .where(eq(submissionQueue.id, item.id));
      
      requeued++;
    }
  }

  return {
    requeued,
    cancelled,
  };
}

/**
 * Get queue statistics for monitoring
 */
export async function getQueueStatistics(): Promise<{
  totalQueued: number;
  ready: number;
  pendingValidation: number;
  queued: number;
  inProgress: number;
  submitted: number;
  failed: number;
  cancelled: number;
  byState: Record<string, number>;
  byPriority: Record<string, number>;
  urgentCount: number;
}> {
  const stats = await db
    .select({
      status: submissionQueue.status,
      stateCode: submissionQueue.stateCode,
      priority: submissionQueue.priority,
    })
    .from(submissionQueue);

  const byState: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const statusCounts = {
    ready: 0,
    pending_validation: 0,
    queued: 0,
    in_progress: 0,
    submitted: 0,
    failed: 0,
    cancelled: 0,
  };

  let urgentCount = 0;

  for (const item of stats) {
    // Count by status
    if (item.status && item.status in statusCounts) {
      statusCounts[item.status as keyof typeof statusCounts]++;
    }

    // Count by state
    if (item.stateCode) {
      byState[item.stateCode] = (byState[item.stateCode] || 0) + 1;
    }

    // Count by priority
    if (item.priority !== null) {
      const priorityKey = item.priority.toString();
      byPriority[priorityKey] = (byPriority[priorityKey] || 0) + 1;
      
      if (item.priority >= 8) {
        urgentCount++;
      }
    }
  }

  return {
    totalQueued: stats.length,
    ready: statusCounts.ready,
    pendingValidation: statusCounts.pending_validation,
    queued: statusCounts.queued,
    inProgress: statusCounts.in_progress,
    submitted: statusCounts.submitted,
    failed: statusCounts.failed,
    cancelled: statusCounts.cancelled,
    byState,
    byPriority,
    urgentCount,
  };
}
