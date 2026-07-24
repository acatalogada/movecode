// pages/api/projects/[id].js
// GET    /api/projects/:id  → projeto + todas as cenas
// DELETE /api/projects/:id  → remove projeto e cenas

import sql from '../../../../lib/db';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const [project] = await sql`SELECT id, title, author, year, status, synopsis, chunks_total, chunks_done, max_scene_number FROM projects WHERE id = ${id}`;
      if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });

      const [rawRow] = await sql`SELECT raw_text FROM projects WHERE id = ${id}`;
      project.raw_text = rawRow?.raw_text || null;

      // Garante que colunas novas existem e scene_number suporta letras (29B, 12A)
      await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS notes TEXT`;
      await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS stunts JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS art JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS set_dressing JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS weapons JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS sfx JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS animals JSONB DEFAULT '[]'`;
      await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS extra_fields TEXT DEFAULT '[]'`;
      // Muda scene_number para TEXT para suportar 29B, 12A, etc
      await sql`ALTER TABLE scenes ALTER COLUMN scene_number TYPE TEXT USING scene_number::TEXT`.catch(() => {});

      const scenes = await sql`
        SELECT * FROM scenes
        WHERE project_id = ${id}
        ORDER BY scene_number::integer ASC
      `;

      res.json({ project, scenes });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  else if (req.method === 'DELETE') {
    try {
      // ON DELETE CASCADE cuida das cenas e sessões automaticamente
      await sql`DELETE FROM projects WHERE id = ${id}`;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  else if (req.method === 'PATCH') {
    try {
      const { status } = req.body;
      if (status === 'processing') {
        const CHUNK_SIZE = 2000;
        const [proj] = await sql`SELECT raw_text FROM projects WHERE id = ${id}`;
        const textLen = (proj?.raw_text || '').length;
        const newChunksTotal = textLen > 0 ? Math.ceil(textLen / CHUNK_SIZE) : 1;
        await sql`DELETE FROM scenes WHERE project_id = ${id}`;
        await sql`UPDATE projects SET status = 'processing', chunks_done = 0, chunks_total = ${newChunksTotal}, updated_at = NOW() WHERE id = ${id}`;
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  else {
    res.setHeader('Allow', ['GET', 'DELETE']);
    res.status(405).json({ error: 'Método não permitido.' });
  }
}
