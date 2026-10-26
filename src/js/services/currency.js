/**
 * services/currency.js — which currency the store's prices are SHOWN in.
 *
 * Rohan, 25 Oct 2026: a shopper in India sees approximate ₹ prices; the store
 * still charges US dollars and ships within the US only; discount codes stay
 * percentages. So this module only ever changes what a price LOOKS like:
 *   - cents stay US cents everywhere (cart, checkout, server); nothing here is sent;
 *   - every ₹ figure is marked "≈" (priceMap.approxRupees);
 *   - wherever ₹ is shown next to a purchase, the dollar charge is said too
 *     ([data-charge-cents]: "You pay $19.99 in US dollars…"), and Pay says dollars.
 *
 * Who sees ₹: a browser whose time zone is India's (Asia/Kolkata), unless the
 * shopper chose otherwise with the switch; anyone can switch either way. The
 * rate is GET /fx (the ECB's daily reference rate, kaayko-api products/fx.js),
 * kept here for 12 hours; with no rate, prices stay in dollars.
 *
 * A displayed price is an element carrying data-cents (paint(), priceSpan()), so
 * switching repaints every price on the page in place — no reload, no re-render.
 */
import { money, approxRupees, priceCents } from '/js/priceMap.js';
import { request } from '/js/services/storeApi.js';

const PREF = 'kaayko:currency';          // 'USD' | 'INR', set only by the switch
const KEEP = 'kaayko:fx:usdinr:v1';      // { rate, asOf, source, t }
const FRESH_MS = 12 * 60 * 60 * 1000;
const USABLE_MS = 7 * 24 * 60 * 60 * 1000; // a week-old rate still beats none if /fx is down

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* private mode: this visit only */ } },
};

function inIndia() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta';
  } catch (_) { return false; }
}

let chosen = store.get(PREF);
let fx;
try { fx = JSON.parse(store.get(KEEP) || 'null'); } catch (_) { fx = null; }
const usable = (f) => !!f && typeof f.rate === 'number' && f.rate > 0 && Date.now() - f.t < USABLE_MS;

/** 'INR' or 'USD': the shopper's choice, else rupees for a browser in India. */
export function currency() {
  if (chosen === 'INR' || chosen === 'USD') return chosen;
  return inIndia() ? 'INR' : 'USD';
}

/** True when prices are actually being shown in rupees (chosen, and a rate in hand). */
export function showingRupees() {
  return currency() === 'INR' && usable(fx);
}

/** US cents as the shopper sees them: "$19.99", or "≈ ₹1,898". */
export function price(cents) {
  if (showingRupees()) return approxRupees(cents, fx.rate);
  // a discount reads "−$1.50" (a true minus), as the bag always printed it
  return typeof cents === 'number' && cents < 0 ? `−${money(-cents)}` : money(cents);
}
export const priceOf = (product) => price(priceCents(product));

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** A price as markup that repaint() can change later. `cents` is US cents. */
export function priceSpan(cents, cls = '') {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '';
  return `<span class="px${cls ? ` ${escAttr(cls)}` : ''}" data-cents="${Math.round(cents)}">${escAttr(price(cents))}</span>`;
}

/** Put a price into an element and mark it for repainting. */
export function paint(el, cents) {
  if (!el) return;
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return label(el, '');
  el.dataset.cents = String(Math.round(cents));
  el.textContent = price(cents);
}
/** Put words (not a price) into an element that sometimes holds one. */
export function label(el, text) {
  if (!el) return;
  delete el.dataset.cents;
  el.textContent = text;
}

/** The dollar line beside a ₹ price: what the card is actually charged. */
function chargeLine(el) {
  const c = Number(el.dataset.chargeCents);
  const show = showingRupees() && Number.isFinite(c) && c > 0;
  el.hidden = !show;
  if (show) el.textContent = `You pay ${money(c)} in US dollars; your bank converts it.`;
}

/** Re-print every price under `root` in the current currency. */
export function repaint(root = document) {
  root.querySelectorAll('[data-cents]').forEach((el) => { el.textContent = price(Number(el.dataset.cents)); });
  root.querySelectorAll('[data-charge-cents]').forEach(chargeLine);
  root.querySelectorAll('[data-fx-switch]').forEach(drawSwitch);
}

let loading = null;
async function loadRate() {
  const r = await request('/fx', { timeoutMs: 6000 });
  if (r.ok && r.data && typeof r.data.rate === 'number' && r.data.rate > 0) {
    fx = { rate: r.data.rate, asOf: r.data.asOf || '', source: r.data.source || '', t: Date.now() };
    store.set(KEEP, JSON.stringify(fx));
  }
  return fx;
}

/**
 * Resolves once the rate the current currency needs is in hand (or `timeoutMs` has
 * passed — then prices show in dollars until it arrives, and repaint as it does).
 * A kept rate older than 12 hours is refreshed behind the page.
 */
export function currencyReady({ timeoutMs = 1500 } = {}) {
  if (currency() !== 'INR') return Promise.resolve();
  const fresh = usable(fx) && Date.now() - fx.t < FRESH_MS;
  if (fresh) return Promise.resolve();
  loading = loading || loadRate().catch(() => null).then((f) => { repaint(); return f; }).finally(() => { loading = null; });
  if (usable(fx)) return Promise.resolve();          // an older rate shows now; the new one repaints
  return Promise.race([loading, new Promise((r) => setTimeout(r, timeoutMs))]);
}

/** Switch currency (the shopper's choice is kept), and repaint the page. */
export async function setCurrency(next) {
  chosen = next === 'INR' ? 'INR' : 'USD';
  store.set(PREF, chosen);
  repaint();
  await currencyReady({ timeoutMs: 6000 });
  repaint();
  document.dispatchEvent(new CustomEvent('kaayko:currency', { detail: { currency: chosen } }));
}

/* ── The switch ───────────────────────────────────────────────────────────
   One line, wherever prices are: in rupees it says they are approximate and
   that the charge is in dollars; in dollars it offers rupees.               */
function drawSwitch(el) {
  const inr = showingRupees();
  let asOf = '';
  if (inr && /^\d{4}-\d{2}-\d{2}$/.test(fx.asOf || '')) {
    const d = new Date(`${fx.asOf}T12:00:00Z`);
    asOf = ` (rate of ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })})`;
  }
  el.innerHTML = inr
    ? `Prices in ₹ are approximate${escAttr(asOf)}; you pay in US dollars. <button type="button" class="fx-toggle" data-to="USD">Show prices in $</button>`
    : `Prices in US dollars. <button type="button" class="fx-toggle" data-to="INR">Show prices in ₹</button>`;
}

/** Put a switch into `host` (appended), and keep it current. */
export function mountCurrencySwitch(host, cls = '') {
  if (!host || host.querySelector(':scope > [data-fx-switch]')) return;
  const p = document.createElement('p');
  p.className = `fx-switch${cls ? ` ${cls}` : ''}`;
  p.dataset.fxSwitch = '';
  p.setAttribute('aria-live', 'polite');
  p.addEventListener('click', (e) => {
    const b = e.target.closest('.fx-toggle');
    if (b) setCurrency(b.dataset.to);
  });
  host.appendChild(p);
  drawSwitch(p);
}

// A rate that arrives after the page has drawn repaints it.
currencyReady().then(() => repaint());
