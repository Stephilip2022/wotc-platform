import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  screenings, 
  employees, 
  employers, 
  creditCalculations, 
  submissionQueue,
  users,
  taxCreditPrograms,
  programScreeningResults,
  programCreditCalculations,
  programSubmissions,
  employerProgramAssignments,
  generatedReports,
} from "@shared/schema";
import { eq, sql, and, gte, lte, count, desc, asc, isNotNull } from "drizzle-orm";

const router = Router();

interface AnalyticsQuery {
  startDate?: string;
  endDate?: string;
  employerId?: string;
  groupBy?: "day" | "week" | "month";
}

// Get overview KPIs for employer or admin
router.get("/overview", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;
    
    // Build where clause based on role
    const whereClause = isAdmin ? sql`1=1` : sql`${screenings.employerId} = ${employerId}`;
    const employerWhereClause = isAdmin ? sql`1=1` : sql`${employees.employerId} = ${employerId}`;
    
    // Total screenings
    const [totalScreenings] = await db
      .select({ count: count() })
      .from(screenings)
      .where(whereClause);
    
    // Eligible screenings
    const [eligibleScreenings] = await db
      .select({ count: count() })
      .from(screenings)
      .where(and(whereClause, eq(screenings.status, "eligible")));
    
    // Certified screenings
    const [certifiedScreenings] = await db
      .select({ count: count() })
      .from(screenings)
      .where(and(whereClause, eq(screenings.status, "certified")));
    
    // Total credits (using projectedCreditAmount)
    const [totalCredits] = await db
      .select({ 
        sum: sql<number>`COALESCE(SUM(CAST(${creditCalculations.projectedCreditAmount} AS DECIMAL)), 0)` 
      })
      .from(creditCalculations)
      .innerJoin(screenings, eq(creditCalculations.screeningId, screenings.id))
      .where(whereClause);
    
    // Pending submissions
    const [pendingSubmissions] = await db
      .select({ count: count() })
      .from(submissionQueue)
      .innerJoin(screenings, eq(submissionQueue.screeningId, screenings.id))
      .where(and(whereClause, eq(submissionQueue.status, "pending")));
    
    // Total employees
    const [totalEmployees] = await db
      .select({ count: count() })
      .from(employees)
      .where(employerWhereClause);
    
    // Conversion rate (eligible / total)
    const conversionRate = totalScreenings.count > 0 
      ? (eligibleScreenings.count / totalScreenings.count) * 100 
      : 0;
    
    // Certification rate (certified / eligible)
    const certificationRate = eligibleScreenings.count > 0 
      ? (certifiedScreenings.count / eligibleScreenings.count) * 100 
      : 0;
    
    res.json({
      totalScreenings: totalScreenings.count,
      eligibleScreenings: eligibleScreenings.count,
      certifiedScreenings: certifiedScreenings.count,
      totalCredits: parseFloat(totalCredits.sum?.toString() || "0"),
      pendingSubmissions: pendingSubmissions.count,
      totalEmployees: totalEmployees.count,
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      certificationRate: parseFloat(certificationRate.toFixed(2)),
    });
  } catch (error) {
    console.error("Analytics overview error:", error);
    res.status(500).json({ error: "Failed to get analytics overview" });
  }
});

