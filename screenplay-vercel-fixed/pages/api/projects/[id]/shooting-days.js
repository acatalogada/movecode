import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../lib/db';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const { id, plan_id } = req.query;

  if (req.method === 'GET') {
    try {
      const { all } = req.query;
      const days = all === 'true'
        ? await sql`SELECT * FROM shooting_days WHERE project_id = ${id} ORDER BY position ASC`
        : plan_id
        ? await sql`SELECT * FROM shooting_days WHERE project_id = ${id} AND plan_id = ${plan_id} ORDER BY position ASC`
        : await sql`SELECT * FROM shooting_days WHERE project_id = ${id} AND plan_id IS NULL ORDER BY position ASC`;
      res.json({ days });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else if (req.method === 'POST') {
    try {
      const { date, position, plan_id: bodyPlanId, scene_ids } = req.body;
      // Verifica se a data já existe neste plano
      const existing = bodyPlanId
        ? await sql`SELECT id FROM shooting_days WHERE project_id = ${id} AND plan_id = ${bodyPlanId} AND date = ${date}`
        : await sql`SELECT id FROM shooting_days WHERE project_id = ${id} AND plan_id IS NULL AND date = ${date}`;
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Esta data já está sendo usada neste plano.' });
      }
      const newId = uuidv4();
      const cleanDate = (date || '').split('T')[0]; // garante formato YYYY-MM-DD
      const sceneIdsJson = JSON.stringify(scene_ids || []);
      await sql`INSERT INTO shooting_days (id, project_id, plan_id, date, position, scene_ids)
        VALUES (${newId}, ${id}, ${bodyPlanId || null}, ${cleanDate}, ${position ?? 0}, ${sceneIdsJson})`;
      res.json({ id: newId, date: cleanDate, position });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
