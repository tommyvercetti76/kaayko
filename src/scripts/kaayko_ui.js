// scripts/kaayko_ui.js
// This file manages the UI functionality for Kaayko Store including:
// • Populating and animating the product carousel,
// • Enabling swipe and modal interactions,
// • Creating the voting (like) button with dynamic vote count,
// • Setting up mobile menu toggling, and
// • Dynamically populating the tag-based menu (which now includes a static "About" link).
// All code is preserved from previous versions.

import {
  updateProductVotes,
  fetchProductsByTag,
  fetchProductData
} from "./kaayko_dataService.js";

/**
 * Populates the carousel with product items and then animates each card.
 * @param {Array<Object>} items - An array of product objects from Firestore.
 */
export function populateCarousel(items) {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;

  // Clear the carousel container.
  carousel.innerHTML = "";

  // Create and append a carousel item for each product.
  items.forEach(item => {
    const carouselItem = createCarouselItem(item);
    carousel.appendChild(carouselItem);
  });

  // Animate each carousel item with a randomized delay.
  animateCarouselItems();
}

/**
 * Creates a single carousel item element (including images, indicators, title, etc.).
 * @param {Object} item - A single product object.
 * @returns {HTMLElement} The DOM element representing the carousel item.
 */
function createCarouselItem(item) {
  const carouselItem = document.createElement("div");
  carouselItem.className = "carousel-item";

  // Build image container (handles multiple images).
  const imgContainer = buildImageContainer(item.imgSrc);
  carouselItem.appendChild(imgContainer);

  // Create and append dot indicators.
  const imageIndicator = createImageIndicator(item.imgSrc.length, 0);
  carouselItem.appendChild(imageIndicator);

  // Create title and description elements.
  const title = createTextElement("h3", "title", item.title);
  const description = createTextElement("p", "description", item.description);

  // Create footer with price and voting button.
  const footer = document.createElement("div");
  footer.className = "footer-elements";
  const priceEl = createTextElement("p", "price", item.price);
  const { heartButton, votesCountEl } = createLikeButton(item);
  footer.append(priceEl, heartButton, votesCountEl);

  // Append title, description, and footer to the carousel item.
  carouselItem.append(title, description, footer);

  // Enable swipe functionality (for desktop and mobile) on the image container.
  addSwipeFunctionality(imgContainer, item.imgSrc.length, imageIndicator);

  // Open modal on image container click.
  imgContainer.addEventListener("click", () => openModal(item));

  return carouselItem;
}

/**
 * Animates each carousel item with a random delay for a professional entrance.
 * Each card will have its own random delay between 0 and maxDelay seconds.
 */
function animateCarouselItems() {
  const items = document.querySelectorAll("#carousel .carousel-item");
  const maxDelay = 0.82; // Maximum delay in seconds.
  items.forEach(item => {
    const delay = Math.random() * maxDelay;
    item.style.animationDelay = `${delay.toFixed(2)}s`;
    item.classList.add("animate");
  });
}

/**
 * Builds the image container that holds multiple images (displayed one at a time).
 * @param {string[]} imageUrls - An array of image URLs.
 * @returns {HTMLElement} A DIV wrapping all images.
 */
function buildImageContainer(imageUrls) {
  const imgContainer = document.createElement("div");
  imgContainer.className = "img-container";

  // Insert each image, marking the first as active (using display style).
  imageUrls.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "carousel-image";
    img.style.display = index === 0 ? "block" : "none";
    imgContainer.appendChild(img);
  });

  return imgContainer;
}

/**
 * Creates dot indicators for the carousel images.
 * @param {number} length - Total number of images.
 * @param {number} currentImageIndex - The initially active image index.
 * @returns {HTMLElement} A container DIV holding the dot indicators.
 */
