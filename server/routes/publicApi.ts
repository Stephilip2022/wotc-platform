import { Router } from "express";
import { eq, and, desc, asc, like, or, sql, count, sum } from "drizzle-orm";
import { db } from "../db";
import { employees, screenings, creditCalculations, employers, hoursWorked, questionnaireResponses } from "../../shared/schema";
import { publicApiMiddleware } from "../middleware/rateLimiter";
import type { ApiKeyRequest } from "../middleware/apiKeyAuth";
import { calculateCredit, calculateCreditDetailed, TARGET_GROUPS } from "../eligibility";
import { dispatchWebhookEvent, WEBHOOK_EVENTS } from "../utils/webhookService";
import crypto from "crypto";

const router = Router();

// ============================================================================
// EMPLOYEES API
// ============================================================================

router.get(
  "/employees",
  ...publicApiMiddleware(["employees:read", "employees:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;
      const sortField = (req.query.sort as string) || "createdAt";
      const sortDirection = (req.query.order as string) === "asc" ? asc : desc;
      const sortColumns = {
        createdAt: employees.createdAt,
        firstName: employees.firstName,
        lastName: employees.lastName,
        hireDate: employees.hireDate,
        status: employees.status,
      };
      const sortColumn = sortColumns[sortField as keyof typeof sortColumns] || employees.createdAt;
      const search = req.query.search as string;
      const status = req.query.status as string;
      const conditions = [eq(employees.employerId, employerId)];
      if (status) conditions.push(eq(employees.status, status));
      if (search) {
        conditions.push(
          or(
            like(employees.firstName, `%${search}%`),
            like(employees.lastName, `%${search}%`),
            like(employees.email, `%${search}%`)
          )!
        );
      }
      const [employeesList, totalCountResult] = await Promise.all([
        db.select().from(employees).where(and(...conditions)).orderBy(sortDirection(sortColumn)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(employees).where(and(...conditions))
      ]);
      const totalCount = Number(totalCountResult[0]?.count || 0);
      const totalPages = Math.ceil(totalCount / limit);
      res.json({
        data: employeesList,
        pagination: { page, limit, totalCount, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
      });
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch employees" });
    }
  }
);

router.get(
  "/employees/:id",
  ...publicApiMiddleware(["employees:read", "employees:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const [employee] = await db.select().from(employees).where(and(eq(employees.id, req.params.id), eq(employees.employerId, employerId)));
      if (!employee) return res.status(404).json({ error: "Not Found", message: "Employee not found" });
      res.json({ data: employee });
    } catch (error) {
      console.error("Error fetching employee:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch employee" });
    }
  }
);

router.post(
  "/employees",
  ...publicApiMiddleware(["employees:write", "employees:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const { firstName, lastName, email, phone, dateOfBirth, ssn, address, city, state, zipCode, hireDate, startDate } = req.body;

      if (!firstName || !lastName || !email) {
        return res.status(400).json({
          error: "Validation Error",
          message: "firstName, lastName, and email are required fields",
        });
      }

      const existing = await db.select().from(employees).where(and(eq(employees.email, email), eq(employees.employerId, employerId)));
      if (existing.length > 0) {
        return res.status(409).json({
          error: "Conflict",
          message: "An employee with this email already exists",
          data: { id: existing[0].id },
        });
      }

      const [employee] = await db.insert(employees).values({
        employerId,
        firstName,
        lastName,
        email,
        phone: phone || null,
        dateOfBirth: dateOfBirth || null,
        ssn: ssn || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        hireDate: hireDate || null,
        startDate: startDate || null,
        status: "active",
      }).returning();

      await dispatchWebhookEvent(employerId, WEBHOOK_EVENTS.EMPLOYEE_HIRED, {
        employeeId: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        hireDate: employee.hireDate,
      });

      res.status(201).json({ data: employee });
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to create employee" });
    }
  }
);

// ============================================================================
// SCREENING INITIATION API (ATS/HRIS Integration)
// ============================================================================

router.post(
  "/screenings/initiate",
  ...publicApiMiddleware(["screenings:write", "screenings:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const { employeeId, firstName, lastName, email, phone, hireDate, callbackUrl } = req.body;

      let resolvedEmployeeId = employeeId;

      if (!resolvedEmployeeId) {
        if (!firstName || !lastName || !email) {
          return res.status(400).json({
            error: "Validation Error",
            message: "Either employeeId or (firstName, lastName, email) are required",
          });
        }

        const existing = await db.select().from(employees).where(and(eq(employees.email, email), eq(employees.employerId, employerId)));
        if (existing.length > 0) {
          resolvedEmployeeId = existing[0].id;
        } else {
          const [newEmp] = await db.insert(employees).values({
            employerId,
            firstName,
            lastName,
            email,
            phone: phone || null,
            hireDate: hireDate || null,
            status: "active",
          }).returning();
          resolvedEmployeeId = newEmp.id;
        }
      } else {
        const [emp] = await db.select().from(employees).where(and(eq(employees.id, resolvedEmployeeId), eq(employees.employerId, employerId)));
        if (!emp) {
          return res.status(404).json({ error: "Not Found", message: "Employee not found" });
        }
      }

      const [screening] = await db.insert(screenings).values({
        employeeId: resolvedEmployeeId,
        employerId,
        status: "pending",
        targetGroups: [],
      }).returning();

      const [employer] = await db.select().from(employers).where(eq(employers.id, employerId));
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const questionnaireToken = employer?.questionnaireUrl || employer?.id;
      const questionnaireUrl = `${baseUrl}/screen/${questionnaireToken}?employee=${resolvedEmployeeId}&screening=${screening.id}`;

      await dispatchWebhookEvent(employerId, WEBHOOK_EVENTS.SCREENING_STARTED, {
        screeningId: screening.id,
        employeeId: resolvedEmployeeId,
        questionnaireUrl,
        status: "pending",
      });

      res.status(201).json({
        data: {
          screeningId: screening.id,
          employeeId: resolvedEmployeeId,
          questionnaireUrl,
          status: "pending",
          callbackUrl: callbackUrl || null,
          createdAt: screening.createdAt,
        },
      });
    } catch (error) {
      console.error("Error initiating screening:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to initiate screening" });
    }
  }
);

