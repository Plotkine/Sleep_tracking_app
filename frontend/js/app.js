const TABS = ['summary','entry','history','statistics','habits','options'];

// Deux modes de navigation :
//   · served by sleep_server.py → real URLs (/summary…), which the server can render;
//   · with no server (Android app) → hashes (#/summary). Capacitor's local server
//     cannot redirect an unknown route to index.html: reloading on
//     /summary y renverrait un 404.
function showTab(name, push=true) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('nav a, nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  document.getElementById('nav-'+name)?.classList.add('active');
  if (push) {
    if (storeUsesServer()) history.pushState({tab:name}, '', '/'+name);
    else if (location.hash !== '#/'+name) location.hash = '/'+name;
  }
  if (name==='summary')    renderSummary();
  if (name==='history')    renderHistory();
  if (name==='statistics') renderStats();
  // Every tab starts at the top: on mobile you would otherwise land mid-content.
  window.scrollTo(0, 0);
}
// Screen rotation or resize: the layout of Statistics and History depends on width,
// so they must be recomputed. Debounced, to avoid re-rendering on every pixel while
// the window is being dragged.
let _resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_resizeTimer);
  _resizeTimer = setTimeout(() => {
    if (document.getElementById('tab-statistics').classList.contains('active')) renderStats();
    else if (document.getElementById('tab-history').classList.contains('active')) renderHistory();
  }, 200);
});

window.addEventListener('popstate', e => {
  showTab(e.state?.tab || tabFromPath(), false);
});
// Hash mode: Android's back button only fires hashchange.
window.addEventListener('hashchange', () => {
  const name = tabFromPath();
  if (!document.getElementById('tab-'+name).classList.contains('active')) showTab(name, false);
});
function tabFromPath() {
  // The hash wins: it carries the route when there is no server.
  const hash = location.hash.replace(/^#\/?/, '');
  const path = hash || location.pathname.replace(/^\//, '');
  return TABS.includes(path) ? path : 'summary';
}

// ---- Theme ----
function applyTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  document.getElementById('theme-toggle').textContent = dark ? t('theme_dark') : t('theme_light');
}
function toggleTheme() {
  const dark = !document.documentElement.classList.contains('dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  applyTheme(dark);
}

// ---- Date navigation helpers ----
// Target pickers: the same widgets as Entry. A target may never be empty, hence
// allowClear:false on both.
function initTargetPickers() {
  initDqp('durgoal', {
    hId: 'dur-target-h', mId: 'dur-target-m',
    allowClear: false, onPick: updateDurTargetParts,
  });
  const box = document.getElementById('sleep-target-container');
  box.innerHTML = buildTimePicker('sleep-target', 15, { allowClear: false });
  box.querySelector('.sleep-target').addEventListener('input', ev => {
    // An empty input (field cleared from the keyboard) must not delete the target:
    // the current value is restored.
    if (!ev.target.value) { ev.target.value = sleepTarget; tpSyncAll(box); return; }
    updateSleepTarget(ev.target.value);
  });
}

function syncTargetInputs() {
  const [dh, dm] = durTarget.split(':');
  document.getElementById('dur-target-h').value = parseInt(dh, 10);
  document.getElementById('dur-target-m').value = parseInt(dm, 10);
  dqpSync('durgoal');
  const box = document.getElementById('sleep-target-container');
  box.querySelector('.sleep-target').value = sleepTarget;
  tpSyncAll(box);
}

async function init() {
  applyTheme(localStorage.getItem('theme') !== 'light');
  buildRG('rg-day','day');
  initDqp();
  initTargetPickers();
  syncTargetInputs();
  setDateValue(defaultDate());
  // Choisit API serveur ou localStorage avant le moindre chargement.
  await storeDetectBackend();
  await Promise.all([load(), loadHabits()]);
  renderHabitsForm(null, null);
  renderHabitsManage();
  applyLang();
  onDateChange();
  updateDayPicks();
  showTab(tabFromPath(), false);
}
init();
