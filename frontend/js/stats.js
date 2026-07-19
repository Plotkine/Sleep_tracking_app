// Onglet Statistiques : cartes de moyennes, carrés Forme/Habitudes et les deux graphes Chart.js.
function renderStats() {
  const sorted = [...entries].sort((a,b)=>a.dateStr.localeCompare(b.dateStr));

  // Build continuous date range
  const yest = yesterday();
  let startDate, endDate;
  if (statsRange === 0) {
    startDate = sorted.length ? sorted[0].dateStr : yest;
    const last = sorted.length ? sorted[sorted.length-1].dateStr : yest;
    endDate   = last < yest ? last : yest;
  } else {
    const e = new Date(yest+'T12:00:00');
    const s = new Date(e); s.setDate(s.getDate() - (statsRange - 1));
    startDate = s.toISOString().split('T')[0];
    endDate   = yest;
  }

  const allDates = [];
  { const c = new Date(startDate+'T12:00:00'), end = new Date(endDate+'T12:00:00');
    while (c <= end) { allDates.push(c.toISOString().split('T')[0]); c.setDate(c.getDate()+1); } }

  const entryMap = {};
  sorted.forEach(e => entryMap[e.dateStr] = e);
  const days = allDates.map(d => entryMap[d] || null);
  const xlabels = allDates.map(d => new Date(d+'T12:00:00').toLocaleDateString(t('locale'),{day:'2-digit',month:'2-digit'}));

  // Jusqu'à 7 jours les deux graphes tiennent côte à côte, à largeur égale ;
  // au-delà, chacun prend toute la largeur pour rester lisible.
  // Sur un écran étroit (mobile), chaque graphe prend toute la largeur quoi qu'il arrive.
  { const SIDE_BY_SIDE_MAX_DAYS = 7, MIN_WIDTH_FOR_TWO = 760;
    const side = allDates.length <= SIDE_BY_SIDE_MAX_DAYS && window.innerWidth >= MIN_WIDTH_FOR_TWO;
    ['c-dur-wrap', 'c-sleep-wrap'].forEach(id => {
      const card = document.getElementById(id)?.closest('.chart-card');
      if (card) card.style.flex = side ? '1 1 calc(50% - 9px)' : '1 1 100%';
    }); }

  // Helpers partagés (sleepOnsetH / durColor / onsetColor / fmtDecH) : définis globalement
  const tH = sleepTargetH();

  renderFormViz(days, allDates);
  renderHabitsViz(days, 'habits-viz', allDates);

  // Forme / Habitudes : une barre de défilement horizontale signifie que l'encart
  // est trop à l'étroit à mi-largeur — on lui rend alors toute la ligne.
  requestAnimationFrame(() => {
    ['form-viz-scroll', 'habits-viz-scroll'].forEach(id => {
      const sc = document.getElementById(id);
      const card = sc?.closest('.chart-card');
      if (!card) return;
      // On mesure à mi-largeur figée (flex-grow 0) : sinon un encart seul sur sa
      // ligne s'étirerait déjà à 100 % et ne déborderait plus.
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

  // Inline plugin: dashed target line + its label, on the y axis
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

  // Inline plugin: relie les points. Chaque segment reçoit son propre dégradé, de la
  // couleur du point de gauche à celle du point de droite, si bien que la teinte suit
  // le passage d'une bande à l'autre. Réservé au graphe des durées.
  function gradientLine(colorFn) {
    return { id:'gradientLine', beforeDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.data.datasets.forEach((ds, i) => {
        const pts = chart.getDatasetMeta(i).data
          .map((pt, j) => ({ pt, v: ds.data[j], j }))
          .filter(p => p.v != null);
        if (pts.length < 2) return;
        ctx.save();
        ctx.lineWidth = 2;
        // Segment par segment, et seulement entre deux jours consécutifs : l'axe
        // couvre une plage de dates continue, donc deux points séparés d'un jour
        // non encodé ne doivent pas être reliés — la ligne inventerait une
        // continuité qui n'existe pas dans les données.
        for (let k = 0; k < pts.length - 1; k++) {
          const a = pts[k], b = pts[k+1];
          if (b.j - a.j !== 1) continue;
          const g = ctx.createLinearGradient(a.pt.x, 0, b.pt.x, 0);
          g.addColorStop(0, colorFn(a.v));
          g.addColorStop(1, colorFn(b.v));
          ctx.strokeStyle = g;
          ctx.beginPath();
          ctx.moveTo(a.pt.x, a.pt.y);
          ctx.lineTo(b.pt.x, b.pt.y);
          ctx.stroke();
        }
        ctx.restore();
      });
    }};
  }

  // Inline plugin: value labels above each dot
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

  const durData = days.map(e => { if(!e) return null; const d=sleepDuration(e); return d!==null?Math.round(d*100)/100:null; });

  // Duration chart — dots, with a configurable target line
  if (charts.dur) charts.dur.destroy();
  const tD = durTargetH();
  document.getElementById('dur-goal').innerHTML =
    `<span class="goal-dash"></span>${t('goal_label')} ${fmtH(tD)}`;
  document.getElementById('dur-legend').innerHTML = bandsLegendHtml(durBands());
  // Axe toujours ancré à 0h : les traits verticaux partent de l'abscisse, donc leur
  // longueur ne se lit correctement que sur une base zéro.
  const durVals = durData.filter(v => v != null);
  const durLo = 0;
  const durHi = Math.ceil(Math.max(tD, ...durVals)) + 1;
  charts.dur = new Chart(document.getElementById('c-dur').getContext('2d'), {
    type: 'line',
    data: {
      labels: xlabels,
      datasets: [{
        label: 'Durée de sommeil',
        data: durData,
        borderWidth: 0,
        pointRadius: durData.map(v => v != null ? 4 : 0),
        pointBackgroundColor: durData.map(v => durColor(v, 'transparent')),
        showLine: false,
      }]
    },
    options: {
      responsive: true,
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
        y: { min: durLo, max: durHi, ticks: { stepSize: 1, callback: v => v+'h' } }
      }
    },
    plugins: [ gradientLine(durColor), refLine(tD, fmtH(tD)), dotLabels(durColor, fmtH) ]
  });

  // Sleep onset chart
  if (charts.sleep) charts.sleep.destroy();
  const onsetData = days.map(sleepOnsetH);
  document.getElementById('sleep-goal').innerHTML =
    `<span class="goal-dash"></span>${t('goal_label')} ${fmtClock(sleepTarget)}`;
  document.getElementById('sleep-legend').innerHTML = bandsLegendHtml(onsetBands());
  charts.sleep = new Chart(document.getElementById('c-sleep').getContext('2d'), {
    type: 'line',
    data: {
      labels: xlabels,
      datasets: [{
        label: "Heure d'endormissement",
        data: onsetData,
        borderWidth: 0,
        pointRadius: onsetData.map(v => v != null ? 4 : 0),
        pointBackgroundColor: onsetData.map(v => onsetColor(v, 'transparent')),
        showLine: false,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { displayColors: false, callbacks: { label: ctx => {
          if (ctx.parsed.y == null) return ' –';
          return ` ${fmtDecH(ctx.parsed.y)}`;
        }}}
      },
      layout: { padding: { left: 0, right: 0 } },
      scales: {
        x: { offset: true, grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 10 }, padding: 4 } },
        y: {
          min: 20, max: 30,
          reverse: true,
          ticks: { stepSize: 1, callback: v => { const h = v >= 24 ? v - 24 : v; return `${String(h).padStart(2,'0')}${clockSep()}00`; } },
        }
      }
    },
    plugins: [ refLine(tH, fmtClock(sleepTarget)), dotLabels(onsetColor, fmtDecH) ]
  });

  // Tableau des corrélations, en bas de l'onglet (défini dans summary.js).
  renderCorrelations();
}

// ---- Tabs ----
