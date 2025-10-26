/**
 * Submission Readiness Detection Engine
 * Automatically detects when screenings are ready for state portal submission
 */

import { db } from "../db";
import {
  screenings,
  employees,
  employers,
  submissionQueue,
  statePortalConfigs,
  type SubmissionQueue,
  type Screening,
} from "@shared/schema";
import { eq, and, isNull, notInArray, sql } from "drizzle-orm";

export interface ReadinessValidation {
  isReady: boolean;
  score: number; // 0-100
  missingFields: string[];
  errors: Array<{ field: string; error: string }>;
  recommendation: string;
  stateCode: string | null;
}

export interface PriorityCalculation {
  priority: number; // 1-10
  urgencyReason: string | null;
  scheduledSubmissionDate: Date;
  submissionWindow: "immediate" | "hourly_batch" | "daily_batch" | "weekly_batch";
}

/**
 * Validate if a screening is ready for submission to state portal
 */
export async function validateScreeningReadiness(
  screeningId: string
): Promise<ReadinessValidation> {
  // Fetch screening with related employee and employer data
  const [screening] = await db
    .select({
      screening: screenings,
      employee: employees,
      employer: employers,
    })
    .from(screenings)
    .innerJoin(employees, eq(screenings.employeeId, employees.id))
    .innerJoin(employers, eq(screenings.employerId, employers.id))
    .where(eq(screenings.id, screeningId))
    .limit(1);

  if (!screening) {
    return {
      isReady: false,
      score: 0,
      missingFields: ["screening_not_found"],
      errors: [{ field: "screening", error: "Screening not found" }],
      recommendation: "Screening does not exist",
      stateCode: null,
    };
  }

  const { screening: scr, employee: emp, employer: empl } = screening;
  
  // Determine state code (from employee address or employer)
  const stateCode = emp.state || empl.state;
  
  if (!stateCode) {
    return {
      isReady: false,
      score: 0,
      missingFields: ["state_code"],
      errors: [{ field: "state", error: "No state code available for employee or employer" }],
      recommendation: "Update employee or employer address with state information",
      stateCode: null,
    };
  }

  // Get state portal configuration
  const [portalConfig] = await db
    .select()
    .from(statePortalConfigs)
    .where(eq(statePortalConfigs.stateCode, stateCode))
    .limit(1);

  if (!portalConfig) {
    return {
      isReady: false,
      score: 20,
      missingFields: ["state_portal_config"],
      errors: [{ field: "state", error: `No portal configuration for state ${stateCode}` }],
      recommendation: `State portal ${stateCode} not configured in system`,
      stateCode,
    };
  }

  // Check if automation is enabled for this state
  if (!portalConfig.automationEnabled) {
    return {
      isReady: false,
      score: 30,
      missingFields: ["automation_disabled"],
      errors: [{ field: "automation", error: `Auto-submission not enabled for ${stateCode}` }],
      recommendation: `Enable automation for ${portalConfig.stateName} portal or submit manually`,
      stateCode,
    };
  }

  const missingFields: string[] = [];
  const errors: Array<{ field: string; error: string }> = [];

  // 1. Check screening status - must be "eligible" or "certified"
  if (!["eligible", "certified"].includes(scr.status || "")) {
    missingFields.push("screening_status");
    errors.push({
      field: "status",
      error: `Screening status is "${scr.status}". Must be "eligible" or "certified" for submission.`,
    });
  }

  // 2. Validate required employee fields based on state requirements
  const requiredColumns = portalConfig.requiredColumns || [];
  
  for (const column of requiredColumns) {
    const normalized = column.toLowerCase().replace(/\s+/g, "_");
    
    if (normalized.includes("last_name") && !emp.lastName) {
      missingFields.push("employee_last_name");
      errors.push({ field: "lastName", error: "Employee last name is required" });
    }
    
    if (normalized.includes("first_name") && !emp.firstName) {
      missingFields.push("employee_first_name");
      errors.push({ field: "firstName", error: "Employee first name is required" });
    }
    
    if (normalized.includes("ssn") && !emp.ssn) {
      missingFields.push("employee_ssn");
      errors.push({ field: "ssn", error: "Employee SSN is required" });
    }
    
    if (normalized.includes("date_of_birth") && !emp.dateOfBirth) {
      missingFields.push("employee_dob");
      errors.push({ field: "dateOfBirth", error: "Employee date of birth is required" });
    }
    
    if (normalized.includes("hire_date") && !emp.hireDate) {
      missingFields.push("employee_hire_date");
      errors.push({ field: "hireDate", error: "Employee hire date is required" });
    }
  }

  // 3. Check for target group classification
  if (!scr.primaryTargetGroup) {
    missingFields.push("primary_target_group");
    errors.push({ field: "targetGroup", error: "No primary target group assigned" });
  }

  // 4. Check for form generation (IRS Form 8850 should be generated)
  if (!scr.form8850Generated) {
    missingFields.push("form_8850");
    errors.push({
      field: "form8850",
      error: "IRS Form 8850 has not been generated",
    });
  }

  // 5. Validate employer has credentials for state portal
  if (portalConfig.authType === "credentials") {
    const credentials = portalConfig.credentials as { userId?: string; password?: string } | null;
    if (!credentials?.userId || !credentials?.password) {
      missingFields.push("portal_credentials");
      errors.push({
        field: "credentials",
        error: `Missing state portal credentials for ${stateCode}`,
      });
    }
  }

  // Calculate readiness score (0-100)
  let score = 100;
  
  // Deduct points for each missing field
  score -= missingFields.length * 15;
  
  // Minimum score is 0
  score = Math.max(0, score);

  const isReady = missingFields.length === 0 && errors.length === 0;

  let recommendation = "";
  if (isReady) {
    recommendation = `Ready for auto-submission to ${portalConfig.stateName}`;
  } else {
    recommendation = `Complete ${missingFields.length} missing requirement(s) before submission`;
  }

  return {
    isReady,
    score,
    missingFields,
    errors,
    recommendation,
    stateCode,
  };
}

