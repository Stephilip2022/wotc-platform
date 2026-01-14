import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  targetLanguage: string;
  confidence: number;
}

export interface BatchTranslationResult {
  translations: TranslationResult[];
  tokensUsed: number;
}

/**
 * Translate a single text to Spanish
 */
export async function translateToSpanish(text: string): Promise<TranslationResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in workplace and tax credit terminology.
Translate the following English text to Spanish, maintaining:
1. Professional, clear language appropriate for workplace documents
2. Correct Spanish grammar and punctuation
3. Cultural sensitivity for diverse Spanish-speaking audiences
4. Preservation of any technical terms or acronyms

Respond with ONLY the translated text, nothing else.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const translatedText = response.choices[0]?.message?.content?.trim() || text;

    return {
      originalText: text,
      translatedText,
      targetLanguage: "es",
      confidence: 0.95,
    };
  } catch (error) {
    console.error("Translation error:", error);
    return {
      originalText: text,
      translatedText: text,
      targetLanguage: "es",
      confidence: 0,
    };
  }
}

/**
 * Batch translate multiple texts to Spanish
 */
export async function batchTranslateToSpanish(
  texts: string[]
): Promise<BatchTranslationResult> {
  try {
    const textList = texts.map((t, i) => `[${i + 1}] ${t}`).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in workplace and tax credit terminology.
Translate each numbered English text to Spanish, maintaining:
1. Professional, clear language appropriate for workplace documents
2. Correct Spanish grammar and punctuation
3. Cultural sensitivity for diverse Spanish-speaking audiences
4. Preservation of any technical terms or acronyms

Respond with the translations in the EXACT same format [1] Translation, [2] Translation, etc.
Each translation should be on its own line with its number prefix.`,
        },
        {
          role: "user",
          content: textList,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const responseText = response.choices[0]?.message?.content?.trim() || "";

    // Parse the numbered translations
    const translations: TranslationResult[] = texts.map((originalText, index) => {
      const pattern = new RegExp(`\\[${index + 1}\\]\\s*(.+?)(?=\\[\\d+\\]|$)`, "s");
      const match = responseText.match(pattern);
      const translatedText = match ? match[1].trim() : originalText;

      return {
        originalText,
        translatedText,
        targetLanguage: "es",
        confidence: match ? 0.95 : 0,
      };
    });

    return {
      translations,
      tokensUsed: response.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error("Batch translation error:", error);
    return {
      translations: texts.map((text) => ({
        originalText: text,
        translatedText: text,
        targetLanguage: "es",
        confidence: 0,
      })),
      tokensUsed: 0,
    };
  }
}

/**
 * Translate questionnaire content (questions, options, help text)
 */
export async function translateQuestionnaireContent(content: {
  questions: Array<{
    id: string;
    text: string;
    helpText?: string;
    options?: string[];
  }>;
}): Promise<{
  questions: Array<{
    id: string;
    text: string;
    helpText?: string;
    options?: string[];
  }>;
  tokensUsed: number;
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in HR and tax credit documentation.
Translate the questionnaire content from English to Spanish.

Return a JSON object with the same structure as the input, with all text fields translated.
Maintain professional language appropriate for employment forms.

IMPORTANT: Return ONLY valid JSON, no markdown formatting.`,
        },
        {
          role: "user",
          content: JSON.stringify(content, null, 2),
        },
      ],
      temperature: 0.3,
      max_tokens: 8000,
      response_format: { type: "json_object" },
    });

    const translated = JSON.parse(
      response.choices[0]?.message?.content || "{}"
    );

    return {
      questions: translated.questions || content.questions,
      tokensUsed: response.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error("Questionnaire translation error:", error);
    return {
      questions: content.questions,
      tokensUsed: 0,
    };
  }
}

/**
 * Pre-translated common UI strings for the questionnaire
 */
export const spanishUIStrings: Record<string, string> = {
  // Navigation
  "Next": "Siguiente",
  "Back": "Atrás",
  "Submit": "Enviar",
  "Save & Continue": "Guardar y continuar",
  "Save Progress": "Guardar progreso",
  
  // Status
  "Complete": "Completo",
  "Incomplete": "Incompleto",
  "In Progress": "En progreso",
  "Pending": "Pendiente",
  
  // Common questions
  "Yes": "Sí",
  "No": "No",
  "Not Sure": "No estoy seguro/a",
  "Prefer not to answer": "Prefiero no responder",
  
  // Labels
  "Required": "Requerido",
  "Optional": "Opcional",
  "Select an option": "Seleccione una opción",
  "Enter your answer": "Ingrese su respuesta",
  
  // Help
  "Need help?": "¿Necesita ayuda?",
  "Click for more information": "Haga clic para más información",
  "Simplify this question": "Simplificar esta pregunta",
  
  // Messages
  "Thank you for completing the questionnaire!": "¡Gracias por completar el cuestionario!",
  "Your responses have been saved.": "Sus respuestas han sido guardadas.",
  "Please answer all required questions.": "Por favor responda todas las preguntas requeridas.",
  "An error occurred. Please try again.": "Ocurrió un error. Por favor intente de nuevo.",
  
  // Target groups
  "TANF Recipient": "Beneficiario de TANF",
  "SNAP Recipient": "Beneficiario de SNAP",
  "Veteran": "Veterano",
  "Ex-Felon": "Ex-convicto",
  "Vocational Rehabilitation": "Rehabilitación Vocacional",
  "Summer Youth": "Juventud de Verano",
  "SSI Recipient": "Beneficiario de SSI",
  "Long-Term Unemployment": "Desempleo de Largo Plazo",
  "Designated Community Resident": "Residente de Comunidad Designada",
  
  // Form fields
  "First Name": "Nombre",
  "Last Name": "Apellido",
  "Date of Birth": "Fecha de Nacimiento",
  "Social Security Number": "Número de Seguro Social",
  "Address": "Dirección",
  "City": "Ciudad",
  "State": "Estado",
  "ZIP Code": "Código Postal",
  "Phone Number": "Número de Teléfono",
  "Email": "Correo Electrónico",
  "Hire Date": "Fecha de Contratación",
  "Start Date": "Fecha de Inicio",
};

/**
 * Get translated UI string
 */
export function getSpanishString(english: string): string {
  return spanishUIStrings[english] || english;
}
