// lib/exports.js
// Funções de exportação: CSV, XLSX, PDF, JSON

import * as XLSX from 'xlsx';

export function exportCSV(scenes, title = 'breakdown') {
  const headers = [
    'Cena','Flashback','INT/EXT','Locação','Set','Período',
    'Personagens','Sinopse','Props','Figurino','VFX','Veículos','Extras','Páginas'
  ];
  const rows = scenes.map((s) => [
    s.scene_number, s.is_flashback ? 'SIM' : 'NÃO',
    s.int_ext, s.location, s.set_name || '', s.day_night,
    (s.characters||[]).join('; '), s.synopsis||'',
    (s.props||[]).join('; '), (s.wardrobe||[]).join('; '),
    (s.vfx||[]).join('; '), (s.vehicles||[]).join('; '),
    (s.extras||[]).join('; '), s.estimated_pages||1,
  ]);
  const csv = '\uFEFF' + [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v??'').replace(/"/g,'""')}"`).join(','))
    .join('\n');
  dl(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${slug(title)}.csv`);
}

export function exportXLSX(scenes, title = 'breakdown') {
  const data = [
    ['Cena','FB','I/E','Locação','Set','Período','Personagens','Sinopse',
     'Props','Figurino','VFX','Veículos','Extras','Págs'],
    ...scenes.map((s) => [
      s.scene_number, s.is_flashback?'SIM':'',
      s.int_ext, s.location, s.set_name||'', s.day_night,
      (s.characters||[]).join(', '), s.synopsis||'',
      (s.props||[]).join(', '), (s.wardrobe||[]).join(', '),
      (s.vfx||[]).join(', '), (s.vehicles||[]).join(', '),
      (s.extras||[]).join(', '), s.estimated_pages||1,
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    {wch:6},{wch:5},{wch:8},{wch:22},{wch:18},{wch:10},
    {wch:28},{wch:40},{wch:25},{wch:20},{wch:18},{wch:15},{wch:20},{wch:7},
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Breakdown');

  const lc = {};
  scenes.forEach((s) => { lc[s.location] = (lc[s.location]||0)+1; });
  const wsL = XLSX.utils.aoa_to_sheet([['Locação','Cenas'],...Object.entries(lc).sort((a,b)=>b[1]-a[1])]);
  wsL['!cols'] = [{wch:28},{wch:10}];
  XLSX.utils.book_append_sheet(wb, wsL, 'Por Locação');

  const cc = {};
  scenes.forEach((s) => (s.characters||[]).forEach((c) => { cc[c]=(cc[c]||0)+1; }));
  const wsC = XLSX.utils.aoa_to_sheet([['Personagem','Cenas'],...Object.entries(cc).sort((a,b)=>b[1]-a[1])]);
  wsC['!cols'] = [{wch:22},{wch:10}];
  XLSX.utils.book_append_sheet(wb, wsC, 'Por Personagem');

  XLSX.writeFile(wb, `${slug(title)}.xlsx`);
}

export function exportPDF(scenes, title = 'Roteiro') {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8"><title>${title} — Breakdown</title>
<style>
body{font-family:Arial,sans-serif;font-size:9px;margin:15px;color:#111}
h1{font-size:14px;margin-bottom:4px}p.sub{font-size:10px;color:#555;margin-bottom:10px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 5px;text-align:left;vertical-align:top}
th{background:#e8e8e8;font-weight:bold;font-size:8px}tr:nth-child(even){background:#f8f8f8}tr.fb{background:#f0eefa!important}
@media print{@page{size:A3 landscape;margin:8mm}}
</style></head><body>
<h1>${title} — Script Breakdown</h1>
<p class="sub">${scenes.length} cenas · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
<table><thead><tr>
<th>Cena</th><th>I/E</th><th>Locação</th><th>Set</th><th>Período</th>
<th>Personagens</th><th>Sinopse</th><th>Props</th><th>Figurino</th>
<th>VFX</th><th>Veículos</th><th>Extras</th><th>Págs</th>
</tr></thead><tbody>
${scenes.map((s) => `<tr class="${s.is_flashback?'fb':''}">
<td>${s.is_flashback?'[FB] ':''}#${s.scene_number}</td>
<td>${s.int_ext}</td><td>${s.location}</td><td>${s.set_name||''}</td>
<td>${s.day_night}</td><td>${(s.characters||[]).join(', ')}</td>
<td>${s.synopsis||''}</td>
<td>${(s.props||[]).join(', ')}</td><td>${(s.wardrobe||[]).join(', ')}</td>
<td>${(s.vfx||[]).join(', ')}</td><td>${(s.vehicles||[]).join(', ')}</td>
<td>${(s.extras||[]).join(', ')}</td><td>${s.estimated_pages}</td>
</tr>`).join('')}
</tbody></table></body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

export function exportODPDF(order, scenes, items, cast, project, planName) {
  function toMin(t) { if (!t || !t.includes(':')) return null; const [h,m]=t.split(':').map(Number); return h*60+m; }
  function diffMin(a,b) { const ma=toMin(a),mb=toMin(b); if(ma===null||mb===null||mb<=ma) return null; return mb-ma; }
  function fmtMin(m) { if(!m) return '—'; const h=Math.floor(m/60),mn=m%60; return h>0?h+'h'+String(mn).padStart(2,'0'):mn+'min'; }

  const ITEM_LABELS = { desl:'Deslocamento', almoco:'Almoço', lanche:'Lanche', jantar:'Jantar', desp_geral:'Desprodução Geral' };
  const ITEM_ICONS = { desl:'🚐', almoco:'🍽️', lanche:'☕', jantar:'🌙', desp_geral:'📦' };

  let totP=0, totF=0, totD=0, totDesl=0, totRef=0;
  (scenes||[]).forEach(s => {
    const p=diffMin(s.prep_start,s.prep_end), f=diffMin(s.shoot_start,s.shoot_end), w=diffMin(s.wrap_start,s.wrap_end);
    if(p) totP+=p; if(f) totF+=f; if(w) totD+=w;
  });
  (items||[]).forEach(it => {
    const d=diffMin(it.time_start,it.time_end);
    if(!d) return;
    if(it.type==='desl') totDesl+=d; else totRef+=d;
  });
  const totalGeral = totP+totF+totD+totDesl+totRef;
  const overLimit = totalGeral > 720;

  const dateStr = order?.date ? (() => { const [y,m,d] = order.date.toString().split('T')[0].split('-'); return `${d}/${m}/${y}`; })() : '—';

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8"><title>Ordem do Dia — ${project?.title||''}</title>
<style>
body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}
h1{font-size:18px;margin-bottom:2px}
p.sub{font-size:11px;color:#555;margin-bottom:14px}
.section{margin-bottom:16px}
.section-title{font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.05em;color:#444;border-bottom:1px solid #ccc;padding-bottom:4px;margin-bottom:8px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px 20px}
.field label{display:block;font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.05em}
.field span{font-size:12px;font-weight:600}
table{width:100%;border-collapse:collapse;margin-top:6px}
th,td{border:1px solid #ddd;padding:5px 6px;text-align:left;vertical-align:top;font-size:10px}
th{background:#f0f0f0;font-weight:bold;font-size:9px;text-transform:uppercase}
.scene-num{font-weight:bold;color:#185FA5}
.badge{display:inline-block;padding:1px 5px;border-radius:3px;font-size:8px;font-weight:bold;margin-right:3px}
.b-ext{background:#FCEBEB;color:#A32D2D}.b-int{background:#E1F5EE;color:#085041}
.b-period{background:#E6F1FB;color:#0C447C}
.item-row td{background:#FAEEDA}
.totais{display:flex;gap:20px;margin-top:10px;padding:10px;background:#f5f5f5;border-radius:4px}
.totais.over{background:#fde8e8}
.total-item{text-align:center}
.total-item .val{font-size:14px;font-weight:bold}
.total-item .lbl{font-size:8px;color:#888;text-transform:uppercase}
.alert{color:#A32D2D;font-weight:bold;font-size:10px;margin-top:6px}
@media print{@page{size:A4 portrait;margin:12mm}}
</style></head><body>
<h1>Ordem do Dia</h1>
<p class="sub">${project?.title||''} ${planName?'· '+planName:''} · Dia ${order?.day_number||1} · ${dateStr}</p>

<div class="section">
  <div class="section-title">Identificação</div>
  <div class="grid">
    <div class="field"><label>Chegada da equipe</label><span>${order?.call_time||'—'}</span></div>
    <div class="field"><label>Início das filmagens</label><span>${order?.shoot_start||'—'}</span></div>
    <div class="field"><label>Locação principal</label><span>${order?.location||'—'}</span></div>
    <div class="field"><label>Endereço</label><span>${order?.address||'—'}</span></div>
    <div class="field"><label>Ponto de encontro</label><span>${order?.meeting_point||'—'}</span></div>
    <div class="field"><label>Contato na locação</label><span>${order?.location_contact||'—'}</span></div>
  </div>
</div>

<div class="section">
  <div class="section-title">Cenas do dia</div>
  <table><thead><tr>
    <th style="width:30px">#</th><th>Locação</th><th>Sinopse</th>
    <th style="width:90px">Preparação</th><th style="width:90px">Filmagem</th><th style="width:90px">Desprodução</th>
  </tr></thead><tbody>
${(scenes||[]).map(s => `<tr>
<td class="scene-num">#${s.scene_number}</td>
<td><span class="badge ${s.int_ext==='EXT'?'b-ext':'b-int'}">${s.int_ext}</span><span class="badge b-period">${s.period}</span><br/><b>${s.location}</b></td>
<td>${s.synopsis||''}</td>
<td>${s.prep_start||'—'} → ${s.prep_end||'—'}</td>
<td>${s.shoot_start||'—'} → ${s.shoot_end||'—'}</td>
<td>${s.wrap_start||'—'} → ${s.wrap_end||'—'}</td>
</tr>`).join('')}
${(items||[]).map(it => `<tr class="item-row"><td colspan="6">
${ITEM_ICONS[it.type]||''} <b>${ITEM_LABELS[it.type]||it.type}</b>
${it.type==='desl' ? ` — ${it.from_loc||''} → ${it.to_loc||''}` : ''}
&nbsp;&nbsp;${it.time_start||'—'} → ${it.time_end||'—'}
</td></tr>`).join('')}
  </tbody></table>

  <div class="totais ${overLimit?'over':''}">
    <div class="total-item"><div class="val">${fmtMin(totP)}</div><div class="lbl">Preparação</div></div>
    <div class="total-item"><div class="val">${fmtMin(totF)}</div><div class="lbl">Filmagem</div></div>
    <div class="total-item"><div class="val">${fmtMin(totD)}</div><div class="lbl">Desprodução</div></div>
    ${totDesl>0?`<div class="total-item"><div class="val">${fmtMin(totDesl)}</div><div class="lbl">Deslocamento</div></div>`:''}
    ${totRef>0?`<div class="total-item"><div class="val">${fmtMin(totRef)}</div><div class="lbl">Refeições</div></div>`:''}
    <div class="total-item" style="margin-left:auto"><div class="val">${fmtMin(totalGeral)}</div><div class="lbl">Dia total</div></div>
  </div>
  ${overLimit?'<p class="alert">⚠️ Atenção: dia ultrapassa 12 horas de trabalho!</p>':''}
</div>

${(cast||[]).length>0?`<div class="section">
  <div class="section-title">Elenco convocado</div>
  <table><thead><tr><th>Personagem</th><th>Ator/Atriz</th><th>Cenas</th><th>Maquiagem</th><th>Chegada</th></tr></thead>
  <tbody>${cast.map(c=>`<tr><td>${c.character_name||''}</td><td>${c.actor_name||''}</td><td>${c.scenes||''}</td><td>${c.makeup_time||''}</td><td>${c.call_time||''}</td></tr>`).join('')}</tbody>
  </table>
</div>`:''}

${order?.notes?`<div class="section">
  <div class="section-title">Observações gerais</div>
  <p>${order.notes}</p>
</div>`:''}

</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

export function exportStripboardPDF(visibleItems, project, planName) {
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const s = dateStr.toString().split('T')[0];
    const [y,m,d] = s.split('-');
    return d ? `${d}/${m}/${y}` : '—';
  }

  const rowsHtml = visibleItems.map(item => {
    if (item.kind === 'day') {
      return `<tr class="day-row"><td colspan="6">📅 <b>DIA DE FILMAGEM</b> — ${formatDate(item.data.date)}</td></tr>`;
    }
    if (item.kind === 'item') {
      const d = item.data;
      const icons = { banner:'🎬', visual_ref:'🖼️', map_link:'📍', note:'📝' };
      return `<tr class="item-row"><td colspan="6">${icons[d.type]||'📌'} ${d.text||''}</td></tr>`;
    }
    const s = item.data;
    return `<tr class="${s.is_flashback?'fb':''}">
<td class="scene-num">${s.is_flashback?'[FB] ':''}#${s.scene_number}</td>
<td><span class="badge ${s.int_ext==='EXT'?'b-ext':'b-int'}">${s.int_ext}</span></td>
<td><b>${s.location}</b>${s.set_name?'<br/><span class="muted">'+s.set_name+'</span>':''}</td>
<td>${s.day_night}</td>
<td>${(s.characters||[]).join(', ')}</td>
<td>${s.synopsis||''}</td>
</tr>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="utf-8"><title>Stripboard — ${project?.title||''}</title>
<style>
body{font-family:Arial,sans-serif;font-size:10px;margin:18px;color:#111}
h1{font-size:16px;margin-bottom:2px}
p.sub{font-size:10px;color:#555;margin-bottom:14px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #ddd;padding:5px 6px;text-align:left;vertical-align:top}
th{background:#e8e8e8;font-weight:bold;font-size:9px;text-transform:uppercase}
tr.fb{background:#f3eefa}
.scene-num{font-weight:bold;color:#185FA5;white-space:nowrap}
.badge{display:inline-block;padding:1px 5px;border-radius:3px;font-size:8px;font-weight:bold}
.b-ext{background:#FCEBEB;color:#A32D2D}.b-int{background:#E1F5EE;color:#085041}
.muted{color:#888;font-size:9px}
.day-row td{background:#e3f2e8;font-weight:bold;color:#0a5c2a;padding:7px}
.item-row td{background:#fdf3da;font-style:italic;padding:6px}
@media print{@page{size:A4 landscape;margin:10mm}}
</style></head><body>
<h1>Stripboard</h1>
<p class="sub">${project?.title||''} ${planName?'· '+planName:''} · gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
<table><thead><tr>
<th style="width:50px">Cena</th><th style="width:40px">I/E</th><th>Locação / Set</th><th style="width:70px">Período</th><th>Personagens</th><th>Sinopse</th>
</tr></thead><tbody>
${rowsHtml}
</tbody></table>
</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

export function exportJSON(scenes, project) {
  dl(
    new Blob([JSON.stringify({ ...project, scenes }, null, 2)], { type: 'application/json' }),
    `${slug(project?.title||'breakdown')}.json`
  );
}

function dl(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function slug(s) {
  return (s||'breakdown')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
