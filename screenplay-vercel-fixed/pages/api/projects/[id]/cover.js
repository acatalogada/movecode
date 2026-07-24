import sql from '../../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Método não permitido.' });
  const { id } = req.query;
  const { title, author, director, production_company, synopsis, whatsapp, email, link, shoot_start_date, shoot_end_date } = req.body;
  try {
    await sql`
      UPDATE projects SET
        title              = ${title || ''},
        author             = ${author || ''},
        director           = ${director || ''},
        production_company = ${production_company || ''},
        synopsis           = ${synopsis || ''},
        whatsapp           = ${whatsapp || ''},
        email              = ${email || ''},
        link               = ${link || ''},
        shoot_start_date   = ${shoot_start_date || null},
        shoot_end_date     = ${shoot_end_date || null},
        updated_at         = NOW()
      WHERE id = ${id}
    `;
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}
