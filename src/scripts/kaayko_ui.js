/**
 * scripts/kaayko_ui.js
 * 
 * Purpose:
 *   - Manages the UI logic for Kaayko store:
 *       1) Carousel population (images, swipes, indicators),
 *       2) Modals (zoomed images),
 *       3) Voting (like) button,
 *       4) Mobile menu toggling,
 *       5) A "smart" menu that changes which links appear depending
 *          on the current page (index, about, or testimonials).
 *   - Also includes a Dark Mode icon button that applies a .dark-theme class
 *     to <body>, with localStorage so user preference persists across pages.
 */

import {
  fetchProductsByCategory,
  updateProductVotes
} from "./kaayko_dataService.js";

/* --------------------------------------------------------------------------
 *                         Initialize Dark Mode
 * -------------------------------------------------------------------------- */

/**
 * Checks localStorage to see if user previously set dark mode on,
 * then updates body accordingly. 
 * Also wires up the icon so it toggles .dark-theme and persists preference.
 */
function initializeDarkMode() {
  const isDark = localStorage.getItem("darkMode") === "true";
  if (isDark) {
    document.body.classList.add("dark-theme");
  }

  const themeButton = document.querySelector('.theme-toggle-icon');
  if (themeButton) {
    themeButton.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const nowDark = document.body.classList.contains('dark-theme');
      localStorage.setItem("darkMode", nowDark ? "true" : "false");
    });
  }
}

/**
 * We call this on DOMContentLoaded in each page,
 * after we do populateMenu() etc.
 */
function runPageInit() {
  initializeDarkMode();
  // If we had other page-wide initialization, we could do it here.
}

/* Export runPageInit so we can call it from the HTML if we want. */
export { runPageInit };

/* --------------------------------------------------------------------------
 *                         Populate Carousel & Items
 * -------------------------------------------------------------------------- */

/**
 * Populates the carousel with product items, then animates each card.
 * @param {Array<Object>} items - Array of product objects from Firestore.
 */
export function populateCarousel(items) {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;

  // Clear old contents
  carousel.innerHTML = "";

  // For each product, create a carousel item
  items.forEach(item => {
    const carouselItem = createCarouselItem(item);
    carousel.appendChild(carouselItem);
  });

  // Animate the items in
  animateCarouselItems();
}

/**
 * Creates a single carousel item (images, indicators, title, etc.).
 * @param {Object} item - A product object (title, category, imgSrc, etc.)
 * @returns {HTMLElement} The carousel item element.
 */
function createCarouselItem(item) {
  const carouselItem = document.createElement("div");
  carouselItem.className = "carousel-item";

  // Images
  const imgContainer = buildImageContainer(item.imgSrc);
  carouselItem.appendChild(imgContainer);

  // Dot indicators
  const imageIndicator = createImageIndicator(item.imgSrc.length, 0);
  carouselItem.appendChild(imageIndicator);

  // Title & Description
  const title = createTextElement("h3", "title", item.title);
  const description = createTextElement("p", "description", item.description);

  // Footer: Price + Votes
  const footer = document.createElement("div");
  footer.className = "footer-elements";
  const priceEl = createTextElement("p", "price", item.price);
  const { heartButton, votesCountEl } = createLikeButton(item);

  footer.append(priceEl, heartButton, votesCountEl);

  // Attach everything
  carouselItem.append(title, description, footer);

  // Swipe & modal
  addSwipeFunctionality(imgContainer, item.imgSrc.length, imageIndicator);
  imgContainer.addEventListener("click", () => openModal(item));

  return carouselItem;
}

/**
 * Animates each carousel item with a random delay for a professional look.
 */
function animateCarouselItems() {
  const items = document.querySelectorAll("#carousel .carousel-item");
  const maxDelay = 0.82;
  items.forEach(item => {
    const delay = Math.random() * maxDelay;
    item.style.animationDelay = `${delay.toFixed(2)}s`;
    item.classList.add("animate");
  });
}

/* --------------------------------------------------------------------------
 *                   Image Container & Indicators
 * -------------------------------------------------------------------------- */

/** 
 * Builds the image container that holds multiple images (display one at a time).
 */
