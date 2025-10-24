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
      // Navigate to portal
      await this.page.goto(config.portalUrl);
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Login
      await this.page.fill('input[name="username"]', credentials.username || '');
      await this.page.fill('input[name="password"]', credentials.password || '');
      await this.page.click('button[type="submit"]');
      await this.page.waitForNavigation({ timeout: 30000 });
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Navigate to bulk upload
      await this.page.click('text=Submit a Bulk File');
      await this.page.waitForTimeout(2000);

      // Upload CSV file
      const fileInput = await this.page.locator('input[type="file"]');
      
      // Create a temporary file buffer for upload
      const buffer = Buffer.from(csvContent, 'utf-8');
      await fileInput.setInputFiles({
        name: `wotc_bulk_${Date.now()}.csv`,
        mimeType: 'text/csv',
        buffer,
      });

      // Wait for file processing
      await this.page.waitForTimeout(5000);
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Click Next button
      await this.page.click('button:has-text("NEXT")');
      
      // Wait for processing (Texas processes in batches of 200)
      const estimatedSeconds = Math.ceil(employerCount / 200) * 10;
      await this.page.waitForTimeout(estimatedSeconds * 1000);

      // Check for incomplete applications
      const incompleteSection = await this.page.locator('.incomplete-applications, [class*="incomplete"]').count();
      if (incompleteSection > 0) {
        // Download incomplete applications report
        const downloadPromise = this.page.waitForEvent('download');
        await this.page.click('text=GENERATE EXCEL FILE');
        const download = await downloadPromise;
        
        return {
          success: false,
          message: 'Some applications were incomplete',
          errors: ['Incomplete applications detected - review downloaded Excel file'],
          screenshots,
        };
      }

      // Accept electronic agreement
      await this.page.check('input[type="checkbox"]:nth-of-type(1)');
      await this.page.check('input[type="checkbox"]:nth-of-type(2)');

      // Submit
      await this.page.click('button:has-text("SUBMIT")');
      await this.page.waitForTimeout(3000);
      screenshots.push(await this.page.screenshot({ encoding: 'base64' }));

      // Look for confirmation
      const confirmationText = await this.page.textContent('body');
      const confirmationMatch = confirmationText?.match(/claim number range:\s*([\d-]+\s*to\s*[\d-]+)/i);
      
      if (confirmationMatch) {
        return {
          success: true,
          message: 'Texas bulk upload successful',
          confirmationNumbers: [confirmationMatch[1]],
          screenshots,
        };
      }

      return {
        success: true,
        message: 'Upload completed but confirmation number not found',
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
