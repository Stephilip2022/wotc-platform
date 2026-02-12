import { db } from "../db";
import { eq, and, inArray } from "drizzle-orm";
import {
  taxCreditPrograms,
  programSubmissions,
  programScreeningResults,
  programCreditCalculations,
  employers,
  employees,
} from "@shared/schema";

interface SubmissionConfig {
  channel: "sftp" | "portal" | "mail" | "api" | "manual";
  format: "fixed_width" | "csv" | "pdf" | "xml" | "json";
  agency: string;
  portalUrl?: string;
  sftpHost?: string;
  formNumbers?: string[];
  deadlines?: { annual?: string; quarterly?: string };
}

const STATE_SUBMISSION_CONFIGS: Record<string, Record<string, SubmissionConfig>> = {
  veteran_credit: {
    default: {
      channel: "mail",
      format: "pdf",
      agency: "State Department of Labor / Veterans Affairs",
      formNumbers: ["State Veteran Tax Credit Application"],
      deadlines: { annual: "April 15" },
    },
  },
  disability_credit: {
    default: {
      channel: "mail",
      format: "pdf",
      agency: "State Vocational Rehabilitation Agency",
      formNumbers: ["Disability Employment Tax Credit Application"],
      deadlines: { annual: "April 15" },
    },
  },
  reentry_credit: {
    default: {
      channel: "mail",
      format: "pdf",
      agency: "State Department of Corrections / Labor",
      formNumbers: ["Re-entry Employment Tax Credit Application"],
      deadlines: { annual: "April 15" },
    },
  },
  youth_training_credit: {
    default: {
      channel: "mail",
      format: "pdf",
      agency: "State Department of Labor / Education",
      formNumbers: ["Youth Employment / Apprenticeship Tax Credit Application"],
      deadlines: { annual: "April 15" },
    },
  },
  enterprise_zone_credit: {
    default: {
      channel: "portal",
      format: "pdf",
      agency: "State Economic Development Agency",
      formNumbers: ["Enterprise Zone Tax Credit Application", "Zone Certification"],
      deadlines: { annual: "March 1" },
    },
  },
  general_screening: {
    default: {
      channel: "mail",
      format: "pdf",
      agency: "State Historic Preservation Office / Tax Authority",
      formNumbers: ["State Tax Credit Application"],
      deadlines: { annual: "April 15" },
    },
  },
};

const CSDC_STATES = ["AL", "AR", "CO", "GA", "ID", "OK", "OR", "SC", "VT", "WV"];

function getSubmissionConfig(category: string, state: string): SubmissionConfig {
  const stateAbbr = state.length === 2 ? state : getStateAbbr(state);

  if (CSDC_STATES.includes(stateAbbr) && (category === "veteran_credit" || category === "disability_credit" || category === "reentry_credit" || category === "youth_training_credit")) {
    return {
      channel: "sftp",
      format: "fixed_width",
      agency: "CSDC (via SFTP to hermes.csdco.com)",
      sftpHost: "hermes.csdco.com",
      formNumbers: ["CSDC Fixed-Width File"],
      deadlines: { quarterly: "End of quarter" },
    };
  }

  const categoryConfigs = STATE_SUBMISSION_CONFIGS[category];
  return categoryConfigs?.default || STATE_SUBMISSION_CONFIGS.general_screening.default;
}

function getStateAbbr(stateName: string): string {
  const map: Record<string, string> = {
    Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
    Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
    Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
    Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
    Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
    Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
    "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
    Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI",
    "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
    Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
    Wisconsin: "WI", Wyoming: "WY",
  };
  return map[stateName] || stateName;
}

export async function createProgramSubmission(
  employerId: string,
  programId: string,
  employeeIds: string[]
): Promise<any> {
  const [program] = await db.select().from(taxCreditPrograms).where(eq(taxCreditPrograms.id, programId));
  if (!program) throw new Error("Program not found");

  const config = getSubmissionConfig(program.programCategory, program.state);

  const calculations = await db
    .select()
    .from(programCreditCalculations)
    .where(
      and(
        eq(programCreditCalculations.programId, programId),
        eq(programCreditCalculations.employerId, employerId)
      )
    );

  const matchingCalcs = calculations.filter((c) => employeeIds.includes(c.employeeId));
  const totalCredit = matchingCalcs.reduce(
    (sum, c) => sum + parseFloat(c.finalCreditAmount?.toString() || "0"),
    0
  );

  const [submission] = await db
    .insert(programSubmissions)
    .values({
      employerId,
      programId,
      submissionType: program.programCategory,
      submissionChannel: config.channel,
      employeeIds,
      recordCount: employeeIds.length,
      totalCreditAmount: totalCredit.toFixed(2),
      fileFormat: config.format,
      submissionStatus: "pending",
      metadata: {
        agency: config.agency,
        formNumbers: config.formNumbers,
        deadlines: config.deadlines,
        portalUrl: config.portalUrl,
        sftpHost: config.sftpHost,
        programState: program.state,
        programCategory: program.programCategory,
      },
    })
    .returning();

  return {
    submission,
    config,
    totalCreditAmount: totalCredit,
    instructions: generateSubmissionInstructions(config, program),
  };
}

