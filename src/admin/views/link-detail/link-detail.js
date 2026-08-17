/**
 * Per-link drill-down.
 *
 * Renders exactly what GET /kortex/links/:code/analytics measured, and nothing
 * else. Rules this module holds to:
 *
 *  - A metric the backend reports as unavailable is shown as unavailable with
 *    its reason. It is never drawn as a zero, an empty bar, or a dash.
 *  - Visitor counts carry their coverage. Where attribution is incomplete the
 *    range is shown, not the flattering end of it.
 *  - Days with no traffic stay in the timeline. For a printed QR code, silence
 *    is the finding.
 *
 * @module views/analytics/link-detail
 */

import { apiFetch } from '../../js/config.js';
import * as router from '../../js/router.js';
import * as utils from '../../js/utils.js';

const esc = (v) => utils.escapeHtml(String(v ?? ''));

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function bar(count, max) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return `<span class="ld-bar"><span class="ld-bar-fill" style="width:${pct}%"></span></span>`;
}

function renderBreakdown(title, rows, total, emptyLabel) {
  if (!rows || !rows.length) {
    return `<div class="ld-block"><h4>${esc(title)}</h4>
      <p class="ld-none">${esc(emptyLabel || 'No data')}</p></div>`;
  }
  const max = Math.max(...rows.map(r => r.clicks));
  return `<div class="ld-block">
    <h4>${esc(title)}</h4>
    <table class="ld-table">
      ${rows.map(r => `
        <tr>
          <td class="ld-key">${r.value === null ? '<em>none</em>' : esc(r.value)}</td>
          <td class="ld-barcell">${bar(r.clicks, max)}</td>
          <td class="ld-num">${r.clicks}</td>
          <td class="ld-pct">${total ? Math.round((r.clicks / total) * 100) : 0}%</td>
        </tr>`).join('')}
    </table>
  </div>`;
}

function renderTimeline(timeline) {
  if (!timeline.length) return '';
  const max = Math.max(...timeline.map(d => d.clicks), 1);
  const quiet = timeline.filter(d => d.clicks === 0).length;
  return `<div class="ld-block">
    <h4>Clicks per day</h4>
    <div class="ld-timeline" role="img"
         aria-label="Daily clicks from ${esc(timeline[0].date)} to ${esc(timeline[timeline.length - 1].date)}">
      ${timeline.map(d => `
        <span class="ld-day${d.clicks === 0 ? ' is-zero' : ''}"
              title="${esc(d.date)}: ${d.clicks} click${d.clicks === 1 ? '' : 's'}">
          <span class="ld-day-fill" style="height:${Math.round((d.clicks / max) * 100)}%"></span>
        </span>`).join('')}
    </div>
    <div class="ld-timeline-axis">
      <span>${esc(timeline[0].date)}</span><span>${esc(timeline[timeline.length - 1].date)}</span>
    </div>
    ${quiet ? `<p class="ld-note">${quiet} of ${timeline.length} days saw no clicks at all.</p>` : ''}
  </div>`;
}

function renderUnique(unique) {
  if (!unique) return '';
  const exact = unique.reliable;
  return `<div class="ld-block">
    <h4>Distinct visitors</h4>
    <p class="ld-figure">
      ${exact ? esc(unique.distinctVisitors)
              : `${esc(unique.lowerBound)}–${esc(unique.upperBound)}`}
      <span class="ld-figure-unit">${exact ? 'confirmed' : 'range'}</span>
    </p>
    <p class="ld-sub">
      Attributed from ${esc(unique.basedOnEvents)} of ${esc(unique.ofTotalEvents)} events
      (${esc(unique.coveragePct)}% coverage)${
        unique.clicksPerVisitor ? ` · ${esc(unique.clicksPerVisitor)} clicks per visitor` : ''}
    </p>
    ${unique.caveat ? `<p class="ld-caveat">${esc(unique.caveat)}</p>` : ''}
  </div>`;
}

