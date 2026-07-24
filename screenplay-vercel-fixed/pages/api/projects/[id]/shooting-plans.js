import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../lib/db';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const plans = await sql`SELECT * FROM shooting_plans WHERE project_id = ${id} ORDER BY created_at ASC`;
      res.json({ plans });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else if (req.method === 'POST') {
    try {
      const { name, scene_order } = req.body;
      const newId = uuidv4();
      await sql`INSERT INTO shooting_plans (id, project_id, name, scene_order)
        VALUES (${newId}, ${id}, ${name || 'Novo Plano'}, ${JSON.stringify(scene_order || [])})`;
      res.json({ id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
