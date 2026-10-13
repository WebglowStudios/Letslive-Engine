import crypto from 'crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-cbc';
const SALT = 'letslive-pwd-secret-salt-2026';
const KEY = crypto.scryptSync(env.JWT_SECRET || 'letslivetours-master-key', SALT, 32);

export function encryptPassword(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptPassword(cipherText?: string): string | null {
  if (!cipherText || !cipherText.includes(':')) return null;
  try {
    const [ivHex, dataHex] = cipherText.split(':');
    if (!ivHex || !dataHex) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    let decrypted = decipher.update(dataHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}
