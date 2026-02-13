import { db } from "../db";
import { 
  onboardingInstances, onboardingInviteTokens, employers 
} from "../../shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { sendOnboardingReminderEmail } from "../email/notifications";
import { sendSms, formatPhoneNumber } from "../services/twilioSms";

const REMINDER_INTERVALS_DAYS = [3, 7];
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

const remindersSent = new Map<string, number[]>();

function getBaseUrl(): string {
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return `https://${process.env.REPL_ID || "app"}.replit.app`;
}

export function startOnboardingReminderWorker() {
  console.log(`[OnboardingReminder] Starting worker with ${POLL_INTERVAL_MS / 1000}s poll interval`);
  
  processReminders().catch(err => console.error("[OnboardingReminder] Initial run failed:", err));
  
  setInterval(() => {
    processReminders().catch(err => console.error("[OnboardingReminder] Poll failed:", err));
  }, POLL_INTERVAL_MS);
}

async function processReminders() {
  try {
    const incompleteInstances = await db
      .select()
      .from(onboardingInstances)
      .where(
        and(
          inArray(onboardingInstances.status, ["pending", "in_progress"]),
          sql`${onboardingInstances.startedAt} IS NOT NULL OR ${onboardingInstances.createdAt} IS NOT NULL`
        )
      );

    if (incompleteInstances.length === 0) return;

    const now = new Date();
    const baseUrl = getBaseUrl();
    let sentCount = 0;

    for (const instance of incompleteInstances) {
      const baseDate = instance.startedAt || instance.createdAt;
      if (!baseDate) continue;

      const daysSinceStart = Math.floor((now.getTime() - new Date(baseDate).getTime()) / (1000 * 60 * 60 * 24));

      const sentForInstance = remindersSent.get(instance.id) || [];

      for (const intervalDay of REMINDER_INTERVALS_DAYS) {
        if (daysSinceStart >= intervalDay && !sentForInstance.includes(intervalDay)) {
          try {
            const [employer] = await db.select().from(employers).where(eq(employers.id, instance.employerId));
            if (!employer?.onboardingModuleEnabled) continue;

            let onboardLink = "";
            if (instance.inviteTokenId) {
              const [token] = await db.select().from(onboardingInviteTokens).where(eq(onboardingInviteTokens.id, instance.inviteTokenId));
              if (token && new Date(token.expiresAt) > now) {
                onboardLink = `${baseUrl}/onboard/${token.token}`;
              }
            }
            if (!onboardLink) continue;

            const daysRemaining = Math.max(0, 30 - daysSinceStart);

            await sendOnboardingReminderEmail(instance.email, {
              firstName: instance.firstName,
              employerName: employer.name,
              onboardingUrl: onboardLink,
              progressPercent: instance.progressPercent,
              daysRemaining,
              employerLogoUrl: employer.logoUrl || undefined,
            });

            if (instance.phone) {
              const formattedPhone = formatPhoneNumber(instance.phone);
              if (formattedPhone) {
                await sendSms(
                  formattedPhone,
                  `Hi ${instance.firstName}, reminder to complete your onboarding for ${employer.name}. You're ${instance.progressPercent}% done: ${onboardLink}`
                ).catch(() => {});
              }
            }

            sentForInstance.push(intervalDay);
            remindersSent.set(instance.id, sentForInstance);
            sentCount++;

            console.log(`[OnboardingReminder] Sent day-${intervalDay} reminder to ${instance.email}`);
          } catch (e) {
            console.error(`[OnboardingReminder] Failed for instance ${instance.id} day-${intervalDay}:`, e);
          }
        }
      }
    }

    if (sentCount > 0) {
      console.log(`[OnboardingReminder] Sent ${sentCount} reminders`);
    }
  } catch (error) {
    console.error("[OnboardingReminder] Error processing reminders:", error);
  }
}
