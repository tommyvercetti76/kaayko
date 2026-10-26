/**
 * Kreators View Module
 * Review queue for seller applications, and the list of sellers.
 *
 * Built 26 Oct 2026. The old review console (src/kreator/admin/index.html) was
 * deleted on 3 Oct with the X-Admin-Key backdoor it shipped, which left approval
 * reachable only by curl. These are the same endpoints, behind the admin sign-in:
 *   GET  /kreators/admin/applications?status=…          → { applications, total }
 *   PUT  /kreators/admin/applications/:id/approve {notes} → creates the seller, emails the activation link
 *   PUT  /kreators/admin/applications/:id/reject  {reason, notes}
 *   GET  /kreators/admin/list?status=active|pending_password → { kreators }
 *   POST /kreators/admin/:uid/resend-link                → a new activation link (the old one stops working)
 *   GET  /kreators/admin/listings?status=pending|approved → listings by review state
 *   PUT  /kreators/admin/listings/:id/review {decision, note} → approve (on the store) or send back
 *   GET  /kreators/admin/store-address?name=|handle=      → the shop address and whether it is free
 *   POST /kreators/admin/:uid/store-address {handle}      → give a seller an address (kaay.store/kreator/<h>, kaay.link/<h>)
 * Approving names the shop: kaay.store/kreator/<handle> and kaay.link/<handle>,
 * checked free on both and on every shelf before the account is created.
 * Every route is requirePlatformAdmin: a self-serve tenant admin gets 403.
 *
 * SECURITY: everything an applicant typed is untrusted. Text goes through
 * escapeHtml; links are shown only when they are plain http(s); actions use
 * data-attributes and one delegated listener, never onclick strings.
 */

import { apiFetch, CONFIG } from '../../js/config.js';
import { escapeHtml, formatDate, showSuccess, showError } from '../../js/utils.js';

const TABS = [
  { key: 'pending',  label: 'Applications',  load: () => applications('pending') },
  { key: 'listings', label: 'Listings to review', load: () => listings('pending') },
  { key: 'approved', label: 'Approved', load: () => applications('approved') },
  { key: 'rejected', label: 'Rejected', load: () => applications('rejected') },
  { key: 'sellers',  label: 'Sellers',  load: sellers },
  { key: 'live',     label: 'Live listings', load: () => listings('approved') },
];

const LABELS = {
  priceRange: { under_25: 'Under $25', '25_50': '$25–50', '50_100': '$50–100', '100_250': '$100–250', '250_500': '$250–500', '500_plus': '$500+' },
  shippingCapability: { domestic_only: 'US only', north_america: 'North America', international: 'International', local_pickup: 'Local pickup' },
  fulfillmentTime: { '1-2_days': '1–2 days', '3-5_days': '3–5 days', '1-2_weeks': '1–2 weeks', '2-4_weeks': '2–4 weeks', varies: 'Varies' },
  inventoryManagement: { ready_stock: 'Ready stock', made_to_order: 'Made to order', dropship: 'Dropship', hybrid: 'Hybrid' },
};

let current = 'pending';
let listEl = null;

