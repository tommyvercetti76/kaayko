/**
 * priceMap.js — the client's ONE price authority. Pure: no DOM, no fetch, testable in node.
 *
 * A product's price is its `actualPrice`, in dollars, written by the uploader from the
 * product-type registry (kaayko-api config/productTypes.js) or set in Kortex. The
 * migration on 13 Sep 2026 wrote it onto every house product; the tier symbol that
 * `price` used to hold ("$" … "$$$$") is retired and never read, here or on the server.
 *
 * priceCents() mirrors resolveUnitPriceCents() in kaayko-api/functions/api/checkout/pricing.js
 * for the case the client can see: a finite, positive actualPrice → its cents; anything
 * else → null, and the product cannot be bought. The server additionally falls back to
 * the type's registry price for a document that carries no actualPrice at all; such a
 * document is a data error the admin view flags, not a state the storefront prices.
 *
 * Money is INTEGER CENTS everywhere on the client. money() is the only place cents
 * become a string, so "$29.99" is never parsed back into a number.
 */

/** Integer cents → "$12.34". Anything that is not a finite number → "". */
export function money(cents) {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "";
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(Math.round(cents)) / 100).toFixed(2)}`;
}

/** Integer cents the server would charge for this product, or null if it cannot be priced. */
export function priceCents(product) {
  const ap = product?.actualPrice;
  if (typeof ap !== "number" || !Number.isFinite(ap)) return null;
  const cents = Math.round(ap * 100);
  return cents > 0 ? cents : null;
}

/** Display price, or "" when the product carries no usable price. */
export function priceText(product) {
  return money(priceCents(product));
}
