/**
 * services/storeApi.js — every store call to the API, in one place.
 *
 * Rules (see kaayko/ENGINEERING-IDENTITY.md §3):
 *   • The base URL comes from kit.apiBase(); prod-config.js decides it once per page.
 *   • Every call has a timeout. A cold Cloud Run instance answers in ~5 s; a dead one
 *     answers never, and a shopper must never look at a spinner forever.
 *   • Helpers either return data or throw an ApiError the page can act on.
 *   • request() returns {ok, status, data, offline, timeout} for the checkout, which
 *     branches on status (a 4xx carries a message for the shopper, a 5xx does not).
 *   • Nothing here touches the DOM.
 */
import { fetchJson, apiBase } from '/js/kit.js';

export class ApiError extends Error {
  constructor(message, { status = 0, data = null, offline = false, timeout = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.offline = offline;
    this.timeout = timeout;
  }
}

const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Low-level call. Never throws on a network failure.
 * @returns {Promise<{ok:boolean,status:number,data:any,offline:boolean,timeout:boolean}>}
 */
export function request(path, { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return fetchJson(`${apiBase()}${path}`, { timeoutMs, signal, init }).then((r) => ({
    ok: r.ok,
    status: r.status,
    data: r.data,
    offline: r.status === 0 && !r.aborted,
    timeout: !!r.aborted && !(signal && signal.aborted)
  }));
}

/** Turn a failed request() result into an ApiError with a shopper-readable message. */
function toError(r, what) {
  if (r.offline) return new ApiError('We could not reach the store. Check your connection and try again.', { ...r });
  if (r.timeout) return new ApiError('The store is taking too long to answer. Please try again.', { ...r });
  const serverMessage = r.data && (r.data.message || r.data.error);
  const message = (r.status < 500 && typeof serverMessage === 'string')
    ? serverMessage
    : `${what} is briefly unavailable. Please try again in a moment.`;
  return new ApiError(message, { ...r });
}

/** Message for a shopper from any thrown value. Raw server text never reaches the page. */
export function friendlyMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (err instanceof ApiError) return err.message || fallback;
  return fallback;
}

/* ── The customer's own order ──────────────────────────────────────────── */

/** POST /orders/lookup → { orderNumber, statusPath, statusUrl } or { pending: true }. Throws ApiError. */
export async function lookupOrder({ paymentIntentId, clientSecret }, { timeoutMs = 10000 } = {}) {
  const r = await request('/orders/lookup', { method: 'POST', body: { paymentIntentId, clientSecret }, timeoutMs });
  if (!r.ok) throw toError(r, 'Your order');
  return r.data || {};
}

/** GET /orders/:number?t=token → the order. Throws ApiError (status 404 for a wrong link). */
export async function getOrderStatus(orderNumber, token, { timeoutMs = 12000 } = {}) {
  const r = await request(`/orders/${encodeURIComponent(orderNumber)}?t=${encodeURIComponent(token)}`, { timeoutMs });
  if (r.status === 404) throw new ApiError('No order by that link', { ...r });
  if (!r.ok) throw toError(r, 'Your order');
  return (r.data && r.data.order) || null;
}

/* ── Catalogue ─────────────────────────────────────────────────────────── */

/**
 * GET /products → { products, productTypes }. Throws ApiError.
 * `productTypes` is the server's type registry (labels, order, coming-soon rows);
 * it is [] on an older response, and the grid copes.
 */
export async function getCatalogue({ timeoutMs = 12000 } = {}) {
  const r = await request('/products', { timeoutMs });
  if (!r.ok) throw toError(r, 'The catalogue');
  const d = r.data;
  const products = Array.isArray(d) ? d : (d && d.products) || [];
  const productTypes = d && !Array.isArray(d) && Array.isArray(d.productTypes) ? d.productTypes : [];
  keep({ products, productTypes });
  return { products, productTypes };
}

/* ── The catalogue, kept ─────────────────────────────────────────────────
   Fetched once and kept in this browser, so a product page opens on its own
   details at once — no wait, no skeleton — and the store redraws at once on
   the way back. Every product page used to fetch its product again on every
   open (Rohan, 25 Oct 2026: "fetch once and always quickly opened/closed").
   The list carries exactly the fields /products/:id does (checked 25 Oct
   2026), 156 KB for 102 products.
   A kept copy older than FRESH_MS is refreshed quietly behind the page. A
   price shown from it is never what is charged: checkout re-prices every line
   on the server (pricing.js) and says so if a price moved.                  */
const KEEP = 'kaayko:catalogue:v1';
const FRESH_MS = 60 * 1000;              // younger than this: not even a quiet refresh
const KEEP_MAX_MS = 24 * 60 * 60 * 1000; // older than this: not shown, fetched afresh
let kept;                                // parsed once per page

function keep(catalogue) {
  kept = { t: Date.now(), ...catalogue };
  try { localStorage.setItem(KEEP, JSON.stringify(kept)); } catch (_) { /* full or private: the network still works */ }
}

/** The kept catalogue, or null when there is none (or it is a day old). */
export function keptCatalogue() {
  if (kept === undefined) {
    try { kept = JSON.parse(localStorage.getItem(KEEP) || 'null'); } catch (_) { kept = null; }
  }
  return kept && Array.isArray(kept.products) && Date.now() - kept.t < KEEP_MAX_MS ? kept : null;
}

let refreshing = null;
function refreshQuietly() {
  const k = keptCatalogue();
  if (k && Date.now() - k.t < FRESH_MS) return null;
  refreshing = refreshing || getCatalogue().catch(() => null).finally(() => { refreshing = null; });
  return refreshing;
}

/** What a shopper sees of a product; a change in any of it is worth redrawing for. */
const seen = (p) => p && JSON.stringify([p.title, p.actualPrice, p.soldOut, p.isAvailable, p.availableSizes,
  p.productType, p.imgSrc, p.previewSrc, p.description, p.lesson]);   // a lesson's seats left and where

/**
 * The catalogue from the kept copy when there is one (refreshed quietly if old), else
 * fetched. `maxAgeMs`: a kept copy older than this is fetched afresh instead — the
 * store's own fresh visits use a minute, so a product uploaded a moment ago is there
 * on the next visit (Rohan tests in production); if that fetch fails, the kept copy
 * still beats an error.
 */
export async function catalogueFirst({ maxAgeMs } = {}) {
  const k = keptCatalogue();
  const use = (c) => ({ products: c.products, productTypes: c.productTypes || [] });
  if (k && (maxAgeMs === undefined || Date.now() - k.t < maxAgeMs)) { refreshQuietly(); return use(k); }
  try { return await getCatalogue(); } catch (err) { if (k) return use(k); throw err; }
}

/**
 * A product from the kept catalogue when it is there, else fetched. `onFresh(product)`
 * is called if the quiet refresh finds that this product has changed, and
 * `onFresh(null)` if it is no longer in the store at all (taken off sale, sent
 * back to review): the kept copy used to stay buyable on the page for a day.
 */
export async function productFirst(productId, { onFresh } = {}) {
  const hit = keptCatalogue()?.products.find((p) => p.id === productId);
  if (!hit) return getProduct(productId);
  const pending = refreshQuietly();
  if (pending && onFresh) {
    pending.then((fresh) => {
      if (!fresh) return;
      const now = fresh.products.find((p) => p.id === productId);
      if (!now) onFresh(null);
      else if (seen(now) !== seen(hit)) onFresh(now);
    });
  }
  return hit;
}

/** GET /products → the array. Throws ApiError. */
export async function getAllProducts(opts) {
  return (await getCatalogue(opts)).products;
}

/** GET /products/:id → the product. Throws ApiError (status 404 when unknown). */
export async function getProduct(productId) {
  if (!productId) throw new ApiError('Product not found', { status: 404 });
  const r = await request(`/products/${encodeURIComponent(productId)}`);
  if (r.status === 404) throw new ApiError('Product not found', { ...r });
  if (!r.ok) throw toError(r, 'This product');
  return (r.data && r.data.product) || r.data;
}

/** POST /products/:id/vote  body {voteChange: 1|-1}. Throws ApiError. */
export async function voteOnProduct(productId, voteChange, visitorId = null) {
  if (!productId) throw new ApiError('voteOnProduct requires a productId');
  if (voteChange !== 1 && voteChange !== -1) throw new ApiError('voteOnProduct requires +1 or -1');
  // visitorId lets the server count one love per visitor (api/products/votes.js).
  const body = visitorId ? { voteChange, visitorId } : { voteChange };
  const r = await request(`/products/${encodeURIComponent(productId)}/vote`, { method: 'POST', body });
  if (!r.ok) throw toError(r, 'Voting');
  return r.data;
}

/** GET /animals/:slug → { animal, products }. Throws ApiError (404 when unpublished). */
export async function getAnimal(slug) {
  if (!slug) throw new ApiError('Animal not found', { status: 404 });
  const r = await request(`/animals/${encodeURIComponent(slug)}`);
  if (r.status === 404) throw new ApiError('Animal not found', { ...r });
  if (!r.ok) throw toError(r, 'This page');
  return r.data;
}

/* ── Checkout ──────────────────────────────────────────────────────────────
   These return the raw request() result: the cart page decides what a 404
   (tax route absent) or a 4xx (a piece just sold out) means to the shopper.
   Prices are never sent; the server re-derives them from the catalogue.      */

export function createPaymentIntent(body) {
  return request('/createPaymentIntent', { method: 'POST', body, timeoutMs: 15000 });
}
export function calculateTax(body) {
  return request('/createPaymentIntent/tax', { method: 'POST', body, timeoutMs: 12000 });
}
export function updateContact(body) {
  return request('/createPaymentIntent/updateEmail', { method: 'POST', body, timeoutMs: 12000 });
}
