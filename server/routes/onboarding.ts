import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "../db";
import { 
  employers, employees, users,
  onboardingInviteTokens, onboardingInstances, onboardingTasks, 
  onboardingDocuments, onboardingFormData,
  onboardingSettings, onboardingTemplates
} from "../../shared/schema";
import { eq, and, desc, sql, count, inArray } from "drizzle-orm";
import crypto from "crypto";
import multer from "multer";
import { sendOnboardingInviteEmail } from "../email/notifications";
import { sendSms, formatPhoneNumber } from "../services/twilioSms";

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

    const { email, firstName, lastName, phone, jobTitle, department, startDate, templateId } = req.body;
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: "email, firstName, and lastName are required" });
    }

    const [settings] = await db.select().from(onboardingSettings).where(eq(onboardingSettings.employerId, user.employerId));

    let template = null;
    if (templateId) {
      const [t] = await db.select().from(onboardingTemplates)
        .where(and(eq(onboardingTemplates.id, templateId), eq(onboardingTemplates.employerId, user.employerId)));
      template = t || null;
    }

    const deadlineDays = settings?.deadlineDays || 30;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + deadlineDays);

    const effectiveJobTitle = jobTitle || template?.jobTitle || "";
    const effectiveDepartment = department || template?.department || "";

    const [invite] = await db
      .insert(onboardingInviteTokens)
      .values({
        employerId: user.employerId,
        token,
        email,
        firstName,
        lastName,
        phone,
        jobTitle: effectiveJobTitle,
        department: effectiveDepartment,
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
        jobTitle: effectiveJobTitle,
        department: effectiveDepartment,
        startDate,
        status: "pending",
        progressPercent: 0,
        currentStep: "welcome",
      })
      .returning();

    const activeStepKeys = new Set([
      ...(template?.requiredSteps || settings?.requiredSteps || DEFAULT_ONBOARDING_STEPS.map(s => s.stepKey)),
      ...(template?.optionalSteps || settings?.optionalSteps || []),
    ]);

    const taskRows = DEFAULT_ONBOARDING_STEPS
      .filter(step => activeStepKeys.has(step.stepKey))
      .map((step, idx) => {
        const isOptional = (template?.optionalSteps || settings?.optionalSteps || []).includes(step.stepKey);
        return {
          instanceId: instance.id,
          ...step,
          category: isOptional ? "optional" : "required",
          sortOrder: idx,
          status: "pending" as const,
        };
      });

    await db.insert(onboardingTasks).values(taskRows);

    const onboardLink = `${req.protocol}://${req.get("host")}/onboard/${token}`;

    const notifications: { email?: boolean; sms?: boolean } = {};

    try {
      const emailResult = await sendOnboardingInviteEmail(email, {
        firstName,
        employerName: employer.name,
        onboardingUrl: onboardLink,
        jobTitle,
        startDate,
        employerLogoUrl: employer.logoUrl || undefined,
      });
      notifications.email = emailResult.success;
    } catch (e) {
      console.error("[Onboarding] Email send failed:", e);
      notifications.email = false;
    }

    if (phone) {
      try {
        const formattedPhone = formatPhoneNumber(phone);
        if (formattedPhone) {
          const smsResult = await sendSms(
            formattedPhone,
            `Hi ${firstName}! Welcome to ${employer.name}. Please complete your onboarding: ${onboardLink}`
          );
          notifications.sms = smsResult.success;
        }
      } catch (e) {
        console.error("[Onboarding] SMS send failed:", e);
        notifications.sms = false;
      }
    }

    res.json({
      invite,
      instance,
      onboardLink,
      notifications,
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

router.get("/employer/instances/:id/detail", async (req, res) => {
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
      .select({
        id: onboardingDocuments.id,
        documentType: onboardingDocuments.documentType,
        fileName: onboardingDocuments.fileName,
        fileSize: onboardingDocuments.fileSize,
        mimeType: onboardingDocuments.mimeType,
        status: onboardingDocuments.status,
        signedAt: onboardingDocuments.signedAt,
        createdAt: onboardingDocuments.createdAt,
      })
      .from(onboardingDocuments)
      .where(eq(onboardingDocuments.instanceId, instance.id));

    const forms = await db
      .select()
      .from(onboardingFormData)
      .where(eq(onboardingFormData.instanceId, instance.id));

    const parsedForms = forms.map(f => {
      let data;
      try { data = JSON.parse(f.formData); } catch { data = {}; }
      if (data.ssn) data.ssn = "***-**-" + (data.ssn as string).slice(-4);
      if (data.accountNumber) data.accountNumber = "****" + (data.accountNumber as string).slice(-4);
      if (data.routingNumber) data.routingNumber = "****" + (data.routingNumber as string).slice(-5);
      return { formType: f.formType, formData: data, isComplete: f.isComplete, updatedAt: f.updatedAt };
    });

    const timeline = tasks
      .filter(t => t.completedAt)
      .map(t => ({ step: t.title, stepKey: t.stepKey, completedAt: t.completedAt, sortOrder: t.sortOrder }))
      .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime());

    let inviteToken = null;
    if (instance.inviteTokenId) {
      const [tk] = await db.select().from(onboardingInviteTokens).where(eq(onboardingInviteTokens.id, instance.inviteTokenId));
      if (tk) inviteToken = { token: tk.token, expiresAt: tk.expiresAt, usedAt: tk.usedAt };
    }

    res.json({
      instance,
      tasks,
      documents,
      forms: parsedForms,
      timeline,
      inviteToken,
    });
  } catch (error) {
    console.error("Error fetching onboarding instance detail:", error);
    res.status(500).json({ error: "Failed to fetch onboarding instance detail" });
  }
});

