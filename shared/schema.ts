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
// PUSH SUBSCRIPTIONS & NOTIFICATION PREFERENCES
// ============================================================================

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;

export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // Screening notifications
  screeningStarted: boolean("screening_started").default(true),
  screeningCompleted: boolean("screening_completed").default(true),
  screeningEligible: boolean("screening_eligible").default(true),
  screeningCertified: boolean("screening_certified").default(true),
  screeningDenied: boolean("screening_denied").default(true),
  
  // Submission notifications
  submissionQueued: boolean("submission_queued").default(true),
  submissionSuccess: boolean("submission_success").default(true),
  submissionFailed: boolean("submission_failed").default(true),
  
  // Credit notifications
  creditCalculated: boolean("credit_calculated").default(true),
  creditUpdated: boolean("credit_updated").default(true),
  
  // Billing notifications (employer only)
  invoiceGenerated: boolean("invoice_generated").default(true),
  paymentReceived: boolean("payment_received").default(true),
  paymentFailed: boolean("payment_failed").default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotificationPreferences = z.infer<typeof insertNotificationPreferencesSchema>;
export type NotificationPreferences = typeof notificationPreferences.$inferSelect;

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
  
  // States where employer hires employees
  hiringStates: text("hiring_states").array(), // Array of US state codes e.g. ['CA', 'TX', 'NY']
  
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
  
  // New Hire Onboarding Module
  onboardingModuleEnabled: boolean("onboarding_module_enabled").default(false),
  
  // Referral partner association
  referralPartnerId: varchar("referral_partner_id"),
  
  // Fee & Billing configuration
  feePercentage: decimal("fee_percentage", { precision: 5, scale: 2 }).default("15.00"), // Service fee 0-20%
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
// EMPLOYER SETUP TOKENS (for onboarding via welcome email)
// ============================================================================

