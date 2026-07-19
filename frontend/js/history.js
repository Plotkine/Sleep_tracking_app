// History tab: one row per day on a continuous date axis.
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
    <span style="display:flex;align-items:center;gap:4px"><span style="width:20px;height:9px;display:inline-block;background:repeating-linear-gradient(45deg,#3d5a80,#3d5a80 2px,#5b8dbf 2px,#5b8dbf 4px);border-radius:2px"></span>${t('tl_sleep')}</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:20px;height:9px;display:inline-block;background:repeating-linear-gradient(45deg,#8ecae6,#8ecae6 2px,#b8daed 2px,#b8daed 4px);border-radius:2px"></span>${t('tl_half')}</span>
    <span>${t('tl_markers')}</span>
  </div>`;

  // Column widths: shared by the header, the recorded rows and the empty ones. If
  // they drift apart, the hour ruler no longer lines up with
  // face des barres.
  const W = { date: '80px', notes: '90px' };
  // Start/end times are centred on the timeline edges (translateX(-50%)), so half of
  // each label spills out of its column. The gap between columns must stay wider than
  // that overhang, otherwise they overlap. Same value for the header, the ruler and
  // every row.
  const GAP = '20px';

  // Continuous date axis, newest first: an unrecorded night must show up as such,
  // otherwise it vanishes without trace and
  // deux dates éloignées se retrouvent collées l'une sous l'autre.
  const byDate = {};
  entries.forEach(e => byDate[e.dateStr] = e);
  const dates = entries.map(e => e.dateStr).sort();
  const allDates = [];
  { const c = new Date(dates[0]+'T12:00:00'), end = new Date(dates[dates.length-1]+'T12:00:00');
    while (c <= end) { allDates.push(c.toISOString().split('T')[0]); c.setDate(c.getDate()+1); }
    allDates.reverse(); }

  // Footer and header columns: identical widths everywhere, otherwise the hour ruler
  // stops falling opposite the bars.
  const spacer = `<button class="edit-btn" style="visibility:hidden;pointer-events:none" aria-hidden="true">${editSvg}</button>`
               + `<button class="del-btn" style="visibility:hidden;pointer-events:none" aria-hidden="true">${delSvg}</button>`;

  // Une saisie rapide ne porte qu'une durée totale : il n'y a aucun horaire à
  // dessiner, et une barre vide laissait croire à une nuit sans sommeil.
  const dashedRow = (ds, text, dim, tail) => `
      <div style="display:flex;align-items:center;gap:${GAP};padding:4px 0${dim ? ';opacity:0.45' : ''}">
        <div class="hx-date" style="width:${W.date};font-size:0.76rem;font-weight:600;flex-shrink:0;white-space:nowrap">${shortDate(ds)}</div>
        <div style="flex:1;min-width:50px;height:41px;display:flex;align-items:center;gap:8px">
          <div style="flex:1;border-top:1px dashed var(--border)"></div>
          <span style="font-size:0.72rem;color:var(--muted);white-space:nowrap;font-style:italic">${text}</span>
          <div style="flex:1;border-top:1px dashed var(--border)"></div>
        </div>
        ${tail}
      </div>`;

  const emptyRow = ds => dashedRow(ds, t('hx_none'), true,
    `<div class="hx-notes" style="width:${W.notes};flex-shrink:0"></div>${spacer}`);

  const rows = allDates.map(ds => {
    const e = byDate[ds];
    if (!e) return emptyRow(ds);
    if (e.quickDuration != null) {
      const notes = `<div class="hx-notes" style="width:${W.notes};flex-shrink:0;font-size:0.72rem;color:var(--muted);font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default" title="${(e.notes||'').replace(/"/g,'&quot;')}">${e.notes?'📝 '+e.notes:'/'}</div>`
        + `<button class="edit-btn" onclick="editEntry(${e.id})" title="${t('act_edit')}">${editSvg}</button>`
        + `<button class="del-btn" data-id="${e.id}" onclick="deleteEntry(${e.id})" title="${t('act_delete')}">${delSvg}</button>`;
      return dashedRow(e.dateStr, t('hx_quick')(fmtH(e.quickDuration)), false, notes);
    }
    return `
      <div style="display:flex;align-items:center;gap:${GAP};padding:4px 0">
        <div class="hx-date" style="width:${W.date};font-size:0.76rem;font-weight:600;flex-shrink:0;white-space:nowrap">${shortDate(e.dateStr)}</div>
        <div id="ht-${e.id}" style="flex:1;min-width:50px;position:relative;height:41px;overflow:visible"></div>
        <div class="hx-notes" style="width:${W.notes};flex-shrink:0;font-size:0.72rem;color:var(--muted);font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:default" title="${(e.notes||'').replace(/"/g,'&quot;')}">${e.notes?'📝 '+e.notes:'/'}</div>
        <button class="edit-btn" onclick="editEntry(${e.id})" title="${t('act_edit')}">${editSvg}</button>
        <button class="del-btn" data-id="${e.id}" onclick="deleteEntry(${e.id})" title="${t('act_delete')}">${delSvg}</button>
      </div>`;
  }).join('');

  const pct = h => `${(h/24*100).toFixed(2)}%`;
  // Every hour, like the Dashboard and Entry previews; multiples of 4 stay more
  // prominent to keep landmarks.
  let hourLbls = '';
  for (let h = 0; h <= 24; h++) {
    const hour = (20 + h) % 24;
    const major = h % 4 === 0;
    hourLbls += `<div style="position:absolute;left:${pct(h)};transform:translateX(-50%);font-size:${major?'0.58':'0.48'}rem;color:var(--muted);font-weight:${major?'600':'400'};white-space:nowrap">${fmtHourTick(hour)}</div>`;
  }
  // Column names, then the hour ruler just below.
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
  const rotateHint = `<div class="rotate-hint"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="10.5" y1="18.5" x2="13.5" y2="18.5"/></svg><span>${t('rotate_hint')}</span></div>`;
  el.innerHTML = rotateHint + legend + colHeader + hourHeader + `<div>${rows}</div>`;
  allDates.forEach(ds => { const e = byDate[ds]; if (e && e.quickDuration == null) renderTLCompact(e, `ht-${e.id}`, { showTimes: true }); });
}

// ---- Stats ----
