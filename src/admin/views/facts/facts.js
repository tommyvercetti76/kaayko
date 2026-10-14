/**
 * Facts review — the owner's queue between official data feeds and the public
 * "Know before you go" panel.
 *
 * Built 13 Oct 2026 after 120 AI-written facts were published without review.
 * A daily job (kaayko-api scheduled/spotSourcesRefresh.js) reads the National
 * Park Service API and queues only what changed; nothing reaches a page until
 * it is approved here.
 *
 *   GET  /paddlingOut/admin/fact-proposals?status=pending|approved|rejected|superseded
 *   POST /paddlingOut/admin/fact-proposals/:id/approve   { as?: 'closure' }
 *   POST /paddlingOut/admin/fact-proposals/:id/reject    { note? }
 *
 * SECURITY: feed text is untrusted. Every value is escaped; links must be https.
 */

import { apiFetch } from '../../js/config.js';
import { escapeHtml, jsAttr, showSuccess, showError } from '../../js/utils.js';

const TABS = [
  { key: 'pending', label: 'To review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'superseded', label: 'Replaced' }
];
const FIELD = { fees: 'Fees', hazards: 'Notice', status: 'Closure', permits: 'Permits', parking: 'Parking', launch: 'Put-in' };
const PROVIDER = { nps: 'National Park Service' };

let current = 'pending';
let listEl = null;
let metaEl = null;
let tabsEl = null;

export async function init() {
  const container = document.getElementById('facts-view');
  if (!container) return;
  current = 'pending';
  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Facts review</h1>
        <p class="view-subtitle">What official sources say about your spots. Nothing here is on the site until you approve it.</p>
      </div>
      <button type="button" class="btn btn-secondary" id="facts-refresh">Refresh</button>
    </header>
    <div class="card fr-card">
      <div class="fr-meta" id="fr-meta"></div>
      <div class="submissions-tabs" id="fr-tabs"></div>
      <div class="fr-list" id="fr-list"><div class="loading">Loading…</div></div>
    </div>`;
  listEl = container.querySelector('#fr-list');
  metaEl = container.querySelector('#fr-meta');
  tabsEl = container.querySelector('#fr-tabs');
  container.querySelector('#facts-refresh').addEventListener('click', load);
  tabsEl.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    current = t.dataset.tab;
    load();
  });
  listEl.addEventListener('click', onAction);
  await load();
}

async function load() {
  renderTabs();
  listEl.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const res = await apiFetch(`/paddlingOut/admin/fact-proposals?status=${encodeURIComponent(current)}`);
    if (!res) return;
    if (!res.ok) throw new Error(`Failed to load (${res.status})`);
    const data = await res.json();
    renderMeta(data.lastRun);
    render(Array.isArray(data.proposals) ? data.proposals : []);
    if (current === 'pending') setBadge(data.proposals.length);
  } catch (err) {
    listEl.innerHTML = `<div class="submissions-error">${escapeHtml(err.message)}</div>`;
  }
}

function renderTabs() {
  tabsEl.innerHTML = TABS.map(t =>
    `<button type="button" class="submissions-tab${t.key === current ? ' active' : ''}" data-tab="${t.key}">${escapeHtml(t.label)}</button>`).join('');
}

function renderMeta(run) {
  if (!run) { metaEl.textContent = 'The daily check has not run yet.'; return; }
  const when = run.atIso ? new Date(run.atIso).toLocaleString() : '';
  const errs = Array.isArray(run.errors) && run.errors.length
    ? ` <span class="fr-err">Problems: ${escapeHtml(run.errors.join('; '))}</span>` : '';
  metaEl.innerHTML = `Last checked ${escapeHtml(when)} · ${escapeHtml(String(run.created || 0))} new${errs}`;
}

const safeUrl = (u) => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : '');

function factBlock(label, f) {
  if (!f) return `<div class="fr-fact fr-fact--empty"><span class="fr-label">${escapeHtml(label)}</span><span class="fr-none">Nothing shown on the site</span></div>`;
  const url = safeUrl(f.source);
  let host = '';
  try { host = url ? new URL(url).hostname : ''; } catch (_) { host = ''; }
  return `<div class="fr-fact">
    <span class="fr-label">${escapeHtml(label)}</span>
    <p class="fr-summary">${escapeHtml(f.summary || '')}</p>
    <p class="fr-src">${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(host)} ↗</a>` : 'no source'}
      · ${f.official === false ? '<span class="fr-unofficial">not official</span>' : 'official'}
      · checked ${escapeHtml(f.checked || '?')}${f.provider ? '' : ' · <span class="fr-unofficial">AI research, 3 Oct, unreviewed</span>'}</p>
  </div>`;
}

function card(p) {
  const kind = p.kind === 'remove' ? 'Remove' : (p.current ? 'Update' : 'New');
  const closure = p.category === 'Park Closure';
  const actions = p.status === 'pending' ? `<div class="sub-actions">
      <button type="button" class="btn btn-success" data-act="approve" data-id="${jsAttr(p.id)}">${p.kind === 'remove' ? 'Approve removal' : 'Approve'}</button>
      ${closure ? `<button type="button" class="btn btn-secondary" data-act="closure" data-id="${jsAttr(p.id)}">Approve as closure</button>` : ''}
      <button type="button" class="btn btn-danger" data-act="reject" data-id="${jsAttr(p.id)}">Reject</button>
    </div>` : `<p class="fr-decided">${escapeHtml(p.status)}${p.approvedAs === 'closure' ? ' as closure' : ''}${p.decidedBy ? ` by ${escapeHtml(p.decidedBy)}` : ''}${p.note ? ` · “${escapeHtml(p.note)}”` : ''}</p>`;
  return `<article class="fr-item" data-id="${jsAttr(p.id)}">
    <div class="fr-head">
      <h3>${escapeHtml(p.title || p.spotId)}</h3>
      <span class="badge badge-info">${escapeHtml(FIELD[p.field] || p.field)}</span>
      <span class="badge ${kind === 'Remove' ? 'badge-error' : 'badge-warning'}">${escapeHtml(kind)}</span>
      ${closure ? '<span class="badge badge-error">NPS calls this a closure</span>' : ''}
      <span class="fr-prov">${escapeHtml(PROVIDER[p.provider] || p.provider || '')}</span>
    </div>
    <div class="fr-compare">
      ${p.kind === 'remove' ? factBlock('On the site now (source withdrew it)', p.current) : factBlock('Source says', p.proposed)}
      ${p.kind === 'remove' ? '' : factBlock('On the site now', p.current)}
    </div>
    ${closure && p.status === 'pending' ? '<p class="fr-hint">“Approve” shows it as a notice. “Approve as closure” hides the Paddle Score on every page until it is removed. Use it only if the water itself is closed.</p>' : ''}
    ${actions}
  </article>`;
}

function render(items) {
  if (!items.length) {
    listEl.innerHTML = `<div class="submissions-empty">${current === 'pending' ? 'Nothing to review. Official sources match what is on the site.' : 'None yet.'}</div>`;
    return;
  }
  listEl.innerHTML = items.map(card).join('');
}

async function onAction(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;
  let body = {};
  let path = 'approve';
  if (act === 'reject') {
    const note = window.prompt('Why reject? (optional)');
    if (note === null) return;
    body = note.trim() ? { note: note.trim() } : {};
    path = 'reject';
  } else if (act === 'closure') {
    if (!window.confirm('Close this water? Its Paddle Score will be hidden everywhere until the closure is removed.')) return;
    body = { as: 'closure' };
  }
  const item = btn.closest('.fr-item');
  item.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try {
    const res = await apiFetch(`/paddlingOut/admin/fact-proposals/${encodeURIComponent(id)}/${path}`, { method: 'POST', body: JSON.stringify(body) });
    if (!res) return;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
    showSuccess(path === 'reject' ? 'Rejected. It will not come back unless the source changes.' : 'Approved. It is on the site now.');
    item.remove();
    const left = listEl.querySelectorAll('.fr-item').length;
    if (current === 'pending') setBadge(left);
    if (!left) render([]);
  } catch (err) {
    showError(err.message);
    item.querySelectorAll('button').forEach(b => { b.disabled = false; });
  }
}

function setBadge(n) {
  const b = document.getElementById('facts-badge');
  if (!b) return;
  b.textContent = n > 0 ? String(n) : '';
  b.hidden = !(n > 0);
}
