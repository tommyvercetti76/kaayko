/**
 * Submissions View Module
 * Review queue for community-submitted lake / river / boat-ramp spots.
 *
 * Wires the already-live moderation endpoints into the Kortex admin SPA:
 *   GET  /paddlingOut/admin/submissions               → array of submissions
 *   POST /paddlingOut/admin/submissions/:id/validate  → approve (publishes spot)
 *   POST /paddlingOut/admin/submissions/:id/reject    → reject (deletes images)
 *
 * SECURITY: every displayed field (lakeName, city, region, country, launchHint,
 * description, contactEmail, image URLs, spotId) is USER-SUBMITTED and untrusted.
 * All text is escaped with escapeHtml, all id values placed into HTML attributes
 * go through jsAttr, and image URLs are validated to be plain https before use.
 * Card actions use data-attributes + a single delegated listener — no onclick
 * strings are ever built from submission data.
 */

import { apiFetch } from '../../js/config.js';
import { escapeHtml, jsAttr, formatDate, showSuccess, showError, showInfo } from '../../js/utils.js';
import { renderEditor, bindEditor, fetchSpot, DEFAULT_TAGS } from '../spots/spot-editor.js';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

const FILTERS = [
  { key: 'pending',   label: 'Pending',  match: (s) => s === 'pending' },
  { key: 'validated', label: 'Approved', match: (s) => s === 'validated' },
  { key: 'rejected',  label: 'Rejected', match: (s) => s === 'rejected' },
  { key: 'all',       label: 'All',      match: () => true },
];

let allSubmissions = [];
let currentFilter = 'pending';
let tagLabels = DEFAULT_TAGS;
let openEditorId = null;

