/**
 * scripts/kaayko_ui.js
 *
 * Manages all UI behavior:
 *  1) Carousel rendering & swipe
 *  2) Image-zoom modal
 *  3) Voting (♥ button) via our REST API
 *  4) Mobile menu toggle
 *  5) “Smart” menu links (including Paddling Out)
 *  6) Dark-mode toggle
 *
 * Uses an image-proxy so the real signed URLs never hit the client.
 */

import { voteOnProduct } from "./kaayko_apiClient.js";

// point this at your Cloud Function image proxy
const IMAGE_PROXY_BASE =
  "https://us-central1-kaayko-api-dev.cloudfunctions.net/api/images";



/* ==========================================================================
   1) Dark-Mode Toggle
   ========================================================================== */

/**
 * Read/write user theme preference in localStorage,
 * toggles ".dark-theme" on <body>.
 */
function initializeDarkMode() {
  const isDark = localStorage.getItem("darkMode") === "true";
  document.body.classList.toggle("dark-theme", isDark);

  const btn = document.querySelector(".theme-toggle-icon");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const nowDark = document.body.classList.toggle("dark-theme");
    localStorage.setItem("darkMode", nowDark);
  });
}

/** Called on every page load (before other UI wires) */
export function runPageInit() {
  initializeDarkMode();
}



 /* ==========================================================================
    2) Carousel Rendering
    ========================================================================== */

/**
 * Renders an array of product objects into the "#carousel" container.
 * Each item must include:
 *   id, title, description, price, votes, productID, imgSrc: [<signedURL>,…]
 *
 * @param {Array<Object>} items
 */
export function populateCarousel(items) {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;
  carousel.innerHTML = "";

  items.forEach(item => {
    const card = createCarouselItem(item);
    carousel.appendChild(card);
  });

  animateCarouselItems();
}

/** Apply fade-in animation on each card with a random stagger */
function animateCarouselItems() {
  document.querySelectorAll("#carousel .carousel-item").forEach(card => {
    const delay = (Math.random() * 0.8).toFixed(2) + "s";
    card.style.animationDelay = delay;
    card.classList.add("animate");
  });
}

/**
 * Build one carousel card:
 *   • image container & dot indicator
 *   • title, description
 *   • footer with price + heart + votes
 */
function createCarouselItem(item) {
  const card = document.createElement("div");
  card.className = "carousel-item";

  // — Images (using proxy) & indicator dots
  const imgContainer = buildImageContainer(item);
  const indicator    = createImageIndicator(item.imgSrc.length, 0);
  card.append(imgContainer, indicator);

  // — Title & Description
  const titleEl = textEl("h3", "title", item.title);
  const descEl  = textEl("p",  "description", item.description);

  // — Footer: price + ♥ + vote count
  const footer = document.createElement("div");
  footer.className = "footer-elements";
  const priceEl            = textEl("p", "price", item.price);
  const { heartButton, votesCountEl } = createLikeButton(item);
  footer.append(priceEl, heartButton, votesCountEl);

  card.append(titleEl, descEl, footer);

  // — Swipe handling & click to zoom
  addSwipe(imgContainer, item.imgSrc.length, indicator);
  imgContainer.addEventListener("click", () => openModal(item));

  return card;
}

/** Utility: create an element with text */
function textEl(tag, cls, txt) {
  const e = document.createElement(tag);
  e.className   = cls;
  e.textContent = txt;
  return e;
}



 /* ==========================================================================
    3) Image Container & Swipe
    ========================================================================== */

/**
 * Wraps multiple <img> tags (all hidden except the first).
 * Replaces the signedURL with your proxy path:
 *    /api/images/:productID/:fileName
 *
 * @param {Object} item  from your API → must have .productID & .imgSrc[]
 */
function buildImageContainer(item) {
  const container = document.createElement("div");
  container.className = "img-container";

  item.imgSrc.forEach((signedURL, i) => {
    // extract just the fileName from signedURL
    const url = new URL(signedURL);
    const rawName = url.pathname.split("/").pop();       // e.g. "StraightOutta_1.png"
    const fileName = rawName.split("%2F").pop();         // fallback if double-encoded

    // use the proxy instead of the signedURL
    const proxyURL = `${IMAGE_PROXY_BASE}/${encodeURIComponent(item.productID)}/${encodeURIComponent(fileName)}`;

    const img = document.createElement("img");
    img.src       = proxyURL;
    img.className = "carousel-image";
    img.style.display = i === 0 ? "block" : "none";
    container.append(img);
  });

  return container;
}

