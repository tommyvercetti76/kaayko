// File: header.js
// LocalStorage key for dark-mode
const DARK_KEY = "darkTheme";

/** ───────────────────────────────────────────────────────────────────────────
 * 1) Dark-Mode Toggle
 *    Reads/stores preference, toggles .dark-theme on <html>,
 *    and wires up the crescent button.
 *───────────────────────────────────────────────────────────────────────────*/
function initializeDarkMode() {
  const root = document.documentElement;
  const isDark = localStorage.getItem(DARK_KEY) === "enabled";
  root.classList.toggle("dark-theme", isDark);

  const btn = document.querySelector(".theme-toggle-icon");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const nowEnabled = root.classList.toggle("dark-theme");
    localStorage.setItem(DARK_KEY, nowEnabled ? "enabled" : "disabled");
  });
}

/** ───────────────────────────────────────────────────────────────────────────
 * 2) Populate Desktop & Mobile Menu
 *    Fixed nav tabs with dynamic subtitle system.
 *───────────────────────────────────────────────────────────────────────────*/
function populateMenu() {
  // Each product page is self-contained — no cross-product nav tabs.
  // In-page navigation (cart, filters, location pin, etc.) is wired up
  // directly in each page's own HTML/scripts.
  const desktopUl = document.querySelector(".top-menu ul");
  const mobileUl  = document.querySelector(".mobile-menu-overlay ul");
  if (!desktopUl || !mobileUl) return;
  desktopUl.innerHTML = "";
  mobileUl.innerHTML  = "";
}

/** ───────────────────────────────────────────────────────────────────────────
 * 2.1) Handle Store Navigation - Check for Secret Access
 *      Prevents access to store without secret keyword
 *───────────────────────────────────────────────────────────────────────────*/
function handleStoreNavigation(e) {
  const hasAccess = localStorage.getItem('kaaykoStoreAccess') === 'granted';
  if (!hasAccess) {
    e.preventDefault();
    console.log('🔐 Store access attempted without keyword');
    
    // Directly redirect to store page which will show the modal
    window.location.href = 'store.html';
  }
}

/** ───────────────────────────────────────────────────────────────────────────
 * 3) Mobile FAB & Overlay Toggle
 *    Shows/hides overlay menu at ≤768px.
 *───────────────────────────────────────────────────────────────────────────*/
function setupMobileMenu() {
  const fab     = document.querySelector(".fab-menu");
  const overlay = document.querySelector(".mobile-menu-overlay");
  if (!fab || !overlay) return;

  const toggle = () => overlay.classList.toggle("active");
  const close  = e => {
    if (e.target === overlay || e.target.tagName === "A") {
      overlay.classList.remove("active");
    }
  };

  const mql = window.matchMedia("(max-width: 768px)");
  const onChange = e => {
    if (e.matches) {
      fab.style.display = "";
      fab.addEventListener("click", toggle);
      overlay.addEventListener("click", close);
    } else {
      fab.style.display = "none";
      fab.removeEventListener("click", toggle);
      overlay.removeEventListener("click", close);
      overlay.classList.remove("active");
    }
  };
  mql.addEventListener("change", onChange);
  onChange(mql);
}

/** ───────────────────────────────────────────────────────────────────────────
 * 4) API Mode Toggle (both desktop and mobile versions)
 *    Switches between cached (emulator) and real-time (production) data
 *───────────────────────────────────────────────────────────────────────────*/
function initializeApiModeToggle() {
  const toggleBtn = document.querySelector('.api-mode-toggle');
  const toggleBtnMobile = document.querySelector('.api-mode-toggle-mobile');
  
  // Update UI for both desktop and mobile toggles
  function updateToggleUI() {
    const currentMode = window.apiClient?.getMode() || 'production';
    
    [toggleBtn, toggleBtnMobile].forEach(btn => {
      if (!btn) return;
      
      const iconEl = btn.querySelector('.api-mode-icon');
      const textEl = btn.querySelector('.api-mode-text');
      
      if (!iconEl || !textEl) return;
      
      // Remove existing state classes
      btn.classList.remove('cached', 'realtime');
      
      if (currentMode === 'emulator') {
        // Cached data mode
        btn.classList.add('cached');
        iconEl.textContent = '⚡';
        textEl.textContent = 'Quick';
        btn.title = 'Using cached data from Firebase. Click to switch to real-time.';
      } else {
        // Real-time data mode
        btn.classList.add('realtime');
        iconEl.textContent = '📡';
        textEl.textContent = 'Slow';
        btn.title = 'Using real-time data from API. Click to switch to cached.';
      }
    });
  }

  // Handle toggle click for both buttons
  function handleToggleClick() {
    if (!window.apiClient) {
      console.warn('⚠️ API client not available');
      return;
    }

    const currentMode = window.apiClient.getMode();
    const newMode = currentMode === 'emulator' ? 'production' : 'emulator';
    
    // Switch the mode
    window.apiClient.setMode(newMode);
    
    // Update UI
    updateToggleUI();
    
    // Show feedback to user
    const modeText = newMode === 'emulator' ? 'Cached Data' : 'Real-time Data';
    console.log(`🔄 Switched to ${modeText} mode`);
    
    // Optionally trigger a refresh of current data
    const event = new CustomEvent('apiModeChanged', { 
      detail: { 
        mode: newMode,
        endpoint: window.apiClient.getCurrentEndpoint()
      } 
    });
    document.dispatchEvent(event);
  }

  // Add event listeners
  if (toggleBtn) {
    toggleBtn.addEventListener('click', handleToggleClick);
  }
  if (toggleBtnMobile) {
    toggleBtnMobile.addEventListener('click', handleToggleClick);
  }

  // Initialize UI on page load
  updateToggleUI();
  
  // Listen for API client mode changes from other parts of the app
  document.addEventListener('apiModeChanged', updateToggleUI);
}


/** ───────────────────────────────────────────────────────────────────────────
 * 6) Home Navigation
 *    Store and Paddle Out always open in a new tab from kaayko.com, so
 *    window.opener will be set — kaayko.com is already in the background tab
 *    and a redundant home link would be stray navigation. Only wire it up for
 *    direct visits (bookmarks, shared links) where opener is null.
 *───────────────────────────────────────────────────────────────────────────*/
function initializeHomeNavigation() {
  if (window.opener !== null) return;

  const homeElement = document.querySelector('.header-brand') || document.querySelector('.header-title');
  if (!homeElement) return;

  homeElement.style.cursor = 'pointer';
  homeElement.addEventListener('click', () => {
    window.location.href = 'https://kaayko.com';
  });
}

/** ───────────────────────────────────────────────────────────────────────────
 * Init all header/UI behavior once DOM is ready
 *───────────────────────────────────────────────────────────────────────────*/
document.addEventListener("DOMContentLoaded", () => {
  initializeDarkMode();
  populateMenu();
  setupMobileMenu();
  initializeApiModeToggle();
  initializeHomeNavigation();
});
