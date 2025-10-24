# State-Specific Bulk Upload Formats

This document outlines the bulk upload CSV format requirements for state WOTC portals.

## Overview

Different states have unique requirements for bulk CSV uploads. This document serves as a reference for generating properly formatted CSV files for automated state portal submissions.

---

## Arizona Format

### File Format
- **Format**: CSV (Comma Separated Values)
- **Character Encoding**: UTF-8
- **File Extension**: `.csv`

### Column Structure

The Arizona bulk upload template contains the following columns (in order):

1. `General_FormVersionID` - Form version identifier (e.g., "9")
2. `General_YourSystemsRecordIdentifier` - Internal tracking ID
3. `Form8850_ApplicantFirstName` - Employee first name
4. `Form8850_ApplicantMiddleName` - Employee middle name (optional)
5. `Form8850_ApplicantLastName` - Employee last name
6. `Form8850_ApplicantSuffix` - Name suffix (Jr., Sr., etc.)
7. `Form8850_ApplicantSSN` - Social Security Number (9 digits, no dashes)
8. `Form8850_ApplicantAddressLine1` - Street address
9. `Form8850_ApplicantCity` - City
10. `Form8850_ApplicantStateCd` - State code (2 letters)
11. `Form8850_ApplicantZipCode` - ZIP code
12. `Form8850_ApplicantCounty` - County name
13. `Form8850_ApplicantPhone` - Phone number (10 digits)
14. `Form8850_ApplicantDOB` - Date of birth (M/D/YY format)
15. `Form8850_Checkbox1` - Boolean (TRUE/FALSE)
16. `Form8850_Checkbox2` - Boolean (TRUE/FALSE)
17. `Form8850_Checkbox3` - Boolean (TRUE/FALSE)
18. `Form8850_Checkbox4` - Boolean (TRUE/FALSE)
19. `Form8850_Checkbox5` - Boolean (TRUE/FALSE)
20. `Form8850_Checkbox6` - Boolean (TRUE/FALSE)
21. `Form8850_Checkbox7` - Boolean (TRUE/FALSE)
22. ... (additional employer and consultant fields)

### Key Requirements
- **Boolean Values**: Use `TRUE` or `FALSE` (case-sensitive)
- **Dates**: Use M/D/YY format (e.g., "9/1/01")
- **SSN**: 9 digits with no dashes or spaces
- **Phone**: 10 digits with no formatting
- **State Codes**: 2-letter abbreviations (e.g., "AZ", "TX")

### Sample Row
```csv
9,A123456789,Ava,,Brown,,123456789,123 N 3rd St,Phoenix,AZ,85001,Maricopa County,1234567890,6/20/92,FALSE,TRUE,FALSE,FALSE,FALSE,FALSE,FALSE,...
```

---

## Texas Format

### File Format
- **Format**: CSV (NOT CSV UTF-8)
- **Character Encoding**: Standard CSV
- **File Extension**: `.csv`
- **Maximum Records**: 999 per file (including header)

### Critical Requirements

#### Text Formatting
- **Columns A, B, C, and L MUST be formatted as TEXT** before converting to CSV
- These columns need leading zeros preserved
- Each cell should show a green triangle in upper-left corner indicating text format
- Do NOT use "CSV UTF-8 (Comma delimited)"

#### File Preparation
1. Start with blank Excel template as first tab
2. Format columns A, B, C, L as TEXT
3. Populate data
4. Convert to CSV (NOT CSV UTF-8)
5. Retain original Excel/CSV file as "Certificate of Electronic Filing" (COEFile)

#### Data Rules
- **NO COMMAS** in any field (commas are field separators)
- **NO drop-downs, borders, shaded areas** in template
- Use current version of Excel for conversion
- Files process in batches of 200 records

### Column Requirements

#### Required Columns (A-L)
Must be present in every file:
- **Column A**: Consultant EIN (leave blank if employer direct)
- **Column B**: Employer EIN
- **Column C**: Employee SSN
- **Column L**: (specific field - see template)

#### Optional Columns (M-AS)
- Leave blank if all answers are NO (reduces errors)
- **Columns W, Y, AM, AP, AR**: Require 2-digit state abbreviation for Out of State (OOS) benefits
  - TX is automatic, do not enter
- **Column AS**: Source Docs
  - If AS = Y, must have at least one target group selected
  - Target group columns: V, X, AD, AG, AJ, AK, AL, AN, AO, AQ

### Texas Processing Order

The Texas WOTC Unit processes applications in this priority:

1. **LTFAR (Long-Term Family Assistance Recipient)** - Pursued for all applications
2. **Veterans (VOW)** - If DD214 info found during Eligibility Matching
   - Priority order: DV6 → DV → UVB → UVA (highest to lowest credit value)
3. **SNAP/TANF/SSI/LTFAR** - Texas/TX benefits before Out of State
4. **DCR (Designated Community Resident)** - Processed last

### Important Notes
- **Date of Birth (DOB)** is critical, especially for age-restricted target groups
- Employers without consultant should leave Column A blank
- Do NOT enter Employer EIN in both Column A and Column B
- Upload files process in groups of 200 to avoid slow response times

### Upload Process

1. Navigate to "Submit a Bulk File"
2. Upload CSV file (NOT CSV UTF-8)
3. Review incomplete applications section (if any)
4. Download incomplete applications Excel report
5. Review complete applications section
6. Check BOTH electronic agreement boxes
7. Submit
8. Receive confirmation email with claim number range

### Error Prevention
- Pre-format text columns before data entry
- Remove all commas from field values
- Do not modify template structure
- Validate file has 998 records or fewer (excluding header)
- Ensure required columns A-L are populated
- Verify state codes are 2-letter abbreviations

---

## General Best Practices

### For All States

1. **Data Validation**
   - Validate SSN format (9 digits, numeric only)
   - Validate phone numbers (10 digits)
   - Validate state codes (2-letter, uppercase)
   - Validate dates (proper format for target state)

2. **File Management**
   - Retain original submission files as Certificate of Electronic Filing
   - Name files with employer ID and submission date
   - Track submission batch numbers

3. **Testing**
   - Test with small batches first (10-20 records)
   - Verify field mapping before large uploads
   - Review error reports immediately

4. **Common Errors to Avoid**
   - Mixing date formats
   - Including commas in text fields
   - Incorrect boolean representations (1/0 vs TRUE/FALSE)
   - Missing required fields
   - Incorrect column order

---

## Implementation Notes

When building automated state submission functionality:

1. **Template Storage**: Store state-specific templates in database (statePortalConfigs table)
2. **Field Mapping**: Map internal employee/screening data to state-specific column names
3. **Format Transformation**: 
   - Convert dates to state-required format
   - Format booleans correctly (TRUE/FALSE vs Y/N)
   - Remove formatting from SSN/phone numbers
4. **Validation**: Validate data against state requirements before CSV generation
5. **Batch Processing**: Respect state-specific batch size limits (e.g., Texas: 999 max)
6. **Error Handling**: Parse state portal error responses and map to source records

---

## Future State Additions

As additional states are configured, document their specific requirements here following the same structure:
- File format specifications
- Column structure
- Data formatting rules
- Upload process
- Common errors
- Processing priorities (if applicable)
