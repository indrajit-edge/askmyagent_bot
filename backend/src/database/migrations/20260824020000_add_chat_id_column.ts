import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasChatId = await knex.schema.hasColumn('telegram_users', 'chat_id');
  if (!hasChatId) {
    await knex.schema.alterTable('telegram_users', (table) => {
      table.integer('chat_id').nullable();
    });
    // Backfill chat_id with telegram_id
    await knex.raw('UPDATE telegram_users SET chat_id = telegram_id WHERE chat_id IS NULL AND telegram_id IS NOT NULL');
  }
}

export async function down(knex: Knex): Promise<void> {
  // Safe rollback
}
