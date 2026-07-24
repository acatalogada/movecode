import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../../../lib/db';

export default async function handler(req, res) {
  const { id, orderId } = req.query;

  if (req.method === 'GET') {
    try {
      const [order] = await sql`SELECT * FROM daily_orders WHERE id = ${orderId} AND project_id = ${id}`;
      if (!order) return res.status(404).json({ error: 'OD não encontrada.' });
      const scenes = await sql`SELECT * FROM daily_order_scenes WHERE daily_order_id = ${orderId} ORDER BY position ASC`;
      const items = await sql`SELECT * FROM daily_order_items WHERE daily_order_id = ${orderId} ORDER BY position ASC`;
      const cast = await sql`SELECT * FROM daily_order_cast WHERE daily_order_id = ${orderId} ORDER BY position ASC`;
      res.json({ order, scenes, items, cast });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else if (req.method === 'PATCH') {
    try {
      const { call_time, shoot_start, location, address, meeting_point, location_contact, notes, day_number } = req.body;
      await sql`
        UPDATE daily_orders SET
          call_time = ${call_time||''}, shoot_start = ${shoot_start||''},
          location = ${location||''}, address = ${address||''},
          meeting_point = ${meeting_point||''}, location_contact = ${location_contact||''},
          notes = ${notes||''}, day_number = ${day_number||1}
        WHERE id = ${orderId} AND project_id = ${id}
      `;
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM daily_orders WHERE id = ${orderId} AND project_id = ${id}`;
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
