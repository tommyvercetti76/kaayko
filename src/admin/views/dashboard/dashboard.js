/**
 * Dashboard — triage, not vanity.
 *
 * One question at sign-in: where do the next ten minutes go? The answer is the
 * work queue, ordered by recoverable lost scans, over the same canonical
 * numbers the wanderer dashboard and the per-link drilldown use
 * (GET /kortex/workspace/analytics). Lifetime counters and campaign shortcuts
 * lived here before and answered nothing.
 *
 * @module views/dashboard/dashboard
 */

import { apiFetch } from '../../js/config.js';
import { escapeHtml, browserTz } from '../../js/utils.js';
import * as router from '../../js/router.js';

const esc = (v) => escapeHtml(String(v ?? ''));
const WORKSPACE_FINDING_KEYS = ['placementPerformance', 'safetyImpact', 'utmHealth', 'anomalies'];
const RECENT_LIMIT = 8;

export async function init() {
  await Promise.all([loadWorkspace(), loadRecentLinks()]);
}

/** GET a Kortex JSON endpoint; null when apiFetch handled a 401 by logging out. */
async function fetchJson(path) {
  const res = await apiFetch(path);
  if (!res) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ── the four numbers that decide what to do ──────────────────────────────*/

function metricsHtml(data) {
  const rows = data.links || [];
  const sum = (key) => rows.reduce((total, row) => total + (row[key] || 0), 0);
  const observed = sum('observed'), useful = sum('useful'), lost = sum('lost'), rescued = sum('rescued');
  const rate = observed ? Math.round((useful / observed) * 100) : 0;
  const recoverable = sum('recoverableLost');
  const metric = (value, label, tip, modifier) =>
    `<div class="dash-metric${modifier ? ` is-${modifier}` : ''}" data-tip="${esc(tip)}"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
  return [
    metric(useful, 'Useful visits', 'Scans that reached a page you chose, including fallbacks.', 'good'),
    metric(lost, 'Lost', 'Scans that reached no page: paused, held, blocked, past the end date or over the cap.', lost ? 'bad' : ''),
    metric(rescued, 'Rescued', 'Scans a fallback address caught after a cap or an end date.', ''),
    metric(`${rate}%`, 'Useful rate', 'Useful visits as a share of every scan observed in the window.', ''),
    metric(recoverable, 'Recoverable', 'Lost scans with a fix you can apply today. The queue is sorted by this.', recoverable ? 'bad' : '')
  ].join('');
}

async function loadWorkspace() {
  const metrics = document.getElementById('dash-metrics');
  const queue = document.getElementById('dash-queue');
  const note = document.getElementById('dash-queue-note');
  const windowChip = document.getElementById('dash-window');
  if (!queue) return;
  try {
    const data = await fetchJson(`/kortex/workspace/analytics?tz=${encodeURIComponent(browserTz())}`);
    if (!data) return;
    if (windowChip) windowChip.textContent = `${data.window?.days ?? '—'}-day window · ${data.window?.timeZone || 'UTC'}`;
    if (metrics) metrics.innerHTML = metricsHtml(data);
    if (note) note.textContent = `${(data.links || []).length} links · sorted by recoverable lost scans`;

    const views = window.KortexViews;
    if (!views) { queue.innerHTML = '<p class="dash-none">The shared views did not load.</p>'; return; }
    views.renderWorkspaceQueue(queue, data, { onOpen: (code) => router.navigate('link-detail', code) });
    if (data.droppedLinks) {
      queue.insertAdjacentHTML('beforeend', `<p class="dash-none">${data.droppedLinks} more link${data.droppedLinks === 1 ? '' : 's'} not shown. All Links has the rest.</p>`);
    }
    renderFindings(data.insights, views);
    if (metrics) views.attachTips(metrics);
  } catch (err) {
    if (note) note.textContent = 'unavailable';
    queue.innerHTML = `<p class="dash-none">Could not read the workspace: ${esc(err.message)}</p>`;
  }
}

function renderFindings(insights, views) {
  const card = document.getElementById('dash-findings-card');
  const box = document.getElementById('dash-findings');
  if (!card || !box) return;
  const present = insights && WORKSPACE_FINDING_KEYS.some((key) => insights[key]);
  card.hidden = !present;
  if (present) views.renderInsights(box, insights, { keys: WORKSPACE_FINDING_KEYS, compact: true });
}

/* ── recently created: a way in, not a report ─────────────────────────────*/

async function loadRecentLinks() {
  const container = document.getElementById('dashboard-recent-links');
  if (!container) return;
  try {
    const res = await apiFetch('/kortex?limit=50');
    if (!res) return;
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const links = (await res.json()).links || [];
    if (!links.length) { container.innerHTML = '<p class="dash-none">No links yet.</p>'; return; }
    const recent = links.slice(0, RECENT_LIMIT);
    container.innerHTML = `<div class="dash-recent">${recent.map(rowHtml).join('')}</div>`;
    container.querySelectorAll('[data-link-code]').forEach((row) => {
      const open = () => router.navigate('link-detail', row.dataset.linkCode);
      row.addEventListener('click', open);
      row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  } catch (err) {
    container.innerHTML = `<p class="dash-none">Could not load links: ${esc(err.message)}</p>`;
  }
}

function rowHtml(link) {
  const code = link.code || link.id || '';
  const live = link.enabled !== false && (!link.status || link.status === 'active');
  const state = link.status === 'held' ? 'Under review' : link.status === 'blocked' ? 'Blocked' : live ? 'Live' : 'Paused';
  return `<div class="dash-recent-row" data-link-code="${esc(code)}" role="button" tabindex="0" aria-label="Open ${esc(code)}">
    <span class="dash-recent-name"><b>${esc(link.title || code)}</b><span class="mono">${esc(code)}</span></span>
    <span class="dash-recent-clicks">${esc(link.clickCount || 0)}</span>
    <span class="dash-recent-state${live ? ' is-live' : ''}">${esc(state)}</span>
  </div>`;
}
