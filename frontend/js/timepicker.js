// ---- Time Picker ----
let _tpOpen = null, _tpCnt = 0;

function tpClose() {
  if (!_tpOpen) return;
  const pop = document.getElementById(_tpOpen + '-pop');
  if (pop) pop.style.display = 'none';
  const disp = document.getElementById(_tpOpen + '-disp');
  if (disp) disp.classList.remove('open');
  _tpOpen = null;
}


function tpSync(id) {
  const v = document.getElementById(id + '-v').value;
  const disp = document.getElementById(id + '-disp');
  if (!disp) return;
  if (v && /^\d{2}:\d{2}$/.test(v)) {
    disp.value = fmtClock(v); disp.classList.remove('empty');
  } else {
    disp.value = ''; disp.classList.add('empty');
  }
  const [curH, curM] = v && /^\d{2}:\d{2}$/.test(v) ? v.split(':').map(Number) : [null, null];
  const pop = document.getElementById(id + '-pop');
  if (!pop) return;
  pop.querySelectorAll('.tp-h-btn').forEach(b => b.classList.toggle('active', +b.dataset.h === curH));
  pop.querySelectorAll('.tp-m-btn').forEach(b => b.classList.toggle('active', +b.dataset.m === curM));
}

function tpHour(id, h, step) {
  const inp = document.getElementById(id + '-v');
  const cur = inp.value;
  const curM = /^\d{2}:\d{2}$/.test(cur) ? cur.split(':')[1] : '00';
  const hStr = String(h).padStart(2, '0');
  inp.value = hStr + ':' + curM;
  tpSync(id);
  inp.dispatchEvent(new Event('input', {bubbles: true}));
  const pop = document.getElementById(id + '-pop');
  pop.querySelectorAll('.tp-h-btn').forEach(b => b.classList.toggle('active', +b.dataset.h === h));
  pop.querySelectorAll('.tp-m-btn').forEach(b => b.classList.toggle('active', +b.dataset.m === +curM));
}

function tpMin(id, m) {
  const inp = document.getElementById(id + '-v');
  const cur = inp.value;
  const mStr = String(m).padStart(2, '0');
  const hPart = /^(\d{2})/.test(cur) ? cur.match(/^(\d{2})/)[1] : null;
  if (hPart) {
    inp.value = hPart + ':' + mStr;
    tpSync(id); tpClose();
    inp.dispatchEvent(new Event('input', {bubbles: true}));
  } else {
    document.getElementById(id + '-pop').querySelectorAll('.tp-m-btn')
      .forEach(b => b.classList.toggle('active', +b.dataset.m === m));
  }
}

function tpClear(id, ev) {
  ev.stopPropagation();
  const inp = document.getElementById(id + '-v');
  inp.value = ''; tpSync(id); tpClose();
  inp.dispatchEvent(new Event('input', {bubbles: true}));
}

