/**
 * Playwright State Portal Automation Bot
 * 
 * Handles automated login and CSV bulk upload to state WOTC portals
 * using Playwright browser automation with human-like pacing.
 * 
 * Texas portal: Appian Cloud (twcgov.appiancloud.us) with Okta SSO
 */

import { chromium, type Browser, type BrowserContext, type Page, type Download } from 'playwright';
import type { StatePortalConfig } from '@shared/schema';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface BotResult {
  success: boolean;
  message: string;
  confirmationNumbers?: string[];
  errors?: string[];
  screenshotPaths?: string[];
  errorFileData?: Buffer;
  incompleteSSNs?: string[];
  submittedCount?: number;
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function humanDelay(page: Page, minMs = 800, maxMs = 2500): Promise<void> {
  await page.waitForTimeout(randomDelay(minMs, maxMs));
}

async function humanType(page: Page, selector: string, text: string): Promise<void> {
  const el = await page.waitForSelector(selector, { timeout: 15000 });
  if (!el) throw new Error(`Element not found: ${selector}`);
  await el.click();
  await humanDelay(page, 200, 500);
  for (const char of text) {
    await page.keyboard.type(char, { delay: randomDelay(50, 150) });
  }
}

async function takeScreenshot(page: Page, label: string): Promise<string> {
  const dir = path.join(os.tmpdir(), 'wotc-screenshots');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${label}_${Date.now()}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

/**
 * Main Playwright bot class for state portal automation
 */
export class StatePortalBot {
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
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
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

  async submitBulkCSV(
    config: StatePortalConfig,
    csvContent: string,
    employerCount: number
  ): Promise<BotResult> {
    if (!this.page) {
      throw new Error('Bot not initialized. Call initialize() first.');
    }

    try {
      const certlinkStates = ['AZ', 'IL', 'KS', 'ME'];
      const upperCode = config.stateCode.toUpperCase();

      if (certlinkStates.includes(upperCode)) {
        return await this.submitCertLinkPortal(config, csvContent, employerCount);
      }

      switch (upperCode) {
        case 'TX':
          return await this.submitTexasPortal(config, csvContent, employerCount);
        case 'CA':
          return await this.submitCaliforniaPortal(config, csvContent, employerCount);
        default:
          return {
            success: false,
            message: `Portal automation not yet implemented for ${config.stateCode}`,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Automation failed: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Handle Okta Multi-Factor Authentication
   */
  private async handleOktaMFA(config: StatePortalConfig): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      const mfaPrompt = await this.page.waitForSelector(
        'input[name="credentials.passcode"], input[name="verificationCode"], input[name="answer"], input[data-se="input-credentials.passcode"]',
        { timeout: 8000 }
      ).catch(() => null);

      if (!mfaPrompt) return;

      let mfaToken: string | null = null;

      const mfaType = config.mfaType || 'totp';
      if (mfaType === 'totp' || mfaType === 'authenticator_app') {
        if (config.mfaSecret) {
          const { generateTOTPToken } = await import('./mfaHandler');
          mfaToken = generateTOTPToken(config.mfaSecret);
        }
      }

      if (!mfaToken) {
        const backupCodes = config.mfaBackupCodes as string[] | null;
        if (backupCodes && Array.isArray(backupCodes) && backupCodes.length > 0) {
          mfaToken = backupCodes[0];
        }
      }

      if (mfaToken) {
        await humanType(this.page, 'input[name="credentials.passcode"], input[name="verificationCode"], input[name="answer"]', mfaToken);
        await humanDelay(this.page, 500, 1000);

        const verifyBtn = await this.page.waitForSelector(
          'input[value="Verify"], button:has-text("Verify"), input[type="submit"]',
          { timeout: 5000 }
        );
        await verifyBtn?.click();
        await this.page.waitForLoadState('networkidle', { timeout: 20000 });
      }
    } catch (error) {
      console.error('MFA handling failed:', error);
    }
  }

  /**
   * Texas WOTC Portal Automation (Appian Cloud + Okta SSO)
   * 
   * Flow:
   * 1. Navigate to Appian portal → redirects to Okta login
   * 2. Okta SSO: Username → Next → Password → Verify
   * 3. Handle MFA if required
   * 4. Navigate: "New WOTC Application" → "Submit a Bulk"
   * 5. Upload CSV file
   * 6. Click Next → Wait for processing
   * 7. Handle error file download if incomplete applications exist
   * 8. Check certification checkboxes → Submit
   * 9. Capture confirmation
   */
  private async submitTexasPortal(
    config: StatePortalConfig,
    csvContent: string,
    employerCount: number
  ): Promise<BotResult> {
    if (!this.page) throw new Error('Page not initialized');

    const screenshots: string[] = [];
    const credentials = config.credentials as any;

    if (!credentials?.userId && !credentials?.username) {
      return { success: false, message: 'No credentials configured for Texas portal' };
    }

    const username = credentials.userId || credentials.username;
    const password = credentials.password;

    try {
      // ─── STEP 1: Navigate to Texas Appian portal ───
      console.log('[TX Bot] Navigating to Texas portal...');
      const portalUrl = config.portalUrl || 'https://twcgov.appiancloud.us/suite/sites/work-opportunity-tax-credit';
      await this.page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await humanDelay(this.page, 2000, 4000);
      screenshots.push(await takeScreenshot(this.page, 'tx_01_landing'));

      // ─── STEP 2: Okta SSO Login ───
      console.log('[TX Bot] Performing Okta SSO login...');

      // 2a. Enter username (Okta uses various input selectors)
      const usernameSelector = "input[name='identifier'], input[name='username'], input[id*='input'][type='text'], input[type='email']";
      await this.page.waitForSelector(usernameSelector, { timeout: 30000 });
      await humanDelay(this.page, 1000, 2000);
      await humanType(this.page, usernameSelector, username);
      await humanDelay(this.page, 500, 1500);

      // 2b. Click "Next" button
      const nextBtnSelector = "input[value='Next'], button:has-text('Next'), input[type='submit'][value='Next']";
      const nextBtn = await this.page.waitForSelector(nextBtnSelector, { timeout: 10000 });
      await nextBtn?.click();
      await humanDelay(this.page, 2000, 4000);
      screenshots.push(await takeScreenshot(this.page, 'tx_02_after_next'));

      // 2c. Enter password
      const passwordSelector = "input[name='credentials.passcode'], input[name='password'], input[id*='input'][type='password'], input[type='password']";
      await this.page.waitForSelector(passwordSelector, { timeout: 15000 });
      await humanDelay(this.page, 500, 1500);
      await humanType(this.page, passwordSelector, password);
      await humanDelay(this.page, 500, 1500);

      // 2d. Click "Verify" button
      const verifyBtnSelector = "input[value='Verify'], button:has-text('Verify'), input[value='Sign in'], input[type='submit']";
      const verifyBtn = await this.page.waitForSelector(verifyBtnSelector, { timeout: 10000 });
      await verifyBtn?.click();

      // Wait for login to complete
      await this.page.waitForLoadState('networkidle', { timeout: 45000 });
      await humanDelay(this.page, 3000, 5000);

      // ─── STEP 3: Handle MFA if needed ───
      if (config.mfaEnabled) {
        console.log('[TX Bot] Checking for MFA prompt...');
        await this.handleOktaMFA(config);
      }

      // Check for login errors
      const loginError = await this.page.locator("text=/invalid|incorrect|error|denied/i").count();
      if (loginError > 0) {
        screenshots.push(await takeScreenshot(this.page, 'tx_03_login_error'));
        return {
          success: false,
          message: 'Login failed - invalid credentials or account locked',
          screenshotPaths: screenshots,
        };
      }

      screenshots.push(await takeScreenshot(this.page, 'tx_03_logged_in'));
      console.log('[TX Bot] Login successful');

      // ─── STEP 4: Navigate to "New WOTC Application" ───
      console.log('[TX Bot] Navigating to New WOTC Application...');
      await humanDelay(this.page, 2000, 4000);

      const newAppSelector = "span:has-text('New WOTC Application'), a:has-text('New WOTC Application'), [aria-label*='New WOTC']";
      const newAppBtn = await this.page.waitForSelector(newAppSelector, { timeout: 30000 });
      if (!newAppBtn) throw new Error('Could not find "New WOTC Application" button');
      await humanDelay(this.page, 500, 1500);
      await newAppBtn.click();
      await humanDelay(this.page, 2000, 4000);
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });

      // ─── STEP 5: Select "Submit a Bulk" option ───
      console.log('[TX Bot] Selecting Bulk submission option...');
      const bulkSelector = "label:has-text('Submit a Bulk'), span:has-text('Submit a Bulk'), input[value*='Bulk'], [aria-label*='Bulk']";
      const bulkOption = await this.page.waitForSelector(bulkSelector, { timeout: 20000 });
      if (!bulkOption) throw new Error('Could not find "Submit a Bulk" option');
      await humanDelay(this.page, 500, 1200);
      await bulkOption.click();
      await humanDelay(this.page, 2000, 4000);
      screenshots.push(await takeScreenshot(this.page, 'tx_04_bulk_selected'));

      // ─── STEP 6: Upload CSV file ───
      console.log('[TX Bot] Uploading CSV file...');

      // Write CSV to temp file
      const tmpDir = path.join(os.tmpdir(), 'wotc-uploads');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
      const csvFilePath = path.join(tmpDir, `TX_WOTC_Upload_${Date.now()}.csv`);
      fs.writeFileSync(csvFilePath, csvContent, { encoding: 'ascii' });

      // Find the hidden file input (Appian hides it behind a drag-drop zone)
      const fileInput = await this.page.waitForSelector("input[type='file']", { timeout: 15000 });
      if (!fileInput) throw new Error('Could not find file upload input');
      await fileInput.setInputFiles(csvFilePath);
      await humanDelay(this.page, 3000, 5000);
      screenshots.push(await takeScreenshot(this.page, 'tx_05_file_uploaded'));

      // ─── STEP 7: Click Next ───
      console.log('[TX Bot] Clicking Next...');
      const nextAppianBtn = await this.page.waitForSelector(
        "button:has-text('Next'), input[value='Next']",
        { timeout: 15000 }
      );
      await humanDelay(this.page, 500, 1500);
      await nextAppianBtn?.click();
      await humanDelay(this.page, 8000, 12000);

      // Wait for processing (TX processes in batches of 200)
      const processingWait = Math.max(10000, Math.ceil(employerCount / 200) * 8000);
      await this.page.waitForLoadState('networkidle', { timeout: processingWait });
      screenshots.push(await takeScreenshot(this.page, 'tx_06_after_next'));

      // ─── STEP 8: Handle Incomplete Applications (Error File) ───
      console.log('[TX Bot] Checking for incomplete applications...');
      let errorFileData: Buffer | undefined;
      let incompleteSSNs: string[] = [];

      const generateBtn = await this.page.waitForSelector(
        "span:has-text('Generate Excel File'), button:has-text('Generate Excel'), a:has-text('Generate')",
        { timeout: 20000 }
      ).catch(() => null);

      if (generateBtn) {
        console.log('[TX Bot] Errors detected - downloading error file...');
        screenshots.push(await takeScreenshot(this.page, 'tx_07_errors_detected'));

        // Click Generate Excel using JavaScript (Appian sticky headers can intercept)
        await this.page.evaluate((el: any) => el.click(), generateBtn);
        await humanDelay(this.page, 3000, 6000);

        // Wait for download link and click it
        const downloadLink = await this.page.waitForSelector(
          "a:has-text('Download Incomplete Applications'), a[href*='download']",
          { timeout: 30000 }
        ).catch(() => null);

        if (downloadLink) {
          const [download] = await Promise.all([
            this.page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
            this.page.evaluate((el: any) => el.click(), downloadLink),
          ]);

          if (download) {
            const downloadPath = path.join(tmpDir, `TX_Errors_${Date.now()}.xlsx`);
            await download.saveAs(downloadPath);
            errorFileData = fs.readFileSync(downloadPath);
            console.log('[TX Bot] Error file downloaded');

            // Parse error file to get incomplete SSNs
            try {
              const XLSX = await import('xlsx');
              const workbook = XLSX.read(errorFileData, { type: 'buffer' });
              const sheet = workbook.Sheets[workbook.SheetNames[0]];
              const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
              incompleteSSNs = data
                .map((row: Record<string, any>) => String(row['SSN'] || row['ssn'] || '').trim())
                .filter((ssn: string) => ssn.length > 0);
              console.log(`[TX Bot] Found ${incompleteSSNs.length} incomplete SSNs`);
            } catch (parseError) {
              console.error('[TX Bot] Failed to parse error file:', parseError);
            }
          }
        }
        await humanDelay(this.page, 2000, 4000);
      } else {
        console.log('[TX Bot] No errors detected - clean upload');
      }

      // ─── STEP 9: Submit or Cancel ───
      const submitBtn = await this.page.waitForSelector(
        "button:has-text('Submit'), input[value='Submit']",
        { timeout: 10000 }
      ).catch(() => null);

      if (submitBtn) {
        // Valid applications exist - check certification boxes first
        console.log('[TX Bot] Checking certification checkboxes...');
        const checkboxLabels = await this.page.$$("div[class*='FieldLayout'] label, input[type='checkbox']");

        for (const cb of checkboxLabels) {
          const isVisible = await cb.isVisible();
          const isEnabled = await cb.isEnabled();
          if (isVisible && isEnabled) {
            await cb.click();
            await humanDelay(this.page, 200, 500);
          }
        }
        await humanDelay(this.page, 1000, 2000);
        screenshots.push(await takeScreenshot(this.page, 'tx_08_checkboxes_checked'));

        // Click Submit
        console.log('[TX Bot] Submitting...');
        await submitBtn.click();
        await this.page.waitForLoadState('networkidle', { timeout: 45000 });
        await humanDelay(this.page, 3000, 5000);
        screenshots.push(await takeScreenshot(this.page, 'tx_09_submitted'));

        // Look for confirmation
        const bodyText = await this.page.textContent('body') || '';
        const confirmPatterns = [
          /claim number range:\s*([\d-]+\s*(?:to|through)\s*[\d-]+)/i,
          /confirmation.*?number[s]?:?\s*([\d-]+(?:\s*(?:to|through)\s*[\d-]+)?)/i,
          /successfully.*?submitted.*?(\d+)\s*applications?/i,
          /batch.*?number[s]?:?\s*([\w-]+)/i,
        ];

        for (const pattern of confirmPatterns) {
          const match = bodyText.match(pattern);
          if (match) {
            console.log(`[TX Bot] Confirmation found: ${match[1]}`);
            return {
              success: true,
              message: `Texas bulk upload successful. ${match[0]}`,
              confirmationNumbers: [match[1]],
              screenshotPaths: screenshots,
              errorFileData,
              incompleteSSNs: incompleteSSNs.length > 0 ? incompleteSSNs : undefined,
              submittedCount: employerCount - incompleteSSNs.length,
            };
          }
        }

        // Success without specific confirmation number
        const successIndicators = await this.page.locator("text=/success|submitted|complete|received/i").count();
        if (successIndicators > 0) {
          return {
            success: true,
            message: 'Texas bulk upload completed successfully',
            screenshotPaths: screenshots,
            errorFileData,
            incompleteSSNs: incompleteSSNs.length > 0 ? incompleteSSNs : undefined,
            submittedCount: employerCount - incompleteSSNs.length,
          };
        }

        return {
          success: true,
          message: 'Upload submitted but explicit confirmation not detected - verify in portal',
          screenshotPaths: screenshots,
          errorFileData,
          incompleteSSNs: incompleteSSNs.length > 0 ? incompleteSSNs : undefined,
          submittedCount: employerCount - incompleteSSNs.length,
        };

      } else {
        // No submit button = 100% errors
        console.log('[TX Bot] No Submit button found - all applications had errors');
        const cancelBtn = await this.page.waitForSelector(
          "span:has-text('Cancel'), button:has-text('Cancel')",
          { timeout: 10000 }
        ).catch(() => null);

        if (cancelBtn) {
          await cancelBtn.click();
          await humanDelay(this.page, 2000, 4000);
        }

        return {
          success: false,
          message: 'All applications had errors - submission cancelled',
          errors: ['100% of applications were incomplete or had errors'],
          screenshotPaths: screenshots,
          errorFileData,
          incompleteSSNs: incompleteSSNs.length > 0 ? incompleteSSNs : undefined,
          submittedCount: 0,
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[TX Bot] Error:', errorMessage);
      try {
        screenshots.push(await takeScreenshot(this.page!, 'tx_error'));
      } catch {}

      return {
        success: false,
        message: `Texas portal automation failed: ${errorMessage}`,
        errors: [errorMessage],
        screenshotPaths: screenshots,
      };
    } finally {
      // Cleanup temp files (screenshots stay for audit)
      const tmpDir = path.join(os.tmpdir(), 'wotc-uploads');
      try {
        const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.csv'));
        for (const f of files) {
          try { fs.unlinkSync(path.join(tmpDir, f)); } catch {}
        }
      } catch {}
    }
  }

  /**
   * California EDD WOTC Portal Automation
   * 
   * Delegates to the dedicated CaliforniaBot for the full flow:
   *   1. Login (username/password via EDD portal)
   *   2. Navigate to "Submit Multiple Applications"
   *   3. Upload XML file
   *   4. Parse validation results (errors, receipt, accepted/rejected counts)
   */
  private async submitCaliforniaPortal(
    config: StatePortalConfig,
    xmlContent: string,
    employerCount: number
  ): Promise<BotResult> {
    const californiaModule = await import('./californiaBot');

    const credentials = config.credentials as any;
    if (!credentials?.username && !credentials?.email && !credentials?.userId) {
      return { success: false, message: 'No credentials configured for California EDD portal' };
    }

    const caCreds: californiaModule.CaliforniaCredentials = {
      username: credentials.username || credentials.email || credentials.userId,
      password: credentials.password,
    };

    const portalUrl = config.portalUrl || 'https://eddservices.edd.ca.gov/wotc/';

    const bot = new californiaModule.CaliforniaBot();
    try {
      await bot.initialize();
      const result = await bot.submit(portalUrl, caCreds, xmlContent);

      return {
        success: result.success,
        message: result.message,
        screenshotPaths: result.screenshotPaths,
        submittedCount: result.accepted,
        errors: result.errors.length > 0 ? result.errors : undefined,
      };
    } finally {
      await bot.close();
    }
  }

  /**
   * CertLink Portal Automation (AZ, IL, KS, ME)
   * 
   * Delegates to the dedicated CertLinkBot for the full flow:
   *   1. Login (Email/Password/Agreement → Dashboard)
   *   2. Batch CSV upload with error parsing and retry (up to 3 attempts)
   *   3. Signator fix logic for POA errors
   */
  private async submitCertLinkPortal(
    config: StatePortalConfig,
    csvContent: string,
    employerCount: number
  ): Promise<BotResult> {
    const certlinkModule = await import('./certlinkBot');
    const { getCertLinkPortalUrl } = await import('./certlinkCsvGenerator');

    const stateCode = config.stateCode.toUpperCase();
    const credentials = config.credentials as any;

    if (!credentials?.email && !credentials?.username && !credentials?.userId) {
      return { success: false, message: `No credentials configured for ${stateCode} CertLink portal` };
    }

    const certlinkCreds = {
      email: credentials.email || credentials.username || credentials.userId,
      password: credentials.password,
    };

    const portalUrl = config.portalUrl || getCertLinkPortalUrl(stateCode);
    const stateName = config.stateName || stateCode;

    const bot = new certlinkModule.CertLinkBot();
    try {
      await bot.initialize();
      const result = await bot.runState(portalUrl, certlinkCreds, csvContent, stateCode, stateName);

      return {
        success: result.success,
        message: result.message,
        screenshotPaths: result.screenshotPaths,
        submittedCount: result.recordsSubmitted,
        errors: result.rejectedRows.length > 0
          ? result.rejectedRows.map(r => `Row ${r.rowNumber}: ${r.errorMessage} (${r.fieldName})`)
          : undefined,
      };
    } finally {
      await bot.close();
    }
  }

  /**
   * Capture determinations from Texas portal
   * Scrapes determination results and returns them for database update
   */
  async captureDeterminations(config: StatePortalConfig): Promise<BotResult & { determinations?: Array<{ ssn: string; status: string; claimNumber?: string; determinationDate?: string }> }> {
    if (!this.page) throw new Error('Page not initialized');

    const screenshots: string[] = [];
    const credentials = config.credentials as any;
    const username = credentials?.userId || credentials?.username;
    const password = credentials?.password;

    if (!username || !password) {
      return { success: false, message: 'No credentials configured for Texas portal' };
    }

    try {
      // Login using Okta flow
      const portalUrl = config.portalUrl || 'https://twcgov.appiancloud.us/suite/sites/work-opportunity-tax-credit';
      await this.page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await humanDelay(this.page, 2000, 4000);

      // Okta login
      const usernameSelector = "input[name='identifier'], input[name='username'], input[id*='input'][type='text'], input[type='email']";
      await this.page.waitForSelector(usernameSelector, { timeout: 30000 });
      await humanType(this.page, usernameSelector, username);
      await humanDelay(this.page, 500, 1500);

      const nextBtn = await this.page.waitForSelector("input[value='Next'], button:has-text('Next')", { timeout: 10000 });
      await nextBtn?.click();
      await humanDelay(this.page, 2000, 4000);

      const passwordSelector = "input[name='credentials.passcode'], input[type='password']";
      await this.page.waitForSelector(passwordSelector, { timeout: 15000 });
      await humanType(this.page, passwordSelector, password);
      await humanDelay(this.page, 500, 1500);

      const verifyBtn = await this.page.waitForSelector("input[value='Verify'], button:has-text('Verify'), input[type='submit']", { timeout: 10000 });
      await verifyBtn?.click();
      await this.page.waitForLoadState('networkidle', { timeout: 45000 });
      await humanDelay(this.page, 3000, 5000);

      if (config.mfaEnabled) await this.handleOktaMFA(config);

      screenshots.push(await takeScreenshot(this.page, 'tx_det_01_logged_in'));
      console.log('[TX Bot] Logged in for determination capture');

      // Navigate to determinations/status page
      const statusSelectors = [
        "span:has-text('Application Status')",
        "a:has-text('View Status')",
        "span:has-text('Determinations')",
        "a:has-text('Determination')",
        "span:has-text('Status')",
      ];

      let statusNav = null;
      for (const sel of statusSelectors) {
        statusNav = await this.page.$(sel);
        if (statusNav) break;
      }

      if (!statusNav) {
        screenshots.push(await takeScreenshot(this.page, 'tx_det_02_no_status_nav'));
        return {
          success: false,
          message: 'Could not find determination/status section in Texas portal',
          screenshotPaths: screenshots,
        };
      }

      await humanDelay(this.page, 500, 1500);
      await statusNav.click();
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });
      await humanDelay(this.page, 2000, 4000);
      screenshots.push(await takeScreenshot(this.page, 'tx_det_02_status_page'));

      // Try to download determination report if available
      const downloadReportBtn = await this.page.$(
        "a:has-text('Download'), button:has-text('Export'), span:has-text('Generate Report'), a:has-text('Report')"
      );

      const determinations: Array<{ ssn: string; status: string; claimNumber?: string; determinationDate?: string }> = [];

      if (downloadReportBtn) {
        const [download] = await Promise.all([
          this.page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
          downloadReportBtn.click(),
        ]);

        if (download) {
          const downloadPath = path.join(os.tmpdir(), 'wotc-uploads', `TX_Determinations_${Date.now()}.xlsx`);
          await download.saveAs(downloadPath);
          const fileData = fs.readFileSync(downloadPath);

          try {
            const XLSX = await import('xlsx');
            const workbook = XLSX.read(fileData, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

            for (const row of data) {
              const ssn = String(row['SSN'] || row['ssn'] || row['Employee SSN'] || '').trim();
              const status = String(row['Status'] || row['Determination'] || row['Result'] || '').trim();
              const claimNumber = String(row['Claim Number'] || row['Claim #'] || row['ClaimNumber'] || '').trim();
              const determinationDate = String(row['Date'] || row['Determination Date'] || '').trim();

              if (ssn) {
                determinations.push({
                  ssn,
                  status: status || 'Unknown',
                  claimNumber: claimNumber || undefined,
                  determinationDate: determinationDate || undefined,
                });
              }
            }
          } catch (parseErr) {
            console.error('[TX Bot] Failed to parse determination file:', parseErr);
          }
        }
      } else {
        // Scrape determinations from the page table
        console.log('[TX Bot] Attempting to scrape determinations from page...');
        const rows = await this.page.$$('table tbody tr, [role="row"]');

        for (const row of rows) {
          const cells = await row.$$('td, [role="cell"]');
          if (cells.length >= 3) {
            const cellTexts = await Promise.all(cells.map(c => c.textContent()));
            const ssn = cellTexts.find(t => t && /\d{3}-?\d{2}-?\d{4}/.test(t))?.trim() || '';
            const status = cellTexts.find(t => t && /certified|denied|pending|approved/i.test(t))?.trim() || '';

            if (ssn) {
              determinations.push({
                ssn: ssn.replace(/[^0-9]/g, ''),
                status: status || 'Unknown',
              });
            }
          }
        }
      }

      screenshots.push(await takeScreenshot(this.page, 'tx_det_03_results'));
      console.log(`[TX Bot] Captured ${determinations.length} determinations`);

      return {
        success: determinations.length > 0,
        message: determinations.length > 0
          ? `Captured ${determinations.length} determinations from Texas portal`
          : 'No determinations found in Texas portal',
        screenshotPaths: screenshots,
        determinations,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      try { screenshots.push(await takeScreenshot(this.page!, 'tx_det_error')); } catch {}
      return {
        success: false,
        message: `Determination capture failed: ${errorMessage}`,
        errors: [errorMessage],
        screenshotPaths: screenshots,
      };
    }
  }

  /**
   * Test portal credentials (login only, no submission)
   */
  async testCredentials(config: StatePortalConfig): Promise<BotResult> {
    if (!this.page) throw new Error('Page not initialized');

    const credentials = config.credentials as any;
    const username = credentials?.userId || credentials?.username;
    const password = credentials?.password;

    if (!username || !password) {
      return { success: false, message: 'No credentials configured' };
    }

    try {
      const portalUrl = config.portalUrl || '';
      await this.page.goto(portalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await humanDelay(this.page, 1000, 3000);

      // Okta flow for Texas
      if (config.stateCode === 'TX') {
        const usernameSelector = "input[name='identifier'], input[name='username'], input[type='text'], input[type='email']";
        await this.page.waitForSelector(usernameSelector, { timeout: 20000 });
        await humanType(this.page, usernameSelector, username);

        const nextBtn = await this.page.waitForSelector("input[value='Next'], button:has-text('Next')", { timeout: 10000 });
        await nextBtn?.click();
        await humanDelay(this.page, 2000, 4000);

        await this.page.waitForSelector("input[type='password']", { timeout: 15000 });
        await humanType(this.page, "input[type='password']", password);

        const verifyBtn = await this.page.waitForSelector("input[value='Verify'], button:has-text('Verify'), input[type='submit']", { timeout: 10000 });
        await verifyBtn?.click();
      } else {
        // Generic login flow
        await this.page.fill("input[name='username'], #username", username);
        await this.page.fill("input[name='password'], #password", password);
        await this.page.click("button[type='submit'], input[type='submit']");
      }

      await this.page.waitForLoadState('networkidle', { timeout: 30000 });
      await humanDelay(this.page, 2000, 4000);

      const hasError = await this.page.locator("text=/invalid|incorrect|error|denied|failed/i").count();
      if (hasError > 0) {
        return { success: false, message: 'Invalid credentials' };
      }

      return { success: true, message: 'Credentials validated successfully' };
    } catch (error) {
      return {
        success: false,
        message: `Credential test failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

/**
 * Create and initialize a new bot instance
 */
export async function createBot(): Promise<StatePortalBot> {
  const bot = new StatePortalBot();
  await bot.initialize();
  return bot;
}
