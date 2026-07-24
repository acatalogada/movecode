import sql from '../../../../lib/db';
import { analyzeScreenplayChunk } from '../../../../lib/analyze';

const CHUNK_SIZE = 2000;

export default async function handler(req, res) {
  const { id } = req.query;
  try {
    const [project] = await sql`SELECT id, title, status, raw_text, chunks_total, chunks_done FROM projects WHERE id = ${id}`;
    if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });
    
    const text = project.raw_text || '';
    const chunkText = text.slice(0, CHUNK_SIZE);
    
    // Testa só o primeiro chunk
    const scenes = await analyzeScreenplayChunk(chunkText, project.title, 1, 0, project.chunks_total);
    
    res.json({ ok: true, scenes_found: scenes.length, scenes, chunk_preview: chunkText.substring(0, 200) });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
