// File: scripts/kaayko_main.js
/**
 * Entry point for index.html (the Kaayko store page).
 * • Disables right-click context menu
 * • Renders product carousel (all items or single deep-linked item)
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

    // detect deep-link via ?productID=… or ?id=…
    const params = new URLSearchParams(window.location.search);
    const pid    = params.get("productID") || params.get("id");

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
    } else {
      // no deep-link param → show full list
      populateCarousel(products);
    }

  } catch (err) {
    console.error("Failed to load products:", err);
    alert("Sorry—couldn't load products. Please try again later.");
  }
});