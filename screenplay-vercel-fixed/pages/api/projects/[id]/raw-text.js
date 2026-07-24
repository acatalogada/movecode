import sql from '../../../../lib/db';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT raw_text FROM projects WHERE id = ${id}`;
      if (!rows.length) return res.status(404).json({ error: 'Projeto não encontrado.' });
      return res.json({ text: rows[0].raw_text || '' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const { raw_text, append } = req.body;
  if (!raw_text) return res.status(400).json({ error: 'Texto inválido.' });

  try {
    if (append) {
      // Concatena ao texto existente
      await sql`UPDATE projects SET raw_text = COALESCE(raw_text, '') || ${raw_text} WHERE id = ${id}`;
    } else {
      // Substitui o texto
      await sql`UPDATE projects SET raw_text = ${raw_text} WHERE id = ${id}`;
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
