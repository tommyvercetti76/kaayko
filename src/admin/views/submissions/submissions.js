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
  // 'applying': an Approve of a suggested edit in progress (or one that never finished).
  { key: 'pending',   label: 'Pending',  match: (s) => s === 'pending' || s === 'applying' },
  { key: 'validated', label: 'Approved', match: (s) => s === 'validated' },
  { key: 'rejected',  label: 'Rejected', match: (s) => s === 'rejected' },
  // Mapmakers: the finder withdrew it in review, or asked and it was taken down.
  { key: 'withdrawn', label: 'Withdrawn', match: (s) => s === 'withdrawn' || s === 'removed' },
  { key: 'all',       label: 'All',      match: () => true },
  // Mapmakers monthly picks (28 Oct 2026): not a status, its own list.
  { key: 'picks',     label: 'Picks',    match: () => false, picks: true },
  // Reports from paddlers (29 Oct 2026): wildlife, hazards, access, with the day seen.
  { key: 'reports',   label: 'Reports',  match: () => false, reports: true },
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
// id → the "Name on the lake" box as the reviewer left it (survives re-renders).
const editedCredit = new Map();
// The Picks tab: one month at a time from GET /paddlingOut/admin/mapmakers/picks.
let picksData = null;
let picksMonth = null;
// The Reports tab: GET /paddlingOut/admin/reports (pending, or the status chosen).
let reportsData = null;
let reportsStatus = 'pending';

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
  // Fresh each visit: the module is cached between navigations.
  reportsData = null;
  reportsStatus = 'pending';
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
    if (currentFilter === 'picks' && !picksData) loadPicks(picksMonth);
    if (currentFilter === 'reports' && !reportsData) loadReports(reportsStatus);
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
    else if (action === 'pick') pickLake(id, btn);
    else if (action === 'send-link') sendFinderLink(id, btn);
    else if (action === 'takedown-remove' || action === 'takedown-keep') decideTakedown(id, action === 'takedown-remove' ? 'remove' : 'keep', btn);
    else if (action === 'pick-resend' || action === 'pick-release' || action === 'pick-revoke') pickAction(id, action.slice(5), btn);
    else if (action === 'picks-month') loadPicks(id);
    else if (action === 'report-approve' || action === 'report-reject' || action === 'report-remove') decideReport(id, action.slice(7), btn);
    else if (action === 'reports-status') loadReports(id);
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

  listEl.addEventListener('input', (e) => {
    if (!e.target.matches('[data-credit-for]')) return;
    editedCredit.set(e.target.dataset.creditFor, e.target.value);
  });

  const refreshBtn = container.querySelector('#submissions-refresh');
  // Refresh reloads the lists the tabs show, reports and picks included.
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    load();
    loadReports(reportsStatus);
    if (picksData) loadPicks(picksMonth);
  });

  renderTabs();
  await load();
  loadReports('pending');   // so the Reports tab shows its pending count from the start
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
    const body = waterType ? { waterType } : {};
    // The name rides with Approve exactly as the box reads; empty = no name.
    const creditBox = card && card.querySelector(`[data-credit-for="${CSS.escape(id)}"]`);
    if (creditBox) body.creditName = creditBox.value.trim();
    // What the name was when this card loaded: if the finder took it off since, the
    // API refuses rather than publish it again.
    if (sub) body.creditNameLoaded = sub.creditName || null;
    const result = await postAction(id, 'validate', body);
    if (sub && result) sub.creditName = result.credit || null;
    editedCredit.delete(id);
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
  const reason = window.prompt('Reason (optional). It is emailed to the person who sent it and shown on their Mapmakers page; leave blank to reject without one.');
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
    const count = f.picks ? (picksData ? `${picksData.count}/${picksData.cap}` : '·')
      : f.reports ? (reportsData && reportsData.status === 'pending' ? reportsData.reports.length : '·')
        : allSubmissions.filter((s) => f.match(getStatus(s))).length;
    const active = f.key === currentFilter ? ' active' : '';
    return `<button type="button" class="submissions-tab${active}" data-filter="${f.key}">`
      + `${escapeHtml(f.label)}<span class="submissions-tab-count">${count}</span></button>`;
  }).join('');
}

