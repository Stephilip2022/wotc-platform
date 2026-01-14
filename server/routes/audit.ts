import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { auditLogs, complianceReports, users, employers } from "@shared/schema";
import { eq, and, gte, lte, desc, asc, or, sql, count } from "drizzle-orm";

const router = Router();

// Middleware to log audit events
export async function logAuditEvent(
  userId: string | null,
  action: string,
  resourceType: string,
  resourceId: string | null,
  options: {
    employerId?: string;
    userEmail?: string;
    userRole?: string;
    ipAddress?: string;
    userAgent?: string;
    previousData?: any;
    newData?: any;
    description?: string;
    category?: string;
    severity?: string;
    piiAccessed?: boolean;
    exportedData?: boolean;
    requestId?: string;
    sessionId?: string;
  } = {}
): Promise<void> {
  try {
    const changedFields = options.previousData && options.newData
      ? getChangedFields(options.previousData, options.newData)
      : null;

    await db.insert(auditLogs).values({
      userId,
      action,
      resourceType,
      resourceId,
      employerId: options.employerId,
      userEmail: options.userEmail,
      userRole: options.userRole,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      previousData: options.previousData,
      newData: options.newData,
      changedFields,
      description: options.description,
      category: options.category || "general",
      severity: options.severity || "info",
      piiAccessed: options.piiAccessed || false,
      exportedData: options.exportedData || false,
      requestId: options.requestId,
      sessionId: options.sessionId,
    } as any);
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

function getChangedFields(previous: any, current: any): string[] {
  const changed: string[] = [];
  const prevKeys = Object.keys(previous || {});
  const currKeys = Object.keys(current || {});
  const allKeys = Array.from(new Set([...prevKeys, ...currKeys]));
  
  for (let i = 0; i < allKeys.length; i++) {
    const key = allKeys[i];
    if (JSON.stringify(previous?.[key]) !== JSON.stringify(current?.[key])) {
      changed.push(key);
    }
  }
  
  return changed;
}

// Express middleware for automatic request logging
export function auditMiddleware(
  resourceType: string,
  actionMapper?: (method: string) => string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user?.claims;
    const action = actionMapper 
      ? actionMapper(req.method) 
      : methodToAction(req.method);
    
    const originalSend = res.send;
    res.send = function(body: any) {
      // Log after response
      logAuditEvent(
        user?.sub,
        action,
        resourceType,
        req.params.id || null,
        {
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          userEmail: user?.email,
          description: `${action} ${resourceType} ${req.params.id || ""}`.trim(),
        }
      );
      return originalSend.call(this, body);
    };
    
    next();
  };
}

function methodToAction(method: string): string {
  switch (method) {
    case "GET": return "read";
    case "POST": return "create";
    case "PUT":
    case "PATCH": return "update";
    case "DELETE": return "delete";
    default: return "access";
  }
}

// Get audit logs (admin only or own employer's logs)
router.get("/", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    if (!dbUser) {
      return res.status(401).json({ error: "User not found" });
    }
    
    const isAdmin = dbUser.role === "admin";
    const { 
      page = "1", 
      limit = "50", 
      action, 
      resourceType, 
      category,
      severity,
      startDate, 
      endDate,
      userId,
      requiresReview,
    } = req.query;
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    // Build where conditions
    const conditions = [];
    
    if (!isAdmin && dbUser.employerId) {
      conditions.push(eq(auditLogs.employerId, dbUser.employerId));
    }
    
    if (action) {
      conditions.push(eq(auditLogs.action, action as string));
    }
    
    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType as string));
    }
    
    if (category) {
      conditions.push(eq(auditLogs.category, category as string));
    }
    
    if (severity) {
      conditions.push(eq(auditLogs.severity, severity as string));
    }
    
    if (startDate) {
      conditions.push(gte(auditLogs.timestamp, new Date(startDate as string)));
    }
    
    if (endDate) {
      conditions.push(lte(auditLogs.timestamp, new Date(endDate as string)));
    }
    
    if (userId && isAdmin) {
      conditions.push(eq(auditLogs.userId, userId as string));
    }
    
    if (requiresReview === "true") {
      conditions.push(eq(auditLogs.requiresReview, true));
      conditions.push(eq(auditLogs.reviewed, false));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [logs, totalResult] = await Promise.all([
      db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.timestamp))
        .limit(parseInt(limit as string))
        .offset(offset),
      db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause),
    ]);
    
    res.json({
      logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalResult[0]?.count || 0,
        pages: Math.ceil((totalResult[0]?.count || 0) / parseInt(limit as string)),
      },
    });
  } catch (error) {
    console.error("Failed to get audit logs:", error);
    res.status(500).json({ error: "Failed to retrieve audit logs" });
  }
});

// Get audit log statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    if (!dbUser) {
      return res.status(401).json({ error: "User not found" });
    }
    
    const isAdmin = dbUser.role === "admin";
    const whereClause = isAdmin 
      ? sql`1=1` 
      : sql`${auditLogs.employerId} = ${dbUser.employerId}`;
    
    const [totalLogs] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereClause);
    
    const [todayLogs] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(and(
        whereClause,
        gte(auditLogs.timestamp, sql`CURRENT_DATE`)
      ));
    
    const [pendingReview] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(and(
        whereClause,
        eq(auditLogs.requiresReview, true),
        eq(auditLogs.reviewed, false)
      ));
    
    const [criticalLogs] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(and(
        whereClause,
        eq(auditLogs.severity, "critical")
      ));
    
    const actionBreakdown = await db
      .select({
        action: auditLogs.action,
        count: count(),
      })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.action)
      .orderBy(desc(count()))
      .limit(10);
    
    const categoryBreakdown = await db
      .select({
        category: auditLogs.category,
        count: count(),
      })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.category)
      .orderBy(desc(count()));
    
    res.json({
      total: totalLogs.count,
      today: todayLogs.count,
      pendingReview: pendingReview.count,
      critical: criticalLogs.count,
      actionBreakdown,
      categoryBreakdown,
    });
  } catch (error) {
    console.error("Failed to get audit stats:", error);
    res.status(500).json({ error: "Failed to get audit statistics" });
  }
});

