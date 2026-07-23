// Entry tab: building and reading the form, saving, date navigation, calendar.
function getDateValue() {
  const d = document.getElementById('f-day').value;
  const m = document.getElementById('f-month').value;
  const y = document.getElementById('f-year').value;
  if (!d || !m || !y || y.length < 4) return '';
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function setDateValue(dateStr) {
  if (!dateStr) {
    ['f-day','f-month','f-year'].forEach(id => document.getElementById(id).value = '');
    const el = document.getElementById('date-display');
    if (el) el.textContent = '–';
    const nuit = document.getElementById('lbl-nuit-card');
    if (nuit) nuit.textContent = t('nuit_card');
    const jour = document.getElementById('lbl-journee-card');
    if (jour) jour.textContent = t('journee_card');
    const forme = document.getElementById('lbl-form-card');
    if (forme) forme.textContent = t('form_card');
    return;
  }
  const [y, m, d] = dateStr.split('-');
  document.getElementById('f-day').value   = parseInt(d, 10);
  document.getElementById('f-month').value = parseInt(m, 10);
  document.getElementById('f-year').value  = y;
  const el = document.getElementById('date-display');
  if (el) {
    const dt = new Date(dateStr + 'T12:00:00');
    el.textContent = dt.toLocaleDateString(t('locale'), {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    const next = new Date(dt); next.setDate(next.getDate() + 1);
    const fmt = x => x.toLocaleDateString(t('locale'), {day:'2-digit', month:'2-digit'});
    const nuit = document.getElementById('lbl-nuit-card');
    if (nuit) nuit.textContent = t('nuit_card_d')(fmt(dt), fmt(next));
    const jour = document.getElementById('lbl-journee-card');
    if (jour) jour.textContent = t('journee_card_d')(fmt(next));
    const forme = document.getElementById('lbl-form-card');
    if (forme) forme.textContent = t('form_card_d')(fmt(next));
  }
}

function onDatePartInput(el, nextId, maxLen) {
  if (String(el.value).length >= maxLen && nextId) document.getElementById(nextId).focus();
  updatePreview();
  onDateChange();
}

function onPickerChange(val) {
  setDateValue(val);
  updatePreview();
  onDateChange();
}

function switchMode(mode, skipFill = false) {
  entryMode = mode;
  document.getElementById('mode-btn-detailed').classList.toggle('active', mode === 'detailed');
  document.getElementById('mode-btn-quick').classList.toggle('active', mode === 'quick');
  document.getElementById('mode-detailed').style.display = mode === 'detailed' ? '' : 'none';
  document.getElementById('mode-quick').style.display    = mode === 'quick'    ? '' : 'none';
  document.getElementById('notes-card').style.display    = mode === 'quick'    ? 'none' : '';

  if (!skipFill) {
    const existing = editingId != null ? entries.find(x => x.id === editingId) : null;
    if (mode === 'quick') {
      ['list-sleep','list-nap','list-drow'].forEach(id => document.getElementById(id).innerHTML = '');
      const qd = existing?.quickDuration;
      document.getElementById('f-quick-h').value = qd != null ? Math.floor(qd) : '';
      document.getElementById('f-quick-m').value = qd != null ? (Math.round((qd % 1) * 60) || '') : '';
      dqpSync();
    } else {
      document.getElementById('f-quick-h').value = '';
      document.getElementById('f-quick-m').value = '';
      dqpSync();
      document.getElementById('list-sleep').innerHTML = '';
      document.getElementById('list-nap').innerHTML = '';
      if (existing) {
        normalizeSleeps(existing).forEach(sl => addSleepBlock(sl));
        (existing.naps || []).forEach(n => addNapRow(n));
        fillSingle('list-drow', existing.drowsiness, 'drow-t');
      } else {
        addSleepBlock();
        addNapRow();
      }
    }
  }
  updatePreview();
}

function toggleHalf(btn) {
  const active = btn.dataset.half === '1';
  btn.dataset.half = active ? '0' : '1';
  btn.classList.toggle('active', !active);
  updatePreview();
}
function buildRG(id, key) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  VALS.forEach(v => {
    const b = document.createElement('button');
    b.className = 'rating-btn'; b.dataset.v = v; b.textContent = VNAME[v];
    b.onclick = () => {
      // Clicking the selected option again clears it: without this, a form entered by
      // mistake could only be replaced, never removed.
      const off = ratings[key] === v;
      ratings[key] = off ? null : v;
      el.querySelectorAll('.rating-btn').forEach(x=>x.classList.remove('sel'));
      if (!off) b.classList.add('sel');
      updatePreview();
    };
    el.appendChild(b);
  });
}

// ---- Time select helpers ----
function addSleepBlock(vals) {
  const list = document.getElementById('list-sleep');
  const div = document.createElement('div');
  div.className = 'sleep-item';
  div.innerHTML = `
    <div class="sleep-fields">
      <div class="sleep-field"><span>${t('sl_bed')}</span>${buildTimePicker('sl-bed',15)}</div>
      <div class="sleep-field"><span>${t('sl_start')}</span>${buildTimePicker('sl-start',15)}</div>
      <div class="sleep-field"><span>${t('sl_end')}</span>${buildTimePicker('sl-end',15)}</div>
      <div class="sleep-field"><span>${t('sl_wake')}</span>${buildTimePicker('sl-up',15)}</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
      <button class="half-toggle" data-half="0" onclick="toggleHalf(this)">${t('half_sleep')}</button>
      <button class="rm-btn" onclick="this.closest('.sleep-item').remove();updatePreview()">×</button>
    </div>
  `;
  list.appendChild(div);
  if (vals) {
    // Legacy entries: bedtime/wakeup carried both going to bed and falling asleep.
    div.querySelector('.sl-bed').value   = vals.bed || vals.bedtime || '';
    div.querySelector('.sl-start').value = vals.sleepStart || '';
    div.querySelector('.sl-end').value   = vals.sleepEnd || vals.wakeup || '';
    div.querySelector('.sl-up').value    = vals.wakeup || '';
    tpSyncAll(div);
    if (vals.halfSleep) {
      const btn = div.querySelector('.half-toggle');
      btn.dataset.half = '1'; btn.classList.add('active');
    }
  }
  updatePreview();
}

function addNapRow(vals) {
  const list = document.getElementById('list-nap');
  const div = document.createElement('div');
  div.className = 'time-item';
  div.innerHTML = `
    ${buildTimePicker('nap-s',5)}
    <span class="arr">→</span>
    ${buildTimePicker('nap-e',5)}
    <button class="half-toggle" data-half="0" onclick="toggleHalf(this)" title="${t('tl_half')}">½</button>
    <button class="rm-btn" onclick="this.parentElement.remove();updatePreview()">×</button>
  `;
  list.appendChild(div);
  if (vals) {
    div.querySelector('.nap-s').value = vals.s || '';
    div.querySelector('.nap-e').value = vals.e || '';
    tpSyncAll(div);
    if (vals.halfSleep) {
      const btn = div.querySelector('.half-toggle');
      btn.dataset.half = '1'; btn.classList.add('active');
    }
  }
  updatePreview();
}

function addSingle(listId, cls) {
  const list = document.getElementById(listId);
  const div = document.createElement('div');
  div.className = 'time-item';
  div.innerHTML = `
    ${buildTimePicker(cls, 60)}
    <button class="rm-btn" onclick="this.parentElement.remove();updatePreview()">×</button>
  `;
  list.appendChild(div);
  updatePreview();
}

// ---- Get form entry ----
function getFormEntry() {
  const sleeps = [];
  document.querySelectorAll('#list-sleep .sleep-item').forEach(item => {
    sleeps.push({
      bed:        item.querySelector('.sl-bed')?.value   || '',
      sleepStart: item.querySelector('.sl-start')?.value || '',
      sleepEnd:   item.querySelector('.sl-end')?.value   || '',
      wakeup:     item.querySelector('.sl-up')?.value    || '',
      halfSleep:  item.querySelector('.half-toggle')?.dataset.half === '1',
    });
  });
  const naps = [];
  document.querySelectorAll('#list-nap .time-item').forEach(row => {
    naps.push({
      s: row.querySelector('.nap-s')?.value || '',
      e: row.querySelector('.nap-e')?.value || '',
      halfSleep: row.querySelector('.half-toggle')?.dataset.half === '1',
    });
  });
  const drowsiness = [];
  document.querySelectorAll('.drow-t').forEach(i => { if(i.value) drowsiness.push(i.value); });

  let quickDuration = null;
  if (entryMode === 'quick') {
    const qh = parseFloat(document.getElementById('f-quick-h').value);
    const qm = parseFloat(document.getElementById('f-quick-m').value);
    if (!isNaN(qh) || !isNaN(qm)) quickDuration = (isNaN(qh)?0:qh) + (isNaN(qm)?0:qm)/60;
  }

  return {
    dateStr: getDateValue(),
    sleeps: entryMode === 'detailed' ? sleeps : [],
    naps:   entryMode === 'detailed' ? naps   : [],
    drowsiness: entryMode === 'detailed' ? drowsiness : [],
    quickDuration,
    dayForm: ratings.day,
    notes: document.getElementById('f-notes').value,
    habits: getHabitStates().done,
    habitsNotDone: getHabitStates().notDone,
    events: getEventStates().done,
    eventsAbsent: getEventStates().absent,
  };
}

// ---- Preview ----
function updatePreview() {
  const e = getFormEntry();

  if (e.dateStr) {
    const d = new Date(e.dateStr+'T12:00:00'), n = new Date(d);
    n.setDate(n.getDate()+1);
    document.getElementById('prev-date').textContent =
      t('night_of')(d.toLocaleDateString(t('locale'),{day:'2-digit',month:'2-digit'}), n.toLocaleDateString(t('locale'),{day:'2-digit',month:'2-digit'}));
  } else {
    document.getElementById('prev-date').textContent = '';
  }

  renderTL(e, 'prev-tl');

  const dur = sleepDuration(e);
  document.getElementById('prev-dur').textContent = dur !== null ? fmtH(dur) : '';


}

// ---- Save / Edit entry ----
function showSaveStatus(msg, type='ok') {
  const el = document.getElementById('save-status');
  el.textContent = msg;
  el.className = 'save-status ' + (type === true ? 'err' : type === false ? 'ok' : type);
  el.style.display = 'block';
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

async function saveEntry() {
  const e = getFormEntry();
  if (!e.dateStr) { showSaveStatus(t('alert_no_date'), true); return; }
  let msg, savedId;
  if (editingId !== null) {
    const idx = entries.findIndex(x => x.id === editingId);
    if (idx !== -1) {
      e.id = editingId;
      entries[idx] = e;
      msg = t('updated');
      savedId = editingId;
    }
    editingId = null;
  }
  if (!msg) {
    const existingIdx = entries.findIndex(x => x.dateStr === e.dateStr);
    if (existingIdx !== -1) {
      e.id = entries[existingIdx].id;
      entries[existingIdx] = e;
      msg = t('replaced');
      savedId = e.id;
    } else {
      e.id = Date.now();
      savedId = e.id;
      entries.unshift(e);
      msg = t('saved');
    }
  }
  entries.sort((a,b)=>b.dateStr.localeCompare(a.dateStr));
  await saveToServer();
  // Stay on the current date in edit mode
  editingId = savedId;
  document.getElementById('save-btn').textContent = t('edit_btn');
  document.getElementById('delete-day-btn').style.display = '';
  showSaveStatus(msg);
  renderHistory();
  renderSummary();
  updateDayPicks();
}

function editEntry(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  showSaveStatus(t('loaded_edit'), 'inf');
  editingId = id;
  setDateValue(e.dateStr || '');
  fillFormFromEntry(e);

  document.getElementById('save-btn').textContent = t('edit_btn');
  document.getElementById('delete-day-btn').style.display = '';
  updateDayPicks();
  showTab('entry');
  window.scrollTo({top:0, behavior:'smooth'});
}

function fillSingle(listId, items, cls) {
  const list = document.getElementById(listId);
  list.innerHTML = '';
  (items || []).forEach(val => {
    addSingle(listId, cls);
    const inputs = list.querySelectorAll('.'+cls);
    const inp = inputs[inputs.length - 1];
    inp.value = val || '';
    tpSyncAll(inp.closest('.time-item'));
  });
}

function onDateChange() {
  const dateStr = getDateValue();
  const existing = entries.find(e => e.dateStr === dateStr);
  if (existing) {
    fillFormFromEntry(existing);
    editingId = existing.id;
    document.getElementById('save-btn').textContent = t('edit_btn');
      document.getElementById('delete-day-btn').style.display = '';
    } else {
    editingId = null;
    ['list-sleep','list-nap','list-drow'].forEach(id => document.getElementById(id).innerHTML = '');
    document.getElementById('f-quick-h').value = '';
    document.getElementById('f-quick-m').value = '';
    dqpSync();
    switchMode('detailed');
    document.getElementById('f-notes').value = '';
    ratings = {day:null};
    document.querySelectorAll('.rating-btn').forEach(b=>b.classList.remove('sel'));
    renderHabitsForm(null, null);
    renderEventsForm(null, null);
    document.getElementById('save-btn').textContent = t('save_btn');
    document.getElementById('delete-day-btn').style.display = 'none';
    updatePreview();
  }
  updateDayPicks();
}

function fillFormFromEntry(e) {
  switchMode(e.quickDuration != null ? 'quick' : 'detailed', true);

  document.getElementById('list-sleep').innerHTML = '';
  normalizeSleeps(e).forEach(sl => addSleepBlock(sl));

  document.getElementById('list-nap').innerHTML = '';
  (e.naps || []).forEach(n => addNapRow(n));

  fillSingle('list-drow', e.drowsiness, 'drow-t');

  if (e.quickDuration != null) {
    document.getElementById('f-quick-h').value = Math.floor(e.quickDuration);
    document.getElementById('f-quick-m').value = Math.round((e.quickDuration % 1) * 60) || '';
    dqpSync();
  }

  document.getElementById('f-notes').value = e.notes || '';
  ratings.day = e.dayForm || null;
  document.querySelectorAll('#rg-day .rating-btn').forEach(b =>
    b.classList.toggle('sel', b.dataset.v === e.dayForm));
  renderHabitsForm(e.habits ?? null, e.habitsNotDone ?? null);
  renderEventsForm(e.events ?? null, e.eventsAbsent ?? null);
  updatePreview();
}

// Empties the form *without* touching the displayed date: it clears what was typed,
// without sending the user to another day. switchMode('detailed') takes care of
// rebuilding empty lists, since editingId has just been reset to null.
function resetForm() {
  editingId = null;
  document.getElementById('f-notes').value = '';
  switchMode('detailed');
  ratings = {day:null};
  document.querySelectorAll('.rating-btn').forEach(b=>b.classList.remove('sel'));
  renderHabitsForm(null, null);
  renderEventsForm(null, null);
  document.getElementById('save-btn').textContent = t('save_btn');
  document.getElementById('delete-day-btn').style.display = 'none';
  updatePreview();
}

let _pendingDelId = null, _pendingDelTimer = null;
async function deleteEntry(id) {
  if (_pendingDelId === id) {
    clearTimeout(_pendingDelTimer);
    _pendingDelId = null;
    entries = entries.filter(e=>e.id!==id);
    await saveToServer();
    showSaveStatus(t('deleted_entry'));
    renderHistory();
    renderSummary();
    return;
  }
  _pendingDelId = id;
  showSaveStatus(t('del_again'), 'inf');
  const btn = document.querySelector(`.del-btn[data-id="${id}"]`);
  if (btn) { btn.textContent = t('del_confirm'); btn.style.background='#fee2e2'; btn.style.color='#e74c3c'; }
  _pendingDelTimer = setTimeout(() => {
    _pendingDelId = null;
    renderHistory();
  }, 3000);
}

async function deleteSelectedDay() {
  if (editingId === null) return;
  entries = entries.filter(e => e.id !== editingId);
  await saveToServer();
  resetForm();
  onDateChange();
  renderHistory();
  renderSummary();
}

function prevDay() {
  const d = getDateValue();
  if (!d) return;
  const dt = new Date(d+'T12:00:00'); dt.setDate(dt.getDate()-1);
  setDateValue(dt.toISOString().split('T')[0]);
  updatePreview(); onDateChange();
}
function nextDay() {
  const d = getDateValue();
  if (!d) return;
  const dt = new Date(d+'T12:00:00'); dt.setDate(dt.getDate()+1);
  setDateValue(dt.toISOString().split('T')[0]);
  updatePreview(); onDateChange();
}

// ---- Day quick pick (centred on selected date ±2) ----
function updateDayPicks() {
  const container = document.getElementById('day-picks');
  if (!container) return;
  const entryDates = new Set(entries.map(e => e.dateStr));
  const curDate = getDateValue() || defaultDate();
  const latest = latestEncodableDate();
  const loc = t('locale');
  container.innerHTML = '';
  const center = new Date(curDate + 'T12:00:00');
  for (let i = -2; i <= 2; i++) {
    const d = new Date(center); d.setDate(d.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    if (ds > latest) continue;
    const label = d.toLocaleDateString(loc, {weekday:'short', day:'numeric'});
    const btn = document.createElement('button');
    btn.className = 'day-pick-btn' + (entryDates.has(ds) ? ' has-entry' : '') + (ds === curDate ? ' active' : '');
    btn.textContent = label;
    btn.title = ds;
    btn.onclick = () => { setDateValue(ds); updatePreview(); onDateChange(); };
    container.appendChild(btn);
  }
}

// ---- Custom calendar ----
let calYear, calMonth;
function toggleCalendar(e) {
  e.stopPropagation();
  const cal = document.getElementById('custom-calendar');
  if (cal.style.display === 'none') {
    const d = getDateValue() ? new Date(getDateValue()+'T12:00:00') : new Date();
    calYear = d.getFullYear(); calMonth = d.getMonth();
    renderCalendar();
    cal.style.display = '';
  } else {
    cal.style.display = 'none';
  }
}
function calNav(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth=0; calYear++; }
  if (calMonth < 0) { calMonth=11; calYear--; }
  renderCalendar();
}
function renderCalendar() {
  const loc = t('locale');
  const entryDates = new Set(entries.map(e => e.dateStr));
  const latest = latestEncodableDate();
  const selected = getDateValue();
  const d = new Date(calYear, calMonth, 1);
  document.getElementById('cal-month-label').textContent =
    d.toLocaleDateString(loc,{month:'long',year:'numeric'});
  // Weekday headers Mon-Sun
  const wd = document.getElementById('cal-weekdays');
  if (wd) {
    const wdNames = lang==='en'
      ? ['Mo','Tu','We','Th','Fr','Sa','Su']
      : ['Lu','Ma','Me','Je','Ve','Sa','Di'];
    wd.innerHTML = wdNames.map(n=>`<div>${n}</div>`).join('');
  }
  // Days grid
  const daysEl = document.getElementById('cal-days');
  daysEl.innerHTML = '';
  const firstDow = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const offset = (firstDow + 6) % 7; // convert to Mon-start
  for (let i=0; i<offset; i++) daysEl.innerHTML += '<div class="cal-day cal-empty"></div>';
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  for (let day=1; day<=daysInMonth; day++) {
    const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if (ds > latest) {
      daysEl.innerHTML += `<div class="cal-day cal-empty" style="opacity:0.25;pointer-events:none">${day}</div>`;
      continue;
    }
    let cls = 'cal-day';
    if (entryDates.has(ds)) cls += ' cal-has-entry';
    if (ds===selected) cls += ' cal-selected';
    daysEl.innerHTML += `<div class="${cls}" onclick="calSelectDay('${ds}')">${day}</div>`;
  }
}
function calSelectDay(ds) {
  setDateValue(ds); updatePreview(); onDateChange();
  document.getElementById('custom-calendar').style.display = 'none';
}
document.addEventListener('click', function(ev) {
  if (_tpOpen && !ev.target.closest('.tp-wrap')) tpClose();
  const cal = document.getElementById('custom-calendar');
  if (!cal || cal.style.display==='none') return;
  const wrap = document.querySelector('.cal-wrap');
  if (wrap && !wrap.contains(ev.target)) cal.style.display='none';
});

// ---- Duration quick picker ----
