import { Router } from "express";
import { getAuth } from "@clerk/express";
import PDFDocument from "pdfkit";
import { db } from "../db";
import { taxCreditPrograms, employerProgramAssignments, employers, users } from "../../shared/schema";
import { eq, and, sql, ilike, inArray, desc, asc } from "drizzle-orm";

const router = Router();

async function requireAdmin(req: any, res: any): Promise<string | null> {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const [user] = await db.select().from(users).where(eq(users.id, clerkUserId));
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return clerkUserId;
}

async function getEmployerId(req: any, res: any): Promise<string | null> {
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  const [user] = await db.select().from(users).where(eq(users.id, clerkUserId));
  if (!user?.employerId) {
    res.status(403).json({ error: "Employer access required" });
    return null;
  }
  return user.employerId;
}

router.get("/programs", async (req, res) => {
  try {
    const { state, category, tier, search, isActive } = req.query;
    let query = db.select().from(taxCreditPrograms);
    const conditions: any[] = [];

    if (state) conditions.push(eq(taxCreditPrograms.state, state as string));
    if (category) conditions.push(eq(taxCreditPrograms.programCategory, category as string));
    if (tier) conditions.push(eq(taxCreditPrograms.tier, tier as string));
    if (isActive !== undefined) conditions.push(eq(taxCreditPrograms.isActive, isActive === "true"));
    if (search) conditions.push(ilike(taxCreditPrograms.programName, `%${search}%`));

    const programs = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(asc(taxCreditPrograms.state), asc(taxCreditPrograms.programName))
      : await query.orderBy(asc(taxCreditPrograms.state), asc(taxCreditPrograms.programName));

    res.json(programs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/programs/:id", async (req, res) => {
  try {
    const [program] = await db.select().from(taxCreditPrograms).where(eq(taxCreditPrograms.id, req.params.id));
    if (!program) return res.status(404).json({ error: "Program not found" });
    res.json(program);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/programs/:id", async (req, res) => {
  try {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const { isActive, tier, programCategory, eligibilityRules, screeningQuestions, creditFormula, maxCreditAmount } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (isActive !== undefined) updates.isActive = isActive;
    if (tier) updates.tier = tier;
    if (programCategory) updates.programCategory = programCategory;
    if (eligibilityRules !== undefined) updates.eligibilityRules = eligibilityRules;
    if (screeningQuestions !== undefined) updates.screeningQuestions = screeningQuestions;
    if (creditFormula !== undefined) updates.creditFormula = creditFormula;
    if (maxCreditAmount !== undefined) updates.maxCreditAmount = maxCreditAmount;

    const [updated] = await db.update(taxCreditPrograms)
      .set(updates)
      .where(eq(taxCreditPrograms.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/programs/:id/toggle", async (req, res) => {
  try {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const [program] = await db.select().from(taxCreditPrograms).where(eq(taxCreditPrograms.id, req.params.id));
    if (!program) return res.status(404).json({ error: "Program not found" });

    const [updated] = await db.update(taxCreditPrograms)
      .set({ isActive: !program.isActive, updatedAt: new Date() })
      .where(eq(taxCreditPrograms.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/employer/:employerId/assignments", async (req, res) => {
  try {
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) return res.status(401).json({ error: "Not authenticated" });

    const [user] = await db.select().from(users).where(eq(users.id, clerkUserId));
    if (!user) return res.status(401).json({ error: "User not found" });

    const { employerId } = req.params;

    if (user.role !== "admin" && user.employerId !== employerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const assignments = await db
      .select({
        assignment: employerProgramAssignments,
        program: taxCreditPrograms,
      })
      .from(employerProgramAssignments)
      .innerJoin(taxCreditPrograms, eq(employerProgramAssignments.programId, taxCreditPrograms.id))
      .where(eq(employerProgramAssignments.employerId, employerId))
      .orderBy(asc(taxCreditPrograms.state), asc(taxCreditPrograms.programName));

    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/my-programs", async (req, res) => {
  try {
    const employerId = await getEmployerId(req, res);
    if (!employerId) return;

    const assignments = await db
      .select({
        assignment: employerProgramAssignments,
        program: taxCreditPrograms,
      })
      .from(employerProgramAssignments)
      .innerJoin(taxCreditPrograms, eq(employerProgramAssignments.programId, taxCreditPrograms.id))
      .where(and(
        eq(employerProgramAssignments.employerId, employerId),
        eq(employerProgramAssignments.isEnabled, true),
        eq(taxCreditPrograms.isActive, true)
      ))
      .orderBy(asc(taxCreditPrograms.state), asc(taxCreditPrograms.programName));

    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/employer/:employerId/assignments", async (req, res) => {
  try {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const { employerId } = req.params;
    const { programId, isEnabled, isRecommended, notes } = req.body;

    const existing = await db.select().from(employerProgramAssignments)
      .where(and(
        eq(employerProgramAssignments.employerId, employerId),
        eq(employerProgramAssignments.programId, programId)
      ));

    if (existing.length > 0) {
      const [updated] = await db.update(employerProgramAssignments)
        .set({
          isEnabled: isEnabled !== undefined ? isEnabled : existing[0].isEnabled,
          isRecommended: isRecommended !== undefined ? isRecommended : existing[0].isRecommended,
          notes: notes || existing[0].notes,
          enabledBy: adminId,
          enabledAt: isEnabled ? new Date() : existing[0].enabledAt,
          disabledAt: isEnabled === false ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(employerProgramAssignments.id, existing[0].id))
        .returning();
      return res.json(updated);
    }

    const [assignment] = await db.insert(employerProgramAssignments).values({
      employerId,
      programId,
      isEnabled: isEnabled !== undefined ? isEnabled : true,
      isRecommended: isRecommended || false,
      enabledBy: adminId,
      enabledAt: new Date(),
    }).returning();

    res.json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/employer/:employerId/assignments/:assignmentId/toggle", async (req, res) => {
  try {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const { assignmentId } = req.params;
    const [existing] = await db.select().from(employerProgramAssignments)
      .where(eq(employerProgramAssignments.id, assignmentId));

    if (!existing) return res.status(404).json({ error: "Assignment not found" });

    const newEnabled = !existing.isEnabled;
    const [updated] = await db.update(employerProgramAssignments)
      .set({
        isEnabled: newEnabled,
        enabledBy: adminId,
        enabledAt: newEnabled ? new Date() : existing.enabledAt,
        disabledAt: newEnabled ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(employerProgramAssignments.id, assignmentId))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/employer/:employerId/recommend", async (req, res) => {
  try {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const { employerId } = req.params;

    const [employer] = await db.select().from(employers).where(eq(employers.id, employerId));
    if (!employer) return res.status(404).json({ error: "Employer not found" });

    const allPrograms = await db.select().from(taxCreditPrograms).where(eq(taxCreditPrograms.isActive, true));

    const recommended: any[] = [];
    for (const program of allPrograms) {
      let matches = false;

      if (employer.state && program.state.toLowerCase() === employer.state.toLowerCase()) {
        matches = true;
      }
      if (program.state === "Federal") {
        matches = true;
      }

      if (!matches) continue;

      const existing = await db.select().from(employerProgramAssignments)
        .where(and(
          eq(employerProgramAssignments.employerId, employerId),
          eq(employerProgramAssignments.programId, program.id)
        ));

      if (existing.length === 0) {
        const [assignment] = await db.insert(employerProgramAssignments).values({
          employerId,
          programId: program.id,
          isEnabled: false,
          isRecommended: true,
          enabledBy: adminId,
        }).returning();
        recommended.push({ assignment, program });
      } else if (!existing[0].isRecommended) {
        await db.update(employerProgramAssignments)
          .set({ isRecommended: true, updatedAt: new Date() })
          .where(eq(employerProgramAssignments.id, existing[0].id));
        recommended.push({ assignment: existing[0], program });
      }
    }

    res.json({ recommended: recommended.length, programs: recommended });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/employer/:employerId/bulk-assign", async (req, res) => {
  try {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const { employerId } = req.params;
    const { programIds, isEnabled } = req.body;

    if (!Array.isArray(programIds) || programIds.length === 0) {
      return res.status(400).json({ error: "programIds array is required" });
    }

    const results: any[] = [];
    for (const programId of programIds) {
      const existing = await db.select().from(employerProgramAssignments)
        .where(and(
          eq(employerProgramAssignments.employerId, employerId),
          eq(employerProgramAssignments.programId, programId)
        ));

      if (existing.length > 0) {
        const [updated] = await db.update(employerProgramAssignments)
          .set({
            isEnabled: isEnabled !== undefined ? isEnabled : true,
            enabledBy: adminId,
            enabledAt: isEnabled ? new Date() : existing[0].enabledAt,
            disabledAt: isEnabled === false ? new Date() : null,
            updatedAt: new Date(),
          })
          .where(eq(employerProgramAssignments.id, existing[0].id))
          .returning();
        results.push(updated);
      } else {
        const [assignment] = await db.insert(employerProgramAssignments).values({
          employerId,
          programId,
          isEnabled: isEnabled !== undefined ? isEnabled : true,
          isRecommended: false,
          enabledBy: adminId,
        }).returning();
        results.push(assignment);
      }
    }

    res.json({ updated: results.length, assignments: results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/seed", async (req, res) => {
  try {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;

    const XLSX = require("xlsx");
    const path = require("path");
    const filePath = path.join(process.cwd(), "attached_assets", "c2er_state_incentives_database-2025_1770936549949.xlsx");

    let wb;
    try {
      wb = XLSX.readFile(filePath);
    } catch {
      return res.status(404).json({ error: "C2ER spreadsheet not found" });
    }

    const ws = wb.Sheets["WOTC-Similar State Tax Credits"];
    if (!ws) return res.status(400).json({ error: "WOTC-Similar sheet not found" });

    const data = XLSX.utils.sheet_to_json(ws);
    let imported = 0;
    let skipped = 0;

    for (const row of data) {
      const state = row["State"];
      const programName = row["Program Name"];
      if (!state || !programName) { skipped++; continue; }

      const existing = await db.select().from(taxCreditPrograms)
        .where(and(
          eq(taxCreditPrograms.state, state),
          eq(taxCreditPrograms.programName, programName)
        ));

      if (existing.length > 0) { skipped++; continue; }

      const leverage = (row["How Rockerbox Might Leverage"] || "").toLowerCase();
      let category = "general_screening";
      let tier = "2";

      if (leverage.includes("veteran")) { category = "veteran_credit"; tier = "1"; }
      else if (leverage.includes("disability") || leverage.includes("rehab")) { category = "disability_credit"; tier = "1"; }
      else if (leverage.includes("felony") || leverage.includes("incarcerat")) { category = "reentry_credit"; tier = "1"; }
      else if (leverage.includes("youth") || leverage.includes("apprentice") || leverage.includes("training")) { category = "youth_training_credit"; tier = "1"; }
      else if (leverage.includes("zone") || leverage.includes("location") || leverage.includes("enterprise")) { category = "enterprise_zone_credit"; tier = "2"; }
      else if (leverage.includes("historic") || leverage.includes("rehab")) { category = "historic_rehabilitation"; tier = "3"; }
      else { tier = "2"; }

      await db.insert(taxCreditPrograms).values({
        c2erReferenceNumber: row["C2ER Reference Number "] || null,
        state,
        programName,
        programDescription: row["Program Description"] || null,
        programCategory: category,
        leverageType: row["How Rockerbox Might Leverage"] || null,
        informationNeededToCertify: row["Information Needed to Certify"] || null,
        agencyToWorkWith: row["Agency to Work With"] || null,
        tier,
        isActive: true,
      });
      imported++;
    }

    res.json({ imported, skipped, total: data.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const [totalPrograms] = await db.select({ count: sql<number>`count(*)` }).from(taxCreditPrograms);
    const [activePrograms] = await db.select({ count: sql<number>`count(*)` }).from(taxCreditPrograms).where(eq(taxCreditPrograms.isActive, true));

    const byState = await db
      .select({ state: taxCreditPrograms.state, count: sql<number>`count(*)` })
      .from(taxCreditPrograms)
      .where(eq(taxCreditPrograms.isActive, true))
      .groupBy(taxCreditPrograms.state)
      .orderBy(desc(sql`count(*)`));

    const byCategory = await db
      .select({ category: taxCreditPrograms.programCategory, count: sql<number>`count(*)` })
      .from(taxCreditPrograms)
      .where(eq(taxCreditPrograms.isActive, true))
      .groupBy(taxCreditPrograms.programCategory)
      .orderBy(desc(sql`count(*)`));

    const byTier = await db
      .select({ tier: taxCreditPrograms.tier, count: sql<number>`count(*)` })
      .from(taxCreditPrograms)
      .where(eq(taxCreditPrograms.isActive, true))
      .groupBy(taxCreditPrograms.tier)
      .orderBy(asc(taxCreditPrograms.tier));

    const [totalAssignments] = await db.select({ count: sql<number>`count(*)` }).from(employerProgramAssignments);
    const [enabledAssignments] = await db.select({ count: sql<number>`count(*)` }).from(employerProgramAssignments).where(eq(employerProgramAssignments.isEnabled, true));

    res.json({
      totalPrograms: totalPrograms.count,
      activePrograms: activePrograms.count,
      byState,
      byCategory,
      byTier,
      totalAssignments: totalAssignments.count,
      enabledAssignments: enabledAssignments.count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const LEVERAGE_LABELS: Record<string, string> = {
  wage_percentage: "Wage-based percentage credit",
  per_employee_flat_plus_wage: "Flat amount per employee plus wage-based component",
  percentage_of_expenditure: "Percentage of qualified expenditures",
  flat_per_employee: "Flat credit per qualifying employee",
  tiered_by_hours: "Tiered credit based on hours worked",
};

const CATEGORY_LABELS: Record<string, string> = {
  veteran_credit: "Veteran",
  disability_credit: "Disability",
  reentry_credit: "Re-entry",
  youth_training_credit: "Youth/Training",
  enterprise_zone_credit: "Enterprise Zone",
  historic_rehabilitation: "Historic Rehab",
  general_screening: "General",
};

function getCaptureStrategy(program: any): string {
  const parts: string[] = [];
  const lt = program.leverageType || "";
  if (lt === "wage_percentage") {
    parts.push("Screen employees using WOTC-aligned questionnaire to identify eligibility.");
    parts.push("Collect wage records and hours worked data from employer payroll.");
    parts.push("Calculate credit as percentage of qualifying wages.");
  } else if (lt === "per_employee_flat_plus_wage") {
    parts.push("Verify employer worksite is within designated zone boundaries.");
    parts.push("Screen new hires for zone residency and employment eligibility.");
    parts.push("Submit zone certification along with employee wage documentation.");
  } else if (lt === "percentage_of_expenditure") {
    parts.push("Collect documentation of qualified expenditures from employer.");
    parts.push("Verify project meets program-specific certification requirements.");
    parts.push("Submit application to certifying agency with expenditure records.");
  } else if (lt === "flat_per_employee") {
    parts.push("Screen employees using target group criteria aligned with program rules.");
    parts.push("Collect required documentation (hire date, job details, eligibility proof).");
    parts.push("Submit per-employee certification to administering agency.");
  } else if (lt === "tiered_by_hours") {
    parts.push("Track employee hours worked to determine credit tier eligibility.");
    parts.push("Collect payroll data to verify hours thresholds (120/400 hour milestones).");
    parts.push("Calculate tiered credit amount based on hours worked and wage data.");
  } else {
    parts.push("Review program-specific criteria and documentation requirements.");
    parts.push("Collect relevant employee/employer data for certification.");
  }
  parts.push(`Submit to ${program.agencyToWorkWith || "state agency"} for certification and approval.`);
  return parts.join(" ");
}

router.get("/matrix/pdf", async (req, res) => {
  try {
    const programs = await db.select().from(taxCreditPrograms)
      .where(eq(taxCreditPrograms.isActive, true))
      .orderBy(asc(taxCreditPrograms.state), asc(taxCreditPrograms.programName));

    const doc = new PDFDocument({ size: "LETTER", layout: "landscape", margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Rockerbox_State_Credits_Matrix.pdf"');
    doc.pipe(res);

    doc.fontSize(22).font("Helvetica-Bold").text("Rockerbox State Credits Matrix", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#666666")
      .text(`${programs.length} State-Specific Credit Programs | Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(8).text("Confidential - For Internal Use Only", { align: "center" });
    doc.fillColor("#000000");
    doc.moveDown(1);

    const colWidths = [130, 60, 70, 180, 120, 180];
    const headers = ["Program Name", "State", "Category", "Description", "Certifying Agency", "How to Capture Credit"];
    const startX = 40;
    let y = doc.y;

    const drawHeaderRow = (yPos: number) => {
      doc.rect(startX, yPos, colWidths.reduce((a, b) => a + b, 0), 18).fill("#1a1a2e");
      let x = startX;
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#ffffff");
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x + 3, yPos + 5, { width: colWidths[i] - 6, lineBreak: false });
        x += colWidths[i];
      }
      doc.fillColor("#000000");
      return yPos + 18;
    };

    y = drawHeaderRow(y);

    let currentState = "";
    for (let idx = 0; idx < programs.length; idx++) {
      const p = programs[idx];
      const desc = (p.programDescription || "").substring(0, 200);
      const agency = p.agencyToWorkWith || "—";
      const capture = getCaptureStrategy(p).substring(0, 220);
      const category = CATEGORY_LABELS[p.programCategory || ""] || p.programCategory || "";

      const textHeight = Math.max(
        doc.font("Helvetica").fontSize(6.5).heightOfString(p.programName, { width: colWidths[0] - 6 }),
        doc.heightOfString(desc, { width: colWidths[3] - 6 }),
        doc.heightOfString(capture, { width: colWidths[5] - 6 }),
        14
      );
      const rowH = Math.min(textHeight + 8, 60);

      if (y + rowH > 560) {
        doc.addPage({ size: "LETTER", layout: "landscape", margin: 40 });
        y = 40;
        y = drawHeaderRow(y);
        currentState = "";
      }

      if (p.state !== currentState) {
        currentState = p.state;
        doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), 14).fill("#f0f0f5");
        doc.font("Helvetica-Bold").fontSize(7).fillColor("#333333");
        doc.text(p.state, startX + 3, y + 4);
        doc.fillColor("#000000");
        y += 14;
        if (y + rowH > 560) {
          doc.addPage({ size: "LETTER", layout: "landscape", margin: 40 });
          y = 40;
          y = drawHeaderRow(y);
        }
      }

      const bgColor = idx % 2 === 0 ? "#ffffff" : "#fafafa";
      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowH).fill(bgColor);

      let x = startX;
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#111111");
      doc.text(p.programName, x + 3, y + 4, { width: colWidths[0] - 6 });
      x += colWidths[0];

      doc.font("Helvetica").fontSize(6.5).fillColor("#444444");
      doc.text(p.state, x + 3, y + 4, { width: colWidths[1] - 6 });
      x += colWidths[1];

      doc.text(category, x + 3, y + 4, { width: colWidths[2] - 6 });
      x += colWidths[2];

      doc.fontSize(6).fillColor("#555555");
      doc.text(desc, x + 3, y + 4, { width: colWidths[3] - 6, height: rowH - 6 });
      x += colWidths[3];

      doc.fontSize(6.5).fillColor("#444444");
      doc.text(agency, x + 3, y + 4, { width: colWidths[4] - 6, height: rowH - 6 });
      x += colWidths[4];

      doc.fontSize(6).fillColor("#555555");
      doc.text(capture, x + 3, y + 4, { width: colWidths[5] - 6, height: rowH - 6 });

      doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowH).stroke("#e0e0e0");
      y += rowH;
    }

    doc.addPage({ size: "LETTER", layout: "landscape", margin: 40 });
    doc.fontSize(16).font("Helvetica-Bold").text("Program Summary by State", { align: "center" });
    doc.moveDown(1);

    const stateGroups: Record<string, number> = {};
    for (const p of programs) {
      stateGroups[p.state] = (stateGroups[p.state] || 0) + 1;
    }
    const sortedStates = Object.entries(stateGroups).sort((a, b) => a[0].localeCompare(b[0]));
    
    doc.font("Helvetica").fontSize(9);
    const summCols = 3;
    const summColWidth = 220;
    let summY = doc.y;
    for (let i = 0; i < sortedStates.length; i++) {
      const col = i % summCols;
      const row = Math.floor(i / summCols);
      const sx = 40 + col * summColWidth;
      const sy = summY + row * 16;
      if (sy > 540) break;
      doc.text(`${sortedStates[i][0]}: ${sortedStates[i][1]} program${sortedStates[i][1] > 1 ? "s" : ""}`, sx, sy);
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor("#999999").text(
      `Generated by Rockerbox WOTC Optimization Platform | ${new Date().toISOString().split("T")[0]} | Total: ${programs.length} programs across ${Object.keys(stateGroups).length} states`,
      40, 560, { align: "center" }
    );

    doc.end();
  } catch (error: any) {
    console.error("Error generating matrix PDF:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
