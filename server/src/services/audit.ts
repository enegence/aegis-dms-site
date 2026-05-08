import type { AegisDb } from '../db/index.js';
import { auditEvents } from '../db/schema.js';

export interface AuditInput {
  userId?: string | null;
  switchId?: string | null;
  relayConnectionId?: string | null;
  eventType: string;
  actorType: 'user' | 'system' | 'relay' | 'contact' | 'admin';
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
}

const REDACTED_KEYS = new Set([
  'email', 'phone', 'name', 'fullName', 'institution', 'institutionName',
  'account', 'accountNumber', 'password', 'secret', 'token', 'apiKey',
  'keyMaterial', 'plaintext', 'executorNotes', 'stripeSecret', 'botToken',
  'smtpPassword', 'privateKey', 'ssn', 'dob', 'address',
]);

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = [...REDACTED_KEYS].some(
      (k) => lowerKey.includes(k.toLowerCase()),
    );
    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeAuditMetadata(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export async function writeAuditEvent(
  db: AegisDb,
  input: AuditInput,
): Promise<void> {
  // relayConnectionId is not a column on audit_events; store it in metadata (it's not PII)
  let rawMetadata = input.metadata ?? null;
  if (input.relayConnectionId) {
    rawMetadata = {
      ...(rawMetadata ?? {}),
      relayConnectionId: input.relayConnectionId,
    };
  }

  const sanitizedMetadata = rawMetadata
    ? sanitizeAuditMetadata(rawMetadata)
    : null;

  await db.insert(auditEvents).values({
    userId: input.userId ?? null,
    switchId: input.switchId ?? null,
    eventType: input.eventType,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    metadata: sanitizedMetadata,
  });
}
