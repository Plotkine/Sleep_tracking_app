// Habitudes : création/édition/ordre, et les trois rendus (Saisie, gestion, carrés).
function renderHabitsForm(habitsDone, habitsNotDone) {
  const el = document.getElementById('habits-form-list');
  if (!el) return;
  const active = habits.filter(h => h.tracked !== false);
  if (!active.length) {
    el.innerHTML = '<p style="font-size:0.78rem;color:var(--muted);margin:4px 0">Aucune habitude suivie. Gérez-les dans l\'onglet Habitudes.</p>';
    return;
  }
  el.innerHTML = '';
  active.forEach(h => {
    const isDone    = habitsDone    != null && habitsDone.includes(h.id);
    const isNotDone = habitsNotDone != null && habitsNotDone.includes(h.id);
    const row = document.createElement('div');
    row.className = 'habit-row';
    row.dataset.hid = h.id;
    row.innerHTML = `<span class="habit-label"><span>${h.name}</span></span>
      <div style="display:flex;gap:4px">
        <button class="habit-state-btn${isDone?' active-done':''}" data-state="done" onclick="toggleHabitState(this,'done')" title="Fait">✓</button>
        <button class="habit-state-btn${isNotDone?' active-notdone':''}" data-state="notdone" onclick="toggleHabitState(this,'notdone')" title="Non fait">✗</button>
      </div>`;
    el.appendChild(row);
  });
}

function toggleHabitState(btn, state) {
  const row = btn.closest('.habit-row');
  const doneBtn    = row.querySelector('[data-state="done"]');
  const notDoneBtn = row.querySelector('[data-state="notdone"]');
  const isActive = btn.classList.contains(state === 'done' ? 'active-done' : 'active-notdone');
  doneBtn.classList.remove('active-done');
  notDoneBtn.classList.remove('active-notdone');
  if (!isActive) btn.classList.add(state === 'done' ? 'active-done' : 'active-notdone');
  updatePreview();
}

function getHabitStates() {
  const done = [], notDone = [];
  document.querySelectorAll('#habits-form-list .habit-row[data-hid]').forEach(row => {
    const hid = row.dataset.hid;
    if (row.querySelector('[data-state="done"].active-done')) done.push(hid);
    else if (row.querySelector('[data-state="notdone"].active-notdone')) notDone.push(hid);
  });
  return { done, notDone };
}

let _dragHabitId = null;

function _makeHabitRow(h) {
  const row = document.createElement('div');
  row.className = 'habit-row';
  row.draggable = true;
  const pencilSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const trashSvg  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  row.innerHTML = `
    <span style="cursor:grab;color:var(--muted);padding-right:8px;font-size:1.1rem;user-select:none;flex-shrink:0">⠿</span>
    <span class="habit-name-lbl" style="flex:1;font-size:0.85rem;color:var(--text)">${h.name}</span>
    <input class="habit-name-inp" style="display:none;flex:1;font-size:0.85rem;padding:2px 6px;border:1.5px solid var(--primary-light);border-radius:4px;background:var(--card);color:var(--text);font-family:inherit" value="${h.name}">
    <button class="edit-btn habit-rename-btn" title="Renommer">${pencilSvg}</button>
    <label style="display:flex;align-items:center;gap:4px;font-size:0.72rem;color:var(--muted);flex-shrink:0;margin:0 8px">
      Impact nuit
      <select class="habit-impact-sel" style="font-size:0.72rem;border:1px solid var(--border);border-radius:4px;padding:1px 4px;background:var(--card);color:var(--text);cursor:pointer">
        <option value="next" ${(h.sleepImpact||'next')==='next'?'selected':''}>J+1</option>
        <option value="same" ${h.sleepImpact==='same'?'selected':''}>J</option>
      </select>
    </label>
    <button class="del-btn" onclick="deleteHabit('${h.id}')" title="Supprimer">${trashSvg}</button>`;
  row.querySelector('.habit-impact-sel').addEventListener('change', async function() {
    h.sleepImpact = this.value; await saveHabits();
  });
  const lbl = row.querySelector('.habit-name-lbl');
  const inp = row.querySelector('.habit-name-inp');
  const renameBtn = row.querySelector('.habit-rename-btn');
  async function commitRename() {
    const name = inp.value.trim();
    if (name && name !== h.name) { h.name = name; await saveHabits(); }
    lbl.textContent = h.name;
    inp.style.display = 'none'; lbl.style.display = '';
    renameBtn.style.display = ''; row.draggable = true;
    renderHabitsForm(...Object.values(getHabitStates()));
  }
  renameBtn.addEventListener('click', () => {
    inp.style.display = ''; lbl.style.display = 'none';
    renameBtn.style.display = 'none'; row.draggable = false;
    inp.focus(); inp.select();
  });
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commitRename(); } if (e.key === 'Escape') { inp.value = h.name; commitRename(); } });
  inp.addEventListener('blur', commitRename);

  row.addEventListener('dragstart', e => {
    _dragHabitId = h.id;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => row.style.opacity = '0.4', 0);
  });
  row.addEventListener('dragend', () => {
    row.style.opacity = '';
    document.querySelectorAll('.habit-row').forEach(r => r.classList.remove('drag-over'));
  });
  row.addEventListener('dragover', e => {
    e.preventDefault();
    if (_dragHabitId === h.id) return;
    document.querySelectorAll('.habit-row').forEach(r => r.classList.remove('drag-over'));
    row.classList.add('drag-over');
  });
  row.addEventListener('drop', async e => {
    e.preventDefault();
    document.querySelectorAll('.habit-row').forEach(r => r.classList.remove('drag-over'));
    if (_dragHabitId === h.id) return;
    const dragged = habits.find(x => x.id === _dragHabitId);
    if (!dragged) return;
    dragged.tracked = h.tracked !== false;
    habits.splice(habits.indexOf(dragged), 1);      // remove from old position
    const toIdx = habits.indexOf(h);               // find target (indices shifted after splice)
    habits.splice(toIdx < 0 ? habits.length : toIdx, 0, dragged);
    await saveHabits();
    renderHabitsManage();
    const hs = getHabitStates(); renderHabitsForm(hs.done, hs.notDone);
  });
  return row;
}

