/**
 * Hosted worker — evaluates armed switches, starts/progresses release runs,
 * starts cascades, escalates expired claims, and completes/fails runs.
 *
 * Idempotent: safe to call on every worker tick without duplicate side effects.
 */

import { and, eq, inArray, lte, isNull } from 'drizzle-orm';
import type { AegisDb } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { switches, contactClaims, releaseRuns } from '../db/schema.js';
import { evaluateHostedSwitch } from '../services/hosted-switch-engine.js';
import { startCascadeForReleaseRun, escalateClaim } from '../services/hosted-cascade.js';
import {
  getActiveReleaseRunForUser,
  updateReleaseRun,
} from '../repositories/release-run-repository.js';

export interface HostedWorkerResult {
  switchesEvaluated: number;
  cascadesStarted: number;
  claimsEscalated: number;
  errors: number;
}

const BASE_URL = process.env.AEGIS_BASE_URL ?? 'https://aegisdms.life';

export async function runHostedWorkerOnce(
  db: AegisDb,
  config: AppConfig,
  now?: Date,
): Promise<HostedWorkerResult> {
  const effectiveNow = now ?? new Date();
  const result: HostedWorkerResult = {
    switchesEvaluated: 0,
    cascadesStarted: 0,
    claimsEscalated: 0,
    errors: 0,
  };

  // ── Step 1: Evaluate all armed/warning switches ───────────────────────────
  // Only evaluate armed/warning — triggered switches are already handled.
  let armedSwitches: (typeof switches.$inferSelect)[];
  try {
    armedSwitches = await db
      .select()
      .from(switches)
      .where(inArray(switches.status, ['armed', 'warning']));
  } catch (err) {
    console.error('[hosted-worker] failed to query armed switches:', err);
    result.errors++;
    armedSwitches = [];
  }

  for (const sw of armedSwitches) {
    try {
      await evaluateHostedSwitch(db, config, sw.userId, sw.id, effectiveNow);
      result.switchesEvaluated++;
    } catch (err) {
      console.error('[hosted-worker] evaluateHostedSwitch error:', sw.id, err);
      result.errors++;
    }
  }

  // ── Step 2: Start cascades for active runs without one ───────────────────
  // Find 'active' or 'active_pending_packet' runs that have a packet but no cascade yet.
  let runsNeedingCascade: (typeof releaseRuns.$inferSelect)[];
  try {
    runsNeedingCascade = await db
      .select()
      .from(releaseRuns)
      .where(
        and(
          inArray(releaseRuns.status, ['active', 'active_pending_packet']),
          isNull(releaseRuns.currentContactClaimId),
        ),
      );
  } catch (err) {
    console.error('[hosted-worker] failed to query runs needing cascade:', err);
    result.errors++;
    runsNeedingCascade = [];
  }

  for (const run of runsNeedingCascade) {
    if (!run.activePacketId) continue; // packet not yet built; wait for next tick

    try {
      await startCascadeForReleaseRun({
        db,
        config,
        releaseRunId: run.id,
        baseUrl: BASE_URL,
      });
      // Update status to reflect cascade is active
      await updateReleaseRun(db, run.id, { status: 'cascade_active' });
      result.cascadesStarted++;
    } catch (err) {
      console.error('[hosted-worker] startCascadeForReleaseRun error:', run.id, err);
      result.errors++;
    }
  }

  // ── Step 3: Escalate expired notified claims ─────────────────────────────
  let expiredClaims: (typeof contactClaims.$inferSelect)[];
  try {
    expiredClaims = await db
      .select()
      .from(contactClaims)
      .where(
        and(
          eq(contactClaims.status, 'notified'),
          lte(contactClaims.expiresAt, effectiveNow),
        ),
      );
  } catch (err) {
    console.error('[hosted-worker] failed to query expired claims:', err);
    result.errors++;
    expiredClaims = [];
  }

  for (const claim of expiredClaims) {
    try {
      await escalateClaim({
        db,
        config,
        claimId: claim.id,
        baseUrl: BASE_URL,
      });
      result.claimsEscalated++;
    } catch (err) {
      console.error('[hosted-worker] escalateClaim error:', claim.id, err);
      result.errors++;
    }
  }

  return result;
}
