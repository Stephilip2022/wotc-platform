// WOTC Target Group Determination Engine
// Reference: IRS Form 8850 and ETA Form 9061/9062

interface QuestionnaireResponse {
  [questionId: string]: any;
}

interface Question {
  id: string;
  question: string;
  type: string;
  targetGroup?: string; // Which target group this question maps to
  eligibilityTrigger?: string | string[]; // Which answer(s) trigger eligibility
  required?: boolean;
  options?: string[];
}

export interface TargetGroup {
  code: string;
  name: string;
  maxCredit: number;
  hoursRequired: number;
  qualifiedWageCap: number;
  secondYearWageCap?: number;
  secondYearRate?: number;
}

// WOTC Target Groups (2024) with IRS-defined wage caps
export const TARGET_GROUPS: Record<string, TargetGroup> = {
  "IV-A": {
    code: "IV-A",
    name: "TANF Recipient (Long-term, 18+ months)",
    maxCredit: 9000,
    hoursRequired: 400,
    qualifiedWageCap: 10000,
    secondYearWageCap: 10000,
    secondYearRate: 0.50,
  },
  "IV-B": {
    code: "IV-B",
    name: "TANF Recipient (Short-term)",
    maxCredit: 2400,
    hoursRequired: 120,
    qualifiedWageCap: 6000,
  },
  "V": {
    code: "V",
    name: "Qualified Veteran",
    maxCredit: 2400,
    hoursRequired: 400,
    qualifiedWageCap: 6000,
  },
  "V-SNAP": {
    code: "V-SNAP",
    name: "Veteran (SNAP Recipient)",
    maxCredit: 2400,
    hoursRequired: 400,
    qualifiedWageCap: 6000,
  },
  "V-DISABLED": {
    code: "V-DISABLED",
    name: "Disabled Veteran (discharged past year)",
    maxCredit: 4800,
    hoursRequired: 400,
    qualifiedWageCap: 12000,
  },
  "V-UNEMPLOYED": {
    code: "V-UNEMPLOYED",
    name: "Veteran (unemployed 4 weeks to 6 months)",
    maxCredit: 2400,
    hoursRequired: 400,
    qualifiedWageCap: 6000,
  },
  "V-UNEMPLOYED-6MO": {
    code: "V-UNEMPLOYED-6MO",
    name: "Veteran (unemployed 6+ months)",
    maxCredit: 5600,
    hoursRequired: 400,
    qualifiedWageCap: 14000,
  },
  "V-DISABLED-UNEMPLOYED": {
    code: "V-DISABLED-UNEMPLOYED",
    name: "Disabled Veteran (unemployed 6+ months)",
    maxCredit: 9600,
    hoursRequired: 400,
    qualifiedWageCap: 24000,
  },
  "VI": {
    code: "VI",
    name: "Ex-Felon",
    maxCredit: 2400,
    hoursRequired: 400,
    qualifiedWageCap: 6000,
  },
  "VII": {
    code: "VII",
    name: "Designated Community Resident",
    maxCredit: 2400,
    hoursRequired: 400,
    qualifiedWageCap: 6000,
  },
  "VIII": {
    code: "VIII",
    name: "Vocational Rehabilitation Referral",
    maxCredit: 2400,
    hoursRequired: 400,
    qualifiedWageCap: 6000,
  },
  "IX": {
    code: "IX",
    name: "SNAP Recipient (age 18-39)",
    maxCredit: 2400,
    hoursRequired: 400,
    qualifiedWageCap: 6000,
  },
  "X": {
    code: "X",
    name: "SSI Recipient",
    maxCredit: 2400,
    hoursRequired: 400,
    qualifiedWageCap: 6000,
  },
  "XI": {
    code: "XI",
    name: "Summer Youth Employee",
    maxCredit: 1200,
    hoursRequired: 120,
    qualifiedWageCap: 3000,
  },
};

/**
 * Helper function to normalize target group names to their codes
 * Handles various display formats and returns the correct TARGET_GROUPS key
 */
