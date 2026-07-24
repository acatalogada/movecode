import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../../../lib/db';

export default async function handler(req, res) {
  const { orderId } = req.query;
  if (req.method === 'POST') {
    try {
      const { character_name, actor_name, scenes, makeup_time, call_time, position } = req.body;
      const newId = uuidv4();
      await sql`INSERT INTO daily_order_cast (id, daily_order_id, character_name, actor_name, scenes, makeup_time, call_time, position)
        VALUES (${newId}, ${orderId}, ${character_name||''}, ${actor_name||''}, ${scenes||''}, ${makeup_time||''}, ${call_time||''}, ${position||0})`;
      res.json({ id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else if (req.method === 'DELETE') {
    try {
      const { castId } = req.query;
      await sql`DELETE FROM daily_order_cast WHERE id=${castId} AND daily_order_id=${orderId}`;
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
