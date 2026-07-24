// pages/api/projects/[id]/status.js
// GET /api/projects/:id/status → retorna status atual do processamento
// Usado pelo frontend para fazer polling enquanto a IA analisa

import sql from '../../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query;

  try {
    const [project] = await sql`
      SELECT id, status, title, total_scenes, total_pages
      FROM projects
      WHERE id = ${id}
    `;

    if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
