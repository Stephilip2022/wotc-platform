/**
 * MFA Token Handler
 * Generates and validates MFA tokens for state portal automation
 */

import { TOTP } from 'otpauth';

/**
 * Generate a TOTP token from a secret
 * @param secret - Base32 encoded TOTP secret
 * @returns 6-digit TOTP token
 */
export function generateTOTPToken(secret: string): string {
  try {
    const totp = new TOTP({
      issuer: 'Rockerbox',
      label: 'State Portal',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret,
    });
    
    return totp.generate();
  } catch (error) {
    console.error('TOTP generation failed:', error);
    throw new Error('Failed to generate MFA token');
  }
}

/**
 * Validate a TOTP token against a secret
 * @param token - 6-digit token to validate
 * @param secret - Base32 encoded TOTP secret
 * @param window - Number of time steps to check (allows for clock drift)
 * @returns boolean indicating if token is valid
 */
export function validateTOTPToken(token: string, secret: string, window: number = 1): boolean {
  try {
    const totp = new TOTP({
      issuer: 'Rockerbox',
      label: 'State Portal',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret,
    });
    
    // Validate with time window to account for clock drift
    const delta = totp.validate({ token, window });
    return delta !== null;
  } catch (error) {
    console.error('TOTP validation failed:', error);
    return false;
  }
}

/**
 * Generate a new TOTP secret
 * @returns Base32 encoded secret
 */
export function generateTOTPSecret(): string {
  const totp = new TOTP({
    issuer: 'Rockerbox',
    label: 'State Portal',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  
  return totp.secret.base32;
}

/**
 * Generate backup codes for MFA
 * @param count - Number of backup codes to generate
 * @returns Array of backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  
  return codes;
}

/**
 * Get MFA token based on MFA type
 * @param mfaType - Type of MFA ('totp', 'sms', 'email', 'authenticator_app')
 * @param mfaSecret - Encrypted MFA secret (for TOTP)
 * @param backupCodes - Array of backup codes (optional fallback)
 * @returns MFA token or null if not available
 */
export async function getMFAToken(
  mfaType: string | null,
  mfaSecret: string | null,
  backupCodes?: string[] | null
): Promise<string | null> {
  if (!mfaType) return null;
  
  switch (mfaType.toLowerCase()) {
    case 'totp':
    case 'authenticator_app':
      if (mfaSecret) {
        return generateTOTPToken(mfaSecret);
      }
      break;
      
    case 'sms':
    case 'email':
      // For SMS/Email MFA, we would need manual intervention or integration with SMS/email provider
      console.warn(`${mfaType} MFA requires manual token entry or external integration`);
      return null;
      
    default:
      console.warn(`Unknown MFA type: ${mfaType}`);
      return null;
  }
  
  return null;
}
