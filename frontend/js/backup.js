// ---- Backup: export / import of the whole dataset ----
//
// A single JSON file carries everything the user produced: nights, habits, events and
// both targets. It is the exchange format between the web app and the Android app,
// which share no storage.

const BACKUP_FORMAT = 1;   // bump if the structure changes incompatibly

// Assembles the current state. Targets live in localStorage, not in the data files:
// leaving them out would make a restore silently incomplete.
function buildBackup() {
  return {
    app: 'agenda-sommeil',
    format: BACKUP_FORMAT,
    exportedAt: new Date().toISOString(),
    entries,
    habits,
    events,
    targets: { durTarget, sleepTarget },
  };
}

function backupFileName() {
  return `agenda-sommeil-${new Date().toISOString().slice(0, 10)}.json`;
}

// Download through a Blob. In the Android WebView a programmatic click on a
// `download` link works, but if the environment refuses it we fall back to native
// sharing, then as a last resort to a copyable textarea.
// Android: the WebView does not always expose file sharing through `navigator.share`,
// and the `<a download>` fallback writes silently to Downloads — hence an export that
// reports success with no hint of where it went. The native plugins open the system
// share sheet, which offers "Save to Files" and therefore a choice of folder.
// The file is first written to the cache: that copy is temporary, the real
// destination is the one the user picks.
async function exportViaNative(json, name) {
  const P = window.Capacitor && window.Capacitor.Plugins;
  if (!window.Capacitor || !window.Capacitor.isNativePlatform || !window.Capacitor.isNativePlatform()) return false;
  if (!P || !P.Filesystem || !P.Share) return false;
  const { uri } = await P.Filesystem.writeFile({
    path: name, data: json, directory: 'CACHE', encoding: 'utf8',
  });
  await P.Share.share({ title: name, files: [uri], dialogTitle: t('bk_choose') });
  return true;
}

async function exportData() {
  const json = JSON.stringify(buildBackup(), null, 2);
  const name = backupFileName();

  try {
    if (await exportViaNative(json, name)) { showBackupStatus(t('bk_exported')); return; }
  } catch (err) {
    // Share dismissed without choosing: not an error, and certainly not a failure
    // worth warning about.
    const m = (err && (err.message || err)) + '';
    if (/cancel|abort|dismiss/i.test(m)) return;
    // Otherwise let the fallbacks below have their turn.
  }

  // Native sharing: on a phone this is the only path that lets the user choose where.
  if (navigator.canShare && navigator.share) {
    try {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        showBackupStatus(t('bk_exported'));
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;   // share cancelled: not an error
    }
  }

  try {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Deferred revocation: Chrome cancels the download if the URL dies too early.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    // This path offers no choice, so it at least names the file and its folder —
    // otherwise the export looks as though it vanished.
    showBackupStatus(t('bk_exported_dl')(name));
  } catch {
    showBackupFallback(json);
  }
}

// Last resort: the JSON to copy by hand.
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

// Validate the file before overwriting anything: an invalid import that emptied the
// diary would be unrecoverable.
function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(t('bk_err_json')); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(t('bk_err_shape'));
  if (!Array.isArray(data.entries)) throw new Error(t('bk_err_shape'));
  if (data.habits != null && !Array.isArray(data.habits)) throw new Error(t('bk_err_shape'));
  // `events` est apparu après le format 1 : une sauvegarde qui n'en a pas reste valide.
  if (data.events != null && !Array.isArray(data.events)) throw new Error(t('bk_err_shape'));
  // An entry without a date could not be displayed anywhere.
  if (data.entries.some(e => !e || typeof e.dateStr !== 'string')) throw new Error(t('bk_err_entries'));
  return data;
}

let _pendingImport = null;   // validated backup, awaiting confirmation

// Step 1: read and validate, then ask for confirmation — the import replaces everything.
function onImportFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      _pendingImport = parseBackup(String(reader.result));
      const n = _pendingImport.entries.length;
      const h = (_pendingImport.habits || []).length;
      const v = (_pendingImport.events || []).length;
      document.getElementById('import-confirm').style.display = '';
      document.getElementById('import-summary').textContent = t('bk_confirm')(n, h, v);
      showBackupStatus('');
    } catch (err) {
      _pendingImport = null;
      document.getElementById('import-confirm').style.display = 'none';
      showBackupStatus(err.message, true);
    }
  };
  reader.onerror = () => showBackupStatus(t('bk_err_read'), true);
  reader.readAsText(file);
  input.value = '';   // allows the same file to be picked again afterwards
}

function cancelImport() {
  _pendingImport = null;
  document.getElementById('import-confirm').style.display = 'none';
}

// Step 2: replace the data, persist it, then re-render everything.
async function confirmImport() {
  if (!_pendingImport) return;
  const data = _pendingImport;
  _pendingImport = null;
  document.getElementById('import-confirm').style.display = 'none';

  entries = data.entries;
  entries.sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  if (Array.isArray(data.habits)) habits = data.habits;
  if (Array.isArray(data.events)) events = data.events;
  await Promise.all([saveToServer(), saveHabits(), saveEvents()]);

  if (data.targets) {
    if (data.targets.durTarget)   updateDurTarget(data.targets.durTarget);
    if (data.targets.sleepTarget) updateSleepTarget(data.targets.sleepTarget);
    syncTargetInputs();
  }

  renderHabitsManage();
  renderHabitsForm(null, null);
  renderEventsManage();
  renderEventsForm(null, null);
  onDateChange();
  updateDayPicks();
  renderSummary();
  renderHistory();
  renderStats();
  showBackupStatus(t('bk_imported')(entries.length));
}
