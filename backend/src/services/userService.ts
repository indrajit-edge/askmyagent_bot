import db from '../database/connection';
import { GoogleConnectorRegistry } from '../connectors/registry';

export interface TelegramUserData {
  telegramId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface FormattedUser {
  id: number;
  name: string;
  email: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'disabled' | 'pending';
  createdAt: string;
  updatedAt: string;
  telegram: {
    telegramId: number;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    lastSeenAt: string;
  } | null;
}

export interface UserProfileDetails extends FormattedUser {
  geminiKeyStatus: {
    configured: boolean;
    status: 'Configured' | 'Not configured';
    lastUsed: string | null;
  };
  connectors: {
    name: string;
    title: string;
    icon: string;
    connected: boolean;
    email: string | null;
    scopes: string[];
    connectionDate: string | null;
    lastActivity: string | null;
    lastError: string | null;
    tokenStatus: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'REVOKED' | 'ERROR';
  }[];
}

export class UserService {
  /**
   * Identifies the Telegram user by their stable numeric Telegram ID,
   * creating or updating both the telegram_users record and parent users record.
   */
  static async upsertTelegramUser(data: TelegramUserData): Promise<{ userId: number; telegramId: number; isNew: boolean }> {
    const { telegramId, username, firstName, lastName } = data;

    if (!telegramId || typeof telegramId !== 'number') {
      throw new Error('Valid numeric telegramId is required for user synchronization.');
    }

    const displayName = [firstName, lastName].filter(Boolean).join(' ') || (username ? `@${username}` : `Telegram User ${telegramId}`);

    return await db.transaction(async (trx) => {
      const existingTgUser = await trx('telegram_users')
        .where('telegram_id', telegramId)
        .orWhere('chat_id', telegramId)
        .first();

      if (existingTgUser) {
        // Update telegram user metadata and last_seen_at
        await trx('telegram_users')
          .where('id', existingTgUser.id)
          .update({
            telegram_id: telegramId,
            chat_id: telegramId,
            username: username || existingTgUser.username || null,
            first_name: firstName || existingTgUser.first_name || null,
            last_name: lastName || existingTgUser.last_name || null,
            last_seen_at: trx.fn.now(),
            updated_at: trx.fn.now()
          });

        const targetUserId = existingTgUser.user_id;

        if (targetUserId) {
          // Also update user's display name if changed
          await trx('users')
            .where('id', targetUserId)
            .update({
              name: displayName,
              updated_at: trx.fn.now()
            });
        }

        return {
          userId: targetUserId || existingTgUser.id,
          telegramId,
          isNew: false
        };
      }

      // Create new user in users table
      const [userId] = await trx('users').insert({
        name: displayName,
        email: null,
        role: 'user',
        status: 'active'
      });

      // Insert telegram_users linked to user_id
      await trx('telegram_users').insert({
        user_id: userId,
        telegram_id: telegramId,
        chat_id: telegramId,
        username: username || null,
        first_name: firstName || null,
        last_name: lastName || null,
        last_seen_at: trx.fn.now()
      });

      return {
        userId,
        telegramId,
        isNew: true
      };
    });
  }

  /**
   * Retrieves all users joined with their Telegram metadata.
   * Strips all internal secrets, passwords, and tokens.
   */
  static async getUsersWithTelegram(filters?: { search?: string; status?: string; role?: string }): Promise<FormattedUser[]> {
    let query = db('users')
      .leftJoin('telegram_users', 'users.id', 'telegram_users.user_id')
      .select(
        'users.id as id',
        'users.name as name',
        'users.email as email',
        'users.role as role',
        'users.status as status',
        'users.created_at as created_at',
        'users.updated_at as updated_at',
        'telegram_users.telegram_id as telegram_id',
        'telegram_users.chat_id as chat_id',
        'telegram_users.username as telegram_username',
        'telegram_users.first_name as first_name',
        'telegram_users.last_name as last_name',
        'telegram_users.last_seen_at as last_seen_at'
      )
      .orderBy('users.id', 'desc');

    if (filters?.status && filters.status !== 'all') {
      query = query.where('users.status', filters.status);
    }

    if (filters?.role && filters.role !== 'all') {
      query = query.where('users.role', filters.role);
    }

    if (filters?.search) {
      const search = `%${filters.search.trim().toLowerCase()}%`;
      query = query.where((builder) => {
        builder
          .whereRaw('LOWER(users.name) LIKE ?', [search])
          .orWhereRaw('LOWER(telegram_users.username) LIKE ?', [search])
          .orWhereRaw('CAST(COALESCE(telegram_users.telegram_id, telegram_users.chat_id) AS TEXT) LIKE ?', [search]);
      });
    }

    const rows = await query;

    return rows.map((r) => {
      const tgId = r.telegram_id || r.chat_id;
      return {
        id: r.id,
        name: r.name,
        email: r.email || null,
        role: r.role === 'admin' ? 'admin' : 'user',
        status: r.status || 'active',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        telegram: tgId
          ? {
              telegramId: tgId,
              username: r.telegram_username || null,
              firstName: r.first_name || null,
              lastName: r.last_name || null,
              lastSeenAt: r.last_seen_at
            }
          : null
      };
    });
  }

