/**
 * CertLink CSV Generator
 * 
 * Generates the 86-column CertLink batch upload CSV format used by
 * Arizona, Illinois, Kansas, and Maine state WOTC portals.
 * 
 * Based on CertLink's FormVersion 9 template with:
 * - Form 8850 fields (applicant + employer info)
 * - ICF fields (eligibility categories, signator, wages)
 * - Checkbox logic: SNAP (age<=39), SSI (age>=40), TANF/LTANF
 * - Date format: MM/dd/yyyy
 */

export interface CertLinkStateConfig {
  signatorCandidates: string[];
  defaultSignator: string;
}

export const CERTLINK_STATES: Record<string, CertLinkStateConfig> = {
  AZ: {
    signatorCandidates: ['David Young', 'Philip Wentworth, CEO'],
    defaultSignator: 'David Young',
  },
  IL: {
    signatorCandidates: ['Garrett Rinehart', 'Philip Wentworth, CEO'],
    defaultSignator: 'Garrett Rinehart',
  },
  KS: {
    signatorCandidates: ['David Young', 'Philip Wentworth'],
    defaultSignator: 'David Young',
  },
  ME: {
    signatorCandidates: ['Philip Wentworth', 'David Young'],
    defaultSignator: 'Philip Wentworth',
  },
};

const CERTLINK_HEADERS = [
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
  'Form8850_EmployeeSignatureDate',
  'Form8850_EmployerName',
  'Form8850_EmployerPhone',
  'Form8850_EmployerFEIN',
  'Form8850_EmployerAddressLine1',
  'Form8850_EmployerCity',
  'Form8850_EmployerStateCd',
  'Form8850_EmployerZipcode',
  'Form8850_ContactFirstName',
  'Form8850_ContactLastName',
  'Form8850_ContactPhone',
  'Form8850_ContactAddressLine1',
  'Form8850_ContactCity',
  'Form8850_ContactStateCd',
  'Form8850_ContactZipcode',
  'Form8850_GroupNumber',
  'Form8850_GaveInformationDate',
  'Form8850_OfferedJobDate',
  'Form8850_EmployeeDateHired',
  'Form8850_EmployeeStartDate',
  'ICF_Rehire',
  'ICF_StartingWage',
  'ICF_OccupationID',
  'ICF_IVA',
  'ICF_IVAName',
  'ICF_IVACity',
  'ICF_IVAStateCd',
  'ICF_IVAAdditionalCity',
  'ICF_IVAAdditionalStateCd',
  'ICF_Veteran',
  'ICF_VeteranSNAPName',
  'ICF_VeteranSNAPCity',
  'ICF_VeteranSNAPStateCd',
  'ICF_VeteranSNAPAdditionalCity',
  'ICF_VeteranSNAPAdditionalStateCd',
  'ICF_Felon',
  'ICF_Felon_WorkRelease',
  'ICF_FelonDateConviction',
  'ICF_FelonDateRelease',
  'ICF_FelonType',
  'ICF_FelonStateCd',
  'ICF_DCR_RRC',
  'ICF_DCR_EZ',
  'ICF_VR',
  'ICF_SummerYouth',
  'ICF_SNAP',
  'ICF_SNAPName',
  'ICF_SNAPCity',
  'ICF_SNAPStateCd',
  'ICF_SNAPAdditionalCity',
  'ICF_SNAPAdditionalStateCd',
  'ICF_SSI',
  'ICF_TANF',
  'ICF_TANFName',
  'ICF_TANFCity',
  'ICF_TANFStateCd',
  'ICF_TANFAdditionalCity',
  'ICF_TANFAdditionalStateCd',
  'ICF_LTUR',
  'ICF_LTURCity',
  'ICF_LTURStateCd',
  'ICF_LTURAdditionalCity',
  'ICF_LTURAdditionalStateCd',
  'ICF_EligibilitySources',
  'ICF_SignatorName',
];