export async function init() {
  const container = document.getElementById('kreators-view');
  if (!container) return;
  current = 'pending';
  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Kreators</h1>
        <p class="view-subtitle">Seller applications and the sellers you have approved. Approving creates the account and emails the applicant an activation link.</p>
      </div>
      <button type="button" class="btn btn-secondary" id="kreators-refresh">Refresh</button>
    </header>
    <div class="card kreators-card">
      <div class="kreators-tabs" role="tablist">
        ${TABS.map((t) => `<button type="button" class="kreators-tab${t.key === current ? ' active' : ''}" role="tab" data-tab="${t.key}" aria-selected="${t.key === current}">${t.label}</button>`).join('')}
      </div>
      <div class="kreators-list" id="kreators-list"><p class="kreators-empty">Loading…</p></div>
    </div>`;
  listEl = container.querySelector('#kreators-list');
  container.querySelector('#kreators-refresh').addEventListener('click', render);
  container.querySelector('.kreators-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    current = tab.dataset.tab;
    container.querySelectorAll('.kreators-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === current);
      b.setAttribute('aria-selected', String(b.dataset.tab === current));
    });
    render();
  });
  listEl.addEventListener('click', onAction);
  await render();
}

async function getJson(path, init) {
  const res = await apiFetch(path, init);
  if (!res) throw new Error('Signed out');
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const err = new Error(body.message || body.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body.data;
}

async function applications(status) {
  const data = await getJson(`/kreators/admin/applications?status=${status}&limit=100`);
  return (data.applications || []).map(applicationCard).join('') || empty(status === 'pending' ? 'No applications waiting.' : `No ${status} applications.`);
}

async function sellers() {
  const [active, waiting] = await Promise.all([
    getJson('/kreators/admin/list?status=active&limit=100'),
    getJson('/kreators/admin/list?status=pending_password&limit=100'),
  ]);
  const rows = [...(waiting.kreators || []), ...(active.kreators || [])].map(sellerCard).join('');
  return rows || empty('No sellers yet.');
}

async function listings(status) {
  const data = await getJson(`/kreators/admin/listings?status=${status}`);
  return (data.listings || []).map(listingCard).join('') || empty(status === 'pending' ? 'No listings waiting for review.' : 'No live kreator listings.');
}

function listingCard(p) {
  const img = (p.imgSrc || []).map(safeUrl).filter(Boolean);
  const actions = p.reviewStatus === 'pending'
    ? `<div class="kreators-actions">
         <button type="button" class="btn btn-primary" data-act="list-approve" data-id="${escapeHtml(p.id)}">Approve — put on the store</button>
         <button type="button" class="btn btn-secondary" data-act="list-reject" data-id="${escapeHtml(p.id)}">Send back…</button>
       </div>`
    : `<div class="kreators-actions"><button type="button" class="btn btn-secondary" data-act="list-reject" data-id="${escapeHtml(p.id)}">Take down and send back…</button></div>`;
  return `
    <article class="kreators-item">
      <header class="kreators-item-head">
        <div>
          <h3>${escapeHtml(p.title)} · $${Number(p.actualPrice || 0).toFixed(2)}</h3>
          <p>${escapeHtml(p.storeName || '')} · ${escapeHtml(p.sellerEmail || '')}</p>
        </div>
        <span class="kreators-status kreators-status-${p.reviewStatus === 'approved' ? 'approved' : 'pending'}">${p.reviewStatus === 'approved' ? 'live' : 'waiting'}</span>
      </header>
      ${img.length ? `<div class="kreators-photos">${img.map((u) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener"><img src="${escapeHtml(u)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
      <p class="kreators-desc">${escapeHtml(p.description || '')}</p>
      <dl class="kreators-rows">
        ${row('Kind', escapeHtml([p.category, p.productType].filter(Boolean).join(' · ')))}
        ${row('Options', escapeHtml((p.availableSizes || []).join(', ')))}
        ${row('Tags', escapeHtml((p.tags || []).join(', ')))}
        ${row('Story', escapeHtml(p.storyCopy || ''))}
        ${row('Seller has it', p.isAvailable ? 'switched on' : 'switched off')}
        ${row('Submitted', escapeHtml(p.submittedForReviewAt ? formatDate(p.submittedForReviewAt) : ''))}
      </dl>
      ${actions}
    </article>`;
}

async function render() {
  if (!listEl) return;
  listEl.innerHTML = '<p class="kreators-empty">Loading…</p>';
  try {
    listEl.innerHTML = await TABS.find((t) => t.key === current).load();
  } catch (e) {
    listEl.innerHTML = empty(e.status === 403 ? 'Kreators needs a platform administrator.' : `Could not load: ${escapeHtml(e.message)}`);
  }
}

const empty = (text) => `<p class="kreators-empty">${escapeHtml(text)}</p>`;
const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : null);
const label = (field, v) => LABELS[field]?.[v] || v || '—';

function row(name, value) {
  return value ? `<div class="kreators-row"><dt>${escapeHtml(name)}</dt><dd>${value}</dd></div>` : '';
}

