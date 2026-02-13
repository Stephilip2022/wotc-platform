import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "../db";
import { 
  employers, employees, users,
  onboardingInviteTokens, onboardingInstances, onboardingTasks, 
  onboardingDocuments, onboardingFormData
} from "../../shared/schema";
import { eq, and, desc, sql, count } from "drizzle-orm";
import crypto from "crypto";
import multer from "multer";

const router = Router();

const onboardingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function getUserByClerkId(clerkId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, clerkId));
  return user;
}

const DEFAULT_ONBOARDING_STEPS = [
  { stepKey: "personal_info", title: "Personal Information", description: "Confirm your name, address, and contact details", category: "required", sortOrder: 0 },
  { stepKey: "tax_w4", title: "Federal Tax (W-4)", description: "Complete your federal W-4 tax withholding form", category: "required", sortOrder: 1 },
  { stepKey: "state_withholding", title: "State Tax Withholding", description: "Complete your state tax withholding elections", category: "required", sortOrder: 2 },
  { stepKey: "direct_deposit", title: "Direct Deposit", description: "Set up your bank account for direct deposit", category: "required", sortOrder: 3 },
  { stepKey: "emergency_contact", title: "Emergency Contact", description: "Provide an emergency contact", category: "required", sortOrder: 4 },
  { stepKey: "id_upload", title: "Photo ID Upload", description: "Upload a government-issued photo ID", category: "required", sortOrder: 5 },
  { stepKey: "policy_sign", title: "Policy Acknowledgements", description: "Review and sign required company policies", category: "required", sortOrder: 6 },
];

router.get("/employer/instances", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const [employer] = await db.select().from(employers).where(eq(employers.id, user.employerId));
    if (!employer?.onboardingModuleEnabled) {
      return res.status(403).json({ error: "Onboarding module not enabled" });
    }

    const instances = await db
      .select()
      .from(onboardingInstances)
      .where(eq(onboardingInstances.employerId, user.employerId))
      .orderBy(desc(onboardingInstances.createdAt));

    res.json(instances);
  } catch (error) {
    console.error("Error fetching onboarding instances:", error);
    res.status(500).json({ error: "Failed to fetch onboarding instances" });
  }
});

router.get("/employer/instances/:id", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const [instance] = await db
      .select()
      .from(onboardingInstances)
      .where(and(
        eq(onboardingInstances.id, req.params.id),
        eq(onboardingInstances.employerId, user.employerId)
      ));

    if (!instance) return res.status(404).json({ error: "Onboarding instance not found" });

    const tasks = await db
      .select()
      .from(onboardingTasks)
      .where(eq(onboardingTasks.instanceId, instance.id))
      .orderBy(onboardingTasks.sortOrder);

    const documents = await db
      .select()
      .from(onboardingDocuments)
      .where(eq(onboardingDocuments.instanceId, instance.id));

    res.json({ ...instance, tasks, documents });
  } catch (error) {
    console.error("Error fetching onboarding instance:", error);
    res.status(500).json({ error: "Failed to fetch onboarding instance" });
  }
});

router.post("/employer/invite", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const [employer] = await db.select().from(employers).where(eq(employers.id, user.employerId));
    if (!employer?.onboardingModuleEnabled) {
      return res.status(403).json({ error: "Onboarding module not enabled" });
    }

    const { email, firstName, lastName, phone, jobTitle, department, startDate } = req.body;
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: "email, firstName, and lastName are required" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const [invite] = await db
      .insert(onboardingInviteTokens)
      .values({
        employerId: user.employerId,
        token,
        email,
        firstName,
        lastName,
        phone,
        jobTitle,
        department,
        startDate,
        expiresAt,
      })
      .returning();

    const [instance] = await db
      .insert(onboardingInstances)
      .values({
        employerId: user.employerId,
        inviteTokenId: invite.id,
        firstName,
        lastName,
        email,
        phone,
        jobTitle,
        department,
        startDate,
        status: "pending",
        progressPercent: 0,
        currentStep: "welcome",
      })
      .returning();

    const taskRows = DEFAULT_ONBOARDING_STEPS.map(step => ({
      instanceId: instance.id,
      ...step,
      status: "pending" as const,
    }));

    await db.insert(onboardingTasks).values(taskRows);

    const onboardLink = `${req.protocol}://${req.get("host")}/onboard/${token}`;

    res.json({
      invite,
      instance,
      onboardLink,
      message: `Onboarding invite created for ${firstName} ${lastName}`,
    });
  } catch (error) {
    console.error("Error creating onboarding invite:", error);
    res.status(500).json({ error: "Failed to create onboarding invite" });
  }
});

router.get("/employer/metrics", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const instances = await db
      .select()
      .from(onboardingInstances)
      .where(eq(onboardingInstances.employerId, user.employerId));

    const total = instances.length;
    const completed = instances.filter(i => i.status === "completed").length;
    const inProgress = instances.filter(i => i.status === "in_progress").length;
    const pending = instances.filter(i => i.status === "pending").length;

    const completedInstances = instances.filter(i => i.completedAt && i.startedAt);
    const avgCompletionMinutes = completedInstances.length > 0
      ? completedInstances.reduce((sum, i) => {
          const diff = new Date(i.completedAt!).getTime() - new Date(i.startedAt!).getTime();
          return sum + diff / (1000 * 60);
        }, 0) / completedInstances.length
      : 0;

    const avgProgress = total > 0
      ? Math.round(instances.reduce((sum, i) => sum + i.progressPercent, 0) / total)
      : 0;

    const upcomingHires = instances
      .filter(i => i.startDate && i.status !== "completed")
      .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))
      .slice(0, 10);

    res.json({
      total,
      completed,
      inProgress,
      pending,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      avgCompletionMinutes: Math.round(avgCompletionMinutes),
      avgProgress,
      upcomingHires,
    });
  } catch (error) {
    console.error("Error fetching onboarding metrics:", error);
    res.status(500).json({ error: "Failed to fetch onboarding metrics" });
  }
});

router.post("/employer/resend-invite/:instanceId", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const [instance] = await db
      .select()
      .from(onboardingInstances)
      .where(and(
        eq(onboardingInstances.id, req.params.instanceId),
        eq(onboardingInstances.employerId, user.employerId)
      ));

    if (!instance) return res.status(404).json({ error: "Onboarding instance not found" });

    if (instance.inviteTokenId) {
      const [oldToken] = await db
        .select()
        .from(onboardingInviteTokens)
        .where(eq(onboardingInviteTokens.id, instance.inviteTokenId));

      if (oldToken) {
        const onboardLink = `${req.protocol}://${req.get("host")}/onboard/${oldToken.token}`;
        return res.json({ onboardLink, message: "Invite link retrieved" });
      }
    }

    res.status(404).json({ error: "No invite token found for this instance" });
  } catch (error) {
    console.error("Error resending invite:", error);
    res.status(500).json({ error: "Failed to resend invite" });
  }
});

export default router;
