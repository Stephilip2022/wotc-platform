import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type SupportedLanguage = "es" | "fr" | "zh" | "vi" | "ko" | "pt" | "de" | "ja";

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  es: "Spanish",
  fr: "French",
  zh: "Chinese (Simplified)",
  vi: "Vietnamese",
  ko: "Korean",
  pt: "Portuguese",
  de: "German",
  ja: "Japanese",
};

export const LANGUAGE_NATIVE_NAMES: Record<SupportedLanguage, string> = {
  es: "Español",
  fr: "Français",
  zh: "中文",
  vi: "Tiếng Việt",
  ko: "한국어",
  pt: "Português",
  de: "Deutsch",
  ja: "日本語",
};

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

export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
  languageName: string;
}

/**
 * Translate text to a specified language
 */
export async function translateText(
  text: string,
  targetLanguage: SupportedLanguage
): Promise<TranslationResult> {
  try {
    const languageName = LANGUAGE_NAMES[targetLanguage];
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in workplace and tax credit terminology.
Translate the following English text to ${languageName}, maintaining:
1. Professional, clear language appropriate for workplace documents
2. Correct grammar and punctuation for ${languageName}
3. Cultural sensitivity for the target audience
4. Preservation of any technical terms, acronyms, or proper nouns
5. Natural, fluent expression (not word-for-word translation)

Respond with ONLY the translated text, nothing else.`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const translatedText = response.choices[0]?.message?.content?.trim() || text;

    return {
      originalText: text,
      translatedText,
      targetLanguage,
      confidence: 0.95,
    };
  } catch (error) {
    console.error(`Translation error (${targetLanguage}):`, error);
    return {
      originalText: text,
      translatedText: text,
      targetLanguage,
      confidence: 0,
    };
  }
}

/**
 * Translate a single text to Spanish (convenience wrapper)
 */
export async function translateToSpanish(text: string): Promise<TranslationResult> {
  return translateText(text, "es");
}

/**
 * Batch translate multiple texts to a specified language
 */
export async function batchTranslate(
  texts: string[],
  targetLanguage: SupportedLanguage
): Promise<BatchTranslationResult> {
  try {
    const languageName = LANGUAGE_NAMES[targetLanguage];
    const textList = texts.map((t, i) => `[${i + 1}] ${t}`).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in workplace and tax credit terminology.
Translate each numbered English text to ${languageName}, maintaining:
1. Professional, clear language appropriate for workplace documents
2. Correct grammar and punctuation for ${languageName}
3. Cultural sensitivity for the target audience
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

    const translations: TranslationResult[] = texts.map((originalText, index) => {
      const pattern = new RegExp(`\\[${index + 1}\\]\\s*(.+?)(?=\\[\\d+\\]|$)`, "s");
      const match = responseText.match(pattern);
      const translatedText = match ? match[1].trim() : originalText;

      return {
        originalText,
        translatedText,
        targetLanguage,
        confidence: match ? 0.95 : 0,
      };
    });

    return {
      translations,
      tokensUsed: response.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error(`Batch translation error (${targetLanguage}):`, error);
    return {
      translations: texts.map((text) => ({
        originalText: text,
        translatedText: text,
        targetLanguage,
        confidence: 0,
      })),
      tokensUsed: 0,
    };
  }
}

/**
 * Batch translate multiple texts to Spanish (convenience wrapper)
 */
export async function batchTranslateToSpanish(
  texts: string[]
): Promise<BatchTranslationResult> {
  return batchTranslate(texts, "es");
}

/**
 * Detect the language of input text
 */
export async function detectLanguage(text: string): Promise<LanguageDetectionResult> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a language detection expert. Analyze the following text and identify its language.
Respond with ONLY a JSON object in this exact format:
{"code": "ISO 639-1 code", "name": "Language name", "confidence": 0.0-1.0}

For example: {"code": "es", "name": "Spanish", "confidence": 0.98}`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.1,
      max_tokens: 100,
    });

    const responseText = response.choices[0]?.message?.content?.trim() || "";
    const parsed = JSON.parse(responseText);

    return {
      detectedLanguage: parsed.code,
      languageName: parsed.name,
      confidence: parsed.confidence,
    };
  } catch (error) {
    console.error("Language detection error:", error);
    return {
      detectedLanguage: "en",
      languageName: "English",
      confidence: 0,
    };
  }
}

/**
 * Pre-translated UI strings for common questionnaire elements
 */