// ---- Saisie clavier directe dans le champ heure ----
// "2315" → 23:15 · "23" → 23:00 · "013" → 01:30 (complété à la volée)
function tpParseDigits(d) {
  let h, m;
  if (d.length <= 2)      { h = +d;            m = 0; }
  else if (d.length === 3){ h = +d.slice(0,2); m = +d[2] * 10; }
  else                    { h = +d.slice(0,2); m = +d.slice(2); }
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function tpFocusNext(disp) {
  const all = [...document.querySelectorAll('input.tp-display')].filter(el => el.offsetParent !== null);
  const i = all.indexOf(disp);
  if (i >= 0 && i < all.length - 1) all[i+1].focus();
  else disp.blur();
}

function tpType(id, disp) {
  let v = disp.value;
  // Champ non sélectionné à l'ouverture (tactile) : la première frappe remplace la
  // valeur au lieu de s'y ajouter — sans quoi taper sur « 23:15 » donnerait « 2315… »
  // aussitôt retronqué à l'ancienne heure, et le champ paraîtrait bloqué.
  if (disp.dataset.fresh) {
    delete disp.dataset.fresh;
    const prev = disp.dataset.prev || '';
    if (prev && v.length > prev.length && v.startsWith(prev)) v = v.slice(prev.length);
  }
  const digits = v.replace(/\D/g, '').slice(0, 4);
  disp.value = digits.length > 2 ? digits.slice(0,2) + clockSep() + digits.slice(2) : digits;
  disp.classList.toggle('empty', !digits.length);
  if (digits.length === 4) tpCommit(id, true);
}

function tpCommit(id, advance) {
  const disp = document.getElementById(id + '-disp');
  const inp  = document.getElementById(id + '-v');
  delete disp.dataset.fresh;   // le champ est validé : plus rien à remplacer
  const digits = disp.value.replace(/\D/g, '');
  if (!digits.length) {
    if (inp.value !== '') { inp.value = ''; inp.dispatchEvent(new Event('input', {bubbles: true})); }
  } else {
    const parsed = tpParseDigits(digits);
    if (parsed && parsed !== inp.value) {
      inp.value = parsed;
      inp.dispatchEvent(new Event('input', {bubbles: true}));
    }
  }
  tpSync(id);
  if (advance) { tpClose(); tpFocusNext(disp); }
}

function tpKey(id, ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); tpCommit(id, true); }
  else if (ev.key === 'Escape') { tpSync(id); tpClose(); ev.target.blur(); }
  else if (ev.key === 'Tab') { tpCommit(id); tpClose(); }
}

function tpFocus(id, ev) {
  ev.stopPropagation();
  if (_tpOpen === id) return;
  tpClose();
  _tpOpen = id;
  document.getElementById(id + '-pop').style.display = '';
  const disp = document.getElementById(id + '-disp');
  disp.classList.add('open');
  tpSync(id);
  // Au clavier, sélectionner tout permet de retaper l'heure par-dessus. Au doigt, la
  // même sélection fait surgir les poignées et la barre « Copier / Coller » d'Android
  // par-dessus le sélecteur. On place donc le curseur en fin de champ et on marque la
  // valeur comme « à remplacer » : la première touche repart de zéro (voir tpType).
  if (window.matchMedia('(pointer: coarse)').matches) {
    disp.dataset.prev = disp.value;
    disp.dataset.fresh = '1';
    const end = disp.value.length;
    disp.setSelectionRange(end, end);
  } else {
    disp.select();
  }
}

function tpSyncAll(container) {
  container.querySelectorAll('[data-tp]').forEach(el => tpSync(el.dataset.tp));
}

// `opts.allowClear === false` retire le bouton « Effacer » : utilisé pour les
// objectifs, qui ne peuvent pas rester vides.
function buildTimePicker(cls, step, opts = {}) {
  const id = 'tp' + (_tpCnt++);
  const hours = Array.from({length: 24}, (_, h) =>
    `<button type="button" class="tp-h-btn" data-h="${h}" onclick="tpHour('${id}',${h},${step})">${String(h).padStart(2,'0')}</button>`
  ).join('');
  const nMins = step < 60 ? Math.floor(60 / step) : 0;
  const mins = nMins ? Array.from({length: nMins}, (_, i) => {
    const m = i * step;
    return `<button type="button" class="tp-m-btn" data-m="${m}" onclick="tpMin('${id}',${m})">:${String(m).padStart(2,'0')}</button>`;
  }).join('') : '';
  return `<div class="tp-wrap">
    <input type="hidden" id="${id}-v" class="${cls}" data-tp="${id}" oninput="updatePreview()">
    <input type="text" class="tp-display empty" id="${id}-disp" placeholder="--:--" inputmode="numeric" autocomplete="off" maxlength="5"
      onfocus="tpFocus('${id}',event)" onclick="event.stopPropagation()"
      oninput="tpType('${id}',this)" onkeydown="tpKey('${id}',event)" onblur="tpCommit('${id}')">
    <div class="tp-popup" id="${id}-pop" style="display:none">
      <div class="tp-hours">${hours}</div>
      ${mins ? `<div class="tp-mins">${mins}</div>` : ''}
      ${opts.allowClear === false ? '' : `<button type="button" class="tp-clear" onclick="tpClear('${id}',event)">✕ Effacer</button>`}
    </div>
  </div>`;
}

