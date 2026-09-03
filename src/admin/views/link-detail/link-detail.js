/**
 * Per-link drilldown — "Bullion" design.
 *
 * A single link read top-to-bottom, rendered entirely as inline SVG from the
 * real /kortex/links/:code/analytics payload. No chart library, no fabricated
 * data. Design rules, enforced in code:
 *
 *  - Gold is bullion: spent on exactly one hero element (the traffic ribbon's
 *    click columns), withheld elsewhere. Visitors are cool slate, not gold.
 *  - Uncertainty is geometry: the reliability boundary (2026-08-17, when client
 *    IPs became resolvable) is drawn as a vertical marker that physically
 *    separates the "estimated" region from the "counted" region. Unreliable
 *    visitor figures are a range, never a false exact number.
 *  - The unmeasured set gets equal billing: analytics.unavailable[] and the
 *    events-vs-lifetime drift are a first-class hatched ledger, not a footnote.
 *
 * @module views/link-detail/link-detail
 */

import { apiFetch } from '../../js/config.js';
import * as router from '../../js/router.js';
import * as utils from '../../js/utils.js';

const esc = (v) => utils.escapeHtml(String(v ?? ''));
const RELIABILITY_ISO = '2026-08-17';

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
function fmtDay(iso) { return iso ? new Date(iso).toISOString().slice(0, 10) : '—'; }
function humanHours(h) {
  if (h == null) return '—';
  if (h < 1) return '<1h';
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

// One shared diagonal-hatch pattern id per render, injected once.
function hatchDefs(id) {
  return `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="6" height="6" fill="transparent"/>
    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--data-void)" stroke-width="3"/>
  </pattern></defs>`;
}

/* ── 1. Traffic & reach ribbon ─────────────────────────────────────────────
   Gold click columns per day + a slate visitor overlay. A vertical marker at
   the reliability boundary splits the estimated region (hatched, visitors
   cannot be trusted) from the counted region (solid visitor line). */
function renderRibbon(timeline, unique) {
  if (!timeline.length) return '';
  const W = 720, H = 200, padL = 34, padR = 12, padT = 14, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const n = timeline.length;
  const bw = Math.max(2, Math.min(26, (iw / n) * 0.62));
  const step = iw / n;
  const maxClicks = Math.max(...timeline.map(d => d.clicks), 1);
  const x = (i) => padL + step * i + (step - bw) / 2;
  const yC = (v) => padT + ih - (v / maxClicks) * ih;

  const boundaryIdx = timeline.findIndex(d => d.date >= RELIABILITY_ISO);
  const hasBoundary = boundaryIdx > 0 && boundaryIdx < n;
  const bx = boundaryIdx >= 0 ? padL + step * boundaryIdx : null;

  // y gridlines (0, mid, max)
  const grid = [0, Math.ceil(maxClicks / 2), maxClicks].map(v => {
    const yy = yC(v);
    return `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="var(--grid-tick)"/>
      <text x="${padL - 6}" y="${(yy + 3).toFixed(1)}" text-anchor="end" class="ld-svg-tick">${v}</text>`;
  }).join('');

  // estimated-region shade (before the boundary)
  const estRegion = hasBoundary
    ? `<rect x="${padL}" y="${padT}" width="${(bx - padL).toFixed(1)}" height="${ih}" fill="url(#hatchRibbon)" opacity="0.5"/>`
    : '';

  const cols = timeline.map((d, i) => {
    if (!d.clicks) return '';
    const h = ih - (yC(d.clicks) - padT);
    return `<rect x="${x(i).toFixed(1)}" y="${yC(d.clicks).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="var(--gold-primary)"/>`;
  }).join('');

  // visitor overlay: solid line only where reliable (>= boundary); dotted before
  const pts = timeline.map((d, i) => `${(padL + step * i + step / 2).toFixed(1)},${yC(d.uniqueVisitors || 0).toFixed(1)}`);
  const splitAt = hasBoundary ? boundaryIdx : 0;
  const dotted = pts.slice(0, Math.max(1, splitAt + 1)).join(' ');
  const solid = pts.slice(splitAt).join(' ');
  const visitorLine =
    `${splitAt > 0 ? `<polyline points="${dotted}" fill="none" stroke="var(--data-visitor)" stroke-width="1.4" stroke-dasharray="2 3" opacity="0.7"/>` : ''}
     ${solid.split(' ').length > 1 ? `<polyline points="${solid}" fill="none" stroke="var(--data-visitor)" stroke-width="1.8"/>` : ''}`;

  // Place the boundary label inside the plot: to the right of the marker
  // normally, but flipped to the left (end-anchored) when the marker sits in
  // the right third, so it never clips the viewBox edge.
  const nearRight = bx != null && bx > padL + iw * 0.68;
  const boundaryMark = hasBoundary
    ? `<line x1="${bx.toFixed(1)}" y1="${padT - 4}" x2="${bx.toFixed(1)}" y2="${padT + ih}" stroke="var(--gold-dark)" stroke-width="1" stroke-dasharray="3 3"/>
       <text x="${(nearRight ? bx - 5 : bx + 5).toFixed(1)}" y="${padT + 6}" text-anchor="${nearRight ? 'end' : 'start'}" class="ld-svg-note">attribution begins</text>`
    : '';

  const axisDays = [0, Math.floor(n / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  const xLabels = axisDays.map(i => `<text x="${(padL + step * i + step / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="ld-svg-tick">${esc(timeline[i].date.slice(5))}</text>`).join('');

  return `<section class="ld-card ld-card-hero">
    <div class="ld-card-head"><h4>Traffic &amp; reach</h4>
      <span class="ld-legend"><i class="sw-gold"></i>clicks <i class="sw-visitor"></i>distinct visitors</span></div>
    <svg viewBox="0 0 ${W} ${H}" class="ld-svg" preserveAspectRatio="none" role="img" aria-label="Daily clicks with distinct-visitor overlay">
      ${hatchDefs('hatchRibbon')}
      ${estRegion}${grid}${cols}${visitorLine}${boundaryMark}${xLabels}
    </svg>
    ${!unique?.reliable ? `<p class="ld-caveat">Visitors before ${RELIABILITY_ISO} can't be attributed — that region is hatched and its visitor line is dotted. Only the solid segment is counted.</p>` : ''}
  </section>`;
}

/* ── 2. Reach & confidence meter ───────────────────────────────────────────*/
function renderReach(unique, installs) {
  if (!unique) return '';
  const exact = unique.reliable;
  const figure = exact ? esc(unique.distinctVisitors) : `${esc(unique.lowerBound)}–${esc(unique.upperBound)}`;
  const cov = Math.max(0, Math.min(100, unique.coveragePct || 0));
  return `<section class="ld-card">
    <div class="ld-card-head"><h4>Reach &amp; confidence</h4></div>
    <div class="ld-reach">
      <div class="ld-figure-block">
        <span class="ld-figure">${figure}</span>
        <span class="ld-figure-label">${exact ? 'distinct visitors' : 'visitors (range)'}</span>
      </div>
      <div class="ld-reach-meta">
        <div class="ld-meter" title="${esc(unique.basedOnEvents)} of ${esc(unique.ofTotalEvents)} events attributable">
          <span class="ld-meter-fill" style="width:${cov}%"></span>
        </div>
        <p class="ld-sub">${cov}% attribution coverage · ${unique.clicksPerVisitor ? `${esc(unique.clicksPerVisitor)} clicks/visitor` : 'ratio n/a'}${installs?.attributed ? ` · ${esc(installs.attributed)} installs` : ''}</p>
      </div>
    </div>
    ${unique.caveat ? `<p class="ld-caveat">${esc(unique.caveat)}</p>` : ''}
  </section>`;
}

/* ── 3. Rhythm — quiet-now bar (the safe cadence rendering) ────────────────
   Two bar lengths on one scale: how long the link has been quiet NOW versus
   its longest quiet stretch. Avoids positioning a dead-zone band on a timeline
   the API gives no start-timestamp for. */
function renderRhythm(cadence) {
  if (!cadence) return '';
  const now = cadence.hoursSinceLastClick ?? 0;
  const longest = cadence.longestQuietHours ?? 0;
  const scale = Math.max(now, longest, 1);
  const pct = (v) => `${Math.round((v / scale) * 100)}%`;
  const alarming = longest && now >= longest * 0.9;
  return `<section class="ld-card">
    <div class="ld-card-head"><h4>Rhythm</h4></div>
    <div class="ld-rhythm">
      <div class="ld-rhythm-row">
        <span class="ld-rhythm-key">Quiet now</span>
        <span class="ld-rhythm-track"><span class="ld-rhythm-bar ${alarming ? 'is-alarm' : ''}" style="width:${pct(now)}"></span></span>
        <span class="ld-rhythm-val">${humanHours(now)}</span>
      </div>
      <div class="ld-rhythm-row">
        <span class="ld-rhythm-key">Longest silence</span>
        <span class="ld-rhythm-track"><span class="ld-rhythm-bar is-muted" style="width:${pct(longest)}"></span></span>
        <span class="ld-rhythm-val">${humanHours(longest)}</span>
      </div>
    </div>
    <div class="ld-chiprow">
      <span class="ld-chip"><b>${humanHours(cadence.hoursToFirstClick)}</b> to first scan</span>
      <span class="ld-chip"><b>${humanHours(cadence.medianGapHours)}</b> typical gap</span>
    </div>
    ${longest >= 72 ? `<p class="ld-note">${(() => { const d = Math.round(longest / 24); return `${[8, 11, 18].includes(d) || String(d)[0] === '8' ? 'An' : 'A'} ${d}-day`; })()} silence is the dominant fact here — for a printed code that is a placement question, not a traffic one.</p>` : ''}
  </section>`;
}

/* ── 4. Redirect latency range ─────────────────────────────────────────────*/
function renderLatency(latency, unavailable) {
  if (!latency) return '';
  const BUDGET = 500; // ms — a comfortable resolver budget
  const scaleMax = Math.max(latency.slowestMs, BUDGET) * 1.1;
  const pos = (v) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  const weak = latency.samples < 5;
  return `<section class="ld-card">
    <div class="ld-card-head"><h4>Redirect latency</h4>
      <span class="ld-legend">${esc(latency.samples)} sample${latency.samples === 1 ? '' : 's'}${weak ? ' · thin' : ''}</span></div>
    <div class="ld-latency">
      <div class="ld-latency-track">
        <span class="ld-latency-budget" style="left:${pos(BUDGET)}" title="500ms budget"></span>
        <span class="ld-latency-span" style="left:${pos(latency.medianMs)};right:calc(100% - ${pos(latency.slowestMs)})"></span>
        <span class="ld-latency-tick" style="left:${pos(latency.medianMs)}"></span>
        <span class="ld-latency-tick is-slow" style="left:${pos(latency.slowestMs)}"></span>
      </div>
      <div class="ld-latency-labels">
        <span><b>${esc(latency.medianMs)}ms</b> median</span>
        <span><b>${esc(latency.slowestMs)}ms</b> slowest</span>
      </div>
    </div>
    ${weak ? `<p class="ld-note">Only ${esc(latency.samples)} timed redirect${latency.samples === 1 ? '' : 's'} — read this as directional, not a stable median.</p>` : ''}
  </section>`;
}

/* ── 5. Source breakdown matrix ────────────────────────────────────────────*/
function facetBars(title, rows, total) {
  if (!rows || !rows.length || rows.every(r => r.value === null)) {
    return `<div class="ld-facet"><h5>${esc(title)}</h5><p class="ld-none">not reported</p></div>`;
  }
  const max = Math.max(...rows.map(r => r.clicks));
  return `<div class="ld-facet"><h5>${esc(title)}</h5>
    ${rows.slice(0, 6).map((r, i) => `
      <div class="ld-facet-row">
        <span class="ld-facet-key">${r.value === null ? '<em>none</em>' : esc(r.value)}</span>
        <span class="ld-facet-track"><span class="ld-facet-fill${i === 0 ? ' is-lead' : ''}" style="width:${Math.round((r.clicks / max) * 100)}%"></span></span>
        <span class="ld-facet-num">${r.clicks}</span>
      </div>`).join('')}
  </div>`;
}
function renderMatrix(b, total) {
  return `<section class="ld-card">
    <div class="ld-card-head"><h4>Where clicks came from</h4></div>
    <div class="ld-matrix">
      ${facetBars('Device', b.deviceType, total)}
      ${facetBars('OS', b.os, total)}
      ${facetBars('Browser', b.browser, total)}
      ${facetBars('Platform', b.platform, total)}
      ${facetBars('Referrer', b.referrer, total)}
      ${facetBars('Destination', b.destination, total)}
      ${b.country ? facetBars('Country', b.country, total) : ''}
    </div>
  </section>`;
}

/* ── 6. When it gets scanned ───────────────────────────────────────────────
   A 24-bin hour histogram and 7-bin weekday grid only carry a distribution once
   there is enough volume. Below that threshold the individual scans ARE the
   information — so show a scan log at low volume, and the distribution ramps
   only when the sample is big enough for a shape to be real. */
const HEATMAP_MIN = 25;

function ramp(cells, labelEvery) {
  const max = Math.max(...cells.map(c => c.clicks), 1);
  return cells.map((c, i) => {
    const t = c.clicks / max;
    const bg = c.clicks ? `color-mix(in srgb, var(--gold-primary) ${Math.round(20 + t * 80)}%, var(--surface-sunken))` : 'var(--data-void)';
    const lbl = (i % labelEvery === 0) ? `<span class="ld-ramp-lbl">${esc(String(c.value ?? i)).slice(0, 3)}</span>` : '';
    return `<span class="ld-ramp-cell" style="background:${bg}" title="${esc(c.value ?? i)}: ${c.clicks}">${lbl}</span>`;
  }).join('');
}

function scanRow(s) {
  const d = new Date(s.at);
  const when = d.toISOString().replace('T', ' ').slice(0, 16);
  const dev = [s.deviceType, s.os, s.browser].filter(Boolean).join(' · ') || 'unknown device';
  return `<div class="ld-scan-row">
    <span class="ld-scan-when">${esc(when)} UTC</span>
    <span class="ld-scan-dev">${esc(dev)}</span>
    <span class="ld-scan-geo">${s.country ? esc(s.country) : '—'}</span>
  </div>`;
}

function renderWhen(a) {
  const total = a.totals?.events || 0;
  const b = a.breakdowns || {};

  // Enough volume → the distribution is real. Show the ramps.
  if (total >= HEATMAP_MIN) {
    const hasHours = b.hourOfDayUtc?.some(h => h.clicks);
    const hasDows = b.dayOfWeekUtc?.some(d => d.clicks);
    if (!hasHours && !hasDows) return '';
    return `<section class="ld-card">
      <div class="ld-card-head"><h4>When it gets scanned <span class="ld-h5-note">UTC · ${esc(total)} scans</span></h4></div>
      ${hasHours ? `<div class="ld-clockblock"><span class="ld-clock-label">Hour</span><div class="ld-ramp ld-ramp-24">${ramp(b.hourOfDayUtc.map((c, i) => ({ value: i, clicks: c.clicks })), 6)}</div></div>` : ''}
      ${hasDows ? `<div class="ld-clockblock"><span class="ld-clock-label">Day</span><div class="ld-ramp ld-ramp-7">${ramp(b.dayOfWeekUtc, 1)}</div></div>` : ''}
    </section>`;
  }

  // Low volume → the individual scans are the story.
  const scans = a.recentScans || [];
  if (!scans.length) return '';
  return `<section class="ld-card">
    <div class="ld-card-head"><h4>Every scan</h4><span class="ld-legend">${esc(scans.length)} scan${scans.length === 1 ? '' : 's'} · newest first</span></div>
    <div class="ld-scanlog">${scans.map(scanRow).join('')}</div>
    <p class="ld-note">Too few scans for an hour-of-day pattern to mean anything — here is each one instead. The distribution view appears past ${HEATMAP_MIN} scans.</p>
  </section>`;
}

/* ── 7. Not-measured ledger (grafted honesty instrument) ──────────────────
   Drift reconciliation (events vs lifetime counter) + every unavailable metric,
   given equal billing as a hatched peer panel rather than a footnote. */
function renderLedger(totals, unavailable) {
  const rows = [];
  if (totals && totals.storedClickCount != null) {
    const reconciled = totals.drift === 0;
    rows.push(`<div class="ld-ledger-row">
      <span class="ld-ledger-hatch"></span>
      <span class="ld-ledger-key">Events retained vs lifetime</span>
      <span class="ld-ledger-val">${esc(totals.events)} / ${esc(totals.storedClickCount)}${reconciled ? ' ✓' : ''}</span>
    </div>`);
    if (totals.driftNote) rows.push(`<p class="ld-ledger-note">${esc(totals.driftNote)}</p>`);
  }
  for (const u of (unavailable || [])) {
    rows.push(`<div class="ld-ledger-row">
      <span class="ld-ledger-hatch"></span>
      <span class="ld-ledger-key">${esc(u.metric)}</span>
      <span class="ld-ledger-val ld-ledger-void">not measured</span>
    </div>
    <p class="ld-ledger-note">${esc(u.reason)}</p>`);
  }
  if (!rows.length) return '';
  return `<section class="ld-card ld-card-ledger">
    <div class="ld-card-head"><h4>What this view is <em>not</em> telling you</h4></div>
    ${rows.join('')}
  </section>`;
}

/* ── link header + meta ────────────────────────────────────────────────────*/
function renderHeader(link, analytics) {
  const t = analytics.totals;
  const status = link.status === 'held'
    ? '<span class="ld-status is-paused" title="Held for review: the destination is new to Kortex and is being checked">Under review</span>'
    : link.status === 'blocked'
      ? '<span class="ld-status is-paused" title="Blocked by the safety check or an operator">Blocked</span>'
      : link.enabled
        ? '<span class="ld-status is-live">Live</span>'
        : '<span class="ld-status is-paused">Paused</span>';
  return `<header class="ld-header">
    <button class="ld-back" data-ld-back>← Back</button>
    <div class="ld-header-main">
      <div>
        <h3 class="ld-title">${esc(link.title || link.code)} ${status}</h3>
        <p class="ld-shorturl">${esc(link.shortUrl || 'kaayko.com/l/' + link.code)}</p>
      </div>
      <div class="ld-header-kpis">
        <div class="ld-kpi ld-kpi-hero"><span class="ld-kpi-val">${esc(t.events)}</span><span class="ld-kpi-lbl">clicks measured</span></div>
        <div class="ld-kpi"><span class="ld-kpi-val">${esc(analytics.window.daysWithTraffic)}</span><span class="ld-kpi-lbl">active days</span></div>
        <div class="ld-kpi"><span class="ld-kpi-val">${esc(analytics.window.daysSpanned)}</span><span class="ld-kpi-lbl">days live</span></div>
      </div>
    </div>
  </header>`;
}
function renderMeta(link, analytics) {
  const utm = link.utm && Object.keys(link.utm).length
    ? Object.entries(link.utm).map(([k, v]) => `<div class="ld-meta-row"><span class="ld-meta-k">${esc(k)}</span><span>${esc(v)}</span></div>`).join('')
    : `<div class="ld-meta-row"><span class="ld-meta-k">UTM</span><span class="ld-none">none set</span></div>`;
  return `<section class="ld-card">
    <div class="ld-card-head"><h4>Link</h4></div>
    <div class="ld-meta">
      <div class="ld-meta-row"><span class="ld-meta-k">Destination</span><span>${esc(link.destination || '—')}</span></div>
      <div class="ld-meta-row"><span class="ld-meta-k">Created</span><span>${fmtDateTime(link.createdAt)} · ${esc(link.createdBy || 'unknown')}</span></div>
      <div class="ld-meta-row"><span class="ld-meta-k">First → last click</span><span>${fmtDay(analytics.window.firstEvent)} → ${fmtDay(analytics.window.lastEvent)}</span></div>
      ${utm}
    </div>
  </section>`;
}

function render(payload) {
  const { link, analytics } = payload;
  const a = analytics;
  if (!a.timeline.length) {
    return `<div class="ld-root">
      ${renderHeader(link, a)}
      ${renderLedger(a.totals, a.unavailable)}
      <section class="ld-card"><p class="ld-none">No clicks recorded within the ${esc(a.window?.retentionDays || 30)}-day retention window.</p></section>
    </div>`;
  }
  return `<div class="ld-root">
    ${renderHeader(link, a)}
    ${renderRibbon(a.timeline, a.unique)}
    <div class="ld-grid-2">
      ${renderReach(a.unique, a.installs)}
      ${renderRhythm(a.cadence)}
    </div>
    ${renderLatency(a.latency, a.unavailable)}
    ${renderMatrix(a.breakdowns, a.totals.events)}
    ${renderWhen(a)}
    ${renderMeta(link, a)}
    ${renderLedger(a.totals, a.unavailable)}
  </div>`;
}

export async function showLinkDetail(code, container) {
  container.innerHTML = `<div class="ld-loading">Loading ${esc(code)}…</div>`;
  try {
    const response = await apiFetch(`/kortex/links/${encodeURIComponent(code)}/analytics`);
    if (!response) return; // apiFetch handled a 401 by logging out
    const payload = await response.json();
    if (!response.ok || !payload?.success) throw new Error(payload?.error || `Request failed (${response.status})`);
    container.innerHTML = render(payload);
  } catch (err) {
    container.innerHTML = `<div class="ld-root">
      <button class="ld-back" data-ld-back>← Back</button>
      <p class="ld-caveat">Could not load analytics for ${esc(code)}: ${esc(err.message)}</p></div>`;
  }
  const back = container.querySelector('[data-ld-back]');
  if (back) back.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else router.navigate('links', null, { replace: true });
  });
}

/** Render a payload directly into a container (used by the offline preview harness). */
export function renderInto(container, payload) { container.innerHTML = render(payload); }

/** Routed view entry: link code arrives via #/links/<code> as STATE.routeParam. */
export async function init(STATE) {
  const container = document.querySelector('#link-detail-content');
  if (!container) return;
  const code = STATE?.routeParam;
  if (!code) { router.navigate('links', null, { replace: true }); return; }
  await showLinkDetail(code, container);
}
