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
}

// WOTC Target Groups (2024)
export const TARGET_GROUPS: Record<string, TargetGroup> = {
  "IV-A": {
    code: "IV-A",
    name: "TANF Recipient (Long-term)",
    maxCredit: 9000,
    hoursRequired: 400,
  },
  "IV-B": {
    code: "IV-B",
    name: "TANF Recipient (Short-term)",
    maxCredit: 2400,
    hoursRequired: 120,
  },
  "V": {
    code: "V",
    name: "Qualified Veteran",
    maxCredit: 9600,
    hoursRequired: 400,
  },
  "VI": {
    code: "VI",
    name: "Ex-Felon",
    maxCredit: 2400,
    hoursRequired: 400,
  },
  "VII": {
    code: "VII",
    name: "Designated Community Resident",
    maxCredit: 2400,
    hoursRequired: 400,
  },
  "VIII": {
    code: "VIII",
    name: "Vocational Rehabilitation Referral",
    maxCredit: 2400,
    hoursRequired: 400,
  },
  "IX": {
    code: "IX",
    name: "SNAP Recipient",
    maxCredit: 2400,
    hoursRequired: 400,
  },
  "X": {
    code: "X",
    name: "SSI Recipient",
    maxCredit: 2400,
    hoursRequired: 400,
  },
  "XI": {
    code: "XI",
    name: "Summer Youth Employee",
    maxCredit: 1200,
    hoursRequired: 120,
  },
};

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

/**
 * Calculate actual WOTC credit based on hours worked and wages
 */
export function calculateCredit(
  targetGroupCode: string,
  hoursWorked: number,
  wagesEarned: number
): number {
  const targetGroup = TARGET_GROUPS[targetGroupCode];
  if (!targetGroup) {
    return 0;
  }

  // Must meet minimum hours requirement
  if (hoursWorked < targetGroup.hoursRequired) {
    return 0;
  }

  // Credit calculation rules
  let creditPercentage = 0.40; // 40% for 400+ hours
  if (hoursWorked >= 120 && hoursWorked < 400) {
    creditPercentage = 0.25; // 25% for 120-399 hours
  }

  const calculatedCredit = wagesEarned * creditPercentage;
  return Math.min(calculatedCredit, targetGroup.maxCredit);
}
