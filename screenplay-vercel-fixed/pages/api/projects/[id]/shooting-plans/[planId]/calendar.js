// Configuração de calendário do plano: data início, fim, regra de folga
import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../../../lib/db';

export default async function handler(req, res) {
  const { id, planId } = req.query;

  if (req.method === 'GET') {
    try {
      const [cal] = await sql`SELECT * FROM plan_calendars WHERE plan_id = ${planId}`;
      res.json({ calendar: cal || null });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else if (req.method === 'POST') {
    try {
      const { start_date, end_date, off_every } = req.body;
      const existing = await sql`SELECT id FROM plan_calendars WHERE plan_id = ${planId}`;
      if (existing.length > 0) {
        await sql`UPDATE plan_calendars SET start_date=${start_date}, end_date=${end_date||null}, off_every=${off_every||0} WHERE plan_id = ${planId}`;
        res.json({ id: existing[0].id });
      } else {
        const newId = uuidv4();
        await sql`INSERT INTO plan_calendars (id, plan_id, start_date, end_date, off_every) VALUES (${newId}, ${planId}, ${start_date}, ${end_date||null}, ${off_every||0})`;
        res.json({ id: newId });
      }
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
