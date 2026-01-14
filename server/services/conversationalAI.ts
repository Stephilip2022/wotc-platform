import OpenAI from "openai";
import { db } from "../db";
import { aiAssistanceLogs } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  message: string;
  suggestedAction?: string;
  relatedQuestions?: string[];
  tokensUsed: number;
}

export interface QuestionnaireContext {
  currentQuestion: string;
  currentSection: string;
  employeeName?: string;
  targetGroups?: string[];
  completedSections?: string[];
  language?: string;
}

const SYSTEM_PROMPT = `You are a friendly and helpful AI assistant specialized in helping employees complete WOTC (Work Opportunity Tax Credit) eligibility questionnaires.

Your role is to:
1. Explain questions in simple, easy-to-understand terms
2. Provide context about why certain questions are being asked
3. Help clarify terminology (e.g., TANF, SNAP, unemployment benefits)
4. Guide users through the questionnaire process
5. Answer questions about WOTC eligibility without making definitive eligibility determinations
6. Be encouraging and supportive - completing forms can be stressful

Important guidelines:
- Never ask for or store sensitive personal information like SSN
- Do not make promises about tax credit amounts or eligibility
- If unsure, recommend consulting with HR or the employer
- Keep responses concise and focused (2-3 sentences for simple questions)
- Use plain language, avoid jargon
- Be culturally sensitive and professional

You can explain these common WOTC target groups:
- TANF (Temporary Assistance for Needy Families) recipients
- SNAP (Food Stamps) recipients  
- Qualified veterans (with various conditions)
- Designated community residents
- Vocational rehabilitation referrals
- Ex-felons
- Supplemental Security Income (SSI) recipients
- Summer youth employees
- Long-term unemployment recipients`;

/**
 * Get AI assistance for questionnaire questions
 */
export async function getQuestionnaireHelp(
  userMessage: string,
  context: QuestionnaireContext,
  conversationHistory: ConversationMessage[] = []
): Promise<ChatResponse> {
  try {
    const contextMessage = buildContextMessage(context);
    
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT + "\n\n" + contextMessage },
      ...conversationHistory.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: userMessage },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const assistantMessage = response.choices[0]?.message?.content?.trim() || "";

    // Generate related questions the user might want to ask
    const relatedQuestions = await generateRelatedQuestions(context, userMessage);

    return {
      message: assistantMessage,
      relatedQuestions,
      tokensUsed: response.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error("Conversational AI error:", error);
    return {
      message: "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment, or contact your HR representative for assistance.",
      tokensUsed: 0,
    };
  }
}

/**
 * Simplify a questionnaire question for better understanding
 */
export async function simplifyQuestion(
  question: string,
  targetReadingLevel: number = 8,
  language: string = "en"
): Promise<{
  simplifiedQuestion: string;
  explanation: string;
  exampleAnswer?: string;
}> {
  try {
    const languageInstruction = language !== "en" 
      ? `Respond in the following language: ${language}. ` 
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `${languageInstruction}You are an expert at making complex questions easier to understand.
Rewrite questions to be at a ${targetReadingLevel}th grade reading level while preserving the original meaning.

Respond with JSON:
{
  "simplifiedQuestion": "The easier to understand version",
  "explanation": "A brief explanation of what this question is asking and why",
  "exampleAnswer": "An example of how someone might answer (optional)"
}`,
        },
        {
          role: "user",
          content: question,
        },
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    const responseText = response.choices[0]?.message?.content?.trim() || "";
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    return {
      simplifiedQuestion: parsed.simplifiedQuestion || question,
      explanation: parsed.explanation || "",
      exampleAnswer: parsed.exampleAnswer,
    };
  } catch (error) {
    console.error("Question simplification error:", error);
    return {
      simplifiedQuestion: question,
      explanation: "This question helps determine your eligibility for tax credits.",
    };
  }
}

/**
 * Provide contextual help for a specific WOTC term
 */
