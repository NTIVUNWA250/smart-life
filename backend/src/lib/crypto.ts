import crypto from 'node:crypto';
import { env } from './env.js';

// AES-256-GCM field encryption for sensitive approval/peer data (SRS §2.4).
const ALGO = 'aes-256-gcm';

function key(): Buffer {
  const k = Buffer.from(env.fieldEncryptionKey, 'hex');
  if (k.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes (64 hex chars)');
  }
  return k;
}

/** Encrypts plaintext to a self-describing base64 string: iv.tag.ciphertext */
export function encryptField(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64')).join('.');
}

export function decryptField(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  const decipher = crypto.createDecipheriv(
    ALGO,
    key(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** SHA-256 hash, used for storing refresh tokens at rest. */
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
