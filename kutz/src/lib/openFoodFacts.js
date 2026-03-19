/**
 * Open Food Facts — barcode lookup
 * Returns a normalized food item ready for preview/addFood.
 *
 * Note: text search is proxied through the backend (/api/kutz/searchFoods)
 * to avoid CORS — the OFf CGI search endpoint doesn't allow browser origins.
 * Barcode lookup uses the OFf product API which does support CORS.
 */

const OFF_BASE = 'https://world.openfoodfacts.org/api/v0/product';
const UA       = { 'User-Agent': 'KaleKutz/1.0 (kaayko.com)' };

/**
 * Look up a barcode via Open Food Facts.
 * @param {string} barcode — EAN-13 / UPC etc.
 * @returns {Promise<Object|null>}
 */
export async function lookupBarcode(barcode) {
  const resp = await fetch(`${OFF_BASE}/${barcode}.json`, { headers: UA });

  if (!resp.ok) return null;

  const json = await resp.json();
  if (json.status !== 1 || !json.product) return null;

  const p = json.product;
  const n = p.nutriments || {};

  const servingG = parseFloat(p.serving_size) || 100;
  const scale    = servingG / 100;

  const name     = p.product_name || p.product_name_en || 'Scanned product';
  const quantity = p.serving_size ? `${p.serving_size}` : '100g';

  return {
    name,
    quantity,
    calories: Math.round((n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0) * scale),
    protein:  Math.round((n['proteins_100g']    ?? n['proteins']    ?? 0) * scale * 10) / 10,
    carbs:    Math.round((n['carbohydrates_100g'] ?? 0) * scale * 10) / 10,
    fat:      Math.round((n['fat_100g']          ?? 0) * scale * 10) / 10,
    fiber:    Math.round((n['fiber_100g']        ?? n['fiber'] ?? 0) * scale * 10) / 10,
    iron:     Math.round((n['iron_100g']    ?? 0) * scale * 1000 * 10) / 10,
    calcium:  Math.round((n['calcium_100g'] ?? 0) * scale * 1000 * 10) / 10,
    zinc:     Math.round((n['zinc_100g']    ?? 0) * scale * 1000 * 10) / 10,
    b12:      0,
    meal:     'snacks',
    source:   'barcode',
  };
}
