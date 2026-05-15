import { inArray, eq } from 'drizzle-orm';
import type { AegisDb } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { releaseRuns, workerHeartbeats } from '../db/schema.js';
import { runRelayMonitorOnce } from '../services/relay-monitor.js';
import { runRelayEscrowCascadeOnce } from '../services/relay-assisted-cascade.js';
import { runHostedWorkerOnce } from './hosted-worker.js';
import { writeAuditEvent } from '../services/audit.js';
import { purgeExpiredIdempotencyKeys } from '../services/idempotency-keys.js';
import { sendOperatorAlerts } from '../services/alerts.js';

// ─── Worker restart recovery ──────────────────────────────────────────────────

/**
 * On startup, recover active/paused release runs.
 * Emits audit events so operators can observe recovery events.
 * The actual deduplication for notifications/uploads is enforced by idempotency
 * keys checked in the cascade/packet build layers.
 */
export async function recoverActiveReleaseRuns(db: AegisDb): Promise<number> {
  const rows = await db
    .select()
    .from(releaseRuns)
    .where(inArray(releaseRuns.status, ['active', 'cascade_active', 'paused', 'active_pending_packet']));

  if (rows.length === 0) return 0;

  const runIds = rows.map((r) => r.id);

  await writeAuditEvent(db, {
    eventType: 'worker_recovery_started',
    actorType: 'system',
    metadata: { activeRunCount: rows.length, runIds },
  });

  // The worker tick loop naturally picks up active/cascade_active runs
  // via loadActiveReleaseRuns() on the next tick — no explicit re-queue needed.

  await writeAuditEvent(db, {
    eventType: 'worker_recovery_completed',
    actorType: 'system',
    metadata: { activeRunCount: rows.length, runIds },
  });

  return rows.length;
}

export interface WorkerOptions {
  intervalSeconds?: number;
  postmarkApiToken?: string;
  fromEmail?: string;
}

// ─── Heartbeat persistence ─────────────────────────────────────────────────────

async function upsertHeartbeatTick(db: AegisDb, now: Date): Promise<void> {
  try {
    await db
      .insert(workerHeartbeats)
      .values({ id: 'singleton', lastTickAt: now })
      .onConflictDoUpdate({
        target: workerHeartbeats.id,
        set: { lastTickAt: now },
      });
  } catch {
    // Non-fatal — heartbeat table may not exist yet (pre-migration)
  }
}

async function upsertHeartbeatSuccess(db: AegisDb, now: Date, durationMs: number): Promise<void> {
  try {
    await db
      .insert(workerHeartbeats)
      .values({ id: 'singleton', lastTickAt: now, lastSuccessAt: now, tickDurationMs: durationMs })
      .onConflictDoUpdate({
        target: workerHeartbeats.id,
        set: { lastSuccessAt: now, tickDurationMs: durationMs },
      });
  } catch {
    // Non-fatal
  }
}

async function upsertHeartbeatError(db: AegisDb, now: Date, errorRedacted: string): Promise<void> {
  try {
    await db
      .insert(workerHeartbeats)
      .values({ id: 'singleton', lastTickAt: now, lastErrorAt: now, lastErrorRedacted: errorRedacted })
      .onConflictDoUpdate({
        target: workerHeartbeats.id,
        set: { lastErrorAt: now, lastErrorRedacted: errorRedacted },
      });
  } catch {
    // Non-fatal
  }
}

export function startWorker(
  db: AegisDb,
  config: AppConfig,
  options: WorkerOptions = {},
): { stop(): Promise<void> } {
  const intervalMs =
    (options.intervalSeconds ??
      parseInt(process.env.AEGIS_WORKER_INTERVAL_SECONDS ?? '60', 10)) * 1000;
  const apiToken = options.postmarkApiToken ?? process.env.POSTMARK_API_TOKEN ?? '';
  const from =
    options.fromEmail ??
    process.env.POSTMARK_FROM_EMAIL ??
    'noreply@aegisdms.life';

  let stopped = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let tickCount = 0;
  const PURGE_INTERVAL_TICKS = 100;

  // Recovery: on startup, find and log any in-flight release runs so the
  // worker can resume from current state rather than starting fresh.
  recoverActiveReleaseRuns(db).catch((err) =>
    console.error('[worker] recovery error:', err),
  );

  async function tick() {
    if (stopped) return;
    const tickStart = Date.now();
    const now = new Date();
    await upsertHeartbeatTick(db, now);
    let tickError: string | null = null;
    try {
      await runRelayMonitorOnce(db, apiToken, from);
    } catch (err) {
      console.error('[worker] relay monitor error:', err);
      tickError = err instanceof Error ? err.constructor.name : 'UnknownError';
    }
    try {
      await runRelayEscrowCascadeOnce(db, config);
    } catch (err) {
      console.error('[worker] relay escrow cascade error:', err);
      if (!tickError) tickError = err instanceof Error ? err.constructor.name : 'UnknownError';
    }
    try {
      await runHostedWorkerOnce(db, config);
    } catch (err) {
      console.error('[worker] hosted worker error:', err);
      if (!tickError) tickError = err instanceof Error ? err.constructor.name : 'UnknownError';
    }
    if (tickError) {
      await upsertHeartbeatError(db, now, tickError);
    } else {
      const durationMs = Date.now() - tickStart;
      await upsertHeartbeatSuccess(db, now, durationMs);
    }
    tickCount += 1;
    if (tickCount % PURGE_INTERVAL_TICKS === 0) {
      purgeExpiredIdempotencyKeys(db).catch((err) =>
        console.error('[worker] purge idempotency keys error:', err),
      );
    }
    // Operator alerting — only if configured
    const operatorEmail = process.env.OPERATOR_EMAIL ?? '';
    const fromEmail = process.env.FROM_EMAIL ?? process.env.POSTMARK_FROM_EMAIL ?? '';
    const postmarkApiToken = process.env.POSTMARK_API_TOKEN ?? '';
    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
    if (operatorEmail) {
      await sendOperatorAlerts(db, { operatorEmail, fromEmail, postmarkApiToken, baseUrl });
    }
    if (!stopped) {
      timeout = setTimeout(tick, intervalMs);
    }
  }

  if (process.env.AEGIS_WORKER_ENABLED !== 'false') {
    timeout = setTimeout(tick, intervalMs);
  }

  return {
    async stop() {
      stopped = true;
      if (timeout) clearTimeout(timeout);
    },
  };
}
