import { db } from "../db";
import { employees, hoursWorked, creditCalculations, integrationSyncedRecords, screenings } from "@shared/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  getValidAccessToken,
  trackSyncedRecord,
  logSyncActivity,
  retryWithBackoff,
} from "./integrationManager";
import { calculateCredit } from "../eligibility";

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
// ADP PAYROLL CONNECTOR
// ============================================================================

interface ADPEmployee {
  associateOID: string;
  workerID: {
    idValue: string;
  };
  person: {
    legalName: {
      givenName: string;
      familyName1: string;
    };
    communication: {
      emails: Array<{ emailUri: string }>;
    };
  };
  workAssignment: {
    actualWorkHours: number;
    remunerationBasisCode: {
      codeValue: string;
    };
  };
}

interface ADPPayrollData {
  payrollOutputs: Array<{
    associateOID: string;
    netPayAmount: {
      amountValue: number;
    };
    payPeriod: {
      startDate: string;
      endDate: string;
    };
    earnings: Array<{
      earningCode: string;
      earningAmount: {
        amountValue: number;
      };
      earningHours: number;
    }>;
  }>;
}

/**
 * Sync employee hours and wages from ADP Workforce Now
 */
export async function syncADPPayroll(
  connectionId: string,
  employerId: string,
  startDate: Date,
  endDate: Date
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

    // Fetch payroll data from ADP API
    const response = await retryWithBackoff(async () => {
      const res = await fetch(
        `https://api.adp.com/payroll/v2/payroll-outputs?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`ADP API error: ${res.statusText}`);
      }

      return res.json();
    });

    const payrollData: ADPPayrollData = response;
    const payrollOutputs = payrollData.payrollOutputs || [];
    result.recordsProcessed = payrollOutputs.length;

    for (const payrollOutput of payrollOutputs) {
      try {
        // Find employee using integrationSyncedRecords mapping
        const [syncedRecord] = await db
          .select()
          .from(integrationSyncedRecords)
          .where(
            and(
              eq(integrationSyncedRecords.connectionId, connectionId),
              eq(integrationSyncedRecords.externalId, payrollOutput.associateOID),
              eq(integrationSyncedRecords.externalType, "employee")
            )
          )
          .limit(1);

        if (!syncedRecord || !syncedRecord.internalId) {
          result.recordsFailed++;
          result.errors.push(
            `Employee mapping not found for ADP OID: ${payrollOutput.associateOID}. Employee may need to be synced first.`
          );
          continue;
        }

        const [employee] = await db
          .select()
          .from(employees)
          .where(eq(employees.id, syncedRecord.internalId))
          .limit(1);

        if (!employee) {
          result.recordsFailed++;
          result.errors.push(
            `Employee not found for ADP OID: ${payrollOutput.associateOID}`
          );
          continue;
        }

        // Calculate total hours and wages
        const totalHours = payrollOutput.earnings.reduce(
          (sum, earning) => sum + (earning.earningHours || 0),
          0
        );
        const totalWages = payrollOutput.earnings.reduce(
          (sum, earning) => sum + earning.earningAmount.amountValue,
          0
        );

        // Check if hours record already exists for this period
        const [existingRecord] = await db
          .select()
          .from(hoursWorked)
          .where(
            and(
              eq(hoursWorked.employeeId, employee.id),
              eq(hoursWorked.periodStart, payrollOutput.payPeriod.startDate),
              eq(hoursWorked.periodEnd, payrollOutput.payPeriod.endDate)
            )
          )
          .limit(1);

        if (existingRecord) {
          // Update existing record
          await db
            .update(hoursWorked)
            .set({
              hours: totalHours.toString(),
              wages: totalWages.toString(),
              source: "payroll_system",
              updatedAt: new Date(),
            })
            .where(eq(hoursWorked.id, existingRecord.id));

          result.recordsUpdated++;
        } else {
          // Create new hours record
          const [newRecord] = await db
            .insert(hoursWorked)
            .values({
              employerId,
              employeeId: employee.id,
              periodStart: payrollOutput.payPeriod.startDate,
              periodEnd: payrollOutput.payPeriod.endDate,
              hours: totalHours.toString(),
              wages: totalWages.toString(),
              source: "payroll_system",
              enteredBy: "system", // System-generated entry
            })
            .returning();

          result.recordsCreated++;
          result.syncedRecordIds.push(newRecord.id);
        }

        // Track sync
        await trackSyncedRecord(
          connectionId,
          payrollOutput.associateOID,
          employee.id,
          "adp_payroll_output",
          payrollOutput
        );

        // Auto-update credit calculations
        await updateCreditCalculations(employee.id, employerId);
      } catch (error) {
        result.recordsFailed++;
        result.errors.push(
          `Failed to process ADP payroll for ${payrollOutput.associateOID}: ${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`ADP payroll sync failed: ${(error as Error).message}`);
  }

  // Log the sync activity
  await logSyncActivity(connectionId, employerId, "adp_payroll", result);

  return result;
}

// ============================================================================
// GUSTO PAYROLL CONNECTOR
// ============================================================================

interface GustoEmployee {
  id: string;
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface GustoPayroll {
  payroll_uuid: string;
  pay_period: {
    start_date: string;
    end_date: string;
  };
  employee_compensations: Array<{
    employee_id: string;
    gross_pay: string;
    net_pay: string;
    hours: string;
  }>;
}

/**
 * Sync employee hours and wages from Gusto
 */
export async function syncGustoPayroll(
  connectionId: string,
  employerId: string,
  startDate: Date,
  endDate: Date
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

    // Fetch company ID first
    const companyResponse = await fetch("https://api.gusto.com/v1/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!companyResponse.ok) {
      throw new Error(`Gusto API error: ${companyResponse.statusText}`);
    }

    const companyData = await companyResponse.json();
    const companyId = companyData.companies[0]?.uuid;

    if (!companyId) {
      throw new Error("No Gusto company found");
    }

    // Fetch payrolls for the date range
    const response = await retryWithBackoff(async () => {
      const res = await fetch(
        `https://api.gusto.com/v1/companies/${companyId}/payrolls?start_date=${startDate.toISOString().split("T")[0]}&end_date=${endDate.toISOString().split("T")[0]}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Gusto API error: ${res.statusText}`);
      }

      return res.json();
    });

    const payrolls: GustoPayroll[] = response.payrolls || [];
    result.recordsProcessed = payrolls.length;

    for (const payroll of payrolls) {
      try {
        for (const compensation of payroll.employee_compensations) {
          // Find employee using integrationSyncedRecords mapping
          const [syncedRecord] = await db
            .select()
            .from(integrationSyncedRecords)
            .where(
              and(
                eq(integrationSyncedRecords.connectionId, connectionId),
                eq(integrationSyncedRecords.externalId, compensation.employee_id),
                eq(integrationSyncedRecords.externalType, "employee")
              )
            )
            .limit(1);

          if (!syncedRecord || !syncedRecord.internalId) {
            result.recordsFailed++;
            result.errors.push(
              `Employee mapping not found for Gusto ID: ${compensation.employee_id}. Employee may need to be synced first.`
            );
            continue;
          }

          const [employee] = await db
            .select()
            .from(employees)
            .where(eq(employees.id, syncedRecord.internalId))
            .limit(1);

          if (!employee) {
            result.recordsFailed++;
            result.errors.push(
              `Employee not found for Gusto ID: ${compensation.employee_id}`
            );
            continue;
          }

          const totalHours = parseFloat(compensation.hours);
          const totalWages = parseFloat(compensation.gross_pay);

          // Check if hours record already exists for this period
          const [existingRecord] = await db
            .select()
            .from(hoursWorked)
            .where(
              and(
                eq(hoursWorked.employeeId, employee.id),
                eq(hoursWorked.periodStart, payroll.pay_period.start_date),
                eq(hoursWorked.periodEnd, payroll.pay_period.end_date)
              )
            )
            .limit(1);

          if (existingRecord) {
            // Update existing record
            await db
              .update(hoursWorked)
              .set({
                hours: totalHours.toString(),
                wages: totalWages.toString(),
                source: "payroll_system",
                updatedAt: new Date(),
              })
              .where(eq(hoursWorked.id, existingRecord.id));

            result.recordsUpdated++;
          } else {
            // Create new hours record
            const [newRecord] = await db
              .insert(hoursWorked)
              .values({
                employerId,
                employeeId: employee.id,
                periodStart: payroll.pay_period.start_date,
                periodEnd: payroll.pay_period.end_date,
                hours: totalHours.toString(),
                wages: totalWages.toString(),
                source: "payroll_system",
                enteredBy: "system", // System-generated entry
              })
              .returning();

            result.recordsCreated++;
            result.syncedRecordIds.push(newRecord.id);
          }

          // Track sync
          await trackSyncedRecord(
            connectionId,
            payroll.payroll_uuid,
            employee.id,
            "gusto_payroll",
            payroll
          );

          // Auto-update credit calculations
          await updateCreditCalculations(employee.id, employerId);
        }
      } catch (error) {
        result.recordsFailed++;
        result.errors.push(
          `Failed to process Gusto payroll ${payroll.payroll_uuid}: ${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`Gusto payroll sync failed: ${(error as Error).message}`);
  }

  // Log the sync activity
  await logSyncActivity(connectionId, employerId, "gusto_payroll", result);

  return result;
}

// ============================================================================
// QUICKBOOKS PAYROLL CONNECTOR
// ============================================================================

interface QuickBooksPayrollItem {
  Employee: {
    value: string;
  };
  PayPeriodStart: string;
  PayPeriodEnd: string;
  TotalHours: number;
  GrossPay: number;
}

/**
 * Sync employee hours and wages from QuickBooks Payroll
 */
export async function syncQuickBooksPayroll(
  connectionId: string,
  employerId: string,
  startDate: Date,
  endDate: Date
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

    // Fetch company realm ID from connection metadata
    const companyId = process.env.QUICKBOOKS_REALM_ID;

    if (!companyId) {
      throw new Error("QuickBooks company realm ID not configured");
    }

    // Fetch payroll data using QuickBooks Query API
    const query = `SELECT * FROM PayrollCheckDetail WHERE PayPeriodStart >= '${startDate.toISOString().split("T")[0]}' AND PayPeriodEnd <= '${endDate.toISOString().split("T")[0]}'`;

    const response = await retryWithBackoff(async () => {
      const res = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${companyId}/query?query=${encodeURIComponent(query)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`QuickBooks API error: ${res.statusText}`);
      }

      return res.json();
    });

    const payrollItems: QuickBooksPayrollItem[] =
      response.QueryResponse?.PayrollCheckDetail || [];
    result.recordsProcessed = payrollItems.length;

    for (const item of payrollItems) {
      try {
        // Find employee using integrationSyncedRecords mapping
        const [syncedRecord] = await db
          .select()
          .from(integrationSyncedRecords)
          .where(
            and(
              eq(integrationSyncedRecords.connectionId, connectionId),
              eq(integrationSyncedRecords.externalId, item.Employee.value),
              eq(integrationSyncedRecords.externalType, "employee")
            )
          )
          .limit(1);

        if (!syncedRecord || !syncedRecord.internalId) {
          result.recordsFailed++;
          result.errors.push(
            `Employee mapping not found for QuickBooks ID: ${item.Employee.value}. Employee may need to be synced first.`
          );
          continue;
        }

        const [employee] = await db
          .select()
          .from(employees)
          .where(eq(employees.id, syncedRecord.internalId))
          .limit(1);

        if (!employee) {
          result.recordsFailed++;
          result.errors.push(
            `Employee not found for QuickBooks ID: ${item.Employee.value}`
          );
          continue;
        }

        // Check if hours record already exists for this period
        const [existingRecord] = await db
          .select()
          .from(hoursWorked)
          .where(
            and(
              eq(hoursWorked.employeeId, employee.id),
              eq(hoursWorked.periodStart, item.PayPeriodStart),
              eq(hoursWorked.periodEnd, item.PayPeriodEnd)
            )
          )
          .limit(1);

        if (existingRecord) {
          // Update existing record
          await db
            .update(hoursWorked)
            .set({
              hours: item.TotalHours.toString(),
              wages: item.GrossPay.toString(),
              source: "payroll_system",
              updatedAt: new Date(),
            })
            .where(eq(hoursWorked.id, existingRecord.id));

          result.recordsUpdated++;
        } else {
          // Create new hours record
          const [newRecord] = await db
            .insert(hoursWorked)
            .values({
              employerId,
              employeeId: employee.id,
              periodStart: item.PayPeriodStart,
              periodEnd: item.PayPeriodEnd,
              hours: item.TotalHours.toString(),
              wages: item.GrossPay.toString(),
              source: "payroll_system",
              enteredBy: "system", // System-generated entry
            })
            .returning();

          result.recordsCreated++;
          result.syncedRecordIds.push(newRecord.id);
        }

        // Track sync
        await trackSyncedRecord(
          connectionId,
          item.Employee.value,
          employee.id,
          "quickbooks_payroll",
          item
        );

        // Auto-update credit calculations
        await updateCreditCalculations(employee.id, employerId);
      } catch (error) {
        result.recordsFailed++;
        result.errors.push(
          `Failed to process QuickBooks payroll for employee ${item.Employee.value}: ${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(
      `QuickBooks payroll sync failed: ${(error as Error).message}`
    );
  }

  // Log the sync activity
  await logSyncActivity(connectionId, employerId, "quickbooks_payroll", result);

  return result;
}

// ============================================================================
// CREDIT CALCULATION AUTO-UPDATE
// ============================================================================

/**
 * Automatically recalculate WOTC credits based on updated payroll data
 * Uses the existing calculateCredit function from eligibility.ts
 */
async function updateCreditCalculations(
  employeeId: string,
  employerId: string
): Promise<void> {
  // Get employee's certified screenings
  const certifiedScreenings = await db
    .select()
    .from(screenings)
    .where(
      and(
        eq(screenings.employeeId, employeeId),
        eq(screenings.status, "certified")
      )
    );

  for (const screening of certifiedScreenings) {
    // Get total hours worked from hours records
    const hoursData = await db
      .select()
      .from(hoursWorked)
      .where(eq(hoursWorked.employeeId, employeeId));

    const totalHours = hoursData.reduce(
      (sum, record) => sum + parseFloat(record.hours || "0"),
      0
    );

    // Calculate total wages from payroll data
    const totalWages = hoursData.reduce(
      (sum, record) => sum + parseFloat(record.wages || "0"),
      0
    );

    // Get target group code
    const targetGroupCode = screening.primaryTargetGroup || "snap";

    // Calculate credit using existing eligibility logic
    const calculatedCredit = calculateCredit(
      targetGroupCode,
      totalHours,
      totalWages
    );

    // Determine max credit based on target group
    const maxCredit = targetGroupCode === "veterans" ? 9600 : 2400;

    // Update or create credit calculation
    const [existingCalc] = await db
      .select()
      .from(creditCalculations)
      .where(eq(creditCalculations.screeningId, screening.id))
      .limit(1);

    if (existingCalc) {
      await db
        .update(creditCalculations)
        .set({
          hoursWorked: totalHours,
          wagesEarned: totalWages.toString(),
          projectedCreditAmount: calculatedCredit.toString(),
          actualCreditAmount: calculatedCredit.toString(),
          updatedAt: new Date(),
        })
        .where(eq(creditCalculations.id, existingCalc.id));
    } else {
      await db.insert(creditCalculations).values({
        screeningId: screening.id,
        employerId,
        employeeId,
        targetGroup: targetGroupCode,
        maxCreditAmount: maxCredit.toString(),
        projectedCreditAmount: calculatedCredit.toString(),
        hoursWorked: totalHours,
        wagesEarned: totalWages.toString(),
      });
    }
  }
}
