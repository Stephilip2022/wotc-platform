/**
 * Background Worker for Determination Letter Processing
 * 
 * Automatically processes parsed determination letters and updates:
 * 1. Employee screening status
 * 2. Credit calculations
 * 3. Certification details
 */

import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  determinationLetters,
  employees,
  screenings,
  credits,
} from "@shared/schema";
import { findEmployeeMatchScore } from "../utils/ocrParser";

/**
 * Process a single determination letter and update related records
 */
export async function processDeterminationLetter(letterId: string): Promise<{
  success: boolean;
  message: string;
  updatedEmployeeId?: string;
  updatedScreeningId?: string;
}> {
  console.log(`[DeterminationProcessor] Processing letter ${letterId}`);

  try {
    // Fetch letter
    const [letter] = await db
      .select()
      .from(determinationLetters)
      .where(eq(determinationLetters.id, letterId));

    if (!letter) {
      throw new Error(`Letter ${letterId} not found`);
    }

    if (letter.status === 'processed') {
      return {
        success: true,
        message: 'Letter already processed',
      };
    }

    const parsedData = letter.parsedData as any;
    
    // Try to find matching employee
    let employeeId = letter.employeeId;
    
    if (!employeeId && parsedData) {
      // Auto-match employee based on SSN or name
      const employeeRecords = await db
        .select()
        .from(employees)
        .where(eq(employees.employerId, letter.employerId));

      if (employeeRecords.length > 0) {
        // Calculate match scores
        const scores = employeeRecords.map(emp => ({
          employee: emp,
          score: findEmployeeMatchScore(parsedData, emp),
        }));

        // Find best match (score >= 60 for confidence)
        const bestMatch = scores.sort((a, b) => b.score - a.score)[0];
        if (bestMatch.score >= 60) {
          employeeId = bestMatch.employee.id;
          console.log(`[DeterminationProcessor] Auto-matched employee ${employeeId} with score ${bestMatch.score}`);
        }
      }
    }

    if (!employeeId) {
      // Update letter status to needs_review
      await db
        .update(determinationLetters)
        .set({
          status: 'needs_review',
          processedAt: new Date(),
        })
        .where(eq(determinationLetters.id, letterId));

      return {
        success: false,
        message: 'Could not auto-match employee - needs manual review',
      };
    }

    // Fetch employee screening
    const [screening] = await db
      .select()
      .from(screenings)
      .where(eq(screenings.employeeId, employeeId))
      .orderBy(desc(screenings.createdAt))
      .limit(1);

    if (!screening) {
      // Update letter to needs_review since we found employee but no screening
      await db
        .update(determinationLetters)
        .set({
          employeeId,
          status: 'needs_review',
          processedAt: new Date(),
        })
        .where(eq(determinationLetters.id, letterId));

      return {
        success: false,
        message: 'No screening found for employee - needs manual review',
      };
    }

    // Update screening based on determination status
    const updates: any = {
      updatedAt: new Date(),
    };

    if (parsedData.determinationStatus === 'approved') {
      updates.status = 'certified';
      updates.certifiedAt = parsedData.certificationDate 
        ? new Date(parsedData.certificationDate) 
        : new Date();
      updates.certificationNumber = parsedData.certificationNumber;
      
      if (parsedData.expirationDate) {
        updates.certificationExpiresAt = new Date(parsedData.expirationDate);
      }

      if (parsedData.targetGroup) {
        updates.primaryTargetGroup = parsedData.targetGroup;
      }
    } else if (parsedData.determinationStatus === 'denied') {
      updates.status = 'denied';
    } else if (parsedData.determinationStatus === 'pending') {
      updates.status = 'pending';
    }

    if (parsedData.determinationDate) {
      updates.eligibilityDeterminedAt = new Date(parsedData.determinationDate);
    }

    // Update screening
    await db
      .update(screenings)
      .set(updates)
      .where(eq(screenings.id, screening.id));

    // Create or update credit record if approved
    if (parsedData.determinationStatus === 'approved' && parsedData.creditAmount) {
      const [existingCredit] = await db
        .select()
        .from(credits)
        .where(and(
          eq(credits.screeningId, screening.id),
          eq(credits.employeeId, employeeId)
        ));

      if (existingCredit) {
        // Update existing credit
        await db
          .update(credits)
          .set({
            targetGroup: parsedData.targetGroup || existingCredit.targetGroup,
            creditAmount: parsedData.creditAmount,
            maxCreditAmount: parsedData.maxCreditAmount || parsedData.creditAmount,
            certificationNumber: parsedData.certificationNumber || existingCredit.certificationNumber,
            updatedAt: new Date(),
          })
          .where(eq(credits.id, existingCredit.id));
      } else {
        // Create new credit record
        await db
          .insert(credits)
          .values({
            employerId: letter.employerId,
            employeeId,
            screeningId: screening.id,
            targetGroup: parsedData.targetGroup || '',
            creditAmount: parsedData.creditAmount,
            maxCreditAmount: parsedData.maxCreditAmount || parsedData.creditAmount,
            certificationNumber: parsedData.certificationNumber || '',
            taxYear: new Date().getFullYear(),
            status: 'available',
          });
      }
    }

    // Update letter status and link to employee
    await db
      .update(determinationLetters)
      .set({
        employeeId,
        status: 'processed',
        processedAt: new Date(),
      })
      .where(eq(determinationLetters.id, letterId));

    return {
      success: true,
      message: 'Determination letter processed successfully',
      updatedEmployeeId: employeeId,
      updatedScreeningId: screening.id,
    };
  } catch (error) {
    console.error(`[DeterminationProcessor] Failed to process letter ${letterId}:`, error);
    
    // Update letter to error status
    await db
      .update(determinationLetters)
      .set({
        status: 'error',
        processedAt: new Date(),
      })
      .where(eq(determinationLetters.id, letterId));

    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process all pending determination letters
 */
export async function processAllPendingLetters(): Promise<void> {
  console.log('[DeterminationProcessor] Checking for pending letters...');

  const pendingLetters = await db
    .select()
    .from(determinationLetters)
    .where(eq(determinationLetters.status, 'pending'))
    .limit(50);

  if (pendingLetters.length === 0) {
    console.log('[DeterminationProcessor] No pending letters found');
    return;
  }

  console.log(`[DeterminationProcessor] Processing ${pendingLetters.length} pending letters`);

  for (const letter of pendingLetters) {
    await processDeterminationLetter(letter.id);
  }

  console.log('[DeterminationProcessor] All pending letters processed');
}
