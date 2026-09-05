/**
 * Orders View Module
 * Fulfilment queue for the Kaayko store — one person, one box at a time.
 *
 * Wires the admin order endpoints into the Kortex admin SPA:
 *   GET  /admin/listOrders?groupByOrder=true&limit=N  → one shipment per payment intent
 *   POST /admin/updateOrderStatus                     → advance a whole order
 *
 * WHY SHIPMENTS, NOT ORDERS: the `orders` collection stores ONE DOCUMENT PER
 * LINE ITEM (`{paymentIntentId}_item{n}`), carrying per-item money only. The
 * order-level total lives exactly once, on `payment_intents/{id}` — summing
 * line items would be a different number and is deliberately not done here.
 * `groupByOrder=true` does that join server-side and hands back a packing list:
 * address + every item + `orderTotalCents`. That is what this view renders.
 *
 * WHY WHOLE-ORDER ACTIONS: everything bought in one payment goes in one box
 * with one tracking number, so every action posts `parentOrderId` and the API
 * updates all line items at once. Partial shipments are a per-item operation
 * the API supports but this screen deliberately does not offer.
 *
 * SECURITY: customer email, customer name, shipping address, product titles,
 * sizes, genders, tracking numbers and carrier names are ALL UNTRUSTED — they
 * come from Stripe Checkout and from whatever a shopper typed. Every displayed
 * value goes through escapeHtml; every value placed in an HTML attribute goes
 * through jsAttr. Card actions use data-attributes plus a single delegated
 * listener — no onclick string is ever built from order data. Shipping
 * addresses are never written to the console.
 */

import { apiFetch } from '../../js/config.js';
import { escapeHtml, jsAttr, showSuccess, showError, copyToClipboard } from '../../js/utils.js';

// ---------------------------------------------------------------------------
// Vocabulary — mirrors ORDER_STATUSES in api/admin/updateOrderStatus.js.
// Sending anything outside this list is rejected by the API with a 400, and
// that message is surfaced verbatim rather than swallowed.
// ---------------------------------------------------------------------------

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'];

// The API's fulfillmentStatus vocabulary is separate and narrower; we only send
// the values that have an unambiguous orderStatus counterpart.
const FULFILLMENT_FOR = {
  processing: 'processing',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled'
};

// Carriers whose tracking URL the API can build. Anything else is accepted but
// produces a bare tracking number with no link.
const CARRIERS = ['USPS', 'UPS', 'FEDEX', 'DHL'];

const FILTERS = [
  { key: 'needs_action', label: 'Needs action', match: (s) => s === 'pending' || s === 'processing' },
  { key: 'pending',      label: 'New',          match: (s) => s === 'pending' },
  { key: 'processing',   label: 'Packing',      match: (s) => s === 'processing' },
  { key: 'shipped',      label: 'Shipped',      match: (s) => s === 'shipped' },
  { key: 'delivered',    label: 'Delivered',    match: (s) => s === 'delivered' },
  { key: 'returned',     label: 'Returned',     match: (s) => s === 'returned' },
  { key: 'cancelled',    label: 'Cancelled',    match: (s) => s === 'cancelled' },
  { key: 'all',          label: 'All',          match: () => true }
];

const STATUS_LABELS = {
  pending: 'New — not packed',
  processing: 'Packing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  returned: 'Returned',
  cancelled: 'Cancelled',
  mixed: 'Part-shipped'
};

const PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let shipments = [];
let currentFilter = 'needs_action';
let currentLimit = PAGE_SIZE;
let hasMore = false;

