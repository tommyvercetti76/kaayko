/**
 * Submissions View Module
 * Review queue for community-submitted lake / river / boat-ramp spots.
 *
 * Wires the already-live moderation endpoints into the Kortex admin SPA:
 *   GET  /paddlingOut/admin/submissions               → array of submissions
 *   POST /paddlingOut/admin/submissions/:id/validate  → approve (publishes spot)
 *   POST /paddlingOut/admin/submissions/:id/reject    → reject (deletes images)
 *
 * Two kinds share the queue (21 Oct 2026):
 *   new  — a lake not on the map yet; its id IS its spot id.
 *   edit — a suggested change to a live spot (communityEdits.js). Its id is
 *          `edit-…` and `spotId` is the spot it would change, so a card's id
 *          is NOT always spotId: approving an edit by spotId would approve
 *          that spot's own original submission instead. Approve sends the
 *          ticked changes only ({ fields: [...] }).
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
import { renderEditor, bindEditor, fetchSpot, saveEditorIfDirty } from '../spots/spot-editor.js';

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
let openEditorId = null;
// id → the server's reason an Approve was refused (422: no water type, no
// coordinates, no photos, no name). Shown on the card until the spot is edited.
const approveBlocked = new Map();
const WATER_TYPES = ['lake', 'reservoir', 'river', 'coastal', 'bay', 'canal'];
// id → the water type the reviewer picked on the card (survives re-renders).
const pickedWaterType = new Map();

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

  // One water type per card: the picker above Approve and the editor's field
  // follow each other, so they can never disagree (they did: Bay vs —).
  listEl.addEventListener('change', (e) => {
    const card = e.target.closest('.submission-card');
    if (!card) return;
    const id = card.dataset.cardId;
    let value = null;
    if (e.target.matches('[data-wt-for]')) {
      value = e.target.value;
      const other = card.querySelector('.se-editor select[name="waterType"]');
      if (other && other.value !== value) { other.value = value; other.closest('.se-editor').dataset.dirty = '1'; }
    } else if (e.target.matches('.se-editor select[name="waterType"]')) {
      value = e.target.value;
      const other = card.querySelector('[data-wt-for]');
      if (other) other.value = value;
    } else {
      return;
    }
    if (value) pickedWaterType.set(id, value); else pickedWaterType.delete(id);
    approveBlocked.delete(id);
    const flag = card.querySelector('.sub-flag--blocked');
    if (flag) flag.remove();
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
    // kinds=all: this card knows suggested edits (an older one would key them on spotId)
    const res = await apiFetch('/paddlingOut/admin/submissions?kinds=all');
    if (!res) return; // 401 → apiFetch already triggered logout
    if (!res.ok) throw new Error(`Failed to load submissions (${res.status})`);

    const data = await res.json();
    allSubmissions = Array.isArray(data)
      ? data
      : (Array.isArray(data && data.submissions) ? data.submissions : []);

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
  const sub = allSubmissions.find((s) => cardId(s) === id);
  if (sub && sub.kind === 'edit') return approveEdit(id, card);
  // The water type rides with Approve, so it is never a separate Edit → Save
  // round trip. The server also falls back to the submitter's answer and the
  // name, and only refuses when none of them says what the water is.
  const sel = card && card.querySelector(`[data-wt-for="${CSS.escape(id)}"]`);
  const waterType = sel ? sel.value : '';
  if (sel && !waterType) {
    approveBlocked.set(id, 'Pick a water type, then Approve.');
    renderList();
    const again = listEl.querySelector(`[data-wt-for="${CSS.escape(id)}"]`);
    if (again) again.focus();
    return;
  }
  setCardBusy(card, true, 'approve');
  try {
    // Edits typed into the open editor used to be dropped: Approve published
    // the old values. Save them first; a bad field stops the approval there.
    const editorHost = card && card.querySelector('.sub-editor');
    if (editorHost && !editorHost.hidden) await saveEditorIfDirty(editorHost);
    const result = await postAction(id, 'validate', waterType ? { waterType } : {});
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
    if (err.status === 422) {
      // The spot is missing something only an admin can set (coordinates,
      // photos, a name, or a water type nothing could infer). Say so on the
      // card; open the editor only when the fix lives there.
      approveBlocked.set(id, err.message);
      if (!/water type/i.test(err.message)) openEditorId = id;
      renderList();
    } else {
      setCardBusy(card, false);
    }
  }
}

async function approveEdit(id, card) {
  const fields = [...card.querySelectorAll('[data-change]:checked')].map((c) => c.dataset.change);
  if (!fields.length) { showError('Tick at least one change to apply, or Reject.'); return; }
  setCardBusy(card, true, 'approve');
  try {
    const result = await postAction(id, 'validate', { fields });
    markStatus(id, 'validated');
    const sub = allSubmissions.find((s) => cardId(s) === id);
    if (sub) sub.appliedFields = result.applied || fields;
    showSuccess(`Applied: ${(result.applied || fields).map(changeLabel).join(', ')}.`);
    refreshUI();
  } catch (err) {
    console.error('[Submissions] Approve edit failed:', err);
    showError(err.message || 'Failed to apply the edit.');
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
    const was = allSubmissions.find((s) => cardId(s) === id);
    showInfo(was && was.kind === 'edit' ? 'Edit rejected. The live spot is unchanged; its new photos were deleted.' : 'Submission rejected. Uploaded images were deleted.');
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
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  try { return await res.json(); } catch (_) { return {}; }
}

// ---------------------------------------------------------------------------
// Inline edit (shared spot editor) — lets an admin fix a name, move the pin,
// swap a photo or set the water type BEFORE approving, instead of rejecting a nearly-
// right entry.
// ---------------------------------------------------------------------------

function toggleEditor(id) {
  openEditorId = openEditorId === id ? null : id;
  renderList();
}

async function mountEditor(id) {
  const host = listEl && listEl.querySelector(`[data-editor-for="${CSS.escape(id)}"]`);
  if (!host) return;
  ensureEditorStyles();
  host.hidden = false;
  host.innerHTML = '<div class="loading">Loading spot…</div>';
  try {
    const spot = await fetchSpot(id);
    host.innerHTML = renderEditor(spot);
    // Start the editor on the same water type the card offers.
    const sub = allSubmissions.find((s) => (s.spotId || s.id) === id);
    const offered = pickedWaterType.get(id) || (sub && sub.suggestedWaterType);
    const wtSelect = host.querySelector('select[name="waterType"]');
    if (wtSelect && !spot.waterType && offered) {
      wtSelect.value = offered;
      host.querySelector('.se-editor').dataset.dirty = '1';
    }
    bindEditor(host, {
      onChange: (fresh) => {
        if (!fresh) return;
        approveBlocked.delete(id);
        // Reflect edits on the review card without a full reload.
        const sub = allSubmissions.find((s) => (s.spotId || s.id) === id);
        if (sub) {
          Object.assign(sub, {
            lakeName: fresh.title || fresh.lakeName, city: fresh.city, region: fresh.region, country: fresh.country,
            launchHint: fresh.launchHint, text: fresh.text, parkingAvl: fresh.parkingAvl, restroomsAvl: fresh.restroomsAvl,
            location: fresh.location, imgSrc: (fresh.images || []).map((i) => i.url),
            waterType: fresh.waterType || null
          });
          if (fresh.waterType) pickedWaterType.set(id, fresh.waterType);
        }
        renderList();
      }
    });
  } catch (err) {
    host.innerHTML = `<div class="submissions-error">${escapeHtml(err.message || 'Failed to load spot.')}</div>`;
  }
}

// The editor's styles live with the Spots view, and kortex-core only loads a
// view's CSS when that view is opened — so opening Submissions first rendered
// an unstyled form. Same href as kortex-core, so neither loads it twice.
function ensureEditorStyles() {
  const href = 'views/spots/spots.css';
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
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
  if (openEditorId && sorted.some((s) => s.kind !== 'edit' && cardId(s) === openEditorId)) mountEditor(openEditorId);
}

function submissionCard(sub) {
  if (sub.kind === 'edit') return editCard(sub);
  const id = cardId(sub);
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
  const blocked = status === 'pending' && approveBlocked.has(id)
    ? `<div class="sub-flag sub-flag--blocked" role="alert">${escapeHtml(approveBlocked.get(id))}</div>`
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
    ? `${waterTypePicker(sub, id)}
       <div class="sub-actions">
         <button type="button" class="btn btn-success" data-action="approve" data-id="${jsAttr(id)}">Approve</button>
         <button type="button" class="btn btn-danger" data-action="reject" data-id="${jsAttr(id)}">Reject</button>
         ${editBtn}
       </div>`
    : (editBtn ? `<div class="sub-actions">${editBtn}</div>` : '');

  return `
    <article class="submission-card${editing ? ' is-editing' : ''}" data-card-id="${jsAttr(id)}">
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
        ${sourceLines(sub)}
        ${dup}
        ${launchHint}
        ${description}
        ${note}
        <div class="sub-amenities">${boolPill('Parking', sub.parkingAvl)}${boolPill('Restrooms', sub.restroomsAvl)}</div>
        <div class="sub-meta">
          <span class="sub-meta-item">By ${submitter}</span>
          <span class="sub-meta-sep">•</span>
          <span class="sub-meta-item">${created}</span>
        </div>
        ${blocked}
        ${actions}
      </div>
      <div class="sub-editor" data-editor-for="${jsAttr(id)}" ${editing ? '' : 'hidden'}></div>
    </article>
  `;
}

/** Where the place and the name came from (spotLocate on the server). */
function sourceLines(sub) {
  const out = [];
  const p = sub.place;
  if (p && sub.placeSource) {
    const src = sub.placeSource === 'census' ? 'US Census' : sub.placeSource === 'osm' ? 'OpenStreetMap' : sub.placeSource;
    const town = p.town ? (p.townDistanceKm === 0 ? `in ${p.town}` : `${p.townDistanceKm != null ? p.townDistanceKm + ' km from ' : 'near '}${p.town}`) : '';
    out.push(`Place from the pin (${src}): ${[town, p.county].filter(Boolean).join(' · ')}`);
  } else if (sub.kind !== 'edit' && sub.placeSource === 'submitter') {
    out.push('Place typed by the submitter (lookup unavailable)');
  }
  const m = sub.waterMatch;
  if (m && m.name) {
    out.push(`Name matches ${m.source === 'usgs' ? 'USGS' : 'OpenStreetMap'}: ${m.name}${m.inside ? ' (pin is on the water)' : m.distanceM != null ? ` · ${m.distanceM} m from the pin` : ''}`);
  } else if (Array.isArray(sub.waterCandidates) && sub.waterCandidates.length) {
    out.push(`Typed name. Mapped water near the pin: ${sub.waterCandidates.join(', ')}`);
  }
  return out.length ? `<div class="sub-sources">${out.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}</div>` : '';
}

