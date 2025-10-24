import { db } from '../db';
import { employees } from '@shared/schema';
import { eq, and, or, sql } from 'drizzle-orm';

export interface EmployeeMatchResult {
  employeeId: string | null;
  employee: any | null;
  confidence: 'exact' | 'high' | 'medium' | 'low' | 'none';
  matchMethod: 'id' | 'ssn' | 'email' | 'name' | 'none';
  matchScore: number; // 0-100
  possibleMatches?: Array<{
    employeeId: string;
    employee: any;
    score: number;
    reason: string;
  }>;
}

export interface EmployeeMatchCriteria {
  employeeId?: string;
  ssn?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

/**
 * Match an employee using multiple strategies with confidence scoring
 */
export async function matchEmployee(
  employerId: string,
  criteria: EmployeeMatchCriteria,
  matchStrategy: 'id' | 'ssn' | 'email' | 'name' | 'auto' = 'auto'
): Promise<EmployeeMatchResult> {
  
  // Strategy 1: Match by Employee ID (exact match)
  if ((matchStrategy === 'id' || matchStrategy === 'auto') && criteria.employeeId) {
    const result = await matchById(employerId, criteria.employeeId);
    if (result.employee) return result;
  }

  // Strategy 2: Match by SSN (exact match, most reliable)
  if ((matchStrategy === 'ssn' || matchStrategy === 'auto') && criteria.ssn) {
    const result = await matchBySSN(employerId, criteria.ssn);
    if (result.employee) return result;
  }

  // Strategy 3: Match by Email (exact match)
  if ((matchStrategy === 'email' || matchStrategy === 'auto') && criteria.email) {
    const result = await matchByEmail(employerId, criteria.email);
    if (result.employee) return result;
  }

  // Strategy 4: Match by Name (fuzzy match)
  if ((matchStrategy === 'name' || matchStrategy === 'auto') && (criteria.firstName || criteria.fullName)) {
    const result = await matchByName(employerId, criteria);
    if (result.employee && result.confidence !== 'none') return result;
  }

  // No match found
  return {
    employeeId: null,
    employee: null,
    confidence: 'none',
    matchMethod: 'none',
    matchScore: 0,
  };
}

/**
 * Match by employee ID
 */
async function matchById(employerId: string, employeeId: string): Promise<EmployeeMatchResult> {
  try {
    const [employee] = await db
      .select()
      .from(employees)
      .where(and(
        eq(employees.id, employeeId),
        eq(employees.employerId, employerId)
      ))
      .limit(1);

    if (employee) {
      return {
        employeeId: employee.id,
        employee,
        confidence: 'exact',
        matchMethod: 'id',
        matchScore: 100,
      };
    }
  } catch (error) {
    console.error('Error matching by ID:', error);
  }

  return {
    employeeId: null,
    employee: null,
    confidence: 'none',
    matchMethod: 'none',
    matchScore: 0,
  };
}

/**
 * Match by SSN
 */
async function matchBySSN(employerId: string, ssn: string): Promise<EmployeeMatchResult> {
  try {
    // Normalize SSN (remove dashes, spaces)
    const normalizedSSN = ssn.replace(/[-\s]/g, '');

    const [employee] = await db
      .select()
      .from(employees)
      .where(and(
        eq(employees.employerId, employerId),
        sql`REPLACE(REPLACE(${employees.ssn}, '-', ''), ' ', '') = ${normalizedSSN}`
      ))
      .limit(1);

    if (employee) {
      return {
        employeeId: employee.id,
        employee,
        confidence: 'exact',
        matchMethod: 'ssn',
        matchScore: 100,
      };
    }
  } catch (error) {
    console.error('Error matching by SSN:', error);
  }

  return {
    employeeId: null,
    employee: null,
    confidence: 'none',
    matchMethod: 'none',
    matchScore: 0,
  };
}

/**
 * Match by email
 */
async function matchByEmail(employerId: string, email: string): Promise<EmployeeMatchResult> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    const [employee] = await db
      .select()
      .from(employees)
      .where(and(
        eq(employees.employerId, employerId),
        sql`LOWER(TRIM(${employees.email})) = ${normalizedEmail}`
      ))
      .limit(1);

