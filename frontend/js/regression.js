// Régression linéaire multiple : la forme du jour (RSCORE 1→5) expliquée par TOUTES les
// variables des corrélations à la fois, et non une par une comme le fait le tableau des
// corrélations. L'apport de chaque variable est estimé « les autres tenues constantes »,
// ce qui sépare par exemple l'effet de l'heure d'endormissement de celui de la durée.
//
// Méthode. On travaille sur coefficients standardisés (donc comparables entre eux) :
//   β = R⁻¹ r
// où r est le vecteur des corrélations variable→forme et R la matrice des corrélations
// entre variables. Chaque corrélation est calculée sur ses propres paires disponibles
// (available-case), ce qui évite d'exiger que toutes les variables soient encodées le
// même jour — sinon il ne resterait presque aucune ligne. Comme pour le reste de l'app,
// une variable n'est retenue que si elle atteint MIN_N = 10 paires avec la forme.
//
// Colinéarité. Les moyennes glissantes (durée moy. 2/3/5 nuits…) se ressemblent beaucoup :
// R peut devenir quasi singulière et faire exploser les coefficients. On résout donc avec
// une petite crête (ridge λ) ajoutée au besoin, en partant de λ = 0 (moindres carrés purs)
// et en n'augmentant que si le résultat dérape. Le fait qu'une stabilisation ait été
// nécessaire est signalé à l'utilisateur.

const REG_MIN_N = 10;

// Résout A x = b (Gauss-Jordan, pivot partiel). Renvoie null si A est singulière.
function _regSolve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => row.slice().concat(b[i]));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-9) return null;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = col; j <= n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (!f) continue;
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map(row => row[n]);
}

// Corrélation de Pearson sur les paires où a ET b sont renseignés (available-case).
function _regCorr(a, b) {
  const xs = [], ys = [];
  for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null) { xs.push(a[i]); ys.push(b[i]); }
  const n = xs.length;
  if (n < 2) return { r: 0, n };
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  const den = Math.sqrt(dx * dy);
  return { r: den ? num / den : 0, n };
}

function _regVar(x) {
  const v = x.filter(a => a != null);
  if (v.length < 2) return 0;
  const m = v.reduce((s, a) => s + a, 0) / v.length;
  return v.reduce((s, a) => s + (a - m) ** 2, 0);
}

