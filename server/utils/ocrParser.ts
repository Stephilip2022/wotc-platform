/**
 * OCR Parser for WOTC Determination Letters
 * 
 * Uses OpenAI Vision API to extract structured data from state determination
 * letters (PDF/images). Extracts employee information, determination status,
 * credit amounts, and certification dates.
 */

import OpenAI from 'openai';
import type { DeterminationLetter } from '@shared/schema';

// Initialize OpenAI client with integration credentials
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ParsedDeterminationLetter {
  employeeSSN?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  employerEIN?: string;
  employerName?: string;
  
  determinationStatus: 'approved' | 'denied' | 'pending' | 'unknown';
  certificationNumber?: string;
  
  targetGroup?: string;
  creditAmount?: number;
  maxCreditAmount?: number;
  
  determinationDate?: string;
  certificationDate?: string;
  expirationDate?: string;
  
  stateCode?: string;
  claimNumber?: string;
  
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
  extractedFields: Record<string, any>;
}

/**
 * Sanitize currency string to numeric value
 * Handles formats like: "$1,200.50", "1200.50", "$1200", "1,200"
 */
function parseCurrencyAmount(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  
  // Remove $, commas, and whitespace, then parse
  const cleaned = String(value).replace(/[$,\s]/g, '').trim();
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Parse determination letter using OpenAI Vision API
 * Supports both images (JPEG, PNG) and PDFs
 */
export async function parseDeterminationLetter(
  fileBase64: string,
  stateCode: string,
  mimeType: string = 'image/jpeg'
): Promise<ParsedDeterminationLetter> {
  console.log(`[OCR] Parsing determination letter for state: ${stateCode}, type: ${mimeType}`);

  try {
    // Create vision API request with structured extraction instructions
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert at extracting structured data from WOTC (Work Opportunity Tax Credit) determination letters. Extract all available information accurately. For monetary amounts, include ONLY the numeric value without $, commas, or other symbols.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract all information from this WOTC determination letter. Return a JSON object with these fields:

EMPLOYEE INFORMATION:
- employeeSSN: Social Security Number (format: ###-##-####)
- employeeFirstName: Employee first name
- employeeLastName: Employee last name

EMPLOYER INFORMATION:
- employerEIN: Employer Identification Number
- employerName: Employer company name

DETERMINATION:
- determinationStatus: One of "approved", "denied", "pending", "unknown"
- certificationNumber: WOTC certification number if approved
- targetGroup: WOTC target group category (e.g., "SNAP", "VETERAN", "TANF", "EX-FELON")
- creditAmount: Calculated tax credit amount in dollars
- maxCreditAmount: Maximum possible credit amount in dollars

DATES:
- determinationDate: Date determination was made (YYYY-MM-DD)
- certificationDate: Date certification was issued (YYYY-MM-DD)
- expirationDate: Certification expiration date (YYYY-MM-DD)

OTHER:
- stateCode: State code (2 letters)
- claimNumber: State claim/application number
- rawText: Full extracted text from the letter

Return ONLY valid JSON. If a field is not found, omit it or use null.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${fileBase64}`,
              },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1, // Low temperature for more deterministic extraction
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from OpenAI Vision API');
    }

    // Parse JSON response
    let extractedData: any;
    try {
      // Remove markdown code blocks if present
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      extractedData = JSON.parse(cleanedContent);
    } catch (error) {
      console.error('[OCR] Failed to parse JSON response:', content);
      throw new Error('Invalid JSON response from OCR');
    }

    // Calculate confidence based on how many fields were extracted
    const extractedFieldCount = Object.keys(extractedData).filter(
      key => extractedData[key] !== null && extractedData[key] !== undefined
    ).length;
    
    let confidence: 'high' | 'medium' | 'low';
    if (extractedFieldCount >= 10) {
      confidence = 'high';
    } else if (extractedFieldCount >= 5) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // Normalize determination status
    const statusMap: Record<string, 'approved' | 'denied' | 'pending' | 'unknown'> = {
      'approved': 'approved',
      'certified': 'approved',
      'eligible': 'approved',
      'denied': 'denied',
      'rejected': 'denied',
      'not eligible': 'denied',
      'pending': 'pending',
      'in progress': 'pending',
    };

    const normalizedStatus = extractedData.determinationStatus?.toLowerCase();
    const determinationStatus = statusMap[normalizedStatus] || 'unknown';

    return {
      employeeSSN: extractedData.employeeSSN,
      employeeFirstName: extractedData.employeeFirstName,
      employeeLastName: extractedData.employeeLastName,
      employerEIN: extractedData.employerEIN,
      employerName: extractedData.employerName,
      
      determinationStatus,
      certificationNumber: extractedData.certificationNumber,
      
      targetGroup: extractedData.targetGroup,
      creditAmount: parseCurrencyAmount(extractedData.creditAmount),
      maxCreditAmount: parseCurrencyAmount(extractedData.maxCreditAmount),
      
      determinationDate: extractedData.determinationDate,
      certificationDate: extractedData.certificationDate,
      expirationDate: extractedData.expirationDate,
      
      stateCode: extractedData.stateCode || stateCode,
      claimNumber: extractedData.claimNumber,
      
      rawText: extractedData.rawText || '',
      confidence,
      extractedFields: extractedData,
    };
  } catch (error) {
    console.error('[OCR] Error parsing determination letter:', error);
    throw error;
  }
}

/**
 * Batch parse multiple determination letters
 */
export async function batchParseDeterminationLetters(
  files: Array<{ base64: string; stateCode: string; filename: string; mimeType?: string }>
): Promise<Array<{ filename: string; result: ParsedDeterminationLetter | null; error?: string }>> {
  console.log(`[OCR] Batch parsing ${files.length} determination letters`);

  const results = [];
  
  // Process sequentially to avoid rate limits (could be parallelized with rate limiting)
  for (const file of files) {
    try {
      // Detect MIME type from filename if not provided
      const mimeType = file.mimeType || detectMimeType(file.filename);
      const result = await parseDeterminationLetter(file.base64, file.stateCode, mimeType);
      results.push({
        filename: file.filename,
        result,
      });
    } catch (error) {
      console.error(`[OCR] Failed to parse ${file.filename}:`, error);
      results.push({
        filename: file.filename,
        result: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * Detect MIME type from filename extension
 */
function detectMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
  };
  
  return mimeTypes[ext || ''] || 'image/jpeg';
}

/**
 * Validate parsed determination letter data
 */
export function validateParsedLetter(parsed: ParsedDeterminationLetter): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Critical fields for matching
  if (!parsed.employeeSSN && !parsed.employeeFirstName && !parsed.employeeLastName) {
    errors.push('Missing employee identification (need SSN or name)');
  }

  if (!parsed.determinationStatus || parsed.determinationStatus === 'unknown') {
    errors.push('Determination status not found or unclear');
  }

  // Warnings for missing but non-critical fields
  if (!parsed.certificationNumber && parsed.determinationStatus === 'approved') {
    warnings.push('Approved letter missing certification number');
  }

  if (!parsed.creditAmount && parsed.determinationStatus === 'approved') {
    warnings.push('Approved letter missing credit amount');
  }

  if (!parsed.targetGroup) {
    warnings.push('Target group not identified');
  }

  if (parsed.confidence === 'low') {
    warnings.push('Low confidence extraction - manual review recommended');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Match parsed letter to employee record
 */
export function findEmployeeMatchScore(
  parsed: ParsedDeterminationLetter,
  employee: { ssn?: string | null; firstName: string; lastName: string }
): number {
  let score = 0;

  // SSN match is strongest indicator (100 points)
  if (parsed.employeeSSN && employee.ssn) {
    const cleanParsedSSN = parsed.employeeSSN.replace(/-/g, '');
    const cleanEmployeeSSN = employee.ssn.replace(/-/g, '');
    if (cleanParsedSSN === cleanEmployeeSSN) {
      score += 100;
    }
  }

  // Name matching (case-insensitive, partial match)
  if (parsed.employeeFirstName && employee.firstName) {
    const firstName1 = parsed.employeeFirstName.toLowerCase();
    const firstName2 = employee.firstName.toLowerCase();
    if (firstName1 === firstName2) {
      score += 30;
    } else if (firstName1.includes(firstName2) || firstName2.includes(firstName1)) {
      score += 15;
    }
  }

  if (parsed.employeeLastName && employee.lastName) {
    const lastName1 = parsed.employeeLastName.toLowerCase();
    const lastName2 = employee.lastName.toLowerCase();
    if (lastName1 === lastName2) {
      score += 30;
    } else if (lastName1.includes(lastName2) || lastName2.includes(lastName1)) {
      score += 15;
    }
  }

  return score;
}