function applicationCard(a) {
  const site = safeUrl(a.website);
  const expires = a.expiresAt ? new Date(a.expiresAt) : null;
  const expired = expires && expires < new Date() && a.status === 'pending';
  const actions = a.status === 'pending' && !expired
    ? `<div class="kreators-actions">
         <button type="button" class="btn btn-primary" data-act="approve" data-id="${escapeHtml(a.id)}" data-name="${escapeHtml(a.businessName || a.email)}">Approve…</button>
         <button type="button" class="btn btn-secondary" data-act="reject" data-id="${escapeHtml(a.id)}">Reject</button>
       </div>`
    : a.status === 'approved' && a.kreatorId
      ? `<div class="kreators-actions"><button type="button" class="btn btn-secondary" data-act="resend" data-uid="${escapeHtml(a.kreatorId)}">Resend activation link</button></div>`
      : '';
  return `
    <article class="kreators-item">
      <header class="kreators-item-head">
        <div>
          <h3>${escapeHtml(a.businessName || '(no business name)')}</h3>
          <p>${escapeHtml(a.displayName || [a.firstName, a.lastName].filter(Boolean).join(' '))} · <a href="mailto:${escapeHtml(a.email)}">${escapeHtml(a.email)}</a></p>
        </div>
        <span class="kreators-status kreators-status-${escapeHtml(expired ? 'expired' : a.status)}">${escapeHtml(expired ? 'expired' : a.status)}</span>
      </header>
      <p class="kreators-desc">${escapeHtml(a.productDescription || '')}</p>
      <dl class="kreators-rows">
        ${row('Sells', escapeHtml((a.productCategories || []).join(', ')))}
        ${row('Listings', escapeHtml(a.productCount || ''))}
        ${row('Price range', escapeHtml(label('priceRange', a.priceRange)))}
        ${row('Ships', escapeHtml(label('shippingCapability', a.shippingCapability)))}
        ${row('Fulfilment', escapeHtml(label('fulfillmentTime', a.fulfillmentTime)))}
        ${row('Inventory', escapeHtml(label('inventoryManagement', a.inventoryManagement)))}
        ${row('Location', escapeHtml(a.location || ''))}
        ${row('Phone', escapeHtml(a.phone || ''))}
        ${row('Website', site ? `<a href="${escapeHtml(site)}" target="_blank" rel="noopener noreferrer">${escapeHtml(site)}</a>` : escapeHtml(a.website || ''))}
        ${row('Sells elsewhere', escapeHtml(a.otherPlatforms || ''))}
        ${row('Notes', escapeHtml(a.additionalInfo || ''))}
        ${row('Submitted', escapeHtml(a.submittedAt ? formatDate(a.submittedAt) : ''))}
        ${a.status === 'pending' ? row(expired ? 'Expired' : 'Expires', escapeHtml(expires ? formatDate(expires.toISOString()) : '')) : ''}
        ${row('Reason', escapeHtml(a.rejectionReason || ''))}
      </dl>
      ${actions}
    </article>`;
}

const qrFor = (handle) => (CONFIG.ENVIRONMENT === 'production' || !CONFIG.API_BASE.includes('127.0.0.1')
  ? `https://kaay.link/qr/${encodeURIComponent(handle)}.png`
  : `${CONFIG.API_BASE}/qr/${encodeURIComponent(handle)}.png`);

function shopLines(k) {
  if (k.storeHandle && !k.storeLinkReady) {
    return `<p class="kreators-shopless">Shop address kaay.store/kreator/${escapeHtml(k.storeHandle)} is reserved, but its kaay.link link is not made yet.</p>`;
  }
  if (!k.storeHandle) {
    return `<p class="kreators-shopless">No shop address yet (approved before addresses existed).</p>`;
  }
  return `<div class="kreators-shop">
      <img src="${escapeHtml(qrFor(k.storeHandle))}" alt="QR for kaay.link/${escapeHtml(k.storeHandle)}" width="72" height="72" loading="lazy">
      <div>
        <a href="https://kaay.store/kreator/${encodeURIComponent(k.storeHandle)}" target="_blank" rel="noopener">kaay.store/kreator/${escapeHtml(k.storeHandle)}</a>
        <a href="https://kaay.link/${encodeURIComponent(k.storeHandle)}" target="_blank" rel="noopener">kaay.link/${escapeHtml(k.storeHandle)}</a>
      </div>
    </div>`;
}

function sellerCard(k) {
  const waiting = k.status === 'pending_password';
  return `
    <article class="kreators-item">
      <header class="kreators-item-head">
        <div>
          <h3>${escapeHtml(k.businessName || k.displayName || '(no name)')}</h3>
          <p>${escapeHtml([k.firstName, k.lastName].filter(Boolean).join(' '))} · <a href="mailto:${escapeHtml(k.email)}">${escapeHtml(k.email)}</a></p>
        </div>
        <span class="kreators-status kreators-status-${waiting ? 'pending' : 'approved'}">${waiting ? 'not activated' : 'active'}</span>
      </header>
      ${shopLines(k)}
      <dl class="kreators-rows">
        ${row('Listings', escapeHtml(String(k.stats?.totalProducts ?? 0)))}
        ${row('Location', escapeHtml(k.location || ''))}
        ${row('Approved', escapeHtml(k.createdAt ? formatDate(k.createdAt) : ''))}
      </dl>
      <div class="kreators-actions">
        ${waiting ? `<button type="button" class="btn btn-secondary" data-act="resend" data-uid="${escapeHtml(k.uid)}">Resend activation link</button>` : ''}
        ${!k.storeHandle
          ? `<button type="button" class="btn btn-secondary" data-act="address" data-uid="${escapeHtml(k.uid)}" data-name="${escapeHtml(k.businessName || '')}">Give shop address…</button>`
          : k.storeLinkReady ? '' : `<button type="button" class="btn btn-primary" data-act="finish-link" data-uid="${escapeHtml(k.uid)}" data-handle="${escapeHtml(k.storeHandle)}">Finish kaay.link link</button>`}
      </div>
    </article>`;
}

