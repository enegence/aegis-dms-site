/**
 * Tests for email-templates.ts (Phase 5 Task 11).
 *
 * Snapshot-style: verify structural correctness of each template builder.
 * Pure functions — no DB or mocking required.
 */

import { describe, it, expect } from 'vitest';
import {
  buildVerifyEmailTemplate,
  buildPasswordResetTemplate,
  buildClaimNotificationTemplate,
  buildClaimEscalationTemplate,
  buildRelayOfflineAlertTemplate,
  buildBillingStateChangeTemplate,
  buildAccountDeletionTemplate,
  type EmailTemplate,
} from '../src/services/email-templates.js';

const BASE_URL = 'https://app.aegisdms.life';
const LEGAL_FOOTER_MARKER = 'Aegis DMS';
const LEGAL_EMAIL_MARKER = 'support@aegisdms.life';
const AUTOMATED_MARKER = 'automated message';

function assertTemplateStructure(t: EmailTemplate, label: string) {
  expect(t.subject, `${label}: subject must be non-empty`).toBeTruthy();
  expect(t.subject, `${label}: subject must be a string`).toBeTypeOf('string');
  expect(t.html, `${label}: html must be non-empty`).toBeTruthy();
  expect(t.text, `${label}: text must be non-empty`).toBeTruthy();
  expect(t.html, `${label}: html must contain legal brand footer`).toContain(LEGAL_FOOTER_MARKER);
  expect(t.html, `${label}: html must contain support email`).toContain(LEGAL_EMAIL_MARKER);
  expect(t.html, `${label}: html must contain automated message note`).toContain(AUTOMATED_MARKER);
  expect(t.text, `${label}: text must contain legal footer`).toContain(LEGAL_FOOTER_MARKER);
  expect(t.html, `${label}: html must not contain literal 'undefined'`).not.toContain('undefined');
  expect(t.text, `${label}: text must not contain literal 'undefined'`).not.toContain('undefined');
}

// ── 1. Verify email ──────────────────────────────────────────────────────────

describe('buildVerifyEmailTemplate', () => {
  const token = 'test-verify-token-abc123';
  const t = buildVerifyEmailTemplate(BASE_URL, token);

  it('has correct structure', () => {
    assertTemplateStructure(t, 'verifyEmail');
  });

  it('includes the verify link with token in html', () => {
    expect(t.html).toContain(`/verify-email?token=${token}`);
  });

  it('includes the verify link with token in text', () => {
    expect(t.text).toContain(`/verify-email?token=${token}`);
  });

  it('subject references verification', () => {
    expect(t.subject.toLowerCase()).toContain('verify');
  });
});

// ── 2. Password reset ────────────────────────────────────────────────────────

describe('buildPasswordResetTemplate', () => {
  const token = 'reset-token-xyz789';
  const t = buildPasswordResetTemplate(BASE_URL, token);

  it('has correct structure', () => {
    assertTemplateStructure(t, 'passwordReset');
  });

  it('includes the reset link with token in html', () => {
    expect(t.html).toContain(`/reset-password?token=${token}`);
  });

  it('includes the reset link with token in text', () => {
    expect(t.text).toContain(`/reset-password?token=${token}`);
  });

  it('mentions 15 minute expiry', () => {
    expect(t.html).toContain('15');
    expect(t.text).toContain('15');
  });

  it('subject references password reset', () => {
    expect(t.subject.toLowerCase()).toContain('password');
  });
});

// ── 3. Claim notification ────────────────────────────────────────────────────

describe('buildClaimNotificationTemplate', () => {
  const claimToken = 'claim-tok-001';
  const t = buildClaimNotificationTemplate(BASE_URL, claimToken);

  it('has correct structure', () => {
    assertTemplateStructure(t, 'claimNotification');
  });

  it('includes the claim link in html', () => {
    expect(t.html).toContain(`/claim/${claimToken}`);
  });

  it('includes the claim link in text', () => {
    expect(t.text).toContain(`/claim/${claimToken}`);
  });

  it('does not contain user-specific account information or personal names', () => {
    // Template should not have templating placeholders or literal "undefined"
    expect(t.html).not.toContain('{{');
    expect(t.html).not.toContain('undefined');
    // No raw email addresses other than the support address
    const emailPattern = /\b[a-z0-9._%+-]+@(?!aegisdms\.life)[a-z0-9.-]+\.[a-z]{2,}\b/i;
    expect(emailPattern.test(t.html)).toBe(false);
  });
});

