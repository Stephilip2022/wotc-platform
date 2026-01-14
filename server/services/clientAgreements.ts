import { db } from "../db";
import { clientAgreements, employers } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const ROCKERBOX_INFO = {
  name: "Rockerbox Technologies, LLC",
  address: "1234 Tax Credit Drive, Suite 500, Austin, TX 78701",
  phone: "(512) 555-WOTC",
  email: "wotc@rockerbox.tech",
  representativeName: "WOTC Processing Team",
  representativeTitle: "Authorized Representative",
};

export interface EngagementLetterData {
  employerId: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  feeStructure: "percentage" | "flat_fee" | "hybrid";
  feePercentage?: number;
  flatFeeAmount?: number;
  minimumFee?: number;
  paymentTerms: "upon_certification" | "monthly" | "quarterly";
  contractDuration: "1_year" | "2_year" | "ongoing";
}

export interface Form9198Data {
  employerId: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  authorizationStartDate: string;
  authorizationEndDate?: string;
}

export async function generateEngagementLetter(data: EngagementLetterData) {
  const [employer] = await db.select().from(employers).where(eq(employers.id, data.employerId));
  
  if (!employer) {
    throw new Error("Employer not found");
  }

  const feeDescription = getFeeDescription(data);
  const paymentTermsDescription = getPaymentTermsDescription(data.paymentTerms);
  const durationDescription = getDurationDescription(data.contractDuration);
  const effectiveDate = new Date().toLocaleDateString("en-US", { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });

  const content = `
WOTC SERVICES ENGAGEMENT LETTER

Effective Date: ${effectiveDate}

PARTIES:

Service Provider:
${ROCKERBOX_INFO.name}
${ROCKERBOX_INFO.address}
Phone: ${ROCKERBOX_INFO.phone}
Email: ${ROCKERBOX_INFO.email}

Client:
${employer.name}
EIN: ${employer.ein}
${employer.address || ""}
${employer.city ? `${employer.city}, ${employer.state} ${employer.zipCode}` : ""}
Contact: ${data.signerName}, ${data.signerTitle}
Email: ${data.signerEmail}

1. SCOPE OF SERVICES

Rockerbox Technologies, LLC ("Rockerbox") agrees to provide the following Work Opportunity Tax Credit (WOTC) services to ${employer.name} ("Client"):

a) Employee Screening: Automated WOTC eligibility screening for all new hires
b) Form Preparation: Preparation and submission of IRS Form 8850 and ETA Form 9061/9062
c) State Submission: Electronic submission to state workforce agencies in all 50 states
d) Credit Tracking: Real-time tracking of certification status and credit calculations
e) Documentation: Secure storage of all WOTC-related documentation
f) Reporting: Monthly and annual WOTC credit reports and analytics
g) Support: Dedicated support for WOTC-related questions and compliance

2. FEE STRUCTURE

${feeDescription}

3. PAYMENT TERMS

${paymentTermsDescription}

4. TERM AND TERMINATION

${durationDescription}

Either party may terminate this Agreement with 30 days written notice. Upon termination:
- All pending WOTC submissions will be completed
- Client will be responsible for fees on credits certified prior to termination
- All Client data will be securely transferred or deleted per Client's instructions

5. CONFIDENTIALITY

Both parties agree to maintain the confidentiality of all proprietary information, employee data, and business information shared during the course of this engagement. Rockerbox maintains SOC 2 Type II compliance and encrypts all sensitive data.

6. REPRESENTATIONS AND WARRANTIES

Rockerbox represents that it will:
- Perform services in a professional manner
- Comply with all applicable federal and state laws
- Maintain appropriate insurance coverage
- Protect Client data in accordance with industry standards

Client represents that it will:
- Provide accurate employee information
- Maintain required documentation for WOTC claims
- Authorize Rockerbox to act as its representative for WOTC submissions
- Execute ETA Form 9198 (Employer Representative Declaration)

7. LIMITATION OF LIABILITY

Rockerbox's liability under this Agreement shall be limited to the fees paid by Client in the 12 months preceding any claim. Rockerbox is not liable for credits denied due to inaccurate information provided by Client or changes in tax law.

8. GOVERNING LAW

This Agreement shall be governed by the laws of the State of Texas.

9. ACCEPTANCE

By signing below, Client agrees to the terms of this Engagement Letter and authorizes Rockerbox to provide WOTC services as described herein.

CLIENT SIGNATURE:

_________________________________
${data.signerName}
${data.signerTitle}
${employer.name}

Date: _________________

ROCKERBOX TECHNOLOGIES, LLC:

_________________________________
${ROCKERBOX_INFO.representativeName}
${ROCKERBOX_INFO.representativeTitle}

Date: ${effectiveDate}
`.trim();

  const [agreement] = await db.insert(clientAgreements).values({
    employerId: data.employerId,
    documentType: "engagement_letter",
    documentContent: content,
    signerName: data.signerName,
    signerTitle: data.signerTitle,
    signerEmail: data.signerEmail,
    feeStructure: data.feeStructure,
    feePercentage: data.feePercentage?.toString(),
    flatFeeAmount: data.flatFeeAmount?.toString(),
    minimumFee: data.minimumFee?.toString(),
    paymentTerms: data.paymentTerms,
    contractDuration: data.contractDuration,
    status: "draft",
  }).returning();

  return agreement;
}

