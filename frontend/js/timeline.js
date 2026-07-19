// 24 h timeline rendering (20:00 → 20:00).
// renderTL = detailed version (Entry, dashboard) · renderTLCompact = dense version (History).
function fracDur(d) {
  if (d < 0) d += 1;
  return fmtH(d * 24);   // same rule as everywhere else: "7h30", "30min"
}

// Hour stamps for a timeline, shared by the dashboard preview
// (renderTL) and History (renderTLCompact).
//
// Two touching blocks — sleep then half-sleep, say — form a single recorded period:
// only its outer bounds are stamped, otherwise the junction time is printed twice at
// the same spot. A genuinely interrupted night stays two periods and keeps all four
// times.
function periodStamps(periods, pct) {
  if (!periods.length) return '';
  const EPS = 1e-6;
  const merged = [];
  [...periods].sort((a, b) => a.s - b.s).forEach(p => {
    const last = merged[merged.length - 1];
    if (last && p.s <= last.e + EPS) {
      if (p.e > last.e) { last.e = p.e; last.endT = p.endT; }
      last.isNap = last.isNap && p.isNap;
    } else merged.push({ ...p });
  });
  const stamp = (f, txt) => `<div style="position:absolute;left:${pct(f)};top:0;transform:translateX(-50%);` +
    `font-size:0.55rem;color:var(--muted);white-space:nowrap">${txt}</div>`;
  // Below this width the two times would overlap: a single centred stamp carries
  // both bounds instead.
  const MIN_W = 0.07;
  let out = '';
  merged.forEach(p => {
    // A nap only carries its start time: it is short, and its end can be read from
    // the block's length.
    if (p.isNap) {
      if (p.startT) out += stamp(p.s, fmtClock(p.startT));
    } else if (p.e - p.s < MIN_W) {
      if (p.startT || p.endT) out += stamp((p.s + p.e) / 2, `${fmtClock(p.startT) || '?'} – ${fmtClock(p.endT) || '?'}`);
    } else {
      if (p.startT) out += stamp(p.s, fmtClock(p.startT));
      if (p.endT)   out += stamp(p.e, fmtClock(p.endT));
    }
  });
  return out;
}

