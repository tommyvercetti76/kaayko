// scripts/kaayko_main.js
import { fetchProductData } from "./kaayko_dataService.js";
import { populateCarousel, setupModalCloseHandlers, setupMobileMenu } from "./kaayko_ui.js";

// Wait for the DOM to fully load
document.addEventListener('DOMContentLoaded', () => {
  // Disable right-click context menu for enhanced UX/security
  document.addEventListener('contextmenu', (event) => event.preventDefault());

  // Fetch and render products
  fetchProductData().then(products => populateCarousel(products));

  // Setup modal close functionality and mobile menu toggle
  setupModalCloseHandlers();
  setupMobileMenu();
});