export function normalizeTargetGroup(targetGroup: string): string | null {
  if (!targetGroup) return null;
  
  // If it's already a valid code, return it
  if (TARGET_GROUPS[targetGroup]) {
    return targetGroup;
  }
  
  // Normalize the string for comparison
  const normalized = targetGroup.toLowerCase().trim();
  
  // Map common variations to codes
  const mappings: Record<string, string> = {
    "tanf": "IV-B", // Default to short-term
    "tanf recipient": "IV-B",
    "tanf recipients": "IV-B",
    "tanf recipient (short-term)": "IV-B",
    "tanf recipient (long-term)": "IV-A",
    "veteran": "V",
    "veterans": "V",
    "qualified veteran": "V",
    "qualified veterans": "V",
    "ex-felon": "VI",
    "ex-felons": "VI",
    "felon": "VI",
    "designated community resident": "VII",
    "community resident": "VII",
    "vocational rehabilitation": "VIII",
    "vocational rehabilitation referral": "VIII",
    "snap": "IX",
    "snap recipient": "IX",
    "snap recipients": "IX",
    "food stamps": "IX",
    "ssi": "X",
    "ssi recipient": "X",
    "ssi recipients": "X",
    "summer youth": "XI",
    "summer youth employee": "XI",
  };
  
  const code = mappings[normalized];
  if (code) {
    return code;
  }
  
  // Try to find by matching against official names
  for (const [code, info] of Object.entries(TARGET_GROUPS)) {
    if (info.name.toLowerCase() === normalized) {
      return code;
    }
  }
  
  return null;
}

export interface EligibilityResult {
  isEligible: boolean;
  targetGroups: string[];
  primaryTargetGroup: string | null;
  maxPotentialCredit: number;
  reason: string;
}

/**
 * Determine WOTC eligibility based on questionnaire responses and question metadata
 * This is metadata-driven and works with any dynamically configured questionnaire
 */
export function determineEligibility(
  responses: QuestionnaireResponse,
  questions: Question[],
  dateOfBirth?: string,
  hireDate?: string
): EligibilityResult {
  const eligibleGroups: Set<string> = new Set();
  let maxCredit = 0;
  const reasons: string[] = [];

  // Helper function to check if response matches trigger
  const responseMatchesTrigger = (response: any, trigger: string | string[]): boolean => {
    if (Array.isArray(trigger)) {
      return trigger.some((t) => {
        if (Array.isArray(response)) {
          return response.includes(t);
        }
        return response === t;
      });
    }
    if (Array.isArray(response)) {
      return response.includes(trigger);
    }
    return response === trigger;
  };

  // Process each question based on its metadata
  for (const question of questions) {
    if (!question.targetGroup || !question.eligibilityTrigger) {
      continue; // Skip questions without eligibility mapping
    }

    const response = responses[question.id];
    if (!response) {
      continue; // No response for this question
    }

    // Check if response triggers eligibility
    if (responseMatchesTrigger(response, question.eligibilityTrigger)) {
      const targetGroup = question.targetGroup;
      
      if (TARGET_GROUPS[targetGroup]) {
        eligibleGroups.add(targetGroup);
        reasons.push(`Qualified for ${TARGET_GROUPS[targetGroup].name}`);
        
        if (TARGET_GROUPS[targetGroup].maxCredit > maxCredit) {
          maxCredit = TARGET_GROUPS[targetGroup].maxCredit;
        }
      }
    }
  }

  // Additional age-based eligibility check for Summer Youth
  if (dateOfBirth && hireDate) {
    const age = calculateAge(dateOfBirth);
    if (age >= 16 && age <= 17) {
      const hDate = new Date(hireDate);
      const month = hDate.getMonth();
      if (month >= 4 && month <= 8) {
        eligibleGroups.add("XI");
        reasons.push("Summer youth employee (age 16-17, hired during summer)");
        if (TARGET_GROUPS["XI"].maxCredit > maxCredit) {
          maxCredit = TARGET_GROUPS["XI"].maxCredit;
        }
      }
    }
  }

  // Determine primary target group (highest credit value)
  let primaryTargetGroup: string | null = null;
  let highestCredit = 0;

  for (const group of Array.from(eligibleGroups)) {
    if (TARGET_GROUPS[group].maxCredit > highestCredit) {
      highestCredit = TARGET_GROUPS[group].maxCredit;
      primaryTargetGroup = group;
    }
  }

  return {
    isEligible: eligibleGroups.size > 0,
    targetGroups: Array.from(eligibleGroups),
    primaryTargetGroup,
    maxPotentialCredit: maxCredit,
    reason: eligibleGroups.size > 0
      ? reasons.join("; ")
      : "No qualifying target groups identified",
  };
}

