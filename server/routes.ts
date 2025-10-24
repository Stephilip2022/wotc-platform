import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { promises as fs } from "fs";
import path from "path";
import QRCode from "qrcode";
import { db } from "./db";
import { 
  users, 
  employers, 
  employees, 
  questionnaires,
  questionnaireResponses,
  screenings,
  documents,
  creditCalculations,
  invoices,
  invoiceLineItems,
  invoiceSequences,
  payments,
  aiAssistanceLogs,
  etaForm9198,
  insertEtaForm9198Schema,
  hoursWorked,
  screeningStatusChanges,
  subscriptionPlans,
  subscriptions,
  csvImportSessions,
  csvImportRows,
  csvImportTemplates,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./replitAuth";
import OpenAI from "openai";
import Stripe from "stripe";
import { determineEligibility, calculateCredit, TARGET_GROUPS, normalizeTargetGroup } from "./eligibility";
import { generateWOTCExportCSV, generateStateSpecificCSV, generateExportFilename } from "./utils/csv-export";

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
});

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Configure multer for file uploads (documents)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only certain file types
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const mimeType = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimeType && extname) {
      return cb(null, true);
    }
    cb(new Error("Invalid file type. Only JPEG, PNG, PDF, DOC, and DOCX files are allowed."));
  },
});