/**
 * Dots under the carousel. Clicking a dot jumps to that image.
 */
function createImageIndicator(length, currentIdx) {
  const dots = document.createElement("div");
  dots.className = "image-indicator";
  for (let i = 0; i < length; i++) {
    const dot = document.createElement("span");
    dot.className = "indicator-dot" + (i === currentIdx ? " active" : "");
    dot.addEventListener("click", () => {
      const imgs = dots.parentElement.querySelectorAll(".carousel-image");
      imgs.forEach(img => (img.style.display = "none"));
      Array.from(dots.children).forEach(d => d.classList.remove("active"));
      imgs[i].style.display = "block";
      dot.classList.add("active");
    });
    dots.append(dot);
  }
  return dots;
}

/**
 * Swipe left/right to cycle images.
 * Uses PointerEvent on desktop, touch on mobile.
 */
function addSwipe(container, count, indicator) {
  let startX = 0, idx = 0, threshold = 50;
  const process = dx => {
    if (Math.abs(dx) < threshold) return;
    const imgs = container.querySelectorAll(".carousel-image");
    imgs[idx].style.display = "none";
    indicator.children[idx].classList.remove("active");
    idx = dx < 0 ? (idx + 1) % count : (idx - 1 + count) % count;
    imgs[idx].style.display = "block";
    indicator.children[idx].classList.add("active");
  };

  if (window.PointerEvent) {
    container.addEventListener("pointerdown", e => startX = e.clientX);
    container.addEventListener("pointerup",   e => process(e.clientX - startX));
  } else {
    container.addEventListener("touchstart", e => startX = e.touches[0].clientX, {passive:true});
    container.addEventListener("touchend",   e => process(e.changedTouches[0].clientX - startX));
  }
}



 /* ==========================================================================
    4) Modal (Zoomed) View
    ========================================================================== */

/**
 * Opens a full-screen modal showing all images for this item.
 * @param {Object} item  must have .imgSrc[] & .productID
 */
export function openModal(item) {
  const modal = document.getElementById("modal");
  const box   = document.getElementById("modal-image-container");
  if (!modal || !box) return;

  box.innerHTML = "";
  item.imgSrc.forEach((signedURL, i) => {
    const url = new URL(signedURL);
    const rawName = url.pathname.split("/").pop();
    const fileName = rawName.split("%2F").pop();
    const proxyURL = `${IMAGE_PROXY_BASE}/${encodeURIComponent(item.productID)}/${encodeURIComponent(fileName)}`;

    const img = document.createElement("img");
    img.src       = proxyURL;
    img.className = "modal-image";
    img.style.display = i === 0 ? "block" : "none";
    box.append(img);
  });

  modal.classList.add("active");
  setupModalNav(box, item.imgSrc.length);
}

/** Wire up left/right arrows & swipe inside the modal */
function setupModalNav(container, count) {
  let idx = 0, startX = 0;
  const prev = document.querySelector(".modal-nav-left");
  const next = document.querySelector(".modal-nav-right");
  const imgs = container.querySelectorAll(".modal-image");

  function show(i) {
    imgs[idx].style.display = "none";
    idx = (i + count) % count;
    imgs[idx].style.display = "block";
  }

  prev?.addEventListener("click", () => show(idx - 1));
  next?.addEventListener("click", () => show(idx + 1));

  container.addEventListener("mousedown", e => startX = e.clientX);
  container.addEventListener("mouseup",   e => {
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 50) show(dx < 0 ? idx + 1 : idx - 1);
  });
  container.addEventListener("touchstart", e => startX = e.touches[0].clientX, {passive:true});
  container.addEventListener("touchend",   e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(dx < 0 ? idx + 1 : idx - 1);
  });
}



 /* ==========================================================================
    5) Voting (♥ button)
    ========================================================================== */

