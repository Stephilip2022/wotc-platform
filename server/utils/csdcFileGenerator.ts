interface CsdcRecord {
  employee: any;
  screening: any;
  employerEin: string;
  employerName?: string;
}

export interface CsdcStateConfig {
  consultantId: string;
  pinOrPassword: string;
  representative: string;
  defaultHourlyWage: number;
}

const STATE_DEFAULTS: Record<string, Omit<CsdcStateConfig, 'pinOrPassword'>> = {
  AL: { consultantId: 'ROCKERBOX', representative: 'Young', defaultHourlyWage: 7.25 },
  AR: { consultantId: 'ROCKERBOX', representative: 'DYOUNG', defaultHourlyWage: 11.00 },
  CO: { consultantId: 'ROCKERBOX', representative: 'GRinehart', defaultHourlyWage: 15.50 },
  GA: { consultantId: 'SCREEN', representative: 'PHILIPW', defaultHourlyWage: 11.50 },
  ID: { consultantId: 'ROCKERBOX', representative: 'PCALHOUN', defaultHourlyWage: 11.50 },
  OK: { consultantId: 'ROCKERBOX', representative: 'DYOUNG', defaultHourlyWage: 11.50 },
  OR: { consultantId: 'ROCKERBOX', representative: 'DYOUNG', defaultHourlyWage: 16.00 },
  SC: { consultantId: 'ROCKERBOX', representative: 'DAVIDYOUNG', defaultHourlyWage: 11.50 },
  VT: { consultantId: 'ROCKERBOX', representative: 'DAVIDY', defaultHourlyWage: 14.50 },
  WV: { consultantId: 'SCREENTECH', representative: 'DYOUNG', defaultHourlyWage: 11.50 },
};

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

interface LayoutColumn {
  name: string;
  width: number;
}

const LAYOUT: LayoutColumn[] = [
  { name: 'ConsultantID', width: 12 },
  { name: 'fein', width: 9 },
  { name: 'plain_ssn', width: 19 },
  { name: 'MiddleInitial', width: 1 },
  { name: 'last_name', width: 19 },
  { name: 'address', width: 30 },
  { name: 'city', width: 20 },
  { name: 'state', width: 2 },
  { name: 'zip_code', width: 5 },
  { name: 'phone', width: 10 },
  { name: 'date_birth', width: 90 },
  { name: 'pin_or_password', width: 20 },
  { name: 'SignatureOnFile_YN', width: 1 },
  { name: 'DateOfSignature_mmddccyy', width: 8 },
  { name: 'TargetedGroup_4_or_6_or_blank', width: 1 },
  { name: 'date_gave_info', width: 8 },
  { name: 'date_was_offered_job', width: 8 },
  { name: 'date_was_hired', width: 8 },
  { name: 'date_started_job', width: 31 },
  { name: 'DatePart2Signature_mmddccyy', width: 8 },
  { name: 'StartingWage_Dollars_2', width: 2 },
  { name: 'HourlyWage_Cents', width: 2 },
  { name: 'occupation_code', width: 2 },
  { name: 'is_rehire', width: 5 },
  { name: 'SNAP1_YN_322', width: 5 },
  { name: 'TANF_9_18_YN_327', width: 1 },
  { name: 'TANF_last18_YN_328', width: 3 },
  { name: 'PrimaryRecipientName_30', width: 50 },
  { name: 'PrimaryRecipientState_2', width: 2 },
  { name: 'Felony_YN_383', width: 1 },
  { name: 'ConvictionDate_mmddccyy_384_391', width: 8 },
  { name: 'ReleaseDate_mmddccyy_392_399', width: 8 },
  { name: 'EmpowermentZone_YN_400', width: 1 },
  { name: 'RuralRenewal_YN_401', width: 21 },
  { name: 'SSI_YN_422', width: 1 },
  { name: 'Eligibility_Line1_80', width: 80 },
  { name: 'Eligibility_Line2_80', width: 80 },
  { name: 'Eligibility_Line3_80', width: 80 },
  { name: 'Eligibility_Line4_80', width: 80 },
  { name: 'CompletedBy_743_E_A_C_S_G', width: 1 },
  { name: 'Dateof9061', width: 28 },
  { name: 'OutOfStateBenefits_State_2_772_773', width: 2 },
  { name: 'Representative_774_785_12chars', width: 15 },
  { name: 'Version_8850_Pos_789_790_SET_23', width: 2 },
  { name: 'Version_ICF_Pos_791_792_SET_23', width: 2 },
  { name: 'Is9062_YN_793', width: 1 },
  { name: 'Q2_YN_794', width: 1 },
  { name: 'Q3_YN_795', width: 1 },
  { name: 'Q4_YN_796', width: 1 },
  { name: 'Q5_YN_797', width: 1 },
  { name: 'Q6_YN_798', width: 1 },
  { name: 'ConvictionType_F_or_S_799', width: 1 },
  { name: 'ConvictionState_2_800_801', width: 4 },
  { name: 'CategoryF_YN_804', width: 1 },
  { name: 'MailDate_mmddccyy_805_812_optional', width: 8 },
  { name: 'LTUR_YN_813', width: 2 },
  { name: 'Q7_YN_815', width: 1 },
  { name: 'LTUR_State_2_843_844', width: 29 },
  { name: 'first_name', width: 20 },
  { name: 'Vet_YN_865', width: 1 },
  { name: 'WorkRelease_YN_866', width: 1 },
  { name: 'VocRehab_YN_867', width: 185 },
];

