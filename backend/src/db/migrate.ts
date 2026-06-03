import { query, testConnection } from './pool';
import dotenv from 'dotenv';

dotenv.config();

const migrations = [
  {
    name: 'create_conversations',
    sql: `
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB NOT NULL DEFAULT '{}'
      );
    `,
  },
  {
    name: 'create_messages',
    sql: `
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'ai')),
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
        ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at
        ON messages(created_at);
    `,
  },
  {
    name: 'create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `,
  },
];

async function runMigrations(): Promise<void> {
  await testConnection();

  // Create migrations tracking table first
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const migration of migrations) {
    if (migration.name === 'create_migrations_table') continue;

    const existing = await query<{ name: string }>(
      'SELECT name FROM schema_migrations WHERE name = $1',
      [migration.name]
    );

    if (existing.length > 0) {
      console.log(`⏭️  Skipping migration: ${migration.name}`);
      continue;
    }

    console.log(`🔄 Running migration: ${migration.name}`);
    await query(migration.sql);
    await query(
      'INSERT INTO schema_migrations (name) VALUES ($1)',
      [migration.name]
    );
    console.log(`✅ Migration complete: ${migration.name}`);
  }

  console.log('✅ All migrations complete');
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
