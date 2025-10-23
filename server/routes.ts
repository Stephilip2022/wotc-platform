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
  type InsertEmployee,
  type InsertEmployer,
  type InsertQuestionnaire,
  type InsertQuestionnaireResponse,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(app: Express): Promise<Server> {
  // ============================================================================
  // AUTHENTICATION ROUTES
  // ============================================================================
  
  app.get("/api/auth/me", async (req, res) => {
    // Mock user for development - in production use Replit Auth
    // For now, return a mock employer user
    res.json({
      id: "mock-user-1",
      email: "employer@example.com",
      role: "employer",
      employerId: "mock-employer-1",
    });
  });

  // ============================================================================
  // EMPLOYEE PORTAL ROUTES
  // ============================================================================
  
  app.get("/api/employee/questionnaire", async (req, res) => {
    try {
      // Get the employee's questionnaire (mock for now)
      const mockQuestionnaire = {
        id: "q1",
        employerId: "mock-employer-1",
        name: "WOTC Screening Questionnaire",
        description: "Complete this questionnaire to determine WOTC eligibility",
        isActive: true,
        questions: [
          {
            id: "q1",
            type: "radio",
            question: "Are you a member of a family that received SNAP (Food Stamps) benefits for at least 3 months in the past 15 months?",
            helpText: "SNAP is the Supplemental Nutrition Assistance Program, commonly known as food stamps.",
            options: ["Yes", "No", "Unsure"],
            required: true,
            targetGroup: "SNAP Recipients",
          },
          {
            id: "q2",
            type: "radio",
            question: "Are you a veteran who was unemployed for at least 4 weeks in the past year?",
            options: ["Yes", "No"],
            required: true,
            targetGroup: "Veterans",
          },
          {
            id: "q3",
            type: "radio",
            question: "Have you received Temporary Assistance for Needy Families (TANF) for at least 9 months?",
            helpText: "TANF is a federal assistance program.",
            options: ["Yes", "No", "Unsure"],
            required: true,
            targetGroup: "TANF Recipients",
          },
          {
            id: "q4",
            type: "radio",
            question: "Were you referred to this employer by a vocational rehabilitation agency?",
            options: ["Yes", "No"],
            required: true,
            targetGroup: "Vocational Rehabilitation",
          },
          {
            id: "q5",
            type: "date",
            question: "What is your date of birth?",
            required: true,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      res.json(mockQuestionnaire);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch questionnaire" });
    }
  });

  app.post("/api/employee/questionnaire/response", async (req, res) => {
    try {
      const { responses, completionPercentage } = req.body;
      // Save response to database
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save response" });
    }
  });

  app.post("/api/employee/questionnaire/submit", async (req, res) => {
    try {
      const { responses } = req.body;
      // Process submission and determine eligibility
      res.json({ success: true, message: "Questionnaire submitted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to submit questionnaire" });
    }
  });

  // ============================================================================
  // AI ASSISTANCE ROUTES
  // ============================================================================
  
  app.post("/api/ai/simplify-question", async (req, res) => {
    try {
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

      res.json({ simplifiedQuestion });
    } catch (error) {
      console.error("AI simplification error:", error);
      res.status(500).json({ error: "Failed to simplify question" });
    }
  });

  // ============================================================================
  // EMPLOYER PORTAL ROUTES
  // ============================================================================
  
  app.get("/api/employer/stats", async (req, res) => {
    try {
      // Mock stats for development
      res.json({
        totalEmployees: 45,
        activeScreenings: 12,
        certifiedEmployees: 28,
        projectedCredits: "$126,000",
        actualCredits: "$84,000",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/employer/recent-activity", async (req, res) => {
    try {
      // Mock activity data
      res.json([
        {
          id: "1",
          employeeName: "John Smith",
          action: "Completed Questionnaire",
          status: "eligible",
          date: "2025-10-20",
        },
        {
          id: "2",
          employeeName: "Jane Doe",
          action: "Screening Started",
          status: "pending",
          date: "2025-10-19",
        },
        {
          id: "3",
          employeeName: "Mike Johnson",
          action: "Certification Received",
          status: "certified",
          date: "2025-10-18",
        },
      ]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  app.get("/api/employer/employees", async (req, res) => {
    try {
      // Mock employee data
      res.json([
        {
          id: "emp1",
          employerId: "mock-employer-1",
          firstName: "John",
          lastName: "Smith",
          email: "john.smith@example.com",
          phone: "555-0100",
          jobTitle: "Sales Associate",
          hireDate: "2025-09-15",
          status: "certified",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "emp2",
          employerId: "mock-employer-1",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane.doe@example.com",
          phone: "555-0101",
          jobTitle: "Warehouse Worker",
          hireDate: "2025-10-01",
          status: "screening",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.post("/api/employer/employees", async (req, res) => {
    try {
      const employeeData = req.body as InsertEmployee;
      // Add employer ID from session
      employeeData.employerId = "mock-employer-1";
      
      // In production, insert into database
      // const newEmployee = await db.insert(employees).values(employeeData).returning();
      
      res.json({ success: true, id: "new-emp-id" });
    } catch (error) {
      res.status(500).json({ error: "Failed to add employee" });
    }
  });

  app.post("/api/employer/employees/:id/remind", async (req, res) => {
    try {
      const { id } = req.params;
      // Send reminder email
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to send reminder" });
    }
  });

  app.get("/api/employer/screenings", async (req, res) => {
    try {
      // Mock screening data with employee info
      res.json([
        {
          id: "scr1",
          employeeId: "emp1",
          employerId: "mock-employer-1",
          primaryTargetGroup: "SNAP Recipients",
          status: "certified",
          certificationNumber: "WOTC-2025-12345",
          form8850Generated: true,
          form9061Generated: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          employee: {
            id: "emp1",
            firstName: "John",
            lastName: "Smith",
            email: "john.smith@example.com",
          },
        },
        {
          id: "scr2",
          employeeId: "emp2",
          employerId: "mock-employer-1",
          primaryTargetGroup: "Veterans",
          status: "eligible",
          form8850Generated: false,
          form9061Generated: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          employee: {
            id: "emp2",
            firstName: "Jane",
            lastName: "Doe",
            email: "jane.doe@example.com",
          },
        },
      ]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch screenings" });
    }
  });

  // ============================================================================
  // ADMIN PORTAL ROUTES
  // ============================================================================
  
  app.get("/api/admin/stats", async (req, res) => {
    try {
      res.json({
        totalEmployers: 8,
        activeEmployers: 7,
        totalEmployees: 324,
        totalScreenings: 256,
        totalRevenue: "$127,450",
        monthlyRevenue: "$24,800",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/employers/summary", async (req, res) => {
    try {
      res.json([
        {
          id: "emp1",
          name: "TechCorp Industries",
          ein: "12-3456789",
          contactEmail: "hr@techcorp.com",
          revenueSharePercentage: "25.00",
          billingStatus: "active",
          employeeCount: 45,
          screeningCount: 38,
          certifiedCount: 28,
          projectedCredits: "$126,000",
        },
        {
          id: "emp2",
          name: "Retail Solutions Inc",
          ein: "98-7654321",
          contactEmail: "admin@retailsolutions.com",
          revenueSharePercentage: "25.00",
          billingStatus: "active",
          employeeCount: 82,
          screeningCount: 72,
          certifiedCount: 51,
          projectedCredits: "$204,000",
        },
      ]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employer summary" });
    }
  });

  app.get("/api/admin/employers", async (req, res) => {
    try {
      res.json([
        {
          id: "emp1",
          name: "TechCorp Industries",
          ein: "12-3456789",
          contactEmail: "hr@techcorp.com",
          contactPhone: "555-1000",
          address: "123 Tech Street",
          city: "San Francisco",
          state: "CA",
          zipCode: "94105",
          revenueSharePercentage: "25.00",
          billingStatus: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "emp2",
          name: "Retail Solutions Inc",
          ein: "98-7654321",
          contactEmail: "admin@retailsolutions.com",
          contactPhone: "555-2000",
          address: "456 Commerce Ave",
          city: "Los Angeles",
          state: "CA",
          zipCode: "90001",
          revenueSharePercentage: "25.00",
          billingStatus: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employers" });
    }
  });

  app.post("/api/admin/employers", async (req, res) => {
    try {
      const employerData = req.body as InsertEmployer;
      
      // In production, insert into database
      // const newEmployer = await db.insert(employers).values(employerData).returning();
      
      res.json({ success: true, id: "new-employer-id" });
    } catch (error) {
      res.status(500).json({ error: "Failed to add employer" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
