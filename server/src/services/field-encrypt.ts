import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function deriveKey(rawKey: string): Buffer {
  // SHA-256 of the raw key string to ensure exactly 32 bytes
  return createHash('sha256').update(rawKey).digest();
}

export function encryptField(plaintext: string, rawKey: string): string {
  const key = deriveKey(rawKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: base64(iv + authTag + ciphertext)
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

export function decryptField(ciphertext: string, rawKey: string): string {
  const key = deriveKey(rawKey);
  const combined = Buffer.from(ciphertext, 'base64');
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

export function encryptFieldIfPresent(
  value: string | null | undefined,
  rawKey: string,
): string | null {
  if (value == null || value === '') return null;
  return encryptField(value, rawKey);
}

export function decryptFieldIfPresent(
  value: string | null | undefined,
  rawKey: string,
): string | null {
  if (value == null) return null;
  return decryptField(value, rawKey);
}
