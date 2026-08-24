import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add performance indexes on frequently queried fields
  try {
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_telegram_users_tg_id ON telegram_users(telegram_id);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_telegram_users_chat_id ON telegram_users(chat_id);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id ON telegram_users(user_id);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_google_connections_chat_prov ON google_connections(chat_id, provider);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_api_logs_chat_id ON api_logs(chat_id);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs(timestamp);');
  } catch (err) {
    console.warn('[Migration] Note: index creation warning (may already exist):', err);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Safe rollback
}