/**
 * Calculate submission priority and scheduling
 */
export function calculateSubmissionPriority(
  screening: Screening,
  employee: { hireDate: string | null },
  portalConfig: { submissionFrequency: string | null }
): PriorityCalculation {
  let priority = 5; // Default: normal priority
  let urgencyReason: string | null = null;
  const now = new Date();
  let scheduledSubmissionDate = new Date();
  let submissionWindow: "immediate" | "hourly_batch" | "daily_batch" | "weekly_batch" = "daily_batch";

  // Check hire date urgency (45-day deadline for WOTC submission)
  if (employee.hireDate) {
    const hireDate = new Date(employee.hireDate);
    const daysSinceHire = Math.floor((now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceHire >= 38) {
      // 38+ days since hire - URGENT (7 days or less remaining)
      priority = 10;
      urgencyReason = "Critical: Only " + (45 - daysSinceHire) + " days remaining before WOTC deadline";
      submissionWindow = "immediate";
      scheduledSubmissionDate = new Date(); // Immediate submission
    } else if (daysSinceHire >= 30) {
      // 30-37 days since hire - HIGH priority
      priority = 8;
      urgencyReason = "High priority: " + (45 - daysSinceHire) + " days remaining before deadline";
      submissionWindow = "hourly_batch";
      scheduledSubmissionDate = new Date(now.getTime() + 60 * 60 * 1000); // Next hour
    } else if (daysSinceHire >= 21) {
      // 21-29 days since hire - ELEVATED priority
      priority = 7;
      urgencyReason = "Elevated priority: " + (45 - daysSinceHire) + " days remaining";
      submissionWindow = "daily_batch";
      // Clone date before mutation to avoid side effects
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      scheduledSubmissionDate = endOfToday;
    }
  }

  // Adjust based on portal submission frequency
  if (priority < 8) {
    const frequency = portalConfig.submissionFrequency || "daily";
    
    if (frequency === "weekly") {
      submissionWindow = "weekly_batch";
      // Schedule for next Monday at 9am (clone date to avoid mutation)
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + ((1 + 7 - now.getDay()) % 7 || 7));
      nextMonday.setHours(9, 0, 0, 0);
      scheduledSubmissionDate = nextMonday;
    } else if (frequency === "daily") {
      submissionWindow = "daily_batch";
      // Schedule for today at 11:59 PM or tomorrow at 9am if past 6pm
      if (now.getHours() >= 18) {
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        scheduledSubmissionDate = tomorrow;
      } else {
        // Clone date before mutation
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);
        scheduledSubmissionDate = endOfToday;
      }
    }
  }

  return {
    priority,
    urgencyReason,
    scheduledSubmissionDate,
    submissionWindow,
  };
}

