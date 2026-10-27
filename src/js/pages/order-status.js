/**
 * pages/order-status.js — the customer's own order, from the link in their receipt.
 *
 * URL: /order/KAAY-1042?t=<token>. The token is the only credential; the API answers
 * 404 for a wrong one, so this page shows one honest state for "not found" and never
 * hints at whether the number exists. Nothing here needs an account, and nothing is
 * cached: the page asks every time it is opened.
 */
import { getOrderStatus } from '/js/services/storeApi.js';
import { esc, money } from '/js/kit.js';

const panel = document.getElementById('os-panel');

const number = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '').toUpperCase();
const token = new URLSearchParams(location.search).get('t') || '';

const STEPS = [
  { key: 'paid',      name: 'Paid' },
  { key: 'making',    name: 'Being made' },
  { key: 'shipped',   name: 'On its way' },
  { key: 'delivered', name: 'Delivered' }
];
const RANK = { paid: 0, making: 1, shipped: 2, delivered: 3 };

const day = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

function notFound() {
  panel.innerHTML = `
    <div class="os-state">
      <h1>No order by that link.</h1>
      <p>Open the link from your receipt email again, or reply to the receipt and we will look it up by hand.</p>
      <p><a href="/store">Back to the store</a></p>
    </div>`;
}

const isLessonsOnly = (order) => (order.items || []).length > 0 && order.items.every((it) => it.lesson);
const lengthText = (min) => (!min ? '' : min % 60 === 0 ? `${min / 60} hour${min === 60 ? '' : 's'}` : `${min} minutes`);

function steps(order) {
  if (isLessonsOnly(order) && order.status !== 'cancelled' && order.status !== 'refunded') {
    // A lesson has no parcel to follow: it is booked, and the details are below.
    return `<p class="os-closed">Booked. Full refund if you cancel at least 48 hours before your session: reply to your receipt. If the teacher cancels, you get a full refund automatically.</p>`;
  }
  if (order.status === 'cancelled' || order.status === 'refunded') {
    const refunded = order.refundedCents > 0 ? ` ${money(order.refundedCents)} has gone back to your card; banks take five to ten business days to show it.` : '';
    return `<p class="os-closed">This order was ${order.status === 'refunded' ? 'refunded' : 'cancelled'}${order.cancelledAt ? ` on ${esc(day(order.cancelledAt))}` : ''}.${esc(refunded)}</p>`;
  }
  const now = RANK[order.status] ?? 0;
  const when = { paid: day(order.placedAt), shipped: day(order.shippedAt), delivered: day(order.deliveredAt),
                 making: order.estimatedShipBy && now === 1 ? `by ${day(order.estimatedShipBy)}` : '' };
  return `<ol class="os-steps" aria-label="Order progress">${STEPS.map((s, i) => `
    <li class="os-step${i < now ? ' is-done' : ''}${i === now ? ' is-now is-done' : ''}">
      <span class="os-step-name">${esc(s.name)}</span>
      <span class="os-step-when">${esc(when[s.key] || '')}</span>
    </li>`).join('')}</ol>`;
}

function lines(order) {
  return `<ul class="os-lines">${order.items.map((it) => `
    <li class="os-line">
      ${it.imgSrc ? `<img class="os-line-img" src="${esc(it.imgSrc)}" alt="" loading="lazy">` : '<span class="os-line-img is-blank" aria-hidden="true"></span>'}
      <span class="os-line-body">
        <span class="os-line-title">${esc(it.productTitle)}${it.storeName ? ` <span class="os-line-meta">by ${esc(it.storeName)}</span>` : ''}</span>
        ${it.lesson ? `
        <span class="os-line-meta">Lesson · ${esc(it.lesson.label || it.size || '')} · ${esc(lengthText(it.lesson.durationMin))}${it.status === 'cancelled' ? ' · cancelled' : ''}</span>
        <span class="os-line-meta">${esc(it.lesson.format === 'online' ? 'Online' : (it.lesson.area || 'In person'))}${it.lesson.details ? ` · ${it.lesson.format === 'online' ? 'How to join' : 'Where to meet'}: ${esc(it.lesson.details)}` : ''}</span>` : `
        <span class="os-line-meta">${esc([it.gender, it.size].filter(Boolean).join(' · ') || 'One size')} · Qty ${esc(String(it.quantity))}${it.status === 'cancelled' ? ' · cancelled' : ''}</span>`}
      </span>
      <span class="os-line-money">${esc(money(it.lineTotalCents))}</span>
    </li>`).join('')}</ul>`;
}