// Get screening trends over time
router.get("/trends/screenings", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;
    const { startDate, endDate, groupBy = "day" } = req.query as AnalyticsQuery;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    let dateFormat: string;
    switch (groupBy) {
      case "week":
        dateFormat = "YYYY-IW";
        break;
      case "month":
        dateFormat = "YYYY-MM";
        break;
      default:
        dateFormat = "YYYY-MM-DD";
    }
    
    const whereClause = isAdmin 
      ? and(gte(screenings.createdAt, start), lte(screenings.createdAt, end))
      : and(
          eq(screenings.employerId, employerId!),
          gte(screenings.createdAt, start),
          lte(screenings.createdAt, end)
        );
    
    const trends = await db
      .select({
        period: sql<string>`TO_CHAR(${screenings.createdAt}, ${dateFormat})`,
        total: count(),
        eligible: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} = 'eligible')`,
        certified: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} = 'certified')`,
        denied: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} = 'denied')`,
      })
      .from(screenings)
      .where(whereClause)
      .groupBy(sql`TO_CHAR(${screenings.createdAt}, ${dateFormat})`)
      .orderBy(asc(sql`TO_CHAR(${screenings.createdAt}, ${dateFormat})`));
    
    res.json(trends);
  } catch (error) {
    console.error("Screening trends error:", error);
    res.status(500).json({ error: "Failed to get screening trends" });
  }
});

// Get credit trends over time
router.get("/trends/credits", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;
    const { startDate, endDate, groupBy = "month" } = req.query as AnalyticsQuery;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    let dateFormat: string;
    switch (groupBy) {
      case "week":
        dateFormat = "YYYY-IW";
        break;
      case "month":
        dateFormat = "YYYY-MM";
        break;
      default:
        dateFormat = "YYYY-MM-DD";
    }
    
    const whereClause = isAdmin 
      ? and(gte(creditCalculations.calculatedAt, start), lte(creditCalculations.calculatedAt, end))
      : and(
          eq(creditCalculations.employerId, employerId!),
          gte(creditCalculations.calculatedAt, start),
          lte(creditCalculations.calculatedAt, end)
        );
    
    const trends = await db
      .select({
        period: sql<string>`TO_CHAR(${creditCalculations.calculatedAt}, ${dateFormat})`,
        totalCredits: sql<number>`COALESCE(SUM(CAST(${creditCalculations.projectedCreditAmount} AS DECIMAL)), 0)`,
        count: count(),
        avgCredit: sql<number>`COALESCE(AVG(CAST(${creditCalculations.projectedCreditAmount} AS DECIMAL)), 0)`,
      })
      .from(creditCalculations)
      .where(whereClause)
      .groupBy(sql`TO_CHAR(${creditCalculations.calculatedAt}, ${dateFormat})`)
      .orderBy(asc(sql`TO_CHAR(${creditCalculations.calculatedAt}, ${dateFormat})`));
    
    res.json(trends);
  } catch (error) {
    console.error("Credit trends error:", error);
    res.status(500).json({ error: "Failed to get credit trends" });
  }
});

// Get target group distribution
router.get("/distribution/target-groups", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;
    
    const whereClause = isAdmin ? sql`1=1` : sql`${screenings.employerId} = ${employerId}`;
    
    // Get distribution from credit calculations which has targetGroup
    const distribution = await db
      .select({
        targetGroup: creditCalculations.targetGroup,
        count: count(),
        totalCredits: sql<number>`COALESCE(SUM(CAST(${creditCalculations.projectedCreditAmount} AS DECIMAL)), 0)`,
      })
      .from(creditCalculations)
      .innerJoin(screenings, eq(creditCalculations.screeningId, screenings.id))
      .where(and(whereClause, sql`${creditCalculations.targetGroup} IS NOT NULL`))
      .groupBy(creditCalculations.targetGroup)
      .orderBy(desc(count()));
    
    res.json(distribution);
  } catch (error) {
    console.error("Target group distribution error:", error);
    res.status(500).json({ error: "Failed to get target group distribution" });
  }
});

// Get submission performance by state
router.get("/performance/states", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;
    
    const whereClause = isAdmin ? sql`1=1` : sql`${submissionQueue.employerId} = ${employerId}`;
    
    const statePerformance = await db
      .select({
        stateCode: submissionQueue.stateCode,
        total: count(),
        successful: sql<number>`COUNT(*) FILTER (WHERE ${submissionQueue.status} = 'submitted')`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${submissionQueue.status} = 'failed')`,
        avgProcessingTime: sql<number>`AVG(EXTRACT(EPOCH FROM (${submissionQueue.completedAt} - ${submissionQueue.submittedAt})))`,
      })
      .from(submissionQueue)
      .where(whereClause)
      .groupBy(submissionQueue.stateCode)
      .orderBy(desc(count()));
    
    res.json(statePerformance.map(s => ({
      ...s,
      successRate: s.total > 0 ? (s.successful / s.total) * 100 : 0,
    })));
  } catch (error) {
    console.error("State performance error:", error);
    res.status(500).json({ error: "Failed to get state performance" });
  }
});

