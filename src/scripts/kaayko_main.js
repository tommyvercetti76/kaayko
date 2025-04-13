/**
 * scripts/kaayko_main.js
 * 
 * Purpose:
 *   - The main entry point for index.html (the store)
 *   - Fetches products, sets up the carousel, modal close logic,
 *     plus calls the "smart" menu so we show only "About" & "Testimonials" on index.
 */

import {
  fetchProductData,
  fetchAllCategories
} from "./kaayko_dataService.js";
import {
  populateCarousel,
  setupModalCloseHandlers,
  setupMobileMenu,
  populateMenu
} from "./kaayko_ui.js";

document.addEventListener("DOMContentLoaded", () => {
  // Disable right-click
  document.addEventListener("contextmenu", event => event.preventDefault());

  // 1) Load & display all products in the carousel
  fetchProductData().then(products => populateCarousel(products));

  // 2) Setup product modal close & mobile menu
  setupModalCloseHandlers();
  setupMobileMenu();

  // 3) Setup "smart" menu which shows "About" & "Testimonials" if on index
  populateMenu(); 
});