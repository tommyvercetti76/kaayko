/**
 * Per-link drilldown — "Bullion" design.
 *
 * A single link read top-to-bottom from the real /kortex/links/:code/analytics
 * payload. The Action Center (needs attention, what's working, result since
 * the last change, explore tabs) and the five shared views come from
 * window.KortexViews, the same code kaayko.com/kortex renders; the evidence
 * charts below them are inline SVG. No chart library, no fabricated data.
 *
 *  - Gold is bullion: spent on exactly one hero element (the traffic ribbon's
 *    scan columns), withheld elsewhere. Visitors are cool slate, not gold.
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
import * as ui from '../../js/ui.js';
import { STATE } from '../../js/kortex-core.js';

const esc = (v) => utils.escapeHtml(String(v ?? ''));
const RELIABILITY_ISO = '2026-08-17';
// Below this many delivered scans the individual scans are the story; above it
// the Graphs tab (hours and weekdays in the viewer's zone) carries the shape.
const SCAN_LOG_MAX = 25;

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
const words = (constant) => String(constant || '').toLowerCase().replace(/_/g, ' ');
const linkPath = (code, suffix = '') => `/kortex/${encodeURIComponent(code)}${suffix}`;

/** Parse a JSON response; transport failures and `success:false` become one error. Null when apiFetch logged out on a 401. */
async function readJson(response, failureMessage) {
  if (!response) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || `${failureMessage} (${response.status})`);
  return data;
}

// One shared diagonal-hatch pattern id per render, injected once.
function hatchDefs(id) {
  return `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="6" height="6" fill="transparent"/>
    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--data-void)" stroke-width="3"/>
  </pattern></defs>`;
}

/* ── 1. Traffic & reach ribbon ─────────────────────────────────────────────
   Gold scan columns per day + a slate visitor overlay. A vertical marker at
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
      <span class="ld-legend"><i class="sw-gold"></i>scans <i class="sw-visitor"></i>distinct visitors</span></div>
    <svg viewBox="0 0 ${W} ${H}" class="ld-svg" preserveAspectRatio="none" role="img" aria-label="Daily scans with distinct-visitor overlay">
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
        <p class="ld-sub">${cov}% attribution coverage · ${unique.clicksPerVisitor ? `${esc(unique.clicksPerVisitor)} scans per visitor` : 'ratio n/a'}${installs?.attributed ? ` · ${esc(installs.attributed)} installs` : ''}</p>
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
function renderLatency(latency) {
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
function facetBars(title, rows) {
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
function renderMatrix(b) {
  return `<section class="ld-card">
    <div class="ld-card-head"><h4>Where scans came from</h4></div>
    <div class="ld-matrix">
      ${facetBars('Device', b.deviceType)}
      ${facetBars('OS', b.os)}
      ${facetBars('Browser', b.browser)}
      ${facetBars('Platform', b.platform)}
      ${facetBars('Referrer', b.referrer)}
      ${facetBars('Destination', b.destination)}
      ${b.country ? facetBars('Country', b.country) : ''}
    </div>
  </section>`;
}

/* ── 6. Every scan — the low-volume log ────────────────────────────────────
   Below SCAN_LOG_MAX delivered scans a distribution has no shape, so the
   individual scans are shown instead. Past it, the Graphs tab above carries
   hours and weekdays in the viewer's zone. */
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

