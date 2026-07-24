// pages/api/projects/[id]/banners.js
// GET  → lista banners do projeto
// POST → cria novo banner

import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const banners = await sql`
        SELECT * FROM banners WHERE project_id = ${id} ORDER BY position ASC
      `;
      res.json({ banners });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { text, bg_color, text_color, font_family, font_size, position } = req.body;
      const id_banner = uuidv4();
      await sql`
        INSERT INTO banners (id, project_id, text, bg_color, text_color, font_family, font_size, position)
        VALUES (${id_banner}, ${id}, ${text}, ${bg_color}, ${text_color}, ${font_family}, ${font_size}, ${position ?? 0})
      `;
      res.json({ id: id_banner });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido.' });
  }
}