router.get("/employer/analytics", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const instances = await db
      .select()
      .from(onboardingInstances)
      .where(eq(onboardingInstances.employerId, user.employerId));

    const allTasks = instances.length > 0
      ? await db
          .select()
          .from(onboardingTasks)
          .where(sql`${onboardingTasks.instanceId} IN (${sql.join(instances.map(i => sql`${i.id}`), sql`, `)})`)
      : [];

    const stepNames = DEFAULT_ONBOARDING_STEPS.map(s => s.stepKey);
    const funnel = stepNames.map(stepKey => {
      const matching = allTasks.filter(t => t.stepKey === stepKey);
      const completed = matching.filter(t => t.status === "completed").length;
      const total = matching.length;
      const step = DEFAULT_ONBOARDING_STEPS.find(s => s.stepKey === stepKey);
      return {
        stepKey,
        title: step?.title || stepKey,
        completedCount: completed,
        totalCount: total,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    });

    const completedInstances = instances.filter(i => i.completedAt && i.startedAt);
    const timeBreakdown = completedInstances.map(i => {
      const diff = new Date(i.completedAt!).getTime() - new Date(i.startedAt!).getTime();
      return diff / (1000 * 60);
    });

    const avgMinutes = timeBreakdown.length > 0
      ? Math.round(timeBreakdown.reduce((s, v) => s + v, 0) / timeBreakdown.length)
      : 0;
    const medianMinutes = timeBreakdown.length > 0
      ? Math.round(timeBreakdown.sort((a, b) => a - b)[Math.floor(timeBreakdown.length / 2)])
      : 0;
    const fastestMinutes = timeBreakdown.length > 0 ? Math.round(Math.min(...timeBreakdown)) : 0;
    const slowestMinutes = timeBreakdown.length > 0 ? Math.round(Math.max(...timeBreakdown)) : 0;

    const statusDistribution = {
      pending: instances.filter(i => i.status === "pending").length,
      in_progress: instances.filter(i => i.status === "in_progress").length,
      completed: instances.filter(i => i.status === "completed").length,
      expired: instances.filter(i => i.status === "expired").length,
    };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dailyCompletions: { date: string; count: number }[] = [];
    for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const count = completedInstances.filter(i => 
        i.completedAt && new Date(i.completedAt).toISOString().split("T")[0] === dateStr
      ).length;
      dailyCompletions.push({ date: dateStr, count });
    }

    res.json({
      funnel,
      timeToComplete: { avgMinutes, medianMinutes, fastestMinutes, slowestMinutes, totalCompleted: completedInstances.length },
      statusDistribution,
      dailyCompletions,
      totalInstances: instances.length,
    });
  } catch (error) {
    console.error("Error fetching onboarding analytics:", error);
    res.status(500).json({ error: "Failed to fetch onboarding analytics" });
  }
});

