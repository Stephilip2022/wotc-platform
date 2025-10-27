import { Router } from "express";
import { 
  calculateMilestoneProgress,
  updateMilestoneTracking,
  predictTurnoverRisk,
  getEmployeesAtRisk,
  batchUpdateMilestones
} from "../services/retentionOptimization";
import { db } from "../db";
import { 
  retentionMilestones,
  retentionAlerts,
  turnoverPredictions,
  employees
} from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

/**
 * GET /api/retention/at-risk
 * Get all employees at risk (near milestones or high turnover risk)
 */
router.get("/at-risk", async (req, res) => {
  try {
    const employerId = req.user?.claims?.employerId;
    
    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const atRiskEmployees = await getEmployeesAtRisk(employerId);

    res.json(atRiskEmployees);
  } catch (error: any) {
    console.error("Error fetching at-risk employees:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/retention/milestones/:employeeId
 * Get detailed milestone progress for a specific employee
 */
router.get("/milestones/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employerId = req.user?.claims?.employerId;

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

    // Update milestone data first
    await updateMilestoneTracking(employeeId);

    // Get milestone details
    const [milestone] = await db
      .select()
      .from(retentionMilestones)
      .where(eq(retentionMilestones.employeeId, employeeId))
      .limit(1);

    // Get latest turnover prediction
    const [prediction] = await db
      .select()
      .from(turnoverPredictions)
      .where(eq(turnoverPredictions.employeeId, employeeId))
      .orderBy(desc(turnoverPredictions.predictedAt))
      .limit(1);

    // Get active alerts
    const alerts = await db
      .select()
      .from(retentionAlerts)
      .where(
        and(
          eq(retentionAlerts.employeeId, employeeId),
          eq(retentionAlerts.dismissed, false)
        )
      )
      .orderBy(desc(retentionAlerts.createdAt))
      .limit(10);

    res.json({
      employee,
      milestone,
      prediction,
      alerts,
    });
  } catch (error: any) {
    console.error("Error fetching milestone details:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/retention/predict
 * Trigger AI turnover risk prediction for an employee
 */
router.post("/predict", async (req, res) => {
  try {
    const { employeeId } = req.body;
    const employerId = req.user?.claims?.employerId;

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

    // Run AI prediction
    await predictTurnoverRisk(employeeId);

    // Get the prediction
    const [prediction] = await db
      .select()
      .from(turnoverPredictions)
      .where(eq(turnoverPredictions.employeeId, employeeId))
      .orderBy(desc(turnoverPredictions.predictedAt))
      .limit(1);

    res.json(prediction);
  } catch (error: any) {
    console.error("Error predicting turnover risk:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/retention/alerts/:id/acknowledge
 * Acknowledge a retention alert
 */
router.patch("/alerts/:id/acknowledge", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.claims?.sub;
    const employerId = req.user?.claims?.employerId;

    if (!userId || !employerId) {
      return res.status(403).json({ error: "Authentication required" });
    }

    // Get alert
    const [alert] = await db
      .select()
      .from(retentionAlerts)
      .where(eq(retentionAlerts.id, id))
      .limit(1);

    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    // Verify alert belongs to this employer
    if (alert.employerId !== employerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Acknowledge alert
    await db
      .update(retentionAlerts)
      .set({
        acknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(retentionAlerts.id, id));

    // Return updated alert
    const [updated] = await db
      .select()
      .from(retentionAlerts)
      .where(eq(retentionAlerts.id, id))
      .limit(1);

    res.json(updated);
  } catch (error: any) {
    console.error("Error acknowledging alert:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/retention/alerts/:id/dismiss
 * Dismiss a retention alert
 */
router.patch("/alerts/:id/dismiss", async (req, res) => {
  try {
    const { id } = req.params;
    const employerId = req.user?.claims?.employerId;

    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    // Get alert
    const [alert] = await db
      .select()
      .from(retentionAlerts)
      .where(eq(retentionAlerts.id, id))
      .limit(1);

    if (!alert) {
      return res.status(404).json({ error: "Alert not found" });
    }

    // Verify alert belongs to this employer
    if (alert.employerId !== employerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Dismiss alert
    await db
      .update(retentionAlerts)
      .set({
        dismissed: true,
        updatedAt: new Date(),
      })
      .where(eq(retentionAlerts.id, id));

    // Return updated alert
    const [updated] = await db
      .select()
      .from(retentionAlerts)
      .where(eq(retentionAlerts.id, id))
      .limit(1);

    res.json(updated);
  } catch (error: any) {
    console.error("Error dismissing alert:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/retention/batch-update
 * Batch update milestones for all active employees
 */
router.post("/batch-update", async (req, res) => {
  try {
    const employerId = req.user?.claims?.employerId;

    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const updated = await batchUpdateMilestones(employerId);

    res.json({ 
      success: true, 
      message: `Updated milestones for ${updated} employees`,
      updated 
    });
  } catch (error: any) {
    console.error("Error batch updating milestones:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/retention/alerts
 * Get all active retention alerts for an employer
 */
router.get("/alerts", async (req, res) => {
  try {
    const employerId = req.user?.claims?.employerId;

    if (!employerId) {
      return res.status(403).json({ error: "Employer access required" });
    }

    const alerts = await db
      .select({
        alert: retentionAlerts,
        employee: employees,
      })
      .from(retentionAlerts)
      .innerJoin(employees, eq(employees.id, retentionAlerts.employeeId))
      .where(
        and(
          eq(retentionAlerts.employerId, employerId),
          eq(retentionAlerts.dismissed, false)
        )
      )
      .orderBy(desc(retentionAlerts.createdAt))
      .limit(100);

    res.json(alerts);
  } catch (error: any) {
    console.error("Error fetching retention alerts:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