// Get employer leaderboard (admin only)
router.get("/leaderboard/employers", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    if (dbUser?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const leaderboard = await db
      .select({
        employerId: employers.id,
        employerName: employers.name,
        totalScreenings: sql<number>`(SELECT COUNT(*) FROM screenings WHERE employer_id = ${employers.id})`,
        eligibleScreenings: sql<number>`(SELECT COUNT(*) FROM screenings WHERE employer_id = ${employers.id} AND status = 'eligible')`,
        certifiedScreenings: sql<number>`(SELECT COUNT(*) FROM screenings WHERE employer_id = ${employers.id} AND status = 'certified')`,
        totalCredits: sql<number>`COALESCE((SELECT SUM(CAST(projected_credit_amount AS DECIMAL)) FROM credit_calculations WHERE employer_id = ${employers.id}), 0)`,
      })
      .from(employers)
      .orderBy(desc(sql`(SELECT COUNT(*) FROM screenings WHERE employer_id = ${employers.id})`))
      .limit(20);
    
    res.json(leaderboard);
  } catch (error) {
    console.error("Employer leaderboard error:", error);
    res.status(500).json({ error: "Failed to get employer leaderboard" });
  }
});

// ============================================================================
// MULTI-CREDIT PROGRAM ANALYTICS
// ============================================================================

