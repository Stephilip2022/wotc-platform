import OpenAI from "openai";
import type { Employee, Screening, QuestionnaireResponse } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface EligibilityPredictionInput {
  employee: Partial<Employee>;
  questionnaireResponse?: Partial<QuestionnaireResponse>;
  additionalContext?: Record<string, any>;
}

interface TargetGroupPrediction {
  group: string;
  probability: number;
  reasoning: string;
}

interface PredictionReason {
  factor: string;
  impact: "positive" | "negative" | "neutral";
  description: string;
}

export interface EligibilityPredictionResult {
  eligibilityScore: number; // 0-100
  confidence: "low" | "medium" | "high";
  predictedTargetGroups: TargetGroupPrediction[];
  primaryPredictedGroup: string | null;
  reasons: PredictionReason[];
  factorsAnalyzed: string[];
  modelVersion: string;
  promptTokens: number;
  completionTokens: number;
  predictionLatencyMs: number;
}

/**
 * WOTC Target Groups Reference
 */
const WOTC_TARGET_GROUPS = {
  "IV-A": "TANF Recipients",
  "IV-B": "TANF Long-term Recipients (18+ months)",
  "V": "Veterans (General)",
  "V-Unemployed-4wk": "Unemployed Veterans (4+ weeks)",
  "V-Unemployed-6mo": "Unemployed Veterans (6+ months)",
  "V-Disability": "Veterans with Service-Connected Disability",
  "V-Disability-Unemployed-6mo": "Veterans with Disability + Unemployed 6+ months",
  "V-SNAP": "Veterans receiving SNAP",
  "VI": "Ex-Felons (Convicted Felons)",
  "VII-EZ": "Empowerment Zone Residents",
  "VII-RRC": "Rural Renewal County Residents",
  "VIII": "Vocational Rehabilitation Referrals",
  "IX": "SNAP Recipients (Age 18-39)",
  "X": "SSI Recipients",
  "XI": "Summer Youth Employees (16-17)",
  "XI-EZ": "Summer Youth in Empowerment Zones",
  "XI-RRC": "Summer Youth in Rural Renewal Counties",
  "XII": "Long-Term Unemployment Recipients (27+ weeks)",
};

/**
 * Generate AI-powered WOTC eligibility prediction
 */
export async function predictWotcEligibility(
  input: EligibilityPredictionInput
): Promise<EligibilityPredictionResult> {
  const startTime = Date.now();

  // Prepare input data for analysis
  const factorsAnalyzed: string[] = [];
  const analysisData: Record<string, any> = {};

  // Employee demographics
  if (input.employee.dateOfBirth) {
    analysisData.age = calculateAge(input.employee.dateOfBirth);
    factorsAnalyzed.push("age");
  }
  if (input.employee.hireDate) {
    analysisData.hireDate = input.employee.hireDate;
    factorsAnalyzed.push("hire_date");
  }
  if (input.employee.city || input.employee.state || input.employee.zipCode) {
    analysisData.location = {
      city: input.employee.city,
      state: input.employee.state,
      zipCode: input.employee.zipCode,
    };
    factorsAnalyzed.push("geographic_location");
  }

  // Questionnaire responses
  if (input.questionnaireResponse?.responses) {
    analysisData.questionnaireResponses = input.questionnaireResponse.responses;
    factorsAnalyzed.push("questionnaire_responses");
  }

  // Additional context
  if (input.additionalContext) {
    analysisData.additionalContext = input.additionalContext;
    Object.keys(input.additionalContext).forEach((key) => {
      if (!factorsAnalyzed.includes(key)) {
        factorsAnalyzed.push(key);
      }
    });
  }

  // Create structured prompt for OpenAI
  const systemPrompt = `You are an expert WOTC (Work Opportunity Tax Credit) eligibility analyst. Your job is to analyze employee data and predict their likelihood of qualifying for WOTC tax credits.

WOTC Target Groups:
${Object.entries(WOTC_TARGET_GROUPS)
  .map(([code, description]) => `- ${code}: ${description}`)
  .join("\n")}

Analyze the provided employee data and return a JSON prediction with:
1. eligibilityScore (0-100): Overall likelihood of WOTC eligibility
2. confidence (low/medium/high): Your confidence in this prediction
3. predictedTargetGroups: Array of likely target groups with probabilities
4. reasons: Array of factors influencing the prediction
5. primaryPredictedGroup: Most likely target group code

Guidelines:
- Veterans data (military service, discharge, disability) → V groups
- Age 16-17 with summer employment → XI groups
- Age 18-39 with SNAP benefits → IX
- TANF/welfare recipients → IV-A or IV-B
- Ex-felons/criminal history → VI
- Unemployment 27+ weeks → XII
- SSI recipients → X
- Geographic location (empowerment zones, rural renewal) → VII-EZ or VII-RRC
- Vocational rehabilitation referrals → VIII

Be conservative: Only high probabilities (>70%) should be included in predictions.`;

  const userPrompt = `Analyze this employee for WOTC eligibility:

Employee Data:
${JSON.stringify(analysisData, null, 2)}

Return a JSON object with your prediction.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more consistent predictions
    });

    const predictionLatencyMs = Date.now() - startTime;
    const result = JSON.parse(completion.choices[0].message.content || "{}");

    // Extract and validate the prediction
    const prediction: EligibilityPredictionResult = {
      eligibilityScore: Math.min(100, Math.max(0, result.eligibilityScore || 0)),
      confidence: ["low", "medium", "high"].includes(result.confidence)
        ? result.confidence
        : "low",
      predictedTargetGroups: (result.predictedTargetGroups || [])
        .filter((group: any) => group.probability > 0.7) // Only include high-confidence predictions (>70%)
        .sort((a: any, b: any) => b.probability - a.probability),
      primaryPredictedGroup:
        result.primaryPredictedGroup ||
        result.predictedTargetGroups?.[0]?.group ||
        null,
      reasons: result.reasons || [],
      factorsAnalyzed,
      modelVersion: completion.model,
      promptTokens: completion.usage?.prompt_tokens || 0,
      completionTokens: completion.usage?.completion_tokens || 0,
      predictionLatencyMs,
    };

    return prediction;
  } catch (error) {
    console.error("AI Prediction Error:", error);
    
    // Return a low-confidence default prediction on error
    return {
      eligibilityScore: 0,
      confidence: "low",
      predictedTargetGroups: [],
      primaryPredictedGroup: null,
      reasons: [
        {
          factor: "prediction_error",
          impact: "negative",
          description: error instanceof Error ? error.message : "Prediction failed",
        },
      ],
      factorsAnalyzed,
      modelVersion: "gpt-4o",
      promptTokens: 0,
      completionTokens: 0,
      predictionLatencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Calculate age from date of birth (YYYY-MM-DD)
 */
function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Batch predict eligibility for multiple employees
 */
export async function batchPredictEligibility(
  inputs: EligibilityPredictionInput[]
): Promise<EligibilityPredictionResult[]> {
  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  const results: EligibilityPredictionResult[] = [];

  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((input) => predictWotcEligibility(input))
    );
    results.push(...batchResults);
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < inputs.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return results;
}
