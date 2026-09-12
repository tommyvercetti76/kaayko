/**
 * Spots View Module — the Paddling Out catalogue.
 *
 * Every spot (curated and community, published, hidden, pending) with the
 * public-visibility verdict, photos, score-cache state and tags. Inline edit
 * via the shared spot editor; a publish toggle on `archived`.
 *
 * Endpoints (platform admin): GET /paddlingOut/admin/spots + the editor's.
 *
 * SECURITY: every field is user- or admin-authored and escaped; ids go through
 * jsAttr; photo URLs through safeImageUrl. One delegated listener, data-action.
 */

import { escapeHtml, jsAttr, showSuccess, showError } from '../../js/utils.js';
import { renderEditor, bindEditor, fetchSpots, patchSpot, safeImageUrl, DEFAULT_TAGS } from './spot-editor.js';

const FILTERS = [
  { key: 'all',       label: 'All',        match: () => true },
  { key: 'public',    label: 'Published',  match: (s) => s.isPublic },
  { key: 'hidden',    label: 'Hidden',     match: (s) => !s.isPublic },
  { key: 'community', label: 'Community',  match: (s) => s.communitySubmission },
  { key: 'noscore',   label: 'No score',   match: (s) => s.isPublic && !s.hasCachedScore },
];

let spots = [];
let tagLabels = DEFAULT_TAGS;
let filter = 'all';
let query = '';
let openId = null;

let listEl = null;
let tabsEl = null;
let countEl = null;
let searchEl = null;

