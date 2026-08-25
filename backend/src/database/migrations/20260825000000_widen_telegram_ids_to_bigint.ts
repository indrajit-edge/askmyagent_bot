import { Knex } from 'knex';

/**
 * Telegram IDs have outgrown 32-bit integers (modern user/chat ids exceed
 * 2^31 - 1). Widen every Telegram identity column from INTEGER to BIGINT so
 * real production chat_ids (e.g. 7319408446) do not overflow.
 *
 * Uses raw ALTER COLUMN TYPE statements: PostgreSQL keeps NOT NULL, the
 * UNIQUE constraint, and dependent indexes intact while rewriting them.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE telegram_users ALTER COLUMN telegram_id TYPE BIGINT');
  await knex.raw('ALTER TABLE telegram_users ALTER COLUMN chat_id TYPE BIGINT');
  await knex.raw('ALTER TABLE google_connections ALTER COLUMN chat_id TYPE BIGINT');
  await knex.raw('ALTER TABLE api_logs ALTER COLUMN chat_id TYPE BIGINT');
}

export async function down(knex: Knex): Promise<void> {
  // Only safe when no stored value exceeds int4 range.
  await knex.raw('ALTER TABLE api_logs ALTER COLUMN chat_id TYPE INTEGER');
  await knex.raw('ALTER TABLE google_connections ALTER COLUMN chat_id TYPE INTEGER');
  await knex.raw('ALTER TABLE telegram_users ALTER COLUMN chat_id TYPE INTEGER');
  await knex.raw('ALTER TABLE telegram_users ALTER COLUMN telegram_id TYPE INTEGER');
}
