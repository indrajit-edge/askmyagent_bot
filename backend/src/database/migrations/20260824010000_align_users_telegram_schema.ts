import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Ensure chat_id and telegram_id are present on telegram_users
  const hasTelegramUsers = await knex.schema.hasTable('telegram_users');
  if (hasTelegramUsers) {
    const hasChatId = await knex.schema.hasColumn('telegram_users', 'chat_id');
    const hasTelegramId = await knex.schema.hasColumn('telegram_users', 'telegram_id');
    const hasUserId = await knex.schema.hasColumn('telegram_users', 'user_id');

    if (!hasChatId) {
      await knex.schema.alterTable('telegram_users', (table) => {
        table.integer('chat_id').nullable();
      });
    }
    if (!hasTelegramId) {
      await knex.schema.alterTable('telegram_users', (table) => {
        table.integer('telegram_id').nullable();
      });
    }
    if (!hasUserId) {
      await knex.schema.alterTable('telegram_users', (table) => {
        table.integer('user_id').nullable();
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Safe down migration
}
