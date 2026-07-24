// pages/api/projects/[id]/share.js
// POST /api/projects/:id/share → gera código de compartilhamento para equipe
// GET  /api/projects/join/:code → redireciona para o projeto (em outra rota)

import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query;

  try {
    const [project] = await sql`SELECT id FROM projects WHERE id = ${id}`;
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });

    // Gera código alfanumérico de 6 caracteres (fácil de digitar)
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    await sql`
      INSERT INTO team_sessions (id, project_id, session_code)
      VALUES (${uuidv4()}, ${id}, ${code})
      ON CONFLICT (session_code) DO UPDATE SET session_code = ${code}
    `;

    res.json({ code, expires_in: '30 dias' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
