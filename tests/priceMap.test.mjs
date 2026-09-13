/**
 * priceMap.js is the client's one price authority: actualPrice, in cents, or nothing.
 * The tier symbol and legacy dollar strings were retired on 13 Sep 2026; these tests
 * pin that they are never read again. The server's registry fallback
 * (kaayko-api config/productTypes.js) is tested there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { money, priceCents, priceText } from '../src/js/priceMap.js';

test('money formats integer cents and nothing else', () => {
  assert.equal(money(2499), '$24.99');
  assert.equal(money(0), '$0.00');
  assert.equal(money(5), '$0.05');
  assert.equal(money(-150), '-$1.50');
  assert.equal(money(1999.6), '$20.00');       // rounds, never truncates
  assert.equal(money(null), '');
  assert.equal(money(undefined), '');
  assert.equal(money('24.99'), '');            // a string is never money
  assert.equal(money(NaN), '');
});

test('actualPrice is the price when finite and positive', () => {
  assert.equal(priceCents({ actualPrice: 19.99 }), 1999);
  assert.equal(priceCents({ actualPrice: 5.99 }), 599);
  assert.equal(priceCents({ actualPrice: 29.995 }), 3000);       // Math.round, like the server
  assert.equal(priceCents({ actualPrice: 24.99, price: '$$$$' }), 2499);
});

test('a non-positive actualPrice makes the product unpriceable', () => {
  assert.equal(priceCents({ actualPrice: 0 }), null);
  assert.equal(priceCents({ actualPrice: -5 }), null);
});

test('a non-numeric actualPrice is not a price', () => {
  assert.equal(priceCents({ actualPrice: '24.99' }), null);
  assert.equal(priceCents({ actualPrice: NaN }), null);
  assert.equal(priceCents({ actualPrice: null }), null);
  assert.equal(priceCents({ actualPrice: Infinity }), null);
});

test('the retired tier symbol and legacy strings are never read', () => {
  assert.equal(priceCents({ price: '$$' }), null);
  assert.equal(priceCents({ price: '$$$$' }), null);
  assert.equal(priceCents({ price: '$24.99' }), null);
  assert.equal(priceCents({ price: '1,299.00' }), null);
  assert.equal(priceCents({ price: 24.99 }), null);
});

test('missing or malformed products are null, never 0', () => {
  assert.equal(priceCents(undefined), null);
  assert.equal(priceCents(null), null);
  assert.equal(priceCents({}), null);
});

test('priceText is money(priceCents)', () => {
  assert.equal(priceText({ actualPrice: 29.99 }), '$29.99');
  assert.equal(priceText({ price: '$$' }), '');
  assert.equal(priceText({}), '');
});
