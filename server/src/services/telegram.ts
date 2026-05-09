/**
 * Telegram Bot API dispatch.
 *
 * Security: never log the bot token, chat IDs, or message content.
 * `chatId` is derived from the stored handle (e.g. "@username") — the raw
 * handle value is never emitted to logs from this module.
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  if (!botToken) {
    return { ok: false, error: 'no_bot_token' };
  }

  const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

    if (!response.ok) {
      // Capture the status code only — not the body which could echo back PII
      return { ok: false, error: `http_${response.status}` };
    }

    const data = (await response.json()) as {
      ok: boolean;
      result?: { message_id?: number };
      description?: string;
    };

    if (!data.ok) {
      // Use a generic error code; description may echo the text we sent
      return { ok: false, error: 'telegram_api_error' };
    }

    return {
      ok: true,
      messageId: data.result?.message_id,
    };
  } catch {
    // Network or parse error — do not include any request details
    return { ok: false, error: 'network_error' };
  }
}

/**
 * Derive a Telegram chatId from the stored handle value.
 * Stored format: "@username" → chatId "@username" (Telegram accepts it directly).
 * If the handle is missing the "@" prefix it is returned as-is.
 */
export function telegramChatIdFromHandle(handle: string): string {
  return handle.startsWith('@') ? handle : `@${handle}`;
}
