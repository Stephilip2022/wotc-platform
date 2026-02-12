import { db } from "../db";
import { eq, and, inArray } from "drizzle-orm";
import {
  taxCreditPrograms,
  employerProgramAssignments,
  programScreeningResults,
  programCreditCalculations,
  employerWorksites,
  employees,
  screenings,
  employers,
} from "@shared/schema";

interface ScreeningContext {
  employee: any;
  screening: any;
  employer: any;
  worksites: any[];
}

interface EligibilityResult {
  programId: string;
  programName: string;
  state: string;
  category: string;
  eligible: boolean;
  score: number;
  autoScreened: boolean;
  autoScreenSource: string | null;
  qualifyingFactors: string[];
  disqualifyingFactors: string[];
  requiredQuestions: any[];
  creditEstimate: number | null;
}

const WOTC_TARGET_GROUP_MAP: Record<string, string[]> = {
  qualified_veteran: ["veteran", "vet", "armed forces", "military"],
  disabled_veteran: ["disabled veteran", "service-connected disability"],
  vocational_rehabilitation: ["vocational rehabilitation", "voc rehab", "vocrehab"],
  ssi_recipient: ["ssi", "supplemental security income"],
  ex_felon: ["ex-felon", "felon", "ex felon", "conviction", "formerly incarcerated"],
  snap_recipient_age_18_39: ["snap", "food stamp"],
  tanf_recipient: ["tanf", "temporary assistance"],
  long_term_unemployed: ["long-term unemployed", "ltur", "long term unemployed"],
  designated_community_resident: ["designated community", "empowerment zone resident"],
  summer_youth: ["summer youth"],
};

function extractWotcTargetGroups(screening: any): string[] {
  const groups: string[] = [];
  const raw = screening?.targetGroups || screening?.qualifyingCategories || "";
  const rawUpper = String(raw).toUpperCase();

  for (const [groupKey, keywords] of Object.entries(WOTC_TARGET_GROUP_MAP)) {
    if (keywords.some((kw) => rawUpper.includes(kw.toUpperCase()))) {
      groups.push(groupKey);
    }
  }

  if (screening?.isVeteran || screening?.veteranStatus) groups.push("qualified_veteran");
  if (screening?.isSNAP || screening?.snapRecipient) groups.push("snap_recipient_age_18_39");
  if (screening?.isTANF || screening?.tanfRecipient) groups.push("tanf_recipient");
  if (screening?.isSSI || screening?.ssiRecipient) groups.push("ssi_recipient");
  if (screening?.isExFelon || screening?.felonyConviction) groups.push("ex_felon");
  if (screening?.isVocRehab || screening?.vocationalRehab) groups.push("vocational_rehabilitation");

  return Array.from(new Set(groups));
}

function calculateAge(dateOfBirth: any): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

function checkZoneEligibility(worksites: any[], programState: string): { inZone: boolean; zoneName: string | null } {
  const stateWorksites = worksites.filter(
    (w) => w.state?.toUpperCase() === programState.toUpperCase() || programState === "Federal"
  );

  for (const ws of stateWorksites) {
    if (ws.isEnterpriseZone || ws.isEmpowermentZone || ws.isOpportunityZone || ws.isRuralRenewalArea) {
      return { inZone: true, zoneName: ws.enterpriseZoneName || "Designated Zone" };
    }
  }
  return { inZone: false, zoneName: null };
}

