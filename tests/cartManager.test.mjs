/**
 * The bag: cents in, cents out, two distinct products, one event per change,
 * and bags saved before 12 Sep 2026 (price as "$29.99") migrate on load.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Browser globals the module reaches for. Installed before the import below runs.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};
const events = [];
globalThis.document = { dispatchEvent: (e) => events.push(e) };
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
globalThis.window = globalThis;

store.set('kaayko_cart', JSON.stringify([
  { productId: 'old1', title: 'Old tote', price: '$29.99', imgSrc: 'x.webp', size: 'One Size', gender: null }
]));
const { cartManager } = await import('../src/js/cartManager.js');

beforeEach(() => { events.length = 0; });

test('a legacy bag migrates its display price to cents and drops the string', () => {
  const item = cartManager.getItem('old1');
  assert.equal(item.priceCents, 2999);
  assert.equal('price' in item, false);
  assert.equal(cartManager.getTotalCents(), 2999);
});

test('addItem stores priceCents, keeps the first image, and announces once', () => {
  const ok = cartManager.addItem({ productId: 'p2', title: 'Bottle', subtitle: '', priceCents: 2499, imgSrc: ['a.webp', 'b.webp'], size: '20 oz', gender: null });
  assert.equal(ok, true);
  const item = cartManager.getItem('p2');
  assert.equal(item.priceCents, 2499);
  assert.equal(item.imgSrc, 'a.webp');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'kaayko:cartchange');
  assert.equal(events[0].detail.count, 2);
  assert.equal(cartManager.getTotalCents(), 5498);
});

test('a bag holds two distinct products and refuses a third', () => {
  assert.equal(cartManager.canAddNewProduct(), false);
  assert.equal(cartManager.addItem({ productId: 'p3', title: 'Third', priceCents: 1999, imgSrc: 'c.webp', size: 'M', gender: 'Female' }), false);
  assert.equal(cartManager.getCount(), 2);
});

test('re-adding a product updates it in place instead of duplicating', () => {
  cartManager.addItem({ productId: 'p2', title: 'Bottle', priceCents: 2499, imgSrc: 'a.webp', size: '32 oz', gender: null });
  assert.equal(cartManager.getCount(), 2);
  assert.equal(cartManager.getItem('p2').size, '32 oz');
});

test('an unpriceable product is stored with priceCents null and counts as 0', () => {
  cartManager.removeItem('old1');
  cartManager.addItem({ productId: 'p4', title: 'Mystery', priceCents: null, imgSrc: 'd.webp', size: 'One Size', gender: null });
  assert.equal(cartManager.getItem('p4').priceCents, null);
  assert.equal(cartManager.getTotalCents(), 2499);
});

test('getItems returns copies, and what is saved is what is read back', () => {
  const items = cartManager.getItems();
  items[0].title = 'tampered';
  assert.notEqual(cartManager.getItems()[0].title, 'tampered');
  assert.deepEqual(JSON.parse(store.get('kaayko_cart')).map((i) => i.productId), cartManager.getItems().map((i) => i.productId));
});

test('clear empties the bag and announces count 0', () => {
  cartManager.clear();
  assert.equal(cartManager.getCount(), 0);
  assert.equal(events.at(-1).detail.count, 0);
});
