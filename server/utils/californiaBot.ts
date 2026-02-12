/**
 * California EDD WOTC Portal Playwright Bot
 * 
 * Automates the submission of WOTC applications to the California EDD portal:
 *   Portal: https://eddservices.edd.ca.gov/wotc/
 * 
 * Flow (matches PowerShell HiJack script):
 *   1. Navigate to portal
 *   2. Login if needed (detect login page via username input)
 *   3. Navigate to "Submit Multiple Applications" link
 *   4. Upload XML file via file input
 *   5. Click Upload button
 *   6. Parse validation results:
 *      - Errors: #FormValidation > ul > li
 *      - Receipt: #lblMessage, accepted/rejected counts, EIN/SSN table
 * 
 * Credentials passed as runtime parameters, never hardcoded.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface CaliforniaBotResult {
  success: boolean;
  message: string;
  batchId?: string;
  accepted: number;
  rejected: number;
  errors: string[];
  applicationDetails: Array<{ ein: string; ssn: string }>;
  receiptText: string;
  screenshotPaths: string[];
}

export interface CaliforniaCredentials {
  username: string;
  password: string;
}

export class CaliforniaBot {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(30000);
  }

  async close(): Promise<void> {
    try {
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch {}
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  private async takeScreenshot(label: string): Promise<string> {
    if (!this.page) return '';
    try {
      const tmpDir = path.join(os.tmpdir(), 'ca-wotc-screenshots');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const filePath = path.join(tmpDir, `ca_${label}_${Date.now()}.png`);
      await this.page.screenshot({ path: filePath, fullPage: false });
      return filePath;
    } catch {
      return '';
    }
  }

  private async humanDelay(min = 500, max = 1500): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private async humanType(selector: string, text: string): Promise<void> {
    if (!this.page) return;
    const el = await this.page.waitForSelector(selector, { timeout: 10000 });
    if (!el) throw new Error(`Element not found: ${selector}`);
    await el.click();
    await this.humanDelay(200, 400);
    await el.fill('');
    for (const char of text) {
      await this.page.keyboard.type(char, { delay: Math.random() * 80 + 30 });
    }
  }

  async submit(
    portalUrl: string,
    credentials: CaliforniaCredentials,
    xmlContent: string
  ): Promise<CaliforniaBotResult> {
    if (!this.page) throw new Error('Bot not initialized. Call initialize() first.');

    const screenshots: string[] = [];
    const result: CaliforniaBotResult = {
      success: false,
      message: '',
      accepted: 0,
      rejected: 0,
      errors: [],
      applicationDetails: [],
      receiptText: '',
      screenshotPaths: [],
    };

    try {
      // Write XML to temp file for upload
      const tmpDir = path.join(os.tmpdir(), 'ca-wotc-xml');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const xmlFilePath = path.join(tmpDir, `CA_WOTC_Batch_${Date.now()}.xml`);
      fs.writeFileSync(xmlFilePath, xmlContent, 'utf-8');

      // 1. NAVIGATE TO PORTAL
      console.log('[CA Bot] Navigating to portal:', portalUrl);
      await this.page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.humanDelay(2000, 4000);

      let ss = await this.takeScreenshot('01_landing');
      if (ss) screenshots.push(ss);

      // 2. LOGIN IF NEEDED
      const loginInputs = await this.page.$$("input[id*='username' i], input[id*='user' i], input[name*='username' i]");
      if (loginInputs.length > 0) {
        console.log('[CA Bot] Login page detected. Logging in...');

        const usernameInput = loginInputs[0];
        await usernameInput.click();
        await usernameInput.fill('');
        for (const char of credentials.username) {
          await this.page.keyboard.type(char, { delay: Math.random() * 60 + 20 });
        }
        await this.humanDelay(400, 800);

        const passwordInput = await this.page.waitForSelector("input[type='password']", { timeout: 10000 });
        if (passwordInput) {
          await passwordInput.click();
          await passwordInput.fill('');
          for (const char of credentials.password) {
            await this.page.keyboard.type(char, { delay: Math.random() * 60 + 20 });
          }
          await this.humanDelay(400, 800);
        }

        // Click Login button
        try {
          const loginBtn = await this.page.$("button:has-text('Log In'), input[value='Log In'], button[type='submit'], input[type='submit']");
          if (loginBtn) {
            await loginBtn.click();
          } else {
            await this.page.keyboard.press('Enter');
          }
        } catch {
          await this.page.keyboard.press('Enter');
        }

        await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        await this.humanDelay(3000, 5000);

        ss = await this.takeScreenshot('02_post_login');
        if (ss) screenshots.push(ss);
      } else {
        console.log('[CA Bot] Already logged in (login box not found).');
      }

      // 3. NAVIGATE TO "Submit Multiple Applications"
      console.log('[CA Bot] Looking for "Submit Multiple Applications" link...');

      const submitLink = await this.page.waitForSelector(
        "a:has-text('Submit Multiple Applications'), a[href*='multiple'], a[href*='batch'], a[href*='upload']",
        { timeout: 30000 }
      ).catch(() => null);

      if (submitLink) {
        console.log('[CA Bot] Found link. Clicking...');
        await this.humanDelay(300, 700);
        await submitLink.click();
        await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
        await this.humanDelay(2000, 4000);
      } else {
        // Debug: list all links on the page
        const allLinks = await this.page.$$eval('a', links =>
          links.map(l => ({ text: l.textContent?.trim() || '', href: l.href || '' }))
        );
        console.log('[CA Bot] Available links:', JSON.stringify(allLinks.slice(0, 20)));

        // Try partial text match as fallback
        const fallbackLink = await this.page.$("a:has-text('Multiple'), a:has-text('Batch'), a:has-text('Bulk')");
        if (fallbackLink) {
          await fallbackLink.click();
          await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
          await this.humanDelay(2000, 4000);
        } else {
          ss = await this.takeScreenshot('03_nav_failed');
          if (ss) screenshots.push(ss);
          result.message = 'Could not find "Submit Multiple Applications" link on dashboard';
          result.screenshotPaths = screenshots;
          return result;
        }
      }

      ss = await this.takeScreenshot('04_upload_page');
      if (ss) screenshots.push(ss);

      // 4. UPLOAD XML FILE
      console.log('[CA Bot] Uploading XML file:', xmlFilePath);

      const fileInput = await this.page.waitForSelector("input[type='file']", { timeout: 15000 }).catch(() => null);
      if (!fileInput) {
        result.message = 'Could not find file input. Login may have failed or navigation timed out.';
        result.screenshotPaths = screenshots;
        return result;
      }

      await fileInput.setInputFiles(xmlFilePath);
      await this.humanDelay(800, 1500);

      // Click Upload button
      const uploadBtn = await this.page.$(
        "input[value='Upload'], button:has-text('Upload'), #btnUpload, button[type='submit']:has-text('Upload')"
      );
      if (uploadBtn) {
        await uploadBtn.click();
      } else {
        // Try any submit button on the form
        const anySubmit = await this.page.$("button[type='submit'], input[type='submit']");
        if (anySubmit) await anySubmit.click();
      }

      // 5. WAIT FOR VALIDATION RESULTS
      console.log('[CA Bot] Waiting for validation results...');
      await this.page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
      await this.humanDelay(3000, 5000);

      // Wait for either error container or success receipt to appear
      await this.page.waitForSelector('#FormValidation, #lblMessage, p:has-text("accepted"), p:has-text("rejected")', {
        timeout: 30000,
      }).catch(() => {});
      await this.humanDelay(1000, 2000);

      ss = await this.takeScreenshot('05_results');
      if (ss) screenshots.push(ss);

      // Check for errors (#FormValidation > ul > li)
      const errorElements = await this.page.$$('#FormValidation > ul > li');
      if (errorElements.length > 0) {
        console.log('[CA Bot] ERRORS DETECTED!');
        for (const errEl of errorElements) {
          const errText = await errEl.textContent();
          if (errText) result.errors.push(errText.trim());
        }
        result.message = `Errors detected: ${result.errors.length} validation error(s)`;
        result.screenshotPaths = screenshots;
        return result;
      }

      // SUCCESS: Capture receipt
      console.log('[CA Bot] SUCCESS: Capturing receipt...');
      await this.humanDelay(1500, 2500);

      let fullMsg = '';

      // Batch ID / main message (#lblMessage)
      const receiptEl = await this.page.$('#lblMessage');
      if (receiptEl) {
        const receiptText = await receiptEl.textContent();
        if (receiptText) {
          fullMsg += receiptText.trim();
          // Try to extract batch ID from text
          const batchIdMatch = receiptText.match(/batch\s*(?:id|#|number)?\s*:?\s*(\S+)/i);
          if (batchIdMatch) result.batchId = batchIdMatch[1];
        }
      }

      // Accepted count
      const acceptEl = await this.page.$("p:has-text('successfully accepted'), span:has-text('accepted')");
      if (acceptEl) {
        const acceptText = await acceptEl.textContent();
        if (acceptText) {
          fullMsg += '\n' + acceptText.trim();
          const numMatch = acceptText.match(/(\d+)/);
          if (numMatch) result.accepted = parseInt(numMatch[1], 10);
        }
      }

      // Rejected count
      const rejectEl = await this.page.$("p:has-text('rejected'), span:has-text('rejected')");
      if (rejectEl) {
        const rejectText = await rejectEl.textContent();
        if (rejectText) {
          fullMsg += '\n' + rejectText.trim();
          const numMatch = rejectText.match(/(\d+)/);
          if (numMatch) result.rejected = parseInt(numMatch[1], 10);
        }
      }

      // Application details table (EIN + SSN)
      const dataRows = await this.page.$$('table tr:has(td)');
      if (dataRows.length > 0) {
        fullMsg += '\n\n--- APPLICATION DETAILS ---';
        for (const row of dataRows) {
          const cells = await row.$$('td');
          if (cells.length >= 2) {
            const ein = (await cells[0].textContent())?.trim() || '';
            const ssn = (await cells[1].textContent())?.trim() || '';
            fullMsg += `\nEIN: ${ein}  |  SSN: ${ssn}`;
            result.applicationDetails.push({ ein, ssn });
          }
        }
      }

      result.receiptText = fullMsg;
      result.success = true;
      result.message = fullMsg || 'File submitted successfully';

      ss = await this.takeScreenshot('06_receipt');
      if (ss) screenshots.push(ss);

      // Cleanup temp XML file
      try { fs.unlinkSync(xmlFilePath); } catch {}

    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error('[CA Bot] Error:', errMsg);
      result.message = `Automation error: ${errMsg}`;
      const ss = await this.takeScreenshot('error');
      if (ss) screenshots.push(ss);
    }

    result.screenshotPaths = screenshots;
    return result;
  }

  async submitMultipleBatches(
    portalUrl: string,
    credentials: CaliforniaCredentials,
    xmlBatches: Array<{ xmlContent: string; fileName: string }>
  ): Promise<CaliforniaBotResult[]> {
    const results: CaliforniaBotResult[] = [];

    for (const batch of xmlBatches) {
      console.log(`[CA Bot] Submitting batch: ${batch.fileName}`);
      const batchResult = await this.submit(portalUrl, credentials, batch.xmlContent);
      results.push(batchResult);

      if (!batchResult.success && batchResult.errors.length > 0) {
        console.log(`[CA Bot] Batch ${batch.fileName} had errors, stopping further submissions`);
        break;
      }

      // Wait between batches
      if (xmlBatches.indexOf(batch) < xmlBatches.length - 1) {
        await this.humanDelay(3000, 5000);
      }
    }

    return results;
  }
}
