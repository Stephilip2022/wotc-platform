/**
 * Texas WOTC OLS Bulk Upload CSV Generator
 * 
 * Generates CSV files matching the EXACT format required by Texas Workforce Commission
 * portal at twcgov.appiancloud.us
 * 
 * Key format requirements:
 * - Dates: YYYYMMDD (no dashes)
 * - No quotes around any fields
 * - No commas in any field values
 * - Max 998 data rows per file (plus header = 999 total)
 * - ASCII encoding (no UTF-8 BOM)
 * - Columns A, B, C, L must preserve leading zeros
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
  consultantEin?: string;
}

function formatDateYYYYMMDD(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  } catch {
    return '';
  }
}

function cleanField(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/,/g, ' ').replace(/"/g, '').replace(/'/g, '').trim();
}

function formatWage(wage: number | null | undefined): string {
  if (!wage || wage <= 0) return '0.00';
  return wage.toFixed(2).replace(/,/g, '');
}

function extractOnetPrefix(code: string | null | undefined): string {
  if (!code || code.length < 2) return '';
  const digits = code.substring(0, 2);
  return /^\d{2}$/.test(digits) ? digits : '';
}

function hasGroup(qualifiers: any, ...patterns: string[]): boolean {
  const str = typeof qualifiers === 'string' ? qualifiers : '';
  const arr = Array.isArray(qualifiers) ? qualifiers : [];
  
  for (const pattern of patterns) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(str)) return true;
    if (arr.some((g: string) => regex.test(g))) return true;
  }
  return false;
}

const TEXAS_CSV_HEADERS = [
  'cein',               // A - Consultant EIN
  'fein',               // B - Employer FEIN
  'ssn',                // C - Employee SSN
  'dob',                // D - Date of Birth (YYYYMMDD)
  'hireDate',           // E - Hire Date (YYYYMMDD)
  'startDate',          // F - Start Date (YYYYMMDD)
  'lastName',           // G - Last Name
  'firstName',          // H - First Name
  'address',            // I - Address
  'city',               // J - City
  'state',              // K - State
  'zip',                // L - ZIP Code
  'startingWage',       // M - Starting Wage
  'jobOnetCode',        // N - O*NET Job Code (2 digits)
  'q1_condCert',        // O - Conditional Certification
  'q2_metConditions',   // P - Met Conditions (Y if SNAP, SSI, or TANF)
  'q3_uVet6',           // Q - Unemployed Veteran 6+ months
  'q4_dVet',            // R - Disabled Veteran
  'q5_dUVet6',          // S - Disabled Unemployed Veteran 6+ months
  'q6_tanfPayments',    // T - TANF Payments
  'q7_u27',             // U - Unemployed 27+ weeks
  'qualifiedIva',       // V - Qualified IV-A
  'qualifiedIvaState',  // W - IV-A State (blank for TX)
  'qualifiedVet',       // X - Qualified Veteran
  'qualifiedVetState',  // Y - Veteran State
  'uVet4Weeks',         // Z - Unemployed Vet 4+ weeks
  'uVet6Months',        // AA - Unemployed Vet 6+ months
  'dVet',               // AB - Disabled Veteran
  'dUVet6Months',       // AC - Disabled Unemployed Vet 6+ months
  'exFelon',            // AD - Ex-Felon
  'exFelonTypeFederal', // AE - Federal Ex-Felon
  'exFelonTypeState',   // AF - State Ex-Felon
  'dcr',                // AG - Designated Community Resident
  'dcrResidesInRRC',    // AH - Resides in Rural Renewal County
  'dcrResidesInEZ',     // AI - Resides in Empowerment Zone
  'vocRehab',           // AJ - Vocational Rehabilitation
  'summerYouth',        // AK - Summer Youth
  'snap',               // AL - SNAP
  'snapState',          // AM - SNAP State (blank for TX)
  'ssi',                // AN - SSI
  'ltfar',              // AO - Long-Term Family Assistance
  'ltfarState',         // AP - LTFAR State (blank for TX)
  'ltu',                // AQ - Long-Term Unemployment
  'lturState',          // AR - LTU State
  'sourceDocs',         // AS - Source Documents
];

export function generateTexasCSV(records: EmployeeWithScreening[], consultantEin?: string): string {
  if (records.length > 998) {
    throw new Error('Texas bulk upload limited to 998 records per file (plus header)');
  }

  const rows: string[] = [];
  rows.push(TEXAS_CSV_HEADERS.join(','));

  for (const record of records) {
    const { employee, screening, employerEin, startingWage, jobOnetCode } = record;

    const qualifiers = screening.targetGroups || '';

    const isTANF = hasGroup(qualifiers, 'TANF');
    const isLTANF = hasGroup(qualifiers, 'LTANF', 'LTFAR');
    const isSNAP = hasGroup(qualifiers, 'SNAP');
    const isSSI = hasGroup(qualifiers, 'SSI');
    const isVet = hasGroup(qualifiers, 'Vet', 'VETERAN');
    const isFelon = hasGroup(qualifiers, 'Felon', 'EXFELON');
    const isVetDisabled = hasGroup(qualifiers, 'VETERAN_DISABLED', 'DV');
    const isVetUnemployed = hasGroup(qualifiers, 'VETERAN_UNEMPLOYED', 'UV');
    const isDCR = hasGroup(qualifiers, 'DCR');
    const isVocRehab = hasGroup(qualifiers, 'VR', 'VOC_REHAB');
    const isSummerYouth = hasGroup(qualifiers, 'SUMMER_YOUTH');
    const isLTUR = hasGroup(qualifiers, 'LTUR', 'LTU');

    const q2_met = (isSNAP || isSSI || isTANF) ? 'Y' : 'N';

    const fein = cleanField(employerEin)?.replace(/-/g, '') || '';
    const ssn = cleanField(employee.ssn)?.replace(/[^0-9]/g, '') || '';
    const dob = formatDateYYYYMMDD(employee.dateOfBirth);
    const hireDate = formatDateYYYYMMDD(employee.hireDate);
    const startDate = formatDateYYYYMMDD(employee.startDate || employee.hireDate);
    const zip = cleanField(employee.zipCode)?.replace(/-/g, '') || '';

    const rowData = [
      consultantEin || record.consultantEin || '',  // cein
      fein,                                          // fein
      ssn,                                           // ssn
      dob,                                           // dob
      hireDate,                                      // hireDate
      startDate,                                     // startDate
      cleanField(employee.lastName),                 // lastName
      cleanField(employee.firstName),                // firstName
      cleanField(employee.address),                  // address
      cleanField(employee.city),                     // city
      'TX',                                          // state
      zip,                                           // zip
      formatWage(startingWage ?? (employee as any).hourlyStartWage), // startingWage
      extractOnetPrefix(jobOnetCode ?? (employee as any).occupationCode), // jobOnetCode
      'N',                                           // q1_condCert
      q2_met,                                        // q2_metConditions
      'N',                                           // q3_uVet6
      isVetDisabled ? 'Y' : 'N',                    // q4_dVet
      'N',                                           // q5_dUVet6
      (isTANF || isLTANF) ? 'Y' : 'N',             // q6_tanfPayments
      'N',                                           // q7_u27
      isTANF ? 'Y' : 'N',                           // qualifiedIva
      isTANF ? 'TX' : '',                           // qualifiedIvaState
      isVet ? 'Y' : 'N',                            // qualifiedVet
      '',                                            // qualifiedVetState
      'N',                                           // uVet4Weeks
      'N',                                           // uVet6Months
      'N',                                           // dVet
      'N',                                           // dUVet6Months
      isFelon ? 'Y' : 'N',                          // exFelon
      '',                                            // exFelonTypeFederal
      '',                                            // exFelonTypeState
      'N',                                           // dcr
      '',                                            // dcrResidesInRRC
      '',                                            // dcrResidesInEZ
      'N',                                           // vocRehab
      'N',                                           // summerYouth
      isSNAP ? 'Y' : 'N',                           // snap
      isSNAP ? 'TX' : '',                           // snapState
      isSSI ? 'Y' : 'N',                            // ssi
      isLTANF ? 'Y' : 'N',                          // ltfar
      isLTANF ? 'TX' : '',                          // ltfarState
      'N',                                           // ltu
      '',                                            // lturState
      'N',                                           // sourceDocs
    ];

    rows.push(rowData.join(','));
  }

  return rows.join('\n');
}

export function validateTexasSubmission(
  employee: Employee,
  screening: Screening
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!employee.firstName) errors.push('First name required');
  if (!employee.lastName) errors.push('Last name required');
  if (!employee.ssn) errors.push('SSN required');
  if (!employee.dateOfBirth) errors.push('Date of birth required');
  if (!employee.hireDate) errors.push('Hire date required');
  if (!employee.address) errors.push('Address required');
  if (!employee.city) errors.push('City required');
  if (!employee.state) errors.push('State required');
  if (!employee.zipCode) errors.push('ZIP code required');

  if (employee.ssn && !/^\d{3}-?\d{2}-?\d{4}$/.test(employee.ssn)) {
    errors.push('SSN must be 9 digits (###-##-#### or #########)');
  }

  if (screening.status !== 'eligible' && screening.status !== 'certified' && screening.status !== 'completed') {
    errors.push('Employee must have completed screening for WOTC');
  }

  const targetGroups = Array.isArray(screening.targetGroups) ? screening.targetGroups : [];
  if (targetGroups.length === 0) {
    errors.push('At least one target group must be identified');
  }

  if (targetGroups.includes('SUMMER_YOUTH') && employee.dateOfBirth) {
    const dob = new Date(employee.dateOfBirth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 16 || age > 17) {
      errors.push('Summer Youth requires employee age 16-17');
    }
  }

  return { valid: errors.length === 0, errors };
}
