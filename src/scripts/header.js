// File: scripts/header.js

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
 *    Dynamically builds nav links, skipping the current page.
 *───────────────────────────────────────────────────────────────────────────*/
function populateMenu() {
  const mapping = {
    "index.html":        { name: "Store",        url: "index.html" },
    "about.html":        { name: "About",        url: "about.html" },
    "testimonials.html": { name: "Testimonials", url: "testimonials.html" },
    "paddlingout.html":  { name: "Paddling Out", url: "paddlingout.html" }
  };
  const current = window.location.pathname.split("/").pop() || "index.html";
  const desktopUl = document.querySelector(".top-menu ul");
  const mobileUl  = document.querySelector(".mobile-menu-overlay ul");
  if (!desktopUl || !mobileUl) return;

  desktopUl.innerHTML = "";
  mobileUl.innerHTML  = "";

  Object.entries(mapping).forEach(([file, info]) => {
    if (file === current) return;
    const li = document.createElement("li");
    const a  = document.createElement("a");
    a.href        = info.url;
    a.textContent = info.name;
    li.appendChild(a);
    desktopUl.appendChild(li);
    mobileUl.appendChild(li.cloneNode(true));
  });
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
 * Init all header/UI behavior once DOM is ready
 *───────────────────────────────────────────────────────────────────────────*/
document.addEventListener("DOMContentLoaded", () => {
  initializeDarkMode();
  populateMenu();
  setupMobileMenu();
});