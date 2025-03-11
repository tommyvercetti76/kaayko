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
 * Fetches all products from the "kaaykoproducts" collection.
 * Merges each product with its associated image URLs.
 * @returns {Promise<Array<Object>>} Array of product objects with imgSrc added.
 */
export async function fetchProductData() {
  try {
    const snapshot = await getDocs(collection(db, "kaaykoproducts"));
    const productList = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    // Fetch images for each product in parallel
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
 * Fetches image URLs for a given product from Firebase Storage.
 * @param {string} productID - The product's folder ID in Storage.
 * @returns {Promise<Array<string>>} Array of download URLs.
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
 * Fetches all unique tags from products in the "kaaykoproducts" collection.
 * @returns {Promise<Array<string>>} Array of unique tags (plus "All").
 */
export async function fetchAllTags() {
  try {
    const allProducts = await fetchProductData();
    const tagsSet = new Set();

    // Collect all tags from each product's tags array
    allProducts.forEach(product => {
      if (product.tags && Array.isArray(product.tags)) {
        product.tags.forEach(tag => tagsSet.add(tag));
      }
    });

    // Add an "All" option at the beginning
    // We'll handle "All" logic in the UI code
    return ["All", ...Array.from(tagsSet)];
  } catch (error) {
    console.error("Error fetching tags:", error);
    return ["All"];
  }
}

/**
 * Fetches products whose tags array contains the specified tag (case-sensitive).
 * @param {string} tag - The tag to filter by.
 * @returns {Promise<Array<Object>>} Array of product objects with the given tag.
 */
export async function fetchProductsByTag(tag) {
  try {
    // If user selected "All," return all products
    if (tag === "All") {
      return await fetchProductData();
    }

    // Use array-contains for tag-based filtering
    const q = query(collection(db, "kaaykoproducts"), where("tags", "array-contains", tag));
    const snapshot = await getDocs(q);

    // Merge image URLs for each filtered product
    const products = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    const productsWithImages = await Promise.all(
      products.map(async product => {
        const images = await fetchImagesByProductId(product.productID);
        return { ...product, imgSrc: images };
      })
    );

    return productsWithImages;
  } catch (error) {
    console.error("Error fetching products by tag:", error);
    return [];
  }
}

/**
 * Updates the vote count for a product using atomic increment.
 * @param {string} productId - The Firestore document ID.
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