function formatDateMMddyyyy(dateVal: any): string {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}${dd}${yyyy}`;
}

function cleanDigits(val: any): string {
  if (!val) return '';
  return String(val).trim().replace(/[^0-9]/g, '');
}

function padField(value: string, width: number): string {
  const truncated = value.length > width ? value.substring(0, width) : value;
  return truncated.padEnd(width, ' ');
}

function resolveStateAbbr(stateName: string | undefined): string {
  if (!stateName) return '';
  const trimmed = stateName.trim();
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return STATE_NAME_TO_ABBR[trimmed] || '';
}

function hasQualifier(qualifiers: string, ...keywords: string[]): boolean {
  if (!qualifiers) return false;
  const upper = qualifiers.toUpperCase();
  return keywords.some(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(upper);
  });
}

function buildRecordFields(record: CsdcRecord, stateAbbr: string, config: CsdcStateConfig): Record<string, string> {
  const { employee: e, screening: s, employerEin } = record;
  const qualifiers = s?.targetGroups || s?.qualifyingCategories || '';
  const isSNAP = hasQualifier(qualifiers, 'SNAP');
  const isTANF = hasQualifier(qualifiers, 'TANF');
  const isLTANF = hasQualifier(qualifiers, 'LTANF');
  const isSSI = hasQualifier(qualifiers, 'SSI');

  const fullName = `${e.firstName || e.first_name || ''} ${e.lastName || e.last_name || ''}`.trim();
  const empStateAbbr = resolveStateAbbr(e.state);

  const dateGaveInfo = e.dateGaveInfo || e.date_gave_info || s?.submittedAt || s?.createdAt;
  const dateOffered = e.dateWasOfferedJob || e.date_was_offered_job || e.startDate || e.date_started_job;
  const dateHired = e.dateWasHired || e.date_was_hired || e.hireDate || e.date_started_job;
  const dateStarted = e.startDate || e.date_started_job || e.hireDate;

  let dollars = '';
  let cents = '';
  const rawWage = e.hourlyStartWage || e.hourly_start_wage || e.startingWage;
  let effectiveWage = 0;
  if (rawWage) {
    const parsed = parseFloat(String(rawWage).replace(/[$,]/g, ''));
    if (!isNaN(parsed) && parsed > 0) effectiveWage = parsed;
  }
  if (effectiveWage === 0) effectiveWage = config.defaultHourlyWage;

  if (effectiveWage > 0) {
    const d = Math.trunc(effectiveWage);
    let c = Math.round((effectiveWage - d) * 100);
    if (c >= 100) { dollars = String(d + 1); c = 0; }
    else { dollars = String(d); }
    cents = String(c).padStart(2, '0');
  }

  const isBenefitRecipient = isTANF || isSNAP;

  const fields: Record<string, string> = {
    ConsultantID: config.consultantId,
    fein: cleanDigits(employerEin),
    plain_ssn: cleanDigits(e.ssn || e.plain_ssn),
    MiddleInitial: '',
    last_name: e.lastName || e.last_name || '',
    address: e.address || '',
    city: e.city || '',
    state: empStateAbbr,
    zip_code: cleanDigits(e.zipCode || e.zip_code).substring(0, 5),
    phone: '',
    date_birth: formatDateMMddyyyy(e.dateOfBirth || e.date_birth || e.dob),
    pin_or_password: config.pinOrPassword,
    SignatureOnFile_YN: 'N',
    DateOfSignature_mmddccyy: formatDateMMddyyyy(dateGaveInfo),
    TargetedGroup_4_or_6_or_blank: '',
    date_gave_info: formatDateMMddyyyy(dateGaveInfo),
    date_was_offered_job: formatDateMMddyyyy(dateOffered) || formatDateMMddyyyy(dateStarted),
    date_was_hired: formatDateMMddyyyy(dateHired) || formatDateMMddyyyy(dateStarted),
    date_started_job: formatDateMMddyyyy(dateStarted),
    DatePart2Signature_mmddccyy: formatDateMMddyyyy(dateGaveInfo),
    StartingWage_Dollars_2: dollars,
    HourlyWage_Cents: cents,
    occupation_code: e.occupationCode || e.occupation_code || e.jobOnetCode || '',
    is_rehire: 'N',
    SNAP1_YN_322: isSNAP ? 'Y' : 'N',
    TANF_9_18_YN_327: isTANF ? 'Y' : 'N',
    TANF_last18_YN_328: isTANF ? 'Y' : 'N',
    PrimaryRecipientName_30: isBenefitRecipient ? fullName : '',
    PrimaryRecipientState_2: isBenefitRecipient ? empStateAbbr : '',
    Felony_YN_383: 'N',
    ConvictionDate_mmddccyy_384_391: '',
    ReleaseDate_mmddccyy_392_399: '',
    EmpowermentZone_YN_400: 'N',
    RuralRenewal_YN_401: 'N',
    SSI_YN_422: isSSI ? 'Y' : 'N',
    Eligibility_Line1_80: '',
    Eligibility_Line2_80: '',
    Eligibility_Line3_80: '',
    Eligibility_Line4_80: '',
    CompletedBy_743_E_A_C_S_G: 'C',
    Dateof9061: formatDateMMddyyyy(dateGaveInfo),
    OutOfStateBenefits_State_2_772_773: '',
    Representative_774_785_12chars: config.representative,
    Version_8850_Pos_789_790_SET_23: '23',
    Version_ICF_Pos_791_792_SET_23: '23',
    Is9062_YN_793: 'N',
    Q2_YN_794: 'Y',
    Q3_YN_795: 'N',
    Q4_YN_796: 'N',
    Q5_YN_797: 'N',
    Q6_YN_798: isLTANF ? 'Y' : 'N',
    ConvictionType_F_or_S_799: '',
    ConvictionState_2_800_801: '',
    CategoryF_YN_804: 'N',
    MailDate_mmddccyy_805_812_optional: '',
    LTUR_YN_813: 'N',
    Q7_YN_815: 'N',
    LTUR_State_2_843_844: '',
    first_name: e.firstName || e.first_name || '',
    Vet_YN_865: 'N',
    WorkRelease_YN_866: 'N',
    VocRehab_YN_867: 'N',
  };

  return fields;
}

function recordToFixedWidth(fields: Record<string, string>): string {
  return LAYOUT.map(col => padField(fields[col.name] || '', col.width)).join('');
}

export function generateCsdcFile(records: CsdcRecord[], stateAbbr: string, pinOrPassword?: string): string {
  const upper = stateAbbr.toUpperCase();
  const defaults = STATE_DEFAULTS[upper];
  if (!defaults) {
    throw new Error(`No CSDC configuration found for state: ${stateAbbr}`);
  }

  const config: CsdcStateConfig = {
    ...defaults,
    pinOrPassword: pinOrPassword || '',
  };

  const lines = records.map(record => {
    const fields = buildRecordFields(record, upper, config);
    return recordToFixedWidth(fields);
  });

  return lines.join('\n');
}

export function getCsdcFileName(stateAbbr: string): string {
  const upper = stateAbbr.toUpperCase();
  if (upper === 'GA') return 'GANOELEVENTXT.txt';
  return `${upper}NOVELEVENTXT.txt`;
}

export function getCsdcRemotePath(stateAbbr: string): string {
  const upper = stateAbbr.toUpperCase();
  const fileName = getCsdcFileName(upper);
  return `${upper}.DIR;1/${fileName}`;
}

export function getCsdcStateDefaults(stateAbbr: string): Omit<CsdcStateConfig, 'pinOrPassword'> | undefined {
  return STATE_DEFAULTS[stateAbbr.toUpperCase()];
}

export function getCsdcSupportedStates(): string[] {
  return Object.keys(STATE_DEFAULTS);
}

export function generateCsdcPreview(records: CsdcRecord[], stateAbbr: string, pinOrPassword?: string): { preview: string; recordCount: number; fileName: string; remotePath: string } {
  const content = generateCsdcFile(records, stateAbbr, pinOrPassword);
  const lines = content.split('\n');
  return {
    preview: lines.slice(0, 5).join('\n'),
    recordCount: lines.length,
    fileName: getCsdcFileName(stateAbbr),
    remotePath: getCsdcRemotePath(stateAbbr),
  };
}
