// File: header.js
// LocalStorage key for dark-mode
const DARK_KEY = "darkTheme";

function updateThemeToggleIcon(btn, isDark) {
  if (!btn) return;

  btn.innerHTML = isDark
    ? `<svg class="header-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
         <path d="M12 3v2.2" />
         <path d="M12 18.8V21" />
         <path d="M5.64 5.64l1.56 1.56" />
         <path d="M16.8 16.8l1.56 1.56" />
         <path d="M3 12h2.2" />
         <path d="M18.8 12H21" />
         <path d="M5.64 18.36l1.56-1.56" />
         <path d="M16.8 7.2l1.56-1.56" />
         <circle cx="12" cy="12" r="4.2" />
       </svg>`
    : `<svg class="header-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
         <path d="M20.2 14.8A8.6 8.6 0 1 1 9.2 3.8a7.2 7.2 0 0 0 11 11z" />
       </svg>`;

  btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

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

  updateThemeToggleIcon(btn, isDark);

  btn.addEventListener("click", () => {
    const nowEnabled = root.classList.toggle("dark-theme");
    localStorage.setItem(DARK_KEY, nowEnabled ? "enabled" : "disabled");
    updateThemeToggleIcon(btn, nowEnabled);
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
 * 3) Mobile FAB & Overlay Toggle
 *    Shows/hides overlay menu at ≤768px.
 *───────────────────────────────────────────────────────────────────────────*/
function setupMobileMenu() {
  const fab     = document.querySelector(".fab-menu");
  const overlay = document.querySelector(".mobile-menu-overlay");
  if (!fab || !overlay) return;

  const hasMenuItems = !!overlay.querySelector("li, a");
  if (!hasMenuItems) {
    fab.style.display = "none";
    overlay.classList.remove("active");
    return;
  }

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
  initializeHomeNavigation();
});