function _makeGroupHeader(label, targetTracked) {
  const hdr = document.createElement('div');
  hdr.className = 'habit-cat-header';
  hdr.textContent = label;
  hdr.addEventListener('dragover', e => { e.preventDefault(); hdr.style.outline = '2px solid var(--primary)'; });
  hdr.addEventListener('dragleave', () => { hdr.style.outline = ''; });
  hdr.addEventListener('drop', async e => {
    e.preventDefault();
    hdr.style.outline = '';
    const dragged = habits.find(x => x.id === _dragHabitId);
    if (!dragged) return;
    dragged.tracked = targetTracked;
    habits.splice(habits.indexOf(dragged), 1);
    const insertAt = targetTracked
      ? habits.filter(x => x.tracked !== false).length
      : habits.length;
    habits.splice(insertAt, 0, dragged);
    await saveHabits();
    renderHabitsManage();
    const hs = getHabitStates(); renderHabitsForm(hs.done, hs.notDone);
  });
  return hdr;
}

function renderHabitsManage() {
  const el = document.getElementById('habits-manage-list');
  if (!el) return;
  el.innerHTML = '';
  const tracked   = habits.filter(h => h.tracked !== false);
  const untracked = habits.filter(h => h.tracked === false);
  el.appendChild(_makeGroupHeader(t('hb_tracked'), true));
  tracked.forEach(h => el.appendChild(_makeHabitRow(h)));
  el.appendChild(_makeGroupHeader(t('hb_untracked'), false));
  untracked.forEach(h => el.appendChild(_makeHabitRow(h)));
}

async function addHabit() {
  const inp = document.getElementById('new-habit-input');
  const name = inp.value.trim();
  if (!name) return;
  habits.push({id: String(Date.now()), name, tracked: true, sleepImpact: 'next'});
  await saveHabits();
  inp.value = '';
  renderHabitsManage();
  const hs = getHabitStates(); renderHabitsForm(hs.done, hs.notDone);
}

async function deleteHabit(id) {
  habits = habits.filter(h => h.id !== id);
  await saveHabits();
  renderHabitsManage();
  const hs = getHabitStates(); renderHabitsForm(hs.done, hs.notDone);
}

