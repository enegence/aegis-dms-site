/**
 * Production-safe email template builders (Phase 5 Task 11).
 *
 * Each function returns an EmailTemplate with subject, html, and text.
 * All HTML uses inline styles and consistent Aegis branding.
 * Every HTML template includes a legal footer.
 * No PII beyond what is strictly required for the specific email purpose.
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Shared layout helpers ────────────────────────────────────────────────────

const LEGAL_FOOTER_HTML = `
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #DDE8F4;font-family:sans-serif;font-size:11px;color:#8AAAC8;">
    Aegis DMS &middot; <a href="mailto:support@aegisdms.life" style="color:#8AAAC8;text-decoration:none;">support@aegisdms.life</a> &middot; This is an automated message.
  </div>
`;

const LEGAL_FOOTER_TEXT = `\n\n---\nAegis DMS · support@aegisdms.life · This is an automated message.`;

function wrapHtml(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F4F8FB;">
  <div style="font-family:sans-serif;max-width:520px;margin:40px auto;padding:0 16px;">
    <div style="background:#0B1C2C;padding:20px 24px;border-radius:6px 6px 0 0;">
      <span style="font-size:20px;font-weight:700;color:#DDE8F4;letter-spacing:0.01em;">Aegis DMS</span>
    </div>
    <div style="background:#ffffff;padding:28px 24px;border-radius:0 0 6px 6px;border:1px solid #DDE8F4;border-top:none;">
      ${body}
      ${LEGAL_FOOTER_HTML}
    </div>
  </div>
</body>
</html>
`.trim();
}

function ctaButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#0B1C2C;color:#DDE8F4;padding:12px 28px;text-decoration:none;border-radius:4px;font-weight:600;font-size:14px;margin:20px 0;">${label}</a>`;
}

// ── Template builders ────────────────────────────────────────────────────────

/**
 * Email address verification.
 */
export function buildVerifyEmailTemplate(baseUrl: string, token: string): EmailTemplate {
  const link = `${baseUrl}/verify-email?token=${token}`;
  const subject = 'Verify your Aegis DMS email address';

  const body = `
    <h1 style="font-size:22px;color:#0B1C2C;margin:0 0 12px;">Verify your email address</h1>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 8px;">Click the button below to verify your Aegis DMS email address and activate your account.</p>
    ${ctaButton(link, 'Verify Email')}
    <p style="color:#8AAAC8;font-size:12px;margin:0;">If you didn't create an Aegis DMS account, you can safely ignore this email.</p>
  `;

  const text = `Verify your Aegis DMS email address\n\nClick the link below to verify your email address:\n${link}\n\nIf you didn't create an Aegis DMS account, you can safely ignore this email.${LEGAL_FOOTER_TEXT}`;

  return { subject, html: wrapHtml(subject, body), text };
}

/**
 * Password reset.
 */
export function buildPasswordResetTemplate(baseUrl: string, token: string): EmailTemplate {
  const link = `${baseUrl}/reset-password?token=${token}`;
  const subject = 'Reset your Aegis DMS password';

  const body = `
    <h1 style="font-size:22px;color:#0B1C2C;margin:0 0 12px;">Reset your password</h1>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 8px;">We received a request to reset your Aegis DMS password. Click the button below to choose a new password. This link expires in 15 minutes.</p>
    ${ctaButton(link, 'Reset Password')}
    <p style="color:#8AAAC8;font-size:12px;margin:0;">If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
  `;

  const text = `Reset your Aegis DMS password\n\nWe received a request to reset your password. Click the link below to choose a new password (expires in 15 minutes):\n${link}\n\nIf you didn't request a password reset, ignore this email.${LEGAL_FOOTER_TEXT}`;

  return { subject, html: wrapHtml(subject, body), text };
}

/**
 * Claim notification — sent to designated contacts when a release is triggered.
 */
