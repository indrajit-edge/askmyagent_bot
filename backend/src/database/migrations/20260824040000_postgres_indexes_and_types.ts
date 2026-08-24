import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  try {
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_api_logs_chat_time ON api_logs(chat_id, timestamp);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_api_logs_conn_time ON api_logs(connector, timestamp);');
    await knex.raw('CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);');
  } catch (err) {
    console.warn('[Migration:20260824040000] Notice:', err);
  }
}

export async function down(knex: Knex): Promise<void> {
  try {
    await knex.raw('DROP INDEX IF EXISTS idx_api_logs_chat_time;');
    await knex.raw('DROP INDEX IF EXISTS idx_api_logs_conn_time;');
    await knex.raw('DROP INDEX IF EXISTS idx_users_role_status;');
  } catch {
    // Ignore
  }
}
