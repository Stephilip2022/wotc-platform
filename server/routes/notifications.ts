import { Router } from "express";
import { db } from "../db";
import { pushSubscriptions, notificationPreferences, users } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { insertPushSubscriptionSchema, insertNotificationPreferencesSchema } from "../../shared/schema";

const router = Router();

// Subscribe to push notifications
router.post("/subscribe", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const subscriptionData = insertPushSubscriptionSchema.parse({
      userId,
      endpoint: req.body.endpoint,
      p256dh: req.body.keys.p256dh,
      auth: req.body.keys.auth,
      userAgent: req.headers['user-agent'] || null,
    });

    // Check if subscription already exists
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscriptionData.endpoint))
      .limit(1);

    if (existing.length > 0) {
      // Update existing subscription
      const [updated] = await db
        .update(pushSubscriptions)
        .set({
          p256dh: subscriptionData.p256dh,
          auth: subscriptionData.auth,
          userAgent: subscriptionData.userAgent,
          updatedAt: new Date(),
        })
        .where(eq(pushSubscriptions.endpoint, subscriptionData.endpoint))
        .returning();

      return res.json({ subscription: updated });
    }

    // Create new subscription
    const [subscription] = await db
      .insert(pushSubscriptions)
      .values(subscriptionData)
      .returning();

    // Create default notification preferences if they don't exist
    const existingPrefs = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existingPrefs.length === 0) {
      await db
        .insert(notificationPreferences)
        .values({ userId })
        .returning();
    }

    res.json({ subscription });
  } catch (error) {
    console.error("Error subscribing to push notifications:", error);
    res.status(500).json({ error: "Failed to subscribe to push notifications" });
  }
});

// Unsubscribe from push notifications
router.post("/unsubscribe", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { endpoint } = req.body;

    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );

    res.json({ success: true });
  } catch (error) {
    console.error("Error unsubscribing from push notifications:", error);
    res.status(500).json({ error: "Failed to unsubscribe from push notifications" });
  }
});

// Get notification preferences
router.get("/preferences", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    // Create default preferences if they don't exist
    if (!preferences) {
      [preferences] = await db
        .insert(notificationPreferences)
        .values({ userId })
        .returning();
    }

    res.json({ preferences });
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    res.status(500).json({ error: "Failed to fetch notification preferences" });
  }
});

// Update notification preferences
router.patch("/preferences", async (req: any, res) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updateSchema = insertNotificationPreferencesSchema.partial().omit({ userId: true });
    const updates = updateSchema.parse(req.body);

    // Ensure preferences exist
    const existing = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing.length === 0) {
      // Create with updates
      const [preferences] = await db
        .insert(notificationPreferences)
        .values({ userId, ...updates })
        .returning();
      return res.json({ preferences });
    }

    // Update existing
    const [preferences] = await db
      .update(notificationPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId))
      .returning();

    res.json({ preferences });
  } catch (error) {
    console.error("Error updating notification preferences:", error);
    res.status(500).json({ error: "Failed to update notification preferences" });
  }
});

// Get VAPID public key
router.get("/vapid-public-key", (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  res.json({ publicKey });
});

export default router;
