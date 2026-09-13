/**
 * cartManager.js — the bag. One instance, persisted in localStorage.
 *
 *   • At most 2 distinct products (by productId); quantity is structurally 1.
 *   • Money is integer cents (`priceCents`), never a display string. The server
 *     re-prices every line at checkout; this figure is only what the shopper sees
 *     before that happens. See priceMap.js.
 *   • Two ways to hear about changes: subscribe(cb) for modules, and the
 *     `kaayko:cartchange` DOM event for classic scripts (header.js paints the badge).
 *   • Publishes itself as window.cartManager for those classic scripts. Modules import it.
 */

const STORAGE_KEY = 'kaayko_cart';
const MAX_DISTINCT = 2;

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
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      this.cart = Array.isArray(parsed) ? parsed.map(migrate).filter(Boolean) : [];
    } catch (e) {
      console.error('Failed to load cart:', e);
      this.cart = [];
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cart));
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
if (typeof window !== 'undefined') window.cartManager = cartManager;
