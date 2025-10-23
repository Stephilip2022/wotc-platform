import { db } from "./db";
import { employers, users, employees, questionnaires } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // Create sample employers
  const [employer1] = await db
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
    .returning();

  const [employer2] = await db
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
    .returning();

  console.log("✓ Created employers");

  // Create default questionnaire for employer1
  if (employer1) {
    await db
      .insert(questionnaires)
      .values({
        name: "WOTC Standard Screening 2024",
        employerId: employer1.id,
        isActive: true,
        questions: [
          {
            id: "q1",
            question: "Have you received SNAP (Food Stamps) benefits in the last 6 months?",
            type: "radio",
            required: true,
            options: ["Yes", "No"],
            targetGroup: "IX",
            eligibilityTrigger: "Yes",
          },
          {
            id: "q2",
            question: "Are you a veteran who has been unemployed for at least 4 weeks?",
            type: "radio",
            required: true,
            options: ["Yes", "No"],
            targetGroup: "V",
            eligibilityTrigger: "Yes",
          },
          {
            id: "q3",
            question: "Have you received Supplemental Security Income (SSI) benefits?",
            type: "radio",
            required: true,
            options: ["Yes", "No"],
            targetGroup: "X",
            eligibilityTrigger: "Yes",
          },
          {
            id: "q4",
            question: "Are you a recipient of Temporary Assistance for Needy Families (TANF)?",
            type: "radio",
            required: true,
            options: ["Yes", "No"],
            targetGroup: "IV-B",
            eligibilityTrigger: "Yes",
          },
          {
            id: "q5",
            question: "Were you convicted of a felony and released from prison within the last year?",
            type: "radio",
            required: true,
            options: ["Yes", "No"],
            targetGroup: "VI",
            eligibilityTrigger: "Yes",
          },
          {
            id: "q6",
            question: "What is your date of birth?",
            type: "date",
            required: true,
            options: [],
          },
          {
            id: "q7",
            question: "What is your Social Security Number? (for verification purposes)",
            type: "text",
            required: true,
            options: [],
          },
          {
            id: "q8",
            question: "If you are a veteran, please upload your DD-214 form",
            type: "file",
            required: false,
            options: [],
          },
        ],
      })
      .onConflictDoNothing();

    console.log("✓ Created questionnaire for Acme Corporation");
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