export async function init(STATE) { // eslint-disable-line no-unused-vars
  const container = document.getElementById('spots-view');
  if (!container) return;
  filter = 'all'; query = ''; openId = null; spots = [];

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Paddling Spots</h1>
        <p class="view-subtitle">Every lake, river and ramp in the catalogue. Edit copy, location, photos and tags; publish or hide.</p>
      </div>
      <button type="button" class="btn btn-secondary" id="spots-refresh">Refresh</button>
    </header>

    <div class="card spots-card">
      <div class="spots-toolbar">
        <div class="submissions-tabs" id="spots-tabs"></div>
        <input type="search" id="spots-search" class="spots-search" placeholder="Search name, place, id…" aria-label="Search spots">
      </div>
      <div class="submissions-count" id="spots-count"></div>
      <div class="spots-list" id="spots-list"><div class="loading">Loading spots…</div></div>
    </div>
  `;

  tabsEl = container.querySelector('#spots-tabs');
  countEl = container.querySelector('#spots-count');
  listEl = container.querySelector('#spots-list');
  searchEl = container.querySelector('#spots-search');

  tabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-filter]');
    if (!tab) return;
    filter = tab.dataset.filter || 'all';
    renderTabs(); renderList();
  });
  searchEl.addEventListener('input', () => { query = searchEl.value.trim().toLowerCase(); renderList(); });
  container.querySelector('#spots-refresh').addEventListener('click', load);

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'toggle-edit') toggleEdit(id);
    else if (btn.dataset.action === 'publish') setPublished(id, true, btn);
    else if (btn.dataset.action === 'hide') setPublished(id, false, btn);
  });

  renderTabs();
  await load();
}

async function load() {
  if (listEl) listEl.innerHTML = '<div class="loading">Loading spots…</div>';
  try {
    const data = await fetchSpots();
    spots = Array.isArray(data.spots) ? data.spots : [];
    if (data.tags && typeof data.tags === 'object') tagLabels = data.tags;
    renderTabs(); renderList();
  } catch (err) {
    console.error('[Spots] load failed:', err);
    if (listEl) listEl.innerHTML = `<div class="submissions-error">${escapeHtml(err.message || 'Failed to load spots.')}</div>`;
  }
}

function renderTabs() {
  if (!tabsEl) return;
  tabsEl.innerHTML = FILTERS.map((f) => {
    const n = spots.filter(f.match).length;
    return `<button type="button" class="submissions-tab${f.key === filter ? ' active' : ''}" data-filter="${f.key}">`
      + `${escapeHtml(f.label)}<span class="submissions-tab-count">${n}</span></button>`;
  }).join('');
}

function visible() {
  const f = FILTERS.find(x => x.key === filter) || FILTERS[0];
  return spots.filter(f.match).filter(s => !query || [s.title, s.lakeName, s.city, s.region, s.country, s.id]
    .some(v => String(v || '').toLowerCase().includes(query)));
}

function renderList() {
  if (!listEl) return;
  const items = visible();
  if (countEl) countEl.textContent = `${items.length} spot${items.length === 1 ? '' : 's'}`;
  if (!items.length) { listEl.innerHTML = '<div class="submissions-empty">No spots match.</div>'; return; }
  listEl.innerHTML = items.map(row).join('');
  if (openId) mountEditor(openId);
}

function row(s) {
  const cover = s.images && s.images[0] ? safeImageUrl(s.images[0].url) : '';
  const place = [s.city, s.region, s.country].filter(Boolean).map(escapeHtml).join(', ') || escapeHtml(s.subtitle || '');
  const kind = s.communitySubmission ? `<span class="badge badge-info">Community</span>` : `<span class="badge">Curated</span>`;
  const vis = s.isPublic
    ? `<span class="badge badge-success">Published</span>`
    : `<span class="badge badge-warning">${escapeHtml(hiddenReason(s))}</span>`;
  const score = s.hasCachedScore
    ? `<span class="sp-score" title="Cached paddle score">${Number(s.rating).toFixed(1)}</span>`
    : (s.isPublic ? `<span class="sp-score sp-score--none" title="No cached score yet">—</span>` : '');
  const tags = (s.tags || []).map(t => `<span class="sp-tag">${escapeHtml(tagLabels[t] || t)}</span>`).join('');
  const canPublish = !s.communitySubmission || String(s.submissionStatus || '').toLowerCase() === 'validated';
  const pubBtn = s.isPublic
    ? `<button type="button" class="btn btn-secondary btn-sm" data-action="hide" data-id="${jsAttr(s.id)}">Hide</button>`
    : (canPublish
      ? `<button type="button" class="btn btn-success btn-sm" data-action="publish" data-id="${jsAttr(s.id)}">Publish</button>`
      : `<a class="btn btn-secondary btn-sm" href="#/submissions">Review in Submissions</a>`);
  const open = openId === s.id;

  return `
    <article class="sp-row${open ? ' is-open' : ''}" data-row-id="${jsAttr(s.id)}">
      <div class="sp-main">
        <div class="sp-cover">${cover ? `<img src="${escapeHtml(cover)}" alt="" loading="lazy">` : '<span class="sp-cover--empty">No photo</span>'}</div>
        <div class="sp-body">
          <div class="sp-head">
            <h3 class="sp-title">${escapeHtml(s.title || s.lakeName || s.id)}</h3>
            ${score}
          </div>
          <div class="sp-place">${place || '<em>No place set</em>'} <span class="sp-id">${escapeHtml(s.id)}</span></div>
          <div class="sp-badges">${kind}${vis}${tags}<span class="sp-photos">${(s.images || []).length} photo${(s.images || []).length === 1 ? '' : 's'}</span></div>
        </div>
        <div class="sp-actions">
          ${pubBtn}
          <button type="button" class="btn btn-primary btn-sm" data-action="toggle-edit" data-id="${jsAttr(s.id)}">${open ? 'Close' : 'Edit'}</button>
        </div>
      </div>
      <div class="sp-editor" data-editor-for="${jsAttr(s.id)}" ${open ? '' : 'hidden'}></div>
    </article>
  `;
}

function hiddenReason(s) {
  if (s.archived) return 'Hidden';
  const st = String(s.submissionStatus || '').toLowerCase();
  if (st === 'pending') return 'Pending review';
  if (st === 'rejected') return 'Rejected';
  return 'Hidden';
}

function toggleEdit(id) {
  openId = openId === id ? null : id;
  renderList();
  if (openId) {
    const rowEl = listEl.querySelector(`[data-row-id="${CSS.escape(openId)}"]`);
    if (rowEl) rowEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function mountEditor(id) {
  const spot = spots.find(s => s.id === id);
  const host = listEl.querySelector(`[data-editor-for="${CSS.escape(id)}"]`);
  if (!spot || !host) return;
  host.hidden = false;
  host.innerHTML = renderEditor(spot, tagLabels);
  bindEditor(host, {
    onChange: (fresh) => {
      if (!fresh) return;
      const i = spots.findIndex(s => s.id === fresh.id);
      if (i >= 0) spots[i] = fresh;
      renderTabs(); renderList();
    }
  });
}

async function setPublished(id, publish, btn) {
  const spot = spots.find(s => s.id === id);
  if (!spot) return;
  if (!publish && !window.confirm(`Hide "${spot.title || id}" from Paddling Out? Its photos stay; it just stops showing.`)) return;
  btn.disabled = true;
  try {
    const result = await patchSpot(id, { archived: !publish });
    const i = spots.findIndex(s => s.id === id);
    if (i >= 0 && result.spot) spots[i] = result.spot;
    showSuccess(publish ? 'Published.' : 'Hidden from the public list.');
    renderTabs(); renderList();
  } catch (err) {
    showError(err.message);
    btn.disabled = false;
  }
}
