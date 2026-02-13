import crypto from 'crypto';
import { db } from '../db';
import { eq, and, lte, sql } from 'drizzle-orm';
import {
  documentUploadTokens,
  documentUploadReminders,
  employees,
  employers,
  screenings,
} from '@shared/schema';
import { sendSms, formatPhoneNumber } from './twilioSms';

const REMINDER_DAYS = [3, 5, 7];
const TOKEN_EXPIRY_DAYS = 14;

const VETERAN_GROUPS = [
  'qualified_veteran',
  'veteran',
  'disabled_veteran',
  'unemployed_veteran',
  'snap_veteran',
  'veteran_disabled',
  'veteran_unemployed_6months',
  'veteran_snap',
];

const TANF_SNAP_GROUPS = [
  'tanf_recipient',
  'tanf',
  'snap_recipient',
  'snap',
  'iv_a_recipient',
  'long_term_tanf',
  'long_term_family_assistance',
];

function getRequiredDocuments(targetGroups: string[]): { docs: string[]; descriptions: Record<string, string> } {
  const docs: string[] = [];
  const descriptions: Record<string, string> = {};
  const lowerGroups = targetGroups.map(g => g.toLowerCase().replace(/[\s-]/g, '_'));

  const isVeteran = lowerGroups.some(g => VETERAN_GROUPS.some(v => g.includes(v)));
  const isTanfSnap = lowerGroups.some(g => TANF_SNAP_GROUPS.some(t => g.includes(t)));

  if (isVeteran) {
    docs.push('dd214');
    descriptions['dd214'] = 'DD-214 (Certificate of Release or Discharge from Active Duty)';
  }
  if (isTanfSnap) {
    docs.push('drivers_license');
    descriptions['drivers_license'] = "Current driver's license (for identity verification)";
  }

  return { docs, descriptions };
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getBaseUrl(): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return 'https://rockerbox.app';
}

export async function scheduleDocumentUploadReminders(
  employeeId: string,
  screeningId: string,
  targetGroups: string[]
): Promise<{ scheduled: boolean; reason?: string }> {
  const { docs, descriptions } = getRequiredDocuments(targetGroups);

  if (docs.length === 0) {
    return { scheduled: false, reason: 'No documents required for these target groups' };
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId));

  if (!employee) {
    return { scheduled: false, reason: 'Employee not found' };
  }

  const phoneNumber = formatPhoneNumber(employee.phone || '');
  if (!phoneNumber) {
    return { scheduled: false, reason: 'No valid phone number available' };
  }

  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_EXPIRY_DAYS);

  const [uploadToken] = await db
    .insert(documentUploadTokens)
    .values({
      employeeId,
      employerId: employee.employerId,
      screeningId,
      token,
      requiredDocuments: docs,
      targetGroups,
      expiresAt,
    })
    .returning();

  const now = new Date();
  const reminderValues = REMINDER_DAYS.map(day => {
    const scheduledAt = new Date(now);
    scheduledAt.setDate(scheduledAt.getDate() + day);
    scheduledAt.setHours(10, 0, 0, 0);

    return {
      employeeId,
      employerId: employee.employerId,
      uploadTokenId: uploadToken.id,
      reminderDay: day,
      scheduledAt,
      phoneNumber,
      status: 'pending' as const,
    };
  });

  await db.insert(documentUploadReminders).values(reminderValues);

  console.log(`[DocUpload] Scheduled ${REMINDER_DAYS.length} reminders for employee ${employeeId}, token: ${uploadToken.id}`);
  console.log(`[DocUpload] Required documents: ${docs.join(', ')}`);

  return { scheduled: true };
}