router.get("/programs/overview", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;

    const programFilter = isAdmin ? sql`1=1` : sql`${employerProgramAssignments.employerId} = ${employerId}`;

    const programs = await db
      .select({
        programId: taxCreditPrograms.id,
        programName: taxCreditPrograms.programName,
        state: taxCreditPrograms.state,
        category: taxCreditPrograms.programCategory,
        tier: taxCreditPrograms.tier,
      })
      .from(taxCreditPrograms)
      .innerJoin(employerProgramAssignments, eq(taxCreditPrograms.id, employerProgramAssignments.programId))
      .where(and(programFilter, eq(employerProgramAssignments.isEnabled, true), eq(taxCreditPrograms.isActive, true)));

    const screeningResults = await db
      .select({
        programId: programScreeningResults.programId,
        eligible: sql<number>`COUNT(*) FILTER (WHERE ${programScreeningResults.eligibilityResult} = 'eligible')`,
        ineligible: sql<number>`COUNT(*) FILTER (WHERE ${programScreeningResults.eligibilityResult} = 'ineligible')`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${programScreeningResults.screeningStatus} = 'pending')`,
        total: count(),
      })
      .from(programScreeningResults)
      .where(isAdmin ? sql`1=1` : sql`${programScreeningResults.employerId} = ${employerId}`)
      .groupBy(programScreeningResults.programId);

    const creditTotals = await db
      .select({
        programId: programCreditCalculations.programId,
        totalCredits: sql<number>`COALESCE(SUM(CAST(${programCreditCalculations.finalCreditAmount} AS DECIMAL)), 0)`,
        avgCredit: sql<number>`COALESCE(AVG(CAST(${programCreditCalculations.finalCreditAmount} AS DECIMAL)), 0)`,
        calcCount: count(),
      })
      .from(programCreditCalculations)
      .where(isAdmin ? sql`1=1` : sql`${programCreditCalculations.employerId} = ${employerId}`)
      .groupBy(programCreditCalculations.programId);

    const screeningMap = new Map(screeningResults.map(r => [r.programId, r]));
    const creditMap = new Map(creditTotals.map(r => [r.programId, r]));

    const enriched = programs.map(p => {
      const sr = screeningMap.get(p.programId) || { eligible: 0, ineligible: 0, pending: 0, total: 0 };
      const cr = creditMap.get(p.programId) || { totalCredits: 0, avgCredit: 0, calcCount: 0 };
      return {
        ...p,
        eligible: Number(sr.eligible),
        ineligible: Number(sr.ineligible),
        pending: Number(sr.pending),
        totalScreened: Number(sr.total),
        totalCredits: Number(cr.totalCredits),
        avgCredit: Number(cr.avgCredit),
        calculations: Number(cr.calcCount),
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error("Program overview error:", error);
    res.status(500).json({ error: "Failed to get program overview" });
  }
});

router.get("/programs/by-category", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;

    const creditFilter = isAdmin ? sql`1=1` : sql`${programCreditCalculations.employerId} = ${employerId}`;

    const byCategory = await db
      .select({
        category: taxCreditPrograms.programCategory,
        programCount: sql<number>`COUNT(DISTINCT ${taxCreditPrograms.id})`,
        totalCredits: sql<number>`COALESCE(SUM(CAST(${programCreditCalculations.finalCreditAmount} AS DECIMAL)), 0)`,
        avgCredit: sql<number>`COALESCE(AVG(CAST(${programCreditCalculations.finalCreditAmount} AS DECIMAL)), 0)`,
        employeeCount: sql<number>`COUNT(DISTINCT ${programCreditCalculations.employeeId})`,
      })
      .from(taxCreditPrograms)
      .leftJoin(programCreditCalculations, and(
        eq(taxCreditPrograms.id, programCreditCalculations.programId),
        creditFilter
      ))
      .where(eq(taxCreditPrograms.isActive, true))
      .groupBy(taxCreditPrograms.programCategory)
      .orderBy(desc(sql`COALESCE(SUM(CAST(${programCreditCalculations.finalCreditAmount} AS DECIMAL)), 0)`));

    res.json(byCategory.map(c => ({
      category: c.category,
      programCount: Number(c.programCount),
      totalCredits: Number(c.totalCredits),
      avgCredit: Number(c.avgCredit),
      employeeCount: Number(c.employeeCount),
    })));
  } catch (error) {
    console.error("Program category error:", error);
    res.status(500).json({ error: "Failed to get program categories" });
  }
});

router.get("/geographic/state-credits", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;

    const creditFilter = isAdmin ? sql`1=1` : sql`${programCreditCalculations.employerId} = ${employerId}`;

    const stateData = await db
      .select({
        state: taxCreditPrograms.state,
        programCount: sql<number>`COUNT(DISTINCT ${taxCreditPrograms.id})`,
        totalCredits: sql<number>`COALESCE(SUM(CAST(${programCreditCalculations.finalCreditAmount} AS DECIMAL)), 0)`,
        employeeCount: sql<number>`COUNT(DISTINCT ${programCreditCalculations.employeeId})`,
        calcCount: sql<number>`COUNT(${programCreditCalculations.id})`,
      })
      .from(taxCreditPrograms)
      .leftJoin(programCreditCalculations, and(
        eq(taxCreditPrograms.id, programCreditCalculations.programId),
        creditFilter
      ))
      .where(eq(taxCreditPrograms.isActive, true))
      .groupBy(taxCreditPrograms.state)
      .orderBy(desc(sql`COALESCE(SUM(CAST(${programCreditCalculations.finalCreditAmount} AS DECIMAL)), 0)`));

    res.json(stateData.map(s => ({
      state: s.state,
      stateCode: getStateCode(s.state),
      programCount: Number(s.programCount),
      totalCredits: Number(s.totalCredits),
      employeeCount: Number(s.employeeCount),
      calculations: Number(s.calcCount),
    })));
  } catch (error) {
    console.error("Geographic credits error:", error);
    res.status(500).json({ error: "Failed to get geographic data" });
  }
});

router.get("/roi/summary", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;

    const screeningFilter = isAdmin ? sql`1=1` : sql`${screenings.employerId} = ${employerId}`;
    const creditFilter = isAdmin ? sql`1=1` : sql`${creditCalculations.employerId} = ${employerId}`;
    const programCreditFilter = isAdmin ? sql`1=1` : sql`${programCreditCalculations.employerId} = ${employerId}`;

    const [wotcCredits] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${creditCalculations.projectedCreditAmount} AS DECIMAL)), 0)`,
        count: count(),
      })
      .from(creditCalculations)
      .where(creditFilter);

    const [multiCredits] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${programCreditCalculations.finalCreditAmount} AS DECIMAL)), 0)`,
        count: count(),
      })
      .from(programCreditCalculations)
      .where(programCreditFilter);

    const [screeningStats] = await db
      .select({
        total: count(),
        eligible: sql<number>`COUNT(*) FILTER (WHERE ${screenings.status} IN ('eligible', 'certified'))`,
      })
      .from(screenings)
      .where(screeningFilter);

    const [employerCount] = await db
      .select({ count: count() })
      .from(employers);

    const [employeeCount] = await db
      .select({ count: count() })
      .from(employees)
      .where(isAdmin ? sql`1=1` : sql`${employees.employerId} = ${employerId}`);

    const totalWotcCredits = Number(wotcCredits.total);
    const totalMultiCredits = Number(multiCredits.total);
    const totalAllCredits = totalWotcCredits + totalMultiCredits;
    const avgCreditPerEmployee = Number(employeeCount.count) > 0 ? totalAllCredits / Number(employeeCount.count) : 0;
    const eligibilityRate = Number(screeningStats.total) > 0 ? (Number(screeningStats.eligible) / Number(screeningStats.total)) * 100 : 0;

    res.json({
      wotcCredits: totalWotcCredits,
      multiCreditPrograms: totalMultiCredits,
      totalCredits: totalAllCredits,
      wotcCalculations: Number(wotcCredits.count),
      multiCreditCalculations: Number(multiCredits.count),
      totalEmployers: Number(employerCount.count),
      totalEmployees: Number(employeeCount.count),
      avgCreditPerEmployee: Math.round(avgCreditPerEmployee),
      eligibilityRate: parseFloat(eligibilityRate.toFixed(1)),
      estimatedAnnualROI: totalAllCredits > 0 ? Math.round(totalAllCredits * 4) : 0,
    });
  } catch (error) {
    console.error("ROI summary error:", error);
    res.status(500).json({ error: "Failed to get ROI summary" });
  }
});

router.get("/programs/credit-trends", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;
    const { months = "12" } = req.query;
    const monthCount = parseInt(months as string) || 12;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthCount);

    const creditFilter = isAdmin 
      ? gte(programCreditCalculations.createdAt, startDate)
      : and(
          eq(programCreditCalculations.employerId, employerId!),
          gte(programCreditCalculations.createdAt, startDate)
        );

    const trends = await db
      .select({
        period: sql<string>`TO_CHAR(${programCreditCalculations.createdAt}, 'YYYY-MM')`,
        category: taxCreditPrograms.programCategory,
        totalCredits: sql<number>`COALESCE(SUM(CAST(${programCreditCalculations.finalCreditAmount} AS DECIMAL)), 0)`,
        count: count(),
      })
      .from(programCreditCalculations)
      .innerJoin(taxCreditPrograms, eq(programCreditCalculations.programId, taxCreditPrograms.id))
      .where(creditFilter)
      .groupBy(sql`TO_CHAR(${programCreditCalculations.createdAt}, 'YYYY-MM')`, taxCreditPrograms.programCategory)
      .orderBy(asc(sql`TO_CHAR(${programCreditCalculations.createdAt}, 'YYYY-MM')`));

    res.json(trends.map(t => ({
      period: t.period,
      category: t.category,
      totalCredits: Number(t.totalCredits),
      count: Number(t.count),
    })));
  } catch (error) {
    console.error("Program credit trends error:", error);
    res.status(500).json({ error: "Failed to get program credit trends" });
  }
});

router.get("/submissions/summary", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;

    const subFilter = isAdmin ? sql`1=1` : sql`${programSubmissions.employerId} = ${employerId}`;

    const summary = await db
      .select({
        channel: programSubmissions.submissionChannel,
        status: programSubmissions.submissionStatus,
        count: count(),
        totalCredit: sql<number>`COALESCE(SUM(CAST(${programSubmissions.totalCreditAmount} AS DECIMAL)), 0)`,
      })
      .from(programSubmissions)
      .where(subFilter)
      .groupBy(programSubmissions.submissionChannel, programSubmissions.submissionStatus);

    res.json(summary.map(s => ({
      channel: s.channel,
      status: s.status,
      count: Number(s.count),
      totalCredit: Number(s.totalCredit),
    })));
  } catch (error) {
    console.error("Submission summary error:", error);
    res.status(500).json({ error: "Failed to get submission summary" });
  }
});

function getStateCode(stateName: string): string {
  const map: Record<string, string> = {
    Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
    Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
    Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
    Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
    Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
    Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
    Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
    "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
    Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
    Wisconsin: "WI", Wyoming: "WY",
  };
  return map[stateName] || stateName;
}

// ============================================================================
// REPORT GENERATION & MANAGEMENT
// ============================================================================

router.post("/reports/generate", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    if (!dbUser) return res.status(401).json({ error: "User not found" });

    const { reportType, employerId, periodStart, periodEnd } = req.body;
    if (!reportType) return res.status(400).json({ error: "reportType required" });

    const isAdmin = dbUser.role === "admin";
    const targetEmployerId = isAdmin ? (employerId || null) : dbUser.employerId;

    const { generateReport } = await import("../services/reportGenerator");
    const { reportId, buffer } = await generateReport({
      reportType,
      employerId: targetEmployerId || undefined,
      periodStart: periodStart ? new Date(periodStart) : undefined,
      periodEnd: periodEnd ? new Date(periodEnd) : undefined,
      generatedBy: dbUser.id,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="rockerbox_${reportType}_${reportId}.pdf"`);
    res.setHeader("X-Report-Id", reportId);
    res.send(buffer);
  } catch (error: any) {
    console.error("Report generation error:", error);
    res.status(500).json({ error: error.message || "Failed to generate report" });
  }
});

