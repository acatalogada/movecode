// pages/api/projects/[id]/scenes/[sceneId].js
// PATCH /api/projects/:id/scenes/:sceneId — atualiza campos de uma cena

import sql from '../../../../../lib/db';
import { normalizeDisplay } from '../../../../../lib/normalize';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { id, sceneId } = req.query;
  const body = req.body;

  const allowed = ['location', 'set_name', 'synopsis', 'characters', 'int_ext',
                   'day_night', 'props', 'wardrobe', 'vfx', 'vehicles', 'extras',
                   'estimated_pages', 'is_flashback', 'notes',
                   'stunts', 'art', 'set_dressing', 'weapons', 'sfx', 'animals',
                   'extra_fields'];

  const updates = Object.keys(body).filter((k) => allowed.includes(k));
  if (updates.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo válido para atualizar.' });
  }

  try {
    // Garante que as novas colunas existem
    await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS notes TEXT`;
    await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS stunts JSONB DEFAULT '[]'`;
    await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS art JSONB DEFAULT '[]'`;
    await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS set_dressing JSONB DEFAULT '[]'`;
    await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS weapons JSONB DEFAULT '[]'`;
    await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS sfx JSONB DEFAULT '[]'`;
    await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS animals JSONB DEFAULT '[]'`;
    await sql`ALTER TABLE scenes ADD COLUMN IF NOT EXISTS extra_fields TEXT DEFAULT '[]'`;
    for (const field of updates) {
      let val = body[field];
      if (field === 'characters' && Array.isArray(val)) {
        val = val.map(normalizeDisplay).filter(Boolean);
      }
      const isJson = ['characters','props','wardrobe','vfx','vehicles','extras',
                      'stunts','art','set_dressing','weapons','sfx','animals'].includes(field);
      if (isJson) {
        await sql`UPDATE scenes SET ${sql(field)} = ${JSON.stringify(val)} WHERE id = ${sceneId} AND project_id = ${id}`;
      } else {
        await sql`UPDATE scenes SET ${sql(field)} = ${val} WHERE id = ${sceneId} AND project_id = ${id}`;
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao atualizar cena:', err.message);
    res.status(500).json({ error: err.message });
  }
}
