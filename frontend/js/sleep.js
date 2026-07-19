// Calculs du domaine : conversion des heures, durée d'une nuit, formatage.
// Fonctions pures — aucune lecture du DOM.
function sleepOnsetH(e) {
  if (!e) return null;
  const sl = normalizeSleeps(e)[0];
  if (!sl) return null;
  const t = sl.sleepStart || sl.bed || sl.bedtime;
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h >= 20 ? h + m / 60 : h + m / 60 + 24;
}
// Bornes des intervalles : première valeur exclue, seconde incluse — ]a, b]
// Séparateur des heures d'horloge, selon la langue : le français écrit « 23h15 »,
// l'anglais « 23:15 » et jamais « 23h15 ». Les durées, elles, gardent « 7h30 » dans
// les deux langues — « 7:30 » se lirait comme une heure d'horloge.
function clockSep() { return lang === 'en' ? ':' : 'h'; }

// Heure décimale (23.25) -> « 23h15 » / « 23:15 »
function fmtDecH(v) {
  const dec = v >= 24 ? v - 24 : v;
  const hh = Math.floor(dec), mm = Math.round((dec % 1) * 60);
  return `${String(hh).padStart(2,'0')}${clockSep()}${String(mm).padStart(2,'0')}`;
}

// Heure déjà au format de stockage « HH:MM » -> notation de la langue courante.
// Le stockage, lui, reste toujours « HH:MM » : ceci ne sert qu'à l'affichage.
function fmtClock(t) {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return t || '';
  return t.replace(':', clockSep());
}
function timeFrac(t) {
  if (!t) return null;
  const [h,m] = t.split(':').map(Number);
  const off = h >= 20 ? h - 20 : h + 4;
  return (off + m/60) / 24;
}

function normalizeSleeps(e) {
  if (e.sleeps) return e.sleeps;
  // backwards compat: single block from old fields
  if (e.bedtime || e.sleepStart) return [{
    bed: e.bedtime, sleepStart: e.sleepStart, sleepEnd: e.sleepEnd, wakeup: e.wakeup,
    awakenings: e.awakenings
  }];
  return [];
}

function blockDuration(s, en, half) {
  let d = en - s; if (d < 0) d += 1;
  return d * (half ? 0.5 : 1);
}

function sleepDuration(e) {
  if (e.quickDuration != null) return e.quickDuration;
  const sleeps = normalizeSleeps(e);
  let total = 0, hasAny = false;
  for (const sl of sleeps) {
    const s = timeFrac(sl.sleepStart), en = timeFrac(sl.sleepEnd) ?? timeFrac(sl.wakeup);
    if (s !== null && en !== null) {
      total += blockDuration(s, en, sl.halfSleep); hasAny = true;
    } else {
      const bed = timeFrac(sl.bed || sl.bedtime), wk = timeFrac(sl.wakeup);
      if (bed !== null && wk !== null) {
        let d = wk - bed; if (d < 0) d += 1;
        (sl.awakenings||[]).filter(a=>a.s&&a.e).forEach(a=>{
          let diff = timeFrac(a.e) - timeFrac(a.s); if (diff < 0) diff += 1; d -= diff;
        });
        total += d * (sl.halfSleep ? 0.5 : 1); hasAny = true;
      }
    }
  }
  for (const n of (e.naps||[])) {
    const s = timeFrac(n.s), en = timeFrac(n.e);
    if (s !== null && en !== null) { total += blockDuration(s, en, n.halfSleep); hasAny = true; }
  }
  return hasAny ? Math.max(0, total * 24) : null;
}

function fmtH(h) {
  if (h === null) return '–';
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm}min`;
  if (mm === 0) return `${hh}h`;
  return `${hh}h${String(mm).padStart(2,'0')}`;
}

function fmtDate(ds) {
  const loc = t('locale');
  const d = new Date(ds + 'T12:00:00');
  const n = new Date(d); n.setDate(n.getDate()+1);
  return t('night_of')(
    d.toLocaleDateString(loc,{weekday:'short',day:'2-digit',month:'short'}),
    n.toLocaleDateString(loc,{day:'2-digit',month:'short'})
  );
}

// ---- Timeline renderer ----
// Date locale au format YYYY-MM-DD. `toISOString()` bascule en UTC : entre minuit et
// le décalage horaire (2 h l'été en Belgique) il renvoie la veille, ce qui décalait
// toute l'app d'un jour en pleine nuit — et bloquait la saisie du jour concerné.
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Dernière date encodable. Une entrée datée J porte la nuit J→J+1, qui commence à
// 20:00 — l'origine de la timeline : le jour J devient donc saisissable dès 20:00.
const DAY_START_HOUR = 20;
function latestEncodableDate() {
  const now = new Date();
  const d = new Date(now);
  if (now.getHours() < DAY_START_HOUR) d.setDate(d.getDate() - 1);
  return localDate(d);
}

function defaultDate() { return latestEncodableDate(); }

function yesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return localDate(d);
}

// ---- History ----
