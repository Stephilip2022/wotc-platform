import { db } from "../db";
import { employees, screenings, employers } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  getValidAccessToken,
  applyFieldMappings,
  getFieldMappings,
  trackSyncedRecord,
  logSyncActivity,
  retryWithBackoff,
  type SyncResult,
} from "./integrationManager";

// ============================================================================
// GREENHOUSE ATS CONNECTOR
// ============================================================================

interface GreenhouseCandidate {
  id: number;
  first_name: string;
  last_name: string;
  email_addresses: Array<{ value: string; type: string }>;
  phone_numbers: Array<{ value: string; type: string }>;
  addresses: Array<{
    value: string;
    type: string;
    city?: string;
    state?: string;
    zip?: string;
  }>;
  application_ids: number[];
}

/**
 * Sync hired candidates from Greenhouse
 */
export async function syncGreenhouseCandidates(
  connectionId: string,
  employerId: string
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
    const fieldMappings = await getFieldMappings(connectionId);

    // Fetch hired candidates (offer accepted stage)
    const response = await retryWithBackoff(async () => {
      const res = await fetch(
        "https://harvest.greenhouse.io/v1/candidates?per_page=500",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "On-Behalf-Of": employerId, // Greenhouse organization ID
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Greenhouse API error: ${res.statusText}`);
      }

      return res.json();
    });

    // Greenhouse API returns array directly or { candidates: [] }
    const candidates: GreenhouseCandidate[] = Array.isArray(response)
      ? response
      : response.candidates || [];
    result.recordsProcessed = candidates.length;

    for (const candidate of candidates) {
      try {
        // Map Greenhouse fields to our employee schema
        const mappedData = applyFieldMappings(candidate, fieldMappings);

        const primaryEmail =
          candidate.email_addresses.find((e) => e.type === "personal")?.value ||
          candidate.email_addresses[0]?.value;

        const primaryPhone =
          candidate.phone_numbers.find((p) => p.type === "mobile")?.value ||
          candidate.phone_numbers[0]?.value;

        const address = candidate.addresses[0];

        // Check if employee already exists
        const existingEmployee = await db
          .select()
          .from(employees)
          .where(eq(employees.email, primaryEmail))
          .limit(1);

        if (existingEmployee.length > 0) {
          // Update existing employee
          await db
            .update(employees)
            .set({
              firstName: candidate.first_name,
              lastName: candidate.last_name,
              phone: primaryPhone,
              address: address?.value,
              city: address?.city,
              state: address?.state,
              zipCode: address?.zip,
            })
            .where(eq(employees.id, existingEmployee[0].id));

          result.recordsUpdated++;
          result.syncedRecordIds.push(existingEmployee[0].id);

          // Track sync
          await trackSyncedRecord(
            connectionId,
            candidate.id.toString(),
            existingEmployee[0].id,
            "greenhouse_candidate",
            candidate
          );
        } else {
          // Create new employee
          const [newEmployee] = await db
            .insert(employees)
            .values({
              employerId,
              firstName: candidate.first_name,
              lastName: candidate.last_name,
              email: primaryEmail,
              phone: primaryPhone,
              address: address?.value,
              city: address?.city,
              state: address?.state,
              zipCode: address?.zip,
              hireDate: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
              status: "active",
            })
            .returning();

          result.recordsCreated++;
          result.syncedRecordIds.push(newEmployee.id);

          // Track sync
          await trackSyncedRecord(
            connectionId,
            candidate.id.toString(),
            newEmployee.id,
            "greenhouse_candidate",
            candidate
          );

          // Auto-create screening for new hire
          await db.insert(screenings).values({
            employeeId: newEmployee.id,
            employerId,
            status: "pending",
          });
        }
      } catch (error) {
        result.recordsFailed++;
        result.errors.push(
          `Failed to sync candidate ${candidate.id}: ${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`Greenhouse sync failed: ${(error as Error).message}`);
  }

  // Log the sync activity
  await logSyncActivity(connectionId, employerId, "greenhouse_candidates", result);

  return result;
}

/**
 * Push WOTC screening results back to Greenhouse
 */
export async function pushWotcResultsToGreenhouse(
  connectionId: string,
  candidateId: string,
  wotcData: {
    eligible: boolean;
    targetGroup?: string;
    certificationNumber?: string;
    creditAmount?: number;
  }
): Promise<boolean> {
  try {
    const accessToken = await getValidAccessToken(connectionId);

    // Add custom field or note to candidate profile
    await retryWithBackoff(async () => {
      const res = await fetch(
        `https://harvest.greenhouse.io/v1/candidates/${candidateId}/activity_feed/notes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: null, // System note
            body: `WOTC Status: ${wotcData.eligible ? "Eligible" : "Not Eligible"}${
              wotcData.targetGroup ? `\nTarget Group: ${wotcData.targetGroup}` : ""
            }${
              wotcData.certificationNumber
                ? `\nCertification: ${wotcData.certificationNumber}`
                : ""
            }${
              wotcData.creditAmount
                ? `\nEstimated Credit: $${wotcData.creditAmount}`
                : ""
            }`,
            visibility: "admin_only",
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to update Greenhouse: ${res.statusText}`);
      }

      return res.json();
    });

    return true;
  } catch (error) {
    console.error("Error pushing to Greenhouse:", error);
    return false;
  }
}

// ============================================================================
// BAMBOOHR ATS CONNECTOR
// ============================================================================

interface BambooHREmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobilePhone?: string;
  homePhone?: string;
  address1?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  hireDate?: string;
  department?: string;
  jobTitle?: string;
}

