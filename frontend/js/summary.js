// Dashboard tab: correlations, scatter plot, mascot text.
let _scatterId = 0;

// Star score of a correlation, from |r|

const sectionTitle = txt => `<div style="margin-bottom:6px"><span style="font-size:0.72rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em">${txt}</span></div>`;

// Correlations: computed over ALL entries, regardless of the range selectors. Used in
// two places — the "Your data analysed" table (Statistics tab) and the mascot sentence
// (Dashboard) — hence the extraction.
function buildCorrelations(opts = {}) {
  // `excludeDate` drops one day from the computation. Used by the mascot prediction:
  // predicting a day's form from correlations that already contain that very form
  // would make it depend on the thing being predicted.
  const allSorted = [...entries]
    .filter(e => e.dateStr !== opts.excludeDate)
    .sort((a,b) => a.dateStr.localeCompare(b.dateStr));
  function pearson(xs, ys) {
    const n = xs.length; if (n < 4) return null;
    const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
    const num = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0);
    const den = Math.sqrt(xs.reduce((s,x)=>s+(x-mx)**2,0)*ys.reduce((s,y)=>s+(y-my)**2,0));
    return den ? num/den : null;
  }

  const byDate = {}; allSorted.forEach(e => byDate[e.dateStr] = e);

  // Helper: prev entry N days before
  function prevEntry(ds, n) {
    const d = new Date(ds+'T12:00:00'); d.setDate(d.getDate()-n);
    return byDate[d.toISOString().split('T')[0]] ?? null;
  }

  // Mean of the last n nights (this entry included), null if one is missing — same
  // rules as the pair building, otherwise the prediction and the correlation would
  // rest on different quantities.
  function avgLastNights(e, n) {
    const ds = [];
    for (let k = 0; k < n; k++) {
      const en = k === 0 ? e : prevEntry(e.dateStr, k);
      const d  = en ? sleepDuration(en) : null;
      if (d === null) return null;
      ds.push(d);
    }
    return ds.reduce((a,b)=>a+b,0) / n;
  }

  // Collect pairs for each correlation.
  // Entry dateStr=J records sleep(J→J+1) and form(J+1).
  // Veille      = même entrée (nuit J→J+1, forme J+1).
  // Avant-veille = entrée J-1 (nuit J-1→J, forme J+1).
  const p_dur1=[], p_dur2=[], p_onset=[], p_bed_dur=[];
  // Rolling sleep averages set against the form: one bad night weighs less than an
  // accumulated debt, which these averages make visible.
  const p_durAvg2=[], p_durAvg3=[], p_durAvg5=[];
  // Bedtime → night duration: independent of the form, so computed over every entry,
  // including those with no form recorded.
  allSorted.forEach(e => {
    const dur = sleepDuration(e); if (dur === null) return;
    const sl = normalizeSleeps(e)[0];
    const t = sl && (sl.bed || sl.sleepStart);
    if (!t) return;
    const [h, m] = t.split(':').map(Number);
    p_bed_dur.push([h >= 20 ? h+m/60 : h+m/60+24, dur]);
  });
  allSorted.forEach(e => {
    const score = RSCORE[e.dayForm]; if (!score) return;
    const p1 = prevEntry(e.dateStr, 1);
    // durée veille : même entrée
    const d1 = sleepDuration(e);
    if (d1 !== null) p_dur1.push([d1, score]);
    // durée avant-veille : entrée J-1
    const d2 = p1 ? sleepDuration(p1) : null;
    if (d2 !== null) p_dur2.push([d2, score]);
    // previous night's sleep onset: same entry
    const sl = normalizeSleeps(e)[0];
    const t = sl && (sl.sleepStart || sl.bed || sl.bedtime);
    if (t) {
      const [h, m] = t.split(':').map(Number);
      p_onset.push([h >= 20 ? h+m/60 : h+m/60+24, score]);
    }
    // Means of the n nights preceding this form, entry D included. The point is kept
    // only if all n nights are recorded: a mean computed over a varying number of
    // nights would not be comparable from one point to the next.
    [[2, p_durAvg2], [3, p_durAvg3], [5, p_durAvg5]].forEach(([n, out]) => {
      const ds = [];
      for (let k = 0; k < n; k++) {
        const en = k === 0 ? e : prevEntry(e.dateStr, k);
        const d  = en ? sleepDuration(en) : null;
        if (d === null) return;
        ds.push(d);
      }
      out.push([ds.reduce((a,b)=>a+b,0)/n, score]);
    });
  });
  // Habitudes globales + individuelles, impact selon sleepImpact ('same'|'next')
  const trackedHabits = habits.filter(h=>h.tracked!==false);
  const p_hab_ind = trackedHabits.map(h => ({ h, pairs:[] }));
  const p_hab_dur_same = [], p_hab_dur_next = [];
  allSorted.forEach(e => {
    const nd = new Date(e.dateStr+'T12:00:00'); nd.setDate(nd.getDate()+1);
    const nextE = byDate[nd.toISOString().split('T')[0]];
    const durSame = sleepDuration(e);
    const durNext = nextE ? sleepDuration(nextE) : null;
    // agrégats séparés par impact
    const sameIds = trackedHabits.filter(h=>(h.sleepImpact||'next')==='same').map(h=>h.id);
    const nextIds = trackedHabits.filter(h=>(h.sleepImpact||'next')==='next').map(h=>h.id);
    const doneSame    = (e.habits        || []).filter(id=>sameIds.includes(id)).length;
    const notDoneSame = (e.habitsNotDone || []).filter(id=>sameIds.includes(id)).length;
    const doneNext    = (e.habits        || []).filter(id=>nextIds.includes(id)).length;
    const notDoneNext = (e.habitsNotDone || []).filter(id=>nextIds.includes(id)).length;
    if (doneSame+notDoneSame > 0 && durSame !== null) p_hab_dur_same.push([doneSame/(doneSame+notDoneSame), durSame]);
    if (doneNext+notDoneNext > 0 && durNext !== null) p_hab_dur_next.push([doneNext/(doneNext+notDoneNext), durNext]);
    // par habitude individuelle
    p_hab_ind.forEach(({h, pairs}) => {
      const impact = h.sleepImpact || 'next';
      const dur = impact === 'same' ? durSame : durNext;
      if (dur === null) return;
      const isDone    = (e.habits        || []).includes(h.id);
      const isNotDone = (e.habitsNotDone || []).includes(h.id);
      if (isDone || isNotDone) pairs.push([isDone ? 1 : 0, dur]);
    });
  });

  function rRow(label, with2, pairs) {
    const r = pearson(pairs.map(p=>p[0]), pairs.map(p=>p[1]));
    if (r === null) return `<tr>
      <td style="padding:3px 12px 3px 0;font-size:0.78rem">${label}</td>
      <td style="padding:3px 12px 3px 0;font-size:0.78rem">${with2}</td>
      <td style="padding:3px 8px;font-size:0.75rem;color:var(--muted)">${t('corr_insuf')}</td>
      <td style="padding:3px 0;font-size:0.72rem;color:var(--muted)">n=${pairs.length}</td></tr>`;
    const stars = starsHtml(Math.abs(r));
    return `<tr>
      <td style="padding:3px 12px 3px 0;font-size:0.78rem">${label}</td>
      <td style="padding:3px 12px 3px 0;font-size:0.78rem">${with2}</td>
      <td style="padding:3px 8px;font-size:0.78rem;font-weight:700;white-space:nowrap">${stars} <span style="color:var(--muted)">r=${r.toFixed(2)}</span></td>
      <td style="padding:3px 0;font-size:0.72rem;color:var(--muted)">n=${pairs.length}</td>
    </tr>`;
  }

  // Metadata per correlation — includes bucket definitions for the detail chart
  const corrList = [
    { lbl:t('corr_dur_veille'),  w2:t('corr_forme_jour'), pairs:p_dur1,
      buckets: bucketsFrom(durBands()),
      xFmt: v=>fmtH(v), yType:'form',
      xFor: e => sleepDuration(e),
      pos: v => t('r_dur_long')(fmtH(v)), neg: v => t('r_dur_short')(fmtH(v)),
      focus: r => r > 0 ? t('f_longer') : t('f_shorter') },
    { lbl:t('corr_dur_avv'),     w2:t('corr_forme_jour'), pairs:p_dur2,
      buckets: bucketsFrom(durBands()),
      xFmt: v=>fmtH(v), yType:'form',
      xFor: e => { const p = prevEntry(e.dateStr, 1); return p ? sleepDuration(p) : null; },
      pos: v => t('r_avv_long')(fmtH(v)), neg: v => t('r_avv_short')(fmtH(v)),
      focus: r => r > 0 ? t('f_longer2') : t('f_shorter') },
    { lbl:t('corr_dur_avg')(2),  w2:t('corr_forme_jour'), pairs:p_durAvg2,
      buckets: bucketsFrom(durBands()),
      xFmt: v=>fmtH(v), yType:'form',
      xFor: e => avgLastNights(e, 2),
      pos: v => t('r_avg_long')(2, fmtH(v)), neg: v => t('r_avg_short')(2, fmtH(v)),
      focus: r => r > 0 ? t('f_avg2p') : t('f_avg2n') },
    { lbl:t('corr_dur_avg')(3),  w2:t('corr_forme_jour'), pairs:p_durAvg3,
      buckets: bucketsFrom(durBands()),
      xFmt: v=>fmtH(v), yType:'form',
      xFor: e => avgLastNights(e, 3),
      pos: v => t('r_avg_long')(3, fmtH(v)), neg: v => t('r_avg_short')(3, fmtH(v)),
      focus: r => r > 0 ? t('f_avg3p') : t('f_avg3n') },
    { lbl:t('corr_dur_avg')(5),  w2:t('corr_forme_jour'), pairs:p_durAvg5,
      buckets: bucketsFrom(durBands()),
      xFmt: v=>fmtH(v), yType:'form',
      xFor: e => avgLastNights(e, 5),
      pos: v => t('r_avg_long')(5, fmtH(v)), neg: v => t('r_avg_short')(5, fmtH(v)),
      focus: r => r > 0 ? t('f_avg5p') : t('f_avg5n') },
    { lbl:t('corr_onset_veille'), w2:t('corr_forme_jour'), pairs:p_onset,
      buckets: bucketsFrom(onsetBands()),
      xFmt: v=>fmtDecH(v), yType:'form',
      xFor: e => sleepOnsetH(e),
      pos: v => t('m_bed_early')(fmtDecH(v)), neg: v => t('m_bed_late')(fmtDecH(v)),
      focus: r => r < 0 ? t('f_early') : t('f_late') },
    { lbl:t('corr_bed'),          w2:t('corr_dur_nuit'),  pairs:p_bed_dur,
      buckets: bucketsFrom(onsetBands()),
      xFmt: v=>fmtDecH(v), yType:'duration',
      focus: r => r < 0 ? t('f_bedp') : t('f_bedn') },
    ...(p_hab_dur_same.length >= 4 ? [{ lbl:t('corr_habits_kept'), w2:t('corr_dur_same'), pairs:p_hab_dur_same,
      buckets:[[t('b_lt25'),v=>v<0.25],[t('b_25_75'),v=>v>=0.25&&v<=0.75],[t('b_gt75'),v=>v>0.75]],
      xFmt: v=>Math.round(v*100)+'%', yType:'duration',
      focus: r => r > 0 ? t('f_habsamep') : t('f_habsamen') }] : []),
    ...(p_hab_dur_next.length >= 4 ? [{ lbl:t('corr_habits_kept'), w2:t('corr_dur_next'), pairs:p_hab_dur_next,
      buckets:[[t('b_lt25'),v=>v<0.25],[t('b_25_75'),v=>v>=0.25&&v<=0.75],[t('b_gt75'),v=>v>0.75]],
      xFmt: v=>Math.round(v*100)+'%', yType:'duration',
      focus: r => r > 0 ? t('f_habnextp') : t('f_habnextn') }] : []),
    ...p_hab_ind.map(({h, pairs}) => ({
      lbl: h.name,
      w2: (h.sleepImpact||'next') === 'same' ? t('corr_dur_same') : t('corr_dur_next'),
      pairs,
      buckets:[[t('b_notdone'),v=>v===0],[t('b_done'),v=>v===1]],
      xFmt: v=>v===1?t('b_done'):t('b_notdone'), yType:'duration',
      focus: r => r > 0 ? t('f_habp')(h.name) : t('f_habn')(h.name),
    })),
  ];
  const corrSorted = corrList.map(c=>({...c, abs:Math.abs(pearson(c.pairs.map(p=>p[0]),c.pairs.map(p=>p[1]))??0)}))
                             .sort((a,b)=>b.abs-a.abs);

  // Mini scatter plot illustrating a correlation: raw points + regression line
  function scatterSVG(c) {
    const pts = c.pairs;
    if (pts.length < 3) return '';
    const W = 250, H = 120, PL = 42, PR = 10, PT = 10, PB = 20;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    let x0 = Math.min(...xs), x1 = Math.max(...xs);
    if (x1 === x0) { x0 -= 0.5; x1 += 0.5; }
    // Forme : échelle complète TM→TB · durée : bornes des données
    let y0, y1;
    if (c.yType === 'form') { y0 = 1; y1 = 5; }
    else {
      y0 = Math.min(...ys); y1 = Math.max(...ys);
      if (y1 === y0) { y0 -= 0.5; y1 += 0.5; }
    }
    const px = v => PL + (v - x0) / (x1 - x0) * (W - PL - PR);
    const py = v => H - PB - (v - y0) / (y1 - y0) * (H - PT - PB);
    const dotCol = v => c.yType === 'form'
      ? (RCOLOR[RSCORE_INV[Math.round(v)]] || 'var(--muted)')
      : durColor(v);
    const yLbl = v => c.yType === 'form' ? (VLABEL[RSCORE_INV[Math.round(v)]] ?? '') : fmtH(v);

    // Least-squares line — gives the direction of the link at a glance
    const n = pts.length;
    const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
    const den = xs.reduce((s,x)=>s+(x-mx)**2, 0);
    const slope = den ? xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my), 0)/den : 0;
    const clipId = 'sc' + (_scatterId++);

    // Hover label: a wider transparent circle, so it is comfortable to aim at
    const yFull = v => c.yType === 'form' ? (VNAME[RSCORE_INV[Math.round(v)]] ?? '–') : fmtH(v);
    const dots = pts.map(([x,y]) => {
      const cx = px(x).toFixed(1), cy = py(y).toFixed(1);
      return `<g><title>${c.xFmt(x)} → ${yFull(y)}</title>`
        + `<circle cx="${cx}" cy="${cy}" r="7" fill="transparent"/>`
        + `<circle cx="${cx}" cy="${cy}" r="3" fill="${dotCol(y)}" opacity="0.75"/></g>`;
    }).join('');

    return `<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;max-width:100%;height:auto;flex-shrink:0">
      <clipPath id="${clipId}"><rect x="${PL}" y="${PT}" width="${W-PL-PR}" height="${H-PT-PB}"/></clipPath>
      <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${H-PB}" stroke="var(--border)" stroke-width="1"/>
      <line x1="${PL}" y1="${H-PB}" x2="${W-PR}" y2="${H-PB}" stroke="var(--border)" stroke-width="1"/>
      <line clip-path="url(#${clipId})" x1="${px(x0)}" y1="${py(my + slope*(x0-mx)).toFixed(1)}"
            x2="${px(x1)}" y2="${py(my + slope*(x1-mx)).toFixed(1)}"
            stroke="var(--primary-light)" stroke-width="1.5" stroke-dasharray="4,3"/>
      ${dots}
      <text x="${PL-5}" y="${PT+4}"   text-anchor="end"   font-size="7" fill="var(--muted)">${yLbl(y1)}</text>
      <text x="${PL-5}" y="${H-PB}"   text-anchor="end"   font-size="7" fill="var(--muted)">${yLbl(y0)}</text>
      <text x="${PL}"   y="${H-PB+11}" text-anchor="start" font-size="7" fill="var(--muted)">${c.xFmt(x0)}</text>
      <text x="${W-PR}" y="${H-PB+11}" text-anchor="end"   font-size="7" fill="var(--muted)">${c.xFmt(x1)}</text>
    </svg>`;
  }

  function bucketChart(c) {
    const rows = c.buckets.map(([lbl, fn, dotColor]) => {
      const vals = c.pairs.filter(p=>fn(p[0])).map(p=>p[1]);
      if (!vals.length) return '';
      const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
      const dot = dotColor ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};margin-right:5px;vertical-align:middle"></span>` : '';
      if (c.yType === 'form') {
        const key = RSCORE_INV[Math.round(avg)];
        return `<tr>
          <td style="padding:2px 12px 2px 0;font-size:0.76rem">${dot}${lbl}</td>
          <td style="padding:2px 8px;width:86px"><span style="display:inline-block;width:${Math.round(avg/5*70)}px;height:7px;border-radius:3px;background:${key?RCOLOR[key]:'var(--border)'}"></span></td>
          <td style="padding:2px 0;font-size:0.76rem;width:84px;color:${key?RCOLOR[key]:'var(--muted)'}">${key?VNAME[key]:'–'} <span style="color:var(--muted);font-size:0.7rem">(n=${vals.length})</span></td>
        </tr>`;
      } else {
        const col = durColor(avg);
        return `<tr>
          <td style="padding:2px 12px 2px 0;font-size:0.76rem">${dot}${lbl}</td>
          <td style="padding:2px 8px;width:86px"><span style="display:inline-block;width:${Math.round(avg/10*70)}px;height:7px;border-radius:3px;background:${col}"></span></td>
          <td style="padding:2px 0;font-size:0.76rem;width:84px;color:${col}">${fmtH(avg)} <span style="color:var(--muted);font-size:0.7rem">(n=${vals.length})</span></td>
        </tr>`;
      }
    }).join('');
    if (!rows) return '';
    return `<p style="font-size:0.75rem;font-weight:600;margin:14px 0 5px">${starsHtml(c.abs)} ${c.lbl} <span class="arr">→</span> ${c.w2}</p>
      <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">
        <table style="border-collapse:collapse;width:290px;max-width:100%;table-layout:fixed">
          <tbody>${rows}</tbody>
        </table>
        ${scatterSVG(c)}
      </div>`;
  }

  // ★★★ (|r| ≥ 0.5) shown by default; ★★☆ (0.3 ≤ |r| < 0.5) folded behind a click
  const eligible = corrSorted.filter(c => c.pairs.length >= 4);
  const strongCharts = eligible.filter(c => c.abs >= 0.5).map(bucketChart).join('');
  const mediumCharts = eligible.filter(c => c.abs >= 0.3 && c.abs < 0.5).map(bucketChart).join('');
  const detailCharts = strongCharts + (mediumCharts ? `
    <details style="margin-top:14px" class="corr-more">
      <summary style="cursor:pointer;font-size:0.74rem;font-weight:600;color:var(--muted)">
        ${t('corr_more')}
      </summary>
      ${mediumCharts}
    </details>` : '');

  const statsCard = (p_dur1.length + p_onset.length) < 4 ? '' : sectionTitle(t('sec_analysis')) + `
    <div class="chart-card" style="margin-bottom:12px">
      <table style="border-collapse:collapse;width:100%;margin-bottom:14px">
        <thead><tr>
          <th style="width:35%;padding:2px 12px 8px 0;font-size:0.72rem;color:var(--muted);font-weight:500;text-align:left">${t('corr_v1')}</th>
          <th style="padding:2px 12px 8px 0;font-size:0.72rem;color:var(--muted);font-weight:500;text-align:left">${t('corr_v2')}</th>
          <th style="padding:2px 8px 8px;font-size:0.72rem;color:var(--muted);font-weight:500;text-align:left">${t('corr_r')}</th>
          <th style="padding:2px 0 8px;font-size:0.72rem;color:var(--muted);font-weight:500;text-align:left">${t('corr_n')}</th>
        </tr></thead>
        <tbody>
          ${corrSorted.map(({lbl,w2,pairs})=>rRow(lbl,w2,pairs)).join('')}
        </tbody>
      </table>
      ${detailCharts}
    </div>`;

  return { pearson, byDate, p_dur1, p_onset, corrSorted, html: statsCard };
}

