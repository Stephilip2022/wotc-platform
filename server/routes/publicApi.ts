import { Router } from "express";
import { eq, and, desc, asc, like, or, sql } from "drizzle-orm";
import { db } from "../db";
import { employees, screenings, creditCalculations } from "../../shared/schema";
import { publicApiMiddleware } from "../middleware/rateLimiter";
import type { ApiKeyRequest } from "../middleware/apiKeyAuth";

const router = Router();

// ============================================================================
// EMPLOYEES API
// ============================================================================

/**
 * GET /api/v1/employees
 * List employees for the authenticated employer
 * Query params: page, limit, sort, search, status
 */
router.get(
  "/employees",
  ...publicApiMiddleware(["employees:read", "employees:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      
      // Pagination
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;
      
      // Sorting - map field to column
      const sortField = (req.query.sort as string) || "createdAt";
      const sortDirection = (req.query.order as string) === "asc" ? asc : desc;
      
      const sortColumns = {
        createdAt: employees.createdAt,
        firstName: employees.firstName,
        lastName: employees.lastName,
        hireDate: employees.hireDate,
        status: employees.status,
      };
      const sortColumn = sortColumns[sortField as keyof typeof sortColumns] || employees.createdAt;
      
      // Filtering
      const search = req.query.search as string;
      const status = req.query.status as string;
      
      // Build where conditions
      const conditions = [eq(employees.employerId, employerId)];
      
      if (status) {
        conditions.push(eq(employees.status, status));
      }
      
      if (search) {
        conditions.push(
          or(
            like(employees.firstName, `%${search}%`),
            like(employees.lastName, `%${search}%`),
            like(employees.email, `%${search}%`)
          )!
        );
      }
      
      // Execute queries with single orderBy call
      const [employeesList, totalCountResult] = await Promise.all([
        db
          .select()
          .from(employees)
          .where(and(...conditions))
          .orderBy(sortDirection(sortColumn))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(employees)
          .where(and(...conditions))
      ]);
      
      const totalCount = Number(totalCountResult[0]?.count || 0);
      const totalPages = Math.ceil(totalCount / limit);
      
      res.json({
        data: employeesList,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch employees",
      });
    }
  }
);

/**
 * GET /api/v1/employees/:id
 * Get a single employee by ID
 */
router.get(
  "/employees/:id",
  ...publicApiMiddleware(["employees:read", "employees:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const { id } = req.params;
      
      const [employee] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, id), eq(employees.employerId, employerId)));
      
      if (!employee) {
        return res.status(404).json({
          error: "Not Found",
          message: "Employee not found",
        });
      }
      
      res.json({ data: employee });
    } catch (error) {
      console.error("Error fetching employee:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch employee",
      });
    }
  }
);

// ============================================================================
// SCREENINGS API
// ============================================================================

/**
 * GET /api/v1/screenings
 * List screenings for the authenticated employer
 * Query params: page, limit, sort, employeeId, status
 */
router.get(
  "/screenings",
  ...publicApiMiddleware(["screenings:read", "screenings:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      
      // Pagination
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;
      
      // Sorting - map field to column
      const sortField = (req.query.sort as string) || "createdAt";
      const sortDirection = (req.query.order as string) === "asc" ? asc : desc;
      
      const sortColumns = {
        createdAt: screenings.createdAt,
        status: screenings.status,
        certifiedAt: screenings.certifiedAt,
        eligibilityDeterminedAt: screenings.eligibilityDeterminedAt,
      };
      const sortColumn = sortColumns[sortField as keyof typeof sortColumns] || screenings.createdAt;
      
      // Filtering
      const employeeId = req.query.employeeId as string;
      const status = req.query.status as string;
      
      // Build where conditions
      const conditions = [eq(screenings.employerId, employerId)];
      
      if (employeeId) {
        conditions.push(eq(screenings.employeeId, employeeId));
      }
      
      if (status) {
        conditions.push(eq(screenings.status, status));
      }
      
      // Execute queries with single orderBy call
      const [screeningsList, totalCountResult] = await Promise.all([
        db
          .select()
          .from(screenings)
          .where(and(...conditions))
          .orderBy(sortDirection(sortColumn))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(screenings)
          .where(and(...conditions))
      ]);
      
      const totalCount = Number(totalCountResult[0]?.count || 0);
      const totalPages = Math.ceil(totalCount / limit);
      
      res.json({
        data: screeningsList,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching screenings:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch screenings",
      });
    }
  }
);

/**
 * GET /api/v1/screenings/:id
 * Get a single screening by ID
 */
router.get(
  "/screenings/:id",
  ...publicApiMiddleware(["screenings:read", "screenings:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const { id } = req.params;
      
      const [screening] = await db
        .select()
        .from(screenings)
        .where(and(eq(screenings.id, id), eq(screenings.employerId, employerId)));
      
      if (!screening) {
        return res.status(404).json({
          error: "Not Found",
          message: "Screening not found",
        });
      }
      
      res.json({ data: screening });
    } catch (error) {
      console.error("Error fetching screening:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch screening",
      });
    }
  }
);

/**
 * GET /api/v1/screenings/:id/status
 * Get screening status (lightweight endpoint for polling)
 */
