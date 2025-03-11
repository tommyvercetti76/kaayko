// scripts/kaayko_ui.js
import { updateProductVotes } from "./kaayko_dataService.js";

/**
 * Populates the carousel with product items.
 * @param {Array<Object>} items - An array of product objects from Firestore.
 */
export function populateCarousel(items) {
  const carousel = document.getElementById('carousel');
  if (!carousel) return;

  // Clear the carousel container
  carousel.innerHTML = '';

  // Create and append a carousel item for each product
  items.forEach(item => {
    const carouselItem = createCarouselItem(item);
    carousel.appendChild(carouselItem);
  });
}

/**
 * Creates a single carousel item element (including images, indicators, title, etc.).
 * @param {Object} item - A single product object.
 * @returns {HTMLElement} The DOM element representing the carousel item.
 */
function createCarouselItem(item) {
  const carouselItem = document.createElement('div');
  carouselItem.className = 'carousel-item';

  // Build image container (with multiple images)
  const imgContainer = buildImageContainer(item.imgSrc);
  carouselItem.appendChild(imgContainer);

  // Create and append dot indicators
  const imageIndicator = createImageIndicator(item.imgSrc.length, 0);
  carouselItem.appendChild(imageIndicator);

  // Title and description elements
  const title = createTextElement('h3', 'title', item.title);
  const description = createTextElement('p', 'description', item.description);

  // Footer with price and like button container
  const footer = document.createElement('div');
  footer.className = 'footer-elements';
  const priceEl = createTextElement('p', 'price', item.price);
  const { heartButton, votesCountEl } = createLikeButton(item);
  footer.append(priceEl, heartButton, votesCountEl);

  // Append title, description, and footer to the carousel item
  carouselItem.append(title, description, footer);

  // Add swipe functionality (desktop and mobile) on the image container.
  // This function sets a "swiped" flag (data attribute) on the container.
  addSwipeFunctionality(imgContainer, item.imgSrc.length, imageIndicator);

  // On click, open modal only if a swipe did NOT occur.
  imgContainer.addEventListener('click', () => {
    // If a swipe was detected, reset flag and do not open modal.
    if (imgContainer.dataset.swiped === "true") {
      imgContainer.dataset.swiped = "false";
      return;
    }
    openModal(item);
  });

  return carouselItem;
}

/**
 * Builds the image container that holds multiple images (displayed one at a time).
 * @param {string[]} imageUrls - An array of image URLs.
 * @returns {HTMLElement} A DIV wrapping all images.
 */
function buildImageContainer(imageUrls) {
  const imgContainer = document.createElement('div');
  imgContainer.className = 'img-container';
  // Initialize swipe flag to false.
  imgContainer.dataset.swiped = "false";

  // Insert each image; show only the first image initially.
  imageUrls.forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'carousel-image';
    img.style.display = index === 0 ? 'block' : 'none';
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
  const indicator = document.createElement('div');
  indicator.className = 'image-indicator';

  // Create each dot, marking the current index as active.
  for (let i = 0; i < length; i++) {
    const dot = document.createElement('span');
    dot.className = 'indicator-dot' + (i === currentImageIndex ? ' active' : '');
    // Clicking a dot changes the active image.
    dot.addEventListener('click', () => {
      const container = indicator.parentElement.querySelector('.img-container');
      const images = container.querySelectorAll('.carousel-image');
      images.forEach(img => img.style.display = 'none');
      Array.from(indicator.children).forEach(child => child.classList.remove('active'));
      images[i].style.display = 'block';
      dot.classList.add('active');
    });
    indicator.appendChild(dot);
  }

  return indicator;
}

/**
 * Adds swipe functionality for the image carousel on both desktop and mobile.
 * A new image will be shown only when the user swipes.
 * Also sets a flag on the container to prevent a swipe from triggering a click.
 * @param {HTMLElement} container - The container holding the carousel images.
 * @param {number} length - Total number of images.
 * @param {HTMLElement} indicator - The dot indicator container.
 */
function addSwipeFunctionality(container, length, indicator) {
  let startX = 0;
  let currentImageIndex = 0;
  const swipeThreshold = 50; // Minimum horizontal distance (px) for a valid swipe.

  // Use Pointer Events if available; fallback to touch/mouse events.
  if (window.PointerEvent) {
    container.addEventListener('pointerdown', e => { startX = e.clientX; });
    container.addEventListener('pointerup', e => handleSwipe(e.clientX - startX));
  } else {
    // Touch events.
    container.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    container.addEventListener('touchend', e => handleSwipe(e.changedTouches[0].clientX - startX));
    // Mouse events.
    container.addEventListener('mousedown', e => { startX = e.clientX; });
    container.addEventListener('mouseup', e => handleSwipe(e.clientX - startX));
  }

  /**
   * Determines if a valid swipe occurred and updates the displayed image and indicator.
   * Also sets a "swiped" flag so that a click event does not open the modal.
   * @param {number} deltaX - The horizontal distance moved by the swipe.
   */
  function handleSwipe(deltaX) {
    if (Math.abs(deltaX) > swipeThreshold) {
      const images = container.querySelectorAll('.carousel-image');
      if (!images.length) return;

      // Mark that a swipe occurred.
      container.dataset.swiped = "true";

      // Hide the current image and remove indicator highlight.
      images[currentImageIndex].style.display = 'none';
      indicator.children[currentImageIndex].classList.remove('active');

      // Update index based on swipe direction.
      currentImageIndex = deltaX < 0
        ? (currentImageIndex + 1) % length
        : (currentImageIndex - 1 + length) % length;

      // Show the new image and update indicator.
      images[currentImageIndex].style.display = 'block';
      indicator.children[currentImageIndex].classList.add('active');
    }
  }
}

