import { clerkMiddleware, getAuth, requireAuth, createClerkClient } from "@clerk/express";
import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const publishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY || process.env.CLERK_PUBLISHABLE_KEY;
const secretKey = process.env.CLERK_SECRET_KEY;

if (!publishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY or CLERK_PUBLISHABLE_KEY environment variable");
}
if (!secretKey) {
  throw new Error("Missing CLERK_SECRET_KEY environment variable");
}

const clerkClient = createClerkClient({
  publishableKey,
  secretKey,
});

export function setupClerkAuth(app: Express) {
  app.use(clerkMiddleware({ publishableKey, secretKey, clerkClient }));
}

export const isAuthenticated: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);

  if (!auth || !auth.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  return next();
};

export function getClerkUserId(req: Request): string | null {
  const auth = getAuth(req);
  return auth?.userId || null;
}

export async function getOrCreateUser(req: Request) {
  const auth = getAuth(req);
  if (!auth || !auth.userId) return null;

  const clerkUserId = auth.userId;

  const [existingUser] = await db.select().from(users).where(eq(users.id, clerkUserId));
  if (existingUser) return existingUser;

  try {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);

    const email = clerkUser.emailAddresses?.[0]?.emailAddress || null;
    const firstName = clerkUser.firstName || null;
    const lastName = clerkUser.lastName || null;
    const profileImageUrl = clerkUser.imageUrl || null;

    if (email) {
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, email));
      if (existingByEmail) {
        const [updated] = await db
          .update(users)
          .set({
            firstName,
            lastName,
            profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.email, email))
          .returning();
        return updated;
      }
    }

    const [newUser] = await db
      .insert(users)
      .values({
        id: clerkUserId,
        email,
        firstName,
        lastName,
        profileImageUrl,
        role: "employee",
      })
      .returning();
    return newUser;
  } catch (error) {
    console.error("Error fetching Clerk user:", error);
    const [newUser] = await db
      .insert(users)
      .values({
        id: clerkUserId,
        role: "employee",
      })
      .returning();
    return newUser;
  }
}
