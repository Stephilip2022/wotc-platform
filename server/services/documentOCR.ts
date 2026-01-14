import OpenAI from "openai";
import { db } from "../db";
import { determinationLetters } from "@shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface OCRExtractionResult {
  success: boolean;
  extractedData: DeterminationLetterData | null;
  rawText: string;
  confidence: number;
  processingTimeMs: number;
  error?: string;
}

export interface DeterminationLetterData {
  certificationNumber: string | null;
  employerEIN: string | null;
  employerName: string | null;
  employeeName: string | null;
  employeeSSNLast4: string | null;
  targetGroup: string | null;
  determinationStatus: "certified" | "denied" | "pending" | "unknown";
  creditAmount: number | null;
  maxCreditAmount: number | null;
  hireDate: string | null;
  certificationDate: string | null;
  expirationDate: string | null;
  state: string | null;
  additionalNotes: string | null;
}

/**
 * Extract data from a determination letter image/PDF using GPT-4 Vision
 */
export async function extractDeterminationLetterData(
  imageBase64: string,
  mimeType: string = "image/png"
): Promise<OCRExtractionResult> {
  const startTime = Date.now();

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at extracting data from WOTC (Work Opportunity Tax Credit) determination letters issued by state workforce agencies.

Analyze the provided document image and extract the following information if present:
- Certification Number (case number, confirmation number)
- Employer EIN (Employer Identification Number)
- Employer Name
- Employee Name
- Last 4 digits of Employee SSN
- Target Group (e.g., TANF Recipient, Veteran, Ex-Felon, SNAP Recipient, etc.)
- Determination Status (Certified, Denied, Pending)
- Credit Amount (if certified)
- Maximum Credit Amount
- Hire Date
- Certification Date
- Expiration Date (if any)
- State (which state issued this letter)
- Any additional notes or conditions

Respond with a JSON object containing all extracted fields. Use null for any field that is not found or unclear.
Be precise with numbers and dates. Dates should be in YYYY-MM-DD format.
Credit amounts should be numbers without currency symbols.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: "Please extract all WOTC determination data from this document.",
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const responseText = response.choices[0]?.message?.content?.trim() || "";
    
    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    const extractedData: DeterminationLetterData = {
      certificationNumber: parsed.certificationNumber || parsed.caseNumber || parsed.confirmationNumber || null,
      employerEIN: parsed.employerEIN || parsed.ein || null,
      employerName: parsed.employerName || null,
      employeeName: parsed.employeeName || null,
      employeeSSNLast4: parsed.employeeSSNLast4 || parsed.ssnLast4 || null,
      targetGroup: parsed.targetGroup || null,
      determinationStatus: normalizeDeterminationStatus(parsed.determinationStatus || parsed.status),
      creditAmount: parseNumber(parsed.creditAmount),
      maxCreditAmount: parseNumber(parsed.maxCreditAmount),
      hireDate: parsed.hireDate || null,
      certificationDate: parsed.certificationDate || parsed.issueDate || null,
      expirationDate: parsed.expirationDate || null,
      state: parsed.state || null,
      additionalNotes: parsed.additionalNotes || parsed.notes || null,
    };

    const processingTimeMs = Date.now() - startTime;

    return {
      success: true,
      extractedData,
      rawText: responseText,
      confidence: calculateConfidence(extractedData),
      processingTimeMs,
    };
  } catch (error) {
    console.error("OCR extraction error:", error);
    return {
      success: false,
      extractedData: null,
      rawText: "",
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Process and store determination letter OCR results
 */
export async function processAndStoreDeterminationLetter(
  screeningId: string,
  imageBase64: string,
  mimeType: string = "image/png",
  originalFilename: string
): Promise<{ success: boolean; letterId?: string; error?: string }> {
  try {
    const ocrResult = await extractDeterminationLetterData(imageBase64, mimeType);

    if (!ocrResult.success || !ocrResult.extractedData) {
      return { success: false, error: ocrResult.error || "OCR extraction failed" };
    }

    const data = ocrResult.extractedData;

    const [letter] = await db
      .insert(determinationLetters)
      .values({
        screeningId,
        originalFilename,
        status: "processed",
        certificationNumber: data.certificationNumber,
        creditAmount: data.creditAmount?.toString(),
        expirationDate: data.expirationDate ? new Date(data.expirationDate) : null,
        parsedData: data as any,
        ocrConfidence: Math.round(ocrResult.confidence * 100),
        processedAt: new Date(),
      } as any)
      .returning();

    return { success: true, letterId: letter.id };
  } catch (error) {
    console.error("Error processing determination letter:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Analyze document type (is it a determination letter?)
 */
export async function analyzeDocumentType(
  imageBase64: string,
  mimeType: string = "image/png"
): Promise<{
  isWOTCDocument: boolean;
  documentType: string;
  confidence: number;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analyze the provided document image and determine if it is related to WOTC (Work Opportunity Tax Credit).
          
Respond with a JSON object:
{
  "isWOTCDocument": true/false,
  "documentType": "determination_letter" | "form_8850" | "form_9061" | "form_9062" | "supporting_document" | "other",
  "confidence": 0.0-1.0
}`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: "What type of document is this?",
            },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.1,
    });

    const responseText = response.choices[0]?.message?.content?.trim() || "";
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    return {
      isWOTCDocument: parsed.isWOTCDocument || false,
      documentType: parsed.documentType || "other",
      confidence: parsed.confidence || 0,
    };
  } catch (error) {
    console.error("Document type analysis error:", error);
    return {
      isWOTCDocument: false,
      documentType: "other",
      confidence: 0,
    };
  }
}

// Helper functions
function normalizeDeterminationStatus(
  status: string | undefined
): "certified" | "denied" | "pending" | "unknown" {
  if (!status) return "unknown";
  const lower = status.toLowerCase();
  if (lower.includes("certif") || lower.includes("approved")) return "certified";
  if (lower.includes("denied") || lower.includes("reject")) return "denied";
  if (lower.includes("pending") || lower.includes("review")) return "pending";
  return "unknown";
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

function calculateConfidence(data: DeterminationLetterData): number {
  const criticalFields = [
    data.certificationNumber,
    data.determinationStatus !== "unknown",
    data.employeeName,
    data.targetGroup,
  ];
  
  const importantFields = [
    data.employerName,
    data.employerEIN,
    data.creditAmount,
    data.hireDate,
    data.certificationDate,
    data.state,
  ];

  const criticalScore = criticalFields.filter(Boolean).length / criticalFields.length;
  const importantScore = importantFields.filter(Boolean).length / importantFields.length;

  return criticalScore * 0.7 + importantScore * 0.3;
}
