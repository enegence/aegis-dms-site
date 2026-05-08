import type { AegisDb } from '../db/index.js';
import { estateItems } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { encryptEstateItem, decryptEstateItem } from './estate-mapper.js';
import { encryptFieldIfPresent } from './field-encrypt.js';
import type { EstateItemInput } from './estate-mapper.js';

export async function listEstateItems(
  db: AegisDb,
  userId: string,
  encryptionKey: string,
) {
  const rows = await db
    .select()
    .from(estateItems)
    .where(eq(estateItems.userId, userId));
  return rows.map((row) => decryptEstateItem(row, encryptionKey));
}

export async function getEstateItem(
  db: AegisDb,
  userId: string,
  id: string,
  encryptionKey: string,
) {
  const rows = await db
    .select()
    .from(estateItems)
    .where(and(eq(estateItems.id, id), eq(estateItems.userId, userId)));
  if (rows.length === 0) return null;
  return decryptEstateItem(rows[0], encryptionKey);
}

export async function createEstateItem(
  db: AegisDb,
  userId: string,
  input: EstateItemInput,
  encryptionKey: string,
) {
  const encrypted = encryptEstateItem(input, encryptionKey);
  const rows = await db
    .insert(estateItems)
    .values({ userId, ...encrypted })
    .returning();
  return decryptEstateItem(rows[0], encryptionKey);
}

export async function updateEstateItem(
  db: AegisDb,
  userId: string,
  id: string,
  input: Partial<EstateItemInput>,
  encryptionKey: string,
) {
  const patch: Record<string, unknown> = {};

  if (input.category !== undefined) patch.category = input.category;
  if (input.title !== undefined) patch.title = input.title;
  if (input.institutionName !== undefined)
    patch.institutionNameEncrypted = encryptFieldIfPresent(input.institutionName, encryptionKey);
  if (input.accountType !== undefined)
    patch.accountTypeEncrypted = encryptFieldIfPresent(input.accountType, encryptionKey);
  if (input.referenceHint !== undefined)
    patch.referenceHintEncrypted = encryptFieldIfPresent(input.referenceHint, encryptionKey);
  if (input.assetDescription !== undefined)
    patch.assetDescriptionEncrypted = encryptFieldIfPresent(input.assetDescription, encryptionKey);
  if (input.locationNotes !== undefined)
    patch.locationNotesEncrypted = encryptFieldIfPresent(input.locationNotes, encryptionKey);
  if (input.executorNotes !== undefined)
    patch.executorNotesEncrypted = encryptFieldIfPresent(input.executorNotes, encryptionKey);
  if (input.sensitiveFlag !== undefined) patch.sensitiveFlag = input.sensitiveFlag;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;

  patch.updatedAt = new Date();

  const rows = await db
    .update(estateItems)
    .set(patch)
    .where(and(eq(estateItems.id, id), eq(estateItems.userId, userId)))
    .returning();

  if (rows.length === 0) return null;
  return decryptEstateItem(rows[0], encryptionKey);
}

export async function deleteEstateItem(
  db: AegisDb,
  userId: string,
  id: string,
) {
  const rows = await db
    .delete(estateItems)
    .where(and(eq(estateItems.id, id), eq(estateItems.userId, userId)))
    .returning({ id: estateItems.id });
  return { deleted: rows.length > 0 };
}
