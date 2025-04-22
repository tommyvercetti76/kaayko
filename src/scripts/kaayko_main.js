// scripts/kaayko_main.js
/**
 * scripts/kaayko_main.js
 *
 * Entry point for index.html (the Kaayko store page).
 * • Fetches product data from our REST API
 * • Renders the carousel
 * • Wires up modal‐close, mobile menu & “smart” menu
 */

import { getAllProducts } from "./kaayko_apiClient.js";
import {
  populateCarousel,
  setupModalCloseHandlers,
  setupMobileMenu,
  populateMenu
} from "./kaayko_ui.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Disable right-click context menu
  document.addEventListener("contextmenu", e => e.preventDefault());

  // 2) Load & display products
  try {
    const products = await getAllProducts();
    populateCarousel(products);
  } catch (err) {
    console.error("Failed to load products:", err);
    alert("Sorry—couldn't load products. Please try again later.");
  }

  // 3) Wire up UI behaviors
  setupModalCloseHandlers();
  setupMobileMenu();
  populateMenu();
});