// Live DOM references, re-bound on every init() (the view module is cached but
// init runs on each navigation, replacing the container's contents).
let listEl = null;
let tabsEl = null;
let countEl = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export async function init(STATE) { // eslint-disable-line no-unused-vars
  const container = document.getElementById('submissions-view');
  if (!container) return;

  currentFilter = 'pending';
  allSubmissions = [];

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Community Submissions</h1>
        <p class="view-subtitle">Review lake, river, and boat-ramp spots submitted by the community.</p>
      </div>
      <button type="button" class="btn btn-secondary" id="submissions-refresh">Refresh</button>
    </header>

    <div class="card submissions-card">
      <div class="submissions-tabs" id="submissions-tabs"></div>
      <div class="submissions-count" id="submissions-count"></div>
      <div class="submissions-list" id="submissions-list">
        <div class="loading">Loading submissions…</div>
      </div>
    </div>
  `;

  tabsEl = container.querySelector('#submissions-tabs');
  countEl = container.querySelector('#submissions-count');
  listEl = container.querySelector('#submissions-list');

  // Filter tab switching — delegated, so re-rendering the tab buttons is safe.
  tabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-filter]');
    if (!tab) return;
    currentFilter = tab.dataset.filter || 'pending';
    renderTabs();
    renderList();
  });

  // Approve / Reject actions — delegated on the persistent list container.
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id) return;
    if (action === 'approve') approve(id, btn);
    else if (action === 'reject') reject(id, btn);
    else if (action === 'edit') toggleEditor(id);
  });

  const refreshBtn = container.querySelector('#submissions-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', () => load());

  renderTabs();
  await load();
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

async function load() {
  if (listEl) listEl.innerHTML = '<div class="loading">Loading submissions…</div>';

  try {
    const res = await apiFetch('/paddlingOut/admin/submissions');
    if (!res) return; // 401 → apiFetch already triggered logout
    if (!res.ok) throw new Error(`Failed to load submissions (${res.status})`);

    const data = await res.json();
    allSubmissions = Array.isArray(data)
      ? data
      : (Array.isArray(data && data.submissions) ? data.submissions : []);
    if (data && data.tags && typeof data.tags === 'object') tagLabels = data.tags;

    refreshUI();
  } catch (err) {
    console.error('[Submissions] Failed to load:', err);
    if (listEl) {
      listEl.innerHTML = '<div class="submissions-error">Failed to load submissions. Please try again.</div>';
    }
  }
}

async function approve(id, btn) {
  const card = btn.closest('.submission-card');
  setCardBusy(card, true, 'approve');
  try {
    const result = await postAction(id, 'validate', {});
    markStatus(id, 'validated');
    const score = result && result.paddleScore;
    if (score && score.warmed) {
      showSuccess(`Published. Paddle score ${Number(score.rating).toFixed(1)} is live on the card now.`);
    } else {
      showSuccess('Published. Score will appear within 15 minutes (weather lookup did not complete now).');
    }
    if (result && result.notification && result.notification.status === 'failed') {
      showError('Submitter email failed to send: ' + (result.notification.error || 'unknown error'));
    }
    refreshUI();
  } catch (err) {
    console.error('[Submissions] Approve failed:', err);
    showError(err.message || 'Failed to approve submission.');
    setCardBusy(card, false);
  }
}

async function reject(id, btn) {
  const reason = window.prompt('Reason for rejecting this submission? (optional — leave blank to reject without a note)');
  if (reason === null) return; // user cancelled

  const card = btn.closest('.submission-card');
  setCardBusy(card, true, 'reject');
  try {
    const trimmed = reason.trim();
    await postAction(id, 'reject', trimmed ? { rejectionReason: trimmed } : {});
    markStatus(id, 'rejected');
    showInfo('Submission rejected. Uploaded images were deleted.');
    refreshUI();
  } catch (err) {
    console.error('[Submissions] Reject failed:', err);
    showError(err.message || 'Failed to reject submission.');
    setCardBusy(card, false);
  }
}

async function postAction(id, action, bodyObj) {
  const endpoint = `/paddlingOut/admin/submissions/${encodeURIComponent(id)}/${action}`;
  const res = await apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(bodyObj || {}),
  });
  if (!res) throw new Error('Session expired. Please sign in again.'); // 401 handled by apiFetch
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const d = await res.json();
      if (d && (d.error || d.message)) msg = d.error || d.message;
    } catch (_) { /* non-JSON error body */ }
    throw new Error(msg);
  }
  try { return await res.json(); } catch (_) { return {}; }
}

// ---------------------------------------------------------------------------
// Inline edit (shared spot editor) — lets an admin fix a name, move the pin,
// swap a photo or set tags BEFORE approving, instead of rejecting a nearly-
// right entry.
// ---------------------------------------------------------------------------

function toggleEditor(id) {
  openEditorId = openEditorId === id ? null : id;
  renderList();
}

async function mountEditor(id) {
  const host = listEl && listEl.querySelector(`[data-editor-for="${CSS.escape(id)}"]`);
  if (!host) return;
  host.hidden = false;
  host.innerHTML = '<div class="loading">Loading spot…</div>';
  try {
    const spot = await fetchSpot(id);
    host.innerHTML = renderEditor(spot, tagLabels);
    bindEditor(host, {
      onChange: (fresh) => {
        if (!fresh) return;
        // Reflect edits on the review card without a full reload.
        const sub = allSubmissions.find((s) => (s.spotId || s.id) === id);
        if (sub) {
          Object.assign(sub, {
            lakeName: fresh.title || fresh.lakeName, city: fresh.city, region: fresh.region, country: fresh.country,
            launchHint: fresh.launchHint, text: fresh.text, parkingAvl: fresh.parkingAvl, restroomsAvl: fresh.restroomsAvl,
            location: fresh.location, tags: fresh.tags, imgSrc: (fresh.images || []).map((i) => i.url)
          });
        }
        renderList();
      }
    });
  } catch (err) {
    host.innerHTML = `<div class="submissions-error">${escapeHtml(err.message || 'Failed to load spot.')}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function refreshUI() {
  renderTabs();
  renderList();
  updateSubmissionsBadge(pendingCount());
}

function renderTabs() {
  if (!tabsEl) return;
  tabsEl.innerHTML = FILTERS.map((f) => {
    const count = allSubmissions.filter((s) => f.match(getStatus(s))).length;
    const active = f.key === currentFilter ? ' active' : '';
    return `<button type="button" class="submissions-tab${active}" data-filter="${f.key}">`
      + `${escapeHtml(f.label)}<span class="submissions-tab-count">${count}</span></button>`;
  }).join('');
}

function renderList() {
  if (!listEl) return;

  const filter = FILTERS.find((f) => f.key === currentFilter) || FILTERS[0];
  const items = allSubmissions.filter((s) => filter.match(getStatus(s)));

  if (countEl) {
    const noun = filter.key === 'all' ? 'submission' : `${filter.label.toLowerCase()} submission`;
    countEl.textContent = `${items.length} ${noun}${items.length === 1 ? '' : 's'}`;
  }

  if (!items.length) {
    const emptyNoun = filter.key === 'all' ? 'submissions' : `${filter.label.toLowerCase()} submissions`;
    listEl.innerHTML = `<div class="submissions-empty">No ${escapeHtml(emptyNoun)} yet.</div>`;
    return;
  }

  const sorted = items.slice().sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  listEl.innerHTML = sorted.map(submissionCard).join('');
  if (openEditorId && sorted.some((s) => (s.spotId || s.id) === openEditorId)) mountEditor(openEditorId);
}

function submissionCard(sub) {
  const id = sub.spotId || sub.id || '';
  const status = getStatus(sub);
  const name = escapeHtml(sub.lakeName || 'Untitled spot');

  const loc = [sub.city, sub.region, sub.country]
    .filter((v) => v != null && String(v).trim() !== '')
    .map((v) => escapeHtml(v))
    .join(', ');

  const imgs = safeImages(sub.imgSrc);
  const hero = imgs[0]
    ? `<img class="sub-hero" src="${escapeHtml(imgs[0])}" alt="${name} photo" loading="lazy">`
    : '<div class="sub-hero sub-hero--empty">No photos</div>';
  const thumbs = imgs.slice(1, 5)
    .map((u) => `<img class="sub-thumb" src="${escapeHtml(u)}" alt="" loading="lazy">`)
    .join('');

  const coords = getCoords(sub);
  const coordText = coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'No coordinates';
  const mapLink = coords
    ? `<a class="sub-map-link" href="https://www.google.com/maps?q=${coords.lat},${coords.lng}" target="_blank" rel="noopener">View on map ↗</a>`
    : '';

  const launchHint = sub.launchHint
    ? `<div class="sub-field"><span class="sub-field-label">Launch hint</span><span class="sub-field-val">${escapeHtml(sub.launchHint)}</span></div>`
    : '';
  const descText = sub.text || sub.description || '';
  const description = descText
    ? `<div class="sub-field"><span class="sub-field-label">Description</span><span class="sub-field-val">${escapeHtml(descText)}</span></div>`
    : '';
  const dup = sub.possibleDuplicateOf && sub.possibleDuplicateOf.id
    ? `<div class="sub-flag sub-flag--dup">Possible duplicate: <strong>${escapeHtml(sub.possibleDuplicateOf.lakeName || sub.possibleDuplicateOf.id)}</strong>
         is ${escapeHtml(String(sub.possibleDuplicateOf.distanceMetres))} m away${sub.possibleDuplicateOf.isPublic ? ' and already published' : ' (not public)'}.
         <a href="#/spots">Open Spots ↗</a></div>`
    : '';
  const tags = Array.isArray(sub.tags) && sub.tags.length
    ? `<div class="sub-tags">${sub.tags.map((t) => `<span class="sp-tag">${escapeHtml(tagLabels[t] || t)}</span>`).join('')}</div>`
    : '';
  const note = status === 'rejected' && sub.rejectionReason
    ? `<div class="sub-field"><span class="sub-field-label">Rejection reason</span><span class="sub-field-val">${escapeHtml(sub.rejectionReason)}</span></div>`
    : '';

  const submitter = sub.anonymous ? 'Anonymous' : escapeHtml(sub.contactEmail || 'Anonymous');
  const created = sub.createdAt ? escapeHtml(formatDate(sub.createdAt)) : '—';

  const editing = openEditorId === id;
  const editBtn = status !== 'rejected'
    ? `<button type="button" class="btn btn-secondary" data-action="edit" data-id="${jsAttr(id)}">${editing ? 'Close editor' : 'Edit'}</button>`
    : '';
  const actions = status === 'pending'
    ? `<div class="sub-actions">
         <button type="button" class="btn btn-success" data-action="approve" data-id="${jsAttr(id)}">Approve</button>
         <button type="button" class="btn btn-danger" data-action="reject" data-id="${jsAttr(id)}">Reject</button>
         ${editBtn}
       </div>`
    : (editBtn ? `<div class="sub-actions">${editBtn}</div>` : '');

  return `
    <article class="submission-card" data-card-id="${jsAttr(id)}">
      <div class="sub-media">
        ${hero}
        ${thumbs ? `<div class="sub-thumbs">${thumbs}</div>` : ''}
      </div>
      <div class="sub-body">
        <div class="sub-head">
          <div class="sub-head-text">
            <h3 class="sub-title">${name}</h3>
            <div class="sub-loc">${loc || 'Location unknown'}</div>
          </div>
          ${statusBadge(status)}
        </div>
        <div class="sub-coords">
          <span class="sub-coord-text">${escapeHtml(coordText)}</span>
          ${mapLink}
        </div>
        ${dup}
        ${launchHint}
        ${description}
        ${note}
        ${tags}
        <div class="sub-amenities">${boolPill('Parking', sub.parkingAvl)}${boolPill('Restrooms', sub.restroomsAvl)}</div>
        <div class="sub-meta">
          <span class="sub-meta-item">By ${submitter}</span>
          <span class="sub-meta-sep">•</span>
          <span class="sub-meta-item">${created}</span>
        </div>
        ${actions}
      </div>
      <div class="sub-editor" data-editor-for="${jsAttr(id)}" ${editing ? '' : 'hidden'}></div>
    </article>
  `;
}

function statusBadge(status) {
  const map = {
    pending:   ['badge-warning', 'Pending'],
    validated: ['badge-success', 'Approved'],
    rejected:  ['badge-error',   'Rejected'],
  };
  const [cls, label] = map[status] || ['badge-info', status || 'Unknown'];
  return `<span class="badge ${cls} sub-status">${escapeHtml(label)}</span>`;
}

function boolPill(label, val) {
  // The API stores 'Y'/'N' strings (the spot schema), so a strict boolean
  // check rendered every submission as "Parking: No".
  const yes = val === true || val === 'true' || val === 1 || val === 'Y' || val === 'y';
  return `<span class="sub-pill ${yes ? 'sub-pill--yes' : 'sub-pill--no'}">`
    + `${escapeHtml(label)}: ${yes ? 'Yes' : 'No'}</span>`;
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

/**
 * Update the sidebar pending-count badge (#submissions-badge). Shows the number
 * of pending submissions and unhides the badge only when there are any.
 */
export function updateSubmissionsBadge(count) {
  const badge = document.getElementById('submissions-badge');
  if (!badge) return;
  const n = Number(count) || 0;
  if (n > 0) {
    badge.textContent = String(n);
    badge.hidden = false;
  } else {
    badge.textContent = '';
    badge.hidden = true;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setCardBusy(card, busy, which) {
  if (!card) return;
  card.classList.toggle('is-busy', busy);
  card.querySelectorAll('[data-action]').forEach((b) => { b.disabled = busy; });
  if (busy && which) {
    const active = card.querySelector(`[data-action="${which}"]`);
    if (active) active.textContent = which === 'approve' ? 'Approving…' : 'Rejecting…';
  }
}

function markStatus(id, status) {
  const sub = allSubmissions.find((s) => (s.spotId || s.id) === id);
  if (sub) sub.status = status;
}

function pendingCount() {
  return allSubmissions.filter((s) => getStatus(s) === 'pending').length;
}

function getStatus(sub) {
  return String((sub && (sub.status || sub.submissionStatus)) || 'pending').toLowerCase();
}

function safeImages(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((u) => typeof u === 'string')
    .map((u) => u.trim())
    .filter((u) => /^https:\/\/[^\s"'<>]+$/i.test(u));
}

function getCoords(sub) {
  let lat = sub.lat;
  let lng = sub.lng;
  if ((lat == null || lng == null) && sub.location) {
    lat = sub.location.latitude;
    lng = sub.location.longitude;
  }
  lat = Number(lat);
  lng = Number(lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null; // treat null-island as missing
  return { lat, lng };
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts._seconds) return ts._seconds * 1000;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
}
