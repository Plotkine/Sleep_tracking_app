// Onglet Régression — trois analyses empilées de la forme du jour (et, pour la 3ᵉ, de
// la durée de sommeil) contre les variables des corrélations. Tout est calculé sur
// TOUTES les entrées, sans dépendance externe (l'app tourne hors ligne) : l'algèbre
// linéaire, les lois de Student/Fisher, l'ACP (Jacobi) et la forêt d'arbres + SHAP sont
// implémentées ici.
//
//   1. Régression linéaire multiple — poids standardisés, p-valeurs, R² du modèle.
//   2. ACP puis régression (PCR) — les variables sont d'abord résumées en axes non
//      corrélés, ce qui règle le problème des variables qui se ressemblent.
//   3. Forêt aléatoire + SHAP — capte les interactions (p. ex. sport tard ET repas lourd)
//      et donne l'impact de chaque action en minutes de sommeil.
//
// Seules les variables atteignant 10 observations sont retenues, comme partout.

const REG_MIN_N = 10;

// ============================ Aides numériques ============================
function _betacf(a, b, x) {
  const FPMIN = 1e-300, EPS = 3e-12, MAXIT = 200;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function _gammaln(x) {
  const cof = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x; const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; ser += cof[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
// Bêta incomplète régularisée I_x(a,b)
function _betai(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(_gammaln(a + b) - _gammaln(a) - _gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * _betacf(a, b, x) / a : 1 - bt * _betacf(b, a, 1 - x) / b;
}
// p-valeur bilatérale de Student (df degrés de liberté)
function _studentP(t, df) { return df <= 0 ? NaN : _betai(df / 2, 0.5, df / (df + t * t)); }
// p-valeur (queue supérieure) de Fisher
function _fP(f, d1, d2) { return (f <= 0 || d1 <= 0 || d2 <= 0) ? NaN : _betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * f)); }

// Valeurs/vecteurs propres d'une matrice symétrique (Jacobi), triés par valeur décroissante.
function _jacobiEig(Sin) {
  const n = Sin.length;
  const a = Sin.map(r => r.slice());
  const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off < 1e-14) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-18) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const sgn = theta >= 0 ? 1 : -1;   // Math.sign(0)===0 tuerait la rotation
      const t = sgn / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let i = 0; i < n; i++) { const aip = a[i][p], aiq = a[i][q]; a[i][p] = c * aip - s * aiq; a[i][q] = s * aip + c * aiq; }
      for (let i = 0; i < n; i++) { const api = a[p][i], aqi = a[q][i]; a[p][i] = c * api - s * aqi; a[q][i] = s * api + c * aqi; }
      for (let i = 0; i < n; i++) { const vip = v[i][p], viq = v[i][q]; v[i][p] = c * vip - s * viq; v[i][q] = s * vip + c * viq; }
    }
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  return { values: idx.map(i => a[i][i]), vectors: idx.map(i => v.map(row => row[i])) };
}

function _regInv(A) {
  const n = A.length;
  const M = A.map((r, i) => r.slice().concat(Array.from({ length: n }, (_, j) => i === j ? 1 : 0)));
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-11) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c]; if (!f) continue; for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map(r => r.slice(n));
}

// Moindres carrés ordinaires. X inclut la colonne de constante. Renvoie les coefficients,
// R², R² ajusté, p-valeurs (Student) et p globale (Fisher), ou null si non estimable.
function _ols(X, y) {
  const n = X.length, p = X[0].length;
  if (n <= p) return null;
  const XtX = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => { let s = 0; for (let r = 0; r < n; r++) s += X[r][i] * X[r][j]; return s; }));
  const Xty = Array.from({ length: p }, (_, i) => { let s = 0; for (let r = 0; r < n; r++) s += X[r][i] * y[r]; return s; });
  const inv = _regInv(XtX); if (!inv) return null;
  const beta = inv.map(row => row.reduce((s, v, j) => s + v * Xty[j], 0));
  const ybar = y.reduce((a, b) => a + b, 0) / n;
  let RSS = 0, TSS = 0;
  for (let r = 0; r < n; r++) { const yh = X[r].reduce((s, v, j) => s + v * beta[j], 0); RSS += (y[r] - yh) ** 2; TSS += (y[r] - ybar) ** 2; }
  const df = n - p;
  const r2 = TSS > 0 ? 1 - RSS / TSS : 0;
  const adjR2 = 1 - (1 - r2) * (n - 1) / df;
  const sigma2 = RSS / df;
  const se = inv.map((row, i) => Math.sqrt(Math.max(0, sigma2 * row[i])));
  const tval = beta.map((b, i) => se[i] > 0 ? b / se[i] : 0);
  const pval = tval.map(t => _studentP(t, df));
  const F = (p > 1 && r2 < 1) ? (r2 / (p - 1)) / ((1 - r2) / df) : NaN;
  return { beta, se, t: tval, p: pval, r2, adjR2, df, n, F, fp: isNaN(F) ? NaN : _fP(F, p - 1, df) };
}