// ============================================================================
// QUESTIONNAIRE STATUS & ELIGIBILITY
// ============================================================================

router.get(
  "/screenings/:id/questionnaire-status",
  ...publicApiMiddleware(["screenings:read", "screenings:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const [screening] = await db.select({
        id: screenings.id,
        employeeId: screenings.employeeId,
        status: screenings.status,
        questionnaireAccessedAt: screenings.questionnaireAccessedAt,
        questionnaireStartedAt: screenings.questionnaireStartedAt,
        questionnaireCompletedAt: screenings.questionnaireCompletedAt,
        createdAt: screenings.createdAt,
        updatedAt: screenings.updatedAt,
      }).from(screenings).where(and(eq(screenings.id, req.params.id), eq(screenings.employerId, employerId)));

      if (!screening) return res.status(404).json({ error: "Not Found", message: "Screening not found" });

      let questionnaireStatus = "not_sent";
      if (screening.questionnaireCompletedAt) {
        questionnaireStatus = "completed";
      } else if (screening.questionnaireStartedAt) {
        questionnaireStatus = "in_progress";
      } else if (screening.questionnaireAccessedAt) {
        questionnaireStatus = "accessed";
      } else if (screening.createdAt) {
        questionnaireStatus = "sent";
      }

      res.json({
        data: {
          screeningId: screening.id,
          employeeId: screening.employeeId,
          questionnaireStatus,
          accessedAt: screening.questionnaireAccessedAt,
          startedAt: screening.questionnaireStartedAt,
          completedAt: screening.questionnaireCompletedAt,
          screeningStatus: screening.status,
        },
      });
    } catch (error) {
      console.error("Error fetching questionnaire status:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch questionnaire status" });
    }
  }
);

