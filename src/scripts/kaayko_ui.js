// scripts/kaayko_ui.js
import {
    updateProductVotes,
    fetchProductsByTag,
    fetchProductData
  } from "./kaayko_dataService.js";
  
  /**
   * Populates the carousel with product items.
   * @param {Array<Object>} items - An array of product objects from Firestore
   */
  export function populateCarousel(items) {
    const carousel = document.getElementById("carousel");
    if (!carousel) return;
  
    // Clear the carousel container
    carousel.innerHTML = "";
  
    // Create and append a carousel item for each product
    items.forEach(item => {
      const carouselItem = createCarouselItem(item);
      carousel.appendChild(carouselItem);
    });
  }
  
  /**
   * Creates a single carousel item element (including images, indicators, title, etc.).
   * @param {Object} item - A single product object
   * @returns {HTMLElement} The DOM element representing the carousel item
   */
  function createCarouselItem(item) {
    const carouselItem = document.createElement("div");
    carouselItem.className = "carousel-item";
  
    // Build image container (multiple images)
    const imgContainer = buildImageContainer(item.imgSrc);
    carouselItem.appendChild(imgContainer);
  
    // Create and append dot indicators
    const imageIndicator = createImageIndicator(item.imgSrc.length, 0);
    carouselItem.appendChild(imageIndicator);
  
    // Title and description
    const title = createTextElement("h3", "title", item.title);
    const description = createTextElement("p", "description", item.description);
  
    // Footer with price and voting button
    const footer = document.createElement("div");
    footer.className = "footer-elements";
    const priceEl = createTextElement("p", "price", item.price);
    const { heartButton, votesCountEl } = createLikeButton(item);
    footer.append(priceEl, heartButton, votesCountEl);
  
    // Append title, description, and footer to carousel item
    carouselItem.append(title, description, footer);
  
    // Add swipe functionality (desktop + mobile) on the image container
    addSwipeFunctionality(imgContainer, item.imgSrc.length, imageIndicator);
  
    // Open modal on image container click
    imgContainer.addEventListener("click", () => openModal(item));
  
    return carouselItem;
  }
  
  /**
   * Builds the image container that holds multiple images (displayed one at a time).
   * @param {string[]} imageUrls - An array of image URLs
   * @returns {HTMLElement} A DIV wrapping all images
   */
  function buildImageContainer(imageUrls) {
    const imgContainer = document.createElement("div");
    imgContainer.className = "img-container";
  
    // Insert each image, marking the first as active and using display style
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
   * @param {number} length - Total number of images
   * @param {number} currentImageIndex - The initially active image index
   * @returns {HTMLElement} A container DIV holding the dot indicators
   */
  function createImageIndicator(length, currentImageIndex) {
    const indicator = document.createElement("div");
    indicator.className = "image-indicator";
  
    // Create each dot, highlighting the current index
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
   * @param {HTMLElement} container - The container holding the carousel images
   * @param {number} length - Total number of images
   * @param {HTMLElement} indicator - The dot indicator container
   */
  function addSwipeFunctionality(container, length, indicator) {
    let startX = 0;
    let currentImageIndex = 0;
    const swipeThreshold = 50;
  
    if (window.PointerEvent) {
      container.addEventListener("pointerdown", e => {
        startX = e.clientX;
      });
      container.addEventListener("pointerup", e => handleSwipe(e.clientX - startX));
    } else {
      container.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
      }, { passive: true });
      container.addEventListener("touchend", e => handleSwipe(e.changedTouches[0].clientX - startX));
      container.addEventListener("mousedown", e => {
        startX = e.clientX;
      });
      container.addEventListener("mouseup", e => {
        handleSwipe(e.clientX - startX);
      });
    }
  
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
   * Opens a modal to display images of the selected product.
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
  
    modal.classList.add("active");
    setupModalNavigation(modalImageContainer, item.imgSrc.length, 0);
  }
  
  /**
   * Sets up navigation (arrow clicks and swipe) inside the modal.
   * @param {HTMLElement} container - The container holding modal images.
   * @param {number} length - Total number of images.
   * @param {number} currentImageIndex - The currently displayed image index.
   */
  function setupModalNavigation(container, length, currentImageIndex) {
    const images = container.querySelectorAll(".modal-image");
    const leftButton = document.querySelector(".modal-nav-left");
    const rightButton = document.querySelector(".modal-nav-right");
  
    if (!leftButton || !rightButton) {
      console.error("Modal navigation buttons not found.");
      return;
    }
  
    function updateImageIndex(newIndex) {
      images[currentImageIndex].style.display = "none";
      currentImageIndex = (newIndex + length) % length;
      images[currentImageIndex].style.display = "block";
    }
  
    leftButton.onclick = () => updateImageIndex(currentImageIndex - 1);
    rightButton.onclick = () => updateImageIndex(currentImageIndex + 1);
  
    let startX = 0;
    if (window.PointerEvent) {
      container.addEventListener("pointerdown", e => {
        startX = e.clientX;
      });
      container.addEventListener("pointerup", e => handleModalSwipe(e.clientX - startX));
    } else {
      container.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
      }, { passive: true });
      container.addEventListener("touchend", e => handleModalSwipe(e.changedTouches[0].clientX - startX));
      container.addEventListener("mousedown", e => {
        startX = e.clientX;
      });
      container.addEventListener("mouseup", e => {
        handleModalSwipe(e.clientX - startX);
      });
    }
  
    function handleModalSwipe(deltaX) {
      if (Math.abs(deltaX) > 50) {
        updateImageIndex(deltaX < 0 ? currentImageIndex + 1 : currentImageIndex - 1);
      }
    }
  }
  
  /**
   * Creates a generic text element.
   * @param {string} tag - The HTML tag (e.g., 'p', 'h3')
   * @param {string} className - A CSS class name
   * @param {string} text - The text content
   * @returns {HTMLElement} The resulting DOM element
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
   * @param {Object} item - The product object containing 'id' and 'votes'
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
   * Sets up modal close handlers (close button and clicking outside modal content).
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
   * Sets up the mobile menu toggle (floating action button).
   */
  export function setupMobileMenu() {
    const fabMenu = document.querySelector(".fab-menu");
    const mobileMenuOverlay = document.querySelector(".mobile-menu-overlay");
    if (!fabMenu || !mobileMenuOverlay) return;
  
    fabMenu.addEventListener("click", () => mobileMenuOverlay.classList.toggle("active"));
  
    mobileMenuOverlay.addEventListener("click", e => {
      // If user clicks outside or on a link, close overlay
      if (e.target === mobileMenuOverlay || e.target.tagName === "A") {
        mobileMenuOverlay.classList.remove("active");
      }
    });
  }
  
  /**
   * Dynamically populates a tag-based menu (including "All") in BOTH
   * desktop (.top-menu ul) and mobile (.mobile-menu-overlay ul).
   * When a tag is clicked, we filter products by that tag and
   * close the mobile overlay if applicable.
   * 
   * @param {Array<string>} tags - Array of unique tags with "All" at index 0.
   */
  export function populateMenu(tags) {
    const desktopMenu = document.querySelector(".top-menu ul");
    const mobileMenu = document.querySelector(".mobile-menu-overlay ul");
  
    if (!desktopMenu && !mobileMenu) return;
  
    function buildMenuItems(menuUl) {
      menuUl.innerHTML = "";
  
      tags.forEach(tag => {
        const li = document.createElement("li");
        const link = document.createElement("a");
        link.href = "#";
        link.textContent = tag;
  
        link.addEventListener("click", async e => {
          e.preventDefault();
  
          // Remove underline from previously active link (desktop only)
          if (menuUl.classList.contains("top-menu-ul")) {
            document.querySelectorAll(".top-menu ul li a").forEach(a => {
              a.classList.remove("active-tag");
            });
            link.classList.add("active-tag");
          }
  
          // Fetch products by tag
          const filteredProducts = await fetchProductsByTag(tag);
          populateCarousel(filteredProducts);
  
          // Close mobile overlay if this is the mobile menu
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
  
    // Mark the desktop menu UL for active-tag highlighting
    if (desktopMenu) {
      desktopMenu.classList.add("top-menu-ul");
      buildMenuItems(desktopMenu);
    }
  
    // Mark the mobile menu UL for overlay logic
    if (mobileMenu) {
      mobileMenu.classList.add("mobile-menu-ul");
      buildMenuItems(mobileMenu);
    }
  }