// scripts/kaayko_main.js

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

/**
 * Main entry point for Kaayko Store:
 * 1) Shows all products in the carousel
 * 2) Builds a dynamic menu from categories (like "Apparel")
 * 3) Sets up modals & mobile menu
 */
document.addEventListener("DOMContentLoaded", () => {
  // Disable right-click
  document.addEventListener("contextmenu", event => event.preventDefault());

  // 1) Load & display all products
  fetchProductData().then(products => populateCarousel(products));

  // 2) Load categories (no "All") & populate menu
  fetchAllCategories().then(categories => populateMenu(categories));

  // 3) Setup product modal close & mobile menu
  setupModalCloseHandlers();
  setupMobileMenu();
});