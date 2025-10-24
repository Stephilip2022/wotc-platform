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
  aiAssistanceLogs,
  etaForm9198,
  insertEtaForm9198Schema,
  hoursWorked,
  screeningStatusChanges,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./replitAuth";
import OpenAI from "openai";
import { determineEligibility, calculateCredit, TARGET_GROUPS } from "./eligibility";
import { generateWOTCExportCSV, generateStateSpecificCSV, generateExportFilename } from "./utils/csv-export";

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
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
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
      // TODO: Implement email/SMS reminder
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to send reminder" });
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

      // Get monthly certification trends for the last 12 months (SQLite compatible)
      const trends = await db
        .select({
          month: sql<string>`strftime('%Y-%m', ${screenings.updatedAt})`,
          certified: sql<number>`SUM(CASE WHEN ${screenings.status} = 'certified' THEN 1 ELSE 0 END)`,
          denied: sql<number>`SUM(CASE WHEN ${screenings.status} = 'denied' THEN 1 ELSE 0 END)`,
          pending: sql<number>`SUM(CASE WHEN ${screenings.status} = 'pending' THEN 1 ELSE 0 END)`,
        })
        .from(screenings)
        .where(sql`${screenings.updatedAt} >= date('now', '-12 months')`)
        .groupBy(sql`strftime('%Y-%m', ${screenings.updatedAt})`)
        .orderBy(sql`strftime('%Y-%m', ${screenings.updatedAt})`);

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

      // TODO: If status is "sent", trigger email to contactEmail with e-signature request
      if (newForm.status === "sent") {
        console.log(`📧 E-signature request would be sent to: ${newForm.contactEmail}`);
        // Future: Integrate with DocuSign, HelloSign, or build custom e-signature flow
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

      const targetGroup = screening.screening.primaryTargetGroup;
      if (!targetGroup) {
        return res.status(400).json({ error: "No target group assigned" });
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

  const httpServer = createServer(app);
  return httpServer;
}
