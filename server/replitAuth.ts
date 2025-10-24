import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  const userId = claims["sub"];
  const userEmail = claims["email"];
  
  // Check if user exists by ID
  const [existingUserById] = await db.select().from(users).where(eq(users.id, userId));
  
  // Check if email already exists (potentially with different ID)
  const [existingUserByEmail] = await db.select().from(users).where(eq(users.email, userEmail));
  
  if (existingUserById) {
    // User exists by ID - check if email is changing
    if (existingUserByEmail && existingUserByEmail.id !== userId) {
      // Email is taken by a different user - don't update email, just update other fields
      const [updatedUser] = await db
        .update(users)
        .set({
          firstName: claims["first_name"],
          lastName: claims["last_name"],
          profileImageUrl: claims["profile_image_url"],
          ...(claims["role"] && { role: claims["role"] }),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();
      return updatedUser;
    } else {
      // Email is not taken or is the same user - safe to update
      const [updatedUser] = await db
        .update(users)
        .set({
          email: userEmail,
          firstName: claims["first_name"],
          lastName: claims["last_name"],
          profileImageUrl: claims["profile_image_url"],
          ...(claims["role"] && { role: claims["role"] }),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();
      return updatedUser;
    }
  }
  
  if (existingUserByEmail) {
    // Email exists but user doesn't exist by ID
    // This is a returning user with a new OIDC sub (e.g., after account migration)
    // We can't safely update the primary key due to FK constraints,
    // so we update the profile and return the existing user
    // The session will use the existing user's ID, preserving FK relationships
    console.log(`Email ${userEmail} already exists with ID ${existingUserByEmail.id}, reusing for new sub ${userId}`);
    
    // Update profile fields (but not the ID to avoid FK violations)
    const [updatedUser] = await db
      .update(users)
      .set({
        firstName: claims["first_name"],
        lastName: claims["last_name"],
        profileImageUrl: claims["profile_image_url"],
        ...(claims["role"] && { role: claims["role"] }),
        updatedAt: new Date(),
      })
      .where(eq(users.email, userEmail))
      .returning();
    
    // Return the existing user (with their original ID) so session lookups work
    return updatedUser;
  }
  
  // Create new user
  const [newUser] = await db
    .insert(users)
    .values({
      id: userId,
      email: userEmail,
      firstName: claims["first_name"],
      lastName: claims["last_name"],
      profileImageUrl: claims["profile_image_url"],
      role: claims["role"] || "employee",
    })
    .returning();
  return newUser;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env.REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", async (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      failureRedirect: "/api/login",
    })(req, res, async () => {
      // After successful auth, redirect based on user role
      try {
        const userId = (req.user as any)?.claims?.sub;
        const userEmail = (req.user as any)?.claims?.email;
        
        if (userId || userEmail) {
          // Try to find user by ID first, then by email as fallback
          let [user] = userId ? await db.select().from(users).where(eq(users.id, userId)) : [null];
          
          // If not found by ID, try email (handles email conflicts where sub changed)
          if (!user && userEmail) {
            [user] = await db.select().from(users).where(eq(users.email, userEmail));
          }
          
          if (user) {
            const redirectMap: Record<string, string> = {
              admin: "/admin",
              employer: "/employer",
              employee: "/employee",
            };
            return res.redirect(redirectMap[user.role] || "/");
          }
        }
        res.redirect("/");
      } catch (error) {
        console.error("Error in callback redirect:", error);
        res.redirect("/");
      }
    });
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > user.expires_at) {
    const refreshToken = user.refresh_token;
    if (!refreshToken) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
    } catch (error) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
  }

  // Resolve canonical user ID with email fallback
  // This handles cases where OIDC sub changed but email stayed the same
  if (!user.canonicalSubResolved) {
    const originalSub = user.claims.sub;
    const userEmail = user.claims.email;
    
    // Try to find user by ID first
    let [dbUser] = await db.select().from(users).where(eq(users.id, originalSub));
    
    // If not found by ID, try email as fallback
    if (!dbUser && userEmail) {
      [dbUser] = await db.select().from(users).where(eq(users.email, userEmail));
      
      if (dbUser) {
        // Sub changed but email matches - use the database user's ID as the canonical sub
        console.log(`Resolved user by email fallback: ${userEmail} → ${dbUser.id} (original sub: ${originalSub})`);
        user.claims.sub = dbUser.id; // Overwrite sub with canonical database ID
      }
    }
    
    if (!dbUser) {
      // User not found in database - this shouldn't happen after upsert
      console.error(`User not found: sub=${originalSub}, email=${userEmail}`);
      res.status(401).json({ message: "User not found in database" });
      return;
    }
    
    // Mark as resolved so we don't repeat this lookup on every request
    user.canonicalSubResolved = true;
  }

  return next();
};
