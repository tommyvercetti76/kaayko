/**
 * productTypes.js — the storefront's view of the product-type registry.
 *
 * The registry lives on the server (kaayko-api config/productTypes.js) and rides
 * along on GET /products as `productTypes`. pages/store.js hands it to
 * setProductTypes(); every label, section order and the coming-soon line then
 * come from it. When a page has not fetched the list (a PDP), LABELS below is the
 * fallback for names only.
 *
 * Money never comes from here. A product's price is its `actualPrice`
 * (priceMap.js); the registry's priceCents is shown only for types that are
 * coming soon, which nothing can buy.
 */

const LABELS = Object.freeze({
  tshirt:  { label: "T-Shirts", singular: "T-Shirt" },
  hoodie:  { label: "Hoodies",  singular: "Hoodie" },
  tote:    { label: "Totes",    singular: "Tote" },
  bottle:  { label: "Bottles",  singular: "Bottle" },
  magnet:  { label: "Magnets",  singular: "Magnet" },
  mug:     { label: "Mugs",     singular: "Mug" },
  sticker: { label: "Stickers", singular: "Sticker" }
});

let registry = [];

const norm = (key) => String(key || "").trim().toLowerCase();

/** Remember the registry the API sent with the catalogue. */
export function setProductTypes(list) {
  registry = Array.isArray(list)
    ? list.filter((t) => t && typeof t.key === "string").map((t) => ({ ...t, key: norm(t.key) }))
    : [];
}

/** The registry as last set (empty on pages that never fetched it). */
export function productTypes() {
  return registry.slice();
}

export function typeFor(key) {
  const k = norm(key);
  return registry.find((t) => t.key === k) || null;
}

/** "T-Shirts" / "T-Shirt" for a type key; a capitalised key for one nobody registered; "Other" for none. */
export function labelForType(key, { singular = false } = {}) {
  const k = norm(key);
  if (!k) return singular ? "" : "Other";
  const row = typeFor(k) || LABELS[k];
  if (row) return singular ? row.singular : row.label;
  return k[0].toUpperCase() + k.slice(1);
}

/** Registry order for sorting product lists; unknown types sort last. */
export function typeRank(key) {
  const k = norm(key);
  const order = registry.length ? registry.map((t) => t.key) : Object.keys(LABELS);
  const i = order.indexOf(k);
  return i === -1 ? order.length : i;
}

/** Types the grid names but nothing sells yet. */
export function comingSoonTypes() {
  return registry.filter((t) => t.status === "coming_soon");
}

/**
 * What people type when they mean a type. Search folds these into every card's
 * haystack so "tee", "t-shirt" and "shirt" all find the shirts, and "bag" the totes.
 */
const SEARCH_TERMS = Object.freeze({
  tshirt:  "tshirt t-shirt tee tees shirt shirts top apparel",
  hoodie:  "hoodie hoodies sweatshirt sweater pullover apparel",
  tote:    "tote totes bag bags tote-bag canvas",
  bottle:  "bottle bottles water-bottle flask drinkware",
  magnet:  "magnet magnets fridge-magnet fridge",
  mug:     "mug mugs cup cups coffee drinkware",
  sticker: "sticker stickers decal decals"
});

export function searchTermsFor(key) {
  return SEARCH_TERMS[norm(key)] || "";
}