router.get(
  "/screenings/:id/eligibility",
  ...publicApiMiddleware(["screenings:read", "screenings:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const [screening] = await db.select().from(screenings).where(and(eq(screenings.id, req.params.id), eq(screenings.employerId, employerId)));

      if (!screening) return res.status(404).json({ error: "Not Found", message: "Screening not found" });

      const targetGroups = Array.isArray(screening.targetGroups) ? screening.targetGroups : [];
      const targetGroupDetails = targetGroups.map((code: string) => {
        const tg = TARGET_GROUPS[code];
        return tg ? {
          code: tg.code,
          name: tg.name,
          maxCredit: tg.maxCredit,
          qualifiedWageCap: tg.qualifiedWageCap,
          hoursRequired: tg.hoursRequired,
        } : { code, name: code, maxCredit: 0, qualifiedWageCap: 0, hoursRequired: 0 };
      });

      let creditInfo = null;
      const creditCalcs = await db.select().from(creditCalculations).where(and(eq(creditCalculations.screeningId, screening.id), eq(creditCalculations.employerId, employerId)));
      if (creditCalcs.length > 0) {
        const totalActual = creditCalcs.reduce((s, c) => s + Number(c.actualCreditAmount || 0), 0);
        const totalProjected = creditCalcs.reduce((s, c) => s + Number(c.projectedCreditAmount || 0), 0);
        creditInfo = {
          totalActualCredits: totalActual,
          totalProjectedCredits: totalProjected,
          calculations: creditCalcs.map(c => ({
            id: c.id,
            targetGroup: c.targetGroup,
            hoursWorked: c.hoursWorked,
            wagesEarned: c.wagesEarned,
            actualCreditAmount: c.actualCreditAmount,
            projectedCreditAmount: c.projectedCreditAmount,
            status: c.status,
          })),
        };
      }

      res.json({
        data: {
          screeningId: screening.id,
          employeeId: screening.employeeId,
          isEligible: screening.status === "eligible" || screening.status === "certified",
          status: screening.status,
          targetGroups: targetGroupDetails,
          primaryTargetGroup: screening.primaryTargetGroup,
          certificationNumber: screening.certificationNumber,
          certifiedAt: screening.certifiedAt,
          eligibilityDeterminedAt: screening.eligibilityDeterminedAt,
          form8850Generated: screening.form8850Generated,
          form9061Generated: screening.form9061Generated,
          credits: creditInfo,
        },
      });
    } catch (error) {
      console.error("Error fetching eligibility:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch eligibility data" });
    }
  }
);

// ============================================================================
// SCREENINGS API (existing)
// ============================================================================

router.get(
  "/screenings",
  ...publicApiMiddleware(["screenings:read", "screenings:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;
      const sortField = (req.query.sort as string) || "createdAt";
      const sortDirection = (req.query.order as string) === "asc" ? asc : desc;
      const sortColumns = {
        createdAt: screenings.createdAt,
        status: screenings.status,
        certifiedAt: screenings.certifiedAt,
        eligibilityDeterminedAt: screenings.eligibilityDeterminedAt,
      };
      const sortColumn = sortColumns[sortField as keyof typeof sortColumns] || screenings.createdAt;
      const employeeId = req.query.employeeId as string;
      const status = req.query.status as string;
      const conditions = [eq(screenings.employerId, employerId)];
      if (employeeId) conditions.push(eq(screenings.employeeId, employeeId));
      if (status) conditions.push(eq(screenings.status, status));
      const [screeningsList, totalCountResult] = await Promise.all([
        db.select().from(screenings).where(and(...conditions)).orderBy(sortDirection(sortColumn)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(screenings).where(and(...conditions))
      ]);
      const totalCount = Number(totalCountResult[0]?.count || 0);
      const totalPages = Math.ceil(totalCount / limit);
      res.json({
        data: screeningsList,
        pagination: { page, limit, totalCount, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
      });
    } catch (error) {
      console.error("Error fetching screenings:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch screenings" });
    }
  }
);

router.get(
  "/screenings/:id",
  ...publicApiMiddleware(["screenings:read", "screenings:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const [screening] = await db.select().from(screenings).where(and(eq(screenings.id, req.params.id), eq(screenings.employerId, employerId)));
      if (!screening) return res.status(404).json({ error: "Not Found", message: "Screening not found" });
      res.json({ data: screening });
    } catch (error) {
      console.error("Error fetching screening:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch screening" });
    }
  }
);

