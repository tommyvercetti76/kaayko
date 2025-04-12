// scripts/kaayko_dataService.js

import { db, storage } from "./kaayko_firebaseConfig.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  increment,
  query,
  where
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  ref,
  listAll,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

/**
 * Fetches all products from "kaaykoproducts", merges each product
 * with its associated image URLs from Firebase Storage.
 *
 * @returns {Promise<Array<Object>>} Array of products, each with "imgSrc".
 */
export async function fetchProductData() {
  try {
    const snapshot = await getDocs(collection(db, "kaaykoproducts"));
    const productList = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    // For each product, fetch images
    const productsWithImages = await Promise.all(
      productList.map(async product => {
        const images = await fetchImagesByProductId(product.productID);
        return { ...product, imgSrc: images };
      })
    );

    return productsWithImages;
  } catch (error) {
    console.error("Error fetching product data:", error);
    return [];
  }
}

/**
 * Fetches image URLs for a given product ID from Firebase Storage.
 * @param {string} productID - The product's folder ID in Storage.
 * @returns {Promise<Array<string>>} Array of image download URLs.
 */
export async function fetchImagesByProductId(productID) {
  try {
    const storageRef = ref(storage, `kaaykoStoreTShirtImages/${productID}`);
    const result = await listAll(storageRef);
    return await Promise.all(result.items.map(imageRef => getDownloadURL(imageRef)));
  } catch (error) {
    console.error("Error fetching images for product:", error);
    return [];
  }
}

/* --------------------------------------------------------------------------
 *                          Category-Based Fetching
 * -------------------------------------------------------------------------- */

/**
 * Fetches unique categories from "kaaykoproducts".
 * We remove "All" entirely, so only real categories remain.
 *
 * @returns {Promise<Array<string>>} e.g. ["Apparel", "Shoes"]
 * If you only want "Apparel", ensure the Firestore docs have that category.
 */
export async function fetchAllCategories() {
  try {
    const snapshot = await getDocs(collection(db, "kaaykoproducts"));
    const categoriesSet = new Set();

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (typeof data.category === "string" && data.category.trim().length > 0) {
        categoriesSet.add(data.category);
      }
    });

    // Return an array with no "All"
    return [...Array.from(categoriesSet)];
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

/**
 * Fetches products for a given category. If your site
 * only has "Apparel," then that is all you'll see.
 *
 * @param {string} category - The category name from Firestore docs.
 * @returns {Promise<Array<Object>>} Filtered product objects.
 */
export async function fetchProductsByCategory(category) {
  try {
    const allProducts = await fetchProductData();
    // If user selects "Apparel", we filter for product.category === "Apparel"
    return allProducts.filter(product => product.category === category);
  } catch (error) {
    console.error("Error fetching products by category:", error);
    return [];
  }
}

/* --------------------------------------------------------------------------
 *                          Voting (Likes)
 * -------------------------------------------------------------------------- */

/**
 * Atomically updates the "votes" field in Firestore for a given product.
 * @param {string} productId - The document ID in Firestore.
 * @param {number} voteChange - +1 or -1
 */
export async function updateProductVotes(productId, voteChange) {
  try {
    const productRef = doc(db, "kaaykoproducts", productId);
    await updateDoc(productRef, { votes: increment(voteChange) });
  } catch (error) {
    console.error("Error updating vote count:", error);
  }
}