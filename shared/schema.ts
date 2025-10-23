import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, decimal, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// SESSION STORAGE (Required for Replit Auth)
// ============================================================================

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// ============================================================================
// AUTHENTICATION & USERS (Compatible with Replit Auth)
// ============================================================================

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  
  // WOTC-specific fields
  role: text("role").notNull().default("employee"), // 'admin', 'employer', 'employee'
  employerId: varchar("employer_id"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// ============================================================================
// EMPLOYERS (Multi-tenant)
// ============================================================================

export const employers = pgTable("employers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  ein: text("ein").notNull().unique(), // Employer Identification Number
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  
  // White-label branding
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#2563eb"),
  welcomeMessage: text("welcome_message"),
  customFooter: text("custom_footer"),
  
  // Questionnaire distribution
  questionnaireUrl: text("questionnaire_url").unique(), // Unique URL slug: /screen/acme-corp
  qrCodeUrl: text("qr_code_url"), // Generated QR code image URL
  embedCode: text("embed_code"), // <iframe> or API integration code
  
  // Status
  onboardingStatus: text("onboarding_status").default("pending"), // 'pending', 'documents_sent', 'signed', 'active'
  activatedAt: timestamp("activated_at"),
  
  // Billing configuration
  revenueSharePercentage: decimal("revenue_share_percentage", { precision: 5, scale: 2 }).default("25.00"),
  stripeCustomerId: text("stripe_customer_id"),
  billingStatus: text("billing_status").default("active"), // 'active', 'suspended', 'inactive'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmployerSchema = createInsertSchema(employers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployer = z.infer<typeof insertEmployerSchema>;
export type Employer = typeof employers.$inferSelect;

// ============================================================================
// EMPLOYEES
// ============================================================================

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Personal information
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  ssn: text("ssn"), // Encrypted in production
  dateOfBirth: text("date_of_birth"),
  
  // Address
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  
  // Employment details
  hireDate: text("hire_date"),
  jobTitle: text("job_title"),
  department: text("department"),
  startDate: text("start_date"),
  
  // Status
  status: text("status").default("pending"), // 'pending', 'screening', 'certified', 'not_eligible', 'archived'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// ============================================================================
// QUESTIONNAIRES & RESPONSES
// ============================================================================

export const questionnaires = pgTable("questionnaires", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  questions: jsonb("questions").notNull(), // Array of question objects with targetGroup metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertQuestionnaireSchema = createInsertSchema(questionnaires).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuestionnaire = z.infer<typeof insertQuestionnaireSchema>;
export type Questionnaire = typeof questionnaires.$inferSelect;

export const questionnaireResponses = pgTable("questionnaire_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  questionnaireId: varchar("questionnaire_id").notNull().references(() => questionnaires.id, { onDelete: "cascade" }),
  responses: jsonb("responses").notNull(), // Key-value pairs of question IDs and answers
  completionPercentage: integer("completion_percentage").default(0),
  isCompleted: boolean("is_completed").default(false),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertQuestionnaireResponseSchema = createInsertSchema(questionnaireResponses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuestionnaireResponse = z.infer<typeof insertQuestionnaireResponseSchema>;
export type QuestionnaireResponse = typeof questionnaireResponses.$inferSelect;

// ============================================================================
// WOTC SCREENINGS & CERTIFICATIONS
// ============================================================================

export const screenings = pgTable("screenings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Target groups (WOTC categories)
  targetGroups: jsonb("target_groups").default([]), // Array of eligible target group codes
  primaryTargetGroup: text("primary_target_group"),
  
  // Screening status
  status: text("status").default("pending"), // 'pending', 'eligible', 'not_eligible', 'certified', 'denied'
  eligibilityDeterminedAt: timestamp("eligibility_determined_at"),
  
  // Certification details
  certificationNumber: text("certification_number"),
  certifiedAt: timestamp("certified_at"),
  certificationExpiresAt: timestamp("certification_expires_at"),
  
  // Form generation
  form8850Generated: boolean("form_8850_generated").default(false),
  form9061Generated: boolean("form_9061_generated").default(false),
  form8850Url: text("form_8850_url"),
  form9061Url: text("form_9061_url"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScreeningSchema = createInsertSchema(screenings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScreening = z.infer<typeof insertScreeningSchema>;
export type Screening = typeof screenings.$inferSelect;

// ============================================================================
// DOCUMENTS
// ============================================================================

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  screeningId: varchar("screening_id").references(() => screenings.id, { onDelete: "cascade" }),
  
  // Document details
  documentType: text("document_type").notNull(), // 'dd214', 'tanf_letter', 'snap_card', 'unemployment_letter', 'other'
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(), // Object storage URL
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  
  // Verification
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by").references(() => users.id),
  
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, uploadedAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// ============================================================================
// CREDIT CALCULATIONS
// ============================================================================

export const creditCalculations = pgTable("credit_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  screeningId: varchar("screening_id").notNull().references(() => screenings.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  
  // Credit amounts
  maxCreditAmount: decimal("max_credit_amount", { precision: 10, scale: 2 }).notNull(),
  projectedCreditAmount: decimal("projected_credit_amount", { precision: 10, scale: 2 }).notNull(),
  actualCreditAmount: decimal("actual_credit_amount", { precision: 10, scale: 2 }),
  
  // Work hours tracking
  hoursWorked: integer("hours_worked").default(0),
  minimumHoursRequired: integer("minimum_hours_required").default(120),
  
  // Status
  status: text("status").default("projected"), // 'projected', 'in_progress', 'claimed', 'denied'
  claimedAt: timestamp("claimed_at"),
  
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCreditCalculationSchema = createInsertSchema(creditCalculations).omit({ id: true, calculatedAt: true, updatedAt: true });
export type InsertCreditCalculation = z.infer<typeof insertCreditCalculationSchema>;
export type CreditCalculation = typeof creditCalculations.$inferSelect;

// ============================================================================
// BILLING & INVOICES
// ============================================================================

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Invoice details
  invoiceNumber: text("invoice_number").notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  revenueSharePercentage: decimal("revenue_share_percentage", { precision: 5, scale: 2 }).notNull(),
  totalCredits: decimal("total_credits", { precision: 10, scale: 2 }).notNull(),
  
  // Period
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  
  // Payment
  status: text("status").default("pending"), // 'pending', 'paid', 'overdue', 'cancelled'
  stripeInvoiceId: text("stripe_invoice_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paidAt: timestamp("paid_at"),
  dueDate: text("due_date"),
  
  // Metadata
  screeningIds: jsonb("screening_ids").default([]), // Array of screening IDs included
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// ============================================================================
// AI ASSISTANCE LOGS
// ============================================================================

export const aiAssistanceLogs = pgTable("ai_assistance_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  originalQuestion: text("original_question").notNull(),
  simplifiedQuestion: text("simplified_question").notNull(),
  usedSimplified: boolean("used_simplified").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAiAssistanceLogSchema = createInsertSchema(aiAssistanceLogs).omit({ id: true, createdAt: true });
export type InsertAiAssistanceLog = z.infer<typeof insertAiAssistanceLogSchema>;
export type AiAssistanceLog = typeof aiAssistanceLogs.$inferSelect;

// ============================================================================
// ETA FORM 9198 (EMPLOYER INTAKE & ONBOARDING)
// ============================================================================

export const etaForm9198 = pgTable("eta_form_9198", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").references(() => employers.id, { onDelete: "cascade" }),
  
  // Employer Information (Section 1)
  employerName: text("employer_name").notNull(),
  tradeName: text("trade_name"),
  ein: text("ein").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  contactName: text("contact_name").notNull(),
  contactTitle: text("contact_title"),
  contactPhone: text("contact_phone").notNull(),
  contactEmail: text("contact_email").notNull(),
  
  // Business Details
  businessType: text("business_type"), // 'corporation', 'partnership', 'sole_proprietor', 'llc', 'other'
  naicsCode: text("naics_code"),
  numberOfEmployees: integer("number_of_employees"),
  averageHiresPerMonth: integer("average_hires_per_month"),
  
  // Authorization (Section 2)
  authorizedName: text("authorized_name"),
  authorizedTitle: text("authorized_title"),
  authorizedSignature: text("authorized_signature"), // Base64 or signature URL
  authorizedDate: text("authorized_date"),
  
  // E-signature tracking
  signatureRequestSentAt: timestamp("signature_request_sent_at"),
  signedAt: timestamp("signed_at"),
  signatureIpAddress: text("signature_ip_address"),
  signatureUserAgent: text("signature_user_agent"),
  
  // Document URLs
  pdfUrl: text("pdf_url"), // Generated PDF of completed form
  termsOfServiceUrl: text("terms_of_service_url"), // Link to engagement letter
  termsAcceptedAt: timestamp("terms_accepted_at"),
  
  // Status
  status: text("status").default("draft"), // 'draft', 'sent', 'signed', 'processed'
  
  // Admin tracking
  createdBy: varchar("created_by").references(() => users.id),
  processedBy: varchar("processed_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEtaForm9198Schema = createInsertSchema(etaForm9198).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEtaForm9198 = z.infer<typeof insertEtaForm9198Schema>;
export type EtaForm9198 = typeof etaForm9198.$inferSelect;

// ============================================================================
// QUESTIONNAIRE METADATA TYPES (for conditional logic & gamification)
// ============================================================================

// WOTC Target Groups (9 major groups + all 14 subcategories)
export const WOTCTargetGroups = {
  // Group IV: TANF Recipients
  "IV-A": "TANF Recipients",
  "IV-B": "TANF Long-term Recipients (18+ months)",
  
  // Group V: Veterans (with all subcategories)
  "V": "Veterans (General)",
  "V-Unemployed-4wk": "Unemployed Veterans (4+ weeks)",
  "V-Unemployed-6mo": "Unemployed Veterans (6+ months)", 
  "V-Disability": "Veterans with Service-Connected Disability",
  "V-Disability-Unemployed-6mo": "Veterans with Disability + Unemployed 6+ months",
  "V-SNAP": "Veterans receiving SNAP",
  
  // Group VI: Ex-Felons
  "VI": "Ex-Felons (Convicted Felons)",
  
  // Group VII: Designated Community Residents
  "VII-EZ": "Empowerment Zone Residents",
  "VII-RRC": "Rural Renewal County Residents",
  
  // Group VIII: Vocational Rehabilitation
  "VIII": "Vocational Rehabilitation Referrals",
  
  // Group IX: SNAP Recipients
  "IX": "SNAP Recipients (Age 18-39)",
  
  // Group X: SSI Recipients
  "X": "SSI Recipients",
  
  // Group XI: Summer Youth
  "XI": "Summer Youth Employees (16-17)",
  "XI-EZ": "Summer Youth in Empowerment Zones",
  "XI-RRC": "Summer Youth in Rural Renewal Counties",
  
  // Group XII: Long-Term Unemployment Recipients
  "XII": "Long-Term Unemployment Recipients (27+ weeks)",
} as const;

export type WOTCTargetGroup = keyof typeof WOTCTargetGroups;

// Simple condition for single predicate
export interface SimpleCondition {
  sourceQuestionId: string;
  operator: "equals" | "notEquals" | "includes" | "greaterThan" | "lessThan" | "exists";
  value: any;
}

// Composite condition for AND/OR logic
export interface CompositeCondition {
  logic: "AND" | "OR";
  conditions: (SimpleCondition | CompositeCondition)[];
}

export type DisplayCondition = SimpleCondition | CompositeCondition;

export interface QuestionUI {
  icon?: string; // Lucide icon name
  helpText?: string;
  placeholder?: string;
  encouragingMessage?: string; // Gamification: "Great job!", "Almost there!"
}

// Gating configuration for section applicability
export interface GatingConfig {
  questionId: string; // Stable ID of the gating question
  questionText: string; // Display text: "Are you a Veteran?"
  applicableAnswers: any[]; // ["Yes"] - answers that make section applicable
  notApplicableAnswers: any[]; // ["No", "Not Applicable"] - answers that skip section
  skipMessage?: string; // "No problem! Moving on to the next section."
  skipReasonKey?: string; // Key for tracking why section was skipped
}

export interface QuestionMetadata {
  id: string;
  question: string;
  type: "text" | "radio" | "checkbox" | "date" | "file" | "number" | "select";
  required?: boolean;
  options?: string[]; // For radio/checkbox/select
  
  // WOTC Eligibility (now type-safe)
  targetGroup?: WOTCTargetGroup;
  eligibilityTrigger?: any; // Value that makes this question trigger eligibility
  eligibleValues?: any[]; // Alternative: array of eligible values
  
  // Conditional Logic (supports complex AND/OR)
  displayCondition?: DisplayCondition; // When to show this question
  followUpQuestions?: QuestionMetadata[]; // Nested follow-up questions
  notApplicableBehavior?: "skip" | "require"; // What happens if marked N/A
  
  // UI/UX
  ui?: QuestionUI;
}

export interface QuestionnaireSection {
  id: string;
  name: string;
  description?: string;
  icon?: string; // Lucide icon name for the section
  targetGroups: WOTCTargetGroup[]; // Target groups this section screens for
  
  // Explicit gating configuration
  gatingConfig: GatingConfig;
  
  // Follow-up questions (shown if section is applicable)
  questions: QuestionMetadata[];
  
  // UI
  order: number;
  weight?: number; // For progress calculation
  completionMessage?: string; // "Thank you for sharing your Veteran status!"
}

export interface EnhancedQuestionnaire {
  name: string;
  description?: string;
  welcomeMessage?: string;
  completionMessage?: string;
  
  // Section-based structure
  sections: QuestionnaireSection[];
  
  // Metadata
  estimatedMinutes?: number;
  gamification?: {
    showProgressBar: boolean;
    celebrateCompletion: boolean;
    encouragingMessages: boolean;
  };
}

// Response tracking with section states
export interface SectionState {
  sectionId: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  completedAt?: string;
  skippedReason?: string;
}

export interface ResponseData {
  answers: Record<string, any>; // questionId -> answer
  sectionStates: SectionState[];
  currentSectionId?: string;
  startedAt?: string;
  completedAt?: string;
}