// Mark audit log as reviewed (admin only)
router.post("/:id/review", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    if (dbUser?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const { id } = req.params;
    const { notes } = req.body;
    
    const [updated] = await db
      .update(auditLogs)
      .set({
        reviewed: true,
        reviewedBy: user.sub,
        reviewedAt: new Date(),
        reviewNotes: notes,
      })
      .where(eq(auditLogs.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Audit log not found" });
    }
    
    res.json(updated);
  } catch (error) {
    console.error("Failed to review audit log:", error);
    res.status(500).json({ error: "Failed to mark as reviewed" });
  }
});

// Generate compliance report
router.post("/compliance-report", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    if (!dbUser || (dbUser.role !== "admin" && dbUser.role !== "employer")) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const { reportType, periodStart, periodEnd, employerId } = req.body;
    
    const targetEmployerId = dbUser.role === "admin" ? employerId : dbUser.employerId;
    
    // Create report record
    const [report] = await db
      .insert(complianceReports)
      .values({
        employerId: targetEmployerId,
        reportType,
        reportName: `${reportType.replace(/_/g, " ")} - ${new Date(periodStart).toLocaleDateString()} to ${new Date(periodEnd).toLocaleDateString()}`,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        status: "generating",
        generatedBy: user.sub,
        generationMethod: "manual",
      } as any)
      .returning();
    
    // Generate report data asynchronously
    generateComplianceReportData(report.id, targetEmployerId, reportType, new Date(periodStart), new Date(periodEnd));
    
    res.json(report);
  } catch (error) {
    console.error("Failed to generate compliance report:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

// Get compliance reports
router.get("/compliance-reports", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    if (!dbUser) {
      return res.status(401).json({ error: "User not found" });
    }
    
    const isAdmin = dbUser.role === "admin";
    const whereClause = isAdmin 
      ? undefined 
      : eq(complianceReports.employerId, dbUser.employerId!);
    
    const reports = await db
      .select()
      .from(complianceReports)
      .where(whereClause)
      .orderBy(desc(complianceReports.createdAt))
      .limit(50);
    
    res.json(reports);
  } catch (error) {
    console.error("Failed to get compliance reports:", error);
    res.status(500).json({ error: "Failed to retrieve reports" });
  }
});

// Get specific compliance report
router.get("/compliance-reports/:id", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    if (!dbUser) {
      return res.status(401).json({ error: "User not found" });
    }
    
    const { id } = req.params;
    
    const [report] = await db
      .select()
      .from(complianceReports)
      .where(eq(complianceReports.id, id));
    
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    
    // Check access
    if (dbUser.role !== "admin" && report.employerId !== dbUser.employerId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(report);
  } catch (error) {
    console.error("Failed to get compliance report:", error);
    res.status(500).json({ error: "Failed to retrieve report" });
  }
});

// Helper function to generate report data
async function generateComplianceReportData(
  reportId: string,
  employerId: string | null,
  reportType: string,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  try {
    const whereClause = employerId 
      ? and(
          eq(auditLogs.employerId, employerId),
          gte(auditLogs.timestamp, periodStart),
          lte(auditLogs.timestamp, periodEnd)
        )
      : and(
          gte(auditLogs.timestamp, periodStart),
          lte(auditLogs.timestamp, periodEnd)
        );
    
    // Gather statistics
    const [totalActions] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(whereClause);
    
    const actionBreakdown = await db
      .select({
        action: auditLogs.action,
        count: count(),
      })
      .from(auditLogs)
      .where(whereClause)
      .groupBy(auditLogs.action);
    
    const [piiAccesses] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(and(whereClause, eq(auditLogs.piiAccessed, true)));
    
    const [dataExports] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(and(whereClause, eq(auditLogs.exportedData, true)));
    
    const [criticalEvents] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(and(whereClause, eq(auditLogs.severity, "critical")));
    
    const findings: string[] = [];
    const recommendations: string[] = [];
    
    // Generate findings based on data
    if (piiAccesses.count > 100) {
      findings.push(`High volume of PII access events (${piiAccesses.count})`);
      recommendations.push("Review PII access patterns and implement additional access controls if needed");
    }
    
    if (criticalEvents.count > 0) {
      findings.push(`${criticalEvents.count} critical security events detected`);
      recommendations.push("Investigate critical events and update security policies");
    }
    
    if (dataExports.count > 50) {
      findings.push(`${dataExports.count} data export operations during this period`);
      recommendations.push("Review data export policies and ensure compliance with data retention requirements");
    }
    
    const summary = {
      totalActions: totalActions.count,
      piiAccesses: piiAccesses.count,
      dataExports: dataExports.count,
      criticalEvents: criticalEvents.count,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };
    
    const details = {
      actionBreakdown,
    };
    
    // Update report with generated data
    await db
      .update(complianceReports)
      .set({
        status: "completed",
        summary,
        details,
        findings,
        recommendations,
        generatedAt: new Date(),
      })
      .where(eq(complianceReports.id, reportId));
    
  } catch (error) {
    console.error("Failed to generate compliance report data:", error);
    await db
      .update(complianceReports)
      .set({ status: "failed" })
      .where(eq(complianceReports.id, reportId));
  }
}

export default router;
