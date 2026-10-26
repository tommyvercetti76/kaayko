/**
 * cartManager.js — the bag. One instance, kept in localStorage — or, where the
 *     browser blocks it, in sessionStorage, a cookie, or (with cookies blocked too)
 *     the page address itself (services/safeStorage.js; "Where the bag lives", below).
 *
 *   • At most 5 distinct products (by productId); quantity is structurally 1. (2 until 24 Oct 2026.)
 *   • Money is integer cents (`priceCents`), never a display string. The server
 *     re-prices every line at checkout; this figure is only what the shopper sees
 *     before that happens. See priceMap.js.
 *   • Two ways to hear about changes: subscribe(cb) for modules, and the
 *     `kaayko:cartchange` DOM event for classic scripts (header.js paints the badge).
 *   • Publishes itself as window.cartManager for those classic scripts. Modules import it.
 */

import { get as storeGet, set as storeSet, storageMode } from '/js/services/safeStorage.js';

const STORAGE_KEY = 'kaayko_cart';
export const MAX_DISTINCT = 5;

/* ── Where the bag lives ─────────────────────────────────────────────────────
   Normally localStorage. With every kind of storage blocked (Safari's "Block all
   cookies" blocks cookies AND localStorage), the bag rides in the address after
   "#kbag=" — never sent to a server — and every way the store moves between
   pages carries it: links (a capture listener below) and the few scripted moves
   (carryBag()). Found 26 Oct 2026: such a browser emptied the bag on every page,
   so nothing could be bought. */
const HASH_KEY = 'kbag';
const b64 = {
  enc: (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))),
};
const inAddressOnly = () => storageMode() === 'memory' && typeof location !== 'undefined';
function bagFromAddress() {
  try {
    const m = location.hash.match(new RegExp(`(?:^#|&)${HASH_KEY}=([A-Za-z0-9_-]+)`));
    return m ? b64.dec(m[1]) : null;
  } catch (_) { return null; }
}
function hashWithBag(hash, json) {
  const rest = (hash || '').replace(/^#/, '').split('&').filter((p) => p && !p.startsWith(`${HASH_KEY}=`));
  if (json && json !== '[]') rest.push(`${HASH_KEY}=${b64.enc(json)}`);
  return rest.length ? `#${rest.join('&')}` : '';
}

/** A store URL that carries the bag, when the address is the only place it can live. */
export function carryBag(url) {
  if (!inAddressOnly()) return url;
  try {
    const u = new URL(url, location.href);
    if (u.origin !== location.origin) return url;
    const json = storeGet(STORAGE_KEY);
    u.hash = hashWithBag(u.hash, json);
    return u.pathname + u.search + u.hash;
  } catch (_) { return url; }
}

/** One-time migration for bags saved before 12 Sep 2026, which held price as "$29.99". */
function migrate(item) {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.priceCents !== 'number' && typeof item.price === 'string') {
    const n = parseFloat(item.price.replace(/[^0-9.]/g, ''));
    item.priceCents = Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  }
  delete item.price;
  return item;
}

class CartManager {
  constructor() {
    this.listeners = [];
    this.cart = [];
    this.load();
  }

  load() {
    try {
      let stored = storeGet(STORAGE_KEY);
      if (stored == null && inAddressOnly()) {
        stored = bagFromAddress();
        if (stored) storeSet(STORAGE_KEY, stored);   // so the next link carries it on
      }
      const parsed = stored ? JSON.parse(stored) : [];
      this.cart = Array.isArray(parsed) ? parsed.map(migrate).filter(Boolean) : [];
    } catch (e) {
      console.error('Failed to load cart:', e);
      this.cart = [];
    }
  }

  save() {
    const json = JSON.stringify(this.cart);
    try {
      storeSet(STORAGE_KEY, json);
      // nowhere else to keep it: the address carries it, so a reload keeps it too
      if (inAddressOnly()) history.replaceState(history.state, '', location.pathname + location.search + hashWithBag(location.hash, json));
    } catch (e) {
      console.error('Failed to save cart:', e);
    }
    this.notifyListeners();
  }

  getItems() { return this.cart.map((i) => ({ ...i })); }
  getCount() { return this.cart.length; }
  hasProduct(productId) { return this.cart.some((i) => i.productId === productId); }
  getItem(productId) { return this.cart.find((i) => i.productId === productId); }
  canAddNewProduct() { return this.cart.length < MAX_DISTINCT; }

  /**
   * Add or update a line. `priceCents` is what priceMap.priceCents(product) returned
   * (null when the product cannot be priced — the server will refuse it at checkout).
   * @returns {boolean} false when the bag is full
   */
  addItem({ productId, title, subtitle, priceCents = null, imgSrc, size, gender }) {
    const existingIndex = this.cart.findIndex((i) => i.productId === productId);
    const item = {
      productId,
      title,
      subtitle,
      priceCents: typeof priceCents === 'number' && Number.isFinite(priceCents) ? priceCents : null,
      imgSrc: Array.isArray(imgSrc) ? imgSrc[0] : imgSrc,
      size,
      gender,
      addedAt: Date.now()
    };
    if (existingIndex >= 0) {
      this.cart[existingIndex] = { ...this.cart[existingIndex], ...item };
    } else {
      if (!this.canAddNewProduct()) return false;
      this.cart.push(item);
    }
    this.save();
    return true;
  }

  updateItem(productId, { size, gender }) {
    const item = this.cart.find((i) => i.productId === productId);
    if (!item) return false;
    if (size) item.size = size;
    if (gender) item.gender = gender;
    this.save();
    return true;
  }

  removeItem(productId) {
    const before = this.cart.length;
    this.cart = this.cart.filter((i) => i.productId !== productId);
    if (this.cart.length === before) return false;
    this.save();
    return true;
  }

  clear() {
    this.cart = [];
    this.save();
  }

  /** Catalogue subtotal in cents, before the server has priced the bag. */
  getTotalCents() {
    return this.cart.reduce((sum, i) => sum + (i.priceCents || 0) * (i.quantity || 1), 0);
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => { this.listeners = this.listeners.filter((cb) => cb !== callback); };
  }

  notifyListeners() {
    const items = this.getItems();
    this.listeners.forEach((cb) => { try { cb(items); } catch (e) { console.error('cart listener failed:', e); } });
    try {
      document.dispatchEvent(new CustomEvent('kaayko:cartchange', { detail: { count: items.length, items } }));
    } catch (_) { /* no document (tests) */ }
  }
}

export const cartManager = new CartManager();
if (typeof window !== 'undefined') {
  window.cartManager = cartManager;
  cartManager.carryBag = carryBag;          // for classic scripts (header.js, secretStore.js)
}

// Address-only: every same-site link the shopper follows takes the bag along.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', (e) => {
    if (!inAddressOnly() || !cartManager.getCount()) return;
    const a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.origin !== location.origin) return;
    if (a.pathname === location.pathname && a.search === location.search && a.hash) return;   // an in-page anchor
    a.href = carryBag(a.href);
  }, true);
}
