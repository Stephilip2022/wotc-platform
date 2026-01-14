import { db } from "../db";
import {
  determinationLetters,
  screenings,
  creditCalculations,
  employees,
  employers,
  auditLogs,
  invoices,
} from "@shared/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";

interface CertificationResult {
  screeningId: string;
  status: "certified" | "denied" | "error";
  certificationNumber?: string;
  creditAmount?: number;
  error?: string;
}

interface ProcessingResult {
  determinationLetterId: string;
  processed: number;
  certified: number;
  denied: number;
  errors: number;
  results: CertificationResult[];
}

export async function processDeterminationLetter(
  determinationLetterId: string,
  userId: string
): Promise<ProcessingResult> {
  const [letter] = await db
    .select()
    .from(determinationLetters)
    .where(eq(determinationLetters.id, determinationLetterId));

  if (!letter) {
    throw new Error("Determination letter not found");
  }

  if (letter.status !== "processed" || !letter.employeeData) {
    throw new Error("Determination letter has not been processed or has no employee data");
  }

  const results: CertificationResult[] = [];
  let certified = 0;
  let denied = 0;
  let errors = 0;

  const employeeDataArray = letter.employeeData as any[];

  for (const employeeRecord of employeeDataArray) {
    try {
      const result = await certifyScreening(
        letter.employerId,
        employeeRecord,
        letter.certificationNumber,
        userId
      );
      results.push(result);

      if (result.status === "certified") certified++;
      else if (result.status === "denied") denied++;
      else errors++;
    } catch (error) {
      results.push({
        screeningId: employeeRecord.screeningId || "unknown",
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      errors++;
    }
  }

  await db
    .update(determinationLetters)
    .set({
      updatesApplied: true,
      updatesAppliedAt: new Date(),
      updatedScreeningIds: results
        .filter((r) => r.status === "certified")
        .map((r) => r.screeningId),
      updatedAt: new Date(),
    })
    .where(eq(determinationLetters.id, determinationLetterId));

  await logAuditEvent(userId, "certification_batch_processed", {
    determinationLetterId,
    certified,
    denied,
    errors,
  });

  return {
    determinationLetterId,
    processed: employeeDataArray.length,
    certified,
    denied,
    errors,
    results,
  };
}

async function certifyScreening(
  employerId: string,
  employeeRecord: any,
  baseCertificationNumber: string | null,
  userId: string
): Promise<CertificationResult> {
  let screening;

  if (employeeRecord.screeningId) {
    [screening] = await db
      .select()
      .from(screenings)
      .where(eq(screenings.id, employeeRecord.screeningId));
  } else if (employeeRecord.ssn || employeeRecord.employeeId) {
    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.employerId, employerId),
          employeeRecord.ssn
            ? sql`${employees.ssn} = ${employeeRecord.ssn}`
            : eq(employees.id, employeeRecord.employeeId)
        )
      );

    if (employee) {
      [screening] = await db
        .select()
        .from(screenings)
        .where(eq(screenings.employeeId, employee.id))
        .orderBy(desc(screenings.createdAt))
        .limit(1);
    }
  }

  if (!screening) {
    return {
      screeningId: employeeRecord.screeningId || "not_found",
      status: "error",
      error: "Screening not found for employee",
    };
  }

  const determinationStatus = (employeeRecord.status || "").toLowerCase();
  const isCertified = determinationStatus.includes("certified") || 
                       determinationStatus.includes("approved");
  const isDenied = determinationStatus.includes("denied") || 
                   determinationStatus.includes("rejected");

  if (isDenied) {
    await db
      .update(screenings)
      .set({
        status: "denied",
        updatedAt: new Date(),
      })
      .where(eq(screenings.id, screening.id));

    return {
      screeningId: screening.id,
      status: "denied",
    };
  }

  if (isCertified) {
    const certificationNumber =
      employeeRecord.certificationNumber ||
      baseCertificationNumber ||
      `CERT-${Date.now()}-${screening.id.slice(0, 8)}`;

    const creditAmount = parseFloat(employeeRecord.creditAmount) || 0;

    await db
      .update(screenings)
      .set({
        status: "certified",
        certificationNumber,
        certifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(screenings.id, screening.id));

    const [existingCalc] = await db
      .select()
      .from(creditCalculations)
      .where(eq(creditCalculations.screeningId, screening.id));

    if (existingCalc) {
      await db
        .update(creditCalculations)
        .set({
          actualCreditAmount: creditAmount.toString(),
          status: "claimed",
          claimedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(creditCalculations.id, existingCalc.id));
    }

    await logAuditEvent(userId, "screening_certified", {
      screeningId: screening.id,
      certificationNumber,
      creditAmount,
    });

    return {
      screeningId: screening.id,
      status: "certified",
      certificationNumber,
      creditAmount,
    };
  }

  return {
    screeningId: screening.id,
    status: "error",
    error: `Unknown determination status: ${determinationStatus}`,
  };
}

export async function getCertificationQueue(employerId?: string) {
  const whereClause = employerId
    ? and(
        eq(determinationLetters.status, "processed"),
        eq(determinationLetters.updatesApplied, false),
        eq(determinationLetters.employerId, employerId)
      )
    : and(
        eq(determinationLetters.status, "processed"),
        eq(determinationLetters.updatesApplied, false)
      );

  const queue = await db
    .select({
      id: determinationLetters.id,
      employerId: determinationLetters.employerId,
      stateCode: determinationLetters.stateCode,
      fileName: determinationLetters.fileName,
      receivedDate: determinationLetters.receivedDate,
      processedAt: determinationLetters.processedAt,
      certificationNumber: determinationLetters.certificationNumber,
      creditAmount: determinationLetters.creditAmount,
      employeeCount: sql<number>`jsonb_array_length(${determinationLetters.employeeData})`,
    })
    .from(determinationLetters)
    .where(whereClause)
    .orderBy(desc(determinationLetters.receivedDate));

  return queue;
}

export async function getCertificationStats(employerId?: string) {
  const baseWhere = employerId
    ? eq(screenings.employerId, employerId)
    : sql`1=1`;

  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      certified: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} = 'certified')`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} IN ('eligible', 'pending'))`,
      denied: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} = 'denied')`,
    })
    .from(screenings)
    .where(baseWhere);

  const [creditStats] = await db
    .select({
      projectedTotal: sql<number>`COALESCE(SUM(CAST(${creditCalculations.projectedCreditAmount} AS DECIMAL)), 0)`,
      actualTotal: sql<number>`COALESCE(SUM(CAST(${creditCalculations.actualCreditAmount} AS DECIMAL)), 0)`,
      claimedCount: sql<number>`COUNT(*) FILTER (WHERE ${creditCalculations.status} = 'claimed')`,
    })
    .from(creditCalculations)
    .where(
      employerId
        ? eq(creditCalculations.employerId, employerId)
        : sql`1=1`
    );

  return {
    screenings: stats,
    credits: creditStats,
    certificationRate:
      stats.total > 0
        ? ((stats.certified / stats.total) * 100).toFixed(2)
        : "0.00",
  };
}

export async function processAllPendingCertifications(userId: string) {
  const pendingLetters = await getCertificationQueue();
  const results: ProcessingResult[] = [];

  for (const letter of pendingLetters) {
    try {
      const result = await processDeterminationLetter(letter.id, userId);
      results.push(result);
    } catch (error) {
      results.push({
        determinationLetterId: letter.id,
        processed: 0,
        certified: 0,
        denied: 0,
        errors: 1,
        results: [
          {
            screeningId: "batch_error",
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        ],
      });
    }
  }

  return {
    totalLettersProcessed: results.length,
    totalCertified: results.reduce((sum, r) => sum + r.certified, 0),
    totalDenied: results.reduce((sum, r) => sum + r.denied, 0),
    totalErrors: results.reduce((sum, r) => sum + r.errors, 0),
    results,
  };
}

async function logAuditEvent(userId: string, action: string, details: any) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resourceType: "certification",
      category: "certification",
      severity: "info",
      description: JSON.stringify(details),
      ipAddress: "system",
      userAgent: "certification-automation",
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

export async function generateCertificationReport(
  employerId: string,
  startDate: Date,
  endDate: Date
) {
  const certifiedScreenings = await db
    .select({
      screeningId: screenings.id,
      employeeId: screenings.employeeId,
      certificationNumber: screenings.certificationNumber,
      certifiedAt: screenings.certifiedAt,
      creditAmount: creditCalculations.actualCreditAmount,
      targetGroup: creditCalculations.targetGroup,
    })
    .from(screenings)
    .leftJoin(
      creditCalculations,
      eq(creditCalculations.screeningId, screenings.id)
    )
    .where(
      and(
        eq(screenings.employerId, employerId),
        eq(screenings.status, "certified"),
        sql`${screenings.certifiedAt} >= ${startDate}`,
        sql`${screenings.certifiedAt} <= ${endDate}`
      )
    )
    .orderBy(desc(screenings.certifiedAt));

  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.id, employerId));

  return {
    employer: employer?.name || "Unknown",
    reportPeriod: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    totalCertified: certifiedScreenings.length,
    totalCredits: certifiedScreenings.reduce(
      (sum, s) => sum + parseFloat(s.creditAmount || "0"),
      0
    ),
    certifications: certifiedScreenings,
  };
}