// Frise de la forme du jour — même grammaire visuelle que la frise des habitudes
function renderFormViz(days, allDates = []) {
  const el = document.getElementById('form-viz');
  if (!el) return;
  const R = 'height:13px;margin-bottom:4px;display:flex;align-items:center;';
  const squares = days.map((d, i) => {
    const ds = allDates[i] || (d && d.dateStr) || '';
    const dateLabel = ds ? new Date(ds+'T12:00:00').toLocaleDateString(t('locale'),{weekday:'short',day:'2-digit',month:'short'}) : '';
    const form = d && d.dayForm;
    const tip = dateLabel ? `${dateLabel} — ${form ? VNAME[form] : t('hx_none')}` : '';
    if (!form) return `<div class="habits-viz-sq" style="background:transparent;border:1px solid var(--border);opacity:0.3" title="${tip}"></div>`;
    return `<div class="habits-viz-sq" style="background:${RCOLOR[form]}" title="${tip}"></div>`;
  }).join('');
  el.innerHTML = `<div style="display:flex;gap:8px;align-items:flex-start">
      <div id="form-viz-scroll" style="overflow-x:auto;flex:1;padding-bottom:4px"><div style="${R}gap:2px;flex-wrap:nowrap">${squares}</div></div>
    </div>
    <div style="display:flex;gap:14px;margin-top:10px;font-size:0.72rem;color:var(--muted);flex-wrap:wrap">
      ${VALS.map(v=>`<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${RCOLOR[v]};margin-right:4px;vertical-align:middle"></span>${VNAME[v]}</span>`).join('')}
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;border:1px solid var(--border);opacity:0.4;margin-right:4px;vertical-align:middle"></span>Non encodée</span>
    </div>`;
  requestAnimationFrame(() => {
    const sc = document.getElementById('form-viz-scroll');
    if (sc) sc.scrollLeft = sc.scrollWidth;
  });
}

function renderHabitsViz(days, targetId = 'habits-viz', allDates = []) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const active = habits.filter(h => h.tracked !== false);
  if (!active.length) {
    el.innerHTML = '<p style="font-size:0.82rem;color:var(--muted)">Aucune habitude suivie.</p>';
    return;
  }
  const R = 'height:13px;margin-bottom:4px;display:flex;align-items:center;';
  let namesHtml = '', squaresHtml = '';
  active.forEach(h => {
    const done = days.map(d => {
      if (!d) return null;
      if (d.habits && d.habits.includes(h.id)) return true;
      if (d.habitsNotDone && d.habitsNotDone.includes(h.id)) return false;
      return null;
    });
    const squares = done.map((v, i) => {
      const ds = allDates[i] || (days[i] && days[i].dateStr) || '';
      const dateLabel = ds ? new Date(ds+'T12:00:00').toLocaleDateString(t('locale'),{weekday:'short',day:'2-digit',month:'short'}) : '';
      const tip = dateLabel ? `${dateLabel} — ${v === true ? 'Fait' : v === false ? 'Non fait' : t('hb_notenc')}` : '';
      // Fait = plein · Non fait = vide, contour net · Non suivi = vide, contour effacé
      if (v === null) return `<div class="habits-viz-sq" style="background:transparent;border:1px solid var(--border);opacity:0.3" title="${tip}"></div>`;
      if (v === true) return `<div class="habits-viz-sq" style="background:#27ae60" title="${tip}"></div>`;
      return `<div class="habits-viz-sq" style="background:transparent;border:1px solid var(--muted)" title="${tip}"></div>`;
    }).join('');
    namesHtml   += `<div style="${R}width:300px;min-width:0;" title="${h.name}"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;font-size:0.75rem;font-weight:500;color:var(--text)">${h.name}</span></div>`;
    squaresHtml += `<div style="${R}gap:2px;flex-wrap:nowrap">${squares}</div>`;
  });
  let html = `<div style="display:flex;gap:8px;align-items:flex-start">
    <div style="width:300px;flex-shrink:0;min-width:0">${namesHtml}</div>
    <div id="habits-viz-scroll" style="overflow-x:auto;flex:1;padding-bottom:4px">${squaresHtml}</div>
  </div>`;
  html += `<div style="display:flex;gap:14px;margin-top:10px;font-size:0.72rem;color:var(--muted)">
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#27ae60;margin-right:4px;vertical-align:middle"></span>Fait</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;border:1px solid var(--muted);margin-right:4px;vertical-align:middle"></span>Non fait</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;border:1px solid var(--border);opacity:0.4;margin-right:4px;vertical-align:middle"></span>Non suivi</span>
  </div>`;
  el.innerHTML = html;
  requestAnimationFrame(() => {
    const sc = document.getElementById('habits-viz-scroll');
    if (sc) sc.scrollLeft = sc.scrollWidth;
  });
}

// ---- Storage ----
