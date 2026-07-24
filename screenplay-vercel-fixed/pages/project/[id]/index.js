// pages/project/[id].js — Visualizador completo de breakdown

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { exportCSV, exportXLSX, exportPDF, exportJSON, exportStripboardPDF } from '../../../lib/exports';

const DN = {
  DIA:           { bg:'bg-amber-100',   text:'text-amber-800',   dot:'🌞' },
  NOITE:         { bg:'bg-indigo-100',  text:'text-indigo-800',  dot:'🌙' },
  'MANHÃ':       { bg:'bg-blue-100',    text:'text-blue-800',    dot:'🌅' },
  TARDE:         { bg:'bg-green-100',   text:'text-green-800',   dot:'🌇' },
  'FIM DE TARDE':{ bg:'bg-orange-100',  text:'text-orange-700',  dot:'🌆' },
};
const IE = {
  INT:     { bg:'bg-teal-100',  text:'text-teal-800' },
  EXT:     { bg:'bg-rose-100',  text:'text-rose-800' },
  'INT/EXT':{ bg:'bg-pink-100', text:'text-pink-800' },
};

function Badge({ type, map, label }) {
  const s = map[type] || { bg:'bg-gray-100', text:'text-gray-600' };
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
      {s.dot && <span>{s.dot}</span>} {label || type}
    </span>
  );
}

// Versão compacta: I/E e período lado a lado numa linha só, sem ocupar espaço vertical à toa.
const DEFAULT_COLORS = {
  ext_color: null,
  int_color: null,
  int_ext_color: null,
  dia_color: null,
  noite_color: null,
  manha_color: null,
  tarde_color: null,
  fim_tarde_color: null,
};

const PERIOD_ABBR = { DIA:'D', NOITE:'N', 'MANHÃ':'M', TARDE:'T', 'FIM DE TARDE':'FT' };

function CompactIEPeriod({ intExt, dayNight, darkMode }) {
  const periodLetter = PERIOD_ABBR[dayNight] || '';
  const neutralBg = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const neutralText = darkMode ? '#e5e7eb' : '#374151';
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
      style={{ background: neutralBg, color: neutralText }}>
      {intExt}
      {periodLetter && <><span className="opacity-40">·</span><span className="font-medium opacity-80">{periodLetter}</span></>}
    </span>
  );
}

function Tag({ children }) {
  return (
    <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-500 mr-0.5 mb-0.5">
      {children}
    </span>
  );
}

const SORT_OPTIONS = [
  { key: 'shoot_date', label: 'Data de filmagem' },
  { key: 'location',   label: 'Locação' },
];