router.post("/employer/bulk-invite", onboardingUpload.single("file"), async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const [employer] = await db.select().from(employers).where(eq(employers.id, user.employerId));
    if (!employer?.onboardingModuleEnabled) {
      return res.status(403).json({ error: "Onboarding module not enabled" });
    }

    if (!req.file) return res.status(400).json({ error: "CSV file required" });

    const csvContent = req.file.buffer.toString("utf-8");
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return res.status(400).json({ error: "CSV must have a header row and at least one data row" });

    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
    const requiredCols = ["firstname", "lastname", "email"];
    const colMap: Record<string, number> = {};

    const aliases: Record<string, string[]> = {
      firstname: ["firstname", "first_name", "first"],
      lastname: ["lastname", "last_name", "last"],
      email: ["email", "emailaddress", "email_address"],
      phone: ["phone", "phonenumber", "phone_number", "mobile"],
      jobtitle: ["jobtitle", "job_title", "title", "position"],
      department: ["department", "dept"],
      startdate: ["startdate", "start_date", "hiredate", "hire_date"],
    };

    for (const [key, possibleNames] of Object.entries(aliases)) {
      const idx = headers.findIndex(h => possibleNames.includes(h));
      if (idx >= 0) colMap[key] = idx;
    }

    for (const req of requiredCols) {
      if (!(req in colMap)) {
        return res.status(400).json({ error: `Missing required column: ${req}. Found columns: ${headers.join(", ")}` });
      }
    }

    const results: { row: number; name: string; status: string; error?: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      const firstName = cols[colMap.firstname] || "";
      const lastName = cols[colMap.lastname] || "";
      const email = cols[colMap.email] || "";
      const phone = colMap.phone !== undefined ? cols[colMap.phone] || "" : "";
      const jobTitle = colMap.jobtitle !== undefined ? cols[colMap.jobtitle] || "" : "";
      const department = colMap.department !== undefined ? cols[colMap.department] || "" : "";
      const startDate = colMap.startdate !== undefined ? cols[colMap.startdate] || "" : "";

      if (!firstName || !lastName || !email) {
        results.push({ row: i + 1, name: `${firstName} ${lastName}`.trim() || "Unknown", status: "skipped", error: "Missing required fields" });
        continue;
      }

      try {
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const [invite] = await db.insert(onboardingInviteTokens).values({
          employerId: user.employerId,
          token, email, firstName, lastName, phone, jobTitle, department, startDate, expiresAt,
        }).returning();

        const [instance] = await db.insert(onboardingInstances).values({
          employerId: user.employerId,
          inviteTokenId: invite.id,
          firstName, lastName, email, phone, jobTitle, department, startDate,
          status: "pending", progressPercent: 0, currentStep: "welcome",
        }).returning();

        await db.insert(onboardingTasks).values(
          DEFAULT_ONBOARDING_STEPS.map(step => ({ instanceId: instance.id, ...step, status: "pending" as const }))
        );

        const onboardLink = `${req.protocol}://${req.get("host")}/onboard/${token}`;

        sendOnboardingInviteEmail(email, {
          firstName, employerName: employer.name, onboardingUrl: onboardLink,
          jobTitle: jobTitle || undefined, startDate: startDate || undefined,
          employerLogoUrl: employer.logoUrl || undefined,
        }).catch(e => console.error("[Bulk] Email failed for", email, e));

        if (phone) {
          const fp = formatPhoneNumber(phone);
          if (fp) sendSms(fp, `Hi ${firstName}! Welcome to ${employer.name}. Complete your onboarding: ${onboardLink}`).catch(() => {});
        }

        results.push({ row: i + 1, name: `${firstName} ${lastName}`, status: "created" });
      } catch (e: any) {
        results.push({ row: i + 1, name: `${firstName} ${lastName}`, status: "error", error: e.message });
      }
    }

    const created = results.filter(r => r.status === "created").length;
    const skipped = results.filter(r => r.status !== "created").length;

    res.json({
      message: `Bulk import complete: ${created} created, ${skipped} skipped/failed`,
      created, skipped, total: results.length, results,
    });
  } catch (error) {
    console.error("Error processing bulk onboarding invite:", error);
    res.status(500).json({ error: "Failed to process bulk invite" });
  }
});

// ── Settings ──