const STATE_NAME_TO_ABBR: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY',
};

function stateToAbbr(state: string | null | undefined): string {
  if (!state) return '';
  const trimmed = state.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return STATE_NAME_TO_ABBR[trimmed] || trimmed.toUpperCase();
}

function formatDateMMDDYYYY(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  } catch {
    return '';
  }
}

function digitsOnly(val: string | null | undefined): string {
  if (!val) return '';
  return val.replace(/[^0-9]/g, '');
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function calculateAge(dobStr: string | null | undefined, startDateStr: string | null | undefined): number | null {
  if (!dobStr || !startDateStr) return null;
  try {
    const dob = new Date(dobStr);
    const start = new Date(startDateStr);
    if (isNaN(dob.getTime()) || isNaN(start.getTime())) return null;
    let age = start.getFullYear() - dob.getFullYear();
    if (start < new Date(dob.getFullYear() + age, dob.getMonth(), dob.getDate())) {
      age--;
    }
    return age;
  } catch {
    return null;
  }
}

interface CertLinkRecord {
  employee: any;
  screening: any;
  employerEin: string;
  employerName: string;
  employerAddress?: string;
  employerCity?: string;
  employerState?: string;
  employerZip?: string;
  employerPhone?: string;
}

function buildCertLinkRow(record: CertLinkRecord, signatorName: string): Record<string, string> {
  const e = record.employee;
  const s = record.screening;

  const qualifie = (s.qualifie || s.targetGroups || '').toString().toUpperCase();
  const hasLTANF = qualifie.includes('LTANF');
  const hasTANF = qualifie.includes('TANF');

  const dobStr = e.dateOfBirth || e.date_birth || e.date_of_birth || null;
  const startDateStr = e.hireDate || e.date_started_job || e.dateStartedJob || null;
  const ageAtStart = calculateAge(dobStr, startDateStr);

  const firstName = (e.firstName || e.first_name || '').trim();
  const lastName = (e.lastName || e.last_name || '').trim();
  const fullName = (e.fullName || e.full_name || `${firstName} ${lastName}`).trim();
  const empState = stateToAbbr(e.state);
  const empCity = (e.city || '').trim();

  const isSNAP = ageAtStart !== null && ageAtStart <= 39;
  const isSSI = ageAtStart !== null && ageAtStart >= 40;
  const isTANF = hasTANF || hasLTANF;

  const employeeId = (e.id || '').toString();
  const recordId = employeeId.includes('-') ? employeeId.split('-')[0] : employeeId;

  const row: Record<string, string> = {};

  row['General_FormVersionID'] = '9';
  row['General_YourSystemsRecordIdentifier'] = recordId;
  row['Form8850_ApplicantFirstName'] = firstName;
  row['Form8850_ApplicantMiddleName'] = '';
  row['Form8850_ApplicantLastName'] = lastName;
  row['Form8850_ApplicantSuffix'] = '';
  row['Form8850_ApplicantSSN'] = digitsOnly(e.ssn || e.plain_ssn || e.plainSsn);
  row['Form8850_ApplicantAddressLine1'] = (e.address || '').trim();
  row['Form8850_ApplicantCity'] = empCity;
  row['Form8850_ApplicantStateCd'] = empState;
  row['Form8850_ApplicantZipCode'] = digitsOnly(e.zipCode || e.zip_code);
  row['Form8850_ApplicantCounty'] = (e.county || '').trim();
  row['Form8850_ApplicantPhone'] = digitsOnly(e.phone || e.phoneNumber || e.phone_number);
  row['Form8850_ApplicantDOB'] = formatDateMMDDYYYY(dobStr);

  row['Form8850_Checkbox1'] = 'FALSE';
  row['Form8850_Checkbox2'] = 'TRUE';
  row['Form8850_Checkbox3'] = 'FALSE';
  row['Form8850_Checkbox4'] = 'FALSE';
  row['Form8850_Checkbox5'] = 'FALSE';
  row['Form8850_Checkbox6'] = hasLTANF ? 'TRUE' : 'FALSE';
  row['Form8850_Checkbox7'] = 'FALSE';

  const hiredDate = e.dateWasHired || e.date_was_hired || e.hireDate || e.date_started_job || null;
  row['Form8850_EmployeeSignatureDate'] = formatDateMMDDYYYY(hiredDate);

  row['Form8850_EmployerName'] = (record.employerName || '').trim();
  row['Form8850_EmployerPhone'] = digitsOnly(record.employerPhone);
  row['Form8850_EmployerFEIN'] = (record.employerEin || '').trim();
  row['Form8850_EmployerAddressLine1'] = (record.employerAddress || '').trim();
  row['Form8850_EmployerCity'] = (record.employerCity || '').trim();
  row['Form8850_EmployerStateCd'] = stateToAbbr(record.employerState);
  row['Form8850_EmployerZipcode'] = (record.employerZip || '').trim();

  row['Form8850_ContactFirstName'] = '';
  row['Form8850_ContactLastName'] = '';
  row['Form8850_ContactPhone'] = '';
  row['Form8850_ContactAddressLine1'] = '';
  row['Form8850_ContactCity'] = '';
  row['Form8850_ContactStateCd'] = '';
  row['Form8850_ContactZipcode'] = '';
  row['Form8850_GroupNumber'] = '';

  const gaveInfoDate = e.dateGaveInfo || e.date_gave_info || null;
  const offeredJobDate = e.dateWasOfferedJob || e.date_was_offered_job || null;
  row['Form8850_GaveInformationDate'] = formatDateMMDDYYYY(gaveInfoDate);
  row['Form8850_OfferedJobDate'] = formatDateMMDDYYYY(offeredJobDate);
  row['Form8850_EmployeeDateHired'] = formatDateMMDDYYYY(hiredDate);
  row['Form8850_EmployeeStartDate'] = formatDateMMDDYYYY(startDateStr);

  row['ICF_Rehire'] = 'FALSE';
  row['ICF_StartingWage'] = (e.hourlyStartWage || e.hourly_start_wage || '').toString();
  row['ICF_OccupationID'] = (e.occupationCode || e.occupation_code || '').toString();

  row['ICF_IVA'] = 'FALSE';
  row['ICF_IVAName'] = '';
  row['ICF_IVACity'] = '';
  row['ICF_IVAStateCd'] = '';
  row['ICF_IVAAdditionalCity'] = '';
  row['ICF_IVAAdditionalStateCd'] = '';

  row['ICF_Veteran'] = 'FALSE';
  row['ICF_VeteranSNAPName'] = '';
  row['ICF_VeteranSNAPCity'] = '';
  row['ICF_VeteranSNAPStateCd'] = '';
  row['ICF_VeteranSNAPAdditionalCity'] = '';
  row['ICF_VeteranSNAPAdditionalStateCd'] = '';

  row['ICF_Felon'] = 'FALSE';
  row['ICF_Felon_WorkRelease'] = 'FALSE';
  row['ICF_FelonDateConviction'] = '';
  row['ICF_FelonDateRelease'] = '';
  row['ICF_FelonType'] = '';
  row['ICF_FelonStateCd'] = '';

  row['ICF_DCR_RRC'] = 'FALSE';
  row['ICF_DCR_EZ'] = 'FALSE';
  row['ICF_VR'] = 'FALSE';
  row['ICF_SummerYouth'] = 'FALSE';

  row['ICF_SNAP'] = isSNAP ? 'TRUE' : 'FALSE';
  row['ICF_SNAPName'] = isSNAP ? fullName : '';
  row['ICF_SNAPCity'] = isSNAP ? empCity : '';
  row['ICF_SNAPStateCd'] = isSNAP ? empState : '';
  row['ICF_SNAPAdditionalCity'] = '';
  row['ICF_SNAPAdditionalStateCd'] = '';

  row['ICF_SSI'] = isSSI ? 'TRUE' : 'FALSE';

  row['ICF_TANF'] = isTANF ? 'TRUE' : 'FALSE';
  row['ICF_TANFName'] = isTANF ? fullName : '';
  row['ICF_TANFCity'] = isTANF ? empCity : '';
  row['ICF_TANFStateCd'] = isTANF ? empState : '';
  row['ICF_TANFAdditionalCity'] = '';
  row['ICF_TANFAdditionalStateCd'] = '';

  row['ICF_LTUR'] = 'FALSE';
  row['ICF_LTURCity'] = '';
  row['ICF_LTURStateCd'] = '';
  row['ICF_LTURAdditionalCity'] = '';
  row['ICF_LTURAdditionalStateCd'] = '';
  row['ICF_EligibilitySources'] = '';

  row['ICF_SignatorName'] = signatorName;

  return row;
}

export function generateCertLinkCSV(records: CertLinkRecord[], stateAbbr: string): string {
  const upper = stateAbbr.toUpperCase();
  const config = CERTLINK_STATES[upper];
  if (!config) {
    throw new Error(`No CertLink configuration found for state: ${stateAbbr}. Supported: ${Object.keys(CERTLINK_STATES).join(', ')}`);
  }

  const headerLine = CERTLINK_HEADERS.join(',');
  const dataLines = records.map(record => {
    const row = buildCertLinkRow(record, config.defaultSignator);
    return CERTLINK_HEADERS.map(h => csvEscape(row[h] || '')).join(',');
  });

  return [headerLine, ...dataLines].join('\n');
}

export function parseCertLinkCSV(csvContent: string): Record<string, string>[] {
  const lines = csvContent.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

export function fixSignatorInCSV(
  csvContent: string,
  fixRowNumbers: number[],
  removeRowNumbers: number[],
  signatorCandidates: string[]
): string {
  const rows = parseCertLinkCSV(csvContent);
  if (rows.length === 0) return csvContent;

  const removeSet = new Set(removeRowNumbers);
  const fixSet = new Set(fixRowNumbers);

  const cleanRows: Record<string, string>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    if (removeSet.has(rowNum)) continue;

    if (fixSet.has(rowNum) && signatorCandidates.length >= 2) {
      const current = rows[i]['ICF_SignatorName'] || '';
      const idx = signatorCandidates.indexOf(current);
      const nextIdx = idx < 0 ? 1 : (idx + 1) % signatorCandidates.length;
      rows[i]['ICF_SignatorName'] = signatorCandidates[nextIdx];
    }

    cleanRows.push(rows[i]);
  }

  if (cleanRows.length === 0) return '';

  const headerLine = CERTLINK_HEADERS.join(',');
  const dataLines = cleanRows.map(row =>
    CERTLINK_HEADERS.map(h => csvEscape(row[h] || '')).join(',')
  );

  return [headerLine, ...dataLines].join('\n');
}

export function getSubmittedRecordsFromCSV(csvContent: string): { ein: string; ssn: string }[] {
  const rows = parseCertLinkCSV(csvContent);
  return rows.map(r => ({
    ein: (r['Form8850_EmployerFEIN'] || '').trim(),
    ssn: (r['Form8850_ApplicantSSN'] || '').trim(),
  }));
}

export function isCertLinkState(stateCode: string): boolean {
  return stateCode.toUpperCase() in CERTLINK_STATES;
}

export function getCertLinkSupportedStates(): string[] {
  return Object.keys(CERTLINK_STATES);
}

export function getCertLinkPortalUrl(stateCode: string): string {
  const urls: Record<string, string> = {
    AZ: 'https://wotc.azdes.gov/Account/Login',
    IL: 'https://illinoiswotc.com/',
    KS: 'https://kansaswotc.com/',
    ME: 'https://wotc.maine.gov/Account/Login',
  };
  return urls[stateCode.toUpperCase()] || '';
}