function buildImageContainer(imageUrls) {
  const container = document.createElement("div");
  container.className = "img-container";

  imageUrls.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "carousel-image";
    // Show the first image, hide the rest
    img.style.display = index === 0 ? "block" : "none";
    container.appendChild(img);
  });
  return container;
}

/**
 * Creates dot indicators for the images. Clicking a dot reveals the corresponding image.
 */
function createImageIndicator(length, currentIndex) {
  const indicator = document.createElement("div");
  indicator.className = "image-indicator";

  for (let i = 0; i < length; i++) {
    const dot = document.createElement("span");
    dot.className = "indicator-dot" + (i === currentIndex ? " active" : "");
    dot.addEventListener("click", () => {
      const images = indicator.parentElement.querySelectorAll(".carousel-image");
      images.forEach(img => (img.style.display = "none"));
      Array.from(indicator.children).forEach(child => child.classList.remove("active"));

      images[i].style.display = "block";
      dot.classList.add("active");
    });
    indicator.appendChild(dot);
  }
  return indicator;
}

/**
 * Adds swipe or drag events to cycle through images left/right.
 */
function addSwipeFunctionality(container, length, indicator) {
  let startX = 0;
  let currentImageIndex = 0;
  const swipeThreshold = 50; // pixels

  function handleSwipe(deltaX) {
    if (Math.abs(deltaX) > swipeThreshold) {
      const images = container.querySelectorAll(".carousel-image");
      if (!images.length) return;

      images[currentImageIndex].style.display = "none";
      indicator.children[currentImageIndex].classList.remove("active");

      if (deltaX < 0) {
        currentImageIndex = (currentImageIndex + 1) % length;
      } else {
        currentImageIndex = (currentImageIndex - 1 + length) % length;
      }

      images[currentImageIndex].style.display = "block";
      indicator.children[currentImageIndex].classList.add("active");
    }
  }

  if (window.PointerEvent) {
    container.addEventListener("pointerdown", e => (startX = e.clientX));
    container.addEventListener("pointerup", e => handleSwipe(e.clientX - startX));
  } else {
    container.addEventListener("touchstart", e => {
      startX = e.touches[0].clientX;
    }, { passive: true });
    container.addEventListener("touchend", e => {
      handleSwipe(e.changedTouches[0].clientX - startX);
    });
    container.addEventListener("mousedown", e => (startX = e.clientX));
    container.addEventListener("mouseup", e => handleSwipe(e.clientX - startX));
  }
}

/* --------------------------------------------------------------------------
 *                           Modal for Images
 * -------------------------------------------------------------------------- */

export function openModal(item) {
  const modal = document.getElementById("modal");
  const modalImageContainer = document.getElementById("modal-image-container");
  if (!modal || !modalImageContainer) return;

  // Clear old images
  modalImageContainer.innerHTML = "";
  item.imgSrc.forEach((src, idx) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "modal-image";
    img.style.display = idx === 0 ? "block" : "none";
    modalImageContainer.appendChild(img);
  });

  modal.classList.add("active");
  setupModalNavigation(modalImageContainer, item.imgSrc.length, 0);
}

/**
 * Sets up left/right arrow navigation & swipe within the modal
 */
function setupModalNavigation(container, length, currentIndex) {
  const images = container.querySelectorAll(".modal-image");
  const leftBtn = document.querySelector(".modal-nav-left");
  const rightBtn = document.querySelector(".modal-nav-right");

  if (!leftBtn || !rightBtn) {
    console.error("Modal nav buttons not found.");
    return;
  }

  function updateIndex(newIdx) {
    images[currentIndex].style.display = "none";
    currentIndex = (newIdx + length) % length;
    images[currentIndex].style.display = "block";
  }

  leftBtn.onclick = () => updateIndex(currentIndex - 1);
  rightBtn.onclick = () => updateIndex(currentIndex + 1);

  let startX = 0;
  function handleModalSwipe(deltaX) {
    if (Math.abs(deltaX) > 50) {
      updateIndex(deltaX < 0 ? currentIndex + 1 : currentIndex - 1);
    }
  }

  if (window.PointerEvent) {
    container.addEventListener("pointerdown", e => (startX = e.clientX));
    container.addEventListener("pointerup", e => handleModalSwipe(e.clientX - startX));
  } else {
    container.addEventListener("touchstart", e => (startX = e.touches[0].clientX), { passive: true });
    container.addEventListener("touchend", e => handleModalSwipe(e.changedTouches[0].clientX - startX));
    container.addEventListener("mousedown", e => (startX = e.clientX));
    container.addEventListener("mouseup", e => handleModalSwipe(e.clientX - startX));
  }
}

