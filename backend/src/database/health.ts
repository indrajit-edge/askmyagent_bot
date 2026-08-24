import fs from 'fs';
import path from 'path';
import db from './connection';

export type DatabaseStatus = 'HEALTHY' | 'UNHEALTHY';

export async function checkDatabaseConnectivity(): Promise<void> {
  await db.raw('SELECT 1');
}

export async function getDatabaseSizeKb(): Promise<number | null> {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
    const pgSizeResult = await db.raw('SELECT pg_database_size(current_database()) as size_bytes;');
    const bytes = parseInt(pgSizeResult.rows?.[0]?.size_bytes || '0', 10);
    return Number.isFinite(bytes) ? Math.round(bytes / 1024) : null;
  }

  const dbPath = path.join(__dirname, '../../database.sqlite');
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  const stats = fs.statSync(dbPath);
  return Math.round(stats.size / 1024);
}