function generateSubmissionInstructions(config: SubmissionConfig, program: any): string[] {
  const instructions: string[] = [];

  switch (config.channel) {
    case "sftp":
      instructions.push(`Generate fixed-width file for ${program.state}`);
      instructions.push(`Upload via SFTP to ${config.sftpHost || "hermes.csdco.com"}`);
      instructions.push(`File will be placed in ${program.state}.DIR;1/ directory`);
      instructions.push("Monitor for determination response files");
      break;
    case "portal":
      instructions.push(`Log into ${config.agency} online portal`);
      if (config.portalUrl) instructions.push(`Portal URL: ${config.portalUrl}`);
      instructions.push(`Complete required forms: ${config.formNumbers?.join(", ")}`);
      instructions.push("Upload supporting documentation");
      instructions.push("Submit and note confirmation number");
      break;
    case "mail":
      instructions.push(`Complete forms: ${config.formNumbers?.join(", ")}`);
      instructions.push(`Mail to: ${config.agency}`);
      instructions.push("Include all supporting documentation");
      instructions.push("Send via certified mail for tracking");
      break;
    case "api":
      instructions.push("Submission will be sent electronically via API");
      instructions.push(`Agency: ${config.agency}`);
      break;
    case "manual":
      instructions.push(`Contact ${config.agency} directly`);
      instructions.push("Prepare all required documentation");
      break;
  }

  if (config.deadlines?.annual) {
    instructions.push(`Annual deadline: ${config.deadlines.annual}`);
  }
  if (config.deadlines?.quarterly) {
    instructions.push(`Quarterly deadline: ${config.deadlines.quarterly}`);
  }

  return instructions;
}

export async function getSubmissionQueue(employerId: string): Promise<any[]> {
  const subs = await db
    .select({
      submission: programSubmissions,
      program: taxCreditPrograms,
    })
    .from(programSubmissions)
    .innerJoin(taxCreditPrograms, eq(programSubmissions.programId, taxCreditPrograms.id))
    .where(eq(programSubmissions.employerId, employerId));

  return subs.map(({ submission, program }) => ({
    ...submission,
    programName: program.programName,
    programState: program.state,
    programCategory: program.programCategory,
  }));
}

export async function updateSubmissionStatus(
  submissionId: string,
  status: string,
  additionalData?: {
    stateReferenceNumber?: string;
    rejectionReason?: string;
    approvedAmount?: string;
  }
): Promise<any> {
  const updates: any = {
    submissionStatus: status,
    updatedAt: new Date(),
  };

  if (status === "submitted") updates.submittedAt = new Date();
  if (status === "confirmed") updates.confirmedAt = new Date();
  if (status === "rejected") {
    updates.rejectedAt = new Date();
    if (additionalData?.rejectionReason) updates.rejectionReason = additionalData.rejectionReason;
  }
  if (additionalData?.stateReferenceNumber) updates.stateReferenceNumber = additionalData.stateReferenceNumber;
  if (additionalData?.approvedAmount) updates.approvedAmount = additionalData.approvedAmount;

  const [updated] = await db
    .update(programSubmissions)
    .set(updates)
    .where(eq(programSubmissions.id, submissionId))
    .returning();

  return updated;
}

export async function getSubmissionStats(employerId: string): Promise<any> {
  const subs = await db
    .select()
    .from(programSubmissions)
    .where(eq(programSubmissions.employerId, employerId));

  const pending = subs.filter((s) => s.submissionStatus === "pending").length;
  const submitted = subs.filter((s) => s.submissionStatus === "submitted").length;
  const confirmed = subs.filter((s) => s.submissionStatus === "confirmed").length;
  const rejected = subs.filter((s) => s.submissionStatus === "rejected").length;

  const totalPending = subs
    .filter((s) => s.submissionStatus === "pending")
    .reduce((sum, s) => sum + parseFloat(s.totalCreditAmount?.toString() || "0"), 0);

  const totalApproved = subs
    .filter((s) => s.submissionStatus === "confirmed")
    .reduce((sum, s) => sum + parseFloat(s.approvedAmount?.toString() || s.totalCreditAmount?.toString() || "0"), 0);

  return {
    total: subs.length,
    pending,
    submitted,
    confirmed,
    rejected,
    totalPendingAmount: totalPending,
    totalApprovedAmount: totalApproved,
  };
}
