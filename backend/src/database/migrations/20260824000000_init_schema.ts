import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Users table for Admin & Web Access
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('email').nullable();
    table.string('password_hash').nullable();
    table.string('role').defaultTo('user');
    table.string('status').defaultTo('active');
    table.timestamps(true, true);
  });

  // Telegram bot users table
  await knex.schema.createTable('telegram_users', (table) => {
    table.increments('id').primary();
    table.integer('user_id').nullable();
    table.integer('telegram_id').unique().nullable();
    table.integer('chat_id').nullable();
    table.string('username').nullable();
    table.string('first_name').nullable();
    table.string('last_name').nullable();
    table.text('encrypted_gemini_api_key').nullable();
    table.timestamp('last_seen_at').defaultTo(knex.fn.now());
    table.integer('is_blocked').defaultTo(0);
    table.timestamps(true, true);
    table.foreign('user_id').references('users.id').onDelete('CASCADE');
  });

  // Google Workspace authorized connections table
  await knex.schema.createTable('google_connections', (table) => {
    table.integer('chat_id').notNullable();
    table.string('provider').notNullable();
    table.string('email').notNullable();
    table.text('encrypted_refresh_token').notNullable();
    table.text('encrypted_access_token').notNullable();
    table.dateTime('token_expiry').notNullable();
    table.text('scopes').notNullable();
    table.timestamps(true, true);
    table.primary(['chat_id', 'provider']);
  });

  // Workspace API logs table
  await knex.schema.createTable('api_logs', (table) => {
    table.increments('id').primary();
    table.integer('chat_id').nullable();
    table.string('connector').notNullable();
    table.string('operation').notNullable();
    table.string('status').notNullable();
    table.text('error_message').nullable();
    table.timestamp('timestamp').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('api_logs');
  await knex.schema.dropTableIfExists('google_connections');
  await knex.schema.dropTableIfExists('telegram_users');
  await knex.schema.dropTableIfExists('users');
}
