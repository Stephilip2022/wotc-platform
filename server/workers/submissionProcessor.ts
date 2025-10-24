/**
 * Background Worker for State Submission Processing
 * 
 * Processes queued state submission jobs:
 * 1. Fetch eligible employees and screenings
 * 2. Validate data for state requirements
 * 3. Generate state-specific CSV
 * 4. Execute Playwright bot for portal submission
 * 5. Parse and store confirmation numbers
 * 6. Update job status and employee records
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
  stateSubmissionJobs,
  employees,
  screenings,
  employers,
  statePortalConfigs,
} from "@shared/schema";
import { generateStateCSV, validateEmployeeForSubmission } from "../utils/stateCsvGenerator";
import { createBot } from "../utils/playwrightBot";

interface ProcessingResult {
  jobId: string;
  success: boolean;
  submittedCount: number;
  failedCount: number;
  confirmationNumbers?: string[];
  errors?: string[];
}

/**
 * Process a single submission job
 */
export async function processSubmissionJob(jobId: string): Promise<ProcessingResult> {
  console.log(`[SubmissionProcessor] Starting job ${jobId}`);

  try {
    // Fetch job details
    const [job] = await db
      .select()
      .from(stateSubmissionJobs)
      .where(eq(stateSubmissionJobs.id, jobId));

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== 'pending') {
      throw new Error(`Job ${jobId} is not pending (status: ${job.status})`);
    }

    // Update job status to processing
    await db
      .update(stateSubmissionJobs)
      .set({ status: 'processing', startedAt: new Date() })
      .where(eq(stateSubmissionJobs.id, jobId));

    // Fetch employer details
    const [employer] = await db
      .select()
      .from(employers)
      .where(eq(employers.id, job.employerId));

    if (!employer) {
      throw new Error(`Employer ${job.employerId} not found`);
    }

    // Fetch state portal configuration
    const [portalConfig] = await db
      .select()
      .from(statePortalConfigs)
      .where(eq(statePortalConfigs.stateCode, job.stateCode));

    if (!portalConfig) {
      throw new Error(`State portal config not found for ${job.stateCode}`);
    }

    if (!portalConfig.active) {
      throw new Error(`State portal for ${job.stateCode} is not active`);
    }

    // Fetch eligible and certified employees with screenings
    const employeeRecords = await db
      .select({
        employee: employees,
        screening: screenings,
      })
      .from(employees)
      .innerJoin(screenings, eq(screenings.employeeId, employees.id))
      .where(
        and(
          eq(employees.employerId, job.employerId),
          // Include both eligible and certified employees for submission
          // Note: Using SQL OR since Drizzle doesn't have inArray for string literals
          // Alternative: We'll filter in code instead
        )
      );

    // Filter to only eligible and certified screenings
    const validStatusRecords = employeeRecords.filter(({ screening }) => 
      screening.status === 'eligible' || screening.status === 'certified'
    );

    if (validStatusRecords.length === 0) {
      await db
        .update(stateSubmissionJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          totalRecords: 0,
          submittedRecords: 0,
          result: { message: 'No eligible or certified employees found for submission' },
        })
        .where(eq(stateSubmissionJobs.id, jobId));

      return {
        jobId,
        success: true,
        submittedCount: 0,
        failedCount: 0,
      };
    }

    // Validate all records
    const validationErrors: Record<string, string[]> = {};
    const validRecords = validStatusRecords.filter(({ employee, screening }) => {
      const validation = validateEmployeeForSubmission(employee, screening, job.stateCode);
      if (!validation.valid) {
        validationErrors[employee.id] = validation.errors;
        return false;
      }
      return true;
    });

    console.log(`[SubmissionProcessor] ${validRecords.length}/${validStatusRecords.length} records passed validation`);

    if (validRecords.length === 0) {
      await db
        .update(stateSubmissionJobs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          totalRecords: validStatusRecords.length,
          submittedRecords: 0,
          failedRecords: validStatusRecords.length,
          result: { validationErrors },
        })
        .where(eq(stateSubmissionJobs.id, jobId));

      return {
        jobId,
        success: false,
        submittedCount: 0,
        failedCount: validStatusRecords.length,
        errors: ['All records failed validation'],
      };
    }

    // Generate CSV
    const csvData = validRecords.map(({ employee, screening }) => ({
      employee,
      screening,
      employerEin: employer.ein || '',
      employerName: employer.name,
      employerAddress: employer.address,
      employerCity: employer.city,
      employerState: employer.state,
      employerZip: employer.zipCode,
      employerPhone: employer.phone,
    }));

    const csvContent = generateStateCSV(job.stateCode, csvData);

    // Update job with total records (use validStatusRecords for consistency)
    await db
      .update(stateSubmissionJobs)
      .set({ totalRecords: validStatusRecords.length })
      .where(eq(stateSubmissionJobs.id, jobId));

    // Execute Playwright bot
    const bot = await createBot();
    const result = await bot.submitBulkCSV(portalConfig, csvContent, validRecords.length);
    await bot.close();

    console.log(`[SubmissionProcessor] Bot result:`, result);

    // Update job with results
    if (result.success) {
      await db
        .update(stateSubmissionJobs)
        .set({
          status: 'completed',
          completedAt: new Date(),
          submittedRecords: validRecords.length,
          failedRecords: validStatusRecords.length - validRecords.length,
          confirmationNumbers: result.confirmationNumbers || [],
          result: {
            message: result.message,
            validationErrors: Object.keys(validationErrors).length > 0 ? validationErrors : undefined,
          },
        })
        .where(eq(stateSubmissionJobs.id, jobId));

      // Update employee screenings to 'submitted' status
      // Note: Preserve 'certified' status if already certified, otherwise mark as submitted
      for (const { employee, screening } of validRecords) {
        await db
          .update(screenings)
          .set({ 
            status: screening.status === 'certified' ? 'certified' : 'submitted',
            updatedAt: new Date(),
          })
          .where(eq(screenings.employeeId, employee.id));
      }

      return {
        jobId,
        success: true,
        submittedCount: validRecords.length,
        failedCount: validStatusRecords.length - validRecords.length,
        confirmationNumbers: result.confirmationNumbers,
      };
    } else {
      await db
        .update(stateSubmissionJobs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          submittedRecords: 0,
          failedRecords: validStatusRecords.length,
          result: {
            message: result.message,
            errors: result.errors,
            validationErrors: Object.keys(validationErrors).length > 0 ? validationErrors : undefined,
          },
        })
        .where(eq(stateSubmissionJobs.id, jobId));

      return {
        jobId,
        success: false,
        submittedCount: 0,
        failedCount: validStatusRecords.length,
        errors: result.errors,
      };
    }
  } catch (error) {
    console.error(`[SubmissionProcessor] Job ${jobId} failed:`, error);

    // Update job to failed status
    await db
      .update(stateSubmissionJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        result: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
      .where(eq(stateSubmissionJobs.id, jobId));

    return {
      jobId,
      success: false,
      submittedCount: 0,
      failedCount: 0,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Start processing jobs (can be called from API or cron)
 */
export async function startJobProcessor() {
  console.log('[SubmissionProcessor] Checking for pending jobs...');

  const pendingJobs = await db
    .select()
    .from(stateSubmissionJobs)
    .where(eq(stateSubmissionJobs.status, 'pending'))
    .limit(5); // Process up to 5 jobs at a time

  if (pendingJobs.length === 0) {
    console.log('[SubmissionProcessor] No pending jobs found');
    return;
  }

  console.log(`[SubmissionProcessor] Found ${pendingJobs.length} pending jobs`);

  // Process jobs sequentially (could be parallelized with job queue)
  for (const job of pendingJobs) {
    await processSubmissionJob(job.id);
  }

  console.log('[SubmissionProcessor] All jobs processed');
}
