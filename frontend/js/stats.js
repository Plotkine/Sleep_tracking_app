// Statistics tab: average cards, Form/Habits squares and the two Chart.js charts.

// Horizontal paging of a chart that overflows. Global: the arrows carry inline
// onclick handlers, like the rest of the markup.
function scrollChart(wrapId, dir) {
  const w = document.getElementById(wrapId);
  if (!w) return;
  w.scrollLeft += dir * w.clientWidth * 0.9;   // 0.9: keeps one column of overlap as a landmark
}

// Shows an arrow only on the side where data remains.
function updateChartNav(wrapId) {
  const w = document.getElementById(wrapId);
  const pane = w && w.parentElement;
  if (!pane) return;
  const left  = pane.querySelector('.chart-nav-left');
  const right = pane.querySelector('.chart-nav-right');
  const max = w.scrollWidth - w.clientWidth;
  if (left)  left.style.display  = w.scrollLeft > 4 ? 'block' : 'none';
  if (right) right.style.display = w.scrollLeft < max - 4 ? 'block' : 'none';
}

// ---- Shared Chart.js helpers (Statistics AND the Dashboard use the same charts) ----
// Inline plugin: dashed target line + its label, on the y axis.
function refLine(value, label) {
  return { id:'refLine', afterDraw(chart) {
    const { ctx, scales: { y } } = chart;
    const yPx = y.getPixelForValue(value);
    ctx.save();
    ctx.strokeStyle = '#4a7aa8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(chart.chartArea.left, yPx);
    ctx.lineTo(chart.chartArea.right, yPx);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#4a7aa8';
    ctx.font = 'bold 9px "Segoe UI",system-ui,sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, chart.chartArea.right, yPx - 3);
    ctx.restore();
  }};
}

// Inline plugin: a vertical stroke under each point, from the 0h baseline up to the
// dot, in the dot's own colour. Reserved for the duration chart, whose axis is anchored
// at 0h, so the stroke's length reads as the value. Replaces the joined line: an
// unrecorded day is simply a gap, with no segment to special-case.
function stemLines(colorFn) {
  return { id:'stemLines', beforeDatasetsDraw(chart) {
    const { ctx, scales: { y } } = chart;
    const y0 = y.getPixelForValue(0);
    chart.data.datasets.forEach((ds, i) => {
      chart.getDatasetMeta(i).data.forEach((pt, j) => {
        const v = ds.data[j];
        if (v == null) return;
        ctx.save();
        ctx.strokeStyle = colorFn(v);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pt.x, y0);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
        ctx.restore();
      });
    });
  }};
}

// Inline plugin: value labels above each dot, in the dot's own colour, so a value and
// its band read as one.
function dotLabels(colorFn, formatFn) {
  return { id:'dotLabels', afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = 'bold 9px "Segoe UI",system-ui,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    chart.data.datasets.forEach((ds, i) => {
      chart.getDatasetMeta(i).data.forEach((pt, j) => {
        const v = ds.data[j];
        if (v == null) return;
        ctx.fillStyle = colorFn(v);
        ctx.fillText(formatFn(v), pt.x, pt.y - 6);
      });
    });
    ctx.restore();
  }};
}

// Duration per night: coloured dots, a vertical stem to the 0h baseline, dashed target.
// `days` is the continuous date range (nulls for unrecorded nights); `xlabels` matches.
function durDotChart(canvasId, days, xlabels) {
  const tD = durTargetH();
  const durData = days.map(e => { if(!e) return null; const d=sleepDuration(e); return d!==null?Math.round(d*100)/100:null; });
  // Axis always anchored at 0h (an explicit user preference): the stems start from the
  // x axis, so their length only reads correctly on a zero baseline.
  const durVals = durData.filter(v => v != null);
  const durHi = Math.ceil(Math.max(tD, ...durVals)) + 1;
  return new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'line',
    data: { labels: xlabels, datasets: [{
      label: t('chart_dur'), data: durData, borderWidth: 0,
      pointRadius: durData.map(v => v != null ? 4 : 0),
      pointBackgroundColor: durData.map(v => durColor(v, 'transparent')),
      showLine: false,
    }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false, callbacks: { label: ctx => {
          const parts = [ctx.parsed.y != null ? ` ${fmtH(ctx.parsed.y)}` : ' –'];
          const day = days[ctx.dataIndex];
          if (day?.notes) parts.push(` 📝 ${day.notes}`);
          return parts;
        }}}
      },
      layout: { padding: { left: 0, right: 0, top: 12 } },
      scales: {
        x: { offset: true, grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 }, padding: 4 } },
        y: { min: 0, max: durHi, ticks: { stepSize: 1, callback: v => fmtHourTick(v) } }
      }
    },
    plugins: [ stemLines(durColor), refLine(tD, fmtH(tD)), dotLabels(durColor, fmtH) ]
  });
}