const CHANGE_LABELS = { title: 'Name', location: 'Launch pin', text: 'Note', parkingAvl: 'Parking', restroomsAvl: 'Restrooms', photos: 'Photos' };
function changeLabel(k) { return CHANGE_LABELS[k] || k; }
function yesNo(v) { return v === 'Y' || v === true ? 'Yes' : 'No'; }
function gmaps(loc) {
  const lat = Number(loc && loc.latitude), lng = Number(loc && loc.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null;
}

/** A suggested edit: what is live now → what was proposed, one tick per change. */
function editCard(sub) {
  const id = cardId(sub);
  const status = getStatus(sub);
  const live = sub.live || {};
  const pr = sub.proposed || {};
  const pending = status === 'pending';
  const rows = [];
  const row = (key, from, to, extra = '') => {
    const applied = Array.isArray(sub.appliedFields) ? sub.appliedFields.includes(key) : null;
    const tick = pending
      ? `<input type="checkbox" data-change="${jsAttr(key)}" checked aria-label="Apply ${escapeHtml(changeLabel(key))}">`
      : `<span class="sub-change-state">${applied === null ? '' : applied ? 'Applied' : 'Not applied'}</span>`;
    rows.push(`<label class="sub-change">${tick}<span class="sub-change-key">${escapeHtml(changeLabel(key))}</span>
      <span class="sub-change-from">${from}</span><span class="sub-change-arrow" aria-hidden="true">→</span><span class="sub-change-to">${to}</span>${extra}</label>`);
  };
  if (pr.title !== undefined) row('title', escapeHtml(live.title || '—'), escapeHtml(pr.title));
  if (pr.location) {
    const a = gmaps(live.location), b = gmaps(pr.location);
    const place = ['city', 'region', 'country'].filter((k) => pr[k]).map((k) => escapeHtml(pr[k])).join(', ');
    row('location',
      a ? `<a href="${escapeHtml(a)}" target="_blank" rel="noopener">current ↗</a>` : '—',
      b ? `<a href="${escapeHtml(b)}" target="_blank" rel="noopener">proposed ↗</a>` : '—',
      `<span class="sub-change-note">moved ${escapeHtml(String(sub.movedMetres ?? '?'))} m${place ? ` · place becomes ${place}` : ''}</span>`);
  }
  if (pr.text !== undefined) row('text', escapeHtml(live.text || '(none)'), escapeHtml(pr.text || '(removed)'));
  if (pr.parkingAvl) row('parkingAvl', yesNo(live.parkingAvl), yesNo(pr.parkingAvl));
  if (pr.restroomsAvl) row('restroomsAvl', yesNo(live.restroomsAvl), yesNo(pr.restroomsAvl));
  const newPhotos = safeImages(sub.pendingImgSrc);
  if (newPhotos.length || (sub.appliedFields || []).includes('photos')) {
    row('photos', `${(live.imgSrc || []).length} now`, `+${newPhotos.length || (sub.photosAdded || []).length}`,
      newPhotos.length ? `<span class="sub-change-thumbs">${newPhotos.map((u) => `<img src="${escapeHtml(u)}" alt="" loading="lazy">`).join('')}</span>` : '');
  }
  const hero = safeImages(live.imgSrc)[0];
  const submitter = sub.anonymous ? 'Anonymous' : escapeHtml(sub.contactEmail || 'Anonymous');
  const created = sub.createdAt ? escapeHtml(formatDate(sub.createdAt)) : '—';
  const spotLink = sub.spotExists === false ? '<span class="sub-flag sub-flag--blocked">The spot no longer exists.</span>'
    : `<a class="sub-map-link" href="/paddlingout/forecast?id=${encodeURIComponent(sub.spotId)}" target="_blank" rel="noopener">Open the live spot ↗</a>`;
  const note = status === 'rejected' && sub.rejectionReason
    ? `<div class="sub-field"><span class="sub-field-label">Rejection reason</span><span class="sub-field-val">${escapeHtml(sub.rejectionReason)}</span></div>` : '';
  const actions = pending
    ? `<div class="sub-actions">
         <button type="button" class="btn btn-success" data-action="approve" data-id="${jsAttr(id)}">Apply ticked</button>
         <button type="button" class="btn btn-danger" data-action="reject" data-id="${jsAttr(id)}">Reject</button>
       </div>` : '';
  return `
    <article class="submission-card submission-card--edit" data-card-id="${jsAttr(id)}">
      <div class="sub-media">
        ${hero ? `<img class="sub-hero" src="${escapeHtml(hero)}" alt="" loading="lazy">` : '<div class="sub-hero sub-hero--empty">No photos</div>'}
      </div>
      <div class="sub-body">
        <div class="sub-head">
          <div class="sub-head-text">
            <span class="sub-kind">Suggested edit</span>
            <h3 class="sub-title">${escapeHtml(live.title || sub.lakeName || 'Spot')}</h3>
            <div class="sub-loc">${spotLink}</div>
          </div>
          ${statusBadge(status)}
        </div>
        <div class="sub-changes">${rows.join('') || '<div class="sub-field-val">No changes recorded.</div>'}</div>
        ${note}
        <div class="sub-meta">
          <span class="sub-meta-item">By ${submitter}</span>
          <span class="sub-meta-sep">•</span>
          <span class="sub-meta-item">${created}</span>
        </div>
        ${actions}
      </div>
    </article>`;
}

/** Water type, chosen on the card. Pre-filled: the spot's, else the submitter's answer, else the name. */
function waterTypePicker(sub, id) {
  const value = pickedWaterType.get(id) || sub.waterType || sub.suggestedWaterType || '';
  const from = pickedWaterType.has(id) || sub.waterType ? ''
    : sub.suggestedWaterTypeSource === 'usgs' ? 'USGS classes it so'
    : sub.suggestedWaterTypeSource === 'osm' || sub.suggestedWaterTypeSource === 'hydrolakes' ? 'from the map, check it'
    : sub.suggestedWaterTypeSource === 'submitter' ? 'submitter said so'
    : sub.suggestedWaterTypeSource === 'name' ? 'from the name, check it' : '';
  return `<label class="sub-wt">
      <span class="sub-field-label">Water type</span>
      <select data-wt-for="${jsAttr(id)}" aria-label="Water type">
        <option value=""${value ? '' : ' selected'}>Pick one…</option>
        ${WATER_TYPES.map((t) => `<option value="${t}"${value === t ? ' selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}
      </select>
      ${from ? `<span class="sub-wt-src">${escapeHtml(from)}</span>` : ''}
    </label>`;
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
  card.querySelectorAll('[data-action]').forEach((b) => {
    b.disabled = busy;
    // A failed request used to leave the button reading "Approving…" forever.
    if (!busy && b.dataset.label) { b.textContent = b.dataset.label; delete b.dataset.label; }
  });
  if (busy && which) {
    const active = card.querySelector(`[data-action="${which}"]`);
    if (active) {
      active.dataset.label = active.textContent;
      active.textContent = which === 'approve' ? 'Approving…' : 'Rejecting…';
    }
  }
}

function markStatus(id, status) {
  const sub = allSubmissions.find((s) => cardId(s) === id);
  if (sub) sub.status = status;
}

function pendingCount() {
  return allSubmissions.filter((s) => getStatus(s) === 'pending').length;
}

/** The id the queue routes use: an edit's own id, a new lake's spot id. */
function cardId(sub) {
  return sub && sub.kind === 'edit' ? (sub.id || '') : ((sub && (sub.spotId || sub.id)) || '');
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