// Live DOM references, re-bound on every init() (the module is cached but
// init runs on each navigation and replaces the container's contents).
let listEl = null;
let tabsEl = null;
let countEl = null;
let moreEl = null;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export async function init(STATE) { // eslint-disable-line no-unused-vars
  const container = document.getElementById('orders-view');
  if (!container) return;

  currentFilter = 'needs_action';
  currentLimit = PAGE_SIZE;
  shipments = [];
  hasMore = false;

  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Orders</h1>
        <p class="view-subtitle">Paid orders, what goes in the box, and where it ships.</p>
      </div>
      <button type="button" class="btn btn-secondary" id="orders-refresh">Refresh</button>
    </header>

    <div class="mail-health" id="mail-health" hidden></div>

    <div class="card orders-card">
      <div class="orders-tabs" id="orders-tabs"></div>
      <div class="orders-count" id="orders-count"></div>
      <div class="orders-list" id="orders-list">
        <div class="loading">Loading orders…</div>
      </div>
      <div class="orders-more" id="orders-more"></div>
    </div>
  `;

  tabsEl = container.querySelector('#orders-tabs');
  countEl = container.querySelector('#orders-count');
  listEl = container.querySelector('#orders-list');
  moreEl = container.querySelector('#orders-more');

  // Filter tabs — delegated, so re-rendering the buttons is safe.
  tabsEl.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-filter]');
    if (!tab) return;
    currentFilter = tab.dataset.filter || 'needs_action';
    renderTabs();
    renderList();
  });

  // All card actions — ONE delegated listener on the persistent list container.
  listEl.addEventListener('click', onListClick);

  // Retry / load-more live outside the list.
  moreEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="load-more"]');
    if (!btn || btn.disabled) return;
    currentLimit += PAGE_SIZE;
    load();
  });

  const refreshBtn = container.querySelector('#orders-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', () => load());

  renderTabs();
  await load();
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

/**
 * Undelivered mail is invisible from the order list — an order reads "shipped"
 * whether or not the confirmation ever reached the buyer. Nothing re-drives a
 * failed mail document automatically, so surface it where fulfilment happens.
 * Counts and ids only; mail bodies stay server-side.
 */
async function loadMailHealth() {
  const el = document.getElementById('mail-health');
  if (!el) return;
  try {
    const res = await apiFetch('/admin/mailHealth');
    if (!res || !res.ok) return;
    const h = await res.json();
    const stuck = (h.error || 0) + (h.staleRetry || 0) + (h.processingStuck || 0);
    if (!stuck) { el.hidden = true; return; }

    const parts = [];
    if (h.error) parts.push(`${h.error} failed`);
    if (h.staleRetry) parts.push(`${h.staleRetry} stuck retrying`);
    if (h.processingStuck) parts.push(`${h.processingStuck} stalled mid-send`);
    el.innerHTML = `<strong>Email needs attention:</strong> ${escapeHtml(parts.join(', '))}. `
      + `Receipts or shipping confirmations have not reached those customers. `
      + `Nothing retries these automatically.`;
    el.hidden = false;
  } catch (_) {
    // An unavailable health check must never break the orders screen.
  }
}

async function load() {
  if (listEl) listEl.innerHTML = '<div class="loading">Loading orders…</div>';
  if (moreEl) moreEl.innerHTML = '';

  try {
    // No status filter on the query: fetching one page unfiltered avoids the
    // composite index the (status + createdAt) query needs, and gives every
    // tab an honest count from the same data.
    loadMailHealth();   // fire and forget; never blocks the order list
  const res = await apiFetch(`/admin/listOrders?groupByOrder=true&limit=${encodeURIComponent(currentLimit)}`);
    if (!res) return; // 401 → apiFetch already triggered logout
    if (!res.ok) throw new Error(await errorMessage(res, `Failed to load orders (${res.status})`));

    const data = await res.json();
    shipments = Array.isArray(data && data.shipments) ? data.shipments : [];
    hasMore = Boolean(data && data.hasMore);

    refreshUI();
  } catch (err) {
    // Deliberately logs the message only — order payloads contain addresses.
    console.error('[Orders] Failed to load:', err && err.message);
    if (listEl) {
      listEl.innerHTML = `
        <div class="orders-error">
          <p class="orders-error-msg">${escapeHtml(err && err.message ? err.message : 'Could not load orders.')}</p>
          <button type="button" class="btn btn-secondary" data-action="retry">Try again</button>
        </div>`;
    }
    if (countEl) countEl.textContent = '';
  }
}

/** Pull the API's real reason out of a failed response, never a generic one. */
async function errorMessage(res, fallback) {
  try {
    const d = await res.json();
    if (d && (d.error || d.message)) return String(d.error || d.message);
  } catch (_) { /* non-JSON error body */ }
  return fallback;
}

/**
 * Post one status transition for a whole order.
 * @param {object} body already-validated fields for /admin/updateOrderStatus
 */
async function postUpdate(body) {
  const res = await apiFetch('/admin/updateOrderStatus', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  if (!res) throw new Error('Session expired. Please sign in again.'); // 401 handled by apiFetch
  if (!res.ok) throw new Error(await errorMessage(res, `Update failed (${res.status})`));
  return res.json();
}

/** Send the customer a delay notice (FTC Mail Order Rule: notify before the promised date). */
async function postDelay(body) {
  const res = await apiFetch('/admin/orders/delay-notice', {
    method: 'POST',
    body: JSON.stringify(body)
  });
  if (!res) throw new Error('Session expired. Please sign in again.'); // 401 handled by apiFetch
  if (!res.ok) throw new Error(await errorMessage(res, `Update failed (${res.status})`));
  return res.json();
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function onListClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn || btn.disabled) return;

  const action = btn.dataset.action;

  if (action === 'retry') { load(); return; }

  const card = btn.closest('.order-card');
  const id = btn.dataset.id || (card && card.dataset.cardId);
  if (!id) return;

  if (action === 'copy-address') { copyAddress(id); return; }
  if (action === 'ship-open')   { toggleShipForm(card, true); return; }
  if (action === 'ship-cancel') { toggleShipForm(card, false); return; }
  if (action === 'ship-confirm') { confirmShip(id, card); return; }
  if (action === 'delay-open')   { toggleDelayForm(card, true); return; }
  if (action === 'delay-cancel') { toggleDelayForm(card, false); return; }
  if (action === 'delay-confirm') { confirmDelay(id, card); return; }
  if (action === 'status') { changeStatus(id, card, btn.dataset.status); return; }
}

/** Advance a whole order to a plain status (no tracking involved). */
async function changeStatus(parentOrderId, card, status) {
  if (!ORDER_STATUSES.includes(status)) {
    showError(`Unknown status "${status}".`);
    return;
  }

  // Irreversible from this screen: nothing here un-cancels or un-returns.
  if (status === 'cancelled' || status === 'returned') {
    const verb = status === 'cancelled' ? 'Cancel' : 'Mark returned';
    if (!window.confirm(`${verb} this entire order? Every item in it changes status and this cannot be undone from this screen.`)) return;
  }

  setCardBusy(card, true);
  try {
    const body = { parentOrderId, orderStatus: status };
    if (FULFILLMENT_FOR[status]) body.fulfillmentStatus = FULFILLMENT_FOR[status];
    await postUpdate(body);
    applyLocalStatus(parentOrderId, status);
    showSuccess(`Order marked ${status}.`);
    replaceCard(parentOrderId);
    renderTabs();
    updateCount();
    updateOrdersBadge(needsActionCount());
  } catch (err) {
    console.error('[Orders] Status update failed:', err && err.message);
    showError(err && err.message ? err.message : 'Could not update this order.');
    setCardBusy(card, false);
  }
}

function toggleShipForm(card, open) {
  if (!card) return;
  const form = card.querySelector('.order-ship-form');
  if (!form) return;
  form.hidden = !open;
  card.classList.toggle('is-shipping', open);
  if (open) {
    const input = form.querySelector('.order-tracking-input');
    if (input) input.focus();
  }
}

function toggleDelayForm(card, open) {
  if (!card) return;
  const form = card.querySelector('.order-delay-form');
  if (!form) return;
  form.hidden = !open;
  if (open) {
    const input = form.querySelector('.order-delay-date');
    if (input) { if (!input.min) input.min = new Date().toISOString().slice(0, 10); input.focus(); }
  }
}

/**
 * Tell the customer the order is running late. The rule: notify BEFORE the
 * promised ship date, give a new date, and offer cancel-for-refund. The email
 * template carries the offer; this just needs a real date.
 */
async function confirmDelay(parentOrderId, card) {
  if (!card) return;
  const form = card.querySelector('.order-delay-form');
  if (!form) return;
  const newEstimatedDate = String(form.querySelector('.order-delay-date').value || '').trim();
  const reason = String(form.querySelector('.order-delay-reason').value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newEstimatedDate)) { showError('Pick the new expected ship date first.'); return; }
  if (new Date(newEstimatedDate) < new Date(new Date().toDateString())) { showError('The new date has to be in the future.'); return; }

  setCardBusy(card, true);
  try {
    const res = await postDelay({ parentOrderId, newEstimatedDate, reason: reason || undefined });
    const shipment = shipments.find((sh) => sh.parentOrderId === parentOrderId);
    if (shipment) shipment.estimatedDelivery = newEstimatedDate;
    // The backend returns `queued` at the TOP LEVEL, not nested under
    // `customerNotification` — reading the nested shape meant `queued` was
    // always undefined, so a successfully sent notice was reported as "email
    // was not sent". See api/admin/orderNotices.js: { success, queued, mailId,
    // reason?, ... }. `queued:false` with reason 'already_sent_for_date' is a
    // legitimate no-op, not a failure.
    const queued = !!(res && res.queued);
    const reason = (res && res.reason) || '';
    showSuccess(queued
      ? `Delay notice sent — customer told to expect shipping by ${newEstimatedDate}.`
      : reason === 'already_sent_for_date'
        ? `Date recorded. The customer was already told this date, so no second email was sent.`
        : `Date recorded. Email was not sent${reason ? `: ${reason}` : ' — no customer email on the order'}.`);
    replaceCard(parentOrderId);
  } catch (err) {
    console.error('[Orders] Delay notice failed:', err && err.message);
    showError(err && err.message ? err.message : 'Could not send the delay notice.');
    setCardBusy(card, false);
  }
}

/** Mark a whole order shipped, with the tracking number and carrier. */
async function confirmShip(parentOrderId, card) {
  if (!card) return;
  const form = card.querySelector('.order-ship-form');
  if (!form) return;

  const trackingNumber = String(form.querySelector('.order-tracking-input').value || '').trim();
  const carrier = String(form.querySelector('.order-carrier-select').value || '').trim();
  const notify = form.querySelector('.order-notify-check').checked;

  if (!trackingNumber && !window.confirm('No tracking number entered. Mark this order shipped anyway? The customer will get an email with no tracking to follow.')) {
    return;
  }

  setCardBusy(card, true);
  try {
    const body = {
      parentOrderId,
      orderStatus: 'shipped',
      fulfillmentStatus: 'shipped',
      notifyCustomer: notify
    };
    if (trackingNumber) body.trackingNumber = trackingNumber;
    if (carrier) body.carrier = carrier;

    const result = await postUpdate(body);

    applyLocalStatus(parentOrderId, 'shipped', {
      trackingNumber: trackingNumber || null,
      carrier: carrier || null,
      trackingUrl: (result && result.trackingUrl) || null,
      shippedAt: new Date().toISOString()
    });

    const queued = Boolean(result && result.customerNotification && result.customerNotification.queued);
    showSuccess(queued ? 'Marked shipped. Tracking email sent to the customer.' : 'Marked shipped.');
    if (!queued && notify) {
      const why = result && result.customerNotification && result.customerNotification.reason;
      if (why) showError(`Customer email not sent: ${why}`);
    }

    replaceCard(parentOrderId);
    renderTabs();
    updateCount();
    updateOrdersBadge(needsActionCount());
  } catch (err) {
    console.error('[Orders] Ship failed:', err && err.message);
    showError(err && err.message ? err.message : 'Could not mark this order shipped.');
    setCardBusy(card, false);
  }
}

function copyAddress(parentOrderId) {
  const shipment = findShipment(parentOrderId);
  if (!shipment || !shipment.shippingAddress) {
    showError('This order has no shipping address to copy.');
    return;
  }
  // Never logged — copied straight to the clipboard for a shipping label.
  copyToClipboard(addressLines(shipment.shippingAddress).join('\n'), 'Address copied for the label.');
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function refreshUI() {
  renderTabs();
  renderList();
  updateOrdersBadge(needsActionCount());
}

function renderTabs() {
  if (!tabsEl) return;
  tabsEl.innerHTML = FILTERS.map((f) => {
    const count = shipments.filter((s) => f.match(statusOf(s))).length;
    const active = f.key === currentFilter ? ' active' : '';
    return `<button type="button" class="orders-tab${active}" data-filter="${f.key}">`
      + `${escapeHtml(f.label)}<span class="orders-tab-count">${count}</span></button>`;
  }).join('');
}

function visibleShipments() {
  const filter = FILTERS.find((f) => f.key === currentFilter) || FILTERS[0];
  return shipments
    .filter((s) => filter.match(statusOf(s)))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

function updateCount() {
  if (!countEl) return;
  const items = visibleShipments();
  const units = items.reduce((n, s) => n + (Number(s.unitCount) || 0), 0);
  countEl.textContent = items.length
    ? `${items.length} order${items.length === 1 ? '' : 's'} · ${units} item${units === 1 ? '' : 's'} to pack`
    : '';
}

function renderList() {
  if (!listEl) return;

  const items = visibleShipments();
  updateCount();

  if (!items.length) {
    const filter = FILTERS.find((f) => f.key === currentFilter) || FILTERS[0];
    // "Every order has shipped" is only true if orders exist. With none at
    // all it is a flat lie, and it hides the far likelier cause: paid orders
    // are not reaching Firestore. Say which of the two it is.
    let message;
    if (!shipments.length) {
      message = 'No orders yet. If you have taken a payment, check that the '
              + 'Stripe webhook is delivering \u2014 a charge with no order '
              + 'means the event never arrived.';
    } else if (filter.key === 'needs_action') {
      message = 'Nothing to pack. Every paid order has been shipped.';
    } else {
      message = `No ${filter.label.toLowerCase()} orders.`;
    }
    listEl.innerHTML = `<div class="orders-empty">${escapeHtml(message)}</div>`;
  } else {
    listEl.innerHTML = items.map(orderCard).join('');
  }

  if (moreEl) {
    moreEl.innerHTML = hasMore
      ? `<button type="button" class="btn btn-secondary" data-action="load-more">Load older orders</button>`
      : '';
  }
}

/** Re-render one card in place, so the list does not jump under the owner. */
function replaceCard(parentOrderId) {
  if (!listEl) return;
  const shipment = findShipment(parentOrderId);
  const existing = listEl.querySelector(`.order-card[data-card-id="${cssEscape(parentOrderId)}"]`);
  if (!shipment || !existing) { renderList(); return; }

  // The card may no longer belong in the current filter; if so, drop it.
  const filter = FILTERS.find((f) => f.key === currentFilter) || FILTERS[0];
  if (!filter.match(statusOf(shipment))) { renderList(); return; }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = orderCard(shipment);
  const fresh = wrapper.firstElementChild;
  if (fresh) existing.replaceWith(fresh);
}

function orderCard(shipment) {
  const id = shipment.parentOrderId || '';
  const status = statusOf(shipment);
  const currency = shipment.currency || 'usd';

  const items = Array.isArray(shipment.items) ? shipment.items : [];
  const rows = items.map((it) => {
    const variant = [it.gender, it.size]
      .filter((v) => v != null && String(v).trim() !== '')
      .map((v) => escapeHtml(v))
      .join(' · ');
    return `
      <li class="order-item">
        <span class="order-item-qty">${escapeHtml(String(it.quantity || 1))}×</span>
        <span class="order-item-main">
          <span class="order-item-title">${escapeHtml(it.productTitle || 'Untitled product')}</span>
          <span class="order-item-variant">${variant || 'No size / gender recorded'}</span>
        </span>
        <span class="order-item-money">${escapeHtml(money(it.lineTotalCents, currency))}</span>
      </li>`;
  }).join('');

  const address = shipment.shippingAddressMissing || !shipment.shippingAddress
    ? `<div class="order-address order-address--missing">
         <div class="order-block-label">Ship to</div>
         <p class="order-address-alert">No shipping address on this order — it cannot be shipped from here.
         Open the payment in the Stripe dashboard to find or request an address.</p>
       </div>`
    : `<div class="order-address">
         <div class="order-block-head">
           <div class="order-block-label">Ship to</div>
           <button type="button" class="order-copy" data-action="copy-address" data-id="${jsAttr(id)}">Copy</button>
         </div>
         <address class="order-address-body">${addressLines(shipment.shippingAddress).map((l) => escapeHtml(l)).join('<br>')}</address>
       </div>`;

  const tracking = shipment.trackingNumber
    ? `<div class="order-tracking">
         <span class="order-block-label">Tracking</span>
         <span class="order-tracking-value">${escapeHtml([shipment.carrier, shipment.trackingNumber].filter(Boolean).join(' · '))}</span>
         ${safeHttpsUrl(shipment.trackingUrl)
           ? `<a class="order-tracking-link" href="${escapeHtml(shipment.trackingUrl)}" target="_blank" rel="noopener">Track ↗</a>`
           : ''}
       </div>`
    : '';

  return `
    <article class="order-card order-card--${escapeHtml(status)}" data-card-id="${jsAttr(id)}">
      <div class="order-head">
        <div class="order-head-text">
          <h3 class="order-title">${escapeHtml(String(shipment.unitCount || items.length || 0))} item${(shipment.unitCount || 0) === 1 ? '' : 's'} · ${escapeHtml(money(shipment.orderTotalCents, currency))}</h3>
          <div class="order-sub">${escapeHtml(shipment.customerEmail || 'No email on file')}</div>
          <div class="order-sub order-sub--muted">${escapeHtml(dateTime(shipment.paidAt || shipment.createdAt))}</div>
        </div>
        ${statusBadge(status)}
      </div>

      <div class="order-block">
        <div class="order-block-label">Pack</div>
        <ul class="order-items">${rows || '<li class="order-item order-item--empty">No line items recorded.</li>'}</ul>
      </div>

      ${address}
      ${tracking}

      <div class="order-meta">
        <span class="order-meta-item" title="Payment intent">${escapeHtml(id)}</span>
        ${shipment.customerPhone ? `<span class="order-meta-sep">•</span><span class="order-meta-item">${escapeHtml(shipment.customerPhone)}</span>` : ''}
      </div>

      ${actionsFor(shipment, status, id)}
      ${shipForm(shipment, id)}
      ${delayForm(shipment, id)}
    </article>
  `;
}

function actionsFor(shipment, status, id) {
  const canShip = !shipment.shippingAddressMissing && Boolean(shipment.shippingAddress);
  const buttons = [];

  if (status === 'pending') {
    buttons.push(btn('btn-secondary', 'Start packing', { action: 'status', status: 'processing', id }));
  }
  if (status === 'pending' || status === 'processing' || status === 'mixed') {
    buttons.push(canShip
      ? btn('btn-success', 'Mark shipped', { action: 'ship-open', id })
      : btn('btn-secondary', 'Mark shipped', { action: 'ship-open', id }, true));
    buttons.push(btn('btn-secondary', 'Running late', { action: 'delay-open', id }));
    buttons.push(btn('btn-danger', 'Cancel order', { action: 'status', status: 'cancelled', id }));
  }
  if (status === 'shipped') {
    buttons.push(btn('btn-success', 'Mark delivered', { action: 'status', status: 'delivered', id }));
    buttons.push(btn('btn-secondary', 'Mark returned', { action: 'status', status: 'returned', id }));
  }
  if (status === 'delivered') {
    buttons.push(btn('btn-secondary', 'Mark returned', { action: 'status', status: 'returned', id }));
  }

  if (!buttons.length) return '';
  return `<div class="order-actions">${buttons.join('')}</div>`;
}

function btn(cls, label, data, disabled = false) {
  const attrs = Object.entries(data)
    .map(([k, v]) => `data-${k}="${jsAttr(v)}"`)
    .join(' ');
  return `<button type="button" class="btn ${cls}" ${attrs}${disabled ? ' disabled title="No shipping address on this order"' : ''}>${escapeHtml(label)}</button>`;
}

function delayForm(shipment, id) {
  const told = shipment.estimatedDelivery
    ? `<p class="order-delay-note">Customer has been told to expect shipping by <strong>${escapeHtml(String(shipment.estimatedDelivery).slice(0, 10))}</strong>.</p>`
    : '';
  const canEmail = Boolean(shipment.customerEmail);
  return `
    ${told}
    <div class="order-ship-form order-delay-form" hidden>
      <label class="order-field">
        <span class="order-field-label">New expected ship date</span>
        <input type="date" class="order-delay-date" required>
      </label>
      <label class="order-field">
        <span class="order-field-label">Reason (optional, goes in the email)</span>
        <textarea class="order-delay-reason" rows="2" maxlength="300" placeholder="e.g. the print run was delayed at the supplier"></textarea>
      </label>
      <p class="order-delay-hint">${canEmail
        ? 'The customer gets an email with the new date and a one-click choice: keep the order, or cancel for a full refund.'
        : 'No customer email on this order — the date will be recorded but nothing can be sent.'}</p>
      <div class="order-ship-actions">
        <button type="button" class="btn btn-secondary" data-action="delay-confirm" data-id="${jsAttr(id)}">Send delay notice</button>
        <button type="button" class="btn btn-secondary" data-action="delay-cancel" data-id="${jsAttr(id)}">Back</button>
      </div>
    </div>`;
}

function shipForm(shipment, id) {
  if (shipment.shippingAddressMissing || !shipment.shippingAddress) return '';
  const options = ['', ...CARRIERS]
    .map((c) => `<option value="${jsAttr(c)}">${escapeHtml(c || 'Carrier…')}</option>`)
    .join('');
  return `
    <div class="order-ship-form" hidden>
      <label class="order-field">
        <span class="order-field-label">Tracking number</span>
        <input type="text" class="order-tracking-input" inputmode="latin" autocomplete="off" placeholder="e.g. 9400 1000 0000 0000 0000 00">
      </label>
      <label class="order-field">
        <span class="order-field-label">Carrier</span>
        <select class="order-carrier-select">${options}</select>
      </label>
      <label class="order-check">
        <input type="checkbox" class="order-notify-check" checked>
        <span>Email the customer their tracking number</span>
      </label>
      <div class="order-ship-actions">
        <button type="button" class="btn btn-success" data-action="ship-confirm" data-id="${jsAttr(id)}">Confirm shipped</button>
        <button type="button" class="btn btn-secondary" data-action="ship-cancel" data-id="${jsAttr(id)}">Back</button>
      </div>
    </div>`;
}

function statusBadge(status) {
  const map = {
    pending:    'badge-warning',
    processing: 'badge-info',
    shipped:    'badge-success',
    delivered:  'badge-success',
    returned:   'badge-error',
    cancelled:  'badge-error',
    mixed:      'badge-warning'
  };
  const cls = map[status] || 'badge-info';
  return `<span class="badge ${cls} order-status">${escapeHtml(STATUS_LABELS[status] || status)}</span>`;
}

// ---------------------------------------------------------------------------
// Sidebar badge
// ---------------------------------------------------------------------------

/** Show the count of orders still waiting to be packed on the nav item. */
export function updateOrdersBadge(count) {
  const badge = document.getElementById('orders-badge');
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

function findShipment(parentOrderId) {
  return shipments.find((s) => s.parentOrderId === parentOrderId) || null;
}

/**
 * Effective status of a whole order. The grouped payload takes `orderStatus`
 * from the first line item, but the API can move items individually, so an
 * order whose items disagree is reported as `mixed` rather than pretending.
 */
function statusOf(shipment) {
  const items = Array.isArray(shipment && shipment.items) ? shipment.items : [];
  const statuses = [...new Set(items.map((i) => String(i.orderStatus || '').toLowerCase()).filter(Boolean))];
  if (statuses.length === 1) return statuses[0];
  if (statuses.length > 1) return 'mixed';
  return String((shipment && shipment.orderStatus) || 'pending').toLowerCase();
}

function applyLocalStatus(parentOrderId, status, extra) {
  const shipment = findShipment(parentOrderId);
  if (!shipment) return;
  shipment.orderStatus = status;
  if (Array.isArray(shipment.items)) shipment.items.forEach((i) => { i.orderStatus = status; });
  if (extra) Object.assign(shipment, extra);
}

function needsActionCount() {
  return shipments.filter((s) => {
    const st = statusOf(s);
    return st === 'pending' || st === 'processing' || st === 'mixed';
  }).length;
}

function setCardBusy(card, busy) {
  if (!card) return;
  card.classList.toggle('is-busy', busy);
  card.querySelectorAll('button[data-action]').forEach((b) => { b.disabled = busy; });
}

/** Address lines in label order. Returned as an array so the copy is clean. */
function addressLines(addr) {
  if (!addr) return [];
  return [
    addr.name,
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter((v) => v != null && String(v).trim() !== '').join(', '),
    addr.country
  ].filter((v) => v != null && String(v).trim() !== '').map((v) => String(v));
}

function money(cents, currency) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  const code = String(currency || 'usd').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(n / 100);
  } catch (_) {
    return `${(n / 100).toFixed(2)} ${code}`;
  }
}

function dateTime(ts) {
  const ms = toMillis(ts);
  if (!ms) return 'Date unknown';
  return new Date(ms).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts._seconds) return ts._seconds * 1000;
  if (ts.seconds) return ts.seconds * 1000;
  const t = new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** Only ever put a plain https URL in an href. */
function safeHttpsUrl(url) {
  return typeof url === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(url.trim());
}

/**
 * Escape a value for use inside a CSS attribute selector. Payment intent ids
 * are Stripe-generated (`pi_...`), but this is data from the network, so it is
 * quoted rather than trusted.
 */
function cssEscape(value) {
  const s = String(value == null ? '' : value);
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(s);
  return s.replace(/["\\\]]/g, '\\$&');
}
