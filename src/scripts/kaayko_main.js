/**
 * scripts/kaayko_main.js
 *
 * Entry point for index.html (the Kaayko store page).
 * • Disables right-click context menu
 * • Initializes dark-mode toggle
 * • Renders product carousel
 * • Wires up modal-close, mobile-menu toggle, and "smart" menu links
 */

import {
  getAllProducts,
  getProductByID      // for future detail-page use
} from "./kaayko_apiClient.js";

import {
  runPageInit,
  populateCarousel,
  setupModalCloseHandlers,
  setupMobileMenu,
  populateMenu
} from "./kaayko_ui.js";

// Wait for the DOM to be fully loaded
document.addEventListener("DOMContentLoaded", async () => {
  // 1) Disable the default context menu (makes "Save as…" harder)
  document.addEventListener("contextmenu", e => e.preventDefault());

  // 2) Initialize shared UI behaviors
  //    - Dark-mode toggle
  //    - Modal close buttons
  //    - "Smart" desktop and mobile menus
  runPageInit();
  setupModalCloseHandlers();
  setupMobileMenu();
  populateMenu();

  // 3) Fetch and render all products in the carousel
  try {
    const products = await getAllProducts();
    populateCarousel(products);
  } catch (err) {
    console.error("Failed to load products:", err);
    alert("Sorry—couldn't load products. Please try again later.");
  }
});