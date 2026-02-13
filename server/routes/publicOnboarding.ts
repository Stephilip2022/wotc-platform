import { Router } from "express";
import { db } from "../db";
import {
  employers, employees, onboardingInviteTokens, onboardingInstances, 
  onboardingTasks, onboardingDocuments, onboardingFormData,
  onboardingSettings
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import multer from "multer";

const router = Router();

async function handleCompletionActions(instanceId: string, employerId: string) {
  try {
    const [settings] = await db.select().from(onboardingSettings).where(eq(onboardingSettings.employerId, employerId));
    const [instance] = await db.select().from(onboardingInstances).where(eq(onboardingInstances.id, instanceId));
    if (!instance) return;

    if (settings?.autoCreateEmployee !== false) {
      const existingEmployee = await db.select().from(employees)
        .where(and(eq(employees.employerId, employerId), eq(employees.email, instance.email)));

      if (existingEmployee.length === 0) {
        await db.insert(employees).values({
          employerId,
          firstName: instance.firstName,
          lastName: instance.lastName,
          email: instance.email,
          phone: instance.phone || null,
          jobTitle: instance.jobTitle || null,
          department: instance.department || null,
          startDate: instance.startDate || null,
          status: "active",
          onboardingStatus: "completed",
        });
        console.log(`[Onboarding] Auto-created employee for ${instance.firstName} ${instance.lastName}`);
      }
    }

    if (settings?.autoTriggerScreening) {
      console.log(`[Onboarding] WOTC screening auto-trigger for ${instance.firstName} ${instance.lastName}`);
    }
  } catch (error) {
    console.error("[Onboarding] Completion actions error:", error);
  }
}

const onboardingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const mimeOk = allowedTypes.test(file.mimetype);
    const extOk = allowedTypes.test(file.originalname.toLowerCase().split('.').pop() || '');
    if (mimeOk || extOk) return cb(null, true);
    cb(new Error("Only JPEG, PNG, and PDF files are allowed."));
  },
});

router.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;

    const [invite] = await db
      .select()
      .from(onboardingInviteTokens)
      .where(eq(onboardingInviteTokens.token, token));

    if (!invite) {
      return res.status(404).json({ error: "Invalid onboarding link" });
    }

    if (new Date() > new Date(invite.expiresAt)) {
      return res.status(410).json({ error: "This onboarding link has expired. Please contact your employer for a new link." });
    }

    const [employer] = await db
      .select({
        id: employers.id,
        name: employers.name,
        logoUrl: employers.logoUrl,
        primaryColor: employers.primaryColor,
        welcomeMessage: employers.welcomeMessage,
      })
      .from(employers)
      .where(eq(employers.id, invite.employerId));

    if (!employer) {
      return res.status(404).json({ error: "Employer not found" });
    }

    const [settings] = await db.select().from(onboardingSettings).where(eq(onboardingSettings.employerId, invite.employerId));
    if (settings?.welcomeMessage) {
      employer.welcomeMessage = settings.welcomeMessage;
    }

    const [instance] = await db
      .select()
      .from(onboardingInstances)
      .where(eq(onboardingInstances.inviteTokenId, invite.id));

    if (!instance) {
      return res.status(404).json({ error: "Onboarding session not found" });
    }

    const tasks = await db
      .select()
      .from(onboardingTasks)
      .where(eq(onboardingTasks.instanceId, instance.id))
      .orderBy(onboardingTasks.sortOrder);

    const forms = await db
      .select()
      .from(onboardingFormData)
      .where(eq(onboardingFormData.instanceId, instance.id));

    const documents = await db
      .select()
      .from(onboardingDocuments)
      .where(eq(onboardingDocuments.instanceId, instance.id));

    if (instance.status === "pending") {
      await db
        .update(onboardingInstances)
        .set({ status: "in_progress", startedAt: new Date(), lastActivityAt: new Date() })
        .where(eq(onboardingInstances.id, instance.id));
    }

    if (!invite.usedAt) {
      await db
        .update(onboardingInviteTokens)
        .set({ usedAt: new Date() })
        .where(eq(onboardingInviteTokens.id, invite.id));
    }

    res.json({
      employer,
      instance: { ...instance, status: instance.status === "pending" ? "in_progress" : instance.status },
      tasks,
      forms: forms.map(f => ({ ...f, formData: undefined })),
      documents,
    });
  } catch (error) {
    console.error("Error loading onboarding:", error);
    res.status(500).json({ error: "Failed to load onboarding" });
  }
});

