import { db } from "../db";
import { employers, questionnaires, etaForm9198 } from "@shared/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Generate a unique questionnaire URL slug from company name
 * Example: "Acme Corporation" -> "acme-corporation-a1b2"
 */
export async function generateUniqueQuestionnaireUrl(companyName: string): Promise<string> {
  const baseSlug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .substring(0, 40); // Limit length

  // Add random suffix to ensure uniqueness
  const suffix = nanoid(4).toLowerCase();
  const slug = `${baseSlug}-${suffix}`;

  // Verify uniqueness (shouldn't conflict with 4-char nanoid, but be safe)
  const existing = await db
    .select()
    .from(employers)
    .where(eq(employers.questionnaireUrl, slug))
    .limit(1);

  if (existing.length > 0) {
    // Recursive retry with new suffix
    return generateUniqueQuestionnaireUrl(companyName);
  }

  return slug;
}

/**
 * Get the default comprehensive WOTC questionnaire structure
 */
export function getDefaultWotcQuestionnaire() {
  return [
    // Section 1: TANF Recipients
    {
      id: "section-tanf",
      name: "Public Assistance",
      description: "Questions about government assistance programs",
      icon: "HandHeart",
      targetGroups: ["IV-A", "IV-B"],
      gatingConfig: {
        questionId: "tanf_gating",
        questionText: "Have you received Temporary Assistance for Needy Families (TANF) or similar cash assistance?",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No", "Not Sure"],
        skipMessage: "No problem! Moving on to the next section.",
      },
      questions: [
        {
          id: "tanf_duration",
          question: "How long have you received TANF benefits?",
          type: "radio",
          required: true,
          options: ["Less than 9 months", "9-18 months", "18+ months"],
          targetGroup: "IV-B",
          eligibleValues: ["18+ months"],
        },
        {
          id: "tanf_household_size",
          question: "How many people are in your household?",
          type: "number",
          required: false,
        },
      ],
      order: 1,
      completionMessage: "Thank you for sharing this information!",
    },
    
    // Section 2: Veterans
    {
      id: "section-veterans",
      name: "Veteran Status",
      description: "Questions for veterans and active service members",
      icon: "Shield",
      targetGroups: ["V", "V-Unemployed-4wk", "V-Unemployed-6mo", "V-Disability", "V-Disability-Unemployed-6mo"],
      gatingConfig: {
        questionId: "veteran_gating",
        questionText: "Are you a veteran or currently serving in the military?",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No"],
        skipMessage: "Thank you! Let's move to the next section.",
      },
      questions: [
        {
          id: "veteran_discharge_date",
          question: "When were you discharged from military service?",
          type: "date",
          required: true,
          ui: {
            helpText: "Enter the date shown on your DD-214 form",
          },
        },
        {
          id: "veteran_unemployment_duration",
          question: "How long have you been unemployed or underemployed since discharge?",
          type: "radio",
          required: true,
          options: ["Less than 4 weeks", "4 weeks to 6 months", "6 months or more", "Not unemployed"],
          targetGroup: "V-Unemployed-6mo",
          eligibleValues: ["6 months or more"],
        },
        {
          id: "veteran_disability",
          question: "Do you have a service-connected disability?",
          type: "radio",
          required: true,
          options: ["Yes", "No"],
          targetGroup: "V-Disability",
          eligibleValues: ["Yes"],
          followUpQuestions: [
            {
              id: "veteran_disability_rating",
              question: "What is your disability rating percentage?",
              type: "select",
              required: true,
              options: ["10%", "20%", "30%", "40%", "50%", "60%", "70%", "80%", "90%", "100%"],
              displayCondition: {
                sourceQuestionId: "veteran_disability",
                operator: "equals",
                value: "Yes",
              },
            },
          ],
        },
      ],
      order: 2,
      completionMessage: "Thank you for your service!",
    },
    
    // Section 3: Ex-Felons
    {
      id: "section-exfelon",
      name: "Criminal Justice Background",
      description: "Confidential questions about criminal justice involvement",
      icon: "Scale",
      targetGroups: ["VI"],
      gatingConfig: {
        questionId: "exfelon_gating",
        questionText: "Have you been convicted of a felony?",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No", "Prefer not to answer"],
        skipMessage: "No problem! We're moving to the next section.",
      },
      questions: [
        {
          id: "exfelon_release_date",
          question: "When were you released from prison or a halfway house?",
          type: "date",
          required: true,
          ui: {
            helpText: "This information is confidential and used only for tax credit eligibility",
          },
        },
        {
          id: "exfelon_state",
          question: "In which state were you convicted?",
          type: "text",
          required: false,
        },
      ],
      order: 3,
      completionMessage: "Thank you for sharing this sensitive information.",
    },
    
    // Section 4: Vocational Rehabilitation
    {
      id: "section-voc-rehab",
      name: "Vocational Rehabilitation",
      description: "Questions about vocational rehabilitation services",
      icon: "Briefcase",
      targetGroups: ["VIII"],
      gatingConfig: {
        questionId: "voc_rehab_gating",
        questionText: "Have you received vocational rehabilitation services?",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No", "Not Sure"],
      },
      questions: [
        {
          id: "voc_rehab_agency",
          question: "Which agency provided your vocational rehabilitation services?",
          type: "select",
          required: true,
          options: [
            "State Vocational Rehabilitation Agency",
            "Veterans Administration",
            "Department of Labor",
            "Other",
          ],
        },
        {
          id: "voc_rehab_completion_date",
          question: "When did you complete or were you referred from the program?",
          type: "date",
          required: true,
        },
      ],
      order: 4,
      completionMessage: "Great! Your rehabilitation services may qualify you for benefits.",
    },
    
    // Section 5: SNAP Benefits
    {
      id: "section-snap",
      name: "SNAP Benefits",
      description: "Questions about food assistance programs",
      icon: "ShoppingCart",
      targetGroups: ["IX"],
      gatingConfig: {
        questionId: "snap_gating",
        questionText: "Do you currently receive SNAP (food stamps) benefits?",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No", "Not Sure"],
      },
      questions: [
        {
          id: "snap_duration",
          question: "How long have you received SNAP benefits?",
          type: "radio",
          required: true,
          options: ["Less than 3 months", "3-6 months", "6+ months"],
          ui: {
            encouragingMessage: "You're doing great!",
          },
        },
        {
          id: "snap_household_size",
          question: "How many people are in your household?",
          type: "number",
          required: false,
        },
      ],
      order: 5,
    },
    
    // Section 6: SSI Recipients
    {
      id: "section-ssi",
      name: "Supplemental Security Income",
      description: "Questions about SSI benefits",
      icon: "Heart",
      targetGroups: ["X"],
      gatingConfig: {
        questionId: "ssi_gating",
        questionText: "Do you receive Supplemental Security Income (SSI) benefits?",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No"],
      },
      questions: [
        {
          id: "ssi_start_date",
          question: "When did you start receiving SSI benefits?",
          type: "date",
          required: true,
        },
      ],
      order: 6,
    },
    
    // Section 7: Long-term Unemployment
    {
      id: "section-unemployment",
      name: "Unemployment History",
      description: "Questions about your employment status",
      icon: "TrendingDown",
      targetGroups: ["XII"],
      gatingConfig: {
        questionId: "unemployment_gating",
        questionText: "Have you been unemployed or looking for work?",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No"],
      },
      questions: [
        {
          id: "unemployment_duration",
          question: "How long have you been unemployed?",
          type: "radio",
          required: true,
          options: ["Less than 4 weeks", "4-12 weeks", "12-27 weeks", "27+ weeks"],
          targetGroup: "XII",
          eligibleValues: ["27+ weeks"],
        },
        {
          id: "unemployment_benefits",
          question: "Have you received unemployment insurance?",
          type: "radio",
          required: false,
          options: ["Yes", "No", "Benefits Exhausted"],
        },
      ],
      order: 7,
    },
  ];
}

