import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const orders = await sql`
        SELECT * FROM daily_orders WHERE project_id = ${id} ORDER BY date ASC, day_number ASC
      `;
      res.json({ orders });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else if (req.method === 'POST') {
    try {
      const { plan_id, date, day_number, call_time, shoot_start, location, address, meeting_point, location_contact, notes } = req.body;
      const cleanDate = (date || '').split('T')[0] || new Date().toISOString().split('T')[0];
      const newId = uuidv4();
      await sql`
        INSERT INTO daily_orders (id, project_id, plan_id, date, day_number, call_time, shoot_start, location, address, meeting_point, location_contact, notes)
        VALUES (${newId}, ${id}, ${plan_id||null}, ${cleanDate}, ${day_number||1}, ${call_time||''}, ${shoot_start||''}, ${location||''}, ${address||''}, ${meeting_point||''}, ${location_contact||''}, ${notes||''})
      `;
      res.json({ id: newId });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
