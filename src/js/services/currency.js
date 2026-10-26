/**
 * services/currency.js — which currency the store's prices are SHOWN in.
 *
 * Rohan, 25 Oct 2026: a shopper in India sees approximate ₹ prices; the store
 * still charges US dollars and ships within the US only; discount codes stay
 * percentages. So this module only ever changes what a price LOOKS like:
 *   - cents stay US cents everywhere (cart, checkout, server); nothing here is sent;
 *   - every ₹ figure is marked "≈" (priceMap.approxRupees);
 *   - wherever ₹ is shown next to a purchase, the dollar charge is said too
 *     ([data-charge-cents]: "You pay $19.99 in US dollars…"), and Pay says dollars;
 *   - a shopper seeing ₹ is told, before the bag, that delivery is US-only and that
 *     the bank's own rate and fee decide the final rupee figure.
 *
 * Who sees ₹: a browser whose time zone is India's (Asia/Kolkata), unless the
 * shopper chose otherwise with the switch or a ?currency=INR|USD link; anyone can
 * switch either way. The rate is GET /fx (the ECB's daily reference rate,
 * kaayko-api products/fx.js), kept here for 12 hours; with no rate, prices stay in
 * dollars and the switch says so.
 *
 * A displayed price is an element carrying data-cents (paint(), priceSpan()), so
 * switching repaints every price on the page in place — no reload, no re-render.
 * A figure built from parts (a bag total) also carries data-parts, so its ₹ value
 * is the sum of the ₹ lines above it.
 */
import { money, approxRupees, approxRupeesSum, priceCents } from '/js/priceMap.js';
import { request } from '/js/services/storeApi.js';

const PREF = 'kaayko:currency';          // 'USD' | 'INR', set only by the switch or a link
const KEEP = 'kaayko:fx:usdinr:v1';      // { rate, asOf, source, t }
const FAIL = 'kaayko:fx:fail';           // when /fx last failed: no retry on every page
const FRESH_MS = 12 * 60 * 60 * 1000;
const USABLE_MS = 7 * 24 * 60 * 60 * 1000; // a week-old rate still beats none if /fx is down
const RETRY_MS = 10 * 60 * 1000;

/* Storage: localStorage, else sessionStorage, else a first-party cookie, else this
   page's memory. A browser that blocks storage used to forget the shopper's choice
   on every page (audit, 26 Oct 2026). */
const memory = {};
const cookieName = (k) => k.replace(/[^a-z0-9]/gi, '_');
const store = {
  get(k) {
    for (const s of ['localStorage', 'sessionStorage']) {
      try { const v = window[s].getItem(k); if (v !== null) return v; } catch (_) { /* blocked */ }
    }
    try {
      const m = document.cookie.match(new RegExp(`(?:^|; )${cookieName(k)}=([^;]*)`));
      if (m) return decodeURIComponent(m[1]);
    } catch (_) { /* blocked */ }
    return k in memory ? memory[k] : null;
  },
  set(k, v) {
    memory[k] = v;
    for (const s of ['localStorage', 'sessionStorage']) {
      try { window[s].setItem(k, v); return; } catch (_) { /* blocked: try the next */ }
    }
    try { document.cookie = `${cookieName(k)}=${encodeURIComponent(v)}; path=/; max-age=31536000; samesite=lax`; } catch (_) { /* memory only */ }
  },
};

function inIndia() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta';
  } catch (_) { return false; }
}

// ?currency=INR (or USD) is a choice too: a link can carry it between kaayko.com and
// kaay.store, whose storage the browser keeps apart.
let chosen = store.get(PREF);
try {
  const q = (new URLSearchParams(location.search).get('currency') || '').toUpperCase();
  if (q === 'INR' || q === 'USD') { chosen = q; store.set(PREF, q); }
} catch (_) { /* no URL */ }

let fx;
try { fx = JSON.parse(store.get(KEEP) || 'null'); } catch (_) { fx = null; }
const usable = (f) => !!f && typeof f.rate === 'number' && f.rate > 0 && Date.now() - f.t < USABLE_MS;
let state = 'idle';                      // 'idle' | 'loading' | 'failed': the rate's fetch

/** 'INR' or 'USD': the shopper's choice, else rupees for a browser in India. */
export function currency() {
  if (chosen === 'INR' || chosen === 'USD') return chosen;
  return inIndia() ? 'INR' : 'USD';
}

/** True when prices are actually being shown in rupees (chosen, and a rate in hand). */
export function showingRupees() {
  return currency() === 'INR' && usable(fx);
}