function CharacterDOOD({ scenes, sceneDates, darkMode, project, planName }) {
  // Monta: personagem → { dias: { data: [cenas] }, totalDiarias }
  const dood = {};
  scenes.forEach(s => {
    const date = sceneDates?.[s.id];
    if (!date) return; // só conta cenas que já têm data de filmagem
    (s.characters || []).forEach(char => {
      if (!dood[char]) dood[char] = {};
      if (!dood[char][date]) dood[char][date] = [];
      dood[char][date].push(s);
    });
  });

  const characters = Object.keys(dood).sort();
  const allDates = [...new Set(Object.values(dood).flatMap(d => Object.keys(d)))].sort();

  function formatD(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
  }

  function exportDOODPDF() {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8"><title>Diárias por personagem — ${project?.title||''}</title>
<style>
body{font-family:Arial,sans-serif;font-size:10px;margin:18px;color:#111}
h1{font-size:16px;margin-bottom:2px}
p.sub{font-size:10px;color:#555;margin-bottom:14px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #ddd;padding:5px 6px;text-align:center;font-size:9px}
th{background:#eee;font-weight:bold}
td.char-name{text-align:left;font-weight:bold;color:#185FA5}
td.work{background:#e1f5ee;color:#085041;font-weight:bold}
td.total{font-weight:bold;background:#f5f5f5}
@media print{@page{size:A4 landscape;margin:10mm}}
</style></head><body>
<h1>Di&aacute;rias por personagem (DOOD)</h1>
<p class="sub">${project?.title||''} ${planName?'· '+planName:''} · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
<table><thead><tr>
<th>Personagem</th>${allDates.map(d => `<th>${formatD(d)}</th>`).join('')}<th>Total diárias</th>
</tr></thead><tbody>
${characters.map(char => {
  const days = dood[char];
  const total = Object.keys(days).length;
  return `<tr><td class="char-name">${char}</td>${allDates.map(d => days[d] ? `<td class="work">${days[d].length}</td>` : `<td>—</td>`).join('')}<td class="total">${total}</td></tr>`;
}).join('')}
</tbody></table>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }

  if (characters.length === 0) {
    return <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Nenhuma cena com data de filmagem neste plano ainda. Insira dias de filmagem no Stripboard primeiro.</p>;
  }

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={exportDOODPDF}
          className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors">
          📄 Exportar PDF
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className={`text-left px-2 py-1.5 sticky left-0 ${darkMode ? 'bg-gray-900 text-gray-400' : 'bg-white text-gray-500'}`}>Personagem</th>
              {allDates.map(d => (
                <th key={d} className={`px-2 py-1.5 text-center text-[10px] font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{formatD(d)}</th>
              ))}
              <th className={`px-2 py-1.5 text-center text-[10px] font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {characters.map(char => {
              const days = dood[char];
              const total = Object.keys(days).length;
              return (
                <tr key={char} className={`border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
                  <td className={`px-2 py-1.5 font-medium sticky left-0 ${darkMode ? 'bg-gray-900 text-gray-200' : 'bg-white text-gray-700'}`}>{char}</td>
                  {allDates.map(d => (
                    <td key={d} className="px-2 py-1.5 text-center">
                      {days[d] ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${darkMode ? 'bg-teal-900/40 text-teal-300' : 'bg-teal-50 text-teal-700'}`} title={days[d].map(s=>'#'+s.scene_number).join(', ')}>
                          {days[d].length}
                        </span>
                      ) : (
                        <span className={`text-[10px] ${darkMode ? 'text-gray-700' : 'text-gray-200'}`}>—</span>
                      )}
                    </td>
                  ))}
                  <td className={`px-2 py-1.5 text-center font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TimeInput({ value, onChange, darkMode: dm }) {
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);
  function handleBlur() {
    const digits = local.replace(/[^0-9]/g, '');
    let f = local;
    if (digits.length === 4) f = digits.slice(0,2) + ':' + digits.slice(2,4);
    else if (digits.length === 3) f = '0' + digits[0] + ':' + digits.slice(1);
    else if (digits.length === 2 && !local.includes(':')) f = digits + ':00';
    setLocal(f); onChange(f);
  }
  return (
    <input type="text" value={local} onChange={e => setLocal(e.target.value)} onBlur={handleBlur}
      placeholder="hh:mm"
      className={`w-14 text-center font-mono text-xs outline-none border-b py-0.5 bg-transparent ${dm ? 'border-gray-600 text-gray-200 focus:border-brand-400' : 'border-gray-200 text-gray-700 focus:border-brand-400'}`} />
  );
}

function toMin(t) { if (!t || !t.includes(':')) return null; const [h,m] = t.split(':').map(Number); return h*60+m; }
function diffMin(a,b) { const ma=toMin(a),mb=toMin(b); if(ma===null||mb===null||mb<=ma) return null; return mb-ma; }
function fmtMin(m) { if(!m) return '—'; const h=Math.floor(m/60),mn=m%60; return h>0?h+'h'+String(mn).padStart(2,'0'):mn+'min'; }

const ITEM_TYPES = {
  desl:       { label: 'Deslocamento',      icon: '🚐' },
  almoco:     { label: 'Almoço',            icon: '🍽️' },
  lanche:     { label: 'Lanche',            icon: '☕' },
  jantar:     { label: 'Jantar',            icon: '🌙' },
  desp_geral: { label: 'Desprodução geral', icon: '📦' },
};

function ODTab({ project, scenes, plans, darkMode: dm }) {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [showItemMenu, setShowItemMenu] = useState(false);
  const [callTimeOffset, setCallTimeOffset] = useState(90); // padrão 90min = 1h30

  const muted = dm ? 'text-gray-500' : 'text-gray-400';
  const border = dm ? 'border-gray-800' : 'border-gray-100';
  const cardCls = `border rounded-xl overflow-hidden ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'}`;
  const secTitle = `text-[9px] font-medium uppercase tracking-widest px-4 py-2 flex items-center justify-between border-b ${dm ? 'bg-gray-800 border-gray-700 text-gray-500' : 'bg-gray-50 border-gray-100 text-gray-400'}`;

  const ITEMS = [
    { type: 'cafe',       label: 'Café da manhã', icon: '☕' },
    { type: 'almoco',     label: 'Almoço',         icon: '🍽️' },
    { type: 'lanche',     label: 'Lanche',          icon: '🥪' },
    { type: 'jantar',     label: 'Jantar',           icon: '🌙' },
    { type: 'desl',       label: 'Deslocamento',     icon: '🚐' },
    { type: 'desp_geral', label: 'Desprodução',      icon: '📦' },
  ];

  useEffect(() => {
    if (!project?.id) return;
    fetch(`/api/projects/${project.id}/daily-orders`).then(r => r.json())
      .then(d => setOrders(d.orders || []));
  }, [project?.id]);

  async function loadOrder(orderId) {
    const d = await fetch(`/api/projects/${project.id}/daily-orders/${orderId}`).then(r => r.json());
    if (d.scenes) {
      d.scenes = d.scenes.map(s => {
        const orig = scenes.find(o => o.id === s.scene_id);
        return {
          ...s,
          synopsis: orig?.synopsis || s.synopsis || '',
          location: orig?.location || s.location,
          int_ext: orig?.int_ext || s.int_ext,
          period: orig?.day_night || s.period,
          characters: orig?.characters || [],
        };
      });
    }
    // Auto-popula elenco das cenas
    if (d.scenes && (!d.cast || d.cast.length === 0)) {
      const allChars = [...new Set(d.scenes.flatMap(s => s.characters || []))];
      if (allChars.length > 0) {
        const scenesByChar = {};
        const firstFilmByChar = {};
        allChars.forEach(char => {
          const charScenes = d.scenes.filter(s => (s.characters||[]).includes(char));
          scenesByChar[char] = charScenes.map(s => s.scene_number).join(', ');
          // Pega o primeiro horário de Film deste personagem
          const firstFilm = charScenes.map(s => s.shoot_start).filter(Boolean).sort()[0];
          if (firstFilm && firstFilm.includes(':')) {
            const [h, m] = firstFilm.split(':').map(Number);
            const arrival = h * 60 + m - 90; // Film - 1h30
            if (arrival > 0) {
              const ah = Math.floor(arrival / 60), am = arrival % 60;
              firstFilmByChar[char] = `${String(ah).padStart(2,'0')}:${String(am).padStart(2,'0')}`;
            }
          }
        });
        d.cast = allChars.map((char, i) => ({
          id: `auto-${i}`, character_name: char, actor_name: '',
          call_time: firstFilmByChar[char] || '',
          scenes: scenesByChar[char]
        }));
      }
    }
    setSelectedOrder(orderId);
    setOrderData(d);
  }

  async function generateAllODs() {
    if (!selectedPlanId) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/shooting-plans/${selectedPlanId}/scenes-by-day`).then(r => r.json());
      const days = (res.days || []).filter(d => d.scenes?.length > 0).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const existing = orders.filter(o => o.plan_id === selectedPlanId);
      for (const o of existing) await fetch(`/api/projects/${project.id}/daily-orders/${o.id}`, { method: 'DELETE' });
      const newOrders = [];
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const dateStr = (day.date || '').toString().split('T')[0];
        const r2 = await fetch(`/api/projects/${project.id}/daily-orders`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan_id: selectedPlanId, date: dateStr, day_number: i + 1 }),
        });
        const created = await r2.json();
        for (let j = 0; j < day.scenes.length; j++) {
          const s = day.scenes[j];
          await fetch(`/api/projects/${project.id}/daily-orders/${created.id}/scenes`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scene_id: s.id, scene_number: s.scene_number, location: s.location, period: s.day_night || s.period, int_ext: s.int_ext, position: j }),
          });
        }
        newOrders.push({ id: created.id, day_number: i + 1, date: dateStr, plan_id: selectedPlanId });
      }
      setOrders(prev => [...prev.filter(o => o.plan_id !== selectedPlanId), ...newOrders]);
      if (newOrders.length > 0) loadOrder(newOrders[0].id);
    } finally { setGenerating(false); }
  }

  async function saveHeader(key, val) {
    if (!orderData?.order) return;
    const updated = { ...orderData.order, [key]: val };
    setOrderData(prev => ({ ...prev, order: updated }));
    await fetch(`/api/projects/${project.id}/daily-orders/${selectedOrder}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }

  function updateScene(sceneId, field, val) {
    setOrderData(prev => {
      const newScenes = prev.scenes.map(s => s.id === sceneId ? { ...s, [field]: val } : s);
      // Recalcula chegada do elenco se o horário de Film foi alterado
      if (field === 'shoot_start' && val && val.includes(':')) {
        const [h, m] = val.split(':').map(Number);
        const arrivalMin = h * 60 + m - 90;
        if (arrivalMin > 0) {
          const ah = Math.floor(arrivalMin / 60), am = arrivalMin % 60;
          const arrivalTime = `${String(ah).padStart(2,'0')}:${String(am).padStart(2,'0')}`;
          const scene = newScenes.find(s => s.id === sceneId);
          const chars = scene?.characters || [];
          const newCast = (prev.cast || []).map(c => {
            if (chars.includes(c.character_name) && !c._manual_time) {
              return { ...c, call_time: arrivalTime };
            }
            return c;
          });
          return { ...prev, scenes: newScenes, cast: newCast };
        }
      }
      return { ...prev, scenes: newScenes };
    });
  }

  async function removeScene(sceneId) {
    await fetch(`/api/projects/${project.id}/daily-orders/${selectedOrder}/scenes?sceneId=${sceneId}`, { method: 'DELETE' });
    setOrderData(prev => ({ ...prev, scenes: prev.scenes.filter(s => s.id !== sceneId) }));
  }

  async function addItem(type) {
    const res = await fetch(`/api/projects/${project.id}/daily-orders/${selectedOrder}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, position: orderData?.items?.length || 0 }),
    });
    const d = await res.json();
    setOrderData(prev => ({ ...prev, items: [...(prev.items||[]), { id: d.id, type, from_loc:'', to_loc:'', time_start:'', time_end:'' }] }));
    setShowItemMenu(false);
  }

  function updateItem(itemId, field, val) {
    setOrderData(prev => ({ ...prev, items: prev.items.map(x => x.id === itemId ? { ...x, [field]: val } : x) }));
  }

  async function removeItem(itemId) {
    await fetch(`/api/projects/${project.id}/daily-orders/${selectedOrder}/items?itemId=${itemId}`, { method: 'DELETE' });
    setOrderData(prev => ({ ...prev, items: prev.items.filter(x => x.id !== itemId) }));
  }

  function calcDur(a, b) {
    const toMin = t => { if (!t||!t.includes(':')) return null; const [h,m]=t.split(':').map(Number); return h*60+m; };
    const d = toMin(b) - toMin(a); if (!d||d<=0) return '';
    const h=Math.floor(d/60),mn=d%60; return h>0?(mn>0?`${h}h${String(mn).padStart(2,'0')}`:`${h}h`):`${mn}min`;
  }

  function formatDate(s) {
    const p=(s||'').toString().split('T')[0]; const [y,m,d]=p.split('-'); return d?`${d}/${m}/${y}`:'—';
  }

  const planName = id => plans.find(p => p.id === id)?.name || 'Original';

  const tagCls = val => {
    if (!val) return dm?'bg-gray-700 text-gray-400':'bg-gray-100 text-gray-500';
    const v = val.toUpperCase();
    if (v==='INT') return dm?'bg-blue-900/40 text-blue-300':'bg-blue-50 text-blue-800';
    if (v==='EXT') return dm?'bg-green-900/40 text-green-300':'bg-green-50 text-green-800';
    if (v.includes('DIA')||v==='D') return dm?'bg-amber-900/40 text-amber-300':'bg-amber-50 text-amber-800';
    return dm?'bg-indigo-900/40 text-indigo-300':'bg-indigo-50 text-indigo-700';
  };

  const tInput = `font-mono text-xs bg-transparent outline-none border-b w-9 text-center ${dm?'text-gray-200 border-gray-700 focus:border-brand-400':'text-gray-800 border-gray-200 focus:border-brand-400'}`;

  const totals = useMemo(() => {
    if (!orderData) return {};
    const toMin = t => { if (!t||!t.includes(':')) return null; const [h,m]=t.split(':').map(Number); return h*60+m; };
    const diff = (a,b) => { const ma=toMin(a),mb=toMin(b); if(ma===null||mb===null||mb<=ma) return 0; return mb-ma; };
    const fmt = m => { if(!m) return '—'; const h=Math.floor(m/60),mn=m%60; return h>0?(mn>0?`${h}h${String(mn).padStart(2,'0')}`:`${h}h`):`${mn}min`; };
    let prep=0,film=0,wrap=0,ref=0,desl=0;
    (orderData.scenes||[]).forEach(s=>{prep+=diff(s.prep_start,s.prep_end);film+=diff(s.shoot_start,s.shoot_end);wrap+=diff(s.wrap_start,s.wrap_end);});
    (orderData.items||[]).forEach(x=>{const d=diff(x.time_start,x.time_end);if(x.type==='desl'||x.type==='desp_geral')desl+=d;else ref+=d;});
    const total=prep+film+wrap+ref+desl;
    return {prep:fmt(prep),film:fmt(film),wrap:fmt(wrap),ref:fmt(ref),total:fmt(total),over:total>720};
  },[orderData]);

  // Intercala cenas e itens em ordem cronológica
  const chronoList = useMemo(() => {
    if (!orderData) return [];
    const toMin = t => { if (!t||!t.includes(':')) return null; const [h,m]=t.split(':').map(Number); return h*60+m; };
    const entries = [
      ...(orderData.scenes||[]).map(s => ({ kind:'scene', data:s, start: toMin(s.prep_start) ?? toMin(s.shoot_start) ?? Infinity })),
      ...(orderData.items||[]).map(x => ({ kind:'item', data:x, start: toMin(x.time_start) ?? Infinity })),
    ];
    return entries.sort((a,b) => a.start - b.start);
  }, [orderData]);

  const groupedOrders = orders.reduce((acc, o) => {
    const k = o.plan_id || '__orig__';
    if (!acc[k]) acc[k] = [];
    acc[k].push(o);
    return acc;
  }, {});

  // Seleção por arrasto com linha fantasma
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [dragStartId, setDragStartId] = useState(null);
  const [dragHoverId, setDragHoverId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const dragRef = useRef(false);
  const dragTimerRef = useRef(null);

  // Calcula quais IDs estão no range do arrasto
  const allOrderIds = Object.values(groupedOrders).flat().sort((a,b) => a.day_number - b.day_number).map(o => o.id);
  const dragRangeIds = useMemo(() => {
    if (!dragStartId || !dragHoverId) return new Set();
    const startIdx = allOrderIds.indexOf(dragStartId);
    const endIdx = allOrderIds.indexOf(dragHoverId);
    if (startIdx === -1 || endIdx === -1) return new Set();
    const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    return new Set(allOrderIds.slice(from, to + 1));
  }, [dragStartId, dragHoverId, allOrderIds]);

  function handleItemMouseDown(orderId) {
    dragTimerRef.current = setTimeout(() => {
      dragRef.current = true;
      setIsDragging(true);
      setDragStartId(orderId);
      setDragHoverId(orderId);
    }, 150);
  }

  function handleItemMouseEnter(orderId) {
    if (dragRef.current) setDragHoverId(orderId);
  }

  function handleMouseUp() {
    clearTimeout(dragTimerRef.current);
    if (dragRef.current) {
      dragRef.current = false;
      setIsDragging(false);
      // Confirma seleção do range
      if (dragRangeIds.size > 0) setSelectedIds(dragRangeIds);
      setDragStartId(null);
      setDragHoverId(null);
    }
  }

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [dragRangeIds]);

  async function deleteSelected() {
    const toDelete = orders.filter(o => selectedIds.has(o.id));
    if (toDelete.length === 0) return;
    setUndoStack(prev => [...prev, toDelete]);
    setOrders(prev => prev.filter(o => !selectedIds.has(o.id)));
    if (selectedIds.has(selectedOrder)) { setSelectedOrder(null); setOrderData(null); }
    setSelectedIds(new Set());
    for (const o of toDelete) {
      await fetch(`/api/projects/${project.id}/daily-orders/${o.id}`, { method: 'DELETE' });
    }
  }

  async function undoDelete() {
    const last = undoStack[undoStack.length - 1];
    if (!last) return;
    setUndoStack(prev => prev.slice(0, -1));
    const restored = [];
    for (const o of last) {
      const r = await fetch(`/api/projects/${project.id}/daily-orders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: o.plan_id, date: o.date, day_number: o.day_number }),
      });
      const created = await r.json();
      restored.push({ ...o, id: created.id });
    }
    setOrders(prev => [...prev, ...restored].sort((a,b) => a.day_number - b.day_number));
  }

  return (
    <div className="flex gap-4" style={{ minHeight: 'calc(100vh - 200px)' }}>

      {/* Sidebar */}
      <div className={`w-56 flex-shrink-0 border rounded-xl overflow-hidden ${dm?'bg-gray-900 border-gray-700':'bg-white border-gray-100'}`}>
        <div className={`p-3 border-b ${dm?'border-gray-700':'border-gray-100'}`}>
          <p className={`text-[9px] font-medium uppercase tracking-widest mb-2 ${muted}`}>Gerar ODs automaticamente</p>
          <select value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}
            className={`w-full text-xs rounded-lg px-2 py-1.5 mb-2 outline-none border ${dm?'bg-gray-800 border-gray-700 text-gray-200':'bg-white border-gray-200 text-gray-700'}`}>
            <option value="">Selecione o plano...</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={generateAllODs} disabled={!selectedPlanId||generating}
            className="w-full py-1.5 text-xs bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-40 transition-colors">
            {generating?'⏳ Gerando...':'⚡ Gerar todas as ODs'}
          </button>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight:'calc(100vh - 350px)' }}>
          {/* Barra de ações quando há seleção */}
          {selectedIds.size > 0 && (
            <div className={`flex items-center justify-between px-3 py-2 border-b ${dm?'border-gray-700 bg-gray-800':'border-gray-100 bg-gray-50'}`}>
              <span className={`text-[10px] ${muted}`}>{selectedIds.size} selecionada{selectedIds.size>1?'s':''}</span>
              <button onClick={deleteSelected} className="text-[10px] text-red-400 hover:text-red-300 font-medium">🗑 Apagar</button>
            </div>
          )}
          {/* Toast de desfazer */}
          {undoStack.length > 0 && (
            <div className={`flex items-center justify-between px-3 py-2 border-b ${dm?'border-gray-700 bg-gray-800/60':'border-gray-100 bg-blue-50'}`}>
              <span className={`text-[10px] ${muted}`}>{undoStack[undoStack.length-1].length} apagada{undoStack[undoStack.length-1].length>1?'s':''}</span>
              <button onClick={undoDelete} className={`text-[10px] font-medium ${dm?'text-brand-400':'text-brand-600'}`}>↩ Desfazer</button>
            </div>
          )}
          {Object.keys(groupedOrders).length===0 && <p className={`text-[11px] ${muted} text-center p-4`}>Selecione um plano e clique em Gerar.</p>}
          {Object.entries(groupedOrders).map(([planId, planOrders]) => (
            <div key={planId}>
              <p className={`text-[9px] font-medium uppercase tracking-widest px-3 py-2 ${muted} ${dm?'bg-gray-800/50':'bg-gray-50'}`}>
                {planId==='__orig__'?'Original':planName(planId)}
              </p>
              {planOrders.sort((a,b)=>a.day_number-b.day_number).map(o => {
                const isSelected = selectedIds.has(o.id);
                const inRange = dragRangeIds.has(o.id);
                return (
                  <div key={o.id}
                    onMouseDown={() => handleItemMouseDown(o.id)}
                    onMouseEnter={() => handleItemMouseEnter(o.id)}
                    onClick={(e) => {
                      if (isDragging) return;
                      if (e.shiftKey && allOrderIds.length > 0) {
                        // Shift+clique: seleciona intervalo do último selecionado até este
                        const lastSelected = [...selectedIds].pop() || allOrderIds[0];
                        const startIdx = allOrderIds.indexOf(lastSelected);
                        const endIdx = allOrderIds.indexOf(o.id);
                        const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
                        setSelectedIds(new Set(allOrderIds.slice(from, to + 1)));
                      } else if (e.ctrlKey || e.metaKey) {
                        // Ctrl/Cmd+clique: adiciona ou remove da seleção
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(o.id)) next.delete(o.id); else next.add(o.id);
                          return next;
                        });
                      } else if (selectedIds.size > 0) {
                        // Clique simples com seleção ativa: limpa seleção
                        setSelectedIds(new Set());
                      } else {
                        loadOrder(o.id);
                      }
                    }}
                    style={{ userSelect: 'none' }}
                    className={`group px-3 py-2.5 cursor-pointer border-b flex items-center justify-between gap-2 transition-colors
                      ${isSelected ? (dm?'bg-brand-900/40 border-l-2 border-l-brand-500':'bg-brand-100 border-l-2 border-l-brand-500') :
                        inRange ? (dm?'bg-brand-900/20 border-l-2 border-l-brand-400 opacity-70':'bg-brand-50 border-l-2 border-l-brand-300 opacity-70') :
                        selectedOrder===o.id ? (dm?'bg-gray-800 border-l-2 border-l-brand-500':'bg-brand-50 border-l-2 border-l-brand-500') :
                        (dm?'border-gray-800 hover:bg-gray-800':'border-gray-100 hover:bg-gray-50')}`}>
                    <div>
                      <p className="text-xs font-medium">Dia {o.day_number}</p>
                      <p className={`text-[10px] ${muted}`}>{formatDate(o.date)}</p>
                    </div>
                    <button onClick={async e => {
                      e.stopPropagation();
                      setUndoStack(prev => [...prev, [o]]);
                      setOrders(prev => prev.filter(x => x.id !== o.id));
                      if (selectedOrder===o.id) { setSelectedOrder(null); setOrderData(null); }
                      await fetch(`/api/projects/${project.id}/daily-orders/${o.id}`, { method:'DELETE' });
                    }} className={`opacity-0 group-hover:opacity-100 text-xs ${muted} hover:text-red-400`}>✕</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        {!selectedOrder ? (
          <div className={`border rounded-xl p-12 text-center ${dm?'bg-gray-900 border-gray-700':'bg-white border-gray-100'}`}>
            <p className="text-4xl mb-3">📋</p>
            <p className={`text-sm font-medium mb-1 ${dm?'text-gray-300':'text-gray-600'}`}>Selecione um plano e gere as ODs automaticamente</p>
            <p className={`text-xs ${muted}`}>Todas as Ordens do Dia serão criadas com as cenas corretas de cada dia da Strip.</p>
          </div>
        ) : !orderData ? (
          <div className={`border rounded-xl p-8 text-center ${dm?'bg-gray-900 border-gray-700':'bg-white border-gray-100'}`}><p className={muted}>Carregando...</p></div>
        ) : (
          <div className={cardCls}>

            {/* Cabeçalho */}
            <div className={`flex items-center justify-between px-5 py-3 border-b ${dm?'bg-gray-800 border-gray-700':'bg-gray-50 border-gray-100'}`}>
              <div>
                <h2 className={`text-sm font-semibold ${dm?'text-gray-100':'text-gray-800'}`}>{project?.title}</h2>
                <p className={`text-[10px] mt-0.5 ${muted}`}>{project?.author&&`Dir: ${project.author} · `}Plano: {planName(orderData.order?.plan_id)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md ${dm?'bg-brand-900/30 text-brand-400':'bg-brand-50 text-brand-600'}`}>Dia {orderData.order?.day_number}</span>
                <span className={`text-[10px] font-medium px-2.5 py-1 rounded-md border ${dm?'border-gray-600 text-gray-300':'border-gray-200 text-gray-600'}`}>{formatDate(orderData.order?.date)}</span>
              </div>
            </div>

            {/* Meta */}
            <div className={`grid grid-cols-3 border-b ${dm?'border-gray-700':'border-gray-100'}`}>
              {[
                {label:'📍 Locação', key:'location', sub:'address', subLabel:'Endereço'},
                {label:'🎬 Início das filmagens', key:'shoot_start', sub:'meeting_point', subLabel:'Ponto de encontro'},
                {label:'📞 Contato na locação', key:'location_contact'},
              ].map((f,i)=>(
                <div key={i} className={`px-4 py-3 ${i<2?`border-r ${dm?'border-gray-700':'border-gray-100'}`:''}`}>
                  <p className={`text-[9px] font-medium uppercase tracking-widest mb-1 ${muted}`}>{f.label}</p>
                  <input defaultValue={orderData.order?.[f.key]||''} placeholder="—"
                    className={`text-xs font-medium bg-transparent outline-none border-b w-full ${dm?'text-gray-200 border-gray-700 focus:border-brand-400 placeholder-gray-700':'text-gray-800 border-gray-100 focus:border-brand-400 placeholder-gray-300'}`}
                    onBlur={e=>{let v=e.target.value;const d=v.replace(/[^0-9]/g,'');if(d.length===4)v=d.slice(0,2)+':'+d.slice(2,4);saveHeader(f.key,v);}} />
                  {f.sub&&<input defaultValue={orderData.order?.[f.sub]||''} placeholder={f.subLabel}
                    className={`text-[10px] bg-transparent outline-none border-b w-full mt-1 ${dm?'text-gray-500 border-gray-800 placeholder-gray-700':'text-gray-400 border-gray-50 placeholder-gray-300'}`}
                    onBlur={e=>saveHeader(f.sub,e.target.value)} />}
                </div>
              ))}
            </div>

            {/* Chamada geral */}
            <div className={`flex items-center gap-4 px-4 py-2.5 border-b ${dm?'border-gray-700 bg-gray-800/40':'border-gray-100 bg-gray-50'}`}>
              <p className={`text-[9px] font-medium uppercase tracking-widest flex-shrink-0 ${muted}`}>Chamada geral</p>
              <TimeInput value={orderData.order?.call_time||''} onChange={v=>saveHeader('call_time',v)} darkMode={dm} />
              <input defaultValue={orderData.order?.notes||''} placeholder="Observação..."
                className={`text-xs bg-transparent outline-none flex-1 ${dm?'text-gray-400 placeholder-gray-700':'text-gray-500 placeholder-gray-300'}`}
                onBlur={e=>saveHeader('notes',e.target.value)} />
            </div>

            {/* Cronograma — uma linha por cena, itens intercalados */}
            <div>
              <div className={secTitle}>
                <span>Cronograma do dia — {(orderData.scenes||[]).length} cena{(orderData.scenes||[]).length!==1?'s':''}</span>
                <div className="relative">
                  <button onClick={()=>setShowItemMenu(v=>!v)}
                    className={`text-[10px] px-2 py-1 rounded border border-dashed ${dm?'border-gray-600 text-gray-500 hover:text-brand-400':'border-gray-300 text-gray-400 hover:text-brand-500'}`}>
                    + adicionar item
                  </button>
                  {showItemMenu&&(
                    <div className={`absolute right-0 top-7 border rounded-xl shadow-lg py-1 z-20 min-w-[160px] ${dm?'bg-gray-800 border-gray-700':'bg-white border-gray-200'}`}>
                      {ITEMS.map(({type,label,icon})=>(
                        <button key={type} onClick={()=>addItem(type)}
                          className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 ${dm?'text-gray-300 hover:bg-gray-700':'text-gray-700 hover:bg-gray-50'}`}>
                          {icon} {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {chronoList.map((entry, idx) => {
                if (entry.kind === 'scene') {
                  const s = entry.data;
                  return (
                    <div key={`scene-${s.id}`} className={`grid border-b ${border}`} style={{gridTemplateColumns:'220px 1fr'}}>
                      {/* Horários à esquerda — sempre visíveis e contidos */}
                      <div className={`flex flex-col gap-2 px-3 py-2.5 border-r ${dm?'border-gray-800':'border-gray-100'}`}>
                        {[
                          {label:'Prep',color:dm?'text-blue-400':'text-blue-600',start:'prep_start',end:'prep_end'},
                          {label:'Film',color:dm?'text-green-400':'text-green-600',start:'shoot_start',end:'shoot_end'},
                          {label:'Desp',color:dm?'text-amber-400':'text-amber-600',start:'wrap_start',end:'wrap_end'},
                        ].map(({label,color,start,end})=>{
                          const dur = calcDur(s[start],s[end]);
                          return (
                            <div key={label} className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-semibold w-7 flex-shrink-0 ${color}`}>{label}</span>
                              <TimeInput value={s[start]||''} onChange={v=>updateScene(s.id,start,v)} darkMode={dm} />
                              <span className={`text-[9px] ${muted}`}>→</span>
                              <TimeInput value={s[end]||''} onChange={v=>updateScene(s.id,end,v)} darkMode={dm} />
                              <span className="opacity-0 w-9 flex-shrink-0"></span>
                            </div>
                          );
                        })}
                      </div>
                      {/* Info da cena à direita */}
                      <div className="px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-sm font-bold flex-shrink-0 ${dm?'text-brand-400':'text-brand-600'}`}>#{s.scene_number}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${tagCls(s.int_ext)}`}>{s.int_ext}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${tagCls(s.period)}`}>{s.period}</span>
                          <span className={`text-xs font-medium flex-1 truncate ${dm?'text-gray-200':'text-gray-800'}`}>{s.location}</span>
                          {s.characters?.length>0 && (
                            <span className={`text-[9px] flex-shrink-0 truncate max-w-32 ${muted}`}>{s.characters.join(', ')}</span>
                          )}
                          <button onClick={()=>removeScene(s.id)} className={`text-[10px] ${muted} hover:text-red-400 flex-shrink-0`}>✕</button>
                        </div>
                        {s.synopsis && <p className={`text-[10px] leading-relaxed ${dm?'text-gray-500':'text-gray-400'}`}>{s.synopsis}</p>}
                      </div>
                    </div>
                  );
                }
                // Item (café, almoço, etc)
                const x = entry.data;
                const cfg = ITEMS.find(i=>i.type===x.type)||ITEMS[0];
                return (
                  <div key={`item-${x.id}`} className={`grid border-b ${border}`} style={{gridTemplateColumns:'200px 1fr'}}>
                    <div className={`flex items-center gap-1.5 px-3 py-2 border-r ${dm?'border-gray-800':'border-gray-100'}`}>
                      <TimeInput value={x.time_start||''} onChange={v=>updateItem(x.id,'time_start',v)} darkMode={dm} />
                      <span className={`text-[9px] ${muted}`}>→</span>
                      <TimeInput value={x.time_end||''} onChange={v=>updateItem(x.id,'time_end',v)} darkMode={dm} />
                      <span className="w-8 flex-shrink-0"></span>
                    </div>
                    <div className={`flex items-center gap-2 px-3 py-2 ${dm?'bg-gray-800/20':''}`}>
                      <span className="text-sm">{cfg.icon}</span>
                      <span className={`text-xs font-medium ${dm?'text-gray-300':'text-gray-700'}`}>{cfg.label}</span>
                      {x.type==='desl'&&<>
                        <input value={x.from_loc||''} onChange={e=>updateItem(x.id,'from_loc',e.target.value)} placeholder="De..." className={`text-xs bg-transparent border-b outline-none w-20 ${dm?'border-gray-700 text-gray-400 placeholder-gray-600':'border-gray-200 text-gray-600 placeholder-gray-300'}`}/>
                        <span className={`text-xs ${muted}`}>→</span>
                        <input value={x.to_loc||''} onChange={e=>updateItem(x.id,'to_loc',e.target.value)} placeholder="Para..." className={`text-xs bg-transparent border-b outline-none w-20 ${dm?'border-gray-700 text-gray-400 placeholder-gray-600':'border-gray-200 text-gray-600 placeholder-gray-300'}`}/>
                      </>}
                      <button onClick={()=>removeItem(x.id)} className={`ml-auto text-[10px] ${muted} hover:text-red-400`}>✕</button>
                    </div>
                  </div>
                );
              })}

              {chronoList.length===0&&<p className={`text-[11px] ${muted} px-4 py-3`}>Nenhuma cena neste dia.</p>}
            </div>

            {/* Elenco */}
            <div>
              <div className={secTitle}>
                <span>Elenco convocado</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] ${muted}`}>chegada</span>
                    <input type="number" min="0" max="480" step="15" value={callTimeOffset}
                      onChange={e => {
                        const mins = parseInt(e.target.value) || 90;
                        setCallTimeOffset(mins);
                        setOrderData(prev => ({
                          ...prev,
                          cast: (prev.cast||[]).map(c => {
                            if (c._manual_time) return c;
                            const charScenes = (prev.scenes||[]).filter(s => (s.characters||[]).includes(c.character_name));
                            const firstFilm = charScenes.map(s => s.shoot_start).filter(Boolean).sort()[0];
                            if (firstFilm && firstFilm.includes(':')) {
                              const [h, m] = firstFilm.split(':').map(Number);
                              const arrival = h * 60 + m - mins;
                              if (arrival > 0) {
                                const ah = Math.floor(arrival/60), am = arrival%60;
                                return { ...c, call_time: `${String(ah).padStart(2,'0')}:${String(am).padStart(2,'0')}` };
                              }
                            }
                            return c;
                          })
                        }));
                      }}
                      className={`w-10 text-xs text-center bg-transparent outline-none border-b ${dm?'border-gray-600 text-gray-300':'border-gray-300 text-gray-600'}`}
                    />
                    <span className={`text-[9px] ${muted}`}>min antes</span>
                  </div>
                  <button onClick={()=>setOrderData(prev=>({...prev,cast:[...(prev.cast||[]),{id:`m-${Date.now()}`,character_name:'',actor_name:'',call_time:'',scenes:''}]}))}
                    className={`text-[10px] px-2 py-1 rounded border border-dashed ${dm?'border-gray-600 text-gray-500 hover:text-brand-400':'border-gray-300 text-gray-400 hover:text-brand-500'}`}>
                    + adicionar
                  </button>
                </div>
              </div>
              {(orderData.cast||[]).length===0 ? (
                <p className={`text-[11px] ${muted} px-4 py-3`}>Elenco preenchido automaticamente ao gerar as ODs.</p>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className={`border-b ${border}`}>
                      {['Personagem','Ator / Atriz','Chegada','Cenas',''].map(h=>(
                        <th key={h} className={`text-left text-[9px] font-medium uppercase tracking-widest px-4 py-2 ${muted}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(orderData.cast||[]).map(c=>(
                      <tr key={c.id} className={`border-b last:border-0 ${dm?'border-gray-800 hover:bg-gray-800/30':'border-gray-50 hover:bg-gray-50'}`}>
                        <td className={`px-4 py-2 text-xs font-medium ${dm?'text-gray-200':'text-gray-800'}`}>{c.character_name||
                          <input placeholder="Personagem" className={`text-xs font-medium bg-transparent outline-none border-b w-full ${dm?'border-gray-700 text-gray-200':'border-gray-100'}`}
                            onChange={e=>setOrderData(prev=>({...prev,cast:prev.cast.map(x=>x.id===c.id?{...x,character_name:e.target.value}:x)}))} />}
                        </td>
                        <td className="px-4 py-2">
                          <input value={c.actor_name||''} onChange={e=>setOrderData(prev=>({...prev,cast:prev.cast.map(x=>x.id===c.id?{...x,actor_name:e.target.value}:x)}))}
                            className={`text-xs bg-transparent outline-none border-b w-full ${dm?'border-gray-700 text-gray-400 placeholder-gray-600':'border-gray-100 text-gray-600 placeholder-gray-300'}`} placeholder="Nome do ator" />
                        </td>
                        <td className="px-4 py-2">
                          <TimeInput value={c.call_time||''} onChange={v=>setOrderData(prev=>({...prev,cast:prev.cast.map(x=>x.id===c.id?{...x,call_time:v,_manual_time:true}:x)}))} darkMode={dm} />
                        </td>
                        <td className={`px-4 py-2 text-[10px] ${muted}`}>{c.scenes}</td>
                        <td className="px-2 py-2 text-center">
                          <button onClick={()=>setOrderData(prev=>({...prev,cast:prev.cast.filter(x=>x.id!==c.id)}))} className={`text-xs ${muted} hover:text-red-400`}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Totais */}
            <div className={`grid border-t ${dm?'border-gray-700':'border-gray-100'}`} style={{gridTemplateColumns:'repeat(5,1fr)'}}>
              {[
                {label:'Preparação',value:totals.prep,color:dm?'text-blue-400':'text-blue-600'},
                {label:'Filmagem',value:totals.film,color:dm?'text-green-400':'text-green-600'},
                {label:'Desprodução',value:totals.wrap,color:dm?'text-amber-400':'text-amber-600'},
                {label:'Refeições',value:totals.ref,color:dm?'text-teal-400':'text-teal-600'},
                {label:'Total do dia',value:totals.total,color:totals.over?'text-red-500':(dm?'text-gray-200':'text-gray-800')},
              ].map(({label,value,color},i)=>(
                <div key={label} className={`text-center py-3 ${i<4?`border-r ${dm?'border-gray-700':'border-gray-100'}`:''} ${i===4?(dm?'bg-gray-800/40':'bg-gray-50'):''}`}>
                  <div className={`text-sm font-semibold ${color}`}>{value||'—'}</div>
                  <div className={`text-[9px] mt-0.5 ${muted}`}>{label}</div>
                </div>
              ))}
            </div>
            {totals.over&&<div className={`px-4 py-2 border-t ${dm?'border-red-900/30 bg-red-900/10':'border-red-100 bg-red-50'}`}><p className="text-xs text-red-400 font-medium">⚠️ Dia ultrapassa 12 horas de trabalho!</p></div>}

          </div>
        )}
      </div>
    </div>
  );
}



function BudgetPage({ project, scenes, plans, darkMode }) {

  const [budgetPlanId, setBudgetPlanId] = useState('__original__');
  const [budgetItems, setBudgetItems] = useState([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Busca os itens do plano selecionado DIRETAMENTE do banco — independente da Strip
  useEffect(() => {
    if (!project?.id || budgetPlanId === '__original__') {
      setBudgetItems([]);
      return;
    }
    setLoadingPlan(true);
    Promise.all([
      fetch(`/api/projects/${project.id}/shooting-days?plan_id=${budgetPlanId}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ days: [] })),
      fetch(`/api/projects/${project.id}/shooting-plans`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ plans: [] })),
      fetch(`/api/projects/${project.id}/budget?plan_id=${budgetPlanId}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ sections: null })),
    ]).then(([daysRes, plansRes, budgetRes]) => {
      const plan = (plansRes.plans || []).find(p => p.id === budgetPlanId);
      const sceneOrder = plan?.scene_order?.length > 0 ? plan.scene_order : scenes.map(s => s.id);
      const sceneItems = sceneOrder.map(id => scenes.find(s => s.id === id)).filter(Boolean).map(s => ({ id: s.id, kind: 'scene', data: s }));
      const days = (daysRes.days || []).map(d => ({ id: d.id, kind: 'day', data: d, pos: d.position ?? 0 })).sort((a, b) => a.pos - b.pos);
      const unified = [...sceneItems];
      days.forEach(({ id, kind, data, pos }) => unified.splice(Math.min(pos, unified.length), 0, { id, kind, data }));
      setBudgetItems(unified);

      // Se já tem orçamento salvo para esse plano, carrega ele
      if (budgetRes.sections && Array.isArray(budgetRes.sections) && budgetRes.sections.length > 0) {
        setSections(budgetRes.sections);
      } else {
        // Senão, gera as seções iniciais com os dados do plano
        setSections(buildInitialSections());
      }
    }).finally(() => setLoadingPlan(false));
  }, [budgetPlanId, project?.id]);

  // Calcula sceneDates a partir dos itens buscados diretamente
  const effectiveSceneDates = useMemo(() => {
    if (budgetPlanId === '__original__') return {};
    const map = {};
    let currentDay = null;
    for (const item of budgetItems) {
      if (item.kind === 'day') currentDay = item.data;
      else if (item.kind === 'scene' && currentDay) {
        const d = currentDay.date ? currentDay.date.toString().slice(0, 10) : null;
        if (d && !map[item.data?.id]) map[item.data.id] = d;
      }
    }
    return map;
  }, [budgetItems, budgetPlanId]);

  const characters = [...new Set(scenes.flatMap(s => s.characters || []))].sort();
  const locations = [...new Set(scenes.map(s => s.location).filter(Boolean))].sort();
  const shootingDays = [...new Set(Object.values(effectiveSceneDates))].sort();

  // Calcula diárias únicas por personagem (quantos dias diferentes ele filma)
  const diariasPersonagem = {};
  characters.forEach(char => {
    const dias = new Set();
    scenes.forEach(s => {
      if ((s.characters || []).includes(char) && effectiveSceneDates?.[s.id]) {
        dias.add(effectiveSceneDates[s.id]);
      }
    });
    diariasPersonagem[char] = dias.size;
  });

  // Calcula diárias únicas por locação
  const diariasLocacao = {};
  locations.forEach(loc => {
    const dias = new Set();
    scenes.forEach(s => {
      if (s.location === loc && effectiveSceneDates?.[s.id]) {
        dias.add(effectiveSceneDates[s.id]);
      }
    });
    diariasLocacao[loc] = dias.size;
  });

  const totalDiasGravacao = shootingDays.length;

  // Estrutura de categorias baseada no padrão ANCINE/mercado brasileiro
  const buildInitialSections = () => [
    { id: '1', label: 'Roteiro e Direitos', items: [
      { id: '1.1.1', desc: 'Roteiro', qtd: 1, unid: 'mês', valor: 0, pre: true, prod: false, pos: false },
      { id: '1.1.2', desc: 'Revisão de diálogos', qtd: 1, unid: 'mês', valor: 0, pre: true, prod: false, pos: false },
      { id: '1.2.1', desc: 'Cessão de direitos de autor', qtd: 1, unid: 'total', valor: 0, pre: true, prod: false, pos: false },
    ]},
    { id: '2', label: 'Pesquisa e Desenvolvimento', items: [
      { id: '2.1.1', desc: 'Pesquisa / consultoria', qtd: 1, unid: 'mês', valor: 0, pre: true, prod: false, pos: false },
      { id: '2.2.1', desc: 'Despesas de acesso a conteúdos', qtd: 1, unid: 'total', valor: 0, pre: true, prod: false, pos: false },
    ]},
    { id: '3', label: 'Diretores', items: [
      { id: '3.1.1', desc: 'Direção', qtd: 1, unid: 'total', valor: 0, pre: true, prod: true, pos: true },
      { id: '3.1.2', desc: 'Direção 2ª unidade', qtd: 0, unid: 'semanas', valor: 0, pre: false, prod: true, pos: false },
    ]},
    { id: '4', label: 'Equipe de Direção', items: [
      { id: '4.1.1', desc: '1º AD', qtd: totalDiasGravacao || 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false },
      { id: '4.1.2', desc: '2º AD', qtd: totalDiasGravacao || 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false },
      { id: '4.1.3', desc: '3º AD', qtd: totalDiasGravacao || 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false },
      { id: '4.1.4', desc: 'Continuísta', qtd: totalDiasGravacao || 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false },
    ]},
    { id: '5', label: 'Elenco', items: characters.length > 0
      ? characters.map((c, i) => ({ id: `5.1.${i+1}`, desc: c, qtd: diariasPersonagem[c] || 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false }))
      : [{ id: '5.1.1', desc: 'Elenco principal', qtd: 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false }]
    },
    { id: '6', label: 'Equipe Técnica — Fotografia', items: [
      { id: '6.1.1', desc: 'Diretor de Fotografia', qtd: 0, unid: 'semanas', valor: 0, pre: false, prod: true, pos: false },
      { id: '6.1.2', desc: 'Operador de câmera', qtd: 0, unid: 'semanas', valor: 0, pre: false, prod: true, pos: false },
      { id: '6.1.3', desc: 'Assistente de câmera', qtd: 0, unid: 'semanas', valor: 0, pre: false, prod: true, pos: false },
      { id: '6.1.4', desc: 'Iluminador / Gaffer', qtd: 0, unid: 'semanas', valor: 0, pre: false, prod: true, pos: false },
    ]},
    { id: '7', label: 'Equipe Técnica — Arte', items: [
      { id: '7.1.1', desc: 'Diretor de Arte', qtd: 0, unid: 'semanas', valor: 0, pre: true, prod: true, pos: false },
      { id: '7.1.2', desc: 'Assistente de Arte', qtd: 0, unid: 'semanas', valor: 0, pre: true, prod: true, pos: false },
      { id: '7.1.3', desc: 'Cenógrafo', qtd: 0, unid: 'semanas', valor: 0, pre: false, prod: true, pos: false },
      { id: '7.1.4', desc: 'Figurinista', qtd: 0, unid: 'semanas', valor: 0, pre: true, prod: true, pos: false },
    ]},
    { id: '8', label: 'Equipe Técnica — Som', items: [
      { id: '8.1.1', desc: 'Diretor de Som', qtd: 0, unid: 'semanas', valor: 0, pre: false, prod: true, pos: false },
      { id: '8.1.2', desc: 'Microfonista', qtd: 0, unid: 'semanas', valor: 0, pre: false, prod: true, pos: false },
    ]},
    { id: '9', label: 'Locações', items: locations.length > 0
      ? locations.map((l, i) => ({ id: `9.1.${i+1}`, desc: l, qtd: diariasLocacao[l] || 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false }))
      : [{ id: '9.1.1', desc: 'Locação principal', qtd: 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false }]
    },
    { id: '10', label: 'Equipamentos', items: [
      { id: '10.1.1', desc: 'Câmera principal', qtd: 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false },
      { id: '10.1.2', desc: 'Lentes', qtd: 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false },
      { id: '10.1.3', desc: 'Kit iluminação', qtd: 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false },
      { id: '10.1.4', desc: 'Kit som', qtd: 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false },
    ]},
    { id: '11', label: 'Produção — Logística', items: [
      { id: '11.1.1', desc: 'Transporte equipe', qtd: 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false },
      { id: '11.1.2', desc: 'Alimentação', qtd: 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false },
      { id: '11.1.3', desc: 'Hospedagem', qtd: 0, unid: 'diárias', valor: 0, pre: false, prod: true, pos: false },
    ]},
    { id: '12', label: 'Pós-produção', items: [
      { id: '12.1.1', desc: 'Montagem', qtd: 0, unid: 'semanas', valor: 0, pre: false, prod: false, pos: true },
      { id: '12.1.2', desc: 'Finalização de cor', qtd: 0, unid: 'total', valor: 0, pre: false, prod: false, pos: true },
      { id: '12.1.3', desc: 'Mixagem de som', qtd: 0, unid: 'total', valor: 0, pre: false, prod: false, pos: true },
      { id: '12.1.4', desc: 'VFX', qtd: 0, unid: 'total', valor: 0, pre: false, prod: false, pos: true },
      { id: '12.1.5', desc: 'Trilha sonora', qtd: 0, unid: 'total', valor: 0, pre: false, prod: false, pos: true },
    ]},
    { id: '13', label: 'Despesas Administrativas', items: [
      { id: '13.1.1', desc: 'Seguro', qtd: 0, unid: 'total', valor: 0, pre: false, prod: true, pos: false },
      { id: '13.1.2', desc: 'Contabilidade', qtd: 0, unid: 'mês', valor: 0, pre: true, prod: true, pos: true },
      { id: '13.1.3', desc: 'Taxas e tributos', qtd: 0, unid: 'total', valor: 0, pre: false, prod: false, pos: true },
    ]},
  ];

  const [sections, setSections] = useState(() => buildInitialSections());

  // Salva automaticamente no banco com debounce de 1s após qualquer mudança
  useEffect(() => {
    if (!project?.id || budgetPlanId === '__original__') return;
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      fetch(`/api/projects/${project.id}/budget?plan_id=${budgetPlanId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      }).then(() => setSaveStatus('saved')).catch(err => console.warn('Erro ao salvar orçamento:', err.message));
    }, 1000);
    return () => clearTimeout(saveTimeoutRef.current);
  }, [sections, budgetPlanId, project?.id]);

  // Atualiza APENAS as quantidades automáticas (diárias) quando o plano muda
  // Sem resetar valores que o usuário já editou (preços, etc.)
  useEffect(() => {
    setSections(prev => prev.map(sec => {
      // Seção 4 — Equipe de Direção: atualiza qtd com total de dias de gravação
      if (sec.id === '4') {
        return { ...sec, items: sec.items.map(item => ({ ...item, qtd: totalDiasGravacao || 0 })) };
      }
      // Seção 5 — Elenco: atualiza qtd com diárias por personagem
      if (sec.id === '5') {
        return { ...sec, items: sec.items.map(item => ({
          ...item,
          qtd: diariasPersonagem[item.desc] ?? item.qtd
        }))};
      }
      // Seção 9 — Locações: atualiza qtd com diárias por locação
      if (sec.id === '9') {
        return { ...sec, items: sec.items.map(item => ({
          ...item,
          qtd: diariasLocacao[item.desc] ?? item.qtd
        }))};
      }
      return sec;
    }));
  }, [budgetPlanId, totalDiasGravacao]);

  function updateItem(secId, itemId, field, value) {
    setSections(prev => prev.map(sec => sec.id !== secId ? sec : {
      ...sec,
      items: sec.items.map(item => item.id !== itemId ? item : { ...item, [field]: value })
    }));
  }

  function addItem(secId) {
    setSections(prev => prev.map(sec => {
      if (sec.id !== secId) return sec;
      const lastId = sec.items[sec.items.length - 1]?.id || `${secId}.1.0`;
      const parts = lastId.split('.');
      const newNum = parseInt(parts[parts.length - 1] || 0) + 1;
      const newId = `${parts.slice(0, -1).join('.')}.${newNum}`;
      return { ...sec, items: [...sec.items, { id: newId, desc: '', qtd: 1, unid: 'total', valor: 0, pre: false, prod: true, pos: false }] };
    }));
  }

  // Shift+Enter: insere nova linha imediatamente após a linha onde o usuário está
  function insertItemAfter(secId, afterItemId) {
    setSections(prev => prev.map(sec => {
      if (sec.id !== secId) return sec;
      const idx = sec.items.findIndex(i => i.id === afterItemId);
      const base = sec.items[idx]?.id || `${secId}.1.0`;
      const parts = base.split('.');
      const newNum = parseInt(parts[parts.length - 1] || 0) + 1;
      const newId = `${parts.slice(0, -1).join('.')}.${newNum}`;
      const newItem = { id: newId, desc: '', qtd: 1, unid: 'total', valor: 0, pre: false, prod: true, pos: false };
      const newItems = [...sec.items];
      newItems.splice(idx + 1, 0, newItem);
      return { ...sec, items: newItems };
    }));
  }

  // Insere nova seção após a seção clicada
  function insertSectionAfter(afterSecId) {
    setSections(prev => {
      const idx = prev.findIndex(s => s.id === afterSecId);
      const newSec = {
        id: String(idx + 2), // temporário, vai ser renumerado abaixo
        label: 'Novo departamento',
        items: [{ id: `${idx + 2}.1.1`, desc: '', qtd: 1, unid: 'total', valor: 0, pre: false, prod: true, pos: false }]
      };
      const next = [...prev];
      next.splice(idx + 1, 0, newSec);
      // Renumera todas as seções em ordem
      return next.map((sec, i) => ({
        ...sec,
        id: String(i + 1),
        items: sec.items.map(item => ({
          ...item,
          id: item.id.replace(/^\d+/, String(i + 1))
        }))
      }));
    });
  }

  function updateSectionLabel(secId, label) {
    setSections(prev => prev.map(sec => sec.id !== secId ? sec : { ...sec, label }));
  }

  function handleArrowNav(e, rowIdx, colIdx) {
    const COLS = 7; // desc(0), qtd(1), unid(2), valor(3), pre(4), prod(5), pos(6)
    let targetRow = rowIdx;
    let targetCol = colIdx;

    if (e.key === 'ArrowDown') { e.preventDefault(); targetRow = rowIdx + 1; }
    else if (e.key === 'ArrowUp') { e.preventDefault(); targetRow = rowIdx - 1; }
    else if (e.key === 'ArrowRight') {
      if (colIdx >= 3 || e.target.selectionStart === e.target.value?.length) { e.preventDefault(); targetCol = colIdx + 1; }
      else return;
    }
    else if (e.key === 'ArrowLeft') {
      if (colIdx >= 4 || e.target.selectionStart === 0) { e.preventDefault(); targetCol = colIdx - 1; }
      else return;
    }
    else return;

    targetCol = Math.max(0, Math.min(COLS - 1, targetCol));
    const next = document.querySelector(`[data-row="${targetRow}"][data-col="${targetCol}"]`);
    if (next) { next.focus(); if (next.type !== 'checkbox') next.select?.(); }
  }

  function removeItem(secId, itemId) {
    setSections(prev => prev.map(sec => sec.id !== secId ? sec : {
      ...sec, items: sec.items.filter(item => item.id !== itemId)
    }));
  }

  function calcSubtotal(item) {
    return (parseFloat(item.qtd) || 0) * (parseFloat(item.valor) || 0);
  }

  function fmtBRL(v) {
    return 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const [limite, setLimite] = useState('');
  const barRef = useRef(null);
  const [barHeight, setBarHeight] = useState(90);

  useEffect(() => {
    if (barRef.current) {
      const h = barRef.current.getBoundingClientRect().height;
      setBarHeight(h);
    }
  }, []);
  const totalGeral = sections.reduce((acc, sec) => acc + sec.items.reduce((a, item) => a + calcSubtotal(item), 0), 0);
  const limiteNum = parseFloat((limite || '0').replace(/\./g, '').replace(',', '.')) || 0;
  const saldo = limiteNum > 0 ? limiteNum - totalGeral : null;
  const pct = limiteNum > 0 ? Math.min((totalGeral / limiteNum) * 100, 100) : 0;
  const estourado = saldo !== null && saldo < 0;

  const th = `text-[9px] font-medium uppercase tracking-wide px-2 py-2 border-b border-r whitespace-nowrap ${darkMode ? 'border-gray-700 text-gray-500 bg-gray-900' : 'border-gray-200 text-gray-400 bg-gray-50'}`;

  // Larguras exatas das colunas — usadas em AMBAS as tabelas para garantir alinhamento
  const COLS = [24, 70, 260, 55, 70, 90, 90, 100, 44, 44, 44, 32];
  const TOTAL_WIDTH = COLS.reduce((a, b) => a + b, 0); // 923px
  const tdBase = `px-2 py-1.5 border-b border-r text-xs ${darkMode ? 'border-gray-800' : 'border-gray-100'}`;
  const [activeRow, setActiveRow] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving'

  function fmtValor(v) {
    const num = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    if (isNaN(num) || num === 0) return '';
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Totais por fase
  const totalPre = sections.reduce((acc, sec) => acc + sec.items.reduce((a, item) => a + (item.pre ? calcSubtotal(item) : 0), 0), 0);
  const totalProd = sections.reduce((acc, sec) => acc + sec.items.reduce((a, item) => a + (item.prod ? calcSubtotal(item) : 0), 0), 0);
  const totalPos = sections.reduce((acc, sec) => acc + sec.items.reduce((a, item) => a + (item.pos ? calcSubtotal(item) : 0), 0), 0);

  return (
    <div>
      {/* Barra fixa de orçamento */}
      <div ref={barRef} className={`sticky top-14 z-10 border rounded-xl px-5 py-3 flex items-center gap-6 flex-wrap ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>

        {/* Seletor de plano */}
        {plans.length > 0 && (
          <>
            <div className="flex flex-col gap-0.5">
              <span className={`text-[9px] font-medium uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Plano de filmagem</span>
              <select value={budgetPlanId} onChange={e => { setBudgetPlanId(e.target.value); setSections(buildInitialSections()); }}
                className={`text-xs font-medium bg-transparent outline-none border-b ${darkMode ? 'text-gray-200 border-gray-600' : 'text-gray-700 border-gray-300'}`}>
                <option value="__original__">Original (sem datas)</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className={`w-px h-8 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
          </>
        )}

        {/* Valor limite */}
        <div className="flex flex-col gap-0.5">
          <span className={`text-[9px] font-medium uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Valor limite</span>
          <div className="flex items-center gap-1">
            <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>R$</span>
            <input value={limite} 
              onChange={e => {
                // Permite só números, ponto e vírgula
                const raw = e.target.value.replace(/[^0-9.,]/g, '');
                setLimite(raw);
              }}
              onBlur={e => {
                // Formata ao sair do campo: 1000000 → 1.000.000,00
                const num = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(num)) setLimite(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
              }}
              placeholder="0,00"
              className={`text-base font-medium bg-transparent outline-none border-b border-dashed w-36 ${darkMode ? 'text-gray-200 border-gray-600 placeholder-gray-700' : 'text-gray-700 border-gray-300 placeholder-gray-300'}`} />
          </div>
        </div>

        <div className={`w-px h-8 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />

        {/* Orçado */}
        <div className="flex flex-col gap-0.5">
          <span className={`text-[9px] font-medium uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Orçado</span>
          <span className={`text-base font-medium ${darkMode ? 'text-brand-400' : 'text-brand-600'}`}>{fmtBRL(totalGeral)}</span>
        </div>

        <div className={`w-px h-8 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />

        {/* Saldo */}
        <div className="flex flex-col gap-0.5">
          <span className={`text-[9px] font-medium uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Saldo</span>
          {saldo === null ? (
            <span className={`text-base font-medium ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>— defina o limite</span>
          ) : estourado ? (
            <span className="text-base font-medium text-red-500">⚠️ {fmtBRL(Math.abs(saldo))} estourado</span>
          ) : (
            <span className="text-base font-medium text-green-500">+ {fmtBRL(saldo)}</span>
          )}
        </div>

        {/* Barra de progresso */}
        {limiteNum > 0 && (
          <>
            <div className={`w-px h-8 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
            <div className="flex-1 min-w-40">
              <div className="flex justify-between mb-1">
                <span className={`text-[10px] ${estourado ? 'text-red-500' : (darkMode ? 'text-gray-500' : 'text-gray-400')}`}>
                  {estourado ? `${Math.round((totalGeral/limiteNum)*100)}% — estourado` : `${Math.round(pct)}% utilizado`}
                </span>
                {!estourado && <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{Math.round(100 - pct)}% disponível</span>}
              </div>
              <div className={`h-1.5 rounded-full ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <div className={`h-full rounded-full transition-all ${estourado ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </>
        )}

        {/* Indicador de salvamento + Botões */}
        <div className="flex items-center gap-2 ml-auto">
          <span className={`text-[10px] transition-opacity ${saveStatus === 'saving' ? 'opacity-100' : 'opacity-0'} ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Salvando...
          </span>
          <span className={`text-[10px] transition-opacity ${saveStatus === 'saved' && budgetPlanId !== '__original__' ? 'opacity-100' : 'opacity-0'} text-green-500`}>
            ✓ Salvo
          </span>
          <button className={`text-[11px] px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${darkMode ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            ⬆️ Importar
          </button>
          <button onClick={async () => {
            try {
              const res = await fetch(`/api/projects/${project?.id}/export-budget`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections, projectTitle: project?.title, limite }),
              });
              if (!res.ok) throw new Error('Erro ao gerar arquivo');
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `orcamento_${(project?.title || 'projeto').replace(/\s+/g, '_')}.xlsx`;
              a.click();
              URL.revokeObjectURL(url);
            } catch (err) {
              alert('Erro ao exportar: ' + err.message);
            }
          }} className={`text-[11px] px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${darkMode ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            ⬇️ Exportar Excel
          </button>
        </div>
      </div>

      {/* Uma única tabela com thead sticky dentro do mesmo scroll */}
      <div className={`border rounded-xl overflow-hidden ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - ' + (57 + barHeight + 80) + 'px)' }}>
          <table className="w-full border-collapse">
            <colgroup>
              <col style={{width:24}} /><col style={{width:70}} /><col />
              <col style={{width:55}} /><col style={{width:70}} />
              <col style={{width:90}} /><col style={{width:90}} /><col style={{width:100}} />
              <col style={{width:44}} /><col style={{width:44}} /><col style={{width:44}} /><col style={{width:32}} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, zIndex: 5,
              backgroundColor: darkMode ? '#111827' : '#f9fafb' }}>
              <tr>
                <th className={th}></th>
                <th className={th}>Nº</th>
                <th className={th}>Descrição</th>
                <th className={th}>Qtd</th>
                <th className={th}>Unid</th>
                <th className={th}>Valor unit</th>
                <th className={th}>Sub-total</th>
                <th className={`${th} font-semibold`}>Total</th>
                <th className={th}>Pré</th>
                <th className={th}>Prod</th>
                <th className={th}>Pós</th>
                <th className={`${th} border-r-0`}></th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let globalRowIdx = 0;
                return sections.map((sec, secIdx) => {
                const secTotal = sec.items.reduce((a, item) => a + calcSubtotal(item), 0);
                return (
                  <>
                    {/* Linha de seção */}
                    <tr key={sec.id} className={`group ${darkMode ? 'bg-gray-800/60' : 'bg-gray-50'}`}>
                      <td className={`${tdBase} w-6 text-center`}>
                        <button onClick={() => insertSectionAfter(sec.id)}
                          title="Inserir novo departamento após este"
                          className={`w-4 h-4 rounded text-[11px] leading-none border opacity-20 group-hover:opacity-80 transition-opacity ${darkMode ? 'border-gray-600 text-gray-400 hover:border-brand-500 hover:text-brand-400' : 'border-gray-300 text-gray-400 hover:border-brand-400 hover:text-brand-500'}`}>
                          +
                        </button>
                      </td>
                      <td className={`${tdBase} text-[10px] font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{sec.id}</td>
                      <td className={`${tdBase} font-semibold text-xs ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        <input value={sec.label}
                          onChange={e => updateSectionLabel(sec.id, e.target.value)}
                          className={`w-full bg-transparent outline-none font-semibold text-xs ${darkMode ? 'text-gray-200 placeholder-gray-600' : 'text-gray-700 placeholder-gray-400'}`}
                          placeholder="Nome do departamento" />
                      </td>
                      <td className={tdBase}></td>
                      <td className={tdBase}></td>
                      <td className={tdBase}></td>
                      <td className={tdBase}></td>
                      <td className={`${tdBase} font-semibold text-xs ${darkMode ? 'text-brand-400' : 'text-brand-600'}`}>{secTotal > 0 ? fmtBRL(secTotal) : '—'}</td>
                      <td className={tdBase}></td>
                      <td className={tdBase}></td>
                      <td className={tdBase}></td>
                      <td className={`${tdBase} border-r-0`}>
                        <button onClick={() => addItem(sec.id)} className={`text-[10px] px-1.5 py-0.5 rounded ${darkMode ? 'text-gray-500 hover:text-brand-400' : 'text-gray-300 hover:text-brand-500'}`} title="Adicionar sublinha">+</button>
                      </td>
                    </tr>
                    {/* Itens da seção */}
                    {sec.items.map(item => {
                      const sub = calcSubtotal(item);
                      const rowIdx = globalRowIdx++;
                      return (
                        <tr key={item.id}
                          className={activeRow === rowIdx
                            ? (darkMode ? 'bg-brand-900/20' : 'bg-brand-50')
                            : (darkMode ? 'hover:bg-gray-800/40' : 'hover:bg-gray-50/50')}>
                          <td className={`${tdBase} w-6`}></td>
                          <td className={`${tdBase} text-[10px] ${darkMode ? 'text-gray-600' : 'text-gray-300'} pl-6`}>{item.id}</td>
                          <td className={`${tdBase} pl-6`}>
                            <input value={item.desc}
                              onChange={e => updateItem(sec.id, item.id, 'desc', e.target.value)}
                              onFocus={() => setActiveRow(rowIdx)}
                              onBlur={() => setActiveRow(null)}
                              onKeyDown={e => { if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); insertItemAfter(sec.id, item.id); } else handleArrowNav(e, rowIdx, 0); }}
                              data-row={rowIdx} data-col={0}
                              className={`w-full bg-transparent outline-none text-xs ${darkMode ? 'text-gray-300 placeholder-gray-600' : 'text-gray-700 placeholder-gray-300'}`}
                              placeholder="Descrição do item" />
                          </td>
                          <td className={tdBase}>
                            <input value={item.qtd || ''} onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); updateItem(sec.id, item.id, 'qtd', v); }} type="text" inputMode="numeric"
                              onKeyDown={e => handleArrowNav(e, rowIdx, 1)}
                              data-row={rowIdx} data-col={1}
                              className={`w-full bg-transparent outline-none text-xs text-center ${darkMode ? 'text-gray-300' : 'text-gray-700'}`} />
                          </td>
                          <td className={tdBase}>
                            <select value={item.unid} onChange={e => updateItem(sec.id, item.id, 'unid', e.target.value)}
                              data-row={rowIdx} data-col={2}
                              className={`w-full bg-transparent outline-none text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {['total','mês','semanas','diárias','verba','horas'].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className={tdBase}>
                            <input value={item.valor || ''}
                              onChange={e => { const v = e.target.value.replace(/[^0-9.,]/g, ''); updateItem(sec.id, item.id, 'valor', v); }}
                              onFocus={() => setActiveRow(rowIdx)}
                              onBlur={() => { setActiveRow(null); if (item.valor) updateItem(sec.id, item.id, 'valor', fmtValor(item.valor) || item.valor); }}
                              type="text" inputMode="decimal"
                              onKeyDown={e => handleArrowNav(e, rowIdx, 3)}
                              data-row={rowIdx} data-col={3}
                              className={`w-full bg-transparent outline-none text-xs text-right ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                              placeholder="0,00" />
                          </td>
                          <td className={`${tdBase} text-xs text-right ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{sub > 0 ? fmtBRL(sub) : <span className={darkMode ? 'text-gray-700' : 'text-gray-300'}>R$ 0,00</span>}</td>
                          <td className={`${tdBase} text-xs font-medium text-right ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{sub > 0 ? fmtBRL(sub) : '—'}</td>
                          <td className={`${tdBase} text-center`} style={{width:44}}>
                            <input type="checkbox" checked={item.pre}
                              onChange={e => updateItem(sec.id, item.id, 'pre', e.target.checked)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); updateItem(sec.id, item.id, 'pre', !item.pre); } else handleArrowNav(e, rowIdx, 4); }}
                              data-row={rowIdx} data-col={4} />
                          </td>
                          <td className={`${tdBase} text-center`} style={{width:44}}>
                            <input type="checkbox" checked={item.prod}
                              onChange={e => updateItem(sec.id, item.id, 'prod', e.target.checked)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); updateItem(sec.id, item.id, 'prod', !item.prod); } else handleArrowNav(e, rowIdx, 5); }}
                              data-row={rowIdx} data-col={5} />
                          </td>
                          <td className={`${tdBase} text-center`} style={{width:44}}>
                            <input type="checkbox" checked={item.pos}
                              onChange={e => updateItem(sec.id, item.id, 'pos', e.target.checked)}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); updateItem(sec.id, item.id, 'pos', !item.pos); } else handleArrowNav(e, rowIdx, 6); }}
                              data-row={rowIdx} data-col={6} />
                          </td>
                          <td className={`${tdBase} border-r-0 text-center`}>
                            <button onClick={() => removeItem(sec.id, item.id)} className={`text-[11px] ${darkMode ? 'text-gray-600 hover:text-red-400' : 'text-gray-300 hover:text-red-400'}`}>✕</button>
                          </td>
                        </tr>
                      );
                    })}
                  </>
                );
              });
              })()}

              {/* Totais por fase */}
              <tr className={darkMode ? 'bg-gray-800/40' : 'bg-gray-50'}>
                <td className={`${tdBase} text-[9px] uppercase tracking-wide`} colSpan={7} style={{textAlign:'right', color: 'var(--text-muted)'}}>Totais por fase</td>
                <td className={tdBase}></td>
                <td className={`${tdBase} text-xs text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{fmtBRL(totalPre)}</td>
                <td className={`${tdBase} text-xs text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{fmtBRL(totalProd)}</td>
                <td className={`${tdBase} text-xs text-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{fmtBRL(totalPos)}</td>
                <td className={`${tdBase} border-r-0`}></td>
              </tr>

              {/* Total geral */}
              <tr className={darkMode ? 'bg-gray-900' : 'bg-gray-50'}>
                <td className={`${tdBase} font-bold text-xs`} colSpan={6} style={{textAlign:'right'}}>TOTAL GERAL</td>
                <td className={`${tdBase} font-bold text-sm ${darkMode ? 'text-brand-400' : 'text-brand-600'}`}>{fmtBRL(totalGeral)}</td>
                <td className={tdBase} colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({ icon, title, count, darkMode, children, defaultOpen, headerAction }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className={`border rounded-xl overflow-hidden ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100"}`}>
      <div className={`w-full flex items-center gap-3 px-6 py-4 text-left transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-3 flex-1 text-left">
          <span className="text-base">{icon}</span>
          <span className={`text-sm font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{title}</span>
          {count !== undefined && <span className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{count}</span>}
        </button>
        {headerAction}
        <button onClick={() => setOpen(v => !v)} className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{open ? '▼' : '▶'}</button>
      </div>
      {open && (
        <div className={`px-6 pb-6 pt-1 border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          {children}
        </div>
      )}
    </div>
  );
}

function DatesOnlyView({ list, sceneDates, darkMode }) {
  // Pega as datas únicas (sem repetir), ordenadas cronologicamente
  const uniqueDates = [...new Set(
    list.map(s => sceneDates?.[s.id]).filter(Boolean)
  )].sort();

  function formatBR(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  if (uniqueDates.length === 0) {
    return <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Nenhuma cena com data de filmagem ainda.</p>;
  }

  return (
    <div className={`border rounded-lg p-4 ${darkMode ? 'bg-gray-950 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
      <p className={`text-sm leading-relaxed ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
        {uniqueDates.map(formatBR).join(', ')}
      </p>
      <p className={`text-[10px] mt-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{uniqueDates.length} diária{uniqueDates.length !== 1 ? 's' : ''}</p>
    </div>
  );
}

function MiniCalendarView({ list, sceneDates, darkMode }) {
  // Agrupa cenas por data
  const byDate = {};
  list.forEach(s => {
    const d = sceneDates?.[s.id];
    if (!d) return;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(s);
  });

  const datesWithScenes = Object.keys(byDate).sort();
  // Mês inicial: o mês da primeira data com cena, ou o mês atual
  const initialMonth = datesWithScenes[0] ? datesWithScenes[0].slice(0, 7) : new Date().toISOString().slice(0, 7);
  const [monthStr, setMonthStr] = useState(initialMonth); // "YYYY-MM"

  const [year, month] = monthStr.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0 = domingo

  function changeMonth(delta) {
    const d = new Date(year, month - 1 + delta, 1);
    setMonthStr(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="flex items-center justify-center gap-3 mb-3">
        <button onClick={() => changeMonth(-1)} className={`w-6 h-6 rounded flex items-center justify-center text-xs ${darkMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>‹</button>
        <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{monthNames[month - 1]} {year}</span>
        <button onClick={() => changeMonth(1)} className={`w-6 h-6 rounded flex items-center justify-center text-xs ${darkMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
          <div key={d} className={`text-[9px] text-center uppercase ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayScenes = byDate[dateStr] || [];
          const hasScenes = dayScenes.length > 0;
          return (
            <div key={i} className={`rounded px-1 py-1 min-h-[44px] border ${hasScenes ? (darkMode ? 'bg-brand-900/20 border-brand-700' : 'bg-brand-50 border-brand-200') : (darkMode ? 'border-gray-800' : 'border-gray-100')}`}>
              <div className={`text-[9px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{day}</div>
              {hasScenes && (
                <div className={`text-[8px] leading-tight mt-0.5 ${darkMode ? 'text-teal-400' : 'text-teal-700'}`}>
                  {dayScenes.length} cena{dayScenes.length !== 1 ? 's' : ''}
                  <div className="truncate">{dayScenes[0].location}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExpandableBarChart({ data, color, scenes, mode, darkMode, project, planName, sceneDates }) {
  const [expanded, setExpanded] = useState(null);
  const [sortKey, setSortKey] = useState('shoot_date');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar' | 'dates'
  const max = Math.max(...data.map((d) => d.count), 1);

  function scenesFor(label) {
    const list = mode === 'location'
      ? scenes.filter(s => s.location === label)
      : scenes.filter(s => (s.characters || []).includes(label));

    const sorted = [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === 'location') { av = a.location || ''; bv = b.location || ''; }
      else { // shoot_date
        av = sceneDates?.[a.id] || '9999-99-99'; // sem data vai pro fim
        bv = sceneDates?.[b.id] || '9999-99-99';
      }
      if (av < bv) return -1;
      if (av > bv) return 1;
      return a.scene_number - b.scene_number; // desempate sempre por número
    });
    return sorted;
  }

  function formatShootDate(sceneId) {
    const d = sceneDates?.[sceneId];
    if (!d) return '— sem data —';
    const [y, m, day] = d.split('-');
    return `${day}/${m}`;
  }

  function exportLocationPDF(label) {
    const list = scenesFor(label);
    const sortLabel = SORT_OPTIONS.find(o => o.key === sortKey)?.label || 'data de filmagem';
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8"><title>${label} — ${project?.title||''}</title>
<style>
body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}
h1{font-size:16px;margin-bottom:2px}
p.sub{font-size:10px;color:#555;margin-bottom:14px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #ddd;padding:6px 7px;text-align:left;vertical-align:top;font-size:10px}
th{background:#eee;font-weight:bold;font-size:9px;text-transform:uppercase}
.scene-num{font-weight:bold;color:#185FA5}
@media print{@page{size:A4 portrait;margin:12mm}}
</style></head><body>
<h1>${mode === 'location' ? '📍 ' + label : '👤 ' + label}</h1>
<p class="sub">${project?.title||''} ${planName?'· '+planName:''} · ${list.length} cena${list.length!==1?'s':''} · ordenado por ${sortLabel} · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
<table><thead><tr>
<th style="width:40px">#</th><th style="width:90px">I/E · Período</th><th>Set</th><th style="width:60px">Data</th><th>Sinopse</th><th>Personagens</th>
</tr></thead><tbody>
${list.map(s => `<tr>
<td class="scene-num">#${s.scene_number}</td>
<td>${s.int_ext} · ${s.day_night}</td>
<td>${s.set_name||'—'}</td>
<td>${formatShootDate(s.id)}</td>
<td>${s.synopsis||''}</td>
<td>${(s.characters||[]).join(', ')}</td>
</tr>`).join('')}
</tbody></table>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }

  function exportDatesPDF(label, list) {
    const uniqueDates = [...new Set(list.map(s => sceneDates?.[s.id]).filter(Boolean))].sort();
    function formatBR(dateStr) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8"><title>${label} — Datas — ${project?.title||''}</title>
<style>
body{font-family:Arial,sans-serif;font-size:12px;margin:24px;color:#111}
h1{font-size:16px;margin-bottom:2px}
p.sub{font-size:10px;color:#555;margin-bottom:18px}
p.dates{font-size:13px;line-height:1.7;background:#f5f5f5;padding:14px;border-radius:6px}
p.total{font-size:10px;color:#888;margin-top:10px}
@media print{@page{size:A4 portrait;margin:14mm}}
</style></head><body>
<h1>${mode === 'location' ? '📍 ' + label : '👤 ' + label} — Datas de filmagem</h1>
<p class="sub">${project?.title||''} ${planName?'· '+planName:''} · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
<p class="dates">${uniqueDates.map(formatBR).join(', ')}</p>
<p class="total">${uniqueDates.length} diária${uniqueDates.length!==1?'s':''}</p>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }

  function exportCalendarPDF(label, list) {
    const byDate = {};
    list.forEach(s => {
      const d = sceneDates?.[s.id];
      if (!d) return;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(s);
    });
    const dates = Object.keys(byDate).sort();
    if (dates.length === 0) {
      alert('Nenhuma cena com data de filmagem para exportar neste calendário.');
      return;
    }

    // Agrupa as datas por mês, gerando um calendário por mês que tiver cena
    const months = [...new Set(dates.map(d => d.slice(0, 7)))].sort();
    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    function buildMonthGrid(monthStr) {
      const [year, month] = monthStr.split('-').map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const daysInMonth = new Date(year, month, 0).getDate();
      const startWeekday = firstDay.getDay();
      const cells = [];
      for (let i = 0; i < startWeekday; i++) cells.push('<td></td>');
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dayScenes = byDate[dateStr] || [];
        if (dayScenes.length > 0) {
          cells.push(`<td class="has-shoot"><div class="daynum">${d}</div><div class="dayinfo">${dayScenes.length} cena${dayScenes.length!==1?'s':''}<br>${dayScenes[0].location}</div></td>`);
        } else {
          cells.push(`<td><div class="daynum">${d}</div></td>`);
        }
      }
      // Completa a última semana
      while (cells.length % 7 !== 0) cells.push('<td></td>');
      let rows = '';
      for (let i = 0; i < cells.length; i += 7) {
        rows += '<tr>' + cells.slice(i, i+7).join('') + '</tr>';
      }
      return `<h2>${monthNames[month-1]} ${year}</h2>
<table class="cal"><thead><tr><th>Dom</th><th>Seg</th><th>Ter</th><th>Qua</th><th>Qui</th><th>Sex</th><th>Sáb</th></tr></thead>
<tbody>${rows}</tbody></table>`;
    }

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8"><title>${label} — Calendário — ${project?.title||''}</title>
<style>
body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}
h1{font-size:16px;margin-bottom:2px}
h2{font-size:13px;margin:16px 0 8px;color:#185FA5}
p.sub{font-size:10px;color:#555;margin-bottom:14px}
table.cal{width:100%;border-collapse:collapse;margin-bottom:10px}
table.cal th{border:1px solid #ddd;padding:4px;font-size:9px;text-transform:uppercase;background:#eee}
table.cal td{border:1px solid #ddd;padding:4px;vertical-align:top;height:50px;width:14.28%}
.daynum{font-size:9px;color:#888}
.dayinfo{font-size:9px;color:#0f6e56;font-weight:bold;margin-top:2px}
td.has-shoot{background:#e1f5ee}
@media print{@page{size:A4 portrait;margin:12mm}}
</style></head><body>
<h1>${mode === 'location' ? '📍 ' + label : '👤 ' + label} — Calendário</h1>
<p class="sub">${project?.title||''} ${planName?'· '+planName:''} · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
${months.map(buildMonthGrid).join('')}
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }

  return (
    <div className="space-y-1">
      {data.map(({ label, count }) => {
        const isOpen = expanded === label;
        const list = isOpen ? scenesFor(label) : [];
        const sortLabel = SORT_OPTIONS.find(o => o.key === sortKey)?.label.toLowerCase() || 'data de filmagem';
        return (
          <div key={label}>
            <div onClick={() => setExpanded(isOpen ? null : label)}
              className={`flex items-center gap-3 cursor-pointer rounded-lg px-1 py-1 transition-colors ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
              <span className={`text-[10px] w-3.5 flex-shrink-0 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>{isOpen ? '▼' : '▶'}</span>
              <div className={`w-44 text-xs truncate flex-shrink-0 ${darkMode ? 'text-gray-300' : 'text-gray-500'}`} title={label}>{label}</div>
              <div className={`flex-1 h-5 rounded overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <div className="h-full rounded flex items-center pl-2 text-[10px] font-bold text-white transition-all"
                  style={{ width:`${Math.round(count/max*100)}%`, background:color, minWidth:'24px' }}>
                  {count}
                </div>
              </div>
              <div className={`w-6 text-right text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{count}</div>
            </div>

            {isOpen && (
              <div className="ml-[174px] mb-3 mt-1.5">
                {/* Toggle Lista / Calendário / Datas corridas */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className={`flex items-center gap-1 rounded-lg p-0.5 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                    <button onClick={(e) => { e.stopPropagation(); setViewMode('list'); }}
                      className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${viewMode === 'list' ? 'bg-brand-500 text-white font-medium' : (darkMode ? 'text-gray-400' : 'text-gray-500')}`}>
                      Lista
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setViewMode('calendar'); }}
                      className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-brand-500 text-white font-medium' : (darkMode ? 'text-gray-400' : 'text-gray-500')}`}>
                      Calendário
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setViewMode('dates'); }}
                      className={`text-[10px] px-2.5 py-1 rounded-md transition-colors ${viewMode === 'dates' ? 'bg-brand-500 text-white font-medium' : (darkMode ? 'text-gray-400' : 'text-gray-500')}`}>
                      Datas corridas
                    </button>
                  </div>
                  {viewMode === 'calendar' && (
                    <button onClick={(e) => { e.stopPropagation(); exportCalendarPDF(label, list); }}
                      className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors">
                      📄 Exportar PDF
                    </button>
                  )}
                  {viewMode === 'dates' && (
                    <button onClick={(e) => { e.stopPropagation(); exportDatesPDF(label, list); }}
                      className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors">
                      📄 Exportar PDF
                    </button>
                  )}
                </div>

                {viewMode === 'calendar' ? (
                  <MiniCalendarView list={list} sceneDates={sceneDates} darkMode={darkMode} />
                ) : viewMode === 'dates' ? (
                  <DatesOnlyView list={list} sceneDates={sceneDates} darkMode={darkMode} />
                ) : (
                  <>
                {/* Botões de ordenação — seleção única */}
                <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                  <span className={`text-[10px] mr-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Ordenar por:</span>
                  {SORT_OPTIONS.map(opt => {
                    const isActive = sortKey === opt.key;
                    return (
                      <button key={opt.key} onClick={(e) => { e.stopPropagation(); setSortKey(opt.key); }}
                        className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${isActive ? 'bg-brand-500 border-brand-500 text-white font-medium' : (darkMode ? 'border-gray-700 bg-gray-800 text-gray-400 hover:border-brand-400' : 'border-gray-200 bg-white text-gray-500 hover:border-brand-300')}`}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{list.length} cena{list.length !== 1 ? 's' : ''} nesta {mode === 'location' ? 'locação' : 'personagem'} · ordenado por {sortLabel}</span>
                  <button onClick={(e) => { e.stopPropagation(); exportLocationPDF(label); }}
                    className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors">
                    📄 Exportar PDF
                  </button>
                </div>
                <div className={`border rounded-lg overflow-hidden ${darkMode ? 'bg-gray-950 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                  {list.map(s => (
                    <div key={s.id} className={`flex gap-2.5 px-3 py-2 border-b last:border-b-0 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
                      <span className="text-[10px] font-bold text-brand-500 w-7 flex-shrink-0">#{s.scene_number}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${darkMode ? 'bg-rose-900/30 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>{s.int_ext}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${darkMode ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-50 text-indigo-700'}`}>{s.day_night}</span>
                          {s.set_name && <span className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{s.set_name}</span>}
                        </div>
                        <p className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>{s.synopsis}</p>
                      </div>
                      <span className={`text-[9px] flex-shrink-0 whitespace-nowrap ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>{formatShootDate(s.id)}</span>
                    </div>
                  ))}
                </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BarChart({ data, color }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2">
      {data.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-3">
          <div className="w-44 text-xs text-gray-500 truncate flex-shrink-0" title={label}>{label}</div>
          <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
            <div className="h-full rounded flex items-center pl-2 text-[10px] font-bold text-white transition-all"
              style={{ width:`${Math.round(count/max*100)}%`, background:color, minWidth:'24px' }}>
              {count}
            </div>
          </div>
          <div className="w-6 text-right text-xs text-gray-400">{count}</div>
        </div>
      ))}
    </div>
  );
}


// ── Modais e Menu de inserção ────────────────────────────────────────────────
const FONTS = [
  { label: 'Sans-serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Impact', value: 'Impact, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
];

function BannerModal({ initial, onSave, onClose }) {
  const [text, setText] = useState(initial?.text || '');
  const [bgColor, setBgColor] = useState(initial?.bg_color || '#185FA5');
  const [textColor, setTextColor] = useState(initial?.text_color || '#FFFFFF');
  const [fontFamily, setFontFamily] = useState(initial?.font_family || 'sans-serif');
  const [fontSize, setFontSize] = useState(initial?.font_size || 14);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-gray-800 mb-4">{initial ? 'Editar Banner' : 'Criar Banner'}</h3>
        <div className="rounded-lg mb-4 px-4 py-3 flex items-center justify-center min-h-[48px]"
          style={{ backgroundColor: bgColor, fontFamily, fontSize: fontSize + 'px', color: textColor, fontWeight: 'bold' }}>
          {text || 'Texto do banner'}
        </div>
        <label className="block text-[11px] text-gray-500 mb-1">Texto</label>
        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand-400"
          value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex: DIA 1 DE FILMAGEM" autoFocus />
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Cor de fundo</label>
            <div className="flex items-center gap-2">
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-10 h-8 rounded border border-gray-200 cursor-pointer" />
              <input value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Cor do texto</label>
            <div className="flex items-center gap-2">
              <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-10 h-8 rounded border border-gray-200 cursor-pointer" />
              <input value={textColor} onChange={(e) => setTextColor(e.target.value)} className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs outline-none" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Fonte</label>
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-400">
              {FONTS.map((f) => <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Tamanho ({fontSize}px)</label>
            <input type="range" min="10" max="32" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full mt-1" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={() => text.trim() && onSave({ type:'banner', text: text.trim(), bg_color: bgColor, text_color: textColor, font_family: fontFamily, font_size: fontSize })}
            className="px-4 py-2 text-xs text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-40" disabled={!text.trim()}>
            {initial ? 'Salvar' : 'Criar Banner'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SimpleItemModal({ type, initial, onSave, onClose }) {
  const config = {
    visual_ref: { title: 'Referência Visual', icon: '🖼️', textLabel: 'Descrição', urlLabel: 'URL da imagem ou link', placeholder: 'Ex: Referência de figurino da Ana' },
    map_link:   { title: 'Link para Mapa',    icon: '📍', textLabel: 'Nome do local',  urlLabel: 'Link do Google Maps', placeholder: 'Ex: Hospital São Lucas' },
    note:       { title: 'Observação',         icon: '📝', textLabel: 'Observação',     urlLabel: '', placeholder: 'Escreva sua observação aqui...' },
  }[type];
  const [text, setText] = useState(initial?.text || '');
  const [url, setUrl] = useState(initial?.url || '');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-gray-800 mb-4">{config.icon} {initial ? 'Editar' : 'Criar'} {config.title}</h3>
        <label className="block text-[11px] text-gray-500 mb-1">{config.textLabel}</label>
        {type === 'note' ? (
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand-400 resize-none h-24"
            value={text} onChange={(e) => setText(e.target.value)} placeholder={config.placeholder} autoFocus />
        ) : (
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand-400"
            value={text} onChange={(e) => setText(e.target.value)} placeholder={config.placeholder} autoFocus />
        )}
        {config.urlLabel && (
          <>
            <label className="block text-[11px] text-gray-500 mb-1">{config.urlLabel}</label>
            <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand-400"
              value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={() => text.trim() && onSave({ type, text: text.trim(), url })}
            className="px-4 py-2 text-xs text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-40" disabled={!text.trim()}>
            {initial ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorConfigModal({ initial, onSave, onClose }) {
  const [colors, setColors] = useState(initial || DEFAULT_COLORS);

  const fields = [
    { key: 'ext_color', label: 'EXT (externa)' },
    { key: 'int_color', label: 'INT (interna)' },
    { key: 'int_ext_color', label: 'INT/EXT' },
    { key: 'dia_color', label: 'Dia' },
    { key: 'noite_color', label: 'Noite' },
    { key: 'manha_color', label: 'Manhã' },
    { key: 'tarde_color', label: 'Tarde' },
    { key: 'fim_tarde_color', label: 'Fim de tarde' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-gray-800 mb-1">⚙️ Personalizar cores</h3>
        <p className="text-[11px] text-gray-400 mb-4">Define as cores usadas no Breakdown e Stripboard para INT/EXT e período. Vale para todo o projeto.</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {fields.map(f => (
            <div key={f.key} className="flex items-center gap-2">
              <input type="color" value={colors[f.key]} onChange={e => setColors(prev => ({ ...prev, [f.key]: e.target.value }))}
                className="w-8 h-8 rounded border border-gray-200 cursor-pointer flex-shrink-0" />
              <span className="text-xs text-gray-600">{f.label}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={() => onSave(colors)}
            className="px-4 py-2 text-xs text-white bg-brand-500 rounded-lg hover:bg-brand-600">
            Salvar cores
          </button>
        </div>
      </div>
    </div>
  );
}

function DatePicker({ value, onChange, label, required }) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear + i);
  const months = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
  ];

  // Parse value (YYYY-MM-DD) ou default para hoje
  const parsed = value ? value.split('-') : null;
  const [year, setYear] = React.useState(parsed ? parseInt(parsed[0]) : currentYear);
  const [month, setMonth] = React.useState(parsed ? parseInt(parsed[1]) : today.getMonth() + 1);
  const [day, setDay] = React.useState(parsed ? parseInt(parsed[2]) : today.getDate());

  // Dias válidos para o mês/ano selecionado
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Ajusta dia se exceder o mês
  React.useEffect(() => {
    const maxDay = new Date(year, month, 0).getDate();
    const safeDay = Math.min(day, maxDay);
    if (safeDay !== day) setDay(safeDay);
    const pad = n => String(n).padStart(2, '0');
    onChange(`${year}-${pad(month)}-${pad(safeDay)}`);
  }, [year, month, day]);

  const pad = n => String(n).padStart(2, '0');
  const sel = "border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-brand-400 text-gray-900 font-medium bg-white";

  return (
    <div>
      {label && <label className="block text-[11px] text-gray-500 mb-1">{label}{required && ' *'}</label>}
      <div className="flex gap-1">
        <select value={day} onChange={e => setDay(parseInt(e.target.value))} className={sel + " w-16"}>
          {days.map(d => <option key={d} value={d}>{pad(d)}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className={sel + " flex-1"}>
          {months.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className={sel + " w-20"}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
    </div>
  );
}

function ScriptViewer({ projectId, darkMode }) {
  const [text, setText] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const r = await fetch(`/api/projects/${projectId}/raw-text`);
        if (!r.ok) throw new Error('Erro ao carregar roteiro');
        const d = await r.json();
        setText(d.text || '');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  const dm = darkMode;

  if (loading) return (
    <div className={`flex items-center justify-center py-20 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
      <span className="text-sm">Carregando roteiro...</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center py-20 text-red-400">
      <span className="text-sm">{error}</span>
    </div>
  );

  if (!text) return (
    <div className={`flex items-center justify-center py-20 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
      <span className="text-sm">Roteiro não disponível.</span>
    </div>
  );

  // Renderiza o texto do roteiro com formatação visual
  const lines = text.split('\n');
  return (
    <div className={`max-w-2xl mx-auto px-4 py-6`}>
      <div className={`rounded-xl shadow-sm border p-8 font-mono text-[12px] leading-relaxed ${dm ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'}`}>
        {lines.map((line, i) => {
          const trimmed = line.trim();
          const isSlug = /^(INT\.|EXT\.|INT\/EXT\.|EXT\/INT\.)/i.test(trimmed) || /^\d+\s+(INT\.|EXT\.)/i.test(trimmed);
          const isChar = trimmed === trimmed.toUpperCase() && trimmed.length > 0 && trimmed.length < 40 && !/^[0-9]/.test(trimmed) && !isSlug && trimmed.match(/^[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇÀÜ\s''\-\.]+$/) && trimmed.length > 1;
          const isParen = trimmed.startsWith('(') && trimmed.endsWith(')');
          const isTransition = /(CORTE PARA|DISSOLVE|FADE IN|FADE OUT|CUT TO):?\s*$/.test(trimmed);

          if (!trimmed) return <div key={i} className="h-3" />;

          if (isSlug) return (
            <div key={i} className={`font-bold uppercase mt-6 mb-1 ${dm ? 'text-white' : 'text-gray-900'}`}>{line}</div>
          );
          if (isTransition) return (
            <div key={i} className={`text-right mt-4 mb-4 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{trimmed}</div>
          );
          if (isChar) return (
            <div key={i} className={`text-center mt-4 font-semibold ${dm ? 'text-gray-100' : 'text-gray-800'}`}>{trimmed}</div>
          );
          if (isParen) return (
            <div key={i} className={`text-center ${dm ? 'text-gray-400' : 'text-gray-500'}`}>{trimmed}</div>
          );
          // Diálogo: linha após personagem/parêntese
          return (
            <div key={i} className={`${dm ? 'text-gray-300' : 'text-gray-700'} px-12`}>{trimmed || <>&nbsp;</>}</div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarConfigModal({ initial, onSave, onClose }) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = React.useState(initial?.start_date?.split('T')[0] || today);
  const [endDate, setEndDate] = React.useState(initial?.end_date?.split('T')[0] || '');
  const [hasEndDate, setHasEndDate] = React.useState(!!initial?.end_date);
  const [offMode, setOffMode] = useState(initial?.off_every > 0 ? 'every' : 'none');
  const [offEvery, setOffEvery] = useState(initial?.off_every || 5);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-gray-800 mb-1">⚙️ Configurar Calendário do Plano</h3>
        <p className="text-[11px] text-gray-400 mb-4">Define o período de filmagem e a regra de folgas. Isso vai gerar automaticamente os dias de filmagem e de folga na Strip.</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <DatePicker label="Data de início" value={startDate} onChange={setStartDate} required />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-[11px] text-gray-500">Data de término</label>
              <input type="checkbox" checked={hasEndDate} onChange={e => setHasEndDate(e.target.checked)} className="w-3 h-3" />
              <span className="text-[10px] text-gray-400">{hasEndDate ? '' : '(opcional)'}</span>
            </div>
            {hasEndDate
              ? <DatePicker value={endDate || startDate} onChange={setEndDate} />
              : <div className="text-[10px] text-gray-300 italic px-1 py-2">Sem data de término definida</div>
            }
          </div>
        </div>

        <label className="block text-[11px] text-gray-500 mb-2">Regra de folgas</label>
        <div className="flex gap-2 mb-3">
          <button onClick={() => setOffMode('none')}
            className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${offMode === 'none' ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-500 hover:border-brand-300'}`}>
            Inserir folga manualmente
          </button>
          <button onClick={() => setOffMode('every')}
            className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-colors ${offMode === 'every' ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-500 hover:border-brand-300'}`}>
            Folga a cada X dias
          </button>
        </div>

        {offMode === 'every' && (
          <div className="flex items-center gap-2 mb-4 bg-gray-50 rounded-lg p-3">
            <span className="text-xs text-gray-600">A cada</span>
            <input type="number" min="1" max="30" value={offEvery} onChange={(e) => setOffEvery(parseInt(e.target.value) || 1)}
              className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center outline-none focus:border-brand-400 text-gray-900 font-medium" />
            <span className="text-xs text-gray-600">dias de filmagem trabalhados, 1 dia de folga</span>
          </div>
        )}

        <div className="flex gap-2 justify-end mt-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={() => startDate && onSave({ start_date: startDate, end_date: hasEndDate ? (endDate || null) : null, off_every: offMode === 'every' ? offEvery : 0 })}
            className="px-4 py-2 text-xs text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-40" disabled={!startDate}>
            Aplicar ao Plano
          </button>
        </div>
      </div>
    </div>
  );
}

function DayOffModal({ initial, onSave, onClose }) {
  const [date, setDate] = useState(initial?.date || '');
  const [reason, setReason] = useState(initial?.text || '');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-gray-800 mb-4">🚫 {initial?.id ? 'Editar' : 'Criar'} Dia de Folga / Indisponível</h3>
        <label className="block text-[11px] text-gray-500 mb-1">Data</label>
        <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand-400"
          value={date} onChange={(e) => setDate(e.target.value)} autoFocus />
        <label className="block text-[11px] text-gray-500 mb-1">Motivo (opcional)</label>
        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-brand-400"
          value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Feriado, folga da equipe, chuva..." />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
          <button onClick={() => date && onSave({ type: 'day_off', date, text: reason.trim() })}
            className="px-4 py-2 text-xs text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40" disabled={!date}>
            {initial ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper de formatação de data
function formatDate(dateStr) {
  try {
    if (!dateStr) return '';
    const str = dateStr.split('T')[0];
    const [year, month, day] = str.split('-');
    if (!year || !month || !day) return '';
    return `${day}/${month}/${year}`;
  } catch { return ''; }
}

// ── Utilitários centralizados de data — todos seguros contra valores ausentes/inválidos ──
// Extrai "YYYY-MM-DD" de qualquer formato de data que vier do banco (com ou sem hora).
function toDateOnly(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const str = dateStr.split('T')[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
}

// Cria um objeto Date a partir de "YYYY-MM-DD", retornando null se inválido (nunca quebra).
function safeDate(dateOnlyStr) {
  const d = toDateOnly(dateOnlyStr);
  if (!d) return null;
  const date = new Date(d + 'T12:00:00');
  return isNaN(date.getTime()) ? null : date;
}

// Soma dias a uma data "YYYY-MM-DD" com segurança, retornando "YYYY-MM-DD" ou null.
function addDays(dateOnlyStr, days) {
  const date = safeDate(dateOnlyStr);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// Botão "+" discreto à esquerda de cada strip
function InsertBtn({ index, onInsert, nextCalendarEntry, planStartDate }) {
  const [open, setOpen] = useState(false);

  // nextCalendarEntry vem calculado de fora: { date, type } ou null se não houver calendário configurado
  const calendarOption = nextCalendarEntry
    ? (nextCalendarEntry.type === 'day_off'
        ? { type: 'day_off', label: `Dia de Folga (${formatDate(nextCalendarEntry.date)})`, icon: '🚫', forcedDate: nextCalendarEntry.date }
        : { type: 'shooting_day', label: `Dia de Filmagem (${formatDate(nextCalendarEntry.date)})`, icon: '📅', forcedDate: nextCalendarEntry.date })
    : { type: 'shooting_day', label: 'Dia de Filmagem', icon: '📅', disabled: true };

  const options = [
    calendarOption,
    { type: 'day_off_manual', label: 'Dia de Folga (manual)', icon: '🚫' },
    { type: 'banner',       label: 'Banner',            icon: '🎬' },
    { type: 'visual_ref',   label: 'Referência Visual', icon: '🖼️' },
    { type: 'map_link',     label: 'Link para Mapa',    icon: '📍' },
    { type: 'note',         label: 'Observação',         icon: '📝' },
  ];
  return (
    <div className="relative flex-shrink-0 flex items-center mr-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-5 h-5 rounded-full bg-gray-100 hover:bg-brand-500 hover:text-white text-gray-400 text-xs flex items-center justify-center transition-all"
        title="Inserir aqui">
        +
      </button>
      {open && (
        <div className="absolute left-6 top-0 bg-white border border-gray-200 rounded-xl shadow-lg z-40 py-1 min-w-[200px]"
          onMouseLeave={() => setOpen(false)}>
          {options.map((opt) => (
            <button key={opt.type}
              onClick={() => { if (!opt.disabled) { setOpen(false); onInsert(index, opt.type, opt.forcedDate); } }}
              className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors ${opt.disabled ? 'text-gray-300 cursor-not-allowed' : (opt.type === 'day_off' || opt.type === 'day_off_manual') ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-brand-50 hover:text-brand-600'}`}
              title={opt.disabled ? 'Configure o calendário do plano primeiro (botão ⚙️ Configurar Calendário)' : ''}>
              <span>{opt.icon}</span> {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente Capa do Projeto ───────────────────────────────────────────────
function CoverPage({ project, onSave, saving, saved, darkMode }) {
  const [fields, setFields] = useState({
    title:              project?.title || '',
    author:             project?.author || '',
    director:           project?.director || '',
    production_company: project?.production_company || '',
    synopsis:           project?.synopsis || '',
    whatsapp:           project?.whatsapp || '',
    email:              project?.email || '',
    link:               project?.link || '',
    shoot_start_date:   project?.shoot_start_date || '',
    shoot_end_date:     project?.shoot_end_date || '',
  });

  useEffect(() => {
    setFields({
      title:              project?.title || '',
      author:             project?.author || '',
      director:           project?.director || '',
      production_company: project?.production_company || '',
      synopsis:           project?.synopsis || '',
      whatsapp:           project?.whatsapp || '',
      email:              project?.email || '',
      link:               project?.link || '',
      shoot_start_date:   project?.shoot_start_date || '',
      shoot_end_date:     project?.shoot_end_date || '',
    });
  }, [project?.id]);

  function Field({ label, fieldKey, placeholder, multiline }) {
    return (
      <div className="mb-5">
        <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>{label}</label>
        {multiline ? (
          <textarea
            className={`w-full bg-transparent border-b focus:border-brand-400 outline-none text-sm resize-none py-1 leading-relaxed transition-colors ${darkMode ? "border-gray-600 text-gray-200" : "border-gray-200 text-gray-700"}`}
            rows={4}
            placeholder={placeholder}
            value={fields[fieldKey]}
            onChange={(e) => setFields((p) => ({ ...p, [fieldKey]: e.target.value }))}
          />
        ) : (
          <input
            className={`w-full bg-transparent border-b focus:border-brand-400 outline-none text-sm py-1 transition-colors ${darkMode ? "border-gray-600 text-gray-200" : "border-gray-200 text-gray-700"}`}
            placeholder={placeholder}
            value={fields[fieldKey]}
            onChange={(e) => setFields((p) => ({ ...p, [fieldKey]: e.target.value }))}
          />
        )}
      </div>
    );
  }

  return (
    <div className="fade-in max-w-2xl mx-auto">
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100"}`}>
        {/* Faixa decorativa no topo */}
        <div className="h-2 bg-brand-500" />

        <div className="px-10 py-10">
          {/* Título grande */}
          <div className="mb-8 text-center">
            <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-2 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>Título</label>
            <input
              className={`w-full text-center text-2xl font-bold bg-transparent border-b-2 focus:border-brand-400 outline-none pb-2 transition-colors ${darkMode ? "text-white border-gray-600" : "text-gray-900 border-gray-200"}`}
              placeholder="Título do projeto"
              value={fields.title}
              onChange={(e) => setFields((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          {/* Sinopse */}
          <div className={`mb-8 pb-8 border-b ${darkMode ? "border-gray-700" : "border-gray-100"}`}>
            <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-2 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>Sinopse</label>
            <textarea
              className={`w-full bg-transparent border-b focus:border-brand-400 outline-none text-sm resize-none py-1 leading-relaxed transition-colors italic ${darkMode ? "border-gray-600 text-gray-300" : "border-gray-200 text-gray-600"}`}
              rows={4}
              placeholder="Uma breve sinopse do projeto..."
              value={fields.synopsis}
              onChange={(e) => setFields((p) => ({ ...p, synopsis: e.target.value }))}
            />
          </div>

          {/* Grid de fichas técnicas */}
          <div className="grid grid-cols-2 gap-x-8">
            <div>
              <Field label="Roteirista" fieldKey="author" placeholder="Nome do roteirista" />
              <Field label="Diretor" fieldKey="director" placeholder="Nome do diretor" />
              <Field label="Produtora" fieldKey="production_company" placeholder="Nome da produtora" />
            </div>
            <div>
              <Field label="WhatsApp" fieldKey="whatsapp" placeholder="+55 (11) 99999-9999" />
              <Field label="E-mail" fieldKey="email" placeholder="contato@email.com" />
              <Field label="Link" fieldKey="link" placeholder="https://..." />
            </div>
          </div>

          {/* Botão salvar */}
          <div className="mt-8 flex justify-end items-center gap-3">
            {saved && <span className="text-xs text-green-500">✓ Salvo!</span>}
            <button
              onClick={() => onSave(fields)}
              disabled={saving}
              className="px-6 py-2 bg-brand-500 text-white text-xs font-semibold rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Rodapé decorativo */}
        <div className={`px-10 py-4 border-t flex items-center justify-between ${darkMode ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"}`}>
          <span className="text-[10px] text-gray-300 uppercase tracking-widest">Breakdown · {project?.year || new Date().getFullYear()}</span>
          <span className="text-[10px] text-gray-300">{project?.total_scenes || 0} cenas</span>
        </div>
      </div>
    </div>
  );
}

// ── Componente Stripboard ────────────────────────────────────────────────────
function Stripboard({ scenes, onScenesChange, projectId, project, darkMode, projectColors, onOpenColorConfig, activePlanId, setActivePlanId, plans, setPlans, items, setItemsRaw, onOpenBreakdown }) {
  // Lista unificada: cada item tem { id, kind: 'scene'|'item'|'day', data } — vem de fora agora (ProjectPage),
  // pra que os Relatórios consigam ler exatamente os mesmos dados em memória, sem depender
  // de re-buscar do banco (que pode não ter terminado de salvar ainda).

  // Wrapper que substitui setItems em TODO o componente: toda vez que a lista muda,
  // sincroniza IMEDIATAMENTE com o banco — sem debounce, sem espera, sem depender
  // de trocar de aba. Aceita tanto um valor direto quanto uma função updater (como o setState normal).
  function setItems(updater) {
    setItemsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      syncDayScenesToDatabase(next);
      return next;
    });
  }

  const [loaded, setLoaded] = useState(false);
  const [editingPlanName, setEditingPlanName] = useState(null);
  const [planNameValue, setPlanNameValue] = useState('');

  // UI
  // groupByLocation removido — agora é uma ação de reorganizar a lista
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [insertModal, setInsertModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showCalendarConfig, setShowCalendarConfig] = useState(false);
  const [planCalendar, setPlanCalendar] = useState(null);
  const [hasGrouped, setHasGrouped] = useState(false);
  const [history, setHistory] = useState([]);   // histórico de estados anteriores
  const [future, setFuture] = useState([]);      // estados para refazer

  const listRef = useRef(null);
  const overIndexRef = useRef(null);
  useEffect(() => { overIndexRef.current = overIndex; }, [overIndex]);

  const ORIGINAL_ID = '__original__';

  // ── Monta lista inicial de scenes ───────────────────────────────────────
  useEffect(() => {
    if (scenes.length === 0) return;
    setItems(scenes.map((s) => ({ id: s.id, kind: 'scene', data: s })));
    setLoaded(true);
  }, [scenes.length]);

  // ── Ao trocar plano, recarrega a lista ──────────────────────────────────
  async function loadPlan(planId) {
    setHasGrouped(false);
    setHistory([]);
    setFuture([]);
    setPlanCalendar(null);
    if (planId === ORIGINAL_ID) {
      const list = scenes.map((s) => ({ id: s.id, kind: 'scene', data: s }));
      setItems(list);
      return list;
    }
    const [itemsRes, daysRes, calRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/strip-items?plan_id=${planId}`).then(r => r.json()).catch(() => ({ items: [] })),
      fetch(`/api/projects/${projectId}/shooting-days?plan_id=${planId}`).then(r => r.json()).catch(() => ({ days: [] })),
      fetch(`/api/projects/${projectId}/shooting-plans/${planId}/calendar`).then(r => r.json()).catch(() => ({ calendar: null })),
    ]);
    setPlanCalendar(calRes.calendar || null);
    const plan = plans.find(p => p.id === planId);
    const sceneOrder = plan?.scene_order?.length > 0 ? plan.scene_order : scenes.map(s => s.id);
    const sceneItems = sceneOrder.map(id => scenes.find(s => s.id === id)).filter(Boolean).map(s => ({ id: s.id, kind: 'scene', data: s }));
    const extras = [
      ...(itemsRes.items || []).map(x => ({ id: x.id, kind: 'item', data: x, pos: x.position ?? 0 })),
      ...(daysRes.days || []).map(x => ({ id: x.id, kind: 'day', data: x, pos: x.position ?? 0 })),
    ].sort((a, b) => a.pos - b.pos);
    const unified = [...sceneItems];
    extras.forEach(({ id, kind, data, pos }) => {
      unified.splice(Math.min(pos, unified.length), 0, { id, kind, data });
    });
    setItems(unified);
    // Sincroniza automaticamente ao carregar — sem precisar arrastar nada
    syncDayScenesToDatabase(unified);
    return unified;
  }

  useEffect(() => {
    if (!activePlanId) return;
    if (activePlanId !== ORIGINAL_ID && plans.length === 0) return;
    loadPlan(activePlanId);
  }, [activePlanId, plans.length]);

  // ── Drag & Drop unificado ────────────────────────────────────────────────
  function saveToHistory(currentItems) {
    setHistory(prev => [...prev, currentItems]);
    setFuture([]); // limpa o futuro ao fazer nova ação
  }

  function undo() {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      const last = newHistory.pop();
      setFuture(f => [items, ...f]);
      setItems(last);
      return newHistory;
    });
  }

  function redo() {
    setFuture(prev => {
      if (prev.length === 0) return prev;
      const newFuture = [...prev];
      const next = newFuture.shift();
      setHistory(h => [...h, items]);
      setItems(next);
      return newFuture;
    });
  }

  // Recalcula e salva no banco quais cenas pertencem a cada dia, baseado na ordem atual da lista.
  // Chamado sempre que algo é arrastado, pra manter scene_ids sempre correto.
  async function syncDayScenesToDatabase(list) {
    let currentDay = null;
    let currentSceneIds = [];

    async function flush() {
      if (currentDay) {
        await fetch(`/api/projects/${projectId}/shooting-days/${currentDay.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scene_ids: currentSceneIds }),
        });
      }
    }

    for (const item of list) {
      if (item.kind === 'day') {
        await flush();
        currentDay = item.data;
        currentSceneIds = [];
      } else if (item.kind === 'scene' && currentDay) {
        currentSceneIds.push(item.data.id);
      }
      // item.kind === 'item' (banner, day_off etc) não interrompe a contagem do dia atual
    }
    await flush();
  }

  const handleMouseDown = useCallback((e, id) => {
    if (activePlanId === ORIGINAL_ID) return;
    e.preventDefault();
    setDraggingId(id);
    let snapshotSaved = false;

    function onMouseMove(ev) {
      if (!listRef.current) return;
      const rows = listRef.current.querySelectorAll('[data-idx]');
      let target = 0;
      rows.forEach(row => {
        const rect = row.getBoundingClientRect();
        if (ev.clientY > rect.top + rect.height / 2) target = parseInt(row.dataset.idx) + 1;
      });
      setOverIndex(target);
    }

    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const target = overIndexRef.current;
      if (target !== null) {
        setItems(prev => {
          const list = [...prev];
          const from = list.findIndex(x => x.id === id);
          if (from === -1) return prev;
          const to = Math.min(target > from ? target - 1 : target, list.length);
          if (from === to) return prev;
          saveToHistory(list);
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved);
          syncDayScenesToDatabase(list);
          return list;
        });
      }
      setDraggingId(null);
      setOverIndex(null);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [activePlanId, items]);

  // ── Computed: lista visível ──────────────────────────────────────────────
  // Função que reorganiza items agrupando por locação (ação, não estado)
  function normalizeLocation(loc, set) {
    const l = (loc || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const s = (set || '').trim().toUpperCase().replace(/\s+/g, ' ');
    return s ? l + ' / ' + s : l;
  }

  function groupItemsByLocation() {
    if (hasGrouped) {
      alert('Você já agrupou este plano por locação.\n\nPara fazer um novo agrupamento, duplique o Original e crie um novo plano — assim você não perde o trabalho já feito.');
      return;
    }
    saveToHistory(items);
    setItems(prev => {
      const extras = prev.filter(x => x.kind !== 'scene');
      const scenes = prev.filter(x => x.kind === 'scene').map(item => ({
        ...item,
        data: {
          ...item.data,
          location: (item.data.location || '').trim().toUpperCase().replace(/\s+/g, ' '),
          set_name: (item.data.set_name || '').trim().toUpperCase().replace(/\s+/g, ' '),
        }
      }));
      const groups = {};
      scenes.forEach(item => {
        const key = (item.data.location || '').trim().toUpperCase().replace(/\s+/g, ' ');
        if (!groups[key]) groups[key] = [];
        groups[key].push(item);
      });
      const grouped = [...Object.values(groups).flat(), ...extras];
      return grouped;
    });
    setHasGrouped(true);
  }

  const visibleItems = items;

  // ── Inserir novo item ────────────────────────────────────────────────────
  async function insertAt(index, type, vals) {
    if (type === 'shooting_day') {
      const date = vals?.forcedDate;
      if (!date) return;

      // Cenas que pertencem a este dia = cenas APÓS este dia e ANTES do próximo dia/folga
      // (apenas para referência visual na OD depois — o AD decide manualmente quais cenas ficam aqui)
      const currentItems = [...items];
      const itemsAfter = currentItems.slice(index);
      const nextBreakOffset = itemsAfter.findIndex(x => x.kind === 'day' || (x.kind === 'item' && x.data.type === 'day_off'));
      const sliceEnd = nextBreakOffset === -1 ? itemsAfter.length : nextBreakOffset;
      const scenesBelow = itemsAfter.slice(0, sliceEnd)
        .filter(x => x.kind === 'scene')
        .map(x => x.data.id);

      const res = await fetch(`/api/projects/${projectId}/shooting-days`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, position: index, plan_id: activePlanId === ORIGINAL_ID ? null : activePlanId, scene_ids: scenesBelow }),
      });
      const d = await res.json();
      if (res.ok) {
        const newItem = { id: d.id, kind: 'day', data: { id: d.id, date, position: index, scene_ids: scenesBelow } };
        setItems(prev => {
          const list = [...prev];
          list.splice(Math.min(index, list.length), 0, newItem);
          return list;
        });
      }
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/strip-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...vals, position: index, plan_id: activePlanId === ORIGINAL_ID ? null : activePlanId }),
    });
    const d = await res.json();
    const newItem = { id: d.id, kind: 'item', data: { id: d.id, position: index, type, ...vals } };
    setItems(prev => {
      const list = [...prev];
      list.splice(Math.min(index, list.length), 0, newItem);
      return list;
    });
    setInsertModal(null);
  }

  // Empurra todas as datas (dias de filmagem e folgas) que vêm depois de uma posição, em +1 dia
  async function realignDatesAfter(afterIndex, fromDate) {
    let cursor = addDays(fromDate, 1);
    if (!cursor) return; // data inválida — não quebra a tela, simplesmente não faz nada

    const updated = [...items];
    for (let i = afterIndex + 1; i < updated.length; i++) {
      const it = updated[i];
      if (it.kind === 'day') {
        await fetch(`/api/projects/${projectId}/shooting-days/${it.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: cursor }),
        });
        updated[i] = { ...it, data: { ...it.data, date: cursor } };
        cursor = addDays(cursor, 1);
        if (!cursor) break;
      } else if (it.kind === 'item' && it.data.type === 'day_off') {
        await fetch(`/api/projects/${projectId}/strip-items/${it.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...it.data, date: cursor }),
        });
        updated[i] = { ...it, data: { ...it.data, date: cursor } };
        cursor = addDays(cursor, 1);
        if (!cursor) break;
      }
    }
    setItems(updated);
  }

  function confirmAndRealign(index, date) {
    realignDatesAfter(index, date);
    return true;
  }

  // ── Deletar item ─────────────────────────────────────────────────────────
  async function deleteExtra(item) {
    if (item.kind === 'day') {
      await fetch(`/api/projects/${projectId}/shooting-days/${item.id}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/projects/${projectId}/strip-items/${item.id}`, { method: 'DELETE' });
    }
    setItems(prev => prev.filter(x => x.id !== item.id));
  }

  // ── Edição inline de cenas ───────────────────────────────────────────────
  function startEdit(scene, field) {
    const val = field === 'characters' ? (scene.characters || []).join(', ') : (scene[field] ?? '');
    setEditingCell({ id: scene.id, field });
    setEditValue(String(val));
  }

  async function commitEdit(scene, field) {
    setEditingCell(null);
    const newVal = field === 'characters' ? editValue.split(',').map(s => s.trim()).filter(Boolean) : editValue;
    onScenesChange(prev => prev.map(s => s.id === scene.id ? { ...s, [field]: newVal } : s));
    setItems(prev => prev.map(x => x.id === scene.id ? { ...x, data: { ...x.data, [field]: newVal } } : x));
    setSaving(p => ({ ...p, [scene.id]: true }));
    try {
      await fetch(`/api/projects/${projectId}/scenes/${scene.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newVal }),
      });
    } catch (e) { console.error(e); }
    finally { setSaving(p => ({ ...p, [scene.id]: false })); }
  }

  // ── Planos ───────────────────────────────────────────────────────────────
  async function duplicatePlan() {
    if (plans.length >= 3) {
      alert('Limite de 3 planos por projeto (Plano A, B e C). Apague um plano existente para criar um novo.');
      return;
    }
    const names = ['Plano A','Plano B','Plano C'];
    const name = names[plans.length] || `Plano ${plans.length + 1}`;
    const sceneOrder = scenes.map(s => s.id);
    const res = await fetch(`/api/projects/${projectId}/shooting-plans`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scene_order: sceneOrder }),
    });
    const d = await res.json();
    const newPlan = { id: d.id, name, scene_order: sceneOrder };
    setPlans(prev => [...prev, newPlan]);
    setActivePlanId(d.id);
    setPlanCalendar(null);
    setShowCalendarConfig(true);
  }

  // Aplica a configuração de calendário: gera os dias de filmagem + folgas automaticamente
  async function applyCalendar(config) {
    setShowCalendarConfig(false);
    await fetch(`/api/projects/${projectId}/shooting-plans/${activePlanId}/calendar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    setPlanCalendar(config);
  }

  // Gera a sequência de datas do calendário (filmagem ou folga), sem se preocupar com cenas.
  // Usado pelo InsertBtn pra saber: "qual é a próxima data e ela é filmagem ou folga?"
  function getCalendarSequence() {
    const startDate = toDateOnly(planCalendar?.start_date);
    if (!startDate) return []; // sem calendário configurado ou data inválida — lista vazia, sem quebrar

    const offEvery = planCalendar.off_every || 0;

    // Percorre os itens JÁ inseridos na ordem real do Stripboard, simulando a contagem de "worked"
    // para saber corretamente em que ponto da sequência estamos.
    let worked = 0;
    let lastDate = null;
    items.forEach(it => {
      if (it.kind === 'day') {
        worked++;
        const d = toDateOnly(it.data.date);
        if (d) lastDate = d;
      } else if (it.kind === 'item' && it.data.type === 'day_off') {
        worked = 0; // reseta a contagem após a folga
        const d = toDateOnly(it.data.date);
        if (d) lastDate = d;
      }
    });

    // Próxima data: dia seguinte à última data inserida, ou a data de início se nada foi inserido ainda
    let nextDate = lastDate ? addDays(lastDate, 1) : startDate;
    if (!nextDate) return [];

    const sequence = [];
    let w = worked;
    for (let i = 0; i < 5; i++) {
      if (!nextDate) break;
      const isOff = offEvery > 0 && w > 0 && w % offEvery === 0;
      sequence.push({ date: nextDate, type: isOff ? 'day_off' : 'shooting_day' });
      if (isOff) { w = 0; } else { w++; }
      nextDate = addDays(nextDate, 1);
    }
    return sequence;
  }

  async function renamePlan(planId, name) {
    await fetch(`/api/projects/${projectId}/shooting-plans/${planId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, name } : p));
    setEditingPlanName(null);
  }

  async function deletePlan(planId) {
    await fetch(`/api/projects/${projectId}/shooting-plans/${planId}`, { method: 'DELETE' });
    const remaining = plans.filter(p => p.id !== planId);
    setPlans(remaining);
    // Se era o último plano, volta para o Original
    if (remaining.length === 0) {
      setActivePlanId(ORIGINAL_ID);
      setItems(scenes.map(s => ({ id: s.id, kind: 'scene', data: s })));
    } else {
      setActivePlanId(remaining[0].id);
    }
  }

  // ── Renderização de cada linha ────────────────────────────────────────────
  function renderRow(item, i) {
    const isDragging = draggingId === item.id;
    const showPlaceholder = draggingId && !isDragging && overIndex === i;
    const isOriginal = activePlanId === ORIGINAL_ID;

    const placeholder = showPlaceholder ? (
      <div className={`flex items-stretch rounded-lg overflow-hidden border-2 border-dashed h-12 mb-1 opacity-70 ${darkMode ? 'border-blue-500 bg-gray-700' : 'border-blue-300 bg-blue-50'}`}>
        <div className="w-5 flex-shrink-0" /><div className={`w-10 flex-shrink-0 ${darkMode ? 'bg-gray-600' : 'bg-blue-100'}`} />
        <div className={`flex-1 px-3 flex items-center ${darkMode ? 'bg-gray-700' : 'bg-blue-50'}`}><div className={`h-2 w-32 rounded ${darkMode ? 'bg-gray-500' : 'bg-blue-200'}`} /></div>
      </div>
    ) : null;

    if (item.kind === 'day') {
      return (
        <div key={item.id} data-idx={i}>
          {placeholder}
          <div className="relative flex items-stretch mb-1">
            {!isOriginal && (
              <div onMouseDown={e => handleMouseDown(e, item.id)}
                className="w-5 flex-shrink-0 flex items-center justify-center cursor-grab text-green-400 text-[10px]">⠿</div>
            )}
            <div className="flex-1 flex items-stretch rounded-lg overflow-hidden border border-green-200 bg-green-50 h-9 select-none"
              style={{ opacity: isDragging ? 0.3 : 1 }}>
              <div className="w-10 flex items-center justify-center bg-green-500 text-white text-sm flex-shrink-0">📅</div>
              <div className="flex-1 flex items-center px-3 gap-2">
                <span className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Dia de Filmagem</span>
                <span className="text-xs text-green-600 font-semibold">{formatDate(toDateOnly(item.data.date))}</span>
              </div>
              {!isOriginal && (
                <button onClick={() => deleteExtra(item)} className="px-3 text-green-300 hover:text-red-400 text-xs">✕</button>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (item.kind === 'item' && item.data.type === 'day_off') {
      const d = item.data;
      return (
        <div key={item.id} data-idx={i}>
          {placeholder}
          <div className="relative flex items-stretch mb-1">
            {!isOriginal && (
              <div onMouseDown={e => handleMouseDown(e, item.id)}
                className="w-5 flex-shrink-0 flex items-center justify-center cursor-grab text-gray-400 text-[10px]">⠿</div>
            )}
            <div className={`flex-1 flex items-stretch rounded-lg overflow-hidden border h-9 select-none ${darkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-100'}`}
              style={{ opacity: isDragging ? 0.3 : 1, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(120,120,120,0.08) 8px, rgba(120,120,120,0.08) 16px)' }}>
              <div className="w-10 flex items-center justify-center bg-gray-500 text-white text-sm flex-shrink-0">🚫</div>
              <div className="flex-1 flex items-center px-3 gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wide ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Dia de Folga / Indisponível</span>
                <span className={`text-xs font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{formatDate(toDateOnly(d.date))}</span>
                {d.text && <span className={`text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>· {d.text}</span>}
              </div>
              {!isOriginal && (
                <>
                  <button onClick={() => setEditingItem(d)} className={`px-2 text-xs ${darkMode ? 'text-gray-500 hover:text-brand-400' : 'text-gray-400 hover:text-brand-500'}`}>✏️</button>
                  <button onClick={() => deleteExtra(item)} className={`px-3 text-xs ${darkMode ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-400'}`}>✕</button>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (item.kind === 'item') {
      const d = item.data;
      const visual = {
        banner:     { bg: d.bg_color || '#185FA5', color: d.text_color || '#fff', icon: '🎬' },
        visual_ref: { bg: '#f3f4f6', color: '#374151', icon: '🖼️' },
        map_link:   { bg: '#ecfdf5', color: '#065f46', icon: '📍' },
        note:       { bg: '#fefce8', color: '#713f12', icon: '📝' },
      }[d.type] || { bg: '#f3f4f6', color: '#374151', icon: '📌' };
      return (
        <div key={item.id} data-idx={i}>
          {placeholder}
          <div className="relative flex items-stretch mb-1">
            {!isOriginal && (
              <div onMouseDown={e => handleMouseDown(e, item.id)}
                className="w-5 flex-shrink-0 flex items-center justify-center cursor-grab text-gray-300 text-[10px]">⠿</div>
            )}
            <div className="flex-1 flex items-stretch rounded-lg overflow-hidden h-9 select-none border"
              style={{ borderColor: visual.bg, opacity: isDragging ? 0.3 : 1 }}>
              <div className="w-10 flex items-center justify-center flex-shrink-0 text-sm" style={{ background: visual.bg }}>{visual.icon}</div>
              <div className="flex-1 flex items-center px-3" style={{ background: visual.bg }}>
                {d.type === 'banner' ? (
                  <span style={{ fontFamily: d.font_family, fontSize: (d.font_size || 14) + 'px', color: visual.color, fontWeight: 'bold' }}>{d.text}</span>
                ) : d.url ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline truncate" style={{ color: visual.color }}>{d.text}</a>
                ) : (
                  <span className="text-xs truncate" style={{ color: visual.color }}>{d.text}</span>
                )}
              </div>
              {!isOriginal && (
                <div className="flex items-center gap-1 px-2" style={{ background: visual.bg }}>
                  <button onClick={() => setEditingItem(item.data)} className="text-[10px] px-1 hover:opacity-70" style={{ color: visual.color }}>✏️</button>
                  <button onClick={() => deleteExtra(item)} className="text-[10px] px-1 hover:opacity-70" style={{ color: visual.color }}>✕</button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Scene
    const s = item.data;
    const periodColors = {
      DIA: darkMode ? 'bg-amber-950 text-amber-300' : 'bg-amber-50 text-amber-700',
      NOITE: darkMode ? 'bg-indigo-950 text-indigo-300' : 'bg-indigo-50 text-indigo-700',
      'MANHÃ': darkMode ? 'bg-blue-950 text-blue-300' : 'bg-blue-50 text-blue-700',
      TARDE: darkMode ? 'bg-green-950 text-green-300' : 'bg-green-50 text-green-700',
      'FIM DE TARDE': darkMode ? 'bg-orange-950 text-orange-300' : 'bg-orange-50 text-orange-700',
    };
    const dnClass = periodColors[s.day_night] || (darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600');
    const dnL = { DIA:'D', NOITE:'N', 'MANHÃ':'M', TARDE:'T', 'FIM DE TARDE':'FT' }[s.day_night] || 'D';
    const isEditing = field => editingCell?.id === s.id && editingCell?.field === field;

    return (
      <div key={item.id} data-idx={i}>
        {placeholder}
        <div className="relative flex items-stretch mb-1">
          {!isOriginal && (
            <InsertBtn index={i} onInsert={(idx, type, forcedDate) => {
              if (type === 'shooting_day') { insertAt(idx, 'shooting_day', { forcedDate }); }
              else if (type === 'day_off') { insertAt(idx, 'day_off', { date: forcedDate, text: '' }); confirmAndRealign(idx, forcedDate); }
              else if (type === 'day_off_manual') {
                const nextDate = getCalendarSequence()[0]?.date;
                if (nextDate) { insertAt(idx, 'day_off', { date: nextDate, text: '' }); confirmAndRealign(idx, nextDate); }
              }
              else setInsertModal({ index: idx, type });
            }} nextCalendarEntry={getCalendarSequence()[0] || null} />
          )}
          <div className={`flex-1 flex items-stretch rounded-lg overflow-hidden border h-12 hover:shadow-sm transition-all select-none cursor-grab active:cursor-grabbing ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
            style={{ opacity: isDragging ? 0.3 : saving[s.id] ? 0.6 : 1 }}
            onDoubleClick={() => onOpenBreakdown && onOpenBreakdown(s)}>
            <div onMouseDown={!isOriginal ? e => handleMouseDown(e, item.id) : undefined}
              className={`w-7 flex items-center justify-center text-[11px] font-semibold flex-shrink-0 ${!isOriginal ? 'cursor-grab active:cursor-grabbing' : ''} ${s.is_flashback ? 'text-purple-500' : (darkMode ? 'text-gray-200' : 'text-gray-700')} ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              {s.scene_number}
            </div>
            <div className={`px-2 flex items-center justify-center flex-shrink-0 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <CompactIEPeriod intExt={s.int_ext} dayNight={s.day_night} darkMode={darkMode} />
            </div>
            <div className={`flex-1 px-3 flex flex-col justify-center overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className={`text-[11px] font-semibold truncate ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                {s.is_flashback ? '[FB] ' : ''}{s.int_ext} · {s.location}{s.set_name ? ' / ' + s.set_name : ''}
              </div>
              <div className={`text-[10px] truncate ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
                {s.synopsis}
              </div>
            </div>
            <div className={`w-28 border-l px-2 flex items-center ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
              <span className={`text-[10px] truncate ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                {(s.characters || []).slice(0,3).join(', ')}{(s.characters||[]).length > 3 ? '…' : ''}
              </span>
            </div>
            <div className={`w-12 border-l flex items-center justify-end px-2 ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
              <span className={`text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-300'}`}>{s.estimated_pages}p</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) return <div className={`text-center text-sm py-10 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Carregando...</div>;

  return (
    <div className={`fade-in ${darkMode ? "text-gray-100" : ""}`}>
      {/* Abas de planos */}
      <div className={`flex items-center gap-1 mb-3 border-b flex-wrap ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className={`group relative flex items-center gap-1.5 px-3 py-2 text-xs rounded-t-lg border-b-2 cursor-pointer transition-all ${activePlanId === ORIGINAL_ID ? (darkMode ? 'border-gray-400 text-gray-100 font-semibold' : 'border-gray-500 text-gray-700 font-semibold') : (darkMode ? 'border-transparent text-gray-500 hover:text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-600')}`}
          onClick={() => setActivePlanId(ORIGINAL_ID)}>
          🔒 Original
          {activePlanId === ORIGINAL_ID && plans.length < 3 && (
            <button onClick={e => { e.stopPropagation(); duplicatePlan(); }}
              className={`ml-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${darkMode ? 'bg-gray-800 hover:bg-brand-500 hover:text-white text-gray-300' : 'bg-gray-100 hover:bg-brand-500 hover:text-white text-gray-500'}`}>
              + Duplicar
            </button>
          )}
        </div>
        <div className={`w-px h-5 mx-1 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
        {plans.map(plan => (
          <div key={plan.id} className={`group relative flex items-center gap-1 px-3 py-2 text-xs rounded-t-lg border-b-2 cursor-pointer transition-all ${activePlanId === plan.id ? 'border-brand-500 text-brand-500 font-semibold' : (darkMode ? 'border-transparent text-gray-500 hover:text-gray-300' : 'border-transparent text-gray-400 hover:text-gray-600')}`}
            onClick={() => setActivePlanId(plan.id)}>
            {editingPlanName === plan.id ? (
              <input autoFocus className="w-20 outline-none border-b border-brand-400 bg-transparent text-xs font-semibold"
                value={planNameValue} onChange={e => setPlanNameValue(e.target.value)}
                onBlur={() => renamePlan(plan.id, planNameValue || plan.name)}
                onKeyDown={e => { if (e.key === 'Enter') renamePlan(plan.id, planNameValue || plan.name); if (e.key === 'Escape') setEditingPlanName(null); }}
                onClick={e => e.stopPropagation()} />
            ) : (
              <span onDoubleClick={e => { e.stopPropagation(); setEditingPlanName(plan.id); setPlanNameValue(plan.name); }}>{plan.name}</span>
            )}
            {activePlanId === plan.id && (
              <button onClick={e => { e.stopPropagation(); if (window.confirm(`Deletar "${plan.name}"?`)) deletePlan(plan.id); }}
                className={`ml-1 opacity-0 group-hover:opacity-100 text-[10px] transition-colors ${darkMode ? 'text-gray-600 hover:text-red-400' : 'text-gray-300 hover:text-red-400'}`}>✕</button>
            )}
          </div>
        ))}
      </div>

      {/* Barra de ações — agrupada por contexto: plano à esquerda, documento à direita */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {activePlanId !== ORIGINAL_ID && (
            <>
              <button onClick={() => setShowCalendarConfig(true)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-brand-400 hover:text-brand-400' : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-500'}`}>
                📅 Calendário
              </button>
              <button onClick={groupItemsByLocation}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${hasGrouped ? (darkMode ? 'border-gray-700 bg-gray-800 text-gray-600 cursor-not-allowed' : 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed') : (darkMode ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-brand-400 hover:text-brand-400' : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-500')}`}
                title={hasGrouped ? 'Já agrupado — duplique o Original para criar um novo agrupamento' : 'Agrupa as cenas por locação — depois arraste livremente'}>
                📍 Agrupar por locação {hasGrouped ? '✓' : ''}
              </button>
              <div className={`w-px h-5 mx-0.5 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
              <button onClick={undo} disabled={history.length === 0}
                className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed ${darkMode ? 'border-gray-700 text-gray-400 hover:text-brand-400 hover:border-brand-400' : 'border-gray-200 text-gray-400 hover:text-brand-500 hover:border-brand-300'}`}
                title="Desfazer">↩</button>
              <button onClick={redo} disabled={future.length === 0}
                className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed ${darkMode ? 'border-gray-700 text-gray-400 hover:text-brand-400 hover:border-brand-400' : 'border-gray-200 text-gray-400 hover:text-brand-500 hover:border-brand-300'}`}
                title="Refazer">↪</button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenColorConfig && (
            <button onClick={onOpenColorConfig}
              className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors text-sm ${darkMode ? 'border-gray-700 text-gray-400 hover:text-brand-400 hover:border-brand-400' : 'border-gray-200 text-gray-400 hover:text-brand-500 hover:border-brand-300'}`}
              title="Personalizar cores">
              🎨
            </button>
          )}
          <button onClick={() => {
            const plan = activePlanId === ORIGINAL_ID ? null : plans.find(p => p.id === activePlanId);
            exportStripboardPDF(visibleItems, project, plan?.name || 'Original');
          }}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-brand-400 hover:text-brand-400' : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-500'}`}>
            📄 Exportar PDF
          </button>
        </div>
      </div>

      {activePlanId !== ORIGINAL_ID && (
        <p className={`text-[10px] mb-3 ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>Arraste pelo número · clique no texto para editar</p>
      )}

      {/* Lista */}
      <div ref={listRef}>
        {visibleItems.map((item, i) => renderRow(item, i))}
        {/* Placeholder no final */}
        {draggingId && overIndex === visibleItems.length && (
          <div className="flex items-stretch rounded-lg overflow-hidden border-2 border-dashed border-blue-300 h-12 bg-blue-50 opacity-70">
            <div className="w-5 flex-shrink-0" /><div className="w-10 bg-blue-100 flex-shrink-0" />
            <div className="flex-1 bg-blue-50 px-3 flex items-center"><div className="h-2 w-32 bg-blue-200 rounded" /></div>
          </div>
        )}
      </div>

      {/* Modais */}
      {showCalendarConfig && (
        <CalendarConfigModal initial={planCalendar} onSave={applyCalendar} onClose={() => setShowCalendarConfig(false)} />
      )}
      {insertModal?.type === 'banner' && (
        <BannerModal onSave={vals => insertAt(insertModal.index, 'banner', vals)} onClose={() => setInsertModal(null)} />
      )}
      {insertModal?.type === 'day_off' && (
        <DayOffModal onSave={vals => {
          insertAt(insertModal.index, 'day_off', vals);
          confirmAndRealign(insertModal.index, vals.date);
        }} onClose={() => setInsertModal(null)} />
      )}
      {insertModal && !['banner','shooting_day','day_off','day_off_manual'].includes(insertModal.type) && (
        <SimpleItemModal type={insertModal.type} onSave={vals => insertAt(insertModal.index, insertModal.type, vals)} onClose={() => setInsertModal(null)} />
      )}
      {editingItem?.type === 'banner' && (
        <BannerModal initial={editingItem} onSave={async vals => {
          await fetch(`/api/projects/${projectId}/strip-items/${editingItem.id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(vals) });
          setItems(prev => prev.map(x => x.id === editingItem.id ? { ...x, data: { ...x.data, ...vals } } : x));
          setEditingItem(null);
        }} onClose={() => setEditingItem(null)} />
      )}
      {editingItem?.type === 'day_off' && (
        <DayOffModal initial={editingItem} onSave={async vals => {
          await fetch(`/api/projects/${projectId}/strip-items/${editingItem.id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(vals) });
          const idx = items.findIndex(x => x.id === editingItem.id);
          setItems(prev => prev.map(x => x.id === editingItem.id ? { ...x, data: { ...x.data, ...vals } } : x));
          setEditingItem(null);
          if (idx !== -1) confirmAndRealign(idx, vals.date);
        }} onClose={() => setEditingItem(null)} />
      )}
      {editingItem && !['banner','day_off'].includes(editingItem.type) && (
        <SimpleItemModal type={editingItem.type} initial={editingItem} onSave={async vals => {
          await fetch(`/api/projects/${projectId}/strip-items/${editingItem.id}`, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify(vals) });
          setItems(prev => prev.map(x => x.id === editingItem.id ? { ...x, data: { ...x.data, ...vals } } : x));
          setEditingItem(null);
        }} onClose={() => setEditingItem(null)} />
      )}
    </div>
  );
}

function findSceneTextInScript(rawText, scene) {
  if (!rawText || typeof rawText !== 'string') return null;
  const lines = rawText.split('\n');
  let startIdx = -1;

  // Monta termos de busca — partes da locação
  const locParts = [
    scene.set_name,
    scene.location,
  ].filter(Boolean).join(' / ').toUpperCase();

  // Palavras-chave da locação (ignora palavras curtas)
  const keywords = locParts.split(/[\s\/\-]+/).filter(w => w.length > 3);

  for (let i = 0; i < lines.length; i++) {
    const lineUpper = lines[i].toUpperCase();
    const isSlug = lineUpper.includes('INT') || lineUpper.includes('EXT');
    if (!isSlug) continue;

    // Verifica se pelo menos uma keyword da locação está na linha
    const matches = keywords.length === 0 || keywords.some(kw => lineUpper.includes(kw));
    if (matches) {
      // Verifica número de cena se disponível
      const sceneNum = String(scene.scene_number || '');
      if (sceneNum && !lineUpper.includes(sceneNum) && !lines[i].trim().startsWith(sceneNum)) {
        // Tenta a próxima linha com essa locação
        continue;
      }
      startIdx = i;
      break;
    }
  }

  // Segunda tentativa — sem verificar número de cena
  if (startIdx === -1) {
    for (let i = 0; i < lines.length; i++) {
      const lineUpper = lines[i].toUpperCase();
      const isSlug = lineUpper.includes('INT') || lineUpper.includes('EXT');
      if (!isSlug) continue;
      const matches = keywords.length === 0 || keywords.some(kw => lineUpper.includes(kw));
      if (matches) { startIdx = i; break; }
    }
  }

  if (startIdx === -1) return `[Texto não encontrado para: ${scene.int_ext} · ${scene.location}]`;

  // Encontra o fim da cena
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length && i < startIdx + 200; i++) {
    const t = lines[i].trim().toUpperCase();
    if (t.length > 5 && (
      t.startsWith('INT.') || t.startsWith('EXT.') || t.startsWith('INT/EXT') ||
      /^\d+\s+(INT|EXT)/.test(t) || /^(INT|EXT)\s*\./.test(t)
    )) { endIdx = i; break; }
  }

  return lines.slice(startIdx, endIdx).join('\n').trim();
}


function RawTextUploader({ projectId, darkMode: dm, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function extractPDF(file) {
    // Carrega pdfjs se necessário
    await new Promise((resolve, reject) => {
      if (window.pdfjsLib) { resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(' ') + '\n';
    }
    return text;
  }

  async function handleFile(file) {
    setUploading(true);
    setError('');
    try {
      let text = '';
      if (file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractPDF(file);
      } else {
        text = await file.text();
      }
      if (!text || text.trim().length < 50) {
        throw new Error('Não foi possível extrair texto do PDF. Tente um arquivo .txt.');
      }
      const r = await fetch(`/api/projects/${projectId}/raw-text`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: text }),
      });
      if (!r.ok) throw new Error('Erro ao salvar no banco.');
      setDone(true);
      onUploaded && onUploaded(text);
      setTimeout(() => window.location.reload(), 1200);
    } catch(e) {
      setError(e.message);
    } finally { setUploading(false); }
  }

  return (
    <div className={`border-2 border-dashed rounded-xl p-8 text-center ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
      <p className="text-3xl mb-3">📄</p>
      <p className={`text-sm font-medium mb-1 ${dm ? 'text-gray-300' : 'text-gray-700'}`}>
        {done ? '✓ Roteiro salvo! Recarregando...' : 'Roteiro original não encontrado'}
      </p>
      <p className={`text-xs mb-4 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
        Suba o mesmo PDF original para recuperar o texto das cenas
      </p>
      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
      {!done && (
        <label className={`inline-flex items-center gap-2 text-xs px-4 py-2 rounded-lg cursor-pointer ${dm ? 'bg-brand-600 hover:bg-brand-500 text-white' : 'bg-brand-500 hover:bg-brand-600 text-white'}`}>
          {uploading ? 'Extraindo texto...' : '📂 Selecionar PDF ou TXT'}
          <input type="file" accept=".txt,.pdf" className="hidden"
            onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
        </label>
      )}
    </div>
  );
}

function SplitScreenModal({ scene, scenes, rawText, darkMode, projectId, onClose, onSave }) {
  const dm = darkMode;
  const [editedScene, setEditedScene] = useState(scene);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const sceneText = findSceneTextInScript(rawText, editedScene);

  const currentIdx = scenes.findIndex(s => s.id === editedScene.id);

  function goTo(idx) {
    if (idx < 0 || idx >= scenes.length) return;
    setEditedScene({ ...scenes[idx] });
  }

  async function saveField(field, value) {
    const updated = { ...editedScene, [field]: value };
    setEditedScene(updated);
    setSaveLabel('Salvando...');
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/scenes/${editedScene.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      onSave && onSave(updated);
      setSaveLabel('✓ Salvo');
      setTimeout(() => setSaveLabel(''), 2000);
    } catch(e) { setSaveLabel('Erro'); }
    finally { setSaving(false); }
  }

  // Departamentos fixos + customizados
  const FIXED_DEPTS = [
    { key: 'characters', label: 'Elenco',       color: '#ef4444', row: 0 },
    { key: 'extras',     label: 'Figuração',     color: '#22c55e', row: 0 },
    { key: 'stunts',     label: 'Stunts',        color: '#94a3b8', row: 0 },
    { key: 'art',        label: 'Arte',          color: '#f59e0b', row: 1 },
    { key: 'props',      label: 'Props',         color: '#3b82f6', row: 1 },
    { key: 'set_dressing',label:'Set Dressing',  color: '#f97316', row: 1 },
    { key: 'weapons',    label: 'Armas',         color: '#6b7280', row: 2 },
    { key: 'vehicles',   label: 'Veículos',      color: '#8b5cf6', row: 2 },
    { key: 'wardrobe',   label: 'Figurino',      color: '#ec4899', row: 2 },
    { key: 'vfx',        label: 'VFX',           color: '#06b6d4', row: 3 },
    { key: 'animals',    label: 'Animais',       color: '#84cc16', row: 3 },
    { key: 'sfx',        label: 'Efeitos sonoros',color:'#f43f5e', row: 3 },
  ];

  // Departamentos customizados ficam em extra_fields (JSONB no banco)
  const [customDepts, setCustomDepts] = useState(() => {
    try { return JSON.parse(editedScene.extra_fields || '[]'); } catch { return []; }
  });
  const [addingDept, setAddingDept] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptColor, setNewDeptColor] = useState('#a78bfa');

  async function saveCustomDepts(depts) {
    setCustomDepts(depts);
    const updated = { ...editedScene, extra_fields: JSON.stringify(depts) };
    setEditedScene(updated);
    await fetch(`/api/projects/${projectId}/scenes/${editedScene.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extra_fields: JSON.stringify(depts) }),
    });
    onSave && onSave(updated);
  }

  function DeptColumn({ deptKey, label, color, isCustom, customIdx }) {
    const items = isCustom
      ? (customDepts[customIdx]?.items || [])
      : (editedScene[deptKey] || []);
    const [adding, setAdding] = useState(false);
    const [val, setVal] = useState('');

    function addItem() {
      if (!val.trim()) return;
      if (isCustom) {
        const updated = customDepts.map((d, i) => i === customIdx ? { ...d, items: [...(d.items||[]), val.trim()] } : d);
        saveCustomDepts(updated);
      } else {
        saveField(deptKey, [...items, val.trim()]);
      }
      setVal(''); setAdding(false);
    }

    function removeItem(i) {
      if (isCustom) {
        const updated = customDepts.map((d, ci) => ci === customIdx ? { ...d, items: d.items.filter((_, j) => j !== i) } : d);
        saveCustomDepts(updated);
      } else {
        saveField(deptKey, items.filter((_, j) => j !== i));
      }
    }

    return (
      <div className={`border rounded-lg overflow-hidden ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
        <div className={`flex items-center justify-between px-2.5 py-1.5 border-b ${dm ? 'border-gray-700 bg-gray-800' : 'border-gray-100 bg-gray-50'}`}>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></span>
            <span className={`text-[10px] font-semibold truncate ${dm ? 'text-gray-300' : 'text-gray-700'}`}>{label}</span>
          </div>
          <button onClick={() => setAdding(true)} className={`text-sm font-light leading-none flex-shrink-0 ${dm ? 'text-gray-500 hover:text-brand-400' : 'text-gray-400 hover:text-brand-500'}`}>+</button>
        </div>
        <div className={`px-2.5 py-1.5 min-h-[36px] ${dm ? 'bg-gray-900' : 'bg-white'}`}>
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-0.5 group">
              <span className={`text-[11px] flex-1 truncate ${dm ? 'text-gray-300' : 'text-gray-700'}`}>{item}</span>
              <button onClick={() => removeItem(i)} className={`text-[9px] opacity-0 group-hover:opacity-100 ${dm ? 'text-gray-500 hover:text-red-400' : 'text-gray-300 hover:text-red-400'}`}>✕</button>
            </div>
          ))}
          {adding && (
            <input autoFocus value={val} onChange={e => setVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') { setAdding(false); setVal(''); } }}
              onBlur={() => { addItem(); }}
              className={`text-[11px] w-full bg-transparent outline-none border-b mt-0.5 ${dm ? 'border-gray-600 text-gray-200 placeholder-gray-600' : 'border-gray-200 text-gray-700 placeholder-gray-300'}`}
              placeholder="Digite e pressione Enter" />
          )}
          {items.length === 0 && !adding && (
            <span className={`text-[10px] ${dm ? 'text-gray-700' : 'text-gray-300'}`}>—</span>
          )}
        </div>
      </div>
    );
  }

  const inp = `text-[11px] font-medium bg-transparent outline-none border-b w-full ${dm ? 'border-gray-700 text-gray-200 focus:border-brand-400' : 'border-gray-200 text-gray-800 focus:border-brand-400'}`;
  const lbl = `text-[9px] font-medium uppercase tracking-widest mb-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`;
  const cell = (extra='') => `px-3 py-2 border-b border-r ${dm ? 'border-gray-800' : 'border-gray-100'} ${extra}`;

  // Agrupa departamentos fixos em linhas de 3
  const deptRows = [0,1,2,3].map(r => FIXED_DEPTS.filter(d => d.row === r));

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${dm ? 'bg-gray-950' : 'bg-gray-50'}`}>

      {/* Topbar */}
      <div className={`flex items-center gap-2 px-4 py-2 border-b flex-shrink-0 ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
        <button onClick={onClose}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${dm ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
          ← Voltar à Strip
        </button>
        <button onClick={() => goTo(currentIdx - 1)} disabled={currentIdx <= 0}
          className={`w-7 h-7 rounded-lg border flex items-center justify-center text-sm ${dm ? 'border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-30' : 'border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30'}`}>‹</button>
        <select value={editedScene.id}
          onChange={e => { const s = scenes.find(x => x.id === e.target.value); if(s) setEditedScene({...s}); }}
          className={`text-xs rounded-lg border px-2 py-1.5 outline-none ${dm ? 'bg-gray-800 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-700'}`}>
          {scenes.map(s => <option key={s.id} value={s.id}>Cena {s.scene_number} · {s.int_ext} · {s.location}</option>)}
        </select>
        <button onClick={() => goTo(currentIdx + 1)} disabled={currentIdx >= scenes.length - 1}
          className={`w-7 h-7 rounded-lg border flex items-center justify-center text-sm ${dm ? 'border-gray-700 text-gray-400 hover:bg-gray-800 disabled:opacity-30' : 'border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30'}`}>›</button>
        <span className={`ml-auto text-[10px] font-medium ${saveLabel === '✓ Salvo' ? 'text-green-400' : (dm ? 'text-gray-500' : 'text-gray-400')}`}>{saveLabel}</span>
      </div>

      {/* Corpo */}
      <div className="flex flex-1 overflow-hidden">

        {/* Breakdown — tela toda */}
        <div className={`w-full overflow-y-auto`}>
          <div className="p-4 flex flex-col gap-3">

            {/* Identificação */}
            <div className={`border rounded-xl overflow-hidden ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
              <div className={`grid`} style={{ gridTemplateColumns: '1fr 1fr 80px' }}>
                <div className={cell()}>
                  <p className={lbl}>Int/Ext</p>
                  <select value={editedScene.int_ext || 'INT'} onChange={e => saveField('int_ext', e.target.value)}
                    className={`text-[11px] font-medium bg-transparent outline-none w-full ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                    {['INT','EXT','INT/EXT'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className={cell()}>
                  <p className={lbl}>Day/Night</p>
                  <select value={editedScene.day_night || 'DIA'} onChange={e => saveField('day_night', e.target.value)}
                    className={`text-[11px] font-medium bg-transparent outline-none w-full ${dm ? 'text-gray-200' : 'text-gray-800'}`}>
                    {['DIA','NOITE','MANHÃ','TARDE','FIM DE TARDE','AMANHECER'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div className={`px-3 py-2 border-b ${dm ? 'border-gray-800' : 'border-gray-100'}`}>
                  <p className={lbl}>Páginas</p>
                  <input defaultValue={editedScene.estimated_pages || ''} className={inp}
                    onBlur={e => saveField('estimated_pages', e.target.value)} placeholder="1 2/8" />
                </div>
              </div>
              <div className={cell('border-r-0 col-span-3')}>
                <p className={lbl}>Set / Ambiente</p>
                <input defaultValue={editedScene.set_name || ''} className={inp}
                  onBlur={e => saveField('set_name', e.target.value)} placeholder="APARTAMENTO / SALA" />
              </div>
              <div className={cell('border-r-0')}>
                <p className={lbl}>Locação</p>
                <input defaultValue={editedScene.location || ''} className={inp}
                  onBlur={e => saveField('location', e.target.value)} placeholder="Endereço ou nome da locação" />
              </div>
              <div className={cell('border-r-0')}>
                <p className={lbl}>Sinopse</p>
                <input defaultValue={editedScene.synopsis || ''} className={inp}
                  onBlur={e => saveField('synopsis', e.target.value)} placeholder="Breve descrição da cena" />
              </div>
              <div className={`px-3 py-2 flex items-center gap-3 border-b-0 ${dm ? 'border-gray-800' : 'border-gray-100'}`}>
                <p className={lbl}>Flashback</p>
                <input type="checkbox" checked={!!editedScene.is_flashback}
                  onChange={e => saveField('is_flashback', e.target.checked)} />
              </div>
            </div>

            {/* Departamentos fixos — 3 por linha */}
            {deptRows.map((row, ri) => (
              <div key={ri} className="grid grid-cols-3 gap-2">
                {row.map(d => (
                  <DeptColumn key={d.key} deptKey={d.key} label={d.label} color={d.color} />
                ))}
              </div>
            ))}

            {/* Departamentos customizados */}
            {customDepts.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {customDepts.map((d, i) => (
                  <div key={i} className="relative">
                    <DeptColumn deptKey={null} label={d.label} color={d.color} isCustom customIdx={i} />
                    <button onClick={() => saveCustomDepts(customDepts.filter((_, j) => j !== i))}
                      className={`absolute top-1 right-6 text-[9px] ${dm ? 'text-gray-600 hover:text-red-400' : 'text-gray-300 hover:text-red-400'}`} title="Remover departamento">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Botão novo departamento */}
            {addingDept ? (
              <div className={`border rounded-xl p-3 flex flex-col gap-2 ${dm ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
                <p className={`text-[10px] font-semibold ${dm ? 'text-gray-300' : 'text-gray-700'}`}>Novo departamento</p>
                <input autoFocus value={newDeptName} onChange={e => setNewDeptName(e.target.value)}
                  className={`text-xs bg-transparent border-b outline-none ${dm ? 'border-gray-600 text-gray-200 placeholder-gray-600' : 'border-gray-200 text-gray-700 placeholder-gray-300'}`}
                  placeholder="Ex: Animais, Drones, Efeitos especiais..." />
                <div className="flex items-center gap-2">
                  <label className={`text-[10px] ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Cor:</label>
                  <input type="color" value={newDeptColor} onChange={e => setNewDeptColor(e.target.value)} className="w-8 h-6 rounded cursor-pointer border-0" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (!newDeptName.trim()) return;
                    saveCustomDepts([...customDepts, { label: newDeptName.trim(), color: newDeptColor, items: [] }]);
                    setNewDeptName(''); setNewDeptColor('#a78bfa'); setAddingDept(false);
                  }} className="text-xs px-3 py-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600">Adicionar</button>
                  <button onClick={() => { setAddingDept(false); setNewDeptName(''); }}
                    className={`text-xs px-3 py-1 rounded-lg border ${dm ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingDept(true)}
                className={`w-full py-2 text-xs border border-dashed rounded-xl flex items-center justify-center gap-2 transition-colors ${dm ? 'border-gray-700 text-gray-500 hover:border-brand-600 hover:text-brand-400' : 'border-gray-300 text-gray-400 hover:border-brand-400 hover:text-brand-500'}`}>
                + novo departamento
              </button>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

export default function ProjectPage() {
  const router = useRouter();
  const { id } = router.query;

  const [project, setProject] = useState(null);
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [coverEdits, setCoverEdits] = useState({});
  const [savingCover, setSavingCover] = useState(false);
  const [coverSaved, setCoverSaved] = useState(false);
  const [tab, setTab] = useState('cover');
  const [splitScreenScene, setSplitScreenScene] = useState(null);
  const [search, setSearch] = useState('');
  const [fDN, setFDN] = useState('');
  const [fIE, setFIE] = useState('');
  const [fFB, setFFB] = useState('');
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const [chunkProgress, setChunkProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (!id) return;
    loadProject().then((proj) => {
      if (proj?.status === 'processing') {
        runChunks(proj.chunks_total || 1);
      }
    });
  }, [id]);

  async function runChunks(chunksTotal) {
    setChunkProgress({ done: 0, total: chunksTotal });
    let keepGoing = true;
    let errorCount = 0;
    while (keepGoing) {
      try {
        const r = await fetch(`/api/projects/${id}/process-chunk`, { method: 'POST' });
        if (!r.ok) {
          // Erro HTTP — incrementa contador, tenta de novo após 2s (máx 3 tentativas)
          errorCount++;
          if (errorCount >= 3) {
            setProject((p) => ({ ...p, status: 'error' }));
            keepGoing = false;
          } else {
            await new Promise((res) => setTimeout(res, 2000));
          }
          continue;
        }
        errorCount = 0; // reseta contador a cada sucesso
        const d = await r.json();
        if (d.status === 'done') {
          setChunkProgress({ done: d.chunks_total || chunksTotal, total: d.chunks_total || chunksTotal });
          loadProject();
          keepGoing = false;
        } else if (d.status === 'error') {
          setProject((p) => ({ ...p, status: 'error' }));
          keepGoing = false;
        } else {
          setChunkProgress({ done: d.chunks_done || 0, total: d.chunks_total || chunksTotal });
        }
      } catch {
        // erro de rede — tenta novamente após 3s
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
  }

  async function loadProject() {
    try {
      const r = await fetch(`/api/projects/${id}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setProject(d.project);
      setScenes(d.scenes || []);
      return d.project;
    } catch (e) {
      setProject({ status: 'error', title: 'Projeto não encontrado' });
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    try {
      const r = await fetch(`/api/projects/${id}/share`, { method: 'POST' });
      const d = await r.json();
      setShareCode(d.code);
      setShowShare(true);
    } catch { alert('Erro ao gerar código.'); }
  }

  function copyCode() {
    navigator.clipboard.writeText(shareCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scenes.filter((s) => {
      if (fDN && s.day_night !== fDN) return false;
      if (fIE && s.int_ext !== fIE) return false;
      if (fFB === 'true' && !s.is_flashback) return false;
      if (fFB === 'false' && s.is_flashback) return false;
      if (!q) return true;
      return (
        s.location?.toLowerCase().includes(q) ||
        s.set_name?.toLowerCase().includes(q) ||
        s.synopsis?.toLowerCase().includes(q) ||
        (s.characters||[]).some((c) => c.toLowerCase().includes(q)) ||
        (s.props||[]).some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [scenes, search, fDN, fIE, fFB]);

  const stats = useMemo(() => {
    const locs = {}, chars = {};
    scenes.forEach((s) => {
      locs[s.location] = (locs[s.location]||0)+1;
      (s.characters||[]).forEach((c) => { chars[c]=(chars[c]||0)+1; });
    });
    return {
      locData: Object.entries(locs).sort((a,b)=>b[1]-a[1]).map(([label,count])=>({label,count})),
      charData: Object.entries(chars).sort((a,b)=>b[1]-a[1]).map(([label,count])=>({label,count})),
    };
  }, [scenes]);

  // Cores personalizadas de INT/EXT e período — vale para todo o projeto
  const [projectColors, setProjectColors] = useState(DEFAULT_COLORS);
  const [showColorConfig, setShowColorConfig] = useState(false);
  useEffect(() => {
    if (!project?.id) return;
    fetch(`/api/projects/${project.id}/colors`)
      .then(r => r.json())
      .then(d => { if (d.colors) setProjectColors(d.colors); })
      .catch(() => {});
  }, [project?.id]);

  async function saveProjectColors(colors) {
    setProjectColors(colors);
    setShowColorConfig(false);
    await fetch(`/api/projects/${project.id}/colors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(colors),
    });
  }

  // Exporta uma tabela geral: cada linha é um personagem (ou locação) com pelo menos
  // 1 data, e do lado as datas corridas dele. Só inclui quem já tem data marcada.
  function exportAllDatesPDF(mode) {
    function formatBR(dateStr) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }

    const groups = {};
    scenes.forEach(s => {
      const date = sceneDates?.[s.id];
      if (!date) return;
      const labels = mode === 'location' ? [s.location] : (s.characters || []);
      labels.forEach(label => {
        if (!groups[label]) groups[label] = new Set();
        groups[label].add(date);
      });
    });

    const rows = Object.entries(groups)
      .map(([label, datesSet]) => ({ label, dates: [...datesSet].sort() }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (rows.length === 0) {
      alert('Nenhuma data de filmagem encontrada neste plano ainda.');
      return;
    }

    const planLabel = activePlanId === '__original__' ? 'Original' : plans.find(p => p.id === activePlanId)?.name;
    const title = mode === 'location' ? '📍 Datas por locação' : '👤 Datas por personagem';

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8"><title>${title} — ${project?.title||''}</title>
<style>
body{font-family:Arial,sans-serif;font-size:11px;margin:22px;color:#111}
h1{font-size:16px;margin-bottom:2px}
p.sub{font-size:10px;color:#555;margin-bottom:16px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #ddd;padding:7px 9px;text-align:left;vertical-align:top;font-size:10px}
th{background:#eee;font-weight:bold;font-size:9px;text-transform:uppercase}
td.label{font-weight:bold;color:#185FA5;width:160px}
td.dates{line-height:1.5}
td.total{width:60px;text-align:center;color:#888}
@media print{@page{size:A4 portrait;margin:12mm}}
</style></head><body>
<h1>${title}</h1>
<p class="sub">${project?.title||''} ${planLabel?'· '+planLabel:''} · ${rows.length} ${mode === 'location' ? 'locações' : 'personagens'} · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
<table><thead><tr>
<th>${mode === 'location' ? 'Locação' : 'Personagem'}</th><th>Datas</th><th>Diárias</th>
</tr></thead><tbody>
${rows.map(r => `<tr>
<td class="label">${r.label}</td>
<td class="dates">${r.dates.map(formatBR).join(', ')}</td>
<td class="total">${r.dates.length}</td>
</tr>`).join('')}
</tbody></table>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }

  // Estado global do plano ativo — controla Stripboard e Relatórios juntos
  const [plans, setPlans] = useState([]);
  // Lista unificada do plano ativo (cenas + dias + folgas) — vive aqui pra que
  // Stripboard e Relatórios usem exatamente os MESMOS dados em memória, sem
  // depender de buscar do banco de novo (que pode ainda não ter terminado de salvar).
  const [items, setItemsRaw] = useState([]);
  const [activePlanId, setActivePlanId] = useState('__original__');

  // Busca a lista de planos UMA ÚNICA VEZ aqui no componente pai — é a fonte de verdade
  // compartilhada entre Stripboard e Relatórios. Nenhum dos dois tem cópia própria.
  useEffect(() => {
    if (!project?.id) return;
    fetch(`/api/projects/${project.id}/shooting-plans`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.plans)) setPlans(d.plans); })
      .catch(() => {});
  }, [project?.id]);

  // Mapa scene_id → data de filmagem, sempre filtrado pelo plano ativo globalmente.
  // Reconstrói a lista unificada (cenas + dias + folgas) na ordem real salva no banco,
  // e RECALCULA + SALVA o scene_ids de cada dia antes de montar o mapa — assim os
  // Relatórios nunca dependem de você ter mexido na Strip antes.
  // Mapa scene_id → data de filmagem, calculado DIRETO da lista `items` que já está em
  // memória (a mesma usada pelo Stripboard). Isso é síncrono — sem fetch, sem espera,
  // sem possibilidade de race condition. Sempre reflete exatamente o que está na tela.
  const sceneDates = useMemo(() => {
    if (activePlanId === '__original__') return {};
    const map = {};
    let currentDay = null;
    for (const item of items) {
      if (item.kind === 'day') {
        currentDay = item.data;
      } else if (item.kind === 'scene' && currentDay) {
        const d = toDateOnly(currentDay.date);
        if (d && !map[item.data.id]) map[item.data.id] = d;
      }
    }
    return map;
  }, [items, activePlanId]);

  if (loading) return (
    <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-3 pulse-slow">🎬</p>
        <p className="text-sm text-gray-500">Carregando projeto...</p>
      </div>
    </div>
  );

  if (project?.status === 'processing') {
    const pct = chunkProgress.total > 0
      ? Math.round((chunkProgress.done / chunkProgress.total) * 100)
      : 0;
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
        <div className="text-center max-w-xs">
          <p className="text-5xl mb-4 pulse-slow">⏳</p>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Analisando o roteiro...</h2>
          <p className="text-sm text-gray-400 mb-3">
            A IA está lendo cada cena em partes.
            {chunkProgress.total > 0 && (
              <span className="block mt-1 font-medium text-gray-600">
                Parte {chunkProgress.done} de {chunkProgress.total} ({pct}%)
              </span>
            )}
          </p>
          {chunkProgress.total > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div
                className="bg-amber-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          <p className="text-xs font-medium text-amber-500 mt-1">⚠️ Não feche esta janela até terminar</p>
        </div>
      </div>
    );
  }

  if (project?.status === 'error') return (
    <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
      <div className="text-center max-w-sm px-4">
        <p className="text-4xl mb-3">❌</p>
        <h2 className="text-base font-semibold text-gray-800 mb-1">Erro ao processar</h2>
        <p className="text-sm text-gray-400 mb-2">Ocorreu um erro durante a análise do roteiro. Isso pode ser causado por instabilidade temporária da API.</p>
        <p className="text-sm text-gray-400 mb-4">Tente enviar o roteiro novamente. Se o erro persistir, tente colar o texto diretamente.</p>
        <button onClick={async () => {
          const resetRes = await fetch(`/api/projects/${id}/reset`, { method: 'POST' }).then(r => r.json()).catch(() => null);
          if (!resetRes?.ok) { alert('Erro ao resetar projeto.'); return; }
          const proj = await fetch(`/api/projects/${id}`).then(r => r.json()).catch(() => null);
          if (proj?.project) {
            setProject({ ...proj.project, status: 'processing' });
            runChunks(resetRes.chunks_total || proj.project.chunks_total);
          }
        }} className="text-sm text-white bg-brand-500 px-4 py-2 rounded-lg hover:bg-brand-600 mb-3 block mx-auto">
          🔄 Tentar processar novamente
        </button>
        <button onClick={() => router.push('/')} className="text-sm text-brand-500 hover:underline">← Voltar</button>
      </div>
    </div>
  );

  const totalPages = scenes.reduce((s,c) => s+(parseFloat(c.estimated_pages)||1), 0);
  const TABS = [
    { key:'cover', label:'🎬 ' + (project?.title || 'Capa') },
    { key:'stripboard', label:'🎞 Stripboard' },
    { key:'breakdown', label:'📋 Breakdown' },
    { key:'reports', label:'📊 Relatórios' },
  ];

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-950 text-gray-100" : "bg-[#f8f7f4]"}`}>
      {/* Header */}
      <header className={`border-b px-6 py-3 flex items-center gap-4 sticky top-0 z-20 ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}>
        <button onClick={() => router.push('/')} className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'}`}>
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h1 className={`text-[15px] font-semibold truncate ${darkMode ? "text-white" : "text-gray-900"}`}>{project?.title}</h1>
          <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            {project?.author && `${project.author} · `}{scenes.length} cenas · {totalPages.toFixed(0)} páginas est.
          </p>
        </div>

        {/* Grupo: colaboração */}
        <div className="relative flex-shrink-0">
          <button onClick={() => setShowShare(!showShare)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${darkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            🔗 Compartilhar
          </button>
          {showShare && (
            <div className={`absolute right-0 top-9 border rounded-xl shadow-lg p-4 w-60 z-30 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <p className={`text-xs font-semibold mb-1 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Código da equipe</p>
              <p className={`text-xs mb-3 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Válido por 30 dias.</p>
              {shareCode ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-center font-mono text-xl font-bold text-brand-500 tracking-widest border border-brand-300 rounded-lg py-2 bg-brand-50">
                    {shareCode}
                  </span>
                  <button onClick={copyCode} className={`p-2 rounded-lg border text-sm ${darkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    {copied ? '✅' : '📋'}
                  </button>
                </div>
              ) : (
                <button onClick={handleShare}
                  className="w-full py-2 bg-brand-500 text-white text-xs font-medium rounded-lg hover:bg-brand-600 transition-colors">
                  Gerar código
                </button>
              )}
            </div>
          )}
        </div>

        {/* Grupo: exportar — ação principal, fica destacada */}
        <div className="relative group flex-shrink-0">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
            ⬇️ Exportar
          </button>
          <div className={`absolute right-0 top-8 border rounded-xl shadow-lg py-1 w-40 z-30 hidden group-hover:block ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            {[
              { l:'CSV (Excel)',   fn:()=>exportCSV(scenes, project?.title) },
              { l:'Excel (.xlsx)', fn:()=>exportXLSX(scenes, project?.title) },
              { l:'PDF',           fn:()=>exportPDF(scenes, project?.title) },
              { l:'JSON',          fn:()=>exportJSON(scenes, project) },
            ].map(({ l, fn }) => (
              <button key={l} onClick={fn}
                className={`w-full text-left px-4 py-2 text-xs transition-colors ${darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Divisor visual antes do toggle de tema, que é uma preferência, não uma ação */}
        <div className={`w-px h-6 flex-shrink-0 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />

        <button onClick={() => setDarkMode(d => !d)}
          className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-sm ${darkMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
          title={darkMode ? 'Modo claro' : 'Modo escuro'}>
          {darkMode ? '☀️' : '🌙'}
        </button>
      </header>

      <div className="px-6 pt-5">
        {/* Stats */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
          {[
            { l:'Cenas', v:scenes.length, icon:'🎬' },
            { l:'Páginas do roteiro', v:totalPages.toFixed(0), icon:'📄' },
            { l:'Locações', v:new Set(scenes.map((s)=>s.location)).size, icon:'📍' },
            { l:'Personagens', v:new Set(scenes.flatMap((s)=>s.characters||[])).size, icon:'👤' },
            { l:'Dia / Noite', v:`${scenes.filter((s)=>s.day_night==='DIA').length}/${scenes.filter((s)=>s.day_night==='NOITE').length}`, icon:'🌗' },
            { l:'Flashbacks', v:scenes.filter((s)=>s.is_flashback).length, icon:'⏪' },
          ].map(({ l, v, icon }) => (
            <div key={l} className={`border rounded-xl px-3 py-2.5 ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100"}`}>
              <div className={`text-[9px] uppercase tracking-wide mb-1 flex items-center gap-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <span>{icon}</span> {l}
              </div>
              <div className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{v}</div>
            </div>
          ))}
        </div>

        {/* Sidebar + conteúdo */}
      </div>
      <div className="flex" style={{ minHeight: 'calc(100vh - 57px)' }}>

        {/* Sidebar */}
        <aside className={`w-52 flex-shrink-0 border-r ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`} style={{ position: 'sticky', top: 57, height: 'calc(100vh - 57px)', overflowY: 'auto' }}>

          {/* Nome do projeto */}
          {/* Nome do projeto clicável — leva para a Capa */}
          <button onClick={() => setTab('cover')}
            className={`w-full text-left px-4 py-3 border-b transition-colors ${darkMode ? 'border-gray-800 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'}`}>
            <p className={`text-xs font-semibold truncate ${darkMode ? 'text-brand-400' : 'text-brand-600'}`}>{project?.title}</p>
          </button>

          {/* Seção Direção */}
          <div className="pt-3 pb-1">
            <p className={`text-[9px] font-medium uppercase tracking-widest px-4 mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Direção</p>
            {[
              { key: 'roteiro', icon: '📄', label: 'Roteiro' },
              { key: 'stripboard', icon: '🎞', label: 'Stripboard' },
              { key: 'breakdown', icon: '📋', label: 'Breakdown' },
              { key: 'reports', icon: '📊', label: 'Relatórios' },
              { key: 'schedule', icon: '📆', label: 'Cronograma' },
            ].map(({ key, icon, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs text-left transition-colors
                  ${tab === key
                    ? (darkMode ? 'bg-brand-900/30 text-brand-400 font-medium border-r-2 border-brand-500' : 'bg-brand-50 text-brand-600 font-medium border-r-2 border-brand-500')
                    : (darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700')}`}>
                <span className="text-sm">{icon}</span>
                {label}
              </button>
            ))}
            <button onClick={() => setTab('od')}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs text-left transition-colors
                ${tab === 'od'
                  ? (darkMode ? 'bg-brand-900/30 text-brand-400 font-medium border-r-2 border-brand-500' : 'bg-brand-50 text-brand-600 font-medium border-r-2 border-brand-500')
                  : (darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700')}`}>
              <span className="text-sm">📅</span>
              Ordem do dia
            </button>
          </div>

          <div className={`mx-4 my-2 border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}`} />

          {/* Seção Produção */}
          <div className="pb-1">
            <p className={`text-[9px] font-medium uppercase tracking-widest px-4 mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Produção</p>
            <button onClick={() => setTab('budget')}
              className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs text-left transition-colors
                ${tab === 'budget'
                  ? (darkMode ? 'bg-brand-900/30 text-brand-400 font-medium border-r-2 border-brand-500' : 'bg-brand-50 text-brand-600 font-medium border-r-2 border-brand-500')
                  : (darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700')}`}>
              <span className="text-sm">📊</span>
              Planilhas
            </button>
            {[
              { icon: '📄', label: 'Contratos' },
              { icon: '✅', label: 'Autorizações' },
            ].map(({ icon, label }) => (
              <div key={label} className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                <span className="text-sm">🔒</span>
                {label}
                <span className={`ml-auto text-[9px] ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>em breve</span>
              </div>
            ))}
          </div>

          <div className={`mx-4 my-2 border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}`} />

          {/* Seção Departamentos */}
          <div className="pb-3">
            <p className={`text-[9px] font-medium uppercase tracking-widest px-4 mb-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Departamentos</p>
            {[
              { icon: '🎨', label: 'Arte' },
              { icon: '📷', label: 'Fotografia' },
              { icon: '🎙', label: 'Som' },
              { icon: '🎭', label: 'Elenco' },
              { icon: '🚛', label: 'Logística' },
            ].map(({ icon, label }) => (
              <div key={label}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs cursor-pointer transition-colors ${darkMode ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                <span className="text-sm">{icon}</span>
                {label}
                <span className={`ml-auto text-[9px] ${darkMode ? 'text-gray-600' : 'text-gray-300'}`}>em breve</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Conteúdo principal */}
        <main className="flex-1 px-6 pt-4 pb-10 min-w-0">

        {/* CRONOGRAMA */}
        {tab === 'od' && (
          <ODTab project={project} scenes={scenes} plans={plans} darkMode={darkMode} />
        )}

        {tab === 'schedule' && (
          <div className={`border rounded-xl p-8 text-center ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'}`}>
            <p className="text-3xl mb-3">📆</p>
            <h2 className={`text-base font-semibold mb-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>Cronograma</h2>
            <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Em desenvolvimento — em breve aqui.</p>
          </div>
        )}

        {/* PLANILHAS */}
        {tab === 'budget' && (
          <BudgetPage project={project} scenes={scenes} plans={plans} darkMode={darkMode} />
        )}

        {/* CAPA DO PROJETO */}
        {tab === 'cover' && (
          <CoverPage project={project} darkMode={darkMode} onSave={async (fields) => {
            setSavingCover(true);
            try {
              await fetch(`/api/projects/${project.id}/cover`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
              });
              setProject((p) => ({ ...p, ...fields }));
              setCoverSaved(true);
              setTimeout(() => setCoverSaved(false), 2000);
            } finally { setSavingCover(false); }
          }} saving={savingCover} saved={coverSaved} />
        )}

        {tab === 'roteiro' && (
          <div className="fade-in">
            <ScriptViewer projectId={projectId} darkMode={darkMode} />
          </div>
        )}

        {tab === 'breakdown' && (
          <div className="fade-in">
            <div className="flex flex-wrap gap-2 mb-3">
              <input value={search} onChange={(e)=>setSearch(e.target.value)}
                placeholder="Buscar cenas, locações, personagens..."
                className="flex-1 min-w-[180px] text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none focus:border-brand-400" />
              <select value={fDN} onChange={(e)=>setFDN(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none text-gray-600">
                <option value="">Período</option>
                {['DIA','NOITE','MANHÃ','TARDE','FIM DE TARDE'].map((v)=><option key={v}>{v}</option>)}
              </select>
              <select value={fIE} onChange={(e)=>setFIE(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none text-gray-600">
                <option value="">INT / EXT</option>
                {['INT','EXT','INT/EXT'].map((v)=><option key={v}>{v}</option>)}
              </select>
              <select value={fFB} onChange={(e)=>setFFB(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg bg-white outline-none text-gray-600">
                <option value="">Tipo</option>
                <option value="false">Normal</option>
                <option value="true">Flashback</option>
              </select>
              {(search||fDN||fIE||fFB) && (
                <button onClick={()=>{setSearch('');setFDN('');setFIE('');setFFB('');}}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2">Limpar</button>
              )}
            </div>
            <p className={`text-xs mb-2 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>{filtered.length} de {scenes.length} cenas</p>

            <div className={`table-wrap border rounded-xl overflow-hidden ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100"}`}>
              <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '28px' }} />
                  <col style={{ width: '55px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '200px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '130px' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '70px' }} />
                  <col style={{ width: '30px' }} />
                </colgroup>
                <thead>
                  <tr className={`border-b ${darkMode ? "border-gray-700" : "border-gray-100"}`}>
                    {['#','I/E · Período','Locação / Set','Sinopse','Personagens','Arte','VFX · Veículos · Extras','Figuração','Págs'].map((h) => (
                      <th key={h} className={`text-left px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} onClick={() => setSplitScreenScene(s)} className={`border-b transition-colors text-[11px] cursor-pointer ${darkMode ? "border-gray-800 hover:bg-gray-800" : "border-gray-50 hover:bg-gray-50"} ${s.is_flashback ? (darkMode ? "bg-purple-900/20" : "bg-purple-50/30") : ""}`}>
                      {/* # */}
                      <td className="px-2 py-1.5 font-bold text-brand-500 whitespace-nowrap">
                        {s.is_flashback && <span className={`text-[8px] rounded px-1 mr-0.5 ${darkMode ? "bg-purple-900 text-purple-300" : "bg-purple-100 text-purple-600"}`}>FB</span>}
                        {s.scene_number}
                      </td>
                      {/* I/E + Período */}
                      <td className="px-2 py-1.5">
                        <CompactIEPeriod intExt={s.int_ext} dayNight={s.day_night} darkMode={darkMode} />
                      </td>
                      {/* Locação */}
                      <td className="px-2 py-1.5">
                        <div className={`font-medium text-[11px] leading-tight ${darkMode ? "text-gray-200" : "text-gray-800"}`}>{s.location}</div>
                        {s.set_name && <div className={`text-[9px] mt-0.5 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>{s.set_name}</div>}
                      </td>
                      {/* Sinopse */}
                      <td className={`px-2 py-1.5 text-[10px] leading-snug ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{s.synopsis}</td>
                      {/* Personagens */}
                      <td className="px-2 py-1.5">{(s.characters||[]).map((c)=><Tag key={c}>{c}</Tag>)}</td>
                      {/* Props + Figurino */}
                      <td className="px-2 py-1.5">
                        {(s.props||[]).map((p)=><Tag key={p}>{p}</Tag>)}
                        {(s.wardrobe||[]).length > 0 && <div className={`text-[8px] mt-1 mb-0.5 font-semibold uppercase tracking-wide ${darkMode ? "text-gray-600" : "text-gray-300"}`}>figurino</div>}
                        {(s.wardrobe||[]).map((w)=><Tag key={w}>{w}</Tag>)}
                      </td>
                      {/* VFX + Veículos + Extras */}
                      <td className="px-2 py-1.5">
                        {(s.vfx||[]).map((v)=><Tag key={v}>{v}</Tag>)}
                        {(s.vehicles||[]).map((v)=><Tag key={v}>{v}</Tag>)}
                        {(s.extras||[]).map((e)=><Tag key={e}>{e}</Tag>)}
                      </td>
                      {/* Figuração */}
                      <td className="px-2 py-1.5">{(s.extras||[]).map((e)=><Tag key={e}>{e}</Tag>)}</td>
                      {/* Páginas */}
                      <td className={`px-2 py-1.5 text-right font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{s.estimated_pages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STRIPBOARD — sempre montado (mesmo em outras abas), só fica escondido visualmente.
            Isso é ESSENCIAL: garante que `items` (cenas + dias + folgas com datas) sempre
            esteja carregado, mesmo que o usuário nunca tenha clicado nesta aba na sessão atual.
            Sem isso, os Relatórios não têm como saber as datas de filmagem. */}
        <div style={{ display: tab === 'stripboard' ? 'block' : 'none' }}>
          <Stripboard scenes={scenes} onScenesChange={setScenes} projectId={project.id} project={project} darkMode={darkMode}
            projectColors={projectColors} onOpenColorConfig={() => setShowColorConfig(true)}
            activePlanId={activePlanId} setActivePlanId={setActivePlanId} plans={plans} setPlans={setPlans}
            items={items} setItemsRaw={setItemsRaw}
            onOpenBreakdown={s => setSplitScreenScene(s)} />
        </div>

        {/* RELATÓRIOS */}
        {tab === 'reports' && (
          <div className="fade-in space-y-4">
            <div className={`flex items-center gap-2 flex-wrap border rounded-xl px-4 py-3 ${darkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100'}`}>
              <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>📋 Plano de filmagem:</span>
              <select value={activePlanId} onChange={e => setActivePlanId(e.target.value)}
                className={`text-xs px-3 py-1.5 rounded-lg border outline-none font-medium ${darkMode ? 'bg-gray-800 border-gray-700 text-brand-400' : 'bg-white border-gray-200 text-brand-600'}`}>
                <option value="__original__">🔒 Original (sem datas)</option>
                {plans.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <span className={`text-[10px] ml-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Todos os relatórios abaixo seguem este plano.</span>
            </div>

            <button onClick={async () => {
              const res = await fetch(`/api/projects/${project.id}/normalize-characters`, { method: 'POST' });
              const d = await res.json();
              if (res.ok) {
                await loadProject(); // recarrega as cenas já corrigidas, sem precisar dar F5
                alert(`Personagens normalizados! ${d.scenesUpdated} de ${d.scenesChecked} cenas foram corrigidas (nomes duplicados por maiúscula/acento foram unificados). A tela já foi atualizada.`);
              } else {
                alert('Erro ao normalizar: ' + (d.error || 'desconhecido'));
              }
            }}
              className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors self-start ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-400 hover:border-brand-400 hover:text-brand-400' : 'border-gray-200 bg-white text-gray-500 hover:border-brand-300 hover:text-brand-500'}`}>
              🧹 Corrigir nomes duplicados de personagens (ex: "ALAN" vs "Alan")
            </button>


            <CollapsibleSection icon="👤" title="Personagens" count={`${stats.charData.length} personagens`} darkMode={darkMode}
              headerAction={
                <button onClick={(e) => { e.stopPropagation(); exportAllDatesPDF('character'); }}
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors flex-shrink-0">
                  📄 Exportar todos
                </button>
              }>
              <p className={`text-[11px] mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Clique em um personagem para ver as cenas e exportar.</p>
              <ExpandableBarChart data={stats.charData} color="#0f6e56" scenes={scenes} mode="character" darkMode={darkMode} project={project} sceneDates={sceneDates} planName={activePlanId === '__original__' ? 'Original' : plans.find(p => p.id === activePlanId)?.name} />
            </CollapsibleSection>

            <CollapsibleSection icon="📍" title="Locações" count={`${stats.locData.length} locações`} darkMode={darkMode}
              headerAction={
                <button onClick={(e) => { e.stopPropagation(); exportAllDatesPDF('location'); }}
                  className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors flex-shrink-0">
                  📄 Exportar todas
                </button>
              }>
              <p className={`text-[11px] mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Clique em uma locação para ver as cenas e exportar.</p>
              <ExpandableBarChart data={stats.locData} color="#185FA5" scenes={scenes} mode="location" darkMode={darkMode} project={project} sceneDates={sceneDates} planName={activePlanId === '__original__' ? 'Original' : plans.find(p => p.id === activePlanId)?.name} />
            </CollapsibleSection>

            <CollapsibleSection icon="📅" title="Diárias por personagem (DOOD)" count={activePlanId === '__original__' ? 'requer plano com datas' : undefined} darkMode={darkMode}>
              <p className={`text-[11px] mb-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                {activePlanId === '__original__'
                  ? 'Selecione um plano com datas de filmagem para ver as diárias.'
                  : 'Quais dias cada personagem filma, quantas cenas em cada dia, e o total de diárias.'}
              </p>
              {activePlanId !== '__original__' && (
                <CharacterDOOD scenes={scenes} sceneDates={sceneDates} darkMode={darkMode} project={project} planName={plans.find(p => p.id === activePlanId)?.name} />
              )}
            </CollapsibleSection>
          </div>
        )}
        </main>
      </div>

      {/* Modal de personalizar cores */}
      {showColorConfig && (
        <ColorConfigModal initial={projectColors} onSave={saveProjectColors} onClose={() => setShowColorConfig(false)} />
      )}

      {/* SPLIT-SCREEN: Roteiro original ao lado do breakdown da cena */}
      {splitScreenScene && (
        <SplitScreenModal
          scene={splitScreenScene}
          scenes={scenes}
          rawText={project.raw_text}
          darkMode={darkMode}
          projectId={project.id}
          onClose={() => setSplitScreenScene(null)}
          onSave={(updated) => {
            setScenes(prev => prev.map(s => s.id === updated.id ? updated : s));
            setSplitScreenScene(updated);
          }}
        />
      )}
    </div>
  );
}
