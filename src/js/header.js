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
  // Fixed navigation tabs
  const tabs = [
    { name: "Store", url: "store.html", subtitle: "Made for the Wild" },
    { name: "Karma", url: "karma.html", subtitle: "Giving Back" }
  ];
  
  const currentPath = window.location.pathname;
  const currentPage = currentPath.split("/").pop() || "index.html";
  const isStorePage = currentPage === "store.html" || currentPage === "cart.html";
  const isAdminPage = currentPath.includes("/admin/");
  const isKreatorPage = currentPath.includes("/kreator/");
  
  const desktopUl = document.querySelector(".top-menu ul");
  const mobileUl  = document.querySelector(".mobile-menu-overlay ul");
  const subtitleEl = document.querySelector(".header-subtitle");
  
  if (!desktopUl || !mobileUl) return;

  desktopUl.innerHTML = "";
  mobileUl.innerHTML  = "";

  tabs.forEach(tab => {
    // Determine if this tab is active - match against href or path
    const isActive = currentPath.includes(tab.url.replace('.html', '')) || 
                     currentPage === tab.url ||
                     (tab.url === "store.html" && isStorePage) ||
                     (tab.url === "admin/kortex.html" && isAdminPage) ||
                     (tab.url === "kreator/apply.html" && isKreatorPage);
    
    // Desktop tab
    const li = document.createElement("li");
    const a  = document.createElement("a");
    a.href        = tab.url;
    a.textContent = tab.name;
    
    if (isActive) {
      a.classList.add('active');
      // Update subtitle for active tab
      if (subtitleEl) {
        subtitleEl.textContent = tab.subtitle;
      }
    }
    
    // Add special handling for Store links
    if (tab.url === 'store.html') {
      a.addEventListener('click', handleStoreNavigation);
    }
    
    li.appendChild(a);
    desktopUl.appendChild(li);
    
    // Mobile tab
    const mobileLi = li.cloneNode(true);
    const mobileA = mobileLi.querySelector('a');
    if (tab.url === 'store.html') {
      mobileA.addEventListener('click', handleStoreNavigation);
    }
    mobileUl.appendChild(mobileLi);
  });
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
 *    Adds click handler to header brand/title for navigation back to home
 *───────────────────────────────────────────────────────────────────────────*/
function initializeHomeNavigation() {
  const headerBrand = document.querySelector('.header-brand');
  const headerTitle = document.querySelector('.header-title');
  
  // Add click handler to either brand container or title
  const homeElement = headerBrand || headerTitle;
  if (homeElement) {
    homeElement.style.cursor = 'pointer';
    homeElement.addEventListener('click', () => {
      // Navigate to home (paddlingout.html)
      window.location.href = '/paddlingout.html';
    });
  }
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
