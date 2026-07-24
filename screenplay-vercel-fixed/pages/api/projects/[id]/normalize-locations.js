// Normaliza todas as locações do projeto para CAIXA ALTA
import sql from '../../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const { id } = req.query;
  try {
    await sql`
      UPDATE scenes
      SET location = UPPER(TRIM(location)),
          set_name = UPPER(TRIM(set_name))
      WHERE project_id = ${id}
    `;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