export async function screenEmployeeForPrograms(
  employeeId: string,
  employerId: string
): Promise<EligibilityResult[]> {
  const [employee] = await db.select().from(employees).where(eq(employees.id, employeeId));
  if (!employee) throw new Error("Employee not found");

  const [employer] = await db.select().from(employers).where(eq(employers.id, employerId));
  if (!employer) throw new Error("Employer not found");

  const employeeScreenings = await db
    .select()
    .from(screenings)
    .where(eq(screenings.employeeId, employeeId));
  const latestScreening = employeeScreenings[0] || {};

  const worksites = await db
    .select()
    .from(employerWorksites)
    .where(eq(employerWorksites.employerId, employerId));

  const assignedPrograms = await db
    .select({ program: taxCreditPrograms, assignment: employerProgramAssignments })
    .from(employerProgramAssignments)
    .innerJoin(taxCreditPrograms, eq(employerProgramAssignments.programId, taxCreditPrograms.id))
    .where(
      and(
        eq(employerProgramAssignments.employerId, employerId),
        eq(employerProgramAssignments.isEnabled, true),
        eq(taxCreditPrograms.isActive, true)
      )
    );

  const context: ScreeningContext = {
    employee,
    screening: latestScreening,
    employer,
    worksites,
  };

  const wotcGroups = extractWotcTargetGroups(latestScreening);
  const employeeAge = calculateAge(employee.dateOfBirth);
  const results: EligibilityResult[] = [];

  for (const { program } of assignedPrograms) {
    const rules = (program.eligibilityRules as any) || {};
    const result = evaluateProgram(program, rules, context, wotcGroups, employeeAge);
    results.push(result);
  }

  for (const result of results.filter((r) => r.eligible || r.score >= 50)) {
    const existing = await db
      .select()
      .from(programScreeningResults)
      .where(
        and(
          eq(programScreeningResults.employeeId, employeeId),
          eq(programScreeningResults.programId, result.programId)
        )
      );

    if (existing.length === 0) {
      await db.insert(programScreeningResults).values({
        employeeId,
        employerId,
        programId: result.programId,
        screeningStatus: result.eligible ? "eligible" : "review_needed",
        eligibilityResult: result.eligible ? "eligible" : "possible",
        eligibilityScore: result.score,
        qualifyingFactors: result.qualifyingFactors,
        disqualifyingFactors: result.disqualifyingFactors,
        autoScreened: result.autoScreened,
        autoScreenSource: result.autoScreenSource,
      });
    }
  }

  return results;
}

function evaluateProgram(
  program: any,
  rules: any,
  context: ScreeningContext,
  wotcGroups: string[],
  employeeAge: number | null
): EligibilityResult {
  const qualifyingFactors: string[] = [];
  const disqualifyingFactors: string[] = [];
  let score = 0;
  let autoScreened = false;
  let autoScreenSource: string | null = null;

  if (rules.autoScreenFromWotc && wotcGroups.length > 0) {
    const programTargets: string[] = rules.wotcTargetGroups || [];

    if (programTargets.includes("all")) {
      score += 80;
      autoScreened = true;
      autoScreenSource = "wotc_screening";
      qualifyingFactors.push(`WOTC target groups: ${wotcGroups.join(", ")}`);
    } else {
      const matchedGroups = programTargets.filter((t: string) => wotcGroups.includes(t));
      if (matchedGroups.length > 0) {
        score += 70 + matchedGroups.length * 5;
        autoScreened = true;
        autoScreenSource = "wotc_target_group_match";
        qualifyingFactors.push(`Matched WOTC groups: ${matchedGroups.join(", ")}`);
      }
    }
  }

  const category = program.programCategory;

  if (category === "veteran_credit") {
    if (wotcGroups.includes("qualified_veteran") || wotcGroups.includes("disabled_veteran")) {
      score = Math.max(score, 90);
      qualifyingFactors.push("Employee identified as veteran through WOTC screening");
      if (wotcGroups.includes("disabled_veteran")) {
        score = Math.max(score, 95);
        qualifyingFactors.push("Disabled veteran - higher credit tier");
      }
    }
  }

  if (category === "disability_credit") {
    if (
      wotcGroups.includes("vocational_rehabilitation") ||
      wotcGroups.includes("ssi_recipient") ||
      wotcGroups.includes("disabled_veteran")
    ) {
      score = Math.max(score, 85);
      qualifyingFactors.push("Employee has disability qualification from WOTC screening");
    }
  }

  if (category === "reentry_credit") {
    if (wotcGroups.includes("ex_felon")) {
      score = Math.max(score, 85);
      qualifyingFactors.push("Employee identified as ex-felon through WOTC screening");
    }
  }

  if (category === "youth_training_credit") {
    if (employeeAge !== null && employeeAge >= 16 && employeeAge <= 24) {
      score += 30;
      qualifyingFactors.push(`Employee age ${employeeAge} is within 16-24 range`);
    } else if (employeeAge !== null) {
      disqualifyingFactors.push(`Employee age ${employeeAge} is outside 16-24 range`);
    }
    if (wotcGroups.includes("summer_youth") || wotcGroups.includes("snap_recipient_age_18_39")) {
      score += 40;
      qualifyingFactors.push("WOTC youth/SNAP qualification supports eligibility");
    }
  }

  if (category === "enterprise_zone_credit") {
    const zoneCheck = checkZoneEligibility(context.worksites, program.state);
    if (zoneCheck.inZone) {
      score += 60;
      qualifyingFactors.push(`Worksite in designated zone: ${zoneCheck.zoneName}`);
    } else if (context.worksites.length === 0) {
      score += 10;
      disqualifyingFactors.push("No worksites registered - cannot verify zone eligibility");
    } else {
      disqualifyingFactors.push("No worksites found in designated zones for this state");
    }
  }

  if (employer_state_matches(context.employer, program.state)) {
    score += 5;
    qualifyingFactors.push(`Employer operates in ${program.state}`);
  }

  const eligible = score >= 70;

  const creditEstimate = eligible ? estimateCredit(program, context) : null;

  const questions = (program.screeningQuestions as any[]) || [];
  const requiredQuestions = autoScreened
    ? questions.filter((q: any) => !q.autoScreenField)
    : questions;

  return {
    programId: program.id,
    programName: program.programName,
    state: program.state,
    category: program.programCategory,
    eligible,
    score: Math.min(score, 100),
    autoScreened,
    autoScreenSource,
    qualifyingFactors,
    disqualifyingFactors,
    requiredQuestions,
    creditEstimate,
  };
}