router.get("/reports", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    if (!dbUser) return res.status(401).json({ error: "User not found" });

    const isAdmin = dbUser.role === "admin";
    const employerId = isAdmin ? (req.query.employerId as string || null) : dbUser.employerId;

    const { listReports } = await import("../services/reportGenerator");
    const reports = await listReports(employerId || null);
    res.json(reports);
  } catch (error: any) {
    console.error("List reports error:", error);
    res.status(500).json({ error: "Failed to list reports" });
  }
});

router.get("/reports/:id/download", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    if (!dbUser) return res.status(401).json({ error: "User not found" });

    const [report] = await db.select().from(generatedReports).where(eq(generatedReports.id, req.params.id));
    if (!report) return res.status(404).json({ error: "Report not found" });

    if (dbUser.role !== "admin" && report.employerId !== dbUser.employerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    await db.update(generatedReports).set({
      downloadCount: (report.downloadCount || 0) + 1,
      lastDownloadedAt: new Date(),
    }).where(eq(generatedReports.id, req.params.id));

    const { generateReport } = await import("../services/reportGenerator");
    const { buffer } = await generateReport({
      reportType: report.reportType,
      employerId: report.employerId || undefined,
      periodStart: report.periodStart || undefined,
      periodEnd: report.periodEnd || undefined,
      generatedBy: dbUser.id,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="rockerbox_${report.reportType}_${report.id}.pdf"`);
    res.send(buffer);
  } catch (error: any) {
    console.error("Report download error:", error);
    res.status(500).json({ error: "Failed to download report" });
  }
});

router.delete("/reports/:id", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    if (!dbUser) return res.status(401).json({ error: "User not found" });

    const [report] = await db.select().from(generatedReports).where(eq(generatedReports.id, req.params.id));
    if (!report) return res.status(404).json({ error: "Report not found" });

    if (dbUser.role !== "admin" && report.employerId !== dbUser.employerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    await db.delete(generatedReports).where(eq(generatedReports.id, req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete report error:", error);
    res.status(500).json({ error: "Failed to delete report" });
  }
});

// Export analytics data as CSV
router.get("/export", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    const isAdmin = dbUser?.role === "admin";
    const employerId = dbUser?.employerId;
    const { startDate, endDate, type = "screenings" } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    let data: any[] = [];
    let filename = "";
    
    if (type === "screenings") {
      const whereClause = isAdmin 
        ? and(gte(screenings.createdAt, start), lte(screenings.createdAt, end))
        : and(
            eq(screenings.employerId, employerId!),
            gte(screenings.createdAt, start),
            lte(screenings.createdAt, end)
          );
      
      data = await db
        .select({
          id: screenings.id,
          status: screenings.status,
          createdAt: screenings.createdAt,
        })
        .from(screenings)
        .where(whereClause)
        .orderBy(desc(screenings.createdAt));
      
      filename = `screenings_${start.toISOString().split("T")[0]}_${end.toISOString().split("T")[0]}.csv`;
    } else if (type === "credits") {
      const whereClause = isAdmin 
        ? and(gte(creditCalculations.calculatedAt, start), lte(creditCalculations.calculatedAt, end))
        : and(
            eq(creditCalculations.employerId, employerId!),
            gte(creditCalculations.calculatedAt, start),
            lte(creditCalculations.calculatedAt, end)
          );
      
      data = await db
        .select({
          id: creditCalculations.id,
          screeningId: creditCalculations.screeningId,
          targetGroup: creditCalculations.targetGroup,
          projectedCreditAmount: creditCalculations.projectedCreditAmount,
          calculatedAt: creditCalculations.calculatedAt,
        })
        .from(creditCalculations)
        .where(whereClause)
        .orderBy(desc(creditCalculations.calculatedAt));
      
      filename = `credits_${start.toISOString().split("T")[0]}_${end.toISOString().split("T")[0]}.csv`;
    }
    
    // Convert to CSV
    if (data.length === 0) {
      return res.status(404).json({ error: "No data found for the specified period" });
    }
    
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error("Analytics export error:", error);
    res.status(500).json({ error: "Failed to export analytics data" });
  }
});

export default router;
