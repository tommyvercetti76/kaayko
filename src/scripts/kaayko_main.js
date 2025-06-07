// File: scripts/kaayko_main.js
/**
 * Entry point for index.html (the Kaayko store page).
 * • Disables right-click context menu
 * • Renders product carousel
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

  // 3) Fetch & render all products into the carousel
  try {
    const products = await getAllProducts();
    populateCarousel(products);
  } catch (err) {
    console.error("Failed to load products:", err);
    alert("Sorry—couldn't load products. Please try again later.");
  }
});