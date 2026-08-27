import db from '../database/connection';
import { encryptToken, decryptToken } from '../utils/crypto';
import { UserService } from './userService';

export class UserKeyService {
  /**
   * Encrypts and securely stores the user's Google Gemini API key in SQLite.
   */
  static async setUserGeminiKey(chatId: number, rawKey: string): Promise<void> {
    const trimmed = rawKey.trim();
    if (!trimmed) {
      throw new Error('API key cannot be empty.');
    }

    const encryptedKey = encryptToken(trimmed);

    const user = await db('telegram_users')
      .where('telegram_id', chatId)
      .orWhere('chat_id', chatId)
      .first();

    if (user) {
      await db('telegram_users').where('id', user.id).update({
        encrypted_gemini_api_key: encryptedKey,
        updated_at: new Date().toISOString()
      });
    } else {
      let botUser: any = null;
      try {
        const hasBotTable = await db.schema.hasTable('bot_users');
        if (hasBotTable) {
          botUser = await db('bot_users').where('chat_id', chatId).first();
        }
      } catch {}

      await UserService.upsertTelegramUser({
        telegramId: chatId,
        username: botUser?.username || null,
        firstName: botUser?.first_name || null,
        lastName: botUser?.last_name || null
      });

      await db('telegram_users')
        .where('telegram_id', chatId)
        .orWhere('chat_id', chatId)
        .update({
          encrypted_gemini_api_key: encryptedKey,
          updated_at: new Date().toISOString()
        });
    }
  }

  /**
   * Retrieves and decrypts the user's Gemini API key, falling back to server default if available.
   */
  static async getUserGeminiKey(chatId: number): Promise<string | null> {
    const user = await db('telegram_users')
      .where('telegram_id', chatId)
      .orWhere('chat_id', chatId)
      .first();

    if (user && user.encrypted_gemini_api_key) {
      try {
        return decryptToken(user.encrypted_gemini_api_key);
      } catch (err) {
        console.error(`[UserKeyService] Error decrypting API key for ${chatId}:`, err);
      }
    }

    // Server-level fallback from environment if configured
    return process.env.GEMINI_API_KEY || null;
  }

  /**
   * Removes the user's stored Gemini API key from database.
   */
  static async removeUserGeminiKey(chatId: number): Promise<boolean> {
    const updated = await db('telegram_users')
      .where('telegram_id', chatId)
      .orWhere('chat_id', chatId)
      .update({
        encrypted_gemini_api_key: null,
        updated_at: new Date().toISOString()
      });
    return updated > 0;
  }

  /**
   * Returns whether the user has a Gemini API key configured (either personal or server default).
   */
  static async isKeyConfigured(chatId: number): Promise<{ configured: boolean; isPersonal: boolean; maskedKey?: string }> {
    const user = await db('telegram_users')
      .where('telegram_id', chatId)
      .orWhere('chat_id', chatId)
      .first();

    if (user && user.encrypted_gemini_api_key) {
      try {
        const decrypted = decryptToken(user.encrypted_gemini_api_key);
        const masked = decrypted.length > 8
          ? `${decrypted.slice(0, 6)}...${decrypted.slice(-4)}`
          : '••••••••';
        return { configured: true, isPersonal: true, maskedKey: masked };
      } catch {
        // Fall through
      }
    }

    if (process.env.GEMINI_API_KEY) {
      return { configured: true, isPersonal: false, maskedKey: 'Server Default' };
    }

    return { configured: false, isPersonal: false };
  }
}