/**
 * Sync employees from BambooHR
 */
export async function syncBambooHREmployees(
  connectionId: string,
  employerId: string,
  bambooSubdomain: string
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
    const fieldMappings = await getFieldMappings(connectionId);

    // Fetch employees from BambooHR
    const response = await retryWithBackoff(async () => {
      const res = await fetch(
        `https://api.bamboohr.com/api/gateway.php/${bambooSubdomain}/v1/employees/directory`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${accessToken}:x`).toString("base64")}`,
            Accept: "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error(`BambooHR API error: ${res.statusText}`);
      }

      return res.json();
    });

    const bambooEmployees: BambooHREmployee[] = response.employees || [];
    result.recordsProcessed = bambooEmployees.length;

    for (const bambooEmployee of bambooEmployees) {
      try {
        // Map BambooHR fields to our employee schema
        const mappedData = applyFieldMappings(bambooEmployee, fieldMappings);

        // Check if employee already exists
        const existingEmployee = await db
          .select()
          .from(employees)
          .where(eq(employees.email, bambooEmployee.email))
          .limit(1);

        if (existingEmployee.length > 0) {
          // Update existing employee
          await db
            .update(employees)
            .set({
              firstName: bambooEmployee.firstName,
              lastName: bambooEmployee.lastName,
              phone: bambooEmployee.mobilePhone || bambooEmployee.homePhone,
              address: bambooEmployee.address1,
              city: bambooEmployee.city,
              state: bambooEmployee.state,
              zipCode: bambooEmployee.zipcode,
              department: bambooEmployee.department,
              jobTitle: bambooEmployee.jobTitle,
            })
            .where(eq(employees.id, existingEmployee[0].id));

          result.recordsUpdated++;
          result.syncedRecordIds.push(existingEmployee[0].id);

          // Track sync
          await trackSyncedRecord(
            connectionId,
            bambooEmployee.id,
            existingEmployee[0].id,
            "bamboohr_employee",
            bambooEmployee
          );
        } else {
          // Create new employee
          const [newEmployee] = await db
            .insert(employees)
            .values({
              employerId,
              firstName: bambooEmployee.firstName,
              lastName: bambooEmployee.lastName,
              email: bambooEmployee.email,
              phone: bambooEmployee.mobilePhone || bambooEmployee.homePhone,
              address: bambooEmployee.address1,
              city: bambooEmployee.city,
              state: bambooEmployee.state,
              zipCode: bambooEmployee.zipcode,
              department: bambooEmployee.department,
              jobTitle: bambooEmployee.jobTitle,
              hireDate: bambooEmployee.hireDate || new Date().toISOString().split('T')[0],
              status: "active",
            })
            .returning();

          result.recordsCreated++;
          result.syncedRecordIds.push(newEmployee.id);

          // Track sync
          await trackSyncedRecord(
            connectionId,
            bambooEmployee.id,
            newEmployee.id,
            "bamboohr_employee",
            bambooEmployee
          );

          // Auto-create screening for new hire
          await db.insert(screenings).values({
            employeeId: newEmployee.id,
            employerId,
            status: "pending",
          });
        }
      } catch (error) {
        result.recordsFailed++;
        result.errors.push(
          `Failed to sync employee ${bambooEmployee.id}: ${(error as Error).message}`
        );
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`BambooHR sync failed: ${(error as Error).message}`);
  }

  // Log the sync activity
  await logSyncActivity(connectionId, employerId, "bamboohr_employees", result);

  return result;
}

/**
 * Push WOTC certification status to BambooHR
 */
export async function pushWotcResultsToBambooHR(
  connectionId: string,
  bambooSubdomain: string,
  employeeId: string,
  wotcData: {
    eligible: boolean;
    targetGroup?: string;
    certificationNumber?: string;
    creditAmount?: number;
  }
): Promise<boolean> {
  try {
    const accessToken = await getValidAccessToken(connectionId);

    // Update custom field in BambooHR
    await retryWithBackoff(async () => {
      const res = await fetch(
        `https://api.bamboohr.com/api/gateway.php/${bambooSubdomain}/v1/employees/${employeeId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accessToken}:x`).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            wotcEligible: wotcData.eligible ? "Yes" : "No",
            wotcTargetGroup: wotcData.targetGroup || "",
            wotcCertification: wotcData.certificationNumber || "",
            wotcCreditAmount: wotcData.creditAmount || 0,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to update BambooHR: ${res.statusText}`);
      }

      return res.json();
    });

    return true;
  } catch (error) {
    console.error("Error pushing to BambooHR:", error);
    return false;
  }
}
