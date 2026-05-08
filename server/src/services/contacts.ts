import type { AegisDb } from '../db/index.js';
import { contacts } from '../db/schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { encryptContact, decryptContact } from './contact-mapper.js';
import type { ContactInput } from './contact-mapper.js';
import { encryptFieldIfPresent } from './field-encrypt.js';

export async function listContacts(
  db: AegisDb,
  userId: string,
  encryptionKey: string,
) {
  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.userId, userId))
    .orderBy(asc(contacts.priorityOrder));
  return rows.map((row) => decryptContact(row, encryptionKey));
}

export async function getContact(
  db: AegisDb,
  userId: string,
  id: string,
  encryptionKey: string,
) {
  const rows = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, userId)));
  if (rows.length === 0) return null;
  return decryptContact(rows[0]!, encryptionKey);
}

export async function createContact(
  db: AegisDb,
  userId: string,
  input: ContactInput,
  encryptionKey: string,
) {
  const existing = await db
    .select({ p: contacts.priorityOrder })
    .from(contacts)
    .where(eq(contacts.userId, userId));
  const maxOrder = existing.reduce((m, r) => Math.max(m, r.p), -1);
  const priorityOrder = input.priorityOrder ?? maxOrder + 1;

  const encrypted = encryptContact(input, encryptionKey);
  const rows = await db
    .insert(contacts)
    .values({ userId, ...encrypted, priorityOrder })
    .returning();
  return decryptContact(rows[0]!, encryptionKey);
}

export async function updateContact(
  db: AegisDb,
  userId: string,
  id: string,
  input: Partial<ContactInput>,
  encryptionKey: string,
) {
  const patch: Record<string, unknown> = {};

  if (input.fullName !== undefined)
    patch.fullNameEncrypted = encryptFieldIfPresent(input.fullName, encryptionKey)!;
  if (input.relationship !== undefined)
    patch.relationshipEncrypted = encryptFieldIfPresent(input.relationship, encryptionKey);
  if (input.email !== undefined)
    patch.emailEncrypted = encryptFieldIfPresent(input.email, encryptionKey)!;
  if (input.phone !== undefined)
    patch.phoneEncrypted = encryptFieldIfPresent(input.phone, encryptionKey);
  if (input.telegramHandle !== undefined)
    patch.telegramHandleEncrypted = encryptFieldIfPresent(input.telegramHandle, encryptionKey);
  if (input.preferredChannels !== undefined)
    patch.preferredChannels = input.preferredChannels;
  if (input.confirmationWindowHours !== undefined)
    patch.confirmationWindowHours = input.confirmationWindowHours;
  if (input.backupNotes !== undefined)
    patch.backupNotesEncrypted = encryptFieldIfPresent(input.backupNotes, encryptionKey);
  if (input.priorityOrder !== undefined)
    patch.priorityOrder = input.priorityOrder;
  patch.updatedAt = new Date();

  const rows = await db
    .update(contacts)
    .set(patch)
    .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
    .returning();

  if (rows.length === 0) return null;
  return decryptContact(rows[0]!, encryptionKey);
}

export async function deleteContact(
  db: AegisDb,
  userId: string,
  id: string,
) {
  const rows = await db
    .delete(contacts)
    .where(and(eq(contacts.id, id), eq(contacts.userId, userId)))
    .returning({ id: contacts.id });
  return { deleted: rows.length > 0 };
}

export async function reorderContacts(
  db: AegisDb,
  userId: string,
  orderedIds: string[],
) {
  const existing = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.userId, userId));
  const existingIds = new Set(existing.map((r) => r.id));
  const valid =
    orderedIds.every((id) => existingIds.has(id)) &&
    orderedIds.length === existingIds.size;
  if (!valid) throw new Error('invalid_ids');

  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(contacts)
      .set({ priorityOrder: i, updatedAt: new Date() })
      .where(and(eq(contacts.id, orderedIds[i]!), eq(contacts.userId, userId)));
  }
}
