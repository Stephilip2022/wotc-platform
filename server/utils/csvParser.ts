import { parse } from 'csv-parse/sync';

export interface DetectedColumn {
  name: string;
  index: number;
  dataType: 'text' | 'number' | 'date' | 'email' | 'ssn' | 'mixed';
  sampleValues: string[];
  nullCount: number;
  suggestedMapping?: string; // Suggested field based on column name analysis
  confidence?: number; // Confidence score for suggested mapping (0-1)
}

export interface ParsedCSV {
  columns: DetectedColumn[];
  rowCount: number;
  errors: string[];
}

/**
 * Parse CSV file and detect column types and suggested mappings
 */
export function parseAndDetectColumns(csvContent: string, maxSampleRows: number = 100): ParsedCSV {
  const errors: string[] = [];
  
  try {
    // Parse CSV
    const records: any[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true, // Allow varying column counts
    });

    if (records.length === 0) {
      throw new Error('CSV file has no data rows');
    }

    // Get column headers
    const headers = Object.keys(records[0]);
    const columns: DetectedColumn[] = [];

    // Analyze each column
    for (let i = 0; i < headers.length; i++) {
      const columnName = headers[i];
      const values = records.map(row => row[columnName] || '');
      const suggestedField = suggestFieldMapping(columnName);
      
      const column: DetectedColumn = {
        name: columnName,
        index: i,
        dataType: detectDataType(values),
        sampleValues: getSampleValues(values, Math.min(maxSampleRows, 5)),
        nullCount: values.filter(v => !v || v.trim() === '').length,
        suggestedMapping: suggestedField,
        confidence: suggestedField ? 0.9 : 0, // High confidence if we have a suggestion
      };
      
      columns.push(column);
    }

    return {
      columns,
      rowCount: records.length,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Failed to parse CSV');
    return {
      columns: [],
      rowCount: 0,
      errors,
    };
  }
}

/**
 * Detect the data type of a column based on its values
 */
function detectDataType(values: string[]): DetectedColumn['dataType'] {
  const nonEmptyValues = values.filter(v => v && v.trim() !== '');
  
  if (nonEmptyValues.length === 0) return 'text';
  
  let numberCount = 0;
  let dateCount = 0;
  let emailCount = 0;
  let ssnCount = 0;
  
  for (const value of nonEmptyValues) {
    if (isNumeric(value)) numberCount++;
    if (isDate(value)) dateCount++;
    if (isEmail(value)) emailCount++;
    if (isSSN(value)) ssnCount++;
  }
  
  const total = nonEmptyValues.length;
  const threshold = 0.8; // 80% of values must match the pattern
  
  // Check SSN first (most specific pattern)
  if (ssnCount / total >= threshold) return 'ssn';
  
  // Check email
  if (emailCount / total >= threshold) return 'email';
  
  // Check date
  if (dateCount / total >= threshold) return 'date';
  
  // Check number
  if (numberCount / total >= threshold) return 'number';
  
  // Check if mixed types
  const typeCount = [numberCount, dateCount, emailCount, ssnCount].filter(c => c > 0).length;
  if (typeCount > 1) return 'mixed';
  
  return 'text';
}

/**
 * Get sample values from a column (up to maxSamples unique non-empty values)
 */
function getSampleValues(values: string[], maxSamples: number): string[] {
  const uniqueValues = new Set<string>();
  
  for (const value of values) {
    if (value && value.trim() !== '') {
      uniqueValues.add(value);
      if (uniqueValues.size >= maxSamples) break;
    }
  }
  
  return Array.from(uniqueValues).slice(0, maxSamples);
}

/**
 * Suggest field mapping based on column name
 */
function suggestFieldMapping(columnName: string): string | undefined {
  const normalized = columnName.toLowerCase().replace(/[_\s-]+/g, '');
  
  // Employee identification
  if (/^(emp|employee|worker|staff)?id$/i.test(normalized)) return 'employeeId';
  if (/^ssn|socialsecurity/i.test(normalized)) return 'ssn';
  if (/^email/i.test(normalized)) return 'email';
  
  // Name fields
  if (/^(first|given)?name$/i.test(normalized)) return 'firstName';
  if (/^(last|sur|family)?name$/i.test(normalized)) return 'lastName';
  if (/^fullname|name$/i.test(normalized)) return 'fullName';
  
  // Hours and dates
  if (/^(hours?|time|hrs)$/i.test(normalized)) return 'hours';
  if (/^(total)?hours?(worked)?$/i.test(normalized)) return 'hours';
  if (/^(period|pay)?start(date)?$/i.test(normalized)) return 'periodStart';
  if (/^(period|pay)?end(date)?$/i.test(normalized)) return 'periodEnd';
  if (/^(work|pay)?date$/i.test(normalized)) return 'periodStart';
  
  // Other common fields
  if (/^notes?|comments?|remarks?$/i.test(normalized)) return 'notes';
  if (/^department|dept$/i.test(normalized)) return 'department';
  if (/^(job)?title|position$/i.test(normalized)) return 'jobTitle';
  
  return undefined;
}

/**
 * Check if a value is numeric
 */
function isNumeric(value: string): boolean {
  if (!value || value.trim() === '') return false;
  const cleaned = value.replace(/[$,]/g, ''); // Remove currency symbols and commas
  return !isNaN(parseFloat(cleaned)) && isFinite(Number(cleaned));
}

/**
 * Check if a value is a date
 */
function isDate(value: string): boolean {
  if (!value || value.trim() === '') return false;
  
  // Common date patterns
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // M/D/YY or M/D/YYYY
  ];
  
  if (datePatterns.some(pattern => pattern.test(value))) {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  
  return false;
}

/**
 * Check if a value is an email
 */
function isEmail(value: string): boolean {
  if (!value || value.trim() === '') return false;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(value);
}

/**
 * Check if a value is an SSN (Social Security Number)
 */
function isSSN(value: string): boolean {
  if (!value || value.trim() === '') return false;
  
  // SSN patterns: XXX-XX-XXXX or XXXXXXXXX
  const ssnPatterns = [
    /^\d{3}-\d{2}-\d{4}$/,
    /^\d{9}$/,
  ];
  
  return ssnPatterns.some(pattern => pattern.test(value));
}

/**
 * Parse date string with multiple format support
 */
export function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return null;
}

/**
 * Format date to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
