/**
 * Aegis SaaS — Export / Restore Service
 *
 * Creates encrypted export bundles (same wire format as OSS).
 * Decrypts export bundles (shared by both SaaS export and any restore path).
 */

import argon2 from 'argon2';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import type { AegisDb } from '../db/index.js';
import {
  users,
  estateItems,
  contacts,
  switches,
  releaseRuns,
  subscriptions,
} from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { decryptField } from './field-encrypt.js';

export const EXPORT_SCHEMA_VERSION = 'aegis-export-2026-05-01';
const APP_VERSION = '1.0.0-saas-alpha';
const ALGORITHM = 'aes-256-gcm';

export interface ExportBundle {
  schemaVersion: string;
  createdAt: string;
  appVersion: string;
  encryption: {
    algorithm: string;
    kdf: string;
    salt: string;
    iv: string;
    authTag: string;
  };
  payloadHash: string;
  encryptedPayload: string;
}

export interface ExportPayload {
  account: {
    displayName: string;
    email: string;
    timezone: string;
    totpEnabled: boolean;
    createdAt: string;
  };
  subscription: {
    plan: string | null;
    status: string | null;
  } | null;
  estateItems: Array<{
    id: string;
    category: string;
    title: string;
    institutionName: string | null;
    accountType: string | null;
    referenceHint: string | null;
    assetDescription: string | null;
    locationNotes: string | null;
    executorNotes: string | null;
    sensitiveFlag: boolean;
    sortOrder: number;
    createdAt: string;
  }>;
  contacts: Array<{
    id: string;
    fullName: string;
    relationship: string | null;
    priorityOrder: number;
    email: string;
    phone: string | null;
    telegramHandle: string | null;
    preferredChannels: unknown;
    confirmationWindowHours: number;
    backupNotes: string | null;
    createdAt: string;
  }>;
  switches: Array<{
    id: string;
    name: string;
    mode: string;
    status: string;
    gracePeriodHours: number;
    warningWindowDays: number;
    createdAt: string;
  }>;
  releaseRunsMeta: Array<{
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
  }>;
  exportedAt: string;
}

/** Derive a 32-byte AES key from passphrase using argon2id. */
async function deriveKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  const hash = await argon2.hash(passphrase, {
    type: argon2.argon2id,
    salt,
    hashLength: 32,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    raw: true,
  });
  return hash as unknown as Buffer;
}

/** Build an encrypted export bundle from a plaintext payload. */
export async function buildExportBundle(
  payload: ExportPayload,
  passphrase: string,
): Promise<ExportBundle> {
  const plaintext = JSON.stringify(payload);
  const payloadHash = createHash('sha256').update(plaintext).digest('hex');

  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const key = await deriveKey(passphrase, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf8')),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    encryption: {
      algorithm: ALGORITHM,
      kdf: 'argon2id',
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    },
    payloadHash,
    encryptedPayload: encrypted.toString('hex'),
  };
}

/** Decrypt an export bundle with the provided passphrase. */
export async function decryptExportBundle(
  bundle: ExportBundle,
  passphrase: string,
): Promise<ExportPayload> {
  if (bundle.schemaVersion !== EXPORT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${bundle.schemaVersion}`);
  }

  const salt = Buffer.from(bundle.encryption.salt, 'hex');
  const iv = Buffer.from(bundle.encryption.iv, 'hex');
  const authTag = Buffer.from(bundle.encryption.authTag, 'hex');
  const encryptedData = Buffer.from(bundle.encryptedPayload, 'hex');

  const key = await deriveKey(passphrase, salt);

  let plaintext: string;
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    plaintext = decrypted.toString('utf8');
  } catch {
    throw new Error('Decryption failed — incorrect passphrase or corrupted bundle');
  }

  const actualHash = createHash('sha256').update(plaintext).digest('hex');
  if (actualHash !== bundle.payloadHash) {
    throw new Error('Payload hash mismatch — bundle may be corrupted');
  }

  return JSON.parse(plaintext) as ExportPayload;
}

/** Gather all exportable data for a SaaS user. */
export async function gatherUserExportPayload(
  db: AegisDb,
  userId: string,
  fieldKey: string,
): Promise<ExportPayload> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error('User not found');

  const estateRows = await db.select().from(estateItems).where(eq(estateItems.userId, userId));
  const contactRows = await db.select().from(contacts).where(eq(contacts.userId, userId));
  const switchRows = await db.select().from(switches).where(eq(switches.userId, userId));
  const releaseRunRows = await db.select().from(releaseRuns).where(eq(releaseRuns.userId, userId));
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);

  const exportedAccount: ExportPayload['account'] = {
    displayName: user.displayName,
    email: user.email,
    timezone: user.timezone,
    totpEnabled: user.totpEnabled,
    createdAt: user.createdAt.toISOString(),
  };

  const exportedSubscription: ExportPayload['subscription'] = sub
    ? { plan: sub.plan, status: sub.status }
    : null;

  const exportedEstateItems = estateRows.map(item => ({
    id: item.id,
    category: item.category,
    title: item.title,
    institutionName: item.institutionNameEncrypted
      ? decryptField(item.institutionNameEncrypted, fieldKey)
      : null,
    accountType: item.accountTypeEncrypted
      ? decryptField(item.accountTypeEncrypted, fieldKey)
      : null,
    referenceHint: item.referenceHintEncrypted
      ? decryptField(item.referenceHintEncrypted, fieldKey)
      : null,
    assetDescription: item.assetDescriptionEncrypted
      ? decryptField(item.assetDescriptionEncrypted, fieldKey)
      : null,
    locationNotes: item.locationNotesEncrypted
      ? decryptField(item.locationNotesEncrypted, fieldKey)
      : null,
    executorNotes: item.executorNotesEncrypted
      ? decryptField(item.executorNotesEncrypted, fieldKey)
      : null,
    sensitiveFlag: item.sensitiveFlag,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
  }));

  const exportedContacts = contactRows.map(c => ({
    id: c.id,
    fullName: decryptField(c.fullNameEncrypted, fieldKey) ?? '',
    relationship: c.relationshipEncrypted
      ? decryptField(c.relationshipEncrypted, fieldKey)
      : null,
    priorityOrder: c.priorityOrder,
    email: decryptField(c.emailEncrypted, fieldKey) ?? '',
    phone: c.phoneEncrypted ? decryptField(c.phoneEncrypted, fieldKey) : null,
    telegramHandle: c.telegramHandleEncrypted
      ? decryptField(c.telegramHandleEncrypted, fieldKey)
      : null,
    preferredChannels: c.preferredChannels,
    confirmationWindowHours: c.confirmationWindowHours,
    backupNotes: c.backupNotesEncrypted
      ? decryptField(c.backupNotesEncrypted, fieldKey)
      : null,
    createdAt: c.createdAt.toISOString(),
  }));

  const exportedSwitches = switchRows.map(s => ({
    id: s.id,
    name: s.name,
    mode: s.mode,
    status: s.status,
    gracePeriodHours: s.gracePeriodHours,
    warningWindowDays: s.warningWindowDays,
    createdAt: s.createdAt.toISOString(),
  }));

  const exportedReleaseRunsMeta = releaseRunRows.map(r => ({
    id: r.id,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt ? r.completedAt.toISOString() : null,
  }));

  return {
    account: exportedAccount,
    subscription: exportedSubscription,
    estateItems: exportedEstateItems,
    contacts: exportedContacts,
    switches: exportedSwitches,
    releaseRunsMeta: exportedReleaseRunsMeta,
    exportedAt: new Date().toISOString(),
  };
}