const _mean = a => a.reduce((s, v) => s + v, 0) / a.length;
const _sd = a => { const m = _mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
function _regCorr(a, b) {
  const xs = [], ys = [];
  for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null) { xs.push(a[i]); ys.push(b[i]); }
  const n = xs.length; if (n < 2) return { r: 0, n };
  const mx = _mean(xs), my = _mean(ys); let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const den = Math.sqrt(dx * dy);
  return { r: den ? num / den : 0, n };
}
const _regVar = x => { const v = x.filter(a => a != null); return v.length < 2 ? 0 : v.reduce((s, a) => s + (a - _mean(v)) ** 2, 0); };
// PRNG déterministe : la forêt ne doit pas changer à chaque affichage.
function _mulberry32(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ============================ Données partagées ============================
// Colonnes prédictives de la FORME (analyses 1 & 2) et des ACTIONS→DURÉE (analyse 3).
function _regBase() {
  const sorted = [...entries].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const byDate = {}; sorted.forEach(e => byDate[e.dateStr] = e);
  const prev = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() - n); return byDate[d.toISOString().split('T')[0]] ?? null; };
  const avgDur = (e, n) => { let s = 0; for (let k = 0; k < n; k++) { const en = k === 0 ? e : prev(e.dateStr, k); const v = en ? sleepDuration(en) : null; if (v === null) return null; s += v; } return s / n; };
  const avgOns = (e, n) => { let s = 0; for (let k = 0; k < n; k++) { const en = k === 0 ? e : prev(e.dateStr, k); const v = en ? sleepOnsetH(en) : null; if (v === null) return null; s += v; } return s / n; };
  const bedH = e => { const sl = normalizeSleeps(e)[0]; const tt = sl && (sl.bed || sl.sleepStart); if (!tt) return null; const [h, m] = tt.split(':').map(Number); return h >= 20 ? h + m / 60 : h + m / 60 + 24; };
  const habState = (e, h) => { if ((e.habits || []).includes(h.id)) return 1; if ((e.habitsNotDone || []).includes(h.id)) return 0; return null; };
  const trackedHabits = habits.filter(h => h.tracked !== false);
  const trackedEvents = events.filter(v => v.tracked !== false);

  // Prédicteurs de la forme (entrée e -> forme J+1). Impact « J » lu sur e, « J+1 » sur la veille.
  const formDefs = [
    { label: t('corr_dur_veille'), fn: e => sleepDuration(e) },
    { label: t('corr_dur_avv'), fn: e => { const p = prev(e.dateStr, 1); return p ? sleepDuration(p) : null; } },
    { label: t('corr_dur_avg')(2), fn: e => avgDur(e, 2) },
    { label: t('corr_dur_avg')(3), fn: e => avgDur(e, 3) },
    { label: t('corr_dur_avg')(5), fn: e => avgDur(e, 5) },
    { label: t('corr_onset_veille'), fn: e => sleepOnsetH(e) },
    { label: t('corr_onset_avv'), fn: e => { const p = prev(e.dateStr, 1); return p ? sleepOnsetH(p) : null; } },
    { label: t('corr_onset_avg')(2), fn: e => avgOns(e, 2) },
    { label: t('corr_onset_avg')(3), fn: e => avgOns(e, 3) },
    { label: t('corr_onset_avg')(5), fn: e => avgOns(e, 5) },
    { label: t('corr_bed'), fn: e => bedH(e) },
    ...trackedHabits.map(h => ({ label: h.name, fn: e => { const src = (h.sleepImpact || 'next') === 'same' ? e : prev(e.dateStr, 1); return src ? habState(src, h) : null; } })),
    ...trackedEvents.map(v => ({ label: v.name, fn: e => { const src = (v.sleepImpact || 'same') === 'same' ? e : prev(e.dateStr, 1); return src ? eventState(src, v.id) : null; } })),
  ];
  const obsForm = sorted.filter(e => RSCORE[e.dayForm]);
  const YForm = obsForm.map(e => RSCORE[e.dayForm]);
  formDefs.forEach(d => { d.x = obsForm.map(d.fn); d.n = d.x.filter(v => v != null).length; });
  const keptForm = formDefs.filter(d => d.n >= REG_MIN_N && _regVar(d.x) > 1e-9);
  const excludedForm = formDefs.filter(d => !(d.n >= REG_MIN_N && _regVar(d.x) > 1e-9)).map(d => ({ label: d.label, n: d.n }));

  // Prédicteurs « actions » de la DURÉE de la nuit (entrée e -> sa propre nuit).
  const actionDefs = [
    { label: t('corr_bed'), cont: true, fn: e => bedH(e) },
    ...trackedHabits.map(h => ({ label: h.name, cont: false, fn: e => { const src = (h.sleepImpact || 'next') === 'same' ? e : prev(e.dateStr, 1); return src ? habState(src, h) : null; } })),
    ...trackedEvents.map(v => ({ label: v.name, cont: false, fn: e => { const src = (v.sleepImpact || 'same') === 'same' ? e : prev(e.dateStr, 1); return src ? eventState(src, v.id) : null; } })),
  ];
  const obsDur = sorted.filter(e => sleepDuration(e) != null);
  const YDur = obsDur.map(e => sleepDuration(e));
  actionDefs.forEach(d => { d.x = obsDur.map(d.fn); d.n = d.x.filter(v => v != null).length; });
  const keptAction = actionDefs.filter(d => d.n >= REG_MIN_N && _regVar(d.x) > 1e-9);

  return { obsForm, YForm, keptForm, excludedForm, obsDur, YDur, keptAction };
}

