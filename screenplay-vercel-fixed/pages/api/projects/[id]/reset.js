import sql from '../../../../lib/db';
import { analyzeScreenplayChunk } from '../../../../lib/analyze';

const CHUNK_SIZE = 2000;

export default async function handler(req, res) {
  const { id, debug } = req.query;
  try {
    const [project] = await sql`SELECT id, title, status, raw_text, chunks_total, chunks_done FROM projects WHERE id = ${id}`;
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });

    if (debug === '1') {
      // Modo debug: testa só o primeiro chunk e retorna erro se houver
      const text = project.raw_text || '';
      const chunkText = text.slice(0, CHUNK_SIZE);
      try {
        const scenes = await analyzeScreenplayChunk(chunkText, project.title, 1, 0, 1);
        return res.json({ ok: true, scenes_found: scenes.length, first_scene: scenes[0] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // Reset normal
    const text = project.raw_text || '';
    const newChunksTotal = text.length > 0 ? Math.ceil(text.length / CHUNK_SIZE) : 1;
    await sql`DELETE FROM scenes WHERE project_id = ${id}`;
    await sql`UPDATE projects SET status = 'processing', chunks_done = 0, chunks_total = ${newChunksTotal}, updated_at = NOW() WHERE id = ${id}`;
    res.json({ ok: true, chunks_total: newChunksTotal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