function renderEveryScan(a) {
  const scans = a.recentScans || [];
  if (!scans.length || (a.totals?.events || 0) >= SCAN_LOG_MAX) return '';
  return `<section class="ld-card">
    <div class="ld-card-head"><h4>Every scan</h4><span class="ld-legend">${esc(scans.length)} scan${scans.length === 1 ? '' : 's'} · newest first</span></div>
    <div class="ld-scanlog">${scans.map(scanRow).join('')}</div>
    <p class="ld-note">Too few scans for an hour-of-day pattern to mean anything — here is each one instead. Past ${SCAN_LOG_MAX} scans the Graphs tab shows hours and weekdays in your time zone.</p>
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

/* ── link header: toolbar, identity, sharing state, result since last change ─*/
const SINCE_WORDS = { pending: 'too early to tell', improved: 'improved', unchanged: 'unchanged', regressed: 'regressed' };

/** One line on the measured effect of the last accepted or dismissed finding. */
function renderSinceLastChange(since) {
  if (!since) return '';
  const rate = (side) => (side && side.usefulRate != null ? `${Math.round(side.usefulRate * 100)}%` : '—');
  const ago = since.atMs ? utils.timeAgo(new Date(since.atMs)) : '';
  return `<p class="ld-since is-${esc(since.state)}"><b>${esc(SINCE_WORDS[since.state] || since.state)}</b> since ${esc(words(since.type) || 'the last change')}${ago ? ` (${esc(ago)})` : ''} · useful rate ${rate(since.before)} → ${rate(since.after)} on ${esc(since.after?.observed ?? 0)} scans since</p>`;
}

function shareControls(link) {
  return link.shared
    ? `<button type="button" class="ld-back" data-ld-share="rotate">Rotate share link</button>
       <button type="button" class="ld-back" data-ld-share="revoke">Stop sharing</button>`
    : `<button type="button" class="ld-back" data-ld-share="mint">Share report</button>`;
}
function shareLine(link) {
  if (!link.shared) return '';
  const until = link.shareExpiresAt ? `expires ${fmtDay(link.shareExpiresAt)}` : 'no expiry';
  return `<p class="ld-shorturl">Shared report active · ${esc(until)} · the address was shown once when it was made; rotate to get a fresh one.</p>`;
}

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
    <div class="ld-toolbar">
      <button type="button" class="ld-back" data-ld-back>← Back</button>
      <button type="button" class="ld-back" data-ld-csv>Download CSV</button>
      ${shareControls(link)}
    </div>
    <div class="ld-header-main">
      <div>
        <h3 class="ld-title">${esc(link.title || link.code)} ${status}</h3>
        <p class="ld-shorturl">${esc(link.shortUrl || 'kaayko.com/l/' + link.code)}</p>
        ${shareLine(link)}
        ${renderSinceLastChange(analytics.actionCenter?.sinceLastChange)}
      </div>
      <div class="ld-header-kpis">
        <div class="ld-kpi ld-kpi-hero"><span class="ld-kpi-val">${esc(t.observed ?? t.events)}</span><span class="ld-kpi-lbl">scans observed</span></div>
        <div class="ld-kpi"><span class="ld-kpi-val">${esc(analytics.window?.daysWithTraffic ?? 0)}</span><span class="ld-kpi-lbl">active days</span></div>
        <div class="ld-kpi"><span class="ld-kpi-val">${esc(analytics.window?.daysSpanned ?? 0)}</span><span class="ld-kpi-lbl">days live</span></div>
      </div>
    </div>
  </header>`;
}

