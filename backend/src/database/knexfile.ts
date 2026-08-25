import '../config/env';
import { Knex } from 'knex';
import path from 'path';
import * as initSchema from './migrations/20260824000000_init_schema';
import * as alignUsersTelegramSchema from './migrations/20260824010000_align_users_telegram_schema';
import * as addChatIdColumn from './migrations/20260824020000_add_chat_id_column';
import * as addIndexes from './migrations/20260824030000_add_indexes';
import * as postgresIndexesAndTypes from './migrations/20260824040000_postgres_indexes_and_types';
import * as widenTelegramIds from './migrations/20260825000000_widen_telegram_ids_to_bigint';

export const migrationSource = {
  getMigrations() {
    return Promise.resolve([
      '20260824000000_init_schema',
      '20260824010000_align_users_telegram_schema',
      '20260824020000_add_chat_id_column',
      '20260824030000_add_indexes',
      '20260824040000_postgres_indexes_and_types',
      '20260825000000_widen_telegram_ids_to_bigint'
    ]);
  },
  getMigrationName(migration: string) {
    return migration;
  },
  getMigration(migration: string) {
    switch (migration) {
      case '20260824000000_init_schema':
        return Promise.resolve(initSchema);
      case '20260824010000_align_users_telegram_schema':
        return Promise.resolve(alignUsersTelegramSchema);
      case '20260824020000_add_chat_id_column':
        return Promise.resolve(addChatIdColumn);
      case '20260824030000_add_indexes':
        return Promise.resolve(addIndexes);
      case '20260824040000_postgres_indexes_and_types':
        return Promise.resolve(postgresIndexesAndTypes);
      case '20260825000000_widen_telegram_ids_to_bigint':
        return Promise.resolve(widenTelegramIds);
      default:
        return Promise.reject(new Error(`Unknown migration: ${migration}`));
    }
  }
};

const defaultDbPath = path.join(__dirname, '../../database.sqlite');
const dbUrl = process.env.DATABASE_URL;
const isPostgres = !!dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'));

if (process.env.NODE_ENV === 'production' && !isPostgres) {
  throw new Error('DATABASE_URL must be configured with a PostgreSQL connection string in production.');
}

const config: { [key: string]: Knex.Config } = {
  development: isPostgres
    ? {
        client: 'pg',
        connection: {
          connectionString: dbUrl,
          ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
        },
        pool: { min: 2, max: 10 },
        migrations: {
          migrationSource,
          tableName: 'knex_migrations'
        }
      }
    : {
        client: 'sqlite3',
        connection: {
          filename: process.env.DATABASE_PATH || defaultDbPath
        },
        useNullAsDefault: true,
        migrations: {
          migrationSource,
          tableName: 'knex_migrations'
        }
      },
  production: {
    client: 'pg',
    connection: {
      connectionString: dbUrl,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
    },
    pool: { min: 2, max: 20 },
    migrations: {
      migrationSource,
      tableName: 'knex_migrations'
    }
  },
  test: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:'
    },
    useNullAsDefault: true,
    migrations: {
      migrationSource,
      tableName: 'knex_migrations'
    }
  }
};

export default config;
