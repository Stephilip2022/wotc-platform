import { db } from "../db";
import { employees, employers, screenings, otherTaxCredits } from "../../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface CreditOpportunity {
  creditType: string;
  creditName: string;
  creditCategory: string;
  eligibilityScore: number;
  estimatedValue: number;
  minimumValue: number;
  maximumValue: number;
  eligibilityCriteria: any;
  aiAnalysis: any;
  requiredDocumentation: string[];
  nextSteps: any[];
  jurisdiction?: string;
}

/**
 * R&D Tax Credit Analysis
 * Identifies employees in qualified research activities
 */
async function analyzeRDCredit(employee: any, employer: any): Promise<CreditOpportunity | null> {
  const rdQualifyingRoles = [
    "software engineer",
    "software developer",
    "data scientist",
    "research scientist",
    "engineer",
    "scientist",
    "developer",
    "programmer",
    "architect",
    "machine learning",
    "ai engineer",
    "product engineer",
  ];

  const jobTitle = employee.jobTitle?.toLowerCase() || "";
  const qualifies = rdQualifyingRoles.some(role => jobTitle.includes(role));

  if (!qualifies) {
    return null;
  }

  // Use OpenAI to analyze R&D eligibility
  const prompt = `Analyze R&D Tax Credit eligibility for this employee:

Job Title: ${employee.jobTitle}
Department: ${employee.department || "Not specified"}
Employer Industry: ${employer.industry || "Not specified"}

The R&D Tax Credit is for companies that conduct qualified research activities including:
- Developing new or improved products, processes, software, techniques, formulas, or inventions
- Activities that rely on principles of physical or biological sciences, engineering, or computer science
- Systematic experimentation to resolve technical uncertainty

Provide analysis in JSON format:
{
  "eligible": <true|false>,
  "eligibilityScore": <0-100>,
  "estimatedValue": <dollar amount>,
  "minimumValue": <minimum dollar amount>,
  "maximumValue": <maximum dollar amount>,
  "analysis": {
    "reasoning": "explanation of why this employee qualifies",
    "qualifyingActivities": ["activity 1", "activity 2"],
    "technicalUncertainty": "areas where technical uncertainty likely exists"
  },
  "requiredDocumentation": ["doc type 1", "doc type 2"],
  "nextSteps": [
    {
      "action": "specific action to take",
      "priority": "high|medium|low",
      "description": "why this action is needed"
    }
  ]
}

Be conservative in eligibility scoring. Focus on actual R&D activities.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an R&D tax credit expert. Always respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const analysis = JSON.parse(completion.choices[0].message.content || "{}");

    if (!analysis.eligible || analysis.eligibilityScore < 50) {
      return null;
    }

    return {
      creditType: "rd_tax_credit",
      creditName: "Federal R&D Tax Credit",
      creditCategory: "federal",
      eligibilityScore: analysis.eligibilityScore,
      estimatedValue: analysis.estimatedValue,
      minimumValue: analysis.minimumValue,
      maximumValue: analysis.maximumValue,
      eligibilityCriteria: {
        role: employee.jobTitle,
        department: employee.department,
        qualifyingActivities: analysis.analysis.qualifyingActivities,
      },
      aiAnalysis: analysis.analysis,
      requiredDocumentation: analysis.requiredDocumentation,
      nextSteps: analysis.nextSteps,
    };
  } catch (error) {
    console.error("Error analyzing R&D credit:", error);
    return null;
  }
}

/**
 * State Hiring Incentive Analysis
 * Identifies state-specific hiring tax credits and incentives
 */
async function analyzeStateIncentives(employee: any, employer: any): Promise<CreditOpportunity[]> {
  const opportunities: CreditOpportunity[] = [];

  // State-specific incentive rules (simplified - real implementation would have comprehensive state database)
  const stateIncentiveRules = {
    "CA": {
      name: "California Competes Tax Credit",
      description: "For businesses that create new jobs or invest in California",
      eligibleIndustries: ["technology", "manufacturing", "clean energy"],
      estimatedValuePerEmployee: 3000,
    },
    "NY": {
      name: "Excelsior Jobs Program",
      description: "For businesses in strategic industries",
      eligibleIndustries: ["software", "technology", "biotech", "manufacturing"],
      estimatedValuePerEmployee: 5000,
    },
    "TX": {
      name: "Texas Enterprise Fund",
      description: "For major economic development projects",
      eligibleIndustries: ["technology", "manufacturing", "energy"],
      estimatedValuePerEmployee: 2500,
    },
    "FL": {
      name: "Qualified Target Industry Tax Refund",
      description: "For high-wage job creation",
      eligibleIndustries: ["technology", "manufacturing", "life sciences"],
      estimatedValuePerEmployee: 3000,
    },
  };

  const employeeState = employee.state || employer.state;
  const stateIncentive = stateIncentiveRules[employeeState as keyof typeof stateIncentiveRules];

  if (stateIncentive) {
    const employerIndustry = employer.industry?.toLowerCase() || "";
    const qualifies = stateIncentive.eligibleIndustries.some(industry => 
      employerIndustry.includes(industry)
    );

    if (qualifies) {
      opportunities.push({
        creditType: "state_hiring_incentive",
        creditName: stateIncentive.name,
        creditCategory: "state",
        eligibilityScore: 75,
        estimatedValue: stateIncentive.estimatedValuePerEmployee,
        minimumValue: stateIncentive.estimatedValuePerEmployee * 0.7,
        maximumValue: stateIncentive.estimatedValuePerEmployee * 1.3,
        eligibilityCriteria: {
          state: employeeState,
          industry: employer.industry,
          eligibleIndustries: stateIncentive.eligibleIndustries,
        },
        aiAnalysis: {
          reasoning: stateIncentive.description,
          matchedIndustry: employerIndustry,
        },
        requiredDocumentation: [
          "Proof of job creation",
          "Payroll records",
          "Business registration in state",
        ],
        nextSteps: [
          {
            action: "Apply to state economic development office",
            priority: "medium",
            description: "Submit application with job creation documentation",
          },
        ],
        jurisdiction: employeeState,
      });
    }
  }

  return opportunities;
}

/**
 * New Markets Tax Credit Analysis
 * For businesses operating in low-income communities
 */
async function analyzeNewMarketsCredit(employee: any, employer: any): Promise<CreditOpportunity | null> {
  // Simplified ZIP code analysis (real implementation would use comprehensive NMTC census tract database)
  const nmtcQualifiedZips = [
    "90001", "90002", "90003", // Los Angeles low-income areas
    "10001", "10002", "10003", // NYC low-income areas
    "60601", "60602", "60603", // Chicago low-income areas
    // Add more qualified census tracts
  ];

  const employerZip = employer.zipCode?.substring(0, 5);
  const qualifies = nmtcQualifiedZips.includes(employerZip);

  if (!qualifies) {
    return null;
  }

  return {
    creditType: "new_markets_tax_credit",
    creditName: "New Markets Tax Credit",
    creditCategory: "federal",
    eligibilityScore: 70,
    estimatedValue: 5000, // Per-employee approximation
    minimumValue: 3000,
    maximumValue: 8000,
    eligibilityCriteria: {
      location: employer.zipCode,
      qualifiedCommunity: true,
    },
    aiAnalysis: {
      reasoning: "Business operates in a qualified low-income community eligible for NMTC",
      censusTract: "Qualified based on ZIP code analysis",
    },
    requiredDocumentation: [
      "Business address verification",
      "Census tract documentation",
      "Qualified investment documentation",
    ],
    nextSteps: [
      {
        action: "Consult with NMTC advisor",
        priority: "medium",
        description: "Work with Community Development Entity (CDE) to structure investment",
      },
    ],
  };
}

/**
 * Disabled Access Credit Analysis
 * For businesses that hire individuals with disabilities
 */
async function analyzeDisabledAccessCredit(employee: any, employer: any, screening: any): Promise<CreditOpportunity | null> {
  // Check if employee qualified for WOTC disability target groups
  const disabilityTargetGroups = ["V-Disability", "Disabled Veterans"];
  const hasDisabilityTargetGroup = screening?.primaryTargetGroup && 
    disabilityTargetGroups.some(group => screening.primaryTargetGroup.includes(group));

  if (!hasDisabilityTargetGroup) {
    return null;
  }

  return {
    creditType: "disabled_access_credit",
    creditName: "Disabled Access Credit",
    creditCategory: "federal",
    eligibilityScore: 85,
    estimatedValue: 5000,
    minimumValue: 2500,
    maximumValue: 10250, // Actual max is $10,250
    eligibilityCriteria: {
      employeeDisability: true,
      targetGroup: screening.primaryTargetGroup,
    },
    aiAnalysis: {
      reasoning: "Employee qualifies for WOTC disability category, likely eligible for Disabled Access Credit for accommodations",
      accessibilityImprovements: "Credit available for accessibility improvements and accommodations",
    },
    requiredDocumentation: [
      "Documentation of disability",
      "Accessibility improvement expenses",
      "Reasonable accommodation costs",
    ],
    nextSteps: [
      {
        action: "Document accessibility improvements",
        priority: "high",
        description: "Track all expenses related to making workplace accessible",
      },
      {
        action: "Claim on Form 8826",
        priority: "high",
        description: "File Form 8826 with tax return to claim credit",
      },
    ],
  };
}

/**
 * Comprehensive multi-credit scan for an employee
 */
export async function scanEmployeeForCredits(employeeId: string): Promise<CreditOpportunity[]> {
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) {
    throw new Error("Employee not found");
  }

  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.id, employee.employerId))
    .limit(1);

  if (!employer) {
    throw new Error("Employer not found");
  }

  const [screening] = await db
    .select()
    .from(screenings)
    .where(eq(screenings.employeeId, employeeId))
    .orderBy(desc(screenings.createdAt))
    .limit(1);

  const opportunities: CreditOpportunity[] = [];

  // R&D Tax Credit
  const rdCredit = await analyzeRDCredit(employee, employer);
  if (rdCredit) {
    opportunities.push(rdCredit);
  }

  // State Incentives
  const stateIncentives = await analyzeStateIncentives(employee, employer);
  opportunities.push(...stateIncentives);

  // New Markets Tax Credit
  const nmtcCredit = await analyzeNewMarketsCredit(employee, employer);
  if (nmtcCredit) {
    opportunities.push(nmtcCredit);
  }

  // Disabled Access Credit
  const disabledCredit = await analyzeDisabledAccessCredit(employee, employer, screening);
  if (disabledCredit) {
    opportunities.push(disabledCredit);
  }

  // Save identified credits to database
  for (const opportunity of opportunities) {
    await db.insert(otherTaxCredits).values({
      employeeId,
      employerId: employee.employerId,
      creditType: opportunity.creditType,
      creditName: opportunity.creditName,
      creditCategory: opportunity.creditCategory,
      eligibilityScore: opportunity.eligibilityScore,
      status: "identified",
      estimatedValue: opportunity.estimatedValue.toFixed(2),
      minimumValue: opportunity.minimumValue.toFixed(2),
      maximumValue: opportunity.maximumValue.toFixed(2),
      eligibilityCriteria: opportunity.eligibilityCriteria,
      aiAnalysis: opportunity.aiAnalysis,
      requiredDocumentation: opportunity.requiredDocumentation,
      nextSteps: opportunity.nextSteps,
      jurisdiction: opportunity.jurisdiction,
      identifiedBy: "ai_scan",
    });
  }

  return opportunities;
}

/**
 * Get other tax credits for an employee
 */
export async function getEmployeeOtherCredits(employeeId: string) {
  const credits = await db
    .select()
    .from(otherTaxCredits)
    .where(eq(otherTaxCredits.employeeId, employeeId))
    .orderBy(desc(otherTaxCredits.eligibilityScore));

  return credits;
}

/**
 * Get all identified other tax credits for an employer
 */
export async function getEmployerOtherCredits(employerId: string) {
  const credits = await db
    .select({
      credit: otherTaxCredits,
      employee: employees,
    })
    .from(otherTaxCredits)
    .innerJoin(employees, eq(employees.id, otherTaxCredits.employeeId))
    .where(eq(otherTaxCredits.employerId, employerId))
    .orderBy(desc(otherTaxCredits.estimatedValue));

  return credits;
}

/**
 * Batch scan all employees for an employer
 */
export async function batchScanEmployer(employerId: string): Promise<number> {
  const allEmployees = await db
    .select()
    .from(employees)
    .where(eq(employees.employerId, employerId));

  let scanned = 0;
  for (const employee of allEmployees) {
    try {
      await scanEmployeeForCredits(employee.id);
      scanned++;
    } catch (error) {
      console.error(`Error scanning employee ${employee.id}:`, error);
    }
  }

  return scanned;
}
