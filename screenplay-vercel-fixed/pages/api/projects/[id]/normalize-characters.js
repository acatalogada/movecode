// pages/api/projects/[id]/normalize-characters.js
// Corrige cenas já existentes que têm o mesmo personagem grafado de formas diferentes
// (ex: "ALAN", "Alan", "alan" viram todos "ALAN").

import sql from '../../../../lib/db';
import { normalizeDisplay } from '../../../../lib/normalize';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  const { id } = req.query;

  try {
    const scenes = await sql`SELECT id, characters FROM scenes WHERE project_id = ${id}`;
    let updatedCount = 0;

    for (const scene of scenes) {
      const original = Array.isArray(scene.characters) ? scene.characters : [];
      const normalized = [...new Set(original.map(normalizeDisplay).filter(Boolean))];

      // Só atualiza se realmente mudou algo, para não gerar updates desnecessários
      const changed = JSON.stringify(original) !== JSON.stringify(normalized);
      if (changed) {
        await sql`UPDATE scenes SET characters = ${JSON.stringify(normalized)} WHERE id = ${scene.id}`;
        updatedCount++;
      }
    }

    res.json({ ok: true, scenesChecked: scenes.length, scenesUpdated: updatedCount });
  } catch (err) {
    console.error('Erro ao normalizar personagens:', err.message);
    res.status(500).json({ error: err.message });
  }
}
