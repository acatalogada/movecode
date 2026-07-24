// pages/api/projects/index.js
// GET  /api/projects  → lista todos os projetos
// POST /api/projects  → faz upload do roteiro e prepara análise em chunks

import { v4 as uuidv4 } from 'uuid';
import sql from '../../../lib/db';
import { extractMetadata } from '../../../lib/analyze';

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

// Tamanho de cada chunk em caracteres
const CHUNK_SIZE = 4000;

export default async function handler(req, res) {
  if (req.method === 'GET') return listProjects(req, res);
  if (req.method === 'POST') return uploadProject(req, res);
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).json({ error: 'Método não permitido.' });
}

async function listProjects(req, res) {
  try {
    const projects = await sql`
      SELECT id, title, author, year, total_scenes, total_pages,
             status, chunks_total, chunks_done, created_at
      FROM projects
      ORDER BY created_at DESC
    `;
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function uploadProject(req, res) {
  const projectId = uuidv4();

  try {
    const { text: rawText } = req.body;
    const text = (rawText || '').trim();

    if (!text || text.length < 100) {
      return res.status(400).json({ error: 'Texto do roteiro muito curto ou vazio.' });
    }

    // Calcula quantos chunks serão necessários
    const chunksTotal = Math.ceil(text.length / CHUNK_SIZE);

    // Detecta o maior número de cena real no texto (para filtrar cenas fantasmas depois)
    const sceneNumbers = [...text.matchAll(/^\s*(\d+[A-Za-z]?)\s+(?:INT|EXT|INT\/EXT)/gim)].map(m => parseInt(m[1]));
    const maxSceneNumber = sceneNumbers.length > 0 ? Math.max(...sceneNumbers) : 9999;

    // Extrai metadados e cria o projeto salvando o texto completo
    const meta = await extractMetadata(text);
    await sql`
      INSERT INTO projects (id, title, author, year, status, raw_text, chunks_total, chunks_done)
      VALUES (
        ${projectId},
        ${meta.title || 'Roteiro sem título'},
        ${meta.author || ''},
        ${meta.year || null},
        'processing',
        ${text},
        ${chunksTotal},
        ${0}
      )
    `;

    // Salva o número máximo de cena detectado para filtrar cenas fantasmas
    await sql`UPDATE projects SET max_scene_number = ${maxSceneNumber} WHERE id = ${projectId}`.catch(() => {});

    // Responde imediatamente com o ID e total de chunks
    res.status(202).json({
      project_id: projectId,
      status: 'processing',
      chunks_total: chunksTotal,
    });

  } catch (err) {
    console.error('Erro no upload:', err.message);
    await sql`
      UPDATE projects SET status = 'error', updated_at = NOW()
      WHERE id = ${projectId}
    `.catch(() => {});
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
}
