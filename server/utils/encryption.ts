import crypto from 'crypto';

// Use SESSION_SECRET as the encryption key base
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(process.env.SESSION_SECRET || 'default-key-for-development')
  .digest();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts sensitive text data using AES-256-GCM
 * @param text - Plain text to encrypt
 * @returns Encrypted data as base64 string (format: iv:authTag:encryptedData)
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Return as iv:authTag:encryptedData
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypts data encrypted with encrypt()
 * @param encryptedText - Encrypted string in format iv:authTag:encryptedData
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;
    
    const [ivBase64, authTagBase64, encryptedData] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return encryptedText; // Return as-is if decryption fails (handles legacy data)
  }
}

/**
 * Encrypts credentials object for storage
 * @param credentials - Object with userId and password
 * @returns Object with encrypted values
 */
export function encryptCredentials(credentials: { userId?: string; password?: string } | null) {
  if (!credentials) return null;
  
  return {
    userId: credentials.userId ? encrypt(credentials.userId) : undefined,
    password: credentials.password ? encrypt(credentials.password) : undefined,
  };
}

/**
 * Decrypts credentials object from storage
 * @param credentials - Object with encrypted values
 * @returns Object with decrypted values
 */
export function decryptCredentials(credentials: { userId?: string; password?: string } | null) {
  if (!credentials) return null;
  
  return {
    userId: credentials.userId ? decrypt(credentials.userId) : undefined,
    password: credentials.password ? decrypt(credentials.password) : undefined,
  };
}

/**
 * Encrypts challenge questions array
 * @param questions - Array of {question, answer} objects
 * @returns Array with encrypted answers
 */
export function encryptChallengeQuestions(questions: Array<{ question: string; answer: string }> | null) {
  if (!questions || !Array.isArray(questions)) return questions;
  
  return questions.map(q => ({
    question: q.question,
    answer: q.answer ? encrypt(q.answer) : q.answer,
  }));
}

/**
 * Decrypts challenge questions array
 * @param questions - Array with encrypted answers
 * @returns Array with decrypted answers
 */
export function decryptChallengeQuestions(questions: Array<{ question: string; answer: string }> | null) {
  if (!questions || !Array.isArray(questions)) return questions;
  
  return questions.map(q => ({
    question: q.question,
    answer: q.answer ? decrypt(q.answer) : q.answer,
  }));
}
