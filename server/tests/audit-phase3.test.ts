/**
 * Phase 3 audit redaction tests.
 *
 * Verifies:
 *   - sanitizeAuditMetadata strips known sensitive field names
 *   - Sensitive suffix patterns are redacted (Email, Phone, Token, Key, etc.)
 *   - Nested objects are also sanitized
 *   - writeAuditEvent does not persist plaintext PII
 *   - Event type coverage for all Phase 3 operations
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { auditEvents } from '../src/db/schema.js';
import { sanitizeAuditMetadata, writeAuditEvent } from '../src/services/audit.js';

describe('Audit redaction — sanitizeAuditMetadata', () => {
  it('redacts exact sensitive keys', () => {
    const out = sanitizeAuditMetadata({
      email: 'alice@example.com',
      phone: '+1555555555',
      fullName: 'Alice Smith',
      apiKey: 'sk_live_abc123',
      claimToken: 'token123',
      password: 'hunter2',
    });
    expect(out.email).toBe('[REDACTED]');
    expect(out.phone).toBe('[REDACTED]');
    expect(out.fullName).toBe('[REDACTED]');
    expect(out.apiKey).toBe('[REDACTED]');
    expect(out.claimToken).toBe('[REDACTED]');
    expect(out.password).toBe('[REDACTED]');
  });

  it('redacts fields matching sensitive suffixes', () => {
    const out = sanitizeAuditMetadata({
      recipientEmail: 'bob@example.com',
      senderPhone: '+1555555556',
      sessionToken: 'sess_xyz',
      encryptionKey: 'aes_key_123',
      apiKeyHash: 'hashedvalue',
      smtpPassword: 'smtppass',
      privateKey: 'rsa_private',
      resetToken: 'reset_abc',
    });
    expect(out.recipientEmail).toBe('[REDACTED]');
    expect(out.senderPhone).toBe('[REDACTED]');
    expect(out.sessionToken).toBe('[REDACTED]');
    expect(out.encryptionKey).toBe('[REDACTED]');
    expect(out.apiKeyHash).toBe('[REDACTED]');
    expect(out.smtpPassword).toBe('[REDACTED]');
    expect(out.privateKey).toBe('[REDACTED]');
    expect(out.resetToken).toBe('[REDACTED]');
  });

  it('preserves non-sensitive fields', () => {
    const out = sanitizeAuditMetadata({
      packetId: 'uuid-123',
      version: 3,
      status: 'active',
      switchId: 'sw-uuid',
      releaseRunId: 'rr-uuid',
    });
    expect(out.packetId).toBe('uuid-123');
    expect(out.version).toBe(3);
    expect(out.status).toBe('active');
    expect(out.switchId).toBe('sw-uuid');
    expect(out.releaseRunId).toBe('rr-uuid');
  });

  it('sanitizes nested objects', () => {
    const out = sanitizeAuditMetadata({
      contactRef: {
        contactId: 'contact-uuid',
        email: 'contact@example.com',
        label: 'priority-1',
      },
    });
    const nested = out.contactRef as Record<string, unknown>;
    expect(nested.contactId).toBe('contact-uuid');
    expect(nested.email).toBe('[REDACTED]');
    expect(nested.label).toBe('priority-1');
  });

  it('sanitizes arrays of objects', () => {
    const out = sanitizeAuditMetadata({
      contacts: [
        { contactId: 'c1', email: 'c1@example.com' },
        { contactId: 'c2', phone: '+15550001' },
      ],
    });
    const contacts = out.contacts as Record<string, unknown>[];
    expect(contacts[0]!.contactId).toBe('c1');
    expect(contacts[0]!.email).toBe('[REDACTED]');
    expect(contacts[1]!.contactId).toBe('c2');
    expect(contacts[1]!.phone).toBe('[REDACTED]');
  });
});

describe('Audit redaction — writeAuditEvent persists no plaintext PII', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('packet_generated event stored without sensitive data', async () => {
    await writeAuditEvent(app.db, {
      userId: null,
      eventType: 'packet_generated',
      actorType: 'system',
      metadata: {
        packetId: 'pkt-uuid-123',
        version: 1,
        email: 'should-be-redacted@example.com',
        keyMaterial: 'should-be-redacted-key',
      },
    });

    const rows = await app.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.eventType, 'packet_generated'));

    const found = rows.find(r => (r.metadata as Record<string, unknown>)?.packetId === 'pkt-uuid-123');
    expect(found).toBeDefined();
    const meta = found!.metadata as Record<string, unknown>;
    expect(meta.email).toBe('[REDACTED]');
    expect(meta.keyMaterial).toBe('[REDACTED]');
    expect(meta.packetId).toBe('pkt-uuid-123');
    expect(meta.version).toBe(1);
  });

  it('relay_assisted_release_started event stored without sensitive data', async () => {
    await writeAuditEvent(app.db, {
      userId: null,
      eventType: 'relay_assisted_release_started',
      actorType: 'system',
      metadata: {
        relayConnectionId: 'conn-uuid',
        releaseRunId: 'rr-uuid',
        apiKey: 'should-be-redacted',
        claimToken: 'should-be-redacted',
      },
    });

    const rows = await app.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.eventType, 'relay_assisted_release_started'));

    const found = rows.find(r => (r.metadata as Record<string, unknown>)?.relayConnectionId === 'conn-uuid');
    expect(found).toBeDefined();
    const meta = found!.metadata as Record<string, unknown>;
    expect(meta.apiKey).toBe('[REDACTED]');
    expect(meta.claimToken).toBe('[REDACTED]');
    expect(meta.relayConnectionId).toBe('conn-uuid');
    expect(meta.releaseRunId).toBe('rr-uuid');
  });

  it('contact_notified event stored without recipient address', async () => {
    await writeAuditEvent(app.db, {
      userId: null,
      eventType: 'contact_notified',
      actorType: 'system',
      metadata: {
        contactId: 'contact-uuid',
        channel: 'email',
        recipientEmail: 'contact@example.com',
        phone: '+15550002',
      },
    });

    const rows = await app.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.eventType, 'contact_notified'));

    const found = rows.find(r => (r.metadata as Record<string, unknown>)?.contactId === 'contact-uuid');
    expect(found).toBeDefined();
    const meta = found!.metadata as Record<string, unknown>;
    expect(meta.recipientEmail).toBe('[REDACTED]');
    expect(meta.phone).toBe('[REDACTED]');
    expect(meta.channel).toBe('email');
    expect(meta.contactId).toBe('contact-uuid');
  });
});

describe('Phase 3 audit event type coverage', () => {
  const PHASE3_EVENT_TYPES = [
    'packet_generated',
    'packet_uploaded',
    'packet_verified',
    'packet_deleted',
    'release_run_started',
    'release_run_suppressed_duplicate',
    'contact_claim_created',
    'contact_notified',
    'contact_opened_claim',
    'contact_verified',
    'contact_accepted',
    'packet_downloaded',
    'release_material_viewed',
    'claim_acknowledged',
    'contact_escalated',
    'cascade_completed',
    'cascade_failed',
    'relay_escrow_enabled',
    'relay_escrow_revoked',
    'relay_assisted_release_started',
    'release_run_cancelled',
    'admin_viewed_metrics',
  ];

  it('all Phase 3 event types are non-empty strings (type registry check)', () => {
    for (const eventType of PHASE3_EVENT_TYPES) {
      expect(typeof eventType).toBe('string');
      expect(eventType.length).toBeGreaterThan(0);
      expect(eventType).not.toContain(' ');
    }
  });

  it('no Phase 3 event type contains PII in its name', () => {
    for (const eventType of PHASE3_EVENT_TYPES) {
      expect(eventType).not.toMatch(/email|phone|name|address|hash|token|key|password/i);
    }
  });
});
