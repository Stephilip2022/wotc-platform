import { Router } from "express";
import { getAuth } from "@clerk/express";
import {
  scanEmployeeForCredits,
  getEmployeeOtherCredits,
  getEmployerOtherCredits,
  batchScanEmployer
} from "../services/multiCreditBundling";
import { db } from "../db";
import { employees, otherTaxCredits, users } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

/**
 * POST /api/credits/scan
 * Scan a single employee for all available tax credits
 */
router.post("/scan", async (req, res) => {
  try {
    const { employeeId } = req.body;
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;

    if (!employeeId) {
      return res.status(400).json({ error: "employeeId is required" });
    }

    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    // Verify employee belongs to this employer
    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.employerId, employerId)
        )
      )
      .limit(1);

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Scan for credits
    const opportunities = await scanEmployeeForCredits(employeeId);

    res.json({
      employeeId,
      creditsFound: opportunities.length,
      opportunities,
    });
  } catch (error: any) {
    console.error("Error scanning for credits:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/credits/batch-scan
 * Scan all employees for an employer
 */
router.post("/batch-scan", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;

    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const scanned = await batchScanEmployer(employerId);

    res.json({
      success: true,
      message: `Scanned ${scanned} employees for additional tax credits`,
      employeesScanned: scanned,
    });
  } catch (error: any) {
    console.error("Error batch scanning for credits:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/credits/other/:employeeId
 * Get all other (non-WOTC) tax credits for an employee
 */
router.get("/other/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;

    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    // Verify employee belongs to this employer
    const [employee] = await db
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.employerId, employerId)
        )
      )
      .limit(1);

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const credits = await getEmployeeOtherCredits(employeeId);

    res.json(credits);
  } catch (error: any) {
    console.error("Error fetching other credits:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/credits/other
 * Get all other tax credits for the employer
 */
router.get("/other", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;

    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const credits = await getEmployerOtherCredits(employerId);

    res.json(credits);
  } catch (error: any) {
    console.error("Error fetching employer other credits:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/credits/summary
 * Get summary of all credits (WOTC + other) for employer
 */
router.get("/summary", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;

    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    // Get other tax credits summary
    const [otherCreditsSummary] = await db
      .select({
        totalValue: sql<number>`COALESCE(SUM(CAST(${otherTaxCredits.estimatedValue} AS NUMERIC)), 0)`,
        creditCount: sql<number>`COUNT(*)`,
        byCategory: sql<any>`
          json_agg(
            json_build_object(
              'category', ${otherTaxCredits.creditCategory},
              'count', COUNT(*),
              'value', SUM(CAST(${otherTaxCredits.estimatedValue} AS NUMERIC))
            )
          )
        `,
      })
      .from(otherTaxCredits)
      .where(eq(otherTaxCredits.employerId, employerId));

    res.json({
      otherCredits: {
        totalValue: Number(otherCreditsSummary.totalValue || 0),
        count: Number(otherCreditsSummary.creditCount || 0),
        byCategory: otherCreditsSummary.byCategory || [],
      },
    });
  } catch (error: any) {
    console.error("Error fetching credits summary:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/credits/other/:id/status
 * Update status of an other tax credit
 */
router.patch("/other/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const clerkUserId = getAuth(req).userId!;
    const [currentUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
    const employerId = currentUser?.employerId;

    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }

    // Get credit
    const [credit] = await db
      .select()
      .from(otherTaxCredits)
      .where(eq(otherTaxCredits.id, id))
      .limit(1);

    if (!credit) {
      return res.status(404).json({ error: "Credit not found" });
    }

    // Verify credit belongs to this employer
    if (credit.employerId !== employerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Update status
    const updateData: any = {
      status,
      lastReviewedAt: new Date(),
      updatedAt: new Date(),
    };

    if (status === "claimed") {
      updateData.claimedAt = new Date();
    }

    await db
      .update(otherTaxCredits)
      .set(updateData)
      .where(eq(otherTaxCredits.id, id));

    // Return updated credit
    const [updated] = await db
      .select()
      .from(otherTaxCredits)
      .where(eq(otherTaxCredits.id, id))
      .limit(1);

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating credit status:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
