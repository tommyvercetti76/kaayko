/**
 * Catalogue price tiers — the single client-side source of truth.
 *
 * `kaaykoproducts.price` is a TIER SYMBOL ("$" … "$$$$"), not a dollar
 * string: see kaayko/scripts/store_uploader/firestore_writer.py, which
 * writes price_to_symbol(actualPrice). Only some products also carry a
 * numeric `actualPrice`; at the time of writing 26 of 39 do not, so a
 * caller that treats `price` as a number gets NaN for two thirds of the
 * catalogue.
 *
 * The server mirrors this table as PRICE_SYMBOL_CENTS in
 * kaayko-api/functions/api/checkout/pricing.js and is the authority at
 * checkout. Change one and you must change the other, or shoppers are
 * shown a price they are not charged.
 */
export const PRICE_MAP = Object.freeze({
  "$": "$19.99",
  "$$": "$29.99",
  "$$$": "$39.99",
  "$$$$": "$49.99"
});

/**
 * Display price for a product, as a formatted dollar string.
 * Returns "" when the product carries no usable price.
 */
export function priceText(product) {
  if (typeof product?.actualPrice === "number") {
    return `$${product.actualPrice.toFixed(2)}`;
  }
  const symbol = String(product?.price ?? "").trim();
  return PRICE_MAP[symbol] || "";
}