// ── 4. Claim escalation ──────────────────────────────────────────────────────

describe('buildClaimEscalationTemplate', () => {
  const claimToken = 'claim-tok-002';

  it('has correct structure for attempt 1', () => {
    const t = buildClaimEscalationTemplate(BASE_URL, claimToken, 1);
    assertTemplateStructure(t, 'claimEscalation attempt=1');
  });

  it('has correct structure for attempt 3', () => {
    const t = buildClaimEscalationTemplate(BASE_URL, claimToken, 3);
    assertTemplateStructure(t, 'claimEscalation attempt=3');
  });

  it('includes attempt number in html', () => {
    const t = buildClaimEscalationTemplate(BASE_URL, claimToken, 2);
    expect(t.html).toContain('2');
  });

  it('includes attempt number in text', () => {
    const t = buildClaimEscalationTemplate(BASE_URL, claimToken, 3);
    expect(t.text).toContain('3');
  });

  it('includes the claim link', () => {
    const t = buildClaimEscalationTemplate(BASE_URL, claimToken, 1);
    expect(t.html).toContain(`/claim/${claimToken}`);
    expect(t.text).toContain(`/claim/${claimToken}`);
  });
});

// ── 5. Relay offline alert ───────────────────────────────────────────────────

describe('buildRelayOfflineAlertTemplate', () => {
  const relayName = 'my-home-relay';
  const offlineSince = new Date('2026-05-10T14:30:00.000Z');
  const t = buildRelayOfflineAlertTemplate(relayName, offlineSince);

  it('has correct structure', () => {
    assertTemplateStructure(t, 'relayOffline');
  });

  it('includes relay name in html', () => {
    expect(t.html).toContain(relayName);
  });

  it('includes relay name in text', () => {
    expect(t.text).toContain(relayName);
  });

  it('includes offline timestamp in html', () => {
    expect(t.html).toContain('2026');
  });

  it('subject references relay and offline', () => {
    expect(t.subject.toLowerCase()).toContain('relay');
    expect(t.subject.toLowerCase()).toContain('offline');
  });
});

// ── 6. Billing state change ──────────────────────────────────────────────────

describe('buildBillingStateChangeTemplate', () => {
  it('payment_failed: has correct structure', () => {
    const t = buildBillingStateChangeTemplate('payment_failed', 'Aegis Relay');
    assertTemplateStructure(t, 'billing payment_failed');
    expect(t.html).toContain('Aegis Relay');
    expect(t.subject.toLowerCase()).toContain('payment');
  });

  it('subscription_cancelled: has correct structure', () => {
    const t = buildBillingStateChangeTemplate('subscription_cancelled', 'Aegis Hosted');
    assertTemplateStructure(t, 'billing subscription_cancelled');
    expect(t.html).toContain('Aegis Hosted');
    expect(t.subject.toLowerCase()).toContain('cancel');
  });

  it('subscription_renewed: has correct structure', () => {
    const t = buildBillingStateChangeTemplate('subscription_renewed', 'Aegis Relay');
    assertTemplateStructure(t, 'billing subscription_renewed');
    expect(t.html).toContain('Aegis Relay');
    expect(t.subject.toLowerCase()).toContain('renew');
  });

  it('works without planName (defaults gracefully)', () => {
    const t = buildBillingStateChangeTemplate('subscription_renewed');
    assertTemplateStructure(t, 'billing no planName');
    expect(t.html).not.toContain('undefined');
    expect(t.text).not.toContain('undefined');
  });
});

// ── 7. Account deletion ──────────────────────────────────────────────────────

describe('buildAccountDeletionTemplate', () => {
  const t = buildAccountDeletionTemplate();

  it('has correct structure', () => {
    assertTemplateStructure(t, 'accountDeletion');
  });

  it('mentions permanent deletion in html', () => {
    expect(t.html.toLowerCase()).toContain('deleted');
  });

  it('mentions permanent deletion in text', () => {
    expect(t.text.toLowerCase()).toContain('deleted');
  });

  it('subject references account deletion', () => {
    expect(t.subject.toLowerCase()).toContain('deleted');
  });

  it('contains no PII placeholders', () => {
    // Should not reference any user-specific data
    expect(t.html).not.toContain('{{');
    expect(t.html).not.toContain('undefined');
  });
});