export async function processDueReminders(): Promise<{ sent: number; failed: number; cancelled: number }> {
  const now = new Date();
  let sent = 0;
  let failed = 0;
  let cancelled = 0;

  const dueReminders = await db
    .select({
      reminder: documentUploadReminders,
      employee: employees,
      employer: employers,
      uploadToken: documentUploadTokens,
    })
    .from(documentUploadReminders)
    .innerJoin(employees, eq(documentUploadReminders.employeeId, employees.id))
    .innerJoin(employers, eq(documentUploadReminders.employerId, employers.id))
    .innerJoin(documentUploadTokens, eq(documentUploadReminders.uploadTokenId, documentUploadTokens.id))
    .where(
      and(
        eq(documentUploadReminders.status, 'pending'),
        lte(documentUploadReminders.scheduledAt, now)
      )
    );

  for (const { reminder, employee, employer, uploadToken } of dueReminders) {
    if (uploadToken.isUsed) {
      await db
        .update(documentUploadReminders)
        .set({ status: 'cancelled' })
        .where(eq(documentUploadReminders.id, reminder.id));
      cancelled++;
      continue;
    }

    if (new Date(uploadToken.expiresAt) < now) {
      await db
        .update(documentUploadReminders)
        .set({ status: 'cancelled', errorMessage: 'Token expired' })
        .where(eq(documentUploadReminders.id, reminder.id));
      cancelled++;
      continue;
    }

    const requiredDocs = uploadToken.requiredDocuments as string[];
    const { descriptions } = getRequiredDocuments(uploadToken.targetGroups as string[]);
    const docList = requiredDocs.map(d => descriptions[d] || d).join(' and ');

    const uploadUrl = `${getBaseUrl()}/upload/${uploadToken.token}`;

    const dayLabel = reminder.reminderDay === 3
      ? 'Reminder'
      : reminder.reminderDay === 5
      ? '2nd Reminder'
      : 'Final Reminder';

    const message = `${dayLabel}: ${employer.name} needs you to upload your ${docList} to complete your WOTC screening. Click here to upload securely: ${uploadUrl} - This link expires in ${Math.ceil((new Date(uploadToken.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days.`;

    const result = await sendSms(reminder.phoneNumber, message);

    if (result.success) {
      await db
        .update(documentUploadReminders)
        .set({
          status: 'sent',
          sentAt: new Date(),
          twilioMessageSid: result.messageSid,
        })
        .where(eq(documentUploadReminders.id, reminder.id));
      sent++;
    } else {
      await db
        .update(documentUploadReminders)
        .set({
          status: 'failed',
          errorMessage: result.error,
        })
        .where(eq(documentUploadReminders.id, reminder.id));
      failed++;
    }
  }

  if (sent > 0 || failed > 0 || cancelled > 0) {
    console.log(`[DocUpload] Processed reminders: ${sent} sent, ${failed} failed, ${cancelled} cancelled`);
  }

  return { sent, failed, cancelled };
}

export async function cancelRemindersForEmployee(employeeId: string): Promise<void> {
  await db
    .update(documentUploadReminders)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(documentUploadReminders.employeeId, employeeId),
        eq(documentUploadReminders.status, 'pending')
      )
    );
}

export async function validateUploadToken(token: string): Promise<{
  valid: boolean;
  data?: {
    tokenRecord: typeof documentUploadTokens.$inferSelect;
    employee: typeof employees.$inferSelect;
    employer: typeof employers.$inferSelect;
  };
  error?: string;
}> {
  const [tokenRecord] = await db
    .select()
    .from(documentUploadTokens)
    .where(eq(documentUploadTokens.token, token));

  if (!tokenRecord) {
    return { valid: false, error: 'Invalid upload link' };
  }

  if (tokenRecord.isUsed) {
    return { valid: false, error: 'This upload link has already been used' };
  }

  if (new Date(tokenRecord.expiresAt) < new Date()) {
    return { valid: false, error: 'This upload link has expired. Please contact your employer for a new link.' };
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, tokenRecord.employeeId));

  const [employer] = await db
    .select()
    .from(employers)
    .where(eq(employers.id, tokenRecord.employerId));

  if (!employee || !employer) {
    return { valid: false, error: 'Invalid upload link' };
  }

  return {
    valid: true,
    data: { tokenRecord, employee, employer },
  };
}

export async function markTokenUsed(tokenId: string): Promise<void> {
  await db
    .update(documentUploadTokens)
    .set({ isUsed: true, usedAt: new Date() })
    .where(eq(documentUploadTokens.id, tokenId));

  await db
    .update(documentUploadReminders)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(documentUploadReminders.uploadTokenId, tokenId),
        eq(documentUploadReminders.status, 'pending')
      )
    );
}
