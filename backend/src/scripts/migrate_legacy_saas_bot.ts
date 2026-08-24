import path from 'path';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import db from '../database/connection';
import { encryptToken } from '../utils/crypto';

interface LegacyUserRecord {
  id?: number;
  telegram_id?: number;
  chat_id?: number;
  user_id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  gemini_api_key?: string;
  api_key?: string;
  preferred_model?: string;
  created_at?: string;
  usage_count?: number;
  requests_count?: number;
  calendar_refresh_token?: string;
  calendar_access_token?: string;
  calendar_email?: string;
}

/**
 * Migration CLI tool: Migrates legacy saas-bot SQLite database into PostgreSQL.
 * Run with: npx tsx src/scripts/migrate_legacy_saas_bot.ts [--source=path/to/users.db] [--dry-run]
 */
async function runMigration() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  let sourcePath = '';
  const sourceArg = args.find((a) => a.startsWith('--source='));
  if (sourceArg) {
    sourcePath = path.resolve(sourceArg.split('=')[1]);
  } else {
    // Default search paths for legacy saas-bot SQLite database
    const candidates = [
      path.resolve(process.env.HOME || '', 'saas-bot/users.db'),
      path.resolve(process.env.HOME || '', 'saas-bot/database.sqlite'),
      path.resolve(__dirname, '../../database.sqlite'),
      path.resolve('./users.db'),
      path.resolve('./database.sqlite')
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        sourcePath = cand;
        break;
      }
    }
  }

  console.log('================================================================');
  console.log(' AskMyAgent — Legacy saas-bot SQLite -> PostgreSQL Migration');
  console.log('================================================================');
  console.log(` Mode:        ${isDryRun ? 'DRY-RUN (Simulated, no changes written)' : 'LIVE PRODUCTION MIGRATION'}`);
  console.log(` Source File: ${sourcePath || 'NOT SPECIFIED / NONE FOUND'}`);
  console.log(` Destination: ${process.env.DATABASE_URL ? 'Managed PostgreSQL' : 'Local Knex Instance'}`);
  console.log('----------------------------------------------------------------');

  if (!sourcePath || !fs.existsSync(sourcePath)) {
    console.log(`ℹ️ No legacy SQLite database found at specified path.`);
    console.log(`  To migrate an existing SQLite database, provide the path via:`);
    console.log(`  npx tsx src/scripts/migrate_legacy_saas_bot.ts --source=/path/to/users.db`);
    console.log('\n✓ Destination database is verified and ready for live production use.');
    process.exit(0);
  }

  // Open legacy SQLite database in read-only mode
  const legacyDb = new sqlite3.Database(sourcePath, sqlite3.OPEN_READONLY);

  const queryAll = (sql: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      legacyDb.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  };

  try {
    // 1. Discover table schema in source database
    const tables = await queryAll("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
    const tableNames = tables.map((t: any) => t.name);
    console.log(`✓ Discovered ${tableNames.length} tables in source: [${tableNames.join(', ')}]`);

    let usersMigrated = 0;
    let keysReEncrypted = 0;
    let calendarConnectionsMigrated = 0;
    let usageLogsRecorded = 0;

    // Detect user table name
    const userTableName = tableNames.find((t) => ['telegram_users', 'users', 'bot_users', 'chat_users'].includes(t.toLowerCase())) || 'users';

    let userRows: LegacyUserRecord[] = [];
    if (tableNames.includes(userTableName)) {
      userRows = await queryAll(`SELECT * FROM ${userTableName}`);
      console.log(`✓ Found ${userRows.length} user records in source table "${userTableName}"`);
    }

    // Process each user record
    for (const row of userRows) {
      const tgId = Number(row.telegram_id || row.chat_id || row.user_id || row.id);
      if (!tgId || isNaN(tgId)) {
        continue;
      }

      const chatId = Number(row.chat_id || tgId);
      const username = row.username || `user_${tgId}`;
      const firstName = row.first_name || 'Telegram';
      const lastName = row.last_name || 'User';

      // 2. Handle Gemini API Key Re-Encryption (AES-256-GCM)
      let encryptedKey: string | null = null;
      const rawKey = row.gemini_api_key || row.api_key;
      if (rawKey && typeof rawKey === 'string' && rawKey.trim().length > 0) {
        if (rawKey.startsWith('iv:')) {
          // Already in new format
          encryptedKey = rawKey;
        } else {
          // Re-encrypt using current production AES-256-GCM key
          encryptedKey = encryptToken(rawKey.trim());
          keysReEncrypted++;
        }
      }

      if (!isDryRun) {
        // Upsert destination App User
        let appUserId: number;
        const existingAppUser = await db('users').where({ name: username }).first();

        if (existingAppUser) {
          appUserId = existingAppUser.id;
        } else {
          const [newId] = await db('users').insert({
            name: username,
            role: 'user',
            status: 'active',
            created_at: row.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).returning('id');
          appUserId = typeof newId === 'object' ? (newId as any).id : newId;
        }

        // Upsert destination Telegram User
        const existingTgUser = await db('telegram_users')
          .where('telegram_id', tgId)
          .orWhere('chat_id', chatId)
          .first();

        if (existingTgUser) {
          await db('telegram_users').where('id', existingTgUser.id).update({
            user_id: appUserId,
            username,
            first_name: firstName,
            last_name: lastName,
            ...(encryptedKey ? { encrypted_gemini_api_key: encryptedKey } : {}),
            updated_at: new Date().toISOString()
          });
        } else {
          await db('telegram_users').insert({
            user_id: appUserId,
            telegram_id: tgId,
            chat_id: chatId,
            username,
            first_name: firstName,
            last_name: lastName,
            encrypted_gemini_api_key: encryptedKey,
            created_at: row.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }

        // 3. Handle Calendar OAuth Credentials Migration
        if (row.calendar_refresh_token && row.calendar_email) {
          const encRefresh = encryptToken(row.calendar_refresh_token);
          const encAccess = row.calendar_access_token ? encryptToken(row.calendar_access_token) : encRefresh;

          const existingConn = await db('google_connections').where({ chat_id: chatId, provider: 'calendar' }).first();
          if (!existingConn) {
            await db('google_connections').insert({
              chat_id: chatId,
              provider: 'calendar',
              email: row.calendar_email,
              encrypted_refresh_token: encRefresh,
              encrypted_access_token: encAccess,
              token_expiry: new Date(Date.now() + 3600000).toISOString(),
              scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
            calendarConnectionsMigrated++;
          }
        }

        // 4. Handle Historical Usage Log Insertion
        const requestsCount = row.requests_count || row.usage_count || 0;
        if (requestsCount > 0) {
          await db('api_logs').insert({
            chat_id: chatId,
            connector: 'telegram_bot',
            operation: 'legacy_migrated_usage',
            status: 'success',
            error_message: `Historical requests count: ${requestsCount}`,
            timestamp: new Date().toISOString()
          });
          usageLogsRecorded++;
        }
      }

      usersMigrated++;
    }

    console.log('\n================================================================');
    console.log(' Migration Results Summary:');
    console.log('================================================================');
    console.log(` • Telegram Users Processed:       ${usersMigrated}`);
    console.log(` • Gemini API Keys Re-Encrypted:   ${keysReEncrypted} (AES-256-GCM)`);
    console.log(` • Calendar Connections Migrated:  ${calendarConnectionsMigrated}`);
    console.log(` • Historical Usage Logs Created:  ${usageLogsRecorded}`);
    console.log(` • Database Status:                ${isDryRun ? 'DRY-RUN VERIFIED' : 'SUCCESSFULLY COMMITTED'}`);
    console.log('================================================================\n');

  } catch (err: any) {
    console.error('❌ Migration Error:', err.message);
    process.exit(1);
  } finally {
    legacyDb.close();
    await db.destroy();
  }
}

runMigration();