/* --------------------------------------------------------------------------
 *                      Helpers: Text & Like Button
 * -------------------------------------------------------------------------- */

function createTextElement(tag, className, text) {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

function createLikeButton(item) {
  const button = document.createElement("button");
  button.className = "heart-button";

  let isLiked = false;
  let currentVotes = item.votes || 0;

  const votesCount = document.createElement("span");
  votesCount.className = "likes-count";
  votesCount.textContent = `${currentVotes} Votes`;

  function updateHeartVisuals() {
    if (isLiked) {
      button.classList.add("liked");
    } else {
      button.classList.remove("liked");
    }
  }
  updateHeartVisuals();

  button.addEventListener("click", async () => {
    isLiked = !isLiked;
    const voteChange = isLiked ? 1 : -1;
    await updateProductVotes(item.id, voteChange);
    currentVotes += voteChange;
    updateHeartVisuals();
    votesCount.textContent = `${currentVotes} Votes`;
  });

  return { heartButton: button, votesCountEl: votesCount };
}

/* --------------------------------------------------------------------------
 *                        Modal Close Handlers
 * -------------------------------------------------------------------------- */

export function setupModalCloseHandlers() {
  const modal = document.getElementById("modal");
  if (!modal) return;

  const closeButton = document.getElementById("close-modal-button");
  if (closeButton) {
    closeButton.onclick = () => modal.classList.remove("active");
  }

  modal.addEventListener("click", e => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });
}

/* --------------------------------------------------------------------------
 *                           Mobile Menu
 * -------------------------------------------------------------------------- */

export function setupMobileMenu() {
  // First run the localStorage-based dark-mode logic
  runPageInit();

  const fab = document.querySelector(".fab-menu");
  const overlay = document.querySelector(".mobile-menu-overlay");
  if (!fab || !overlay) return;

  fab.addEventListener("click", () => {
    overlay.classList.toggle("active");
  });

  overlay.addEventListener("click", e => {
    // Close overlay if clicking outside or on a link
    if (e.target === overlay || e.target.tagName === "A") {
      overlay.classList.remove("active");
    }
  });
}

/* --------------------------------------------------------------------------
 *                       "Smart" Menu Mechanism
 * -------------------------------------------------------------------------- */

export function populateMenu() {
  const desktopMenu = document.querySelector(".top-menu ul");
  const mobileMenu = document.querySelector(".mobile-menu-overlay ul");
  if (!desktopMenu || !mobileMenu) return;

  const pathname = window.location.pathname; 
  let desktopLinks = [];

  // If on index => "About" & "Testimonials"
  if (pathname.endsWith("index.html") || pathname === "/" || pathname === "") {
    desktopLinks = [
      { text: "About", href: "about.html" },
      { text: "Testimonials", href: "testimonials.html" }
    ];
  }
  // If on about => "Home" & "Testimonials"
  else if (pathname.endsWith("about.html")) {
    desktopLinks = [
      { text: "Home", href: "index.html" },
      { text: "Testimonials", href: "testimonials.html" }
    ];
  }
  // If on testimonials => "Home" & "About"
  else if (pathname.endsWith("testimonials.html")) {
    desktopLinks = [
      { text: "Home", href: "index.html" },
      { text: "About", href: "about.html" }
    ];
  }
  else {
    // fallback for unknown pages
    desktopLinks = [
      { text: "Home", href: "index.html" },
      { text: "About", href: "about.html" },
      { text: "Testimonials", href: "testimonials.html" }
    ];
  }

  // The mobile menu gets the same links
  const mobileLinks = [...desktopLinks];

  // Populate the top menu
  desktopMenu.innerHTML = "";
  desktopLinks.forEach(link => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = link.text;
    a.href = link.href;
    li.appendChild(a);
    desktopMenu.appendChild(li);
  });

  // Populate the mobile overlay menu
  mobileMenu.innerHTML = "";
  mobileLinks.forEach(link => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.textContent = link.text;
    a.href = link.href;
    li.appendChild(a);
    mobileMenu.appendChild(li);
  });
}