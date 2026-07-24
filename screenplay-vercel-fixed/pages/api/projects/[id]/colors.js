import { v4 as uuidv4 } from 'uuid';
import sql from '../../../../lib/db';

const DEFAULTS = {
  ext_color: '#A32D2D',
  int_color: '#0F6E56',
  int_ext_color: '#993556',
  dia_color: '#854F0B',
  noite_color: '#3C3489',
  manha_color: '#0C447C',
  tarde_color: '#3B6D11',
  fim_tarde_color: '#993C1D',
};

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const [colors] = await sql`SELECT * FROM project_colors WHERE project_id = ${id}`;
      res.json({ colors: colors || DEFAULTS });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else if (req.method === 'POST') {
    try {
      const fields = { ...DEFAULTS, ...req.body };
      const existing = await sql`SELECT id FROM project_colors WHERE project_id = ${id}`;
      if (existing.length > 0) {
        await sql`UPDATE project_colors SET
          ext_color=${fields.ext_color}, int_color=${fields.int_color}, int_ext_color=${fields.int_ext_color},
          dia_color=${fields.dia_color}, noite_color=${fields.noite_color}, manha_color=${fields.manha_color},
          tarde_color=${fields.tarde_color}, fim_tarde_color=${fields.fim_tarde_color}
          WHERE project_id = ${id}`;
      } else {
        const newId = uuidv4();
        await sql`INSERT INTO project_colors (id, project_id, ext_color, int_color, int_ext_color, dia_color, noite_color, manha_color, tarde_color, fim_tarde_color)
          VALUES (${newId}, ${id}, ${fields.ext_color}, ${fields.int_color}, ${fields.int_ext_color}, ${fields.dia_color}, ${fields.noite_color}, ${fields.manha_color}, ${fields.tarde_color}, ${fields.fim_tarde_color})`;
      }
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }

  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
