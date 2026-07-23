// Évènements : mêmes gestes que les habitudes, mais ce que l'utilisateur encode ici ne
// dépend pas de lui (travail en présentiel, invités, garde d'enfant…). D'où deux
// différences assumées avec habits.js :
//   · aucun taux « respecté » n'est calculé — il n'y a rien à respecter ;
//   · aucun conseil (`focus`) n'en découle : on ne conseille pas de changer un fait subi.
// Il reste la mesure : chaque évènement suivi est corrélé à la durée de la nuit et à la
// forme du jour (voir buildCorrelations dans summary.js).
//
// Par entrée : id dans `events` = s'est produit, dans `eventsAbsent` = ne s'est pas
// produit, dans aucun des deux = non encodé. Même trichotomie que les habitudes.

// 1 = s'est produit · 0 = ne s'est pas produit · null = non encodé
function eventState(e, id) {
  if (!e) return null;
  if ((e.events       || []).includes(id)) return 1;
  if ((e.eventsAbsent || []).includes(id)) return 0;
  return null;
}

function renderEventsForm(evDone, evAbsent) {
  const el = document.getElementById('events-form-list');
  if (!el) return;
  const active = events.filter(v => v.tracked !== false);
  if (!active.length) {
    el.innerHTML = `<p style="font-size:0.78rem;color:var(--muted);margin:4px 0">${t('ev_none')}</p>`;
    return;
  }
  el.innerHTML = '';
  active.forEach(v => {
    const isYes = evDone   != null && evDone.includes(v.id);
    const isNo  = evAbsent != null && evAbsent.includes(v.id);
    const row = document.createElement('div');
    row.className = 'habit-row event-row';
    row.dataset.eid = v.id;
    row.innerHTML = `<span class="habit-label"><span>${v.name}</span></span>
      <div style="display:flex;gap:4px">
        <button class="habit-state-btn${isYes?' active-done':''}" data-state="done" onclick="toggleEventState(this,'done')" title="${t('ev_yes')}">✓</button>
        <button class="habit-state-btn${isNo?' active-notdone':''}" data-state="notdone" onclick="toggleEventState(this,'notdone')" title="${t('ev_no')}">✗</button>
      </div>`;
    el.appendChild(row);
  });
}

function toggleEventState(btn, state) {
  const row = btn.closest('.event-row');
  const yesBtn = row.querySelector('[data-state="done"]');
  const noBtn  = row.querySelector('[data-state="notdone"]');
  const isActive = btn.classList.contains(state === 'done' ? 'active-done' : 'active-notdone');
  yesBtn.classList.remove('active-done');
  noBtn.classList.remove('active-notdone');
  if (!isActive) btn.classList.add(state === 'done' ? 'active-done' : 'active-notdone');
  updatePreview();
}

function getEventStates() {
  const done = [], absent = [];
  document.querySelectorAll('#events-form-list .event-row[data-eid]').forEach(row => {
    const eid = row.dataset.eid;
    if (row.querySelector('[data-state="done"].active-done')) done.push(eid);
    else if (row.querySelector('[data-state="notdone"].active-notdone')) absent.push(eid);
  });
  return { done, absent };
}

let _dragEventId = null;

