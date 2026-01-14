import { Router, Request, Response } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  processDeterminationLetter,
  getCertificationQueue,
  getCertificationStats,
  processAllPendingCertifications,
  generateCertificationReport,
} from "../services/certificationAutomation";

const router = Router();

router.get("/queue", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    const employerId = dbUser?.role === "admin" ? undefined : dbUser?.employerId || undefined;
    const queue = await getCertificationQueue(employerId);
    
    res.json(queue);
  } catch (error) {
    console.error("Failed to get certification queue:", error);
    res.status(500).json({ error: "Failed to get certification queue" });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    const employerId = dbUser?.role === "admin" ? undefined : dbUser?.employerId || undefined;
    const stats = await getCertificationStats(employerId);
    
    res.json(stats);
  } catch (error) {
    console.error("Failed to get certification stats:", error);
    res.status(500).json({ error: "Failed to get certification stats" });
  }
});

router.post("/process/:determinationLetterId", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const { determinationLetterId } = req.params;
    
    const result = await processDeterminationLetter(determinationLetterId, user.sub);
    
    res.json(result);
  } catch (error) {
    console.error("Failed to process determination letter:", error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to process determination letter" 
    });
  }
});

router.post("/process-all", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    if (dbUser?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const result = await processAllPendingCertifications(user.sub);
    
    res.json(result);
  } catch (error) {
    console.error("Failed to process all certifications:", error);
    res.status(500).json({ error: "Failed to process all certifications" });
  }
});

router.get("/report/:employerId", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user?.claims;
    const [dbUser] = await db.select().from(users).where(eq(users.id, user.sub));
    
    const { employerId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (dbUser?.role !== "admin" && dbUser?.employerId !== employerId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    const report = await generateCertificationReport(employerId, start, end);
    
    res.json(report);
  } catch (error) {
    console.error("Failed to generate certification report:", error);
    res.status(500).json({ error: "Failed to generate certification report" });
  }
});

export default router;