// `opts.showTimes`: prints each period's start and end above the block, and moves the
// duration inside the bar to free up the space.
// Used by the dashboard preview; Entry keeps the original rendering.
function renderTL(e, containerId, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const showTimes = !!opts.showTimes;
  const pct = f => (f * 100).toFixed(3) + '%';

  let bars = '', arrows = '';
  const periods = [];   // blocs dessinés, en fractions d'axe — sert au marquage des heures

  // Grid lines — minor (every 1h) and major (every 4h)
  for (let h = 0; h <= 24; h++) {
    const major = h % 4 === 0;
    bars += `<div style="position:absolute;left:${pct(h/24)};top:0;height:100%;` +
      `border-left:1px ${major?'solid':'dashed'} rgba(0,0,0,${major?0.18:0.08})"></div>`;
  }

  const drawBlock = (s, en, half, startT, endT, isNap = false) => {
    let d = en - s; if (d < 0) d += 1;
    const w = d * 100;
    const dur = fracDur(d);
    const bg = half ? HALF_SLEEP_BG : SLEEP_BG;
    const cx = s + d / 2;
    bars += `<div style="position:absolute;left:${pct(s)};width:${w.toFixed(3)}%;height:100%;` +
      `background:${bg};cursor:default" title="${startT} → ${endT}"></div>`;
    if (showTimes) {
      // Duration inside the bar: dark text on half-sleep (light blue), light on full sleep.
      bars += `<div style="position:absolute;left:${pct(cx)};top:50%;transform:translate(-50%,-50%);` +
        `font-size:0.58rem;font-weight:700;color:${half ? '#1a2535' : '#ffffff'};white-space:nowrap;` +
        `pointer-events:none;z-index:2">${dur}</div>`;
      // Times are stamped further down, once touching blocks have been merged.
      periods.push({ s, e: s + d, startT, endT, isNap });
    } else {
      arrows += `<div style="position:absolute;left:${pct(cx)};bottom:1px;transform:translateX(-50%);` +
        `font-size:0.62rem;font-weight:700;color:var(--text);white-space:nowrap">${dur}</div>`;
    }
  };

  // Night sleep blocks
  for (const sl of normalizeSleeps(e)) {
    const bed = timeFrac(sl.bed || sl.bedtime), wk = timeFrac(sl.wakeup);
    const sleepS = timeFrac(sl.sleepStart), sleepE = timeFrac(sl.sleepEnd);
    const s  = sleepS !== null ? sleepS : bed;
    const en = sleepE !== null ? sleepE : wk;
    const startT = sl.sleepStart || sl.bed || sl.bedtime || '';
    const endT   = sl.sleepEnd   || sl.wakeup || '';
    if (s !== null && en !== null) drawBlock(s, en, sl.halfSleep, startT, endT);
    // In times mode the ↓ ↑ markers move into the bar (as renderTLCompact already did):
    // the top band then carries only the times, and can sit close to the bar.
    const marker = (f, glyph, tip) => showTimes
      ? `<div style="position:absolute;left:${pct(f)};bottom:1px;transform:translateX(-50%);font-size:11px;line-height:1;z-index:3;pointer-events:none" title="${tip}">${glyph}</div>`
      : `<div style="position:absolute;left:${pct(f)};bottom:0;transform:translateX(-50%);font-size:13px;line-height:1" title="${tip}">${glyph}</div>`;
    if (bed !== null) { const m = marker(bed, '↓', sl.bed||sl.bedtime||''); if (showTimes) bars += m; else arrows += m; }
    if (wk  !== null) { const m = marker(wk,  '↑', sl.wakeup||'');          if (showTimes) bars += m; else arrows += m; }
  }

  // Naps
  (e.naps||[]).filter(n=>n.s&&n.e).forEach(n=>{
    const s=timeFrac(n.s), en=timeFrac(n.e);
    if (s!==null&&en!==null) drawBlock(s, en, n.halfSleep, n.s, n.e, true);
  });

  if (showTimes) arrows += periodStamps(periods, pct);

  // Drowsiness markers — rendered inside tl-bar, vertically centred
  (e.drowsiness||[]).filter(d=>d).forEach(d=>{
    const f=timeFrac(d);
    if (f!==null) bars += `<div style="position:absolute;left:${pct(f)};top:50%;transform:translate(-50%,-50%);` +
      `font-size:0.65rem;color:#e67e22;font-weight:700;z-index:2;pointer-events:none" title="${d}">S</div>`;
  });

  // Hour labels — every 1h; major at every 4h.
  // `opts.hideHours` drops them entirely: the dashboard preview stamps each recorded
  // period with its own times, so a full ruler underneath only adds noise.
  let labels = '';
  for (let h = 0; opts.hideHours ? false : h <= 24; h++) {
    const hour = (20 + h) % 24;
    const major = h % 4 === 0;
    labels += `<div style="position:absolute;left:${pct(h/24)};transform:translateX(-50%);` +
      `font-size:${major?'0.60':'0.50'}rem;color:var(--muted);font-weight:${major?'600':'400'}">${fmtHourTick(hour)}</div>`;
  }

  el.innerHTML = `
    <div class="tl-wrap${showTimes ? ' tl-times' : ''}">
      <div class="tl-arrows">${arrows}</div>
      <div class="tl-bar">${bars}</div>
      <div class="tl-hlabels">${labels}</div>
    </div>
    <div class="tl-legend">
      <div class="tl-legend-item">
        <div class="tl-legend-swatch" style="background:${SLEEP_BG}"></div> ${t('tl_sleep')}
      </div>
      <div class="tl-legend-item">
        <div class="tl-legend-swatch" style="background:${HALF_SLEEP_BG}"></div> ${t('tl_half')}
      </div>
      <div class="tl-legend-item" style="color:#e67e22;font-weight:700">S</div>
      <div>${t('tl_drow')}</div>
      <div class="tl-legend-item">${t('tl_markers')}</div>
    </div>
  `;
}

