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
  return { products, productTypes };
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
export async function voteOnProduct(productId, voteChange) {
  if (!productId) throw new ApiError('voteOnProduct requires a productId');
  if (voteChange !== 1 && voteChange !== -1) throw new ApiError('voteOnProduct requires +1 or -1');
  const r = await request(`/products/${encodeURIComponent(productId)}/vote`, { method: 'POST', body: { voteChange } });
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
