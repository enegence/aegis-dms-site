import type { AegisDb } from '../db/index.js';
import type { AppConfig } from '../config.js';
import { runRelayMonitorOnce } from '../services/relay-monitor.js';
import { runRelayEscrowCascadeOnce } from '../services/relay-assisted-cascade.js';
import { runHostedWorkerOnce } from './hosted-worker.js';

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
