// pages/api/extract-pdf.js
// Usa a API da Anthropic para extrair texto de PDF nativamente
// A Anthropic suporta PDFs como documentos — é mais confiável que pdfjs em serverless

export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const { base64, filename } = req.body;
  if (!base64) return res.status(400).json({ error: 'PDF não enviado.' });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Extraia TODO o texto deste roteiro, mantendo a estrutura original (cabeçalhos de cena, diálogos, ações). Retorne apenas o texto puro, sem comentários seus, sem markdown, sem explicações. Comece direto com o conteúdo do roteiro.',
          }
        ],
      }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    if (!text || text.trim().length < 100) {
      return res.status(400).json({ error: 'Não foi possível extrair texto do PDF.' });
    }

    res.json({ text });
  } catch (err) {
    console.error('Erro ao extrair PDF:', err.message);
    res.status(500).json({ error: 'Erro ao processar PDF: ' + err.message });
  }
}
