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

// Cible de durée de sommeil (graphe en points) — "HH:MM" = durée, pas une heure d'horloge
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
// La cible de durée se saisit en h + min : on la stocke au format "HH:MM"
function updateDurTargetParts() {
  const clamp = (v, max) => Math.max(0, Math.min(max, parseInt(v, 10) || 0));
  const h = clamp(document.getElementById('dur-target-h').value, 14);
  const m = clamp(document.getElementById('dur-target-m').value, 59);
  updateDurTarget(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
}
// Chargement / enregistrement : passent par storage.js, qui choisit entre l'API
// du serveur et le localStorage. Les noms sont conservés (saveToServer notamment)
// car ils sont appelés depuis toute l'app.
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

// `ev` est passé explicitement par le onclick : la variable globale `event` n'existe
// pas dans tous les moteurs, et la WebView Android n'est pas une garantie.
function setRange(n, ev) {
  statsRange = n;
  document.querySelectorAll('.range-btn').forEach(b => b.classList.toggle('active', b === ev?.currentTarget));
  renderStats();
}

// Fenêtre du tableau de bord, en jours. Fixe : le sélecteur de plage n'existe que
// dans Statistiques (statsRange).
let summaryRange = 7;
