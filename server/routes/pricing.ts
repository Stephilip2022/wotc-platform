import { Router } from "express";
import { getAuth } from "@clerk/express";
import { isAuthenticated } from "../clerkAuth";
import { db } from "../db";
import { users, employers } from "@shared/schema";
import { eq, or, and } from "drizzle-orm";
import {
  createPricingPlan,
  getPricingPlans,
  getPricingPlanById,
  updatePricingPlan,
  assignPricingPlanToEmployer,
  getEmployerBilling,
  calculatePricing,
  initializeDefaultPricingPlans,
  DEFAULT_MILESTONE_FEES_EXPORT,
  DEFAULT_SCREENING_TIERS_EXPORT,
  DEFAULT_DEFERRED_CONFIG_EXPORT,
} from "../services/pricing";

const router = Router();

async function isAdmin(userId: string): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user?.role === "admin";
}

async function canAccessEmployerBilling(userId: string, employerId: string): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "employer" && user.employerId === employerId) return true;
  return false;
}

router.get("/plans", isAuthenticated, async (req, res) => {
  try {
    const plans = await getPricingPlans();
    res.json(plans);
  } catch (error: any) {
    console.error("Error fetching pricing plans:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pricing plans" });
  }
});

router.get("/plans/all", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuth(req).userId!;
    if (!await isAdmin(userId)) {
      return res.status(403).json({ error: "Admin access required" });
    }
    const plans = await getPricingPlans(false);
    res.json(plans);
  } catch (error: any) {
    console.error("Error fetching all pricing plans:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pricing plans" });
  }
});

router.get("/plans/:id", isAuthenticated, async (req, res) => {
  try {
    const plan = await getPricingPlanById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: "Pricing plan not found" });
    }
    res.json(plan);
  } catch (error: any) {
    console.error("Error fetching pricing plan:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pricing plan" });
  }
});

router.post("/plans", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuth(req).userId!;
    if (!await isAdmin(userId)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const plan = await createPricingPlan(req.body);
    res.json(plan);
  } catch (error: any) {
    console.error("Error creating pricing plan:", error);
    res.status(500).json({ error: error.message || "Failed to create pricing plan" });
  }
});

router.put("/plans/:id", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuth(req).userId!;
    if (!await isAdmin(userId)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const plan = await updatePricingPlan(req.params.id, req.body);
    if (!plan) {
      return res.status(404).json({ error: "Pricing plan not found" });
    }
    res.json(plan);
  } catch (error: any) {
    console.error("Error updating pricing plan:", error);
    res.status(500).json({ error: error.message || "Failed to update pricing plan" });
  }
});

router.post("/employer/:employerId/assign", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuth(req).userId!;
    const { employerId } = req.params;
    
    if (!await canAccessEmployerBilling(userId, employerId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { pricingPlanId, customOverrides } = req.body;
    
    const userIsAdmin = await isAdmin(userId);
    if (customOverrides && !userIsAdmin) {
      return res.status(403).json({ error: "Custom overrides require admin access" });
    }

    const billing = await assignPricingPlanToEmployer(employerId, pricingPlanId, userIsAdmin ? customOverrides : undefined);
    res.json(billing);
  } catch (error: any) {
    console.error("Error assigning pricing plan:", error);
    res.status(500).json({ error: error.message || "Failed to assign pricing plan" });
  }
});

router.get("/employer/:employerId", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuth(req).userId!;
    const { employerId } = req.params;
    
    if (!await canAccessEmployerBilling(userId, employerId)) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const billing = await getEmployerBilling(employerId);
    res.json(billing || { billing: null, plan: null });
  } catch (error: any) {
    console.error("Error fetching employer billing:", error);
    res.status(500).json({ error: error.message || "Failed to fetch employer billing" });
  }
});

router.post("/calculate", async (req, res) => {
  try {
    const result = await calculatePricing(req.body);
    res.json(result);
  } catch (error: any) {
    console.error("Error calculating pricing:", error);
    res.status(500).json({ error: error.message || "Failed to calculate pricing" });
  }
});

router.post("/initialize", isAuthenticated, async (req, res) => {
  try {
    const userId = getAuth(req).userId!;
    if (!await isAdmin(userId)) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const plans = await initializeDefaultPricingPlans();
    res.json(plans);
  } catch (error: any) {
    console.error("Error initializing default plans:", error);
    res.status(500).json({ error: error.message || "Failed to initialize default plans" });
  }
});

router.get("/defaults", async (req, res) => {
  try {
    res.json({
      milestoneFees: DEFAULT_MILESTONE_FEES_EXPORT,
      screeningTiers: DEFAULT_SCREENING_TIERS_EXPORT,
      deferredConfig: DEFAULT_DEFERRED_CONFIG_EXPORT,
    });
  } catch (error: any) {
    console.error("Error fetching defaults:", error);
    res.status(500).json({ error: error.message || "Failed to fetch defaults" });
  }
});

export default router;
