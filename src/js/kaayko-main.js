// File: scripts/kaayko_main.js
/**
 * Entry point for index.html (the Kaayko store page).
 * • Disables right-click context menu
 * • Renders product carousel (all items or single deep-linked item)
 * • Supports store filtering via ?store= parameter
 * • Wires up modal-close buttons
 */

import { getAllProducts } from "./kaayko_apiClient.js";
import {
  populateCarousel,
  setupModalCloseHandlers
} from "./kaayko_ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Disable the default right-click menu
  document.addEventListener("contextmenu", e => e.preventDefault());

  // 2) Modal close handlers (for image-zoom modal)
  setupModalCloseHandlers();

  // 3) Fetch & render products into the carousel
  try {
    const products = await getAllProducts();
    
    // Store original products for filtering (make available to filter modal)
    if (window.storeOriginalProducts) {
      window.storeOriginalProducts(products);
    }
    
    // Make populateCarousel globally available for filtering
    window.populateCarousel = populateCarousel;

    // detect deep-link via ?productID=… or ?id=… or store filter via ?store=…
    const params = new URLSearchParams(window.location.search);
    const pid    = params.get("productID") || params.get("id");
    const storeSlug = params.get("store");

    if (pid) {
      // try to find that specific product
      const match = products.find(p => p.productID === pid);
      if (match) {
        // show only the deep-linked card
        populateCarousel([match]);
        document.getElementById("carousel")?.classList.add("single-card");
      } else {
        // fallback to showing all
        populateCarousel(products);
      }
    } else if (storeSlug) {
      // Filter products by store slug
      const storeProducts = products.filter(p => p.storeSlug === storeSlug);
      
      if (storeProducts.length > 0) {
        // Update page title and show store header
        const storeName = storeProducts[0].storeName || storeSlug;
        document.title = `${storeName} - Kaayko Store`;
        
        // Add store header banner
        const carousel = document.getElementById("carousel");
        if (carousel) {
          const storeBanner = document.createElement('div');
          storeBanner.className = 'store-banner';
          storeBanner.innerHTML = `
            <div class="store-banner-content">
              <h2 class="store-banner-name">${storeName}</h2>
              <p class="store-banner-count">${storeProducts.length} product${storeProducts.length !== 1 ? 's' : ''}</p>
              <a href="/store.html" class="store-banner-link">← Browse All Products</a>
            </div>
          `;
          carousel.parentNode.insertBefore(storeBanner, carousel);
        }
        
        populateCarousel(storeProducts);
      } else {
        // No products found for this store
        const carousel = document.getElementById("carousel");
        if (carousel) {
          carousel.innerHTML = `
            <div class="store-empty">
              <h2>No products found</h2>
              <p>This store doesn't have any products yet.</p>
              <a href="/store.html" class="store-back-link">Browse All Products</a>
            </div>
          `;
        }
      }
    } else {
      // no deep-link param → show full list
      populateCarousel(products);
    }

  } catch (err) {
    console.error("Failed to load products:", err);
    alert("Sorry—couldn't load products. Please try again later.");
  }
});