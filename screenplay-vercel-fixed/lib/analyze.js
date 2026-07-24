// lib/analyze.js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function extractMetadata(text) {
  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Extraia do trecho abaixo o título do roteiro, nome do autor/roteirista e ano (se presentes).\nRetorne APENAS JSON puro: {"title":"...","author":"...","year":null}\nSem markdown, sem texto extra.\n\nTRECHO:\n${text.substring(0, 2000)}`,
      }],
    });
    const raw = res.content[0].text.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch {
    return { title: 'Roteiro sem título', author: '', year: null };
  }
}

export async function analyzeScreenplayChunk(chunkText, title, startSceneNumber, chunkIndex, chunksTotal) {
  const isFirst = chunkIndex === 0;
  const isLast = chunkIndex === chunksTotal - 1;

  let contextNote = '';
  if (isFirst) {
    contextNote = `Este é o INÍCIO do roteiro (parte 1 de ${chunksTotal}). A numeração de cenas começa em 1.`;
  } else if (isLast) {
    contextNote = `Esta é a PARTE FINAL do roteiro (parte ${chunkIndex + 1} de ${chunksTotal}). A numeração de cenas começa em ${startSceneNumber}.`;
  } else {
    contextNote = `Este é um TRECHO DO MEIO do roteiro (parte ${chunkIndex + 1} de ${chunksTotal}). A numeração de cenas começa em ${startSceneNumber}.`;
  }

  const prompt = `Analise o trecho de roteiro abaixo e faça um breakdown de CADA cena identificada.
${contextNote}

REGRAS:
1. Identifique cenas por cabeçalhos no formato INT./EXT. LOCAÇÃO - PERÍODO e variações.
2. Use o número de cena que aparece no roteiro. Se não houver número, use ${startSceneNumber} em diante.
3. IGNORE textos que não são cenas: "FIM", "THE END", créditos, notas. Se não houver cenas no trecho, retorne {"scenes": []}.

Para CADA cena, retorne JSON com estes campos:
- scene_number (inteiro), int_ext ("INT"/"EXT"/"INT/EXT"), location (CAIXA ALTA), set_name (CAIXA ALTA ou ""), day_night ("DIA"/"NOITE"/"MANHÃ"/"TARDE"/"FIM DE TARDE"), synopsis (1-2 frases), characters (array CAIXA ALTA), props (array), wardrobe (array), vfx (array), vehicles (array), extras (array), estimated_pages (decimal), is_flashback (boolean)

Retorne APENAS JSON: {"scenes": [...]}. Sem markdown, sem texto extra.

TÍTULO: ${title}

TRECHO:
${chunkText}`;

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: `Você é um assistente de produção cinematográfica profissional especializado em breakdown de roteiros brasileiros.\nSua tarefa é identificar e catalogar TODAS as cenas de um roteiro, sem exceção.\nRetorne sempre JSON válido, sem texto adicional.`,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = res.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .replace(/```json|```/g, '')
        .trim();

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*"scenes"[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error('JSON inválido na resposta');
        }
      }

      if (!Array.isArray(parsed?.scenes)) {
        throw new Error('Resposta sem array de cenas');
      }

      return parsed.scenes;

    } catch (err) {
      lastError = err;
      console.warn(`Chunk ${chunkIndex} tentativa ${attempt} falhou: ${err.message}`);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  console.warn(`Chunk ${chunkIndex} falhou após 3 tentativas — pulando: ${lastError?.message}`);
  return [];
}
