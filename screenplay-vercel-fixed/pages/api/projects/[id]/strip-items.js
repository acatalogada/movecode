import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../lib/db';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const { id, plan_id } = req.query;

  if (req.method === 'GET') {
    try {
      const items = plan_id
        ? await sql`SELECT * FROM strip_items WHERE project_id = ${id} AND plan_id = ${plan_id} ORDER BY position ASC`
        : await sql`SELECT * FROM strip_items WHERE project_id = ${id} AND plan_id IS NULL ORDER BY position ASC`;
      res.json({ items });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else if (req.method === 'POST') {
    try {
      const { type, text, url, bg_color, text_color, font_family, font_size, position, plan_id: bodyPlanId, date } = req.body;
      const newId = uuidv4();
      await sql`INSERT INTO strip_items (id, project_id, plan_id, type, text, url, bg_color, text_color, font_family, font_size, position, date)
        VALUES (${newId}, ${id}, ${bodyPlanId || null}, ${type}, ${text||''}, ${url||''}, ${bg_color||'#185FA5'}, ${text_color||'#FFFFFF'}, ${font_family||'sans-serif'}, ${font_size||14}, ${position??0}, ${date||null})`;
      res.json({ id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