function renderMeta(link, analytics) {
  const utm = link.utm && Object.keys(link.utm).length
    ? Object.entries(link.utm).map(([k, v]) =>
        `<tr><td class="ld-key">${esc(k)}</td><td colspan="3">${esc(v)}</td></tr>`).join('')
    : `<tr><td colspan="4" class="ld-none">No UTM parameters set</td></tr>`;

  return `<div class="ld-block">
    <h4>Link</h4>
    <table class="ld-table ld-meta">
      <tr><td class="ld-key">Short URL</td><td colspan="3">${esc(link.shortUrl || '—')}</td></tr>
      <tr><td class="ld-key">Destination</td><td colspan="3">${esc(link.destination || '—')}</td></tr>
      <tr><td class="ld-key">Created</td><td colspan="3">${fmtDate(link.createdAt)} by ${esc(link.createdBy || 'unknown')}</td></tr>
      <tr><td class="ld-key">First click</td><td colspan="3">${fmtDate(analytics.window.firstEvent)}</td></tr>
      <tr><td class="ld-key">Last click</td><td colspan="3">${fmtDate(analytics.window.lastEvent)}</td></tr>
      ${utm}
    </table>
  </div>`;
}

function renderUnavailable(list) {
  if (!list || !list.length) return '';
  return `<div class="ld-block ld-unavailable">
    <h4>Not measured</h4>
    <ul>${list.map(u => `<li><strong>${esc(u.metric)}</strong> — ${esc(u.reason)}</li>`).join('')}</ul>
  </div>`;
}

function render(payload) {
  const { link, analytics } = payload;
  const t = analytics.totals;

  if (!analytics.timeline.length) {
    return `<div class="ld-root">
      <button class="ld-back" data-ld-back>← Back</button>
      <h3 class="ld-title">${esc(link.title || link.code)} <span class="ld-code">${esc(link.code)}</span></h3>
      ${renderUnavailable(analytics.unavailable)}
    </div>`;
  }

  return `<div class="ld-root">
    <button class="ld-back" data-ld-back>← Back</button>
    <h3 class="ld-title">${esc(link.title || link.code)} <span class="ld-code">${esc(link.code)}</span></h3>
    ${link.description ? `<p class="ld-desc">${esc(link.description)}</p>` : ''}

    <div class="ld-headline">
      <div><span class="ld-figure">${esc(t.events)}</span><span class="ld-label">clicks measured</span></div>
      <div><span class="ld-figure">${esc(analytics.window.daysWithTraffic)}</span><span class="ld-label">days with traffic</span></div>
      <div><span class="ld-figure">${esc(analytics.window.daysSpanned)}</span><span class="ld-label">days since first click</span></div>
    </div>
    ${t.driftNote ? `<p class="ld-caveat">${esc(t.driftNote)}</p>` : ''}

    ${renderTimeline(analytics.timeline)}
    ${renderUnique(analytics.unique)}
    ${renderBreakdown('Device', analytics.breakdowns.deviceType, t.events)}
    ${renderBreakdown('Operating system', analytics.breakdowns.os, t.events)}
    ${renderBreakdown('Browser', analytics.breakdowns.browser, t.events)}
    ${renderBreakdown('Referrer', analytics.breakdowns.referrer, t.events)}
    ${renderMeta(link, analytics)}
    ${renderUnavailable(analytics.unavailable)}
  </div>`;
}

/**
 * Standard view entry point. The link code arrives via the route
 * (#/links/<code>), which the core exposes as STATE.routeParam.
 */
export async function init(STATE) {
  const container = document.querySelector('#link-detail-content');
  if (!container) return;
  const code = STATE?.routeParam;
  if (!code) { router.navigate('links', null, { replace: true }); return; }
  await showLinkDetail(code, container);
}

/**
 * Fetch and render the drill-down for one link into `container`.
 * @param {string} code
 * @param {HTMLElement} container
 */
export async function showLinkDetail(code, container) {
  container.innerHTML = `<div class="loading">Loading ${esc(code)}…</div>`;
  try {
    // apiFetch resolves to the raw Response, or null when it has handled a 401
    // by logging out — in which case the page is already navigating away.
    const response = await apiFetch(`/kortex/links/${encodeURIComponent(code)}/analytics`);
    if (!response) return;
    const payload = await response.json();
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || `Request failed (${response.status})`);
    }
    container.innerHTML = render(payload);
  } catch (err) {
    container.innerHTML = `<div class="ld-root">
      <button class="ld-back" data-ld-back>← Back</button>
      <p class="ld-caveat">Could not load analytics for ${esc(code)}: ${esc(err.message)}</p>
    </div>`;
  }
  // Real history navigation: returns wherever the user actually came from
  // (All Links, Analytics, or a shared URL), instead of a guessed destination.
  const back = container.querySelector('[data-ld-back]');
  if (back) {
    back.addEventListener('click', () => {
      if (window.history.length > 1) window.history.back();
      else router.navigate('links', null, { replace: true });
    });
  }
}
