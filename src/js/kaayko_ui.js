// File: scripts/kaayko_ui.js
/**
 * Manages Kaayko Store page UI:
 *  1) Carousel rendering & swipe
 *  2) Image-zoom modal + navigation
 *  3) Voting (♥ button)
 *
 * Updated: now skips any item where `isAvailable !== true`
 */

import { voteOnProduct } from "./kaayko_apiClient.js";

// Cloud Function image proxy base - auto-detect environment
const IMAGE_PROXY_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `${window.location.origin}/api/images`  // Local Firebase emulator
  : "https://us-central1-kaayko-api-dev.cloudfunctions.net/api/images";  // Production

/* ==========================================================================
   1) Carousel Rendering & Swipe
   ========================================================================== */
/**
 * Renders the product carousel into the #carousel element,
 * skipping any product where `isAvailable` is explicitly `false`.
 *
 * @param {Array<Object>} items – array of product objects, each with an `isAvailable` boolean
 */
export function populateCarousel(items) {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;

  // Clear out any existing content
  carousel.innerHTML = "";

  // Only display items where isAvailable !== false (i.e. true or undefined)
  const visibleItems = items.filter(item => item.isAvailable !== false);

  // Create and append a card for each visible product
  visibleItems.forEach(item => {
    const card = createCarouselItem(item);
    carousel.appendChild(card);
  });

  // Kick off any animations on the newly-inserted cards
  animateCarouselItems();
}

function animateCarouselItems() {
  document.querySelectorAll("#carousel .carousel-item").forEach(card => {
    const delay = (Math.random() * 0.8).toFixed(2) + "s";
    card.style.animationDelay = delay;
    card.classList.add("animate");
  });
}

function createCarouselItem(item) {
  const card = document.createElement("div");
  card.className = "carousel-item";

  const imgContainer = buildImageContainer(item);
  const indicator    = createImageIndicator(item.imgSrc.length, 0);
  card.append(imgContainer, indicator);

  const titleEl = textEl("h3", "title", item.title);
  const descEl  = textEl("p",  "description", item.description);

  const footer = document.createElement("div");
  footer.className = "footer-elements";
  const priceEl               = textEl("p", "price", item.price);
  const { heartButton, votesCountEl } = createLikeButton(item);
  footer.append(priceEl, heartButton, votesCountEl);

  card.append(titleEl, descEl, footer);
  addSwipe(imgContainer, item.imgSrc.length, indicator);
  imgContainer.addEventListener("click", () => openModal(item));

  return card;
}

function textEl(tag, cls, txt) {
  const e = document.createElement(tag);
  e.className   = cls;
  e.textContent = txt;
  return e;
}

function buildImageContainer(item) {
  const container = document.createElement("div");
  container.className = "img-container";

  item.imgSrc.forEach((signedURL, i) => {
    const url      = new URL(signedURL);
    const rawName  = url.pathname.split("/").pop();
    const fileName = rawName.split("%2F").pop();
    const proxy    = `${IMAGE_PROXY_BASE}/${encodeURIComponent(item.productID)}/${encodeURIComponent(fileName)}`;
    const img      = document.createElement("img");
    img.src        = proxy;
    img.className  = "carousel-image";
    img.style.display = i === 0 ? "block" : "none";
    container.append(img);
  });
  return container;
}

function createImageIndicator(count, current) {
  const dots = document.createElement("div");
  dots.className = "image-indicator";
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    dot.className = "indicator-dot" + (i === current ? " active" : "");
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
   2) Modal & Swipe Navigation
   ========================================================================== */
export function openModal(item) {
  const modal = document.getElementById("modal");
  const box   = document.getElementById("modal-image-container");
  if (!modal || !box) return;

  box.innerHTML = "";
  item.imgSrc.forEach((signedURL, i) => {
    const url      = new URL(signedURL);
    const rawName  = url.pathname.split("/").pop();
    const fileName = rawName.split("%2F").pop();
    const proxy    = `${IMAGE_PROXY_BASE}/${encodeURIComponent(item.productID)}/${encodeURIComponent(fileName)}`;
    const img      = document.createElement("img");
    img.src        = proxy;
    img.className  = "modal-image";
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
  container.addEventListener(
    "mouseup",
    e => Math.abs(e.clientX - startX) > 50 && show(e.clientX - startX < 0 ? idx + 1 : idx - 1)
  );
  container.addEventListener("touchstart", e => startX = e.touches[0].clientX, {passive:true});
  container.addEventListener(
    "touchend",
    e => Math.abs(e.changedTouches[0].clientX - startX) > 50 && show(e.changedTouches[0].clientX - startX < 0 ? idx + 1 : idx - 1)
  );
}

/* ==========================================================================
   3) Voting (♥ button)
   ========================================================================== */
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
    const delta = liked ? -1 : 1;
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
      alert("Oops—couldn't update vote.");
    }
  });

  return { heartButton: btn, votesCountEl: countEl };
}

/* ==========================================================================
   4) Modal-Close Handler
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