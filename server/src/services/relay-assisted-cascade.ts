/**
 * relay-assisted-cascade.ts
 *
 * Runs relay-escrow-initiated release for eligible offline connections.
 *
 * Security invariants:
 *  - Only relay_escrow connections trigger a release run; monitoring-only never does.
 *  - Escrow material must be active and non-revoked (isEscrowEnabled).
 *  - Subscription must be active or trialing (canUseRelay).
 *  - One active release run per user at a time (no parallel cascades).
 *  - Audit event written for every cascade start.
 */

import { eq, and } from 'drizzle-orm';
import type { AegisDb } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { relayConnections, relayEscrowMaterials } from '../db/schema.js';
import { isEscrowEnabled } from './relay-escrow.js';
import { getActiveReleaseRunForUser, createReleaseRun } from '../repositories/release-run-repository.js';
import { canUseRelay } from './subscription-gate.js';
import { writeAuditEvent } from './audit.js';

export interface RelayEscrowCascadeResult {
  checked: number;
  escrowCascadesStarted: number;
  skippedNoEscrow: number;
  skippedActiveRun: number;
  skippedSubscription: number;
  errors: number;
}

export async function runRelayEscrowCascadeOnce(
  db: AegisDb,
  config: AppConfig,
): Promise<RelayEscrowCascadeResult> {
  const result: RelayEscrowCascadeResult = {
    checked: 0,
    escrowCascadesStarted: 0,
    skippedNoEscrow: 0,
    skippedActiveRun: 0,
    skippedSubscription: 0,
    errors: 0,
  };

  // Query all connections currently offline (relay-monitor already marked them)
  let offlineConnections: Array<typeof relayConnections.$inferSelect>;
  try {
    offlineConnections = await db
      .select()
      .from(relayConnections)
      .where(eq(relayConnections.status, 'offline'));
  } catch (err) {
    console.error('[relay-escrow-cascade] failed to query offline connections:', err);
    result.errors++;
    return result;
  }

  result.checked = offlineConnections.length;

  for (const conn of offlineConnections) {
    try {
      // Gate 1: escrow must be enabled (non-revoked, acknowledged)
      const escrowEnabled = await isEscrowEnabled(db, conn.userId, conn.id);
      if (!escrowEnabled) {
        result.skippedNoEscrow++;
        continue;
      }

      // Gate 2: subscription must be active/trialing
      const subAllowed = await canUseRelay(db, conn.userId);
      if (!subAllowed) {
        result.skippedSubscription++;
        continue;
      }

      // Gate 3: no active release run for this user (one-at-a-time constraint)
      const existingRun = await getActiveReleaseRunForUser(db, conn.userId);
      if (existingRun) {
        result.skippedActiveRun++;
        continue;
      }

      // All gates passed — create relay_escrow release run
      const run = await createReleaseRun(db, {
        userId: conn.userId,
        relayConnectionId: conn.id,
        source: 'relay_escrow',
        status: 'active',
      });

      await writeAuditEvent(db, {
        userId: conn.userId,
        releaseRunId: run.id,
        relayConnectionId: conn.id,
        eventType: 'relay_assisted_release_started',
        actorType: 'system',
        metadata: { connectionId: conn.id, releaseRunId: run.id },
      });

      result.escrowCascadesStarted++;
    } catch (err) {
      console.error('[relay-escrow-cascade] error processing connection', conn.id, err);
      result.errors++;
    }
  }

  return result;
}