export function render(order) {   // exported so the page can be exercised with a fixture without an order
  document.title = `Order ${order.orderNumber} — Kaayko`;
  // An order with a piece from an independent maker is not all printed by us.
  const withMaker = (order.items || []).some((it) => it.storeName);
  const lede = {
    paid: withMaker ? 'Paid and in the queue.' : 'Paid and in the queue. We print each order ourselves, one at a time.',
    making: withMaker ? 'Being made and packed. You will get an email with tracking the moment it ships.' : 'Being printed and packed. You will get an email with tracking the moment it ships.',
    shipped: 'On its way. The tracking link below is the carrier’s own.',
    delivered: 'Delivered. Thirty days to change your mind, unworn and unwashed.',
    cancelled: 'Cancelled before it shipped.',
    refunded: 'Refunded.'
  }[order.status] || '';
  const ledeText = isLessonsOnly(order) && order.status !== 'cancelled' && order.status !== 'refunded'
    ? 'Your lesson is booked. When, how long and where are below, and in your receipt.'
    : lede;

  const shipTo = order.shipTo ? [order.shipTo.name, [order.shipTo.city, order.shipTo.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') : '';
  const tracking = order.tracking ? `
    <div class="os-card">
      <span class="os-label">Tracking</span>
      <dl style="margin:0">
        <div class="os-row"><dt>Carrier</dt><dd>${esc(order.tracking.carrier || '—')}</dd></div>
        <div class="os-row"><dt>Number</dt><dd>${esc(order.tracking.number)}</dd></div>
      </dl>
      ${order.tracking.url ? `<a class="os-track" href="${esc(order.tracking.url)}" target="_blank" rel="noopener">Track the parcel</a>` : ''}
    </div>` : '';

  panel.innerHTML = `
    <p class="os-eyebrow">Your order</p>
    <h1>${esc(order.orderNumber)}</h1>
    <p class="os-lede">${esc(ledeText)}</p>
    ${steps(order)}
    <div class="os-card">
      <span class="os-label">In the bag</span>
      ${lines(order)}
    </div>
    ${tracking}
    <div class="os-card">
      <span class="os-label">Order</span>
      <dl style="margin:0">
        <div class="os-row"><dt>Placed</dt><dd>${esc(order.placedAt ? new Date(order.placedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—')}</dd></div>
        ${shipTo ? `<div class="os-row"><dt>${isLessonsOnly(order) ? 'Booked by' : 'Ship to'}</dt><dd>${esc(shipTo)}</dd></div>` : ''}
        <div class="os-row"><dt>Subtotal</dt><dd>${esc(money(order.subtotalCents))}</dd></div>
        ${order.discountCents > 0 ? `<div class="os-row"><dt>Discount</dt><dd>&minus;${esc(money(order.discountCents))}</dd></div>` : ''}
        ${isLessonsOnly(order) ? '' : '<div class="os-row"><dt>Shipping</dt><dd>Free</dd></div>'}
        <div class="os-row"><dt>Sales tax</dt><dd>${esc(order.taxCents > 0 ? money(order.taxCents) : 'None')}</dd></div>
        <div class="os-row is-total"><dt>Total paid</dt><dd>${esc(money(order.totalCents))}</dd></div>
        ${order.refundedCents > 0 ? `<div class="os-row"><dt>Refunded</dt><dd>${esc(money(order.refundedCents))}</dd></div>` : ''}
      </dl>
    </div>
    ${helpLine(order)}`;
}

/** How to change your mind: goods before they ship, lessons up to 48 hours before. */
function helpLine(order) {
  const lessons = '<a href="/legal/returns#lessons">Lessons</a>: reply to your receipt at least 48 hours before the session for a full refund; if the teacher cancels, you are refunded in full automatically.';
  if (isLessonsOnly(order)) return `<p class="os-help">Changed your mind? ${lessons}</p>`;
  const goods = `Changed your mind? Before it ships, reply to your receipt with the order number and it is cancelled and refunded in full.
      After that, thirty days under the <a href="/legal/returns">Returns Policy</a>. Delivery times are in the <a href="/legal/shipping">Shipping Policy</a>.`;
  return `<p class="os-help">${goods}${(order.items || []).some((it) => it.lesson) ? ` ${lessons}` : ''}</p>`;
}

(async () => {
  if (!/^KAAY-\d{4,8}$/.test(number) || !token) return notFound();
  try {
    const order = await getOrderStatus(number, token);
    render(order);
  } catch (err) {
    if (err && err.status === 404) return notFound();
    console.error('order status failed:', err);
    panel.innerHTML = `<div class="os-state"><h1>The store is not answering.</h1><p>Try again in a moment, or reply to your receipt.</p></div>`;
  }
})();