  /**
   * Retrieves a single user by their primary database ID.
   */
  static async getUserById(userId: number): Promise<FormattedUser | null> {
    const row = await db('users')
      .leftJoin('telegram_users', 'users.id', 'telegram_users.user_id')
      .where('users.id', userId)
      .select(
        'users.id as id',
        'users.name as name',
        'users.email as email',
        'users.role as role',
        'users.status as status',
        'users.created_at as created_at',
        'users.updated_at as updated_at',
        'telegram_users.telegram_id as telegram_id',
        'telegram_users.chat_id as chat_id',
        'telegram_users.username as telegram_username',
        'telegram_users.first_name as first_name',
        'telegram_users.last_name as last_name',
        'telegram_users.last_seen_at as last_seen_at'
      )
      .first();

    if (!row) return null;

    const tgId = row.telegram_id || row.chat_id;

    return {
      id: row.id,
      name: row.name,
      email: row.email || null,
      role: row.role === 'admin' ? 'admin' : 'user',
      status: row.status || 'active',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      telegram: tgId
        ? {
            telegramId: tgId,
            username: row.telegram_username || null,
            firstName: row.first_name || null,
            lastName: row.last_name || null,
            lastSeenAt: row.last_seen_at
          }
        : null
    };
  }

  /**
   * Retrieves full user profile details including per-connector status (without exposing secrets).
   */
  static async getUserProfile(userId: number): Promise<UserProfileDetails | null> {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const tgId = user.telegram?.telegramId;

    // Check Gemini API key status without exposing the key
    let geminiKeyConfigured = false;
    let geminiLastUsed: string | null = null;

    if (tgId) {
      const tgRow = await db('telegram_users')
        .where('telegram_id', tgId)
        .orWhere('chat_id', tgId)
        .first();

      if (tgRow && tgRow.encrypted_gemini_api_key) {
        geminiKeyConfigured = true;
      }

      const lastGeminiLog = await db('api_logs')
        .where('chat_id', tgId)
        .andWhere('connector', 'gemini')
        .orderBy('timestamp', 'desc')
        .first();

      if (lastGeminiLog) {
        geminiLastUsed = lastGeminiLog.timestamp;
      }
    }

    // Check per-connector status
    const allConnectors = GoogleConnectorRegistry.getInstance().getAllConnectors();
    const userConnections = tgId ? await db('google_connections').where('chat_id', tgId) : [];

    const connectorStatuses = await Promise.all(
      allConnectors.map(async (connector) => {
        const connRow = userConnections.find((c) => c.provider.toLowerCase() === connector.name.toLowerCase());
        const isConnected = !!connRow;

        let lastActivity: string | null = null;
        let lastError: string | null = null;

        if (tgId) {
          const recentLogs = await db('api_logs')
            .where('chat_id', tgId)
            .andWhere('connector', connector.name)
            .orderBy('timestamp', 'desc')
            .limit(5);

          const successLog = recentLogs.find((l) => l.status === 'success');
          const errorLog = recentLogs.find((l) => l.status === 'error' || l.status === 'quota_limit');

          if (successLog) lastActivity = successLog.timestamp;
          if (errorLog) lastError = errorLog.error_message || errorLog.operation;
        }

        let tokenStatus: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'REVOKED' | 'ERROR' = 'DISCONNECTED';
        if (isConnected) {
          tokenStatus = 'CONNECTED';
          if (connRow.token_expiry && new Date(connRow.token_expiry).getTime() < Date.now()) {
            tokenStatus = 'EXPIRED';
          }
        }

        return {
          name: connector.name,
          title: connector.title,
          icon: connector.icon,
          connected: isConnected,
          email: connRow ? connRow.email : null,
          scopes: connRow && connRow.scopes ? connRow.scopes.split(' ') : connector.scopes,
          connectionDate: connRow ? connRow.created_at : null,
          lastActivity,
          lastError,
          tokenStatus
        };
      })
    );

    return {
      ...user,
      geminiKeyStatus: {
        configured: geminiKeyConfigured,
        status: geminiKeyConfigured ? 'Configured' : 'Not configured',
        lastUsed: geminiLastUsed
      },
      connectors: connectorStatuses
    };
  }

