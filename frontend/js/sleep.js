// Domain maths: hour conversion, night duration, formatting.
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
// Clock-time separator, by language: French writes "23h15", English "23:15" and
// never "23h15". Durations keep "7h30" in both languages — "7:30" would read as a
// clock time.
function clockSep() { return lang === 'en' ? ':' : 'h'; }

// Decimal hour (23.25) -> "23h15" / "23:15"
function fmtDecH(v) {
  const dec = v >= 24 ? v - 24 : v;
  const hh = Math.floor(dec), mm = Math.round((dec % 1) * 60);
  return `${String(hh).padStart(2,'0')}${clockSep()}${String(mm).padStart(2,'0')}`;
}

// Hour tick on the 24 h ruler. French labels them "20h"; English uses the bare number,
// as axes conventionally do — "20:00" repeated 24 times would not fit.
function fmtHourTick(h) { return lang === 'en' ? String(h) : `${h}h`; }

// A time already in storage format "HH:MM" -> the current language's notation.
// Storage itself always stays "HH:MM": this is for display only.
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

// Durations follow the language: "7h30" / "7h" in French, "7:30" / "7:00" in English.
// Under an hour both stay "45min": it is not an hour count, and "0:45" would read as a
// time of day.
function fmtH(h) {
  if (h === null) return '–';
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm}min`;
  if (mm === 0) return lang === 'en' ? `${hh}:00` : `${hh}h`;
  return `${hh}${clockSep()}${String(mm).padStart(2,'0')}`;
}

// X-axis label for a night dated `ds`: both dates it spans (J and J+1), e.g.
// "22/07–23/07", so a dot is never mistaken for the night that starts *or* ends on a
// single date. Locale-ordered, so it reads correctly in EN too.
function nightAxisLabel(ds) {
  const loc = t('locale'), opt = { day: '2-digit', month: '2-digit' };
  const d0 = new Date(ds + 'T12:00:00');
  const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
  return `${d0.toLocaleDateString(loc, opt)}–${d1.toLocaleDateString(loc, opt)}`;
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
// Local date as YYYY-MM-DD. `toISOString()` switches to UTC: between midnight and the
// local offset (2 h in summer here) it returns the previous day, which shifted the
// whole app by one day in the small hours — and blocked entry for the day concerned.
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Latest encodable date. An entry dated D carries the night D→D+1, which starts at
// 20:00 — the timeline origin — so day D becomes recordable from 20:00 that day.
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
