// pages/api/projects/[id]/budget.js
import sql from '../../../../lib/db';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const { id, plan_id } = req.query;

  if (req.method === 'GET') {
    try {
      const [row] = await sql`
        SELECT sections FROM budget_sections
        WHERE project_id = ${id} AND plan_id = ${plan_id}
      `;
      res.json({ sections: row?.sections || null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else if (req.method === 'POST') {
    try {
      const { sections } = req.body;
      await sql`
        INSERT INTO budget_sections (project_id, plan_id, sections, updated_at)
        VALUES (${id}, ${plan_id}, ${JSON.stringify(sections)}, NOW())
        ON CONFLICT (project_id, plan_id)
        DO UPDATE SET sections = ${JSON.stringify(sections)}, updated_at = NOW()
      `;
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: 'Método não permitido.' });
  }
}
