// Onglet Historique : une ligne par jour sur un axe de dates continu.
function renderHistory() {
  const el = document.getElementById('hist-list');
  if (!entries.length) {
    el.innerHTML = `<div class="empty-state"><p>🌙</p><p>${t('empty_h1')}</p><p style="margin-top:6px;font-size:0.82rem">${t('empty_h2')}</p></div>`;
    return;
  }

  function shortDate(ds) {
    const d = new Date(ds+'T12:00:00');
    return d.toLocaleDateString(t('locale'),{weekday:'short',day:'2-digit',month:'2-digit'});
  }

  const editSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const delSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

  const legend = `<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:0.72rem;color:var(--muted);margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);align-items:center">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:20px;height:9px;display:inline-block;background:repeating-linear-gradient(45deg,#3d5a80,#3d5a80 2px,#5b8dbf 2px,#5b8dbf 4px);border-radius:2px"></span>Sommeil</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:20px;height:9px;display:inline-block;background:repeating-linear-gradient(45deg,#8ecae6,#8ecae6 2px,#b8daed 2px,#b8daed 4px);border-radius:2px"></span>Demi-sommeil</span>
    <span><span class="arr">↓</span> Mise au lit &nbsp;<span class="arr">↑</span> Lever</span>
  </div>`;

  // Largeurs de colonnes : partagées par l'en-tête, les lignes encodées et les
  // lignes vides. Si elles divergent, la graduation des heures ne tombe plus en
  // face des barres.
  const W = { date: '80px', notes: '90px' };
  // Les heures de début/fin sont centrées sur les bords de la timeline
  // (translateX(-50%)) : la moitié de l'étiquette déborde donc de sa colonne.
  // L'écart entre colonnes doit rester plus large que ce débord, sinon elles se
  // chevauchent. Même valeur pour l'en-tête, la graduation et toutes les lignes.
  const GAP = '20px';

  // Axe de dates continu, du plus récent au plus ancien : une nuit non encodée
  // doit apparaître comme telle, sinon elle disparaît sans laisser de trace et
  // deux dates éloignées se retrouvent collées l'une sous l'autre.
  const byDate = {};
  entries.forEach(e => byDate[e.dateStr] = e);
  const dates = entries.map(e => e.dateStr).sort();
  const allDates = [];
  { const c = new Date(dates[0]+'T12:00:00'), end = new Date(dates[dates.length-1]+'T12:00:00');
    while (c <= end) { allDates.push(c.toISOString().split('T')[0]); c.setDate(c.getDate()+1); }
    allDates.reverse(); }

  // Colonnes du pied et de l'en-tête : mêmes largeurs partout, sinon la
  // graduation des heures ne tombe plus en face des barres.
  const spacer = `<button class="edit-btn" style="visibility:hidden;pointer-events:none" aria-hidden="true">${editSvg}</button>`
               + `<button class="del-btn" style="visibility:hidden;pointer-events:none" aria-hidden="true">${delSvg}</button>`;

  const emptyRow = ds => `
      <div style="display:flex;align-items:center;gap:${GAP};padding:4px 0;opacity:0.45">
        <div class="hx-date" style="width:${W.date};font-size:0.76rem;font-weight:600;flex-shrink:0;white-space:nowrap">${shortDate(ds)}</div>
        <div style="flex:1;min-width:50px;height:41px;display:flex;align-items:center;gap:8px">
          <div style="flex:1;border-top:1px dashed var(--border)"></div>
          <span style="font-size:0.72rem;color:var(--muted);white-space:nowrap;font-style:italic">${t('hx_none')}</span>
          <div style="flex:1;border-top:1px dashed var(--border)"></div>
        </div>
        <div class="hx-notes" style="width:${W.notes};flex-shrink:0"></div>
        ${spacer}
      </div>`;

  const rows = allDates.map(ds => {
    const e = byDate[ds];
    if (!e) return emptyRow(ds);
    return `
      <div style="display:flex;align-items:center;gap:${GAP};padding:4px 0">
        <div class="hx-date" style="width:${W.date};font-size:0.76rem;font-weight:600;flex-shrink:0;white-space:nowrap">${shortDate(e.dateStr)}</div>
        <div id="ht-${e.id}" style="flex:1;min-width:50px;position:relative;height:41px;overflow:visible"></div>
        <div class="hx-notes" style="width:${W.notes};flex-shrink:0;font-size:0.72rem;color:var(--muted);font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default" title="${(e.notes||'').replace(/"/g,'&quot;')}">${e.notes?'📝 '+e.notes:'/'}</div>
        <button class="edit-btn" onclick="editEntry(${e.id})" title="Modifier">${editSvg}</button>
        <button class="del-btn" data-id="${e.id}" onclick="deleteEntry(${e.id})" title="Supprimer">${delSvg}</button>
      </div>`;
  }).join('');

  const pct = h => `${(h/24*100).toFixed(2)}%`;
  // Toutes les heures, comme les aperçus du Tableau de bord et de la Saisie ; les
  // multiples de 4 restent plus lisibles pour garder des repères.
  let hourLbls = '';
  for (let h = 0; h <= 24; h++) {
    const hour = (20 + h) % 24;
    const major = h % 4 === 0;
    hourLbls += `<div style="position:absolute;left:${pct(h)};transform:translateX(-50%);font-size:${major?'0.58':'0.48'}rem;color:var(--muted);font-weight:${major?'600':'400'};white-space:nowrap">${hour}h</div>`;
  }
  // Noms de colonnes, puis la graduation des heures juste en dessous.
  const th = 'font-size:0.64rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;flex-shrink:0';
  const colHeader = `<div style="display:flex;align-items:flex-end;gap:${GAP};padding:0 0 4px">
    <div class="hx-date" style="width:${W.date};${th}">${t('hx_date')}</div>
    <div style="flex:1;min-width:50px;${th}">${t('hx_night')}</div>
    <div class="hx-notes" style="width:${W.notes};${th}">${t('hx_notes')}</div>
    ${spacer}
  </div>`;

  const hourHeader = `<div style="display:flex;align-items:center;gap:${GAP};padding:0 0 2px">
    <div class="hx-date" style="width:${W.date};flex-shrink:0"></div>
    <div style="flex:1;min-width:50px;position:relative;height:14px;overflow:visible">${hourLbls}</div>
    <div class="hx-notes" style="width:${W.notes};flex-shrink:0"></div>
    ${spacer}
  </div>`;
  el.innerHTML = legend + colHeader + hourHeader + `<div>${rows}</div>`;
  allDates.forEach(ds => { const e = byDate[ds]; if (e) renderTLCompact(e, `ht-${e.id}`, { showTimes: true }); });
}

// ---- Stats ----
