// scripts/kaayko_main.js
import {
    fetchProductData,
    fetchAllTags
  } from "./kaayko_dataService.js";
  import {
    populateCarousel,
    setupModalCloseHandlers,
    setupMobileMenu,
    populateMenu
  } from "./kaayko_ui.js";
  
  /**
   * The entry point: fetch all products, set up the UI, etc.
   */
  document.addEventListener("DOMContentLoaded", () => {
    // Disable right-click context menu
    document.addEventListener("contextmenu", event => event.preventDefault());
  
    // 1. Fetch and render all products initially
    fetchProductData().then(products => populateCarousel(products));
  
    // 2. Fetch all tags (including "All") and populate the dynamic menu
    fetchAllTags().then(tags => populateMenu(tags));
  
    // 3. Setup modal close functionality and mobile menu toggle
    setupModalCloseHandlers();
    setupMobileMenu();
  });