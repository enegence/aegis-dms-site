import { createHash, randomBytes } from 'crypto';
import type { AegisDb } from '../db/index.js';
import { contactClaims } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

export type ContactClaim = typeof contactClaims.$inferSelect;

/** Generate a raw token and its SHA-256 hash. Store only the hash. */
export function generateClaimToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashClaimToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export interface CreateContactClaimInput {
  packetId: string;
  contactId: string;
  releaseRunId: string;
  switchId?: string | null;
  claimTokenHash: string;
  expiresAt: Date;
}

export async function createContactClaim(
  db: AegisDb,
  input: CreateContactClaimInput,
): Promise<ContactClaim> {
  const rows = await db
    .insert(contactClaims)
    .values({
      packetId: input.packetId,
      contactId: input.contactId,
      releaseRunId: input.releaseRunId,
      switchId: input.switchId ?? null,
      claimTokenHash: input.claimTokenHash,
      status: 'pending',
      expiresAt: input.expiresAt,
    })
    .returning();
  return rows[0]!;
}

export async function getContactClaimById(
  db: AegisDb,
  id: string,
): Promise<ContactClaim | null> {
  const rows = await db
    .select()
    .from(contactClaims)
    .where(eq(contactClaims.id, id));
  return rows[0] ?? null;
}

export async function getContactClaimByTokenHash(
  db: AegisDb,
  tokenHash: string,
): Promise<ContactClaim | null> {
  const rows = await db
    .select()
    .from(contactClaims)
    .where(eq(contactClaims.claimTokenHash, tokenHash));
  return rows[0] ?? null;
}

export async function getActiveClaimForReleaseRun(
  db: AegisDb,
  releaseRunId: string,
): Promise<ContactClaim | null> {
  const rows = await db
    .select()
    .from(contactClaims)
    .where(
      and(
        eq(contactClaims.releaseRunId, releaseRunId),
        eq(contactClaims.status, 'notified'),
      ),
    );
  return rows[0] ?? null;
}

export async function listClaimsForReleaseRun(
  db: AegisDb,
  releaseRunId: string,
): Promise<ContactClaim[]> {
  return db
    .select()
    .from(contactClaims)
    .where(eq(contactClaims.releaseRunId, releaseRunId));
}

export interface UpdateContactClaimInput {
  status?: string;
  notifiedAt?: Date | null;
  openedAt?: Date | null;
  verifiedAt?: Date | null;
  acceptedAt?: Date | null;
  packetDownloadedAt?: Date | null;
  keyViewedAt?: Date | null;
  acknowledgedAt?: Date | null;
  escalatedAt?: Date | null;
  failedAt?: Date | null;
}

export async function updateContactClaim(
  db: AegisDb,
  id: string,
  patch: UpdateContactClaimInput,
): Promise<ContactClaim | null> {
  const rows = await db
    .update(contactClaims)
    .set(patch)
    .where(eq(contactClaims.id, id))
    .returning();
  return rows[0] ?? null;
}