function buildRegression() {
  const sorted = [...entries].sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  const byDate = {}; sorted.forEach(e => byDate[e.dateStr] = e);
  const prev = (ds, n) => { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() - n); return byDate[d.toISOString().split('T')[0]] ?? null; };

  const avgDur = (e, n) => { let s = 0; for (let k = 0; k < n; k++) { const en = k === 0 ? e : prev(e.dateStr, k); const v = en ? sleepDuration(en) : null; if (v === null) return null; s += v; } return s / n; };
  const avgOns = (e, n) => { let s = 0; for (let k = 0; k < n; k++) { const en = k === 0 ? e : prev(e.dateStr, k); const v = en ? sleepOnsetH(en) : null; if (v === null) return null; s += v; } return s / n; };
  const bedH = e => { const sl = normalizeSleeps(e)[0]; const tt = sl && (sl.bed || sl.sleepStart); if (!tt) return null; const [h, m] = tt.split(':').map(Number); return h >= 20 ? h + m / 60 : h + m / 60 + 24; };

  // La forme portée par l'entrée e est celle du jour J+1, qui suit la nuit J→J+1 de e.
  // Une variable d'impact « J » (same) est donc prise sur e ; une variable d'impact
  // « J+1 » (next) est prise sur l'entrée précédente, dont la nuit précède ce jour-là.
  const habState = (e, h) => { if ((e.habits || []).includes(h.id)) return 1; if ((e.habitsNotDone || []).includes(h.id)) return 0; return null; };
  const trackedHabits = habits.filter(h => h.tracked !== false);
  const trackedEvents = events.filter(v => v.tracked !== false);

  const defs = [
    { label: t('corr_dur_veille'),  fn: e => sleepDuration(e) },
    { label: t('corr_dur_avv'),     fn: e => { const p = prev(e.dateStr, 1); return p ? sleepDuration(p) : null; } },
    { label: t('corr_dur_avg')(2),  fn: e => avgDur(e, 2) },
    { label: t('corr_dur_avg')(3),  fn: e => avgDur(e, 3) },
    { label: t('corr_dur_avg')(5),  fn: e => avgDur(e, 5) },
    { label: t('corr_onset_veille'),fn: e => sleepOnsetH(e) },
    { label: t('corr_onset_avv'),   fn: e => { const p = prev(e.dateStr, 1); return p ? sleepOnsetH(p) : null; } },
    { label: t('corr_onset_avg')(2),fn: e => avgOns(e, 2) },
    { label: t('corr_onset_avg')(3),fn: e => avgOns(e, 3) },
    { label: t('corr_onset_avg')(5),fn: e => avgOns(e, 5) },
    { label: t('corr_bed'),         fn: e => bedH(e) },
    ...trackedHabits.map(h => ({ label: h.name, fn: e => { const src = (h.sleepImpact || 'next') === 'same' ? e : prev(e.dateStr, 1); return src ? habState(src, h) : null; } })),
    ...trackedEvents.map(v => ({ label: v.name, fn: e => { const src = (v.sleepImpact || 'same') === 'same' ? e : prev(e.dateStr, 1); return src ? eventState(src, v.id) : null; } })),
  ];

  const obs = sorted.filter(e => RSCORE[e.dayForm]);
  const Y = obs.map(e => RSCORE[e.dayForm]);
  defs.forEach(d => { d.x = obs.map(d.fn); d.n = d.x.filter(v => v != null).length; });

  const kept = defs.filter(d => d.n >= REG_MIN_N && _regVar(d.x) > 1e-9);
  const excluded = defs.filter(d => !(d.n >= REG_MIN_N && _regVar(d.x) > 1e-9)).map(d => ({ label: d.label, n: d.n }));

  if (kept.length < 2 || _regVar(Y) < 1e-9) {
    return { insufficient: true, nObs: obs.length, kept: kept.length, excluded };
  }

  const rVec = kept.map(d => _regCorr(d.x, Y).r);
  const R = kept.map((di, i) => kept.map((dj, j) => {
    if (i === j) return 1;
    const c = _regCorr(di.x, dj.x);
    // Deux variables qui se croisent trop rarement : on les traite comme indépendantes
    // plutôt que d'injecter une corrélation estimée sur une poignée de points.
    return c.n >= REG_MIN_N ? c.r : 0;
  }));

  const explained = sol => Math.min(1, Math.max(0, sol.reduce((s, b, i) => s + b * rVec[i], 0)));

  // Qualité d'ajustement : R² des moindres carrés purs (λ = 0), la part de variance
  // réellement expliquée. On ne s'en sert QUE pour ce chiffre global — pas pour les poids.
  const solOLS = _regSolve(R, rVec);
  // Poids affichés : les MCO purs, sur des variables aussi proches que les moyennes
  // glissantes, distribuent des coefficients énormes et de signes contraires qui
  // s'annulent (colinéarité). On monte donc une petite crête λ jusqu'à ce que tous les
  // |β| ≤ 1 — des poids lisibles qui se partagent l'effet commun (signalé « stabilisés »).
  let beta = null, lambda = 0;
  for (const lam of [0, 0.05, 0.12, 0.25, 0.5, 1, 2]) {
    const A = R.map((row, i) => row.map((v, j) => i === j ? v + lam : v));
    const sol = _regSolve(A, rVec);
    if (!sol) continue;
    beta = sol; lambda = lam;
    if (Math.max(...sol.map(Math.abs)) <= 1) break;
  }
  if (!beta) return { insufficient: true, nObs: obs.length, kept: kept.length, excluded };
  const r2 = solOLS ? explained(solOLS) : explained(beta);

  const rows = kept.map((d, i) => ({ label: d.label, beta: beta[i], r: rVec[i], n: d.n }))
                   .sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));
  return { insufficient: false, nObs: obs.length, r2, rows, excluded, stabilized: lambda > 0 };
}

// Couleur d'un β : positif = pousse la forme vers le haut (vert), négatif = la tire vers
// le bas (rouge), quasi nul = neutre.
function _regBetaColor(b) { return b > 0.05 ? SCALE.good : b < -0.05 ? SCALE.bad : 'var(--muted)'; }

