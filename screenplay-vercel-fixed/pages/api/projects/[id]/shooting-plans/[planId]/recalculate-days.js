// Recalcula os scene_ids de cada dia de filmagem baseado na ordem atual do plano
import sql from '../../../../../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const { id, planId } = req.query;

  try {
    const [plan] = await sql`SELECT * FROM shooting_plans WHERE id = ${planId} AND project_id = ${id}`;
    if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });

    const sceneOrder = Array.isArray(plan.scene_order) ? plan.scene_order : [];
    const days = await sql`SELECT * FROM shooting_days WHERE project_id = ${id} AND plan_id = ${planId} ORDER BY position ASC`;

    if (days.length === 0) return res.json({ updated: 0 });

    // Estratégia simples e confiável: cada dia "reivindica" a fatia de cenas
    // entre ele e o próximo dia, na MESMA proporção do total — ou seja,
    // distribui sceneOrder em fatias iguais entre os N dias, na ordem deles.
    // Isso é uma aproximação razoável quando não há posição confiável salva.
    const sliceSize = Math.ceil(sceneOrder.length / days.length);

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const start = i * sliceSize;
      const end = i === days.length - 1 ? sceneOrder.length : start + sliceSize;
      const daySceneIds = sceneOrder.slice(start, end);
      await sql`UPDATE shooting_days SET scene_ids = ${JSON.stringify(daySceneIds)} WHERE id = ${day.id}`;
    }

    res.json({ updated: days.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
