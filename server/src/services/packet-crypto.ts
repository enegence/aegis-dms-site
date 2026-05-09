/**
 * packet-crypto.ts — Pure AES-256-GCM packet encryption/decryption.
 *
 * No DB, no storage, no side effects. All randomness generated per call.
 *
 * Encrypted data wire format:
 *   [ IV (12 bytes) | AuthTag (16 bytes) | Ciphertext (variable) ]
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;   // 256-bit key
const IV_LENGTH = 12;    // 96-bit IV (GCM standard)
const AUTH_TAG_LENGTH = 16;  // 128-bit auth tag

export interface PacketCryptoResult {
  /** The full wire-format ciphertext: Buffer.concat([iv, authTag, ciphertext]) */
  encryptedData: Buffer;
  /** 32-byte random symmetric key used for this packet. Caller is responsible for secure handling. */
  packetKey: Buffer;
  /** 12-byte random IV used for this packet. */
  iv: Buffer;
  /** sha256 hex of JSON.stringify(payload) — verifies plaintext integrity */
  contentHash: string;
  /** sha256 hex of encryptedData — verifies ciphertext integrity after storage */
  encryptedObjectHash: string;
  /** Opaque key identifier — format: 'hosted-v1-<uuid>' */
  keyId: string;
}

/**
 * Encrypt a packet payload with AES-256-GCM.
 *
 * Generates a fresh 32-byte key and 12-byte IV each call.
 * The returned packetKey MUST be handled securely by the caller.
 */
export function encryptPacketPayload(payload: object): PacketCryptoResult {
  const plaintext = JSON.stringify(payload);
  const plaintextBuf = Buffer.from(plaintext, 'utf8');

  const packetKey = randomBytes(KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, packetKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // Wire format: iv || authTag || ciphertext
  const encryptedData = Buffer.concat([iv, authTag, ciphertext]);

  const contentHash = createHash('sha256').update(plaintextBuf).digest('hex');
  const encryptedObjectHash = createHash('sha256').update(encryptedData).digest('hex');
  const keyId = `hosted-v1-${randomUUID()}`;

  return {
    encryptedData,
    packetKey,
    iv,
    contentHash,
    encryptedObjectHash,
    keyId,
  };
}

/**
 * Decrypt a packet payload encrypted with encryptPacketPayload().
 *
 * Parses the wire format: iv (first 12 bytes) | authTag (next 16 bytes) | ciphertext (rest).
 * Throws if the data is too short, if the auth tag fails, or if JSON parse fails.
 */
export function decryptPacketPayload(
  encryptedData: Buffer,
  packetKey: Buffer,
  iv: Buffer,
): object {
  const minLength = IV_LENGTH + AUTH_TAG_LENGTH + 1;
  if (encryptedData.length < minLength) {
    throw new Error('encryptedData too short to be a valid packet');
  }

  // Parse wire format
  const parsedIv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  // The iv parameter is passed through for API symmetry but the wire-format IV is canonical
  // We use parsedIv from the wire format (they should match, but wire format is authoritative)
  void iv; // acknowledged — parsedIv is used

  const decipher = createDecipheriv(ALGORITHM, packetKey, parsedIv);
  decipher.setAuthTag(authTag);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('Packet decryption failed: authentication tag mismatch or corrupted data');
  }

  return JSON.parse(plaintext.toString('utf8')) as object;
}
