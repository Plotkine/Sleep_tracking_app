// ---- Sauvegarde : export / import de la totalité des données ----
//
// Un seul fichier JSON porte tout ce que l'utilisateur a produit : les nuits, les
// habitudes et les deux objectifs. C'est le format d'échange entre le web app et
// l'app Android, qui ne partagent aucun stockage.

const BACKUP_FORMAT = 1;   // à incrémenter si la structure change de façon incompatible

// Assemble l'état courant. Les objectifs vivent dans localStorage, pas dans les
// fichiers de données : sans eux la restauration serait incomplète.
function buildBackup() {
  return {
    app: 'agenda-sommeil',
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    entries,
    habits,
    targets: { durTarget, sleepTarget },
  };
}

function backupFileName() {
  return `agenda-sommeil-${new Date().toISOString().slice(0, 10)}.json`;
}

// Téléchargement via un Blob. Dans la WebView Android le clic programmatique sur
// un lien `download` fonctionne, mais si l'environnement le refuse on bascule sur
// le partage natif, puis en dernier recours sur un affichage copiable.
async function exportData() {
  const json = JSON.stringify(buildBackup(), null, 2);
  const name = backupFileName();

  // Partage natif : sur mobile c'est le seul chemin qui laisse choisir la destination.
  if (navigator.canShare && navigator.share) {
    try {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        showBackupStatus(t('bk_exported'));
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;   // partage annulé : ce n'est pas une erreur
    }
  }

  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Révocation différée : Chrome annule le téléchargement si l'URL meurt trop tôt.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    showBackupStatus(t('bk_exported'));
  } catch {
    showBackupFallback(json);
  }
}

// Dernier recours : le JSON à copier à la main.
function showBackupFallback(json) {
  const box = document.getElementById('backup-fallback');
  if (!box) return;
  box.style.display = '';
  const ta = box.querySelector('textarea');
  ta.value = json;
  ta.select();
}

function showBackupStatus(msg, isError = false) {
  const el = document.getElementById('backup-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? '#e74c3c' : 'var(--muted)';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.textContent = ''; }, 4000);
}

// Contrôle du fichier avant d'écraser quoi que ce soit : un import invalide qui
// viderait l'agenda serait irrattrapable.
function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(t('bk_err_json')); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(t('bk_err_shape'));
  if (!Array.isArray(data.entries)) throw new Error(t('bk_err_shape'));
  if (data.habits != null && !Array.isArray(data.habits)) throw new Error(t('bk_err_shape'));
  // Une entrée sans date ne serait affichable nulle part.
  if (data.entries.some(e => !e || typeof e.dateStr !== 'string')) throw new Error(t('bk_err_entries'));
  return data;
}

let _pendingImport = null;   // sauvegarde validée, en attente de confirmation

// Étape 1 : lire et valider, puis demander confirmation — l'import remplace tout.
function onImportFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      _pendingImport = parseBackup(String(reader.result));
      const n = _pendingImport.entries.length;
      const h = (_pendingImport.habits || []).length;
      document.getElementById('import-confirm').style.display = '';
      document.getElementById('import-summary').textContent = t('bk_confirm')(n, h);
      showBackupStatus('');
    } catch (err) {
      _pendingImport = null;
      document.getElementById('import-confirm').style.display = 'none';
      showBackupStatus(err.message, true);
    }
  };
  reader.onerror = () => showBackupStatus(t('bk_err_read'), true);
  reader.readAsText(file);
  input.value = '';   // permet de resélectionner le même fichier ensuite
}

function cancelImport() {
  _pendingImport = null;
  document.getElementById('import-confirm').style.display = 'none';
}

// Étape 2 : remplacer les données, persister, puis tout réafficher.
async function confirmImport() {
  if (!_pendingImport) return;
  const data = _pendingImport;
  _pendingImport = null;
  document.getElementById('import-confirm').style.display = 'none';

  entries = data.entries;
  entries.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  if (Array.isArray(data.habits)) habits = data.habits;
  await Promise.all([saveToServer(), saveHabits()]);

  if (data.targets) {
    if (data.targets.durTarget)   updateDurTarget(data.targets.durTarget);
    if (data.targets.sleepTarget) updateSleepTarget(data.targets.sleepTarget);
    syncTargetInputs();
  }

  renderHabitsManage();
  renderHabitsForm(null, null);
  onDateChange();
  updateDayPicks();
  renderSummary();
  renderHistory();
  renderStats();
  showBackupStatus(t('bk_imported')(entries.length));
}