const placementText = (link) => link.placementLabel || words(link.placement);
function checkpointText(cp) {
  const verdict = cp.applied ? 'applied' : cp.dismissed ? `dismissed (${words(cp.dismissed)})` : 'recorded';
  return `${words(cp.type)} · ${verdict} · ${fmtDateTime(cp.atMs ? new Date(cp.atMs).toISOString() : null)}`;
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
      <div class="ld-meta-row"><span class="ld-meta-k">First → last scan</span><span>${fmtDay(analytics.window.firstEvent)} → ${fmtDay(analytics.window.lastEvent)}</span></div>
      ${utm}
      ${link.placement ? `<div class="ld-meta-row"><span class="ld-meta-k">Placement</span><span>${esc(placementText(link))}</span></div>` : ''}
      ${link.schedule && Array.isArray(link.schedule.windows) && link.schedule.windows.length ? `<div class="ld-meta-row"><span class="ld-meta-k">Windows</span><span>${link.schedule.windows.map(w => `${esc(w.label || '')} ${esc(w.start)}–${esc(w.end)} → ${esc(w.url)}`).join('<br>')} <span class="ld-none">(${esc(link.schedule.timezone || 'UTC')})</span></span></div>` : ''}
      ${link.limits && (link.limits.maxClicks || link.limits.fallbackUrl) ? `<div class="ld-meta-row"><span class="ld-meta-k">Limits</span><span>${link.limits.maxClicks ? `stops after ${esc(link.limits.maxClicks)} scans` : 'no cap'}${link.limits.fallbackUrl ? ` → ${esc(link.limits.fallbackUrl)}` : ''}</span></div>` : ''}
      ${link.economics ? `<div class="ld-meta-row"><span class="ld-meta-k">Economics</span><span>print ${esc(link.economics.printCost != null ? link.economics.printCost : '—')} · value per visit ${esc(link.economics.valuePerVisit != null ? link.economics.valuePerVisit : '—')} ${esc(link.economics.currency || '')}</span></div>` : ''}
      ${link.campaignWindow ? `<div class="ld-meta-row"><span class="ld-meta-k">Campaign</span><span>${fmtDay(link.campaignWindow.startAt)} → ${fmtDay(link.campaignWindow.endAt)}</span></div>` : ''}
      ${analytics.checkpoint ? `<div class="ld-meta-row"><span class="ld-meta-k">Last change</span><span>${esc(checkpointText(analytics.checkpoint))}</span></div>` : ''}
    </div>
  </section>`;
}

function viewsCard(a) {
  if (!window.KortexViews) return '';
  return `<section class="ld-card ld-views">
    <div class="ld-card-head"><h4>The evidence</h4><span class="ld-h5-note">hours in ${esc(a.timeZone || 'UTC')}</span></div>
    ${window.KortexViews.viewsHtml('ld')}
  </section>`;
}

function render(payload) {
  const { link, analytics: a } = payload;
  // The timeline holds delivered and rescued scans only. A link whose every
  // scan was lost still has scans to plot, so it must not read as unscanned.
  const observed = a.totals?.observed ?? a.totals?.events ?? 0;
  const evidence = a.timeline.length
    ? `${renderRibbon(a.timeline, a.unique)}
       ${viewsCard(a)}
       <div class="ld-grid-2">${renderReach(a.unique, a.installs)}${renderRhythm(a.cadence)}</div>
       ${renderLatency(a.latency)}
       ${renderMatrix(a.breakdowns)}
       ${renderEveryScan(a)}`
    : observed
      ? `<section class="ld-card"><p class="ld-none">No useful visits: all ${esc(observed)} scan${observed === 1 ? '' : 's'} in this window were lost before reaching a destination. Every one is plotted below.</p></section>
         ${viewsCard(a)}`
      : `<section class="ld-card"><p class="ld-none">No scans recorded within the ${esc(a.window?.retentionDays || 30)}-day retention window.</p></section>`;
  return `<div class="ld-root">
    ${renderHeader(link, a)}
    <div class="ld-insights" id="ld-insights"></div>
    ${evidence}
    ${renderMeta(link, a)}
    ${renderLedger(a.totals, a.unavailable)}
  </div>`;
}

/* ── Action Center: a finding's CTA opens the edit form prefilled; a dismissal is a checkpoint ─*/
async function postCheckpoint(code, body) {
  const response = await apiFetch(linkPath(code, '/actions'), { method: 'POST', body: JSON.stringify(body) });
  return readJson(response, 'Could not record the checkpoint');
}

async function dismissFinding(code, finding, dismissed, container) {
  try {
    const what = finding.action ? { type: finding.action.type } : { key: finding.key };
    if (!(await postCheckpoint(code, { ...what, applied: false, dismissed }))) return;
    utils.showToast(`Dismissed "${finding.title}" — ${words(dismissed)}.`, 'info', 3500);
    await showLinkDetail(code, container);
  } catch (err) { utils.showToast(err.message, 'error', 4000); }
}

/** A CTA button opens the edit form with the finding's proposal typed in (REQUEST_REVIEW renders as a link to the appeal page instead). */
function openFindingAction(code, finding) {
  STATE.prefill = { code, action: finding.action };
  STATE.editingCode = code;
  router.navigate('create', code);
}

function mountActionCenter(payload, container, code) {
  const V = window.KortexViews;
  const box = document.getElementById('ld-insights');
  if (!V || !box) return;
  V.renderActionCenter(box, payload.analytics, {
    onAction: (finding, options) => (options && options.dismissed
      ? dismissFinding(code, finding, options.dismissed, container)
      : openFindingAction(code, finding))
  });
}

/** The five shared views (same code as kaayko.com/kortex): delivered and rescued points plus the lost ones. */
function mountViews(payload) {
  const V = window.KortexViews;
  const a = payload.analytics, link = payload.link || {};
  if (!V || !Array.isArray(a.points) || !document.getElementById('ld-views')) return;
  const points = a.points.map(p => V.ptOf(p, false));
  const lostPoints = (a.outcomes && Array.isArray(a.outcomes.points) ? a.outcomes.points : []).map(V.ptOfLost);
  V.mountViews('ld', {
    points, lostPoints, hasCode: false, uniquePeople: a.unique ? a.unique.distinctVisitors : null,
    windowRows: link.schedule ? V.tallyOf(points, 'win').map(r => ({ ...r, value: r.value === '—' ? 'day address' : 'night address' })) : null,
    skyTitle: 'Every scan, as a star',
    mapTitle: 'Where each scan went'
  });
}

/* ── Sharing v2: the address is returned once, then only its state is known ─*/
const SHARE_REQUESTS = {
  mint: { method: 'POST', suffix: '/share' },
  rotate: { method: 'POST', suffix: '/share/rotate' },
  revoke: { method: 'DELETE', suffix: '/share' }
};
const SHARE_CONFIRMS = {
  rotate: 'Rotate the share link? The current address stops working immediately.',
  revoke: 'Stop sharing? The public address stops working immediately.'
};

async function changeSharing(code, kind) {
  const { method, suffix } = SHARE_REQUESTS[kind];
  const response = await apiFetch(linkPath(code, suffix), { method, ...(method === 'POST' && { body: '{}' }) });
  return readJson(response, 'Could not change sharing');
}

function showShareUrl(shareUrl, expiresAt) {
  ui.showModal('Shared report address', `
    <p class="ld-share-note">This address is shown once — copy it now; Kortex keeps only a fingerprint of it. Anyone holding it can read this one report until ${expiresAt ? esc(fmtDay(expiresAt)) : 'you stop sharing'}.</p>
    <div class="ld-share-box"><code id="ld-share-url">${esc(shareUrl)}</code><button type="button" class="btn btn-primary" id="ld-share-copy">Copy</button></div>
    <div class="ld-share-actions"><button type="button" class="btn btn-secondary" id="ld-share-done">Done</button></div>`);
  document.getElementById('ld-share-copy').addEventListener('click', () => utils.copyToClipboard(shareUrl, 'Report address copied'));
  document.getElementById('ld-share-done').addEventListener('click', ui.closeModal);
}

async function onShareClick(code, kind, container) {
  if (SHARE_CONFIRMS[kind] && !window.confirm(SHARE_CONFIRMS[kind])) return;
  const buttons = container.querySelectorAll('[data-ld-share]');
  buttons.forEach(b => { b.disabled = true; });
  try {
    const data = await changeSharing(code, kind);
    if (!data) return;
    if (kind === 'revoke') utils.showToast('Sharing stopped; the public address no longer works.', 'success', 5000);
    else showShareUrl(data.shareUrl, data.expiresAt);
    await showLinkDetail(code, container);
  } catch (err) {
    utils.showToast(err.message, 'error', 4000);
    buttons.forEach(b => { b.disabled = false; });
  }
}

/* ── Per-link CSV: the click events inside the plan window, as a file ─*/
async function downloadCsv(code, button) {
  button.disabled = true; button.textContent = 'Preparing…';
  try {
    const r = await apiFetch(linkPath(code, '/clicks.csv'));
    if (!r || !r.ok) throw new Error(r && r.status === 429 ? 'Too many exports for now.' : 'Export failed.');
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `kortex-${code}-clicks.csv`; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    button.textContent = 'Downloaded';
  } catch (e) { button.textContent = e.message; }
  setTimeout(() => { button.disabled = false; button.textContent = 'Download CSV'; }, 2200);
}

/** A shared-module failure must not take the evidence cards or the toolbar down with it. */
function mountGuarded(label, mount) {
  try { mount(); } catch (e) { console.warn(`[LinkDetail] ${label} failed:`, e); }
}

function bindBack(container) {
  const back = container.querySelector('[data-ld-back]');
  if (back) back.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else router.navigate('links', null, { replace: true });
  });
}
function bindToolbar(container, code) {
  bindBack(container);
  const csv = container.querySelector('[data-ld-csv]');
  if (csv) csv.addEventListener('click', () => downloadCsv(code, csv));
  container.querySelectorAll('[data-ld-share]').forEach(btn => btn.addEventListener('click', () => onShareClick(code, btn.dataset.ldShare, container)));
}

export async function showLinkDetail(code, container) {
  container.innerHTML = `<div class="ld-loading">Loading ${esc(code)}…</div>`;
  try {
    const response = await apiFetch(`/kortex/links/${encodeURIComponent(code)}/analytics?tz=${encodeURIComponent(utils.browserTz())}`);
    const payload = await readJson(response, 'Could not load analytics');
    if (!payload) return;
    container.innerHTML = render(payload);
    mountGuarded('action center', () => mountActionCenter(payload, container, code));
    mountGuarded('shared views', () => mountViews(payload));
    bindToolbar(container, code);
  } catch (err) {
    container.innerHTML = `<div class="ld-root">
      <button type="button" class="ld-back" data-ld-back>← Back</button>
      <p class="ld-caveat">Could not load analytics for ${esc(code)}: ${esc(err.message)}</p></div>`;
    bindBack(container);
  }
}

/** Routed view entry: link code arrives via #/links/<code> as STATE.routeParam. */
export async function init(state) {
  const container = document.querySelector('#link-detail-content');
  if (!container) return;
  const code = state?.routeParam;
  if (!code) { router.navigate('links', null, { replace: true }); return; }
  await showLinkDetail(code, container);
}
