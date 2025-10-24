/**
 * One-time script to encrypt existing credentials in the database
 * Run this after implementing encryption to secure existing data
 */

import { db } from "../db";
import { statePortalConfigs } from "@shared/schema";
import { encryptCredentials, encryptChallengeQuestions } from "./encryption";

export async function migrateExistingCredentials() {
  console.log("Starting credential encryption migration...");
  
  try {
    // Fetch all state portal configs
    const configs = await db.select().from(statePortalConfigs);
    
    let updated = 0;
    for (const config of configs) {
      let needsUpdate = false;
      const updates: any = {};
      
      // Check if credentials need encryption (detect plaintext)
      if (config.credentials) {
        const creds = config.credentials as any;
        if (creds.password && !creds.password.includes(':')) {
          // Password doesn't have encryption format (iv:tag:data)
          console.log(`Encrypting credentials for ${config.stateName}...`);
          updates.credentials = encryptCredentials(creds);
          needsUpdate = true;
        }
      }
      
      // Check if challenge questions need encryption
      if (config.challengeQuestions && Array.isArray(config.challengeQuestions)) {
        const questions = config.challengeQuestions as any;
        if (questions.length > 0 && questions[0].answer && !questions[0].answer.includes(':')) {
          console.log(`Encrypting challenge questions for ${config.stateName}...`);
          updates.challengeQuestions = encryptChallengeQuestions(questions);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await db
          .update(statePortalConfigs)
          .set(updates)
          .where(eq(statePortalConfigs.id, config.id));
        updated++;
      }
    }
    
    console.log(`Migration complete! Encrypted credentials for ${updated} state(s).`);
    return { success: true, updated };
  } catch (error) {
    console.error("Migration failed:", error);
    return { success: false, error };
  }
}

// Import eq from drizzle-orm
import { eq } from "drizzle-orm";
