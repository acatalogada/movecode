import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../../../lib/db';

export default async function handler(req, res) {
  const { orderId } = req.query;
  if (req.method === 'POST') {
    try {
      const { scene_id, scene_number, location, period, int_ext, prep_start, prep_end, shoot_start, shoot_end, wrap_start, wrap_end, position } = req.body;
      const newId = uuidv4();
      await sql`INSERT INTO daily_order_scenes (id, daily_order_id, scene_id, scene_number, location, period, int_ext, prep_start, prep_end, shoot_start, shoot_end, wrap_start, wrap_end, position)
        VALUES (${newId}, ${orderId}, ${scene_id||null}, ${scene_number||0}, ${location||''}, ${period||''}, ${int_ext||''}, ${prep_start||''}, ${prep_end||''}, ${shoot_start||''}, ${shoot_end||''}, ${wrap_start||''}, ${wrap_end||''}, ${position||0})`;
      res.json({ id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else if (req.method === 'PATCH') {
    try {
      const { sceneId, ...f } = req.body;
      await sql`UPDATE daily_order_scenes SET prep_start=${f.prep_start||''}, prep_end=${f.prep_end||''}, shoot_start=${f.shoot_start||''}, shoot_end=${f.shoot_end||''}, wrap_start=${f.wrap_start||''}, wrap_end=${f.wrap_end||''} WHERE id=${sceneId} AND daily_order_id=${orderId}`;
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else if (req.method === 'DELETE') {
    try {
      const { sceneId } = req.query;
      await sql`DELETE FROM daily_order_scenes WHERE id=${sceneId} AND daily_order_id=${orderId}`;
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
