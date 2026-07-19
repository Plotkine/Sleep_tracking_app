const TABS = ['summary','entry','history','statistics','habits','options'];

// Deux modes de navigation :
//   · servi par sleep_server.py → vraies URLs (/summary…), que le serveur sait rendre ;
//   · sans serveur (app Android) → ancres (#/summary). Le serveur local de Capacitor
//     ne sait pas rediriger une route inconnue vers index.html : un rechargement sur
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
  // Chaque onglet repart en haut : sur mobile on arrive sinon au milieu du contenu.
  window.scrollTo(0, 0);
}
// Rotation de l'écran ou redimensionnement : la mise en page des Statistiques et de
// l'Historique dépend de la largeur, il faut donc les recalculer. Débounce pour ne
// pas relancer un rendu à chaque pixel pendant le redimensionnement.
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
// Mode ancre : le bouton « retour » d'Android ne déclenche que hashchange.
window.addEventListener('hashchange', () => {
  const name = tabFromPath();
  if (!document.getElementById('tab-'+name).classList.contains('active')) showTab(name, false);
});
function tabFromPath() {
  // L'ancre prime : c'est elle qui porte la route hors serveur.
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
// Sélecteurs des objectifs : mêmes composants que la Saisie. Un objectif ne peut
// pas être vide, d'où allowClear:false sur les deux.
function initTargetPickers() {
  initDqp('durgoal', {
    hId: 'dur-target-h', mId: 'dur-target-m',
    allowClear: false, onPick: updateDurTargetParts,
  });
  const box = document.getElementById('sleep-target-container');
  box.innerHTML = buildTimePicker('sleep-target', 15, { allowClear: false });
  box.querySelector('.sleep-target').addEventListener('input', ev => {
    // Une saisie vide (champ effacé au clavier) ne doit pas supprimer l'objectif :
    // on rétablit la valeur courante.
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