router.get(
  "/screenings/:id/status",
  ...publicApiMiddleware(["screenings:read", "screenings:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const { id } = req.params;
      
      const [screening] = await db
        .select({
          id: screenings.id,
          status: screenings.status,
          certificationNumber: screenings.certificationNumber,
          certifiedAt: screenings.certifiedAt,
          eligibilityDeterminedAt: screenings.eligibilityDeterminedAt,
          updatedAt: screenings.updatedAt,
        })
        .from(screenings)
        .where(and(eq(screenings.id, id), eq(screenings.employerId, employerId)));
      
      if (!screening) {
        return res.status(404).json({
          error: "Not Found",
          message: "Screening not found",
        });
      }
      
      res.json({ data: screening });
    } catch (error) {
      console.error("Error fetching screening status:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch screening status",
      });
    }
  }
);

// ============================================================================
// CREDIT CALCULATIONS API
// ============================================================================

/**
 * GET /api/v1/credits
 * List credit calculations for the authenticated employer
 * Query params: page, limit, sort, employeeId, screeningId, status
 */
router.get(
  "/credits",
  ...publicApiMiddleware(["credits:read", "credits:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      
      // Pagination
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const offset = (page - 1) * limit;
      
      // Sorting - map field to column
      const sortField = (req.query.sort as string) || "calculatedAt";
      const sortDirection = (req.query.order as string) === "asc" ? asc : desc;
      
      const sortColumns = {
        calculatedAt: creditCalculations.calculatedAt,
        actualCreditAmount: creditCalculations.actualCreditAmount,
        projectedCreditAmount: creditCalculations.projectedCreditAmount,
        status: creditCalculations.status,
      };
      const sortColumn = sortColumns[sortField as keyof typeof sortColumns] || creditCalculations.calculatedAt;
      
      // Filtering
      const employeeId = req.query.employeeId as string;
      const screeningId = req.query.screeningId as string;
      const status = req.query.status as string;
      
      // Build where conditions
      const conditions = [eq(creditCalculations.employerId, employerId)];
      
      if (employeeId) {
        conditions.push(eq(creditCalculations.employeeId, employeeId));
      }
      
      if (screeningId) {
        conditions.push(eq(creditCalculations.screeningId, screeningId));
      }
      
      if (status) {
        conditions.push(eq(creditCalculations.status, status));
      }
      
      // Execute queries with single orderBy call
      const [creditsList, totalCountResult] = await Promise.all([
        db
          .select()
          .from(creditCalculations)
          .where(and(...conditions))
          .orderBy(sortDirection(sortColumn))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(creditCalculations)
          .where(and(...conditions))
      ]);
      
      const totalCount = Number(totalCountResult[0]?.count || 0);
      const totalPages = Math.ceil(totalCount / limit);
      
      res.json({
        data: creditsList,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      });
    } catch (error) {
      console.error("Error fetching credits:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch credits",
      });
    }
  }
);

/**
 * GET /api/v1/credits/:id
 * Get a single credit calculation by ID
 */
router.get(
  "/credits/:id",
  ...publicApiMiddleware(["credits:read", "credits:admin"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const { id } = req.params;
      
      const [credit] = await db
        .select()
        .from(creditCalculations)
        .where(and(eq(creditCalculations.id, id), eq(creditCalculations.employerId, employerId)));
      
      if (!credit) {
        return res.status(404).json({
          error: "Not Found",
          message: "Credit calculation not found",
        });
      }
      
      res.json({ data: credit });
    } catch (error) {
      console.error("Error fetching credit:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch credit calculation",
      });
    }
  }
);

/**
 * GET /api/v1/employees/:id/screenings
 * Get all screenings for a specific employee
 */
router.get(
  "/employees/:id/screenings",
  ...publicApiMiddleware(["employees:read", "screenings:read"]),
  async (req, res) => {
    try {
      const { employerId } = (req as ApiKeyRequest).apiKey!;
      const { id: employeeId } = req.params;
      
      // Verify employee belongs to employer
      const [employee] = await db
        .select()
        .from(employees)
        .where(and(eq(employees.id, employeeId), eq(employees.employerId, employerId)));
      
      if (!employee) {
        return res.status(404).json({
          error: "Not Found",
          message: "Employee not found",
        });
      }
      
      // Fetch screenings
      const employeeScreenings = await db
        .select()
        .from(screenings)
        .where(and(eq(screenings.employeeId, employeeId), eq(screenings.employerId, employerId)))
        .orderBy(desc(screenings.createdAt));
      
      res.json({ data: employeeScreenings });
    } catch (error) {
      console.error("Error fetching employee screenings:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to fetch employee screenings",
      });
    }
  }
);

// ============================================================================
// API METADATA
// ============================================================================

/**
 * GET /api/v1
 * API information and available endpoints
 */
router.get(
  "/",
  ...publicApiMiddleware(),
  (req, res) => {
    res.json({
      version: "1.0.0",
      endpoints: {
        employees: {
          list: "GET /api/v1/employees",
          get: "GET /api/v1/employees/:id",
          screenings: "GET /api/v1/employees/:id/screenings",
        },
        screenings: {
          list: "GET /api/v1/screenings",
          get: "GET /api/v1/screenings/:id",
          status: "GET /api/v1/screenings/:id/status",
        },
        credits: {
          list: "GET /api/v1/credits",
          get: "GET /api/v1/credits/:id",
        },
      },
      documentation: "/api/docs",
    });
  }
);

export default router;
