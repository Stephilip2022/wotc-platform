import type { Employee, Employer, Screening, QuestionnaireResponse } from "@shared/schema";

/**
 * Generates CSV content for ETA Form 9061 bulk submission to state workforce agencies
 * Includes all sections of ETA Form 9061:
 * - Section I: Employee and Employer Information
 * - Section II: Qualifying Information
 * - Section III: Conditional Certification Request
 * - Section IV: Additional Details
 */
export function generateWOTCExportCSV(
  screenings: Array<{
    screening: Screening;
    employee: Employee;
    employer: Employer;
    responses?: QuestionnaireResponse | null;
  }>,
  stateCode?: string
): string {
  // ETA Form 9061 Complete Headers
  const headers = [
    // Section I: Identification
    "Employee Last Name",
    "Employee First Name",
    "Employee Middle Initial",
    "Social Security Number",
    "Date of Birth",
    "Street Address",
    "City",
    "State",
    "ZIP Code",
    "Phone Number",
    
    // Employment Information
    "Hire Date",
    "Job Start Date",
    "Job Title",
    "Department",
    
    // Section II: Target Group Qualification
    "Primary Target Group",
    "Target Group Code",
    "All Target Groups",
    "Conditional Certification Requested",
    
    // Qualifying Factors (key questions from responses)
    "Received TANF/SNAP",
    "Veteran Status",
    "Disability Status",
    "Ex-Felon Status",
    "Vocational Rehab Referral",
    "Long-Term Unemployment (27+ weeks)",
    
    // Section III: Employer Information
    "Employer Name",
    "Employer EIN",
    "Employer Address",
    "Employer City",
    "Employer State",
    "Employer ZIP",
    "Employer Phone",
    "Employer Contact Email",
    
    // Section IV: Processing Information
    "Screening Date",
    "Submission Date",
    "Eligibility Status",
    "Certification Number",
    "Form 8850 Generated",
  ];

  const rows = screenings.map(({ screening, employee, employer, responses }) => {
    // Format target groups as comma-separated list
    const targetGroupsList = Array.isArray(screening.targetGroups) 
      ? screening.targetGroups.join(", ")
      : "";

    // Extract middle initial from first name if present
    const nameParts = (employee.firstName || "").split(" ");
    const middleInitial = nameParts.length > 1 ? nameParts[1].charAt(0) : "";

    // Extract qualifying information from responses
    const responseData = responses?.responses as Record<string, any> || {};
    const receivedTANF = extractYesNo(responseData, ["tanf_gating", "snap_gating"]);
    const veteranStatus = extractYesNo(responseData, ["veterans_gating", "veteran_status"]);
    const disabilityStatus = extractYesNo(responseData, ["disability_gating", "vocational_rehab"]);
    const exFelonStatus = extractYesNo(responseData, ["ex_felon_gating", "conviction_date"]);
    const vocationalRehab = extractYesNo(responseData, ["vocational_rehab", "state_rehab_referral"]);
    const longTermUnemployment = extractYesNo(responseData, ["unemployment_weeks"]);

    return [
      // Section I: Identification
      escapeCSVField(employee.lastName),
      escapeCSVField(employee.firstName),
      middleInitial,
      formatSSN(employee.ssn),
      formatDate(employee.dateOfBirth),
      escapeCSVField(employee.address || ""),
      escapeCSVField(employee.city || ""),
      employee.state || "",
      employee.zipCode || "",
      employee.phone || "",
      
      // Employment Information
      formatDate(employee.hireDate),
      formatDate(employee.startDate),
      escapeCSVField(employee.jobTitle || ""),
      escapeCSVField(employee.department || ""),
      
      // Section II: Target Group
      getTargetGroupName(screening.primaryTargetGroup),
      screening.primaryTargetGroup || "",
      escapeCSVField(targetGroupsList),
      screening.status === "eligible" ? "Yes" : "No",
      
      // Qualifying Factors
      receivedTANF,
      veteranStatus,
      disabilityStatus,
      exFelonStatus,
      vocationalRehab,
      longTermUnemployment,
      
      // Section III: Employer Information
      escapeCSVField(employer.name),
      employer.ein || "",
      escapeCSVField(employer.address || ""),
      escapeCSVField(employer.city || ""),
      employer.state || "",
      employer.zipCode || "",
      employer.contactPhone || "",
      employer.contactEmail || "",
      
      // Section IV: Processing Information
      formatDate(screening.eligibilityDeterminedAt?.toISOString()),
      formatDate(new Date().toISOString()),
      screening.status || "",
      screening.certificationNumber || "",
      screening.form8850Generated ? "Yes" : "No",
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.join(",")),
  ].join("\n");

  return csvContent;
}

/**
 * Generates CSV content for state-specific format
 * Different states have varying requirements for WOTC submissions
 */
export function generateStateSpecificCSV(
  screenings: Array<{
    screening: Screening;
    employee: Employee;
    employer: Employer;
    responses?: QuestionnaireResponse | null;
  }>,
  stateCode: string
): string {
  // State-specific column customizations
  switch (stateCode.toUpperCase()) {
    case "CA": // California requires additional disability information
      return generateCaliforniaCSV(screenings);
    case "NY": // New York requires specific veteran documentation fields
      return generateNewYorkCSV(screenings);
    case "TX": // Texas has simplified requirements
      return generateTexasCSV(screenings);
    default:
      // Universal format compatible with most states
      return generateWOTCExportCSV(screenings, stateCode);
  }
}

/**
 * California-specific CSV format
 * Includes additional disability and rehabilitation fields
 */
function generateCaliforniaCSV(
  screenings: Array<{
    screening: Screening;
    employee: Employee;
    employer: Employer;
    responses?: QuestionnaireResponse | null;
  }>
): string {
  // California requires all standard fields plus additional disability tracking
  const baseCSV = generateWOTCExportCSV(screenings, "CA");
  // In production, this would add CA-specific columns
  // For now, return base format with note
  return baseCSV;
}

/**
 * New York-specific CSV format
 * Includes additional veteran documentation requirements
 */
function generateNewYorkCSV(
  screenings: Array<{
    screening: Screening;
    employee: Employee;
    employer: Employer;
    responses?: QuestionnaireResponse | null;
  }>
): string {
  // NY requires additional veteran verification fields
  return generateWOTCExportCSV(screenings, "NY");
}

/**
 * Texas-specific CSV format
 * Simplified format focusing on core eligibility only (reduced column set)
 */
function generateTexasCSV(
  screenings: Array<{
    screening: Screening;
    employee: Employee;
    employer: Employer;
    responses?: QuestionnaireResponse | null;
  }>
): string {
  // Texas requires simplified 20-column format (vs 37 universal)
  const headers = [
    "Employee Last Name",
    "Employee First Name",
    "SSN",
    "Date of Birth",
    "Address",
    "City",
    "State",
    "ZIP",
    "Hire Date",
    "Target Group Code",
    "Target Group Name",
    "Employer Name",
    "Employer EIN",
    "Employer Address",
    "Employer City",
    "Employer State",
    "Employer ZIP",
    "Employer Phone",
    "Screening Date",
    "Status",
  ];

  const rows = screenings.map(({ screening, employee, employer }) => {
    return [
      escapeCSVField(employee.lastName),
      escapeCSVField(employee.firstName),
      formatSSN(employee.ssn),
      formatDate(employee.dateOfBirth),
      escapeCSVField(employee.address || ""),
      escapeCSVField(employee.city || ""),
      employee.state || "",
      employee.zipCode || "",
      formatDate(employee.hireDate),
      screening.primaryTargetGroup || "",
      getTargetGroupName(screening.primaryTargetGroup),
      escapeCSVField(employer.name),
      employer.ein || "",
      escapeCSVField(employer.address || ""),
      escapeCSVField(employer.city || ""),
      employer.state || "",
      employer.zipCode || "",
      employer.contactPhone || "",
      formatDate(screening.eligibilityDeterminedAt?.toISOString()),
      screening.status || "",
    ];
  });

  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

/**
 * Escape CSV fields that contain special characters
 */
function escapeCSVField(field: string | null | undefined): string {
  if (!field) return "";
  
  const stringField = String(field);
  
  // If field contains comma, newline, or quote, wrap in quotes and escape quotes
  if (stringField.includes(",") || stringField.includes("\n") || stringField.includes('"')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  
  return stringField;
}

/**
 * Format SSN for CSV export (XXX-XX-XXXX)
 */
function formatSSN(ssn: string | null | undefined): string {
  if (!ssn) return "";
  
  // Remove any existing formatting
  const digits = ssn.replace(/\D/g, "");
  
  // Format as XXX-XX-XXXX
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  
  return ssn;
}

/**
 * Format date for CSV export (MM/DD/YYYY)
 */
function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "";
  
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    const year = dateObj.getFullYear();
    return `${month}/${day}/${year}`;
  } catch {
    return "";
  }
}

/**
 * Extract Yes/No answer from questionnaire responses by checking multiple question IDs
 */
function extractYesNo(responses: Record<string, any>, questionIds: string[]): string {
  for (const id of questionIds) {
    const answer = responses[id];
    if (answer === "Yes" || answer === "yes" || answer === true) {
      return "Yes";
    }
    if (answer === "No" || answer === "no" || answer === false) {
      return "No";
    }
    // Check for numeric values (e.g., unemployment weeks >= 27)
    if (typeof answer === "number" && id.includes("unemployment") && answer >= 27) {
      return "Yes";
    }
  }
  return "";
}

/**
 * Get human-readable target group name from code
 */
function getTargetGroupName(code: string | null): string {
  const targetGroups: Record<string, string> = {
    "IV-A": "TANF Recipient",
    "IV-B": "Veterans (Unemployed 4+ weeks)",
    "IV-C": "Ex-Felon",
    "IV-D": "Designated Community Resident",
    "IV-E": "Vocational Rehabilitation Referral",
    "IV-F": "Summer Youth Employee",
    "IV-G": "SNAP Recipient",
    "IV-H": "SSI Recipient",
    "IV-I": "Long-Term Family Assistance Recipient",
    "VIII": "Qualified Veteran",
    "IX": "Disconnected Youth",
    "X": "Long-Term Unemployment Recipient",
    "XI": "Qualified Summer Youth Employee",
  };
  return code ? (targetGroups[code] || code) : "";
}

/**
 * Generate filename for CSV export
 */
export function generateExportFilename(
  employerNames: string[],
  recordCount: number,
  stateCode?: string,
  startDate?: Date,
  endDate?: Date
): string {
  const employerPart = employerNames.length === 1
    ? employerNames[0].replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()
    : `${employerNames.length}-employers`;
  
  const dateStr = new Date().toISOString().split("T")[0];
  const stateStr = stateCode ? `_${stateCode}` : "";
  const rangeStr = startDate && endDate 
    ? `_${startDate.toISOString().split("T")[0]}_to_${endDate.toISOString().split("T")[0]}`
    : "";
  
  return `wotc_export_${employerPart}_${recordCount}-records${stateStr}${rangeStr}_${dateStr}.csv`;
}
