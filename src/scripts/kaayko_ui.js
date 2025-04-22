// scripts/kaayko_ui.js
/**
 * scripts/kaayko_ui.js
 *
 * Manages all UI behavior:
 *  • Carousel rendering & swipe
 *  • Image‐zoom modal
 *  • Voting (♥ button) via API
 *  • Mobile menu toggle
 *  • “Smart” menu links
 *  • Dark‑mode toggle
 */

import { voteOnProduct } from "./kaayko_apiClient.js";

/* ==========================================================================
   Dark‑Mode Toggle
   ========================================================================== */

/** Read/write user theme preference in localStorage */
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

/** Called on every page load */
export function runPageInit() {
  initializeDarkMode();
}

/* ==========================================================================
   Carousel Rendering
   ========================================================================== */

/**
 * Renders an array of product objects into the "#carousel" container.
 * @param {Array<Object>} items  each must include id, title, description, price, votes, imgSrc[]
 */
export function populateCarousel(items) {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;
  carousel.innerHTML = "";

  items.forEach(item => {
    const el = createCarouselItem(item);
    carousel.appendChild(el);
  });

  animateCarouselItems();
}

/** Fade‑in animation with staggered, random delays */
function animateCarouselItems() {
  document.querySelectorAll("#carousel .carousel-item").forEach(card => {
    const delay = (Math.random() * 0.8).toFixed(2) + "s";
    card.style.animationDelay = delay;
    card.classList.add("animate");
  });
}

/** Build a single carousel card */
function createCarouselItem(item) {
  const card = document.createElement("div");
  card.className = "carousel-item";

  // -- Images & Indicators
  const imgContainer = buildImageContainer(item.imgSrc);
  const indicator  = createImageIndicator(item.imgSrc.length, 0);
  card.append(imgContainer, indicator);

  // -- Title & Description
  const titleEl = textEl("h3", "title", item.title);
  const descEl  = textEl("p",  "description", item.description);

  // -- Footer: Price + Heart + VoteCount
  const footer = document.createElement("div");
  footer.className = "footer-elements";
  const priceEl       = textEl("p", "price", item.price);
  const { heartButton, votesCountEl } = createLikeButton(item);
  footer.append(priceEl, heartButton, votesCountEl);

  card.append(titleEl, descEl, footer);

  // -- Swipe handling & click to open modal
  addSwipe(imgContainer, item.imgSrc.length, indicator);
  imgContainer.addEventListener("click", () => openModal(item));

  return card;
}

/** Simple helper to create a text element */
function textEl(tag, cls, txt) {
  const e = document.createElement(tag);
  e.className = cls;
  e.textContent = txt;
  return e;
}

/* ==========================================================================
   Image Container & Swipe
   ========================================================================== */

/** Wraps multiple <img> tags, shows only the first initially */
function buildImageContainer(urls) {
  const c = document.createElement("div");
  c.className = "img-container";
  urls.forEach((src, i) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "carousel-image";
    img.style.display = i === 0 ? "block" : "none";
    c.append(img);
  });
  return c;
}

/** Dots under each carousel showing current image */
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

/** Swipe left/right to change images */
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

  // pointer for desktop, touch for mobile
  if (window.PointerEvent) {
    container.addEventListener("pointerdown", e => startX = e.clientX);
    container.addEventListener("pointerup",   e => process(e.clientX - startX));
  } else {
    container.addEventListener("touchstart", e => startX = e.touches[0].clientX, {passive:true});
    container.addEventListener("touchend",   e => process(e.changedTouches[0].clientX - startX));
  }
}

/* ==========================================================================
   Modal (Zoomed) View
   ========================================================================== */

export function openModal(item) {
  const modal = document.getElementById("modal");
  const box   = document.getElementById("modal-image-container");
  if (!modal || !box) return;

  box.innerHTML = "";
  item.imgSrc.forEach((src, i) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "modal-image";
    img.style.display = i === 0 ? "block" : "none";
    box.append(img);
  });

  modal.classList.add("active");
  setupModalNav(box, item.imgSrc.length);
}

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
  container.addEventListener("mouseup", (e) => {
    if (Math.abs(e.clientX - startX) > 50) {
      show(e.clientX < startX ? idx + 1 : idx - 1);
    }
  });
  container.addEventListener("touchstart", e => startX = e.touches[0].clientX, {passive:true});
  container.addEventListener("touchend",   e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(dx < 0 ? idx + 1 : idx - 1);
  });
}

/* ==========================================================================
   Voting (♥ button)
   ========================================================================== */

/**
 * Creates a heart button + vote‑count span.
 * Hitting ♥ calls our API, optimistically toggles UI, rolls back on error.
 */
function createLikeButton(item) {
  const btn = document.createElement("button");
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
      liked = !liked;
      refresh();
      alert("Oops—couldn’t update vote.");
    }
  });

  return { heartButton: btn, votesCountEl: countEl };
}

/* ==========================================================================
   Modal‑Close & Mobile Menu
   ========================================================================== */

export function setupModalCloseHandlers() {
  const modal = document.getElementById("modal");
  const btn   = document.getElementById("close-modal-button");
  if (!modal) return;
  btn?.addEventListener("click", () => modal.classList.remove("active"));
  modal.addEventListener("click", e => {
    if (e.target === modal) modal.classList.remove("active");
  });
}

export function setupMobileMenu() {
  runPageInit();
  const fab    = document.querySelector(".fab-menu");
  const overlay= document.querySelector(".mobile-menu-overlay");
  if (!fab || !overlay) return;
  fab.addEventListener("click", () => overlay.classList.toggle("active"));
  overlay.addEventListener("click", e => {
    if (e.target === overlay || e.target.tagName === "A") {
      overlay.classList.remove("active");
    }
  });
}

/* ==========================================================================
   “Smart” Menu Links
   ========================================================================== */

export function populateMenu() {
  const desk = document.querySelector(".top-menu ul");
  const mob  = document.querySelector(".mobile-menu-overlay ul");
  if (!desk || !mob) return;

  const path = window.location.pathname;
  let links = [];

  if (path.endsWith("index.html") || path === "/" || path === "") {
    links = [
      { text: "About", href: "about.html" },
      { text: "Testimonials", href: "testimonials.html" }
    ];
  } else if (path.endsWith("about.html")) {
    links = [
      { text: "Home", href: "index.html" },
      { text: "Testimonials", href: "testimonials.html" }
    ];
  } else if (path.endsWith("testimonials.html")) {
    links = [
      { text: "Home", href: "index.html" },
      { text: "About", href: "about.html" }
    ];
  } else {
    links = [
      { text: "Home", href: "index.html" },
      { text: "About", href: "about.html" },
      { text: "Testimonials", href: "testimonials.html" }
    ];
  }

  [desk, mob].forEach(menu => {
    menu.innerHTML = "";
    links.forEach(l => {
      const li = document.createElement("li");
      const a  = document.createElement("a");
      a.textContent = l.text;
      a.href = l.href;
      li.append(a);
      menu.append(li);
    });
  });
}