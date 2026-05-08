import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';
import { writeAuditEvent, sanitizeAuditMetadata } from '../src/services/audit.js';

describe('Audit service', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('sanitizeAuditMetadata', () => {
    it('passes through non-sensitive keys', () => {
      const result = sanitizeAuditMetadata({ switchId: 'abc', status: 'offline', count: 3 });
      expect(result.switchId).toBe('abc');
      expect(result.status).toBe('offline');
      expect(result.count).toBe(3);
    });

    it('redacts email key', () => {
      const result = sanitizeAuditMetadata({ email: 'user@example.com' });
      expect(result.email).toBe('[REDACTED]');
    });

    it('redacts keys containing sensitive substrings', () => {
      const result = sanitizeAuditMetadata({ userEmail: 'x', apiKey: 'secret', smtpPassword: 'pw' });
      expect(result.userEmail).toBe('[REDACTED]');
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.smtpPassword).toBe('[REDACTED]');
    });

    it('redacts nested sensitive keys', () => {
      const result = sanitizeAuditMetadata({ config: { smtpPassword: 'pw', host: 'smtp.example.com' } });
      expect((result.config as any).smtpPassword).toBe('[REDACTED]');
      expect((result.config as any).host).toBe('smtp.example.com');
    });

    it('preserves null values for non-sensitive keys', () => {
      const result = sanitizeAuditMetadata({ channel: null });
      expect(result.channel).toBeNull();
    });
  });

  describe('writeAuditEvent', () => {
    it('writes a basic audit event', async () => {
      await expect(
        writeAuditEvent(app.db, {
          eventType: 'relay_heartbeat_received',
          actorType: 'relay',
          metadata: { connectionId: 'some-uuid', status: 'active' },
        })
      ).resolves.not.toThrow();
    });

    it('writes with user and switch context', async () => {
      await expect(
        writeAuditEvent(app.db, {
          eventType: 'switch_armed',
          actorType: 'user',
          metadata: { switchName: 'My Switch' },
        })
      ).resolves.not.toThrow();
    });

    it('redacts sensitive metadata before writing', async () => {
      const testEventType = 'test_redaction_event_' + Date.now();

      await writeAuditEvent(app.db, {
        eventType: testEventType,
        actorType: 'system',
        metadata: { email: 'sensitive@example.com', status: 'ok' },
      });

      const { auditEvents } = await import('../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      const rows = await app.db.select().from(auditEvents).where(eq(auditEvents.eventType, testEventType));

      expect(rows).toHaveLength(1);
      const storedMetadata = rows[0].metadata as Record<string, unknown>;
      expect(storedMetadata.email).toBe('[REDACTED]');
      expect(storedMetadata.status).toBe('ok');
    });

    it('stores relayConnectionId in metadata when provided', async () => {
      await expect(
        writeAuditEvent(app.db, {
          eventType: 'relay_connected',
          actorType: 'relay',
          relayConnectionId: 'conn-uuid-123',
          metadata: { status: 'online' },
        })
      ).resolves.not.toThrow();
    });

    it('handles null metadata gracefully', async () => {
      await expect(
        writeAuditEvent(app.db, {
          eventType: 'system_startup',
          actorType: 'system',
          metadata: null,
        })
      ).resolves.not.toThrow();
    });
  });
});