function renderList() {
  if (!listEl) return;

  const filter = FILTERS.find((f) => f.key === currentFilter) || FILTERS[0];
  if (filter.picks) { renderPicks(); return; }
  if (filter.reports) { renderReports(); return; }
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
        ${mapmakerLines(sub, id, status)}
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

/**
 * Mapmakers (28 Oct 2026). The name the person asked to show is an editable box
 * while the lake is pending — Approve publishes whatever it says, and an empty
 * box leaves the lake unnamed. After Approve it reads as it appears publicly.
 * Nobody is named who did not ask to be, so there is no box without a name.
 */
function mapmakerLines(sub, id, status) {
  const finder = [
    sub.mapmakerOptIn ? '<span class="sub-pill sub-pill--picks">Up for the monthly picks</span>' : '',
    sub.withdrawnByFinder ? '<span class="sub-pill sub-pill--no">Withdrawn by the finder</span>' : '',
    sub.takedownRequested && !sub.takedownDecision ? '<span class="sub-pill sub-pill--held">Take-down requested by the finder</span>' : '',
    sub.takedownDecision === 'kept' ? '<span class="sub-pill">Take-down declined: kept on the map</span>' : '',
    sub.takedownDecision === 'removed' ? '<span class="sub-pill sub-pill--no">Taken down at the finder&rsquo;s request</span>' : ''
  ].filter(Boolean).join('');
  // The finder was told a person decides and writes either way: both buttons email them.
  const takedown = sub.takedownRequested && !sub.takedownDecision && status === 'validated'
    ? `<div class="sub-pick">
        <button type="button" class="btn btn-danger" data-action="takedown-remove" data-id="${jsAttr(id)}">Take it down</button>
        <button type="button" class="btn btn-secondary" data-action="takedown-keep" data-id="${jsAttr(id)}">Keep it</button>
        <span class="picks-sub">Either way the finder is emailed.</span>
      </div>`
    : '';
  const sendLink = sub.contactEmail
    ? `<button type="button" class="btn btn-secondary sub-send-link" data-action="send-link" data-id="${jsAttr(id)}" title="Emails the finder a link to their Mapmakers page on kaay.link">Send their link</button>`
    : '';
  const picks = (finder || sendLink ? `<div class="sub-amenities">${finder}${sendLink}</div>` : '') + takedown + samePersonFlag(sub);
  if (status === 'pending' && sub.creditName) {
    const value = editedCredit.has(id) ? editedCredit.get(id) : sub.creditName;
    return `<label class="sub-field sub-credit">
        <span class="sub-field-label">Name on the lake &middot; clear it to leave the lake unnamed</span>
        <input type="text" class="sub-credit-input" maxlength="40" autocomplete="off" data-credit-for="${jsAttr(id)}" value="${escapeHtml(value)}">
      </label>${picks}`;
  }
  const shown = status === 'validated' && sub.creditName
    ? `<div class="sub-field"><span class="sub-field-label">On the lake</span><span class="sub-field-val">Added by ${escapeHtml(sub.creditName)}</span></div>`
    : '';
  return shown + picks + (status === 'validated' ? pickControl(sub, id) : '');
}

const PICK_STATUS = { issued: 'link sent, choosing', claiming: 'at checkout', claimed: 'claimed, to ship', held: 'held, needs you', shipped: 'shipped', expired: 'expired', revoked: 'withdrawn' };

/** Approved + opted in + an email: the Pick control. Picked: its number and state. */
function pickControl(sub, id) {
  if (sub.pick) {
    return `<div class="sub-amenities"><span class="sub-pill sub-pill--picks">Picked &middot; No. ${escapeHtml(String(sub.pick.number))} &middot; ${escapeHtml(PICK_STATUS[sub.pick.status] || sub.pick.status)}${sub.pick.piece ? ` &middot; ${escapeHtml(sub.pick.piece)}` : ''}${sub.pick.orderNumber ? ` &middot; ${escapeHtml(sub.pick.orderNumber)}` : ''}</span></div>`;
  }
  if (!sub.mapmakerOptIn || !sub.contactEmail) return '';
  // The finder chooses the piece (any of Kaayko's own under the cap) from the link.
  return `<div class="sub-pick">
      <button type="button" class="btn btn-primary" data-action="pick" data-id="${jsAttr(id)}">Pick this lake</button>
      <span class="picks-sub">The finder chooses one store piece under $25.</span>
    </div>`;
}

/** A finder asked for their live lake to come down: take it down, or keep it with a reason. */
async function decideTakedown(id, decision, btn) {
  const name = mapmakerName(id);
  let note = '';
  if (decision === 'remove') {
    const sub = allSubmissions.find((s) => cardId(s) === id);
    const picked = (sub && (sub.pick || sub.mapmakerPickId)) || ((picksData && picksData.takedowns) || []).some((t) => t.id === id && t.picked);
    if (!window.confirm(`Take ${name} off the map? Its photos and the finder's details on the entry and in the edit log are deleted, and the finder is emailed. This cannot be undone.${picked ? '\n\nThis lake has a Mapmakers pick. It is not withdrawn by this; withdraw it in Picks if it should be.' : ''}`)) return;
  } else {
    const answer = window.prompt(`Keep ${name} on the map? The finder is emailed; say why (sent to them):`, '');
    if (answer === null) return;
    note = answer.trim();
  }
  btn.disabled = true;
  try {
    const res = await apiFetch('/paddlingOut/admin/mapmakers/takedown', { method: 'POST', body: JSON.stringify({ submissionId: id, decision, note }) });
    if (!res) throw new Error('Session expired. Please sign in again.');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
    showSuccess(`${decision === 'remove' ? 'Taken down.' : 'Kept.'} ${data.emailed ? 'The finder has been emailed.' : 'There is no email on the entry, so nobody was told.'}`);
    await load();
    if (currentFilter === 'picks') await loadPicks(picksMonth);
  } catch (err) {
    showError(err.message || 'Could not record the decision.');
    btn.disabled = false;
  }
}

/** Kortex → "Send their link": a fresh kaay.link/m link to the finder (their code if they had none). */
async function sendFinderLink(id, btn) {
  btn.disabled = true;
  try {
    const res = await apiFetch('/paddlingOut/admin/mapmakers/send-link', { method: 'POST', body: JSON.stringify({ submissionId: id }) });
    if (!res) throw new Error('Session expired. Please sign in again.');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
    if (data.sent === false) showError(`Not sent to ${data.to}: ${data.reason || 'try again tomorrow.'}`);
    else showSuccess(`Sent a link to their Mapmakers page to ${data.to}.`);
  } catch (err) {
    showError(err.message || 'Could not send the link.');
  }
  btn.disabled = false;
}

async function pickLake(id, btn) {
  const sub = allSubmissions.find((s) => cardId(s) === id);
  const name = mapmakerName(id);
  if (!window.confirm(`Pick ${name} for this month's Mapmakers? This emails the finder a link to choose one store piece, free.`)) return;
  btn.disabled = true;
  try {
    const res = await apiFetch('/paddlingOut/admin/mapmakers/picks', { method: 'POST', body: JSON.stringify({ submissionId: id }) });
    if (!res) throw new Error('Session expired. Please sign in again.');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Pick failed (${res.status})`);
    if (sub) { sub.mapmakerPickId = data.pickId; sub.pick = { id: data.pickId, number: data.number, status: 'issued', piece: null }; }
    picksData = null;
    if (currentFilter === 'picks') await loadPicks(picksMonth);
    showSuccess(`Picked: No. ${data.number} of ${data.cap} this month. ${data.emailStatus === 'queued' ? 'The finder has been emailed.' : 'The email did not go: use Resend in Picks.'}`);
    renderList();
    renderTabs();
  } catch (err) {
    showError(err.message || 'Could not pick this lake.');
    btn.disabled = false;
  }
}

async function loadReports(status) {
  if (listEl && currentFilter === 'reports') listEl.innerHTML = '<div class="loading">Loading reports…</div>';
  try {
    const res = await apiFetch(`/paddlingOut/admin/reports?status=${encodeURIComponent(status || 'pending')}`);
    if (!res) return;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Failed to load reports (${res.status})`);
    reportsData = data;
    reportsStatus = data.status;
    renderTabs();
    if (currentFilter === 'reports') renderReports();
  } catch (err) {
    if (listEl && currentFilter === 'reports') listEl.innerHTML = `<div class="submissions-error">${escapeHtml(err.message)}</div>`;
  }
}

