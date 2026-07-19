let entries = [];
let habits  = [];

let entryMode = 'detailed';

let ratings = {day:null};
let charts = {};
let sleepTarget = localStorage.getItem('sleepTarget') || '23:30';
function sleepTargetH() {
  const [h, m] = sleepTarget.split(':').map(Number);
  return h >= 20 ? h + m / 60 : h + m / 60 + 24;
}
function updateSleepTarget(val) {
  sleepTarget = val;
  localStorage.setItem('sleepTarget', val);
  renderStats();
}

// Sleep duration target (dot chart) — "HH:MM" means a duration, not a clock time
let durTarget = localStorage.getItem('durTarget') || '07:30';
function durTargetH() {
  const [h, m] = durTarget.split(':').map(Number);
  return h + m / 60;
}
function updateDurTarget(val) {
  durTarget = val;
  localStorage.setItem('durTarget', val);
  renderStats();
}
// The duration target is entered as h + min, and stored in "HH:MM" form
function updateDurTargetParts() {
  const clamp = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
  const h = clamp(document.getElementById('dur-target-h').value, 14);
  const m = clamp(document.getElementById('dur-target-m').value, 59);
  updateDurTarget(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
}
// Load / save: both go through storage.js, which picks between the server API and
// localStorage. The names are kept (saveToServer in particular) because they are
// called from all over the app.
async function loadHabits() {
  habits = await storeLoad('habits');
}
async function saveHabits() {
  await storeSave('habits', habits);
}

async function load() {
  entries = await storeLoad('entries');
  entries.sort((a,b) => b.dateStr.localeCompare(a.dateStr));
}
async function saveToServer() {
  await storeSave('entries', entries);
}

// ---- Helpers ----
let editingId = null;

let statsRange = 7;

// `ev` is passed explicitly by the onclick: the global `event` does not exist in
// every engine, and the Android WebView is no guarantee.
function setRange(n, ev) {
  statsRange = n;
  document.querySelectorAll('.range-btn').forEach(b => b.classList.toggle('active', b === ev?.currentTarget));
  renderStats();
}

// Dashboard window, in days. Fixed: the range selector only exists
// dans Statistiques (statsRange).
let summaryRange = 7;
