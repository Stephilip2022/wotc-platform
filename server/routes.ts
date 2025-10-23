import type { Express } from "express";
import { createServer, type Server } from "http";
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
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./replitAuth";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
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
      const userId = req.user.claims.sub;
      const { questionnaireId, responses } = req.body;
      
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      const [employee] = await db
        .select()
        .from(employees)
        .where(eq(employees.userId, userId));
      
      if (!employee) {
        return res.status(400).json({ error: "Employee not found" });
      }

      // Mark as completed
      await db
        .update(questionnaireResponses)
        .set({
          responses,
          isCompleted: true,
          completionPercentage: 100,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(questionnaireResponses.employeeId, employee.id),
            eq(questionnaireResponses.questionnaireId, questionnaireId)
          )
        );

      // Update employee status
      await db
        .update(employees)
        .set({ status: "screening" })
        .where(eq(employees.id, employee.id));
      
      res.json({ success: true, message: "Questionnaire submitted successfully" });
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

  const httpServer = createServer(app);
  return httpServer;
}
