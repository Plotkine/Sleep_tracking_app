// Colours: appreciation palette and the scale bands (duration, sleep onset).
// Depends on state.js (targets) and sleep.js (formatting) at call time, not at load.
const RCOLOR = {TB:'#27ae60',B:'#82c341',Moy:'#f7e08a',M:'#e67e22',TM:'#e74c3c'};

// ---- Appreciation palette: THE single source of colour for the whole app ----
// No scale may be redefined elsewhere, not even "just for this card": that is how
// the same night ended up orange in History and light green in the duration chart.
const SCALE = { good: '#27ae60', ok: '#a8d44a', poor: '#e67e22', bad: '#e74c3c' };

// Each scale is described by its bands: colour, label and test.
// Les tests sont **mutuellement exclusifs et exhaustifs**, ce qui permet de s'en
// servir aussi bien pour colorer une valeur que pour regrouper des points par
// tranche, sans jamais compter une valeur deux fois. Ordre : de la meilleure
// bande à la pire.

// Sleep duration — always relative to the target, everywhere.
// Convention [a, b[ : atteindre l'objectif pile compte comme atteint, donc vert.
function durBands() {
  const n  = durTargetH();
  const b1 = Math.max(0, n - 1), b2 = Math.max(0, n - 2);
  return [
    { c: SCALE.good, label: `≥ ${fmtH(n)}`,               test: d => d >= n },
    { c: SCALE.ok,   label: `${fmtH(b1)} – ${fmtH(n)}`,   test: d => d >= b1 && d < n },
    { c: SCALE.poor, label: `${fmtH(b2)} – ${fmtH(b1)}`,  test: d => d >= b2 && d < b1 },
    { c: SCALE.bad,  label: `< ${fmtH(b2)}`,              test: d => d < b2 },
  ];
}

// Sleep onset — distance from the target.
// Convention ]a, b]: the upper bound is included, the last band lies beyond.
function onsetBands() {
  const t = sleepTargetH();
  return [
    { c: SCALE.good, label: `≤ ${fmtDecH(t+0.25)}`,                       test: v => v <= t+0.25 },
    { c: SCALE.ok,   label: `${fmtDecH(t+0.25)} – ${fmtDecH(t+0.75)}`,    test: v => v > t+0.25 && v <= t+0.75 },
    { c: SCALE.poor, label: `${fmtDecH(t+0.75)} – ${fmtDecH(t+1.5)}`,     test: v => v > t+0.75 && v <= t+1.5 },
    { c: SCALE.bad,  label: `> ${fmtDecH(t+1.5)}`,                        test: v => v > t+1.5 },
  ];
}

// `nullColor` : 'transparent' pour Chart.js, qui ne sait pas lire une var CSS.
// Never hand these functions bare to .map(), which would pass the index as the
// second argument.
function durColor(d, nullColor = 'var(--muted)') {
  return d == null ? nullColor : durBands().find(b => b.test(d)).c;
}
function onsetColor(v, nullColor = 'var(--muted)') {
  return v == null ? nullColor : onsetBands().find(b => b.test(v)).c;
}

// Ratio 0–1 (share of habits kept)
function ratioColor(v) {
  if (v == null) return 'var(--muted)';
  return v >= 0.75 ? SCALE.good : v >= 0.5 ? SCALE.ok : v >= 0.25 ? SCALE.poor : SCALE.bad;
}

// Signed day-form improvement: a lift is good (green), a drop bad (red), ~flat muted.
function deltaColor(v) {
  if (v == null) return 'var(--muted)';
  return v > 0.1 ? SCALE.good : v < -0.1 ? SCALE.bad : 'var(--muted)';
}

// Buckets for a detail analysis, generated from the same bands: the table's
// thresholds therefore always match the colours shown elsewhere.
function bucketsFrom(bands) {
  return bands.map(b => [b.label, b.test, b.c]);
}

// Legend generated from the bands themselves: it cannot disagree with them.
function bandsLegendHtml(bands, shape = 'dot') {
  const r = shape === 'dot' ? '50%' : '2px';
  return bands.map(b => `<span style="display:flex;align-items:center;gap:4px">`
    + `<span style="width:9px;height:9px;border-radius:${r};background:${b.c};flex-shrink:0"></span>${b.label}</span>`).join('');
}

// ---- Habits ----
const SLEEP_BG      = 'repeating-linear-gradient(45deg,#3d5a80,#3d5a80 3px,#5b8dbf 3px,#5b8dbf 6px)';
const HALF_SLEEP_BG = 'repeating-linear-gradient(45deg,#8ecae6,#8ecae6 3px,#b8daed 3px,#b8daed 6px)';

function starsHtml(abs) {
  const filled = abs >= 0.5 ? 3 : abs >= 0.3 ? 2 : abs >= 0.1 ? 1 : 0;
  return `<span style="color:#F5A500">${'★'.repeat(filled)}</span><span style="color:var(--muted)">${'☆'.repeat(3-filled)}</span>`;
}
