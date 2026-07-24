// pages/api/join/[code].js
// GET /api/join/:code → busca o projeto associado ao código de equipe

import sql from '../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { code } = req.query;

  try {
    const [session] = await sql`
      SELECT ts.project_id, p.title, p.author, p.total_scenes, p.status
      FROM team_sessions ts
      JOIN projects p ON p.id = ts.project_id
      WHERE ts.session_code = ${code.toUpperCase()}
        AND ts.expires_at > NOW()
    `;

    if (!session) {
      return res.status(404).json({ error: 'Código inválido ou expirado.' });
    }

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
