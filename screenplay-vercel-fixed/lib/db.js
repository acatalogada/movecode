// lib/db.js
// Conexão com o banco de dados Neon (Postgres serverless)
// O @neondatabase/serverless usa HTTP em vez de TCP — funciona perfeitamente
// em ambientes serverless como Vercel Functions

import { neon } from '@neondatabase/serverless';

// Cria a conexão usando a variável de ambiente DATABASE_URL
const sql = neon(process.env.DATABASE_URL);

export default sql;

// ── Helpers tipados ──────────────────────────────────────────────────────────

// Busca um único registro
export async function getOne(query, ...params) {
  const rows = await sql(query, params);
  return rows[0] || null;
}

// Busca múltiplos registros
export async function getMany(query, ...params) {
  return sql(query, params);
}

// Executa INSERT/UPDATE/DELETE
export async function execute(query, ...params) {
  return sql(query, params);
}
