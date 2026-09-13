/**
 * priceMap.js — the client's ONE price authority. Pure: no DOM, no fetch, testable in node.
 *
 * `kaaykoproducts.price` is a TIER SYMBOL ("$" … "$$$$"), not a dollar string:
 * kaayko/scripts/store_uploader/firestore_writer.py writes price_to_symbol(actualPrice).
 * Only some products also carry a numeric `actualPrice` (18 of 36 on 12 Sep 2026), and six
 * legacy docs hold a literal "$24.99" in `price`.
 *
 * priceCents() below is a line-for-line mirror of resolvePrice() in
 * kaayko-api/functions/api/checkout/pricing.js, which is the authority at checkout:
 *   1. actualPrice, if a finite number → its cents, or null when ≤ 0 (no fallback)
 *   2. price as a run of "$" → the tier table
 *   3. price as a legacy numeric string → parsed
 * Change one and you must change the other, or shoppers are shown a price they are not
 * charged. The test in kaayko/tests/priceMap.test.mjs pins every branch.
 *
 * Money is INTEGER CENTS everywhere on the client from here on. money() is the only
 * place cents become a string, so "$29.99" is never parsed back into a number.
 */
export const PRICE_SYMBOL_CENTS = Object.freeze({
  "$": 1999,
  "$$": 2999,
  "$$$": 3999,
  "$$$$": 4999
});

/** Integer cents → "$12.34". Anything that is not a finite number → "". */
export function money(cents) {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "";
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(Math.round(cents)) / 100).toFixed(2)}`;
}

/** Integer cents the server would charge for this product, or null if it cannot be priced. */
export function priceCents(product) {
  const ap = product?.actualPrice;
  if (typeof ap === "number" && Number.isFinite(ap)) {
    const cents = Math.round(ap * 100);
    return cents > 0 ? cents : null;
  }
  const raw = typeof product?.price === "string" ? product.price.trim() : "";
  if (!raw) return null;
  if (/^\$+$/.test(raw)) return PRICE_SYMBOL_CENTS[raw] || null;
  const parsed = parseFloat(raw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  const cents = Math.round(parsed * 100);
  return cents > 0 ? cents : null;
}

/** Display price, or "" when the product carries no usable price. */
export function priceText(product) {
  return money(priceCents(product));
}

/** Tier symbol → display string. Kept for the filter chips; derived, never hand-written. */
export const PRICE_MAP = Object.freeze(
  Object.fromEntries(Object.entries(PRICE_SYMBOL_CENTS).map(([symbol, cents]) => [symbol, money(cents)]))
);