function _makeEventRow(v) {
  const row = document.createElement('div');
  row.className = 'habit-row event-row';
  row.draggable = true;
  const pencilSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const trashSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  row.innerHTML = `
    <span style="cursor:grab;color:var(--muted);padding-right:8px;font-size:1.1rem;user-select:none;flex-shrink:0">⠿</span>
    <span class="event-name-lbl" style="flex:1;font-size:0.85rem;color:var(--text)">${v.name}</span>
    <input class="event-name-inp" style="display:none;flex:1;font-size:0.85rem;padding:2px 6px;border:1.5px solid var(--primary-light);border-radius:4px;background:var(--card);color:var(--text);font-family:inherit" value="${v.name}">
    <button class="edit-btn event-rename-btn" title="${t('act_rename')}">${pencilSvg}</button>
    <label style="display:flex;align-items:center;gap:4px;font-size:0.72rem;color:var(--muted);flex-shrink:0;margin:0 8px">
      ${t('hb_impact')}
      <select class="event-impact-sel" style="font-size:0.72rem;border:1px solid var(--border);border-radius:4px;padding:1px 4px;background:var(--card);color:var(--text);cursor:pointer">
        <option value="same" ${(v.sleepImpact||'same')==='same'?'selected':''}>${t('hb_same')}</option>
        <option value="next" ${v.sleepImpact==='next'?'selected':''}>${t('hb_next')}</option>
      </select>
    </label>
    <button class="del-btn" onclick="deleteEvent('${v.id}')" title="${t('act_delete')}">${trashSvg}</button>`;
  row.querySelector('.event-impact-sel').addEventListener('change', async function() {
    v.sleepImpact = this.value; await saveEvents();
  });
  const lbl = row.querySelector('.event-name-lbl');
  const inp = row.querySelector('.event-name-inp');
  const renameBtn = row.querySelector('.event-rename-btn');
  async function commitRename() {
    const name = inp.value.trim();
    if (name && name !== v.name) { v.name = name; await saveEvents(); }
    lbl.textContent = v.name;
    inp.style.display = 'none'; lbl.style.display = '';
    renameBtn.style.display = ''; row.draggable = true;
    const es = getEventStates(); renderEventsForm(es.done, es.absent);
  }
  renameBtn.addEventListener('click', () => {
    inp.style.display = ''; lbl.style.display = 'none';
    renameBtn.style.display = 'none'; row.draggable = false;
    inp.focus(); inp.select();
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commitRename(); } if (e.key === 'Escape') { inp.value = v.name; commitRename(); } });
  inp.addEventListener('blur', commitRename);

  const clearDragOver = () => document.querySelectorAll('.event-row').forEach(r => r.classList.remove('drag-over'));
  row.addEventListener('dragstart', e => {
    _dragEventId = v.id;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => row.style.opacity = '0.4', 0);
  });
  row.addEventListener('dragend', () => { row.style.opacity = ''; clearDragOver(); });
  row.addEventListener('dragover', e => {
    e.preventDefault();
    if (_dragEventId === v.id) return;
    clearDragOver();
    row.classList.add('drag-over');
  });
  row.addEventListener('drop', async e => {
    e.preventDefault();
    clearDragOver();
    if (_dragEventId === v.id) return;
    const dragged = events.find(x => x.id === _dragEventId);
    if (!dragged) return;
    dragged.tracked = v.tracked !== false;
    events.splice(events.indexOf(dragged), 1);   // remove from old position
    const toIdx = events.indexOf(v);             // indices shifted by the splice above
    events.splice(toIdx < 0 ? events.length : toIdx, 0, dragged);
    await saveEvents();
    renderEventsManage();
    const es = getEventStates(); renderEventsForm(es.done, es.absent);
  });
  return row;
}

function _makeEventGroupHeader(label, targetTracked) {
  const hdr = document.createElement('div');
  hdr.className = 'habit-cat-header';
  hdr.textContent = label;
  hdr.addEventListener('dragover', e => { e.preventDefault(); hdr.style.outline = '2px solid var(--primary)'; });
  hdr.addEventListener('dragleave', () => { hdr.style.outline = ''; });
  hdr.addEventListener('drop', async e => {
    e.preventDefault();
    hdr.style.outline = '';
    const dragged = events.find(x => x.id === _dragEventId);
    if (!dragged) return;
    dragged.tracked = targetTracked;
    events.splice(events.indexOf(dragged), 1);
    const insertAt = targetTracked
      ? events.filter(x => x.tracked !== false).length
      : events.length;
    events.splice(insertAt, 0, dragged);
    await saveEvents();
    renderEventsManage();
    const es = getEventStates(); renderEventsForm(es.done, es.absent);
  });
  return hdr;
}