/**
 * Ask for the shop's address, starting from the server's suggestion, until it is
 * free on kaay.store, kaay.link and the shelves, or the admin cancels.
 */
async function chooseHandle(name) {
  let suggestion = (await getJson(`/kreators/admin/store-address?name=${encodeURIComponent(name || '')}`)).handle;
  for (;;) {
    const typed = prompt('Shop address — kaay.store/kreator/… and kaay.link/…\n(lower-case letters, numbers and hyphens)', suggestion || '');
    if (typed === null) return null;
    const check = await getJson(`/kreators/admin/store-address?handle=${encodeURIComponent(typed.trim().toLowerCase())}`);
    if (check.ok) return check.handle;
    alert(check.message);
    suggestion = typed;
  }
}

async function onAction(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const { act, id, uid, name, handle: knownHandle } = btn.dataset;
  try {
    if (act === 'approve') {
      const handle = await chooseHandle(name);
      if (!handle) return;
      if (!confirm(`Approve ${name}?\n\nShop: kaay.store/kreator/${handle}\nShort link and QR: kaay.link/${handle}\n\nThis creates their seller account and emails them an activation link. The shop address cannot be changed later.`)) return;
      btn.disabled = true;
      const data = await getJson(`/kreators/admin/applications/${encodeURIComponent(id)}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle }) });
      const parts = [`Approved: kaay.store/kreator/${data.handle || handle}.`];
      parts.push(data.emailQueued ? `Activation link emailed to ${data.kreatorEmail}.` : `The activation email did NOT queue — use Resend on the Sellers tab.`);
      if (data.handleError) parts.push(`Shop address not finished (${data.handleError}) — use Give shop address on the Sellers tab.`);
      (data.emailQueued && !data.handleError ? showSuccess : showError)(parts.join(' '));
    } else if (act === 'address') {
      const handle = await chooseHandle(name);
      if (!handle) return;
      if (!confirm(`Give this shop kaay.store/kreator/${handle} and kaay.link/${handle}? It cannot be changed later.`)) return;
      btn.disabled = true;
      await getJson(`/kreators/admin/${encodeURIComponent(uid)}/store-address`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle }) });
      showSuccess(`Shop address set: kaay.store/kreator/${handle}`);
    } else if (act === 'reject') {
      const reason = prompt('Why is this application refused? The applicant sees this.', '');
      if (!reason || !reason.trim()) return;
      btn.disabled = true;
      await getJson(`/kreators/admin/applications/${encodeURIComponent(id)}/reject`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() }) });
      showSuccess('Rejected.');
    } else if (act === 'finish-link') {
      btn.disabled = true;
      await getJson(`/kreators/admin/${encodeURIComponent(uid)}/store-address`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle: knownHandle }) });
      showSuccess(`kaay.link/${knownHandle} now opens the shop.`);
    } else if (act === 'list-approve') {
      btn.disabled = true;
      await getJson(`/kreators/admin/listings/${encodeURIComponent(id)}/review`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'approve' }) });
      showSuccess('Approved. It is on the store, and the seller has been told.');
    } else if (act === 'list-reject') {
      const note = prompt('What should the seller change? They see this.', '');
      if (!note || note.trim().length < 5) return;
      btn.disabled = true;
      await getJson(`/kreators/admin/listings/${encodeURIComponent(id)}/review`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'reject', note: note.trim() }) });
      showSuccess('Sent back. It is off the store and the seller has the note.');
    } else if (act === 'resend') {
      if (!confirm('Send a new activation link? The previous link stops working.')) return;
      btn.disabled = true;
      const data = await getJson(`/kreators/admin/${encodeURIComponent(uid)}/resend-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      showSuccess(`New activation link emailed to ${data.email}.`);
    }
    await render();
  } catch (err) {
    btn.disabled = false;
    showError(err.message);
  }
}