/** The Reports tab: each report, its photo, and Approve / Reject (the reporter is emailed if they left an address). */
function renderReports() {
  if (!listEl) return;
  if (!reportsData) { listEl.innerHTML = '<div class="loading">Loading reports…</div>'; return; }
  const tabs = ['pending', 'approved', 'rejected', 'withdrawn', 'removed'].map((st) =>
    `<button type="button" class="btn ${st === reportsData.status ? 'btn-primary' : 'btn-secondary'}" data-action="reports-status" data-id="${st}">${escapeHtml(st[0].toUpperCase() + st.slice(1))}</button>`).join('');
  const help = '<p class="picks-help">What paddlers say they saw at a spot, with the day. You cannot confirm a report, only judge it. An approved report shows on the spot page, with its note, photo and name, until a year after the day seen (marked old after 90 days), and never changes the Paddle Score. A report on a spot still in review can be approved only once the spot is approved. Take an approved report down if it is wrong or its sender asks: it stops showing and its photo and the sender\'s details are deleted.</p>';
  const rows = reportsData.reports.map((r) => {
    const photo = r.photo ? `<a href="${escapeHtml(r.photo)}" target="_blank" rel="noopener">photo</a>` : 'no photo';
    const acts = reportsData.status === 'pending'
      ? `<div class="picks-acts"><button type="button" class="btn btn-primary" data-action="report-approve" data-id="${jsAttr(r.id)}">Approve</button><button type="button" class="btn btn-secondary" data-action="report-reject" data-id="${jsAttr(r.id)}">Reject</button></div>`
      : reportsData.status === 'approved'
        ? `<div class="picks-acts"><button type="button" class="btn btn-danger" data-action="report-remove" data-id="${jsAttr(r.id)}">Take down</button></div>`
        : '';
    return `<div class="picks-row">
        <span class="picks-n">${escapeHtml(r.kind || '')}</span>
        <div class="picks-main"><strong>${escapeHtml(r.label || r.type)}</strong> <span class="picks-sub">at ${escapeHtml(r.lakeName || r.spotId)}${r.spotPending ? ' (spot still in review)' : ''}</span>
          <div class="picks-sub">Seen ${escapeHtml(r.seenOn || '')} &middot; ${r.creditName ? `by ${escapeHtml(r.creditName)}` : 'no name'} &middot; ${r.hasEmail ? 'has an email' : 'no email'} &middot; ${photo}</div>
          ${r.note ? `<div class="picks-held">${escapeHtml(r.note)}</div>` : ''}
          ${r.rejectionReason ? `<div class="picks-sub">Reason: ${escapeHtml(r.rejectionReason)}</div>` : ''}
        </div>${acts}</div>`;
  }).join('');
  listEl.innerHTML = `<div class="picks-panel"><div class="picks-nav">${tabs}</div>${help}${rows || `<div class="submissions-empty">No ${escapeHtml(reportsData.status)} reports.</div>`}</div>`;
}

