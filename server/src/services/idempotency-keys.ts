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

import { eq } from 'drizzle-orm';
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
 * Check if a key exists (and is not expired). If not, insert it.
 * Returns { found: true, result } for cached hit, { found: false } for new insert.
 *
 * Callers should treat found === false as "proceed with work" and
 * found === true as "return cached result".
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
  const existing = await checkIdempotencyKey(db, key);
  if (existing.found) return existing;

  await setIdempotencyKey(db, key, scope, opts);
  return { found: false, result: null };
}

/**
 * Delete a specific idempotency key.
 */
export async function deleteIdempotencyKey(db: AegisDb, key: string): Promise<void> {
  await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, key));
}
