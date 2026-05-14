import { inArray } from 'drizzle-orm';
import type { AegisDb } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { releaseRuns } from '../db/schema.js';
import { runRelayMonitorOnce } from '../services/relay-monitor.js';
import { runRelayEscrowCascadeOnce } from '../services/relay-assisted-cascade.js';
import { runHostedWorkerOnce } from './hosted-worker.js';
import { writeAuditEvent } from '../services/audit.js';

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

  await writeAuditEvent(db, {
    eventType: 'worker_recovery_started',
    actorType: 'system',
    metadata: { activeRunCount: rows.length },
  });

  await writeAuditEvent(db, {
    eventType: 'worker_recovery_completed',
    actorType: 'system',
    metadata: { activeRunCount: rows.length },
  });

  return rows.length;
}

export interface WorkerOptions {
  intervalSeconds?: number;
  postmarkApiToken?: string;
  fromEmail?: string;
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

  // Recovery: on startup, find and log any in-flight release runs so the
  // worker can resume from current state rather than starting fresh.
  recoverActiveReleaseRuns(db).catch((err) =>
    console.error('[worker] recovery error:', err),
  );

  async function tick() {
    if (stopped) return;
    try {
      await runRelayMonitorOnce(db, apiToken, from);
    } catch (err) {
      console.error('[worker] relay monitor error:', err);
    }
    try {
      await runRelayEscrowCascadeOnce(db, config);
    } catch (err) {
      console.error('[worker] relay escrow cascade error:', err);
    }
    try {
      await runHostedWorkerOnce(db, config);
    } catch (err) {
      console.error('[worker] hosted worker error:', err);
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
