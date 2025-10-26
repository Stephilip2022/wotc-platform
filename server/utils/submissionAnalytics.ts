import { db } from "../db";
import { stateSubmissionJobs, submissionQueue, employers } from "@shared/schema";
import { eq, and, gte, lte, sql, count, desc } from "drizzle-orm";

export interface SubmissionMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  inProgressJobs: number;
  pendingJobs: number;
  
  successRate: number; // Percentage
  averageProcessingTime: number; // Minutes
  
  totalScreenings: number;
  submittedScreenings: number;
  failedScreenings: number;
  
  byState: {
    stateCode: string;
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  }[];
  
  byEmployer: {
    employerId: string;
    employerName: string;
    total: number;
    completed: number;
    failed: number;
  }[];
  
  recentFailures: {
    jobId: string;
    stateCode: string;
    employerName: string;
    errorMessage: string | null;
    createdAt: Date;
    retryCount: number;
  }[];
}

export interface JobDetail {
  id: string;
  employerName: string;
  stateCode: string;
  status: string;
  recordCount: number;
  successCount: number | null;
  failureCount: number | null;
  confirmationNumber: string | null;
  errorMessage: string | null;
  retryCount: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

/**
 * Get comprehensive submission metrics for monitoring dashboard
 */
export async function getSubmissionMetrics(
  startDate?: Date,
  endDate?: Date
): Promise<SubmissionMetrics> {
  const whereConditions = [];
  
  if (startDate) {
    whereConditions.push(gte(stateSubmissionJobs.createdAt, startDate));
  }
  if (endDate) {
    whereConditions.push(lte(stateSubmissionJobs.createdAt, endDate));
  }

  // Get job status counts
  const jobStats = await db
    .select({
      status: stateSubmissionJobs.status,
      count: count(stateSubmissionJobs.id),
    })
    .from(stateSubmissionJobs)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .groupBy(stateSubmissionJobs.status);

  const totalJobs = jobStats.reduce((sum: number, s: any) => sum + Number(s.count), 0);
  const completedJobs = jobStats.find((s: any) => s.status === "completed")?.count || 0;
  const failedJobs = jobStats.find((s: any) => s.status === "failed")?.count || 0;
  const inProgressJobs = jobStats.find((s: any) => s.status === "in_progress")?.count || 0;
  const pendingJobs = jobStats.find((s: any) => s.status === "pending")?.count || 0;

  const successRate = totalJobs > 0 ? (Number(completedJobs) / totalJobs) * 100 : 0;

  // Calculate average processing time for completed jobs
  const completedJobsData = await db
    .select({
      startedAt: stateSubmissionJobs.startedAt,
      completedAt: stateSubmissionJobs.completedAt,
    })
    .from(stateSubmissionJobs)
    .where(
      and(
        eq(stateSubmissionJobs.status, "completed"),
        whereConditions.length > 0 ? and(...whereConditions) : undefined
      )
    );

  let totalProcessingMinutes = 0;
  let processedCount = 0;

  for (const job of completedJobsData) {
    if (job.startedAt && job.completedAt) {
      const durationMs = job.completedAt.getTime() - job.startedAt.getTime();
      totalProcessingMinutes += durationMs / (1000 * 60);
      processedCount++;
    }
  }

  const averageProcessingTime = processedCount > 0 ? totalProcessingMinutes / processedCount : 0;

  // Get queue statistics
  const queueStats = await db
    .select({
      status: submissionQueue.status,
      count: count(submissionQueue.id),
    })
    .from(submissionQueue)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .groupBy(submissionQueue.status);

  const totalScreenings = queueStats.reduce((sum: number, s: any) => sum + Number(s.count), 0);
  const submittedScreenings = queueStats.find((s: any) => s.status === "submitted")?.count || 0;
  const failedScreenings = queueStats.find((s: any) => s.status === "failed")?.count || 0;

  // Get breakdown by state
  const stateBreakdown = await db
    .select({
      stateCode: stateSubmissionJobs.stateCode,
      status: stateSubmissionJobs.status,
      count: count(stateSubmissionJobs.id),
    })
    .from(stateSubmissionJobs)
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .groupBy(stateSubmissionJobs.stateCode, stateSubmissionJobs.status);

  // Aggregate by state
  const stateMap = new Map<string, { total: number; completed: number; failed: number }>();
  
  for (const row of stateBreakdown) {
    if (!stateMap.has(row.stateCode)) {
      stateMap.set(row.stateCode, { total: 0, completed: 0, failed: 0 });
    }
    
    const state = stateMap.get(row.stateCode)!;
    state.total += Number(row.count);
    
    if (row.status === "completed") {
      state.completed += Number(row.count);
    } else if (row.status === "failed") {
      state.failed += Number(row.count);
    }
  }

  const byState = Array.from(stateMap.entries()).map(([stateCode, stats]) => ({
    stateCode,
    total: stats.total,
    completed: stats.completed,
    failed: stats.failed,
    successRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
  }));

  // Get breakdown by employer
  const employerBreakdown = await db
    .select({
      employerId: stateSubmissionJobs.employerId,
      employerName: employers.name,
      status: stateSubmissionJobs.status,
      count: count(stateSubmissionJobs.id),
    })
    .from(stateSubmissionJobs)
    .innerJoin(employers, eq(stateSubmissionJobs.employerId, employers.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .groupBy(stateSubmissionJobs.employerId, employers.name, stateSubmissionJobs.status);

  // Aggregate by employer
  const employerMap = new Map<string, { employerName: string; total: number; completed: number; failed: number }>();
  
  for (const row of employerBreakdown) {
    if (!employerMap.has(row.employerId)) {
      employerMap.set(row.employerId, {
        employerName: row.employerName,
        total: 0,
        completed: 0,
        failed: 0,
      });
    }
    
    const emp = employerMap.get(row.employerId)!;
    emp.total += Number(row.count);
    
    if (row.status === "completed") {
      emp.completed += Number(row.count);
    } else if (row.status === "failed") {
      emp.failed += Number(row.count);
    }
  }

  const byEmployer = Array.from(employerMap.entries()).map(([employerId, stats]) => ({
    employerId,
    employerName: stats.employerName,
    total: stats.total,
    completed: stats.completed,
    failed: stats.failed,
  }));

  // Get recent failures (last 20)
  const failures = await db
    .select({
      jobId: stateSubmissionJobs.id,
      stateCode: stateSubmissionJobs.stateCode,
      employerName: employers.name,
      errorMessage: stateSubmissionJobs.errorMessage,
      createdAt: stateSubmissionJobs.createdAt,
      retryCount: stateSubmissionJobs.retryCount,
    })
    .from(stateSubmissionJobs)
    .innerJoin(employers, eq(stateSubmissionJobs.employerId, employers.id))
    .where(eq(stateSubmissionJobs.status, "failed"))
    .orderBy(desc(stateSubmissionJobs.createdAt))
    .limit(20);

  return {
    totalJobs,
    completedJobs: Number(completedJobs),
    failedJobs: Number(failedJobs),
    inProgressJobs: Number(inProgressJobs),
    pendingJobs: Number(pendingJobs),
    successRate: Math.round(successRate * 10) / 10,
    averageProcessingTime: Math.round(averageProcessingTime * 10) / 10,
    totalScreenings,
    submittedScreenings: Number(submittedScreenings),
    failedScreenings: Number(failedScreenings),
    byState,
    byEmployer,
    recentFailures: failures,
  };
}

/**
 * Get detailed job list with employer information
 */
export async function getJobDetails(
  status?: string,
  stateCode?: string,
  employerId?: string,
  limit: number = 50
): Promise<JobDetail[]> {
  const whereConditions = [];
  
  if (status) {
    whereConditions.push(eq(stateSubmissionJobs.status, status));
  }
  if (stateCode) {
    whereConditions.push(eq(stateSubmissionJobs.stateCode, stateCode));
  }
  if (employerId) {
    whereConditions.push(eq(stateSubmissionJobs.employerId, employerId));
  }

  const jobs = await db
    .select({
      id: stateSubmissionJobs.id,
      employerName: employers.name,
      stateCode: stateSubmissionJobs.stateCode,
      status: stateSubmissionJobs.status,
      recordCount: stateSubmissionJobs.recordCount,
      successCount: stateSubmissionJobs.successCount,
      failureCount: stateSubmissionJobs.failureCount,
      confirmationNumber: stateSubmissionJobs.confirmationNumber,
      errorMessage: stateSubmissionJobs.errorMessage,
      retryCount: stateSubmissionJobs.retryCount,
      startedAt: stateSubmissionJobs.startedAt,
      completedAt: stateSubmissionJobs.completedAt,
      createdAt: stateSubmissionJobs.createdAt,
    })
    .from(stateSubmissionJobs)
    .innerJoin(employers, eq(stateSubmissionJobs.employerId, employers.id))
    .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
    .orderBy(desc(stateSubmissionJobs.createdAt))
    .limit(limit);

  return jobs;
}

/**
 * Detect submission anomalies that should trigger alerts
 */
export async function detectAnomalies(): Promise<{
  highFailureRates: { stateCode: string; failureRate: number; count: number }[];
  stuckJobs: { jobId: string; stateCode: string; startedAt: Date }[];
  repeatedFailures: { screeningId: string; failureCount: number }[];
}> {
  // 1. Check for states with high failure rates (>30% in last 24 hours)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const recentJobs = await db
    .select({
      stateCode: stateSubmissionJobs.stateCode,
      status: stateSubmissionJobs.status,
      count: count(stateSubmissionJobs.id),
    })
    .from(stateSubmissionJobs)
    .where(gte(stateSubmissionJobs.createdAt, yesterday))
    .groupBy(stateSubmissionJobs.stateCode, stateSubmissionJobs.status);

  const stateMap = new Map<string, { total: number; failed: number }>();
  
  for (const row of recentJobs) {
    if (!stateMap.has(row.stateCode)) {
      stateMap.set(row.stateCode, { total: 0, failed: 0 });
    }
    
    const state = stateMap.get(row.stateCode)!;
    state.total += Number(row.count);
    
    if (row.status === "failed") {
      state.failed += Number(row.count);
    }
  }

  const highFailureRates = Array.from(stateMap.entries())
    .filter(([_, stats]) => stats.total >= 3 && (stats.failed / stats.total) > 0.3)
    .map(([stateCode, stats]) => ({
      stateCode,
      failureRate: Math.round((stats.failed / stats.total) * 100),
      count: stats.total,
    }));

  // 2. Check for stuck jobs (in_progress for >30 minutes)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  
  const stuckJobs = await db
    .select({
      jobId: stateSubmissionJobs.id,
      stateCode: stateSubmissionJobs.stateCode,
      startedAt: stateSubmissionJobs.startedAt,
    })
    .from(stateSubmissionJobs)
    .where(
      and(
        eq(stateSubmissionJobs.status, "in_progress"),
        lte(stateSubmissionJobs.startedAt, thirtyMinutesAgo)
      )
    );

  // 3. Check for screenings with repeated failures (>3 failures)
  const repeatedFailures = await db
    .select({
      screeningId: submissionQueue.screeningId,
      failureCount: submissionQueue.failureCount,
    })
    .from(submissionQueue)
    .where(sql`${submissionQueue.failureCount} > 3`);

  return {
    highFailureRates,
    stuckJobs: stuckJobs.filter((j: any) => j.startedAt !== null) as any,
    repeatedFailures: repeatedFailures.filter((r: any) => r.failureCount !== null) as any,
  };
}