export function buildClaimNotificationTemplate(baseUrl: string, claimToken: string): EmailTemplate {
  const link = `${baseUrl}/claim/${claimToken}`;
  const subject = 'You have a message waiting in Aegis DMS';

  const body = `
    <h1 style="font-size:22px;color:#0B1C2C;margin:0 0 12px;">A message has been released to you</h1>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 8px;">
      Someone has designated you as a recipient through Aegis DMS, a digital legacy service. A message or document package has been released for your access.
    </p>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 16px;">
      Click the button below to view your message. You will be asked to verify your identity before accessing the contents.
    </p>
    ${ctaButton(link, 'View Your Message')}
    <p style="color:#8AAAC8;font-size:12px;margin:0;">
      This link is unique to you. Do not share it with others. If you believe you received this in error, contact us at support@aegisdms.life.
    </p>
  `;

  const text = `You have a message waiting in Aegis DMS\n\nSomeone has designated you as a recipient through Aegis DMS, a digital legacy service. A message or document package has been released for your access.\n\nClick the link below to view your message (you will be asked to verify your identity):\n${link}\n\nThis link is unique to you. Do not share it. If you received this in error, contact support@aegisdms.life.${LEGAL_FOOTER_TEXT}`;

  return { subject, html: wrapHtml(subject, body), text };
}

/**
 * Claim escalation / reminder — sent when a contact has not yet claimed after initial notification.
 */
export function buildClaimEscalationTemplate(
  baseUrl: string,
  claimToken: string,
  attemptNumber: number,
): EmailTemplate {
  const link = `${baseUrl}/claim/${claimToken}`;
  const attemptLabel = attemptNumber > 1 ? `(reminder ${attemptNumber - 1})` : '';
  const subject = `Action required: claim your Aegis DMS message ${attemptLabel}`.trim();

  const body = `
    <h1 style="font-size:22px;color:#0B1C2C;margin:0 0 12px;">Reminder: your message is waiting</h1>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 8px;">
      This is a follow-up notification. A message has been released to you through Aegis DMS and has not yet been claimed.
    </p>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 8px;">
      This is attempt <strong>${attemptNumber}</strong> to reach you. Please access your message at your earliest convenience.
    </p>
    ${ctaButton(link, 'Claim Your Message')}
    <p style="color:#8AAAC8;font-size:12px;margin:0;">
      If you have already claimed your message, you can ignore this reminder. If you need help, contact support@aegisdms.life.
    </p>
  `;

  const text = `Reminder: your Aegis DMS message is waiting (attempt ${attemptNumber})\n\nA message has been released to you through Aegis DMS and has not yet been claimed.\n\nPlease access your message here:\n${link}\n\nIf you have already claimed your message, ignore this reminder. For help: support@aegisdms.life.${LEGAL_FOOTER_TEXT}`;

  return { subject, html: wrapHtml(subject, body), text };
}

/**
 * Relay offline alert — sent to the account holder when their Relay connection goes offline.
 */
export function buildRelayOfflineAlertTemplate(relayName: string, offlineSince: Date): EmailTemplate {
  const offlineSinceStr = offlineSince.toUTCString();
  const subject = 'Your Aegis Relay connection is offline';

  const body = `
    <h1 style="font-size:22px;color:#0B1C2C;margin:0 0 12px;">Relay connection offline</h1>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 8px;">
      Your Aegis Relay connection <strong>${escapeHtml(relayName)}</strong> has gone offline.
    </p>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 16px;">
      <strong>Offline since:</strong> ${offlineSinceStr}
    </p>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 8px;">
      While your Relay is offline, Aegis cannot verify your dead man's switch check-ins through this connection. Please check your Aegis Core installation and ensure the Relay service is running.
    </p>
    <p style="color:#8AAAC8;font-size:12px;margin:0;">
      This is an automated operational alert. No action is required if you intentionally took this Relay offline.
    </p>
  `;

  const text = `Your Aegis Relay connection is offline\n\nRelay: ${relayName}\nOffline since: ${offlineSinceStr}\n\nWhile your Relay is offline, Aegis cannot verify your check-ins through this connection. Please check your Aegis Core installation and ensure the Relay service is running.\n\nThis is an automated operational alert.${LEGAL_FOOTER_TEXT}`;

  return { subject, html: wrapHtml(subject, body), text };
}

