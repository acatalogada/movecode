import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../../../lib/db';

export default async function handler(req, res) {
  const { orderId } = req.query;
  if (req.method === 'POST') {
    try {
      const { type, label, from_loc, to_loc, time_start, time_end, position } = req.body;
      const newId = uuidv4();
      await sql`INSERT INTO daily_order_items (id, daily_order_id, type, label, from_loc, to_loc, time_start, time_end, position)
        VALUES (${newId}, ${orderId}, ${type}, ${label||''}, ${from_loc||''}, ${to_loc||''}, ${time_start||''}, ${time_end||''}, ${position||0})`;
      res.json({ id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else if (req.method === 'PATCH') {
    try {
      const { itemId, ...f } = req.body;
      await sql`UPDATE daily_order_items SET label=${f.label||''}, from_loc=${f.from_loc||''}, to_loc=${f.to_loc||''}, time_start=${f.time_start||''}, time_end=${f.time_end||''} WHERE id=${itemId} AND daily_order_id=${orderId}`;
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else if (req.method === 'DELETE') {
    try {
      const { itemId } = req.query;
      await sql`DELETE FROM daily_order_items WHERE id=${itemId} AND daily_order_id=${orderId}`;
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
