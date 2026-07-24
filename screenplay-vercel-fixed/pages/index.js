// pages/index.js — Dashboard principal (modo escuro padrão)

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

const statusLabel = { processing:'Analisando...', done:'Pronto', error:'Erro' };
const statusColor = { processing:'text-amber-500', done:'text-green-500', error:'text-red-400' };
const statusDot   = { processing:'bg-amber-400', done:'bg-green-400', error:'bg-red-400' };

// Extrai texto de PDF direto no navegador — tenta múltiplas abordagens
async function extractPDFTextClient(file) {
  // Abordagem 1: pdfjs via CDN
  try {
    const text = await extractWithPdfjs(file);
    if (text && text.trim().length > 50) return text;
  } catch(e) { console.warn('pdfjs falhou:', e.message); }

  // Abordagem 2: lê o binário do PDF e extrai strings de texto legíveis
  try {
    const text = await extractTextFromBinary(file);
    if (text && text.trim().length > 50) return text;
  } catch(e) { console.warn('binary falhou:', e.message); }

  throw new Error('Não foi possível ler o PDF automaticamente. Por favor, abra o PDF, selecione tudo (Ctrl+A), copie (Ctrl+C) e cole na caixa de texto abaixo.');
}

async function extractWithPdfjs(file) {
  await new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(i => i.str).join(' '));
  }
  return pages.join('\n');
}

async function extractTextFromBinary(file) {
  const ab = await file.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let result = '';
  // Extrai sequências de caracteres ASCII legíveis do binário do PDF
  let current = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b <= 126) {
      current += String.fromCharCode(b);
    } else {
      if (current.length > 4) result += current + ' ';
      current = '';
    }
  }
  // Filtra strings que parecem palavras reais (não metadados binários)
  const words = result.split(/\s+/).filter(w => w.length > 2 && /[a-zA-ZÀ-ú]/.test(w));
  return words.join(' ');
}

