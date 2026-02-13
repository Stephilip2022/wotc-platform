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
 * Get state-level screening sections based on assigned programs
 * These are dynamically added to the questionnaire based on the employer's
 * state and their assigned credit programs.
 */
export function getStateLevelScreeningSections(
  assignedPrograms: Array<{ programId: string; programName: string; state: string; programCategory: string; isEnabled: boolean }>
): any[] {
  const sections: any[] = [];
  let order = 8;

  const enabledPrograms = assignedPrograms.filter(p => p.isEnabled);
  if (enabledPrograms.length === 0) return sections;

  const categorizedPrograms: Record<string, typeof enabledPrograms> = {};
  for (const p of enabledPrograms) {
    const cat = p.programCategory || "general_screening";
    if (!categorizedPrograms[cat]) categorizedPrograms[cat] = [];
    categorizedPrograms[cat].push(p);
  }

  const states = [...new Set(enabledPrograms.map(p => p.state))].sort();
  const stateLabel = states.length <= 3 ? states.join(", ") : `${states.length} states`;

  if (categorizedPrograms["veteran_credit"]) {
    const programs = categorizedPrograms["veteran_credit"];
    const programStates = [...new Set(programs.map(p => p.state))].sort();
    sections.push({
      id: "section-state-veteran",
      name: "State Veteran Credits",
      description: `Additional veteran tax credits available in ${programStates.join(", ")}`,
      icon: "Medal",
      targetGroups: ["State-Veteran"],
      gatingConfig: {
        questionId: "state_veteran_gating",
        questionText: "Are you a veteran or currently serving in the U.S. military? (State programs)",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No"],
        skipMessage: "No problem! Moving on to the next section.",
      },
      questions: [
        {
          id: "state_veteran_branch",
          question: "Which branch of the military did you serve in?",
          type: "select",
          required: true,
          options: ["Army", "Navy", "Air Force", "Marines", "Coast Guard", "Space Force", "National Guard", "Reserves"],
        },
        {
          id: "state_veteran_service_dates",
          question: "When did your active duty service end?",
          type: "date",
          required: true,
          ui: { helpText: "The date shown on your DD-214 discharge papers" },
        },
        {
          id: "state_veteran_campaign_service",
          question: "Did you serve during a recognized campaign period (e.g., Gulf War, Iraq, Afghanistan)?",
          type: "radio",
          required: true,
          options: ["Yes", "No", "Not Sure"],
        },
        {
          id: "state_veteran_disability_va",
          question: "Do you have a VA-rated service-connected disability?",
          type: "radio",
          required: true,
          options: ["Yes", "No"],
        },
        {
          id: "state_veteran_unemployment",
          question: "Were you unemployed for any period after your military service?",
          type: "radio",
          required: true,
          options: ["Yes, less than 4 weeks", "Yes, 4 weeks to 6 months", "Yes, more than 6 months", "No"],
        },
        {
          id: "state_veteran_hire_date",
          question: "What is your hire date or expected start date with this employer?",
          type: "date",
          required: true,
        },
      ],
      order: order++,
      completionMessage: "Thank you for your service! Your state may offer additional veteran employment credits.",
    });
  }

  if (categorizedPrograms["disability_credit"]) {
    const programs = categorizedPrograms["disability_credit"];
    const programStates = [...new Set(programs.map(p => p.state))].sort();
    sections.push({
      id: "section-state-disability",
      name: "State Disability Employment Credits",
      description: `Disability employment credits available in ${programStates.join(", ")}`,
      icon: "Accessibility",
      targetGroups: ["State-Disability"],
      gatingConfig: {
        questionId: "state_disability_gating",
        questionText: "Do you have a disability or receive disability-related services?",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No", "Prefer not to answer"],
        skipMessage: "No problem! Moving on to the next section.",
      },
      questions: [
        {
          id: "state_disability_type",
          question: "What type of disability do you have?",
          type: "select",
          required: true,
          options: [
            "Physical disability",
            "Developmental disability",
            "Sensory disability (vision/hearing)",
            "Mental health condition",
            "Intellectual disability",
            "Other",
            "Prefer not to specify",
          ],
        },
        {
          id: "state_disability_documentation",
          question: "Do you have documentation of your disability (e.g., from a physician, SSA, or state agency)?",
          type: "radio",
          required: true,
          options: ["Yes", "No", "In process"],
        },
        {
          id: "state_disability_vr_services",
          question: "Have you received services from a state vocational rehabilitation agency?",
          type: "radio",
          required: true,
          options: ["Yes, currently", "Yes, in the past", "No"],
        },
        {
          id: "state_disability_accommodations",
          question: "Do you require workplace accommodations or assistive devices?",
          type: "radio",
          required: false,
          options: ["Yes", "No", "Not Sure"],
        },
      ],
      order: order++,
      completionMessage: "Thank you for sharing. Your employer may qualify for state disability employment credits.",
    });
  }

  if (categorizedPrograms["enterprise_zone_credit"]) {
    const programs = categorizedPrograms["enterprise_zone_credit"];
    const programStates = [...new Set(programs.map(p => p.state))].sort();
    const programNames = programs.map(p => p.programName);
    sections.push({
      id: "section-state-enterprise-zone",
      name: "Enterprise Zone & Location Credits",
      description: `Location-based credits available in ${programStates.join(", ")}`,
      icon: "MapPin",
      targetGroups: ["State-EnterpriseZone"],
      gatingConfig: {
        questionId: "state_ez_gating",
        questionText: "Do you live in or near a designated enterprise zone, empowerment zone, or opportunity zone?",
        applicableAnswers: ["Yes", "Not Sure"],
        notApplicableAnswers: ["No"],
        skipMessage: "No problem! We'll check this using your address information.",
      },
      questions: [
        {
          id: "state_ez_residence_address",
          question: "What is your home address (street, city, state, ZIP)?",
          type: "text",
          required: true,
          ui: { helpText: "We use this to check if you live in a qualifying zone" },
        },
        {
          id: "state_ez_residence_duration",
          question: "How long have you lived at your current address?",
          type: "radio",
          required: true,
          options: ["Less than 6 months", "6 months to 1 year", "1-3 years", "3+ years"],
        },
        {
          id: "state_ez_work_location",
          question: "Will you primarily work at a location within a designated zone?",
          type: "radio",
          required: false,
          options: ["Yes", "No", "Not Sure"],
        },
        {
          id: "state_ez_new_hire",
          question: "Is this a new position for you at this employer?",
          type: "radio",
          required: true,
          options: ["Yes, first time employed here", "No, transferring/rehired"],
        },
      ],
      order: order++,
      completionMessage: "Great! Your location information will help determine enterprise zone credit eligibility.",
    });
  }

  if (categorizedPrograms["youth_training_credit"]) {
    const programs = categorizedPrograms["youth_training_credit"];
    const programStates = [...new Set(programs.map(p => p.state))].sort();
    sections.push({
      id: "section-state-youth-training",
      name: "Youth, Apprenticeship & Training Credits",
      description: `Training and apprenticeship credits available in ${programStates.join(", ")}`,
      icon: "GraduationCap",
      targetGroups: ["State-YouthTraining"],
      gatingConfig: {
        questionId: "state_youth_gating",
        questionText: "Are you under 25, or currently in a training, apprenticeship, or internship program?",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No"],
        skipMessage: "No problem! Moving on to the next section.",
      },
      questions: [
        {
          id: "state_youth_age",
          question: "What is your age?",
          type: "select",
          required: true,
          options: ["16-17", "18-19", "20-24", "25-29", "30 or older"],
        },
        {
          id: "state_youth_program_type",
          question: "Are you enrolled in any of the following programs?",
          type: "select",
          required: true,
          options: [
            "Registered apprenticeship",
            "On-the-job training (OJT)",
            "Summer youth employment program",
            "Vocational/trade school",
            "Internship program",
            "None of the above",
          ],
        },
        {
          id: "state_youth_education_status",
          question: "What is your current education status?",
          type: "radio",
          required: true,
          options: ["Currently in school", "High school diploma/GED", "Some college", "College degree", "Did not complete high school"],
        },
        {
          id: "state_youth_first_job",
          question: "Is this your first job?",
          type: "radio",
          required: false,
          options: ["Yes", "No"],
        },
      ],
      order: order++,
      completionMessage: "Thank you! Training and apprenticeship programs can qualify for valuable state credits.",
    });
  }

  if (categorizedPrograms["reentry_credit"]) {
    const programs = categorizedPrograms["reentry_credit"];
    const programStates = [...new Set(programs.map(p => p.state))].sort();
    sections.push({
      id: "section-state-reentry",
      name: "Re-Entry Employment Credits",
      description: `Re-entry employment credits available in ${programStates.join(", ")}`,
      icon: "RotateCcw",
      targetGroups: ["State-Reentry"],
      gatingConfig: {
        questionId: "state_reentry_gating",
        questionText: "Have you been previously incarcerated or involved in the criminal justice system?",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No", "Prefer not to answer"],
        skipMessage: "No problem. All information is confidential.",
      },
      questions: [
        {
          id: "state_reentry_release_date",
          question: "When were you released from incarceration?",
          type: "date",
          required: true,
          ui: { helpText: "This information is strictly confidential and used only for tax credit eligibility" },
        },
        {
          id: "state_reentry_program",
          question: "Have you participated in any re-entry or rehabilitation programs?",
          type: "radio",
          required: true,
          options: ["Yes", "No"],
        },
        {
          id: "state_reentry_apprenticeship",
          question: "Are you enrolled in or have you completed an apprenticeship program after release?",
          type: "radio",
          required: false,
          options: ["Yes, currently enrolled", "Yes, completed", "No"],
        },
        {
          id: "state_reentry_conviction_type",
          question: "Was your conviction a felony?",
          type: "radio",
          required: true,
          options: ["Yes", "No"],
          ui: { helpText: "Some programs specifically apply to felony convictions" },
        },
      ],
      order: order++,
      completionMessage: "Thank you for sharing this sensitive information. It's kept strictly confidential.",
    });
  }

  if (categorizedPrograms["general_screening"]) {
    const programs = categorizedPrograms["general_screening"];
    const programStates = [...new Set(programs.map(p => p.state))].sort();
    const hasHistoric = programs.some(p => p.programName.toLowerCase().includes("historic") || p.programName.toLowerCase().includes("rehabilitation"));
    const hasRailOrInfra = programs.some(p => p.programName.toLowerCase().includes("rail") || p.programName.toLowerCase().includes("infrastructure"));

    sections.push({
      id: "section-state-general",
      name: "Additional State Credits",
      description: `Additional state-specific credits available in ${programStates.join(", ")}`,
      icon: "Landmark",
      targetGroups: ["State-General"],
      gatingConfig: {
        questionId: "state_general_gating",
        questionText: "Would you like to answer a few more questions to check for additional state tax credits?",
        applicableAnswers: ["Yes"],
        notApplicableAnswers: ["No, skip this"],
        skipMessage: "No problem! You can always come back to this section later.",
      },
      questions: [
        {
          id: "state_general_residence_state",
          question: "What state do you live in?",
          type: "text",
          required: true,
        },
        {
          id: "state_general_employment_type",
          question: "What type of employment is this position?",
          type: "select",
          required: true,
          options: ["Full-time", "Part-time", "Seasonal", "Temporary", "Contract"],
        },
        {
          id: "state_general_new_to_state",
          question: "Did you relocate to this state for this job?",
          type: "radio",
          required: false,
          options: ["Yes", "No"],
        },
        {
          id: "state_general_industry",
          question: "What industry or sector will you work in?",
          type: "select",
          required: false,
          options: [
            "Manufacturing",
            "Construction",
            "Technology",
            "Healthcare",
            "Retail",
            "Hospitality/Food Service",
            "Transportation/Logistics",
            "Agriculture",
            "Financial Services",
            "Education",
            "Government",
            "Other",
          ],
        },
      ],
      order: order++,
      completionMessage: "Thank you! This information helps us identify all available state credits.",
    });
  }

  return sections;
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
