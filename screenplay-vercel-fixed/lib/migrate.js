// lib/migrate.js
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('🔧 Criando/atualizando tabelas no Neon...');

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      author        TEXT DEFAULT '',
      year          INTEGER,
      total_scenes  INTEGER DEFAULT 0,
      total_pages   REAL DEFAULT 0,
      status        TEXT DEFAULT 'processing',
      raw_text      TEXT DEFAULT '',
      chunks_total  INTEGER DEFAULT 0,
      chunks_done   INTEGER DEFAULT 0,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Adiciona colunas novas caso a tabela já exista
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS raw_text TEXT DEFAULT ''`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS chunks_total INTEGER DEFAULT 0`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS chunks_done INTEGER DEFAULT 0`;

  await sql`
    CREATE TABLE IF NOT EXISTS scenes (
      id              TEXT PRIMARY KEY,
      project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scene_number    INTEGER NOT NULL,
      int_ext         TEXT DEFAULT 'INT',
      location        TEXT DEFAULT '',
      set_name        TEXT DEFAULT '',
      day_night       TEXT DEFAULT 'DIA',
      synopsis        TEXT DEFAULT '',
      characters      JSONB DEFAULT '[]',
      props           JSONB DEFAULT '[]',
      wardrobe        JSONB DEFAULT '[]',
      vfx             JSONB DEFAULT '[]',
      vehicles        JSONB DEFAULT '[]',
      extras          JSONB DEFAULT '[]',
      estimated_pages REAL DEFAULT 1,
      is_flashback    BOOLEAN DEFAULT FALSE,
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS team_sessions (
      id           TEXT PRIMARY KEY,
      project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      session_code TEXT UNIQUE NOT NULL,
      created_at   TIMESTAMPTZ DEFAULT NOW(),
      expires_at   TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
    )
  `;

  console.log('✅ Banco de dados atualizado com sucesso!');
}

migrate().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