// ============ Analyse 1 : régression multiple (sélection ascendante, p-valeurs) ============
// Une régression sur toutes les variables à la fois exige plus de jours communs qu'il n'y
// en a (elles ne sont pas encodées les mêmes soirs) : le modèle complet n'est pas
// estimable et n'aurait pas de p-valeurs. On sélectionne donc par pas ascendants : on
// n'ajoute une variable que si elle améliore le R² ajusté. Les p-valeurs sont alors
// exactes sur le modèle retenu (indicatives, la sélection les optimise un peu).
function buildRegression() {
  const { obsForm: obs, YForm: Y, keptForm: kept, excludedForm: excluded } = _regBase();
  if (kept.length < 1 || _regVar(Y) < 1e-9) return { insufficient: true, excluded };
  const MIN_DF = 4;
  const fitSet = preds => {
    const rows = [];
    for (let i = 0; i < obs.length; i++) if (preds.every(p => p.x[i] != null)) rows.push(i);
    if (rows.length < preds.length + 1 + MIN_DF) return null;
    const cols = preds.map(p => { const v = rows.map(i => p.x[i]); const m = _mean(v), sd = _sd(v); return sd < 1e-9 ? null : v.map(z => (z - m) / sd); });
    if (cols.some(c => c === null)) return null;
    const y0 = rows.map(i => Y[i]); const ym = _mean(y0), ysd = _sd(y0); if (ysd < 1e-9) return null;
    const yv = y0.map(z => (z - ym) / ysd);
    const X = rows.map((_, r) => [1, ...cols.map(c => c[r])]);
    const res = _ols(X, yv);
    return res && { res, n: rows.length };
  };

  let selected = [], best = null, remaining = kept.slice();
  while (remaining.length) {
    let cand = null;
    for (const c of remaining) { const f = fitSet([...selected, c]); if (f && (!cand || f.res.adjR2 > cand.f.res.adjR2)) cand = { c, f }; }
    if (!cand) break;
    if (best && cand.f.res.adjR2 <= best.res.adjR2 + 1e-6) break;   // n'améliore plus
    selected.push(cand.c); remaining = remaining.filter(p => p !== cand.c); best = cand.f;
  }
  if (!best) return { insufficient: true, excluded, nofit: true };
  const res = best.res;
  const rows = selected.map((p, i) => ({ label: p.label, beta: res.beta[i + 1], p: res.p[i + 1] }))
                       .sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
  const notSel = kept.filter(k => !selected.includes(k)).map(k => k.label);
  return { insufficient: false, nObs: best.n, r2: res.r2, adjR2: res.adjR2, fp: res.fp, df: res.df, rows, notSel, excluded };
}

