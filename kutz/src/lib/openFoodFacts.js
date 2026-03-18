/**
 * Open Food Facts barcode lookup
 * Returns a normalized food item ready for preview/addFood
 */

const OFF_BASE = 'https://world.openfoodfacts.org/api/v0/product';

/**
 * Look up a barcode via Open Food Facts.
 * @param {string} barcode — EAN-13 / UPC etc.
 * @returns {Promise<{ name, calories, protein, fiber, quantity, meal, source } | null>}
 */
export async function lookupBarcode(barcode) {
  const resp = await fetch(`${OFF_BASE}/${barcode}.json`, {
    headers: { 'User-Agent': 'KaleKutz/1.0 (kaayko.com)' },
  });

  if (!resp.ok) return null;

  const json = await resp.json();
  if (json.status !== 1 || !json.product) return null;

  const p = json.product;
  const n = p.nutriments || {};

  // Prefer per-100g values; scale to serving size if listed
  const servingG = parseFloat(p.serving_size) || 100;
  const scale    = servingG / 100;

  const calories = Math.round((n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0) * scale);
  const protein  = Math.round((n['proteins_100g']    ?? n['proteins']    ?? 0) * scale * 10) / 10;
  const fiber    = Math.round((n['fiber_100g']        ?? n['fiber']       ?? 0) * scale * 10) / 10;

  const name     = p.product_name || p.product_name_en || 'Scanned product';
  const quantity = p.serving_size ? `${p.serving_size}` : '100g';

  return {
    name,
    calories,
    protein,
    fiber,
    quantity,
    meal:   'snacks',
    source: 'barcode',
  };
}
