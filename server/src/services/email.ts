import { ServerClient } from 'postmark';

let client: ServerClient | null = null;

export function getEmailClient(apiToken: string): ServerClient {
  if (!client) {
    client = new ServerClient(apiToken);
  }
  return client;
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

export async function sendEmail(
  apiToken: string,
  fromEmail: string,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<void> {
  if (!apiToken) {
    console.log(`[email-stub] To: ${to}, Subject: ${subject}`);
    return;
  }

  const client = getEmailClient(apiToken);
  await client.sendEmail({
    From: fromEmail,
    To: to,
    Subject: subject,
    HtmlBody: htmlBody,
  });
}
