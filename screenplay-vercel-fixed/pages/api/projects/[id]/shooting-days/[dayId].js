import sql from '../../../../../lib/db';

export default async function handler(req, res) {
  const { id, dayId } = req.query;
  if (req.method === 'PATCH') {
    try {
      const { date, scene_ids } = req.body;
      if (date !== undefined && scene_ids !== undefined) {
        await sql`UPDATE shooting_days SET date = ${date}, scene_ids = ${JSON.stringify(scene_ids)} WHERE id = ${dayId} AND project_id = ${id}`;
      } else if (date !== undefined) {
        await sql`UPDATE shooting_days SET date = ${date} WHERE id = ${dayId} AND project_id = ${id}`;
      } else if (scene_ids !== undefined) {
        await sql`UPDATE shooting_days SET scene_ids = ${JSON.stringify(scene_ids)} WHERE id = ${dayId} AND project_id = ${id}`;
      }
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM shooting_days WHERE id = ${dayId} AND project_id = ${id}`;
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
