import { encryptFieldIfPresent, decryptFieldIfPresent } from './field-encrypt.js';

export interface EstateItemInput {
  category: string;
  title: string;
  institutionName?: string | null;
  accountType?: string | null;
  referenceHint?: string | null;
  assetDescription?: string | null;
  locationNotes?: string | null;
  executorNotes?: string | null;
  sensitiveFlag?: boolean;
  sortOrder?: number;
}

export interface EstateItemDbRow {
  id: string;
  userId: string;
  category: string;
  title: string;
  institutionNameEncrypted: string | null;
  accountTypeEncrypted: string | null;
  referenceHintEncrypted: string | null;
  assetDescriptionEncrypted: string | null;
  locationNotesEncrypted: string | null;
  executorNotesEncrypted: string | null;
  sensitiveFlag: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export function encryptEstateItem(input: EstateItemInput, encryptionKey: string) {
  return {
    category: input.category,
    title: input.title,
    institutionNameEncrypted: encryptFieldIfPresent(input.institutionName, encryptionKey),
    accountTypeEncrypted: encryptFieldIfPresent(input.accountType, encryptionKey),
    referenceHintEncrypted: encryptFieldIfPresent(input.referenceHint, encryptionKey),
    assetDescriptionEncrypted: encryptFieldIfPresent(input.assetDescription, encryptionKey),
    locationNotesEncrypted: encryptFieldIfPresent(input.locationNotes, encryptionKey),
    executorNotesEncrypted: encryptFieldIfPresent(input.executorNotes, encryptionKey),
    sensitiveFlag: input.sensitiveFlag ?? false,
    sortOrder: input.sortOrder ?? 0,
  };
}

export function decryptEstateItem(row: EstateItemDbRow, encryptionKey: string) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    institutionName: decryptFieldIfPresent(row.institutionNameEncrypted, encryptionKey),
    accountType: decryptFieldIfPresent(row.accountTypeEncrypted, encryptionKey),
    referenceHint: decryptFieldIfPresent(row.referenceHintEncrypted, encryptionKey),
    assetDescription: decryptFieldIfPresent(row.assetDescriptionEncrypted, encryptionKey),
    locationNotes: decryptFieldIfPresent(row.locationNotesEncrypted, encryptionKey),
    executorNotes: decryptFieldIfPresent(row.executorNotesEncrypted, encryptionKey),
    sensitiveFlag: row.sensitiveFlag,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