export async function explainTerm(
  term: string,
  language: string = "en"
): Promise<{
  definition: string;
  examples: string[];
  relatedTerms: string[];
}> {
  try {
    const languageInstruction = language !== "en" 
      ? `Respond in the following language: ${language}. ` 
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `${languageInstruction}You are an expert at explaining WOTC (Work Opportunity Tax Credit) and employment-related terminology in simple terms.

Explain the given term in a way that someone without legal or tax expertise can understand.

Respond with JSON:
{
  "definition": "A clear, simple explanation of the term",
  "examples": ["Example 1 of how this applies", "Example 2"],
  "relatedTerms": ["Related term 1", "Related term 2"]
}`,
        },
        {
          role: "user",
          content: `Explain this term: ${term}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 400,
    });

    const responseText = response.choices[0]?.message?.content?.trim() || "";
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    return {
      definition: parsed.definition || `${term} is a term related to WOTC eligibility.`,
      examples: parsed.examples || [],
      relatedTerms: parsed.relatedTerms || [],
    };
  } catch (error) {
    console.error("Term explanation error:", error);
    return {
      definition: `${term} is a term related to WOTC eligibility. Please contact your HR representative for more information.`,
      examples: [],
      relatedTerms: [],
    };
  }
}

/**
 * Log AI assistance interaction for analytics
 */
export async function logAIInteraction(
  userId: string,
  screeningId: string | null,
  interactionType: string,
  userInput: string,
  aiResponse: string,
  tokensUsed: number
): Promise<void> {
  try {
    await db.insert(aiAssistanceLogs).values({
      userId,
      screeningId,
      interactionType,
      inputText: userInput,
      outputText: aiResponse,
      tokensUsed,
    } as any);
  } catch (error) {
    console.error("Error logging AI interaction:", error);
  }
}

// Helper functions
function buildContextMessage(context: QuestionnaireContext): string {
  const parts: string[] = [];
  
  if (context.currentSection) {
    parts.push(`The user is currently in the "${context.currentSection}" section of the questionnaire.`);
  }
  
  if (context.currentQuestion) {
    parts.push(`The current question is: "${context.currentQuestion}"`);
  }
  
  if (context.employeeName) {
    parts.push(`The employee's first name is ${context.employeeName}.`);
  }
  
  if (context.targetGroups && context.targetGroups.length > 0) {
    parts.push(`Potentially relevant target groups: ${context.targetGroups.join(", ")}.`);
  }
  
  if (context.completedSections && context.completedSections.length > 0) {
    parts.push(`Completed sections: ${context.completedSections.join(", ")}.`);
  }

  if (context.language && context.language !== "en") {
    parts.push(`The user prefers responses in: ${context.language}.`);
  }
  
  return parts.join("\n");
}

async function generateRelatedQuestions(
  context: QuestionnaireContext,
  userMessage: string
): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Based on the user's question about a WOTC questionnaire, suggest 2-3 related questions they might want to ask.
Keep suggestions brief (under 10 words each).
Respond with a JSON array of strings.`,
        },
        {
          role: "user",
          content: `Current section: ${context.currentSection || "General"}
Current question: ${context.currentQuestion || "N/A"}
User asked: ${userMessage}

Suggest related questions:`,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const responseText = response.choices[0]?.message?.content?.trim() || "[]";
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    return JSON.parse(jsonStr);
  } catch (error) {
    return [];
  }
}

/**
 * Common WOTC terms dictionary for quick lookups
 */
export const WOTC_TERMS: Record<string, string> = {
  "WOTC": "Work Opportunity Tax Credit - A federal tax credit for employers who hire from certain target groups.",
  "TANF": "Temporary Assistance for Needy Families - A government program that provides financial help to families in need.",
  "SNAP": "Supplemental Nutrition Assistance Program - Also known as food stamps, helps low-income families buy food.",
  "SSI": "Supplemental Security Income - Monthly payments to people with disabilities or older adults with limited income.",
  "ETA Form 9198": "The Pre-Screening Notice form that employers must complete within 28 days of the employee's start date.",
  "Form 8850": "Pre-Screening Notice and Certification Request for the WOTC - the main form submitted to determine eligibility.",
  "Designated Community Resident": "Someone who lives in an Empowerment Zone or Rural Renewal County.",
  "Vocational Rehabilitation Referral": "Someone referred by a state vocational rehabilitation agency for employment.",
  "Qualified Veteran": "A veteran who meets certain criteria related to service, disability, or unemployment.",
  "Long-term Unemployment Recipient": "Someone who has been unemployed for 27 consecutive weeks or more.",
};