// ==================== Analyse 2 : ACP puis régression (PCR) ====================
function buildPCR() {
  const { obsForm: obs, YForm: Y, keptForm: kept } = _regBase();
  if (kept.length < 2 || _regVar(Y) < 1e-9 || obs.length < REG_MIN_N + 2) return { insufficient: true };
  // Standardisation de chaque variable (les manquantes restent nulles).
  const cols = kept.map(k => { const v = k.x.filter(a => a != null); const m = _mean(v), sd = _sd(v); return { label: k.label, z: k.x.map(a => a == null ? null : (sd > 0 ? (a - m) / sd : 0)) }; });
  const p = cols.length;
  const Rm = cols.map((ci, i) => cols.map((cj, j) => { if (i === j) return 1; const c = _regCorr(ci.z, cj.z); return c.n >= REG_MIN_N ? c.r : 0; }));
  const eig = _jacobiEig(Rm);
  const totVar = eig.values.reduce((s, v) => s + Math.max(0, v), 0) || p;
  // Composantes de Kaiser (valeur propre ≥ 1), bornées pour garder des degrés de liberté.
  const maxComp = Math.max(1, Math.min(p, obs.length - REG_MIN_N));
  let nc = eig.values.filter(v => v >= 1).length;
  nc = Math.min(Math.max(nc, 1), maxComp);
  // Scores : projection de chaque jour (valeurs manquantes ramenées à la moyenne = 0).
  const scoreCols = [];
  for (let c = 0; c < nc; c++) {
    let vec = eig.vectors[c];
    // Oriente le signe pour que la plus grosse charge soit positive (affichage stable).
    const mx = vec.reduce((mi, v, i) => Math.abs(v) > Math.abs(vec[mi]) ? i : mi, 0);
    if (vec[mx] < 0) vec = vec.map(v => -v);
    const raw = obs.map((_, i) => cols.reduce((s, col, j) => s + vec[j] * (col.z[i] ?? 0), 0));
    const m = _mean(raw), sd = _sd(raw);
    scoreCols.push({ vec, data: sd > 0 ? raw.map(v => (v - m) / sd) : raw.map(() => 0), varExpl: Math.max(0, eig.values[c]) / totVar });
  }
  const ym = _mean(Y), ysd = _sd(Y);
  const yv = Y.map(v => (v - ym) / ysd);
  const X = obs.map((_, i) => [1, ...scoreCols.map(s => s.data[i])]);
  const res = _ols(X, yv);
  if (!res) return { insufficient: true };
  const comps = scoreCols.map((s, i) => ({
    idx: i + 1, varExpl: s.varExpl, coef: res.beta[i + 1], p: res.p[i + 1],
    loadings: kept.map((k, j) => ({ label: k.label, load: s.vec[j] })).sort((a, b) => Math.abs(b.load) - Math.abs(a.load)).slice(0, 3),
  }));
  const totExpl = scoreCols.reduce((s, c) => s + c.varExpl, 0);
  return { insufficient: false, nObs: obs.length, r2: res.r2, adjR2: res.adjR2, fp: res.fp, df: res.df, comps, nComp: nc, totExpl };
}

