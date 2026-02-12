import { db } from "../db";
import {
  screenings,
  employees,
  employers,
  documents,
  questionnaireResponses,
  type Employee,
  type Employer,
  type Screening,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface FormData {
  employee: Employee;
  employer: Employer;
  screening: Screening;
  questionnaireResponse?: any;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  } catch {
    return '';
  }
}

function formatSSN(ssn: string | null | undefined): string {
  if (!ssn) return '___-__-____';
  const digits = ssn.replace(/\D/g, '');
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
  }
  return ssn;
}

function formatEIN(ein: string | null | undefined): string {
  if (!ein) return '';
  const digits = ein.replace(/\D/g, '');
  if (digits.length === 9) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return ein;
}

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function getTargetGroups(screening: Screening): string[] {
  const tg = screening.targetGroups;
  if (Array.isArray(tg)) return tg.map(String);
  return [];
}

function hasGroup(groups: string[], ...keywords: string[]): boolean {
  return groups.some(g =>
    keywords.some(k => g.toUpperCase().includes(k.toUpperCase()))
  );
}

function isUnder40(dob: string | null | undefined, hireDate: string | null | undefined): boolean {
  if (!dob) return false;
  const birth = new Date(dob);
  const ref = hireDate ? new Date(hireDate) : new Date();
  const age = (ref.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return age < 40;
}

export function generateForm8850HTML(data: FormData): string {
  const { employee: emp, employer: empl, screening } = data;
  const groups = getTargetGroups(screening);
  const fullName = `${emp.firstName} ${emp.lastName}`;
  const today = formatDate(new Date().toISOString());
  const infoDate = formatDate(emp.hireDate || emp.startDate);
  const offerDate = formatDate(emp.hireDate || emp.startDate);
  const hireDate = formatDate(emp.hireDate || emp.startDate);
  const startDate = formatDate(emp.startDate || emp.hireDate);

  const isTanf = hasGroup(groups, 'IV-A', 'TANF') && !hasGroup(groups, 'LTANF', 'LONG_TERM_TANF');
  const isVeteranSnap = hasGroup(groups, 'VET', 'VETERAN') && hasGroup(groups, 'SNAP');
  const isVR = hasGroup(groups, 'VR', 'VOCATIONAL');
  const isSnapRecipient = hasGroup(groups, 'SNAP', 'FOOD_STAMP') && !hasGroup(groups, 'VET', 'VETERAN');
  const isExFelon = hasGroup(groups, 'FELON', 'EX_FELON', 'EXFELON');
  const isSSI = hasGroup(groups, 'SSI', 'SUPPLEMENTAL_SECURITY');
  const isVetUnemployed4wk = hasGroup(groups, 'VET', 'VETERAN') && hasGroup(groups, 'UNEMPLOYED') && !hasGroup(groups, 'UNEMPLOYED_6', 'LONG_TERM');

  const check2 = isTanf || isVeteranSnap || isVR || isSnapRecipient || isExFelon || isSSI || isVetUnemployed4wk;
  const check3 = hasGroup(groups, 'VET', 'VETERAN') && hasGroup(groups, 'UNEMPLOYED_6');
  const check4 = hasGroup(groups, 'VET', 'VETERAN') && hasGroup(groups, 'DISABILITY') && !hasGroup(groups, 'UNEMPLOYED_6');
  const check5 = hasGroup(groups, 'VET', 'VETERAN') && hasGroup(groups, 'DISABILITY') && hasGroup(groups, 'UNEMPLOYED_6');
  const check6 = hasGroup(groups, 'LTANF', 'LONG_TERM_TANF');
  const check7 = hasGroup(groups, 'LTUR', 'LONG_TERM_UNEMPLOYED');

  const checkMark = '&#10004;';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Form 8850 - ${fullName}</title>
<style>
  body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; margin: 40px; color: #000; line-height: 1.4; }
  .form-header { text-align: center; margin-bottom: 20px; }
  .form-header h1 { font-size: 16pt; margin: 5px 0; }
  .form-header h2 { font-size: 12pt; font-weight: normal; margin: 3px 0; }
  .form-header .dept { font-size: 9pt; margin: 2px 0; }
  .form-number { font-size: 14pt; font-weight: bold; }
  .omb { font-size: 9pt; text-align: right; }
  .field-row { display: flex; gap: 20px; margin: 8px 0; align-items: baseline; flex-wrap: wrap; }
  .field-label { font-weight: bold; min-width: 120px; }
  .field-value { border-bottom: 1px solid #000; min-width: 200px; padding: 2px 4px; }
  .checkbox-item { margin: 8px 0; padding-left: 30px; position: relative; }
  .checkbox-item .check { position: absolute; left: 0; top: 0; font-size: 14pt; font-weight: bold; width: 20px; }
  .checkbox-num { font-weight: bold; margin-right: 8px; }
  .section-title { font-weight: bold; font-size: 12pt; margin: 20px 0 10px; border-bottom: 2px solid #000; padding-bottom: 4px; }
  .signature-line { border-bottom: 1px solid #000; min-width: 300px; display: inline-block; margin: 0 10px; }
  .page-break { page-break-before: always; }
  .employer-section { margin-top: 30px; border-top: 3px solid #000; padding-top: 15px; }
  table.form-info { width: 100%; border-collapse: collapse; }
  table.form-info td { padding: 4px 8px; vertical-align: top; }
  .indent { padding-left: 20px; }
</style>
</head>
<body>
<div class="form-header">
  <div class="omb">OMB No. 1545-1500</div>
  <div class="form-number">Form 8850</div>
  <div class="dept">(Rev. March 2016)</div>
  <h2>Pre-Screening Notice and Certification Request for<br>the Work Opportunity Credit</h2>
  <div class="dept">Department of the Treasury<br>Internal Revenue Service</div>
</div>

<div class="section-title">Job applicant: Fill in the lines below and check any boxes that apply.</div>

<table class="form-info">
<tr>
  <td><strong>Your name</strong></td>
  <td class="field-value">${fullName}</td>
  <td><strong>Social security number</strong></td>
  <td class="field-value">${formatSSN(emp.ssn)}</td>
</tr>
<tr>
  <td><strong>Street address</strong></td>
  <td colspan="3" class="field-value">${emp.address || ''}</td>
</tr>
<tr>
  <td><strong>City or town, state, and ZIP code</strong></td>
  <td colspan="3" class="field-value">${[emp.city, emp.state, emp.zipCode].filter(Boolean).join(', ')}</td>
</tr>
<tr>
  <td><strong>County</strong></td>
  <td class="field-value"></td>
  <td><strong>Telephone number</strong></td>
  <td class="field-value">${formatPhone(emp.phone)}</td>
</tr>
</table>

<p>If you are under age 40, enter your date of birth (month, day, year): <span class="field-value">${isUnder40(emp.dateOfBirth, emp.hireDate) ? formatDate(emp.dateOfBirth) : ''}</span></p>

<div style="margin-top: 15px;">
  <div class="checkbox-item">
    <span class="check"></span>
    <span class="checkbox-num">1</span> Check here if you received a conditional certification from the state workforce agency (SWA) or a participating local agency for the work opportunity credit.
  </div>

  <div class="checkbox-item">
    <span class="check">${check2 ? checkMark : ''}</span>
    <span class="checkbox-num">2</span> Check here if any of the following statements apply to you.
    <div class="indent">
      <p>&#8226; I am a member of a family that has received assistance from Temporary Assistance for Needy Families (TANF) for any 9 months during the past 18 months.</p>
      <p>&#8226; I am a veteran and a member of a family that received Supplemental Nutrition Assistance Program (SNAP) benefits (food stamps) for at least a 3-month period during the past 15 months.</p>
      <p>&#8226; I was referred here by a rehabilitation agency approved by the state, an employment network under the Ticket to Work program, or the Department of Veterans Affairs.</p>
      <p>&#8226; I am at least age 18 but not age 40 or older and I am a member of a family that received SNAP benefits (food stamps) for the past 6 months; or received SNAP benefits for at least 3 of the past 5 months.</p>
      <p>&#8226; During the past year, I was convicted of a felony or released from prison for a felony.</p>
      <p>&#8226; I received supplemental security income (SSI) benefits for any month ending during the past 60 days.</p>
      <p>&#8226; I am a veteran and I was unemployed for a period or periods totaling at least 4 weeks but less than 6 months during the past year.</p>
    </div>
  </div>

  <div class="checkbox-item">
    <span class="check">${check3 ? checkMark : ''}</span>
    <span class="checkbox-num">3</span> Check here if you are a veteran and you were unemployed for a period or periods totaling at least 6 months during the past year.
  </div>

  <div class="checkbox-item">
    <span class="check">${check4 ? checkMark : ''}</span>
    <span class="checkbox-num">4</span> Check here if you are a veteran entitled to compensation for a service-connected disability and you were discharged or released from active duty in the U.S. Armed Forces during the past year.
  </div>

  <div class="checkbox-item">
    <span class="check">${check5 ? checkMark : ''}</span>
    <span class="checkbox-num">5</span> Check here if you are a veteran entitled to compensation for a service-connected disability and you were unemployed for a period or periods totaling at least 6 months during the past year.
  </div>

  <div class="checkbox-item">
    <span class="check">${check6 ? checkMark : ''}</span>
    <span class="checkbox-num">6</span> Check here if you are a member of a family that received TANF payments for at least the past 18 months; or received TANF payments for any 18 months beginning after August 5, 1997; or stopped being eligible for TANF payments during the past 2 years.
  </div>

  <div class="checkbox-item">
    <span class="check">${check7 ? checkMark : ''}</span>
    <span class="checkbox-num">7</span> Check here if you are in a period of unemployment that is at least 27 consecutive weeks and for all or part of that period you received unemployment compensation.
  </div>
</div>

<div style="margin-top: 20px;">
  <div class="section-title">Signature&mdash;All Applicants Must Sign</div>
  <p style="font-size: 9pt;">Under penalties of perjury, I declare that I gave the above information to the employer on or before the day I was offered a job, and it is, to the best of my knowledge, true, correct, and complete.</p>
  <p>Job applicant's signature: <span class="signature-line">${fullName}</span> Date: <span class="field-value">${infoDate || today}</span></p>
</div>

<div class="employer-section">
  <div class="section-title">For Employer's Use Only</div>

  <table class="form-info">
  <tr>
    <td><strong>Employer's name</strong></td>
    <td class="field-value">${empl.name}</td>
    <td><strong>Telephone no.</strong></td>
    <td class="field-value">${formatPhone(empl.contactPhone)}</td>
    <td><strong>EIN</strong></td>
    <td class="field-value">${formatEIN(empl.ein)}</td>
  </tr>
  <tr>
    <td><strong>Street address</strong></td>
    <td colspan="5" class="field-value">${empl.address || ''}</td>
  </tr>
  <tr>
    <td><strong>City or town, state, and ZIP code</strong></td>
    <td colspan="5" class="field-value">${[empl.city, empl.state, empl.zipCode].filter(Boolean).join(', ')}</td>
  </tr>
  </table>

  <div style="margin-top: 15px;">
    <table class="form-info">
    <tr>
      <td>Date applicant:</td>
      <td>Gave information: <span class="field-value">${infoDate}</span></td>
      <td>Was offered job: <span class="field-value">${offerDate}</span></td>
      <td>Was hired: <span class="field-value">${hireDate}</span></td>
      <td>Started job: <span class="field-value">${startDate}</span></td>
    </tr>
    </table>
  </div>

  <p style="margin-top: 15px; font-size: 9pt;">Under penalties of perjury, I declare that the applicant provided the information on this form on or before the day a job was offered to the applicant and that the information I have furnished is, to the best of my knowledge, true, correct, and complete. Based on the information the job applicant furnished on page 1, I believe the individual is a member of a targeted group. I hereby request a certification that the individual is a member of a targeted group.</p>
  <p>Employer's signature: <span class="signature-line">SCREEN TECHNOLOGIES LLC DBA ROCKERBOX</span> Title: <span class="field-value">Authorized Representative</span> Date: <span class="field-value">${today}</span></p>
</div>
</body>
</html>`;
}

export function generateForm9061HTML(data: FormData): string {
  const { employee: emp, employer: empl, screening } = data;
  const groups = getTargetGroups(screening);
  const fullName = `${emp.lastName}, ${emp.firstName}`;
  const today = formatDate(new Date().toISOString());
  const startDate = formatDate(emp.startDate || emp.hireDate);

  const isTanf = hasGroup(groups, 'TANF');
  const isVeteran = hasGroup(groups, 'VET', 'VETERAN');
  const isExFelon = hasGroup(groups, 'FELON', 'EX_FELON', 'EXFELON');
  const isDCR = hasGroup(groups, 'DCR', 'DESIGNATED_COMMUNITY');
  const isVR = hasGroup(groups, 'VR', 'VOCATIONAL');
  const isSummerYouth = hasGroup(groups, 'SUMMER', 'YOUTH');
  const isSnap = hasGroup(groups, 'SNAP', 'FOOD_STAMP');
  const isSSI = hasGroup(groups, 'SSI', 'SUPPLEMENTAL_SECURITY');
  const isLTANF = hasGroup(groups, 'LTANF', 'LONG_TERM_TANF');
  const isLTUR = hasGroup(groups, 'LTUR', 'LONG_TERM_UNEMPLOYED');

  const checkMark = '&#10004;';
  const empState = emp.state || empl.state || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Form 9061 (ICF) - ${emp.firstName} ${emp.lastName}</title>
<style>
  body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; margin: 40px; color: #000; line-height: 1.4; }
  .form-header { text-align: center; margin-bottom: 20px; }
  .form-header h1 { font-size: 14pt; margin: 5px 0; }
  .form-header h2 { font-size: 12pt; font-weight: normal; margin: 3px 0; }
  .form-header .dept { font-size: 9pt; margin: 2px 0; }
  .omb { font-size: 9pt; text-align: right; }
  table.form-table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  table.form-table td, table.form-table th { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
  .field-value { font-weight: bold; }
  .checkbox-item { margin: 8px 0; padding-left: 30px; position: relative; }
  .checkbox-item .check { position: absolute; left: 5px; top: 0; font-size: 14pt; font-weight: bold; }
  .checkbox-num { font-weight: bold; margin-right: 8px; }
  .section-title { font-weight: bold; font-size: 11pt; margin: 15px 0 8px; text-transform: uppercase; }
  .signature-line { border-bottom: 1px solid #000; min-width: 250px; display: inline-block; margin: 0 10px; }
  .indent { padding-left: 20px; }
</style>
</head>
<body>
<div class="form-header">
  <div class="omb">OMB Control No. 1205-0371</div>
  <div class="dept">U.S. Department of Labor<br>Employment and Training Administration</div>
  <h1>Work Opportunity Tax Credit</h1>
  <h2>Individual Characteristics Form (ICF)</h2>
</div>

<table class="form-table">
<tr>
  <td style="width:50%;">1. Control No. (For Agency use only)</td>
  <td>2. Date Received (For Agency Use only)</td>
</tr>
</table>

<div class="section-title">Employer Information</div>
<table class="form-table">
<tr>
  <td style="width:33%;">3. Employer Name<br><span class="field-value">${empl.name}</span></td>
  <td style="width:40%;">4. Employer Mailing Address, Telephone No. and Email Address<br><span class="field-value">${empl.address || ''}<br>${[empl.city, empl.state, empl.zipCode].filter(Boolean).join(' ')} ${formatPhone(empl.contactPhone)}<br>${empl.contactEmail}</span></td>
  <td>5. Employer Identification Number (EIN)<br><span class="field-value">${formatEIN(empl.ein)}</span></td>
</tr>
</table>

<div class="section-title">Job Applicant Information</div>
<table class="form-table">
<tr>
  <td style="width:33%;">6. Applicant Name (Last, First, MI)<br><span class="field-value">${fullName}</span></td>
  <td style="width:33%;">7. Social Security Number<br><span class="field-value">${formatSSN(emp.ssn)}</span></td>
  <td>8. Have you worked for this employer before?<br>YES: &#9744; NO: &#9744;</td>
</tr>
</table>

<div class="section-title">Job Applicant Characteristics for WOTC Targeted Group(s) Certification</div>
<table class="form-table">
<tr>
  <td style="width:33%;">9. Employment Start Date<br><span class="field-value">${startDate}</span></td>
  <td style="width:33%;">10. Starting Wage<br><span class="field-value"></span></td>
  <td>11. Job Position (Title) or SOC<br><span class="field-value">${emp.jobTitle || ''}</span></td>
</tr>
</table>

<p><em>Directions: Read the following statements carefully and check any that apply to the job applicant.</em></p>

<div class="checkbox-item">
  <span class="check">${isTanf ? checkMark : ''}</span>
  <span class="checkbox-num">12.</span> <strong>Qualified IV-A Recipient</strong><br>
  Check here if the job applicant is a Qualified IV-A Recipient<br>
  ${isTanf ? `<span class="indent">Primary benefits recipient: <span class="field-value">${emp.firstName} ${emp.lastName}</span>, benefits received in: <span class="field-value">${empState}</span></span>` : ''}
</div>

<div class="checkbox-item">
  <span class="check">${isVeteran ? checkMark : ''}</span>
  <span class="checkbox-num">13.</span> <strong>Qualified Veteran</strong><br>
  Check here if the job applicant is a veteran of the U.S. Armed Forces
  ${isVeteran && isSnap ? `<br><span class="indent">Veteran SNAP recipient: <span class="field-value">${emp.firstName} ${emp.lastName}</span>, benefits received in: <span class="field-value">${empState}</span></span>` : ''}
</div>

<div class="checkbox-item">
  <span class="check">${isExFelon ? checkMark : ''}</span>
  <span class="checkbox-num">14.</span> <strong>Qualified Ex-Felon</strong><br>
  Check here if the job applicant is an Ex-Felon
</div>

<div class="checkbox-item">
  <span class="check">${isDCR ? checkMark : ''}</span>
  <span class="checkbox-num">15.</span> <strong>Designated Community Resident (DCR)</strong><br>
  Check if the job applicant is at least age 18 but not age 40, and resides in a Rural Renewal County (RRC) or an Empowerment Zone (EZ).
  ${isDCR ? `<br><span class="indent">Birthday: <span class="field-value">${formatDate(emp.dateOfBirth)}</span></span>` : ''}
</div>

<div class="checkbox-item">
  <span class="check">${isVR ? checkMark : ''}</span>
  <span class="checkbox-num">16.</span> <strong>Vocational Rehabilitation Referral</strong><br>
  Check here if the job applicant is a Vocational Rehabilitation (VR) Referral
</div>

<div class="checkbox-item">
  <span class="check">${isSummerYouth ? checkMark : ''}</span>
  <span class="checkbox-num">17.</span> <strong>Qualified Summer Youth Employee</strong><br>
  Check here if the job applicant is a Qualified Summer Youth Employee
  ${isSummerYouth ? `<br><span class="indent">Birthday: <span class="field-value">${formatDate(emp.dateOfBirth)}</span></span>` : ''}
</div>

<div class="checkbox-item">
  <span class="check">${isSnap ? checkMark : ''}</span>
  <span class="checkbox-num">18.</span> <strong>Qualified Supplemental Nutrition Assistance Program (SNAP) Recipient</strong><br>
  Check here if the job applicant is a Qualified SNAP (Food Stamps) Recipient
  ${isSnap ? `<br><span class="indent">Birthday: <span class="field-value">${formatDate(emp.dateOfBirth)}</span></span>
  <br><span class="indent">Primary benefits recipient: <span class="field-value">${emp.firstName} ${emp.lastName}</span></span>
  <br><span class="indent">City and state(s) where benefits were received: <span class="field-value">${[emp.city, empState].filter(Boolean).join(', ')}</span></span>` : ''}
</div>

<div class="checkbox-item">
  <span class="check">${isSSI ? checkMark : ''}</span>
  <span class="checkbox-num">19.</span> <strong>Qualified Supplemental Security Income (SSI) Recipient</strong><br>
  Check here if the job applicant received or is receiving Supplemental Security Income (SSI)
</div>

<div class="checkbox-item">
  <span class="check">${isLTANF ? checkMark : ''}</span>
  <span class="checkbox-num">20.</span> <strong>Long-Term Family Assistance Recipient</strong><br>
  Check here if the job applicant is a Long-term Family Assistance (long-term TANF) recipient
  ${isLTANF ? `<br><span class="indent">Primary benefits recipient: <span class="field-value">${emp.firstName} ${emp.lastName}</span>, benefits received in: <span class="field-value">${empState}</span></span>` : ''}
</div>

<div class="checkbox-item">
  <span class="check">${isLTUR ? checkMark : ''}</span>
  <span class="checkbox-num">21.</span> <strong>Qualified Long-Term Unemployment Recipient</strong><br>
  Check here if the job applicant is a qualified long-term unemployment recipient (LTUR)
</div>

<div style="margin-top: 15px;">
  <strong>22.</strong> Sources used to document eligibility: <em>See attached documentation</em>
</div>

<div style="margin-top: 20px; border-top: 1px solid #000; padding-top: 10px;">
  <p><em>I certify that this information is true and correct to the best of my knowledge.</em></p>
  <table class="form-table" style="border: none;">
  <tr style="border: none;">
    <td style="border: none;">23(a). Signature:<br><span class="signature-line">SCREEN TECHNOLOGIES LLC DBA ROCKERBOX</span></td>
    <td style="border: none;">23(b). Signed by:<br><span class="field-value">Employer's Preparer</span></td>
    <td style="border: none;">24. Date:<br><span class="field-value">${today}</span></td>
  </tr>
  </table>
</div>
</body>
</html>`;
}

export async function generateAndStoreWOTCForms(screeningId: string): Promise<{
  form8850Stored: boolean;
  form9061Stored: boolean;
  form8850DocId?: string;
  form9061DocId?: string;
}> {
  const [result] = await db
    .select({
      screening: screenings,
      employee: employees,
      employer: employers,
    })
    .from(screenings)
    .innerJoin(employees, eq(screenings.employeeId, employees.id))
    .innerJoin(employers, eq(screenings.employerId, employers.id))
    .where(eq(screenings.id, screeningId))
    .limit(1);

  if (!result) {
    console.error(`[WOTC Forms] Screening not found: ${screeningId}`);
    return { form8850Stored: false, form9061Stored: false };
  }

  const { screening, employee, employer } = result;

  if (screening.form8850Generated && screening.form9061Generated) {
    console.log(`[WOTC Forms] Forms already generated for screening: ${screeningId}`);
    return { form8850Stored: true, form9061Stored: true };
  }

  const formData: FormData = { employee, employer, screening };

  let form8850DocId: string | undefined;
  let form9061DocId: string | undefined;

  if (!screening.form8850Generated) {
    const form8850HTML = generateForm8850HTML(formData);
    const form8850FileName = `Form_8850_${employee.lastName}_${employee.firstName}_${employer.ein}_${Date.now()}.html`;

    const [doc8850] = await db.insert(documents).values({
      employeeId: employee.id,
      employerId: employer.id,
      screeningId: screening.id,
      documentType: 'form_8850',
      fileName: form8850FileName,
      fileUrl: `data:text/html;base64,${Buffer.from(form8850HTML).toString('base64')}`,
      mimeType: 'text/html',
      fileSize: Buffer.byteLength(form8850HTML),
    }).returning();

    form8850DocId = doc8850?.id;
    console.log(`[WOTC Forms] Form 8850 stored: ${form8850FileName} (EIN: ${employer.ein})`);
  }

  if (!screening.form9061Generated) {
    const form9061HTML = generateForm9061HTML(formData);
    const form9061FileName = `Form_9061_ICF_${employee.lastName}_${employee.firstName}_${employer.ein}_${Date.now()}.html`;

    const [doc9061] = await db.insert(documents).values({
      employeeId: employee.id,
      employerId: employer.id,
      screeningId: screening.id,
      documentType: 'form_9061',
      fileName: form9061FileName,
      fileUrl: `data:text/html;base64,${Buffer.from(form9061HTML).toString('base64')}`,
      mimeType: 'text/html',
      fileSize: Buffer.byteLength(form9061HTML),
    }).returning();

    form9061DocId = doc9061?.id;
    console.log(`[WOTC Forms] Form 9061 (ICF) stored: ${form9061FileName} (EIN: ${employer.ein})`);
  }

  await db
    .update(screenings)
    .set({
      form8850Generated: true,
      form9061Generated: true,
      form8850Url: form8850DocId ? `/api/documents/${form8850DocId}` : screening.form8850Url,
      form9061Url: form9061DocId ? `/api/documents/${form9061DocId}` : screening.form9061Url,
      updatedAt: new Date(),
    })
    .where(eq(screenings.id, screeningId));

  console.log(`[WOTC Forms] Screening ${screeningId} flags updated (EIN: ${employer.ein})`);

  return {
    form8850Stored: true,
    form9061Stored: true,
    form8850DocId,
    form9061DocId,
  };
}

export async function prepareBulkUploadData(screeningId: string): Promise<{
  stateCode: string | null;
  format: string;
  dataStored: boolean;
}> {
  const [result] = await db
    .select({
      screening: screenings,
      employee: employees,
      employer: employers,
    })
    .from(screenings)
    .innerJoin(employees, eq(screenings.employeeId, employees.id))
    .innerJoin(employers, eq(screenings.employerId, employers.id))
    .where(eq(screenings.id, screeningId))
    .limit(1);

  if (!result) {
    return { stateCode: null, format: 'unknown', dataStored: false };
  }

  const { screening, employee, employer } = result;
  const stateCode = (employee.state || employer.state || '').toUpperCase();

  if (!stateCode) {
    console.warn(`[Bulk Upload] No state code for screening ${screeningId}`);
    return { stateCode: null, format: 'unknown', dataStored: false };
  }

  const groups = getTargetGroups(screening);
  const qualifie = groups.join(',');
  const fullName = `${employee.firstName} ${employee.lastName}`;

  const certlinkStates = ['AZ', 'IL', 'KS', 'ME'];
  const csdcStates = ['AL', 'AR', 'CO', 'GA', 'ID', 'OK', 'OR', 'SC', 'VT', 'WV'];

  let format = 'generic';
  let bulkDataContent = '';
  let bulkFileName = '';

  if (stateCode === 'CA') {
    format = 'xml';
    const { generateSingleCaliforniaXML } = await import('../utils/californiaXmlGenerator');
    bulkDataContent = generateSingleCaliforniaXML([{
      firstName: employee.firstName,
      lastName: employee.lastName,
      fullName,
      ssn: employee.ssn || '',
      dateOfBirth: employee.dateOfBirth || '',
      address: employee.address || '',
      city: employee.city || '',
      state: employee.state || 'CA',
      zipCode: employee.zipCode || '',
      startDate: employee.startDate || employee.hireDate || '',
      hireDate: employee.hireDate || '',
      qualifie,
      companyName: employer.name,
      fein: employer.ein,
      companyAddress: employer.address || '',
      companyCity: employer.city || '',
      companyState: employer.state || '',
      companyZip: employer.zipCode || '',
      companyPhone: employer.contactPhone || '',
    }]);
    bulkFileName = `CA_bulk_${employee.lastName}_${employee.firstName}_${Date.now()}.xml`;
  } else if (certlinkStates.includes(stateCode)) {
    format = 'certlink_csv';
    const { generateCertLinkCSV } = await import('../utils/certlinkCsvGenerator');
    bulkDataContent = generateCertLinkCSV([{
      employee: {
        firstName: employee.firstName,
        lastName: employee.lastName,
        ssn: employee.ssn || '',
        dateOfBirth: employee.dateOfBirth || '',
        address: employee.address || '',
        city: employee.city || '',
        state: employee.state || '',
        zipCode: employee.zipCode || '',
        hireDate: employee.hireDate || '',
        startDate: employee.startDate || employee.hireDate || '',
        phone: employee.phone || '',
        jobTitle: employee.jobTitle || '',
      },
      screening: {
        targetGroups: groups,
        qualifie,
      },
      employerEin: employer.ein,
      employerName: employer.name,
      employerAddress: employer.address || '',
      employerCity: employer.city || '',
      employerState: employer.state || '',
      employerZip: employer.zipCode || '',
      employerPhone: employer.contactPhone || '',
    }], stateCode);
    bulkFileName = `${stateCode}_certlink_${employee.lastName}_${employee.firstName}_${Date.now()}.csv`;
  } else if (stateCode === 'TX') {
    format = 'texas_csv';
    bulkFileName = `TX_bulk_${employee.lastName}_${employee.firstName}_${Date.now()}.csv`;
    bulkDataContent = '';
  } else if (csdcStates.includes(stateCode)) {
    format = 'csdc_fixed_width';
    bulkFileName = `${stateCode}_csdc_${employee.lastName}_${employee.firstName}_${Date.now()}.txt`;
    bulkDataContent = '';
  } else {
    format = 'generic';
    bulkFileName = `${stateCode}_bulk_${employee.lastName}_${employee.firstName}_${Date.now()}.csv`;
    bulkDataContent = '';
  }

  if (bulkDataContent) {
    await db.insert(documents).values({
      employeeId: employee.id,
      employerId: employer.id,
      screeningId: screening.id,
      documentType: `bulk_upload_${format}`,
      fileName: bulkFileName,
      fileUrl: `data:text/plain;base64,${Buffer.from(bulkDataContent).toString('base64')}`,
      mimeType: format === 'xml' ? 'application/xml' : 'text/csv',
      fileSize: Buffer.byteLength(bulkDataContent),
    });

    console.log(`[Bulk Upload] ${format} data stored: ${bulkFileName} (State: ${stateCode}, EIN: ${employer.ein})`);
  }

  return { stateCode, format, dataStored: !!bulkDataContent };
}

export async function processCompletedQuestionnaire(screeningId: string): Promise<void> {
  try {
    console.log(`[WOTC Pipeline] Processing screening: ${screeningId}`);

    const formResult = await generateAndStoreWOTCForms(screeningId);
    console.log(`[WOTC Pipeline] Forms generated: 8850=${formResult.form8850Stored}, 9061=${formResult.form9061Stored}`);

    const bulkResult = await prepareBulkUploadData(screeningId);
    console.log(`[WOTC Pipeline] Bulk upload prepared: state=${bulkResult.stateCode}, format=${bulkResult.format}, stored=${bulkResult.dataStored}`);
  } catch (error) {
    console.error(`[WOTC Pipeline] Error processing screening ${screeningId}:`, error);
  }
}
