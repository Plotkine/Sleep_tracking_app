// Couleurs : palette d'appréciation et bandes des échelles (durée, endormissement).
// Dépend de state.js (objectifs) et sleep.js (formatage) au moment de l'appel, pas au chargement.
const RCOLOR = {TB:'#27ae60',B:'#82c341',Moy:'#f7e08a',M:'#e67e22',TM:'#e74c3c'};

// ---- Palette d'appréciation : LA source unique de couleur de toute l'app ----
// Aucun barème ne doit être redéfini ailleurs, même « juste pour cet encart » :
// c'est ainsi qu'une même nuit finissait orange dans l'historique et vert clair
// dans le graphe des durées.
const SCALE = { good: '#27ae60', ok: '#a8d44a', poor: '#e67e22', bad: '#e74c3c' };

// Chaque échelle est décrite par ses bandes : couleur, libellé et test.
// Les tests sont **mutuellement exclusifs et exhaustifs**, ce qui permet de s'en
// servir aussi bien pour colorer une valeur que pour regrouper des points par
// tranche, sans jamais compter une valeur deux fois. Ordre : de la meilleure
// bande à la pire.

// Durée de sommeil — toujours relative à l'objectif, partout.
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

// Heure d'endormissement — écart à l'objectif.
// Convention ]a, b] : la borne haute est incluse, la dernière bande est au-delà.
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
// Attention à ne jamais passer ces fonctions nues à .map(), qui fournirait
// l'index en deuxième argument.
function durColor(d, nullColor = 'var(--muted)') {
  return d == null ? nullColor : durBands().find(b => b.test(d)).c;
}
function onsetColor(v, nullColor = 'var(--muted)') {
  return v == null ? nullColor : onsetBands().find(b => b.test(v)).c;
}

// Ratio 0–1 (part d'habitudes respectées)
function ratioColor(v) {
  if (v == null) return 'var(--muted)';
  return v >= 0.75 ? SCALE.good : v >= 0.5 ? SCALE.ok : v >= 0.25 ? SCALE.poor : SCALE.bad;
}

// Tranches d'une analyse détaillée, engendrées par les mêmes bandes : les seuils
// du tableau collent donc toujours aux couleurs affichées ailleurs.
function bucketsFrom(bands) {
  return bands.map(b => [b.label, b.test, b.c]);
}

// Légende engendrée par les bandes elles-mêmes : elle ne peut pas mentir.
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