export async function generateForm9198(data: Form9198Data) {
  const [employer] = await db.select().from(employers).where(eq(employers.id, data.employerId));
  
  if (!employer) {
    throw new Error("Employer not found");
  }

  const effectiveDate = new Date().toLocaleDateString("en-US", { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });

  const content = `
ETA FORM 9198
EMPLOYER REPRESENTATIVE DECLARATION
Work Opportunity Tax Credit (WOTC)

OMB Control No. 1205-0371
Expiration Date: XX/XX/XXXX

SECTION A: EMPLOYER INFORMATION

1. Employer Legal Name: ${employer.name}

2. Employer Identification Number (EIN): ${employer.ein}

3. Employer Address:
   Street: ${employer.address || ""}
   City: ${employer.city || ""}
   State: ${employer.state || ""}
   ZIP Code: ${employer.zipCode || ""}

4. Employer Contact:
   Name: ${data.signerName}
   Title: ${data.signerTitle}
   Email: ${data.signerEmail}
   Phone: ${employer.contactPhone || ""}

SECTION B: REPRESENTATIVE INFORMATION

5. Representative Organization Name: ${ROCKERBOX_INFO.name}

6. Representative Address:
   ${ROCKERBOX_INFO.address}

7. Representative Contact:
   Name: ${ROCKERBOX_INFO.representativeName}
   Title: ${ROCKERBOX_INFO.representativeTitle}
   Email: ${ROCKERBOX_INFO.email}
   Phone: ${ROCKERBOX_INFO.phone}

SECTION C: AUTHORIZATION SCOPE

8. The employer hereby authorizes the representative named above to act on behalf of the employer for the following WOTC-related activities:

   [X] Submit IRS Form 8850 (Pre-Screening Notice and Certification Request)
   [X] Submit ETA Form 9061 (Individual Characteristics Form)
   [X] Submit ETA Form 9062 (Conditional Certification)
   [X] Receive and respond to correspondence from State Workforce Agencies
   [X] Request certification status information
   [X] Submit appeals for denied certifications
   [X] Access WOTC portal systems on employer's behalf
   [X] Receive certification and denial letters
   [X] Correct or amend previously submitted forms

9. Authorization Period:
   Start Date: ${data.authorizationStartDate}
   End Date: ${data.authorizationEndDate || "Until revoked in writing"}

SECTION D: EMPLOYER CERTIFICATION

I, ${data.signerName}, hereby certify that:

a) I am authorized to sign on behalf of the employer named above.

b) The information provided in this declaration is true and accurate to the best of my knowledge.

c) I authorize ${ROCKERBOX_INFO.name} to act as our representative for WOTC purposes as described in Section C.

d) I understand that I may revoke this authorization at any time by providing written notice to both the representative and the appropriate State Workforce Agency.

e) This authorization supersedes any previous Employer Representative Declaration submitted for the employer named above.

f) I understand that the representative is acting on behalf of the employer and that the employer remains responsible for ensuring the accuracy of all information submitted.

EMPLOYER SIGNATURE:

_________________________________
Signature

${data.signerName}
Printed Name

${data.signerTitle}
Title

Date: _________________

SECTION E: REPRESENTATIVE ACKNOWLEDGMENT

I, on behalf of ${ROCKERBOX_INFO.name}, acknowledge receipt of this authorization and agree to:

a) Act in accordance with the scope of authority granted above.
b) Maintain the confidentiality of all employer and employee information.
c) Comply with all applicable federal and state laws regarding WOTC.
d) Provide the employer with copies of all submissions and correspondence.
e) Notify the employer immediately of any certification decisions.

REPRESENTATIVE SIGNATURE:

_________________________________
${ROCKERBOX_INFO.representativeName}
${ROCKERBOX_INFO.representativeTitle}
${ROCKERBOX_INFO.name}

Date: ${effectiveDate}

---

PRIVACY ACT STATEMENT

The information collected on this form is authorized by Section 51 of the Internal Revenue Code and 20 CFR 652.3. The information will be used by State Workforce Agencies to process WOTC certification requests. Providing this information is voluntary; however, failure to provide complete information may result in processing delays.

Public Burden Statement: Persons are not required to respond to this collection of information unless it displays a currently valid OMB control number. Public reporting burden for this collection of information is estimated to average 10 minutes per response.
`.trim();

  const [agreement] = await db.insert(clientAgreements).values({
    employerId: data.employerId,
    documentType: "eta_form_9198",
    documentContent: content,
    signerName: data.signerName,
    signerTitle: data.signerTitle,
    signerEmail: data.signerEmail,
    representativeName: ROCKERBOX_INFO.representativeName,
    representativeTitle: ROCKERBOX_INFO.representativeTitle,
    representativeAddress: ROCKERBOX_INFO.address,
    representativePhone: ROCKERBOX_INFO.phone,
    representativeEmail: ROCKERBOX_INFO.email,
    authorizationStartDate: data.authorizationStartDate,
    authorizationEndDate: data.authorizationEndDate,
    authorizationScope: "full_wotc_representation",
    status: "draft",
  }).returning();

  return agreement;
}

