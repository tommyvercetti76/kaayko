// Import necessary Firebase modules
import { 
    initializeApp 
  } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
  
  import { 
    getFirestore, 
    collection, 
    getDocs, 
    doc, 
    updateDoc 
  } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
  
  import { 
    getStorage, 
    ref, 
    listAll, 
    getDownloadURL 
  } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";
  
  /* --------------------------------------------------------------------------
   *                           Firebase Configuration
   * -------------------------------------------------------------------------- */
  
  const firebaseConfig = {
    apiKey: "AIzaSyC59ECKLt3rowOoavF76hV_djb--W4jekA",
    authDomain: "kaaykostore.firebaseapp.com",
    projectId: "kaaykostore",
    storageBucket: "kaaykostore.firebasestorage.app",
    messagingSenderId: "87383373015",
    appId: "1:87383373015:web:ee1ce56d4f5192ec67ec92",
    measurementId: "G-W7WN2NXM8M"
  };
  
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const storage = getStorage(app);
  
  /* --------------------------------------------------------------------------
   *                       Application Entry Point
   * -------------------------------------------------------------------------- */
  
  // When the page is fully loaded, fetch products and setup modal close handlers
  document.addEventListener('DOMContentLoaded', () => {
    // Disable right-click context menu
    document.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
    fetchProductData();
    setupModalCloseHandlers();
    setupMobileMenu();
  });
  
  /* --------------------------------------------------------------------------
   *                           Data Fetching Logic
   * -------------------------------------------------------------------------- */
  
  /**
   * Fetches all products from the "kaaykoproducts" collection,
   * fetches their image URLs from Firebase Storage, then populates the carousel.
   */
  async function fetchProductData() {
    try {
      // 1. Get all product docs from Firestore
      const snapshot = await getDocs(collection(db, "kaaykoproducts"));
      const productList = snapshot.docs.map(docSnap => {
        return { 
          id: docSnap.id, 
          ...docSnap.data() 
        };
      });
  
      // 2. For each product, fetch its images from Storage in parallel
      const productsWithImages = await Promise.all(
        productList.map(async (product) => {
          const images = await fetchImagesByProductId(product.productID);
          return { ...product, imgSrc: images };
        })
      );
  
      // 3. Once all images are fetched, populate the carousel
      populateCarousel(productsWithImages);
    } catch (error) {
      console.error("Error fetching product data:", error);
    }
  }
  
  /**
   * Fetches images for a specific product from Firebase Storage.
   * @param {string} productID - The unique ID of the product in Storage.
   * @returns {Promise<string[]>} - An array of image download URLs.
   */
  async function fetchImagesByProductId(productID) {
    try {
      const storageRef = ref(storage, `kaaykoStoreTShirtImages/${productID}`);
      const result = await listAll(storageRef);
      return await Promise.all(result.items.map(imageRef => getDownloadURL(imageRef)));
    } catch (error) {
      console.error("Error fetching images:", error);
      return [];
    }
  }
  
  /* --------------------------------------------------------------------------
   *                            Carousel Rendering
   * -------------------------------------------------------------------------- */
  
  /**
   * Renders the list of product items into the #carousel container.
   * @param {Array<Object>} items - The product items to display.
   */
  function populateCarousel(items) {
    const carousel = document.getElementById('carousel');
    if (!carousel) return;
  
    // Clear any existing content
    carousel.innerHTML = '';
  
    // Create and append each carousel item
    items.forEach(item => {
      const carouselItem = createCarouselItem(item);
      carousel.appendChild(carouselItem);
    });
  }
  
  /**
   * Creates a single carousel item (with images, indicators, title, etc.).
   * @param {Object} item - The product item data.
   * @returns {HTMLElement} - The DOM element representing the carousel item.
   */
  function createCarouselItem(item) {
    const carouselItem = document.createElement('div');
    carouselItem.className = 'carousel-item';
  
    const imgContainer = buildImageContainer(item.imgSrc);
    carouselItem.appendChild(imgContainer);
  
    const imageIndicator = createImageIndicator(item.imgSrc.length, 0);
    carouselItem.appendChild(imageIndicator);
  
    const title = createTextElement('h3', 'title', item.title);
    const description = createTextElement('p', 'description', item.description);
  
    // Instead of directly appending 'price' and 'likeButtonContainer'
    // into the carouselItem, let's group them in a dedicated footer:
    const footer = document.createElement('div');
    footer.className = 'footer-elements';
  
    const priceEl = createTextElement('p', 'price', item.price);
    const voteContainer = createLikeButton(item);
  
    // Price is first => left, vote is second => right
    footer.append(priceEl, voteContainer);
  
    // Append text & new footer to the card
    carouselItem.append(title, description, footer);
  
    // The rest of your logic remains the same
    addSwipeFunctionality(imgContainer, item.imgSrc.length, imageIndicator);
    imgContainer.addEventListener('click', () => openModal(item));
  
    return carouselItem;
  }
  
  /**
   * Builds the image container that holds multiple images (displayed one at a time).
   * @param {string[]} imageUrls - List of image URLs to display.
   * @returns {HTMLElement} - A DIV wrapping all images.
   */
  function buildImageContainer(imageUrls) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'img-container';
  
    imageUrls.forEach((src, index) => {
      const img = document.createElement('img');
      img.src = src;
      img.className = 'carousel-image';
      // Show only the first image initially
      img.style.display = index === 0 ? 'block' : 'none';
      imgContainer.appendChild(img);
    });
  
    return imgContainer;
  }
  
  /**
   * Creates an image indicator (dot carousel) for multiple images.
   * @param {number} length - The total number of images.
   * @param {number} currentImageIndex - The initially displayed image index.
   * @returns {HTMLElement} - A DIV containing dot indicators.
   */
  function createImageIndicator(length, currentImageIndex) {
    const indicator = document.createElement('div');
    indicator.className = 'image-indicator';
  
    for (let i = 0; i < length; i++) {
      const dot = document.createElement('span');
      dot.className = 'indicator-dot' + (i === currentImageIndex ? ' active' : '');
      indicator.appendChild(dot);
    }
  
    return indicator;
  }
  
  /**
   * Allows swiping through images in the carousel.
   * @param {HTMLElement} container - The container holding all images.
   * @param {number} length - The total number of images.
   * @param {HTMLElement} indicator - The dot indicators to update on swipe.
   */
  function addSwipeFunctionality(container, length, indicator) {
    let startX = 0;
    let currentImageIndex = 0;
  
    // Mouse events
    container.addEventListener('mousedown', e => { startX = e.clientX; });
    container.addEventListener('mouseup', e => handleSwipe(e.clientX - startX));
  
    // Touch events
    container.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
    container.addEventListener('touchend', e => handleSwipe(e.changedTouches[0].clientX - startX));
  
    /**
     * Determines direction of swipe based on deltaX, updates displayed image and indicator.
     * @param {number} deltaX - The horizontal distance moved by the swipe.
     */
    function handleSwipe(deltaX) {
      if (Math.abs(deltaX) > 50) {
        const images = container.querySelectorAll('.carousel-image');
        if (!images.length) return;
  
        // Hide current image
        images[currentImageIndex].style.display = 'none';
        indicator.children[currentImageIndex].classList.remove('active');
  
        // Compute next image index (left or right)
        currentImageIndex = deltaX < 0
          ? (currentImageIndex + 1) % length
          : (currentImageIndex - 1 + length) % length;
  
        // Show new image
        images[currentImageIndex].style.display = 'block';
        indicator.children[currentImageIndex].classList.add('active');
      }
    }
  }
  
  /* --------------------------------------------------------------------------
   *                           Modal (Zoomed View)
   * -------------------------------------------------------------------------- */
  
  /**
   * Opens a modal to display images of the selected product.
   * @param {Object} item - The product item data with image array.
   */
  function openModal(item) {
    const modal = document.getElementById('modal');
    const modalImageContainer = document.getElementById('modal-image-container');
    if (!modal || !modalImageContainer) return;
  
    // Clear any previous images
    modalImageContainer.innerHTML = '';
  
    // Insert new images
    item.imgSrc.forEach((src, index) => {
      const img = document.createElement('img');
      img.src = src;
      img.className = 'modal-image';
      // Show only the first image initially
      img.style.display = index === 0 ? 'block' : 'none';
      modalImageContainer.appendChild(img);
    });
  
    // Show the modal
    modal.classList.add('active');
  
    // Set up navigation (arrows, swipes)
    let currentImageIndex = 0;
    setupModalNavigation(modalImageContainer, item.imgSrc.length, currentImageIndex);
  }
  
  /**
   * Allows left/right button navigation and swipe navigation in the modal.
   * @param {HTMLElement} container - The container for modal images.
   * @param {number} length - Number of images available.
   * @param {number} currentImageIndex - The currently displayed image index.
   */
  function setupModalNavigation(container, length, currentImageIndex) {
    const images = container.querySelectorAll('.modal-image');
    const leftButton = document.querySelector('.modal-nav-left');
    const rightButton = document.querySelector('.modal-nav-right');
  
    if (!leftButton || !rightButton) {
      console.error("Modal navigation buttons not found.");
      return;
    }
  
    function updateImageIndex(newIndex) {
      images[currentImageIndex].style.display = 'none';
      currentImageIndex = (newIndex + length) % length;
      images[currentImageIndex].style.display = 'block';
    }
  
    // Arrow clicks
    leftButton.onclick = () => updateImageIndex(currentImageIndex - 1);
    rightButton.onclick = () => updateImageIndex(currentImageIndex + 1);
  
    // Mouse events
    let startX = 0;
    container.addEventListener('mousedown', e => { startX = e.clientX; });
    container.addEventListener('mouseup', e => handleSwipe(e.clientX - startX));
  
    // Touch events
    container.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
    container.addEventListener('touchend', e => handleSwipe(e.changedTouches[0].clientX - startX));
  
    /**
     * Detects swipe direction and moves to the next/previous image accordingly.
     * @param {number} deltaX - Horizontal swipe distance.
     */
    function handleSwipe(deltaX) {
      if (Math.abs(deltaX) > 50) {
        updateImageIndex(deltaX < 0 ? currentImageIndex + 1 : currentImageIndex - 1);
      }
    }
  }
  
  /* --------------------------------------------------------------------------
   *                        Text Elements & Voting
   * -------------------------------------------------------------------------- */
  
  /**
   * Creates a simple text element with the given tag, class, and content.
   * @param {string} tag - The HTML tag (e.g. 'p', 'h3').
   * @param {string} className - The CSS class to apply.
   * @param {string} text - The text content.
   * @returns {HTMLElement} - The resulting DOM element.
   */
  function createTextElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
  }
  
  /**
   * Creates a like (heart) button with toggling functionality to track votes.
   * @param {Object} item - The product item (contains 'id' and 'votes').
   * @returns {HTMLElement} - A container with the button and vote count.
   */
  function createLikeButton(item) {
    // Create the heart button
    const button = document.createElement('button');
    button.className = 'heart-button';
  
    // Track if user has "liked" and the current vote count
    let isLiked = false;
    let currentVotes = item.votes || 0;
  
    // Create a span to display vote count
    const votesCount = document.createElement('span');
    votesCount.className = 'likes-count';
    votesCount.textContent = `${currentVotes} Votes`;
  
    // Initial visuals
    updateHeartButtonVisuals();
  
    // Toggle like on click
    button.addEventListener('click', async () => {
      try {
        isLiked = !isLiked;
        currentVotes = isLiked ? currentVotes + 1 : currentVotes - 1;
  
        // Update Firestore with new vote count
        const productRef = doc(db, "kaaykoproducts", item.id);
        await updateDoc(productRef, { votes: currentVotes });
  
        // Reflect the changes in the UI
        updateHeartButtonVisuals();
        votesCount.textContent = `${currentVotes} Votes`;
      } catch (error) {
        console.error("Error updating vote count:", error);
      }
    });
  
    /**
     * Updates the heart button's "liked" class based on isLiked.
     */
    function updateHeartButtonVisuals() {
      if (isLiked) {
        button.classList.add('liked');
      } else {
        button.classList.remove('liked');
      }
    }
  
    // Wrap button + vote count in a container
    const container = document.createElement('div');
    container.append(button, votesCount);
    return container;
  }
  
  /* --------------------------------------------------------------------------
   *                           Modal Close Handlers
   * -------------------------------------------------------------------------- */
  
  /**
   * Sets up the event listeners to close the modal when clicking
   * the close button or outside the modal content.
   */
  function setupModalCloseHandlers() {
    const modal = document.getElementById('modal');
    const closeButton = document.getElementById('close-modal-button');
  
    if (!modal) return;
  
    // Close on "X" button
    if (closeButton) {
      closeButton.onclick = () => closeModal(modal);
    }
  
    // Close by clicking outside the modal content
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  }
  
  /**
   * Closes the given modal by removing the 'active' class.
   * @param {HTMLElement} modal - The modal element.
   */
  function closeModal(modal) {
    modal.classList.remove('active');
  }
  
  /* --------------------------------------------------------------------------
   *                            Mobile Menu Logic
   * -------------------------------------------------------------------------- */
  
  /**
   * Sets up the floating action button (FAB) for mobile, toggling a menu overlay.
   */
  function setupMobileMenu() {
    const fabMenu = document.querySelector('.fab-menu');
    const mobileMenuOverlay = document.querySelector('.mobile-menu-overlay');
    if (!fabMenu || !mobileMenuOverlay) return;
  
    // Open/close overlay on FAB click
    fabMenu.addEventListener('click', () => {
      mobileMenuOverlay.classList.toggle('active');
    });
  
    // Close overlay when clicking outside or on a link
    mobileMenuOverlay.addEventListener('click', (e) => {
      if (e.target === mobileMenuOverlay || e.target.tagName === 'A') {
        mobileMenuOverlay.classList.remove('active');
      }
    });
  }