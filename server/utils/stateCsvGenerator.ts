/**
 * State-Specific CSV Generator
 * 
 * Transforms employee and screening data into state-required CSV bulk upload formats
 * for Arizona, Texas, and other state WOTC portals.
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
}

/**
 * Format date for state portals (M/D/YY format)
 */
function formatDateMDYY(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear().toString().slice(-2);
    return `${month}/${day}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Format boolean for CSV (TRUE/FALSE)
 */
function formatBoolean(value: boolean): string {
  return value ? 'TRUE' : 'FALSE';
}

/**
 * Clean field value - remove commas and quotes for CSV safety
 */
function cleanField(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/,/g, '').replace(/"/g, '').trim();
}

/**
 * Map WOTC target group to Form 8850 checkbox positions
 */
function mapTargetGroupToCheckboxes(targetGroups: any): {
  checkbox1: boolean; // SNAP
  checkbox2: boolean; // TANF
  checkbox3: boolean; // Veteran
  checkbox4: boolean; // Ex-felon
  checkbox5: boolean; // DCR
  checkbox6: boolean; // VR
  checkbox7: boolean; // Summer Youth / SSI / LTFAR
} {
  const groups = Array.isArray(targetGroups) ? targetGroups : [];
  
  return {
    checkbox1: groups.includes('SNAP'),
    checkbox2: groups.includes('TANF') || groups.includes('LTFAR'),
    checkbox3: groups.some((g: string) => g.startsWith('VETERAN')),
    checkbox4: groups.includes('EXFELON'),
    checkbox5: groups.includes('DCR'),
    checkbox6: groups.includes('VR'),
    checkbox7: groups.includes('SUMMER_YOUTH') || groups.includes('SSI'),
  };
}

/**
 * Generate Arizona format CSV
 * Based on template: AZ-Bulk-Upload-Template.csv
 */
export function generateArizonaCSV(records: EmployeeWithScreening[]): string {
  const header = [
    'General_FormVersionID',
    'General_YourSystemsRecordIdentifier',
    'Form8850_ApplicantFirstName',
    'Form8850_ApplicantMiddleName',
    'Form8850_ApplicantLastName',
    'Form8850_ApplicantSuffix',
    'Form8850_ApplicantSSN',
    'Form8850_ApplicantAddressLine1',
    'Form8850_ApplicantCity',
    'Form8850_ApplicantStateCd',
    'Form8850_ApplicantZipCode',
    'Form8850_ApplicantCounty',
    'Form8850_ApplicantPhone',
    'Form8850_ApplicantDOB',
    'Form8850_Checkbox1',
    'Form8850_Checkbox2',
    'Form8850_Checkbox3',
    'Form8850_Checkbox4',
    'Form8850_Checkbox5',
    'Form8850_Checkbox6',
    'Form8850_Checkbox7',
    'Form8850_JobStartDate',
    'Form8850_EmployerName',
    'Form8850_EmployerPhone',
    'Form8850_EmployerEIN',
    'Form8850_EmployerAddressLine1',
    'Form8850_EmployerCity',
    'Form8850_EmployerStateCd',
    'Form8850_EmployerZipCode',
    // Additional fields would go here based on full template
  ].join(',');

  const rows = records.map(record => {
    const { employee, screening, employerEin, employerName } = record;
    const checkboxes = mapTargetGroupToCheckboxes(screening.targetGroups);

    return [
      '9', // Form version
      cleanField(employee.id), // System record ID
      cleanField(employee.firstName),
      '', // Middle name
      cleanField(employee.lastName),
      '', // Suffix
      cleanField(employee.ssn?.replace(/-/g, '')), // SSN without dashes
      cleanField(employee.address),
      cleanField(employee.city),
      cleanField(employee.state),
      cleanField(employee.zipCode),
      '', // County - would need to add to schema or lookup
      cleanField(employee.phone?.replace(/\D/g, '')), // Phone digits only
      formatDateMDYY(employee.dateOfBirth),
      formatBoolean(checkboxes.checkbox1),
      formatBoolean(checkboxes.checkbox2),
      formatBoolean(checkboxes.checkbox3),
      formatBoolean(checkboxes.checkbox4),
      formatBoolean(checkboxes.checkbox5),
      formatBoolean(checkboxes.checkbox6),
      formatBoolean(checkboxes.checkbox7),
      formatDateMDYY(employee.hireDate),
      cleanField(employerName),
      '', // Employer phone
      cleanField(employerEin),
      cleanField(record.employerAddress),
      cleanField(record.employerCity),
      cleanField(record.employerState),
      cleanField(record.employerZip),
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/**
 * Generate Texas format CSV
 * Uses comprehensive Texas CSV generator with all columns A-AS
 */
export function generateTexasCSV(records: EmployeeWithScreening[], consultantEin?: string): string {
  const { generateTexasCSV: texasGenerator } = require('./texasCsvGenerator');
  return texasGenerator(records, consultantEin || '861505473');
}

/**
 * Generate state-specific CSV based on state code
 */
const CSDC_STATES = ['AL', 'AR', 'CO', 'GA', 'ID', 'OK', 'OR', 'SC', 'VT', 'WV'];
const CERTLINK_STATES = ['AZ', 'IL', 'KS', 'ME'];

export function generateStateCSV(
  stateCode: string,
  records: EmployeeWithScreening[]
): string {
  const upper = stateCode.toUpperCase();
  switch (upper) {
    case 'TX':
      return generateTexasCSV(records);
    default:
      if (CERTLINK_STATES.includes(upper)) {
        const { generateCertLinkCSV } = require('./certlinkCsvGenerator');
        return generateCertLinkCSV(records, upper);
      }
      if (CSDC_STATES.includes(upper)) {
        const { generateCsdcFile } = require('./csdcFileGenerator');
        return generateCsdcFile(records, upper);
      }
      throw new Error(`CSV generation not yet implemented for state: ${stateCode}`);
  }
}

export function isCsdcState(stateCode: string): boolean {
  return CSDC_STATES.includes(stateCode.toUpperCase());
}

export function isCertLinkState(stateCode: string): boolean {
  return CERTLINK_STATES.includes(stateCode.toUpperCase());
}

/**
 * Validate employee data for state submission
 */
export function validateEmployeeForSubmission(
  employee: Employee,
  screening: Screening,
  stateCode: string
): {
  valid: boolean;
  errors: string[];
} {
  switch (stateCode.toUpperCase()) {
    case 'TX': {
      const { validateTexasSubmission } = require('./texasCsvGenerator');
      return validateTexasSubmission(employee, screening);
    }
    case 'CA': {
      const caErrors: string[] = [];
      if (!employee.firstName) caErrors.push('First name required');
      if (!employee.lastName) caErrors.push('Last name required');
      if (!employee.ssn) caErrors.push('SSN required');
      if (!employee.dateOfBirth) caErrors.push('Date of birth required');
      if (!employee.hireDate && !employee.startDate) caErrors.push('Hire date or start date required');
      if (!employee.address) caErrors.push('Address required');
      if (!employee.city) caErrors.push('City required');
      if (!employee.zipCode) caErrors.push('ZIP code required');

      const caGroups = Array.isArray(screening.targetGroups) ? screening.targetGroups : [];
      const hasQualifying = caGroups.some((g: string) =>
        ['SNAP', 'SSI', 'TANF', 'LTANF'].some(q => g.toUpperCase().includes(q))
      );
      if (!hasQualifying) {
        caErrors.push('Must qualify for SNAP, SSI, TANF, or LTANF for California XML submission');
      }

      return { valid: caErrors.length === 0, errors: caErrors };
    }
    case 'AZ': {
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
      
      const targetGroups = Array.isArray(screening.targetGroups) ? screening.targetGroups : [];
      if (targetGroups.length === 0) {
        errors.push('At least one target group must be selected');
      }
      
      return { valid: errors.length === 0, errors };
    }
    default:
      return {
        valid: false,
        errors: [`Validation not implemented for state: ${stateCode}`],
      };
  }
}
