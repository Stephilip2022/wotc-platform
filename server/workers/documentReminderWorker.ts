import { processDueReminders } from "../services/documentUploadReminders";

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes
let isRunning = false;

async function processReminders() {
  if (isRunning) return;
  isRunning = true;

  try {
    const result = await processDueReminders();
    if (result.sent > 0 || result.failed > 0 || result.cancelled > 0) {
      console.log(
        `[DocReminder Worker] Processed: ${result.sent} sent, ${result.failed} failed, ${result.cancelled} cancelled`
      );
    }
  } catch (error) {
    console.error("[DocReminder Worker] Error processing reminders:", error);
  } finally {
    isRunning = false;
  }
}

export function startDocumentReminderWorker() {
  console.log(`[DocReminder Worker] Starting with ${POLL_INTERVAL / 1000}s poll interval`);

  processReminders();

  setInterval(processReminders, POLL_INTERVAL);
}
