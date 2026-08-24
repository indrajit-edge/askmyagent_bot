import { BotCommandHandler } from './commands';
import { ConfirmationManager } from '../confirmation';
import { GeminiAiAgent } from './gemini';
import { UserKeyService } from '../services/userKeyService';
import { UserService } from '../services/userService';
import { htmlEscape } from '../utils/security';

export interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id: number;
    chat: { id: number; username?: string; first_name?: string; last_name?: string };
    from?: { id: number; username?: string; first_name?: string; last_name?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string; first_name?: string; last_name?: string };
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
}

export class TelegramWebhookController {
  /**
   * Processes an incoming update from Telegram Webhook or test simulator.
   * Synchronizes the Telegram user atomically into SQLite before executing bot actions.
   */
  static async handleUpdate(update: TelegramUpdate): Promise<{ chatId: number; replyText: string; replyMarkup?: any }> {
    // 1. Synchronize Telegram User on every incoming update
    if (update.message?.chat?.id) {
      const chat = update.message.chat;
      const from = update.message.from;
      const tgId = from?.id || chat.id;

      try {
        await UserService.upsertTelegramUser({
          telegramId: tgId,
          username: from?.username || chat.username,
          firstName: from?.first_name || chat.first_name,
          lastName: from?.last_name || chat.last_name
        });
      } catch (err) {
        console.warn(`[TelegramSync] Failed to sync user ${tgId}:`, err);
      }
    } else if (update.callback_query?.from?.id) {
      const from = update.callback_query.from;
      try {
        await UserService.upsertTelegramUser({
          telegramId: from.id,
          username: from.username,
          firstName: from.first_name,
          lastName: from.last_name
        });
      } catch (err) {
        console.warn(`[TelegramSync] Failed to sync callback user ${from.id}:`, err);
      }
    }

    // 2. Handle Callback Queries (Inline button confirmations)
    if (update.callback_query && update.callback_query.data) {
      const chatId = update.callback_query.from.id;
      const data = update.callback_query.data;

      if (data.startsWith('confirm:')) {
        const actionId = data.replace('confirm:', '');
        const res = await ConfirmationManager.confirmAction(chatId, actionId);
        return {
          chatId,
          replyText: res.message
        };
      }

      if (data.startsWith('cancel:')) {
        const actionId = data.replace('cancel:', '');
        const res = ConfirmationManager.cancelAction(chatId, actionId);
        return {
          chatId,
          replyText: res.message
        };
      }
    }

    // 3. Handle Text Messages and Commands
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const rawText = update.message.text.trim();
      const parts = rawText.split(' ');
      const command = parts[0].toLowerCase();

      if (command === '/start' || command === '/help') {
        return {
          chatId,
          replyText: `👋 <b>Welcome to AskMyAgent!</b>\n\nI am your unified Google Workspace AI assistant on Telegram.\n\n<b>🔑 API Key Management:</b>\n• /setkey &lt;YOUR_KEY&gt; — Link your Gemini API key\n• /key — View current API key status\n• /clearkey — Delete your stored API key\n\n<b>📁 Workspace Connectors:</b>\n• /connectors — View Google Workspace connections\n• /connectgmail — Connect Gmail\n• /connectcalendar — Connect Calendar\n• /connectdrive — Connect Drive\n• /connectdocs — Connect Docs\n• /connectsheets — Connect Sheets\n• /connecttasks — Connect Tasks\n\nOr ask me anything in natural language!`
        };
      }

      // /setkey or /apikey command
      if (command === '/setkey' || command === '/apikey') {
        const key = parts.slice(1).join(' ').trim();
        if (!key) {
          return {
            chatId,
            replyText: '⚠️ Please provide your API key after the command:\n<code>/setkey YOUR_GEMINI_API_KEY</code>'
          };
        }

        try {
          await UserKeyService.setUserGeminiKey(chatId, key);
          const masked = key.length > 8 ? `${key.slice(0, 6)}...${key.slice(-4)}` : '••••••••';
          return {
            chatId,
            replyText: `✅ <b>Gemini API Key Linked!</b>\n\nYour key (<code>${htmlEscape(masked)}</code>) has been securely encrypted with AES-256 and stored on the server.\n\nYou can now ask questions about your calendar, emails, drive, tasks, and documents!`
          };
        } catch (err: any) {
          return {
            chatId,
            replyText: `❌ Failed to save API key: ${htmlEscape(err.message)}`
          };
        }
      }

      // /key status command
      if (command === '/key' || command === '/keystatus') {
        const keyInfo = await UserKeyService.isKeyConfigured(chatId);
        if (keyInfo.configured) {
          return {
            chatId,
            replyText: `🔑 <b>Gemini API Key Status:</b>\n✅ Configured (${keyInfo.isPersonal ? 'Personal Key' : 'Server Default'})\nKey: <code>${htmlEscape(keyInfo.maskedKey)}</code>\n\nTo update: <code>/setkey &lt;new_key&gt;</code>\nTo remove: <code>/clearkey</code>`
          };
        } else {
          return {
            chatId,
            replyText: `🔑 <b>Gemini API Key Status:</b>\n❌ Not configured.\n\nSet your key using:\n<code>/setkey YOUR_GEMINI_API_KEY</code>`
          };
        }
      }

      // /clearkey command
      if (command === '/clearkey') {
        await UserKeyService.removeUserGeminiKey(chatId);
        return {
          chatId,
          replyText: '🗑️ Your stored Gemini API key has been removed from the server.'
        };
      }

      if (command === '/connectors') {
        const text = await BotCommandHandler.handleConnectorsCommand(chatId);
        return { chatId, replyText: text };
      }

      if (command.startsWith('/connect')) {
        const service = command.replace('/connect', '').trim();
        const res = BotCommandHandler.handleConnectService(chatId, service || 'gmail');
        return { chatId, replyText: res.message };
      }

      if (command.startsWith('/disconnect')) {
        const service = command.replace('/disconnect', '').trim();
        const res = await BotCommandHandler.handleDisconnectService(chatId, service || 'gmail');
        return { chatId, replyText: res.message };
      }

      // Natural language query -> Gemini AI Agent
      const aiReply = await GeminiAiAgent.processMessage(chatId, rawText);
      return { chatId, replyText: aiReply };
    }

    return {
      chatId: 0,
      replyText: 'Unhandled update'
    };
  }
}