export const uiStrings: Record<SupportedLanguage, Record<string, string>> = {
  es: {
    "questionnaire.title": "Cuestionario de Elegibilidad WOTC",
    "questionnaire.subtitle": "Por favor responda las siguientes preguntas",
    "questionnaire.next": "Siguiente",
    "questionnaire.previous": "Anterior",
    "questionnaire.submit": "Enviar",
    "questionnaire.saving": "Guardando...",
    "questionnaire.progress": "Progreso",
    "questionnaire.required": "Este campo es obligatorio",
    "questionnaire.yes": "Sí",
    "questionnaire.no": "No",
    "questionnaire.select": "Seleccione una opción",
    "questionnaire.help": "¿Necesita ayuda?",
    "questionnaire.chat_help": "Chatear con asistente de IA",
    "form.first_name": "Nombre",
    "form.last_name": "Apellido",
    "form.date_of_birth": "Fecha de nacimiento",
    "form.ssn": "Número de Seguro Social",
    "form.address": "Dirección",
    "form.city": "Ciudad",
    "form.state": "Estado",
    "form.zip": "Código postal",
    "form.phone": "Teléfono",
    "form.email": "Correo electrónico",
    "status.eligible": "Elegible",
    "status.not_eligible": "No elegible",
    "status.pending": "Pendiente",
    "status.certified": "Certificado",
  },
  fr: {
    "questionnaire.title": "Questionnaire d'éligibilité WOTC",
    "questionnaire.subtitle": "Veuillez répondre aux questions suivantes",
    "questionnaire.next": "Suivant",
    "questionnaire.previous": "Précédent",
    "questionnaire.submit": "Soumettre",
    "questionnaire.saving": "Enregistrement...",
    "questionnaire.progress": "Progression",
    "questionnaire.required": "Ce champ est obligatoire",
    "questionnaire.yes": "Oui",
    "questionnaire.no": "Non",
    "questionnaire.select": "Sélectionnez une option",
    "questionnaire.help": "Besoin d'aide?",
    "questionnaire.chat_help": "Discuter avec l'assistant IA",
    "form.first_name": "Prénom",
    "form.last_name": "Nom de famille",
    "form.date_of_birth": "Date de naissance",
    "form.ssn": "Numéro de sécurité sociale",
    "form.address": "Adresse",
    "form.city": "Ville",
    "form.state": "État/Province",
    "form.zip": "Code postal",
    "form.phone": "Téléphone",
    "form.email": "E-mail",
    "status.eligible": "Éligible",
    "status.not_eligible": "Non éligible",
    "status.pending": "En attente",
    "status.certified": "Certifié",
  },
  zh: {
    "questionnaire.title": "WOTC资格调查问卷",
    "questionnaire.subtitle": "请回答以下问题",
    "questionnaire.next": "下一步",
    "questionnaire.previous": "上一步",
    "questionnaire.submit": "提交",
    "questionnaire.saving": "保存中...",
    "questionnaire.progress": "进度",
    "questionnaire.required": "此字段为必填项",
    "questionnaire.yes": "是",
    "questionnaire.no": "否",
    "questionnaire.select": "请选择一个选项",
    "questionnaire.help": "需要帮助?",
    "questionnaire.chat_help": "与AI助手聊天",
    "form.first_name": "名",
    "form.last_name": "姓",
    "form.date_of_birth": "出生日期",
    "form.ssn": "社会安全号码",
    "form.address": "地址",
    "form.city": "城市",
    "form.state": "州/省",
    "form.zip": "邮政编码",
    "form.phone": "电话",
    "form.email": "电子邮件",
    "status.eligible": "符合资格",
    "status.not_eligible": "不符合资格",
    "status.pending": "待处理",
    "status.certified": "已认证",
  },
  vi: {
    "questionnaire.title": "Bảng câu hỏi đủ điều kiện WOTC",
    "questionnaire.subtitle": "Vui lòng trả lời các câu hỏi sau",
    "questionnaire.next": "Tiếp theo",
    "questionnaire.previous": "Trước đó",
    "questionnaire.submit": "Gửi",
    "questionnaire.saving": "Đang lưu...",
    "questionnaire.progress": "Tiến độ",
    "questionnaire.required": "Trường này là bắt buộc",
    "questionnaire.yes": "Có",
    "questionnaire.no": "Không",
    "questionnaire.select": "Chọn một tùy chọn",
    "questionnaire.help": "Cần trợ giúp?",
    "questionnaire.chat_help": "Trò chuyện với trợ lý AI",
    "form.first_name": "Tên",
    "form.last_name": "Họ",
    "form.date_of_birth": "Ngày sinh",
    "form.ssn": "Số An sinh Xã hội",
    "form.address": "Địa chỉ",
    "form.city": "Thành phố",
    "form.state": "Bang",
    "form.zip": "Mã bưu điện",
    "form.phone": "Điện thoại",
    "form.email": "Email",
    "status.eligible": "Đủ điều kiện",
    "status.not_eligible": "Không đủ điều kiện",
    "status.pending": "Đang chờ xử lý",
    "status.certified": "Đã chứng nhận",
  },
  ko: {
    "questionnaire.title": "WOTC 자격 설문지",
    "questionnaire.subtitle": "다음 질문에 답해 주세요",
    "questionnaire.next": "다음",
    "questionnaire.previous": "이전",
    "questionnaire.submit": "제출",
    "questionnaire.saving": "저장 중...",
    "questionnaire.progress": "진행률",
    "questionnaire.required": "이 필드는 필수입니다",
    "questionnaire.yes": "예",
    "questionnaire.no": "아니오",
    "questionnaire.select": "옵션을 선택하세요",
    "questionnaire.help": "도움이 필요하신가요?",
    "questionnaire.chat_help": "AI 어시스턴트와 채팅하기",
    "form.first_name": "이름",
    "form.last_name": "성",
    "form.date_of_birth": "생년월일",
    "form.ssn": "사회보장번호",
    "form.address": "주소",
    "form.city": "도시",
    "form.state": "주",
    "form.zip": "우편번호",
    "form.phone": "전화번호",
    "form.email": "이메일",
    "status.eligible": "자격 있음",
    "status.not_eligible": "자격 없음",
    "status.pending": "대기 중",
    "status.certified": "인증됨",
  },
  pt: {
    "questionnaire.title": "Questionário de Elegibilidade WOTC",
    "questionnaire.subtitle": "Por favor, responda às seguintes perguntas",
    "questionnaire.next": "Próximo",
    "questionnaire.previous": "Anterior",
    "questionnaire.submit": "Enviar",
    "questionnaire.saving": "Salvando...",
    "questionnaire.progress": "Progresso",
    "questionnaire.required": "Este campo é obrigatório",
    "questionnaire.yes": "Sim",
    "questionnaire.no": "Não",
    "questionnaire.select": "Selecione uma opção",
    "questionnaire.help": "Precisa de ajuda?",
    "questionnaire.chat_help": "Conversar com assistente de IA",
    "form.first_name": "Nome",
    "form.last_name": "Sobrenome",
    "form.date_of_birth": "Data de nascimento",
    "form.ssn": "Número de Segurança Social",
    "form.address": "Endereço",
    "form.city": "Cidade",
    "form.state": "Estado",
    "form.zip": "CEP",
    "form.phone": "Telefone",
    "form.email": "E-mail",
    "status.eligible": "Elegível",
    "status.not_eligible": "Não elegível",
    "status.pending": "Pendente",
    "status.certified": "Certificado",
  },
  de: {
    "questionnaire.title": "WOTC-Berechtigungsfragebogen",
    "questionnaire.subtitle": "Bitte beantworten Sie die folgenden Fragen",
    "questionnaire.next": "Weiter",
    "questionnaire.previous": "Zurück",
    "questionnaire.submit": "Absenden",
    "questionnaire.saving": "Speichern...",
    "questionnaire.progress": "Fortschritt",
    "questionnaire.required": "Dieses Feld ist erforderlich",
    "questionnaire.yes": "Ja",
    "questionnaire.no": "Nein",
    "questionnaire.select": "Wählen Sie eine Option",
    "questionnaire.help": "Brauchen Sie Hilfe?",
    "questionnaire.chat_help": "Mit KI-Assistent chatten",
    "form.first_name": "Vorname",
    "form.last_name": "Nachname",
    "form.date_of_birth": "Geburtsdatum",
    "form.ssn": "Sozialversicherungsnummer",
    "form.address": "Adresse",
    "form.city": "Stadt",
    "form.state": "Bundesland",
    "form.zip": "Postleitzahl",
    "form.phone": "Telefon",
    "form.email": "E-Mail",
    "status.eligible": "Berechtigt",
    "status.not_eligible": "Nicht berechtigt",
    "status.pending": "Ausstehend",
    "status.certified": "Zertifiziert",
  },
  ja: {
    "questionnaire.title": "WOTC資格アンケート",
    "questionnaire.subtitle": "以下の質問にお答えください",
    "questionnaire.next": "次へ",
    "questionnaire.previous": "戻る",
    "questionnaire.submit": "送信",
    "questionnaire.saving": "保存中...",
    "questionnaire.progress": "進捗",
    "questionnaire.required": "この項目は必須です",
    "questionnaire.yes": "はい",
    "questionnaire.no": "いいえ",
    "questionnaire.select": "オプションを選択してください",
    "questionnaire.help": "ヘルプが必要ですか?",
    "questionnaire.chat_help": "AIアシスタントとチャット",
    "form.first_name": "名",
    "form.last_name": "姓",
    "form.date_of_birth": "生年月日",
    "form.ssn": "社会保障番号",
    "form.address": "住所",
    "form.city": "市区町村",
    "form.state": "都道府県",
    "form.zip": "郵便番号",
    "form.phone": "電話番号",
    "form.email": "メールアドレス",
    "status.eligible": "対象",
    "status.not_eligible": "対象外",
    "status.pending": "保留中",
    "status.certified": "認証済み",
  },
};

/**
 * Get UI strings for Spanish (backward compatibility)
 */
export const spanishUIStrings = uiStrings.es;

/**
 * Get supported languages list
 */
export function getSupportedLanguages() {
  return Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({
    code: code as SupportedLanguage,
    name,
    nativeName: LANGUAGE_NATIVE_NAMES[code as SupportedLanguage],
  }));
}
