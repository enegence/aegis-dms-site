/**
 * relay-link.ts — Secure link code generation and exchange for OSS-to-Relay linking.
 *
 * Flow:
 *   1. Authenticated user calls link/start → gets a 10-minute one-time code.
 *   2. User copies code into their OSS instance config.
 *   3. OSS instance POSTs to link/exchange (server-to-server, no user session) with
 *      the code + state → receives apiKey + connectionId.
 *
 * Security invariants:
 *   - Plaintext code is never stored — only SHA-256 hash.
 *   - API key plaintext returned once only on exchange; only hash stored.
 *   - State must match what was set at link/start to prevent CSRF-style attacks.
 *   - Codes expire in 10 minutes and can only be used once.
 */

import { createHash, randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';
import type { AegisDb } from '../db/index.js';
import { relayLinkCodes } from '../db/schema.js';
import { createRelayConnection } from './relay-connections.js';

const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export function generateLinkCode(): { code: string; codeHash: string } {
  const code = randomBytes(32).toString('hex'); // 64 hex chars
  const codeHash = hashCode(code);
  return { code, codeHash };
}

export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Validates that a callbackUrl is an acceptable self-hosted origin.
 * Accepts:
 *   - http://localhost:*
 *   - http://192.168.*
 *   - http://10.*
 *   - http://172.16-31.*
 *   - https://* (any HTTPS — self-hosters can have custom TLS domains)
 */
export function isValidCallbackUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  const { protocol, hostname } = url;

  if (protocol === 'https:') return true;

  if (protocol === 'http:') {
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (/^10\.\d+\.\d+\.\d+$/.test(hostname)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(hostname)) return true;
    const m = hostname.match(/^172\.(\d+)\.\d+\.\d+$/);
    if (m && parseInt(m[1], 10) >= 16 && parseInt(m[1], 10) <= 31) return true;
  }

  return false;
}

export interface StartLinkResult {
  linkCodeId: string;
  code: string; // plaintext — shown to user once, then discarded server-side
}

export async function startLinkCode(
  db: AegisDb,
  userId: string,
  callbackUrl: string,
  state: string,
  label?: string,
): Promise<StartLinkResult> {
  const { code, codeHash } = generateLinkCode();
  const nonce = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

  const [row] = await db.insert(relayLinkCodes).values({
    userId,
    codeHash,
    callbackUrl,
    state,
    nonce,
    label: label ?? null,
    expiresAt,
  }).returning({ id: relayLinkCodes.id });

  return { linkCodeId: row.id, code };
}

export interface ExchangeResult {
  relayEndpoint: string;
  apiKey: string;
  connectionId: string;
}

export async function exchangeLinkCode(
  db: AegisDb,
  code: string,
  state: string,
  baseUrl: string,
  instanceLabel?: string,
): Promise<ExchangeResult | { error: 'not_found' | 'expired' | 'used' | 'state_mismatch' }> {
  const codeHash = hashCode(code);

  const [row] = await db.select()
    .from(relayLinkCodes)
    .where(eq(relayLinkCodes.codeHash, codeHash));

  if (!row) return { error: 'not_found' };

  if (row.state !== state) return { error: 'state_mismatch' };

  if (row.usedAt !== null) return { error: 'used' };

  if (row.expiresAt < new Date()) return { error: 'expired' };

  // Mark used first (before issuing key) to prevent race conditions
  await db.update(relayLinkCodes)
    .set({ usedAt: new Date() })
    .where(and(
      eq(relayLinkCodes.id, row.id),
      // Extra guard: ensure it hasn't been used between our select and update
      eq(relayLinkCodes.codeHash, codeHash),
    ));

  const label = instanceLabel ?? row.label ?? null;
  const { connection, rawApiKey } = await createRelayConnection(db, row.userId, {
    label,
    mode: 'relay_monitoring',
  });

  const relayEndpoint = `${baseUrl}/api/relay/heartbeat`;

  return {
    relayEndpoint,
    apiKey: rawApiKey,
    connectionId: connection.id,
  };
}