function createImageIndicator(length, currentImageIndex) {
  const indicator = document.createElement("div");
  indicator.className = "image-indicator";

  // Create each dot, highlighting the current index.
  for (let i = 0; i < length; i++) {
    const dot = document.createElement("span");
    dot.className = "indicator-dot" + (i === currentImageIndex ? " active" : "");
    dot.addEventListener("click", () => {
      const container = indicator.parentElement.querySelector(".img-container");
      const images = container.querySelectorAll(".carousel-image");
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
 * Adds swipe functionality for the image carousel on both desktop and mobile.
 * New images will be shown ONLY when the user swipes.
 * This function updates both the display style of images and the active dot.
 * @param {HTMLElement} container - The container holding the carousel images.
 * @param {number} length - Total number of images.
 * @param {HTMLElement} indicator - The dot indicator container.
 */
function addSwipeFunctionality(container, length, indicator) {
  let startX = 0;
  let currentImageIndex = 0;
  const swipeThreshold = 50; // Minimum swipe distance in pixels.

  if (window.PointerEvent) {
    container.addEventListener("pointerdown", e => { startX = e.clientX; });
    container.addEventListener("pointerup", e => handleSwipe(e.clientX - startX));
  } else {
    container.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
    container.addEventListener("touchend", e => handleSwipe(e.changedTouches[0].clientX - startX));
    container.addEventListener("mousedown", e => { startX = e.clientX; });
    container.addEventListener("mouseup", e => { handleSwipe(e.clientX - startX); });
  }

  /**
   * Processes the swipe delta. If the threshold is met, the current image is hidden,
   * the active dot is updated, and the new image is displayed.
   * @param {number} deltaX - The horizontal distance swiped.
   */
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
}

/**
 * Opens a modal (overlay) to display all images of the selected product.
 * The modal appears as a full-screen overlay.
 * @param {Object} item - The product object containing an 'imgSrc' array.
 */
export function openModal(item) {
  const modal = document.getElementById("modal");
  const modalImageContainer = document.getElementById("modal-image-container");
  if (!modal || !modalImageContainer) return;
  modalImageContainer.innerHTML = "";
  item.imgSrc.forEach((src, index) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "modal-image";
    img.style.display = index === 0 ? "block" : "none";
    modalImageContainer.appendChild(img);
  });
  // Show modal as a full-screen overlay.
  modal.classList.add("active");
  setupModalNavigation(modalImageContainer, item.imgSrc.length, 0);
}

/**
 * Sets up navigation (arrow clicks and swipe gestures) inside the modal.
 * @param {HTMLElement} container - The container holding modal images.
 * @param {number} length - Total number of images.
 * @param {number} currentImageIndex - The index of the currently displayed image.
 */
function setupModalNavigation(container, length, currentImageIndex) {
  const images = container.querySelectorAll(".modal-image");
  const leftButton = document.querySelector(".modal-nav-left");
  const rightButton = document.querySelector(".modal-nav-right");
  if (!leftButton || !rightButton) {
    console.error("Modal navigation buttons not found.");
    return;
  }
  /**
   * Updates the active modal image based on the new index.
   * @param {number} newIndex - The new image index.
   */
  function updateImageIndex(newIndex) {
    images[currentImageIndex].style.display = "none";
    currentImageIndex = (newIndex + length) % length;
    images[currentImageIndex].style.display = "block";
  }
  leftButton.onclick = () => updateImageIndex(currentImageIndex - 1);
  rightButton.onclick = () => updateImageIndex(currentImageIndex + 1);
  let startX = 0;
  if (window.PointerEvent) {
    container.addEventListener("pointerdown", e => { startX = e.clientX; });
    container.addEventListener("pointerup", e => handleModalSwipe(e.clientX - startX));
  } else {
    container.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
    container.addEventListener("touchend", e => handleModalSwipe(e.changedTouches[0].clientX - startX));
    container.addEventListener("mousedown", e => { startX = e.clientX; });
    container.addEventListener("mouseup", e => handleModalSwipe(e.clientX - startX));
  }
  /**
   * Processes the swipe delta within the modal to change images.
   * @param {number} deltaX - The horizontal distance swiped.
   */
  function handleModalSwipe(deltaX) {
    if (Math.abs(deltaX) > 50) {
      updateImageIndex(deltaX < 0 ? currentImageIndex + 1 : currentImageIndex - 1);
    }
  }
}

/**
 * Creates a generic text element with the given tag, class, and text content.
 * @param {string} tag - The HTML tag to create (e.g., 'p', 'h3').
 * @param {string} className - The CSS class to assign.
 * @param {string} text - The text content.
 * @returns {HTMLElement} The created text element.
 */
function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

/**
 * Creates a like (heart) button with a dynamic vote count.
 * Uses Firestore's atomic update to avoid race conditions.
 * @param {Object} item - The product object containing 'id' and 'votes'.
 * @returns {{ heartButton: HTMLElement, votesCountEl: HTMLElement }}
 */
function createLikeButton(item) {
  const button = document.createElement("button");
  button.className = "heart-button";
  let isLiked = false;
  let currentVotes = item.votes || 0;
  const votesCount = document.createElement("span");
  votesCount.className = "likes-count";
  votesCount.textContent = `${currentVotes} Votes`;
  /**
   * Updates the heart button's appearance based on whether it is liked.
   */
  function updateHeartButtonVisuals() {
    if (isLiked) {
      button.classList.add("liked");
    } else {
      button.classList.remove("liked");
    }
  }
  updateHeartButtonVisuals();
  button.addEventListener("click", async () => {
    isLiked = !isLiked;
    const voteChange = isLiked ? 1 : -1;
    await updateProductVotes(item.id, voteChange);
    currentVotes += voteChange;
    updateHeartButtonVisuals();
    votesCount.textContent = `${currentVotes} Votes`;
  });
  return { heartButton: button, votesCountEl: votesCount };
}

/**
 * Sets up modal close functionality by binding the close button and overlay click events.
 */
export function setupModalCloseHandlers() {
  const modal = document.getElementById("modal");
  const closeButton = document.getElementById("close-modal-button");
  if (!modal) return;
  if (closeButton) {
    closeButton.onclick = () => modal.classList.remove("active");
  }
  modal.addEventListener("click", e => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });
}

/**
 * Sets up the mobile menu toggle via the floating action button.
 */
export function setupMobileMenu() {
  const fabMenu = document.querySelector(".fab-menu");
  const mobileMenuOverlay = document.querySelector(".mobile-menu-overlay");
  if (!fabMenu || !mobileMenuOverlay) return;
  fabMenu.addEventListener("click", () => mobileMenuOverlay.classList.toggle("active"));
  mobileMenuOverlay.addEventListener("click", e => {
    if (e.target === mobileMenuOverlay || e.target.tagName === "A") {
      mobileMenuOverlay.classList.remove("active");
    }
  });
}

/**
 * Dynamically populates a tag-based menu in both desktop and mobile.
 * The menu includes a static "About" link (which opens the About modal)
 * followed by dynamic category items. The "All" tag is underlined by default.
 * When a tag is clicked, products are filtered with a graceful fade transition.
 * 
 * @param {Array<string>} tags - An array of unique tags with "All" at index 0.
 */
export function populateMenu(tags) {
  const desktopMenu = document.querySelector(".top-menu ul");
  const mobileMenu = document.querySelector(".mobile-menu-overlay ul");
  if (!desktopMenu && !mobileMenu) return;

  /**
   * Builds menu items for the given menu container.
   * First, it adds a static About link that opens the About modal.
   * Then, it adds a menu item for each tag in the tags array.
   * @param {HTMLElement} menuUl - The unordered list element for the menu.
   */
  function buildMenuItems(menuUl) {
    // Clear any existing menu items.
    menuUl.innerHTML = "";

    // --- Static About Link ---
    // Create a menu item that opens the About modal overlay.
    const aboutLi = document.createElement("li");
    const aboutLink = document.createElement("a");
    // Set href to '#' to prevent navigation.
    aboutLink.href = "#";
    aboutLink.textContent = "About";
    // When clicked, prevent default action and open the About modal.
    aboutLink.addEventListener("click", e => {
      e.preventDefault();
      openAboutModal();
    });
    aboutLi.appendChild(aboutLink);
    menuUl.appendChild(aboutLi);

    // --- Dynamic Category Items ---
    tags.forEach((tag, index) => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = tag;
      // Underline "All" by default (assumes "All" is at index 0)
      if (index === 0) {
        link.classList.add("active-tag");
      }
      link.addEventListener("click", async e => {
        e.preventDefault();
        // Remove active underline from all links in this menu.
        const allLinks = menuUl.querySelectorAll("a");
        allLinks.forEach(a => a.classList.remove("active-tag"));
        // Underline the clicked link.
        link.classList.add("active-tag");

        // Fetch products filtered by this tag (or all products if tag is "All").
        const filteredProducts = await fetchProductsByTag(tag);
        fadeOutInCarousel(filteredProducts);

        // If this is the mobile menu, close the overlay after selection.
        if (menuUl.classList.contains("mobile-menu-ul")) {
          const mobileOverlay = document.querySelector(".mobile-menu-overlay");
          if (mobileOverlay) {
            mobileOverlay.classList.remove("active");
          }
        }
      });
      li.appendChild(link);
      menuUl.appendChild(li);
    });
  }

  if (desktopMenu) {
    desktopMenu.classList.add("top-menu-ul");
    buildMenuItems(desktopMenu);
  }
  if (mobileMenu) {
    mobileMenu.classList.add("mobile-menu-ul");
    buildMenuItems(mobileMenu);
  }
}


/**
 * Fades out the carousel, updates its content with new products,
 * and then fades it back in to provide a graceful transition.
 * @param {Array<Object>} newProducts - The new product objects to display.
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
 * Opens the About modal overlay, which displays the About content.
 */
function openAboutModal() {
  const aboutModal = document.getElementById("aboutModal");
  if (!aboutModal) return;
  aboutModal.classList.add("active");
}

/**
 * Sets up close handlers for the About modal.
 * Closes the modal when the close button is clicked or when clicking outside the content.
 */
function setupAboutModalCloseHandlers() {
  const aboutModal = document.getElementById("aboutModal");
  const closeAboutBtn = document.getElementById("close-about-modal");
  if (!aboutModal) return;
  if (closeAboutBtn) {
    closeAboutBtn.onclick = () => aboutModal.classList.remove("active");
  }
  aboutModal.addEventListener("click", e => {
    if (e.target === aboutModal) {
      aboutModal.classList.remove("active");
    }
  });
}

// Call this setup function once the DOM is loaded.
document.addEventListener("DOMContentLoaded", () => {
  setupAboutModalCloseHandlers();
});