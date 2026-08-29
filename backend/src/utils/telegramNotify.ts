/**
 * Telegram Outbound Notification Helper
 * 
 * IMPORTANT ARCHITECTURAL CONSTRAINT:
 * The Python VM bot is the SOLE owner of inbound Telegram traffic and polling (getUpdates).
 * The backend MUST NEVER call setWebhook, deleteWebhook, or getUpdates to prevent 409 Conflict
 * errors with the VM bot.
 * 
 * Calling Telegram's sendMessage API is a stateless, one-way outbound call and does NOT
 * register a listener or conflict with polling ownership.
 */

/**
 * Humanizes raw connector provider keys into readable brand names.
 */
export function humanizeProvider(provider: string): string {
  const normalized = (provider || '').toLowerCase().trim();
  const map: Record<string, string> = {
    gmail: 'Gmail',
    calendar: 'Google Calendar',
    drive: 'Google Drive',
    docs: 'Google Docs',
    sheets: 'Google Sheets',
    tasks: 'Google Tasks'
  };
  return map[normalized] || (provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Google Service');
}

/**
 * Sends a one-way outbound notification message to a Telegram user.
 * 
 * Fails silently (logs a warning, does not throw) if TELEGRAM_BOT_TOKEN is missing
 * or if the network request fails, ensuring non-critical notifications never disrupt
 * primary application workflows.
 */
export async function sendTelegramMessage(chatId: string | number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token || !token.trim()) {
    // Token not configured in this environment — skip notification silently
    return;
  }

  if (!chatId || !text) {
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.warn(`[TelegramNotify] sendMessage failed (${response.status}):`, errorText);
    }
  } catch (err: any) {
    console.warn('[TelegramNotify] Failed to send outbound Telegram notification:', err.message || err);
  }
}
