/**
 * Texas WOTC OLS Bulk Upload CSV Generator
 * 
 * Generates CSV files with EXACT headers required by Texas Workforce Commission
 * Format matches Texas portal bulk upload template specification
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
  startingWage?: number;
  jobOnetCode?: string;
}

/**
 * Format date for Texas portal (YYYY-MM-DD format)
 */
function formatDateTexas(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Clean field - remove commas, quotes, and newlines
 */
function cleanField(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/[,"\n\r]/g, '').trim();
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
 * Extract questionnaire responses for specific questions
 */
function getQuestionResponse(screening: Screening, questionKey: string): string {
  // Placeholder - in production, we'd extract from screening.responses or related questionnaire_responses
  // For now, derive from target groups
  const targetGroups = Array.isArray(screening.targetGroups) ? screening.targetGroups : [];
  
  switch (questionKey) {
    case 'q1_condCert':
      // Conditional certification - typically relates to DCR, IV-A, TANF
      return formatYN(hasTargetGroup(targetGroups, 'DCR', 'IVA', 'TANF'));
    case 'q2_metConditions':
      // Met conditional certification conditions
      return formatYN(hasTargetGroup(targetGroups, 'DCR', 'IVA', 'TANF'));
    case 'q3_uVet6':
      // Unemployed veteran 6+ months
      return formatYN(hasTargetGroup(targetGroups, 'VETERAN_UNEMPLOYED'));
    case 'q4_dVet':
      // Disabled veteran
      return formatYN(hasTargetGroup(targetGroups, 'VETERAN_DISABLED'));
    case 'q5_dUVet6':
      // Disabled unemployed veteran 6+ months
      return formatYN(hasTargetGroup(targetGroups, 'VETERAN_DISABLED', 'VETERAN_UNEMPLOYED'));
    case 'q6_tanfPayments':
      // Receiving TANF payments
      return formatYN(hasTargetGroup(targetGroups, 'TANF', 'LTFAR'));
    case 'q7_u27':
      // Unemployed 27 weeks
      return formatYN(hasTargetGroup(targetGroups, 'LTUR'));
    default:
      return '';
  }
}

/**
 * Texas Column Headers (EXACT format required by portal)
 */
const TEXAS_CSV_HEADERS = [
  'cein',                 // Consultant EIN (blank for direct employers)
  'ein',                  // Employer EIN
  'ssn',                  // Employee SSN
  'dob',                  // Date of birth (YYYY-MM-DD)
  'hiredDate',            // Hire date (YYYY-MM-DD)
  'startDate',            // Start date (YYYY-MM-DD)
  'lastName',             // Last name
  'firstName',            // First name
  'address',              // Street address
  'city',                 // City
  'state',                // State (2-letter code)
  'zip',                  // ZIP code
  'startingWage',         // Starting hourly wage
  'jobOnetCode',          // O*NET job classification code
  'q1_condCert',          // Question 1: Conditional certification (Y/N)
  'q2_metConditions',     // Question 2: Met conditions (Y/N)
  'q3_uVet6',             // Question 3: Unemployed veteran 6+ months (Y/N)
  'q4_dVet',              // Question 4: Disabled veteran (Y/N)
  'q5_dUVet6',            // Question 5: Disabled unemployed vet 6+ months (Y/N)
  'q6_tanfPayments',      // Question 6: TANF payments (Y/N)
  'q7_u27',               // Question 7: Unemployed 27+ weeks (Y/N)
  'qualifiedIva',         // Qualified IV-A recipient (Y/N)
  'qualifiedIvaState',    // State code for out-of-state IV-A
  'qualifiedVet',         // Qualified veteran (Y/N)
  'qualifiedVetState',    // State code for out-of-state veteran
  'uVet4Weeks',           // Unemployed veteran 4+ weeks (Y/N)
  'uVet6Months',          // Unemployed veteran 6+ months (Y/N)
  'dVet',                 // Disabled veteran (Y/N)
  'dUVet6Months',         // Disabled unemployed vet 6+ months (Y/N)
  'exFelon',              // Ex-felon (Y/N)
  'exFelonTypeFederal',   // Federal conviction (Y/N)
  'exFelonTypeState',     // State conviction (Y/N)
  'dcr',                  // Designated Community Resident (Y/N)
  'dcrResidesInRRC',      // DCR resides in Rural Renewal County (Y/N)
  'dcrResidesInEZ',       // DCR resides in Empowerment Zone (Y/N)
  'vocRehab',             // Vocational Rehab referral (Y/N)
  'summerYouth',          // Summer Youth (Y/N)
  'snap',                 // SNAP recipient (Y/N)
  'snapState',            // State code for out-of-state SNAP
  'ssi',                  // SSI recipient (Y/N)
  'ltfar',                // Long-term family assistance (Y/N)
  'ltfarState',           // State code for out-of-state LTFAR
  'ltur',                 // Long-term unemployment (Y/N)
  'lturState',            // State code for out-of-state LTUR
  'sourceDocs',           // Source documents available (Y/N)
];

/**
 * Generate Texas CSV from employee/screening data
 */
export function generateTexasCSV(records: EmployeeWithScreening[]): string {
  // Texas limit: 999 records max (including header = 998 data rows)
  if (records.length > 998) {
    throw new Error('Texas bulk upload limited to 998 records per file (plus header)');
  }

  // Generate CSV rows
  const rows: string[] = [];
  
  // Header row
  rows.push(TEXAS_CSV_HEADERS.join(','));

  // Data rows
  for (const record of records) {
    const { employee, screening, employerEin, startingWage, jobOnetCode } = record;
    const targetGroups = screening.targetGroups || [];

    // Determine target group flags
    const isIva = hasTargetGroup(targetGroups, 'IVA', 'TANF');
    const isVeteran = hasTargetGroup(targetGroups, 'VETERAN', 'VETERAN_DISABLED', 'VETERAN_UNEMPLOYED');
    const isVeteranUnemployed = hasTargetGroup(targetGroups, 'VETERAN_UNEMPLOYED');
    const isVeteranDisabled = hasTargetGroup(targetGroups, 'VETERAN_DISABLED');
    const isExFelon = hasTargetGroup(targetGroups, 'EXFELON');
    const isDcr = hasTargetGroup(targetGroups, 'DCR');
    const isVocRehab = hasTargetGroup(targetGroups, 'VR');
    const isSummerYouth = hasTargetGroup(targetGroups, 'SUMMER_YOUTH');
    const isSnap = hasTargetGroup(targetGroups, 'SNAP');
    const isSsi = hasTargetGroup(targetGroups, 'SSI');
    const isLtfar = hasTargetGroup(targetGroups, 'LTFAR');
    const isLtur = hasTargetGroup(targetGroups, 'LTUR');

    const rowData = [
      '',                                                 // cein - Consultant EIN (blank for direct)
      cleanField(employerEin),                            // ein
      cleanField(employee.ssn?.replace(/[^0-9]/g, '')),   // ssn - digits only
      formatDateTexas(employee.dateOfBirth),              // dob
      formatDateTexas(employee.hireDate),                 // hiredDate
      formatDateTexas(employee.startDate || employee.hireDate), // startDate
      cleanField(employee.lastName),                      // lastName
      cleanField(employee.firstName),                     // firstName
      cleanField(employee.address),                       // address
      cleanField(employee.city),                          // city
      cleanField(employee.state),                         // state
      cleanField(employee.zipCode),                       // zip
      startingWage?.toString() || '',                     // startingWage
      cleanField(jobOnetCode) || '',                      // jobOnetCode
      getQuestionResponse(screening, 'q1_condCert'),      // q1_condCert
      getQuestionResponse(screening, 'q2_metConditions'), // q2_metConditions
      getQuestionResponse(screening, 'q3_uVet6'),         // q3_uVet6
      getQuestionResponse(screening, 'q4_dVet'),          // q4_dVet
      getQuestionResponse(screening, 'q5_dUVet6'),        // q5_dUVet6
      getQuestionResponse(screening, 'q6_tanfPayments'),  // q6_tanfPayments
      getQuestionResponse(screening, 'q7_u27'),           // q7_u27
      formatYN(isIva),                                    // qualifiedIva
      '',                                                 // qualifiedIvaState (TX default)
      formatYN(isVeteran),                                // qualifiedVet
      '',                                                 // qualifiedVetState (TX default)
      formatYN(isVeteranUnemployed),                      // uVet4Weeks
      formatYN(isVeteranUnemployed),                      // uVet6Months
      formatYN(isVeteranDisabled),                        // dVet
      formatYN(isVeteranDisabled && isVeteranUnemployed), // dUVet6Months
      formatYN(isExFelon),                                // exFelon
      'N',                                                // exFelonTypeFederal
      formatYN(isExFelon),                                // exFelonTypeState
      formatYN(isDcr),                                    // dcr
      'N',                                                // dcrResidesInRRC
      'N',                                                // dcrResidesInEZ
      formatYN(isVocRehab),                               // vocRehab
      formatYN(isSummerYouth),                            // summerYouth
      formatYN(isSnap),                                   // snap
      '',                                                 // snapState (TX default)
      formatYN(isSsi),                                    // ssi
      formatYN(isLtfar),                                  // ltfar
      '',                                                 // ltfarState (TX default)
      formatYN(isLtur),                                   // ltur
      '',                                                 // lturState (TX default)
      'Y',                                                // sourceDocs (assume yes)
    ];

    rows.push(rowData.join(','));
  }

  return rows.join('\n');
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