  /**
   * Updates user metadata with strict role protection (only 'user' and 'admin').
   * Prevents removing or demoting the last active administrator.
   */
  static async updateUser(userId: number, updates: { name?: string; role?: string; status?: string }): Promise<FormattedUser | null> {
    const existing = await this.getUserById(userId);
    if (!existing) return null;

    // Validate role if updated
    if (updates.role !== undefined) {
      if (!['user', 'admin'].includes(updates.role)) {
        throw new Error('Invalid role. Only "user" and "admin" roles are supported.');
      }

      // Check if demoting an admin
      if (existing.role === 'admin' && updates.role === 'user') {
        const adminCount = await db('users').where({ role: 'admin', status: 'active' }).count('id as count').first();
        if (Number(adminCount?.count || 0) <= 1) {
          throw new Error('Cannot demote the last active administrator account.');
        }
      }
    }

    // Check if disabling an admin
    if (updates.status !== undefined && updates.status !== 'active' && existing.role === 'admin') {
      const activeAdminCount = await db('users').where({ role: 'admin', status: 'active' }).count('id as count').first();
      if (Number(activeAdminCount?.count || 0) <= 1) {
        throw new Error('Cannot disable the last active administrator account.');
      }
    }

    const payload: Record<string, any> = {
      updated_at: db.fn.now()
    };

    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.status !== undefined) payload.status = updates.status;

    const count = await db('users').where({ id: userId }).update(payload);
    if (!count) return null;

    return this.getUserById(userId);
  }

  /**
   * Updates only user status with last-admin guard.
   */
  static async updateUserStatus(userId: number, status: string): Promise<boolean> {
    const existing = await this.getUserById(userId);
    if (!existing) return false;

    if (status !== 'active' && existing.role === 'admin') {
      const activeAdminCount = await db('users').where({ role: 'admin', status: 'active' }).count('id as count').first();
      if (Number(activeAdminCount?.count || 0) <= 1) {
        throw new Error('Cannot disable the last active administrator account.');
      }
    }

    const count = await db('users').where({ id: userId }).update({
      status,
      updated_at: db.fn.now()
    });
    return count > 0;
  }

  /**
   * Deletes a user and cascades deletion to linked telegram records and connections.
   * Protects the last active admin from deletion.
   */
  static async deleteUser(userId: number): Promise<boolean> {
    const existing = await this.getUserById(userId);
    if (!existing) return false;

    if (existing.role === 'admin') {
      const adminCount = await db('users').where({ role: 'admin' }).count('id as count').first();
      if (Number(adminCount?.count || 0) <= 1) {
        throw new Error('Cannot delete the last administrator account.');
      }
    }

    return await db.transaction(async (trx) => {
      const tgRows = await trx('telegram_users').where({ user_id: userId });
      const tgIds = tgRows.map((r) => r.telegram_id || r.chat_id).filter(Boolean);

      if (tgIds.length > 0) {
        await trx('google_connections').whereIn('chat_id', tgIds).delete();
      }

      await trx('telegram_users').where({ user_id: userId }).delete();
      const count = await trx('users').where({ id: userId }).delete();

      return count > 0;
    });
  }
}