/** A shopper the India notes are for: rupees chosen, or a browser in India. */
export function indiaShopper() {
  return currency() === 'INR' || inIndia();
}

/** US cents as the shopper sees them: "$19.99", "−$1.50", or "≈ ₹1,898". */
export function price(cents, parts) {
  if (showingRupees()) return parts ? approxRupeesSum(parts, fx.rate) : approxRupees(cents, fx.rate);
  // a discount reads "−$1.50" (a true minus), as the bag always printed it
  return typeof cents === 'number' && cents < 0 ? `−${money(-cents)}` : money(cents);
}
export const priceOf = (product) => price(priceCents(product));

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const partsAttr = (parts) => (Array.isArray(parts) && parts.length ? ` data-parts="${parts.map((c) => Math.round(c)).join(',')}"` : '');
const partsOf = (el) => (el.dataset.parts ? el.dataset.parts.split(',').map(Number) : undefined);

/** A price as markup that repaint() can change later. `cents` is US cents; `parts`
 *  (optional) the US-cent parts it is the sum of. */
export function priceSpan(cents, cls = '', parts) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '';
  return `<span class="px${cls ? ` ${escAttr(cls)}` : ''}" data-cents="${Math.round(cents)}"${partsAttr(parts)}>${escAttr(price(cents, parts))}</span>`;
}

/** Put a price into an element and mark it for repainting. */
export function paint(el, cents, parts) {
  if (!el) return;
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return label(el, '');
  el.dataset.cents = String(Math.round(cents));
  if (Array.isArray(parts) && parts.length) el.dataset.parts = parts.map((c) => Math.round(c)).join(',');
  else delete el.dataset.parts;
  el.textContent = price(cents, partsOf(el));
}
/** Put words (not a price) into an element that sometimes holds one. */
export function label(el, text) {
  if (!el) return;
  delete el.dataset.cents;
  delete el.dataset.parts;
  el.textContent = text;
}

/* What the card is actually charged, beside a ₹ figure. data-charge-style:
     "pdp"  — the product page: the charge, the bank's fee, and US-only delivery;
     (none) — checkout: the charge and the bank's fee. */
function chargeLine(el) {
  const c = Number(el.dataset.chargeCents);
  const show = showingRupees() && Number.isFinite(c) && c > 0;
  el.hidden = !show;
  if (!show) return;
  const base = `You pay ${money(c)} in US dollars. Your bank converts it, and may add a small fee.`;
  el.textContent = el.dataset.chargeStyle === 'pdp' ? `${base} We deliver within the United States only.` : base;
}

/* <html class="fx-inr"> while prices show in rupees: CSS lays out the longer figures */
function markPage() {
  try { document.documentElement.classList.toggle('fx-inr', showingRupees()); } catch (_) { /* no DOM */ }
}

/** Re-print every price under `root` in the current currency. */
export function repaint(root = document) {
  markPage();
  root.querySelectorAll('[data-cents]').forEach((el) => { el.textContent = price(Number(el.dataset.cents), partsOf(el)); });
  root.querySelectorAll('[data-charge-cents]').forEach(chargeLine);
  root.querySelectorAll('[data-fx-rupees]').forEach((el) => { el.hidden = !showingRupees(); });
  root.querySelectorAll('[data-fx-india]').forEach((el) => { el.hidden = !indiaShopper(); });
  root.querySelectorAll('[data-fx-switch]').forEach(drawSwitch);
}

let loading = null;
async function loadRate() {
  state = 'loading';
  repaintSwitches();
  const r = await request('/fx', { timeoutMs: 6000 });
  if (r.ok && r.data && typeof r.data.rate === 'number' && r.data.rate > 0) {
    fx = { rate: r.data.rate, asOf: r.data.asOf || '', source: r.data.source || '', t: Date.now() };
    store.set(KEEP, JSON.stringify(fx));
    state = 'idle';
  } else {
    store.set(FAIL, String(Date.now()));
    state = 'failed';
  }
  return fx;
}

/**
 * Resolves once the rate the current currency needs is in hand (or `timeoutMs` has
 * passed — then prices show in dollars until it arrives, and repaint as it does).
 * A kept rate older than 12 hours is refreshed behind the page. After a failed
 * fetch, pages do not ask again for ten minutes unless `force` (the shopper asked).
 */