export async function signAgreement(
  agreementId: string, 
  signatureData: string,
  ipAddress: string,
  userAgent: string
) {
  const [updated] = await db.update(clientAgreements)
    .set({
      signatureData,
      signedAt: new Date(),
      signatureIpAddress: ipAddress,
      signatureUserAgent: userAgent,
      status: "signed",
      updatedAt: new Date(),
    })
    .where(eq(clientAgreements.id, agreementId))
    .returning();

  return updated;
}

export async function getAgreementsByEmployer(employerId: string) {
  return db.select()
    .from(clientAgreements)
    .where(eq(clientAgreements.employerId, employerId))
    .orderBy(clientAgreements.createdAt);
}

export async function getAgreementById(id: string) {
  const [agreement] = await db.select()
    .from(clientAgreements)
    .where(eq(clientAgreements.id, id));
  return agreement;
}

export async function sendAgreementForSignature(agreementId: string) {
  const [updated] = await db.update(clientAgreements)
    .set({
      status: "sent",
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    })
    .where(eq(clientAgreements.id, agreementId))
    .returning();

  return updated;
}

export async function checkOnboardingDocumentsStatus(employerId: string) {
  const agreements = await getAgreementsByEmployer(employerId);
  
  const engagementLetter = agreements.find(a => a.documentType === "engagement_letter");
  const form9198 = agreements.find(a => a.documentType === "eta_form_9198");
  
  return {
    hasEngagementLetter: !!engagementLetter,
    engagementLetterStatus: engagementLetter?.status || "not_created",
    engagementLetterSigned: engagementLetter?.status === "signed",
    hasForm9198: !!form9198,
    form9198Status: form9198?.status || "not_created",
    form9198Signed: form9198?.status === "signed",
    allDocumentsSigned: engagementLetter?.status === "signed" && form9198?.status === "signed",
  };
}

function getFeeDescription(data: EngagementLetterData): string {
  switch (data.feeStructure) {
    case "percentage":
      return `Client agrees to pay Rockerbox ${data.feePercentage || 25}% of all WOTC tax credits successfully certified and claimed.${data.minimumFee ? ` A minimum fee of $${data.minimumFee} per certified credit applies.` : ""}`;
    case "flat_fee":
      return `Client agrees to pay Rockerbox a flat fee of $${data.flatFeeAmount || 100} per employee screened, regardless of certification outcome.`;
    case "hybrid":
      return `Client agrees to pay Rockerbox ${data.feePercentage || 20}% of all WOTC tax credits successfully certified, plus a processing fee of $${data.flatFeeAmount || 25} per employee screened.${data.minimumFee ? ` A minimum fee of $${data.minimumFee} per certified credit applies.` : ""}`;
    default:
      return "Fee structure to be determined.";
  }
}

function getPaymentTermsDescription(paymentTerms: string): string {
  switch (paymentTerms) {
    case "upon_certification":
      return "Fees are due within 30 days of credit certification notification. Rockerbox will invoice Client for each batch of certified credits.";
    case "monthly":
      return "Rockerbox will invoice Client monthly for all credits certified during the previous month. Payment is due within 30 days of invoice date.";
    case "quarterly":
      return "Rockerbox will invoice Client quarterly for all credits certified during the previous quarter. Payment is due within 30 days of invoice date.";
    default:
      return "Payment terms to be determined.";
  }
}

function getDurationDescription(contractDuration: string): string {
  switch (contractDuration) {
    case "1_year":
      return "This Agreement shall be effective for a period of one (1) year from the Effective Date, and shall automatically renew for successive one-year terms unless either party provides written notice of non-renewal at least 60 days prior to the end of the then-current term.";
    case "2_year":
      return "This Agreement shall be effective for a period of two (2) years from the Effective Date, and shall automatically renew for successive one-year terms unless either party provides written notice of non-renewal at least 60 days prior to the end of the then-current term.";
    case "ongoing":
      return "This Agreement shall be effective from the Effective Date and shall continue until terminated by either party in accordance with Section 4.";
    default:
      return "Contract duration to be determined.";
  }
}
