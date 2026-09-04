/**
 * Analytics view — portfolio, from the real click_events stream.
 *
 * This used to sum link.clickCount counters client-side and group by weak
 * fields. It now reads GET /kortex/analytics/portfolio, which aggregates the
 * actual events, and renders with the same honesty rules as the per-link
 * drilldown: uncertainty is a range, the counter-vs-events drift is stated,
 * and unmeasured metrics get a hatched ledger rather than a fake zero.
 *
 * @module views/analytics/analytics
 */

import * as utils from '../../js/utils.js';
import { apiFetch } from '../../js/config.js';
import * as router from '../../js/router.js';

/** Hover copy for a mark; the shared tip layer reads [data-tip]. */
const tip = (title, body) => `data-tip="<b>${esc(title)}</b>${body ? ` · ${esc(body)}` : ''}"`;

const esc = (v) => utils.escapeHtml(String(v ?? ''));
const RELIABILITY_ISO = '2026-08-17';

export async function init() {
  // Portfolio "Export CSV": every link in this tenant, as a file.
  const exportBtn = document.querySelector('#analytics-view [data-export-links]');
  if (exportBtn && !exportBtn.dataset.bound) { exportBtn.dataset.bound = '1'; exportBtn.addEventListener('click', () => window.exportAnalyticsCSV()); }
  window.exportAnalyticsCSV = async () => {
    const btn = document.querySelector('#analytics-view .export-btn');
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }
    try {
      const res = await apiFetch('/kortex/export/links.csv');
      if (!res || !res.ok) throw new Error(res && res.status === 429 ? 'Too many exports for now.' : 'Export failed.');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'kortex-links.csv'; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      if (btn) btn.textContent = 'Downloaded';
    } catch (err) {
      if (btn) btn.textContent = err.message;
    } finally {
      setTimeout(() => { if (btn) { btn.disabled = false; btn.innerHTML = old; } }, 2200);
    }
  };
  // The retained window is fixed (30 days of events); the old tier-gated range
  // buttons filtered on a range this data doesn't honor, so hide them rather
  // than imply a filter that isn't applied.
  document.querySelectorAll('.analytics-range, .range-btn').forEach((el) => {
    const bar = el.closest('.analytics-range') || el;
    if (bar) bar.style.display = 'none';
  });
  await load();
}

async function load() {
  const container = document.getElementById('analytics-content');
  if (!container) return;
  container.innerHTML = '<div data-portfolio><div class="pf-loading">Loading portfolio…</div></div>';
  await loadPortfolio(container.querySelector('[data-portfolio]'));
}

/** GET a Kortex JSON endpoint; null when apiFetch logged out on a 401. */
async function fetchJson(path) {
  const res = await apiFetch(path);
  if (!res) return null;
  const data = await res.json();
  if (!res.ok || !data?.success) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

async function loadPortfolio(el) {
  if (!el) return;
  try {
    const payload = await fetchJson('/kortex/analytics/portfolio');
    if (!payload) return;
    el.innerHTML = render(payload.analytics);
    attachDrilldown(el);
    if (window.KortexViews) window.KortexViews.attachTips(el);
  } catch (err) {
    el.innerHTML = `<div class="pf-error">Couldn't load analytics: ${esc(err.message)}</div>`;
  }
}

function attachDrilldown(container) {
  const open = (code) => code && router.navigate('link-detail', code);
  container.querySelectorAll('[data-link-code]').forEach((row) => {
    row.addEventListener('click', () => open(row.dataset.linkCode));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(row.dataset.linkCode); }
    });
  });
}

