import db from '../database/connection';
import { encryptToken, decryptToken } from '../utils/crypto';
import { UserService } from '../services/userService';

export interface StoredCredentials {
  chatId: number;
  provider: string;
  email: string;
  refreshToken: string;
  accessToken: string;
  tokenExpiry: Date;
  scopes: string[];
}

/**
 * Normalizes an inbound chat_id (number, numeric string, or a BIGINT read
 * back from Postgres — node-pg returns bigint columns as strings) into a JS
 * safe integer. Both the OAuth write path and every status/read path funnel
 * through this so a string '7319408446' and the number 7319408446 can never
 * diverge into separate rows or failed lookups.
 *
 * Values beyond Number.MAX_SAFE_INTEGER are rejected: they cannot round-trip
 * through JSON without corruption and no current Telegram id needs them.
 */
export function normalizeChatId(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isSafeInteger(n)) return null;
  return n;
}

export class GoogleTokenStore {
  /**
   * Save or update encrypted Google OAuth credentials for a given user and provider.
   */
  static async storeCredentials(
    chatId: number | string,
    provider: string,
    email: string,
    refreshToken: string,
    accessToken: string,
    tokenExpiry: Date,
    scopes: string[]
  ): Promise<void> {
    const id = normalizeChatId(chatId);
    if (id === null) {
      throw new Error(`Cannot store credentials: invalid chat_id ${JSON.stringify(chatId)}.`);
    }
    chatId = id;
    const prov = provider.toLowerCase();

    // Ensure telegram user exists
    const user = await db('telegram_users')
      .where('telegram_id', chatId)
      .orWhere('chat_id', chatId)
      .first();

    if (!user) {
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
    }

    const encryptedRefresh = encryptToken(refreshToken);
    const encryptedAccess = encryptToken(accessToken);
    const scopesStr = scopes.join(' ');
    const expiryStr = tokenExpiry.toISOString();

    const existing = await db('google_connections').where({ chat_id: chatId, provider: prov }).first();
    if (existing) {
      await db('google_connections').where({ chat_id: chatId, provider: prov }).update({
        email,
        encrypted_refresh_token: encryptedRefresh,
        encrypted_access_token: encryptedAccess,
        token_expiry: expiryStr,
        scopes: scopesStr,
        updated_at: new Date().toISOString()
      });
    } else {
      await db('google_connections').insert({
        chat_id: chatId,
        provider: prov,
        email,
        encrypted_refresh_token: encryptedRefresh,
        encrypted_access_token: encryptedAccess,
        token_expiry: expiryStr,
        scopes: scopesStr
      });
    }
  }

  /**
   * Retrieve and decrypt credentials for a given user and provider.
   */
  static async getCredentials(chatId: number | string, provider: string): Promise<StoredCredentials | null> {
    const id = normalizeChatId(chatId);
    if (id === null) return null;
    const row = await db('google_connections')
      .where({ chat_id: id, provider: provider.toLowerCase() })
      .first();

    if (!row) {
      return null;
    }

    try {
      const refreshToken = decryptToken(row.encrypted_refresh_token);
      const accessToken = decryptToken(row.encrypted_access_token);
      const scopes = row.scopes ? row.scopes.split(' ') : [];

      return {
        chatId: normalizeChatId(row.chat_id) ?? id,
        provider: row.provider,
        email: row.email,
        refreshToken,
        accessToken,
        tokenExpiry: new Date(row.token_expiry),
        scopes
      };
    } catch (err) {
      console.error(`[TokenStore] Failed to decrypt credentials for chat_id ${chatId}, provider ${provider}:`, err);
      return null;
    }
  }

  /**
   * Retrieves a valid access token, automatically refreshing it with Google OAuth endpoint if expired.
   */
  static async getValidAccessToken(chatId: number | string, provider: string): Promise<string | null> {
    const creds = await this.getCredentials(chatId, provider);
    if (!creds) return null;

    const now = Date.now();
    const expiryTime = creds.tokenExpiry.getTime();

    // If token is still valid (with 60-second safety margin), return directly
    if (expiryTime > now + 60000) {
      return creds.accessToken;
    }

    // Attempt token refresh if live Google credentials are configured
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (clientId && clientSecret && creds.refreshToken && !creds.refreshToken.startsWith('mock_')) {
      try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: creds.refreshToken,
            grant_type: 'refresh_token'
          })
        });

        if (res.ok) {
          const data = await res.json();
          const newAccessToken = data.access_token;
          const expiresIn = data.expires_in || 3600;
          const newExpiry = new Date(Date.now() + expiresIn * 1000);

          // Update SQLite with encrypted new token
          await this.storeCredentials(
            chatId,
            provider,
            creds.email,
            creds.refreshToken,
            newAccessToken,
            newExpiry,
            creds.scopes
          );

          return newAccessToken;
        }
      } catch (err) {
        console.warn(`[TokenStore] Automated token refresh failed for user ${chatId}, provider ${provider}:`, err);
      }
    }

    // Return existing token as fallback
    return creds.accessToken;
  }

  /**
   * Checks if user has an active connection for a given provider.
   */
  static async isConnected(chatId: number | string, provider: string): Promise<boolean> {
    const id = normalizeChatId(chatId);
    if (id === null) return false;
    const row = await db('google_connections')
      .where({ chat_id: id, provider: provider.toLowerCase() })
      .first();
    return !!row;
  }

  /**
   * Disconnects a specific Google Workspace service.
   */
  static async disconnectService(chatId: number | string, provider: string): Promise<boolean> {
    const id = normalizeChatId(chatId);
    if (id === null) return false;
    const deletedCount = await db('google_connections')
      .where({ chat_id: id, provider: provider.toLowerCase() })
      .delete();

    // Log the disconnection in api_logs
    await db('api_logs').insert({
      chat_id: id,
      connector: provider.toLowerCase(),
      operation: 'disconnect',
      status: 'success'
    });

    return deletedCount > 0;
  }

  /**
   * Returns all active connections for a given user.
   */
  static async getUserConnections(chatId: number | string): Promise<{ provider: string; email: string; createdAt: string }[]> {
    const id = normalizeChatId(chatId);
    if (id === null) return [];
    const rows = await db('google_connections')
      .where({ chat_id: id })
      .select('provider', 'email', 'created_at');

    return rows.map((r) => ({
      provider: r.provider,
      email: r.email,
      createdAt: r.created_at
    }));
  }
}
