import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  screenings, 
  employees, 
  employers, 
  creditCalculations, 
  submissionQueue,
  users,
} from "@shared/schema";
import { eq, sql, and, gte, lte, count, desc, asc } from "drizzle-orm";

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
