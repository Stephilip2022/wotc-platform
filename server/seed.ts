import { db } from "./db";
import { employers, users, employees, questionnaires } from "@shared/schema";
import { sql, eq } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Create sample employers (or get existing)
  let employer1 = await db
    .insert(employers)
    .values({
      name: "Acme Corporation",
      ein: "12-3456789",
      contactEmail: "hr@acme.com",
      contactPhone: "(555) 123-4567",
      address: "123 Tech Ave",
      city: "San Francisco",
      state: "CA",
      zipCode: "94102",
      primaryColor: "#3B82F6",
      logoUrl: null,
    })
    .onConflictDoNothing()
    .returning()
    .then(rows => rows[0]);

  // If employer already exists, fetch it
  if (!employer1) {
    employer1 = await db.select().from(employers).where(sql`ein = '12-3456789'`).then(rows => rows[0]);
  }

  let employer2 = await db
    .insert(employers)
    .values({
      name: "Global Retail Inc",
      ein: "98-7654321",
      contactEmail: "jobs@globalretail.com",
      contactPhone: "(555) 987-6543",
      address: "456 Market St",
      city: "New York",
      state: "NY",
      zipCode: "10001",
      primaryColor: "#10B981",
      logoUrl: null,
    })
    .onConflictDoNothing()
    .returning()
    .then(rows => rows[0]);

  if (!employer2) {
    employer2 = await db.select().from(employers).where(sql`ein = '98-7654321'`).then(rows => rows[0]);
  }

  console.log("✓ Created employers");

  // Create test employee user linked to employer1
  if (employer1) {
    const [testUser] = await db
      .insert(users)
      .values({
        email: "test.employee@example.com",
        firstName: "Test",
        lastName: "Employee",
        role: "employee",
        employerId: employer1.id,
      })
      .onConflictDoNothing()
      .returning();

    if (testUser) {
      await db
        .insert(employees)
        .values({
          employerId: employer1.id,
          userId: testUser.id,
          firstName: "Test",
          lastName: "Employee",
          email: "test.employee@example.com",
          status: "screening",
        })
        .onConflictDoNothing();

      console.log("✓ Created test employee user");
    }
  }

  // Create comprehensive WOTC questionnaire for employer1
  if (employer1) {
    const sections = [
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

    await db
      .insert(questionnaires)
      .values({
        name: "WOTC Comprehensive Screening 2024",
        employerId: employer1.id,
        description: "Complete screening for all Work Opportunity Tax Credit target groups",
        isActive: true,
        questions: sections, // Store sections in the questions field
      })
      .onConflictDoNothing();

    console.log("✓ Created comprehensive WOTC questionnaire for Acme Corporation");
  }

  if (employer2) {
    await db
      .insert(questionnaires)
      .values({
        name: "WOTC Retail Screening",
        employerId: employer2.id,
        isActive: true,
        questions: [
          {
            id: "q1",
            question: "Have you received any government assistance in the past year?",
            type: "radio",
            required: true,
            options: ["Yes", "No"],
          },
          {
            id: "q2",
            question: "If yes, what type of assistance?",
            type: "checkbox",
            required: false,
            options: ["SNAP/Food Stamps", "TANF", "SSI", "Unemployment", "None"],
            targetGroup: "IX",
            eligibilityTrigger: ["SNAP/Food Stamps"],
          },
          {
            id: "q3",
            question: "Are you between the ages of 18-24?",
            type: "radio",
            required: true,
            options: ["Yes", "No"],
          },
          {
            id: "q4",
            question: "Have you been employed in the last 6 months?",
            type: "radio",
            required: true,
            options: ["Yes", "No"],
          },
        ],
      })
      .onConflictDoNothing();

    console.log("✓ Created questionnaire for Global Retail Inc");
  }

  console.log("✅ Seeding complete!");
}

seed()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  })
  .then(() => {
    process.exit(0);
  });