// Configure multer for CSV uploads
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for CSV
  },
  fileFilter: (req, file, cb) => {
    // Accept only CSV files
    const allowedTypes = /csv/;
    const mimeType = file.mimetype === "text/csv" || file.mimetype === "application/vnd.ms-excel" || file.mimetype === "text/plain";
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimeType && extname) {
      return cb(null, true);
    }
    cb(new Error("Invalid file type. Only CSV files are allowed."));
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);

  // ============================================================================
  // AUTHENTICATION ROUTES
  // ============================================================================
  
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userEmail = req.user.claims.email;
      
      // Try to find user by ID first
      let [user] = await db.select().from(users).where(eq(users.id, userId));
      
      // If not found by ID, try email as fallback (handles email conflicts where sub changed)
      if (!user && userEmail) {
        [user] = await db.select().from(users).where(eq(users.email, userEmail));
      }
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ============================================================================
  // EMPLOYEE PORTAL ROUTES
  // ============================================================================
  
  app.get("/api/employee/questionnaire", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || !user.employerId) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Get active questionnaire for employer
      const [questionnaire] = await db
        .select()
        .from(questionnaires)
        .where(
          and(
            eq(questionnaires.employerId, user.employerId),
            eq(questionnaires.isActive, true)
          )
        )
        .limit(1);
      
      if (!questionnaire) {
        return res.status(404).json({ error: "No active questionnaire" });
      }
      
      res.json(questionnaire);
    } catch (error) {
      console.error("Error fetching questionnaire:", error);
      res.status(500).json({ error: "Failed to fetch questionnaire" });
    }
  });

  app.get("/api/employee/questionnaire/response", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.userId, userId));
      
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Get the questionnaire for this employee
      const [questionnaire] = await db
        .select()
        .from(questionnaires)
        .where(
          and(
            eq(questionnaires.employerId, employee.employerId),
            eq(questionnaires.isActive, true)
          )
        )
        .limit(1);

      if (!questionnaire) {
        return res.json(null);
      }

      // Get saved response
      const [response] = await db
        .select()
        .from(questionnaireResponses)
        .where(
          and(
            eq(questionnaireResponses.employeeId, employee.id),
            eq(questionnaireResponses.questionnaireId, questionnaire.id)
          )
        );

      res.json(response || null);
    } catch (error) {
      console.error("Error fetching response:", error);
      res.status(500).json({ error: "Failed to fetch response" });
    }
  });

  app.post("/api/employee/questionnaire/response", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { questionnaireId, responses, completionPercentage } = req.body;
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Find employee record
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.userId, userId));
      
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Upsert response
      const existing = await db
        .select()
        .from(questionnaireResponses)
        .where(
          and(
            eq(questionnaireResponses.employeeId, employee.id),
            eq(questionnaireResponses.questionnaireId, questionnaireId)
          )
        );

      if (existing.length > 0) {
        await db
          .update(questionnaireResponses)
          .set({
            responses,
            completionPercentage,
            updatedAt: new Date(),
          })
          .where(eq(questionnaireResponses.id, existing[0].id));
      } else {
        await db.insert(questionnaireResponses).values({
          employeeId: employee.id,
          questionnaireId,
          responses,
          completionPercentage,
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving response:", error);
      res.status(500).json({ error: "Failed to save response" });
    }
  });

  app.post("/api/employee/questionnaire/submit", isAuthenticated, async (req: any, res) => {
    try {
      console.log("[SUBMIT] Starting questionnaire submission");
      const userId = req.user.claims.sub;
      const { questionnaireId, responses } = req.body;
      
      console.log("[SUBMIT] User ID:", userId);
      console.log("[SUBMIT] Questionnaire ID:", questionnaireId);
      console.log("[SUBMIT] Response count:", Object.keys(responses || {}).length);
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      console.log("[SUBMIT] User found:", !!user);
      
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.userId, userId));
      
      console.log("[SUBMIT] Employee found:", !!employee);
      
      if (!employee) {
        console.error("[SUBMIT] Employee not found for userId:", userId);
        return res.status(400).json({ error: "Employee not found" });
      }

      // Check if response already exists
      const [existing] = await db
        .select()
        .from(questionnaireResponses)
        .where(
          and(
            eq(questionnaireResponses.employeeId, employee.id),
            eq(questionnaireResponses.questionnaireId, questionnaireId)
          )
        );

      if (existing) {
        console.log("[SUBMIT] Updating existing response:", existing.id);
        // Update existing response
        await db
          .update(questionnaireResponses)
          .set({
            responses,
            isCompleted: true,
            completionPercentage: 100,
            submittedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(questionnaireResponses.id, existing.id));
        console.log("[SUBMIT] Response updated successfully");
      } else {
        console.log("[SUBMIT] Creating new response");
        // Create new response
        await db.insert(questionnaireResponses).values({
          employeeId: employee.id,
          questionnaireId,
          responses,
          isCompleted: true,
          completionPercentage: 100,
          submittedAt: new Date(),
        });
        console.log("[SUBMIT] Response created successfully");
      }

      // Get questionnaire to access question metadata
      const [questionnaire] = await db
        .select()
        .from(questionnaires)
        .where(eq(questionnaires.id, questionnaireId));

      if (!questionnaire) {
        return res.status(400).json({ error: "Questionnaire not found" });
      }

      // Determine WOTC eligibility using metadata-driven approach
      const eligibilityResult = determineEligibility(
        responses,
        questionnaire.questions as any[],
        employee.dateOfBirth || undefined,
        employee.hireDate || undefined
      );

      // Create or update screening record
      const existingScreening = await db
        .select()
        .from(screenings)
        .where(eq(screenings.employeeId, employee.id));

      if (existingScreening.length > 0) {
        await db
          .update(screenings)
          .set({
            targetGroups: eligibilityResult.targetGroups,
            primaryTargetGroup: eligibilityResult.primaryTargetGroup,
            status: eligibilityResult.isEligible ? "eligible" : "not_eligible",
            eligibilityDeterminedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(screenings.id, existingScreening[0].id));
      } else {
        await db.insert(screenings).values({
          employeeId: employee.id,
          employerId: employee.employerId,
          targetGroups: eligibilityResult.targetGroups,
          primaryTargetGroup: eligibilityResult.primaryTargetGroup,
          status: eligibilityResult.isEligible ? "eligible" : "not_eligible",
          eligibilityDeterminedAt: new Date(),
        });
      }

      // Update employee status
      await db
        .update(employees)
        .set({ 
          status: eligibilityResult.isEligible ? "screening" : "not_eligible" 
        })
        .where(eq(employees.id, employee.id));

      // Calculate projected credit
      if (eligibilityResult.isEligible && eligibilityResult.primaryTargetGroup) {
        const projectedCredit = eligibilityResult.maxPotentialCredit;
        
        // Create or update credit calculation
        const existingCredit = await db
          .select()
          .from(creditCalculations)
          .where(eq(creditCalculations.employeeId, employee.id));

        if (existingCredit.length > 0) {
          await db
            .update(creditCalculations)
            .set({
              targetGroup: eligibilityResult.primaryTargetGroup,
              projectedCreditAmount: projectedCredit.toString(),
              updatedAt: new Date(),
            })
            .where(eq(creditCalculations.id, existingCredit[0].id));
        } else {
          await db.insert(creditCalculations).values({
            employeeId: employee.id,
            employerId: employee.employerId,
            targetGroup: eligibilityResult.primaryTargetGroup,
            projectedCreditAmount: projectedCredit.toString(),
            hoursWorked: 0,
            wagesEarned: "0",
          });
        }
      }
      
      res.json({ 
        success: true, 
        message: "Questionnaire submitted successfully",
        eligibility: eligibilityResult,
      });
    } catch (error) {
      console.error("Error submitting questionnaire:", error);
      res.status(500).json({ error: "Failed to submit questionnaire" });
    }
  });

  // ============================================================================
  // AI ASSISTANCE ROUTES
  // ============================================================================
  
  app.post("/api/ai/simplify-question", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { questionId, questionText } = req.body;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that simplifies complex WOTC (Work Opportunity Tax Credit) screening questions for people with low literacy. Rewrite questions to use simple language, short sentences, and common words. Keep the meaning exactly the same.",
          },
          {
            role: "user",
            content: `Simplify this question for someone with low reading ability:\n\n${questionText}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      const simplifiedQuestion = completion.choices[0].message.content;

      // Log AI assistance for analytics
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.userId, userId));
      
      if (employee) {
        await db.insert(aiAssistanceLogs).values({
          employeeId: employee.id,
          questionId,
          originalQuestion: questionText,
          simplifiedQuestion: simplifiedQuestion || questionText,
          usedSimplified: true,
        });
      }

      res.json({ simplifiedQuestion });
    } catch (error) {
      console.error("AI simplification error:", error);
      res.status(500).json({ error: "Failed to simplify question" });
    }
  });

  // ============================================================================
  // DOCUMENT UPLOAD ROUTES
  // ============================================================================

  app.post("/api/upload/document", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      const { documentType, description } = req.body;

      // Get employee from authenticated user
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.userId, userId));

      if (!employee) {
        return res.status(403).json({ error: "No employee record found. Please contact your employer." });
      }

      // Create directory path in object storage (private storage for sensitive documents)
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "/.private";
      const employerDir = path.join(privateDir, employee.employerId);
      const filePath = path.join(employerDir, `${Date.now()}-${req.file.originalname}`);

      // Write file to object storage
      await fs.mkdir(employerDir, { recursive: true });
      await fs.writeFile(filePath, req.file.buffer);

      // Save document record to database
      const [document] = await db.insert(documents).values({
        employeeId: employee.id,
        employerId: employee.employerId,
        documentType: documentType || "other",
        fileName: req.file.originalname,
        filePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        description,
        uploadedBy: userId,
      }).returning();

      res.json({ success: true, document });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  app.get("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.userId, userId));

      if (!employee) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const docs = await db
        .select()
        .from(documents)
        .where(eq(documents.employeeId, employee.id))
        .orderBy(desc(documents.createdAt));

      res.json(docs);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // ============================================================================
  // EMPLOYER PORTAL ROUTES
  // ============================================================================
  
  app.get("/api/employer/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employeeCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(employees)
        .where(eq(employees.employerId, user.employerId));

      const activeScreeningsCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(screenings)
        .where(
          and(
            eq(screenings.employerId, user.employerId),
            eq(screenings.status, "pending")
          )
        );

      const certifiedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(screenings)
        .where(
          and(
            eq(screenings.employerId, user.employerId),
            eq(screenings.status, "certified")
          )
        );

      const creditsResult = await db
        .select({
          projected: sql<string>`COALESCE(SUM(${creditCalculations.projectedCreditAmount}), 0)`,
          actual: sql<string>`COALESCE(SUM(${creditCalculations.actualCreditAmount}), 0)`,
        })
        .from(creditCalculations)
        .where(eq(creditCalculations.employerId, user.employerId));

      res.json({
        totalEmployees: Number(employeeCount[0].count) || 0,
        activeScreenings: Number(activeScreeningsCount[0].count) || 0,
        certifiedEmployees: Number(certifiedCount[0].count) || 0,
        projectedCredits: `$${Number(creditsResult[0].projected || 0).toLocaleString()}`,
        actualCredits: `$${Number(creditsResult[0].actual || 0).toLocaleString()}`,
      });
    } catch (error) {
      console.error("Error fetching employer stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/employer/recent-activity", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const recentScreenings = await db
        .select({
          id: screenings.id,
          employeeName: sql<string>`${employees.firstName} || ' ' || ${employees.lastName}`,
          action: sql<string>`CASE 
            WHEN ${screenings.status} = 'certified' THEN 'Certification Received'
            WHEN ${screenings.status} = 'eligible' THEN 'Screening Completed'
            ELSE 'Screening Started'
          END`,
          status: screenings.status,
          date: screenings.updatedAt,
        })
        .from(screenings)
        .innerJoin(employees, eq(screenings.employeeId, employees.id))
        .where(eq(screenings.employerId, user.employerId))
        .orderBy(desc(screenings.updatedAt))
        .limit(10);

      res.json(
        recentScreenings.map((s) => ({
          ...s,
          date: s.date.toISOString().split("T")[0],
        }))
      );
    } catch (error) {
      console.error("Error fetching activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  app.get("/api/employer/employees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employeesList = await db
        .select()
        .from(employees)
        .where(eq(employees.employerId, user.employerId))
        .orderBy(desc(employees.createdAt));

      res.json(employeesList);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employer/employees", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employeeData = req.body;
      employeeData.employerId = user.employerId;
      employeeData.status = "pending";
      
      const [newEmployee] = await db.insert(employees).values(employeeData).returning();
      
      res.json({ success: true, id: newEmployee.id });
    } catch (error) {
      console.error("Error adding employee:", error);
      res.status(500).json({ error: "Failed to add employee" });
    }
  });

  app.post("/api/employer/employees/:id/remind", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employeeId = req.params.id;
      
      const [employee] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.employerId, user.employerId)));

      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const [employer] = await db
        .select()
        .from(employers)
        .where(eq(employers.id, user.employerId));

      if (!employer) {
        return res.status(404).json({ error: "Employer not found" });
      }

      // Generate questionnaire URL
      const baseUrl = process.env.REPLIT_DEPLOYMENT 
        ? `https://${process.env.REPLIT_DEPLOYMENT}` 
        : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      const questionnaireUrl = `${baseUrl}/questionnaire/${employer.qrToken}?employee=${employee.id}`;

      // Send screening invitation email
      const { sendScreeningInvite } = await import('./email/notifications');
      const result = await sendScreeningInvite(employee.email, {
        employeeName: `${employee.firstName} ${employee.lastName}`,
        employerName: employer.companyName,
        questionnaireUrl,
        employerLogoUrl: employer.logoUrl || undefined,
        employerBrandColor: employer.brandColor || undefined,
      });

      if (!result.success) {
        console.error('Failed to send screening invite:', result.error);
        return res.status(500).json({ error: 'Failed to send email reminder' });
      }

      res.json({ success: true, messageId: result.messageId });
    } catch (error) {
      console.error("Error sending reminder:", error);
      res.status(500).json({ error: "Failed to send reminder" });
    }
  });

  app.get("/api/employer/employees/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employeeId = req.params.id;

      // Get employee data
      const [employee] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.employerId, user.employerId)));

      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Get screening data
      const screeningData = await db
        .select()
        .from(screenings)
        .where(eq(screenings.employeeId, employeeId))
        .orderBy(desc(screenings.updatedAt));

      // Get hours worked
      const hoursData = await db
        .select()
        .from(hoursWorked)
        .where(eq(hoursWorked.employeeId, employeeId))
        .orderBy(desc(hoursWorked.periodEnd));

      // Get credit calculations
      const creditData = await db
        .select()
        .from(creditCalculations)
        .where(eq(creditCalculations.employeeId, employeeId))
        .orderBy(desc(creditCalculations.updatedAt));

      // Get documents
      const documentsData = await db
        .select()
        .from(documents)
        .where(eq(documents.employeeId, employeeId))
        .orderBy(desc(documents.createdAt));

      res.json({
        employee,
        screenings: screeningData,
        hours: hoursData,
        credits: creditData,
        documents: documentsData,
      });
    } catch (error) {
      console.error("Error fetching employee details:", error);
      res.status(500).json({ error: "Failed to fetch employee details" });
    }
  });

  app.get("/api/employer/screenings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const screeningsList = await db
        .select({
          screening: screenings,
          employee: employees,
        })
        .from(screenings)
        .innerJoin(employees, eq(screenings.employeeId, employees.id))
        .where(eq(screenings.employerId, user.employerId))
        .orderBy(desc(screenings.updatedAt));

      res.json(
        screeningsList.map((s) => ({
          ...s.screening,
          employee: s.employee,
        }))
      );
    } catch (error) {
      console.error("Error fetching screenings:", error);
      res.status(500).json({ error: "Failed to fetch screenings" });
    }
  });

  // ============================================================================
  // ADMIN PORTAL ROUTES
  // ============================================================================
  
  app.get("/api/admin/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employerCount = await db.select({ count: sql<number>`count(*)` }).from(employers);
      const employeeCount = await db.select({ count: sql<number>`count(*)` }).from(employees);
      const screeningCount = await db.select({ count: sql<number>`count(*)` }).from(screenings);
      
      const invoiceTotal = await db
        .select({ total: sql<string>`COALESCE(SUM(${invoices.amount}), 0)` })
        .from(invoices)
        .where(eq(invoices.status, "paid"));

      res.json({
        totalEmployers: Number(employerCount[0].count) || 0,
        activeEmployers: Number(employerCount[0].count) || 0,
        totalEmployees: Number(employeeCount[0].count) || 0,
        totalScreenings: Number(screeningCount[0].count) || 0,
        totalRevenue: `$${Number(invoiceTotal[0].total || 0).toLocaleString()}`,
        monthlyRevenue: `$${Math.round(Number(invoiceTotal[0].total || 0) / 12).toLocaleString()}`,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Admin Analytics: Certification Trends (last 12 months)
  app.get("/api/admin/analytics/certification-trends", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Get monthly certification trends for the last 12 months (PostgreSQL)
      const trends = await db
        .select({
          month: sql<string>`TO_CHAR(${screenings.updatedAt}, 'YYYY-MM')`,
          certified: sql<number>`SUM(CASE WHEN ${screenings.status} = 'certified' THEN 1 ELSE 0 END)`,
          denied: sql<number>`SUM(CASE WHEN ${screenings.status} = 'denied' THEN 1 ELSE 0 END)`,
          pending: sql<number>`SUM(CASE WHEN ${screenings.status} = 'pending' THEN 1 ELSE 0 END)`,
        })
        .from(screenings)
        .where(sql`${screenings.updatedAt} >= CURRENT_DATE - INTERVAL '12 months'`)
        .groupBy(sql`TO_CHAR(${screenings.updatedAt}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${screenings.updatedAt}, 'YYYY-MM')`);

      res.json(trends);
    } catch (error) {
      console.error("Error fetching certification trends:", error);
      res.status(500).json({ error: "Failed to fetch certification trends" });
    }
  });

  // Admin Analytics: State Breakdown
  app.get("/api/admin/analytics/state-breakdown", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Get screening counts by state
      const stateData = await db
        .select({
          state: employees.state,
          totalScreenings: sql<number>`COUNT(DISTINCT ${screenings.id})`,
          certified: sql<number>`SUM(CASE WHEN ${screenings.status} = 'certified' THEN 1 ELSE 0 END)`,
          denied: sql<number>`SUM(CASE WHEN ${screenings.status} = 'denied' THEN 1 ELSE 0 END)`,
          totalCredits: sql<string>`COALESCE(SUM(${creditCalculations.actualCreditAmount}), 0)`,
        })
        .from(employees)
        .leftJoin(screenings, eq(screenings.employeeId, employees.id))
        .leftJoin(creditCalculations, eq(creditCalculations.screeningId, screenings.id))
        .where(sql`${employees.state} IS NOT NULL`)
        .groupBy(employees.state)
        .orderBy(sql`COUNT(DISTINCT ${screenings.id}) DESC`);

      res.json(
        stateData.map((s) => ({
          state: s.state,
          totalScreenings: Number(s.totalScreenings) || 0,
          certified: Number(s.certified) || 0,
          denied: Number(s.denied) || 0,
          totalCredits: `$${Number(s.totalCredits || 0).toLocaleString()}`,
        }))
      );
    } catch (error) {
      console.error("Error fetching state breakdown:", error);
      res.status(500).json({ error: "Failed to fetch state breakdown" });
    }
  });

  app.get("/api/admin/employers/summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employersList = await db
        .select({
          employer: employers,
          employeeCount: sql<number>`COUNT(DISTINCT ${employees.id})`,
          screeningCount: sql<number>`COUNT(DISTINCT ${screenings.id})`,
          certifiedCount: sql<number>`SUM(CASE WHEN ${screenings.status} = 'certified' THEN 1 ELSE 0 END)`,
          projectedCredits: sql<string>`COALESCE(SUM(${creditCalculations.projectedCreditAmount}), 0)`,
        })
        .from(employers)
        .leftJoin(employees, eq(employees.employerId, employers.id))
        .leftJoin(screenings, eq(screenings.employerId, employers.id))
        .leftJoin(creditCalculations, eq(creditCalculations.employerId, employers.id))
        .groupBy(employers.id);

      res.json(
        employersList.map((e) => ({
          ...e.employer,
          employeeCount: Number(e.employeeCount) || 0,
          screeningCount: Number(e.screeningCount) || 0,
          certifiedCount: Number(e.certifiedCount) || 0,
          projectedCredits: `$${Number(e.projectedCredits || 0).toLocaleString()}`,
        }))
      );
    } catch (error) {
      console.error("Error fetching employer summary:", error);
      res.status(500).json({ error: "Failed to fetch employer summary" });
    }
  });

  app.get("/api/admin/employers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employersList = await db
        .select()
        .from(employers)
        .orderBy(desc(employers.createdAt));

      res.json(employersList);
    } catch (error) {
      console.error("Error fetching employers:", error);
      res.status(500).json({ error: "Failed to fetch employers" });
    }
  });

  app.get("/api/admin/employers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employerId = req.params.id;
      const [employer] = await db
        .select()
        .from(employers)
        .where(eq(employers.id, employerId));

      if (!employer) {
        return res.status(404).json({ error: "Employer not found" });
      }

      res.json(employer);
    } catch (error) {
      console.error("Error fetching employer:", error);
      res.status(500).json({ error: "Failed to fetch employer" });
    }
  });

  app.post("/api/admin/employers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employerData = req.body;
      const [newEmployer] = await db.insert(employers).values(employerData).returning();
      
      res.json({ success: true, id: newEmployer.id });
    } catch (error) {
      console.error("Error adding employer:", error);
      res.status(500).json({ error: "Failed to add employer" });
    }
  });

  // ============================================================================
  // ADMIN CSV EXPORT ROUTES
  // ============================================================================

  // Admin: Get export record count
  app.get("/api/admin/export/wotc-csv/count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { employerId, state, startDate, endDate, status } = req.query;

      // Build same query as export but just count
      const latestResponsesSubquery = db
        .select({
          employeeId: questionnaireResponses.employeeId,
          latestResponseId: sql<string>`MAX(${questionnaireResponses.id})`.as("latest_response_id"),
        })
        .from(questionnaireResponses)
        .where(eq(questionnaireResponses.isCompleted, true))
        .groupBy(questionnaireResponses.employeeId)
        .as("latest_responses");

      let query = db
        .select({
          screening: screenings,
          employee: employees,
          employer: employers,
          responses: questionnaireResponses,
        })
        .from(screenings)
        .innerJoin(employees, eq(screenings.employeeId, employees.id))
        .innerJoin(employers, eq(screenings.employerId, employers.id))
        .leftJoin(latestResponsesSubquery, eq(latestResponsesSubquery.employeeId, employees.id))
        .leftJoin(
          questionnaireResponses,
          eq(questionnaireResponses.id, latestResponsesSubquery.latestResponseId)
        );

      // Apply same filters as export
      const conditions = [];
      if (employerId) {
        conditions.push(eq(screenings.employerId, employerId as string));
      }
      if (state) {
        conditions.push(eq(employees.state, state as string));
      }
      if (startDate) {
        conditions.push(sql`${screenings.createdAt} >= ${new Date(startDate as string)}`);
      }
      if (endDate) {
        conditions.push(sql`${screenings.createdAt} <= ${new Date(endDate as string)}`);
      }
      
      // Status filter
      if (status === "eligible" || status === "certified") {
        conditions.push(eq(screenings.status, status));
      } else {
        // Default: only export eligible or certified screenings
        conditions.push(sql`${screenings.status} IN ('eligible', 'certified')`);
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const results = await query;
      
      res.json({ count: results.length });
    } catch (error: any) {
      console.error("Export count error:", error);
      res.status(500).json({ message: "Failed to count records" });
    }
  });

  app.get("/api/admin/export/wotc-csv", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { employerId, state, startDate, endDate } = req.query;

      // Build query with filters including the most recent completed questionnaire response
      // Subquery to get latest completed response per employee
      const latestResponsesSubquery = db
        .select({
          employeeId: questionnaireResponses.employeeId,
          latestResponseId: sql<string>`MAX(${questionnaireResponses.id})`.as("latest_response_id"),
        })
        .from(questionnaireResponses)
        .where(eq(questionnaireResponses.isCompleted, true))
        .groupBy(questionnaireResponses.employeeId)
        .as("latest_responses");

      let query = db
        .select({
          screening: screenings,
          employee: employees,
          employer: employers,
          responses: questionnaireResponses,
        })
        .from(screenings)
        .innerJoin(employees, eq(screenings.employeeId, employees.id))
        .innerJoin(employers, eq(screenings.employerId, employers.id))
        .leftJoin(latestResponsesSubquery, eq(latestResponsesSubquery.employeeId, employees.id))
        .leftJoin(
          questionnaireResponses,
          eq(questionnaireResponses.id, latestResponsesSubquery.latestResponseId)
        );

      // Apply filters
      const conditions = [];
      if (employerId) {
        conditions.push(eq(screenings.employerId, employerId as string));
      }
      if (state) {
        conditions.push(eq(employees.state, state as string));
      }
      if (startDate) {
        conditions.push(sql`${screenings.createdAt} >= ${new Date(startDate as string)}`);
      }
      if (endDate) {
        conditions.push(sql`${screenings.createdAt} <= ${new Date(endDate as string)}`);
      }
      
      // Only export eligible or certified screenings
      conditions.push(sql`${screenings.status} IN ('eligible', 'certified')`);

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const results = await query.orderBy(desc(screenings.createdAt));

      // Generate CSV content using state-specific template if state is provided
      const csvContent = state
        ? generateStateSpecificCSV(results, state as string)
        : generateWOTCExportCSV(results);

      // Get unique employer names for filename
      const uniqueEmployers = [...new Set(results.map(r => r.employer.name))];
      
      const filename = generateExportFilename(
        uniqueEmployers,
        results.length,
        state as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      // Set headers for CSV download
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error generating CSV export:", error);
      res.status(500).json({ error: "Failed to generate export" });
    }
  });

  // ============================================================================
  // ADMIN EMPLOYER BRANDING ROUTES
  // ============================================================================

  app.post("/api/admin/employers/:id/logo", isAuthenticated, upload.single("logo"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const employerId = req.params.id;

      // Get employer to verify it exists
      const [employer] = await db
        .select()
        .from(employers)
        .where(eq(employers.id, employerId));

      if (!employer) {
        return res.status(404).json({ error: "Employer not found" });
      }

      // Upload logo to public object storage
      const publicDir = process.env.PUBLIC_OBJECT_SEARCH_PATHS
        ? JSON.parse(process.env.PUBLIC_OBJECT_SEARCH_PATHS)[0]
        : "/public";
      const logosDir = path.join(publicDir, "logos");
      const fileName = `${employerId}-${Date.now()}.${req.file.originalname.split('.').pop()}`;
      const filePath = path.join(logosDir, fileName);

      // Create directory and write file
      await fs.mkdir(logosDir, { recursive: true });
      await fs.writeFile(filePath, req.file.buffer);

      // Update employer with logo URL (relative path for serving)
      const logoUrl = `/logos/${fileName}`;
      await db
        .update(employers)
        .set({ logoUrl })
        .where(eq(employers.id, employerId));

      res.json({ success: true, logoUrl });
    } catch (error) {
      console.error("Error uploading logo:", error);
      res.status(500).json({ error: "Failed to upload logo" });
    }
  });

  app.patch("/api/admin/employers/:id/branding", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employerId = req.params.id;
      const { primaryColor, welcomeMessage, customFooter } = req.body;

      // Update employer branding
      const [updatedEmployer] = await db
        .update(employers)
        .set({
          primaryColor: primaryColor || undefined,
          welcomeMessage: welcomeMessage || undefined,
          customFooter: customFooter || undefined,
        })
        .where(eq(employers.id, employerId))
        .returning();

      if (!updatedEmployer) {
        return res.status(404).json({ error: "Employer not found" });
      }

      res.json(updatedEmployer);
    } catch (error) {
      console.error("Error updating branding:", error);
      res.status(500).json({ error: "Failed to update branding" });
    }
  });

  app.post("/api/admin/employers/:id/qr-code", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employerId = req.params.id;

      // Get employer
      const [employer] = await db
        .select()
        .from(employers)
        .where(eq(employers.id, employerId));

      if (!employer) {
        return res.status(404).json({ error: "Employer not found" });
      }

      if (!employer.questionnaireUrl) {
        return res.status(400).json({ error: "Employer has no questionnaire URL" });
      }

      // Generate QR code as data URL
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : "http://localhost:5000";
      const fullUrl = `${baseUrl}/screen/${employer.questionnaireUrl}`;
      
      const qrCodeDataUrl = await QRCode.toDataURL(fullUrl, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 400,
      });

      // Save QR code as PNG to public object storage
      const publicDir = process.env.PUBLIC_OBJECT_SEARCH_PATHS
        ? JSON.parse(process.env.PUBLIC_OBJECT_SEARCH_PATHS)[0]
        : "/public";
      const qrCodesDir = path.join(publicDir, "qr-codes");
      const fileName = `${employerId}-qr.png`;
      const filePath = path.join(qrCodesDir, fileName);

      // Convert data URL to buffer
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Create directory and write file
      await fs.mkdir(qrCodesDir, { recursive: true });
      await fs.writeFile(filePath, buffer);

      // Update employer with QR code URL
      const qrCodeUrl = `/qr-codes/${fileName}`;
      await db
        .update(employers)
        .set({ qrCodeUrl })
        .where(eq(employers.id, employerId));

      res.json({ success: true, qrCodeUrl, qrCodeDataUrl });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // ============================================================================
  // ADMIN ETA FORM 9198 ROUTES (Employer Onboarding)
  // ============================================================================

  app.get("/api/admin/eta-forms", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const forms = await db
        .select()
        .from(etaForm9198)
        .orderBy(desc(etaForm9198.createdAt));

      res.json(forms);
    } catch (error) {
      console.error("Error fetching ETA forms:", error);
      res.status(500).json({ error: "Failed to fetch ETA forms" });
    }
  });

  app.post("/api/admin/eta-forms", isAuthenticated, async (req: any, res) => {
    try {
      console.log("🔍 POST /api/admin/eta-forms - Request received");
      console.log("📦 Request body:", JSON.stringify(req.body, null, 2));
      
      const userId = req.user.claims.sub;
      console.log("👤 User ID from claims:", userId);
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      console.log("🔐 User from DB:", user);
      
      if (!user || user.role !== "admin") {
        console.log("❌ Authorization failed - user role:", user?.role);
        return res.status(403).json({ error: "Unauthorized" });
      }

      console.log("✅ Authorization passed");

      // Validate request body
      console.log("🔬 Validating request body with schema...");
      const validatedData = insertEtaForm9198Schema.parse(req.body);
      console.log("✅ Validation passed. Validated data:", JSON.stringify(validatedData, null, 2));
      
      // Create ETA Form 9198
      console.log("💾 Inserting into database...");
      const insertData = {
        ...validatedData,
        createdBy: userId,
        signatureRequestSentAt: validatedData.status === "sent" ? new Date() : undefined,
      };
      console.log("📝 Insert data:", JSON.stringify(insertData, null, 2));
      
      const [newForm] = await db
        .insert(etaForm9198)
        .values(insertData)
        .returning();

      console.log("✅ Database insert successful. New form:", JSON.stringify(newForm, null, 2));

      // Send welcome email if form is approved
      if (newForm.status === "approved") {
        try {
          const baseUrl = process.env.REPLIT_DEPLOYMENT 
            ? `https://${process.env.REPLIT_DEPLOYMENT}` 
            : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
          
          const { sendWelcomeEmail } = await import('./email/notifications');
          await sendWelcomeEmail(newForm.contactEmail, {
            employerName: newForm.legalName,
            contactName: newForm.contactName,
            dashboardUrl: `${baseUrl}/employer`,
            questionnaireUrl: `${baseUrl}/questionnaire/preview`,
          });
          console.log(`📧 Welcome email sent to: ${newForm.contactEmail}`);
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
        }
      }

      console.log("📤 Sending response...");
      res.json(newForm);
    } catch (error) {
      console.error("❌ Error creating ETA form:", error);
      console.error("Stack trace:", error instanceof Error ? error.stack : "No stack");
      res.status(500).json({ error: "Failed to create ETA form", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/admin/eta-forms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const [form] = await db
        .select()
        .from(etaForm9198)
        .where(eq(etaForm9198.id, req.params.id));

      if (!form) {
        return res.status(404).json({ error: "Form not found" });
      }

      res.json(form);
    } catch (error) {
      console.error("Error fetching ETA form:", error);
      res.status(500).json({ error: "Failed to fetch ETA form" });
    }
  });

  app.post("/api/admin/eta-forms/:id/complete-signature", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { signedByName, signedByEmail } = req.body;

      if (!signedByName || !signedByEmail) {
        return res.status(400).json({ error: "signedByName and signedByEmail are required" });
      }

      // Import the utility function
      const { completeSignatureAndActivate } = await import("./utils/onboarding");

      // Trigger employer account creation
      const result = await completeSignatureAndActivate(
        req.params.id,
        signedByName,
        signedByEmail
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error completing signature:", error);
      res.status(500).json({ error: error.message || "Failed to complete signature" });
    }
  });

  // ============================================================================
  // ADMIN QUESTIONNAIRE ROUTES
  // ============================================================================

  app.get("/api/admin/questionnaires", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const questionnairesList = await db
        .select()
        .from(questionnaires)
        .orderBy(desc(questionnaires.createdAt));

      res.json(questionnairesList);
    } catch (error) {
      console.error("Error fetching questionnaires:", error);
      res.status(500).json({ error: "Failed to fetch questionnaires" });
    }
  });

  app.post("/api/admin/questionnaires", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { id, name, employerId, isActive, questions } = req.body;
      
      if (id) {
        // Update existing
        await db
          .update(questionnaires)
          .set({ name, employerId, isActive, questions, updatedAt: new Date() })
          .where(eq(questionnaires.id, id));
        res.json({ success: true, id });
      } else {
        // Create new
        const [newQuestionnaire] = await db
          .insert(questionnaires)
          .values({ name, employerId, isActive, questions })
          .returning();
        res.json({ success: true, id: newQuestionnaire.id });
      }
    } catch (error) {
      console.error("Error saving questionnaire:", error);
      res.status(500).json({ error: "Failed to save questionnaire" });
    }
  });

  app.delete("/api/admin/questionnaires/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await db.delete(questionnaires).where(eq(questionnaires.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting questionnaire:", error);
      res.status(500).json({ error: "Failed to delete questionnaire" });
    }
  });

  // ============================================================================
  // ADMIN DETERMINATION TRACKING ROUTES (Phase 2)
  // ============================================================================

  // Get all screenings with filtering
  app.get("/api/admin/screenings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { employerId, status, startDate, endDate } = req.query;

      // Build query with filters
      let query = db
        .select({
          screening: screenings,
          employee: employees,
          employer: employers,
        })
        .from(screenings)
        .innerJoin(employees, eq(screenings.employeeId, employees.id))
        .innerJoin(employers, eq(screenings.employerId, employers.id));

      const conditions = [];
      if (employerId) {
        conditions.push(eq(screenings.employerId, employerId as string));
      }
      if (status) {
        conditions.push(eq(screenings.status, status as string));
      }
      if (startDate) {
        conditions.push(sql`${screenings.createdAt} >= ${startDate}`);
      }
      if (endDate) {
        conditions.push(sql`${screenings.createdAt} <= ${endDate}`);
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const results = await query.orderBy(desc(screenings.createdAt));

      res.json(results);
    } catch (error) {
      console.error("Error fetching screenings:", error);
      res.status(500).json({ error: "Failed to fetch screenings" });
    }
  });

  // Update screening status with audit trail
  app.patch("/api/admin/screenings/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const screeningId = req.params.id;
      const { 
        status, 
        reason, 
        notes, 
        certificationNumber, 
        certificationDate, 
        certificationExpiresAt,
        determinationLetterId 
      } = req.body;

      // Get current screening
      const [currentScreening] = await db
        .select()
        .from(screenings)
        .where(eq(screenings.id, screeningId));

      if (!currentScreening) {
        return res.status(404).json({ error: "Screening not found" });
      }

      // Update screening
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (status === "certified") {
        updateData.certificationNumber = certificationNumber;
        updateData.certifiedAt = certificationDate ? new Date(certificationDate) : new Date();
        updateData.certificationExpiresAt = certificationExpiresAt ? new Date(certificationExpiresAt) : null;
      }

      const [updatedScreening] = await db
        .update(screenings)
        .set(updateData)
        .where(eq(screenings.id, screeningId))
        .returning();

      // Create audit trail record
      await db.insert(screeningStatusChanges).values({
        screeningId,
        fromStatus: currentScreening.status || "unknown",
        toStatus: status,
        reason,
        notes,
        certificationNumber,
        certificationDate,
        certificationExpiresAt,
        determinationLetterId,
        changedBy: userId,
      });

      // Send determination result email if status changed to certified or denied
      if ((status === "certified" || status === "denied") && status !== currentScreening.status) {
        try {
          const [employee] = await db
            .select()
            .from(employees)
            .where(eq(employees.id, currentScreening.employeeId));

          const [employer] = await db
            .select()
            .from(employers)
            .where(eq(employers.id, currentScreening.employerId));

          if (employee && employer) {
            const { sendDeterminationResult } = await import('./email/notifications');
            
            let creditAmount: string | undefined;
            if (status === "certified") {
              const credits = await db
                .select()
                .from(creditCalculations)
                .where(eq(creditCalculations.screeningId, screeningId))
                .orderBy(desc(creditCalculations.updatedAt))
                .limit(1);
              
              if (credits.length > 0) {
                creditAmount = `$${Number(credits[0].totalCredit).toLocaleString()}`;
              }
            }

            await sendDeterminationResult(employee.email, {
              employeeName: `${employee.firstName} ${employee.lastName}`,
              employerName: employer.companyName,
              status,
              targetGroup: currentScreening.targetGroup || undefined,
              certificationNumber: certificationNumber || undefined,
              certificationDate: certificationDate ? new Date(certificationDate).toLocaleDateString() : undefined,
              denialReason: status === "denied" ? reason : undefined,
              creditAmount,
            });

            console.log(`📧 Determination result email sent to ${employee.email}`);
          }
        } catch (emailError) {
          console.error('Failed to send determination result email:', emailError);
        }
      }

      res.json({ success: true, screening: updatedScreening });
    } catch (error) {
      console.error("Error updating screening status:", error);
      res.status(500).json({ error: "Failed to update screening status" });
    }
  });

  // Upload determination letter for a screening
  app.post("/api/admin/screenings/:id/determination-letter", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const screeningId = req.params.id;

      // Get screening
      const [screening] = await db
        .select()
        .from(screenings)
        .where(eq(screenings.id, screeningId));

      if (!screening) {
        return res.status(404).json({ error: "Screening not found" });
      }

      // Save file to private object storage
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "/.private";
      const screeningsDir = path.join(privateDir, "determination-letters");
      const fileName = `${screeningId}-${Date.now()}-${req.file.originalname}`;
      const filePath = path.join(screeningsDir, fileName);

      await fs.mkdir(screeningsDir, { recursive: true });
      await fs.writeFile(filePath, req.file.buffer);

      // Create document record
      const [document] = await db.insert(documents).values({
        employeeId: screening.employeeId,
        employerId: screening.employerId,
        screeningId: screening.id,
        documentType: "determination_letter",
        fileName: req.file.originalname,
        fileUrl: filePath,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        verifiedBy: userId,
        isVerified: true,
        verifiedAt: new Date(),
      }).returning();

      res.json({ success: true, document });
    } catch (error) {
      console.error("Error uploading determination letter:", error);
      res.status(500).json({ error: "Failed to upload determination letter" });
    }
  });

  // Get screening history (audit trail)
  app.get("/api/admin/screenings/:id/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const screeningId = req.params.id;

      const history = await db
        .select({
          change: screeningStatusChanges,
          changedByUser: users,
        })
        .from(screeningStatusChanges)
        .leftJoin(users, eq(screeningStatusChanges.changedBy, users.id))
        .where(eq(screeningStatusChanges.screeningId, screeningId))
        .orderBy(desc(screeningStatusChanges.changedAt));

      res.json(history);
    } catch (error) {
      console.error("Error fetching screening history:", error);
      res.status(500).json({ error: "Failed to fetch screening history" });
    }
  });

  // ============================================================================
  // HOURS TRACKING ROUTES (Employer)
  // ============================================================================

  // Get all hours for employer's employees
  app.get("/api/employer/hours", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employerId = user.employerId;
      const { employeeId, startDate, endDate } = req.query;

      let query = db
        .select({
          hours: hoursWorked,
          employee: employees,
        })
        .from(hoursWorked)
        .leftJoin(employees, eq(hoursWorked.employeeId, employees.id))
        .where(eq(hoursWorked.employerId, employerId))
        .orderBy(desc(hoursWorked.enteredAt));

      const results = await query;
      res.json(results);
    } catch (error) {
      console.error("Error fetching hours:", error);
      res.status(500).json({ error: "Failed to fetch hours" });
    }
  });

  // Add hours manually
  app.post("/api/employer/hours", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const employerId = user.employerId;
      const { employeeId, hours, periodStart, periodEnd, notes } = req.body;

      // Verify employee belongs to this employer
      const [employee] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.employerId, employerId)));

      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const [newHours] = await db.insert(hoursWorked).values({
        employeeId,
        employerId,
        hours,
        periodStart,
        periodEnd,
        source: "manual",
        notes,
        enteredBy: userId,
      }).returning();

      res.json(newHours);
    } catch (error) {
      console.error("Error adding hours:", error);
      res.status(500).json({ error: "Failed to add hours" });
    }
  });

  // Bulk CSV import
  // NEW Enhanced CSV Import Flow - Step 1: Initialize session and detect columns
  app.post("/api/employer/hours/import/init", isAuthenticated, csvUpload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { parseAndDetectColumns } = await import('./utils/csvParser');
      const csvContent = req.file.buffer.toString("utf-8");
      
      // Parse CSV and detect columns
      const parsed = parseAndDetectColumns(csvContent);
      
      if (parsed.errors.length > 0) {
        return res.status(400).json({ 
          error: "Failed to parse CSV", 
          details: parsed.errors 
        });
      }

      // Create import session
      const [session] = await db.insert(csvImportSessions).values({
        employerId: user.employerId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        rowCount: parsed.rowCount,
        status: "mapping",
        importType: "hours",
        detectedColumns: parsed.columns as any,
        totalRows: parsed.rowCount,
        createdBy: userId,
      }).returning();

      // Store raw CSV data temporarily (in session for now, could use object storage for large files)
      // For simplicity, we'll re-parse on next step

      res.json({
        sessionId: session.id,
        columns: parsed.columns,
        rowCount: parsed.rowCount,
      });
    } catch (error) {
      console.error("Error initializing import:", error);
      res.status(500).json({ error: "Failed to initialize import" });
    }
  });

  // Step 2: Get import session details
  app.get("/api/employer/hours/import/:sessionId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const sessionId = req.params.sessionId;
      
      const [session] = await db
        .select()
        .from(csvImportSessions)
        .where(and(
          eq(csvImportSessions.id, sessionId),
          eq(csvImportSessions.employerId, user.employerId)
        ));

      if (!session) {
        return res.status(404).json({ error: "Import session not found" });
      }

      res.json(session);
    } catch (error) {
      console.error("Error fetching import session:", error);
      res.status(500).json({ error: "Failed to fetch import session" });
    }
  });

  // Step 3: Save column mappings to session
  app.patch("/api/employer/hours/import/:sessionId/mappings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const sessionId = req.params.sessionId;
      const { columnMappings, employeeMatchStrategy } = req.body;
      
      // Update session with column mappings
      const [updatedSession] = await db
        .update(csvImportSessions)
        .set({
          columnMappings: columnMappings as any,
          employeeMatchStrategy: employeeMatchStrategy || "id",
          status: "preview",
          updatedAt: new Date(),
        })
        .where(and(
          eq(csvImportSessions.id, sessionId),
          eq(csvImportSessions.employerId, user.employerId)
        ))
        .returning();

      if (!updatedSession) {
        return res.status(404).json({ error: "Import session not found" });
      }

      res.json(updatedSession);
    } catch (error) {
      console.error("Error saving column mappings:", error);
      res.status(500).json({ error: "Failed to save column mappings" });
    }
  });

  // Get all import templates for employer
  app.get("/api/employer/hours/import/templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const templates = await db
        .select()
        .from(csvImportTemplates)
        .where(eq(csvImportTemplates.employerId, user.employerId))
        .orderBy(desc(csvImportTemplates.lastUsedAt));

      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Step 4: Process and preview import (with employee matching)
  app.post("/api/employer/hours/import/:sessionId/preview", isAuthenticated, csvUpload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const sessionId = req.params.sessionId;
      
      // Get session
      const [session] = await db
        .select()
        .from(csvImportSessions)
        .where(and(
          eq(csvImportSessions.id, sessionId),
          eq(csvImportSessions.employerId, user.employerId)
        ));

      if (!session || !session.columnMappings) {
        return res.status(404).json({ error: "Import session not found or not configured" });
      }

      // Parse CSV again with mappings
      const { parseAndDetectColumns } = await import('./utils/csvParser');
      const csvContent = req.file.buffer.toString("utf-8");
      const parsed = parseAndDetectColumns(csvContent);
      
      if (parsed.errors.length > 0) {
        return res.status(400).json({ error: "Failed to parse CSV", details: parsed.errors });
      }

      // Import employee matching function
      const { matchEmployee } = await import('./utils/employeeMatching');
      
      // Process rows with employee matching
      const { parse } = await import('csv-parse/sync');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      const columnMappings = session.columnMappings as Record<string, string>;
      const matchStrategy = (session.employeeMatchStrategy || 'auto') as any;
      
      const processedRows = [];
      const validationErrors = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < records.length; i++) {
        const rawRow = records[i];
        const rowNum = i + 2; // +2 because row 1 is header, array is 0-indexed

        try {
          // Extract mapped fields
          const mappedData: any = {};
          for (const [csvCol, targetField] of Object.entries(columnMappings)) {
            if (targetField && targetField !== '_ignore') {
              mappedData[targetField] = rawRow[csvCol];
            }
          }

          // Employee matching
          const matchCriteria = {
            employeeId: mappedData.employeeId,
            ssn: mappedData.ssn,
            email: mappedData.email,
            firstName: mappedData.firstName,
            lastName: mappedData.lastName,
          };

          const matchResult = await matchEmployee(user.employerId, matchCriteria, matchStrategy);

          // Validate hours
          const hours = parseFloat(mappedData.hours);
          if (isNaN(hours) || hours <= 0) {
            throw new Error("Invalid hours value");
          }

          // Validate dates
          if (!mappedData.periodStart || !mappedData.periodEnd) {
            throw new Error("Missing period dates");
          }

          const rowData = {
            sessionId,
            rowNumber: rowNum,
            rawData: rawRow as any,
            mappedData: mappedData as any,
            employeeId: matchResult.employeeId,
            matchConfidence: matchResult.confidence,
            matchMethod: matchResult.matchMethod,
            matchScore: matchResult.matchScore,
            possibleMatches: matchResult.possibleMatches as any || null,
            validationStatus: matchResult.employeeId ? 'valid' : 'no_match',
            validationErrors: matchResult.employeeId ? null : ['Employee not found'] as any,
          };

          // Store row in database
          const [storedRow] = await db.insert(csvImportRows).values(rowData).returning();
          
          processedRows.push({
            ...storedRow,
            employeeData: matchResult.employee,
          });

          if (matchResult.employeeId) {
            successCount++;
          } else {
            errorCount++;
            validationErrors.push({
              row: rowNum,
              error: "Employee not found",
              data: mappedData,
            });
          }
        } catch (error: any) {
          errorCount++;
          const errorMsg = error.message || "Processing error";
          
          validationErrors.push({
            row: rowNum,
            error: errorMsg,
            data: rawRow,
          });

          // Store error row
          await db.insert(csvImportRows).values({
            sessionId,
            rowNumber: rowNum,
            rawData: rawRow as any,
            mappedData: {} as any,
            employeeId: null,
            matchConfidence: 'none',
            matchMethod: 'none',
            matchScore: 0,
            validationStatus: 'error',
            validationErrors: [errorMsg] as any,
          });
        }
      }

      // Update session
      await db
        .update(csvImportSessions)
        .set({
          status: 'preview',
          processedRows: successCount,
          errorRows: errorCount,
          updatedAt: new Date(),
        })
        .where(eq(csvImportSessions.id, sessionId));

      res.json({
        success: true,
        totalRows: records.length,
        successCount,
        errorCount,
        rows: processedRows,
        validationErrors,
      });
    } catch (error) {
      console.error("Error processing CSV import:", error);
      res.status(500).json({ error: "Failed to process import" });
    }
  });

  // Save a new import template
  app.post("/api/employer/hours/import/templates", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { name, description, columnMappings, employeeMatchStrategy, dateFormat } = req.body;

      const [template] = await db.insert(csvImportTemplates).values({
        employerId: user.employerId,
        name,
        description,
        importType: "hours",
        columnMappings: columnMappings as any,
        employeeMatchStrategy: employeeMatchStrategy || "id",
        dateFormat: dateFormat || "YYYY-MM-DD",
        createdBy: userId,
      }).returning();

      res.json(template);
    } catch (error) {
      console.error("Error saving template:", error);
      res.status(500).json({ error: "Failed to save template" });
    }
  });

  // Legacy bulk import (kept for backward compatibility)
  app.post("/api/employer/hours/bulk", isAuthenticated, csvUpload.single("file"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const employerId = user.employerId;
      const csvContent = req.file.buffer.toString("utf-8");
      const lines = csvContent.split("\n").filter(line => line.trim());
      
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV file is empty or has no data rows" });
      }

      // Parse CSV (expect: employeeId, hours, periodStart, periodEnd, notes)
      const header = lines[0].split(",").map(h => h.trim());
      const batchId = `batch-${Date.now()}`;
      const hoursEntries = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim());
        const row: any = {};
        header.forEach((h, idx) => {
          row[h] = values[idx];
        });

        // Verify employee exists and belongs to employer
        const [employee] = await db
          .select()
          .from(employees)
          .where(and(
            eq(employees.id, row.employeeId || row.employee_id),
            eq(employees.employerId, employerId)
          ));

        if (!employee) {
          errors.push({ line: i + 1, error: `Employee ${row.employeeId || row.employee_id} not found` });
          continue;
        }

        hoursEntries.push({
          employeeId: employee.id,
          employerId,
          hours: row.hours,
          periodStart: row.periodStart || row.period_start,
          periodEnd: row.periodEnd || row.period_end,
          notes: row.notes || "",
          source: "csv_import",
          batchId,
          enteredBy: userId,
        });
      }

      // Insert all hours
      if (hoursEntries.length > 0) {
        await db.insert(hoursWorked).values(hoursEntries);
      }

      res.json({
        success: true,
        imported: hoursEntries.length,
        errors,
        batchId,
      });
    } catch (error) {
      console.error("Error importing hours:", error);
      res.status(500).json({ error: "Failed to import hours" });
    }
  });

  // Update hours entry
  app.patch("/api/employer/hours/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const hoursId = req.params.id;
      const { hours, periodStart, periodEnd, notes } = req.body;

      // Verify hours entry belongs to this employer
      const [existingHours] = await db
        .select()
        .from(hoursWorked)
        .where(and(eq(hoursWorked.id, hoursId), eq(hoursWorked.employerId, user.employerId)));

      if (!existingHours) {
        return res.status(404).json({ error: "Hours entry not found" });
      }

      const [updated] = await db
        .update(hoursWorked)
        .set({
          hours,
          periodStart,
          periodEnd,
          notes,
          updatedAt: new Date(),
        })
        .where(eq(hoursWorked.id, hoursId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating hours:", error);
      res.status(500).json({ error: "Failed to update hours" });
    }
  });

  // Delete hours entry
  app.delete("/api/employer/hours/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const hoursId = req.params.id;

      // Verify hours entry belongs to this employer
      const [existingHours] = await db
        .select()
        .from(hoursWorked)
        .where(and(eq(hoursWorked.id, hoursId), eq(hoursWorked.employerId, user.employerId)));

      if (!existingHours) {
        return res.status(404).json({ error: "Hours entry not found" });
      }

      await db.delete(hoursWorked).where(eq(hoursWorked.id, hoursId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting hours:", error);
      res.status(500).json({ error: "Failed to delete hours" });
    }
  });

  // ============================================================================
  // CREDIT CALCULATION ENGINE
  // ============================================================================

  // Recalculate credit for a specific screening
  app.post("/api/employer/credits/calculate/:screeningId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || (user.role !== "employer" && user.role !== "admin") || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const screeningId = req.params.screeningId;

      // Get screening with employee data
      const [screening] = await db
        .select({
          screening: screenings,
          employee: employees,
        })
        .from(screenings)
        .leftJoin(employees, eq(screenings.employeeId, employees.id))
        .where(eq(screenings.id, screeningId));

      if (!screening) {
        return res.status(404).json({ error: "Screening not found" });
      }

      // Only calculate for certified screenings
      if (screening.screening.status !== "certified") {
        return res.status(400).json({ error: "Screening must be certified to calculate credits" });
      }

      // Get total hours worked for this employee
      const hoursResults = await db
        .select({
          totalHours: sql<number>`COALESCE(SUM(CAST(${hoursWorked.hours} AS DECIMAL)), 0)`,
        })
        .from(hoursWorked)
        .where(eq(hoursWorked.employeeId, screening.screening.employeeId));

      const totalHours = Number(hoursResults[0]?.totalHours || 0);

      // For now, we'll estimate wages based on hours (can be updated to use actual wage data)
      // Assuming $15/hour as a default (this should come from employee/employer data in real use)
      const estimatedWages = totalHours * 15;

      const rawTargetGroup = screening.screening.primaryTargetGroup;
      if (!rawTargetGroup) {
        return res.status(400).json({ error: "No target group assigned" });
      }

      // Normalize the target group name to get the correct code
      const targetGroup = normalizeTargetGroup(rawTargetGroup);
      if (!targetGroup) {
        console.error(`Failed to normalize target group: "${rawTargetGroup}"`);
        return res.status(400).json({ 
          error: "Invalid target group", 
          details: `Could not map "${rawTargetGroup}" to a valid target group code` 
        });
      }

      // Calculate credit using the eligibility engine
      const actualCredit = calculateCredit(targetGroup, totalHours, estimatedWages);

      // Get target group info
      const targetGroupInfo = TARGET_GROUPS[targetGroup];
      if (!targetGroupInfo) {
        return res.status(400).json({ error: "Invalid target group" });
      }

      // Check if credit calculation already exists
      const [existingCalc] = await db
        .select()
        .from(creditCalculations)
        .where(eq(creditCalculations.screeningId, screeningId));

      let creditCalc;
      if (existingCalc) {
        // Update existing calculation
        [creditCalc] = await db
          .update(creditCalculations)
          .set({
            hoursWorked: Math.floor(totalHours),
            wagesEarned: estimatedWages.toFixed(2),
            actualCreditAmount: actualCredit.toFixed(2),
            minimumHoursRequired: 120, // WOTC minimum is 120 hours for any credit
            status: totalHours >= 120 ? "in_progress" : "projected",
            updatedAt: new Date(),
          })
          .where(eq(creditCalculations.id, existingCalc.id))
          .returning();
      } else {
        // Create new calculation
        [creditCalc] = await db.insert(creditCalculations).values({
          screeningId,
          employerId: screening.screening.employerId,
          employeeId: screening.screening.employeeId,
          targetGroup,
          maxCreditAmount: targetGroupInfo.maxCredit.toFixed(2),
          projectedCreditAmount: actualCredit.toFixed(2),
          actualCreditAmount: actualCredit.toFixed(2),
          hoursWorked: Math.floor(totalHours),
          wagesEarned: estimatedWages.toFixed(2),
          minimumHoursRequired: 120, // WOTC minimum is 120 hours for any credit
          status: totalHours >= 120 ? "in_progress" : "projected",
        }).returning();
      }

      res.json(creditCalc);
    } catch (error) {
      console.error("Error calculating credit:", error);
      res.status(500).json({ error: "Failed to calculate credit" });
    }
  });

  // Get all credit calculations for employer
  app.get("/api/employer/credits", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const credits = await db
        .select({
          credit: creditCalculations,
          employee: employees,
          screening: screenings,
        })
        .from(creditCalculations)
        .leftJoin(employees, eq(creditCalculations.employeeId, employees.id))
        .leftJoin(screenings, eq(creditCalculations.screeningId, screenings.id))
        .where(eq(creditCalculations.employerId, user.employerId))
        .orderBy(desc(creditCalculations.calculatedAt));

      res.json(credits);
    } catch (error) {
      console.error("Error fetching credits:", error);
      res.status(500).json({ error: "Failed to fetch credits" });
    }
  });

  // Auto-recalculate all credits for an employer
  app.post("/api/employer/credits/recalculate-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Get all certified screenings for this employer
      const certifiedScreenings = await db
        .select()
        .from(screenings)
        .where(
          and(
            eq(screenings.employerId, user.employerId),
            eq(screenings.status, "certified")
          )
        );

      let recalculated = 0;
      for (const screening of certifiedScreenings) {
        // Trigger calculation for each screening
        const response = await fetch(`http://localhost:${process.env.PORT || 5000}/api/employer/credits/calculate/${screening.id}`, {
          method: "POST",
          headers: {
            cookie: req.headers.cookie || "",
          },
        });

        if (response.ok) {
          recalculated++;
        }
      }

      res.json({ success: true, recalculated });
    } catch (error) {
      console.error("Error recalculating credits:", error);
      res.status(500).json({ error: "Failed to recalculate credits" });
    }
  });

  // Get admin revenue dashboard metrics
  app.get("/api/admin/revenue/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Calculate MRR (Monthly Recurring Revenue)
      const mrrData = await db
        .select({
          monthlyRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${subscriptions.billingCycle} = 'monthly' THEN CAST(${subscriptionPlans.monthlyPrice} AS DOUBLE PRECISION) ELSE CAST(${subscriptionPlans.annualPrice} AS DOUBLE PRECISION) / 12 END), 0)`,
        })
        .from(subscriptions)
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(eq(subscriptions.status, "active"));

      const mrr = Number(mrrData[0]?.monthlyRevenue || 0);
      const arr = mrr * 12;

      // Get total subscriptions by status
      const subsByStatus = await db
        .select({
          status: subscriptions.status,
          count: sql<number>`COUNT(*)`,
        })
        .from(subscriptions)
        .groupBy(subscriptions.status);

      // Get subscription plan distribution
      const planDistribution = await db
        .select({
          planId: subscriptionPlans.id,
          planName: subscriptionPlans.displayName,
          count: sql<number>`COUNT(${subscriptions.id})`,
          revenue: sql<number>`COALESCE(SUM(CASE WHEN ${subscriptions.billingCycle} = 'monthly' THEN CAST(${subscriptionPlans.monthlyPrice} AS DOUBLE PRECISION) ELSE CAST(${subscriptionPlans.annualPrice} AS DOUBLE PRECISION) / 12 END), 0)`,
        })
        .from(subscriptionPlans)
        .leftJoin(subscriptions, and(
          eq(subscriptions.planId, subscriptionPlans.id),
          eq(subscriptions.status, "active")
        ))
        .groupBy(subscriptionPlans.id, subscriptionPlans.displayName);

      // Get outstanding invoices
      const outstandingInvoices = await db
        .select({
          count: sql<number>`COUNT(*)`,
          totalAmount: sql<number>`COALESCE(SUM(CAST(${invoices.amountDue} AS DOUBLE PRECISION)), 0)`,
        })
        .from(invoices)
        .where(eq(invoices.status, "open"));

      // Get total revenue (paid invoices)
      const totalRevenue = await db
        .select({
          total: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DOUBLE PRECISION)), 0)`,
        })
        .from(invoices)
        .where(eq(invoices.status, "paid"));

      // Calculate churn rate (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const canceledSubs = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, "canceled"),
            sql`${subscriptions.canceledAt} >= ${thirtyDaysAgo}`
          )
        );

      const totalActiveSubs = subsByStatus.find(s => s.status === "active")?.count || 0;
      const recentCancellations = Number(canceledSubs[0]?.count || 0);
      const churnRate = totalActiveSubs > 0 ? (recentCancellations / totalActiveSubs) * 100 : 0;

      // Get monthly revenue trend (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const revenueTrend = await db
        .select({
          month: sql<string>`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`,
          revenue: sql<number>`COALESCE(SUM(CAST(${invoices.totalAmount} AS DOUBLE PRECISION)), 0)`,
          invoiceCount: sql<number>`COUNT(*)`,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.status, "paid"),
            sql`${invoices.createdAt} >= ${sixMonthsAgo}`
          )
        )
        .groupBy(sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`TO_CHAR(${invoices.createdAt}, 'YYYY-MM')`);

      res.json({
        mrr: mrr,
        arr: arr,
        totalRevenue: Number(totalRevenue[0]?.total || 0),
        subscriptionsByStatus: subsByStatus.map(s => ({
          status: s.status,
          count: Number(s.count),
        })),
        planDistribution: planDistribution.map(p => ({
          planId: p.planId,
          planName: p.planName,
          count: Number(p.count),
          monthlyRevenue: Number(p.revenue || 0),
        })),
        outstandingInvoices: {
          count: Number(outstandingInvoices[0]?.count || 0),
          totalAmount: Number(outstandingInvoices[0]?.totalAmount || 0),
        },
        churnRate: churnRate,
        revenueTrend: revenueTrend.map(r => ({
          month: r.month,
          revenue: Number(r.revenue || 0),
          invoiceCount: Number(r.invoiceCount),
        })),
      });
    } catch (error) {
      console.error("Error fetching revenue dashboard:", error);
      res.status(500).json({ error: "Failed to fetch revenue dashboard" });
    }
  });

  // ============================================================================
  // BILLING & SUBSCRIPTIONS
  // ============================================================================

  // Get all available subscription plans
  app.get("/api/subscription-plans", async (req, res) => {
    try {
      const plans = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true))
        .orderBy(subscriptionPlans.sortOrder);

      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  });

  // Get employer's current subscription
  app.get("/api/employer/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const [subscription] = await db
        .select({
          subscription: subscriptions,
          plan: subscriptionPlans,
        })
        .from(subscriptions)
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(eq(subscriptions.employerId, user.employerId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      if (!subscription) {
        return res.json(null);
      }

      res.json(subscription);
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Create Stripe Checkout Session for subscription
  app.post("/api/employer/subscription/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { planId, billingCycle } = req.body;

      if (!planId || !billingCycle || !["monthly", "annual"].includes(billingCycle)) {
        return res.status(400).json({ error: "Invalid plan or billing cycle" });
      }

      // Get the plan
      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId));

      if (!plan) {
        return res.status(404).json({ error: "Plan not found" });
      }

      // Get or create Stripe customer for employer
      const [employer] = await db
        .select()
        .from(employers)
        .where(eq(employers.id, user.employerId));

      if (!employer) {
        return res.status(404).json({ error: "Employer not found" });
      }

      let stripeCustomerId = employer.stripeCustomerId;

      if (!stripeCustomerId) {
        // Create Stripe customer
        const customer = await stripe.customers.create({
          email: employer.contactEmail,
          name: employer.name,
          metadata: {
            employerId: employer.id,
          },
        });

        stripeCustomerId = customer.id;

        // Update employer with Stripe customer ID
        await db
          .update(employers)
          .set({ stripeCustomerId: customer.id })
          .where(eq(employers.id, employer.id));
      }

      // Create Stripe Checkout Session
      const priceAmount = billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;
      
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${plan.displayName} - ${billingCycle === "monthly" ? "Monthly" : "Annual"}`,
                description: plan.description || undefined,
              },
              recurring: {
                interval: billingCycle === "monthly" ? "month" : "year",
              },
              unit_amount: Math.round(Number(priceAmount) * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        success_url: `${req.protocol}://${req.get('host')}/employer/billing?success=true`,
        cancel_url: `${req.protocol}://${req.get('host')}/employer/billing?canceled=true`,
        metadata: {
          employerId: employer.id,
          planId: plan.id,
          billingCycle,
        },
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Stripe webhook handler
  // Note: This endpoint requires raw body for signature verification
  // Make sure your body parser middleware preserves the raw body for /api/webhooks/stripe
  app.post("/api/webhooks/stripe", async (req, res) => {
    const sig = req.headers["stripe-signature"];

    if (!sig) {
      return res.status(400).send("Missing Stripe signature");
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature using raw body
      // In production, configure STRIPE_WEBHOOK_SECRET from Stripe Dashboard → Webhooks
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (webhookSecret) {
        // Production: verify signature with raw body
        // Note: req.rawBody is set by express.json verify function in server/index.ts
        const rawBody = (req as any).rawBody;
        if (!rawBody) {
          throw new Error("Raw body not available for signature verification");
        }
        event = stripe.webhooks.constructEvent(
          rawBody,
          sig,
          webhookSecret
        );
      } else {
        // Development: parse directly (INSECURE - only for local testing)
        console.warn("WARNING: Stripe webhook running without signature verification. Set STRIPE_WEBHOOK_SECRET for production.");
        event = req.body as Stripe.Event;
      }
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`Stripe webhook received: ${event.type}`);

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          
          if (session.mode === "subscription") {
            const employerId = session.metadata?.employerId;
            const planId = session.metadata?.planId;
            const billingCycle = session.metadata?.billingCycle;

            if (employerId && planId && billingCycle) {
              // Create subscription record
              const [newSubscription] = await db.insert(subscriptions).values({
                employerId,
                planId,
                stripeSubscriptionId: session.subscription as string,
                stripeCustomerId: session.customer as string,
                billingCycle,
                status: "active",
                currentPeriodStart: new Date(session.created * 1000),
              }).returning();

              console.log(`Created subscription: ${newSubscription.id} for employer ${employerId}`);
            }
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          
          // Update subscription in database
          await db
            .update(subscriptions)
            .set({
              status: subscription.status,
              currentPeriodStart: new Date(subscription.current_period_start * 1000),
              currentPeriodEnd: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

          console.log(`Updated subscription: ${subscription.id}`);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          
          // Mark subscription as canceled
          await db
            .update(subscriptions)
            .set({
              status: "canceled",
              canceledAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

          console.log(`Canceled subscription: ${subscription.id}`);
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          
          // Find invoice in database
          const invoiceNumber = invoice.number || `draft-${invoice.id}`;
          const [dbInvoice] = await db
            .select()
            .from(invoices)
            .where(eq(invoices.invoiceNumber, invoiceNumber))
            .limit(1);

          if (dbInvoice) {
            // Update invoice status
            await db
              .update(invoices)
              .set({
                status: "paid",
                paidAt: new Date(invoice.status_transitions.paid_at! * 1000),
                updatedAt: new Date(),
              })
              .where(eq(invoices.id, dbInvoice.id));

            // Send invoice notification email
            try {
              const [employer] = await db
                .select()
                .from(employers)
                .where(eq(employers.id, dbInvoice.employerId));

              if (employer && employer.billingEmail) {
                const baseUrl = process.env.REPLIT_DEPLOYMENT 
                  ? `https://${process.env.REPLIT_DEPLOYMENT}` 
                  : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

                const { sendInvoiceNotification } = await import('./email/notifications');
                await sendInvoiceNotification(employer.billingEmail, {
                  employerName: employer.companyName,
                  invoiceNumber: dbInvoice.invoiceNumber,
                  invoiceDate: new Date(dbInvoice.issuedAt).toLocaleDateString(),
                  dueDate: new Date(dbInvoice.dueDate).toLocaleDateString(),
                  totalAmount: `$${Number(dbInvoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  amountDue: `$${Number(dbInvoice.amountDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  invoiceUrl: `${baseUrl}/employer/billing`,
                });

                console.log(`📧 Invoice notification sent to ${employer.billingEmail}`);
              }
            } catch (emailError) {
              console.error('Failed to send invoice notification:', emailError);
            }
          }
          
          console.log(`Invoice payment succeeded: ${invoice.number}`);
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // Create Stripe Billing Portal session (for payment method updates)
  app.post("/api/employer/subscription/portal", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const [employer] = await db
        .select()
        .from(employers)
        .where(eq(employers.id, user.employerId));

      if (!employer || !employer.stripeCustomerId) {
        return res.status(400).json({ error: "No Stripe customer found. Please subscribe first." });
      }

      // Create Stripe billing portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: employer.stripeCustomerId,
        return_url: `${req.protocol}://${req.get('host')}/employer/billing`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating billing portal session:", error);
      res.status(500).json({ error: "Failed to create billing portal session" });
    }
  });

  // Cancel subscription
  app.post("/api/employer/subscription/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Get current subscription
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.employerId, user.employerId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      if (!subscription || !subscription.stripeSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      // Cancel at period end (let them use it until the end of billing cycle)
      const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update in database
      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      res.json({ 
        success: true,
        message: "Subscription will be canceled at the end of the current billing period",
        cancelAt: new Date(updated.current_period_end * 1000)
      });
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Change subscription plan (upgrade/downgrade)
  app.post("/api/employer/subscription/change-plan", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== "employer" || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { planId, billingCycle } = req.body;

      if (!planId || !billingCycle || !["monthly", "annual"].includes(billingCycle)) {
        return res.status(400).json({ error: "Invalid plan or billing cycle" });
      }

      // Get the new plan
      const [newPlan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId));

      if (!newPlan) {
        return res.status(404).json({ error: "Plan not found" });
      }

      // Get current subscription
      const [currentSub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.employerId, user.employerId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      if (!currentSub || !currentSub.stripeSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      // Get the Stripe subscription
      const stripeSubscription = await stripe.subscriptions.retrieve(currentSub.stripeSubscriptionId);

      // Get the price amount
      const priceAmount = billingCycle === "monthly" ? newPlan.monthlyPrice : newPlan.annualPrice;

      // Create new price or get existing one
      // For simplicity, we'll create a new checkout session instead of updating in-place
      // This ensures proper prorating and avoids Stripe API complexity
      
      // Update existing subscription with new plan
      const updated = await stripe.subscriptions.update(currentSub.stripeSubscriptionId, {
        items: [{
          id: stripeSubscription.items.data[0].id,
          price_data: {
            currency: "usd",
            product_data: {
              name: `${newPlan.displayName} - ${billingCycle === "monthly" ? "Monthly" : "Annual"}`,
              description: newPlan.description || undefined,
            },
            recurring: {
              interval: billingCycle === "monthly" ? "month" : "year",
            },
            unit_amount: Math.round(Number(priceAmount) * 100),
          },
        }],
        proration_behavior: "create_prorations", // Prorate the difference
      });

      // Update in database
      await db
        .update(subscriptions)
        .set({
          planId: newPlan.id,
          billingCycle,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, currentSub.id));

      res.json({ 
        success: true,
        message: "Subscription plan updated successfully",
        subscription: updated
      });
    } catch (error) {
      console.error("Error changing subscription plan:", error);
      res.status(500).json({ error: "Failed to change subscription plan" });
    }
  });

  // ============================================================================
  // INVOICE MANAGEMENT
  // ============================================================================

  // Helper function to generate invoice number atomically using sequence table
  // Uses two-step approach: ensure row exists, then atomic increment
  async function generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-indexed
    const month = String(currentMonth + 1).padStart(2, '0');
    const yearMonth = `${year}-${month}`; // e.g., "2024-10"
    
    // Two-step atomic sequence generation:
    // 1. Ensure row exists (safe for concurrent first-of-month requests)
    // 2. Atomic UPDATE with increment and RETURNING (guaranteed post-update value)
    const invoiceNumber = await db.transaction(async (tx) => {
      // Step 1: Ensure sequence row exists for this month
      // ON CONFLICT DO NOTHING means this is safe for concurrent requests
      await tx
        .insert(invoiceSequences)
        .values({
          yearMonth,
          lastSequence: 0, // Start at 0, first UPDATE will make it 1
        })
        .onConflictDoNothing();
      
      // Step 2: Atomically increment and get new value
      // UPDATE with RETURNING guarantees we get the post-increment value
      const [result] = await tx
        .update(invoiceSequences)
        .set({
          lastSequence: sql`${invoiceSequences.lastSequence} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(invoiceSequences.yearMonth, yearMonth))
        .returning();
      
      const sequence = String(result.lastSequence).padStart(4, '0');
      return `INV-${year}-${month}-${sequence}`;
    });
    
    return invoiceNumber;
  }

  // Generate invoice for an employer's certified screenings
  app.post("/api/admin/invoices/generate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { employerId, periodStart, periodEnd } = req.body;

      if (!employerId) {
        return res.status(400).json({ error: "Employer ID is required" });
      }

      // Get employer and their active subscription
      const [employer] = await db
        .select()
        .from(employers)
        .where(eq(employers.id, employerId));

      if (!employer) {
        return res.status(404).json({ error: "Employer not found" });
      }

      const [subscription] = await db
        .select({
          subscription: subscriptions,
          plan: subscriptionPlans,
        })
        .from(subscriptions)
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(
          and(
            eq(subscriptions.employerId, employerId),
            eq(subscriptions.status, "active")
          )
        );

      if (!subscription || !subscription.plan) {
        return res.status(400).json({ error: "No active subscription found for this employer" });
      }

      // Define billing period
      const start = periodStart ? new Date(periodStart) : subscription.subscription.currentPeriodStart || new Date();
      const end = periodEnd ? new Date(periodEnd) : subscription.subscription.currentPeriodEnd || new Date();

      // Get all certified screenings in this period
      const certifiedScreenings = await db
        .select({
          screening: screenings,
          employee: employees,
          credit: creditCalculations,
        })
        .from(screenings)
        .leftJoin(employees, eq(screenings.employeeId, employees.id))
        .leftJoin(creditCalculations, eq(screenings.id, creditCalculations.screeningId))
        .where(
          and(
            eq(screenings.employerId, employerId),
            eq(screenings.status, "certified"),
            sql`${screenings.statusUpdatedAt} >= ${start}`,
            sql`${screenings.statusUpdatedAt} <= ${end}`
          )
        );

      if (certifiedScreenings.length === 0) {
        return res.status(200).json({ 
          message: "No certified screenings found for this period",
          invoice: null 
        });
      }

      // Calculate fees
      const perScreeningFee = Number(subscription.plan.perScreeningFee || 0);
      const perCreditFeeRate = Number(subscription.plan.perCreditFee || 0) / 100; // Convert percentage to decimal

      let subtotal = 0;
      const lineItems: any[] = [];

      // Add screening fees
      const screeningFeeAmount = certifiedScreenings.length * perScreeningFee;
      if (screeningFeeAmount > 0) {
        lineItems.push({
          description: `Screening fees for ${certifiedScreenings.length} certified employee(s)`,
          itemType: "screening_fee",
          quantity: certifiedScreenings.length,
          unitPrice: perScreeningFee.toFixed(2),
          amount: screeningFeeAmount.toFixed(2),
          periodStart: start,
          periodEnd: end,
        });
        subtotal += screeningFeeAmount;
      }

      // Add credit processing fees for each certified screening with calculated credits
      for (const { screening, employee, credit } of certifiedScreenings) {
        if (credit && credit.actualCredit) {
          const creditAmount = Number(credit.actualCredit);
          const processingFee = creditAmount * perCreditFeeRate;
          
          if (processingFee > 0) {
            lineItems.push({
              description: `Credit processing fee for ${employee?.firstName} ${employee?.lastName} - $${creditAmount.toLocaleString()} credit`,
              itemType: "credit_processing_fee",
              screeningId: screening.id,
              employeeId: employee?.id,
              quantity: 1,
              unitPrice: processingFee.toFixed(2),
              amount: processingFee.toFixed(2),
              periodStart: start,
              periodEnd: end,
            });
            subtotal += processingFee;
          }
        }
      }

      // Create invoice using atomic sequence generation
      // SELECT ... FOR UPDATE ensures no race conditions
      const invoiceNumber = await generateInvoiceNumber();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms

      const [invoice] = await db.insert(invoices).values({
        employerId,
        subscriptionId: subscription.subscription.id,
        invoiceNumber,
        subtotal: subtotal.toFixed(2),
        taxAmount: "0.00",
        totalAmount: subtotal.toFixed(2),
        amountDue: subtotal.toFixed(2),
        amountPaid: "0.00",
        periodStart: start,
        periodEnd: end,
        status: "open",
        dueDate,
      }).returning();

      // Insert line items
      for (const item of lineItems) {
        await db.insert(invoiceLineItems).values({
          invoiceId: invoice.id,
          ...item,
        });
      }

      console.log(`Generated invoice ${invoice.invoiceNumber} for employer ${employerId}: $${subtotal.toFixed(2)}`);

      res.json({
        invoice,
        lineItems,
        message: `Invoice ${invoice.invoiceNumber} generated successfully for ${certifiedScreenings.length} certified screenings`,
      });
    } catch (error) {
      console.error("Error generating invoice:", error);
      res.status(500).json({ error: "Failed to generate invoice" });
    }
  });

  // Get all invoices for employer
  app.get("/api/employer/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || !user.employerId) {
        return res.status(403).json({ error: "Employer access required" });
      }

      const employerInvoices = await db
        .select({
          invoice: invoices,
          subscription: subscriptions,
          plan: subscriptionPlans,
        })
        .from(invoices)
        .leftJoin(subscriptions, eq(invoices.subscriptionId, subscriptions.id))
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(eq(invoices.employerId, user.employerId))
        .orderBy(desc(invoices.createdAt));

      res.json(employerInvoices);
    } catch (error) {
      console.error("Error fetching employer invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  // Get invoice details
  app.get("/api/invoices/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      const invoiceId = req.params.id;

      const [invoice] = await db
        .select({
          invoice: invoices,
          employer: employers,
          subscription: subscriptions,
          plan: subscriptionPlans,
        })
        .from(invoices)
        .leftJoin(employers, eq(invoices.employerId, employers.id))
        .leftJoin(subscriptions, eq(invoices.subscriptionId, subscriptions.id))
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
        .where(eq(invoices.id, invoiceId));

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Authorization: admin can see all, employer can see their own
      if (user.role !== 'admin' && invoice.invoice.employerId !== user.employerId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get line items
      const items = await db
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, invoiceId));

      // Get payment history
      const paymentHistory = await db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, invoiceId))
        .orderBy(desc(payments.createdAt));

      res.json({
        ...invoice,
        lineItems: items,
        payments: paymentHistory,
      });
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      res.status(500).json({ error: "Failed to fetch invoice details" });
    }
  });

  // Get all invoices (admin only)
  app.get("/api/admin/invoices", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { status, employerId } = req.query;

      let query = db
        .select({
          invoice: invoices,
          employer: employers,
          subscription: subscriptions,
          plan: subscriptionPlans,
        })
        .from(invoices)
        .leftJoin(employers, eq(invoices.employerId, employers.id))
        .leftJoin(subscriptions, eq(invoices.subscriptionId, subscriptions.id))
        .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id));

      const conditions = [];
      
      if (status && status !== 'all') {
        conditions.push(eq(invoices.status, status as string));
      }
      
      if (employerId && employerId !== 'all') {
        conditions.push(eq(invoices.employerId, employerId as string));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const allInvoices = await query.orderBy(desc(invoices.createdAt));

      res.json(allInvoices);
    } catch (error) {
      console.error("Error fetching admin invoices:", error);
      res.status(500).json({ error: "Failed to fetch invoices" });
    }
  });

  // Mark invoice as paid
  app.post("/api/admin/invoices/:id/mark-paid", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const invoiceId = req.params.id;
      const { paymentMethod, notes } = req.body;

      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId));

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Create payment record
      await db.insert(payments).values({
        invoiceId: invoice.id,
        employerId: invoice.employerId,
        amount: invoice.amountDue,
        currency: "usd",
        paymentMethod: paymentMethod || "manual",
        status: "succeeded",
        paidAt: new Date(),
      });

      // Update invoice
      const [updatedInvoice] = await db
        .update(invoices)
        .set({
          status: "paid",
          amountPaid: invoice.totalAmount,
          amountDue: "0.00",
          paidAt: new Date(),
          notes: notes || invoice.notes,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, invoiceId))
        .returning();

      console.log(`Invoice ${invoice.invoiceNumber} marked as paid`);

      res.json(updatedInvoice);
    } catch (error) {
      console.error("Error marking invoice as paid:", error);
      res.status(500).json({ error: "Failed to mark invoice as paid" });
    }
  });

  // ============================================================================
  // PHASE 4: STATE AUTOMATION & INTELLIGENCE API ROUTES
  // ============================================================================

  // Get all state portal configurations
  app.get("/api/admin/state-portals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { statePortalConfigs } = await import("@shared/schema");
      const configs = await db.select().from(statePortalConfigs).orderBy(statePortalConfigs.stateName);
      
      res.json(configs);
    } catch (error) {
      console.error("Error fetching state portals:", error);
      res.status(500).json({ error: "Failed to fetch state portals" });
    }
  });

  // Get single state portal configuration
  app.get("/api/admin/state-portals/:stateCode", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { statePortalConfigs } = await import("@shared/schema");
      const [config] = await db
        .select()
        .from(statePortalConfigs)
        .where(eq(statePortalConfigs.stateCode, req.params.stateCode));
      
      if (!config) {
        return res.status(404).json({ error: "State portal not found" });
      }

      res.json(config);
    } catch (error) {
      console.error("Error fetching state portal:", error);
      res.status(500).json({ error: "Failed to fetch state portal" });
    }
  });

  // Update state portal configuration
  app.patch("/api/admin/state-portals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { statePortalConfigs, updateStatePortalConfigSchema } = await import("@shared/schema");
      
      // Validate input
      const validated = updateStatePortalConfigSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: validated.error.issues 
        });
      }

      const [updated] = await db
        .update(statePortalConfigs)
        .set({
          ...validated.data,
          updatedAt: new Date(),
        })
        .where(eq(statePortalConfigs.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "State portal not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating state portal:", error);
      res.status(500).json({ error: "Failed to update state portal" });
    }
  });

  // Initialize state portal seeds
  app.post("/api/admin/state-portals/seed", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { statePortalSeeds } = await import('./utils/statePortalSeeds');
      const { statePortalConfigs } = await import("@shared/schema");

      // Insert or update portal configs
      const results = [];
      for (const seed of statePortalSeeds) {
        const [existing] = await db
          .select()
          .from(statePortalConfigs)
          .where(eq(statePortalConfigs.stateCode, seed.stateCode));

        if (existing) {
          // Update existing
          const [updated] = await db
            .update(statePortalConfigs)
            .set({
              ...seed,
              updatedAt: new Date(),
            })
            .where(eq(statePortalConfigs.stateCode, seed.stateCode))
            .returning();
          results.push({ action: 'updated', config: updated });
        } else {
          // Insert new
          const [created] = await db
            .insert(statePortalConfigs)
            .values(seed)
            .returning();
          results.push({ action: 'created', config: created });
        }
      }

      res.json({
        success: true,
        message: `Seeded ${results.length} state portal configurations`,
        results,
      });
    } catch (error) {
      console.error("Error seeding state portals:", error);
      res.status(500).json({ error: "Failed to seed state portals" });
    }
  });

  // Get state submission jobs for employer
  app.get("/api/employer/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== 'employer' || !user.employerId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { stateSubmissionJobs } = await import("@shared/schema");
      const jobs = await db
        .select()
        .from(stateSubmissionJobs)
        .where(eq(stateSubmissionJobs.employerId, user.employerId))
        .orderBy(desc(stateSubmissionJobs.createdAt))
        .limit(100);

      res.json(jobs);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  // Get all submission jobs (admin)
  app.get("/api/admin/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { stateSubmissionJobs } = await import("@shared/schema");
      const jobs = await db
        .select()
        .from(stateSubmissionJobs)
        .orderBy(desc(stateSubmissionJobs.createdAt))
        .limit(500);

      res.json(jobs);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