/**
 * Scan for ready screenings and add them to the submission queue
 * This function is called periodically by a background job
 */
export async function scanAndQueueReadyScreenings(): Promise<{
  scanned: number;
  queued: number;
  alreadyQueued: number;
  notReady: number;
}> {
  let scanned = 0;
  let queued = 0;
  let alreadyQueued = 0;
  let notReady = 0;

  // First, get all screening IDs that are already in queue with active status
  const queuedScreeningIds = await db
    .select({ screeningId: submissionQueue.screeningId })
    .from(submissionQueue)
    .where(sql`${submissionQueue.status} IN ('pending_validation', 'ready', 'queued', 'in_progress')`);

  const queuedIds = queuedScreeningIds.map(r => r.screeningId);

  // Get all screenings that are eligible or certified but not yet queued
  const eligibleScreenings = await db
    .select({
      screening: screenings,
      employee: employees,
      employer: employers,
    })
    .from(screenings)
    .innerJoin(employees, eq(screenings.employeeId, employees.id))
    .innerJoin(employers, eq(screenings.employerId, employers.id))
    .where(
      and(
        sql`${screenings.status} IN ('eligible', 'certified')`,
        // Not already in active queue
        queuedIds.length > 0 ? notInArray(screenings.id, queuedIds) : sql`1=1`
      )
    );

  scanned = eligibleScreenings.length;

  for (const record of eligibleScreenings) {
    const { screening: scr, employee: emp, employer: empl } = record;

    // Check if already in queue
    const [existing] = await db
      .select()
      .from(submissionQueue)
      .where(eq(submissionQueue.screeningId, scr.id))
      .limit(1);

    if (existing) {
      alreadyQueued++;
      continue;
    }

    // Validate readiness
    const validation = await validateScreeningReadiness(scr.id);
    
    if (!validation.stateCode) {
      notReady++;
      continue;
    }

    // Get portal config for priority calculation
    const [portalConfig] = await db
      .select()
      .from(statePortalConfigs)
      .where(eq(statePortalConfigs.stateCode, validation.stateCode))
      .limit(1);

    if (!portalConfig) {
      notReady++;
      continue;
    }

    // Calculate priority
    const priorityCalc = calculateSubmissionPriority(scr, emp, portalConfig);

    // Add to queue
    await db.insert(submissionQueue).values({
      screeningId: scr.id,
      employerId: scr.employerId,
      employeeId: scr.employeeId,
      stateCode: validation.stateCode,
      status: validation.isReady ? "ready" : "pending_validation",
      readinessScore: validation.score,
      missingFields: validation.missingFields,
      validationErrors: validation.errors,
      lastValidationResult: validation,
      priority: priorityCalc.priority,
      scheduledSubmissionDate: priorityCalc.scheduledSubmissionDate,
      submissionWindow: priorityCalc.submissionWindow,
      urgencyReason: priorityCalc.urgencyReason,
      lastValidatedAt: new Date(),
      detectedBySystem: true,
    });

    if (validation.isReady) {
      queued++;
    } else {
      notReady++;
    }
  }

  return {
    scanned,
    queued,
    alreadyQueued,
    notReady,
  };
}

/**
 * Re-validate existing queue items to update their readiness status
 */
export async function revalidateQueueItems(): Promise<{
  validated: number;
  nowReady: number;
  stillNotReady: number;
}> {
  let validated = 0;
  let nowReady = 0;
  let stillNotReady = 0;

  // Get all pending_validation items
  const pendingItems = await db
    .select()
    .from(submissionQueue)
    .where(eq(submissionQueue.status, "pending_validation"));

  for (const item of pendingItems) {
    const validation = await validateScreeningReadiness(item.screeningId);
    
    validated++;

    await db
      .update(submissionQueue)
      .set({
        status: validation.isReady ? "ready" : "pending_validation",
        readinessScore: validation.score,
        missingFields: validation.missingFields,
        validationErrors: validation.errors,
        lastValidationResult: validation,
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(submissionQueue.id, item.id));

    if (validation.isReady) {
      nowReady++;
    } else {
      stillNotReady++;
    }
  }

  return {
    validated,
    nowReady,
    stillNotReady,
  };
}