/**
 * Helper function to calculate age from date of birth
 */
function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export interface CreditBreakdown {
  totalCredit: number;
  firstYearCredit: number;
  secondYearCredit: number;
  creditPercentage: number;
  qualifiedFirstYearWages: number;
  qualifiedSecondYearWages: number;
  wageCap: number;
  hoursWorked: number;
  hoursTier: '0-119' | '120-399' | '400+';
  targetGroupCode: string;
  targetGroupName: string;
}

/**
 * Calculate actual WOTC credit based on hours worked and wages
 * 
 * IRS WOTC Credit Calculation Rules:
 * - < 120 hours: No credit
 * - 120-399 hours: 25% of qualified first-year wages (up to wage cap)
 * - 400+ hours: 40% of qualified first-year wages (up to wage cap)
 * 
 * Wage caps vary by target group:
 * - Standard (most groups): $6,000 first-year wages → max $2,400 credit
 * - Long-term TANF (IV-A): $10,000 first-year + $10,000 second-year (at 50%) → max $9,000
 * - Disabled Veteran (V-DISABLED): $12,000 → max $4,800
 * - Disabled Veteran unemployed 6+ months (V-DISABLED-UNEMPLOYED): $24,000 → max $9,600
 * - Veteran unemployed 6+ months (V-UNEMPLOYED-6MO): $14,000 → max $5,600
 * - Summer Youth (XI): $3,000 → max $1,200
 */
export function calculateCredit(
  targetGroupCode: string,
  hoursWorked: number,
  wagesEarned: number,
  secondYearWages?: number
): number {
  return calculateCreditDetailed(targetGroupCode, hoursWorked, wagesEarned, secondYearWages).totalCredit;
}

export function calculateCreditDetailed(
  targetGroupCode: string,
  hoursWorked: number,
  wagesEarned: number,
  secondYearWages?: number
): CreditBreakdown {
  const targetGroup = TARGET_GROUPS[targetGroupCode];
  const empty: CreditBreakdown = {
    totalCredit: 0,
    firstYearCredit: 0,
    secondYearCredit: 0,
    creditPercentage: 0,
    qualifiedFirstYearWages: 0,
    qualifiedSecondYearWages: 0,
    wageCap: 0,
    hoursWorked,
    hoursTier: '0-119',
    targetGroupCode,
    targetGroupName: targetGroup?.name || 'Unknown',
  };

  if (!targetGroup) return empty;

  if (hoursWorked < 120) return { ...empty, wageCap: targetGroup.qualifiedWageCap };

  const creditPercentage = hoursWorked >= 400 ? 0.40 : 0.25;
  const hoursTier = hoursWorked >= 400 ? '400+' : '120-399';

  const qualifiedFirstYearWages = Math.min(wagesEarned, targetGroup.qualifiedWageCap);
  const firstYearCredit = qualifiedFirstYearWages * creditPercentage;

  let secondYearCredit = 0;
  let qualifiedSecondYearWages = 0;

  if (targetGroup.secondYearWageCap && targetGroup.secondYearRate && secondYearWages && secondYearWages > 0) {
    qualifiedSecondYearWages = Math.min(secondYearWages, targetGroup.secondYearWageCap);
    secondYearCredit = qualifiedSecondYearWages * targetGroup.secondYearRate;
  }

  const totalCredit = Math.min(firstYearCredit + secondYearCredit, targetGroup.maxCredit);

  return {
    totalCredit: Math.round(totalCredit * 100) / 100,
    firstYearCredit: Math.round(firstYearCredit * 100) / 100,
    secondYearCredit: Math.round(secondYearCredit * 100) / 100,
    creditPercentage,
    qualifiedFirstYearWages,
    qualifiedSecondYearWages,
    wageCap: targetGroup.qualifiedWageCap,
    hoursWorked,
    hoursTier,
    targetGroupCode,
    targetGroupName: targetGroup.name,
  };
}
