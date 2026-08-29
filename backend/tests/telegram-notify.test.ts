import { describe, expect, it, vi } from 'vitest';
import { humanizeProvider, sendTelegramMessage } from '../src/utils/telegramNotify';

describe('telegramNotify utility', () => {
  it('humanizes provider names correctly', () => {
    expect(humanizeProvider('gmail')).toBe('Gmail');
    expect(humanizeProvider('calendar')).toBe('Google Calendar');
    expect(humanizeProvider('drive')).toBe('Google Drive');
    expect(humanizeProvider('docs')).toBe('Google Docs');
    expect(humanizeProvider('sheets')).toBe('Google Sheets');
    expect(humanizeProvider('tasks')).toBe('Google Tasks');
    expect(humanizeProvider('custom_provider')).toBe('Custom_provider');
  });

  it('silently ignores when TELEGRAM_BOT_TOKEN is missing', async () => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await expect(sendTelegramMessage(123456, 'Test message')).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();

    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    fetchSpy.mockRestore();
  });

  it('handles fetch errors without throwing', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));
    await expect(sendTelegramMessage(123456, 'Test message')).resolves.toBeUndefined();

    fetchSpy.mockRestore();
  });

  it('successfully posts to Telegram sendMessage endpoint', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token_123';

    let capturedUrl = '';
    let capturedBody: any = null;

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url, init) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(String(init?.body || '{}'));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await sendTelegramMessage(7319408446, '✅ Google Calendar connected successfully!');
    expect(capturedUrl).toBe('https://api.telegram.org/botmock_bot_token_123/sendMessage');
    expect(capturedBody).toEqual({
      chat_id: 7319408446,
      text: '✅ Google Calendar connected successfully!',
      parse_mode: 'HTML'
    });

    fetchSpy.mockRestore();
  });
});