function employer_state_matches(employer: any, programState: string): boolean {
  if (programState === "Federal") return true;
  return employer?.state?.toLowerCase() === programState?.toLowerCase();
}

function estimateCredit(program: any, context: ScreeningContext): number {
  const formula = program.creditFormula;
  const maxCredit = parseFloat(program.maxCreditAmount) || 0;
  const employee = context.employee;

  const annualWage = parseFloat(employee.annualSalary || employee.annual_salary || "0") ||
    (parseFloat(employee.hourlyWage || employee.hourly_wage || "15") * 2080);

  switch (formula) {
    case "wage_percentage": {
      const rate = 0.25;
      const firstYearWages = Math.min(annualWage, 24000);
      const credit = firstYearWages * rate;
      return Math.min(credit, maxCredit || credit);
    }
    case "per_employee_flat_plus_wage": {
      const flatAmount = 1500;
      const wageBonus = annualWage * 0.05;
      return Math.min(flatAmount + wageBonus, maxCredit || 5000);
    }
    case "percentage_of_expenditure": {
      return maxCredit || 5000;
    }
    default:
      return maxCredit || 2500;
  }
}

export async function calculateProgramCredits(
  screeningResultId: string
): Promise<any> {
  const [result] = await db
    .select()
    .from(programScreeningResults)
    .where(eq(programScreeningResults.id, screeningResultId));

  if (!result) throw new Error("Screening result not found");

  const [program] = await db
    .select()
    .from(taxCreditPrograms)
    .where(eq(taxCreditPrograms.id, result.programId));

  if (!program) throw new Error("Program not found");

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, result.employeeId));

  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.id, result.employerId));

  const worksites = await db
    .select()
    .from(employerWorksites)
    .where(eq(employerWorksites.employerId, result.employerId));

  const context: ScreeningContext = { employee, screening: {}, employer, worksites };

  const emp: any = employee || {};
  const annualWage =
    parseFloat(emp.annualSalary || emp.annual_salary || "0") ||
    parseFloat(emp.hourlyWage || emp.hourly_wage || "15") * 2080;

  const formula = program.creditFormula || "wage_percentage";
  const maxCredit = parseFloat(program.maxCreditAmount?.toString() || "0");

  let calculatedAmount = 0;
  let rateApplied = 0;
  let wagesUsed = 0;
  let method = formula;
  const details: any = {};

  switch (formula) {
    case "wage_percentage": {
      rateApplied = 0.25;
      wagesUsed = Math.min(annualWage, 24000);

      const hoursWorked = parseInt(emp.hoursWorked || emp.hours_worked || "0");
      if (hoursWorked >= 400) {
        rateApplied = 0.40;
        details.hourThreshold = "400+ hours (40% rate)";
      } else if (hoursWorked >= 120) {
        rateApplied = 0.25;
        details.hourThreshold = "120-399 hours (25% rate)";
      } else if (hoursWorked > 0) {
        rateApplied = 0;
        details.hourThreshold = "Under 120 hours (not yet eligible)";
      }

      calculatedAmount = wagesUsed * rateApplied;
      method = `${(rateApplied * 100).toFixed(0)}% of first-year wages (capped at $24,000)`;
      break;
    }
    case "per_employee_flat_plus_wage": {
      const flatAmount = 1500;
      rateApplied = 0.05;
      wagesUsed = annualWage;
      calculatedAmount = flatAmount + annualWage * rateApplied;
      method = `$1,500 flat + 5% of annual wages`;
      details.flatComponent = flatAmount;
      details.wageComponent = annualWage * rateApplied;
      break;
    }
    case "percentage_of_expenditure": {
      rateApplied = 0.20;
      calculatedAmount = maxCredit * rateApplied;
      method = `20% of qualified rehabilitation expenditure`;
      details.expenditureBased = true;
      break;
    }
    default: {
      calculatedAmount = maxCredit || 2500;
      method = "flat_amount";
    }
  }

  const cappedAmount = maxCredit > 0 ? Math.min(calculatedAmount, maxCredit) : calculatedAmount;
  const finalCreditAmount = cappedAmount;
  const currentYear = new Date().getFullYear();

  const [calc] = await db
    .insert(programCreditCalculations)
    .values({
      screeningResultId,
      employeeId: result.employeeId,
      employerId: result.employerId,
      programId: result.programId,
      calculationMethod: method,
      wagesUsed: wagesUsed.toFixed(2),
      hoursUsed: parseInt(emp.hoursWorked || "0") || null,
      rateApplied: rateApplied.toFixed(4),
      calculatedAmount: calculatedAmount.toFixed(2),
      cappedAmount: cappedAmount.toFixed(2),
      finalCreditAmount: finalCreditAmount.toFixed(2),
      calculationDetails: details,
      taxYear: currentYear,
      status: "calculated",
    })
    .returning();

  return calc;
}