/**
 * Complete signature and auto-generate employer account
 */
export async function completeSignatureAndActivate(etaFormId: string, signedByName: string, signedByEmail: string) {
  // 1. Get the ETA form
  const [etaForm] = await db
    .select()
    .from(etaForm9198)
    .where(eq(etaForm9198.id, etaFormId));

  if (!etaForm) {
    throw new Error("ETA Form 9198 not found");
  }

  if (etaForm.status === "signed") {
    throw new Error("This form has already been signed");
  }

  // 2. Generate unique questionnaire URL
  const questionnaireUrl = await generateUniqueQuestionnaireUrl(etaForm.employerName);

  // 3. Create employer record
  const [newEmployer] = await db
    .insert(employers)
    .values({
      name: etaForm.employerName,
      ein: etaForm.ein,
      contactEmail: etaForm.contactEmail,
      contactPhone: etaForm.contactPhone,
      address: etaForm.address || undefined,
      city: etaForm.city || undefined,
      state: etaForm.state || undefined,
      zipCode: etaForm.zipCode || undefined,
      questionnaireUrl,
      onboardingStatus: "active",
      activatedAt: new Date(),
      welcomeMessage: `Welcome to ${etaForm.employerName}! Please complete this quick screening to help us maximize your tax benefits.`,
    })
    .returning();

  // 4. Create default comprehensive WOTC questionnaire
  await db.insert(questionnaires).values({
    employerId: newEmployer.id,
    name: "WOTC Comprehensive Screening 2024",
    description: "Complete screening for all Work Opportunity Tax Credit target groups",
    isActive: true,
    questions: getDefaultWotcQuestionnaire(),
  });

  // 5. Update ETA form status
  await db
    .update(etaForm9198)
    .set({
      status: "signed",
      signedAt: new Date(),
      authorizedName: signedByName,
      employerId: newEmployer.id,
    })
    .where(eq(etaForm9198.id, etaFormId));

  return {
    employer: newEmployer,
    questionnaireUrl: `/screen/${questionnaireUrl}`,
    message: "Employer account created successfully!",
  };
}
