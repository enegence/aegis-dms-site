import { encryptFieldIfPresent, decryptFieldIfPresent } from './field-encrypt.js';

export interface ContactInput {
  fullName: string;
  relationship?: string | null;
  email: string;
  phone?: string | null;
  telegramHandle?: string | null;
  preferredChannels?: string[];
  confirmationWindowHours?: number;
  backupNotes?: string | null;
  priorityOrder?: number;
}

export interface ContactDbRow {
  id: string;
  userId: string;
  fullNameEncrypted: string;
  relationshipEncrypted: string | null;
  priorityOrder: number;
  emailEncrypted: string;
  phoneEncrypted: string | null;
  telegramHandleEncrypted: string | null;
  preferredChannels: unknown; // jsonb
  confirmationWindowHours: number;
  claimPinHash: string | null;
  backupNotesEncrypted: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function encryptContact(input: ContactInput, encryptionKey: string) {
  return {
    fullNameEncrypted: encryptFieldIfPresent(input.fullName, encryptionKey)!,
    relationshipEncrypted: encryptFieldIfPresent(input.relationship, encryptionKey),
    emailEncrypted: encryptFieldIfPresent(input.email, encryptionKey)!,
    phoneEncrypted: encryptFieldIfPresent(input.phone, encryptionKey),
    telegramHandleEncrypted: encryptFieldIfPresent(input.telegramHandle, encryptionKey),
    preferredChannels: input.preferredChannels ?? ['email'],
    confirmationWindowHours: input.confirmationWindowHours ?? 48,
    backupNotesEncrypted: encryptFieldIfPresent(input.backupNotes, encryptionKey),
  };
}

export function decryptContact(row: ContactDbRow, encryptionKey: string) {
  return {
    id: row.id,
    fullName: decryptFieldIfPresent(row.fullNameEncrypted, encryptionKey) ?? '',
    relationship: decryptFieldIfPresent(row.relationshipEncrypted, encryptionKey),
    priorityOrder: row.priorityOrder,
    email: decryptFieldIfPresent(row.emailEncrypted, encryptionKey) ?? '',
    phone: decryptFieldIfPresent(row.phoneEncrypted, encryptionKey),
    telegramHandle: decryptFieldIfPresent(row.telegramHandleEncrypted, encryptionKey),
    preferredChannels: Array.isArray(row.preferredChannels) ? row.preferredChannels : ['email'],
    confirmationWindowHours: row.confirmationWindowHours,
    backupNotes: decryptFieldIfPresent(row.backupNotesEncrypted, encryptionKey),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