function renderRegression() {
  const el = document.getElementById('regression-view');
  if (!el) return;
  const R = buildRegression();

  const head = `<div style="margin-bottom:6px"><span style="font-size:0.72rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">${t('reg_section')}</span></div>`;
  const intro = `<p style="font-size:0.82rem;color:var(--text);margin:0 0 14px;line-height:1.5">${t('reg_intro')}</p>`;

  if (R.insufficient) {
    el.innerHTML = head + intro + `<div class="chart-card"><p style="font-size:0.85rem;color:var(--muted);margin:0">${t('reg_none')}</p></div>`;
    return;
  }

  const maxAbs = Math.max(...R.rows.map(r => Math.abs(r.beta)), 0.0001);
  const rows = R.rows.map(row => {
    const col = _regBetaColor(row.beta);
    const w = Math.round(Math.abs(row.beta) / maxAbs * 84);
    const sign = row.beta >= 0 ? '+' : '−';
    // Barre signée : moitié gauche (négatif) / moitié droite (positif) autour d'un axe.
    const bar = row.beta >= 0
      ? `<span style="display:inline-block;width:88px;text-align:left"><span style="display:inline-block;width:${w}px;height:8px;border-radius:2px;background:${col};vertical-align:middle"></span></span>`
      : `<span style="display:inline-block;width:88px;text-align:right"><span style="display:inline-block;width:${w}px;height:8px;border-radius:2px;background:${col};vertical-align:middle"></span></span>`;
    return `<tr>
      <td style="padding:4px 10px 4px 0;font-size:0.8rem">${row.label}</td>
      <td style="padding:4px 4px;text-align:right">${row.beta < 0 ? bar : ''}</td>
      <td style="padding:4px 4px;text-align:left">${row.beta >= 0 ? bar : ''}</td>
      <td style="padding:4px 8px;font-size:0.8rem;font-weight:700;color:${col};white-space:nowrap;text-align:right">${sign}${Math.abs(row.beta).toFixed(2)}</td>
      <td style="padding:4px 0 4px 10px;font-size:0.74rem;color:var(--muted);white-space:nowrap">r=${row.r.toFixed(2)}</td>
      <td style="padding:4px 0 4px 10px;font-size:0.72rem;color:var(--muted)">n=${row.n}</td>
    </tr>`;
  }).join('');

  const r2pct = Math.round(R.r2 * 100);
  const r2card = `<div class="chart-card" style="margin-bottom:12px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
      <span style="font-size:2rem;font-weight:700;color:var(--primary-light)">${r2pct}%</span>
      <span style="font-size:0.85rem;color:var(--text)">${t('reg_r2_label')}</span>
      <span style="font-size:0.74rem;color:var(--muted);margin-left:auto">${t('reg_nobs')(R.nObs)}</span>
    </div>`;

  const table = `<div class="chart-card" style="margin-bottom:12px">
      <p style="font-size:0.8rem;font-weight:600;margin:0 0 4px">${t('reg_table_title')}</p>
      <p style="font-size:0.74rem;color:var(--muted);margin:0 0 10px">${t('reg_beta_help')}</p>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr>
          <th style="text-align:left;padding:2px 10px 8px 0;font-size:0.72rem;color:var(--muted);font-weight:500">${t('reg_col_var')}</th>
          <th colspan="2" style="text-align:center;padding:2px 4px 8px;font-size:0.72rem;color:var(--muted);font-weight:500">${t('reg_col_beta')}</th>
          <th style="padding:2px 8px 8px;"></th>
          <th style="text-align:left;padding:2px 0 8px 10px;font-size:0.72rem;color:var(--muted);font-weight:500">${t('reg_col_r')}</th>
          <th style="text-align:left;padding:2px 0 8px 10px;font-size:0.72rem;color:var(--muted);font-weight:500">${t('corr_n')}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  const excl = R.excluded.length
    ? `<div class="chart-card" style="margin-bottom:12px">
        <p style="font-size:0.78rem;font-weight:600;margin:0 0 6px">${t('reg_excluded')}</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px 14px">
          ${R.excluded.map(x => `<span style="font-size:0.76rem;color:var(--muted)">${x.label} <span style="opacity:0.7">(n=${x.n})</span></span>`).join('')}
        </div>
      </div>` : '';

  const caveats = `<div class="chart-card" style="background:transparent;border:1px dashed var(--border)">
      <p style="font-size:0.74rem;color:var(--muted);margin:0;line-height:1.5">
        ${R.stabilized ? t('reg_cav_ridge') + ' ' : ''}${t('reg_cav_sample')} ${t('reg_cav_cause')}
      </p>
    </div>`;

  el.innerHTML = head + intro + r2card + table + excl + caveats;
}
