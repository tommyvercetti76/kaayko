/**
 * priceMap.js is the client's one price authority: actualPrice, in cents, or nothing.
 * The tier symbol and legacy dollar strings were retired on 13 Sep 2026; these tests
 * pin that they are never read again. The server's registry fallback
 * (kaayko-api config/productTypes.js) is tested there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { money, priceCents, priceText, approxRupees, approxRupeesSum } from '../src/js/priceMap.js';

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

test('approxRupees: whole rupees, Indian grouping, always marked approximate', () => {
  assert.equal(approxRupees(1999, 94.94), '≈ ₹1,898');          // 19.99 × 94.94 = 1897.85
  assert.equal(approxRupees(999, 94.94), '≈ ₹948');
  assert.equal(approxRupees(105397, 95), '≈ ₹1,00,127');          // lakh grouping
  assert.equal(approxRupees(-500, 94.94), '≈ −₹475');             // a discount
  assert.equal(approxRupees(0, 94.94), '≈ ₹0');
  assert.equal(approxRupees(1999, 0), '');                        // no usable rate: nothing, never ₹0
  assert.equal(approxRupees(1999, NaN), '');
  assert.equal(approxRupees(1999, undefined), '');
  assert.equal(approxRupees('1999', 94.94), '');                  // a string is never money
});

test('approxRupeesSum: a total is the sum of the rupee lines above it', () => {
  // two $9.99 magnets: ≈ ₹948 each; converting $19.98 whole gave ≈ ₹1,897
  assert.equal(approxRupees(1998, 94.94), '≈ ₹1,897');
  assert.equal(approxRupeesSum([999, 999], 94.94), '≈ ₹1,896');
  assert.equal(approxRupeesSum([2499, 999, -350, 210], 94.94), '≈ ₹3,188');   // 2373 + 948 − 332 + 199, each rounded
  assert.equal(approxRupeesSum([-999], 94.94), '≈ −₹948');
  assert.equal(approxRupeesSum([], 94.94), '');
  assert.equal(approxRupeesSum([999, NaN], 94.94), '');
  assert.equal(approxRupeesSum([999], 0), '');
});