    if (employee) {
      return {
        employeeId: employee.id,
        employee,
        confidence: 'exact',
        matchMethod: 'email',
        matchScore: 100,
      };
    }
  } catch (error) {
    console.error('Error matching by email:', error);
  }

  return {
    employeeId: null,
    employee: null,
    confidence: 'none',
    matchMethod: 'none',
    matchScore: 0,
  };
}

/**
 * Match by name (with fuzzy matching)
 */
async function matchByName(
  employerId: string,
  criteria: EmployeeMatchCriteria
): Promise<EmployeeMatchResult> {
  try {
    let firstName: string | undefined;
    let lastName: string | undefined;

    // Parse full name if provided
    if (criteria.fullName && !criteria.firstName && !criteria.lastName) {
      const parts = criteria.fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        firstName = parts[0];
        lastName = parts[parts.length - 1];
      } else if (parts.length === 1) {
        lastName = parts[0];
      }
    } else {
      firstName = criteria.firstName;
      lastName = criteria.lastName;
    }

    if (!firstName && !lastName) {
      return {
        employeeId: null,
        employee: null,
        confidence: 'none',
        matchMethod: 'none',
        matchScore: 0,
      };
    }

    // Get all employees for this employer
    const allEmployees = await db
      .select()
      .from(employees)
      .where(eq(employees.employerId, employerId));

    // Score each employee
    const scored = allEmployees.map(employee => {
      const score = calculateNameMatchScore(
        { firstName, lastName },
        { 
          firstName: employee.firstName, 
          lastName: employee.lastName 
        }
      );

      return {
        employeeId: employee.id,
        employee,
        score,
        reason: getMatchReason(score),
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Get best match
    const best = scored[0];

    if (!best || best.score === 0) {
      return {
        employeeId: null,
        employee: null,
        confidence: 'none',
        matchMethod: 'none',
        matchScore: 0,
      };
    }

    // Determine confidence based on score
    let confidence: EmployeeMatchResult['confidence'];
    if (best.score >= 95) {
      confidence = 'exact';
    } else if (best.score >= 80) {
      confidence = 'high';
    } else if (best.score >= 60) {
      confidence = 'medium';
    } else if (best.score >= 40) {
      confidence = 'low';
    } else {
      confidence = 'none';
    }

    // Include top 3 possible matches if confidence is not exact
    const possibleMatches = confidence !== 'exact' 
      ? scored.slice(0, 3).filter(s => s.score > 0)
      : undefined;

    return {
      employeeId: best.employeeId,
      employee: best.employee,
      confidence,
      matchMethod: 'name',
      matchScore: best.score,
      possibleMatches,
    };
  } catch (error) {
    console.error('Error matching by name:', error);
    return {
      employeeId: null,
      employee: null,
      confidence: 'none',
      matchMethod: 'none',
      matchScore: 0,
    };
  }
}

/**
 * Calculate name match score (0-100)
 */
function calculateNameMatchScore(
  search: { firstName?: string; lastName?: string },
  target: { firstName?: string; lastName?: string }
): number {
  let totalScore = 0;
  let weightedTotal = 0;

  // Last name is more important (weight: 60%)
  if (search.lastName && target.lastName) {
    const lastNameScore = fuzzyMatch(search.lastName, target.lastName);
    totalScore += lastNameScore * 0.6;
    weightedTotal += 0.6;
  }

  // First name (weight: 40%)
  if (search.firstName && target.firstName) {
    const firstNameScore = fuzzyMatch(search.firstName, target.firstName);
    totalScore += firstNameScore * 0.4;
    weightedTotal += 0.4;
  }

  // Normalize to 0-100 scale
  return weightedTotal > 0 ? Math.round((totalScore / weightedTotal) * 100) : 0;
}

/**
 * Fuzzy string matching using Levenshtein distance
 */
function fuzzyMatch(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  // Convert distance to similarity score (0-1)
  return maxLength > 0 ? 1 - (distance / maxLength) : 0;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  // Initialize first row and column
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Get match reason based on score
 */
function getMatchReason(score: number): string {
  if (score >= 95) return 'Exact name match';
  if (score >= 80) return 'Very similar name';
  if (score >= 60) return 'Similar name';
  if (score >= 40) return 'Possible match';
  return 'Low confidence match';
}
