/**
 * Release-run state transition service (SaaS).
 *
 * Allowed transitions:
 *   pending        → active
 *   active         → paused | completed | failed | cancelled | cascade_active | active_pending_packet
 *   active_pending_packet → active | failed | cancelled
 *   cascade_active → completed | failed | cancelled
 *   paused         → active | cancelled
 *   failed         → active (explicit manual retry only)
 *   completed      → terminal (no transitions allowed)
 *   cancelled      → terminal (no transitions allowed)
 *
 * Rules:
 *   - Illegal transitions throw ReleaseRunTransitionError.
 *   - If already in the target state, return current run unchanged (idempotent),
 *     EXCEPT for terminal states (completed, cancelled) which always reject.
 */

import type { AegisDb } from '../db/index.js';
import {
  getReleaseRunById,
  updateReleaseRun,
  type ReleaseRun,
} from '../repositories/release-run-repository.js';
import { writeAuditEvent } from './audit.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type ReleaseRunStatus =
  | 'pending'
  | 'active'
  | 'active_pending_packet'
  | 'cascade_active'
  | 'paused'
  | 'failed'
  | 'completed'
  | 'cancelled';

export class ReleaseRunTransitionError extends Error {
  constructor(
    public readonly runId: string,
    public readonly from: string,
    public readonly to: string,
    message?: string,
  ) {
    super(message ?? `Invalid release-run transition: ${from} → ${to} (run ${runId})`);
    this.name = 'ReleaseRunTransitionError';
  }
}

// ── Allowed transition map ───────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  pending: new Set(['active', 'active_pending_packet']),
  active: new Set(['paused', 'completed', 'failed', 'cancelled', 'cascade_active', 'active_pending_packet']),
  active_pending_packet: new Set(['active', 'failed', 'cancelled']),
  cascade_active: new Set(['completed', 'failed', 'cancelled']),
  paused: new Set(['active', 'cancelled']),
  failed: new Set(['active']), // explicit manual retry only
  completed: new Set(),        // terminal
  cancelled: new Set(),        // terminal
};

const TERMINAL_STATES = new Set(['completed', 'cancelled']);

// ── Core transition function ─────────────────────────────────────────────────

/**
 * Transition a release run from `from` state to `to` state.
 *
 * - If run is already in `to` state: return current run (no-op), unless it
 *   is a terminal state, in which case always reject.
 * - If transition is not allowed: throw ReleaseRunTransitionError.
 * - On success: update DB, emit audit event, return updated record.
 */
export async function transitionReleaseRun(
  db: AegisDb,
  runId: string,
  from: ReleaseRunStatus,
  to: ReleaseRunStatus,
): Promise<ReleaseRun> {
  const run = await getReleaseRunById(db, runId);
  if (!run) {
    throw new ReleaseRunTransitionError(runId, from, to, `Release run ${runId} not found`);
  }

  const currentStatus = run.status;

  // Terminal states always reject transitions
  if (TERMINAL_STATES.has(currentStatus)) {
    throw new ReleaseRunTransitionError(
      runId,
      currentStatus,
      to,
      `Release run ${runId} is in terminal state '${currentStatus}' and cannot transition`,
    );
  }

  // Idempotent: already in target state
  if (currentStatus === to) {
    return run;
  }

  // Validate from state matches actual state
  if (currentStatus !== from) {
    throw new ReleaseRunTransitionError(
      runId,
      from,
      to,
      `Release run ${runId} is in state '${currentStatus}', not '${from}' as expected`,
    );
  }

  // Check allowed transitions
  const allowed = ALLOWED_TRANSITIONS[from] ?? new Set();
  if (!allowed.has(to)) {
    throw new ReleaseRunTransitionError(runId, from, to);
  }

  // Build patch
  const patch: Parameters<typeof updateReleaseRun>[2] = { status: to };
  const now = new Date();
  if (to === 'completed') patch.completedAt = now;
  if (to === 'cancelled') patch.cancelledAt = now;

  const updated = await updateReleaseRun(db, runId, patch);

  await writeAuditEvent(db, {
    userId: run.userId,
    releaseRunId: runId,
    eventType: 'release_run_status_changed',
    actorType: 'system',
    metadata: {
      releaseRunId: runId,
      fromStatus: from,
      toStatus: to,
    },
  });

  return updated!;
}

/**
 * Returns true if the given status is a terminal state.
 */
export function isTerminalReleaseRunStatus(status: string): boolean {
  return TERMINAL_STATES.has(status);
}