export function currencyReady({ timeoutMs = 1500, force = false } = {}) {
  if (currency() !== 'INR') return Promise.resolve();
  const fresh = usable(fx) && Date.now() - fx.t < FRESH_MS;
  if (fresh) return Promise.resolve();
  const failedAt = Number(store.get(FAIL)) || 0;
  if (!force && !loading && Date.now() - failedAt < RETRY_MS) {
    if (!usable(fx)) state = 'failed';
    return Promise.resolve();
  }
  loading = loading || loadRate().catch(() => { state = 'failed'; return null; }).then((f) => { repaint(); return f; }).finally(() => { loading = null; });
  if (usable(fx)) return Promise.resolve();          // an older rate shows now; the new one repaints
  return Promise.race([loading, new Promise((r) => setTimeout(r, timeoutMs))]);
}

/* One quiet announcement per switch, for screen readers; the switch line itself is
   not a live region (it was read out on every page load, twice on the store). */
function announce(text) {
  let el = document.getElementById('fx-status');
  if (!el) {
    el = document.createElement('p');
    el.id = 'fx-status';
    el.className = 'visually-hidden';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 60);
}

/** Switch currency (the shopper's choice is kept), and repaint the page. */
export async function setCurrency(next) {
  chosen = next === 'INR' ? 'INR' : 'USD';
  store.set(PREF, chosen);
  repaint();
  await currencyReady({ timeoutMs: 6000, force: true });
  repaint();
  announce(showingRupees() ? 'Prices now shown in rupees, approximately. You still pay in US dollars.'
    : chosen === 'INR' ? 'Rupee prices are not available right now. Prices are in US dollars.'
    : 'Prices now shown in US dollars.');
  document.dispatchEvent(new CustomEvent('kaayko:currency', { detail: { currency: chosen } }));
}

/* ── The switch ───────────────────────────────────────────────────────────
   One line, wherever prices are. In rupees: approximate, charged in dollars,
   the bank's fee, US-only delivery, and a way back. Waiting for the rate, or
   without one, it says so (it used to offer "Show prices in ₹" and then do
   nothing). In dollars: an offer of rupees.                                  */
function rateDate() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fx?.asOf || '')) return '';
  const d = new Date(`${fx.asOf}T12:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
const toggle = (to, text) => `<button type="button" class="fx-toggle" data-to="${to}">${text}</button>`;

function drawSwitch(el) {
  // a redraw must not drop the keyboard: whoever was on the switch stays on it
  const hadFocus = el.contains(document.activeElement) || document.activeElement === el;
  const short = el.classList.contains('is-toolbar');
  let html;
  if (showingRupees()) {
    const when = rateDate();
    html = short
      ? `Prices in ₹ are approximate; you pay in US dollars. We deliver within the US only. ${toggle('USD', 'Show prices in $')}`
      : `Prices in ₹ are approximate, at the European Central Bank rate${when ? ` of ${when}` : ''} (₹${fx.rate.toFixed(2)} to the dollar). You pay in US dollars; your bank converts it and may add a small fee. We deliver within the United States only. ${toggle('USD', 'Show prices in $')}`;
  } else if (currency() === 'INR' && state === 'loading') {
    html = 'Getting today’s rupee rate…';
  } else if (currency() === 'INR') {
    html = `Rupee prices are not available right now, so prices are in US dollars. ${toggle('INR', 'Try again')}`;
  } else {
    html = `Prices in US dollars. ${toggle('INR', 'Show prices in ₹')}`;
  }
  if (el.dataset.drawn === html) return;
  el.dataset.drawn = html;
  el.innerHTML = html;
  if (hadFocus) {
    const b = el.querySelector('.fx-toggle');
    if (b) b.focus({ preventScroll: true });
    else { el.tabIndex = -1; el.focus({ preventScroll: true }); }   // "Getting…": hold focus here
  }
}
function repaintSwitches() { document.querySelectorAll('[data-fx-switch]').forEach(drawSwitch); }

/** Put a switch into `host` (appended), and keep it current. */
export function mountCurrencySwitch(host, cls = '') {
  if (!host || host.querySelector(':scope > [data-fx-switch]')) return;
  const p = document.createElement('p');
  p.className = `fx-switch${cls ? ` ${cls}` : ''}`;
  p.dataset.fxSwitch = '';
  p.addEventListener('click', (e) => {
    const b = e.target.closest('.fx-toggle');
    if (b) setCurrency(b.dataset.to);
  });
  drawSwitch(p);
  host.appendChild(p);
}

// A rate that arrives after the page has drawn repaints it.
markPage();
currencyReady().then(() => repaint());
