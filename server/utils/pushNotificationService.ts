import webpush from 'web-push';
import { db } from "../db";
import { pushSubscriptions, notificationPreferences } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

// VAPID keys configuration
// In production, these should be in environment variables
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@wotc-platform.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
}

export type NotificationType =
  | 'screeningStarted'
  | 'screeningCompleted'
  | 'screeningEligible'
  | 'screeningCertified'
  | 'screeningDenied'
  | 'submissionQueued'
  | 'submissionSuccess'
  | 'submissionFailed'
  | 'creditCalculated'
  | 'creditUpdated'
  | 'invoiceGenerated'
  | 'paymentReceived'
  | 'paymentFailed';

export class PushNotificationService {
  
  static async sendNotification(
    userId: string,
    notificationType: NotificationType,
    payload: NotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    try {
      // Check user preferences
      const [preferences] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      // If preferences don't exist or notification type is disabled, skip
      if (preferences && !(preferences as any)[notificationType]) {
        console.log(`Notification ${notificationType} disabled for user ${userId}`);
        return { sent: 0, failed: 0 };
      }

      // Get all push subscriptions for this user
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, userId));

      if (subscriptions.length === 0) {
        console.log(`No push subscriptions found for user ${userId}`);
        return { sent: 0, failed: 0 };
      }

      // Send to all subscriptions
      const results = await Promise.allSettled(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth,
                },
              },
              JSON.stringify(payload)
            );
            return { success: true };
          } catch (error: any) {
            console.error(`Failed to send notification to ${sub.endpoint}:`, error);
            
            // Remove invalid subscriptions (410 Gone or 404 Not Found)
            if (error.statusCode === 410 || error.statusCode === 404) {
              await db
                .delete(pushSubscriptions)
                .where(eq(pushSubscriptions.id, sub.id));
              console.log(`Removed invalid subscription ${sub.id}`);
            }
            
            return { success: false };
          }
        })
      );

      const sent = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failed = results.length - sent;

      return { sent, failed };
    } catch (error) {
      console.error('Error sending push notifications:', error);
      return { sent: 0, failed: 0 };
    }
  }

  static async sendScreeningNotification(
    userId: string,
    screeningId: string,
    status: string
  ): Promise<void> {
    const notificationMap: Record<string, { type: NotificationType; title: string; body: string }> = {
      'pending': {
        type: 'screeningStarted',
        title: 'WOTC Screening Started',
        body: 'Your WOTC screening has been initiated.',
      },
      'completed': {
        type: 'screeningCompleted',
        title: 'Screening Completed',
        body: 'Your WOTC screening questionnaire has been completed.',
      },
      'eligible': {
        type: 'screeningEligible',
        title: 'WOTC Eligible',
        body: 'Congratulations! You are eligible for WOTC certification.',
      },
      'certified': {
        type: 'screeningCertified',
        title: 'WOTC Certified',
        body: 'Your WOTC certification has been approved!',
      },
      'denied': {
        type: 'screeningDenied',
        title: 'WOTC Certification Denied',
        body: 'Unfortunately, your WOTC certification was not approved.',
      },
    };

    const notification = notificationMap[status];
    if (!notification) return;

    await this.sendNotification(userId, notification.type, {
      title: notification.title,
      body: notification.body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: {
        url: `/employee/screening/${screeningId}`,
        screeningId,
        status,
      },
      actions: [
        { action: 'view', title: 'View Details' },
        { action: 'close', title: 'Dismiss' },
      ],
      tag: `screening-${screeningId}`,
    });
  }

  static async sendSubmissionNotification(
    userId: string,
    submissionId: string,
    status: 'queued' | 'success' | 'failed',
    details?: string
  ): Promise<void> {
    const notificationMap: Record<string, { type: NotificationType; title: string; body: string; requireInteraction?: boolean }> = {
      queued: {
        type: 'submissionQueued',
        title: 'Submission Queued',
        body: 'Your WOTC submission has been queued for processing.',
      },
      success: {
        type: 'submissionSuccess',
        title: 'Submission Successful',
        body: 'Your WOTC submission was successfully submitted to the state portal.',
      },
      failed: {
        type: 'submissionFailed',
        title: 'Submission Failed',
        body: details || 'Your WOTC submission encountered an error.',
        requireInteraction: true,
      },
    };

    const notification = notificationMap[status];

    await this.sendNotification(userId, notification.type, {
      title: notification.title,
      body: notification.body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: {
        url: '/employer/submissions',
        submissionId,
        status,
      },
      actions: [
        { action: 'view', title: 'View Details' },
        { action: 'close', title: 'Dismiss' },
      ],
      tag: `submission-${submissionId}`,
      requireInteraction: notification.requireInteraction || false,
    });
  }
}