/**
 * Billing state change — sent when subscription status changes.
 */
export function buildBillingStateChangeTemplate(
  event: 'payment_failed' | 'subscription_cancelled' | 'subscription_renewed',
  planName?: string,
): EmailTemplate {
  const plan = planName ?? 'your plan';

  const configs: Record<typeof event, { title: string; message: string; subject: string }> = {
    payment_failed: {
      subject: 'Payment failed — action required for your Aegis DMS subscription',
      title: 'Payment failed',
      message: `A payment for <strong>${escapeHtml(plan)}</strong> was declined. Please update your payment method to keep your Aegis DMS subscription active. If payment is not resolved, your account may be downgraded.`,
    },
    subscription_cancelled: {
      subject: 'Your Aegis DMS subscription has been cancelled',
      title: 'Subscription cancelled',
      message: `Your subscription to <strong>${escapeHtml(plan)}</strong> has been cancelled. You will retain access until the end of your current billing period. After that, your account will revert to the free tier. If this was a mistake, you can resubscribe from the billing portal.`,
    },
    subscription_renewed: {
      subject: 'Your Aegis DMS subscription has been renewed',
      title: 'Subscription renewed',
      message: `Your subscription to <strong>${escapeHtml(plan)}</strong> has been successfully renewed. Thank you for continuing to use Aegis DMS.`,
    },
  };

  const cfg = configs[event];

  const body = `
    <h1 style="font-size:22px;color:#0B1C2C;margin:0 0 12px;">${cfg.title}</h1>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 16px;">${cfg.message}</p>
    <p style="color:#8AAAC8;font-size:12px;margin:0;">
      Manage your subscription at <a href="https://app.aegisdms.life/app/billing" style="color:#4A6B8A;">app.aegisdms.life/app/billing</a>. For billing questions, contact support@aegisdms.life.
    </p>
  `;

  const text = `${cfg.title}\n\n${cfg.message.replace(/<[^>]+>/g, '')}\n\nManage your subscription at https://app.aegisdms.life/app/billing. For billing questions, contact support@aegisdms.life.${LEGAL_FOOTER_TEXT}`;

  return { subject: cfg.subject, html: wrapHtml(cfg.subject, body), text };
}

/**
 * Account deletion confirmation — sent when an account deletion is processed.
 */
export function buildAccountDeletionTemplate(): EmailTemplate {
  const subject = 'Your Aegis DMS account has been deleted';

  const body = `
    <h1 style="font-size:22px;color:#0B1C2C;margin:0 0 12px;">Account deleted</h1>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 8px;">
      Your Aegis DMS account and all associated data have been permanently deleted as requested.
    </p>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 16px;">
      This includes your account credentials, estate items, contacts, switches, and any associated configuration. This action cannot be undone.
    </p>
    <p style="color:#4A6B8A;line-height:1.6;margin:0 0 8px;">
      If you have an active Stripe subscription, it has been cancelled. You will not be charged again.
    </p>
    <p style="color:#8AAAC8;font-size:12px;margin:0;">
      If you did not request this deletion, contact us immediately at support@aegisdms.life.
    </p>
  `;

  const text = `Your Aegis DMS account has been deleted\n\nYour account and all associated data have been permanently deleted as requested. This includes your account credentials, estate items, contacts, switches, and any associated configuration. This action cannot be undone.\n\nIf you have an active Stripe subscription, it has been cancelled.\n\nIf you did not request this deletion, contact us immediately at support@aegisdms.life.${LEGAL_FOOTER_TEXT}`;

  return { subject, html: wrapHtml(subject, body), text };
}