async function decideReport(id, decision, btn) {
  let reason = '';
  if (decision === 'remove' && !window.confirm('Take this report down? It stops showing, and its photo and the sender\'s details are deleted. This cannot be undone.')) return;
  if (decision === 'reject') {
    const answer = window.prompt('Reason (optional). It is emailed to the person who sent it, if they left an address, and shown on their Mapmakers page.', '');
    if (answer === null) return;
    reason = answer.trim();
  }
  btn.disabled = true;
  try {
    const res = await apiFetch(`/paddlingOut/admin/reports/${encodeURIComponent(id)}/${decision}`, { method: 'POST', body: JSON.stringify({ reason }) });
    if (!res) throw new Error('Session expired. Please sign in again.');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
    showSuccess(decision === 'remove' ? 'Taken down.' : `${decision === 'approve' ? 'Approved: it shows on the spot page.' : 'Rejected.'} ${data.emailed ? 'The reporter has been emailed.' : 'No email on it, so nobody was told.'}`);
    await loadReports(reportsStatus);
  } catch (err) {
    showError(err.message || 'Could not record the decision.');
    btn.disabled = false;
  }
}

async function loadPicks(month) {
  if (listEl && currentFilter === 'picks') listEl.innerHTML = '<div class="loading">Loading picks…</div>';
  try {
    const q = month ? `?month=${encodeURIComponent(month)}` : '';
    const [res, more] = await Promise.all([
      apiFetch(`/paddlingOut/admin/mapmakers/picks${q}`),
      apiFetch('/paddlingOut/admin/mapmakers/candidates')
    ]);
    if (!res) return;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Failed to load picks (${res.status})`);
    const extra = more && more.ok ? await more.json().catch(() => ({})) : {};
    data.candidates = Array.isArray(extra.candidates) ? extra.candidates : [];
    data.takedowns = Array.isArray(extra.takedowns) ? extra.takedowns : [];
    picksData = data;
    picksMonth = data.month;
    renderTabs();
    if (currentFilter === 'picks') renderPicks();
  } catch (err) {
    if (listEl && currentFilter === 'picks') listEl.innerHTML = `<div class="submissions-error">${escapeHtml(err.message)}</div>`;
  }
}

function shiftMonth(month, by) {
  const [y, m] = String(month).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The Picks tab: this month's picks, what each is waiting on, and what you can do. */
function renderPicks() {
  if (countEl) countEl.textContent = picksData ? `${picksData.count} of ${picksData.cap} picked in ${picksData.monthLabel}` : '';
  if (!picksData) { listEl.innerHTML = '<div class="loading">Loading picks…</div>'; return; }
  const nav = `<div class="picks-nav">
      <button type="button" class="btn btn-secondary" data-action="picks-month" data-id="${jsAttr(shiftMonth(picksData.month, -1))}">&larr; Earlier</button>
      <strong>${escapeHtml(picksData.monthLabel)}</strong>
      <button type="button" class="btn btn-secondary" data-action="picks-month" data-id="${jsAttr(shiftMonth(picksData.month, 1))}">Later &rarr;</button>
    </div>
    <p class="picks-help">Pick from an approved lake&rsquo;s card (Approved tab). The finder gets a link to choose one of Kaayko&rsquo;s own pieces under $25 and claim it at $0; a claimed pick appears in Orders like any order, with the piece, the size and where to ship it. A claim is held when its address already received a piece this month, when it completed a checkout the finder had replaced, when Stripe gave no US address, or when it completed after the pick expired. Withdraw and Release both email the finder.</p>`;
  if (!picksData.picks.length) { listEl.innerHTML = `<div class="picks-panel">${nav}<div class="submissions-empty">No picks in ${escapeHtml(picksData.monthLabel)} yet.</div></div>`; return; }
  const rows = picksData.picks.map((p) => {
    const acts = [];
    if (p.status === 'issued' || p.status === 'claiming') acts.push(['pick-resend', 'Resend link']);
    if (p.status === 'held') acts.push(['pick-release', 'Release']);
    if (!['shipped', 'revoked', 'expired'].includes(p.status)) acts.push(['pick-revoke', 'Withdraw']);
    const when = p.claimBy && (p.status === 'issued' || p.status === 'claiming') ? `claim by ${new Date(p.claimBy).toLocaleDateString()}` : '';
    const held = p.status === 'held'
      ? `<div class="picks-held">Held: ${escapeHtml(String(p.heldReason || '').replace(/_/g, ' '))}${p.heldPiece ? ` &middot; that checkout was for ${escapeHtml(p.heldPiece)}, which Release ships` : ''}${p.shipTo ? ` &middot; ship to ${escapeHtml(p.shipTo.name)}, ${escapeHtml(p.shipTo.city)} ${escapeHtml(p.shipTo.state)}` : ''}</div>`
      : (p.lateCompletion ? '<div class="picks-held">Its checkout completed after it was withdrawn; nothing was ordered. Write to the finder if they should still have a piece.</div>' : '');
    return `<div class="picks-row picks-row--${escapeHtml(p.status)}">
        <span class="picks-n">No. ${escapeHtml(String(p.number))}</span>
        <div class="picks-main">
          <strong>${escapeHtml(p.lakeName)}</strong> <span class="picks-sub">${escapeHtml(p.place || '')}</span>
          <div class="picks-sub">${p.piece ? `${escapeHtml(p.piece)}${p.size ? ` (${escapeHtml(p.size)})` : ''}` : 'Piece not chosen yet'}${p.finderName ? ` &middot; for ${escapeHtml(p.finderName)}` : ''} &middot; ${escapeHtml(PICK_STATUS[p.status] || p.status)}${p.orderNumber ? ` &middot; ${escapeHtml(p.orderNumber)}` : ''}${when ? ` &middot; ${escapeHtml(when)}` : ''}${p.emailStatus === 'failed' ? ' &middot; <em>email failed</em>' : ''}</div>
          ${held}
        </div>
        <div class="picks-acts">${acts.map(([a, l]) => `<button type="button" class="btn btn-secondary" data-action="${a}" data-id="${jsAttr(p.id)}">${l}</button>`).join('')}</div>
      </div>`;
  }).join('');
  listEl.innerHTML = `<div class="picks-panel">${nav}${rows}${mapmakerQueues()}</div>`;
}

/**
 * The work the Approved list may not show (it loads the newest entries only): every
 * open take-down request, and every approved lake up for the picks not yet picked.
 */
function mapmakerQueues() {
  const d = picksData || {};
  const take = (d.takedowns || []).map((t) => `<div class="picks-row picks-row--held">
      <span class="picks-n">&mdash;</span>
      <div class="picks-main"><strong>${escapeHtml(t.lakeName)}</strong> <span class="picks-sub">${escapeHtml(t.place || '')}</span>
        <div class="picks-sub">Take-down asked${t.requestedAt ? ` ${escapeHtml(new Date(t.requestedAt).toLocaleDateString())}` : ''}${t.finderName ? ` &middot; by ${escapeHtml(t.finderName)}` : ''}${t.picked ? ' &middot; this lake has a pick: withdraw it too if you take the lake down' : ''}</div></div>
      <div class="picks-acts">
        <button type="button" class="btn btn-danger" data-action="takedown-remove" data-id="${jsAttr(t.id)}">Take it down</button>
        <button type="button" class="btn btn-secondary" data-action="takedown-keep" data-id="${jsAttr(t.id)}">Keep it</button>
      </div></div>`).join('');
  const cand = (d.candidates || []).map((c) => `<div class="picks-row">
      <span class="picks-n">&mdash;</span>
      <div class="picks-main"><strong>${escapeHtml(c.lakeName)}</strong> <span class="picks-sub">${escapeHtml(c.place || '')}</span>
        <div class="picks-sub">Up for the picks${c.finderName ? ` &middot; ${escapeHtml(c.finderName)}` : ''}${c.validatedAt ? ` &middot; approved ${escapeHtml(new Date(c.validatedAt).toLocaleDateString())}` : ''}</div></div>
      <div class="picks-acts"><button type="button" class="btn btn-primary" data-action="pick" data-id="${jsAttr(c.id)}">Pick</button></div></div>`).join('');
  return (take ? `<h3 class="picks-h">Take-down requests (${(d.takedowns || []).length})</h3>${take}` : '')
    + `<h3 class="picks-h">Up for the picks, not picked yet (${(d.candidates || []).length})</h3>${cand || '<div class="submissions-empty">None right now.</div>'}`;
}

/** A lake's name from the loaded list, or from the Picks tab's own lists. */
function mapmakerName(id) {
  const sub = allSubmissions.find((s) => cardId(s) === id);
  if (sub && sub.lakeName) return sub.lakeName;
  const d = picksData || {};
  const x = (d.candidates || []).concat(d.takedowns || []).find((c) => c.id === id);
  return (x && x.lakeName) || 'this lake';
}

async function pickAction(pickId, what, btn) {
  const p = picksData && picksData.picks.find((x) => x.id === pickId);
  const name = p ? `${p.lakeName} (No. ${p.number})` : 'this pick';
  let body = {};
  if (what === 'revoke') {
    const reason = window.prompt(`Withdraw ${name}? The pick can no longer be claimed, an open checkout is closed, an unshipped order is cancelled and the month's slot comes back. The finder is emailed. Reason (sent to them, and kept in the log):`, '');
    if (reason === null) return;
    body = { reason };
  } else if (what === 'release' && !window.confirm(`Release ${name}? An order is written and it ships like any other.`)) {
    return;
  }
  btn.disabled = true;
  try {
    const res = await apiFetch(`/paddlingOut/admin/mapmakers/picks/${encodeURIComponent(pickId)}/${what}`, { method: 'POST', body: JSON.stringify(body) });
    if (!res) throw new Error('Session expired. Please sign in again.');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
    // Say what actually happened to the email, not what should have.
    if (what === 'resend') {
      if (data.emailStatus === 'queued') showSuccess('The pick email was sent again with a fresh link. Earlier links keep working until they expire; to end them all, the finder asks for a new code on their page.');
      else showError('The pick email did not go. Try Resend again in a minute.');
    } else if (what === 'release') {
      showSuccess(`Released: ${data.orderNumber || 'order written'}. The finder is emailed.`);
    } else {
      showSuccess(data.emailed === false ? 'Withdrawn. There is no email for this finder, so they were not told.' : 'Withdrawn. The finder is emailed.');
    }
    await load();
    await loadPicks(picksMonth);
  } catch (err) {
    showError(err.message || 'That did not work.');
    btn.disabled = false;
  }
}

/**
 * Reviewer-only: other entries that may be the same person (contributors.js on
 * the server — the same email, or the same network, with or without the same
 * browser). Never shown publicly. A shared network is common, so it is a prompt
 * to look before naming a lake or picking it, not a reason to reject.
 */
function samePersonFlag(sub) {
  const list = Array.isArray(sub.samePerson) ? sub.samePerson : [];
  if (!list.length) return '';
  const statusWord = { validated: 'approved', rejected: 'rejected', pending: 'pending' };
  const items = list.map((e) => `<li><strong>${escapeHtml(e.lakeName || e.id)}</strong> &middot; ${escapeHtml(statusWord[e.status] || e.status || '')}${e.kind === 'edit' ? ' edit' : ''}, ${e.hasEmail ? 'with an email' : 'no email'} &middot; <em>${escapeHtml(e.why || '')}</em></li>`).join('');
  return `<div class="sub-flag sub-flag--same">Maybe the same person as ${list.length === 1 ? 'one other entry' : `${list.length} other entries`}:<ul class="sub-same-list">${items}</ul></div>`;
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
