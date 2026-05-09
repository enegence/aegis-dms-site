/**
 * Tests for hosted notification dispatch.
 *
 * External transports (Postmark, Telegram) are mocked so no real API calls
 * are made. The DB is real (test PostgreSQL) so we can verify that events
 * are persisted correctly and contain no plaintext PII.
 *
 * Security invariants verified:
 *  - notification_events.recipient_ref is a contactId (UUID) — never an email or handle
 *  - notification_events does not contain plaintext email addresses
 *  - notification_events does not contain plaintext telegram handles
 *  - Postmark failures are caught; event recorded with status='failed', error redacted
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';

// ── Mock postmark BEFORE any imports that transitively load email.ts ──────────

const mockSendEmail = vi.fn();

vi.mock('postmark', () => {
  class FakeServerClient {
    sendEmail = mockSendEmail;
  }
  return { ServerClient: FakeServerClient };
});

// ── Mock global fetch for Telegram ───────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { buildApp } from '../src/index.js';
import { notificationEvents } from '../src/db/schema.js';
import {
  sendContactClaimNotification,
  sendRelayOfflineAlert,
  sendOwnerAlert,
} from '../src/services/notifications.js';
import type { AppConfig } from '../src/config.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTelegramOkResponse(messageId = 42) {
  return Promise.resolve({
    ok: true,
    json: async () => ({ ok: true, result: { message_id: messageId } }),
    status: 200,
  } as unknown as Response);
}

/** Build a config override that has a non-empty postmark token so sendEmailStructured
 * actually creates a client (and hits the mock) rather than bailing with no_api_token. */