// Sleep onset: coloured dots, dashed target. No stems and no zero baseline — a clock
// time has no meaningful zero, so the range stays 20:00→06:00 and reversed.
function onsetDotChart(canvasId, days, xlabels) {
  const tH = sleepTargetH();
  const onsetData = days.map(sleepOnsetH);
  return new Chart(document.getElementById(canvasId).getContext('2d'), {
    type: 'line',
    data: { labels: xlabels, datasets: [{
      label: t('chart_sleep'), data: onsetData, borderWidth: 0,
      pointRadius: onsetData.map(v => v != null ? 4 : 0),
      pointBackgroundColor: onsetData.map(v => onsetColor(v, 'transparent')),
      showLine: false,
    }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false, callbacks: { label: ctx =>
          ctx.parsed.y == null ? ' –' : ` ${fmtDecH(ctx.parsed.y)}` } }
      },
      layout: { padding: { left: 0, right: 0 } },
      scales: {
        x: { offset: true, grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 }, padding: 4 } },
        y: {
          min: 20, max: 30, reverse: true,
          ticks: { stepSize: 1, callback: v => { const h = v >= 24 ? v - 24 : v; return `${String(h).padStart(2,'0')}${clockSep()}00`; } },
        }
      }
    },
    plugins: [ refLine(tH, fmtClock(sleepTarget)), dotLabels(onsetColor, fmtDecH) ]
  });
}