router.get(
  "/screenings/:id/status",
  ...publicApiMiddleware(["screenings:read", "screenings:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const [screening] = await db.select({
        id: screenings.id,
        status: screenings.status,
        certificationNumber: screenings.certificationNumber,
        certifiedAt: screenings.certifiedAt,
        eligibilityDeterminedAt: screenings.eligibilityDeterminedAt,
        questionnaireAccessedAt: screenings.questionnaireAccessedAt,
        questionnaireStartedAt: screenings.questionnaireStartedAt,
        questionnaireCompletedAt: screenings.questionnaireCompletedAt,
        updatedAt: screenings.updatedAt,
      }).from(screenings).where(and(eq(screenings.id, req.params.id), eq(screenings.employerId, employerId)));
      if (!screening) return res.status(404).json({ error: "Not Found", message: "Screening not found" });
      res.json({ data: screening });
    } catch (error) {
      console.error("Error fetching screening status:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch screening status" });
    }
  }
);

router.get(
  "/employees/:id/screenings",
  ...publicApiMiddleware(["employees:read", "screenings:read"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const { id: employeeId } = req.params;
      const [employee] = await db.select().from(employees).where(and(eq(employees.id, employeeId), eq(employees.employerId, employerId)));
      if (!employee) return res.status(404).json({ error: "Not Found", message: "Employee not found" });
      const employeeScreenings = await db.select().from(screenings).where(and(eq(screenings.employeeId, employeeId), eq(screenings.employerId, employerId))).orderBy(desc(screenings.createdAt));
      res.json({ data: employeeScreenings });
    } catch (error) {
      console.error("Error fetching employee screenings:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch employee screenings" });
    }
  }
);

// ============================================================================
// CREDIT CALCULATIONS API
// ============================================================================

router.get(
  "/credits",
  ...publicApiMiddleware(["credits:read", "credits:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;
      const sortField = (req.query.sort as string) || "calculatedAt";
      const sortDirection = (req.query.order as string) === "asc" ? asc : desc;
      const sortColumns = {
        calculatedAt: creditCalculations.calculatedAt,
        actualCreditAmount: creditCalculations.actualCreditAmount,
        projectedCreditAmount: creditCalculations.projectedCreditAmount,
        status: creditCalculations.status,
      };
      const sortColumn = sortColumns[sortField as keyof typeof sortColumns] || creditCalculations.calculatedAt;
      const employeeId = req.query.employeeId as string;
      const screeningId = req.query.screeningId as string;
      const status = req.query.status as string;
      const conditions = [eq(creditCalculations.employerId, employerId)];
      if (employeeId) conditions.push(eq(creditCalculations.employeeId, employeeId));
      if (screeningId) conditions.push(eq(creditCalculations.screeningId, screeningId));
      if (status) conditions.push(eq(creditCalculations.status, status));
      const [creditsList, totalCountResult] = await Promise.all([
        db.select().from(creditCalculations).where(and(...conditions)).orderBy(sortDirection(sortColumn)).limit(limit).offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(creditCalculations).where(and(...conditions))
      ]);
      const totalCount = Number(totalCountResult[0]?.count || 0);
      const totalPages = Math.ceil(totalCount / limit);
      res.json({
        data: creditsList,
        pagination: { page, limit, totalCount, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
      });
    } catch (error) {
      console.error("Error fetching credits:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch credits" });
    }
  }
);

router.get(
  "/credits/:id",
  ...publicApiMiddleware(["credits:read", "credits:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const [credit] = await db.select().from(creditCalculations).where(and(eq(creditCalculations.id, req.params.id), eq(creditCalculations.employerId, employerId)));
      if (!credit) return res.status(404).json({ error: "Not Found", message: "Credit calculation not found" });
      res.json({ data: credit });
    } catch (error) {
      console.error("Error fetching credit:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch credit calculation" });
    }
  }
);

// ============================================================================
// WOTC SUMMARY (Aggregate employer-level data)
// ============================================================================

