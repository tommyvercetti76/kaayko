// scripts/kaayko_apiClient.js

/**
 * @file kaayko_apiClient.js
 * @description
 *   Thin wrapper over the Kaayko Store REST API.
 *   All product data (including image URLs) and voting
 *   is done via HTTP, so your front‑end no longer needs
 *   direct Firebase imports.
 */

/** Base URL of your deployed API — change to prod when ready */
const BASE_URL = "https://us-central1-kaayko-api-dev.cloudfunctions.net/api";

/**
 * Fetches the full list of products (with imgSrc arrays).
 * @returns {Promise<Array<Object>>} resolves to array of product objects.
 */
export async function getAllProducts() {
  const res = await fetch(`${BASE_URL}/products`);
  if (!res.ok) {
    throw new Error(`API error (${res.status}): ${await res.text()}`);
  }
  return await res.json();
}

/**
 * Fetches a single product by its Firestore docID.
 * @param {string} id – the Firestore document ID.
 * @returns {Promise<Object>} resolves to a single product object.
 */
export async function getProductById(id) {
  const res = await fetch(`${BASE_URL}/products/${encodeURIComponent(id)}`);
  if (res.status === 404) {
    throw new Error("Product not found");
  }
  if (!res.ok) {
    throw new Error(`API error (${res.status}): ${await res.text()}`);
  }
  return await res.json();
}

/**
 * Atomically updates the vote count for a product.
 * @param {string} id         – Firestore document ID.
 * @param {1|-1}   voteChange – +1 to upvote, −1 to remove vote.
 * @returns {Promise<boolean>} resolves true on success.
 */
export async function voteOnProduct(id, voteChange) {
  const res = await fetch(
    `${BASE_URL}/products/${encodeURIComponent(id)}/vote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voteChange })
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `Vote API error (${res.status})`);
  }
  return (await res.json()).success === true;
}