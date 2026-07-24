// pages/api/projects/[id]/banners/[bannerId].js
// PATCH → atualiza banner
// DELETE → remove banner

import sql from '../../../../../lib/db';

export default async function handler(req, res) {
  const { id, bannerId } = req.query;

  if (req.method === 'PATCH') {
    try {
      const { text, bg_color, text_color, font_family, font_size } = req.body;
      await sql`
        UPDATE banners SET
          text = ${text},
          bg_color = ${bg_color},
          text_color = ${text_color},
          font_family = ${font_family},
          font_size = ${font_size}
        WHERE id = ${bannerId} AND project_id = ${id}
      `;
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM banners WHERE id = ${bannerId} AND project_id = ${id}`;
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido.' });
  }
}