function renderStats() {
  const sorted = [...entries].sort((a,b)=>a.dateStr.localeCompare(b.dateStr));

  // Build continuous date range. The window ends at YESTERDAY — the most recent
  // *completed* night — so "3 jours" = hier, avant-hier, avant-avant-hier. The entry
  // dated today (the night of this evening, still to come) is not part of it.
  const anchor = yesterday();
  let startDate, endDate;
  if (statsRange === 0) {
    startDate = sorted.length ? sorted[0].dateStr : anchor;
    const last = sorted.length ? sorted[sorted.length-1].dateStr : anchor;
    endDate   = last < anchor ? last : anchor;
  } else {
    const e = new Date(anchor+'T12:00:00');
    const s = new Date(e); s.setDate(s.getDate() - (statsRange - 1));
    startDate = s.toISOString().split('T')[0];
    endDate   = anchor;
  }

  const allDates = [];
  { const c = new Date(startDate+'T12:00:00'), end = new Date(endDate+'T12:00:00');
    while (c <= end) { allDates.push(c.toISOString().split('T')[0]); c.setDate(c.getDate()+1); } }

  const entryMap = {};
  sorted.forEach(e => entryMap[e.dateStr] = e);
  const days = allDates.map(d => entryMap[d] || null);
  const xlabels = allDates.map(nightAxisLabel);

  // Correlations (over all entries) — used both for the analysis table at the bottom and
  // to decide which of the two dot charts is the stronger predictor of the day form.
  const corr = buildCorrelations();

  // Up to 7 days the two charts fit side by side, at equal width; beyond that each
  // takes the full width to stay readable.
  // On a narrow screen (mobile) each chart takes the full width regardless.
  { const SIDE_BY_SIDE_MAX_DAYS = 7, MIN_WIDTH_FOR_TWO = 760;
    const side = allDates.length <= SIDE_BY_SIDE_MAX_DAYS && window.innerWidth >= MIN_WIDTH_FOR_TWO;
    const durCard   = document.getElementById('c-dur-wrap')?.closest('.chart-card');
    const sleepCard = document.getElementById('c-sleep-wrap')?.closest('.chart-card');
    [durCard, sleepCard].forEach(card => { if (card) card.style.flex = side ? '1 1 calc(50% - 9px)' : '1 1 100%'; });
    // Stronger predictor of the day form first (Forme/Habitudes cards keep order 0).
    if (durCard)   durCard.style.order   = corr.onsetFirst ? '2' : '1';
    if (sleepCard) sleepCard.style.order = corr.onsetFirst ? '1' : '2';
  }

  // 30 jours ou « Tout » : les frises et les graphes dépassent largement un écran
  // de téléphone en portrait.
  { const box = document.getElementById('stats-rotate');
    if (box) box.innerHTML = (statsRange === 30 || statsRange === 0) ? `<div class="rotate-hint"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="10.5" y1="18.5" x2="13.5" y2="18.5"/></svg><span>${t('rotate_hint')}</span></div>` : ''; }

  renderFormViz(days, allDates);
  renderHabitsViz(days, 'habits-viz', allDates);

  // Form / Habits: a horizontal scrollbar means the card is too cramped at half
  // width — it is then given the whole row.
  requestAnimationFrame(() => {
    ['form-viz-scroll', 'habits-viz-scroll'].forEach(id => {
      const sc = document.getElementById(id);
      const card = sc?.closest('.chart-card');
      if (!card) return;
      // Measured at a pinned half width (flex-grow 0): otherwise a card alone on its
      // row would already be stretched to 100% and would never appear to overflow.
      card.style.flex = '0 1 calc(50% - 9px)';
      const overflows = sc.scrollWidth > sc.clientWidth;
      card.style.flex = overflows ? '1 1 100%' : '';
      sc.scrollLeft = sc.scrollWidth;
    });
  });

  // Summary cards — follow the range selector
  const ranged = sorted.filter(e => e.dateStr >= startDate && e.dateStr <= endDate);


  const durs = ranged.map(e=>sleepDuration(e)).filter(d=>d!==null);
  const avgDur = durs.length ? durs.reduce((a,b)=>a+b,0)/durs.length : null;
  document.getElementById('s-avg').innerHTML = avgDur !== null
    ? `<span style="color:${durColor(avgDur)}">${fmtH(avgDur)}</span>` : '–';

  const bedTimes = ranged.map(e => {
    const sl = normalizeSleeps(e)[0];
    const t = sl && (sl.bed || sl.sleepStart);
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h >= 20 ? h + m / 60 : h + m / 60 + 24;
  }).filter(v => v !== null);
  const avgBed = bedTimes.length ? bedTimes.reduce((a,b)=>a+b,0)/bedTimes.length : null;
  document.getElementById('s-bed').innerHTML = avgBed !== null
    ? `<span style="color:${onsetColor(avgBed)}">${fmtDecH(avgBed)}</span>` : '–';

  const quals = ranged.map(e=>e.dayForm).filter(q=>q&&RSCORE[q]);
  document.getElementById('s-qual').innerHTML = quals.length
    ? (k => k ? `<span style="color:${RCOLOR[k]}">${VNAME[k]}</span>` : '–')(RSCORE_INV[Math.round(quals.reduce((a,q)=>a+RSCORE[q],0)/quals.length)]) : '–';

  { const trackedIds = habits.filter(h=>h.tracked!==false).map(h=>h.id);
    const ratios = ranged.map(e=>{
      const done=(e.habits||[]).filter(id=>trackedIds.includes(id)).length;
      const notDone=(e.habitsNotDone||[]).filter(id=>trackedIds.includes(id)).length;
      return done+notDone>0 ? done/(done+notDone) : null;
    }).filter(v=>v!==null);
    const avg = ratios.length ? ratios.reduce((a,b)=>a+b,0)/ratios.length : null;
    document.getElementById('s-habits').innerHTML = avg!==null
      ? `<span style="color:${ratioColor(avg)}">${Math.round(avg*100)}%</span>` : '–'; }

  // Largeur nécessaire pour que deux points restent lisibles. En dessous, le
  // conteneur défile horizontalement au lieu de comprimer l'axe.
  const MIN_PX_PER_POINT = 46;
  function sizeChartArea(wrapId) {
    const wrap = document.getElementById(wrapId);
    const inner = wrap && wrap.querySelector('.chart-inner');
    if (!inner) return;
    const needed = allDates.length * MIN_PX_PER_POINT;
    inner.style.width = needed > wrap.clientWidth ? needed + 'px' : '100%';
    // On ouvre sur les nuits les plus récentes, à droite : c'est ce qu'on vient
    // consulter. Sans `auto`, le scroll-behavior:smooth du CSS animerait ce
    // positionnement initial.
    requestAnimationFrame(() => {
      const prev = wrap.style.scrollBehavior;
      wrap.style.scrollBehavior = 'auto';
      wrap.scrollLeft = wrap.scrollWidth;
      wrap.style.scrollBehavior = prev;
      updateChartNav(wrapId);
    });
  }

  // Duration chart — dots + stems, with a configurable target line
  if (charts.dur) charts.dur.destroy();
  sizeChartArea('c-dur-wrap');
  document.getElementById('dur-goal').innerHTML =
    `<span class="goal-dash"></span>${t('goal_label')} ${fmtH(durTargetH())}`;
  document.getElementById('dur-legend').innerHTML = bandsLegendHtml(durBands());
  charts.dur = durDotChart('c-dur', days, xlabels);

  // Sleep onset chart
  if (charts.sleep) charts.sleep.destroy();
  sizeChartArea('c-sleep-wrap');
  document.getElementById('sleep-goal').innerHTML =
    `<span class="goal-dash"></span>${t('goal_label')} ${fmtClock(sleepTarget)}`;
  document.getElementById('sleep-legend').innerHTML = bandsLegendHtml(onsetBands());
  charts.sleep = onsetDotChart('c-sleep', days, xlabels);

  // Correlation table, at the bottom of the tab — reuse the set already computed above.
  { const box = document.getElementById('corr-view'); if (box) box.innerHTML = corr.html; }
}

// ---- Tabs ----