/**
 * Creates a heart button + vote-count span.
 * Clicking ♥ calls our API, optimistically toggles UI,
 * rolls back if it fails.
 *
 * @param {Object} item  needs .id and .votes
 * @returns {{heartButton:HTMLButtonElement, votesCountEl:HTMLSpanElement}}
 */
function createLikeButton(item) {
  const btn     = document.createElement("button");
  btn.className = "heart-button";

  let liked = false;
  let votes = item.votes || 0;

  const countEl = document.createElement("span");
  countEl.className = "likes-count";
  countEl.textContent = `${votes} Votes`;

  function refresh() {
    btn.classList.toggle("liked", liked);
  }
  refresh();

  btn.addEventListener("click", async () => {
    const delta = liked ? -1 : +1;
    liked = !liked;
    refresh();

    try {
      await voteOnProduct(item.id, delta);
      votes += delta;
      countEl.textContent = `${votes} Votes`;
    } catch (err) {
      console.error("Vote error:", err);
      // rollback
      liked = !liked;
      refresh();
      alert("Oops—couldn't update vote.");
    }
  });

  return { heartButton: btn, votesCountEl: countEl };
}



 /* ==========================================================================
    6) Modal-Close & Mobile Menu
    ========================================================================== */

/** Closes the modal when clicking the X or backdrop */
export function setupModalCloseHandlers() {
  const modal = document.getElementById("modal");
  const btn   = document.getElementById("close-modal-button");
  if (!modal) return;
  btn?.addEventListener("click", () => modal.classList.remove("active"));
  modal.addEventListener("click", e => {
    if (e.target === modal) modal.classList.remove("active");
  });
}

/** Toggles your FAB / overlay menu on mobile */
export function setupMobileMenu() {
  runPageInit();
  const fab     = document.querySelector(".fab-menu");
  const overlay = document.querySelector(".mobile-menu-overlay");
  if (!fab || !overlay) return;
  fab.addEventListener("click", () => overlay.classList.toggle("active"));
  overlay.addEventListener("click", e => {
    if (e.target === overlay || e.target.tagName === "A") {
      overlay.classList.remove("active");
    }
  });
}



 /* ==========================================================================
    7) “Smart” Menu Links
    ========================================================================== */

/**
 * Show exactly three top-links, swapping out the current page for “Home”.
 *
 *   • On index.html (or “/”):   [About, Testimonials, Paddling Out]
 *   • On about.html:            [Home, Testimonials, Paddling Out]
 *   • On testimonials.html:     [Home, About, Paddling Out]
 *   • On paddlingout.html:      [Home, About, Testimonials]
 */
export function populateMenu() {
  const desk = document.querySelector(".top-menu ul");
  const mob  = document.querySelector(".mobile-menu-overlay ul");
  if (!desk || !mob) return;

  // Grab the last segment of the path and lowercase it
  const path = window.location.pathname.split("/").pop()?.toLowerCase() || "";

  let links = [];

  if (path.endsWith("about.html")) {
    links = [
      { text: "Home", href: "index.html" },
      { text: "Testimonials", href: "testimonials.html" },
      { text: "Paddling Out", href: "paddlingout.html" }
    ];
  } else if (path.endsWith("testimonials.html")) {
    links = [
      { text: "Home", href: "index.html" },
      { text: "About", href: "about.html" },
      { text: "Paddling Out", href: "paddlingout.html" }
    ];
  } else if (path.endsWith("paddlingout.html")) {
    links = [
      { text: "Home", href: "index.html" },
      { text: "About", href: "about.html" },
      { text: "Testimonials", href: "testimonials.html" }
    ];
  } else {
    // Default (index.html or any other route)
    links = [
      { text: "About", href: "about.html" },
      { text: "Testimonials", href: "testimonials.html" },
      { text: "Paddling Out", href: "paddlingout.html" }
    ];
  }

  // Populate both desktop and mobile menus
  [desk, mob].forEach(menu => {
    menu.innerHTML = "";
    links.forEach(({ text, href }) => {
      const li = document.createElement("li");
      const a  = document.createElement("a");
      a.textContent = text;
      a.href        = href;
      li.append(a);
      menu.append(li);
    });
  });
}