/* ── timeline ribbon (portfolio) ───────────────────────────────────────────*/
function ribbon(timeline, unique) {
  if (!timeline.length) return '';
  const W = 900, H = 190, padL = 34, padR = 12, padT = 14, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB, n = timeline.length;
  const step = iw / n, bw = Math.max(2, Math.min(22, step * 0.62));
  const maxC = Math.max(...timeline.map((d) => d.clicks), 1);
  const yC = (v) => padT + ih - (v / maxC) * ih;
  const bIdx = timeline.findIndex((d) => d.date >= RELIABILITY_ISO);
  const hasB = bIdx > 0 && bIdx < n;
  const bx = bIdx >= 0 ? padL + step * bIdx : null;
  const grid = [0, Math.ceil(maxC / 2), maxC].map((v) => {
    const yy = yC(v);
    return `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${W - padR}" y2="${yy.toFixed(1)}" stroke="var(--grid-tick)"/><text x="${padL - 6}" y="${(yy + 3).toFixed(1)}" text-anchor="end" class="pf-tick">${v}</text>`;
  }).join('');
  const est = hasB ? `<rect x="${padL}" y="${padT}" width="${(bx - padL).toFixed(1)}" height="${ih}" fill="url(#pfHatch)" opacity="0.5"/>` : '';
  const cols = timeline.map((d, i) => {
    if (!d.clicks) return '';
    const x = padL + step * i + (step - bw) / 2;
    const visitors = d.uniqueVisitors == null ? '' : `, ${d.uniqueVisitors} distinct visitor${d.uniqueVisitors === 1 ? '' : 's'}`;
    return `<rect x="${x.toFixed(1)}" y="${yC(d.clicks).toFixed(1)}" width="${bw.toFixed(1)}" height="${(ih - (yC(d.clicks) - padT)).toFixed(1)}" rx="1.5" fill="var(--gold-primary)" ${tip(d.date, `${d.clicks} scan${d.clicks === 1 ? '' : 's'}${visitors}`)}/>`;
  }).join('');
  const pts = timeline.map((d, i) => `${(padL + step * i + step / 2).toFixed(1)},${yC(d.uniqueVisitors || 0).toFixed(1)}`);
  const split = hasB ? bIdx : 0;
  const dotted = pts.slice(0, Math.max(1, split + 1)).join(' ');
  const solid = pts.slice(split).join(' ');
  const vline = `${split > 0 ? `<polyline points="${dotted}" fill="none" stroke="var(--data-visitor)" stroke-width="1.4" stroke-dasharray="2 3" opacity="0.7"/>` : ''}${solid.split(' ').length > 1 ? `<polyline points="${solid}" fill="none" stroke="var(--data-visitor)" stroke-width="1.8"/>` : ''}`;
  const nearRight = bx != null && bx > padL + iw * 0.68;
  const bMark = hasB ? `<line x1="${bx.toFixed(1)}" y1="${padT - 4}" x2="${bx.toFixed(1)}" y2="${padT + ih}" stroke="var(--gold-dark)" stroke-width="1" stroke-dasharray="3 3"/><text x="${(nearRight ? bx - 5 : bx + 5).toFixed(1)}" y="${padT + 6}" text-anchor="${nearRight ? 'end' : 'start'}" class="pf-note-svg">attribution begins</text>` : '';
  const days = [0, Math.floor(n / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
  const xl = days.map((i) => `<text x="${(padL + step * i + step / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle" class="pf-tick">${esc(timeline[i].date.slice(5))}</text>`).join('');
  return `<section class="pf-card pf-card-hero">
    <div class="pf-card-head"><h4>Scans across all links</h4><span class="pf-legend"><i class="sw-gold"></i>scans <i class="sw-visitor"></i>distinct visitors</span></div>
    <svg viewBox="0 0 ${W} ${H}" class="pf-svg" preserveAspectRatio="none" role="img" aria-label="Portfolio scans per day">
      <defs><pattern id="pfHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--data-void)" stroke-width="3"/></pattern></defs>
      ${est}${grid}${cols}${vline}${bMark}${xl}
    </svg>
    ${!unique?.reliable ? `<p class="pf-caveat">Visitors before ${RELIABILITY_ISO} can't be attributed — hatched region, dotted line. Only the solid segment is counted.</p>` : ''}
  </section>`;
}

/* ── KPI strip ─────────────────────────────────────────────────────────────*/
function kpis(a) {
  const t = a.totals || {}, u = a.unique;
  const visitors = u ? (u.reliable ? esc(u.distinctVisitors) : `${esc(u.lowerBound)}–${esc(u.upperBound)}`) : '—';
  const item = (val, lbl, hero, why) => `<div class="pf-kpi${hero ? ' pf-kpi-hero' : ''}" ${tip(lbl, why)}><span class="pf-kpi-val">${val}</span><span class="pf-kpi-lbl">${lbl}</span></div>`;
  return `<section class="pf-kpis">
    ${item(esc(t.events ?? 0), 'scans measured', true, `events retained in the last ${esc(a.window?.retentionDays ?? 30)} days, not lifetime counters`)}
    ${item(esc(t.activeLinks ?? 0), 'active links', false, 'links that took at least one scan in this window')}
    ${item(esc(t.dormantLinks ?? 0), 'dormant links', false, 'live links that took no scan in this window')}
    ${item(visitors, u?.reliable ? 'distinct visitors' : 'visitors (range)', false, u?.reliable ? 'estimated from visitor keys' : 'part of the window predates visitor keys, so this is a range')}
    ${item(esc(a.window?.daysWithTraffic ?? 0), 'days with traffic', false, 'days in the window with at least one scan')}
  </section>`;
}

/* ── top links (real event counts, drillable) ──────────────────────────────*/
function topLinks(rows) {
  if (!rows.length) return '';
  const max = Math.max(...rows.map((r) => r.clicks), 1);
  const total = rows.reduce((sum, r) => sum + r.clicks, 0);
  return `<section class="pf-card">
    <div class="pf-card-head"><h4>Most-scanned links</h4><span class="pf-legend">hover for the share · open a row for the full report</span></div>
    <div class="pf-toplinks">
      ${rows.map((r, i) => `
        <div class="pf-link-row" data-link-code="${esc(r.code)}" role="button" tabindex="0" ${tip(r.title, `${r.clicks} of ${total} scans (${Math.round((r.clicks / Math.max(1, total)) * 100)}%) · open for the full report`)}>
          <span class="pf-rank">${i + 1}</span>
          <span class="pf-link-name"><b>${esc(r.title)}</b><span class="pf-link-sub">${esc(r.code)}${r.campaign ? ` · ${esc(r.campaign)}` : ''}</span></span>
          <span class="pf-link-bar"><span class="pf-link-fill${i === 0 ? ' is-lead' : ''}" style="width:${Math.round((r.clicks / max) * 100)}%"></span></span>
          <span class="pf-link-clicks">${esc(r.clicks)}</span>
          <span class="pf-status ${r.enabled ? 'is-live' : 'is-paused'}">${r.enabled ? 'Live' : 'Paused'}</span>
        </div>`).join('')}
    </div>
  </section>`;
}

/* ── campaigns (real rollup) ───────────────────────────────────────────────*/
function campaigns(rows) {
  if (!rows.length) return '';
  const max = Math.max(...rows.map((r) => r.clicks), 1);
  const onlyUnassigned = rows.length === 1 && rows[0].campaignId === null;
  return `<section class="pf-card">
    <div class="pf-card-head"><h4>Campaigns</h4></div>
    ${rows.map((r, i) => `
      <div class="pf-facet-row" ${tip(r.name, `${r.clicks} scans across ${r.links} link${r.links === 1 ? '' : 's'}`)}>
        <span class="pf-facet-key">${esc(r.name)}<span class="pf-facet-sub"> ${esc(r.links)} link${r.links === 1 ? '' : 's'}</span></span>
        <span class="pf-facet-track"><span class="pf-facet-fill${i === 0 && !onlyUnassigned ? ' is-lead' : ''}" style="width:${Math.round((r.clicks / max) * 100)}%"></span></span>
        <span class="pf-facet-num">${esc(r.clicks)}</span>
      </div>`).join('')}
    ${onlyUnassigned ? '<p class="pf-note">No links are tagged to a campaign yet — this is one bucket, not a comparison.</p>' : ''}
  </section>`;
}

/* ── source matrix ─────────────────────────────────────────────────────────*/
function facet(title, rows, total) {
  if (!rows || !rows.length || rows.every((r) => r.value === null)) {
    return `<div class="pf-facet"><h5>${esc(title)}</h5><p class="pf-none">not reported</p></div>`;
  }
  const max = Math.max(...rows.map((r) => r.clicks));
  const shown = total || rows.reduce((sum, r) => sum + r.clicks, 0);
  return `<div class="pf-facet"><h5>${esc(title)}</h5>
    ${rows.slice(0, 6).map((r, i) => `<div class="pf-facet-row" ${tip(r.value === null ? 'none reported' : String(r.value), `${r.clicks} of ${shown} scans (${Math.round((r.clicks / Math.max(1, shown)) * 100)}%)`)}>
      <span class="pf-facet-key">${r.value === null ? '<em>none</em>' : esc(r.value)}</span>
      <span class="pf-facet-track"><span class="pf-facet-fill${i === 0 ? ' is-lead' : ''}" style="width:${Math.round((r.clicks / max) * 100)}%"></span></span>
      <span class="pf-facet-num">${esc(r.clicks)}</span></div>`).join('')}
  </div>`;
}
function matrix(b, total) {
  return `<section class="pf-card">
    <div class="pf-card-head"><h4>Where scans came from</h4></div>
    <div class="pf-matrix">
      ${facet('Device', b.deviceType, total)}
      ${facet('OS', b.os, total)}
      ${facet('Browser', b.browser, total)}
      ${facet('Platform', b.platform, total)}
      ${facet('Destination', b.destination, total)}
      ${facet('Referrer', b.referrer, total)}
      ${b.country ? facet('Country', b.country, total) : ''}
    </div>
  </section>`;
}

/* ── not-measured ledger ───────────────────────────────────────────────────*/
function ledger(totals, unavailable) {
  const rows = [];
  if (totals && totals.counterSum != null) {
    rows.push(`<div class="pf-ledger-row"><span class="pf-ledger-hatch"></span><span class="pf-ledger-key">Events retained vs lifetime counters</span><span class="pf-ledger-val">${esc(totals.events)} / ${esc(totals.counterSum)}</span></div>`);
    if (totals.driftNote) rows.push(`<p class="pf-ledger-note">${esc(totals.driftNote)}</p>`);
    if (totals.orphanCodes) rows.push(`<div class="pf-ledger-row"><span class="pf-ledger-hatch"></span><span class="pf-ledger-key">Events for deleted links</span><span class="pf-ledger-val">${esc(totals.orphanCodes)}</span></div>`);
  }
  for (const u of (unavailable || [])) {
    rows.push(`<div class="pf-ledger-row"><span class="pf-ledger-hatch"></span><span class="pf-ledger-key">${esc(u.metric)}</span><span class="pf-ledger-val pf-ledger-void">not measured</span></div><p class="pf-ledger-note">${esc(u.reason)}</p>`);
  }
  if (!rows.length) return '';
  return `<section class="pf-card pf-card-ledger">
    <div class="pf-card-head"><h4>What this view is <em>not</em> telling you</h4></div>${rows.join('')}
  </section>`;
}

function render(a) {
  if (!a || !a.timeline?.length) {
    return `<div class="pf-root">${kpis(a || { totals: {}, window: {} })}
      <section class="pf-card"><p class="pf-none">No scan events retained in the ${esc(a?.window?.retentionDays || 30)}-day window yet.</p></section>
      ${ledger(a?.totals, a?.unavailable)}</div>`;
  }
  return `<div class="pf-root">
    ${kpis(a)}
    ${ribbon(a.timeline, a.unique)}
    ${topLinks(a.topLinks)}
    ${campaigns(a.campaigns)}
    ${matrix(a.breakdowns, a.totals.events)}
    ${ledger(a.totals, a.unavailable)}
  </div>`;
}
