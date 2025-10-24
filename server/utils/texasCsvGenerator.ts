/**
 * Texas WOTC OLS Bulk Upload CSV Generator
 * 
 * Generates CSV files compliant with Texas Workforce Commission requirements
 * Based on Texas OLS bulk upload specifications and Form 8850/9061 fields
 */

import type { Employee, Screening } from "@shared/schema";

interface EmployeeWithScreening {
  employee: Employee;
  screening: Screening;
  employerEin: string;
  employerName: string;
  employerAddress?: string;
  employerCity?: string;
  employerState?: string;
  employerZip?: string;
  employerPhone?: string;
}

/**
 * Format date for Texas portal (M/D/YYYY format)
 */
function formatDateTexas(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Clean field - remove commas and quotes (Texas requirement: NO COMMAS)
 */
function cleanField(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/,/g, '').replace(/"/g, '').trim();
}

/**
 * Format as TEXT for CSV (preserves leading zeros in Excel)
 * Texas requires columns A, B, C, L to be TEXT format
 */
function formatAsText(value: string | null | undefined): string {
  if (!value) return '';
  // Use ="value" format to force Excel to treat as text
  return `="${cleanField(value)}"`;
}

/**
 * Format Y/N boolean
 */
function formatYN(value: boolean): string {
  return value ? 'Y' : 'N';
}

/**
 * Check if target groups include a specific category
 */
function hasTargetGroup(targetGroups: any, ...groups: string[]): boolean {
  const groupArray = Array.isArray(targetGroups) ? targetGroups : [];
  return groups.some(g => groupArray.includes(g));
}

/**
 * Texas Column Definitions
 * Based on standard WOTC Form 8850 and 9061 requirements
 */
export interface TexasCSVRow {
  // Required Columns A-L
  consultantEIN: string;           // A - Leave blank if employer direct
  employerEIN: string;              // B - TEXT format
  employeeSSN: string;              // C - TEXT format
  employeeFirstName: string;        // D
  employeeMiddleName: string;       // E
  employeeLastName: string;         // F
  employeeSuffix: string;           // G
  employeeAddress: string;          // H
  employeeCity: string;             // I
  employeeState: string;            // J
  employeeZip: string;              // K
  employeeDOB: string;              // L - TEXT format (M/D/YYYY)
  
  // Optional Columns M-AS (Form 8850 questions)
  employeePhone: string;            // M
  hireDate: string;                 // N - (M/D/YYYY)
  startDate: string;                // O - (M/D/YYYY)
  employerName: string;             // P
  employerAddress: string;          // Q
  employerCity: string;             // R
  employerState: string;            // S
  employerZip: string;              // T
  employerPhone: string;            // U
  
  // Target Group Indicators (Form 8850 checkboxes)
  snap: string;                     // V - SNAP recipient (Y/N)
  snapState: string;                // W - State code for OOS SNAP
  tanf: string;                     // X - TANF recipient (Y/N)
  tanfState: string;                // Y - State code for OOS TANF
  veteranUnemployed: string;        // Z - Unemployed veteran
  disabledVeteran: string;          // AA - Disabled veteran
  veteranFoodStamps: string;        // AB - Veteran on SNAP
  veteranUnemployed6Months: string; // AC - Unemployed 6+ months
  exFelon: string;                  // AD - Ex-felon (Y/N)
  dcr: string;                      // AE - Designated Community Resident
  vr: string;                       // AF - Vocational Rehab referral (Y/N)
  summerYouth: string;              // AG - Summer Youth (Y/N)
  summerYouthEmpZone: string;       // AH - In empowerment zone
  ssi: string;                      // AI - SSI recipient (Y/N)
  ssiState: string;                 // AJ - State code for OOS SSI
  ltfar: string;                    // AK - Long-term TANF (Y/N)
  ltfarState: string;               // AL - State code for OOS LTFAR
  
  // Additional veteran fields
  dd214Branch: string;              // AM - Military branch
  dd214DischargeDate: string;       // AN - Discharge date
  dd214ServiceDates: string;        // AO - Service dates
  disabilityRating: string;         // AP - VA disability %
  
  // Source documents
  sourceDocs: string;               // AQ - Has source docs (Y/N)
  dd214Attached: string;            // AR - DD214 attached
  disabilityLetter: string;         // AS - Disability letter attached
}

/**
 * Generate Texas CSV from employee/screening data
 */
export function generateTexasCSV(records: EmployeeWithScreening[]): string {
  // Texas limit: 999 records max (including header = 998 data rows)
  if (records.length > 998) {
    throw new Error('Texas bulk upload limited to 998 records per file (plus header)');
  }

  // Define header row
  const header = [
    'Consultant EIN',           // A
    'Employer EIN',             // B
    'Employee SSN',             // C
    'First Name',               // D
    'Middle Name',              // E
    'Last Name',                // F
    'Suffix',                   // G
    'Address',                  // H
    'City',                     // I
    'State',                    // J
    'ZIP',                      // K
    'Date of Birth',            // L
    'Phone',                    // M
    'Hire Date',                // N
    'Start Date',               // O
    'Employer Name',            // P
    'Employer Address',         // Q
    'Employer City',            // R
    'Employer State',           // S
    'Employer ZIP',             // T
    'Employer Phone',           // U
    'SNAP',                     // V
    'SNAP State',               // W
    'TANF',                     // X
    'TANF State',               // Y
    'Veteran Unemployed',       // Z
    'Disabled Veteran',         // AA
    'Veteran SNAP',             // AB
    'Veteran Unemployed 6Mo',   // AC
    'Ex-Felon',                 // AD
    'DCR',                      // AE
    'VR Referral',              // AF
    'Summer Youth',             // AG
    'Summer Youth EZ',          // AH
    'SSI',                      // AI
    'SSI State',                // AJ
    'LTFAR',                    // AK
    'LTFAR State',              // AL
    'DD214 Branch',             // AM
    'DD214 Discharge Date',     // AN
    'DD214 Service Dates',      // AO
    'Disability Rating',        // AP
    'Source Docs',              // AQ
    'DD214 Attached',           // AR
    'Disability Letter',        // AS
  ].join(',');

  // Generate data rows
  const dataRows = records.map(record => {
    const { employee, screening, employerEin, employerName } = record;
    const targetGroups = screening.targetGroups || [];

    // Determine target group flags
    const isSnap = hasTargetGroup(targetGroups, 'SNAP');
    const isTanf = hasTargetGroup(targetGroups, 'TANF');
    const isLtfar = hasTargetGroup(targetGroups, 'LTFAR');
    const isVeteran = hasTargetGroup(targetGroups, 'VETERAN', 'VETERAN_DISABLED', 'VETERAN_UNEMPLOYED');
    const isExFelon = hasTargetGroup(targetGroups, 'EXFELON');
    const isDcr = hasTargetGroup(targetGroups, 'DCR');
    const isVr = hasTargetGroup(targetGroups, 'VR');
    const isSummerYouth = hasTargetGroup(targetGroups, 'SUMMER_YOUTH');
    const isSsi = hasTargetGroup(targetGroups, 'SSI');

    return [
      '',                                           // A - No consultant (employer direct)
      formatAsText(employerEin),                    // B - TEXT format
      formatAsText(employee.ssn?.replace(/-/g, '')), // C - TEXT format, no dashes
      cleanField(employee.firstName),               // D
      '',                                           // E - Middle name
      cleanField(employee.lastName),                // F
      '',                                           // G - Suffix
      cleanField(employee.address),                 // H
      cleanField(employee.city),                    // I
      cleanField(employee.state),                   // J
      cleanField(employee.zipCode),                 // K
      formatAsText(formatDateTexas(employee.dateOfBirth)), // L - TEXT format
      cleanField(employee.phone?.replace(/\D/g, '')), // M - digits only
      formatDateTexas(employee.hireDate),           // N
      formatDateTexas(employee.startDate || employee.hireDate), // O
      cleanField(employerName),                     // P
      cleanField(record.employerAddress),           // Q
      cleanField(record.employerCity),              // R
      cleanField(record.employerState),             // S
      cleanField(record.employerZip),               // T
      cleanField(record.employerPhone?.replace(/\D/g, '')), // U
      formatYN(isSnap),                             // V
      '',                                           // W - State for OOS (TX automatic)
      formatYN(isTanf),                             // X
      '',                                           // Y - State for OOS (TX automatic)
      formatYN(isVeteran),                          // Z
      formatYN(hasTargetGroup(targetGroups, 'VETERAN_DISABLED')), // AA
      formatYN(isVeteran && isSnap),                // AB
      formatYN(hasTargetGroup(targetGroups, 'VETERAN_UNEMPLOYED')), // AC
      formatYN(isExFelon),                          // AD
      formatYN(isDcr),                              // AE
      formatYN(isVr),                               // AF
      formatYN(isSummerYouth),                      // AG
      'N',                                          // AH - Empowerment zone
      formatYN(isSsi),                              // AI
      '',                                           // AJ - State for OOS SSI
      formatYN(isLtfar),                            // AK
      '',                                           // AL - State for OOS LTFAR
      '',                                           // AM - DD214 branch
      '',                                           // AN - Discharge date
      '',                                           // AO - Service dates
      '',                                           // AP - Disability rating
      formatYN(true),                               // AQ - Source docs (assume Y)
      formatYN(isVeteran),                          // AR - DD214 if veteran
      formatYN(hasTargetGroup(targetGroups, 'VETERAN_DISABLED')), // AS
    ].join(',');
  });

  return [header, ...dataRows].join('\n');
}

/**
 * Validate employee data for Texas submission
 */
export function validateTexasSubmission(
  employee: Employee,
  screening: Screening
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required employee fields
  if (!employee.firstName) errors.push('First name required');
  if (!employee.lastName) errors.push('Last name required');
  if (!employee.ssn) errors.push('SSN required');
  if (!employee.dateOfBirth) errors.push('Date of birth required');
  if (!employee.hireDate) errors.push('Hire date required');
  if (!employee.address) errors.push('Address required');
  if (!employee.city) errors.push('City required');
  if (!employee.state) errors.push('State required');
  if (!employee.zipCode) errors.push('ZIP code required');

  // Validate SSN format (9 digits)
  if (employee.ssn && !/^\d{3}-?\d{2}-?\d{4}$/.test(employee.ssn)) {
    errors.push('SSN must be 9 digits (###-##-#### or #########)');
  }

  // Validate screening status
  if (screening.status !== 'eligible' && screening.status !== 'certified') {
    errors.push('Employee must be eligible or certified for WOTC');
  }

  // Validate target groups
  const targetGroups = Array.isArray(screening.targetGroups) ? screening.targetGroups : [];
  if (targetGroups.length === 0) {
    errors.push('At least one target group must be selected');
  }

  // Age validation for Summer Youth
  if (targetGroups.includes('SUMMER_YOUTH') && employee.dateOfBirth) {
    const dob = new Date(employee.dateOfBirth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 16 || age > 17) {
      errors.push('Summer Youth requires employee age 16-17');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
