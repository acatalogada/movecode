// pages/project/[id]/od.js — Ordem do Dia
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { exportODPDF } from '../../../lib/exports';

function toMin(t) {
  if (!t || !t.includes(':')) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function diffMin(a, b) {
  const ma = toMin(a), mb = toMin(b);
  if (ma === null || mb === null || mb <= ma) return null;
  return mb - ma;
}
function fmtMin(m) {
  if (!m) return '—';
  const h = Math.floor(m / 60), mn = m % 60;
  return h > 0 ? h + 'h' + String(mn).padStart(2, '0') : mn + 'min';
}

const ITEM_TYPES = {
  desl:       { label: 'Deslocamento',      icon: '🚐', color: '#BA7517', bg: '#FAEEDA' },
  almoco:     { label: 'Almoço',            icon: '🍽️', color: '#085041', bg: '#E1F5EE' },
  lanche:     { label: 'Lanche',            icon: '☕', color: '#3B6D11', bg: '#EAF3DE' },
  jantar:     { label: 'Jantar',            icon: '🌙', color: '#3C3489', bg: '#EEEDFE' },
  desp_geral: { label: 'Desprodução geral', icon: '📦', color: '#993C1D', bg: '#FAECE7' },
};

function TimeInput({ value, onChange, tabIndex, darkMode }) {
  const [local, setLocal] = useState(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);

  function handleBlur() {
    const digits = local.replace(/[^0-9]/g, '');
    let formatted = local;
    if (digits.length === 4) formatted = digits.slice(0,2) + ':' + digits.slice(2,4);
    else if (digits.length === 3) formatted = '0' + digits.slice(0,1) + ':' + digits.slice(1,3);
    else if (digits.length === 2 && !local.includes(':')) formatted = digits + ':00';
    setLocal(formatted);
    onChange(formatted);
  }

  return (
    <input type="text" value={local}
      tabIndex={tabIndex}
      onChange={e => setLocal(e.target.value)}
      onBlur={handleBlur}
      placeholder="hh:mm"
      className={`w-14 text-center font-mono text-xs outline-none border-b py-0.5 ${darkMode ? 'bg-transparent border-gray-600 text-gray-200 focus:border-blue-400' : 'bg-transparent border-gray-200 text-gray-700 focus:border-brand-400'}`} />
  );
}

export default function ODPage() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState(null);
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderData, setOrderData] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [showAddScene, setShowAddScene] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [scenes, setScenes] = useState([]);

  const dm = darkMode;
  const bg = dm ? 'bg-gray-950 text-gray-100' : 'bg-[#f8f7f4] text-gray-900';
  const card = dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-100';
  const muted = dm ? 'text-gray-500' : 'text-gray-400';
  const inputCls = `bg-transparent border-b outline-none text-xs py-0.5 w-full ${dm ? 'border-gray-600 text-gray-200 focus:border-brand-400' : 'border-gray-200 text-gray-700 focus:border-brand-500'}`;

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/projects/${id}`).then(r => r.json()),
      fetch(`/api/projects/${id}/shooting-plans`).then(r => r.json()),
      fetch(`/api/projects/${id}/daily-orders`).then(r => r.json()),
    ]).then(([pd, pld, od]) => {
      setProject(pd.project);
      setScenes(pd.scenes || []);
      setPlans(pld.plans || []);
      setOrders(od.orders || []);
    });
  }, [id]);

  async function loadOrder(orderId) {
    const d = await fetch(`/api/projects/${id}/daily-orders/${orderId}`).then(r => r.json());
    // Enriquece as cenas com a sinopse da cena original
    if (d.scenes) {
      d.scenes = d.scenes.map(s => {
        const original = scenes.find(orig => orig.id === s.scene_id);
        return { ...s, synopsis: original?.synopsis || s.synopsis || '' };
      });
    }
    setSelectedOrder(orderId);
    setOrderData(d);
  }

  const [showNewOD, setShowNewOD] = useState(false);
  const [newODPlan, setNewODPlan] = useState('');
  const [newODDate, setNewODDate] = useState('');
  const [planDates, setPlanDates] = useState([]);
  const [stripboardItems, setStripboardItems] = useState([]);
  const [selectedSceneIds, setSelectedSceneIds] = useState([]);

  async function loadPlanDates(planId) {
    setNewODPlan(planId);
    setNewODDate('');
    setPlanDates([]);
    setStripboardItems([]);
    setSelectedSceneIds([]);
    if (!planId) return;

    // Busca os dias com as cenas já agrupadas — os scene_ids já estão corretos
    // no banco (gravados pelo Stripboard via syncDayScenesToDatabase), não precisa recalcular.
    const res = await fetch(`/api/projects/${id}/shooting-plans/${planId}/scenes-by-day`)
      .then(r => r.json()).catch(() => ({ days: [] }));
    setPlanDates(res.days || []);
  }

  function onSelectDate(dateId) {
    setNewODDate(dateId);
    // Pré-seleciona automaticamente as cenas deste dia
    const day = planDates.find(d => d.id === dateId);
    const dayScenes = day?.scenes || [];
    setSelectedSceneIds(dayScenes.map(s => s.id));
  }

  function getScenesForDate(dateId) {
    const day = planDates.find(d => d.id === dateId);
    return day?.scenes || [];
  }


  async function createOrder() {
    const selectedDay = planDates.find(d => d.id === newODDate);
    const dayScenes = selectedDay?.scenes || [];
    const scenesForDay = selectedSceneIds.length > 0 
      ? dayScenes.filter(s => selectedSceneIds.includes(s.id))
      : dayScenes;

    console.log('=== CRIAR OD ===');
    console.log('selectedDay:', selectedDay);
    console.log('dayScenes:', dayScenes.length);
    console.log('scenesForDay:', scenesForDay.length);
    console.log('selectedSceneIds:', selectedSceneIds.length);
    
    const cleanDate = (selectedDay?.date || '').split('T')[0] || new Date().toISOString().split('T')[0];

    const res = await fetch(`/api/projects/${id}/daily-orders`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: newODPlan || null,
        date: cleanDate,
        day_number: orders.length + 1,
      }),
    });
    const d = await res.json();
    console.log('OD criada:', d);
    
    // Adiciona as cenas automaticamente
    for (let i = 0; i < scenesForDay.length; i++) {
      const scene = scenesForDay[i];
      const r = await fetch(`/api/projects/${id}/daily-orders/${d.id}/scenes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scene_id: scene.id, scene_number: scene.scene_number,
          location: scene.location, period: scene.day_night || scene.period, int_ext: scene.int_ext,
          position: i,
        }),
      });
      const rd = await r.json();
      console.log(`Cena ${scene.scene_number} adicionada:`, rd);
    }
    
    const newOrder = { id: d.id, day_number: orders.length + 1, date: cleanDate };
    setOrders(prev => [...prev, newOrder]);
    setShowNewOD(false);
    setNewODPlan('');
    setNewODDate('');
    setSelectedSceneIds([]);
    loadOrder(d.id);
  }

  async function saveHeader(key, val) {
    if (!orderData?.order) return;
    const updated = { ...orderData.order, [key]: val };
    setOrderData(prev => ({ ...prev, order: updated }));
    await fetch(`/api/projects/${id}/daily-orders/${selectedOrder}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }

  async function addScene(scene) {
    const res = await fetch(`/api/projects/${id}/daily-orders/${selectedOrder}/scenes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene_id: scene.id, scene_number: scene.scene_number, location: scene.location, period: scene.day_night || scene.period, int_ext: scene.int_ext, position: orderData?.scenes?.length || 0 }),
    });
    const d = await res.json();
    setOrderData(prev => ({ ...prev, scenes: [...(prev.scenes||[]), { id: d.id, scene_id: scene.id, scene_number: scene.scene_number, location: scene.location, period: scene.day_night || scene.period, int_ext: scene.int_ext, synopsis: scene.synopsis || '', prep_start:'', prep_end:'', shoot_start:'', shoot_end:'', wrap_start:'', wrap_end:'' }] }));
    setShowAddScene(false);
  }

  function updateSceneLocal(sceneId, field, val) {
    setOrderData(prev => ({ ...prev, scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, [field]: val } : s) }));
  }

  async function removeScene(sceneId) {
    await fetch(`/api/projects/${id}/daily-orders/${selectedOrder}/scenes?sceneId=${sceneId}`, { method: 'DELETE' });
    setOrderData(prev => ({ ...prev, scenes: prev.scenes.filter(s => s.id !== sceneId) }));
  }

  async function addItem(type) {
    const res = await fetch(`/api/projects/${id}/daily-orders/${selectedOrder}/items`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, position: orderData?.items?.length || 0 }),
    });
    const d = await res.json();
    setOrderData(prev => ({ ...prev, items: [...(prev.items||[]), { id: d.id, type, from_loc:'', to_loc:'', time_start:'', time_end:'' }] }));
    setShowAddItem(false);
  }

  function updateItemLocal(itemId, field, val) {
    setOrderData(prev => ({ ...prev, items: prev.items.map(x => x.id === itemId ? { ...x, [field]: val } : x) }));
  }

  async function removeItem(itemId) {
    await fetch(`/api/projects/${id}/daily-orders/${selectedOrder}/items?itemId=${itemId}`, { method: 'DELETE' });
    setOrderData(prev => ({ ...prev, items: prev.items.filter(x => x.id !== itemId) }));
  }

  async function addCast() {
    const res = await fetch(`/api/projects/${id}/daily-orders/${selectedOrder}/cast`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: orderData?.cast?.length || 0 }),
    });
    const d = await res.json();
    setOrderData(prev => ({ ...prev, cast: [...(prev.cast||[]), { id: d.id, character_name:'', actor_name:'', scenes:'', makeup_time:'', call_time:'' }] }));
  }

  async function removeCast(castId) {
    await fetch(`/api/projects/${id}/daily-orders/${selectedOrder}/cast?castId=${castId}`, { method: 'DELETE' });
    setOrderData(prev => ({ ...prev, cast: prev.cast.filter(c => c.id !== castId) }));
  }

  const totals = (() => {
    if (!orderData) return {};
    let prep=0, film=0, wrap=0, desl=0, refeicao=0;
    (orderData.scenes||[]).forEach(s => {
      const p=diffMin(s.prep_start,s.prep_end), f=diffMin(s.shoot_start,s.shoot_end), w=diffMin(s.wrap_start,s.wrap_end);
      if(p) prep+=p; if(f) film+=f; if(w) wrap+=w;
    });
    (orderData.items||[]).forEach(item => {
      const d=diffMin(item.time_start,item.time_end);
      if(!d) return;
      if(item.type==='desl') desl+=d; else refeicao+=d;
    });
    const total=prep+film+wrap+desl+refeicao;
    return { prep, film, wrap, desl, refeicao, total, over: total>720 };
  })();

  if (!project) return <div className={`min-h-screen ${bg} flex items-center justify-center`}><p className={muted}>Carregando...</p></div>;

  return (
    <div className={`min-h-screen ${bg}`}>
      <header className={`border-b px-6 py-3 flex items-center gap-3 sticky top-0 z-20 ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
        <button onClick={() => router.push(`/project/${id}`)} className={`text-lg ${muted} hover:text-gray-200`}>←</button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">{project.title}</h1>
          <p className={`text-[11px] ${muted}`}>Ordem do Dia</p>
        </div>
        {selectedOrder && orderData && (
          <button onClick={() => {
            const plan = plans.find(p => p.id === orderData.order?.plan_id);
            exportODPDF(orderData.order, orderData.scenes, orderData.items, orderData.cast, project, plan?.name);
          }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${dm ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            📄 Exportar PDF
          </button>
        )}
        <button onClick={() => setDarkMode(d => !d)} className={`w-8 h-8 flex items-center justify-center rounded-lg border ${dm ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-100'}`}>
          {dm ? '☀️' : '🌙'}
        </button>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 53px)' }}>
        {/* Sidebar */}
        <div className={`w-52 border-r flex-shrink-0 flex flex-col ${dm ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className={`p-3 border-b ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
            <button onClick={() => setShowNewOD(true)} className="w-full py-2 text-xs bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors">
              + Nova OD
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {orders.length === 0 && <p className={`text-[11px] ${muted} text-center p-4`}>Nenhuma OD ainda.</p>}
            {orders.map(o => (
              <div key={o.id} onClick={() => loadOrder(o.id)}
                className={`group px-3 py-2.5 cursor-pointer border-b transition-colors flex items-center justify-between gap-2 ${dm ? 'border-gray-800 hover:bg-gray-800' : 'border-gray-100 hover:bg-gray-50'} ${selectedOrder === o.id ? 'border-l-2 border-l-brand-500' : ''}`}>
                <div>
                  <p className="text-xs font-medium">Dia {o.day_number}</p>
                  <p className={`text-[10px] ${muted}`}>{o.date ? (() => { const s = o.date.toString().split('T')[0]; const [y,m,d] = s.split('-'); return d ? `${d}/${m}/${y}` : '—'; })() : '—'}</p>
                </div>
                <button onClick={async e => {
                  e.stopPropagation();
                  if (!window.confirm(`Apagar a Ordem do Dia ${o.day_number}?`)) return;
                  await fetch(`/api/projects/${id}/daily-orders/${o.id}`, { method: 'DELETE' });
                  setOrders(prev => prev.filter(x => x.id !== o.id));
                  if (selectedOrder === o.id) { setSelectedOrder(null); setOrderData(null); }
                }}
                  className={`opacity-0 group-hover:opacity-100 text-xs flex-shrink-0 ${muted} hover:text-red-400 transition-opacity`}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedOrder ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center"><p className="text-4xl mb-3">📋</p><p className={`text-sm ${muted}`}>Selecione ou crie uma Ordem do Dia</p></div>
            </div>
          ) : !orderData ? (
            <div className="flex items-center justify-center h-full"><p className={muted}>Carregando...</p></div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-6">

              {/* Identificação */}
              <div className={`border rounded-xl p-5 ${card}`}>
                <h2 className="text-sm font-semibold mb-4">Identificação</h2>
                <div className="grid grid-cols-3 gap-x-8 gap-y-4">
                  {[
                    { label: 'Projeto', value: project.title, readOnly: true },
                    { label: 'Data', key: 'date', type: 'date', value: orderData.order?.date?.split('T')[0]||'' },
                    { label: 'Dia de filmagem nº', key: 'day_number', type: 'number', value: orderData.order?.day_number||'' },
                    { label: 'Chegada da equipe', key: 'call_time', value: orderData.order?.call_time||'' },
                    { label: 'Início das filmagens', key: 'shoot_start', value: orderData.order?.shoot_start||'' },
                    { label: 'Locação principal', key: 'location', value: orderData.order?.location||'' },
                    { label: 'Endereço', key: 'address', value: orderData.order?.address||'' },
                    { label: 'Ponto de encontro', key: 'meeting_point', value: orderData.order?.meeting_point||'' },
                    { label: 'Contato na locação', key: 'location_contact', value: orderData.order?.location_contact||'' },
                  ].map((f, i) => (
                    <div key={i}>
                      <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1 ${muted}`}>{f.label}</label>
                      <input type={f.type||'text'} defaultValue={f.value} readOnly={f.readOnly}
                        className={inputCls + (f.readOnly ? ' opacity-50' : '')}
                        onBlur={f.key ? e => saveHeader(f.key, e.target.value) : undefined} />
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1 ${muted}`}>Observações gerais</label>
                  <textarea defaultValue={orderData.order?.notes||''} rows={2} className={inputCls + ' resize-none'}
                    onBlur={e => saveHeader('notes', e.target.value)} />
                </div>
              </div>

              {/* Cenas do dia */}
              <div className={`border rounded-xl overflow-hidden ${card}`}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
                  <h2 className="text-sm font-semibold">Cenas do dia</h2>
                  <button onClick={() => setShowAddScene(true)} className="text-xs px-3 py-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600">
                    + Cena
                  </button>
                </div>
                <div className="divide-y divide-gray-800">
                  {(orderData.scenes||[]).map((s, sceneIdx) => (
                    <div key={s.id} className={`px-4 py-3 ${dm ? 'hover:bg-gray-800' : 'hover:bg-gray-50'} transition-colors`}>
                      {/* Info da cena */}
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-xs text-brand-400 font-semibold flex-shrink-0 mt-0.5">#{s.scene_number}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${dm?'bg-rose-900/30 text-rose-300':'bg-rose-50 text-rose-700'}`}>{s.int_ext}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${dm?'bg-indigo-900/30 text-indigo-300':'bg-indigo-50 text-indigo-700'}`}>{s.period}</span>
                            <span className={`text-xs font-medium ${dm?'text-gray-200':'text-gray-800'}`}>{s.location}</span>
                          </div>
                          <p className={`text-xs ${dm?'text-gray-400':'text-gray-500'} leading-snug`}>{s.synopsis}</p>
                        </div>
                        <button onClick={() => removeScene(s.id)} tabIndex={-1} className={`${muted} hover:text-red-400 text-xs flex-shrink-0`}>✕</button>
                      </div>
                      {/* Horários */}
                      <div className={`flex items-center gap-4 pl-6 pt-1 border-t ${dm?'border-gray-700/50':'border-gray-100'} flex-wrap`}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide w-8">Prep</span>
                          <TimeInput value={s.prep_start} onChange={v => updateSceneLocal(s.id,'prep_start',v)} tabIndex={sceneIdx*6+1} darkMode={dm} />
                          <span className={`text-[10px] ${muted}`}>→</span>
                          <TimeInput value={s.prep_end} onChange={v => updateSceneLocal(s.id,'prep_end',v)} tabIndex={sceneIdx*6+2} darkMode={dm} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wide w-8">Film</span>
                          <TimeInput value={s.shoot_start} onChange={v => updateSceneLocal(s.id,'shoot_start',v)} tabIndex={sceneIdx*6+3} darkMode={dm} />
                          <span className={`text-[10px] ${muted}`}>→</span>
                          <TimeInput value={s.shoot_end} onChange={v => updateSceneLocal(s.id,'shoot_end',v)} tabIndex={sceneIdx*6+4} darkMode={dm} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide w-8">Desp</span>
                          <TimeInput value={s.wrap_start} onChange={v => updateSceneLocal(s.id,'wrap_start',v)} tabIndex={sceneIdx*6+5} darkMode={dm} />
                          <span className={`text-[10px] ${muted}`}>→</span>
                          <TimeInput value={s.wrap_end} onChange={v => updateSceneLocal(s.id,'wrap_end',v)} tabIndex={sceneIdx*6+6} darkMode={dm} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(orderData.items||[]).map(item => {
                    const cfg = ITEM_TYPES[item.type] || ITEM_TYPES.desl;
                    return (
                      <div key={item.id} className="px-4 py-2.5 flex items-center gap-3" style={{ background: dm ? 'rgba(255,255,255,0.02)' : cfg.bg }}>
                        <span className="text-sm flex-shrink-0">{cfg.icon}</span>
                        <span className="text-[11px] font-semibold flex-shrink-0" style={{color:cfg.color}}>{cfg.label}</span>
                        {item.type==='desl' && <>
                          <input value={item.from_loc} onChange={e => updateItemLocal(item.id,'from_loc',e.target.value)} placeholder="De..." className={`text-xs bg-transparent border-b outline-none w-24 ${dm?'border-gray-600 text-gray-300':'border-gray-300 text-gray-700'}`}/>
                          <span className={`text-xs ${muted}`}>→</span>
                          <input value={item.to_loc} onChange={e => updateItemLocal(item.id,'to_loc',e.target.value)} placeholder="Para..." className={`text-xs bg-transparent border-b outline-none w-24 ${dm?'border-gray-600 text-gray-300':'border-gray-300 text-gray-700'}`}/>
                        </>}
                        <TimeInput value={item.time_start} onChange={v => updateItemLocal(item.id,'time_start',v)} darkMode={dm} />
                        <span className={`text-xs ${muted}`}>→</span>
                        <TimeInput value={item.time_end} onChange={v => updateItemLocal(item.id,'time_end',v)} darkMode={dm} />
                        <button onClick={() => removeItem(item.id)} className={`ml-auto ${muted} hover:text-red-400 text-xs`}>✕</button>
                      </div>
                    );
                  })}
                </div>

                {/* Botão + */}
                <div className={`px-4 py-2 border-t relative ${dm ? 'border-gray-700' : 'border-gray-100'}`}>
                  <button onClick={() => setShowAddItem(v => !v)} className={`text-[11px] flex items-center gap-1.5 ${muted} hover:text-brand-400 transition-colors`}>
                    <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${dm?'border-gray-600':'border-gray-300'}`}>+</span>
                    Inserir
                  </button>
                  {showAddItem && (
                    <div className={`absolute left-4 bottom-9 border rounded-xl shadow-lg py-1 z-20 min-w-[190px] ${dm?'bg-gray-800 border-gray-700':'bg-white border-gray-200'}`}>
                      {Object.entries(ITEM_TYPES).map(([type, cfg]) => (
                        <button key={type} onClick={() => addItem(type)}
                          className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors ${dm?'text-gray-300 hover:bg-gray-700':'text-gray-700 hover:bg-gray-50'}`}>
                          {cfg.icon} {cfg.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Totais */}
                <div className={`px-4 py-3 border-t ${dm?'border-gray-700 bg-gray-800':'border-gray-100 bg-gray-50'} ${totals.over?'bg-red-900/20':''}`}>
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="text-center"><div className="text-xs font-medium text-blue-400">{fmtMin(totals.prep)}</div><div className={`text-[9px] ${muted}`}>Preparação</div></div>
                    <div className="text-center"><div className="text-xs font-medium text-green-400">{fmtMin(totals.film)}</div><div className={`text-[9px] ${muted}`}>Filmagem</div></div>
                    <div className="text-center"><div className="text-xs font-medium text-amber-400">{fmtMin(totals.wrap)}</div><div className={`text-[9px] ${muted}`}>Desprodução</div></div>
                    {totals.desl>0 && <div className="text-center"><div className="text-xs font-medium" style={{color:'#BA7517'}}>{fmtMin(totals.desl)}</div><div className={`text-[9px] ${muted}`}>Deslocamento</div></div>}
                    {totals.refeicao>0 && <div className="text-center"><div className="text-xs font-medium text-teal-400">{fmtMin(totals.refeicao)}</div><div className={`text-[9px] ${muted}`}>Refeições</div></div>}
                    <div className={`ml-auto text-center border-l pl-6 ${dm?'border-gray-600':'border-gray-200'}`}>
                      <div className={`text-base font-semibold ${totals.over?'text-red-400':''}`}>{fmtMin(totals.total)}</div>
                      <div className={`text-[9px] ${muted}`}>Dia total</div>
                    </div>
                  </div>
                  {totals.over && <p className="text-red-400 text-[11px] font-medium mt-2">⚠️ Dia ultrapassa 12 horas de trabalho!</p>}
                </div>
              </div>

              {/* Elenco */}
              <div className={`border rounded-xl overflow-hidden ${card}`}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${dm?'border-gray-700':'border-gray-100'}`}>
                  <h2 className="text-sm font-semibold">Elenco convocado</h2>
                  <button onClick={addCast} className="text-xs px-3 py-1 bg-brand-500 text-white rounded-lg hover:bg-brand-600">+ Adicionar</button>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className={`border-b ${dm?'border-gray-700':'border-gray-100'}`}>
                      {['Personagem','Ator/Atriz','Cenas','Maquiagem','Chegada',''].map(h => (
                        <th key={h} className={`text-left px-3 py-2 text-[10px] font-medium uppercase ${muted}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(orderData.cast||[]).map(c => (
                      <tr key={c.id} className={`border-b ${dm?'border-gray-800':'border-gray-50'}`}>
                        {['character_name','actor_name','scenes','makeup_time','call_time'].map(field => (
                          <td key={field} className="px-3 py-2">
                            <input value={c[field]||''} onChange={e => setOrderData(prev => ({...prev, cast: prev.cast.map(x => x.id===c.id?{...x,[field]:e.target.value}:x)}))}
                              className={inputCls} />
                          </td>
                        ))}
                        <td className="px-2 py-2"><button onClick={() => removeCast(c.id)} className={`${muted} hover:text-red-400`}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Modal nova OD */}
      {showNewOD && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowNewOD(false)}>
          <div className={`rounded-xl border p-6 w-full max-w-md mx-4 ${dm?'bg-gray-900 border-gray-700':'bg-white border-gray-200'}`} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-4">Nova Ordem do Dia</h3>
            
            <div className="mb-4">
              <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1 ${muted}`}>Plano de filmagem</label>
              <select value={newODPlan} onChange={e => loadPlanDates(e.target.value)}
                className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${dm?'bg-gray-800 border-gray-700 text-gray-200':'bg-white border-gray-200 text-gray-700'}`}>
                <option value="">Selecione um plano...</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {newODPlan && (
              <div className="mb-4">
                <label className={`block text-[10px] font-semibold uppercase tracking-widest mb-1 ${muted}`}>Data de filmagem</label>
                {planDates.length === 0 ? (
                  <p className={`text-xs ${muted}`}>Nenhuma data encontrada neste plano. Adicione dias de filmagem no Stripboard primeiro.</p>
                ) : (
                  <select value={newODDate} onChange={e => onSelectDate(e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${dm?'bg-gray-800 border-gray-700 text-gray-200':'bg-white border-gray-200 text-gray-700'}`}>
                    <option value="">Selecione uma data...</option>
                    {[...planDates].sort((a,b) => (a.position??0)-(b.position??0)).map(d => {
                      const dateStr = d.date ? d.date.toString().split('T')[0] : '';
                      const [year, month, day] = dateStr.split('-');
                      const formatted = dateStr ? `${day}/${month}/${year}` : '—';
                      const sceneCount = (d.scenes || []).length;
                      return (
                        <option key={d.id} value={d.id}>
                          {formatted} — {sceneCount} cena{sceneCount !== 1 ? 's' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}

            {newODDate && (
              <div className={`mb-4 p-3 rounded-lg border ${dm?'bg-gray-800 border-gray-700':'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-widest ${muted}`}>Selecione as cenas do dia</p>
                  <div className="flex gap-2">
                    <button onClick={() => setSelectedSceneIds(scenes.map(s => s.id))} className="text-[10px] text-brand-400 hover:underline">Todas</button>
                    <button onClick={() => setSelectedSceneIds([])} className="text-[10px] text-gray-400 hover:underline">Nenhuma</button>
                  </div>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {scenes.map(s => (
                    <div key={s.id} onClick={() => setSelectedSceneIds(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${selectedSceneIds.includes(s.id) ? (dm?'bg-brand-500/20 border border-brand-500/40':'bg-brand-50 border border-brand-200') : (dm?'hover:bg-gray-700':'hover:bg-gray-100')}`}>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedSceneIds.includes(s.id) ? 'bg-brand-500 border-brand-500' : (dm?'border-gray-600':'border-gray-300')}`}>
                        {selectedSceneIds.includes(s.id) && <span className="text-white text-[8px]">✓</span>}
                      </div>
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-brand-500 text-white text-[9px] font-bold flex-shrink-0">{s.scene_number}</span>
                      <span className="text-xs truncate">{s.int_ext} · {s.location}</span>
                      <span className={`text-[10px] ml-auto flex-shrink-0 ${muted}`}>{s.day_night}</span>
                    </div>
                  ))}
                </div>
                <p className={`text-[10px] mt-2 ${muted}`}>{selectedSceneIds.length} cena{selectedSceneIds.length !== 1 ? 's' : ''} selecionada{selectedSceneIds.length !== 1 ? 's' : ''}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNewOD(false)} className={`px-4 py-2 text-xs border rounded-lg ${dm?'border-gray-700 text-gray-400':'border-gray-200 text-gray-500'}`}>Cancelar</button>
              <button onClick={createOrder} disabled={!newODDate || selectedSceneIds.length === 0}
                className="px-4 py-2 text-xs bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-40 transition-colors">
                Criar OD {selectedSceneIds.length > 0 ? `(${selectedSceneIds.length} cenas)` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal adicionar cena */}
      {showAddScene && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddScene(false)}>
          <div className={`rounded-xl border p-4 w-full max-w-lg mx-4 max-h-[70vh] overflow-y-auto ${dm?'bg-gray-900 border-gray-700':'bg-white border-gray-200'}`} onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-3">Adicionar cena</h3>
            <div className="space-y-1">
              {scenes.map(s => (
                <div key={s.id} onClick={() => addScene(s)} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${dm?'hover:bg-gray-800':'hover:bg-gray-50'}`}>
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-500 text-white text-[10px] font-bold flex-shrink-0">{s.scene_number}</span>
                  <div>
                    <div className="text-xs font-medium">{s.int_ext} · {s.location}</div>
                    <div className={`text-[10px] ${muted}`}>{s.day_night} · {(s.synopsis||'').substring(0,60)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
