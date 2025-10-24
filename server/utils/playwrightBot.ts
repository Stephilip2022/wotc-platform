/**
 * Playwright State Portal Automation Bot
 * 
 * Handles automated login and CSV bulk upload to state WOTC portals
 * using Playwright browser automation.
 */

import { chromium, type Browser, type Page } from 'playwright';
import type { StatePortalConfig } from '@shared/schema';

interface BotResult {
  success: boolean;
  message: string;
  confirmationNumbers?: string[];
  errors?: string[];
  screenshots?: string[];
}

/**
 * Main Playwright bot class for state portal automation
 */
export class StatePortalBot {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * Initialize browser instance
   */
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.page = await this.browser.newPage();
    
    // Set viewport
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
  }

  /**
   * Submit bulk CSV to state portal
   */
  async submitBulkCSV(
    config: StatePortalConfig,
    csvContent: string,
    employerCount: number
  ): Promise<BotResult> {
    if (!this.page) {
      throw new Error('Bot not initialized. Call initialize() first.');
    }

    try {
      switch (config.stateCode.toUpperCase()) {
        case 'TX':
          return await this.submitTexasPortal(config, csvContent, employerCount);
        case 'AZ':
          return await this.submitArizonaPortal(config, csvContent, employerCount);
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
   * Texas WOTC OLS Portal automation
   * Updated with resilient selectors and explicit waits
   */
  private async submitTexasPortal(
    config: StatePortalConfig,
    csvContent: string,
    employerCount: number
  ): Promise<BotResult> {
    if (!this.page) throw new Error('Page not initialized');

    const screenshots: string[] = [];
    const credentials = config.credentials as any;

    try {
      // Navigate to portal with wait for network idle
      await this.page.goto(config.portalUrl, { waitUntil: 'networkidle' });
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Login with explicit waits
      const usernameInput = await this.page.waitForSelector('input[name="username"], input[id="username"], #loginUsername', { timeout: 10000 });
      const passwordInput = await this.page.waitForSelector('input[name="password"], input[id="password"], #loginPassword', { timeout: 10000 });
      
      if (!usernameInput || !passwordInput) {
        throw new Error('Login form not found - portal structure may have changed');
      }

      await usernameInput.fill(credentials.username || '');
      await passwordInput.fill(credentials.password || '');
      
      const submitButton = await this.page.waitForSelector('button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      await submitButton?.click();
      
      // Wait for navigation and check for login errors
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });
      
      const loginError = await this.page.locator('text=/invalid.*credentials|incorrect.*password|login.*failed/i').count();
      if (loginError > 0) {
        throw new Error('Invalid credentials - login failed');
      }
      
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Navigate to bulk upload with resilient selector
      const bulkUploadLink = await this.page.waitForSelector('a:has-text("Submit a Bulk File"), button:has-text("Bulk Upload"), [data-testid="bulk-upload"]', { timeout: 15000 });
      await bulkUploadLink?.click();
      await this.page.waitForLoadState('networkidle');

      // Upload CSV file with explicit wait for file input
      const fileInput = await this.page.waitForSelector('input[type="file"]', { timeout: 10000 });
      
      if (!fileInput) {
        throw new Error('File upload input not found');
      }
      
      const buffer = Buffer.from(csvContent, 'utf-8');
      await fileInput.setInputFiles({
        name: `wotc_bulk_${Date.now()}.csv`,
        mimeType: 'text/csv',
        buffer,
      });

      // Wait for file to be processed (look for next button to become enabled)
      await this.page.waitForSelector('button:has-text("NEXT"):not([disabled])', { timeout: 15000 });
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Click Next button
      const nextButton = await this.page.waitForSelector('button:has-text("NEXT"), button:has-text("Next")');
      await nextButton?.click();
      
      // Wait for processing page to load (Texas processes in batches of 200)
      await this.page.waitForLoadState('networkidle');
      
      // Wait for processing indicator to disappear or results to appear
      try {
        await this.page.waitForSelector('.processing, [data-loading="true"]', { state: 'hidden', timeout: Math.ceil(employerCount / 200) * 10000 });
      } catch {
        // Processing indicator may not exist, continue
      }

      // Check for incomplete applications section
      const incompleteSection = await this.page.locator('.incomplete-applications, [data-section="incomplete"], text=/incomplete.*applications/i').count();
      if (incompleteSection > 0) {
        screenshots.push(await this.page.screenshot({ encoding: 'base64' }));
        
        // Try to download incomplete applications report
        try {
          const downloadPromise = this.page.waitForEvent('download', { timeout: 5000 });
          const generateButton = await this.page.waitForSelector('button:has-text("GENERATE EXCEL FILE"), button:has-text("Download")');
          await generateButton?.click();
          await downloadPromise;
        } catch {
          // Download may not be available
        }
        
        return {
          success: false,
          message: 'Some applications were incomplete - review incomplete applications section',
          errors: ['Incomplete applications detected'],
          screenshots,
        };
      }

      // Accept electronic agreement checkboxes
      const checkboxes = await this.page.locator('input[type="checkbox"]').all();
      if (checkboxes.length >= 2) {
        await checkboxes[0].check();
        await checkboxes[1].check();
      } else {
        throw new Error('Electronic agreement checkboxes not found');
      }

      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Submit with explicit wait
      const submitButton = await this.page.waitForSelector('button:has-text("SUBMIT"), button:has-text("Submit")');
      await submitButton?.click();
      
      // Wait for confirmation page
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Look for confirmation with multiple patterns
      const confirmationText = await this.page.textContent('body');
      const confirmationPatterns = [
        /claim number range:\s*([\d-]+\s*to\s*[\d-]+)/i,
        /confirmation.*number[s]?:\s*([\d-]+(?:\s*to\s*[\d-]+)?)/i,
        /successfully.*submitted.*(\d+)\s*applications?/i,
      ];
      
      for (const pattern of confirmationPatterns) {
        const match = confirmationText?.match(pattern);
        if (match) {
          return {
            success: true,
            message: 'Texas bulk upload successful',
            confirmationNumbers: [match[1]],
            screenshots,
          };
        }
      }

      // Check for success indicators even without specific confirmation number
      const successIndicator = await this.page.locator('text=/success|submitted|complete/i, .success, [data-status="success"]').count();
      if (successIndicator > 0) {
        return {
          success: true,
          message: 'Upload completed successfully',
          screenshots,
        };
      }

      return {
        success: false,
        message: 'Upload completed but success confirmation not found',
        screenshots,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));
      
      return {
        success: false,
        message: `Texas portal automation failed: ${errorMessage}`,
        errors: [errorMessage],
        screenshots,
      };
    }
  }

  /**
   * Arizona WOTC Portal automation
   */
  private async submitArizonaPortal(
    config: StatePortalConfig,
    csvContent: string,
    employerCount: number
  ): Promise<BotResult> {
    if (!this.page) throw new Error('Page not initialized');

    const screenshots: string[] = [];
    const credentials = config.credentials as any;

    try {
      // Navigate to portal
      await this.page.goto(config.portalUrl);
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Login (Arizona-specific selectors would go here)
      await this.page.fill('#username', credentials.username || '');
      await this.page.fill('#password', credentials.password || '');
      await this.page.click('button[type="submit"]');
      await this.page.waitForNavigation({ timeout: 30000 });
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Navigate to bulk upload section
      await this.page.click('text=Bulk Upload');
      await this.page.waitForTimeout(2000);

      // Upload CSV
      const fileInput = await this.page.locator('input[type="file"]');
      const buffer = Buffer.from(csvContent, 'utf-8');
      await fileInput.setInputFiles({
        name: `arizona_wotc_${Date.now()}.csv`,
        mimeType: 'text/csv',
        buffer,
      });

      // Wait and submit
      await this.page.waitForTimeout(3000);
      await this.page.click('button:has-text("Submit")');
      await this.page.waitForTimeout(5000);
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Check for success message
      const successMessage = await this.page.locator('text=/successfully|submitted|complete/i').count();
      
      if (successMessage > 0) {
        return {
          success: true,
          message: 'Arizona bulk upload successful',
          screenshots,
        };
      }

      return {
        success: false,
        message: 'Upload completed but success confirmation not found',
        screenshots,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));
      
      return {
        success: false,
        message: `Arizona portal automation failed: ${errorMessage}`,
        errors: [errorMessage],
        screenshots,
      };
    }
  }

  /**
   * Test portal credentials (login only, no submission)
   */
  async testCredentials(config: StatePortalConfig): Promise<BotResult> {
    if (!this.page) throw new Error('Page not initialized');

    try {
      const credentials = config.credentials as any;
      
      await this.page.goto(config.portalUrl);
      await this.page.fill('input[name="username"]', credentials.username || '');
      await this.page.fill('input[name="password"]', credentials.password || '');
      await this.page.click('button[type="submit"]');
      
      await this.page.waitForNavigation({ timeout: 15000 });
      
      // Check if login successful
      const hasError = await this.page.locator('text=/invalid|error|incorrect/i').count();
      
      if (hasError > 0) {
        return {
          success: false,
          message: 'Invalid credentials',
        };
      }

      return {
        success: true,
        message: 'Credentials valid',
      };
    } catch (error) {
      return {
        success: false,
        message: `Credential test failed: ${error}`,
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
