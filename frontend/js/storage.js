// ---- Couche de persistance ----
//
// Two backends, chosen once at startup:
//   · the Python server API (data/*.json) when it answers;
//   · localStorage otherwise — the case of the Android app packaged with Capacitor,
//     which ships no server.
//
// localStorage is written in both cases: it acts as a cache and as a safety net if
// the server disappears mid-session. The rest of the code only calls storeLoad /
// storeSave and never knows which backend is active.

const LS_KEYS = { entries: 'sleepEntries', habits: 'sleepHabits' };

let _serverAvailable = false;   // decided by storeDetectBackend(), at startup

// Probes the API once. With no server, `fetch` throws (or returns an error) and we
// switch to localStorage for good.
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
  } catch { return []; }   // corrupt entry: start again from an empty list
}

function _lsWrite(kind, data) {
  try { localStorage.setItem(LS_KEYS[kind], JSON.stringify(data)); }
  catch { /* quota exceeded or storage refused: do not block the app */ }
}

// `kind` is 'entries' or 'habits' — the two persisted collections.
async function storeLoad(kind) {
  if (_serverAvailable) {
    try {
      const r = await fetch(`/api/${kind}`);
      if (r.ok) {
        const data = await r.json();
        _lsWrite(kind, data);   // keep the local copy up to date
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
    _serverAvailable = false;   // the server stopped: the local copy is enough
  }
}
