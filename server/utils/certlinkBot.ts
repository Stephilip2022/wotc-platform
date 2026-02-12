/**
 * CertLink Playwright Bot
 * 
 * Automates login, batch CSV upload, error parsing, signator fix,
 * retry logic, and batch delete for CertLink-based state WOTC portals.
 * 
 * Supported states: Arizona (AZ), Illinois (IL), Kansas (KS), Maine (ME)
 * 
 * Portal URLs:
 *   AZ: https://wotc.azdes.gov/Account/Login
 *   IL: https://illinoiswotc.com/
 *   KS: https://kansaswotc.com/
 *   ME: https://wotc.maine.gov/Account/Login
 * 
 * Login flow: Email + Password + Agreement checkbox → Dashboard
 * Upload flow: Batch Applications → File input → Batch Import → Validate → Confirm
 * Error handling: Parse error table, fix signator or remove rows, delete batch, retry (up to 3x)
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  CERTLINK_STATES,
  fixSignatorInCSV,
  getSubmittedRecordsFromCSV,
} from './certlinkCsvGenerator';

export interface CertLinkBotResult {
  success: boolean;
  message: string;
  stateCode: string;
  recordsSubmitted: number;
  recordsRejected: number;
  rejectedRows: CertLinkErrorRow[];
  screenshotPaths: string[];
  attempts: number;
}

export interface CertLinkErrorRow {
  rowNumber: number;
  referenceNumber: string;
  applicantName: string;
  fieldName: string;
  severity: string;
  errorMessage: string;
}

export interface CertLinkCredentials {
  email: string;
  password: string;
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanDelay(page: Page, minMs = 800, maxMs = 2500): Promise<void> {
  await page.waitForTimeout(randomDelay(minMs, maxMs));
}

async function humanType(page: Page, selector: string, text: string): Promise<void> {
  const el = await page.waitForSelector(selector, { timeout: 20000 });
  if (!el) throw new Error(`Element not found: ${selector}`);
  await el.click();
  await humanDelay(page, 200, 500);
  await el.fill('');
  for (const char of text) {
    await page.keyboard.type(char, { delay: randomDelay(40, 120) });
  }
}

async function takeScreenshot(page: Page, label: string): Promise<string> {
  const dir = path.join(os.tmpdir(), 'certlink-screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${label}_${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

async function waitForElement(
  page: Page,
  selector: string,
  timeoutMs = 20000,
  label = 'Element'
): Promise<any> {
  const el = await page.waitForSelector(selector, { timeout: timeoutMs, state: 'visible' });
  if (!el) throw new Error(`${label} not found: ${selector}`);
  return el;
}

export class CertLinkBot {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    const chromiumPath = process.env.CHROMIUM_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';

    this.browser = await chromium.launch({
      headless: true,
      executablePath: fs.existsSync(chromiumPath) ? chromiumPath : undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1366, height: 768 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
      locale: 'en-US',
      timezoneId: 'America/Chicago',
    });

    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    this.page = await this.context.newPage();
  }

  async close(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  /**
   * Login to a CertLink portal
   * 
   * Flow:
   *   1. Navigate to portal URL
   *   2. Enter Email (input#Email)
   *   3. Enter Password (input#Password)
   *   4. Check Agreement checkbox (input#Agreement)
   *   5. Click Login button (div:nth-of-type(4) > button)
   *   6. Wait for /Employer/Dashboard redirect
   */
  async login(
    portalUrl: string,
    credentials: CertLinkCredentials,
    stateCode: string
  ): Promise<{ success: boolean; message: string; screenshots: string[] }> {
    if (!this.page) throw new Error('Bot not initialized');

    const screenshots: string[] = [];

    try {
      console.log(`[${stateCode} CertLink] Opening login page: ${portalUrl}`);
      await this.page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await humanDelay(this.page, 2000, 4000);
      screenshots.push(await takeScreenshot(this.page, `${stateCode}_01_login_page`));

      console.log(`[${stateCode} CertLink] Entering email...`);
      await humanType(this.page, '#Email', credentials.email);
      await humanDelay(this.page, 300, 800);

      console.log(`[${stateCode} CertLink] Entering password...`);
      await humanType(this.page, '#Password', credentials.password);
      await humanDelay(this.page, 300, 800);

      console.log(`[${stateCode} CertLink] Checking agreement...`);
      const agreement = await this.page.waitForSelector('#Agreement', { timeout: 10000 });
      if (agreement) {
        const isChecked = await agreement.isChecked();
        if (!isChecked) {
          await agreement.click();
          await humanDelay(this.page, 200, 500);
        }
      }

      console.log(`[${stateCode} CertLink] Clicking login button...`);
      const loginBtn = await waitForElement(this.page, 'div:nth-of-type(4) > button', 20000, 'Login Button');
      await loginBtn.click();

      const dashboardReached = await this.page.waitForURL('**/Employer/Dashboard**', { timeout: 15000 }).then(() => true).catch(() => false);

      if (!dashboardReached) {
        const currentUrl = this.page.url();
        if (currentUrl.includes('/Employer/Dashboard') || currentUrl.includes('/Dashboard')) {
          console.log(`[${stateCode} CertLink] Dashboard reached via URL check`);
        } else {
          screenshots.push(await takeScreenshot(this.page, `${stateCode}_02_login_failed`));
          return {
            success: false,
            message: `Login failed - did not reach dashboard. Current URL: ${currentUrl}`,
            screenshots,
          };
        }
      }

      console.log(`[${stateCode} CertLink] Login successful - Dashboard reached`);
      screenshots.push(await takeScreenshot(this.page, `${stateCode}_02_dashboard`));

      return { success: true, message: 'Login successful', screenshots };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[${stateCode} CertLink] Login error:`, msg);
      try { screenshots.push(await takeScreenshot(this.page!, `${stateCode}_login_error`)); } catch {}
      return { success: false, message: `Login failed: ${msg}`, screenshots };
    }
  }

  /**
   * Batch upload CSV to CertLink portal with up to 3 retry attempts.
   * 
   * Flow per attempt:
   *   1. Click "Batch Applications" (nav link)
   *   2. Set file input (#BatchData)
   *   3. Click "Batch Import" (#Upload)
   *   4. Wait for validation, find confirm (#btnProcess)
   *   5. Parse error table if errors exist
   *   6. If errors:
   *      a. Log errors
   *      b. Classify as signator fix vs remove
   *      c. Build clean CSV
   *      d. Delete bad batch
   *      e. Retry with clean file
   *   7. If no errors: click confirm
   */
  async batchUpload(
    csvContent: string,
    stateCode: string,
    stateName: string
  ): Promise<CertLinkBotResult> {
    if (!this.page) throw new Error('Bot not initialized');

    const upper = stateCode.toUpperCase();
    const screenshots: string[] = [];
    const allRejected: CertLinkErrorRow[] = [];
    let currentCsv = csvContent;
    let totalOriginalRows = csvContent.split('\n').length - 1;

    const tmpDir = path.join(os.tmpdir(), 'certlink-uploads');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`[${upper} CertLink] ATTEMPT ${attempt}/3`);

      try {
        console.log(`[${upper} CertLink] Navigating to Batch Applications...`);
        await humanDelay(this.page, 1000, 2000);

        const batchLink = await this.page.waitForSelector(
          '#empAppCollapse ul li:nth-of-type(4) > a, a:has-text("Batch Applications"), a[href*="BatchApplication"]',
          { timeout: 20000 }
        );
        if (!batchLink) throw new Error('Could not find Batch Applications link');
        await batchLink.click();
        await humanDelay(this.page, 2000, 4000);
        await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

        const csvFilePath = path.join(tmpDir, `${upper}_Upload_Attempt${attempt}_${Date.now()}.csv`);
        fs.writeFileSync(csvFilePath, currentCsv, { encoding: 'utf8' });

        console.log(`[${upper} CertLink] Setting file input...`);
        const fileInput = await this.page.waitForSelector('#BatchData', { timeout: 15000 });
        if (!fileInput) throw new Error('File input #BatchData not found');
        await fileInput.setInputFiles(csvFilePath);
        await humanDelay(this.page, 1000, 2000);

        console.log(`[${upper} CertLink] Clicking Batch Import...`);
        const uploadBtn = await waitForElement(this.page, '#Upload', 15000, 'Upload Button');
        await uploadBtn.click();

        console.log(`[${upper} CertLink] Waiting for CertLink validation (Attempt ${attempt})...`);
        await humanDelay(this.page, 5000, 8000);

        const confirmBtn = await this.page.waitForSelector('#btnProcess', { timeout: 60000 });
        if (!confirmBtn) throw new Error('Confirm button #btnProcess not found after validation');

        screenshots.push(await takeScreenshot(this.page, `${upper}_attempt${attempt}_validated`));

        console.log(`[${upper} CertLink] Parsing error log...`);
        const errorRows = await this.parseErrorTable(upper);

        if (errorRows.length > 0) {
          console.log(`[${upper} CertLink] Found ${errorRows.length} errors in attempt ${attempt}`);
          allRejected.push(...errorRows);

          const { removeRows, fixSignatorRows } = this.classifyErrors(errorRows, upper);

          console.log(`[${upper} CertLink] rowsToRemove=${removeRows.length} rowsToFixSignator=${fixSignatorRows.length}`);

          const config = CERTLINK_STATES[upper];
          const signatorCandidates = config ? config.signatorCandidates : [];

          if (fixSignatorRows.length > 0 && signatorCandidates.length < 2) {
            removeRows.push(...fixSignatorRows);
            fixSignatorRows.length = 0;
          }

          const cleanCsv = fixSignatorInCSV(currentCsv, fixSignatorRows, removeRows, signatorCandidates);

          console.log(`[${upper} CertLink] Deleting bad batch...`);
          await this.deleteBatch(upper);
          screenshots.push(await takeScreenshot(this.page, `${upper}_attempt${attempt}_deleted`));

          if (!cleanCsv || cleanCsv.split('\n').filter(l => l.trim()).length <= 1) {
            console.log(`[${upper} CertLink] No clean records remain after filtering.`);
            return {
              success: false,
              message: `All records had errors after ${attempt} attempt(s). No clean records remain.`,
              stateCode: upper,
              recordsSubmitted: 0,
              recordsRejected: totalOriginalRows,
              rejectedRows: allRejected,
              screenshotPaths: screenshots,
              attempts: attempt,
            };
          }

          if (attempt === 3) {
            console.log(`[${upper} CertLink] Reached max attempts (3). Moving on.`);
            return {
              success: false,
              message: `Failed after 3 attempts. Some errors could not be resolved.`,
              stateCode: upper,
              recordsSubmitted: 0,
              recordsRejected: totalOriginalRows,
              rejectedRows: allRejected,
              screenshotPaths: screenshots,
              attempts: 3,
            };
          }

          currentCsv = cleanCsv;
          continue;
        }

        console.log(`[${upper} CertLink] No errors detected -> confirming batch import.`);
        await confirmBtn.click();
        await humanDelay(this.page, 3000, 5000);
        await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        screenshots.push(await takeScreenshot(this.page, `${upper}_attempt${attempt}_confirmed`));

        const submittedRecords = getSubmittedRecordsFromCSV(currentCsv);
        const submittedCount = submittedRecords.length;

        console.log(`[${upper} CertLink] Batch confirmed. ${submittedCount} records submitted.`);

        return {
          success: true,
          message: `Batch upload successful. ${submittedCount} records submitted for ${stateName}.`,
          stateCode: upper,
          recordsSubmitted: submittedCount,
          recordsRejected: totalOriginalRows - submittedCount,
          rejectedRows: allRejected,
          screenshotPaths: screenshots,
          attempts: attempt,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[${upper} CertLink] Attempt ${attempt} error:`, msg);
        try { screenshots.push(await takeScreenshot(this.page!, `${upper}_attempt${attempt}_error`)); } catch {}

        if (attempt === 3) {
          return {
            success: false,
            message: `Failed after 3 attempts: ${msg}`,
            stateCode: upper,
            recordsSubmitted: 0,
            recordsRejected: totalOriginalRows,
            rejectedRows: allRejected,
            screenshotPaths: screenshots,
            attempts: 3,
          };
        }
      }
    }

    return {
      success: false,
      message: 'Upload failed after all attempts',
      stateCode: upper,
      recordsSubmitted: 0,
      recordsRejected: totalOriginalRows,
      rejectedRows: allRejected,
      screenshotPaths: screenshots,
      attempts: 3,
    };
  }

  /**
   * Parse the CertLink batch error detail table (#tblBatchDetails)
   * across all DataTables pages.
   * 
   * Table structure:
   *   - Header rows: "Applicant Name: {name}  Reference Number: {ref}"
   *   - Detail rows: [RowNumber, ErrorMessage, FieldName, Severity]
   *   - Only collect rows with Severity === "Error"
   */
  private async parseErrorTable(stateCode: string): Promise<CertLinkErrorRow[]> {
    if (!this.page) return [];

    const errors: CertLinkErrorRow[] = [];

    const collectPage = async () => {
      const trs = await this.page!.$$('table#tblBatchDetails tbody tr');

      let currentApplicant = '';
      let currentRef = '';

      for (const tr of trs) {
        const text = (await tr.textContent() || '').trim();
        if (!text) continue;

        const headerMatch = text.match(/Applicant Name:\s*(.+?)\s+Reference Number:\s*([a-f0-9]{8})/i);
        if (headerMatch) {
          currentApplicant = headerMatch[1].trim();
          currentRef = headerMatch[2].toLowerCase();
          continue;
        }

        const tds = await tr.$$('td');
        if (tds.length >= 4) {
          const rowNum = (await tds[0].textContent() || '').trim();
          const msg = (await tds[1].textContent() || '').trim();
          const field = (await tds[2].textContent() || '').trim();
          const severity = (await tds[3].textContent() || '').trim();

          if (severity === 'Error') {
            errors.push({
              rowNumber: parseInt(rowNum, 10) || 0,
              referenceNumber: currentRef,
              applicantName: currentApplicant,
              fieldName: field,
              severity,
              errorMessage: msg,
            });
          }
        }
      }
    };

    await collectPage();

    for (let pageNum = 2; pageNum <= 50; pageNum++) {
      try {
        const nextPageLink = await this.page.$(`a[aria-controls='tblBatchDetails'][aria-label='Page ${pageNum}']`);
        if (!nextPageLink) break;

        await nextPageLink.click();
        await humanDelay(this.page, 800, 1500);

        await this.page.waitForSelector('table#tblBatchDetails tbody tr', { timeout: 10000 });
        await collectPage();
      } catch {
        break;
      }
    }

    const unique = new Map<string, CertLinkErrorRow>();
    for (const e of errors) {
      const key = `${e.referenceNumber}-${e.rowNumber}-${e.errorMessage}`;
      if (!unique.has(key)) unique.set(key, e);
    }

    return Array.from(unique.values());
  }

  /**
   * Classify error rows into "fix signator" vs "remove" categories.
   * 
   * - POA signator error (only): can fix by rotating signator name
   * - Any other error: must remove that row
   * - If a row has BOTH POA and other errors: remove it
   */
  private classifyErrors(
    errors: CertLinkErrorRow[],
    stateCode: string
  ): { removeRows: number[]; fixSignatorRows: number[] } {
    const POA_MSG = 'Signator listed is not on employer\'s Power of Attorney for start date.';

    const byRow = new Map<number, { hasPoa: boolean; hasOther: boolean }>();

    for (const e of errors) {
      if (e.rowNumber <= 0) continue;

      if (!byRow.has(e.rowNumber)) {
        byRow.set(e.rowNumber, { hasPoa: false, hasOther: false });
      }

      const entry = byRow.get(e.rowNumber)!;
      if (e.errorMessage === POA_MSG) {
        entry.hasPoa = true;
      } else {
        entry.hasOther = true;
      }
    }

    const removeRows: number[] = [];
    const fixSignatorRows: number[] = [];

    byRow.forEach((info, rowNum) => {
      if (info.hasOther) {
        removeRows.push(rowNum);
      } else if (info.hasPoa) {
        fixSignatorRows.push(rowNum);
      }
    });

    return { removeRows, fixSignatorRows };
  }

  /**
   * Delete a bad batch import from CertLink.
   * 
   * Clicks "Delete Batch Import" button, then confirms with
   * "Yes, Delete this batch" in the modal.
   */
  private async deleteBatch(stateCode: string): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    console.log(`[${stateCode} CertLink] Looking for Delete Batch Import button...`);

    const deleteBtn = await this.page.waitForSelector(
      'button:has-text("Delete Batch Import"), a:has-text("Delete Batch Import")',
      { timeout: 60000 }
    );
    if (!deleteBtn) throw new Error(`[${stateCode}] Delete Batch Import button not found`);

    console.log(`[${stateCode} CertLink] Clicking Delete Batch Import...`);
    await deleteBtn.click();
    await humanDelay(this.page, 1000, 2000);

    const confirmDelete = await this.page.waitForSelector(
      'button:has-text("Yes, Delete this batch"), a:has-text("Yes, Delete this batch")',
      { timeout: 60000 }
    );
    if (!confirmDelete) throw new Error(`[${stateCode}] Delete confirmation not found`);

    console.log(`[${stateCode} CertLink] Confirming delete...`);
    await confirmDelete.click();
    await humanDelay(this.page, 3000, 5000);
    await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  }

  /**
   * Run full automation for a single CertLink state:
   *   1. Login
   *   2. Batch upload with retry
   */
  async runState(
    portalUrl: string,
    credentials: CertLinkCredentials,
    csvContent: string,
    stateCode: string,
    stateName: string
  ): Promise<CertLinkBotResult> {
    const upper = stateCode.toUpperCase();
    const screenshots: string[] = [];

    try {
      const loginResult = await this.login(portalUrl, credentials, upper);
      screenshots.push(...loginResult.screenshots);

      if (!loginResult.success) {
        return {
          success: false,
          message: loginResult.message,
          stateCode: upper,
          recordsSubmitted: 0,
          recordsRejected: 0,
          rejectedRows: [],
          screenshotPaths: screenshots,
          attempts: 0,
        };
      }

      const uploadResult = await this.batchUpload(csvContent, upper, stateName);
      uploadResult.screenshotPaths = [...screenshots, ...uploadResult.screenshotPaths];

      return uploadResult;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      try { screenshots.push(await takeScreenshot(this.page!, `${upper}_fatal_error`)); } catch {}

      return {
        success: false,
        message: `Fatal error for ${stateName}: ${msg}`,
        stateCode: upper,
        recordsSubmitted: 0,
        recordsRejected: 0,
        rejectedRows: [],
        screenshotPaths: screenshots,
        attempts: 0,
      };
    }
  }

  /**
   * Run automation for all CertLink states sequentially.
   * Reuses the same browser session across states (like the PS script).
   */
  async runAllStates(
    stateJobs: Array<{
      stateCode: string;
      stateName: string;
      portalUrl: string;
      credentials: CertLinkCredentials;
      csvContent: string;
    }>
  ): Promise<CertLinkBotResult[]> {
    const results: CertLinkBotResult[] = [];

    for (const job of stateJobs) {
      console.log(`\n==============================`);
      console.log(`Running CertLink state: ${job.stateCode} (${job.stateName})`);
      console.log(`==============================`);

      try {
        const result = await this.runState(
          job.portalUrl,
          job.credentials,
          job.csvContent,
          job.stateCode,
          job.stateName
        );
        results.push(result);

        console.log(`[${job.stateCode}] Result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.message}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[${job.stateCode}] Fatal error: ${msg}`);
        results.push({
          success: false,
          message: `Fatal error: ${msg}`,
          stateCode: job.stateCode,
          recordsSubmitted: 0,
          recordsRejected: 0,
          rejectedRows: [],
          screenshotPaths: [],
          attempts: 0,
        });
      }
    }

    return results;
  }
}