function renderEventsManage() {
  const el = document.getElementById('events-manage-list');
  if (!el) return;
  el.innerHTML = '';
  const tracked   = events.filter(v => v.tracked !== false);
  const untracked = events.filter(v => v.tracked === false);
  el.appendChild(_makeEventGroupHeader(t('ev_tracked'), true));
  tracked.forEach(v => el.appendChild(_makeEventRow(v)));
  el.appendChild(_makeEventGroupHeader(t('ev_untracked'), false));
  untracked.forEach(v => el.appendChild(_makeEventRow(v)));
}

async function addEvent() {
  const inp = document.getElementById('new-event-input');
  const name = inp.value.trim();
  if (!name) return;
  // sleepImpact 'same' par défaut : un évènement de la journée J pèse d'abord sur la
  // nuit J→J+1 qui la suit — l'inverse du réglage des habitudes, dont beaucoup (sport,
  // écrans) sont pensées comme préparant la nuit du lendemain.
  events.push({id: String(Date.now()), name, tracked: true, sleepImpact: 'same'});
  await saveEvents();
  inp.value = '';
  renderEventsManage();
  const es = getEventStates(); renderEventsForm(es.done, es.absent);
}

async function deleteEvent(id) {
  events = events.filter(v => v.id !== id);
  await saveEvents();
  renderEventsManage();
  const es = getEventStates(); renderEventsForm(es.done, es.absent);
}

// Frise des évènements — même grammaire visuelle que celle des habitudes, mais la case
// pleine est neutre (bleu) et non verte : un évènement n'est ni bien ni mal.
function renderEventsViz(days, targetId = 'events-viz', allDates = []) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const active = events.filter(v => v.tracked !== false);
  if (!active.length) {
    el.innerHTML = `<p style="font-size:0.82rem;color:var(--muted)">${t('ev_none_short')}</p>`;
    return;
  }
  const R = 'height:13px;margin-bottom:4px;display:flex;align-items:center;';
  let namesHtml = '', squaresHtml = '';
  active.forEach(v => {
    const squares = days.map((d, i) => {
      const st = eventState(d, v.id);
      const ds = allDates[i] || (days[i] && days[i].dateStr) || '';
      const dateLabel = ds ? new Date(ds+'T12:00:00').toLocaleDateString(t('locale'),{weekday:'short',day:'2-digit',month:'short'}) : '';
      const tip = dateLabel ? `${dateLabel} — ${st === 1 ? t('ev_yes') : st === 0 ? t('ev_no') : t('hb_notenc')}` : '';
      if (st === null) return `<div class="habits-viz-sq" style="background:transparent;border:1px solid var(--border);opacity:0.3" title="${tip}"></div>`;
      if (st === 1)    return `<div class="habits-viz-sq" style="background:var(--primary-light)" title="${tip}"></div>`;
      return `<div class="habits-viz-sq" style="background:transparent;border:1px solid var(--muted)" title="${tip}"></div>`;
    }).join('');
    namesHtml   += `<div style="${R}width:300px;min-width:0;" title="${v.name}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;font-size:0.75rem;font-weight:500;color:var(--text)">${v.name}</span></div>`;
    squaresHtml += `<div style="${R}gap:2px;flex-wrap:nowrap">${squares}</div>`;
  });
  el.innerHTML = `<div style="display:flex;gap:8px;align-items:flex-start">
      <div style="width:300px;flex-shrink:0;min-width:0">${namesHtml}</div>
      <div id="events-viz-scroll" style="overflow-x:auto;flex:1;padding-bottom:4px">${squaresHtml}</div>
    </div>
    <div style="display:flex;gap:14px;margin-top:10px;font-size:0.72rem;color:var(--muted);flex-wrap:wrap">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--primary-light);margin-right:4px;vertical-align:middle"></span>${t('ev_yes')}</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;border:1px solid var(--muted);margin-right:4px;vertical-align:middle"></span>${t('ev_no')}</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;border:1px solid var(--border);opacity:0.4;margin-right:4px;vertical-align:middle"></span>${t('hb_notenc')}</span>
    </div>`;
  requestAnimationFrame(() => {
    const sc = document.getElementById('events-viz-scroll');
    if (sc) sc.scrollLeft = sc.scrollWidth;
  });
}