// Writes the analysis table into the Statistics tab.
function renderCorrelations() {
  const box = document.getElementById('corr-view');
  if (box) box.innerHTML = buildCorrelations().html;
}

function renderSummary() {
  const el = document.getElementById('summary-view');
  if (!el) return;

  const sorted = [...entries].sort((a,b) => a.dateStr.localeCompare(b.dateStr));
  const yest = yesterday();
  let startDate, endDate;
  if (summaryRange === 0) {
    startDate = sorted.length ? sorted[0].dateStr : yest;
    const last = sorted.length ? sorted[sorted.length-1].dateStr : yest;
    endDate = last < yest ? last : yest;
  } else {
    const e = new Date(yest+'T12:00:00');
    const s = new Date(e); s.setDate(s.getDate() - (summaryRange - 1));
    startDate = s.toISOString().split('T')[0];
    endDate   = yest;
  }

  const allDates = [];
  { const c = new Date(startDate+'T12:00:00'), end = new Date(endDate+'T12:00:00');
    while (c <= end) { allDates.push(c.toISOString().split('T')[0]); c.setDate(c.getDate()+1); } }

  const entryMap = {};
  sorted.forEach(e => entryMap[e.dateStr] = e);
  const days = allDates.map(d => entryMap[d] || null);

  const tH = sleepTargetH();
  // durColor / onsetColor / ratioColor : barème unique de colors.js.

  const activeHabits = habits.filter(h => h.tracked !== false);

  // One row per day that has an entry
  const entryDays = days.filter(Boolean).reverse(); // most-recent last → show ascending
  let rows = '';
  if (!entryDays.length) {
    rows = `<p style="font-size:0.82rem;color:var(--muted);padding:8px 0">${t('none_period')}</p>`;
  } else {
    entryDays.forEach(e => {
      const dur   = sleepDuration(e);
      const onset = sleepOnsetH(e);
      const dc    = durColor(dur);
      const habitDots = activeHabits.map(h => {
        const done = (e.habits && e.habits.includes(h.id)) ? true : (e.habitsNotDone && e.habitsNotDone.includes(h.id)) ? false : null;
        const bg   = done === true ? '#27ae60' : done === false ? 'var(--border)' : 'transparent';
        const border = done === null ? '1px solid var(--border)' : 'none';
        return `<span title="${h.name}" style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${bg};border:${border};flex-shrink:0"></span>`;
      }).join('');

      const dateLabel = new Date(e.dateStr+'T12:00:00').toLocaleDateString(t('locale'),{weekday:'short',day:'2-digit',month:'2-digit'});
      rows += `
        <div style="display:flex;align-items:center;gap:8px;padding:4px 0">
          <div style="width:78px;font-size:0.74rem;font-weight:600;flex-shrink:0;white-space:nowrap">${dateLabel}</div>
          <div id="sum-tl-${e.id}" style="flex:1;position:relative;height:26px;overflow:hidden"></div>
          <div style="width:32px;text-align:right;font-size:0.76rem;font-weight:700;flex-shrink:0;color:${dc}">${dur!==null?fmtH(dur):'–'}</div>
          <div style="width:38px;text-align:right;font-size:0.72rem;flex-shrink:0;color:${onset!==null?onsetColor(onset):'var(--muted)'}">${onset!==null?fmtDecH(onset):'–'}</div>
          <div style="width:12px;flex-shrink:0">${e.dayForm?`<span title="${VNAME[e.dayForm]}" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${RCOLOR[e.dayForm]}"></span>`:''}</div>
          ${activeHabits.length?`<div style="display:flex;gap:3px;flex-shrink:0">${habitDots}</div>`:''}
        </div>`;
    });
  }

  // Legend
  const legend = `<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:0.71rem;color:var(--muted);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border);align-items:center">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:18px;height:8px;display:inline-block;background:repeating-linear-gradient(45deg,#3d5a80,#3d5a80 2px,#5b8dbf 2px,#5b8dbf 4px);border-radius:2px"></span>${t('tl_sleep')}</span>
    <span style="display:flex;align-items:center;gap:4px"><span style="width:18px;height:8px;display:inline-block;background:repeating-linear-gradient(45deg,#8ecae6,#8ecae6 2px,#b8daed 2px,#b8daed 4px);border-radius:2px"></span>${t('tl_half')}</span>
    <span>${t('tl_markers')}</span>
    <span style="opacity:0.3">|</span>
    ${bandsLegendHtml(durBands(), 'square')}
    <span style="opacity:0.3">|</span>
    ${VALS.map(v=>`<span style="color:${RCOLOR[v]}">${VNAME[v]}</span>`).join('')}
    ${activeHabits.length ? `<span style="opacity:0.3">|</span>${activeHabits.map(h=>`<span style="display:flex;align-items:center;gap:3px"><span style="width:9px;height:9px;display:inline-block;border-radius:2px;background:#27ae60"></span>${h.name}</span>`).join('')}` : ''}
  </div>`;

  // ---- Mascot & statistics (computed over ALL entries) ----
  const allSorted = [...entries].sort((a,b) => a.dateStr.localeCompare(b.dateStr));
  const lastWithForm = [...allSorted].reverse().find(e => e.dayForm);
  const lastForm = lastWithForm?.dayForm ?? null;
  const lastSleep = allSorted[allSorted.length - 1] ?? null;

  const { pearson, byDate, p_dur1, p_onset, corrSorted } = buildCorrelations();

  // Helper: z-score of value v relative to array arr
  function zOf(arr, v) {
    if (!arr.length || v == null) return null;
    const m = arr.reduce((s,x)=>s+x,0)/arr.length;
    const s = Math.sqrt(arr.reduce((s,x)=>s+(x-m)**2,0)/arr.length) || 1;
    return (v - m) / s;
  }
  // "Medium correlation" threshold — the same one the analysis table uses (★★☆).
  const MIN_R = 0.3, MIN_N = 4, MAX_PRED = 3;

  // Mascot prediction. Two requirements:
  //  · it must not depend on the form recorded for the day being predicted, hence the
  //    correlations are recomputed with that date excluded;
  //  · it rests only on the MAX_PRED strongest links, and only if they reach MIN_R —
  //    otherwise there is no prediction at all.
  // The prediction is about TODAY's form, so about the entry dated yesterday: that is
  // the one carrying the night just gone. Anchoring on the most recent entry, as before,
  // dated every predictor relative to it — "night before last" then pointed at a night
  // four days old whenever the recent ones were missing.
  const predEntry = byDate[yest] ?? null;

  let predComment = '';
  if (!lastSleep) {
    predComment = `<strong>${t('m_first')}</strong>`;
  } else if (!predEntry) {
    predComment = `<strong>${t('m_need_last')}</strong>`;
  } else {
    const predictors = buildCorrelations({ excludeDate: predEntry.dateStr }).corrSorted
      .filter(c => c.yType === 'form' && c.xFor && c.pairs.length >= MIN_N && c.abs >= MIN_R)
      .slice(0, MAX_PRED);

    const trackedIds = habits.filter(h => h.tracked !== false).map(h => h.id);
    const hDone     = (predEntry.habits        || []).filter(id => trackedIds.includes(id)).length;
    const hNotDone  = (predEntry.habitsNotDone || []).filter(id => trackedIds.includes(id)).length;
    const hTotal    = hDone + hNotDone;

    const contribs = [];
    predictors.forEach(c => {
      const v = c.xFor(predEntry);
      if (v == null) return;
      const xs = c.pairs.map(p => p[0]);
      const z  = zOf(xs, v);
      if (z == null) return;
      const r  = pearson(xs, c.pairs.map(p => p[1]));
      if (r == null) return;
      contribs.push({ signal: z * r, w: Math.abs(r), pos: c.pos(v), neg: c.neg(v) });
    });

    if (!contribs.length) {
      predComment = `<strong>${t('m_nodata')}</strong>`;
    } else {
      const totalW = contribs.reduce((s,c)=>s+c.w, 0);
      const sig    = contribs.reduce((s,c)=>s+c.signal*c.w, 0) / totalW;

      // A single sentence: verdict, then the reasons in apposition — no nested parentheses
      const needsRest = sig <= -0.8;
      const verdict = sig >  0.8 ? t('m_v5')
                    : sig >  0.25? t('m_v4')
                    : sig > -0.25? t('m_v3')
                    : sig > -0.8 ? t('m_v2')
                    :              t('m_v1');

      const reasons = [...contribs].sort((a,b)=>Math.abs(b.signal*b.w)-Math.abs(a.signal*a.w))
                                   .filter(c=>Math.abs(c.signal)>0.2).slice(0,2)
                                   .map(c=>c.signal>0?c.pos:c.neg);

      if (hTotal > 0) {
        if      (hDone/hTotal >= 0.75) reasons.push(t('m_hab_good'));
        else if (hDone/hTotal <= 0.25) reasons.push(t('m_hab_bad'));
      }

      // Compared with the form actually recorded for that day
      const actualKey = predEntry.dayForm;
      let check = '';
      if (actualKey && RSCORE[actualKey]) {
        const expected = sig > 0.8 ? 5 : sig > 0.25 ? 4 : sig > -0.25 ? 3 : sig > -0.8 ? 2 : 1;
        const gap = RSCORE[actualKey] - expected;
        const how = gap === 0 ? t('m_same') : gap > 0 ? t('m_above') : t('m_below');
        check = t('m_encoded')(VNAME[actualKey], how);
      }

      // Only the forecast is bold; the comparison with the recorded form and any
      // advice stay in normal body text, after it.
      const predSentence = verdict + (reasons.length ? ' : ' + reasons.join(', ') : '') + '.';
      predComment = `<strong>${predSentence}</strong>`
                  + check
                  + (needsRest ? t('m_rest') : '');
    }
  }

  // 3 stat cards — last 3 days
  const s3d = new Date(yest+'T12:00:00'); s3d.setDate(s3d.getDate() - 2);
  const ranged3 = allSorted.filter(e => e.dateStr >= s3d.toISOString().split('T')[0] && e.dateStr <= yest);

  const durs3 = ranged3.map(e=>sleepDuration(e)).filter(d=>d!==null);
  const avgDur3 = durs3.length ? durs3.reduce((a,b)=>a+b,0)/durs3.length : null;
  const avgDurHtml = avgDur3 !== null ? `<span style="color:${durColor(avgDur3)}">${fmtH(avgDur3)}</span>` : '–';

  const beds3 = ranged3.map(e => {
    const sl = normalizeSleeps(e)[0];
    const t = sl && (sl.bed || sl.sleepStart); if (!t) return null;
    const [h,m] = t.split(':').map(Number);
    return h >= 20 ? h+m/60 : h+m/60+24;
  }).filter(v=>v!==null);
  const avgBed3 = beds3.length ? beds3.reduce((a,b)=>a+b,0)/beds3.length : null;
  const avgBedHtml = avgBed3 !== null ? `<span style="color:${onsetColor(avgBed3)}">${fmtDecH(avgBed3)}</span>` : '–';

  const quals3 = ranged3.map(e=>e.dayForm).filter(q=>q&&RSCORE[q]);
  const avgQualKey = quals3.length ? RSCORE_INV[Math.round(quals3.reduce((a,q)=>a+RSCORE[q],0)/quals3.length)] : null;
  const avgQualHtml = avgQualKey ? `<span style="color:${RCOLOR[avgQualKey]}">${VNAME[avgQualKey]}</span>` : '–';

  const trackedIds3 = habits.filter(h=>h.tracked!==false).map(h=>h.id);
  const habitRatios3 = ranged3.map(e=>{
    const done=(e.habits||[]).filter(id=>trackedIds3.includes(id)).length;
    const notDone=(e.habitsNotDone||[]).filter(id=>trackedIds3.includes(id)).length;
    return done+notDone>0 ? done/(done+notDone) : null;
  }).filter(v=>v!==null);
  const avgHab3 = habitRatios3.length ? habitRatios3.reduce((a,b)=>a+b,0)/habitRatios3.length : null;
  const habCol3 = ratioColor(avgHab3);
  const avgHabHtml = avgHab3!==null ? `<span style="color:${habCol3}">${Math.round(avgHab3*100)}%</span>` : '–';

  // What to focus on: the strongest link in the correlation analysis
  const focusCorr = corrSorted.find(c => c.focus && c.abs >= 0.3 && c.pairs.length >= MIN_N);
  let encouragement;
  if (focusCorr) {
    const rF = pearson(focusCorr.pairs.map(p=>p[0]), focusCorr.pairs.map(p=>p[1]));
    encouragement = t('m_focus')(focusCorr.focus(rF));
  } else {
    encouragement = t('m_nofocus');
  }

  // Reminder of the tracked habits — no status, just to keep them in mind.
  // Extends the summary text: same body size, a lead-in sentence then one bullet per
  // habit, with no box and no separator.
  const trackedNames = habits.filter(h => h.tracked !== false).map(h => h.name);
  const habitsReminder = trackedNames.length ? `
    <p style="font-size:0.8rem;color:var(--text);margin:6px 0 0">${t('m_tracking')}</p>
    <ul style="font-size:0.8rem;color:var(--text);margin:2px 0 0;padding-left:18px">
      ${trackedNames.map(n => `<li style="margin-top:1px">${n}</li>`).join('')}
    </ul>` : '';

  const mascotCard = `
    <div class="chart-card" style="display:flex;gap:16px;align-items:center;margin-bottom:12px">
      <div style="width:90px;flex-shrink:0">${meerkitSVG(lastForm)}</div>
      <div style="flex:1;min-width:0">
        ${lastForm
          ? `<div style="font-size:1.3rem;font-weight:700;color:${RCOLOR[lastForm]}">${VNAME[lastForm]}</div>
             <div style="font-size:0.72rem;color:var(--muted);margin-bottom:6px">${t('last_form')}</div>`
          : `<div style="font-size:1rem;color:var(--muted)">${t('no_form')}</div>`}
        <p style="font-size:0.8rem;color:var(--text);margin:0">${predComment}</p>
        ${habitsReminder}
        <p style="font-size:0.78rem;color:var(--primary-light);margin:6px 0 0">${encouragement}</p>
      </div>
    </div>`;

  const miniCards = sectionTitle(t('sec_3d')) + `
  <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">
    <div class="stat-card"><div class="sv">${avgDurHtml}</div><div class="sl">${t('c_dur_avg')}</div></div>
    <div class="stat-card"><div class="sv">${avgBedHtml}</div><div class="sl">${t('c_bed_avg')}</div></div>
    <div class="stat-card"><div class="sv">${avgQualHtml}</div><div class="sl">${t('c_form_avg')}</div></div>
    <div class="stat-card"><div class="sv">${avgHabHtml}</div><div class="sl">${t('c_hab_avg')}</div></div>
  </div>`;

  // Preview of the last 3 days — same rendering as the Entry preview, gathered in one card
  // Newest first
  const prevDays = [];
  { const d = new Date(yest+'T12:00:00');
    for (let i = 0; i < 3; i++) {
      const ds = d.toISOString().split('T')[0];
      prevDays.push({ ds, e: byDate[ds] ?? null });
      d.setDate(d.getDate() - 1);
    } }

  // No heading of its own: the preview lives under the "Last 3 days" section, which it
  // shares with the average cards.
  // Label, bar and duration are aligned on the bar itself (see .sum-prev-row); the ruler
  // and legend are pulled out of the rows after rendering, into the card's footer.
  const previewCard = `
    <div class="chart-card sum-preview" style="margin-bottom:12px">
      ${prevDays.map(({ds, e}, i) => {
        // The night dated yesterday carries today's day form
        const label = ['Aujourd\'hui', 'Hier', 'Avant-hier'][i];
        const dateTip = new Date(ds+'T12:00:00').toLocaleDateString(t('locale'), {weekday:'long', day:'2-digit', month:'long'});
        return `<div class="sum-prev-row"${i ? ' style="margin-top:6px"' : ''}>
            <span class="sum-prev-lbl" title="${t('night_of_one')(dateTip)}">${label}</span>
            <div id="sum-prev-${i}" style="flex:1;min-width:0">${e ? '' : `<p class="sum-prev-empty">${t('none_day')}</p>`}</div>
          </div>`;
      }).join('')}
      <div class="sum-prev-row sum-prev-foot">
        <span class="sum-prev-lbl"></span>
        <div id="sum-prev-ruler" style="flex:1;min-width:0"></div>
      </div>
      <div id="sum-prev-legend"></div>
    </div>`;

  // "Your data analysed" moved to the Statistics tab (renderCorrelations).
  el.innerHTML = sectionTitle(t('sec_now')) + mascotCard + miniCards + previewCard;

  prevDays.forEach(({e}, i) => { if (e) renderTL(e, `sum-prev-${i}`, { showTimes: true }); });
  // renderTL re-emits the ruler and legend on every call, inside the row it renders
  // into: only one set is kept, moved into the card's footer so every row keeps the
  // same height and label, bar and duration stay aligned.
  const prevBox = el.querySelector('.sum-preview');
  if (prevBox) {
    const moveLast = (sel, destId) => {
      const nodes = [...prevBox.querySelectorAll(sel)];
      const keep = nodes.pop();
      nodes.forEach(n => n.remove());
      const dest = document.getElementById(destId);
      if (keep && dest) dest.appendChild(keep);
    };
    moveLast('.tl-hlabels', 'sum-prev-ruler');
    moveLast('.tl-legend',  'sum-prev-legend');
  }
}
