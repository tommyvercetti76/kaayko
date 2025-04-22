/**
 * scripts/kaayko_apiClient.js
 *
 * Thin wrapper over our Cloud Functions API.
 * • All fetches return JSON.
 * • Errors on non‑OK responses.
 */

const API_BASE = "https://us-central1-kaayko-api-dev.cloudfunctions.net/api";

/**
 * Fetches the full list of products.
 *
 * GET /products
 *
 * @returns {Promise<Array<Object>>} Resolves to an array of product objects.
 * @throws {Error} If the network request fails or returns non‑OK.
 */
export async function getAllProducts() {
  const res = await fetch(`${API_BASE}/products`);
  if (!res.ok) {
    throw new Error(`getAllProducts failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Fetches a single product by its Firestore document ID.
 *
 * GET /products/:id
 *
 * @param {string} productId – the Firestore document ID of the product
 * @returns {Promise<Object>} Resolves to the product object.
 * @throws {Error} If the network request fails, returns 404, or non‑OK.
 */
export async function getProductByID(productId) {
  if (!productId) {
    throw new Error("getProductByID requires a productId");
  }
  const res = await fetch(`${API_BASE}/products/${encodeURIComponent(productId)}`);
  if (res.status === 404) {
    throw new Error(`Product ${productId} not found (404)`);
  }
  if (!res.ok) {
    throw new Error(`getProductByID failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Sends a vote change (+1 or -1) for a given product.
 *
 * POST /products/:id/vote
 * Body: { voteChange: 1 | -1 }
 *
 * @param {string} productId – Firestore document ID of the product
 * @param {1|-1}   voteChange – +1 to upvote, -1 to remove vote
 * @returns {Promise<{success: boolean}>} Resolves to { success: true } on success.
 * @throws {Error} If the network request fails or returns non‑OK.
 */
export async function voteOnProduct(productId, voteChange) {
  if (!productId) {
    throw new Error("voteOnProduct requires a productId");
  }
  if (![1, -1].includes(voteChange)) {
    throw new Error("voteOnProduct requires voteChange of +1 or -1");
  }

  const res = await fetch(
    `${API_BASE}/products/${encodeURIComponent(productId)}/vote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voteChange })
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `voteOnProduct failed: ${res.status} ${res.statusText} ${body}`
    );
  }
  return res.json();
}