router.post("/:token/save-step", async (req, res) => {
  try {
    const { token } = req.params;
    const { stepKey, formData } = req.body;

    if (!stepKey || !formData) {
      return res.status(400).json({ error: "stepKey and formData are required" });
    }

    const [invite] = await db
      .select()
      .from(onboardingInviteTokens)
      .where(eq(onboardingInviteTokens.token, token));

    if (!invite || new Date() > new Date(invite.expiresAt)) {
      return res.status(410).json({ error: "Invalid or expired onboarding link" });
    }

    const [instance] = await db
      .select()
      .from(onboardingInstances)
      .where(eq(onboardingInstances.inviteTokenId, invite.id));

    if (!instance) {
      return res.status(404).json({ error: "Onboarding session not found" });
    }

    const validStepKeys = ["personal_info", "tax_w4", "state_withholding", "direct_deposit", "emergency_contact", "id_upload", "policy_sign"];
    if (!validStepKeys.includes(stepKey)) {
      return res.status(400).json({ error: "Invalid step key" });
    }

    const [taskExists] = await db
      .select()
      .from(onboardingTasks)
      .where(and(
        eq(onboardingTasks.instanceId, instance.id),
        eq(onboardingTasks.stepKey, stepKey)
      ));

    if (!taskExists) {
      return res.status(400).json({ error: "Step not found for this onboarding instance" });
    }

    const formDataStr = JSON.stringify(formData);

    const [existing] = await db
      .select()
      .from(onboardingFormData)
      .where(and(
        eq(onboardingFormData.instanceId, instance.id),
        eq(onboardingFormData.formType, stepKey)
      ));

    if (existing) {
      await db
        .update(onboardingFormData)
        .set({ formData: formDataStr, isComplete: true, updatedAt: new Date() })
        .where(eq(onboardingFormData.id, existing.id));
    } else {
      await db
        .insert(onboardingFormData)
        .values({
          instanceId: instance.id,
          formType: stepKey,
          formData: formDataStr,
          isComplete: true,
        });
    }

    await db
      .update(onboardingTasks)
      .set({ status: "completed", completedAt: new Date(), data: formData })
      .where(and(
        eq(onboardingTasks.instanceId, instance.id),
        eq(onboardingTasks.stepKey, stepKey)
      ));

    const allTasks = await db
      .select()
      .from(onboardingTasks)
      .where(eq(onboardingTasks.instanceId, instance.id));

    const completedCount = allTasks.filter(t => t.status === "completed").length;
    const totalRequired = allTasks.filter(t => t.category === "required").length;
    const progressPercent = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 0;

    const nextPendingIdx = allTasks
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .findIndex(t => t.status === "pending");
    const nextStep = nextPendingIdx >= 0 ? allTasks.sort((a, b) => a.sortOrder - b.sortOrder)[nextPendingIdx].stepKey : null;

    await db
      .update(onboardingInstances)
      .set({
        progressPercent,
        currentStep: nextStep || "completed",
        lastActivityAt: new Date(),
        updatedAt: new Date(),
        ...(progressPercent >= 100 ? { status: "completed", completedAt: new Date() } : {}),
      })
      .where(eq(onboardingInstances.id, instance.id));

    res.json({
      progressPercent,
      currentStep: nextStep || "completed",
      completedSteps: completedCount,
      totalSteps: allTasks.length,
    });
  } catch (error) {
    console.error("Error saving onboarding step:", error);
    res.status(500).json({ error: "Failed to save progress" });
  }
});

