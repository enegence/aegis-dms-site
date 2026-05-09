import { ServerClient } from 'postmark';

// Per-token client cache. Each distinct apiToken gets its own instance.
const clientCache = new Map<string, ServerClient>();

export function getEmailClient(apiToken: string): ServerClient {
  let c = clientCache.get(apiToken);
  if (!c) {
    c = new ServerClient(apiToken);
    clientCache.set(apiToken, c);
  }
  return c;
}

export function buildVerifyEmailHtml(baseUrl: string, token: string): string {
  const link = `${baseUrl}/verify-email?token=${token}`;
  return `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <h1 style="font-size: 24px; color: #0B1C2C;">Verify your Aegis account</h1>
      <p style="color: #4A6B8A; line-height: 1.6;">Click the button below to verify your email address.</p>
      <a href="${link}" style="display: inline-block; background: #0B1C2C; color: #DDE8F4; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Verify Email</a>
      <p style="color: #8AAAC8; font-size: 12px;">If you didn't create an Aegis account, ignore this email.</p>
    </div>
  `;
}

export function buildResetPasswordHtml(baseUrl: string, token: string): string {
  const link = `${baseUrl}/reset-password?token=${token}`;
  return `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      <h1 style="font-size: 24px; color: #0B1C2C;">Reset your password</h1>
      <p style="color: #4A6B8A; line-height: 1.6;">Click the button below to reset your Aegis password. This link expires in 15 minutes.</p>
      <a href="${link}" style="display: inline-block; background: #0B1C2C; color: #DDE8F4; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">Reset Password</a>
      <p style="color: #8AAAC8; font-size: 12px;">If you didn't request a password reset, ignore this email.</p>
    </div>
  `;
}

// Legacy signature — used by auth routes and relay monitor.
// Keep this intact for backward compatibility.
export async function sendEmail(
  apiToken: string,
  fromEmail: string,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<void> {
  if (!apiToken) {
    console.log(`[email-stub] Subject: ${subject}`);
    return;
  }

  const c = getEmailClient(apiToken);
  await c.sendEmail({
    From: fromEmail,
    To: to,
    Subject: subject,
    HtmlBody: htmlBody,
  });
}

// Structured send — used by hosted notification dispatch.
// Returns {messageId, error} so callers can store results without re-throwing.
// Errors are caught and returned as redacted strings; plaintext addresses/content
// are never logged here.
export async function sendEmailStructured(
  apiToken: string,
  params: {
    from: string;
    to: string;
    subject: string;
    htmlBody: string;
    textBody: string;
  },
): Promise<{ messageId: string | null; error?: string }> {
  if (!apiToken) {
    // Stub mode — no token configured
    return { messageId: null, error: 'no_api_token' };
  }

  try {
    const c = getEmailClient(apiToken);
    const result = await c.sendEmail({
      From: params.from,
      To: params.to,
      Subject: params.subject,
      HtmlBody: params.htmlBody,
      TextBody: params.textBody,
    });
    return { messageId: result.MessageID ?? null };
  } catch (err) {
    // Redact: do not include addresses or message content in error strings
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : 'postmark_error';
    return { messageId: null, error: code };
  }
}
