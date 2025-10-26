import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface SimplificationRequest {
  question: string;
  targetLanguage?: "en" | "es" | "auto";
  readabilityTarget?: "simple" | "moderate" | "advanced";
  context?: string;
}

interface SimplifiedQuestionResult {
  originalQuestion: string;
  simplifiedQuestion: string;
  targetLanguage: string;
  readabilityScoreOriginal: number;
  readabilityScoreSimplified: number;
  simplificationReason: string;
  alternativePhrasings?: string[];
}

/**
 * Calculate Flesch-Kincaid grade level (reading difficulty)
 * Higher score = more complex
 */
function calculateFleschKincaidGrade(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  const grade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  return Math.max(0, Math.round(grade * 10) / 10);
}

/**
 * Count syllables in a word (simplified algorithm)
 */
function countSyllables(word: string): number {
  word = word.toLowerCase().trim();
  if (word.length <= 3) return 1;

  const vowelGroups = word.match(/[aeiouy]+/g);
  let count = vowelGroups ? vowelGroups.length : 1;

  // Adjust for silent 'e' at end
  if (word.endsWith('e') && count > 1) {
    count--;
  }

  return Math.max(1, count);
}

/**
 * Simplify a questionnaire question using AI
 */
export async function simplifyQuestion(
  request: SimplificationRequest
): Promise<SimplifiedQuestionResult> {
  const {
    question,
    targetLanguage = "en",
    readabilityTarget = "simple",
    context,
  } = request;

  // Calculate original readability
  const readabilityScoreOriginal = calculateFleschKincaidGrade(question);

  // Determine target grade level
  const targetGradeLevel = {
    simple: 6, // 6th grade
    moderate: 10, // 10th grade
    advanced: 14, // College level
  }[readabilityTarget];

  // Build prompt for OpenAI
  const systemPrompt = `You are an expert at simplifying complex questions for WOTC (Work Opportunity Tax Credit) questionnaires.

Your goal is to reword questions to be:
1. Clear and easy to understand
2. Appropriate for ${targetGradeLevel}th grade reading level
3. Culturally sensitive and inclusive
4. Free of legal jargon
5. ${targetLanguage === "es" ? "Translated to Spanish" : "In English"}

Guidelines:
- Use simple, common words
- Break long sentences into shorter ones
- Avoid double negatives
- Use active voice
- Be direct and specific
- Maintain the original question's intent

Return a JSON object with:
- simplifiedQuestion: The simplified/translated version
- simplificationReason: Why you changed it
- alternativePhrasings: 2-3 alternative ways to phrase it`;

  const userPrompt = `${context ? `Context: ${context}\n\n` : ""}Original Question: "${question}"

Simplify this question to ${targetGradeLevel}th grade reading level${
    targetLanguage === "es" ? " and translate to Spanish" : ""
  }.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Faster and cheaper for translation/simplification
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");

    const simplifiedQuestion = result.simplifiedQuestion || question;
    const readabilityScoreSimplified = calculateFleschKincaidGrade(simplifiedQuestion);

    return {
      originalQuestion: question,
      simplifiedQuestion,
      targetLanguage,
      readabilityScoreOriginal,
      readabilityScoreSimplified,
      simplificationReason: result.simplificationReason || "Simplified for clarity",
      alternativePhrasings: result.alternativePhrasings || [],
    };
  } catch (error) {
    console.error("Question simplification error:", error);
    
    // Return original question on error
    return {
      originalQuestion: question,
      simplifiedQuestion: question,
      targetLanguage,
      readabilityScoreOriginal,
      readabilityScoreSimplified: readabilityScoreOriginal,
      simplificationReason: "Error during simplification",
      alternativePhrasings: [],
    };
  }
}

/**
 * Batch simplify multiple questions
 */
export async function batchSimplifyQuestions(
  questions: SimplificationRequest[]
): Promise<SimplifiedQuestionResult[]> {
  // Process in batches of 5 to respect rate limits
  const batchSize = 5;
  const results: SimplifiedQuestionResult[] = [];

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((request) => simplifyQuestion(request))
    );
    results.push(...batchResults);

    // Small delay between batches
    if (i + batchSize < questions.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Translate a question to Spanish (simplified wrapper)
 */
export async function translateToSpanish(question: string, context?: string): Promise<string> {
  const result = await simplifyQuestion({
    question,
    targetLanguage: "es",
    readabilityTarget: "simple",
    context,
  });

  return result.simplifiedQuestion;
}

/**
 * Auto-detect if simplification is needed based on reading level
 */
export function shouldSimplify(question: string, targetGrade: number = 8): boolean {
  const currentGrade = calculateFleschKincaidGrade(question);
  return currentGrade > targetGrade;
}

/**
 * Analyze questionnaire readability
 */
export interface QuestionnaireAnalysis {
  totalQuestions: number;
  averageGradeLevel: number;
  questionsNeedingSimplification: number;
  complexQuestions: Array<{
    question: string;
    gradeLevel: number;
    recommended: "simplify" | "ok";
  }>;
}

export function analyzeQuestionnaireReadability(
  questions: string[],
  targetGrade: number = 8
): QuestionnaireAnalysis {
  const analysis = questions.map((question) => ({
    question,
    gradeLevel: calculateFleschKincaidGrade(question),
    recommended: calculateFleschKincaidGrade(question) > targetGrade ? "simplify" as const : "ok" as const,
  }));

  const averageGradeLevel =
    analysis.reduce((sum, q) => sum + q.gradeLevel, 0) / analysis.length;
  const questionsNeedingSimplification = analysis.filter(
    (q) => q.recommended === "simplify"
  ).length;

  return {
    totalQuestions: questions.length,
    averageGradeLevel: Math.round(averageGradeLevel * 10) / 10,
    questionsNeedingSimplification,
    complexQuestions: analysis.filter((q) => q.recommended === "simplify"),
  };
}
