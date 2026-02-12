/**
 * California XML Generator
 * 
 * Generates the wotcBatch XML format required by the California EDD WOTC portal.
 * Matches the PowerShell template output exactly:
 * - applicantInfo, employerInfo, agentInfo, form8850, form9061_r202305 blocks
 * - Batches of up to 200 records per XML file
 * - Occupation code mapping, date formatting (yyyy-MM-dd)
 * - SNAP/SSI/TANF/LTANF conditional logic with name/location population
 * 
 * Agent: SCREEN TECHNOLOGIES LLC DBA ROCKERBOX
 * Contact: Wayne Goodwin (employer), GARRETT R (agent)
 */

export interface CaliforniaRecord {
  employeeId?: number | string;
  sessionId?: number | string;
  companyId?: number | string;
  firstName: string;
  lastName: string;
  fullName?: string;
  ssn: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  phone?: string;
  startDate: string;
  infoDate?: string;
  offerDate?: string;
  hireDate?: string;
  hourlyStartWage?: string | number;
  occupationCode?: string;
  qualifie: string;
  summerYouthEmpZone?: boolean | string;
  companyName: string;
  fein: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZip?: string;
  companyCounty?: string;
  companyPhone?: string;
}

const STATE_MAP: Record<string, string> = {
  "California": "CA", "Texas": "TX", "New York": "NY", "Florida": "FL", "Illinois": "IL",
  "Pennsylvania": "PA", "Ohio": "OH", "Georgia": "GA", "North Carolina": "NC", "Michigan": "MI",
  "Arizona": "AZ", "Washington": "WA", "Tennessee": "TN", "Massachusetts": "MA", "Indiana": "IN",
  "Missouri": "MO", "Maryland": "MD", "Wisconsin": "WI", "Colorado": "CO", "Minnesota": "MN",
  "South Carolina": "SC", "Alabama": "AL", "Louisiana": "LA", "Kentucky": "KY", "Oregon": "OR",
  "Oklahoma": "OK", "Connecticut": "CT", "Utah": "UT", "Iowa": "IA", "Nevada": "NV",
  "Arkansas": "AR", "Mississippi": "MS", "Kansas": "KS", "New Mexico": "NM", "Nebraska": "NE",
  "Idaho": "ID", "West Virginia": "WV", "Hawaii": "HI", "New Hampshire": "NH", "Maine": "ME",
  "Rhode Island": "RI", "Montana": "MT", "Delaware": "DE", "South Dakota": "SD", "North Dakota": "ND",
  "Alaska": "AK", "Vermont": "VT", "Wyoming": "WY", "New Jersey": "NJ", "Virginia": "VA",
};

const OCCUPATION_MAP: Record<string, string> = {
  "Manager": "11", "Business": "13", "Financial": "13", "Computer": "15", "Engineer": "17",
  "Science": "19", "Social": "21", "Legal": "23", "Education": "25", "Arts": "27", "Media": "27",
  "Healthcare": "29", "Nurse": "29", "Doctor": "29", "Support": "31", "Protective": "33",
  "Food": "35", "Cook": "35", "Server": "35", "Cleaning": "37", "Maintenance": "37",
  "Personal": "39", "Caregiver": "39", "Sales": "41", "Retail": "41", "Admin": "43", "Office": "43",
  "Farm": "45", "Construction": "47", "Installation": "49", "Production": "51", "Transportation": "53", "Driver": "53",
};

const BATCH_SIZE = 200;

function cleanAddr(a: string | null | undefined): string {
  if (!a) return '';
  return a.replace(/[^a-zA-Z0-9\s]/g, '').trim();
}

function cleanPhone(p: string | null | undefined): string {
  if (!p) return '';
  return p.replace(/\D/g, '');
}

function getStateCode(s: string | null | undefined): string {
  if (!s) return '';
  const trimmed = s.trim();
  if (STATE_MAP[trimmed]) return STATE_MAP[trimmed];
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return trimmed;
}