router.get("/employer/settings", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const [existing] = await db.select().from(onboardingSettings).where(eq(onboardingSettings.employerId, user.employerId));

    if (existing) return res.json(existing);

    const [created] = await db.insert(onboardingSettings).values({ employerId: user.employerId }).returning();
    res.json(created);
  } catch (error) {
    console.error("Error fetching onboarding settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/employer/settings", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const { requiredSteps, optionalSteps, deadlineDays, welcomeMessage, autoCreateEmployee, autoTriggerScreening } = req.body;

    const [existing] = await db.select().from(onboardingSettings).where(eq(onboardingSettings.employerId, user.employerId));

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (requiredSteps !== undefined) updates.requiredSteps = requiredSteps;
    if (optionalSteps !== undefined) updates.optionalSteps = optionalSteps;
    if (deadlineDays !== undefined) updates.deadlineDays = deadlineDays;
    if (welcomeMessage !== undefined) updates.welcomeMessage = welcomeMessage;
    if (autoCreateEmployee !== undefined) updates.autoCreateEmployee = autoCreateEmployee;
    if (autoTriggerScreening !== undefined) updates.autoTriggerScreening = autoTriggerScreening;

    if (existing) {
      const [updated] = await db.update(onboardingSettings)
        .set(updates)
        .where(eq(onboardingSettings.employerId, user.employerId))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(onboardingSettings)
      .values({ employerId: user.employerId, ...updates })
      .returning();
    res.json(created);
  } catch (error) {
    console.error("Error updating onboarding settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// ── Templates ──

router.get("/employer/templates", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const templates = await db.select().from(onboardingTemplates)
      .where(eq(onboardingTemplates.employerId, user.employerId))
      .orderBy(desc(onboardingTemplates.createdAt));

    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.post("/employer/templates", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const { name, department, jobTitle, requiredSteps, optionalSteps, welcomeMessage, isDefault } = req.body;
    if (!name) return res.status(400).json({ error: "Template name is required" });

    if (isDefault) {
      await db.update(onboardingTemplates)
        .set({ isDefault: false })
        .where(eq(onboardingTemplates.employerId, user.employerId));
    }

    const [template] = await db.insert(onboardingTemplates).values({
      employerId: user.employerId,
      name,
      department: department || null,
      jobTitle: jobTitle || null,
      requiredSteps: requiredSteps || null,
      optionalSteps: optionalSteps || null,
      welcomeMessage: welcomeMessage || null,
      isDefault: isDefault || false,
    }).returning();

    res.json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.put("/employer/templates/:id", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const { name, department, jobTitle, requiredSteps, optionalSteps, welcomeMessage, isDefault } = req.body;

    if (isDefault) {
      await db.update(onboardingTemplates)
        .set({ isDefault: false })
        .where(eq(onboardingTemplates.employerId, user.employerId));
    }

    const [updated] = await db.update(onboardingTemplates)
      .set({
        ...(name !== undefined && { name }),
        ...(department !== undefined && { department }),
        ...(jobTitle !== undefined && { jobTitle }),
        ...(requiredSteps !== undefined && { requiredSteps }),
        ...(optionalSteps !== undefined && { optionalSteps }),
        ...(welcomeMessage !== undefined && { welcomeMessage }),
        ...(isDefault !== undefined && { isDefault }),
        updatedAt: new Date(),
      })
      .where(and(eq(onboardingTemplates.id, req.params.id), eq(onboardingTemplates.employerId, user.employerId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Template not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

router.delete("/employer/templates/:id", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const [deleted] = await db.delete(onboardingTemplates)
      .where(and(eq(onboardingTemplates.id, req.params.id), eq(onboardingTemplates.employerId, user.employerId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Template not found" });
    res.json({ message: "Template deleted" });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// ── Admin Onboarding Overview ──

router.get("/admin/overview", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (user?.role !== "admin") return res.status(403).json({ error: "Admin access required" });

    const allInstances = await db.select().from(onboardingInstances);
    const total = allInstances.length;
    const completed = allInstances.filter(i => i.status === "completed").length;
    const inProgress = allInstances.filter(i => i.status === "in_progress").length;
    const pending = allInstances.filter(i => i.status === "pending").length;
    const expired = allInstances.filter(i => i.status === "expired").length;

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const completedInstances = allInstances.filter(i => i.status === "completed" && i.completedAt && i.createdAt);
    let avgCompletionHours = 0;
    if (completedInstances.length > 0) {
      const totalMs = completedInstances.reduce((sum, i) => {
        return sum + (new Date(i.completedAt!).getTime() - new Date(i.createdAt).getTime());
      }, 0);
      avgCompletionHours = Math.round(totalMs / completedInstances.length / (1000 * 60 * 60));
    }

    const enabledEmployers = await db.select({ id: employers.id, name: employers.name })
      .from(employers)
      .where(eq(employers.onboardingModuleEnabled, true));

    const employerStats = await Promise.all(enabledEmployers.map(async (emp) => {
      const empInstances = allInstances.filter(i => i.employerId === emp.id);
      const empCompleted = empInstances.filter(i => i.status === "completed").length;
      return {
        employerId: emp.id,
        employerName: emp.name,
        total: empInstances.length,
        completed: empCompleted,
        inProgress: empInstances.filter(i => i.status === "in_progress").length,
        pending: empInstances.filter(i => i.status === "pending").length,
        completionRate: empInstances.length > 0 ? Math.round((empCompleted / empInstances.length) * 100) : 0,
      };
    }));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentInstances = allInstances.filter(i => new Date(i.createdAt) > thirtyDaysAgo);
    const dailyTrend: Record<string, number> = {};
    for (let d = 0; d < 30; d++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + d);
      dailyTrend[date.toISOString().split("T")[0]] = 0;
    }
    recentInstances.forEach(i => {
      const day = new Date(i.createdAt).toISOString().split("T")[0];
      if (dailyTrend[day] !== undefined) dailyTrend[day]++;
    });

    res.json({
      totals: { total, completed, inProgress, pending, expired, completionRate, avgCompletionHours },
      employerStats: employerStats.sort((a, b) => b.total - a.total),
      dailyTrend: Object.entries(dailyTrend).map(([date, count]) => ({ date, count })),
      enabledEmployerCount: enabledEmployers.length,
    });
  } catch (error) {
    console.error("Error fetching admin onboarding overview:", error);
    res.status(500).json({ error: "Failed to fetch admin overview" });
  }
});

// ── Document Export ──

router.get("/employer/instances/:id/export", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId!;
    const user = await getUserByClerkId(clerkUserId);
    if (!user?.employerId) return res.status(403).json({ error: "Employer access required" });

    const [instance] = await db.select().from(onboardingInstances)
      .where(and(eq(onboardingInstances.id, req.params.id), eq(onboardingInstances.employerId, user.employerId)));
    if (!instance) return res.status(404).json({ error: "Instance not found" });

    const tasks = await db.select().from(onboardingTasks)
      .where(eq(onboardingTasks.instanceId, instance.id))
      .orderBy(onboardingTasks.sortOrder);

    const documents = await db.select({
      id: onboardingDocuments.id,
      documentType: onboardingDocuments.documentType,
      fileName: onboardingDocuments.fileName,
      fileSize: onboardingDocuments.fileSize,
      mimeType: onboardingDocuments.mimeType,
      status: onboardingDocuments.status,
      signedAt: onboardingDocuments.signedAt,
      createdAt: onboardingDocuments.createdAt,
    }).from(onboardingDocuments).where(eq(onboardingDocuments.instanceId, instance.id));

    const forms = await db.select().from(onboardingFormData)
      .where(eq(onboardingFormData.instanceId, instance.id));

    const maskSsn = (v: string) => v ? `***-**-${v.replace(/\D/g, "").slice(-4)}` : "";
    const maskAccount = (v: string) => v ? `****${v.slice(-4)}` : "";

    const exportData = {
      employee: {
        firstName: instance.firstName,
        lastName: instance.lastName,
        email: instance.email,
        phone: instance.phone,
        jobTitle: instance.jobTitle,
        department: instance.department,
        startDate: instance.startDate,
      },
      status: instance.status,
      progressPercent: instance.progressPercent,
      completedAt: instance.completedAt,
      createdAt: instance.createdAt,
      tasks: tasks.map(t => ({
        step: t.title,
        status: t.status,
        completedAt: t.completedAt,
      })),
      forms: forms.map(f => {
        let parsed: Record<string, any> = {};
        try { parsed = JSON.parse(f.formData); } catch { parsed = {}; }
        if (f.formType === "tax_w4" && parsed.ssn) parsed.ssn = maskSsn(parsed.ssn);
        if (f.formType === "direct_deposit" && parsed.accountNumber) parsed.accountNumber = maskAccount(parsed.accountNumber);
        return { formType: f.formType, isComplete: f.isComplete, data: parsed };
      }),
      documents: documents.map(d => ({
        type: d.documentType,
        fileName: d.fileName,
        status: d.status,
        signedAt: d.signedAt,
      })),
      exportedAt: new Date().toISOString(),
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="onboarding-${instance.firstName}-${instance.lastName}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error("Error exporting onboarding data:", error);
    res.status(500).json({ error: "Failed to export onboarding data" });
  }
});

export default router;