// Extrai texto de um DOCX no lado do cliente via CDN
async function extractDOCXTextClient(file) {
  await new Promise((resolve, reject) => {
    if (window.mammoth) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value || '';
}

export default function Dashboard() {
  const router = useRouter();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [drag, setDrag] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [menuOpen, setMenuOpen] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [pendingFile, setPendingFile] = useState(null); // arquivo aguardando confirmação do aviso
  const [joinCode, setJoinCode] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const fileRef = useRef();

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    try {
      const r = await fetch('/api/projects');
      const d = await r.json();
      setProjects(d.projects || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function upload(file) {
    if (!file) return;
    setUploading(true);
    setProgress(10);
    try {
      let text = '';
      const filename = file.name || '';
      const mime = file.type || '';

      // Extrai texto no cliente para evitar o limite de 4.5MB da Vercel
      if (mime.includes('pdf') || filename.endsWith('.pdf')) {
        setProgress(20);
        text = await extractPDFTextClient(file);
        setProgress(50);
      } else if (mime.includes('wordprocessingml') || mime.includes('msword') || filename.endsWith('.docx') || filename.endsWith('.doc')) {
        setProgress(20);
        text = await extractDOCXTextClient(file);
        setProgress(50);
      } else if (filename.endsWith('.fdx') || filename.endsWith('.fdr')) {
        // Final Draft XML — converte para texto legível
        setProgress(20);
        const raw = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(raw, 'text/xml');
        const paragraphs = doc.querySelectorAll('Paragraph');
        const lines = [];
        paragraphs.forEach(p => {
          const type = p.getAttribute('Type') || '';
          const textContent = Array.from(p.querySelectorAll('Text')).map(t => t.textContent).join('');
          if (!textContent.trim()) return;
          if (type === 'Scene Heading') {
            const num = p.querySelector('SceneProperties')?.getAttribute('Number') || '';
            lines.push(`\n${num ? num + ' ' : ''}${textContent.trim()}\n`);
          } else if (type === 'Action') {
            lines.push(textContent.trim());
          } else if (type === 'Character') {
            lines.push(`\n                ${textContent.trim()}`);
          } else if (type === 'Parenthetical') {
            lines.push(`              ${textContent.trim()}`);
          } else if (type === 'Dialogue') {
            lines.push(`          ${textContent.trim()}\n`);
          } else if (type === 'Transition') {
            lines.push(`\n                                        ${textContent.trim()}\n`);
          } else {
            lines.push(textContent.trim());
          }
        });
        text = lines.join('\n');
        setProgress(50);
      } else {
        text = await file.text();
        setProgress(50);
      }

      if (!text || text.trim().length < 100) {
        throw new Error('Não foi possível extrair texto do arquivo. Verifique se é um PDF com camada de texto (não escaneado).');
      }

      // Envia o texto extraído como JSON — mais confiável que FormData na Vercel
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);

      // Salva o raw_text separadamente em chunks de 3mb para evitar limite Vercel
      const CHUNK = 3 * 1024 * 1024; // 3mb
      for (let i = 0; i < text.length; i += CHUNK) {
        const part = text.slice(i, i + CHUNK);
        const isFirst = i === 0;
        await fetch(`/api/projects/${d.project_id}/raw-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_text: part, append: !isFirst }),
        });
      }

      setProgress(100);
      load();
      setTimeout(() => router.push(`/project/${d.project_id}`), 800);
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  async function uploadText() {
    if (pasteText.trim().length < 100) { alert('Texto muito curto.'); return; }
    setUploading(true);
    try {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      load();
      setTimeout(() => router.push(`/project/${d.project_id}`), 800);
    } catch (e) {
      alert('Erro: ' + e.message);
    } finally {
      setUploading(false);
    }
  }

  async function del(id, e) {
    e.stopPropagation();
    if (!confirm('Remover este projeto?')) return;
    await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    setProjects((p) => p.filter((x) => x.id !== id));
  }

  async function rename(id, title) {
    if (!title.trim()) return;
    await fetch(`/api/projects/${id}/cover`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim() }),
    });
    setProjects(prev => prev.map(p => p.id === id ? { ...p, title: title.trim() } : p));
    setRenamingId(null);
  }

  async function join() {
    if (joinCode.length < 4) return;
    try {
      const r = await fetch(`/api/join/${joinCode}`);
      const d = await r.json();
      if (!r.ok) { setJoinErr(d.error || 'Código inválido'); return; }
      router.push(`/project/${d.project_id}`);
    } catch { setJoinErr('Erro ao entrar no projeto'); }
  }

  const dm = darkMode;

  return (
    <div className={`min-h-screen ${dm ? 'bg-gray-950 text-gray-100' : 'bg-[#f8f7f4] text-gray-900'}`}>
      {/* Header */}
      <header className={`border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎬</span>
          <div>
            <h1 className={`text-base font-bold ${dm ? 'text-white' : 'text-gray-900'}`}>Movie Magic</h1>
            <p className={`text-[11px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Breakdown inteligente de roteiros</p>
          </div>
        </div>
        <button onClick={() => setDarkMode(d => !d)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${dm ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-100'}`}
          title={dm ? 'Modo claro' : 'Modo escuro'}>
          {dm ? '☀️' : '🌙'}
        </button>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="md:col-span-2 space-y-6">
          {/* Upload */}
          <div className={`rounded-2xl border p-6 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
            <h2 className={`text-sm font-semibold mb-4 ${dm ? 'text-gray-200' : 'text-gray-700'}`}>Novo projeto</h2>
            {!showPaste ? (
              <>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); setPendingFile(e.dataTransfer.files[0]); }}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    drag
                      ? 'border-brand-400 bg-brand-500/10'
                      : dm
                        ? 'border-gray-700 hover:border-brand-500 hover:bg-gray-800'
                        : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
                  }`}>
                  <input ref={fileRef} type="file" accept=".pdf,.txt,.fountain,.fdx,.docx" className="hidden" onChange={(e) => setPendingFile(e.target.files[0])} />
                  {uploading ? (
                    <div>
                      <div className={`w-full rounded-full h-2 mb-3 ${dm ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <p className={`text-sm ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Enviando e analisando...</p>
                      <p className={`text-xs mt-2 font-medium ${dm ? 'text-amber-400' : 'text-amber-600'}`}>⚠️ Não feche esta janela até o processamento terminar</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-3xl mb-3">📄</p>
                      <p className={`text-sm font-medium ${dm ? 'text-gray-300' : 'text-gray-800'}`}>Arraste o roteiro aqui</p>
                      <p className={`text-xs mt-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>PDF com texto selecionável, DOCX ou TXT</p>
                      <p className={`text-xs mt-1 ${dm ? 'text-gray-600' : 'text-gray-300'}`}>⚠️ PDFs escaneados ou de impressão virtual não funcionam</p>
                    </div>
                  )}
                </div>
                <p className={`text-center text-xs mt-2 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                  ou{' '}
                  <button onClick={() => setShowPaste(true)} className="text-brand-400 hover:underline">
                    cole o texto do roteiro
                  </button>
                </p>
              </>
            ) : (
              <div className={`border rounded-xl p-4 ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Cole aqui o texto do roteiro...\n\nINT. DELEGACIA - DIA\n\nMARCOS (40) entra nervoso."}
                  className={`w-full h-48 text-xs font-mono border rounded-lg p-3 resize-none outline-none focus:border-brand-400 ${dm ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-200 text-gray-800'}`}
                />
                <div className="flex gap-2 mt-3">
                  <button onClick={uploadText} disabled={uploading}
                    className="flex-1 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors">
                    {uploading ? 'Analisando...' : '🪄 Analisar roteiro'}
                  </button>
                  <button onClick={() => setShowPaste(false)}
                    className={`px-4 py-2 border text-sm rounded-lg transition-colors ${dm ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Lista de projetos */}
          <div>
            <h2 className={`text-sm font-semibold mb-3 ${dm ? 'text-gray-300' : 'text-gray-700'}`}>Projetos recentes</h2>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map((i) => (
                  <div key={i} className={`h-16 rounded-xl animate-pulse ${dm ? 'bg-gray-800' : 'bg-gray-100'}`} />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className={`border rounded-xl p-8 text-center ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
                <p className="text-3xl mb-2">🎥</p>
                <p className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Nenhum projeto ainda. Envie seu primeiro roteiro!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <div key={p.id}
                    onClick={() => p.status === 'done' && router.push(`/project/${p.id}`)}
                    className={`border rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${
                      dm
                        ? `bg-gray-900 border-gray-800 ${p.status === 'done' ? 'cursor-pointer hover:border-brand-500 hover:bg-gray-800' : 'cursor-default'}`
                        : `bg-white border-gray-100 ${p.status === 'done' ? 'cursor-pointer hover:border-brand-300 hover:shadow-sm' : 'cursor-default'}`
                    }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${dm ? 'bg-gray-800' : 'bg-brand-50'}`}>📋</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${dm ? 'text-gray-200' : 'text-gray-900'}`}>{p.title}</p>
                      <p className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                        {p.author && `${p.author} · `}
                        {p.total_scenes > 0 && `${p.total_scenes} cenas · `}
                        {new Date(p.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${statusDot[p.status]}`} />
                      <span className={`text-xs font-medium ${statusColor[p.status]}`}>{statusLabel[p.status]}</span>
                    </div>
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                        className={`p-1.5 rounded-lg transition-colors text-sm ${dm ? 'text-gray-600 hover:text-gray-300 hover:bg-gray-800' : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'}`}>
                        ···
                      </button>
                      {menuOpen === p.id && (
                        <div className={`absolute right-0 top-8 border rounded-xl shadow-lg py-1 w-36 z-30 ${dm ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                          <button onClick={() => { setRenamingId(p.id); setRenameValue(p.title); setMenuOpen(null); }}
                            className={`w-full text-left px-4 py-2 text-xs transition-colors ${dm ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                            ✏️ Renomear
                          </button>
                          <button onClick={(e) => { setMenuOpen(null); del(p.id, e); }}
                            className={`w-full text-left px-4 py-2 text-xs transition-colors ${dm ? 'text-red-400 hover:bg-gray-700' : 'text-red-500 hover:bg-red-50'}`}>
                            🗑 Excluir
                          </button>
                        </div>
                      )}
                    </div>
                    {p.status === 'done' && <span className={`text-sm ${dm ? 'text-gray-600' : 'text-gray-300'}`}>›</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Entrar em projeto */}
          <div className={`border rounded-xl p-4 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span>👥</span>
              <h3 className={`text-sm font-semibold ${dm ? 'text-gray-200' : 'text-gray-800'}`}>Entrar em um projeto</h3>
            </div>
            <p className={`text-xs mb-3 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Recebeu um código de equipe? Digite abaixo.</p>
            <input value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Ex: ABC123" maxLength={6}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono text-center tracking-widest outline-none focus:border-brand-400 mb-2 ${dm ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}
              onKeyDown={(e) => e.key === 'Enter' && join()}
            />
            {joinErr && <p className="text-xs text-red-400 mb-2">{joinErr}</p>}
            <button onClick={join} disabled={joinCode.length < 4}
              className="w-full py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 disabled:opacity-40 transition-colors">
              Entrar
            </button>
          </div>

          {/* Como funciona */}
          <div className={`border rounded-xl p-4 ${dm ? 'bg-gray-900 border-gray-800' : 'bg-brand-50 border-brand-100'}`}>
            <h3 className={`text-xs font-semibold mb-2 ${dm ? 'text-brand-400' : 'text-brand-700'}`}>Como funciona</h3>
            <ol className={`text-xs space-y-1.5 ${dm ? 'text-gray-400' : 'text-brand-600'}`}>
              <li>① Envie o roteiro (PDF ou texto)</li>
              <li>② A análise será feita automaticamente</li>
              <li>③ Explore o breakdown completo</li>
              <li>④ Exporte para Excel, PDF ou CSV</li>
              <li>⑤ Compartilhe com a equipe via código</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Fecha menu ao clicar fora */}
      {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(null)} />}

      {/* Aviso pré-upload: checklist de requisitos */}
      {pendingFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="text-2xl mb-3">📋</div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Antes de enviar, confirme:</h3>
            <p className="text-xs text-gray-500 mb-4">Esses requisitos garantem que a análise funcione corretamente, sem inventar cenas ou misturar informações.</p>
            <ul className="space-y-3 mb-5">
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                <span className="text-sm text-gray-700"><strong>As cenas estão numeradas</strong> — cada cena tem um número (ex: 1, 2, 3... ou 1A, 1B). Sem numeração, a IA pode misturar cenas.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                <span className="text-sm text-gray-700"><strong>Os cabeçalhos de cena estão no formato padrão</strong> — ex: <code className="bg-gray-100 px-1 rounded text-xs">INT. HOSPITAL - DIA</code> ou <code className="bg-gray-100 px-1 rounded text-xs">EXT. RUA - NOITE</code>.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                <span className="text-sm text-gray-700"><strong>O PDF tem texto selecionável</strong> — você consegue selecionar e copiar texto no arquivo. PDFs escaneados não funcionam.</span>
              </li>
            </ul>
            <div className="flex gap-2">
              <button onClick={() => setPendingFile(null)}
                className="flex-1 px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={() => { upload(pendingFile); setPendingFile(null); }}
                className="flex-1 px-4 py-2 text-sm text-white bg-brand-500 rounded-xl hover:bg-brand-600 font-medium">
                Sim, confirmo — Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de renomear projeto */}
      {renamingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRenamingId(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-gray-800 mb-4">✏️ Renomear projeto</h3>
            <input autoFocus className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-400 mb-4 text-gray-900 bg-white"
              value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') rename(renamingId, renameValue); if (e.key === 'Escape') setRenamingId(null); }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRenamingId(null)} className="px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={() => rename(renamingId, renameValue)} className="px-4 py-2 text-xs text-white bg-brand-500 rounded-lg hover:bg-brand-600">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
