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
import { eq, and, or, desc, sql } from "drizzle-orm";
import { setupClerkAuth, isAuthenticated, getOrCreateUser, getUserByClerkId } from "./clerkAuth";
import { getAuth } from "@clerk/express";
import OpenAI from "openai";
import Stripe from "stripe";
import { determineEligibility, calculateCredit, TARGET_GROUPS, normalizeTargetGroup } from "./eligibility";
import { generateWOTCExportCSV, generateStateSpecificCSV, generateExportFilename } from "./utils/csv-export";
import notificationsRouter from "./routes/notifications";
import apiKeysRouter from "./routes/apiKeys";
import publicApiRouter from "./routes/publicApi";
import webhooksRouter from "./routes/webhooks";
import retentionRouter from "./routes/retention";
import multiCreditRouter from "./routes/multiCredit";
import integrationsRouter from "./routes/integrations";
import analyticsRouter from "./routes/analytics";
import auditRouter, { logAuditEvent } from "./routes/audit";
import certificationRouter from "./routes/certification";
import clientAgreementsRouter from "./routes/clientAgreements";
import pricingRouter from "./routes/pricing";
import { 
  translateText, 
  translateToSpanish, 
  batchTranslate,
  batchTranslateToSpanish, 
  uiStrings,
  spanishUIStrings,
  getSupportedLanguages,
  detectLanguage,
  SupportedLanguage,
} from "./services/translationService";
import {
  extractDeterminationLetterData,
  processAndStoreDeterminationLetter,
  analyzeDocumentType,
} from "./services/documentOCR";
import {
  getQuestionnaireHelp,
  simplifyQuestion,
  explainTerm,
  logAIInteraction,
  WOTC_TERMS,
} from "./services/conversationalAI";

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
  // Setup Clerk Auth
  setupClerkAuth(app);

  // Mount public API routes (v1) - uses API key authentication
  app.use("/api/v1", publicApiRouter);

  // Mount notification routes
  app.use("/api/notifications", isAuthenticated, notificationsRouter);
  
  // Mount API key management routes
  app.use("/api/developer/keys", isAuthenticated, apiKeysRouter);
  
  // Mount webhook management routes
  app.use("/api/webhooks", isAuthenticated, webhooksRouter);
  
  // Mount retention optimization routes
  app.use("/api/retention", isAuthenticated, retentionRouter);
  
  // Mount multi-credit bundling routes
  app.use("/api/credits", isAuthenticated, multiCreditRouter);

  // Mount integrations routes
  app.use("/api/integrations", isAuthenticated, integrationsRouter);

  // Mount analytics routes
  app.use("/api/analytics", isAuthenticated, analyticsRouter);

  // Mount audit routes  
  app.use("/api/audit", isAuthenticated, auditRouter);

  // Mount certification automation routes
  app.use("/api/certification", isAuthenticated, certificationRouter);

  // Client Agreements (Engagement Letters & ETA Form 9198)
  app.use("/api/agreements", isAuthenticated, clientAgreementsRouter);

  // Pricing configuration and billing
  app.use("/api/pricing", pricingRouter);

  // ============================================================================
  // TRANSLATION ROUTES
  // ============================================================================

  // Get supported languages
  app.get("/api/translate/languages", async (req: any, res) => {
    res.json(getSupportedLanguages());
  });

  // Translate single text to any supported language
  app.post("/api/translate", isAuthenticated, async (req: any, res) => {
    try {
      const { text, targetLanguage = "es" } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      const result = await translateText(text, targetLanguage as SupportedLanguage);
      res.json(result);
    } catch (error) {
      console.error("Translation error:", error);
      res.status(500).json({ error: "Failed to translate text" });
    }
  });

  // Batch translate multiple texts
  app.post("/api/translate/batch", isAuthenticated, async (req: any, res) => {
    try {
      const { texts, targetLanguage = "es" } = req.body;
      if (!texts || !Array.isArray(texts)) {
        return res.status(400).json({ error: "Texts array is required" });
      }
      const result = await batchTranslate(texts, targetLanguage as SupportedLanguage);
      res.json(result);
    } catch (error) {
      console.error("Batch translation error:", error);
      res.status(500).json({ error: "Failed to translate texts" });
    }
  });

  // Detect language of text
  app.post("/api/translate/detect", isAuthenticated, async (req: any, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      const result = await detectLanguage(text);
      res.json(result);
    } catch (error) {
      console.error("Language detection error:", error);
      res.status(500).json({ error: "Failed to detect language" });
    }
  });

  // Get pre-translated UI strings for a language
  app.get("/api/translate/ui-strings", isAuthenticated, async (req: any, res) => {
    const language = (req.query.language as SupportedLanguage) || "es";
    res.json(uiStrings[language] || spanishUIStrings);
  });

  // ============================================================================
  // DOCUMENT OCR ROUTES
  // ============================================================================

  // Analyze document type (accepts file upload or JSON with base64)
  app.post("/api/ocr/analyze", isAuthenticated, async (req: any, res) => {
    try {
      let imageBase64: string;
      let mimeType: string;
      
      if (req.body.imageBase64) {
        imageBase64 = req.body.imageBase64;
        mimeType = req.body.mimeType || "image/png";
      } else {
        return res.status(400).json({ error: "imageBase64 is required" });
      }
      
      const result = await analyzeDocumentType(imageBase64, mimeType);
      res.json(result);
    } catch (error) {
      console.error("Document analysis error:", error);
      res.status(500).json({ error: "Failed to analyze document" });
    }
  });

  // Extract data from determination letter (accepts file upload or JSON with base64)
  app.post("/api/ocr/extract", isAuthenticated, async (req: any, res) => {
    try {
      let imageBase64: string;
      let mimeType: string;
      
      if (req.body.imageBase64) {
        imageBase64 = req.body.imageBase64;
        mimeType = req.body.mimeType || "image/png";
      } else {
        return res.status(400).json({ error: "imageBase64 is required" });
      }
      
      const result = await extractDeterminationLetterData(imageBase64, mimeType);
      res.json(result);
    } catch (error) {
      console.error("OCR extraction error:", error);
      res.status(500).json({ error: "Failed to extract document data" });
    }
  });

  // Process and store determination letter
  app.post("/api/ocr/process/:screeningId", isAuthenticated, upload.single("document"), async (req: any, res) => {
    try {
      const { screeningId } = req.params;
      if (!req.file) {
        return res.status(400).json({ error: "Document file is required" });
      }
      const imageBase64 = req.file.buffer.toString("base64");
      const result = await processAndStoreDeterminationLetter(
        screeningId,
        imageBase64,
        req.file.mimetype,
        req.file.originalname
      );
      res.json(result);
    } catch (error) {
      console.error("Document processing error:", error);
      res.status(500).json({ error: "Failed to process document" });
    }
  });

  // ============================================================================
  // CONVERSATIONAL AI ROUTES
  // ============================================================================

  // Get AI help with questionnaire
  app.post("/api/ai/help", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuth(req).userId!;
      const { message, context, history } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      const result = await getQuestionnaireHelp(message, context || {}, history || []);
      
      // Log the interaction
      if (userId) {
        await logAIInteraction(userId, context?.screeningId, "help", message, result.message, result.tokensUsed);
      }
      
      res.json(result);
    } catch (error) {
      console.error("AI help error:", error);
      res.status(500).json({ error: "Failed to get AI assistance" });
    }
  });

  // Simplify a question
  app.post("/api/ai/simplify", isAuthenticated, async (req: any, res) => {
    try {
      const { question, readingLevel, language } = req.body;
      
      if (!question) {
        return res.status(400).json({ error: "Question is required" });
      }
      
      const result = await simplifyQuestion(question, readingLevel || 8, language || "en");
      res.json(result);
    } catch (error) {
      console.error("Question simplification error:", error);
      res.status(500).json({ error: "Failed to simplify question" });
    }
  });

  // Explain a WOTC term
  app.post("/api/ai/explain-term", isAuthenticated, async (req: any, res) => {
    try {
      const { term, language } = req.body;
      
      if (!term) {
        return res.status(400).json({ error: "Term is required" });
      }
      
      // Check quick dictionary first
      if (WOTC_TERMS[term.toUpperCase()] && (!language || language === "en")) {
        return res.json({
          definition: WOTC_TERMS[term.toUpperCase()],
          examples: [],
          relatedTerms: [],
          fromDictionary: true,
        });
      }
      
      const result = await explainTerm(term, language || "en");
      res.json(result);
    } catch (error) {
      console.error("Term explanation error:", error);
      res.status(500).json({ error: "Failed to explain term" });
    }
  });

  // Get WOTC terms dictionary
  app.get("/api/ai/terms", async (req: any, res) => {
    res.json(WOTC_TERMS);
  });

  // Chat with AI assistant (for questionnaire help)
  app.post("/api/ai/chat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuth(req).userId!;
      const { message, context, conversationHistory } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }
      
      const result = await getQuestionnaireHelp(message, context || {}, conversationHistory || []);
      
      // Log the interaction
      if (userId) {
        await logAIInteraction(userId, context?.screeningId, "chat", message, result.message, result.tokensUsed);
      }
      
      res.json(result);
    } catch (error) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: "Failed to get AI response" });
    }
  });

  // ============================================================================
  // AUTHENTICATION ROUTES
  // ============================================================================
  
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getOrCreateUser(req);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const userId = getAuth(req).userId!;
      
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
      const userId = getAuth(req).userId!;
      const { questionnaireId, responses, completionPercentage } = req.body;
      
      const user = await getUserByClerkId(userId);
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
      const userId = getAuth(req).userId!;
      const { questionnaireId, responses } = req.body;
      
      console.log("[SUBMIT] User ID:", userId);
      console.log("[SUBMIT] Questionnaire ID:", questionnaireId);
      console.log("[SUBMIT] Response count:", Object.keys(responses || {}).length);
      
      const user = await getUserByClerkId(userId);
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
      const userId = getAuth(req).userId!;
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

      const userId = getAuth(req).userId!;
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
      const userId = getAuth(req).userId!;
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== "admin") {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { name, ein, contactEmail, contactPhone, address, city, state, zipCode } = req.body;

      if (!name || !ein || !contactEmail) {
        return res.status(400).json({ error: "Company name, EIN, and contact email are required" });
      }

      const [newEmployer] = await db.insert(employers).values({
        name,
        ein,
        contactEmail,
        contactPhone: contactPhone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        onboardingStatus: "pending",
      }).returning();
      
      res.json({ success: true, id: newEmployer.id, employer: newEmployer });
    } catch (error: any) {
      console.error("Error adding employer:", error);
      if (error?.code === "23505") {
        return res.status(400).json({ error: "An employer with this EIN already exists" });
      }
      res.status(500).json({ error: "Failed to add employer" });
    }
  });

  // ============================================================================
  // ADMIN CSV EXPORT ROUTES
  // ============================================================================

  // Admin: Get export record count
  app.get("/api/admin/export/wotc-csv/count", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      
      const userId = getAuth(req).userId!;
      console.log("👤 User ID from claims:", userId);
      
      const user = await getUserByClerkId(userId);
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const userId = getAuth(req).userId!;
      const user = await getUserByClerkId(userId);
      
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
      const userId = getAuth(req).userId!;
      const user = await getUserByClerkId(userId);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const userId = getAuth(req).userId!;
      const user = await getUserByClerkId(userId);
      
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
      const userId = getAuth(req).userId!;
      const user = await getUserByClerkId(userId);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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
  
  // Test MFA functionality (Development only)
  app.post('/api/admin/test-mfa', async (req, res) => {
    try {
      const { generateTOTPToken, validateTOTPToken, generateTOTPSecret, generateBackupCodes } = await import("./utils/mfaHandler");
      
      const secret = generateTOTPSecret();
      const token = generateTOTPToken(secret);
      const isValid = validateTOTPToken(token, secret);
      const backupCodes = generateBackupCodes(10);
      
      res.json({
        success: true,
        secret: secret.substring(0, 16) + '...',
        token,
        isValid,
        backupCodesCount: backupCodes.length,
        sampleBackupCodes: backupCodes.slice(0, 3),
      });
    } catch (error) {
      console.error("MFA test failed:", error);
      res.status(500).json({ error: "MFA test failed" });
    }
  });

  // Get all state portal configurations (with decryption for admin UI)
  app.get("/api/admin/state-portals", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { statePortalConfigs } = await import("@shared/schema");
      const { decryptCredentials, decryptChallengeQuestions, decryptMfaBackupCodes, decrypt } = await import("./utils/encryption");
      
      const configs = await db.select().from(statePortalConfigs).orderBy(statePortalConfigs.stateName);
      
      // Decrypt sensitive fields for admin viewing
      const decryptedConfigs = configs.map(config => ({
        ...config,
        credentials: decryptCredentials(config.credentials as any),
        challengeQuestions: decryptChallengeQuestions(config.challengeQuestions as any),
        mfaSecret: config.mfaSecret ? decrypt(config.mfaSecret) : null,
        mfaBackupCodes: decryptMfaBackupCodes(config.mfaBackupCodes as any),
      }));
      
      res.json(decryptedConfigs);
    } catch (error) {
      console.error("Error fetching state portals:", error);
      res.status(500).json({ error: "Failed to fetch state portals" });
    }
  });

  // ====================================================================
  // SPECIFIC STATE PORTAL ROUTES (must come before parameterized routes)
  // ====================================================================

  // Get state portals that are due for credential rotation
  app.get("/api/admin/state-portals/rotation-due", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { statePortalConfigs } = await import("@shared/schema");
      const { sql } = await import("drizzle-orm");
      
      const now = new Date();
      
      // Get portals that:
      // 1. Have credentials set
      // 2. Either have passed their expiry date OR next rotation is due
      const duePortals = await db
        .select()
        .from(statePortalConfigs)
        .where(
          sql`${statePortalConfigs.credentials} IS NOT NULL 
          AND (
            ${statePortalConfigs.credentialExpiryDate} < ${now}
            OR ${statePortalConfigs.nextRotationDue} < ${now}
          )`
        )
        .orderBy(statePortalConfigs.credentialExpiryDate);

      // Calculate days overdue for each
      const portalsWithStatus = duePortals.map(portal => {
        const expiryDate = portal.credentialExpiryDate || portal.nextRotationDue;
        const daysOverdue = expiryDate 
          ? Math.floor((now.getTime() - new Date(expiryDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        
        return {
          ...portal,
          daysOverdue,
          status: daysOverdue > 0 ? 'overdue' : 'due-soon',
        };
      });
      
      res.json(portalsWithStatus);
    } catch (error) {
      console.error("Error fetching rotation-due portals:", error);
      res.status(500).json({ error: "Failed to fetch rotation-due portals" });
    }
  });

  // Initialize state portal seeds
  app.post("/api/admin/state-portals/seed", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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

  // Encrypt existing plaintext credentials (one-time migration)
  app.post("/api/admin/state-portals/encrypt-credentials", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { statePortalConfigs } = await import("@shared/schema");
      const { encryptCredentials, encryptChallengeQuestions } = await import("./utils/encryption");
      
      const configs = await db.select().from(statePortalConfigs);
      
      let encrypted = 0;
      for (const config of configs) {
        let needsUpdate = false;
        const updates: any = {};
        
        // Check if credentials need encryption (plaintext detection)
        if (config.credentials) {
          const creds = config.credentials as any;
          if (creds.password && !creds.password.includes(':')) {
            updates.credentials = encryptCredentials(creds);
            needsUpdate = true;
          }
        }
        
        // Check if challenge questions need encryption
        if (config.challengeQuestions && Array.isArray(config.challengeQuestions)) {
          const questions = config.challengeQuestions as any;
          if (questions.length > 0 && questions[0].answer && !questions[0].answer.includes(':')) {
            updates.challengeQuestions = encryptChallengeQuestions(questions);
            needsUpdate = true;
          }
        }
        
        if (needsUpdate) {
          await db
            .update(statePortalConfigs)
            .set({
              ...updates,
              updatedAt: new Date(),
            })
            .where(eq(statePortalConfigs.id, config.id));
          encrypted++;
        }
      }
      
      res.json({
        success: true,
        message: `Encrypted credentials for ${encrypted} state(s)`,
        encrypted,
      });
    } catch (error) {
      console.error("Error encrypting credentials:", error);
      res.status(500).json({ error: "Failed to encrypt credentials" });
    }
  });

  // ====================================================================
  // PARAMETERIZED STATE PORTAL ROUTES (must come after specific routes)
  // ====================================================================

  // Get single state portal configuration (with decryption for bot use)
  app.get("/api/admin/state-portals/:stateCode", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { statePortalConfigs } = await import("@shared/schema");
      const { decryptCredentials, decryptChallengeQuestions, decryptMfaBackupCodes, decrypt } = await import("./utils/encryption");
      
      const [config] = await db
        .select()
        .from(statePortalConfigs)
        .where(eq(statePortalConfigs.stateCode, req.params.stateCode));
      
      if (!config) {
        return res.status(404).json({ error: "State portal not found" });
      }

      // Decrypt for bot/admin use
      const decrypted = {
        ...config,
        credentials: decryptCredentials(config.credentials as any),
        challengeQuestions: decryptChallengeQuestions(config.challengeQuestions as any),
        mfaSecret: config.mfaSecret ? decrypt(config.mfaSecret) : null,
        mfaBackupCodes: decryptMfaBackupCodes(config.mfaBackupCodes as any),
      };

      res.json(decrypted);
    } catch (error) {
      console.error("Error fetching state portal:", error);
      res.status(500).json({ error: "Failed to fetch state portal" });
    }
  });

  // Update state portal configuration
  app.patch("/api/admin/state-portals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { statePortalConfigs, updateStatePortalConfigSchema } = await import("@shared/schema");
      const { encryptCredentials, encryptChallengeQuestions, encryptMfaBackupCodes, encrypt } = await import("./utils/encryption");
      
      // Validate input
      const validated = updateStatePortalConfigSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: validated.error.issues 
        });
      }

      // Encrypt sensitive fields before storage
      const dataToUpdate = { ...validated.data };
      if (dataToUpdate.credentials) {
        dataToUpdate.credentials = encryptCredentials(dataToUpdate.credentials);
      }
      if (dataToUpdate.challengeQuestions) {
        dataToUpdate.challengeQuestions = encryptChallengeQuestions(dataToUpdate.challengeQuestions);
      }
      if (dataToUpdate.mfaSecret) {
        dataToUpdate.mfaSecret = encrypt(dataToUpdate.mfaSecret);
      }
      if (dataToUpdate.mfaBackupCodes) {
        dataToUpdate.mfaBackupCodes = encryptMfaBackupCodes(dataToUpdate.mfaBackupCodes as any);
      }

      const [updated] = await db
        .update(statePortalConfigs)
        .set({
          ...dataToUpdate,
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

  // ====================================================================
  // CREDENTIAL ROTATION ENDPOINTS (:id parameterized routes)
  // ====================================================================

  // Rotate credentials for a state portal
  app.post("/api/admin/state-portals/:id/rotate", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { statePortalConfigs, credentialRotationHistory } = await import("@shared/schema");
      const { encryptCredentials, decryptCredentials } = await import("./utils/encryption");
      const crypto = await import("crypto");
      
      const { newCredentials, rotationType, reason } = req.body;
      
      // Validate and trim credentials
      if (!newCredentials || !newCredentials.userId || !newCredentials.password) {
        return res.status(400).json({ error: "New credentials (userId, password) required" });
      }
      
      const trimmedUserId = newCredentials.userId.trim();
      const trimmedPassword = newCredentials.password.trim();
      
      if (!trimmedUserId || !trimmedPassword) {
        return res.status(400).json({ error: "User ID and password cannot be empty or whitespace only" });
      }
      
      if (trimmedUserId.length < 3) {
        return res.status(400).json({ error: "User ID must be at least 3 characters long" });
      }
      
      if (trimmedPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
      }
      
      // Use trimmed values
      newCredentials.userId = trimmedUserId;
      newCredentials.password = trimmedPassword;

      // Get existing portal config
      const [portal] = await db
        .select()
        .from(statePortalConfigs)
        .where(eq(statePortalConfigs.id, req.params.id));

      if (!portal) {
        return res.status(404).json({ error: "State portal not found" });
      }

      // Hash old and new credentials for audit trail (never store plaintext)
      const oldHash = portal.credentials 
        ? crypto.createHash('sha256').update(JSON.stringify(portal.credentials)).digest('hex')
        : null;
      const newHash = crypto.createHash('sha256').update(JSON.stringify(newCredentials)).digest('hex');

      // Encrypt new credentials
      const encryptedCredentials = encryptCredentials(newCredentials);

      // Calculate next rotation date
      const rotationFrequencyDays = portal.rotationFrequencyDays || 90;
      const nextRotationDue = new Date();
      nextRotationDue.setDate(nextRotationDue.getDate() + rotationFrequencyDays);

      // Update portal config
      const [updated] = await db
        .update(statePortalConfigs)
        .set({
          credentials: encryptedCredentials,
          lastRotatedAt: new Date(),
          nextRotationDue,
          credentialExpiryDate: nextRotationDue,
          rotationReminderSentAt: null, // Reset reminder
          updatedAt: new Date(),
        })
        .where(eq(statePortalConfigs.id, req.params.id))
        .returning();

      // Log rotation in history
      await db.insert(credentialRotationHistory).values({
        portalConfigId: req.params.id,
        rotatedBy: userId,
        rotationType: rotationType || 'manual',
        reason: reason || null,
        previousCredentialsHash: oldHash,
        newCredentialsHash: newHash,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        portal: updated,
        nextRotationDue,
        message: `Credentials rotated successfully. Next rotation due: ${nextRotationDue.toLocaleDateString()}`
      });
    } catch (error) {
      console.error("Error rotating credentials:", error);
      res.status(500).json({ error: "Failed to rotate credentials" });
    }
  });

  // Get rotation history for a state portal
  app.get("/api/admin/state-portals/:id/rotation-history", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { credentialRotationHistory, users: usersTable } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      
      const history = await db
        .select({
          id: credentialRotationHistory.id,
          rotatedAt: credentialRotationHistory.rotatedAt,
          rotationType: credentialRotationHistory.rotationType,
          reason: credentialRotationHistory.reason,
          mfaChanged: credentialRotationHistory.mfaChanged,
          rotatedByUser: {
            id: usersTable.id,
            email: usersTable.email,
            firstName: usersTable.firstName,
            lastName: usersTable.lastName,
          }
        })
        .from(credentialRotationHistory)
        .leftJoin(usersTable, eq(credentialRotationHistory.rotatedBy, usersTable.id))
        .where(eq(credentialRotationHistory.portalConfigId, req.params.id))
        .orderBy(desc(credentialRotationHistory.rotatedAt))
        .limit(50);

      res.json(history);
    } catch (error) {
      console.error("Error fetching rotation history:", error);
      res.status(500).json({ error: "Failed to fetch rotation history" });
    }
  });

  // Set rotation schedule for a state portal
  app.post("/api/admin/state-portals/:id/set-rotation-schedule", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { statePortalConfigs } = await import("@shared/schema");
      const { rotationFrequencyDays, credentialExpiryDate } = req.body;
      
      if (!rotationFrequencyDays || rotationFrequencyDays < 1 || rotationFrequencyDays > 365) {
        return res.status(400).json({ error: "Rotation frequency must be between 1 and 365 days" });
      }

      // Calculate next rotation date if not manually set
      let nextRotationDue = credentialExpiryDate ? new Date(credentialExpiryDate) : null;
      if (!nextRotationDue) {
        const [portal] = await db
          .select()
          .from(statePortalConfigs)
          .where(eq(statePortalConfigs.id, req.params.id));
        
        const lastRotation = portal.lastRotatedAt || portal.createdAt || new Date();
        nextRotationDue = new Date(lastRotation);
        nextRotationDue.setDate(nextRotationDue.getDate() + rotationFrequencyDays);
      }

      const [updated] = await db
        .update(statePortalConfigs)
        .set({
          rotationFrequencyDays,
          credentialExpiryDate,
          nextRotationDue,
          updatedAt: new Date(),
        })
        .where(eq(statePortalConfigs.id, req.params.id))
        .returning();

      res.json({
        success: true,
        portal: updated,
        message: `Rotation schedule updated. Next rotation: ${nextRotationDue.toLocaleDateString()}`
      });
    } catch (error) {
      console.error("Error setting rotation schedule:", error);
      res.status(500).json({ error: "Failed to set rotation schedule" });
    }
  });

  // Get state submission jobs for employer
  app.get("/api/employer/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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

  // Trigger automated bulk submission for employer
  app.post("/api/admin/submissions/trigger", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuth(req).userId!;
      const user = await getUserByClerkId(userId);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { employerId, stateCode } = req.body;
      
      if (!employerId || !stateCode) {
        return res.status(400).json({ error: "employerId and stateCode required" });
      }

      const { stateSubmissionJobs } = await import("@shared/schema");
      
      // Create new submission job
      const [job] = await db
        .insert(stateSubmissionJobs)
        .values({
          employerId,
          stateCode: stateCode.toUpperCase(),
          status: 'pending',
          recordCount: 0,
          submittedBy: userId,
        })
        .returning();

      // Trigger background processing (async - don't await)
      const { processSubmissionJob } = await import('./workers/submissionProcessor');
      processSubmissionJob(job.id).catch(err => {
        console.error('Background job processing failed:', err);
      });
      
      res.json({
        success: true,
        message: 'Submission job queued and processing started',
        jobId: job.id,
      });
    } catch (error) {
      console.error("Error triggering submission:", error);
      res.status(500).json({ error: "Failed to trigger submission" });
    }
  });

  // Get submission job status
  app.get("/api/admin/submissions/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { stateSubmissionJobs } = await import("@shared/schema");
      const [job] = await db
        .select()
        .from(stateSubmissionJobs)
        .where(eq(stateSubmissionJobs.id, req.params.jobId));

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ error: "Failed to fetch job" });
    }
  });

  // Get all submission jobs (admin)
  app.get("/api/admin/submissions", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
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

  // Get submission metrics for monitoring dashboard
  app.get("/api/admin/submissions/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { getSubmissionMetrics } = await import('./utils/submissionAnalytics');
      
      // Parse date filters from query params
      let startDate: Date | undefined;
      let endDate: Date | undefined;
      
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
      }

      const metrics = await getSubmissionMetrics(startDate, endDate);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching submission metrics:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // Get submission anomalies for alerts
  app.get("/api/admin/submissions/anomalies", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { detectAnomalies } = await import('./utils/submissionAnalytics');
      const anomalies = await detectAnomalies();
      
      res.json(anomalies);
    } catch (error) {
      console.error("Error detecting anomalies:", error);
      res.status(500).json({ error: "Failed to detect anomalies" });
    }
  });

  // Get detailed job list with filters
  app.get("/api/admin/submissions/jobs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { getJobDetails } = await import('./utils/submissionAnalytics');
      
      const jobs = await getJobDetails(
        req.query.status as string | undefined,
        req.query.stateCode as string | undefined,
        req.query.employerId as string | undefined,
        req.query.limit ? parseInt(req.query.limit as string) : 50
      );
      
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching job details:", error);
      res.status(500).json({ error: "Failed to fetch job details" });
    }
  });

  // Parse determination letter with OCR
  app.post("/api/admin/determination-letters/parse", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { fileBase64, stateCode, mimeType } = req.body;
      
      if (!fileBase64 || !stateCode) {
        return res.status(400).json({ error: "fileBase64 and stateCode required" });
      }

      const { parseDeterminationLetter, validateParsedLetter } = await import('./utils/ocrParser');
      
      const parsed = await parseDeterminationLetter(fileBase64, stateCode, mimeType || 'image/jpeg');
      const validation = validateParsedLetter(parsed);

      res.json({
        parsed,
        validation,
      });
    } catch (error) {
      console.error("Error parsing determination letter:", error);
      res.status(500).json({ error: "Failed to parse determination letter" });
    }
  });

  // Store parsed determination letter
  app.post("/api/admin/determination-letters", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { employerId, employeeId, stateCode, parsedData, fileUrl, fileName } = req.body;
      
      if (!employerId || !stateCode || !parsedData) {
        return res.status(400).json({ error: "employerId, stateCode, and parsedData required" });
      }

      const { determinationLetters } = await import("@shared/schema");
      
      const [letter] = await db
        .insert(determinationLetters)
        .values({
          employerId,
          employeeId: employeeId || null,
          stateCode,
          status: parsedData.determinationStatus || 'pending',
          certificationNumber: parsedData.certificationNumber || null,
          creditAmount: parsedData.creditAmount || null,
          parsedData,
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          processedAt: new Date(),
        })
        .returning();

      res.json(letter);
    } catch (error) {
      console.error("Error storing determination letter:", error);
      res.status(500).json({ error: "Failed to store determination letter" });
    }
  });

  // Get determination letters
  app.get("/api/admin/determination-letters", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { determinationLetters } = await import("@shared/schema");
      const letters = await db
        .select()
        .from(determinationLetters)
        .orderBy(desc(determinationLetters.createdAt))
        .limit(500);

      res.json(letters);
    } catch (error) {
      console.error("Error fetching determination letters:", error);
      res.status(500).json({ error: "Failed to fetch determination letters" });
    }
  });

  // ============================================================================
  // STATE PORTAL RPA - CREDENTIAL TESTING & DETERMINATION CAPTURE
  // ============================================================================

  app.post("/api/admin/state-portal/test-credentials", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { stateCode } = req.body;
      if (!stateCode) {
        return res.status(400).json({ error: "stateCode required" });
      }

      const { statePortalConfigs } = await import("@shared/schema");
      const [portalConfig] = await db
        .select()
        .from(statePortalConfigs)
        .where(eq(statePortalConfigs.stateCode, stateCode.toUpperCase()));

      if (!portalConfig) {
        return res.status(404).json({ error: `No portal config found for ${stateCode}` });
      }

      const { createBot } = await import('./utils/playwrightBot');
      const bot = await createBot();
      try {
        const result = await bot.testCredentials(portalConfig);
        res.json(result);
      } finally {
        await bot.close();
      }
    } catch (error: any) {
      console.error("Error testing credentials:", error);
      res.status(500).json({ error: "Failed to test credentials", details: error?.message });
    }
  });

  app.post("/api/admin/state-portal/capture-determinations", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { stateCode } = req.body;
      if (!stateCode) {
        return res.status(400).json({ error: "stateCode required" });
      }

      const { statePortalConfigs } = await import("@shared/schema");
      const [portalConfig] = await db
        .select()
        .from(statePortalConfigs)
        .where(eq(statePortalConfigs.stateCode, stateCode.toUpperCase()));

      if (!portalConfig) {
        return res.status(404).json({ error: `No portal config found for ${stateCode}` });
      }

      const { createBot } = await import('./utils/playwrightBot');
      const bot = await createBot();
      try {
        const result = await bot.captureDeterminations(portalConfig);

        if (result.success && result.determinations && result.determinations.length > 0) {
          const { screenings, employees } = await import("@shared/schema");

          let updated = 0;
          for (const det of result.determinations) {
            try {
              const [emp] = await db
                .select()
                .from(employees)
                .where(eq(employees.ssn, det.ssn))
                .limit(1);

              if (emp) {
                const detStatus = det.status.toLowerCase().includes('certif') ? 'certified'
                  : det.status.toLowerCase().includes('denied') ? 'denied'
                  : 'pending';

                await db
                  .update(screenings)
                  .set({
                    status: detStatus,
                    updatedAt: new Date(),
                  })
                  .where(eq(screenings.employeeId, emp.id));
                updated++;
              }
            } catch (detErr) {
              console.error(`Failed to update determination for SSN ${det.ssn}:`, detErr);
            }
          }

          res.json({
            ...result,
            updatedRecords: updated,
          });
        } else {
          res.json(result);
        }
      } finally {
        await bot.close();
      }
    } catch (error: any) {
      console.error("Error capturing determinations:", error);
      res.status(500).json({ error: "Failed to capture determinations", details: error?.message });
    }
  });

  app.post("/api/admin/state-portal/generate-csv-preview", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { stateCode, employerId, limit: maxRecords } = req.body;
      if (!stateCode || !employerId) {
        return res.status(400).json({ error: "stateCode and employerId required" });
      }

      const recordLimit = Math.min(maxRecords || 998, 998);
      const { employees: employeesTable, screenings: screeningsTable, employers: employersTable } = await import("@shared/schema");

      const empRows = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.employerId, employerId))
        .limit(recordLimit);

      const screeningRows = await db
        .select()
        .from(screeningsTable)
        .where(
          and(
            eq(screeningsTable.employerId, employerId),
            or(
              eq(screeningsTable.status, 'eligible'),
              eq(screeningsTable.status, 'completed'),
              eq(screeningsTable.status, 'certified')
            )
          )
        );

      const empById = new Map(empRows.map((e: any) => [e.id, e]));

      const [employer] = await db
        .select()
        .from(employersTable)
        .where(eq(employersTable.id, employerId));

      if (!employer) {
        return res.status(404).json({ error: "Employer not found" });
      }

      const records = screeningRows
        .filter(s => empById.has(s.employeeId))
        .map(s => ({
          employee: empById.get(s.employeeId)!,
          screening: s,
          employerEin: employer.ein || '',
          employerName: employer.name,
          consultantEin: '861505473',
        }));

      if (records.length === 0) {
        return res.json({ csvPreview: '', recordCount: 0, message: 'No eligible records found' });
      }

      const { generateTexasCSV } = await import('./utils/texasCsvGenerator');
      const csv = generateTexasCSV(records, '861505473');
      const lines = csv.split('\n');

      res.json({
        csvPreview: lines.slice(0, 6).join('\n'),
        recordCount: lines.length - 1,
        fullCsv: csv,
      });
    } catch (error: any) {
      console.error("Error generating CSV preview:", error);
      res.status(500).json({ error: "Failed to generate CSV preview", details: error?.message });
    }
  });

  app.get("/api/admin/state-portal/orchestrator-status", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { getOrchestratorStatus } = await import('./utils/submissionOrchestrator');
      res.json(getOrchestratorStatus());
    } catch (error: any) {
      console.error("Error getting orchestrator status:", error);
      res.status(500).json({ error: "Failed to get orchestrator status" });
    }
  });

  // ============================================================================
  // CSDC SFTP AUTOMATION (AL, AR, CO, GA, ID, OK, OR, SC, VT, WV)
  // ============================================================================

  app.post("/api/admin/csdc/test-connection", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "SFTP username and password required" });
      }

      const { testCsdcConnection } = await import('./utils/csdcSftpClient');
      const result = await testCsdcConnection({ host: 'hermes.csdco.com', port: 22, username, password });
      res.json(result);
    } catch (error: any) {
      console.error("Error testing CSDC connection:", error);
      res.status(500).json({ error: "Failed to test connection", details: error?.message });
    }
  });

  app.post("/api/admin/csdc/generate-file", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { stateCode, employerId } = req.body;
      if (!stateCode || !employerId) {
        return res.status(400).json({ error: "stateCode and employerId required" });
      }

      const { generateCsdcFile, generateCsdcPreview, getCsdcSupportedStates } = await import('./utils/csdcFileGenerator');
      const supportedStates = getCsdcSupportedStates();
      const upper = stateCode.toUpperCase();

      if (!supportedStates.includes(upper)) {
        return res.status(400).json({ error: `State ${stateCode} is not a CSDC state. Supported: ${supportedStates.join(', ')}` });
      }

      const { employees: employeesTable, screenings: screeningsTable, employers: employersTable } = await import("@shared/schema");

      const [employer] = await db
        .select()
        .from(employersTable)
        .where(eq(employersTable.id, employerId));

      if (!employer) {
        return res.status(404).json({ error: "Employer not found" });
      }

      const empRows = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.employerId, employerId));

      const screeningRows = await db
        .select()
        .from(screeningsTable)
        .where(
          and(
            eq(screeningsTable.employerId, employerId),
            or(
              eq(screeningsTable.status, 'eligible'),
              eq(screeningsTable.status, 'completed'),
              eq(screeningsTable.status, 'certified')
            )
          )
        );

      const empById = new Map(empRows.map((e: any) => [e.id, e]));

      const records = screeningRows
        .filter((s: any) => empById.has(s.employeeId))
        .map((s: any) => ({
          employee: empById.get(s.employeeId)!,
          screening: s,
          employerEin: employer.ein || '',
          employerName: employer.name,
        }));

      if (records.length === 0) {
        return res.json({ preview: '', recordCount: 0, message: 'No eligible records found for this state' });
      }

      const preview = generateCsdcPreview(records, upper);
      const fullContent = generateCsdcFile(records, upper);

      res.json({
        ...preview,
        fullContent,
      });
    } catch (error: any) {
      console.error("Error generating CSDC file:", error);
      res.status(500).json({ error: "Failed to generate file", details: error?.message });
    }
  });

  app.post("/api/admin/csdc/upload", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { stateCode, employerId, username, password } = req.body;
      if (!stateCode || !employerId || !username || !password) {
        return res.status(400).json({ error: "stateCode, employerId, username, and password required" });
      }

      const { generateCsdcFile, getCsdcSupportedStates } = await import('./utils/csdcFileGenerator');
      const supportedStates = getCsdcSupportedStates();
      const upper = stateCode.toUpperCase();

      if (!supportedStates.includes(upper)) {
        return res.status(400).json({ error: `State ${stateCode} is not a CSDC state` });
      }

      const { employees: employeesTable, screenings: screeningsTable, employers: employersTable } = await import("@shared/schema");

      const [employer] = await db
        .select()
        .from(employersTable)
        .where(eq(employersTable.id, employerId));

      if (!employer) {
        return res.status(404).json({ error: "Employer not found" });
      }

      const empRows = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.employerId, employerId));

      const screeningRows = await db
        .select()
        .from(screeningsTable)
        .where(
          and(
            eq(screeningsTable.employerId, employerId),
            or(
              eq(screeningsTable.status, 'eligible'),
              eq(screeningsTable.status, 'completed'),
              eq(screeningsTable.status, 'certified')
            )
          )
        );

      const empById = new Map(empRows.map((e: any) => [e.id, e]));

      const records = screeningRows
        .filter((s: any) => empById.has(s.employeeId))
        .map((s: any) => ({
          employee: empById.get(s.employeeId)!,
          screening: s,
          employerEin: employer.ein || '',
          employerName: employer.name,
        }));

      if (records.length === 0) {
        return res.json({ success: false, message: 'No eligible records found' });
      }

      const fileContent = generateCsdcFile(records, upper);
      const { uploadCsdcFile } = await import('./utils/csdcSftpClient');
      const result = await uploadCsdcFile(
        { host: 'hermes.csdco.com', port: 22, username, password },
        upper,
        fileContent
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error uploading CSDC file:", error);
      res.status(500).json({ error: "Failed to upload file", details: error?.message });
    }
  });

  app.post("/api/admin/csdc/upload-all", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { employerId, username, password } = req.body;
      if (!employerId || !username || !password) {
        return res.status(400).json({ error: "employerId, username, and password required" });
      }

      const { generateCsdcFile, getCsdcSupportedStates } = await import('./utils/csdcFileGenerator');
      const { uploadMultipleCsdcFiles } = await import('./utils/csdcSftpClient');
      const { employees: employeesTable, screenings: screeningsTable, employers: employersTable } = await import("@shared/schema");

      const [employer] = await db
        .select()
        .from(employersTable)
        .where(eq(employersTable.id, employerId));

      if (!employer) {
        return res.status(404).json({ error: "Employer not found" });
      }

      const empRows = await db
        .select()
        .from(employeesTable)
        .where(eq(employeesTable.employerId, employerId));

      const screeningRows = await db
        .select()
        .from(screeningsTable)
        .where(
          and(
            eq(screeningsTable.employerId, employerId),
            or(
              eq(screeningsTable.status, 'eligible'),
              eq(screeningsTable.status, 'completed'),
              eq(screeningsTable.status, 'certified')
            )
          )
        );

      const empById = new Map(empRows.map((e: any) => [e.id, e]));
      const supportedStates = getCsdcSupportedStates();
      const files: Array<{ stateAbbr: string; content: string }> = [];

      for (const stateAbbr of supportedStates) {
        const stateRecords = screeningRows
          .filter((s: any) => {
            const emp = empById.get(s.employeeId);
            if (!emp) return false;
            const empState = (emp.state || '').trim();
            const stateUpper = empState.length === 2 ? empState.toUpperCase() : '';
            return stateUpper === stateAbbr;
          })
          .map((s: any) => ({
            employee: empById.get(s.employeeId)!,
            screening: s,
            employerEin: employer.ein || '',
            employerName: employer.name,
          }));

        if (stateRecords.length > 0) {
          const content = generateCsdcFile(stateRecords, stateAbbr);
          files.push({ stateAbbr, content });
        }
      }

      if (files.length === 0) {
        return res.json({ success: false, message: 'No eligible records found for any CSDC state', results: [] });
      }

      const results = await uploadMultipleCsdcFiles(
        { host: 'hermes.csdco.com', port: 22, username, password },
        files
      );

      res.json({
        success: results.every(r => r.success),
        totalStates: files.length,
        totalRecords: results.reduce((sum, r) => sum + r.recordCount, 0),
        results,
      });
    } catch (error: any) {
      console.error("Error in bulk CSDC upload:", error);
      res.status(500).json({ error: "Failed to upload files", details: error?.message });
    }
  });

  app.post("/api/admin/csdc/download-determinations", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { stateCode, username, password } = req.body;
      if (!stateCode || !username || !password) {
        return res.status(400).json({ error: "stateCode, username, and password required" });
      }

      const { downloadCsdcDeterminations } = await import('./utils/csdcSftpClient');
      const result = await downloadCsdcDeterminations(
        { host: 'hermes.csdco.com', port: 22, username, password },
        stateCode
      );

      res.json(result);
    } catch (error: any) {
      console.error("Error downloading determinations:", error);
      res.status(500).json({ error: "Failed to download determinations", details: error?.message });
    }
  });

  app.get("/api/admin/csdc/supported-states", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { getCsdcSupportedStates, getCsdcFileName, getCsdcRemotePath, getCsdcStateDefaults } = await import('./utils/csdcFileGenerator');
      const states = getCsdcSupportedStates();
      const stateDetails = states.map(st => ({
        stateCode: st,
        fileName: getCsdcFileName(st),
        remotePath: getCsdcRemotePath(st),
        config: getCsdcStateDefaults(st),
      }));

      res.json({ states: stateDetails, sftpHost: 'hermes.csdco.com' });
    } catch (error: any) {
      console.error("Error getting CSDC states:", error);
      res.status(500).json({ error: "Failed to get supported states" });
    }
  });

  // ============================================================================
  // CERTLINK AUTOMATION (AZ, IL, KS, ME)
  // ============================================================================

  app.get("/api/admin/certlink/supported-states", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuth(req).userId!;
      const user = await getUserByClerkId(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { getCertLinkSupportedStates, getCertLinkPortalUrl, CERTLINK_STATES } = await import('./utils/certlinkCsvGenerator');
      const states = getCertLinkSupportedStates();
      const stateDetails = states.map(st => ({
        stateCode: st,
        portalUrl: getCertLinkPortalUrl(st),
        signatorCandidates: CERTLINK_STATES[st]?.signatorCandidates || [],
        defaultSignator: CERTLINK_STATES[st]?.defaultSignator || '',
        provider: 'certlink',
      }));

      res.json({ states: stateDetails });
    } catch (error: any) {
      console.error("Error getting CertLink states:", error);
      res.status(500).json({ error: "Failed to get CertLink states" });
    }
  });

  app.post("/api/admin/certlink/generate-csv", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuth(req).userId!;
      const user = await getUserByClerkId(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { stateCode, records } = req.body;
      if (!stateCode || !records || !Array.isArray(records)) {
        return res.status(400).json({ error: "stateCode and records array required" });
      }

      const { generateCertLinkCSV, isCertLinkState } = await import('./utils/certlinkCsvGenerator');

      if (!isCertLinkState(stateCode)) {
        return res.status(400).json({ error: `${stateCode} is not a CertLink state. Supported: AZ, IL, KS, ME` });
      }

      const csvContent = generateCertLinkCSV(records, stateCode);
      const rowCount = csvContent.split('\n').length - 1;

      res.json({
        success: true,
        stateCode,
        rowCount,
        preview: csvContent.split('\n').slice(0, 3).join('\n'),
        csvContent,
      });
    } catch (error: any) {
      console.error("Error generating CertLink CSV:", error);
      res.status(500).json({ error: error.message || "Failed to generate CertLink CSV" });
    }
  });

  app.post("/api/admin/certlink/submit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuth(req).userId!;
      const user = await getUserByClerkId(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { stateCode, csvContent, portalUrl, credentials } = req.body;
      if (!stateCode || !csvContent) {
        return res.status(400).json({ error: "stateCode and csvContent required" });
      }

      if (!credentials?.email || !credentials?.password) {
        return res.status(400).json({ error: "Portal credentials (email, password) required" });
      }

      const { isCertLinkState, getCertLinkPortalUrl } = await import('./utils/certlinkCsvGenerator');
      if (!isCertLinkState(stateCode)) {
        return res.status(400).json({ error: `${stateCode} is not a CertLink state` });
      }

      const { CertLinkBot } = await import('./utils/certlinkBot');
      const bot = new CertLinkBot();

      try {
        await bot.initialize();
        const url = portalUrl || getCertLinkPortalUrl(stateCode);
        const result = await bot.runState(url, credentials, csvContent, stateCode, stateCode);
        res.json(result);
      } finally {
        await bot.close();
      }
    } catch (error: any) {
      console.error("Error submitting to CertLink:", error);
      res.status(500).json({ error: error.message || "CertLink submission failed" });
    }
  });

  app.post("/api/admin/certlink/submit-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuth(req).userId!;
      const user = await getUserByClerkId(userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { stateJobs } = req.body;
      if (!stateJobs || !Array.isArray(stateJobs) || stateJobs.length === 0) {
        return res.status(400).json({ error: "stateJobs array required with entries: { stateCode, stateName, portalUrl, credentials, csvContent }" });
      }

      const { CertLinkBot } = await import('./utils/certlinkBot');
      const bot = new CertLinkBot();

      try {
        await bot.initialize();
        const results = await bot.runAllStates(stateJobs);
        res.json({ results });
      } finally {
        await bot.close();
      }
    } catch (error: any) {
      console.error("Error in CertLink batch submission:", error);
      res.status(500).json({ error: error.message || "CertLink batch submission failed" });
    }
  });

  // ============================================================================
  // PHASE 5: AI PREDICTION, QUESTIONNAIRE OPTIMIZATION & CREDIT FORECASTING
  // ============================================================================

  // Generate credit forecast for an employer
  app.post("/api/employer/credit-forecast", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getAuth(req).userId!;
      const user = await getUserByClerkId(userId);
      
      if (!user || !user.employerId) {
        return res.status(403).json({ error: "Employer access required" });
      }

      const { timeframeMonths, currentPipelineCount } = req.body;

      const { generateCreditForecast } = await import("./utils/creditForecasting");
      const forecast = await generateCreditForecast({
        employerId: user.employerId,
        timeframeMonths,
        currentPipelineCount,
      });

      // Store forecast in database
      const { creditForecasts } = await import("@shared/schema");
      const [storedForecast] = await db
        .insert(creditForecasts)
        .values({
          employerId: user.employerId,
          forecastType: "employer_projection",
          timeframeDays: (timeframeMonths || 12) * 30,
          projectedCredits: forecast.estimatedTotalCredits.toString(),
          projectedCertifications: forecast.projectedCertifications,
          confidence: forecast.confidenceLevel,
          calculatedBy: userId,
          forecastData: forecast as any,
        })
        .returning();

      res.json({
        forecast,
        storedForecast,
      });
    } catch (error) {
      console.error("Error generating credit forecast:", error);
      res.status(500).json({ error: "Failed to generate credit forecast" });
    }
  });

  // Get monthly projection trend
  app.get("/api/employer/credit-forecast/trend", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || !user.employerId) {
        return res.status(403).json({ error: "Employer access required" });
      }

      const months = parseInt(req.query.months as string) || 12;

      const { getMonthlyProjectionTrend } = await import("./utils/creditForecasting");
      const trend = await getMonthlyProjectionTrend(user.employerId, months);

      res.json({ trend });
    } catch (error) {
      console.error("Error fetching projection trend:", error);
      res.status(500).json({ error: "Failed to fetch projection trend" });
    }
  });

  // Admin: System-wide credit forecast
  app.get("/api/admin/credit-forecast/system-wide", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { generateSystemWideForecast } = await import("./utils/creditForecasting");
      const forecast = await generateSystemWideForecast();

      res.json(forecast);
    } catch (error) {
      console.error("Error generating system-wide forecast:", error);
      res.status(500).json({ error: "Failed to generate system-wide forecast" });
    }
  });

  // Admin: Get all stored forecasts
  app.get("/api/admin/credit-forecasts", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { creditForecasts } = await import("@shared/schema");
      const forecasts = await db
        .select()
        .from(creditForecasts)
        .orderBy(desc(creditForecasts.createdAt))
        .limit(100);

      res.json(forecasts);
    } catch (error) {
      console.error("Error fetching credit forecasts:", error);
      res.status(500).json({ error: "Failed to fetch credit forecasts" });
    }
  });

  // ============================================================================
  // AI PREDICTION & QUESTIONNAIRE OPTIMIZATION ROUTES
  // ============================================================================

  // Simplify a questionnaire question in real-time
  app.post("/api/questionnaire/simplify-question", isAuthenticated, async (req: any, res) => {
    try {
      const { question, targetLanguage, readabilityTarget, context } = req.body;
      
      if (!question) {
        return res.status(400).json({ error: "question is required" });
      }

      const { simplifyQuestion } = await import("./utils/questionnaireOptimization");
      const result = await simplifyQuestion({
        question,
        targetLanguage,
        readabilityTarget,
        context,
      });

      res.json(result);
    } catch (error) {
      console.error("Error simplifying question:", error);
      res.status(500).json({ error: "Failed to simplify question" });
    }
  });

  // Translate question to Spanish
  app.post("/api/questionnaire/translate-spanish", isAuthenticated, async (req: any, res) => {
    try {
      const { question, context } = req.body;
      
      if (!question) {
        return res.status(400).json({ error: "question is required" });
      }

      const { translateToSpanish } = await import("./utils/questionnaireOptimization");
      const translation = await translateToSpanish(question, context);

      res.json({ translation });
    } catch (error) {
      console.error("Error translating question:", error);
      res.status(500).json({ error: "Failed to translate question" });
    }
  });

  // Batch simplify multiple questions
  app.post("/api/questionnaire/batch-simplify", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { questions } = req.body;
      
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "questions array is required" });
      }

      // Validate that each item is a proper SimplificationRequest object
      const invalidQuestions = questions.filter(
        (q: any) => typeof q !== 'object' || !q.question || typeof q.question !== 'string'
      );
      
      if (invalidQuestions.length > 0) {
        return res.status(400).json({
          error: "Each question must be an object with a 'question' string field",
        });
      }

      const { batchSimplifyQuestions } = await import("./utils/questionnaireOptimization");
      const results = await batchSimplifyQuestions(questions);

      res.json({ results });
    } catch (error) {
      console.error("Error batch simplifying questions:", error);
      res.status(500).json({ error: "Failed to batch simplify questions" });
    }
  });

  // Analyze questionnaire readability
  app.post("/api/questionnaire/analyze-readability", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { questions, targetGrade } = req.body;
      
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "questions array is required" });
      }

      const { analyzeQuestionnaireReadability } = await import("./utils/questionnaireOptimization");
      const analysis = analyzeQuestionnaireReadability(questions, targetGrade);

      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing readability:", error);
      res.status(500).json({ error: "Failed to analyze readability" });
    }
  });

  // Track question simplification (store in database)
  app.post("/api/questionnaire/track-simplification", isAuthenticated, async (req: any, res) => {
    try {
      const {
        employeeId,
        questionnaireResponseId,
        questionId,
        originalQuestion,
        simplifiedQuestion,
        targetLanguage,
        readabilityScoreOriginal,
        readabilityScoreSimplified,
        simplificationReason,
        employeeRequested,
      } = req.body;

      if (!questionId || !originalQuestion || !simplifiedQuestion) {
        return res.status(400).json({
          error: "questionId, originalQuestion, and simplifiedQuestion are required",
        });
      }

      const { aiQuestionnaireSimplifications } = await import("@shared/schema");
      const [tracked] = await db
        .insert(aiQuestionnaireSimplifications)
        .values({
          employeeId: employeeId || null,
          questionnaireResponseId: questionnaireResponseId || null,
          questionId,
          originalQuestion,
          simplifiedQuestion,
          targetLanguage: targetLanguage || "en",
          readabilityScoreOriginal: readabilityScoreOriginal || null,
          readabilityScoreSimplified: readabilityScoreSimplified || null,
          simplificationReason: simplificationReason || "user_requested",
          employeeRequested: employeeRequested || false,
        })
        .returning();

      res.json(tracked);
    } catch (error) {
      console.error("Error tracking simplification:", error);
      res.status(500).json({ error: "Failed to track simplification" });
    }
  });

  // Get simplification statistics
  app.get("/api/admin/questionnaire/simplification-stats", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { aiQuestionnaireSimplifications } = await import("@shared/schema");
      
      const stats = await db
        .select({
          totalSimplifications: sql<number>`COUNT(*)`,
          employeeRequested: sql<number>`COUNT(CASE WHEN ${aiQuestionnaireSimplifications.employeeRequested} = true THEN 1 END)`,
          averageReadabilityImprovement: sql<number>`AVG(
            ${aiQuestionnaireSimplifications.readabilityScoreOriginal} - 
            ${aiQuestionnaireSimplifications.readabilityScoreSimplified}
          )`,
          spanishTranslations: sql<number>`COUNT(CASE WHEN ${aiQuestionnaireSimplifications.targetLanguage} = 'es' THEN 1 END)`,
        })
        .from(aiQuestionnaireSimplifications);

      res.json(stats[0] || {});
    } catch (error) {
      console.error("Error fetching simplification stats:", error);
      res.status(500).json({ error: "Failed to fetch simplification statistics" });
    }
  });

  // Generate AI eligibility prediction for an employee
  app.post("/api/admin/ai/predict-eligibility", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { employeeId, questionnaireResponseId } = req.body;
      
      if (!employeeId) {
        return res.status(400).json({ error: "employeeId is required" });
      }

      // Fetch employee data
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId));
      
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Fetch questionnaire response if provided
      let questionnaireResponse;
      if (questionnaireResponseId) {
        [questionnaireResponse] = await db
          .select()
          .from(questionnaireResponses)
          .where(eq(questionnaireResponses.id, questionnaireResponseId));
      }

      // Generate prediction using AI
      const { predictWotcEligibility } = await import("./utils/aiPrediction");
      const prediction = await predictWotcEligibility({
        employee,
        questionnaireResponse,
      });

      // Store prediction in database
      const { aiEligibilityPredictions } = await import("@shared/schema");
      const [storedPrediction] = await db
        .insert(aiEligibilityPredictions)
        .values({
          employeeId: employee.id,
          employerId: employee.employerId,
          screeningId: null, // Can be linked later
          eligibilityScore: prediction.eligibilityScore,
          confidence: prediction.confidence,
          predictedTargetGroups: prediction.predictedTargetGroups,
          primaryPredictedGroup: prediction.primaryPredictedGroup,
          reasons: prediction.reasons,
          factorsAnalyzed: prediction.factorsAnalyzed,
          modelVersion: prediction.modelVersion,
          promptTokens: prediction.promptTokens,
          completionTokens: prediction.completionTokens,
          predictionLatencyMs: prediction.predictionLatencyMs,
        })
        .returning();

      res.json({
        prediction: storedPrediction,
        ...prediction,
      });
    } catch (error) {
      console.error("Error generating AI prediction:", error);
      res.status(500).json({ error: "Failed to generate AI prediction" });
    }
  });

  // Get AI predictions for an employee
  app.get("/api/admin/ai/predictions/:employeeId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { employeeId } = req.params;
      const { aiEligibilityPredictions } = await import("@shared/schema");
      
      const predictions = await db
        .select()
        .from(aiEligibilityPredictions)
        .where(eq(aiEligibilityPredictions.employeeId, employeeId))
        .orderBy(desc(aiEligibilityPredictions.createdAt));

      res.json(predictions);
    } catch (error) {
      console.error("Error fetching AI predictions:", error);
      res.status(500).json({ error: "Failed to fetch AI predictions" });
    }
  });

  // Validate prediction accuracy (compare AI prediction vs actual result)
  app.post("/api/admin/ai/validate-prediction/:predictionId", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { predictionId } = req.params;
      const { actualResult, actualTargetGroup } = req.body;
      
      if (!actualResult) {
        return res.status(400).json({ error: "actualResult is required" });
      }

      const { aiEligibilityPredictions } = await import("@shared/schema");
      
      // Fetch the prediction
      const [prediction] = await db
        .select()
        .from(aiEligibilityPredictions)
        .where(eq(aiEligibilityPredictions.id, predictionId));
      
      if (!prediction) {
        return res.status(404).json({ error: "Prediction not found" });
      }

      // Determine if prediction was accurate
      const predictionAccurate = 
        (actualResult === 'certified' && prediction.eligibilityScore >= 70) ||
        (actualResult === 'not_eligible' && prediction.eligibilityScore < 30) ||
        (actualTargetGroup === prediction.primaryPredictedGroup);

      // Update prediction with actual results
      const [updated] = await db
        .update(aiEligibilityPredictions)
        .set({
          actualResult,
          actualTargetGroup,
          predictionAccurate,
          validatedAt: new Date(),
        })
        .where(eq(aiEligibilityPredictions.id, predictionId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error validating prediction:", error);
      res.status(500).json({ error: "Failed to validate prediction" });
    }
  });

  // Get AI prediction accuracy statistics
  app.get("/api/admin/ai/stats", isAuthenticated, async (req: any, res) => {
    try {
      const user = await getUserByClerkId(getAuth(req).userId!);
      
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { aiEligibilityPredictions } = await import("@shared/schema");
      
      // Get prediction statistics
      const stats = await db
        .select({
          totalPredictions: sql<number>`COUNT(*)`,
          validatedPredictions: sql<number>`COUNT(CASE WHEN ${aiEligibilityPredictions.validatedAt} IS NOT NULL THEN 1 END)`,
          accuratePredictions: sql<number>`COUNT(CASE WHEN ${aiEligibilityPredictions.predictionAccurate} = true THEN 1 END)`,
          averageEligibilityScore: sql<number>`AVG(${aiEligibilityPredictions.eligibilityScore})`,
          averageLatencyMs: sql<number>`AVG(${aiEligibilityPredictions.predictionLatencyMs})`,
          totalPromptTokens: sql<number>`SUM(${aiEligibilityPredictions.promptTokens})`,
          totalCompletionTokens: sql<number>`SUM(${aiEligibilityPredictions.completionTokens})`,
        })
        .from(aiEligibilityPredictions);

      const [statistics] = stats;

      // Calculate accuracy rate
      const accuracyRate = statistics.validatedPredictions > 0
        ? (statistics.accuratePredictions / statistics.validatedPredictions) * 100
        : 0;

      res.json({
        ...statistics,
        accuracyRate: Math.round(accuracyRate * 100) / 100,
      });
    } catch (error) {
      console.error("Error fetching AI stats:", error);
      res.status(500).json({ error: "Failed to fetch AI statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
