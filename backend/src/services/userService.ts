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
  source?: 'backend' | 'vm-bot';
  preferredModel?: string | null;
  hasGeminiKey?: boolean;
  hasCalendarConfig?: boolean;
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
      // .returning('id') is required on PostgreSQL; normalize across drivers.
      const insertedIds = await trx('users')
        .insert({
          name: displayName,
          email: null,
          role: 'user',
          status: 'active'
        })
        .returning('id');
      const firstId = Array.isArray(insertedIds) ? insertedIds[0] : insertedIds;
      const userId: number = typeof firstId === 'object' && firstId !== null ? (firstId as any).id : Number(firstId);

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
   * Supports querying by backend user ID or Telegram numeric ID.
   */
  static async getUserProfile(identifier: number | string): Promise<UserProfileDetails | null> {
    const rawId = String(identifier ?? '').trim();
    if (!rawId) return null;

    let user: FormattedUser | null = null;
    let preferredModel: string | null = null;
    let hasGeminiKeyFlag = false;
    let hasCalendarConfigFlag = false;
    let userSource: 'backend' | 'vm-bot' = 'backend';

    const numId = Number(rawId);

    // 1. Try finding by primary key in users table (if safe integer)
    if (Number.isSafeInteger(numId) && numId > 0 && numId < 2147483647) {
      user = await this.getUserById(numId);
    }

    // 2. If not found by users.id, try finding by telegram_id / chat_id in telegram_users
    if (!user && Number.isSafeInteger(numId)) {
      const tgRow = await db('telegram_users')
        .where('telegram_id', numId)
        .orWhere('chat_id', numId)
        .first();

      if (tgRow) {
        if (tgRow.user_id) {
          user = await this.getUserById(tgRow.user_id);
        } else {
          user = {
            id: tgRow.id,
            name: [tgRow.first_name, tgRow.last_name].filter(Boolean).join(' ') || (tgRow.username ? `@${tgRow.username}` : `Telegram User ${tgRow.telegram_id || tgRow.chat_id}`),
            email: null,
            role: 'user',
            status: 'active',
            createdAt: tgRow.created_at || new Date().toISOString(),
            updatedAt: tgRow.updated_at || new Date().toISOString(),
            telegram: {
              telegramId: tgRow.telegram_id || tgRow.chat_id,
              username: tgRow.username || null,
              firstName: tgRow.first_name || null,
              lastName: tgRow.last_name || null,
              lastSeenAt: tgRow.last_seen_at
            }
          };
        }
      }
    }

    // 3. If still not found, check bot_users table
    const tgChatId = user?.telegram?.telegramId ?? (Number.isSafeInteger(numId) ? numId : null);

    if (tgChatId) {
      try {
        const hasBotUsersTable = await db.schema.hasTable('bot_users');
        if (hasBotUsersTable) {
          const botUser = await db('bot_users')
            .where('chat_id', tgChatId)
            .first();

          if (botUser) {
            preferredModel = botUser.preferred_model || null;
            if (botUser.gemini_api_key && String(botUser.gemini_api_key).trim().length > 0) {
              hasGeminiKeyFlag = true;
            }
            if (botUser.calendar_credentials_path || botUser.calendar_id) {
              hasCalendarConfigFlag = true;
            }

            if (!user) {
              userSource = 'vm-bot';
              user = {
                id: null as any,
                name: [botUser.first_name, botUser.last_name].filter(Boolean).join(' ') || (botUser.username ? `@${botUser.username}` : `Telegram User ${botUser.chat_id}`),
                email: null,
                role: 'user',
                status: 'active',
                createdAt: botUser.created_at || null,
                updatedAt: botUser.updated_at || null,
                telegram: {
                  telegramId: botUser.chat_id,
                  username: botUser.username || null,
                  firstName: botUser.first_name || null,
                  lastName: botUser.last_name || null,
                  lastSeenAt: botUser.last_seen_at || botUser.updated_at || botUser.created_at || null
                }
              };
            }
          }
        }
      } catch (err: any) {
        console.warn('[UserProfile] bot_users lookup failed:', err.message);
      }
    }

    if (!user) return null;

    const tgId = user.telegram?.telegramId;

    // Check Gemini API key status across all sources (telegram_users + bot_users)
    let geminiKeyConfigured = hasGeminiKeyFlag;
    let geminiLastUsed: string | null = null;

    if (tgId) {
      const tgRow = await db('telegram_users')
        .where('telegram_id', tgId)
        .orWhere('chat_id', tgId)
        .first();

      if (tgRow && tgRow.encrypted_gemini_api_key) {
        geminiKeyConfigured = true;
      }

      // Check bot_users table directly if not already configured
      if (!geminiKeyConfigured) {
        try {
          const hasBotUsers = await db.schema.hasTable('bot_users');
          if (hasBotUsers) {
            const bUser = await db('bot_users').where('chat_id', tgId).first();
            if (bUser && bUser.gemini_api_key && String(bUser.gemini_api_key).trim().length > 0) {
              geminiKeyConfigured = true;
              if (bUser.preferred_model && !preferredModel) {
                preferredModel = bUser.preferred_model;
              }
            }
          }
        } catch {
          // Ignore
        }
      }

      // Check last Gemini activity log
      const lastGeminiLog = await db('api_logs')
        .where('chat_id', tgId)
        .andWhere((builder) => {
          builder.where('connector', 'gemini')
            .orWhere('connector', 'bot')
            .orWhereRaw('LOWER(operation) LIKE ?', ['%gemini%']);
        })
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
            .andWhere('connector', connector.name.toLowerCase())
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
      source: (user as any).source || userSource,
      preferredModel: preferredModel || (user as any).preferredModel || null,
      hasGeminiKey: geminiKeyConfigured,
      hasCalendarConfig: hasCalendarConfigFlag,
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
   * Supports identifier as numeric user ID or Telegram chat ID.
   */
  static async updateUser(identifier: number | string, updates: { name?: string; role?: string; status?: string }): Promise<FormattedUser | null> {
    const rawId = String(identifier ?? '').trim();
    if (!rawId) return null;

    const profile = await this.getUserProfile(rawId);
    if (!profile) return null;

    let targetUserId = profile.id;

    if (!targetUserId && profile.telegram?.telegramId) {
      const synced = await this.upsertTelegramUser({
        telegramId: profile.telegram.telegramId,
        username: profile.telegram.username,
        firstName: profile.telegram.firstName,
        lastName: profile.telegram.lastName
      });
      targetUserId = synced.userId;
    }

    if (!targetUserId) return null;

    const existing = await this.getUserById(targetUserId);
    if (!existing) return null;

    // Validate role if updated
    if (updates.role !== undefined) {
      if (!['user', 'admin'].includes(updates.role)) {
        throw new Error('Invalid role. Only "user" and "admin" roles are supported.');
      }

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

    await db('users').where({ id: targetUserId }).update(payload);

    if (updates.status !== undefined && profile.telegram?.telegramId) {
      const isBlocked = updates.status === 'active' ? 0 : 1;
      await db('telegram_users')
        .where('telegram_id', profile.telegram.telegramId)
        .orWhere('chat_id', profile.telegram.telegramId)
        .update({ is_blocked: isBlocked, updated_at: db.fn.now() });
    }

    return this.getUserById(targetUserId);
  }

  /**
   * Updates only user status with last-admin guard and updates telegram_users block status.
   */
  static async updateUserStatus(identifier: number | string, status: string): Promise<boolean> {
    const rawId = String(identifier ?? '').trim();
    if (!rawId) return false;

    const profile = await this.getUserProfile(rawId);
    if (!profile) return false;

    if (profile.role === 'admin' && status !== 'active') {
      const activeAdminCount = await db('users').where({ role: 'admin', status: 'active' }).count('id as count').first();
      if (Number(activeAdminCount?.count || 0) <= 1) {
        throw new Error('Cannot disable the last active administrator account.');
      }
    }

    const isBlocked = status === 'active' ? 0 : 1;

    if (profile.id) {
      await db('users').where({ id: profile.id }).update({
        status,
        updated_at: db.fn.now()
      });
    }

    if (profile.telegram?.telegramId) {
      await db('telegram_users')
        .where('telegram_id', profile.telegram.telegramId)
        .orWhere('chat_id', profile.telegram.telegramId)
        .update({
          is_blocked: isBlocked,
          updated_at: db.fn.now()
        });
    }

    return true;
  }

  /**
   * Deletes a user and cascades deletion to ALL tables:
   * - bot_users (VM bot table: removes Gemini key, credentials, and state)
   * - bot_usage (VM bot usage table)
   * - google_connections (Workspace OAuth tokens & refresh tokens)
   * - telegram_users (Telegram identity records)
   * - users (Backend user accounts)
   * - api_logs (User audit logs)
   *
   * Protects the last active admin from deletion.
   */
  static async deleteUser(identifier: number | string): Promise<boolean> {
    const rawId = String(identifier ?? '').trim();
    if (!rawId) return false;

    const numId = Number(rawId);

    // 1. Gather all related user IDs and chat IDs
    const userIds = new Set<number>();
    const chatIds = new Set<number | string>();

    // Check users table
    if (Number.isSafeInteger(numId) && numId > 0 && numId < 2147483647) {
      const userRow = await db('users').where({ id: numId }).first();
      if (userRow) {
        userIds.add(userRow.id);
        if (userRow.role === 'admin') {
          const adminCount = await db('users').where({ role: 'admin' }).count('id as count').first();
          if (Number(adminCount?.count || 0) <= 1) {
            throw new Error('Cannot delete the last administrator account.');
          }
        }
      }
    }

    // Check telegram_users table
    let tgQuery = db('telegram_users');
    if (userIds.size > 0) {
      tgQuery = tgQuery.whereIn('user_id', Array.from(userIds));
    }
    if (Number.isSafeInteger(numId)) {
      tgQuery = tgQuery.orWhere('telegram_id', numId).orWhere('chat_id', numId);
    }
    const tgRows = await tgQuery;
    for (const row of tgRows) {
      if (row.user_id) userIds.add(row.user_id);
      if (row.telegram_id) chatIds.add(row.telegram_id);
      if (row.chat_id) chatIds.add(row.chat_id);
    }

    // If identifier is numeric and looks like a chat_id
    if (Number.isSafeInteger(numId)) {
      chatIds.add(numId);
    }

    // Check bot_users table
    try {
      const hasBotUsers = await db.schema.hasTable('bot_users');
      if (hasBotUsers) {
        let bQuery = db('bot_users');
        if (chatIds.size > 0) {
          bQuery = bQuery.whereIn('chat_id', Array.from(chatIds));
        }
        if (Number.isSafeInteger(numId)) {
          bQuery = bQuery.orWhere('chat_id', numId);
        }
        const botRows = await bQuery;
        for (const brow of botRows) {
          if (brow.chat_id) chatIds.add(brow.chat_id);
        }
      }
    } catch {
      // Ignore if bot_users table not accessible
    }

    // If nothing found across any table
    if (userIds.size === 0 && chatIds.size === 0) {
      return false;
    }

    const userIdsArray = Array.from(userIds);
    const chatIdsArray = Array.from(chatIds);

    // Double check admin protection on collected userIds
    if (userIdsArray.length > 0) {
      const adminUsers = await db('users').whereIn('id', userIdsArray).where({ role: 'admin' });
      if (adminUsers.length > 0) {
        const totalAdmins = await db('users').where({ role: 'admin' }).count('id as count').first();
        if (Number(totalAdmins?.count || 0) <= adminUsers.length) {
          throw new Error('Cannot delete the last administrator account.');
        }
      }
    }

    // 2. Cascade delete in a transaction across all database tables
    return await db.transaction(async (trx) => {
      // A. Delete from bot_users table
      const hasBotUsersTable = await trx.schema.hasTable('bot_users');
      if (hasBotUsersTable && chatIdsArray.length > 0) {
        await trx('bot_users').whereIn('chat_id', chatIdsArray).delete();
        for (const cid of chatIdsArray) {
          await trx('bot_users').whereRaw('CAST(chat_id AS TEXT) = ?', [String(cid)]).delete();
        }
      }

      // B. Delete from bot_usage table
      const hasBotUsageTable = await trx.schema.hasTable('bot_usage');
      if (hasBotUsageTable && chatIdsArray.length > 0) {
        await trx('bot_usage').whereIn('chat_id', chatIdsArray).delete();
        for (const cid of chatIdsArray) {
          await trx('bot_usage').whereRaw('CAST(chat_id AS TEXT) = ?', [String(cid)]).delete();
        }
      }

      // C. Delete from google_connections table
      if (chatIdsArray.length > 0) {
        await trx('google_connections').whereIn('chat_id', chatIdsArray).delete();
        for (const cid of chatIdsArray) {
          await trx('google_connections').whereRaw('CAST(chat_id AS TEXT) = ?', [String(cid)]).delete();
        }
      }

      // D. Delete from telegram_users table
      if (userIdsArray.length > 0) {
        await trx('telegram_users').whereIn('user_id', userIdsArray).delete();
      }
      if (chatIdsArray.length > 0) {
        await trx('telegram_users').whereIn('telegram_id', chatIdsArray).orWhereIn('chat_id', chatIdsArray).delete();
        for (const cid of chatIdsArray) {
          await trx('telegram_users').whereRaw('CAST(COALESCE(telegram_id, chat_id) AS TEXT) = ?', [String(cid)]).delete();
        }
      }

      // E. Delete from users table
      if (userIdsArray.length > 0) {
        await trx('users').whereIn('id', userIdsArray).delete();
      }

      // F. Delete from api_logs table
      if (chatIdsArray.length > 0) {
        await trx('api_logs').whereIn('chat_id', chatIdsArray).delete();
        for (const cid of chatIdsArray) {
          await trx('api_logs').whereRaw('CAST(chat_id AS TEXT) = ?', [String(cid)]).delete();
        }
      }

      return true;
    });
  }
}
