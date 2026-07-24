import sql from '../../../../../lib/db';

export default async function handler(req, res) {
  const { id, itemId } = req.query;
  if (req.method === 'PATCH') {
    try {
      const { type, text, url, bg_color, text_color, font_family, font_size, date } = req.body;
      await sql`UPDATE strip_items SET type=${type}, text=${text||''}, url=${url||''}, bg_color=${bg_color||'#185FA5'},
        text_color=${text_color||'#FFFFFF'}, font_family=${font_family||'sans-serif'}, font_size=${font_size||14}, date=${date||null}
        WHERE id = ${itemId} AND project_id = ${id}`;
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM strip_items WHERE id = ${itemId} AND project_id = ${id}`;
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  } else { res.status(405).json({ error: 'Método não permitido.' }); }
}