// ==================== Analyse 3 : forêt aléatoire + SHAP ====================
// Cible = durée de la nuit (heures). Prédicteurs = les actions (habitudes, évènements,
// heure de coucher). Les arbres captent les interactions ; les valeurs de Shapley donnent
// l'apport de chaque action à la durée prédite, converti en minutes.
function _buildTree(rows, X, y, feats, depth, opts, rng) {
  const val = _mean(rows.map(i => y[i]));
  const node = { value: val, cover: rows.length };
  if (depth >= opts.maxDepth || rows.length < 2 * opts.minLeaf) return node;
  let base = 0; { const m = val; for (const i of rows) base += (y[i] - m) ** 2; }
  if (base < 1e-12) return node;
  // Sous-échantillon aléatoire de variables candidates.
  const k = Math.max(1, Math.round(feats.length * opts.featFrac));
  const cand = feats.slice(); for (let a = cand.length - 1; a > 0; a--) { const b = Math.floor(rng() * (a + 1)); [cand[a], cand[b]] = [cand[b], cand[a]]; }
  const use = cand.slice(0, k);
  let bestErr = base, split = null;
  for (const f of use) {
    const vals = [...new Set(rows.map(i => X[i][f]))].sort((a, b) => a - b);
    for (let s = 0; s < vals.length - 1; s++) {
      const thr = (vals[s] + vals[s + 1]) / 2;
      const L = rows.filter(i => X[i][f] <= thr), Rr = rows.filter(i => X[i][f] > thr);
      if (L.length < opts.minLeaf || Rr.length < opts.minLeaf) continue;
      const mL = _mean(L.map(i => y[i])), mR = _mean(Rr.map(i => y[i]));
      let err = 0; for (const i of L) err += (y[i] - mL) ** 2; for (const i of Rr) err += (y[i] - mR) ** 2;
      if (err < bestErr - 1e-12) { bestErr = err; split = { f, thr, L, Rr }; }
    }
  }
  if (!split) return node;
  node.feature = split.f; node.threshold = split.thr;
  node.left = _buildTree(split.L, X, y, feats, depth + 1, opts, rng);
  node.right = _buildTree(split.Rr, X, y, feats, depth + 1, opts, rng);
  return node;
}
function _treePredict(node, x) { while (node.left) node = x[node.feature] <= node.threshold ? node.left : node.right; return node.value; }
// Espérance conditionnelle E[f(x) | x_S] : les variables hors de S sont intégrées via la
// proportion d'échantillons d'apprentissage passant par chaque branche (path-dependent).
function _treeCondExp(node, x, mask) {
  if (!node.left) return node.value;
  if ((mask >> node.feature) & 1) return _treeCondExp(x[node.feature] <= node.threshold ? node.left : node.right, x, mask);
  return (node.left.cover * _treeCondExp(node.left, x, mask) + node.right.cover * _treeCondExp(node.right, x, mask)) / node.cover;
}
// SHAP exact par énumération des sous-ensembles (M petit : les actions retenues).
function _shapInstance(node, x, M, shapWeights) {
  const table = new Array(1 << M);
  for (let m = 0; m < (1 << M); m++) table[m] = _treeCondExp(node, x, m);
  const phi = new Array(M).fill(0);
  for (let i = 0; i < M; i++) {
    const bit = 1 << i;
    for (let m = 0; m < (1 << M); m++) {
      if (m & bit) continue;
      phi[i] += shapWeights[_popcount(m)] * (table[m | bit] - table[m]);
    }
  }
  return phi;
}
function _popcount(x) { let c = 0; while (x) { c += x & 1; x >>= 1; } return c; }

function buildTreeShap() {
  const { obsDur: obs, YDur: y0, keptAction: kept0 } = _regBase();
  // Assez d'actions ? Il faut au moins une action binaire (sinon pas d'« interaction »).
  const acts = kept0.filter(k => k.n >= REG_MIN_N);
  if (obs.length < 15 || acts.filter(a => !a.cont).length < 1) return { insufficient: true, nObs: obs.length };
  // On borne le nombre de variables (le SHAP énumère 2^M sous-ensembles).
  let feats = acts;
  if (feats.length > 10) {
    feats = feats.map(f => ({ f, r: Math.abs(_regCorr(f.x, y0).r) })).sort((a, b) => b.r - a.r).slice(0, 10).map(o => o.f);
  }
  const M = feats.length;
  // Matrice X imputée (mode pour le binaire, médiane pour le continu) ; y = durée.
  const impute = feats.map(f => { const v = f.x.filter(a => a != null); if (f.cont) { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; } const ones = v.filter(a => a === 1).length; return ones >= v.length / 2 ? 1 : 0; });
  const X = obs.map((_, i) => feats.map((f, j) => f.x[i] == null ? impute[j] : f.x[i]));
  const y = y0.slice();
  const n = y.length;

  const opts = { nTrees: 120, maxDepth: 3, minLeaf: 3, featFrac: 0.7 };
  const rng = _mulberry32(20260724);
  const trees = [];
  const oobPred = Array.from({ length: n }, () => []);
  const featIdx = feats.map((_, i) => i);
  for (let t = 0; t < opts.nTrees; t++) {
    const boot = [], inbag = new Set();
    for (let k = 0; k < n; k++) { const j = Math.floor(rng() * n); boot.push(j); inbag.add(j); }
    const tree = _buildTree(boot, X, y, featIdx, 0, opts, rng);
    trees.push(tree);
    for (let k = 0; k < n; k++) if (!inbag.has(k)) oobPred[k].push(_treePredict(tree, X[k]));
  }
  // Qualité hors-sac (out-of-bag) : la vraie capacité prédictive, pas l'ajustement.
  let ossR2 = null;
  { let RSS = 0, TSS = 0, cnt = 0; const ybar = _mean(y);
    for (let k = 0; k < n; k++) { if (!oobPred[k].length) continue; const pr = _mean(oobPred[k]); RSS += (y[k] - pr) ** 2; TSS += (y[k] - ybar) ** 2; cnt++; }
    if (cnt > 2 && TSS > 0) ossR2 = 1 - RSS / TSS; }

  // Poids de Shapley par taille de coalition.
  const fact = [1]; for (let i = 1; i <= M; i++) fact[i] = fact[i - 1] * i;
  const shapWeights = []; for (let s = 0; s <= M - 1; s++) shapWeights[s] = fact[s] * fact[M - s - 1] / fact[M];

  const base = _mean(trees.map(tr => tr.value));   // valeur attendue du modèle
  const absSum = new Array(M).fill(0), sgnSum = new Array(M).fill(0);
  let maxAccErr = 0;
  for (let k = 0; k < n; k++) {
    const phi = new Array(M).fill(0);
    for (const tr of trees) { const pt = _shapInstance(tr, X[k], M, shapWeights); for (let i = 0; i < M; i++) phi[i] += pt[i] / opts.nTrees; }
    for (let i = 0; i < M; i++) { absSum[i] += Math.abs(phi[i]); sgnSum[i] += phi[i]; }
    // Contrôle : Σφ = prédiction − base (précision locale).
    const pred = _mean(trees.map(tr => _treePredict(tr, X[k])));
    maxAccErr = Math.max(maxAccErr, Math.abs(phi.reduce((a, b) => a + b, 0) - (pred - base)));
  }
  const rows = feats.map((f, i) => ({ label: f.label, imp: absSum[i] / n * 60, dir: sgnSum[i] / n * 60 }))
                    .sort((a, b) => b.imp - a.imp);
  return { insufficient: false, nObs: n, rows, oobR2: ossR2, base, accErr: maxAccErr };
}