function getOccCode(title: string | null | undefined): string {
  if (!title) return '43';
  for (const key of Object.keys(OCCUPATION_MAP)) {
    if (title.toLowerCase().includes(key.toLowerCase())) {
      return OCCUPATION_MAP[key];
    }
  }
  return '43';
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  try {
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

function fmtYN(v: any): string {
  if (v === true || v === 1 || v === 'Y' || v === 'true') return 'Y';
  return 'N';
}

function fmtBool(v: any): string {
  if (v === true || v === 1 || v === 'Y' || v === 'true') return 'true';
  return 'false';
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildApplicationXml(row: CaliforniaRecord): string {
  const q = (row.qualifie || '').toUpperCase();
  const isSnap = q.includes('SNAP');
  const isTanf = q.includes('TANF');
  const isSsi = q.includes('SSI');
  const isVet = q.includes('VET');
  const isFelon = q.includes('FELON');
  const isLtanf = q.includes('LTANF');
  const isSummer = row.summerYouthEmpZone === true || row.summerYouthEmpZone === 'true' || row.summerYouthEmpZone === 'Y';

  const checkItem2 = isSnap || isSsi || isTanf || isVet || isFelon;
  const checkItem6 = isLtanf;

  const startDateStr = row.startDate;
  const offerDateStr = row.offerDate || startDateStr;
  const hireDateStr = row.hireDate || startDateStr;

  const snapBirth = fmtDate(row.dateOfBirth);

  let snapName = '', snapLoc = '';
  let tanfName = '', tanfLoc = '';
  let ltanfName = '', ltanfLoc = '';

  const fullName = row.fullName || `${row.firstName} ${row.lastName}`;

  if (isSnap) { snapName = fullName; snapLoc = 'CA'; }
  if (isTanf) { tanfName = fullName; tanfLoc = 'CA'; }
  if (isLtanf) { ltanfName = fullName; ltanfLoc = 'CA'; }

  const ssn = (row.ssn || '').replace(/\D/g, '');
  const fein = (row.fein || '').replace(/\D/g, '');
  const rawOcc = row.occupationCode || '';
  const occ = /^\d+$/.test(rawOcc.trim()) ? rawOcc.trim() : getOccCode(rawOcc);
  const wage = row.hourlyStartWage ? String(row.hourlyStartWage) : '16.00';
  const empAddr = cleanAddr(row.address);
  const compAddr = cleanAddr(row.companyAddress);
  const compPhone = cleanPhone(row.companyPhone);
  const compState = getStateCode(row.companyState);

  return `    <wotcApplication>
        <applicantInfo>
            <ssn>${escapeXml(ssn)}</ssn>
            <firstName>${escapeXml(row.firstName)}</firstName>
            <lastName>${escapeXml(row.lastName)}</lastName>
            <street>${escapeXml(empAddr)}</street>
            <city>${escapeXml(row.city || '')}</city>
            <state>CA</state>
            <zipCode>${escapeXml(row.zipCode || '')}</zipCode>
            <birthDate>${fmtDate(row.dateOfBirth)}</birthDate>
        </applicantInfo>
        <employerInfo>
            <fein>${escapeXml(fein)}</fein>
            <name>${escapeXml(row.companyName || '')}</name>
            <street>${escapeXml(compAddr)}</street>
            <city>${escapeXml(row.companyCity || '')}</city>
            <state>${escapeXml(compState)}</state>
            <zipCode>${escapeXml(row.companyZip || '')}</zipCode>
            <phone>${escapeXml(compPhone)}</phone>
            <contactInfo><name>Wayne Goodwin</name></contactInfo>
        </employerInfo>
        <agentInfo>
            <name>SCREEN TECHNOLOGIES LLC DBA ROCKERBOX</name>
            <street>17250 DALLAS PARKWAY</street>
            <city>DALLAS</city>
            <state>TX</state>
            <zipCode>75248</zipCode>
            <phone>4052262121</phone>
            <contactInfo><name>GARRETT R</name></contactInfo>
        </agentInfo>
        <form8850>
            <checkItem1>false</checkItem1>
            <checkItem2>${fmtBool(checkItem2)}</checkItem2>
            <checkItem3>false</checkItem3>
            <checkItem4>false</checkItem4>
            <checkItem5>false</checkItem5>
            <checkItem6>${fmtBool(checkItem6)}</checkItem6>
            <checkItem7>false</checkItem7>
            <infoDate>${fmtDate(row.infoDate)}</infoDate>
            <offerDate>${fmtDate(offerDateStr)}</offerDate>
            <hireDate>${fmtDate(hireDateStr)}</hireDate>
            <startDate>${fmtDate(startDateStr)}</startDate>
        </form8850>
        <form9061_r202305>
            <previousEmployer>N</previousEmployer>
            <startingWage>${escapeXml(wage)}</startingWage>
            <occupationCode>${escapeXml(occ)}</occupationCode>
            <tanfAny9Months>${fmtYN(isTanf)}</tanfAny9Months>
            <tanfPrimaryRecipient>${escapeXml(tanfName)}</tanfPrimaryRecipient>
            <tanfRecipientLocation>${escapeXml(tanfLoc)}</tanfRecipientLocation>
            <veteran>${fmtYN(isVet)}</veteran>
            <veteranSnapPrimaryRecipient> </veteranSnapPrimaryRecipient>
            <exFelon>${fmtYN(isFelon)}</exFelon>
            <inRuralRenewalCounty>N</inRuralRenewalCounty>
            <dcrEmpowermentZone>N</dcrEmpowermentZone>
            <vocationalRehab>N</vocationalRehab>
            <youthEmployee>${fmtYN(isSummer)}</youthEmployee>
            <snap6Months>${fmtYN(isSnap)}</snap6Months>
            <snapBirthdate>${snapBirth}</snapBirthdate>
            <snapPrimaryRecipient>${escapeXml(snapName)}</snapPrimaryRecipient>
            <snapRecipientLocation>${escapeXml(snapLoc)}</snapRecipientLocation>
            <receivedSSI>${fmtYN(isSsi)}</receivedSSI>
            <tanf18Months>${fmtYN(isLtanf)}</tanf18Months>
            <tanfPrimaryRecipientLongTerm>${escapeXml(ltanfName)}</tanfPrimaryRecipientLongTerm>
            <tanfRecipientLocationLongTerm>${escapeXml(ltanfLoc)}</tanfRecipientLocationLongTerm>
            <ltuRecipient27weeks>N</ltuRecipient27weeks>
        </form9061_r202305>
    </wotcApplication>`;
}

export interface CaliforniaXmlBatch {
  batchNumber: number;
  recordCount: number;
  xmlContent: string;
  fileName: string;
}

export function generateCaliforniaXML(records: CaliforniaRecord[]): CaliforniaXmlBatch[] {
  if (!records || records.length === 0) {
    return [];
  }

  const batches: CaliforniaXmlBatch[] = [];
  let counter = 0;
  let batchCount = 1;

  while (counter < records.length) {
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
    lines.push('<wotcBatch>');

    let recordsInBatch = 0;
    for (let i = 0; i < BATCH_SIZE && counter < records.length; i++) {
      const row = records[counter];
      counter++;
      recordsInBatch++;
      lines.push(buildApplicationXml(row));
    }

    lines.push('</wotcBatch>');

    batches.push({
      batchNumber: batchCount,
      recordCount: recordsInBatch,
      xmlContent: lines.join('\n'),
      fileName: `CA_WOTC_Batch_${batchCount}.xml`,
    });

    batchCount++;
  }

  return batches;
}

export function generateSingleCaliforniaXML(records: CaliforniaRecord[]): string {
  if (!records || records.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  lines.push('<wotcBatch>');

  for (const row of records) {
    lines.push(buildApplicationXml(row));
  }

  lines.push('</wotcBatch>');
  return lines.join('\n');
}

export { BATCH_SIZE, STATE_MAP, OCCUPATION_MAP };
