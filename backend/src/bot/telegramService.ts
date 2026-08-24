import { TelegramWebhookController, TelegramUpdate } from './webhook';

export class TelegramBotService {
  private static isPolling = false;
  private static pollingAbortController: AbortController | null = null;

  private static getToken(): string | undefined {
    return process.env.TELEGRAM_BOT_TOKEN;
  }

  /**
   * Sends a message to a Telegram chat using Telegram Bot API.
   */
  static async sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<boolean> {
    const token = this.getToken();
    if (!token) {
      console.log(`[TelegramService] (Mock Send to Chat ${chatId}):\n${text}`);
      return true;
    }

    try {
      const body: any = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      };

      if (replyMarkup) {
        body.reply_markup = replyMarkup;
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      return data.ok === true;
    } catch (err) {
      console.error(`[TelegramService] Error sending message to ${chatId}:`, err);
      return false;
    }
  }

  /**
   * Sets up a webhook for the Telegram Bot pointing to the VM server.
   */
  static async setWebhook(webhookUrl: string): Promise<{ ok: boolean; description?: string }> {
    const token = this.getToken();
    if (!token) {
      return { ok: false, description: 'TELEGRAM_BOT_TOKEN is not configured in .env' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return { ok: false, description: err.message };
    }
  }

  /**
   * Deletes the webhook to allow local polling mode.
   */
  static async deleteWebhook(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
      const data = await res.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }

  /**
   * Starts long-polling for updates from Telegram (ideal for development and VM without public SSL).
   */
  static startPolling(): void {
    const token = this.getToken();
    if (!token) {
      console.log('[TelegramService] TELEGRAM_BOT_TOKEN not provided. Direct /api/bot/simulate and /api/bot/webhook endpoints are active.');
      return;
    }

    if (this.isPolling) return;
    this.isPolling = true;
    this.pollingAbortController = new AbortController();

    console.log('[TelegramService] Connecting Telegram bot long-polling...');

    let offset = 0;

    const poll = async () => {
      while (this.isPolling) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=25`, {
            signal: this.pollingAbortController?.signal
          });

          if (res.ok) {
            const data = await res.json();
            if (data.ok && Array.isArray(data.result)) {
              for (const update of data.result as TelegramUpdate[]) {
                offset = (update.update_id || offset) + 1;

                // Process update
                const reply = await TelegramWebhookController.handleUpdate(update);
                if (reply.chatId && reply.replyText) {
                  await this.sendMessage(reply.chatId, reply.replyText, reply.replyMarkup);
                }
              }
            }
          } else {
            // Backoff slightly on error
            await new Promise((r) => setTimeout(r, 3000));
          }
        } catch (err: any) {
          if (err.name === 'AbortError') break;
          // Transient network glitch: wait 3 seconds before next poll
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    };

    poll();
  }

  /**
   * Stops polling.
   */
  static stopPolling(): void {
    this.isPolling = false;
    if (this.pollingAbortController) {
      this.pollingAbortController.abort();
      this.pollingAbortController = null;
    }
  }
}