export const employerSetupTokens = pgTable("employer_setup_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  token: varchar("token").notNull().unique(),
  email: text("email").notNull(),
  contactName: text("contact_name"),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EmployerSetupToken = typeof employerSetupTokens.$inferSelect;

// ============================================================================
// REFERRAL PARTNERS
// ============================================================================

export const referralPartners = pgTable("referral_partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  legalName: text("legal_name").notNull(),
  dba: text("dba"),
  ein: text("ein").unique(),
  
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  
  contactName: text("contact_name").notNull(),
  contactTitle: text("contact_title"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  
  revenueSharePercentage: decimal("revenue_share_percentage", { precision: 5, scale: 2 }).notNull().default("10.00"),
  
  status: text("status").default("active"), // 'active', 'inactive', 'suspended'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReferralPartnerSchema = createInsertSchema(referralPartners).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferralPartner = z.infer<typeof insertReferralPartnerSchema>;
export type ReferralPartner = typeof referralPartners.$inferSelect;

export const referralPartnerTeamMembers = pgTable("referral_partner_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull().references(() => referralPartners.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertReferralPartnerTeamMemberSchema = createInsertSchema(referralPartnerTeamMembers).omit({ id: true, createdAt: true });
export type InsertReferralPartnerTeamMember = z.infer<typeof insertReferralPartnerTeamMemberSchema>;
export type ReferralPartnerTeamMember = typeof referralPartnerTeamMembers.$inferSelect;

export const referralCommissions = pgTable("referral_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").notNull().references(() => referralPartners.id, { onDelete: "cascade" }),
  quarter: text("quarter").notNull(), // e.g. "2026-Q1"
  year: integer("year").notNull(),
  quarterNumber: integer("quarter_number").notNull(), // 1-4
  totalCredits: decimal("total_credits", { precision: 12, scale: 2 }).default("0.00"),
  revenueSharePercentage: decimal("revenue_share_percentage", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).default("0.00"),
  referredEmployerCount: integer("referred_employer_count").default(0),
  status: text("status").default("pending"), // 'pending', 'approved', 'paid'
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertReferralCommissionSchema = createInsertSchema(referralCommissions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferralCommission = z.infer<typeof insertReferralCommissionSchema>;
export type ReferralCommission = typeof referralCommissions.$inferSelect;

// ============================================================================
// CLIENT AGREEMENTS (Engagement Letters & ETA Form 9198)
// ============================================================================

export const clientAgreements = pgTable("client_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Document type
  documentType: text("document_type").notNull(), // 'engagement_letter', 'eta_form_9198'
  documentVersion: text("document_version").default("1.0"),
  
  // Document content
  documentContent: text("document_content"), // Generated HTML/text content
  pdfUrl: text("pdf_url"), // Stored PDF URL
  
  // Signer information
  signerName: text("signer_name"),
  signerTitle: text("signer_title"),
  signerEmail: text("signer_email"),
  
  // Signature data
  signatureData: text("signature_data"), // Base64 encoded signature image
  signedAt: timestamp("signed_at"),
  signatureIpAddress: text("signature_ip_address"),
  signatureUserAgent: text("signature_user_agent"),
  
  // Status tracking
  status: text("status").default("draft"), // 'draft', 'sent', 'viewed', 'signed', 'expired', 'revoked'
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  expiresAt: timestamp("expires_at"),
  
  // For ETA Form 9198 specific fields
  representativeName: text("representative_name"), // Rockerbox representative
  representativeTitle: text("representative_title"),
  representativeAddress: text("representative_address"),
  representativePhone: text("representative_phone"),
  representativeEmail: text("representative_email"),
  authorizationScope: text("authorization_scope"), // What actions are authorized
  authorizationStartDate: text("authorization_start_date"),
  authorizationEndDate: text("authorization_end_date"),
  
  // Engagement letter specific fields
  feeStructure: text("fee_structure"), // 'percentage', 'flat_fee', 'hybrid'
  feePercentage: decimal("fee_percentage", { precision: 5, scale: 2 }),
  flatFeeAmount: decimal("flat_fee_amount", { precision: 10, scale: 2 }),
  minimumFee: decimal("minimum_fee", { precision: 10, scale: 2 }),
  paymentTerms: text("payment_terms"), // 'upon_certification', 'monthly', 'quarterly'
  contractDuration: text("contract_duration"), // '1_year', '2_year', 'ongoing'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertClientAgreementSchema = createInsertSchema(clientAgreements).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClientAgreement = z.infer<typeof insertClientAgreementSchema>;
export type ClientAgreement = typeof clientAgreements.$inferSelect;

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
  
  // Questionnaire lifecycle tracking
  questionnaireAccessedAt: timestamp("questionnaire_accessed_at"),
  questionnaireStartedAt: timestamp("questionnaire_started_at"),
  questionnaireCompletedAt: timestamp("questionnaire_completed_at"),
  questionnaireResponseId: varchar("questionnaire_response_id"),

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
  
  // Target group (which WOTC category)
  targetGroup: text("target_group"), // 'IV-A', 'V-Disability', etc.
  
  // Credit amounts
  maxCreditAmount: decimal("max_credit_amount", { precision: 10, scale: 2 }).notNull(),
  projectedCreditAmount: decimal("projected_credit_amount", { precision: 10, scale: 2 }).notNull(),
  actualCreditAmount: decimal("actual_credit_amount", { precision: 10, scale: 2 }),
  
  // Work hours and wages tracking
  hoursWorked: integer("hours_worked").default(0),
  wagesEarned: decimal("wages_earned", { precision: 10, scale: 2 }).default("0"),
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

// Note: Billing schema moved to end of file after Phase 3 implementation

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
// HOURS TRACKING (Audit Trail)
// ============================================================================

export const hoursWorked = pgTable("hours_worked", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  creditCalculationId: varchar("credit_calculation_id").references(() => creditCalculations.id, { onDelete: "cascade" }),
  
  // Hours and wages details
  hours: decimal("hours", { precision: 10, scale: 2 }).notNull(),
  wages: decimal("wages", { precision: 12, scale: 2 }), // Gross wages for the period (from payroll)
  periodStart: text("period_start").notNull(), // YYYY-MM-DD
  periodEnd: text("period_end").notNull(), // YYYY-MM-DD
  source: text("source").default("manual"), // 'manual', 'csv_import', 'api', 'payroll_system'
  
  // Metadata
  notes: text("notes"),
  batchId: varchar("batch_id"), // For grouping bulk imports
  
  // Audit
  enteredBy: varchar("entered_by").references(() => users.id),
  enteredAt: timestamp("entered_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertHoursWorkedSchema = createInsertSchema(hoursWorked).omit({ id: true, enteredAt: true, updatedAt: true });
export type InsertHoursWorked = z.infer<typeof insertHoursWorkedSchema>;
export type HoursWorked = typeof hoursWorked.$inferSelect;

// ============================================================================
// CSV IMPORT TEMPLATES (Field Mapping Templates)
// ============================================================================

export const csvImportTemplates = pgTable("csv_import_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "ADP Payroll Export", "QuickBooks Hours", etc.
  description: text("description"),
  
  // Template configuration
  importType: text("import_type").notNull().default("hours"), // 'hours', 'employees', etc.
  columnMappings: jsonb("column_mappings").notNull(), // { "Employee ID": "employeeId", "Total Hours": "hours" }
  
  // Matching configuration
  employeeMatchStrategy: text("employee_match_strategy").default("id"), // 'id', 'ssn', 'email', 'name'
  dateFormat: text("date_format").default("YYYY-MM-DD"), // Date parsing format
  
  // Usage tracking
  lastUsedAt: timestamp("last_used_at"),
  useCount: integer("use_count").default(0),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCsvImportTemplateSchema = createInsertSchema(csvImportTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCsvImportTemplate = z.infer<typeof insertCsvImportTemplateSchema>;
export type CsvImportTemplate = typeof csvImportTemplates.$inferSelect;

// ============================================================================
// CSV IMPORT SESSIONS (Track import process)
// ============================================================================

export const csvImportSessions = pgTable("csv_import_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  templateId: varchar("template_id").references(() => csvImportTemplates.id, { onDelete: "set null" }),
  
  // File information
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  rowCount: integer("row_count").default(0),
  
  // Import status
  status: text("status").default("parsing"), // 'parsing', 'mapping', 'preview', 'importing', 'completed', 'failed'
  importType: text("import_type").notNull().default("hours"),
  
  // Column detection
  detectedColumns: jsonb("detected_columns"), // Array of column headers detected
  columnMappings: jsonb("column_mappings"), // Final column to field mappings
  
  // Employee matching config
  employeeMatchStrategy: text("employee_match_strategy").default("id"),
  
  // Results
  totalRows: integer("total_rows").default(0),
  successfulRows: integer("successful_rows").default(0),
  failedRows: integer("failed_rows").default(0),
  warningRows: integer("warning_rows").default(0),
  
  // Error tracking
  errors: jsonb("errors"), // Array of error objects with row numbers
  warnings: jsonb("warnings"), // Array of warning objects
  
  // Completion
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCsvImportSessionSchema = createInsertSchema(csvImportSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCsvImportSession = z.infer<typeof insertCsvImportSessionSchema>;
export type CsvImportSession = typeof csvImportSessions.$inferSelect;

// ============================================================================
// CSV IMPORT ROWS (Preview and validation)
// ============================================================================

export const csvImportRows = pgTable("csv_import_rows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => csvImportSessions.id, { onDelete: "cascade" }),
  
  // Row information
  rowNumber: integer("row_number").notNull(),
  rawData: jsonb("raw_data").notNull(), // Original CSV row data
  mappedData: jsonb("mapped_data"), // Data after field mapping
  
  // Employee matching
  matchedEmployeeId: varchar("matched_employee_id").references(() => employees.id, { onDelete: "set null" }),
  matchConfidence: text("match_confidence"), // 'exact', 'high', 'medium', 'low', 'none'
  matchMethod: text("match_method"), // 'id', 'ssn', 'email', 'name'
  
  // Validation
  status: text("status").default("pending"), // 'pending', 'valid', 'warning', 'error', 'imported'
  validationErrors: jsonb("validation_errors"), // Array of error messages
  validationWarnings: jsonb("validation_warnings"), // Array of warning messages
  
  // Import result
  importedRecordId: varchar("imported_record_id"), // ID of created hours_worked record
  importedAt: timestamp("imported_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCsvImportRowSchema = createInsertSchema(csvImportRows).omit({ id: true, createdAt: true });
export type InsertCsvImportRow = z.infer<typeof insertCsvImportRowSchema>;
export type CsvImportRow = typeof csvImportRows.$inferSelect;

// ============================================================================
// SCREENING STATUS CHANGES (Audit Trail)
// ============================================================================

export const screeningStatusChanges = pgTable("screening_status_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  screeningId: varchar("screening_id").notNull().references(() => screenings.id, { onDelete: "cascade" }),
  
  // Status change
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  reason: text("reason"), // Why was the status changed?
  notes: text("notes"), // Additional admin notes
  
  // Certification details (when status changes to "certified")
  certificationNumber: text("certification_number"),
  certificationDate: text("certification_date"),
  certificationExpiresAt: text("certification_expires_at"),
  
  // Determination letter reference
  determinationLetterId: varchar("determination_letter_id").references(() => documents.id),
  
  // Audit
  changedBy: varchar("changed_by").notNull().references(() => users.id),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
});

export const insertScreeningStatusChangeSchema = createInsertSchema(screeningStatusChanges).omit({ id: true, changedAt: true });
export type InsertScreeningStatusChange = z.infer<typeof insertScreeningStatusChangeSchema>;
export type ScreeningStatusChange = typeof screeningStatusChanges.$inferSelect;

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

  // State-Level Credit Program Groups
  "State-Veteran": "State Veteran Employment Credits",
  "State-Disability": "State Disability Employment Credits",
  "State-EnterpriseZone": "Enterprise Zone & Location Credits",
  "State-YouthTraining": "Youth, Apprenticeship & Training Credits",
  "State-Reentry": "Re-Entry Employment Credits",
  "State-General": "Additional State Credits",
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

// ============================================================================
// BILLING & SUBSCRIPTIONS
// ============================================================================

export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "Starter", "Professional", "Enterprise"
  displayName: text("display_name").notNull(),
  description: text("description"),
  
  // Pricing
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  annualPrice: decimal("annual_price", { precision: 10, scale: 2 }), // Discounted annual rate
  
  // Stripe integration
  stripeMonthlyPriceId: text("stripe_monthly_price_id"),
  stripeAnnualPriceId: text("stripe_annual_price_id"),
  stripeProductId: text("stripe_product_id"),
  
  // Feature limits
  maxEmployees: integer("max_employees"), // null = unlimited
  maxScreeningsPerMonth: integer("max_screenings_per_month"),
  includeAnalytics: boolean("include_analytics").default(true),
  includePrioritySupport: boolean("include_priority_support").default(false),
  includeApiAccess: boolean("include_api_access").default(false),
  includeDedicatedAccountManager: boolean("include_dedicated_account_manager").default(false),
  
  // Pricing model
  perScreeningFee: decimal("per_screening_fee", { precision: 10, scale: 2 }), // Additional fee per screening
  perCreditFee: decimal("per_credit_fee", { precision: 10, scale: 2 }), // Fee as % of credit earned
  
  // Status
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  planId: varchar("plan_id").notNull().references(() => subscriptionPlans.id),
  
  // Stripe integration
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  
  // Billing cycle
  billingCycle: text("billing_cycle").notNull().default("monthly"), // 'monthly', 'annual'
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  
  // Status
  status: text("status").notNull().default("active"), // 'active', 'canceled', 'past_due', 'trialing', 'paused'
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  canceledAt: timestamp("canceled_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  
  // Usage tracking
  screeningsThisPeriod: integer("screenings_this_period").default(0),
  creditsEarnedThisPeriod: decimal("credits_earned_this_period", { precision: 10, scale: 2 }).default("0.00"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  
  // Invoice details
  invoiceNumber: text("invoice_number").notNull().unique(), // INV-2024-001234
  
  // Stripe integration
  stripeInvoiceId: text("stripe_invoice_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  
  // Amounts
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default("0.00"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default("0.00"),
  amountDue: decimal("amount_due", { precision: 10, scale: 2 }).notNull(),
  
  // Billing period
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  
  // Status
  status: text("status").notNull().default("draft"), // 'draft', 'open', 'paid', 'void', 'uncollectible'
  
  // Dates
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  voidedAt: timestamp("voided_at"),
  
  // Additional info
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  
  // Line item details
  description: text("description").notNull(),
  itemType: text("item_type").notNull(), // 'subscription', 'screening_fee', 'credit_processing_fee', 'overage', 'one_time'
  
  // Related entities (optional)
  screeningId: varchar("screening_id").references(() => screenings.id, { onDelete: "set null" }),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "set null" }),
  
  // Pricing
  quantity: integer("quantity").default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  
  // Period (for subscription items)
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({ id: true, createdAt: true });
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;

// Invoice sequence tracking for atomic number generation
export const invoiceSequences = pgTable("invoice_sequences", {
  yearMonth: text("year_month").primaryKey(), // Format: "2024-10"
  lastSequence: integer("last_sequence").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInvoiceSequenceSchema = createInsertSchema(invoiceSequences).omit({ updatedAt: true });
export type InsertInvoiceSequence = z.infer<typeof insertInvoiceSequenceSchema>;
export type InvoiceSequence = typeof invoiceSequences.$inferSelect;

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Stripe integration
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  stripeChargeId: text("stripe_charge_id"),
  
  // Payment details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd"),
  paymentMethod: text("payment_method"), // 'card', 'ach', 'wire'
  
  // Card details (last 4 digits only)
  cardLast4: text("card_last4"),
  cardBrand: text("card_brand"), // 'visa', 'mastercard', 'amex'
  
  // Status
  status: text("status").notNull().default("pending"), // 'pending', 'succeeded', 'failed', 'refunded'
  failureReason: text("failure_reason"),
  
  // Dates
  paidAt: timestamp("paid_at"),
  refundedAt: timestamp("refunded_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

// ============================================================================
// LICENSEE REVENUE SHARING
// ============================================================================

export const licensees = pgTable("licensees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Organization details
  companyName: text("company_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  
  // Commission structure
  commissionPercentage: decimal("commission_percentage", { precision: 5, scale: 2 }).notNull().default("25.00"), // 25% default
  commissionTier: text("commission_tier").default("standard"), // 'standard', 'premium', 'enterprise'
  
  // Payout details
  payoutMethod: text("payout_method").default("stripe"), // 'stripe', 'ach', 'wire', 'check'
  stripeAccountId: text("stripe_account_id"),
  
  // Status
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'suspended'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLicenseeSchema = createInsertSchema(licensees).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLicensee = z.infer<typeof insertLicenseeSchema>;
export type Licensee = typeof licensees.$inferSelect;

export const licenseePayouts = pgTable("licensee_payouts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  licenseeId: varchar("licensee_id").notNull().references(() => licensees.id, { onDelete: "cascade" }),
  
  // Payout period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Amounts
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).notNull(), // Total revenue generated
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(), // Commission owed
  
  // Stripe integration
  stripeTransferId: text("stripe_transfer_id"),
  stripePayoutId: text("stripe_payout_id"),
  
  // Status
  status: text("status").notNull().default("pending"), // 'pending', 'processing', 'paid', 'failed'
  
  // Dates
  scheduledPayoutDate: timestamp("scheduled_payout_date"),
  paidAt: timestamp("paid_at"),
  
  // Additional info
  notes: text("notes"),
  invoiceUrl: text("invoice_url"), // PDF invoice for payout
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLicenseePayoutSchema = createInsertSchema(licenseePayouts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLicenseePayout = z.infer<typeof insertLicenseePayoutSchema>;
export type LicenseePayout = typeof licenseePayouts.$inferSelect;

// Link table: which employers are managed by which licensees
export const licenseeEmployers = pgTable("licensee_employers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  licenseeId: varchar("licensee_id").notNull().references(() => licensees.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Commission override (if different from licensee's default)
  customCommissionPercentage: decimal("custom_commission_percentage", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertLicenseeEmployerSchema = createInsertSchema(licenseeEmployers).omit({ id: true, createdAt: true });
export type InsertLicenseeEmployer = z.infer<typeof insertLicenseeEmployerSchema>;
export type LicenseeEmployer = typeof licenseeEmployers.$inferSelect;

// ============================================================================
// PHASE 4: STATE AUTOMATION & INTELLIGENCE
// ============================================================================

// ============================================================================
// STATE PORTAL CONFIGURATIONS
// ============================================================================

export const statePortalConfigs = pgTable("state_portal_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateCode: text("state_code").notNull().unique(), // 'CA', 'NY', 'TX', etc.
  stateName: text("state_name").notNull(), // 'California', 'New York', etc.
  
  // Portal URLs
  portalUrl: text("portal_url").notNull(), // State WOTC portal login URL
  bulkUploadUrl: text("bulk_upload_url"), // Bulk upload URL (if different from portalUrl)
  submissionUrl: text("submission_url"), // Direct CSV upload URL if different
  
  // Credentials & Authentication
  authType: text("auth_type").notNull().default("credentials"), // 'credentials', 'oauth', 'api_key'
  credentials: jsonb("credentials"), // { userId: string, password: string }
  challengeQuestions: jsonb("challenge_questions"), // Array of { question: string, answer: string }
  loginFieldSelectors: jsonb("login_field_selectors"), // Playwright selectors for login fields
  
  // Multi-Factor Authentication (MFA)
  mfaEnabled: boolean("mfa_enabled").default(false),
  mfaType: text("mfa_type"), // 'totp', 'sms', 'email', 'authenticator_app'
  mfaSecret: text("mfa_secret"), // Encrypted TOTP secret for authenticator apps
  mfaPhone: text("mfa_phone"), // Phone number for SMS-based MFA
  mfaEmail: text("mfa_email"), // Email for email-based MFA
  mfaBackupCodes: jsonb("mfa_backup_codes"), // Array of encrypted backup codes
  
  // Credential Rotation
  credentialExpiryDate: timestamp("credential_expiry_date"), // When credentials expire
  lastRotatedAt: timestamp("last_rotated_at"), // Last rotation timestamp
  rotationFrequencyDays: integer("rotation_frequency_days").default(90), // Rotate every N days (default 90)
  rotationReminderSentAt: timestamp("rotation_reminder_sent_at"), // Last reminder sent
  nextRotationDue: timestamp("next_rotation_due"), // Calculated next rotation date
  
  // CSV format requirements
  requiredColumns: text("required_columns").array(), // Required CSV columns for this state
  optionalColumns: text("optional_columns").array(), // Optional columns
  dateFormat: text("date_format").default("YYYY-MM-DD"), // Expected date format
  bulkUploadInput: text("bulk_upload_input"), // Additional notes/requirements for bulk uploads
  
  // Automation configuration
  maxBatchSize: integer("max_batch_size").default(100), // Max records per submission
  submissionFrequency: text("submission_frequency").default("daily"), // 'daily', 'weekly', 'manual'
  automationEnabled: boolean("automation_enabled").default(false),
  ocrEnabled: boolean("ocr_enabled").default(false), // OCR capability for determination letters
  
  // Processing times & requirements
  expectedProcessingDays: integer("expected_processing_days").default(30), // Avg days for determination
  missingElectronicSubmittals: boolean("missing_electronic_submittals").default(false),
  signatureRequirement: text("signature_requirement").default("electronic"), // 'electronic', 'wet', 'both'
  longPoaApprovalDuration: boolean("long_poa_approval_duration").default(false),
  
  // State Contacts (up to 3 contacts)
  stateContacts: jsonb("state_contacts"), // Array of { name, title, email, phone }
  
  // Follow-ups & Reminders
  followUps: jsonb("follow_ups"), // Array of { date, description, completed }
  
  // Legacy contact info (kept for backwards compatibility)
  supportEmail: text("support_email"),
  supportPhone: text("support_phone"),
  
  // Status
  status: text("status").default("active"), // 'active', 'maintenance', 'disabled'
  lastVerified: timestamp("last_verified"), // Last time we verified portal is working
  
  // Metadata
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStatePortalConfigSchema = createInsertSchema(statePortalConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const updateStatePortalConfigSchema = insertStatePortalConfigSchema.partial();
export type InsertStatePortalConfig = z.infer<typeof insertStatePortalConfigSchema>;
export type UpdateStatePortalConfig = z.infer<typeof updateStatePortalConfigSchema>;
export type StatePortalConfig = typeof statePortalConfigs.$inferSelect;

// ============================================================================
// CREDENTIAL ROTATION HISTORY
// ============================================================================

export const credentialRotationHistory = pgTable("credential_rotation_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portalConfigId: varchar("portal_config_id").notNull().references(() => statePortalConfigs.id, { onDelete: "cascade" }),
  
  // Rotation details
  rotatedAt: timestamp("rotated_at").notNull().defaultNow(),
  rotatedBy: varchar("rotated_by").notNull().references(() => users.id), // Admin who rotated
  rotationType: text("rotation_type").notNull().default("manual"), // 'manual', 'scheduled', 'security_incident', 'expired'
  reason: text("reason"), // Optional reason/notes
  
  // Audit trail (NO actual credentials stored)
  previousCredentialsHash: text("previous_credentials_hash"), // SHA-256 hash of old credentials for verification
  newCredentialsHash: text("new_credentials_hash"), // SHA-256 hash of new credentials
  
  // MFA changes
  mfaChanged: boolean("mfa_changed").default(false),
  mfaTypeChanged: text("mfa_type_changed"), // Old -> New type if changed
  
  // Notification
  notificationSent: boolean("notification_sent").default(false),
  notifiedUsers: text("notified_users").array(), // Array of user IDs notified
  
  // Metadata
  ipAddress: text("ip_address"), // IP of admin who rotated
  userAgent: text("user_agent"), // Browser/client info
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCredentialRotationHistorySchema = createInsertSchema(credentialRotationHistory).omit({ id: true, createdAt: true });
export type InsertCredentialRotationHistory = z.infer<typeof insertCredentialRotationHistorySchema>;
export type CredentialRotationHistory = typeof credentialRotationHistory.$inferSelect;

// ============================================================================
// STATE SUBMISSION JOBS (Automation Runs)
// ============================================================================

export const stateSubmissionJobs = pgTable("state_submission_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  stateCode: text("state_code").notNull(),
  
  // Job details
  jobType: text("job_type").notNull().default("auto"), // 'auto', 'manual', 'scheduled'
  batchId: varchar("batch_id"), // Groups related submissions
  
  // Submission data
  screeningIds: text("screening_ids").array(), // IDs of screenings being submitted
  recordCount: integer("record_count").notNull().default(0),
  csvUrl: text("csv_url"), // Object storage URL of generated CSV
  
  // Automation execution
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed', 'partial'
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  // Results
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  confirmationNumber: text("confirmation_number"), // State portal confirmation
  
  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"), // Detailed error info for debugging
  screenshotUrl: text("screenshot_url"), // Screenshot if automation failed
  
  // Retry logic
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Audit
  submittedBy: varchar("submitted_by").notNull().references(() => users.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStateSubmissionJobSchema = createInsertSchema(stateSubmissionJobs).omit({ id: true, createdAt: true, updatedAt: true });
export const updateStateSubmissionJobSchema = insertStateSubmissionJobSchema.partial();
export type InsertStateSubmissionJob = z.infer<typeof insertStateSubmissionJobSchema>;
export type UpdateStateSubmissionJob = z.infer<typeof updateStateSubmissionJobSchema>;
export type StateSubmissionJob = typeof stateSubmissionJobs.$inferSelect;

// ============================================================================
// DETERMINATION LETTERS (OCR Parsed Documents)
// ============================================================================

export const determinationLetters = pgTable("determination_letters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").references(() => employees.id), // Matched employee ID
  stateCode: text("state_code").notNull(),
  
  // Document metadata
  fileName: text("file_name"),
  fileUrl: text("file_url"), // Object storage URL
  fileSize: integer("file_size"), // Bytes
  fileType: text("file_type").default("pdf"), // 'pdf', 'image', 'email'
  
  // Simple status tracking (for MVP)
  status: text("status").default("pending"), // 'pending', 'processed', 'needs_review', 'error'
  certificationNumber: text("certification_number"),
  creditAmount: decimal("credit_amount", { precision: 10, scale: 2 }),
  processedAt: timestamp("processed_at"),
  
  // Source
  source: text("source").default("manual"), // 'manual', 'sftp', 'email', 'api'
  receivedDate: timestamp("received_date").notNull().defaultNow(),
  
  // OCR processing
  ocrStatus: text("ocr_status").default("pending"), // 'pending', 'processing', 'completed', 'failed'
  ocrProcessedAt: timestamp("ocr_processed_at"),
  ocrProvider: text("ocr_provider").default("openai-vision"), // 'openai-vision', 'tesseract', 'manual'
  
  // Parsed data
  parsedData: jsonb("parsed_data"), // Full OCR extraction
  employeeData: jsonb("employee_data").array(), // Array of { name, ssn, status, certificationDate, etc }
  
  // Auto-matching
  matchedScreenings: jsonb("matched_screenings").array(), // [{ screeningId, confidence, matchedBy }]
  unmatchedRecords: integer("unmatched_records").default(0),
  
  // Status updates applied
  updatesApplied: boolean("updates_applied").default(false),
  updatesAppliedAt: timestamp("updates_applied_at"),
  updatedScreeningIds: text("updated_screening_ids").array(),
  
  // Review
  requiresReview: boolean("requires_review").default(false),
  reviewStatus: text("review_status").default("pending"), // 'pending', 'approved', 'rejected'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  // Error handling
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  
  // Audit
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDeterminationLetterSchema = createInsertSchema(determinationLetters).omit({ id: true, createdAt: true, updatedAt: true });
export const updateDeterminationLetterSchema = insertDeterminationLetterSchema.partial();
export type InsertDeterminationLetter = z.infer<typeof insertDeterminationLetterSchema>;

// ============================================================================
// AUTO-SUBMISSION QUEUE (Phase 7: Zero-Touch Processing)
// ============================================================================

export const submissionQueue = pgTable("submission_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  screeningId: varchar("screening_id").notNull().references(() => screenings.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  stateCode: text("state_code").notNull(),
  
  // Readiness tracking
  status: text("status").notNull().default("pending_validation"), // 'pending_validation', 'ready', 'queued', 'in_progress', 'submitted', 'failed', 'cancelled'
  readinessScore: integer("readiness_score").default(0), // 0-100 score for data completeness
  missingFields: text("missing_fields").array(), // List of required fields that are missing
  validationErrors: jsonb("validation_errors"), // Detailed validation errors { field: string, error: string }[]
  lastValidationResult: jsonb("last_validation_result"), // Full validation details
  
  // Priority & scheduling
  priority: integer("priority").default(5), // 1-10, higher = more urgent (5 = normal)
  scheduledSubmissionDate: timestamp("scheduled_submission_date"), // When to submit (for batching)
  submissionWindow: text("submission_window").default("daily_batch"), // 'immediate', 'hourly_batch', 'daily_batch', 'weekly_batch'
  urgencyReason: text("urgency_reason"), // Explanation for high priority (e.g., "hire_date_approaching")
  
  // Submission tracking
  assignedToJobId: varchar("assigned_to_job_id").references(() => stateSubmissionJobs.id),
  submittedAt: timestamp("submitted_at"),
  completedAt: timestamp("completed_at"),
  
  // Auto-retry logic
  failureCount: integer("failure_count").default(0),
  lastFailureReason: text("last_failure_reason"),
  nextRetryAt: timestamp("next_retry_at"),
  
  // Metadata
  lastValidatedAt: timestamp("last_validated_at"),
  addedToQueueAt: timestamp("added_to_queue_at").notNull().defaultNow(),
  detectedBySystem: boolean("detected_by_system").default(true), // Auto-detected vs manually queued
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSubmissionQueueSchema = createInsertSchema(submissionQueue).omit({ id: true, createdAt: true, updatedAt: true });
export const updateSubmissionQueueSchema = insertSubmissionQueueSchema.partial();
export type InsertSubmissionQueue = z.infer<typeof insertSubmissionQueueSchema>;
export type UpdateSubmissionQueue = z.infer<typeof updateSubmissionQueueSchema>;
export type SubmissionQueue = typeof submissionQueue.$inferSelect;
export type UpdateDeterminationLetter = z.infer<typeof updateDeterminationLetterSchema>;
export type DeterminationLetter = typeof determinationLetters.$inferSelect;

// ============================================================================
// PAYROLL API CONNECTIONS
// ============================================================================

export const payrollConnections = pgTable("payroll_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Provider details
  provider: text("provider").notNull(), // 'adp', 'paychex', 'paycor', 'quickbooks', 'gusto', etc.
  providerName: text("provider_name").notNull(), // Display name
  
  // Authentication
  authType: text("auth_type").notNull().default("oauth"), // 'oauth', 'api_key', 'credentials'
  accessToken: text("access_token"), // Encrypted in production
  refreshToken: text("refresh_token"), // Encrypted
  tokenExpiresAt: timestamp("token_expires_at"),
  apiKey: text("api_key"), // For API key auth
  clientId: text("client_id"), // For OAuth
  
  // Company identification in payroll system
  companyId: text("company_id"), // Employer's ID in the payroll system
  companyName: text("company_name"),
  
  // Sync configuration
  syncEnabled: boolean("sync_enabled").default(true),
  syncFrequency: text("sync_frequency").default("daily"), // 'hourly', 'daily', 'weekly', 'manual'
  lastSyncAt: timestamp("last_sync_at"),
  nextSyncAt: timestamp("next_sync_at"),
  
  // Sync scope
  syncEmployees: boolean("sync_employees").default(true), // Import employee master data
  syncHours: boolean("sync_hours").default(true), // Import hours worked
  syncPayPeriods: boolean("sync_pay_periods").default(true), // Import pay period dates
  
  // Field mapping
  fieldMappings: jsonb("field_mappings"), // Custom field mapping config
  
  // Status
  status: text("status").default("active"), // 'active', 'paused', 'error', 'expired'
  connectionHealth: text("connection_health").default("healthy"), // 'healthy', 'degraded', 'failing'
  lastHealthCheckAt: timestamp("last_health_check_at"),
  
  // Error tracking
  lastError: text("last_error"),
  errorCount: integer("error_count").default(0),
  lastErrorAt: timestamp("last_error_at"),
  
  // Audit
  connectedBy: varchar("connected_by").notNull().references(() => users.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPayrollConnectionSchema = createInsertSchema(payrollConnections).omit({ id: true, createdAt: true, updatedAt: true });
export const updatePayrollConnectionSchema = insertPayrollConnectionSchema.partial();
export type InsertPayrollConnection = z.infer<typeof insertPayrollConnectionSchema>;
export type UpdatePayrollConnection = z.infer<typeof updatePayrollConnectionSchema>;
export type PayrollConnection = typeof payrollConnections.$inferSelect;

// ============================================================================
// PAYROLL SYNC JOBS (Continuous Sync Tracking)
// ============================================================================

export const payrollSyncJobs = pgTable("payroll_sync_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").notNull().references(() => payrollConnections.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Job details
  jobType: text("job_type").notNull().default("scheduled"), // 'scheduled', 'manual', 'webhook'
  syncType: text("sync_type").notNull().default("incremental"), // 'full', 'incremental'
  
  // Sync period
  periodStart: text("period_start"), // YYYY-MM-DD
  periodEnd: text("period_end"), // YYYY-MM-DD
  
  // Execution
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed'
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  // Results - Employees
  employeesProcessed: integer("employees_processed").default(0),
  employeesCreated: integer("employees_created").default(0),
  employeesUpdated: integer("employees_updated").default(0),
  employeesSkipped: integer("employees_skipped").default(0),
  
  // Results - Hours
  hoursRecordsProcessed: integer("hours_records_processed").default(0),
  hoursRecordsCreated: integer("hours_records_created").default(0),
  hoursRecordsUpdated: integer("hours_records_updated").default(0),
  hoursRecordsSkipped: integer("hours_records_skipped").default(0),
  
  // Credit recalculation
  creditRecalculationsTriggered: integer("credit_recalculations_triggered").default(0),
  totalCreditsUpdated: decimal("total_credits_updated", { precision: 10, scale: 2 }).default("0"),
  
  // Data snapshot
  syncSummary: jsonb("sync_summary"), // Detailed sync results
  changes: jsonb("changes").array(), // [{ type, entityId, changes }]
  
  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  retryCount: integer("retry_count").default(0),
  
  // Audit
  triggeredBy: varchar("triggered_by").references(() => users.id), // null for automated
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPayrollSyncJobSchema = createInsertSchema(payrollSyncJobs).omit({ id: true, createdAt: true, updatedAt: true });
export const updatePayrollSyncJobSchema = insertPayrollSyncJobSchema.partial();
export type InsertPayrollSyncJob = z.infer<typeof insertPayrollSyncJobSchema>;
export type UpdatePayrollSyncJob = z.infer<typeof updatePayrollSyncJobSchema>;
export type PayrollSyncJob = typeof payrollSyncJobs.$inferSelect;

// ============================================================================
// PHASE 5: AI-POWERED INTELLIGENCE & PREDICTION
// ============================================================================

// AI Eligibility Predictions - Track all AI-generated eligibility predictions
export const aiEligibilityPredictions = pgTable("ai_eligibility_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  screeningId: varchar("screening_id").references(() => screenings.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // AI Prediction Score (0-100%)
  eligibilityScore: integer("eligibility_score").notNull(), // 0-100
  confidence: text("confidence").notNull(), // 'low', 'medium', 'high'
  
  // Predicted target groups (ranked by likelihood)
  predictedTargetGroups: jsonb("predicted_target_groups").notNull(), // [{ group: "V-Disability", probability: 0.85 }]
  primaryPredictedGroup: text("primary_predicted_group"),
  
  // AI Reasoning
  reasons: jsonb("reasons").notNull(), // Array of reason objects explaining the prediction
  factorsAnalyzed: jsonb("factors_analyzed"), // What data points were analyzed
  
  // Model information
  modelVersion: text("model_version").default("gpt-4o"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  
  // Input data snapshot (for model training)
  inputDataSnapshot: jsonb("input_data_snapshot"),
  
  // Validation (compare AI prediction vs actual result)
  actualResult: text("actual_result"), // 'certified', 'denied', 'not_eligible'
  actualTargetGroup: text("actual_target_group"),
  predictionAccurate: boolean("prediction_accurate"),
  
  // Timing
  predictionLatencyMs: integer("prediction_latency_ms"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  validatedAt: timestamp("validated_at"),
});

export const insertAiEligibilityPredictionSchema = createInsertSchema(aiEligibilityPredictions).omit({ id: true, createdAt: true });
export type InsertAiEligibilityPrediction = z.infer<typeof insertAiEligibilityPredictionSchema>;
export type AiEligibilityPrediction = typeof aiEligibilityPredictions.$inferSelect;

// Credit Forecasts - Predictive analytics for future credit earnings
export const creditForecasts = pgTable("credit_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Forecast period
  forecastPeriod: text("forecast_period").notNull(), // 'current_month', 'next_month', 'quarter', 'year'
  periodStart: text("period_start").notNull(), // YYYY-MM-DD
  periodEnd: text("period_end").notNull(), // YYYY-MM-DD
  
  // Hiring pipeline data
  pipelineSize: integer("pipeline_size"), // Number of candidates in hiring pipeline
  expectedHires: integer("expected_hires"), // Expected hires this period
  
  // Historical conversion rates
  historicalEligibilityRate: decimal("historical_eligibility_rate", { precision: 5, scale: 2 }), // % of hires that are WOTC eligible
  historicalCertificationRate: decimal("historical_certification_rate", { precision: 5, scale: 2 }), // % of eligibles that get certified
  historicalAverageCreditPerHire: decimal("historical_average_credit_per_hire", { precision: 10, scale: 2 }),
  
  // Predictions
  predictedEligibleHires: integer("predicted_eligible_hires"),
  predictedCertifications: integer("predicted_certifications"),
  predictedTotalCredits: decimal("predicted_total_credits", { precision: 10, scale: 2 }),
  
  // Target group breakdown
  targetGroupBreakdown: jsonb("target_group_breakdown"), // [{ group: "V-Disability", count: 5, credits: 48000 }]
  
  // Confidence intervals
  lowEstimate: decimal("low_estimate", { precision: 10, scale: 2 }),
  highEstimate: decimal("high_estimate", { precision: 10, scale: 2 }),
  confidenceLevel: integer("confidence_level").default(95), // 95% confidence interval
  
  // Model metadata
  modelVersion: text("model_version"),
  assumptions: jsonb("assumptions"), // What assumptions went into the forecast
  
  // Actual results (for validation)
  actualHires: integer("actual_hires"),
  actualEligible: integer("actual_eligible"),
  actualCertified: integer("actual_certified"),
  actualCredits: decimal("actual_credits", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCreditForecastSchema = createInsertSchema(creditForecasts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCreditForecast = z.infer<typeof insertCreditForecastSchema>;
export type CreditForecast = typeof creditForecasts.$inferSelect;

// AI Questionnaire Simplifications - Track real-time question rewording
export const aiQuestionnaireSimplifications = pgTable("ai_questionnaire_simplifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  questionnaireResponseId: varchar("questionnaire_response_id").references(() => questionnaireResponses.id, { onDelete: "cascade" }),
  
  // Question details
  questionId: text("question_id").notNull(),
  originalQuestion: text("original_question").notNull(),
  simplifiedQuestion: text("simplified_question").notNull(),
  targetLanguage: text("target_language").default("en"), // 'en', 'es', etc.
  
  // Simplification metadata
  readabilityScoreOriginal: integer("readability_score_original"), // Flesch-Kincaid grade level
  readabilityScoreSimplified: integer("readability_score_simplified"),
  simplificationReason: text("simplification_reason"), // 'comprehension', 'language_barrier', 'request'
  
  // Employee interaction
  employeeRequested: boolean("employee_requested").default(false), // Did employee ask for simplification?
  employeePreferred: text("employee_preferred"), // 'original', 'simplified'
  timeToAnswer: integer("time_to_answer"), // Seconds spent on question
  
  // Model info
  modelVersion: text("model_version").default("gpt-4o-mini"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAiQuestionnaireSimplificationSchema = createInsertSchema(aiQuestionnaireSimplifications).omit({ id: true, createdAt: true });
export type InsertAiQuestionnaireSimplification = z.infer<typeof insertAiQuestionnaireSimplificationSchema>;
export type AiQuestionnaireSimplification = typeof aiQuestionnaireSimplifications.$inferSelect;

// ============================================================================
// PHASE 6: ENTERPRISE INTEGRATIONS (ATS/HCM)
// ============================================================================

// Integration Providers - Catalog of supported integrations
export const integrationProviders = pgTable("integration_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Provider identification
  providerKey: text("provider_key").notNull().unique(), // 'greenhouse', 'bamboohr', 'workday', 'adp_workforce', etc.
  providerName: text("provider_name").notNull(), // "Greenhouse"
  category: text("category").notNull(), // 'ats', 'hcm', 'payroll', 'accounting'
  
  // Provider details
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  description: text("description"),
  documentation: text("documentation"), // URL to integration docs
  
  // Integration capabilities
  supportsOAuth: boolean("supports_oauth").default(true),
  supportsWebhooks: boolean("supports_webhooks").default(false),
  supportsRealTimeSync: boolean("supports_real_time_sync").default(false),
  supportsBidirectionalSync: boolean("supports_bidirectional_sync").default(false),
  
  // OAuth configuration
  oauthAuthUrl: text("oauth_auth_url"),
  oauthTokenUrl: text("oauth_token_url"),
  oauthScopes: text("oauth_scopes").array(),
  
  // API details
  apiBaseUrl: text("api_base_url"),
  apiVersion: text("api_version"),
  apiDocumentationUrl: text("api_documentation_url"),
  
  // Rate limiting
  rateLimitPerHour: integer("rate_limit_per_hour"),
  rateLimitPerDay: integer("rate_limit_per_day"),
  
  // Data sync capabilities
  canSyncApplicants: boolean("can_sync_applicants").default(false),
  canSyncEmployees: boolean("can_sync_employees").default(false),
  canSyncApplications: boolean("can_sync_applications").default(false),
  canPushWotcStatus: boolean("can_push_wotc_status").default(false),
  
  // Status
  isActive: boolean("is_active").default(true),
  isBeta: boolean("is_beta").default(false),
  
  // Metadata
  config: jsonb("config"), // Provider-specific configuration
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIntegrationProviderSchema = createInsertSchema(integrationProviders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationProvider = z.infer<typeof insertIntegrationProviderSchema>;
export type IntegrationProvider = typeof integrationProviders.$inferSelect;

// Integration Connections - Employer-specific connections to external systems
export const integrationConnections = pgTable("integration_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").notNull().references(() => integrationProviders.id),
  
  // Connection name
  name: text("name").notNull(), // "Production Greenhouse"
  
  // Authentication
  authType: text("auth_type").notNull(), // 'oauth', 'api_key', 'basic_auth'
  accessToken: text("access_token"), // Encrypted OAuth token
  refreshToken: text("refresh_token"), // Encrypted
  tokenExpiresAt: timestamp("token_expires_at"),
  apiKey: text("api_key"), // Encrypted API key
  apiSecret: text("api_secret"), // Encrypted
  
  // OAuth metadata
  oauthState: text("oauth_state"), // CSRF state for OAuth flow
  oauthCode: text("oauth_code"),
  
  // External system identification
  externalAccountId: text("external_account_id"), // Employer's ID in the external system
  externalAccountName: text("external_account_name"),
  
  // Sync configuration
  syncEnabled: boolean("sync_enabled").default(true),
  syncDirection: text("sync_direction").default("bidirectional"), // 'inbound', 'outbound', 'bidirectional'
  syncFrequency: text("sync_frequency").default("hourly"), // 'realtime', 'hourly', 'daily', 'weekly', 'manual'
  
  // Sync scope
  syncApplicants: boolean("sync_applicants").default(true),
  syncEmployees: boolean("sync_employees").default(true),
  syncApplicationStatus: boolean("sync_application_status").default(false),
  pushWotcResults: boolean("push_wotc_results").default(true),
  
  // Webhook configuration
  webhookUrl: text("webhook_url"), // Our endpoint for receiving webhooks
  webhookSecret: text("webhook_secret"), // Encrypted secret for webhook validation
  webhookEvents: text("webhook_events").array(), // ['applicant.created', 'employee.updated']
  
  // Last sync
  lastSyncAt: timestamp("last_sync_at"),
  lastSuccessfulSyncAt: timestamp("last_successful_sync_at"),
  nextScheduledSyncAt: timestamp("next_scheduled_sync_at"),
  
  // Health monitoring
  status: text("status").default("active"), // 'active', 'paused', 'error', 'expired', 'disconnected'
  healthStatus: text("health_status").default("healthy"), // 'healthy', 'degraded', 'unhealthy'
  lastHealthCheckAt: timestamp("last_health_check_at"),
  
  // Error tracking
  errorCount: integer("error_count").default(0),
  lastError: text("last_error"),
  lastErrorAt: timestamp("last_error_at"),
  
  // Audit
  connectedBy: varchar("connected_by").notNull().references(() => users.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIntegrationConnectionSchema = createInsertSchema(integrationConnections).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationConnection = z.infer<typeof insertIntegrationConnectionSchema>;
export type IntegrationConnection = typeof integrationConnections.$inferSelect;

// Integration Field Mappings - Map external fields to our system
export const integrationFieldMappings = pgTable("integration_field_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
  
  // Entity being mapped
  entityType: text("entity_type").notNull(), // 'applicant', 'employee', 'application'
  
  // Field mappings (external field -> our field)
  fieldMappings: jsonb("field_mappings").notNull(), 
  // Example: { "first_name": "firstName", "last_name": "lastName", "email_addresses[0].value": "email" }
  
  // Transformation rules
  transformationRules: jsonb("transformation_rules"), // Custom transformations
  // Example: { "hire_date": { "type": "date", "format": "MM/DD/YYYY" } }
  
  // Default values for missing fields
  defaultValues: jsonb("default_values"),
  
  // Validation rules
  validationRules: jsonb("validation_rules"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIntegrationFieldMappingSchema = createInsertSchema(integrationFieldMappings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationFieldMapping = z.infer<typeof insertIntegrationFieldMappingSchema>;
export type IntegrationFieldMapping = typeof integrationFieldMappings.$inferSelect;

// Integration Sync Logs - Track all sync operations
export const integrationSyncLogs = pgTable("integration_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Sync details
  syncType: text("sync_type").notNull(), // 'full', 'incremental', 'webhook'
  syncDirection: text("sync_direction").notNull(), // 'inbound', 'outbound'
  entityType: text("entity_type"), // 'applicant', 'employee', etc.
  
  // Execution
  status: text("status").notNull().default("pending"), // 'pending', 'running', 'completed', 'failed', 'partial'
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  
  // Results
  recordsProcessed: integer("records_processed").default(0),
  recordsCreated: integer("records_created").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsSkipped: integer("records_skipped").default(0),
  recordsFailed: integer("records_failed").default(0),
  
  // Data details
  syncSummary: jsonb("sync_summary"), // Detailed summary
  changesApplied: jsonb("changes_applied").array(), // [{ entityId, field, oldValue, newValue }]
  
  // Error tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  errorStack: text("error_stack"),
  
  // API usage
  apiCallsMade: integer("api_calls_made").default(0),
  apiCallsFailed: integer("api_calls_failed").default(0),
  rateLimitHit: boolean("rate_limit_hit").default(false),
  
  // Audit
  triggeredBy: varchar("triggered_by").references(() => users.id), // null for automated
  triggerSource: text("trigger_source"), // 'scheduled', 'manual', 'webhook', 'api'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIntegrationSyncLogSchema = createInsertSchema(integrationSyncLogs).omit({ id: true, createdAt: true });
export type InsertIntegrationSyncLog = z.infer<typeof insertIntegrationSyncLogSchema>;
export type IntegrationSyncLog = typeof integrationSyncLogs.$inferSelect;

// Integration Synced Records - Track which external records have been synced
export const integrationSyncedRecords = pgTable("integration_synced_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").notNull().references(() => integrationConnections.id, { onDelete: "cascade" }),
  
  // External record identification
  externalId: text("external_id").notNull(), // ID in the external system
  externalType: text("external_type").notNull(), // 'applicant', 'employee', 'candidate'
  externalUrl: text("external_url"), // Link to view record in external system
  
  // Internal record mapping
  internalId: varchar("internal_id"), // Our employee/applicant ID
  internalType: text("internal_type"), // 'employee', 'screening'
  
  // Sync metadata
  firstSyncedAt: timestamp("first_synced_at").notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at").notNull().defaultNow(),
  syncCount: integer("sync_count").default(1),
  
  // External data snapshot (for change detection)
  externalDataHash: text("external_data_hash"), // Hash of external data to detect changes
  lastExternalData: jsonb("last_external_data"), // Last known state
  
  // Status
  syncStatus: text("sync_status").default("synced"), // 'synced', 'pending', 'failed', 'orphaned'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertIntegrationSyncedRecordSchema = createInsertSchema(integrationSyncedRecords).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIntegrationSyncedRecord = z.infer<typeof insertIntegrationSyncedRecordSchema>;
export type IntegrationSyncedRecord = typeof integrationSyncedRecords.$inferSelect;

// Integration Webhooks - Store webhook payloads for processing
export const integrationWebhooks = pgTable("integration_webhooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").references(() => integrationConnections.id, { onDelete: "set null" }),
  providerId: varchar("provider_id").references(() => integrationProviders.id),
  
  // Webhook metadata
  eventType: text("event_type").notNull(), // 'applicant.created', 'employee.updated'
  externalEventId: text("external_event_id"), // External system's event ID
  
  // Payload
  payload: jsonb("payload").notNull(), // Raw webhook payload
  headers: jsonb("headers"), // HTTP headers
  
  // Processing
  status: text("status").default("pending"), // 'pending', 'processing', 'processed', 'failed', 'ignored'
  processedAt: timestamp("processed_at"),
  processingDurationMs: integer("processing_duration_ms"),
  
  // Results
  actionsCreated: jsonb("actions_created"), // What actions were taken
  errorMessage: text("error_message"),
  
  // Security
  signatureValid: boolean("signature_valid"),
  ipAddress: text("ip_address"),
  
  // Retry
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIntegrationWebhookSchema = createInsertSchema(integrationWebhooks).omit({ id: true, receivedAt: true, createdAt: true });
export type InsertIntegrationWebhook = z.infer<typeof insertIntegrationWebhookSchema>;
export type IntegrationWebhook = typeof integrationWebhooks.$inferSelect;

// ============================================================================
// ACCOUNTING SOFTWARE INTEGRATIONS
// ============================================================================

// Accounting Export Jobs - Track credit exports to accounting systems
export const accountingExportJobs = pgTable("accounting_export_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Export details
  exportType: text("export_type").notNull(), // 'quickbooks', 'xero', 'netsuite', 'sage', 'csv'
  exportFormat: text("export_format").notNull(), // 'qbo', 'xml', 'csv', 'api'
  exportPeriod: text("export_period"), // 'Q1_2025', '2024_Annual'
  
  // Credits included
  screeningIds: text("screening_ids").array(), // Array of screening IDs included
  totalCredits: decimal("total_credits", { precision: 10, scale: 2 }).notNull(),
  creditCount: integer("credit_count").notNull(),
  
  // Export file
  fileName: text("file_name"),
  fileUrl: text("file_url"), // Object storage URL
  fileSize: integer("file_size"),
  
  // Accounting system details
  accountingSystemId: text("accounting_system_id"), // External journal entry ID
  accountingPeriod: text("accounting_period"),
  
  // Status
  status: text("status").default("pending"), // 'pending', 'generated', 'sent', 'imported', 'failed'
  generatedAt: timestamp("generated_at"),
  sentAt: timestamp("sent_at"),
  importedAt: timestamp("imported_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
  
  // Audit
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAccountingExportJobSchema = createInsertSchema(accountingExportJobs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccountingExportJob = z.infer<typeof insertAccountingExportJobSchema>;
export type AccountingExportJob = typeof accountingExportJobs.$inferSelect;

// ============================================================================
// PUBLIC API & DEVELOPER PLATFORM
// ============================================================================

// API Keys - Secure keys for third-party integrations
export const apiKeys = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  // Key details
  name: text("name").notNull(), // Friendly name: "Production API Key", "Staging Key"
  keyPrefix: varchar("key_prefix", { length: 20 }).notNull(), // Prefix for identification: "wotc_live_abc123"
  keyHash: text("key_hash").notNull().unique(), // SHA-256 hash of the full key
  
  // Permissions & scopes
  scopes: text("scopes").array().notNull(), // ['employees:read', 'screenings:write', 'credits:read']
  environment: text("environment").default("production"), // 'production', 'sandbox'
  
  // Rate limiting
  rateLimit: integer("rate_limit").default(1000), // Requests per hour
  rateLimitWindow: integer("rate_limit_window").default(3600), // Window in seconds (default: 1 hour)
  
  // Usage tracking
  lastUsedAt: timestamp("last_used_at"),
  totalRequests: integer("total_requests").default(0),
  
  // Expiration
  expiresAt: timestamp("expires_at"), // null = never expires
  
  // Status
  isActive: boolean("is_active").default(true),
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by").references(() => users.id),
  revokedReason: text("revoked_reason"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastUsedAt: true,
  totalRequests: true,
});
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeys.$inferSelect;

// API Key Usage - Track API usage for analytics and billing
export const apiKeyUsage = pgTable("api_key_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKeyId: varchar("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  
  // Request details
  endpoint: text("endpoint").notNull(), // '/api/v1/employees'
  method: text("method").notNull(), // 'GET', 'POST', 'PUT', 'DELETE'
  statusCode: integer("status_code").notNull(), // 200, 404, 500
  
  // Performance
  responseTimeMs: integer("response_time_ms"),
  
  // Client information
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Error tracking
  errorMessage: text("error_message"),
  
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertApiKeyUsageSchema = createInsertSchema(apiKeyUsage).omit({ id: true, timestamp: true });
export type InsertApiKeyUsage = z.infer<typeof insertApiKeyUsageSchema>;
export type ApiKeyUsage = typeof apiKeyUsage.$inferSelect;

// Webhook Endpoints - Developer-configured webhooks
export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  
  // Endpoint configuration
  url: text("url").notNull(), // https://example.com/webhooks/wotc
  secret: text("secret").notNull(), // Used for HMAC signature verification
  description: text("description"), // "Production webhook for screening updates"
  
  // Event subscriptions
  events: text("events").array().notNull(), // ['screening.completed', 'credit.calculated']
  
  // Delivery configuration
  version: text("version").default("v1"), // API version
  maxRetries: integer("max_retries").default(3),
  retryBackoffSeconds: integer("retry_backoff_seconds").default(60), // 1 minute
  
  // Status
  isActive: boolean("is_active").default(true),
  lastDeliveryAt: timestamp("last_delivery_at"),
  lastDeliveryStatus: text("last_delivery_status"), // 'success', 'failed'
  
  // Statistics
  totalDeliveries: integer("total_deliveries").default(0),
  successfulDeliveries: integer("successful_deliveries").default(0),
  failedDeliveries: integer("failed_deliveries").default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertWebhookEndpointSchema = createInsertSchema(webhookEndpoints).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastDeliveryAt: true,
  lastDeliveryStatus: true,
  totalDeliveries: true,
  successfulDeliveries: true,
  failedDeliveries: true,
});
export type InsertWebhookEndpoint = z.infer<typeof insertWebhookEndpointSchema>;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;

// Webhook Deliveries - Track all webhook delivery attempts
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  webhookEndpointId: varchar("webhook_endpoint_id").notNull().references(() => webhookEndpoints.id, { onDelete: "cascade" }),
  
  // Event details
  eventType: text("event_type").notNull(), // 'screening.completed'
  eventId: varchar("event_id").notNull(), // Unique event ID for idempotency
  
  // Payload
  payload: jsonb("payload").notNull(),
  headers: jsonb("headers"), // HTTP headers sent
  
  // Delivery attempt
  attemptNumber: integer("attempt_number").default(1),
  
  // Response
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  responseTimeMs: integer("response_time_ms"),
  
  // Status
  status: text("status").notNull(), // 'pending', 'success', 'failed', 'retrying'
  errorMessage: text("error_message"),
  
  // Retry
  nextRetryAt: timestamp("next_retry_at"),
  
  // Timestamps
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveries).omit({ id: true, createdAt: true });
export type InsertWebhookDelivery = z.infer<typeof insertWebhookDeliverySchema>;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;

// ============================================================================
// RETENTION OPTIMIZATION - Track employee hours milestones for credit maximization
// ============================================================================

export const retentionMilestones = pgTable("retention_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Milestone tracking
  currentHours: decimal("current_hours", { precision: 10, scale: 2 }).notNull().default("0"),
  targetMilestone: integer("target_milestone").notNull(), // 120 or 400 hours
  progressPercent: decimal("progress_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  
  // Time estimates
  averageHoursPerWeek: decimal("average_hours_per_week", { precision: 5, scale: 2 }),
  estimatedDaysToMilestone: integer("estimated_days_to_milestone"),
  projectedCompletionDate: timestamp("projected_completion_date"),
  
  // Alert thresholds
  alert80Triggered: boolean("alert_80_triggered").default(false),
  alert90Triggered: boolean("alert_90_triggered").default(false),
  
  // Credit value tracking
  currentCreditValue: decimal("current_credit_value", { precision: 10, scale: 2 }).default("0"),
  potentialCreditValue: decimal("potential_credit_value", { precision: 10, scale: 2 }).default("0"),
  
  // Timestamps
  lastCalculated: timestamp("last_calculated").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRetentionMilestoneSchema = createInsertSchema(retentionMilestones).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRetentionMilestone = z.infer<typeof insertRetentionMilestoneSchema>;
export type RetentionMilestone = typeof retentionMilestones.$inferSelect;

export const retentionAlerts = pgTable("retention_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Alert details
  alertType: text("alert_type").notNull(), // 'milestone_80', 'milestone_90', 'high_turnover_risk', 'missed_milestone'
  severity: text("severity").notNull().default("medium"), // 'low', 'medium', 'high', 'critical'
  
  // Message
  title: text("title").notNull(),
  message: text("message").notNull(),
  
  // Context
  currentHours: decimal("current_hours", { precision: 10, scale: 2 }),
  targetMilestone: integer("target_milestone"),
  daysRemaining: integer("days_remaining"),
  potentialValueAtRisk: decimal("potential_value_at_risk", { precision: 10, scale: 2 }),
  
  // Recommended actions
  recommendedActions: jsonb("recommended_actions"), // Array of action items
  
  // Status
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  dismissed: boolean("dismissed").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRetentionAlertSchema = createInsertSchema(retentionAlerts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRetentionAlert = z.infer<typeof insertRetentionAlertSchema>;
export type RetentionAlert = typeof retentionAlerts.$inferSelect;

export const turnoverPredictions = pgTable("turnover_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Risk assessment
  riskScore: integer("risk_score").notNull(), // 0-100
  riskLevel: text("risk_level").notNull(), // 'low', 'medium', 'high', 'critical'
  confidence: integer("confidence").notNull(), // 0-100 (AI confidence in prediction)
  
  // Risk factors
  factors: jsonb("factors").notNull(), // Array of risk factors with weights
  // Example: [{ factor: "low_hours_volatility", weight: 0.3, description: "..." }]
  
  // Analysis inputs
  tenure: integer("tenure_days"), // Days since hire
  hoursVolatility: decimal("hours_volatility", { precision: 5, scale: 2 }), // Std dev of hours
  recentHoursTrend: text("recent_hours_trend"), // 'increasing', 'stable', 'decreasing'
  currentMilestoneProgress: decimal("current_milestone_progress", { precision: 5, scale: 2 }),
  
  // Recommendations
  recommendedActions: jsonb("recommended_actions").notNull(),
  // Example: [{ action: "schedule_retention_conversation", priority: "high", rationale: "..." }]
  
  // AI metadata
  model: text("model"), // OpenAI model used
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  
  // Validation (for tracking prediction accuracy)
  actualOutcome: text("actual_outcome"), // 'retained', 'left_before_milestone', 'left_after_milestone'
  outcomeRecordedAt: timestamp("outcome_recorded_at"),
  
  // Timestamps
  predictedAt: timestamp("predicted_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTurnoverPredictionSchema = createInsertSchema(turnoverPredictions).omit({ id: true, createdAt: true, predictedAt: true });
export type InsertTurnoverPrediction = z.infer<typeof insertTurnoverPredictionSchema>;
export type TurnoverPrediction = typeof turnoverPredictions.$inferSelect;

// ============================================================================
// MULTI-CREDIT BUNDLING - Identify other tax credits beyond WOTC
// ============================================================================

export const otherTaxCredits = pgTable("other_tax_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  
  // Credit identification
  creditType: text("credit_type").notNull(), // 'rd_tax_credit', 'state_hiring_incentive', 'new_markets_tax_credit', 'disabled_access_credit', etc.
  creditName: text("credit_name").notNull(),
  creditCategory: text("credit_category"), // 'federal', 'state', 'local'
  
  // Eligibility
  eligibilityScore: integer("eligibility_score").notNull(), // 0-100 (AI confidence)
  status: text("status").notNull().default("identified"), // 'identified', 'qualified', 'claimed', 'denied', 'expired'
  
  // Value
  estimatedValue: decimal("estimated_value", { precision: 12, scale: 2 }),
  minimumValue: decimal("minimum_value", { precision: 12, scale: 2 }),
  maximumValue: decimal("maximum_value", { precision: 12, scale: 2 }),
  
  // Criteria & analysis
  eligibilityCriteria: jsonb("eligibility_criteria").notNull(),
  // Example: { role: "Software Engineer", location: "CA", qualifyingActivities: [...] }
  
  aiAnalysis: jsonb("ai_analysis"),
  // AI reasoning for why this credit applies
  
  // Requirements
  requiredDocumentation: jsonb("required_documentation"),
  // Array of docs needed: ["time tracking", "project descriptions", "qualified research activities"]
  
  nextSteps: jsonb("next_steps"),
  // Action items to claim credit
  
  // Supporting data
  jurisdiction: text("jurisdiction"), // State/locality for regional credits
  expirationDate: timestamp("expiration_date"),
  claimDeadline: timestamp("claim_deadline"),
  
  // Tracking
  identifiedBy: text("identified_by").default("ai_scan"), // 'ai_scan', 'manual_review', 'user_submitted'
  
  // Notes
  notes: text("notes"),
  
  // Timestamps
  identifiedAt: timestamp("identified_at").notNull().defaultNow(),
  lastReviewedAt: timestamp("last_reviewed_at"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOtherTaxCreditSchema = createInsertSchema(otherTaxCredits).omit({ id: true, createdAt: true, updatedAt: true, identifiedAt: true });
export type InsertOtherTaxCredit = z.infer<typeof insertOtherTaxCreditSchema>;
export type OtherTaxCredit = typeof otherTaxCredits.$inferSelect;

// ============================================================================
// TAX CREDIT PROGRAM CATALOG - C2ER State Incentives Database
// ============================================================================

export const taxCreditPrograms = pgTable("tax_credit_programs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  c2erReferenceNumber: integer("c2er_reference_number"),
  state: text("state").notNull(),
  programName: text("program_name").notNull(),
  programDescription: text("program_description"),
  
  programCategory: text("program_category").notNull().default("general_screening"),
  leverageType: text("leverage_type"),
  informationNeededToCertify: text("information_needed_to_certify"),
  agencyToWorkWith: text("agency_to_work_with"),
  
  screeningQuestions: jsonb("screening_questions"),
  eligibilityRules: jsonb("eligibility_rules"),
  
  creditFormula: text("credit_formula"),
  maxCreditAmount: decimal("max_credit_amount", { precision: 12, scale: 2 }),
  
  applicableIndustries: text("applicable_industries").array(),
  minCompanySize: integer("min_company_size"),
  maxCompanySize: integer("max_company_size"),
  
  isActive: boolean("is_active").notNull().default(true),
  tier: text("tier").notNull().default("1"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaxCreditProgramSchema = createInsertSchema(taxCreditPrograms).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTaxCreditProgram = z.infer<typeof insertTaxCreditProgramSchema>;
export type TaxCreditProgram = typeof taxCreditPrograms.$inferSelect;

// ============================================================================
// EMPLOYER PROGRAM ASSIGNMENTS - Admin-controlled per-employer program toggles
// ============================================================================

export const employerProgramAssignments = pgTable("employer_program_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  programId: varchar("program_id").notNull().references(() => taxCreditPrograms.id, { onDelete: "cascade" }),
  
  isEnabled: boolean("is_enabled").notNull().default(true),
  isRecommended: boolean("is_recommended").notNull().default(false),
  
  enabledBy: varchar("enabled_by").references(() => users.id),
  enabledAt: timestamp("enabled_at").defaultNow(),
  disabledAt: timestamp("disabled_at"),
  
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmployerProgramAssignmentSchema = createInsertSchema(employerProgramAssignments).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployerProgramAssignment = z.infer<typeof insertEmployerProgramAssignmentSchema>;
export type EmployerProgramAssignment = typeof employerProgramAssignments.$inferSelect;

// ============================================================================
// EMPLOYER WORKSITES - Multi-location tracking with zone data
// ============================================================================

export const employerWorksites = pgTable("employer_worksites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),

  siteName: text("site_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  county: text("county"),

  naicsCode: text("naics_code"),
  sicCode: text("sic_code"),
  employeeCount: integer("employee_count"),

  isEnterpriseZone: boolean("is_enterprise_zone").default(false),
  enterpriseZoneName: text("enterprise_zone_name"),
  enterpriseZoneId: text("enterprise_zone_id"),
  isEmpowermentZone: boolean("is_empowerment_zone").default(false),
  isRuralRenewalArea: boolean("is_rural_renewal_area").default(false),
  isHistoricDistrict: boolean("is_historic_district").default(false),
  isOpportunityZone: boolean("is_opportunity_zone").default(false),

  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),

  isPrimary: boolean("is_primary").default(false),
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmployerWorksiteSchema = createInsertSchema(employerWorksites).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployerWorksite = z.infer<typeof insertEmployerWorksiteSchema>;
export type EmployerWorksite = typeof employerWorksites.$inferSelect;

// ============================================================================
// PROGRAM SCREENING RESULTS - Tracks screening outcomes per employee per program
// ============================================================================

export const programScreeningResults = pgTable("program_screening_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  programId: varchar("program_id").notNull().references(() => taxCreditPrograms.id, { onDelete: "cascade" }),

  screeningStatus: text("screening_status").notNull().default("pending"),
  eligibilityResult: text("eligibility_result"),
  eligibilityScore: integer("eligibility_score"),
  qualifyingFactors: jsonb("qualifying_factors"),
  disqualifyingFactors: jsonb("disqualifying_factors"),

  screeningAnswers: jsonb("screening_answers"),
  autoScreened: boolean("auto_screened").default(false),
  autoScreenSource: text("auto_screen_source"),

  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProgramScreeningResultSchema = createInsertSchema(programScreeningResults).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProgramScreeningResult = z.infer<typeof insertProgramScreeningResultSchema>;
export type ProgramScreeningResult = typeof programScreeningResults.$inferSelect;

// ============================================================================
// PROGRAM CREDIT CALCULATIONS - Tracks calculated credits per employee per program
// ============================================================================

export const programCreditCalculations = pgTable("program_credit_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  screeningResultId: varchar("screening_result_id").notNull().references(() => programScreeningResults.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").notNull(),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  programId: varchar("program_id").notNull().references(() => taxCreditPrograms.id, { onDelete: "cascade" }),

  calculationMethod: text("calculation_method").notNull(),
  wagesUsed: decimal("wages_used", { precision: 12, scale: 2 }),
  hoursUsed: integer("hours_used"),
  rateApplied: decimal("rate_applied", { precision: 5, scale: 4 }),
  calculatedAmount: decimal("calculated_amount", { precision: 12, scale: 2 }).notNull(),
  cappedAmount: decimal("capped_amount", { precision: 12, scale: 2 }),
  finalCreditAmount: decimal("final_credit_amount", { precision: 12, scale: 2 }).notNull(),

  calculationDetails: jsonb("calculation_details"),
  taxYear: integer("tax_year"),

  status: text("status").notNull().default("calculated"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProgramCreditCalculationSchema = createInsertSchema(programCreditCalculations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProgramCreditCalculation = z.infer<typeof insertProgramCreditCalculationSchema>;
export type ProgramCreditCalculation = typeof programCreditCalculations.$inferSelect;

// ============================================================================
// PROGRAM SUBMISSIONS - Tracks submissions to state agencies per program
// ============================================================================

export const programSubmissions = pgTable("program_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  programId: varchar("program_id").notNull().references(() => taxCreditPrograms.id, { onDelete: "cascade" }),

  submissionType: text("submission_type").notNull(),
  submissionChannel: text("submission_channel").notNull(),

  employeeIds: text("employee_ids").array(),
  recordCount: integer("record_count").notNull().default(0),
  totalCreditAmount: decimal("total_credit_amount", { precision: 12, scale: 2 }),

  fileGenerated: text("file_generated"),
  fileFormat: text("file_format"),
  remotePathUploaded: text("remote_path_uploaded"),

  submissionStatus: text("submission_status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at"),
  confirmedAt: timestamp("confirmed_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),

  stateReferenceNumber: text("state_reference_number"),
  determinationStatus: text("determination_status"),
  determinationDate: timestamp("determination_date"),
  approvedAmount: decimal("approved_amount", { precision: 12, scale: 2 }),

  submittedBy: varchar("submitted_by"),
  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProgramSubmissionSchema = createInsertSchema(programSubmissions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProgramSubmission = z.infer<typeof insertProgramSubmissionSchema>;
export type ProgramSubmission = typeof programSubmissions.$inferSelect;

// ============================================================================
// AUDIT LOGS - Complete compliance and audit trail
// ============================================================================

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Actor information
  userId: varchar("user_id").references(() => users.id),
  userEmail: text("user_email"),
  userRole: text("user_role"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Action details
  action: text("action").notNull(), // 'create', 'read', 'update', 'delete', 'login', 'logout', 'export', etc.
  resourceType: text("resource_type").notNull(), // 'employee', 'screening', 'credit', 'employer', etc.
  resourceId: varchar("resource_id"),
  
  // Tenant isolation
  employerId: varchar("employer_id").references(() => employers.id),
  
  // Change tracking
  previousData: jsonb("previous_data"), // State before change
  newData: jsonb("new_data"), // State after change
  changedFields: jsonb("changed_fields"), // List of fields that changed
  
  // Context
  description: text("description"),
  category: text("category").notNull().default("general"), // 'authentication', 'data_access', 'data_modification', 'admin_action', 'compliance', 'billing'
  severity: text("severity").notNull().default("info"), // 'info', 'warning', 'critical'
  
  // Request context
  requestId: varchar("request_id"), // For tracing related actions
  sessionId: varchar("session_id"),
  
  // Compliance flags
  piiAccessed: boolean("pii_accessed").default(false),
  exportedData: boolean("exported_data").default(false),
  requiresReview: boolean("requires_review").default(false),
  reviewed: boolean("reviewed").default(false),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  
  // Timestamps
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_audit_logs_user").on(table.userId),
  index("idx_audit_logs_employer").on(table.employerId),
  index("idx_audit_logs_action").on(table.action),
  index("idx_audit_logs_resource").on(table.resourceType, table.resourceId),
  index("idx_audit_logs_timestamp").on(table.timestamp),
  index("idx_audit_logs_category").on(table.category),
]);

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// ============================================================================
// COMPLIANCE REPORTS - Automated compliance documentation
// ============================================================================

export const complianceReports = pgTable("compliance_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").references(() => employers.id, { onDelete: "cascade" }),
  
  // Report type
  reportType: text("report_type").notNull(), // 'monthly_summary', 'quarterly_audit', 'annual_review', 'data_retention', 'pii_access'
  reportName: text("report_name").notNull(),
  
  // Period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Status
  status: text("status").notNull().default("generating"), // 'generating', 'completed', 'failed'
  
  // Content
  summary: jsonb("summary"), // Key metrics and findings
  details: jsonb("details"), // Full report data
  findings: jsonb("findings"), // Any compliance issues found
  recommendations: jsonb("recommendations"),
  
  // Generated files
  pdfUrl: text("pdf_url"),
  csvUrl: text("csv_url"),
  
  // Metadata
  generatedBy: varchar("generated_by").references(() => users.id),
  generationMethod: text("generation_method").default("scheduled"), // 'scheduled', 'manual', 'triggered'
  
  // Timestamps
  generatedAt: timestamp("generated_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertComplianceReportSchema = createInsertSchema(complianceReports).omit({ id: true, createdAt: true });
export type InsertComplianceReport = z.infer<typeof insertComplianceReportSchema>;
export type ComplianceReport = typeof complianceReports.$inferSelect;

// ============================================================================
// PRICING PLANS - Flexible pricing model configurations
// ============================================================================

export const pricingPlans = pgTable("pricing_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  
  // Pricing model type
  pricingModel: text("pricing_model").notNull(), // 'percentage', 'milestone_flat_fee', 'per_screening', 'deferred_annual'
  
  // Model 1: Traditional percentage of credits
  percentageRate: decimal("percentage_rate", { precision: 5, scale: 2 }), // e.g., 15.00
  
  // Model 2: Milestone flat fees (per target group)
  milestoneFeesConfig: jsonb("milestone_fees_config"), // { targetGroup: { submittal: X, certification: Y, hours120: Z, hours400: W } }
  
  // Model 3: Per-screening volume pricing
  perScreeningConfig: jsonb("per_screening_config"), // { tiers: [{ minScreenings: 1, maxScreenings: 50, pricePerScreening: 30 }, ...] }
  
  // Model 4: Deferred annual billing
  deferredConfig: jsonb("deferred_config"), // { monthlyBase: 199, annualPercentage: 9.5, billingDate: "03-15" }
  
  // Common settings
  monthlySubscriptionFee: decimal("monthly_subscription_fee", { precision: 10, scale: 2 }).default("0.00"),
  minimumAnnualFee: decimal("minimum_annual_fee", { precision: 10, scale: 2 }),
  setupFee: decimal("setup_fee", { precision: 10, scale: 2 }).default("0.00"),
  
  // Status
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPricingPlanSchema = createInsertSchema(pricingPlans).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPricingPlan = z.infer<typeof insertPricingPlanSchema>;
export type PricingPlan = typeof pricingPlans.$inferSelect;

// ============================================================================
// EMPLOYER BILLING - Links employers to pricing plans and tracks billing
// ============================================================================

export const employerBilling = pgTable("employer_billing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  pricingPlanId: varchar("pricing_plan_id").references(() => pricingPlans.id),
  
  // Custom overrides (if different from plan defaults)
  customPercentageRate: decimal("custom_percentage_rate", { precision: 5, scale: 2 }),
  customMonthlyFee: decimal("custom_monthly_fee", { precision: 10, scale: 2 }),
  customMilestoneConfig: jsonb("custom_milestone_config"),
  
  // Billing status
  billingStatus: text("billing_status").default("active"), // 'active', 'suspended', 'pending'
  
  // Deferred billing specific
  annualBillingDate: text("annual_billing_date"), // e.g., "03-15"
  form5884Released: boolean("form_5884_released").default(false),
  lastAnnualInvoiceDate: timestamp("last_annual_invoice_date"),
  lastAnnualInvoiceAmount: decimal("last_annual_invoice_amount", { precision: 12, scale: 2 }),
  lastAnnualInvoicePaid: boolean("last_annual_invoice_paid").default(false),
  
  // Contract details
  contractStartDate: timestamp("contract_start_date"),
  contractEndDate: timestamp("contract_end_date"),
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_employer_billing_employer").on(table.employerId),
  index("idx_employer_billing_plan").on(table.pricingPlanId),
]);

export const insertEmployerBillingSchema = createInsertSchema(employerBilling).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployerBilling = z.infer<typeof insertEmployerBillingSchema>;
export type EmployerBilling = typeof employerBilling.$inferSelect;

// ============================================================================
// BILLING EVENTS - Track billable events for invoicing
// ============================================================================

export const billingEvents = pgTable("billing_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").references(() => employees.id),
  screeningId: varchar("screening_id").references(() => screenings.id),
  
  // Event type
  eventType: text("event_type").notNull(), // 'screening', 'submittal', 'certification', 'hours_120', 'hours_400', 'monthly_subscription', 'annual_invoice'
  
  // Target group (for milestone-based billing)
  targetGroup: text("target_group"),
  
  // Financial
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  creditAmount: decimal("credit_amount", { precision: 12, scale: 2 }), // Associated WOTC credit amount
  
  // Billing status
  invoiced: boolean("invoiced").default(false),
  invoiceId: varchar("invoice_id"),
  invoicedAt: timestamp("invoiced_at"),
  
  // Timestamps
  eventDate: timestamp("event_date").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_billing_events_employer").on(table.employerId),
  index("idx_billing_events_type").on(table.eventType),
  index("idx_billing_events_invoiced").on(table.invoiced),
]);

export const insertBillingEventSchema = createInsertSchema(billingEvents).omit({ id: true, createdAt: true });
export type InsertBillingEvent = z.infer<typeof insertBillingEventSchema>;
export type BillingEvent = typeof billingEvents.$inferSelect;

// ============================================================================
// GENERATED REPORTS - Track PDF report generation and downloads
// ============================================================================

export const generatedReports = pgTable("generated_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").references(() => employers.id, { onDelete: "cascade" }),
  
  reportType: text("report_type").notNull(),
  reportTitle: text("report_title").notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  
  status: text("status").notNull().default("pending"),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  
  reportData: jsonb("report_data"),
  metadata: jsonb("metadata"),
  
  generatedBy: varchar("generated_by"),
  downloadCount: integer("download_count").default(0),
  lastDownloadedAt: timestamp("last_downloaded_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_reports_employer").on(table.employerId),
  index("idx_reports_type").on(table.reportType),
  index("idx_reports_status").on(table.status),
]);

export const insertGeneratedReportSchema = createInsertSchema(generatedReports).omit({ id: true, createdAt: true });
export type InsertGeneratedReport = z.infer<typeof insertGeneratedReportSchema>;
export type GeneratedReport = typeof generatedReports.$inferSelect;

// ============================================================================
// DOCUMENT UPLOAD TOKENS (One-time secure links for post-screening uploads)
// ============================================================================

export const documentUploadTokens = pgTable("document_upload_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  screeningId: varchar("screening_id").references(() => screenings.id, { onDelete: "cascade" }),

  token: varchar("token").notNull().unique(),
  requiredDocuments: jsonb("required_documents").notNull(), // e.g. ["dd214", "drivers_license"]
  targetGroups: jsonb("target_groups").notNull(), // which groups triggered the request

  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_upload_tokens_employee").on(table.employeeId),
  index("idx_upload_tokens_token").on(table.token),
]);

export const insertDocumentUploadTokenSchema = createInsertSchema(documentUploadTokens).omit({ id: true, createdAt: true });
export type InsertDocumentUploadToken = z.infer<typeof insertDocumentUploadTokenSchema>;
export type DocumentUploadToken = typeof documentUploadTokens.$inferSelect;

// ============================================================================
// DOCUMENT UPLOAD REMINDERS (Scheduled SMS reminders at 3, 5, 7 days)
// ============================================================================

export const documentUploadReminders = pgTable("document_upload_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  uploadTokenId: varchar("upload_token_id").notNull().references(() => documentUploadTokens.id, { onDelete: "cascade" }),

  reminderDay: integer("reminder_day").notNull(), // 3, 5, or 7
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  phoneNumber: text("phone_number").notNull(),

  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'failed', 'cancelled'
  twilioMessageSid: text("twilio_message_sid"),
  errorMessage: text("error_message"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_reminders_status_scheduled").on(table.status, table.scheduledAt),
  index("idx_reminders_employee").on(table.employeeId),
])

export const insertDocumentUploadReminderSchema = createInsertSchema(documentUploadReminders).omit({ id: true, createdAt: true });
export type InsertDocumentUploadReminder = z.infer<typeof insertDocumentUploadReminderSchema>;
export type DocumentUploadReminder = typeof documentUploadReminders.$inferSelect;

// ============================================================================
// NEW HIRE ONBOARDING MODULE
// ============================================================================

export const onboardingInviteTokens = pgTable("onboarding_invite_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "set null" }),
  token: varchar("token").notNull().unique(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  jobTitle: text("job_title"),
  department: text("department"),
  startDate: text("start_date"),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_onboarding_token").on(table.token),
  index("idx_onboarding_invite_employer").on(table.employerId),
]);

export const insertOnboardingInviteTokenSchema = createInsertSchema(onboardingInviteTokens).omit({ id: true, createdAt: true, usedAt: true });
export type InsertOnboardingInviteToken = z.infer<typeof insertOnboardingInviteTokenSchema>;
export type OnboardingInviteToken = typeof onboardingInviteTokens.$inferSelect;

export const onboardingInstances = pgTable("onboarding_instances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employerId: varchar("employer_id").notNull().references(() => employers.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id").references(() => employees.id, { onDelete: "set null" }),
  inviteTokenId: varchar("invite_token_id").references(() => onboardingInviteTokens.id, { onDelete: "set null" }),

  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  jobTitle: text("job_title"),
  department: text("department"),
  startDate: text("start_date"),

  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'expired'
  progressPercent: integer("progress_percent").notNull().default(0),
  currentStep: text("current_step").default("welcome"), // which step they're on

  completedAt: timestamp("completed_at"),
  startedAt: timestamp("started_at"),
  lastActivityAt: timestamp("last_activity_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_onboarding_instance_employer").on(table.employerId),
  index("idx_onboarding_instance_employee").on(table.employeeId),
  index("idx_onboarding_instance_status").on(table.status),
]);

export const insertOnboardingInstanceSchema = createInsertSchema(onboardingInstances).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true });
export type InsertOnboardingInstance = z.infer<typeof insertOnboardingInstanceSchema>;
export type OnboardingInstance = typeof onboardingInstances.$inferSelect;

export const onboardingTasks = pgTable("onboarding_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull().references(() => onboardingInstances.id, { onDelete: "cascade" }),

  stepKey: text("step_key").notNull(), // 'personal_info', 'tax_w4', 'state_withholding', 'direct_deposit', 'emergency_contact', 'id_upload', 'policy_sign', 'welcome_video'
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("required"), // 'required', 'optional', 'recommended'
  sortOrder: integer("sort_order").notNull().default(0),

  status: text("status").notNull().default("pending"), // 'pending', 'in_progress', 'completed', 'skipped'
  completedAt: timestamp("completed_at"),
  data: jsonb("data"), // form data for this step

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_onboarding_task_instance").on(table.instanceId),
]);

export const insertOnboardingTaskSchema = createInsertSchema(onboardingTasks).omit({ id: true, createdAt: true, completedAt: true });
export type InsertOnboardingTask = z.infer<typeof insertOnboardingTaskSchema>;
export type OnboardingTask = typeof onboardingTasks.$inferSelect;

export const onboardingDocuments = pgTable("onboarding_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull().references(() => onboardingInstances.id, { onDelete: "cascade" }),
  taskId: varchar("task_id").references(() => onboardingTasks.id, { onDelete: "set null" }),

  documentType: text("document_type").notNull(), // 'government_id', 'bank_letter', 'voided_check', 'policy_signature', 'w4_form', 'other'
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),

  signatureData: text("signature_data"), // base64 e-signature for policy acknowledgements
  signedAt: timestamp("signed_at"),

  status: text("status").notNull().default("pending"), // 'pending', 'verified', 'rejected', 'expired'
  verifiedBy: varchar("verified_by"),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_onboarding_doc_instance").on(table.instanceId),
]);

export const insertOnboardingDocumentSchema = createInsertSchema(onboardingDocuments).omit({ id: true, createdAt: true });
export type InsertOnboardingDocument = z.infer<typeof insertOnboardingDocumentSchema>;
export type OnboardingDocument = typeof onboardingDocuments.$inferSelect;

export const onboardingFormData = pgTable("onboarding_form_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  instanceId: varchar("instance_id").notNull().references(() => onboardingInstances.id, { onDelete: "cascade" }),

  formType: text("form_type").notNull(), // 'w4', 'state_withholding', 'direct_deposit', 'emergency_contact', 'personal_info'
  formData: text("form_data").notNull(), // encrypted JSON of form fields
  isComplete: boolean("is_complete").default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_onboarding_form_instance").on(table.instanceId),
  index("idx_onboarding_form_type").on(table.instanceId, table.formType),
])

export const insertOnboardingFormDataSchema = createInsertSchema(onboardingFormData).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOnboardingFormData = z.infer<typeof insertOnboardingFormDataSchema>;
export type OnboardingFormData = typeof onboardingFormData.$inferSelect;
