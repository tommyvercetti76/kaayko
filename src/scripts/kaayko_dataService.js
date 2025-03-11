// scripts/kaayko_dataService.js
import { db, storage } from "./kaayko_firebaseConfig.js";
import { collection, getDocs, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { ref, listAll, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

/**
 * Fetches all products from the "kaaykoproducts" collection.
 * You can later enhance this function with query limits or field projections.
 */
export async function fetchProductData() {
  try {
    const snapshot = await getDocs(collection(db, "kaaykoproducts"));
    const productList = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
    // Fetch images for each product in parallel
    const productsWithImages = await Promise.all(
      productList.map(async (product) => {
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
 * Fetches image URLs for a given product from Storage.
 * @param {string} productID 
 * @returns {Promise<string[]>}
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

/**
 * Updates the vote count for a product.
 * Uses atomic increment to avoid race conditions.
 * @param {string} productId 
 * @param {number} voteChange - +1 for like, -1 for unlike.
 */
export async function updateProductVotes(productId, voteChange) {
  try {
    const productRef = doc(db, "kaaykoproducts", productId);
    await updateDoc(productRef, { votes: increment(voteChange) });
  } catch (error) {
    console.error("Error updating vote count:", error);
  }
}