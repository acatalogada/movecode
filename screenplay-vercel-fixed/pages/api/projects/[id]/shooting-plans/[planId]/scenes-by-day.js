import sql from '../../../../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });
  const { id, planId } = req.query;
  try {
    const days = await sql`
      SELECT * FROM shooting_days 
      WHERE project_id = ${id} AND plan_id = ${planId} 
      ORDER BY position ASC
    `;
    
    const allScenes = await sql`
      SELECT id, scene_number, location, set_name, day_night, int_ext, synopsis, characters
      FROM scenes WHERE project_id = ${id} ORDER BY scene_number ASC
    `;

    const result = days.map(day => {
      // Usa scene_ids do banco — que é sincronizado pela Strip
      const sceneIds = Array.isArray(day.scene_ids) ? day.scene_ids : 
                       (typeof day.scene_ids === 'string' ? JSON.parse(day.scene_ids || '[]') : []);
      
      const dayScenes = sceneIds
        .map(sid => allScenes.find(s => s.id === sid))
        .filter(Boolean);

      return {
        id: day.id,
        date: day.date,
        position: day.position,
        scenes: dayScenes,
      };
    });

    res.json({ days: result });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
}
