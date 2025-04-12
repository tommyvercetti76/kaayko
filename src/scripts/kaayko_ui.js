// scripts/kaayko_ui.js

import {
  fetchProductsByCategory,
  updateProductVotes
} from "./kaayko_dataService.js";

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

  // For each product
  items.forEach(item => {
    const carouselItem = createCarouselItem(item);
    carousel.appendChild(carouselItem);
  });

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

  // Indicators
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

  // Append
  carouselItem.append(title, description, footer);

  // Swipe
  addSwipeFunctionality(imgContainer, item.imgSrc.length, imageIndicator);

  // Modal on click
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

function buildImageContainer(imageUrls) {
  const container = document.createElement("div");
  container.className = "img-container";

  imageUrls.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "carousel-image";
    img.style.display = index === 0 ? "block" : "none";
    container.appendChild(img);
  });
  return container;
}

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

function addSwipeFunctionality(container, length, indicator) {
  let startX = 0;
  let currentImageIndex = 0;
  const swipeThreshold = 50;

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
    container.addEventListener("touchend", e => handleSwipe(e.changedTouches[0].clientX - startX));
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
  const fab = document.querySelector(".fab-menu");
  const overlay = document.querySelector(".mobile-menu-overlay");
  if (!fab || !overlay) return;

  fab.addEventListener("click", () => overlay.classList.toggle("active"));

  overlay.addEventListener("click", e => {
    if (e.target === overlay || e.target.tagName === "A") {
      overlay.classList.remove("active");
    }
  });
}

/* --------------------------------------------------------------------------
 *                      DYNAMIC MENU (Ordered)
 * -------------------------------------------------------------------------- */

/**
 * We want the menu order: "Apparel", then "About", then "Testimonials".
 * We highlight the current page link based on the pathname.
 */
export function populateMenu(categories) {
  const desktopMenu = document.querySelector(".top-menu ul");
  const mobileMenu = document.querySelector(".mobile-menu-overlay ul");
  if (!desktopMenu && !mobileMenu) return;

  // If your Firestore returns ["apparel"], and you want to display "Apparel"
  // we transform it for display
  const capitalized = categories.map(cat => {
    return {
      raw: cat,  // the exact string from Firestore
      display: cat.charAt(0).toUpperCase() + cat.slice(1) 
    };
  });

  function buildMenuItems(menuUl) {
    menuUl.innerHTML = "";

    // Build each category link (like "Apparel")
    capitalized.forEach(obj => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.textContent = obj.display; // "Apparel" to user
      a.href = "#";

      a.addEventListener("click", async e => {
        e.preventDefault();
        // Clear active
        Array.from(menuUl.querySelectorAll("a")).forEach(x => x.classList.remove("active"));

        a.classList.add("active");

        // This calls fetchProductsByCategory("apparel") 
        // even though the user sees "Apparel"
        const newProducts = await fetchProductsByCategory(obj.raw);
        fadeOutInCarousel(newProducts);

        // close mobile overlay if needed
        if (menuUl.classList.contains("mobile-menu-ul")) {
          document.querySelector(".mobile-menu-overlay").classList.remove("active");
        }
      });

      li.appendChild(a);
      menuUl.appendChild(li);
    });

    // Then add your static "About" and "Testimonials" links
    // (or in the order you prefer)
    // e.g. "About" next, then "Testimonials"
    {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.textContent = "About";
      a.href = "about.html";
      li.appendChild(a);
      menuUl.appendChild(li);
    }

    {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.textContent = "Testimonials";
      a.href = "testimonials.html";
      li.appendChild(a);
      menuUl.appendChild(li);
    }

    // highlightActiveLink(menuUl) if you want to highlight based on the current page
  }

  if (desktopMenu) buildMenuItems(desktopMenu);
  if (mobileMenu) {
    mobileMenu.classList.add("mobile-menu-ul");
    buildMenuItems(mobileMenu);
  }
}

/**
 * Helper to fade out the current carousel, load new products, fade in.
 */
async function fadeOutInCarousel(newProducts) {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;

  carousel.classList.add("fade-out");
  await new Promise(resolve => setTimeout(resolve, 300));
  populateCarousel(newProducts);
  carousel.classList.remove("fade-out");
}

/**
 * Highlights the correct nav link based on the current window.location or page.
 * If path is /about.html, we highlight "About". If /testimonials.html, highlight that, etc.
 */
function highlightActiveLink(menuUl) {
  const pathname = window.location.pathname; 
  // e.g. "/about.html" or "/testimonials.html" or "/index.html"

  const links = menuUl.querySelectorAll("a");
  links.forEach(link => {
    const href = link.getAttribute("href");
    if (!href) return;

    // If user is at "about.html" or "testimonials.html" or "index.html"
    if (pathname.endsWith(href)) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}