/**
 * Opens a modal to display images of the selected product.
 * @param {Object} item - The product object containing an 'imgSrc' array.
 */
export function openModal(item) {
  const modal = document.getElementById('modal');
  const modalImageContainer = document.getElementById('modal-image-container');
  if (!modal || !modalImageContainer) return;

  // Clear any previous images.
  modalImageContainer.innerHTML = '';

  // Insert new images; display only the first image initially.
  item.imgSrc.forEach((src, index) => {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'modal-image';
    img.style.display = index === 0 ? 'block' : 'none';
    modalImageContainer.appendChild(img);
  });

  // Display the modal.
  modal.classList.add('active');

  // Set up navigation (arrows and swipe) within the modal.
  setupModalNavigation(modalImageContainer, item.imgSrc.length, 0);
}

/**
 * Sets up navigation (arrow clicks and swipe) inside the modal.
 * @param {HTMLElement} container - The container holding modal images.
 * @param {number} length - Total number of images.
 * @param {number} currentImageIndex - The index of the currently displayed image.
 */
function setupModalNavigation(container, length, currentImageIndex) {
  const images = container.querySelectorAll('.modal-image');
  const leftButton = document.querySelector('.modal-nav-left');
  const rightButton = document.querySelector('.modal-nav-right');

  if (!leftButton || !rightButton) {
    console.error("Modal navigation buttons not found.");
    return;
  }

  /**
   * Updates the active modal image based on the new index.
   * @param {number} newIndex - The new image index.
   */
  function updateImageIndex(newIndex) {
    images[currentImageIndex].style.display = 'none';
    currentImageIndex = (newIndex + length) % length;
    images[currentImageIndex].style.display = 'block';
  }

  // Arrow click events.
  leftButton.onclick = () => updateImageIndex(currentImageIndex - 1);
  rightButton.onclick = () => updateImageIndex(currentImageIndex + 1);

  // Set up swipe events in the modal.
  let startX = 0;
  if (window.PointerEvent) {
    container.addEventListener('pointerdown', e => { startX = e.clientX; });
    container.addEventListener('pointerup', e => handleModalSwipe(e.clientX - startX));
  } else {
    container.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
    container.addEventListener('touchend', e => handleModalSwipe(e.changedTouches[0].clientX - startX));
    container.addEventListener('mousedown', e => { startX = e.clientX; });
    container.addEventListener('mouseup', e => handleModalSwipe(e.clientX - startX));
  }

  /**
   * Processes the swipe delta in the modal to change images.
   * @param {number} deltaX - The horizontal distance moved.
   */
  function handleModalSwipe(deltaX) {
    if (Math.abs(deltaX) > 50) {
      updateImageIndex(deltaX < 0 ? currentImageIndex + 1 : currentImageIndex - 1);
    }
  }
}

/**
 * Creates a generic text element.
 * @param {string} tag - The HTML tag (e.g., 'p', 'h3').
 * @param {string} className - A CSS class name.
 * @param {string} text - The text content.
 * @returns {HTMLElement} The resulting DOM element.
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
 * @returns {{ heartButton: HTMLElement, votesCountEl: HTMLElement }} A container with the button and vote count.
 */
function createLikeButton(item) {
  const button = document.createElement('button');
  button.className = 'heart-button';

  let isLiked = false;
  let currentVotes = item.votes || 0;

  const votesCount = document.createElement('span');
  votesCount.className = 'likes-count';
  votesCount.textContent = `${currentVotes} Votes`;

  /**
   * Updates the heart button's appearance based on the liked state.
   */
  function updateHeartButtonVisuals() {
    if (isLiked) {
      button.classList.add('liked');
    } else {
      button.classList.remove('liked');
    }
  }
  updateHeartButtonVisuals();

  // Toggle liked state and update Firestore on click.
  button.addEventListener('click', async () => {
    isLiked = !isLiked;
    const voteChange = isLiked ? 1 : -1;
    await updateProductVotes(item.id, voteChange);
    currentVotes += voteChange;
    updateHeartButtonVisuals();
    votesCount.textContent = `${currentVotes} Votes`;
  });

  // Wrap button and vote count in a container.
  const container = document.createElement('div');
  container.append(button, votesCount);
  return container;
}

/**
 * Sets up modal close handlers (close button and clicking outside modal content).
 */
export function setupModalCloseHandlers() {
  const modal = document.getElementById('modal');
  const closeButton = document.getElementById('close-modal-button');
  if (!modal) return;

  // Close modal on close button click.
  if (closeButton) {
    closeButton.onclick = () => modal.classList.remove('active');
  }

  // Close modal when clicking outside the modal content.
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
}

/**
 * Sets up the mobile menu toggle (floating action button).
 */
export function setupMobileMenu() {
  const fabMenu = document.querySelector('.fab-menu');
  const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
  if (!fabMenu || !mobileMenuOverlay) return;

  // Toggle the mobile menu overlay on FAB click.
  fabMenu.addEventListener('click', () => mobileMenuOverlay.classList.toggle('active'));

  // Hide mobile menu if user clicks outside or on a menu link.
  mobileMenuOverlay.addEventListener('click', (e) => {
    if (e.target === mobileMenuOverlay || e.target.tagName === 'A') {
      mobileMenuOverlay.classList.remove('active');
    }
  });
}