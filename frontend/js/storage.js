// ---- Couche de persistance ----
//
// Deux back-ends, choisis une fois au démarrage :
//   · l'API du serveur Python (data/*.json) quand elle répond ;
//   · le localStorage sinon — c'est le cas de l'application Android empaquetée
//     par Capacitor, qui n'embarque aucun serveur.
//
// Le localStorage est écrit dans les deux cas : il sert de cache et de filet si le
// serveur disparaît en cours de route. Le reste du code n'appelle que storeLoad /
// storeSave et ignore lequel des deux est actif.

const LS_KEYS = { entries: 'sleepEntries', habits: 'sleepHabits' };

let _serverAvailable = false;   // décidé par storeDetectBackend(), au démarrage

// Teste l'API une seule fois. Sans serveur, `fetch` lève (ou renvoie une erreur)
// et l'on bascule définitivement sur le localStorage.
async function storeDetectBackend() {
  try {
    const r = await fetch('/api/entries', { method: 'GET' });
    _serverAvailable = r.ok;
  } catch {
    _serverAvailable = false;
  }
  return _serverAvailable;
}

function storeUsesServer() { return _serverAvailable; }

function _lsRead(kind) {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEYS[kind]) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }   // entrée corrompue : on repart d'une liste vide
}

function _lsWrite(kind, data) {
  try { localStorage.setItem(LS_KEYS[kind], JSON.stringify(data)); }
  catch { /* quota dépassé ou stockage refusé : on ne bloque pas l'app */ }
}

// `kind` vaut 'entries' ou 'habits' — les deux collections persistées.
async function storeLoad(kind) {
  if (_serverAvailable) {
    try {
      const r = await fetch(`/api/${kind}`);
      if (r.ok) {
        const data = await r.json();
        _lsWrite(kind, data);   // on garde une copie locale à jour
        return data;
      }
    } catch { _serverAvailable = false; }
  }
  return _lsRead(kind);
}

async function storeSave(kind, data) {
  _lsWrite(kind, data);
  if (!_serverAvailable) return;
  try {
    await fetch(`/api/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    _serverAvailable = false;   // le serveur s'est arrêté : la copie locale suffit
  }
}
