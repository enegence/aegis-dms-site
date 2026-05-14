/**
 * Idempotency key service for release-run deduplication.
 *
 * Keys are scoped to prevent cross-domain collisions.
 * Expired keys are treated as absent (caller should set new key).
 *
 * Usage:
 *   const check = await checkOrSetIdempotencyKey(db, {
 *     key: `packet_generation:${switchId}:${version}`,
 *     scope: 'packet_generation',
 *     userId,
 *     ttlMs: 7 * 24 * 60 * 60 * 1000,
 *   });
 *   if (check.found) { return check.result; }
 *   // ... do work ...
 *   // (key was already inserted; result can be updated by calling setIdempotencyKeyResult)
 */

import { eq, and, lt } from 'drizzle-orm';
import { idempotencyKeys } from '../db/schema.js';
import type { AegisDb } from '../db/index.js';

export interface IdempotencyKeyResult {
  found: boolean;
  result: unknown | null;
}

/**
 * Check if an idempotency key exists and is not expired.
 * Returns { found: true, result } if key is valid; { found: false } otherwise.
 */
export async function checkIdempotencyKey(
  db: AegisDb,
  key: string,
): Promise<IdempotencyKeyResult> {
  const now = new Date();
  const rows = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);

  if (rows.length === 0) return { found: false, result: null };

  const row = rows[0];
  if (row.expiresAt && row.expiresAt <= now) {
    return { found: false, result: null };
  }

  return { found: true, result: row.resultJson ?? null };
}

/**
 * Insert an idempotency key.
 * If the key already exists (unique violation), silently no-ops.
 */
export async function setIdempotencyKey(
  db: AegisDb,
  key: string,
  scope: string,
  opts?: {
    userId?: string;
    resultJson?: unknown;
    ttlMs?: number;
  },
): Promise<void> {
  const expiresAt = opts?.ttlMs ? new Date(Date.now() + opts.ttlMs) : null;

  try {
    await db.insert(idempotencyKeys).values({
      key,
      scope,
      userId: opts?.userId ?? null,
      resultJson: opts?.resultJson ?? null,
      expiresAt: expiresAt ?? undefined,
    });
  } catch {
    // Key already exists — no-op (idempotent insert)
  }
}

/**
 * Atomically claim an idempotency key using INSERT ... ON CONFLICT DO NOTHING (PostgreSQL).
 *
 * - Expired keys are deleted first so a fresh insert can proceed.
 * - ON CONFLICT DO NOTHING atomically claims the row if not already present.
 * - Uses RETURNING to detect whether our insert won the race:
 *     • Inserted row returned  → we claimed it → { found: false }
 *     • No row returned (conflict) → already existed → read it and return { found: true, result }
 *
 * Only the first inserter gets found: false. All subsequent callers get found: true.
 */
export async function checkOrSetIdempotencyKey(
  db: AegisDb,
  key: string,
  scope: string,
  opts?: {
    userId?: string;
    resultJson?: unknown;
    ttlMs?: number;
  },
): Promise<IdempotencyKeyResult> {
  const now = new Date();
  const expiresAt = opts?.ttlMs ? new Date(Date.now() + opts.ttlMs) : null;

  // Delete expired key first so the insert below can claim it fresh
  await db.delete(idempotencyKeys).where(
    and(
      eq(idempotencyKeys.key, key),
      lt(idempotencyKeys.expiresAt as any, now),
    ),
  );

  // Atomically insert; returns the inserted row only if the insert succeeded (no conflict)
  const inserted = await db.insert(idempotencyKeys).values({
    key,
    scope,
    userId: opts?.userId ?? null,
    resultJson: opts?.resultJson ?? null,
    expiresAt: expiresAt ?? undefined,
  }).onConflictDoNothing().returning();

  if (inserted.length > 0) {
    // We claimed the key — caller should proceed with work
    return { found: false, result: null };
  }

  // Key already existed — read the current state
  const rows = await db
    .select()
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, key))
    .limit(1);

  if (rows.length === 0) {
    // Edge case: row was deleted between our insert attempt and this read (e.g. concurrent purge)
    return { found: false, result: null };
  }

  const row = rows[0];
  return { found: true, result: row.resultJson ?? null };
}

/**
 * Purge all expired idempotency keys (called by maintenance worker tick).
 */
export async function purgeExpiredIdempotencyKeys(db: AegisDb): Promise<number> {
  const now = new Date();
  const rows = await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.expiresAt as any, now))
    .returning();
  return rows.length;
}

/**
 * Delete a specific idempotency key.
 */
export async function deleteIdempotencyKey(db: AegisDb, key: string): Promise<void> {
  await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
}