// ---- Sélecteur de durée (h + min) ----
// Plusieurs instances coexistent : la Saisie rapide et l'objectif de durée. Chacune
// écrit dans deux champs cachés et prévient l'appelant via onPick. La clé sert de
// préfixe aux ids (`<clé>-container`, `-disp`, `-pop`), et `dqp` reste celle de la
// Saisie pour que les appels existants restent valables sans argument.
const _dqpDefs = {};

function initDqp(key = 'dqp', def = { hId: 'f-quick-h', mId: 'f-quick-m', onPick: () => updatePreview() }) {
  _dqpDefs[key] = def;
  const hours = Array.from({length:15},(_,h)=>
    `<button type="button" class="tp-h-btn" data-h="${h}" onclick="dqpHour(${h},'${key}')">${h}h</button>`
  ).join('');
  const mins = Array.from({length:12},(_,i)=>{
    const m=i*5;
    return `<button type="button" class="tp-m-btn" data-m="${m}" onclick="dqpMin(${m},'${key}')">:${String(m).padStart(2,'0')}</button>`;
  }).join('');
  document.getElementById(`${key}-container`).innerHTML = `<div class="tp-wrap">
    <button type="button" class="tp-display empty" id="${key}-disp" onclick="dqpOpen(event,'${key}')">—</button>
    <div class="tp-popup" id="${key}-pop" style="display:none">
      <div class="tp-hours" style="grid-template-columns:repeat(5,1fr)">${hours}</div>
      <div class="tp-mins" style="grid-template-columns:repeat(6,1fr)">${mins}</div>
      ${def.allowClear === false ? '' : `<button type="button" class="tp-clear" onclick="dqpClear(event,'${key}')">✕ Effacer</button>`}
    </div>
  </div>`;
  dqpSync(key);
}

function dqpOpen(ev, key = 'dqp') {
  ev.stopPropagation();
  if (_tpOpen === key) { tpClose(); return; }
  tpClose();
  _tpOpen = key;
  document.getElementById(`${key}-pop`).style.display = '';
  document.getElementById(`${key}-disp`).classList.add('open');
  dqpSync(key);
}

function dqpSync(key = 'dqp') {
  const def = _dqpDefs[key];
  const disp = document.getElementById(`${key}-disp`);
  if (!def || !disp) return;
  const h = document.getElementById(def.hId).value;
  const m = document.getElementById(def.mId).value;
  const hNum = h !== '' ? parseInt(h) : null;
  const mNum = m !== '' ? parseInt(m) : null;
  if (hNum !== null || mNum !== null) {
    const hStr = hNum !== null ? hNum + 'h' : '–h';
    const mStr = mNum !== null && mNum > 0 ? String(mNum).padStart(2,'0') : '';
    disp.textContent = hStr + mStr;
    disp.classList.remove('empty');
  } else {
    disp.textContent = '—'; disp.classList.add('empty');
  }
  const pop = document.getElementById(`${key}-pop`);
  if (!pop) return;
  pop.querySelectorAll('.tp-h-btn').forEach(b => b.classList.toggle('active', +b.dataset.h === hNum));
  pop.querySelectorAll('.tp-m-btn').forEach(b => b.classList.toggle('active', +b.dataset.m === mNum));
}

function dqpHour(h, key = 'dqp') {
  const def = _dqpDefs[key];
  document.getElementById(def.hId).value = h;
  const m = document.getElementById(def.mId).value;
  dqpSync(key);
  if (m !== '') { tpClose(); def.onPick(); }
}

function dqpMin(m, key = 'dqp') {
  const def = _dqpDefs[key];
  document.getElementById(def.mId).value = m;
  const h = document.getElementById(def.hId).value;
  dqpSync(key);
  if (h !== '') { tpClose(); def.onPick(); }
}

function dqpClear(ev, key = 'dqp') {
  ev.stopPropagation();
  const def = _dqpDefs[key];
  document.getElementById(def.hId).value = '';
  document.getElementById(def.mId).value = '';
  dqpSync(key); tpClose(); def.onPick();
}

// ---- Init ----
// Champs "Objectifs" — reflètent l'état stocké dès le chargement, quel que soit l'onglet ouvert
