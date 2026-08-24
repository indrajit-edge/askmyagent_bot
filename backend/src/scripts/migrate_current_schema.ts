import db from '../database/connection';

async function runCurrentSchemaMigrations() {
  if (process.env.NODE_ENV === 'production') {
    const dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
      throw new Error('Refusing to run production migrations without a PostgreSQL DATABASE_URL.');
    }
  }

  const [batchNo, migrations] = await db.migrate.latest();
  console.log(`[Database] Current AskMyAgent schema migrations complete. Batch ${batchNo}; applied ${migrations.length} migration(s).`);
}

runCurrentSchemaMigrations()
  .catch((err) => {
    console.error('[Database] Current schema migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
