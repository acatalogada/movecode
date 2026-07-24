import sql from '../../../../../lib/db';

export default async function handler(req, res) {
  const { id, planId } = req.query;

  if (req.method === 'PATCH') {
    try {
      const { name, scene_order } = req.body;
      if (name !== undefined) {
        await sql`UPDATE shooting_plans SET name = ${name} WHERE id = ${planId} AND project_id = ${id}`;
      }
      if (scene_order !== undefined) {
        await sql`UPDATE shooting_plans SET scene_order = ${JSON.stringify(scene_order)} WHERE id = ${planId} AND project_id = ${id}`;
      }
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM shooting_plans WHERE id = ${planId} AND project_id = ${id}`;
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