router.get(
  "/wotc-summary",
  ...publicApiMiddleware(["screenings:read", "credits:read"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;

      const [
        totalScreeningsResult,
        statusCounts,
        questionnaireCounts,
        creditTotals,
        employeeCount,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(screenings).where(eq(screenings.employerId, employerId)),
        db.select({
          status: screenings.status,
          count: sql<number>`count(*)`,
        }).from(screenings).where(eq(screenings.employerId, employerId)).groupBy(screenings.status),
        db.select({
          accessed: sql<number>`count(*) filter (where ${screenings.questionnaireAccessedAt} is not null)`,
          started: sql<number>`count(*) filter (where ${screenings.questionnaireStartedAt} is not null)`,
          completed: sql<number>`count(*) filter (where ${screenings.questionnaireCompletedAt} is not null)`,
        }).from(screenings).where(eq(screenings.employerId, employerId)),
        db.select({
          totalProjected: sql<string>`coalesce(sum(${creditCalculations.projectedCreditAmount}::numeric), 0)`,
          totalActual: sql<string>`coalesce(sum(${creditCalculations.actualCreditAmount}::numeric), 0)`,
          totalClaimed: sql<string>`coalesce(sum(case when ${creditCalculations.status} = 'claimed' then ${creditCalculations.actualCreditAmount}::numeric else 0 end), 0)`,
        }).from(creditCalculations).where(eq(creditCalculations.employerId, employerId)),
        db.select({ count: sql<number>`count(*)` }).from(employees).where(eq(employees.employerId, employerId)),
      ]);

      const statusMap: Record<string, number> = {};
      statusCounts.forEach((s) => { statusMap[s.status || "unknown"] = Number(s.count); });

      const qc = questionnaireCounts[0] || { accessed: 0, started: 0, completed: 0 };
      const ct = creditTotals[0] || { totalProjected: "0", totalActual: "0", totalClaimed: "0" };

      res.json({
        data: {
          employer: { id: employerId },
          employees: { total: Number(employeeCount[0]?.count || 0) },
          screenings: {
            total: Number(totalScreeningsResult[0]?.count || 0),
            byStatus: {
              pending: statusMap.pending || 0,
              eligible: statusMap.eligible || 0,
              not_eligible: statusMap.not_eligible || 0,
              certified: statusMap.certified || 0,
              denied: statusMap.denied || 0,
            },
          },
          questionnaire: {
            accessed: Number(qc.accessed),
            started: Number(qc.started),
            completed: Number(qc.completed),
          },
          credits: {
            totalProjectedCredits: parseFloat(ct.totalProjected),
            totalActualCredits: parseFloat(ct.totalActual),
            totalClaimedCredits: parseFloat(ct.totalClaimed),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching WOTC summary:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to fetch WOTC summary" });
    }
  }
);

// ============================================================================
// PAYROLL DATA IMPORT API
// ============================================================================

router.post(
  "/payroll/import",
  ...publicApiMiddleware(["payroll:write", "payroll:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const { records } = req.body;

      if (!Array.isArray(records) || records.length === 0) {
        return res.status(400).json({
          error: "Validation Error",
          message: "Request body must include a 'records' array with at least one payroll record",
          example: {
            records: [{
              employeeId: "emp_123",
              hours: 80,
              wages: 1200.00,
              periodStart: "2025-01-01",
              periodEnd: "2025-01-15",
            }],
          },
        });
      }

      if (records.length > 500) {
        return res.status(400).json({
          error: "Validation Error",
          message: "Maximum 500 records per import batch",
        });
      }

      const results: Array<{ employeeId: string; status: string; hoursRecordId?: string; error?: string }> = [];
      let successCount = 0;
      let errorCount = 0;

      for (const record of records) {
        try {
          const { employeeId, hours, wages, periodStart, periodEnd, notes } = record;

          if (!employeeId || hours === undefined || !periodStart || !periodEnd) {
            results.push({ employeeId: employeeId || "unknown", status: "error", error: "Missing required fields: employeeId, hours, periodStart, periodEnd" });
            errorCount++;
            continue;
          }

          const [emp] = await db.select({ id: employees.id }).from(employees).where(and(eq(employees.id, employeeId), eq(employees.employerId, employerId)));
          if (!emp) {
            results.push({ employeeId, status: "error", error: "Employee not found or does not belong to this employer" });
            errorCount++;
            continue;
          }

          const [hoursRecord] = await db.insert(hoursWorked).values({
            employeeId,
            employerId,
            hours: String(hours),
            wages: wages !== undefined ? String(wages) : null,
            periodStart,
            periodEnd,
            source: "api",
            notes: notes || `API import via key ${(req as ApiKeyRequest).apiKey!.id}`,
          }).returning();

          results.push({ employeeId, status: "success", hoursRecordId: hoursRecord.id });
          successCount++;
        } catch (err: any) {
          results.push({ employeeId: record.employeeId || "unknown", status: "error", error: err.message });
          errorCount++;
        }
      }

      await dispatchWebhookEvent(employerId, WEBHOOK_EVENTS.PAYROLL_IMPORTED, {
        totalRecords: records.length,
        successCount,
        errorCount,
        importedAt: new Date().toISOString(),
      });

      res.status(successCount > 0 ? 201 : 400).json({
        data: {
          summary: {
            totalRecords: records.length,
            successful: successCount,
            failed: errorCount,
          },
          results,
        },
      });
    } catch (error) {
      console.error("Error importing payroll data:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to import payroll data" });
    }
  }
);

// ============================================================================
// CREDIT CALCULATION FROM PAYROLL
// ============================================================================

router.post(
  "/payroll/calculate-credits",
  ...publicApiMiddleware(["credits:write", "credits:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const { employeeIds } = req.body;

      const certifiedScreenings = await db.select()
        .from(screenings)
        .where(and(
          eq(screenings.employerId, employerId),
          eq(screenings.status, "certified"),
          ...(employeeIds ? [sql`${screenings.employeeId} = ANY(${employeeIds})`] : [])
        ));

      if (certifiedScreenings.length === 0) {
        return res.json({
          data: {
            message: "No certified screenings found to calculate credits for",
            calculations: [],
          },
        });
      }

      const calculations: Array<{
        employeeId: string;
        screeningId: string;
        targetGroup: string;
        hoursWorked: number;
        totalWages: number;
        creditAmount: number;
        breakdown: any;
        status: string;
      }> = [];

      for (const screening of certifiedScreenings) {
        const hoursRecords = await db.select({
          totalHours: sql<string>`coalesce(sum(${hoursWorked.hours}::numeric), 0)`,
          totalWages: sql<string>`coalesce(sum(${hoursWorked.wages}::numeric), 0)`,
        }).from(hoursWorked).where(and(
          eq(hoursWorked.employeeId, screening.employeeId),
          eq(hoursWorked.employerId, employerId),
        ));

        const totalHours = parseFloat(hoursRecords[0]?.totalHours || "0");
        const totalWages = parseFloat(hoursRecords[0]?.totalWages || "0");

        const tgCode = screening.primaryTargetGroup || (Array.isArray(screening.targetGroups) && screening.targetGroups.length > 0 ? String(screening.targetGroups[0]) : "");
        if (!tgCode) continue;

        const breakdown = calculateCreditDetailed(tgCode, totalHours, totalWages);

        const existing = await db.select().from(creditCalculations).where(and(
          eq(creditCalculations.screeningId, screening.id),
          eq(creditCalculations.employerId, employerId),
        ));

        if (existing.length > 0) {
          await db.update(creditCalculations).set({
            hoursWorked: Math.round(totalHours),
            wagesEarned: String(totalWages),
            actualCreditAmount: String(breakdown.totalCredit),
            status: totalHours >= 400 ? "in_progress" : totalHours >= 120 ? "in_progress" : "projected",
            updatedAt: new Date(),
          }).where(eq(creditCalculations.id, existing[0].id));
        } else {
          await db.insert(creditCalculations).values({
            screeningId: screening.id,
            employerId,
            employeeId: screening.employeeId,
            targetGroup: tgCode,
            maxCreditAmount: String(breakdown.wageCap * 0.40),
            projectedCreditAmount: String(breakdown.totalCredit),
            actualCreditAmount: String(breakdown.totalCredit),
            hoursWorked: Math.round(totalHours),
            wagesEarned: String(totalWages),
            minimumHoursRequired: TARGET_GROUPS[tgCode]?.hoursRequired || 120,
            status: totalHours >= 120 ? "in_progress" : "projected",
          });
        }

        calculations.push({
          employeeId: screening.employeeId,
          screeningId: screening.id,
          targetGroup: tgCode,
          hoursWorked: totalHours,
          totalWages,
          creditAmount: breakdown.totalCredit,
          breakdown,
          status: totalHours >= 120 ? "in_progress" : "projected",
        });
      }

      const totalCredits = calculations.reduce((s, c) => s + c.creditAmount, 0);

      await dispatchWebhookEvent(employerId, WEBHOOK_EVENTS.CREDITS_RECALCULATED, {
        calculationsCount: calculations.length,
        totalCredits,
        recalculatedAt: new Date().toISOString(),
      });

      res.json({
        data: {
          summary: {
            screeningsProcessed: certifiedScreenings.length,
            calculationsUpdated: calculations.length,
            totalCreditsCalculated: Math.round(totalCredits * 100) / 100,
          },
          calculations,
        },
      });
    } catch (error) {
      console.error("Error calculating credits:", error);
      res.status(500).json({ error: "Internal Server Error", message: "Failed to calculate credits" });
    }
  }
);

// ============================================================================
// TARGET GROUPS REFERENCE
// ============================================================================

router.get(
  "/target-groups",
  ...publicApiMiddleware(),
  (req, res) => {
    const groups = Object.entries(TARGET_GROUPS).map(([code, tg]) => ({
      code: tg.code,
      name: tg.name,
      maxCredit: tg.maxCredit,
      qualifiedWageCap: tg.qualifiedWageCap,
      hoursRequired: tg.hoursRequired,
      hasSecondYearCredit: !!tg.secondYearWageCap,
    }));
    res.json({ data: groups });
  }
);

// ============================================================================
// WEBHOOK EVENTS REFERENCE
// ============================================================================

router.get(
  "/webhook-events",
  ...publicApiMiddleware(),
  (req, res) => {
    res.json({
      data: {
        events: Object.entries(WEBHOOK_EVENTS).map(([key, value]) => ({
          key,
          event: value,
          description: getWebhookEventDescription(value),
        })),
      },
    });
  }
);

function getWebhookEventDescription(event: string): string {
  const descriptions: Record<string, string> = {
    "employee.hired": "Fired when a new employee is created via API",
    "employee.status_changed": "Fired when an employee's status changes",
    "questionnaire.accessed": "Fired when an applicant opens the questionnaire link",
    "questionnaire.started": "Fired when an applicant begins answering questions",
    "questionnaire.completed": "Fired when an applicant submits the completed questionnaire",
    "screening.started": "Fired when a new screening is initiated",
    "screening.completed": "Fired when screening eligibility is determined",
    "screening.certified": "Fired when a screening receives WOTC certification",
    "screening.denied": "Fired when a screening certification is denied",
    "submission.submitted": "Fired when forms are submitted to the state workforce agency",
    "submission.certified": "Fired when the state certifies the submission",
    "submission.denied": "Fired when the state denies the submission",
    "submission.failed": "Fired when a submission to the state fails",
    "credit.calculated": "Fired when a new credit calculation is created",
    "credit.updated": "Fired when a credit calculation is updated with new payroll data",
    "payroll.imported": "Fired when payroll data is imported via API",
    "credits.recalculated": "Fired when credits are recalculated from payroll data",
    "invoice.generated": "Fired when a new invoice is generated",
    "payment.received": "Fired when a payment is received",
    "payment.failed": "Fired when a payment fails",
  };
  return descriptions[event] || "No description available";
}

// ============================================================================
// API METADATA
// ============================================================================

router.get(
  "/",
  ...publicApiMiddleware(),
  (req, res) => {
    res.json({
      version: "1.0.0",
      endpoints: {
        employees: {
          list: "GET /api/v1/employees",
          get: "GET /api/v1/employees/:id",
          create: "POST /api/v1/employees",
          screenings: "GET /api/v1/employees/:id/screenings",
        },
        screenings: {
          list: "GET /api/v1/screenings",
          get: "GET /api/v1/screenings/:id",
          initiate: "POST /api/v1/screenings/initiate",
          status: "GET /api/v1/screenings/:id/status",
          questionnaireStatus: "GET /api/v1/screenings/:id/questionnaire-status",
          eligibility: "GET /api/v1/screenings/:id/eligibility",
        },
        credits: {
          list: "GET /api/v1/credits",
          get: "GET /api/v1/credits/:id",
        },
        payroll: {
          import: "POST /api/v1/payroll/import",
          calculateCredits: "POST /api/v1/payroll/calculate-credits",
        },
        summary: {
          wotcSummary: "GET /api/v1/wotc-summary",
        },
        reference: {
          targetGroups: "GET /api/v1/target-groups",
          webhookEvents: "GET /api/v1/webhook-events",
        },
      },
      documentation: "/api/docs",
    });
  }
);

export default router;