export async function batchScreenEmployer(employerId: string): Promise<{
  employeesScreened: number;
  programsChecked: number;
  eligibleMatches: number;
  results: EligibilityResult[];
}> {
  const employerEmployees = await db
    .select()
    .from(employees)
    .where(eq(employees.employerId, employerId));

  let allResults: EligibilityResult[] = [];
  let eligibleMatches = 0;

  for (const emp of employerEmployees) {
    try {
      const results = await screenEmployeeForPrograms(emp.id, employerId);
      allResults = allResults.concat(results);
      eligibleMatches += results.filter((r) => r.eligible).length;
    } catch (err: any) {
      console.error(`[MultiCredit] Error screening employee ${emp.id}:`, err.message);
    }
  }

  const assignedPrograms = await db
    .select()
    .from(employerProgramAssignments)
    .where(
      and(eq(employerProgramAssignments.employerId, employerId), eq(employerProgramAssignments.isEnabled, true))
    );

  return {
    employeesScreened: employerEmployees.length,
    programsChecked: assignedPrograms.length,
    eligibleMatches,
    results: allResults,
  };
}

export async function getScreeningSummary(employerId: string): Promise<any> {
  const results = await db
    .select({
      result: programScreeningResults,
      program: taxCreditPrograms,
    })
    .from(programScreeningResults)
    .innerJoin(taxCreditPrograms, eq(programScreeningResults.programId, taxCreditPrograms.id))
    .where(eq(programScreeningResults.employerId, employerId));

  const calculations = await db
    .select({
      calc: programCreditCalculations,
      program: taxCreditPrograms,
    })
    .from(programCreditCalculations)
    .innerJoin(taxCreditPrograms, eq(programCreditCalculations.programId, taxCreditPrograms.id))
    .where(eq(programCreditCalculations.employerId, employerId));

  const byProgram: Record<string, any> = {};

  for (const { result, program } of results) {
    if (!byProgram[program.id]) {
      byProgram[program.id] = {
        programId: program.id,
        programName: program.programName,
        state: program.state,
        category: program.programCategory,
        tier: program.tier,
        eligible: 0,
        pending: 0,
        ineligible: 0,
        totalCredits: 0,
      };
    }
    if (result.eligibilityResult === "eligible") byProgram[program.id].eligible++;
    else if (result.screeningStatus === "pending") byProgram[program.id].pending++;
    else byProgram[program.id].ineligible++;
  }

  for (const { calc, program } of calculations) {
    if (byProgram[program.id]) {
      byProgram[program.id].totalCredits += parseFloat(calc.finalCreditAmount?.toString() || "0");
    }
  }

  const totalEstimatedCredits = Object.values(byProgram).reduce(
    (sum: number, p: any) => sum + p.totalCredits,
    0
  );
  const totalEligible = Object.values(byProgram).reduce(
    (sum: number, p: any) => sum + p.eligible,
    0
  );

  return {
    programs: Object.values(byProgram),
    summary: {
      totalPrograms: Object.keys(byProgram).length,
      totalEligible,
      totalEstimatedCredits,
      byCategory: groupByCategory(Object.values(byProgram)),
    },
  };
}

function groupByCategory(programs: any[]): Record<string, any> {
  const grouped: Record<string, any> = {};
  for (const p of programs) {
    if (!grouped[p.category]) {
      grouped[p.category] = { count: 0, eligible: 0, totalCredits: 0 };
    }
    grouped[p.category].count++;
    grouped[p.category].eligible += p.eligible;
    grouped[p.category].totalCredits += p.totalCredits;
  }
  return grouped;
}