// `opts.showTimes`: same annotation as the dashboard preview — times at the bounds of
// each recorded period, duration inside the bar. Used by History, which thereby drops
// its "Times" column.
function renderTLCompact(e, containerId, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const showTimes = !!opts.showTimes;
  const pct = f => (f * 100).toFixed(3) + '%';
  let bars = '';
  const periods = [];
  for (let h = 0; h <= 24; h++) {
    const major = h % 4 === 0;
    bars += `<div style="position:absolute;left:${pct(h/24)};top:0;height:100%;border-left:1px ${major?'solid':'dashed'} rgba(0,0,0,${major?0.18:0.08})"></div>`;
  }
  const drawBlock = (s, en, half, startT, endT, isNap = false) => {
    let d = en - s; if (d < 0) d += 1;
    bars += `<div style="position:absolute;left:${pct(s)};width:${(d*100).toFixed(3)}%;height:100%;background:${half?HALF_SLEEP_BG:SLEEP_BG}" title="${startT} → ${endT}"></div>`;
    if (showTimes) {
      bars += `<div style="position:absolute;left:${pct(s + d/2)};top:50%;transform:translate(-50%,-50%);` +
        `font-size:0.58rem;font-weight:700;color:${half ? '#1a2535' : '#ffffff'};white-space:nowrap;` +
        `pointer-events:none;z-index:2">${fracDur(d)}</div>`;
      periods.push({ s, e: s + d, startT, endT, isNap });
    }
  };
  for (const sl of normalizeSleeps(e)) {
    const bed = timeFrac(sl.bed || sl.bedtime), wk = timeFrac(sl.wakeup);
    const sleepS = timeFrac(sl.sleepStart), sleepE = timeFrac(sl.sleepEnd) ?? wk;
    const s = sleepS !== null ? sleepS : bed;
    const en = sleepE !== null ? sleepE : wk;
    if (s !== null && en !== null) drawBlock(s, en, sl.halfSleep, sl.sleepStart||sl.bed||'', sl.sleepEnd||sl.wakeup||'');
    if (bed !== null) bars += `<div style="position:absolute;left:${pct(bed)};bottom:1px;transform:translateX(-50%);font-size:11px;line-height:1;z-index:3;pointer-events:none" title="${sl.bed||sl.bedtime||''}">↓</div>`;
    if (wk  !== null) bars += `<div style="position:absolute;left:${pct(wk)};bottom:1px;transform:translateX(-50%);font-size:11px;line-height:1;z-index:3;pointer-events:none" title="${sl.wakeup||''}">↑</div>`;
  }
  (e.naps||[]).filter(n=>n.s&&n.e).forEach(n=>{
    const s=timeFrac(n.s), en=timeFrac(n.e);
    if (s!==null&&en!==null) drawBlock(s, en, n.halfSleep, n.s, n.e, true);
  });
  (e.drowsiness||[]).filter(d=>d).forEach(d=>{
    const f=timeFrac(d);
    if (f!==null) bars += `<div style="position:absolute;left:${pct(f)};top:50%;transform:translate(-50%,-50%);font-size:0.6rem;color:#e67e22;font-weight:700;z-index:2;pointer-events:none" title="${d}">S</div>`;
  });
  const barBox = ov => `<div style="position:relative;${ov};background:var(--border);border-radius:3px;overflow:hidden">${bars}</div>`;
  el.innerHTML = showTimes
    ? `<div style="display:flex;flex-direction:column;height:100%">
         <div style="position:relative;height:15px;flex-shrink:0">${periodStamps(periods, pct)}</div>
         ${barBox('flex:1')}
       </div>`
    : barBox('height:100%');
}

// ---- Rating groups ----
