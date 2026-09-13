/**
 * priceMap.js is a mirror of resolvePrice() in
 * kaayko-api/functions/api/checkout/pricing.js. Every branch is pinned here; if the
 * server's rule changes, change both and this file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { money, priceCents, priceText, PRICE_MAP, PRICE_SYMBOL_CENTS } from '../src/js/priceMap.js';

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

test('actualPrice wins when finite and positive', () => {
  assert.equal(priceCents({ actualPrice: 24.99, price: '$$$$' }), 2499);
  assert.equal(priceCents({ actualPrice: 29.995 }), 3000);       // Math.round, like the server
  assert.equal(priceCents({ actualPrice: 34.99, price: '$34.99' }), 3499);
});

test('a non-positive actualPrice makes the product unpriceable — no fallback to the symbol', () => {
  assert.equal(priceCents({ actualPrice: 0, price: '$$' }), null);
  assert.equal(priceCents({ actualPrice: -5, price: '$$' }), null);
});

test('a non-numeric actualPrice is ignored and the symbol is used', () => {
  assert.equal(priceCents({ actualPrice: '24.99', price: '$$' }), 2999);
  assert.equal(priceCents({ actualPrice: NaN, price: '$$$' }), 3999);
  assert.equal(priceCents({ actualPrice: null, price: '$' }), 1999);
});

test('tier symbols map through the table; unknown runs are null', () => {
  for (const [symbol, cents] of Object.entries(PRICE_SYMBOL_CENTS)) {
    assert.equal(priceCents({ price: symbol }), cents);
    assert.equal(priceCents({ price: ` ${symbol} ` }), cents);   // trimmed
  }
  assert.equal(priceCents({ price: '$$$$$' }), null);
});

test('legacy numeric strings are parsed like the server does', () => {
  assert.equal(priceCents({ price: '$24.99' }), 2499);
  assert.equal(priceCents({ price: '1,299.00' }), 129900);
  assert.equal(priceCents({ price: ' $ 19.99 ' }), 1999);
  assert.equal(priceCents({ price: 'free' }), null);
  assert.equal(priceCents({ price: '$0' }), null);
});

test('missing or malformed products are null, never 0', () => {
  assert.equal(priceCents(undefined), null);
  assert.equal(priceCents({}), null);
  assert.equal(priceCents({ price: '' }), null);
  assert.equal(priceCents({ price: 24.99 }), null);              // a number in `price` is not a symbol
});

test('priceText is money(priceCents) and PRICE_MAP is derived from the table', () => {
  assert.equal(priceText({ price: '$$' }), '$29.99');
  assert.equal(priceText({}), '');
  assert.deepEqual(PRICE_MAP, { '$': '$19.99', '$$': '$29.99', '$$$': '$39.99', '$$$$': '$49.99' });
});
