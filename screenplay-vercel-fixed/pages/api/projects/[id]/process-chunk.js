// pages/api/projects/[id]/process-chunk.js
export const config = {
  api: { bodyParser: true },
  maxDuration: 55,
};

import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import sql from '../../../../lib/db';
import { analyzeScreenplayChunk } from '../../../../lib/analyze';
import { normalizeDisplay } from '../../../../lib/normalize';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CHUNK_SIZE = 4000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id } = req.query;

  try {
    const [project] = await sql`
      SELECT id, title, status, raw_text, chunks_total, chunks_done, max_scene_number
      FROM projects WHERE id = ${id}
    `;

    if (!project) return res.status(404).json({ error: 'Projeto não encontrado.' });
    if (project.status === 'done') return res.json({ status: 'done' });
    if (project.status === 'error') return res.json({ status: 'error' });

    const chunkIndex = project.chunks_done;
    const text = project.raw_text;

    if (chunkIndex >= project.chunks_total) {
      const [totals] = await sql`
        SELECT COUNT(*) as total_scenes, COALESCE(SUM(estimated_pages), 0) as total_pages
        FROM scenes WHERE project_id = ${id}
      `;

      let autoSynopsis = '';
      try {
        const allScenes = await sql`
          SELECT scene_number, location, synopsis, characters, day_night
          FROM scenes WHERE project_id = ${id}
          ORDER BY scene_number ASC
        `;
        const sceneSummary = allScenes.slice(0, 40).map(s =>
          `Cena ${s.scene_number} (${s.location}): ${s.synopsis}`
        ).join('\n');

        const synopsisRes = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `Com base nas cenas abaixo do roteiro "${project.title}", escreva uma sinopse em português brasileiro com exatamente 15 linhas. Deve ser fluida, em prosa, sem numeração ou marcadores. Apresente a história, os personagens principais e o conflito central.\n\nCENAS:\n${sceneSummary}\n\nSINOPSE (15 linhas):`,
          }],
        });
        autoSynopsis = synopsisRes.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      } catch (e) {
        console.warn('Erro ao gerar sinopse:', e.message);
      }

      const newChunksDone = chunkIndex;
      await sql`
        UPDATE projects
        SET chunks_done = ${newChunksDone},
            status = 'done',
            total_scenes = ${parseInt(totals.total_scenes)},
            total_pages = ${parseFloat(totals.total_pages)},
            synopsis = ${autoSynopsis},
            updated_at = NOW()
        WHERE id = ${id}
      `;
      return res.json({ status: 'done', chunks_done: newChunksDone, chunks_total: project.chunks_total });
    }

    const start = chunkIndex * CHUNK_SIZE;
    const end = start + CHUNK_SIZE;
    const chunkText = text.slice(start, end);

    const [lastScene] = await sql`
      SELECT COALESCE(MAX(scene_number::integer), 0) as last_number
      FROM scenes WHERE project_id = ${id}
    `;
    const startSceneNumber = parseInt(lastScene.last_number) + 1;

    const scenes = await analyzeScreenplayChunk(
      chunkText,
      project.title,
      startSceneNumber,
      chunkIndex,
      project.chunks_total
    );

    const existingNumbers = new Set(
      (await sql`SELECT scene_number FROM scenes WHERE project_id = ${id}`).map(r => parseInt(r.scene_number))
    );

    for (const scene of scenes) {
      const sceneNum = parseInt(scene.scene_number);
      if (!sceneNum || sceneNum <= 0) {
        console.warn('Cena ignorada — scene_number inválido:', scene.scene_number);
        continue;
      }
      const maxSceneNumber = parseInt(project.max_scene_number) || 9999;
      if (sceneNum > maxSceneNumber) {
        console.warn('Cena ignorada — número acima do máximo detectado:', sceneNum, '>', maxSceneNumber);
        continue;
      }
      if (existingNumbers.has(sceneNum)) {
        console.warn('Cena ignorada — número duplicado:', sceneNum);
        continue;
      }
      existingNumbers.add(sceneNum);

      await sql`
        INSERT INTO scenes (
          id, project_id, scene_number, int_ext, location, set_name,
          day_night, synopsis, characters, props, wardrobe, vfx,
          vehicles, extras, estimated_pages, is_flashback
        ) VALUES (
          ${uuidv4()}, ${id}, ${scene.scene_number},
          ${scene.int_ext || 'INT'}, ${scene.location || ''},
          ${scene.set_name || ''}, ${scene.day_night || 'DIA'},
          ${scene.synopsis || ''},
          ${JSON.stringify((scene.characters || []).map(normalizeDisplay).filter(Boolean))},
          ${JSON.stringify(scene.props || [])},
          ${JSON.stringify(scene.wardrobe || [])},
          ${JSON.stringify(scene.vfx || [])},
          ${JSON.stringify(scene.vehicles || [])},
          ${JSON.stringify(scene.extras || [])},
          ${scene.estimated_pages || 1},
          ${scene.is_flashback ? true : false}
        )
      `.catch((e) => console.warn('Erro ao salvar cena:', e.message));
    }

    const newChunksDone = chunkIndex + 1;
    const isLast = newChunksDone >= project.chunks_total;

    if (isLast) {
      const [totals] = await sql`
        SELECT COUNT(*) as total_scenes, COALESCE(SUM(estimated_pages), 0) as total_pages
        FROM scenes WHERE project_id = ${id}
      `;

      let autoSynopsis = '';
      try {
        const allScenes = await sql`
          SELECT scene_number, location, synopsis, characters, day_night
          FROM scenes WHERE project_id = ${id}
          ORDER BY scene_number ASC
        `;
        const sceneSummary = allScenes.slice(0, 40).map(s =>
          `Cena ${s.scene_number} (${s.location}): ${s.synopsis}`
        ).join('\n');

        const synopsisRes = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `Com base nas cenas abaixo do roteiro "${project.title}", escreva uma sinopse em português brasileiro com exatamente 15 linhas. Deve ser fluida, em prosa, sem numeração ou marcadores. Apresente a história, os personagens principais e o conflito central.\n\nCENAS:\n${sceneSummary}\n\nSINOPSE (15 linhas):`,
          }],
        });
        autoSynopsis = synopsisRes.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      } catch (e) {
        console.warn('Erro ao gerar sinopse:', e.message);
      }

      await sql`
        UPDATE projects
        SET chunks_done = ${newChunksDone},
            status = 'done',
            total_scenes = ${parseInt(totals.total_scenes)},
            total_pages = ${parseFloat(totals.total_pages)},
            synopsis = ${autoSynopsis},
            updated_at = NOW()
        WHERE id = ${id}
      `;
      return res.json({ status: 'done', chunks_done: newChunksDone, chunks_total: project.chunks_total });
    } else {
      await sql`
        UPDATE projects
        SET chunks_done = ${newChunksDone}, updated_at = NOW()
        WHERE id = ${id}
      `;
      return res.json({
        status: 'processing',
        chunks_done: newChunksDone,
        chunks_total: project.chunks_total,
      });
    }

  } catch (err) {
    console.error('Erro no chunk:', err.message);
    await sql`
      UPDATE projects SET status = 'error', updated_at = NOW()
      WHERE id = ${id}
    `.catch(() => {});
    res.status(500).json({ error: err.message });
  }
}
