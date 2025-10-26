import { db } from "../db";
import { creditCalculations, screenings, employees, employers } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  getValidAccessToken,
  logSyncActivity,
  retryWithBackoff,
} from "./integrationManager";

export type SyncResult = {
  success: boolean;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: string[];
  syncedRecordIds: string[];
};

// ============================================================================
// QUICKBOOKS ONLINE EXPORT
// ============================================================================

interface QuickBooksJournalEntry {
  Line: Array<{
    DetailType: string;
    Amount: number;
    Description: string;
    JournalEntryLineDetail: {
      PostingType: string;
      AccountRef: {
        value: string;
      };
    };
  }>;
  TxnDate: string;
  PrivateNote: string;
}

/**
 * Export WOTC credits to QuickBooks Online as journal entries
 */
export async function exportToQuickBooks(
  connectionId: string,
  employerId: string,
  creditCalculationIds: string[]
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsFailed: 0,
    errors: [],
    syncedRecordIds: [],
  };

  try {
    const accessToken = await getValidAccessToken(connectionId);
    const companyId = process.env.QUICKBOOKS_REALM_ID;

    if (!companyId) {
      throw new Error("QuickBooks company realm ID not configured");
    }

    // Get credit calculations with related data
    const credits = await db.query.creditCalculations.findMany({
      where: (creditCalculations, { inArray }) =>
        inArray(creditCalculations.id, creditCalculationIds),
      with: {
        screening: true,
        employee: true,
      },
    });

    result.recordsProcessed = credits.length;

    for (const credit of credits) {
      try {
        const creditAmount = parseFloat(credit.actualCreditAmount || "0");

        // Create journal entry for WOTC credit
        const journalEntry: QuickBooksJournalEntry = {
          Line: [
            {
              DetailType: "JournalEntryLineDetail",
              Amount: creditAmount,
              Description: `WOTC Credit - Employee ID ${credit.employeeId} - ${credit.targetGroup}`,
              JournalEntryLineDetail: {
                PostingType: "Debit",
                AccountRef: {
                  value: "95", // WOTC Credit Receivable account
                },
              },
            },
            {
              DetailType: "JournalEntryLineDetail",
              Amount: creditAmount,
              Description: `WOTC Credit - Employee ID ${credit.employeeId} - ${credit.targetGroup}`,
              JournalEntryLineDetail: {
                PostingType: "Credit",
                AccountRef: {
                  value: "47", // Tax Credits Income account
                },
              },
            },
          ],
          TxnDate: credit.calculatedAt ? new Date(credit.calculatedAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          PrivateNote: JSON.stringify({
            wotcCreditId: credit.id,
            employeeId: credit.employeeId,
            screeningId: credit.screeningId,
            targetGroup: credit.targetGroup,
            hoursWorked: credit.hoursWorked,
          }),
        };

        // Post journal entry to QuickBooks
        const response = await retryWithBackoff(async () => {
          const res = await fetch(
            `https://quickbooks.api.intuit.com/v3/company/${companyId}/journalentry`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify(journalEntry),
            }
          );

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`QuickBooks API error: ${error}`);
          }

          return res.json();
        });

        result.recordsCreated++;
        result.syncedRecordIds.push(credit.id);

        // Note: Export tracking would be stored in integrationSyncedRecords table
        // not on the credit calculation itself
      } catch (error) {
        result.recordsFailed++;
        result.errors.push(
          `Failed to export credit ${credit.id} to QuickBooks: ${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      `QuickBooks export failed: ${(error as Error).message}`
    );
  }

  // Log the export activity
  await logSyncActivity(connectionId, employerId, "quickbooks_export", result);

  return result;
}

// ============================================================================
// XERO EXPORT
// ============================================================================

interface XeroManualJournal {
  Narration: string;
  Date: string;
  JournalLines: Array<{
    LineAmount: number;
    AccountCode: string;
    Description: string;
    TaxType: string;
  }>;
}

/**
 * Export WOTC credits to Xero as manual journals
 */
export async function exportToXero(
  connectionId: string,
  employerId: string,
  creditCalculationIds: string[]
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    recordsProcessed: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsFailed: 0,
    errors: [],
    syncedRecordIds: [],
  };

  try {
    const accessToken = await getValidAccessToken(connectionId);
    const tenantId = process.env.XERO_TENANT_ID;

    if (!tenantId) {
      throw new Error("Xero tenant ID not configured");
    }

    // Get credit calculations with related data
    const credits = await db.query.creditCalculations.findMany({
      where: (creditCalculations, { inArray }) =>
        inArray(creditCalculations.id, creditCalculationIds),
      with: {
        screening: true,
        employee: true,
      },
    });

    result.recordsProcessed = credits.length;

    for (const credit of credits) {
      try {
        const creditAmount = parseFloat(credit.actualCreditAmount || "0");

        // Create manual journal for WOTC credit
        const manualJournal: XeroManualJournal = {
          Narration: `WOTC Credit - Employee ID ${credit.employeeId} - ${credit.targetGroup} - ${credit.hoursWorked} hours`,
          Date: credit.calculatedAt ? new Date(credit.calculatedAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          JournalLines: [
            {
              LineAmount: creditAmount,
              AccountCode: "820", // WOTC Credit Receivable
              Description: `WOTC Credit Receivable - Employee ID ${credit.employeeId}`,
              TaxType: "NONE",
            },
            {
              LineAmount: -creditAmount,
              AccountCode: "470", // Tax Credits Income
              Description: `WOTC Credit Income - ${credit.targetGroup}`,
              TaxType: "NONE",
            },
          ],
        };

        // Post manual journal to Xero
        const response = await retryWithBackoff(async () => {
          const res = await fetch(
            "https://api.xero.com/api.xro/2.0/ManualJournals",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Xero-Tenant-Id": tenantId,
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ ManualJournals: [manualJournal] }),
            }
          );

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Xero API error: ${error}`);
          }

          return res.json();
        });

        result.recordsCreated++;
        result.syncedRecordIds.push(credit.id);

        // Note: Export tracking would be stored in integrationSyncedRecords table
      } catch (error) {
        result.recordsFailed++;
        result.errors.push(
          `Failed to export credit ${credit.id} to Xero: ${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`Xero export failed: ${(error as Error).message}`);
  }

  // Log the export activity
  await logSyncActivity(connectionId, employerId, "xero_export", result);

  return result;
}

// ============================================================================
// BATCH EXPORT WITH PDF ATTACHMENTS
// ============================================================================

/**
 * Generate WOTC credit summary PDF for accounting export
 */
export function generateCreditSummaryPDF(
  credits: Array<{
    id: string;
    employeeId: string;
    targetGroup: string | null;
    hoursWorked: number | null;
    actualCreditAmount: string | null;
    calculatedAt: Date | null;
  }>
): string {
  // Generate simple text summary (in production, use a proper PDF library)
  let summary = "WOTC Credit Summary\n";
  summary += "===================\n\n";

  let totalCredits = 0;

  credits.forEach((credit, index) => {
    const amount = parseFloat(credit.actualCreditAmount || "0");
    totalCredits += amount;

    summary += `${index + 1}. Employee ID: ${credit.employeeId}\n`;
    summary += `   Target Group: ${credit.targetGroup}\n`;
    summary += `   Hours Worked: ${credit.hoursWorked}\n`;
    summary += `   Credit Amount: $${amount.toFixed(2)}\n`;
    summary += `   Calculated: ${credit.calculatedAt || "N/A"}\n\n`;
  });

  summary += `\nTotal WOTC Credits: $${totalCredits.toFixed(2)}\n`;
  summary += `Total Employees: ${credits.length}\n`;
  summary += `Generated: ${new Date().toISOString()}\n`;

  return summary;
}

/**
 * Export batch of WOTC credits with supporting documentation
 */
export async function batchExportCredits(
  connectionId: string,
  employerId: string,
  creditCalculationIds: string[],
  exportType: "quickbooks" | "xero"
): Promise<{
  exportResult: SyncResult;
  summaryPDF: string;
}> {
  // Get credits
  const credits = await db.query.creditCalculations.findMany({
    where: (creditCalculations, { inArray }) =>
      inArray(creditCalculations.id, creditCalculationIds),
  });

  // Generate summary PDF
  const summaryPDF = generateCreditSummaryPDF(credits);

  // Export to accounting system
  let exportResult: SyncResult;
  if (exportType === "quickbooks") {
    exportResult = await exportToQuickBooks(
      connectionId,
      employerId,
      creditCalculationIds
    );
  } else {
    exportResult = await exportToXero(connectionId, employerId, creditCalculationIds);
  }

  return {
    exportResult,
    summaryPDF,
  };
}
