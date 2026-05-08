import type { AegisDb } from '../db/index.js';
import { auditEvents } from '../db/schema.js';

export interface AuditInput {
  userId?: string | null;
  switchId?: string | null;
  relayConnectionId?: string | null;
  releaseRunId?: string | null;
  eventType: string;
  actorType: 'user' | 'system' | 'relay' | 'contact' | 'admin';
  actorId?: string | null;
  metadata?: Record<string, unknown> | null;
}

// Exact key names always redacted
const EXACT_REDACTED_KEYS = new Set([
  'email', 'phone', 'fullName', 'name', 'relationship',
  'institutionName', 'accountNumber', 'referenceHint',
  'assetDescription', 'locationNotes', 'executorNotes', 'backupNotes',
  'telegramHandle', 'password', 'passwordHash', 'secret',
  'apiKey', 'keyMaterial', 'plaintext', 'stripeSecret',
  'botToken', 'smtpPassword', 'privateKey', 'claimToken',
  'resetToken', 'ssn', 'dob', 'address', 'pin', 'otp',
]);

// CamelCase suffix patterns that indicate sensitive fields
const REDACTED_SUFFIXES = [
  'Password', 'Secret', 'Token', 'Email', 'Phone',
  'Name', 'Hash', 'Key', 'Notes',
];

function isKeyRedacted(key: string): boolean {
  if (EXACT_REDACTED_KEYS.has(key)) return true;
  return REDACTED_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const isSensitive = isKeyRedacted(key);
    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !Array.isArray(item)
          ? sanitizeAuditMetadata(item as Record<string, unknown>)
          : item,
      );
    } else if (value !== null && typeof value === 'object') {
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
  // relayConnectionId and releaseRunId are not columns on audit_events; store in metadata (not PII)
  const mergedMetadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
    ...(input.relayConnectionId ? { relayConnectionId: input.relayConnectionId } : {}),
    ...(input.releaseRunId ? { releaseRunId: input.releaseRunId } : {}),
  };

  const hasMetadata = Object.keys(mergedMetadata).length > 0;
  const sanitizedMetadata = hasMetadata
    ? sanitizeAuditMetadata(mergedMetadata)
    : null;

  try {
    await db.insert(auditEvents).values({
      userId: input.userId ?? null,
      switchId: input.switchId ?? null,
      eventType: input.eventType,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      metadata: sanitizedMetadata,
    });
  } catch (err) {
    console.error('[audit] Failed to write audit event:', input.eventType, err);
  }
}