// ============================ Rendu ============================
function _regBetaColor(b) { return b > 0.05 ? SCALE.good : b < -0.05 ? SCALE.bad : 'var(--muted)'; }
function _fmtP(p) { if (p == null || isNaN(p)) return '–'; if (p < 0.001) return '< 0,001'.replace(',', t('locale') === 'en-US' ? '.' : ','); return (t('locale') === 'en-US' ? p.toFixed(3) : p.toFixed(3).replace('.', ',')); }
function _pCell(p) { const sig = p != null && p < 0.05; return `<span style="color:${sig ? 'var(--text)' : 'var(--muted)'};font-weight:${sig ? 700 : 400}">${t('reg_p')} ${_fmtP(p)}</span>`; }
function _sectionTitle(txt) { return `<div style="margin:0 0 6px"><span style="font-size:0.72rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">${txt}</span></div>`; }
function _fitSummary(R) {
  return `<div class="chart-card" style="margin-bottom:12px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
      <span style="font-size:2rem;font-weight:700;color:var(--primary-light)">${Math.round(R.r2 * 100)}%</span>
      <span style="font-size:0.85rem;color:var(--text)">${t('reg_r2_label')}</span>
      <span style="font-size:0.74rem;color:var(--muted);margin-left:auto">${t('reg_sub')(Math.round(R.adjR2 * 100), _fmtP(R.fp), R.nObs)}</span>
    </div>`;
}
function _betaTable(R) {
  const maxAbs = Math.max(...R.rows.map(r => Math.abs(r.beta)), 1e-4);
  const body = R.rows.map(row => {
    const col = _regBetaColor(row.beta);
    const w = Math.round(Math.abs(row.beta) / maxAbs * 84);
    const bar = `<span style="display:inline-block;width:${w}px;height:8px;border-radius:2px;background:${col};vertical-align:middle"></span>`;
    return `<tr>
      <td style="padding:4px 10px 4px 0;font-size:0.8rem">${row.label}</td>
      <td style="padding:4px 4px;text-align:${row.beta >= 0 ? 'left' : 'right'}"><span style="display:inline-block;width:88px;text-align:${row.beta >= 0 ? 'left' : 'right'}">${bar}</span></td>
      <td style="padding:4px 8px;font-size:0.8rem;font-weight:700;color:${col};white-space:nowrap;text-align:right">${row.beta >= 0 ? '+' : '−'}${Math.abs(row.beta).toFixed(2)}</td>
      <td style="padding:4px 0 4px 12px;font-size:0.76rem;white-space:nowrap">${_pCell(row.p)}</td>
    </tr>`;
  }).join('');
  return `<div class="chart-card" style="margin-bottom:12px">
      <p style="font-size:0.8rem;font-weight:600;margin:0 0 4px">${t('reg_table_title')}</p>
      <p style="font-size:0.74rem;color:var(--muted);margin:0 0 10px">${t('reg_beta_help')}</p>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr>
          <th style="text-align:left;padding:2px 10px 8px 0;font-size:0.72rem;color:var(--muted);font-weight:500">${t('reg_col_var')}</th>
          <th style="text-align:center;padding:2px 4px 8px;font-size:0.72rem;color:var(--muted);font-weight:500">${t('reg_col_beta')}</th>
          <th></th>
          <th style="text-align:left;padding:2px 0 8px 12px;font-size:0.72rem;color:var(--muted);font-weight:500">${t('reg_col_p')}</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function renderRegression() {
  const el = document.getElementById('regression-view');
  if (!el) return;
  const R1 = buildRegression(), R2 = buildPCR(), R3 = buildTreeShap();
  let html = _sectionTitle(t('reg_section')) + `<p style="font-size:0.82rem;color:var(--text);margin:0 0 14px;line-height:1.5">${t('reg_intro')}</p>`;

  // ---- Analyse 1 ----
  if (R1.insufficient) {
    html += `<div class="chart-card" style="margin-bottom:20px"><p style="font-size:0.85rem;color:var(--muted);margin:0">${t('reg_none')}</p></div>`;
  } else {
    html += _fitSummary(R1) + _betaTable(R1);
    if (R1.notSel.length) html += `<div class="chart-card" style="margin-bottom:12px"><p style="font-size:0.78rem;font-weight:600;margin:0 0 6px">${t('reg_notsel')}</p><div style="display:flex;flex-wrap:wrap;gap:6px 14px">${R1.notSel.map(l => `<span style="font-size:0.76rem;color:var(--muted)">${l}</span>`).join('')}</div></div>`;
    if (R1.excluded.length) html += `<div class="chart-card" style="margin-bottom:12px"><p style="font-size:0.78rem;font-weight:600;margin:0 0 6px">${t('reg_excluded')}</p><div style="display:flex;flex-wrap:wrap;gap:6px 14px">${R1.excluded.map(x => `<span style="font-size:0.76rem;color:var(--muted)">${x.label} <span style="opacity:0.7">(n=${x.n})</span></span>`).join('')}</div></div>`;
    html += `<div class="chart-card" style="background:transparent;border:1px dashed var(--border);margin-bottom:22px"><p style="font-size:0.74rem;color:var(--muted);margin:0;line-height:1.5">${t('reg_cav_select')} ${t('reg_cav_sample')} ${t('reg_cav_cause')}</p></div>`;
  }

  // ---- Analyse 2 : PCR ----
  html += _sectionTitle(t('reg2_section')) + `<p style="font-size:0.82rem;color:var(--text);margin:0 0 14px;line-height:1.5">${t('reg2_intro')}</p>`;
  if (R2.insufficient) {
    html += `<div class="chart-card" style="margin-bottom:20px"><p style="font-size:0.85rem;color:var(--muted);margin:0">${t('reg_none')}</p></div>`;
  } else {
    html += _fitSummary(R2);
    const comps = R2.comps.map(c => {
      const col = _regBetaColor(c.coef), maxAbs = Math.max(...R2.comps.map(x => Math.abs(x.coef)), 1e-4);
      const w = Math.round(Math.abs(c.coef) / maxAbs * 84);
      const loads = c.loadings.map(l => `${l.label} <span style="color:${l.load >= 0 ? 'var(--muted)' : 'var(--muted)'}">(${l.load >= 0 ? '+' : '−'}${Math.abs(l.load).toFixed(2)})</span>`).join(', ');
      return `<tr>
        <td style="padding:5px 10px 5px 0;font-size:0.8rem;white-space:nowrap">${t('reg2_axis')(c.idx)}<br><span style="font-size:0.72rem;color:var(--muted)">${Math.round(c.varExpl * 100)}% ${t('reg2_var')}</span></td>
        <td style="padding:5px 8px;font-size:0.74rem;color:var(--text)">${t('reg2_madeof')} ${loads}</td>
        <td style="padding:5px 8px;text-align:right"><span style="display:inline-block;width:${w}px;height:8px;border-radius:2px;background:${col};vertical-align:middle"></span></td>
        <td style="padding:5px 8px;font-size:0.8rem;font-weight:700;color:${col};white-space:nowrap;text-align:right">${c.coef >= 0 ? '+' : '−'}${Math.abs(c.coef).toFixed(2)}</td>
        <td style="padding:5px 0 5px 12px;font-size:0.76rem;white-space:nowrap">${_pCell(c.p)}</td>
      </tr>`;
    }).join('');
    html += `<div class="chart-card" style="margin-bottom:12px">
        <p style="font-size:0.8rem;font-weight:600;margin:0 0 4px">${t('reg2_table_title')(R2.nComp, Math.round(R2.totExpl * 100))}</p>
        <p style="font-size:0.74rem;color:var(--muted);margin:0 0 10px">${t('reg2_help')}</p>
        <table style="border-collapse:collapse;width:100%"><tbody>${comps}</tbody></table>
      </div>`;
    html += `<div class="chart-card" style="background:transparent;border:1px dashed var(--border);margin-bottom:22px"><p style="font-size:0.74rem;color:var(--muted);margin:0;line-height:1.5">${t('reg2_impnote')} ${t('reg_cav_sample')} ${t('reg_cav_cause')}</p></div>`;
  }

  // ---- Analyse 3 : forêt + SHAP ----
  html += _sectionTitle(t('reg3_section')) + `<p style="font-size:0.82rem;color:var(--text);margin:0 0 14px;line-height:1.5">${t('reg3_intro')}</p>`;
  if (R3.insufficient) {
    html += `<div class="chart-card"><p style="font-size:0.85rem;color:var(--muted);margin:0">${t('reg3_none')}</p></div>`;
  } else {
    const oob = R3.oobR2 == null ? '–' : Math.round(R3.oobR2 * 100) + '%';
    html += `<div class="chart-card" style="margin-bottom:12px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
        <span style="font-size:1.4rem;font-weight:700;color:var(--primary-light)">${oob}</span>
        <span style="font-size:0.82rem;color:var(--text)">${t('reg3_oob')}</span>
        <span style="font-size:0.74rem;color:var(--muted);margin-left:auto">${t('reg_nobs')(R3.nObs)}</span>
      </div>`;
    const maxImp = Math.max(...R3.rows.map(r => r.imp), 1e-4);
    const body = R3.rows.map(row => {
      const col = row.dir > 0.5 ? SCALE.good : row.dir < -0.5 ? SCALE.bad : 'var(--muted)';
      const w = Math.round(row.imp / maxImp * 120);
      const dm = Math.round(row.dir);
      const dirTxt = dm === 0 ? `≈ 0 ${t('reg3_min')}` : `${dm > 0 ? '+' : '−'}${Math.abs(dm)} ${t('reg3_min')}`;
      return `<tr>
        <td style="padding:5px 10px 5px 0;font-size:0.8rem">${row.label}</td>
        <td style="padding:5px 8px"><span style="display:inline-block;width:${w}px;height:9px;border-radius:2px;background:${col};vertical-align:middle"></span></td>
        <td style="padding:5px 8px;font-size:0.8rem;font-weight:700;color:var(--text);white-space:nowrap;text-align:right">${Math.round(row.imp)} ${t('reg3_min')}</td>
        <td style="padding:5px 0 5px 12px;font-size:0.76rem;color:${col};white-space:nowrap">${dirTxt}</td>
      </tr>`;
    }).join('');
    html += `<div class="chart-card" style="margin-bottom:12px">
        <p style="font-size:0.8rem;font-weight:600;margin:0 0 4px">${t('reg3_table_title')}</p>
        <p style="font-size:0.74rem;color:var(--muted);margin:0 0 10px">${t('reg3_help')}</p>
        <table style="border-collapse:collapse;width:100%">
          <thead><tr>
            <th style="text-align:left;padding:2px 10px 8px 0;font-size:0.72rem;color:var(--muted);font-weight:500">${t('reg_col_var')}</th>
            <th style="text-align:left;padding:2px 8px 8px;font-size:0.72rem;color:var(--muted);font-weight:500">${t('reg3_col_imp')}</th>
            <th></th>
            <th style="text-align:left;padding:2px 0 8px 12px;font-size:0.72rem;color:var(--muted);font-weight:500">${t('reg3_col_dir')}</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
    html += `<div class="chart-card" style="background:transparent;border:1px dashed var(--border)"><p style="font-size:0.74rem;color:var(--muted);margin:0;line-height:1.5">${t('reg3_cav_interact')} ${t('reg3_cav_sample')} ${t('reg_cav_cause')}</p></div>`;
  }

  el.innerHTML = html;
}
