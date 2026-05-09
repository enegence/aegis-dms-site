/**
 * Tests for packet-crypto.ts — pure AES-256-GCM packet encryption functions.
 */

import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import {
  encryptPacketPayload,
  decryptPacketPayload,
} from '../src/services/packet-crypto.js';

describe('packet-crypto', () => {
  // ── Round-trip ─────────────────────────────────────────────────────────────

  it('encrypt then decrypt returns original payload', () => {
    const original = { hello: 'world', count: 42, nested: { a: true } };
    const result = encryptPacketPayload(original);
    const decrypted = decryptPacketPayload(result.encryptedData, result.packetKey, result.iv);
    expect(decrypted).toEqual(original);
  });

  it('round-trips a complex HostedPacketPayload shape', () => {
    const payload = {
      schemaVersion: '1',
      sourceApp: 'aegis_hosted',
      generatedAt: new Date().toISOString(),
      owner: { displayName: 'Alice Testuser' },
      switchSummary: { id: 'sw-1', name: 'Main Switch', mode: 'hosted' },
      estateItems: [
        {
          id: 'ei-1',
          category: 'financial',
          title: 'Savings Account',
          institutionName: 'Big Bank',
          accountType: 'savings',
          referenceHint: null,
          assetDescription: null,
          locationNotes: null,
          executorNotes: 'see safe',
        },
      ],
      contacts: [
        {
          id: 'c-1',
          fullName: 'Bob Recipient',
          relationship: 'sibling',
          email: 'bob@example.com',
          phone: null,
          telegramHandle: null,
          priorityOrder: 1,
          confirmationWindowHours: 48,
        },
      ],
      releaseDisclaimers: ['Confidential'],
    };

    const result = encryptPacketPayload(payload);
    const decrypted = decryptPacketPayload(result.encryptedData, result.packetKey, result.iv);
    expect(decrypted).toEqual(payload);
  });

  // ── IV uniqueness ──────────────────────────────────────────────────────────

  it('different calls produce different IVs', () => {
    const payload = { value: 'test' };
    const r1 = encryptPacketPayload(payload);
    const r2 = encryptPacketPayload(payload);
    expect(r1.iv.toString('hex')).not.toBe(r2.iv.toString('hex'));
  });

  it('different calls produce different packetKeys', () => {
    const payload = { value: 'test' };
    const r1 = encryptPacketPayload(payload);
    const r2 = encryptPacketPayload(payload);
    expect(r1.packetKey.toString('hex')).not.toBe(r2.packetKey.toString('hex'));
  });

  it('different calls produce different encryptedData', () => {
    const payload = { value: 'test' };
    const r1 = encryptPacketPayload(payload);
    const r2 = encryptPacketPayload(payload);
    expect(r1.encryptedData.toString('hex')).not.toBe(r2.encryptedData.toString('hex'));
  });

  // ── contentHash ────────────────────────────────────────────────────────────

  it('contentHash is sha256 hex of JSON.stringify(payload)', () => {
    const payload = { x: 1, y: 'hello' };
    const result = encryptPacketPayload(payload);
    const expected = createHash('sha256')
      .update(JSON.stringify(payload), 'utf8')
      .digest('hex');
    expect(result.contentHash).toBe(expected);
  });

  it('contentHash is 64 hex characters (sha256 output)', () => {
    const result = encryptPacketPayload({ test: true });
    expect(result.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  // ── encryptedObjectHash ────────────────────────────────────────────────────

  it('encryptedObjectHash is sha256 hex of encryptedData', () => {
    const payload = { value: 'check-hash' };
    const result = encryptPacketPayload(payload);
    const expected = createHash('sha256').update(result.encryptedData).digest('hex');
    expect(result.encryptedObjectHash).toBe(expected);
  });

  it('encryptedObjectHash is 64 hex characters', () => {
    const result = encryptPacketPayload({ test: true });
    expect(result.encryptedObjectHash).toMatch(/^[0-9a-f]{64}$/);
  });

  // ── keyId ─────────────────────────────────────────────────────────────────

  it('keyId starts with hosted-v1-', () => {
    const result = encryptPacketPayload({ k: 1 });
    expect(result.keyId).toMatch(/^hosted-v1-/);
  });

  it('keyId is hosted-v1- followed by a valid UUID', () => {
    const result = encryptPacketPayload({ k: 1 });
    const uuid = result.keyId.replace('hosted-v1-', '');
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('keyIds are unique across calls', () => {
    const r1 = encryptPacketPayload({ k: 1 });
    const r2 = encryptPacketPayload({ k: 1 });
    expect(r1.keyId).not.toBe(r2.keyId);
  });

  // ── Buffer sizes ───────────────────────────────────────────────────────────

  it('iv is 12 bytes', () => {
    const result = encryptPacketPayload({ x: 1 });
    expect(result.iv.length).toBe(12);
  });

  it('packetKey is 32 bytes', () => {
    const result = encryptPacketPayload({ x: 1 });
    expect(result.packetKey.length).toBe(32);
  });

  it('encryptedData is larger than payload (iv + authTag overhead)', () => {
    const payload = { x: 1 };
    const result = encryptPacketPayload(payload);
    const plaintextLen = Buffer.byteLength(JSON.stringify(payload), 'utf8');
    // 12 (iv) + 16 (authTag) + plaintextLen (GCM has no padding)
    expect(result.encryptedData.length).toBe(12 + 16 + plaintextLen);
  });

  // ── Tamper detection ───────────────────────────────────────────────────────

  it('tampered ciphertext (flipped byte) fails to decrypt with an error', () => {
    const payload = { secret: 'important data' };
    const result = encryptPacketPayload(payload);

    // Flip one byte in the ciphertext region (after iv=12 and authTag=16)
    const tampered = Buffer.from(result.encryptedData);
    const ciphertextOffset = 12 + 16;
    tampered[ciphertextOffset] ^= 0xff;

    expect(() =>
      decryptPacketPayload(tampered, result.packetKey, result.iv),
    ).toThrow();
  });

  it('tampered auth tag fails to decrypt', () => {
    const payload = { secret: 'protected' };
    const result = encryptPacketPayload(payload);

    // Flip one byte in the auth tag region (bytes 12..27)
    const tampered = Buffer.from(result.encryptedData);
    tampered[12] ^= 0x01;

    expect(() =>
      decryptPacketPayload(tampered, result.packetKey, result.iv),
    ).toThrow();
  });

  it('wrong packetKey fails to decrypt', () => {
    const payload = { secret: 'value' };
    const result = encryptPacketPayload(payload);
    const wrongKey = Buffer.alloc(32, 0xab); // wrong key

    expect(() =>
      decryptPacketPayload(result.encryptedData, wrongKey, result.iv),
    ).toThrow();
  });

  it('truncated encryptedData throws a specific error', () => {
    const result = encryptPacketPayload({ x: 1 });
    const tooShort = result.encryptedData.subarray(0, 10); // less than iv+authTag+1

    expect(() =>
      decryptPacketPayload(tooShort, result.packetKey, result.iv),
    ).toThrow('too short');
  });
});