router.post("/:token/upload-document", onboardingUpload.single("file"), async (req, res) => {
  try {
    const { token } = req.params;
    const { documentType, taskId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const [invite] = await db
      .select()
      .from(onboardingInviteTokens)
      .where(eq(onboardingInviteTokens.token, token));

    if (!invite || new Date() > new Date(invite.expiresAt)) {
      return res.status(410).json({ error: "Invalid or expired onboarding link" });
    }

    const [instance] = await db
      .select()
      .from(onboardingInstances)
      .where(eq(onboardingInstances.inviteTokenId, invite.id));

    if (!instance) {
      return res.status(404).json({ error: "Onboarding session not found" });
    }

    const fileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const [doc] = await db
      .insert(onboardingDocuments)
      .values({
        instanceId: instance.id,
        taskId: taskId || null,
        documentType: documentType || "other",
        fileName: req.file.originalname,
        fileUrl,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        status: "pending",
      })
      .returning();

    if (taskId) {
      await db
        .update(onboardingTasks)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(onboardingTasks.id, taskId));
    }

    res.json({ document: { ...doc, fileUrl: undefined }, message: "Document uploaded successfully" });
  } catch (error) {
    console.error("Error uploading onboarding document:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

router.post("/:token/sign-policy", async (req, res) => {
  try {
    const { token } = req.params;
    const { signatureData, policyName } = req.body;

    if (!signatureData) {
      return res.status(400).json({ error: "Signature data is required" });
    }

    const [invite] = await db
      .select()
      .from(onboardingInviteTokens)
      .where(eq(onboardingInviteTokens.token, token));

    if (!invite || new Date() > new Date(invite.expiresAt)) {
      return res.status(410).json({ error: "Invalid or expired onboarding link" });
    }

    const [instance] = await db
      .select()
      .from(onboardingInstances)
      .where(eq(onboardingInstances.inviteTokenId, invite.id));

    if (!instance) {
      return res.status(404).json({ error: "Onboarding session not found" });
    }

    const [doc] = await db
      .insert(onboardingDocuments)
      .values({
        instanceId: instance.id,
        documentType: "policy_signature",
        fileName: policyName || "Policy Acknowledgement",
        signatureData,
        signedAt: new Date(),
        status: "verified",
      })
      .returning();

    await db
      .update(onboardingTasks)
      .set({ status: "completed", completedAt: new Date() })
      .where(and(
        eq(onboardingTasks.instanceId, instance.id),
        eq(onboardingTasks.stepKey, "policy_sign")
      ));

    res.json({ document: { ...doc, signatureData: undefined }, message: "Policy signed successfully" });
  } catch (error) {
    console.error("Error signing policy:", error);
    res.status(500).json({ error: "Failed to sign policy" });
  }
});

router.post("/:token/submit", async (req, res) => {
  try {
    const { token } = req.params;

    const [invite] = await db
      .select()
      .from(onboardingInviteTokens)
      .where(eq(onboardingInviteTokens.token, token));

    if (!invite || new Date() > new Date(invite.expiresAt)) {
      return res.status(410).json({ error: "Invalid or expired onboarding link" });
    }

    const [instance] = await db
      .select()
      .from(onboardingInstances)
      .where(eq(onboardingInstances.inviteTokenId, invite.id));

    if (!instance) {
      return res.status(404).json({ error: "Onboarding session not found" });
    }

    const tasks = await db
      .select()
      .from(onboardingTasks)
      .where(eq(onboardingTasks.instanceId, instance.id));

    const requiredIncomplete = tasks.filter(t => t.category === "required" && t.status !== "completed");
    if (requiredIncomplete.length > 0) {
      return res.status(400).json({
        error: "Please complete all required steps before submitting",
        incompleteSteps: requiredIncomplete.map(t => t.title),
      });
    }

    await db
      .update(onboardingInstances)
      .set({
        status: "completed",
        progressPercent: 100,
        currentStep: "completed",
        completedAt: new Date(),
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(onboardingInstances.id, instance.id));

    handleCompletionActions(instance.id, instance.employerId).catch(err =>
      console.error("[Onboarding] Completion actions failed:", err)
    );

    res.json({ message: "Onboarding completed successfully! Your employer will be notified." });
  } catch (error) {
    console.error("Error submitting onboarding:", error);
    res.status(500).json({ error: "Failed to submit onboarding" });
  }
});

router.get("/:token/form/:formType", async (req, res) => {
  try {
    const { token, formType } = req.params;

    const [invite] = await db
      .select()
      .from(onboardingInviteTokens)
      .where(eq(onboardingInviteTokens.token, token));

    if (!invite || new Date() > new Date(invite.expiresAt)) {
      return res.status(410).json({ error: "Invalid or expired onboarding link" });
    }

    const [instance] = await db
      .select()
      .from(onboardingInstances)
      .where(eq(onboardingInstances.inviteTokenId, invite.id));

    if (!instance) {
      return res.status(404).json({ error: "Onboarding session not found" });
    }

    const [form] = await db
      .select()
      .from(onboardingFormData)
      .where(and(
        eq(onboardingFormData.instanceId, instance.id),
        eq(onboardingFormData.formType, formType)
      ));

    if (!form) {
      return res.json({ formType, formData: null, isComplete: false });
    }

    let parsedData;
    try {
      parsedData = JSON.parse(form.formData);
    } catch {
      parsedData = {};
    }

    res.json({ formType, formData: parsedData, isComplete: form.isComplete });
  } catch (error) {
    console.error("Error fetching form data:", error);
    res.status(500).json({ error: "Failed to fetch form data" });
  }
});

export default router;
