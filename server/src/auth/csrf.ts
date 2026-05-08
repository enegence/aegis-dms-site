import { createHmac, timingSafeEqual } from 'crypto';

const CSRF_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function generateCsrfToken(sessionId: string, secretKey: string): string {
  const timestamp = Date.now().toString(36);
  const payload = `${sessionId}:${timestamp}`;
  const signature = createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
  return `${payload}:${signature}`;
}

export function validateCsrfToken(
  token: string,
  sessionId: string,
  secretKey: string,
): boolean {
  const parts = token.split(':');
  if (parts.length !== 3) return false;

  const [tokenSessionId, timestamp, providedSignature] = parts;

  if (tokenSessionId !== sessionId) return false;

  const created = parseInt(timestamp, 36);
  if (isNaN(created) || Date.now() - created > CSRF_TTL_MS) return false;

  const payload = `${tokenSessionId}:${timestamp}`;
  const expectedSignature = createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  } catch {
    return false;
  }
}