function makeConfig(base: AppConfig): AppConfig {
  return {
    ...base,
    postmark: { ...base.postmark, apiToken: 'fake-postmark-token' },
    telegram: { botToken: 'fake-telegram-token' },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Hosted notification dispatch', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let userId: string;
  let cfg: AppConfig;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    cfg = makeConfig(app.config);

    // Create a real user so FK constraints on notification_events.user_id pass.
    const regRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Notify Test User',
        email: 'notifytest@example.com',
        password: 'testpass12345',
        timezone: 'UTC',
      },
    });
    const body = JSON.parse(regRes.payload) as { user?: { id: string } };
    userId = body.user?.id ?? '';
    expect(userId).toBeTruthy();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Postmark succeeds
    mockSendEmail.mockResolvedValue({ MessageID: 'postmark-msg-001' });

    // Default: Telegram succeeds
    mockFetch.mockImplementation(() => makeTelegramOkResponse());
  });

  // ── sendContactClaimNotification ──────────────────────────────────────────

  describe('sendContactClaimNotification', () => {
    it('calls Postmark with the decrypted email address', async () => {
      await sendContactClaimNotification(
        { db: app.db, config: cfg },
        {
          userId,
          contactId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          toEmail: 'contact@example.com',
          subject: 'You have a claim',
          htmlBody: '<p>claim</p>',
          textBody: 'claim',
          claimUrl: 'https://aegisdms.life/claim/abc',
        },
      );

      expect(mockSendEmail).toHaveBeenCalledOnce();
      const callArg = mockSendEmail.mock.calls[0][0] as {
        From: string;
        To: string;
        Subject: string;
      };
      expect(callArg.To).toBe('contact@example.com');
      expect(callArg.Subject).toBe('You have a claim');
    });

    it('calls Telegram when toTelegramHandle is provided', async () => {
      await sendContactClaimNotification(
        { db: app.db, config: cfg },
        {
          userId,
          contactId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
          toEmail: 'contact@example.com',
          toTelegramHandle: '@testuser',
          subject: 'You have a claim',
          htmlBody: '<p>claim</p>',
          textBody: 'claim',
          claimUrl: 'https://aegisdms.life/claim/abc',
        },
      );

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/sendMessage');
      const body = JSON.parse(options.body as string) as { chat_id: string };
      expect(body.chat_id).toBe('@testuser');
    });

    it('does NOT call Telegram when toTelegramHandle is absent', async () => {
      await sendContactClaimNotification(
        { db: app.db, config: cfg },
        {
          userId,
          contactId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567892',
          toEmail: 'contact@example.com',
          subject: 'You have a claim',
          htmlBody: '<p>claim</p>',
          textBody: 'claim',
          claimUrl: 'https://aegisdms.life/claim/abc',
        },
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('persists notification event with channel=email, provider=postmark, status=sent', async () => {
      // Use a unique contactId so the query only returns events from this test run
      const contactId = `a1b2c3d4-e5f6-7890-abcd-ef${Date.now().toString().slice(-6).padStart(6, '0')}`;

      await sendContactClaimNotification(
        { db: app.db, config: cfg },
        {
          userId,
          contactId,
          toEmail: 'contact@example.com',
          subject: 'Claim ready',
          htmlBody: '<p>claim</p>',
          textBody: 'claim',
          claimUrl: 'https://aegisdms.life/claim/xyz',
        },
      );

      const events = await app.db
        .select()
        .from(notificationEvents)
        .where(eq(notificationEvents.recipientRef, contactId));

      expect(events.length).toBeGreaterThanOrEqual(1);
      const ev = events[0];
      expect(ev.channel).toBe('email');
      expect(ev.provider).toBe('postmark');
      expect(ev.status).toBe('sent');
      expect(ev.recipientRef).toBe(contactId);
    });

    it('notification event recipientRef is contactId (UUID) — not plaintext email', async () => {
      const contactId = `b2c3d4e5-f6a7-8901-bcde-f1${Date.now().toString().slice(-6).padStart(6, '0')}`;
      const plainTextEmail = 'secretemail@pii-test.com';

      await sendContactClaimNotification(
        { db: app.db, config: cfg },
        {
          userId,
          contactId,
          toEmail: plainTextEmail,
          subject: 'PII test',
          htmlBody: '<p>test</p>',
          textBody: 'test',
          claimUrl: 'https://aegisdms.life/claim/piitest',
        },
      );

      const events = await app.db
        .select()
        .from(notificationEvents)
        .where(eq(notificationEvents.recipientRef, contactId));

      expect(events.length).toBeGreaterThanOrEqual(1);
      for (const ev of events) {
        // recipientRef must be the contactId UUID — never the email address
        expect(ev.recipientRef).toBe(contactId);
        expect(ev.recipientRef).not.toContain('@');
        expect(ev.recipientRef).not.toBe(plainTextEmail);

        // No field in the stored event should contain the plaintext email
        const evStr = JSON.stringify(ev);
        expect(evStr).not.toContain(plainTextEmail);
      }
    });

    it('notification event does not contain plaintext telegram handle', async () => {
      const contactId = `c3d4e5f6-a7b8-9012-cdef-12${Date.now().toString().slice(-6).padStart(6, '0')}`;
      const telegramHandle = '@secrethandle_piitest';

      await sendContactClaimNotification(
        { db: app.db, config: cfg },
        {
          userId,
          contactId,
          toEmail: 'contact@example.com',
          toTelegramHandle: telegramHandle,
          subject: 'TG PII test',
          htmlBody: '<p>test</p>',
          textBody: 'test',
          claimUrl: 'https://aegisdms.life/claim/tg-piitest',
        },
      );

      const events = await app.db
        .select()
        .from(notificationEvents)
        .where(eq(notificationEvents.recipientRef, contactId));

      expect(events.length).toBeGreaterThanOrEqual(1);
      for (const ev of events) {
        const evStr = JSON.stringify(ev);
        expect(evStr).not.toContain(telegramHandle);
        expect(evStr).not.toContain('secrethandle_piitest');
      }
    });

    it('records status=failed when Postmark throws; error is redacted', async () => {
      mockSendEmail.mockRejectedValue(
        Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' }),
      );

      const contactId = `d4e5f6a7-b8c9-0123-defa-23${Date.now().toString().slice(-6).padStart(6, '0')}`;

      await sendContactClaimNotification(
        { db: app.db, config: cfg },
        {
          userId,
          contactId,
          toEmail: 'fail@example.com',
          subject: 'Failure test',
          htmlBody: '<p>fail</p>',
          textBody: 'fail',
          claimUrl: 'https://aegisdms.life/claim/fail',
        },
      );

      const events = await app.db
        .select()
        .from(notificationEvents)
        .where(eq(notificationEvents.recipientRef, contactId));

      expect(events.length).toBeGreaterThanOrEqual(1);
      const ev = events[0];
      expect(ev.status).toBe('failed');

      // Error stored must not contain plaintext address
      const evStr = JSON.stringify(ev);
      expect(evStr).not.toContain('fail@example.com');
    });
  });

  // ── sendRelayOfflineAlert ─────────────────────────────────────────────────

  describe('sendRelayOfflineAlert', () => {
    it('calls Postmark with a relay offline subject', async () => {
      await sendRelayOfflineAlert(
        { db: app.db, config: cfg },
        {
          userId,
          toEmail: 'owner@example.com',
          relayConnectionId: 'relay-conn-uuid-abc',
          offlineSince: new Date('2026-05-08T10:00:00Z'),
        },
      );

      expect(mockSendEmail).toHaveBeenCalledOnce();
      const callArg = mockSendEmail.mock.calls[0][0] as { Subject: string };
      expect(callArg.Subject).toContain('offline');
    });

    it('writes a notification event with status=sent', async () => {
      await sendRelayOfflineAlert(
        { db: app.db, config: cfg },
        {
          userId,
          toEmail: 'owner@example.com',
          relayConnectionId: 'relay-conn-uuid-def',
          offlineSince: new Date('2026-05-08T10:00:00Z'),
        },
      );

      const events = await app.db
        .select()
        .from(notificationEvents)
        .where(eq(notificationEvents.recipientRef, `user:${userId}`));

      expect(events.length).toBeGreaterThanOrEqual(1);
      // Find the most recent event
      const ev = events[events.length - 1];
      expect(ev.channel).toBe('email');
      expect(ev.provider).toBe('postmark');
      expect(ev.status).toBe('sent');
    });

    it('does not store plaintext owner email in notification event', async () => {
      const plainTextEmail = 'owner-piitest@relay-alert.com';

      // Reset events to isolate — we'll verify none of the events for this userId contain the email
      mockSendEmail.mockResolvedValue({ MessageID: 'pii-check-msg' });

      await sendRelayOfflineAlert(
        { db: app.db, config: cfg },
        {
          userId,
          toEmail: plainTextEmail,
          relayConnectionId: 'relay-conn-uuid-pii',
          offlineSince: new Date('2026-05-08T10:00:00Z'),
        },
      );

      const events = await app.db
        .select()
        .from(notificationEvents)
        .where(eq(notificationEvents.providerMessageId, 'pii-check-msg'));

      expect(events.length).toBeGreaterThanOrEqual(1);
      for (const ev of events) {
        const evStr = JSON.stringify(ev);
        expect(evStr).not.toContain(plainTextEmail);
      }
    });
  });

  // ── sendOwnerAlert ────────────────────────────────────────────────────────

  describe('sendOwnerAlert', () => {
    it('calls Postmark with the supplied subject and records status=sent', async () => {
      mockSendEmail.mockResolvedValue({ MessageID: 'owner-alert-msg-001' });

      await sendOwnerAlert(
        { db: app.db, config: cfg },
        {
          userId,
          toEmail: 'owner@example.com',
          subject: 'Release started',
          htmlBody: '<p>release</p>',
          textBody: 'release',
          purpose: 'release_started',
        },
      );

      expect(mockSendEmail).toHaveBeenCalledOnce();
      const callArg = mockSendEmail.mock.calls[0][0] as { Subject: string };
      expect(callArg.Subject).toBe('Release started');

      const events = await app.db
        .select()
        .from(notificationEvents)
        .where(eq(notificationEvents.providerMessageId, 'owner-alert-msg-001'));

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].status).toBe('sent');
    });
  });
});
