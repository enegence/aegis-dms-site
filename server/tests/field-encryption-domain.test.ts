import { describe, it, expect } from 'vitest';
import { encryptField, decryptField, encryptFieldIfPresent, decryptFieldIfPresent } from '../src/services/field-encrypt.js';
import { encryptEstateItem, decryptEstateItem } from '../src/services/estate-mapper.js';
import { encryptContact, decryptContact } from '../src/services/contact-mapper.js';

const TEST_KEY = 'test-encryption-key-for-testing-only-32ch';

describe('field-encrypt', () => {
  it('encrypts and decrypts a string', () => {
    const plaintext = 'sensitive data';
    const encrypted = encryptField(plaintext, TEST_KEY);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptField(encrypted, TEST_KEY)).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', () => {
    const encrypted1 = encryptField('same', TEST_KEY);
    const encrypted2 = encryptField('same', TEST_KEY);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('fails to decrypt with wrong key', () => {
    const encrypted = encryptField('secret', TEST_KEY);
    expect(() => decryptField(encrypted, 'wrong-key-entirely-different-32ch')).toThrow();
  });

  it('encryptFieldIfPresent returns null for null/empty', () => {
    expect(encryptFieldIfPresent(null, TEST_KEY)).toBeNull();
    expect(encryptFieldIfPresent(undefined, TEST_KEY)).toBeNull();
    expect(encryptFieldIfPresent('', TEST_KEY)).toBeNull();
  });

  it('decryptFieldIfPresent returns null for null', () => {
    expect(decryptFieldIfPresent(null, TEST_KEY)).toBeNull();
    expect(decryptFieldIfPresent(undefined, TEST_KEY)).toBeNull();
  });
});

describe('estate-mapper', () => {
  it('encrypts sensitive fields', () => {
    const result = encryptEstateItem({
      category: 'Financial',
      title: 'Savings Account',
      institutionName: 'Big Bank',
      executorNotes: 'Give to Alice',
    }, TEST_KEY);
    expect(result.category).toBe('Financial');
    expect(result.title).toBe('Savings Account');
    expect(result.institutionNameEncrypted).not.toBe('Big Bank');
    expect(result.executorNotesEncrypted).not.toBe('Give to Alice');
    expect(result.institutionNameEncrypted).not.toBeNull();
  });

  it('decrypts to original values', () => {
    const encrypted = encryptEstateItem({
      category: 'Financial',
      title: 'Savings Account',
      institutionName: 'Big Bank',
      accountType: 'Checking',
    }, TEST_KEY);

    const decrypted = decryptEstateItem({
      id: 'some-uuid',
      userId: 'user-uuid',
      category: encrypted.category,
      title: encrypted.title,
      institutionNameEncrypted: encrypted.institutionNameEncrypted,
      accountTypeEncrypted: encrypted.accountTypeEncrypted,
      referenceHintEncrypted: null,
      assetDescriptionEncrypted: null,
      locationNotesEncrypted: null,
      executorNotesEncrypted: null,
      sensitiveFlag: false,
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, TEST_KEY);

    expect(decrypted.institutionName).toBe('Big Bank');
    expect(decrypted.accountType).toBe('Checking');
    expect(decrypted.referenceHint).toBeNull();
  });

  it('preserves null for optional missing fields', () => {
    const result = encryptEstateItem({ category: 'Other', title: 'Test' }, TEST_KEY);
    expect(result.institutionNameEncrypted).toBeNull();
    expect(result.executorNotesEncrypted).toBeNull();
  });
});

describe('contact-mapper', () => {
  it('encrypts all PII fields', () => {
    const result = encryptContact({
      fullName: 'Alice Smith',
      email: 'alice@example.com',
      phone: '+1234567890',
    }, TEST_KEY);
    expect(result.fullNameEncrypted).not.toBe('Alice Smith');
    expect(result.emailEncrypted).not.toBe('alice@example.com');
    expect(result.phoneEncrypted).not.toBe('+1234567890');
  });

  it('decrypts to original values', () => {
    const encrypted = encryptContact({
      fullName: 'Alice Smith',
      email: 'alice@example.com',
      relationship: 'Spouse',
    }, TEST_KEY);

    const decrypted = decryptContact({
      id: 'some-uuid',
      userId: 'user-uuid',
      fullNameEncrypted: encrypted.fullNameEncrypted,
      relationshipEncrypted: encrypted.relationshipEncrypted,
      priorityOrder: 1,
      emailEncrypted: encrypted.emailEncrypted,
      phoneEncrypted: null,
      telegramHandleEncrypted: null,
      preferredChannels: ['email'],
      confirmationWindowHours: 48,
      claimPinHash: null,
      backupNotesEncrypted: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, TEST_KEY);

    expect(decrypted.fullName).toBe('Alice Smith');
    expect(decrypted.email).toBe('alice@example.com');
    expect(decrypted.relationship).toBe('Spouse');
  });
});
