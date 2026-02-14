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
  : "https://api-vwcc5j4qda-uc.a.run.app/images";  // Production

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
  
  // Add store/seller attribution if available
  if (item.storeName && item.storeSlug) {
    const storeLink = document.createElement("a");
    storeLink.className = "product-store-link";
    storeLink.href = `/store.html?store=${encodeURIComponent(item.storeSlug)}`;
    storeLink.textContent = `by ${item.storeName}`;
    storeLink.addEventListener("click", (e) => e.stopPropagation());
    card.append(titleEl, storeLink, descEl);
  } else {
    card.append(titleEl, descEl);
  }

  const footer = document.createElement("div");
  footer.className = "footer-elements";
  
  // Price indicators container
  const priceContainer = document.createElement("div");
  priceContainer.className = "price-container";
  
  const priceSymbols = textEl("p", "price", item.price);
  
  // Convert price symbols to actual dollar amount - use actualPrice if available
  const actualPrice = document.createElement("p");
  actualPrice.className = "actual-price";
  if (item.actualPrice) {
    actualPrice.textContent = `$${item.actualPrice.toFixed(2)}`;
  } else {
    const priceMap = {
      "$$$$": "$49.99",
      "$$$": "$39.99", 
      "$$": "$29.99",
      "$": "$19.99"
    };
    actualPrice.textContent = priceMap[item.price] || item.price;
  }
  
  priceContainer.append(priceSymbols, actualPrice);
  
  const { heartButton, votesCountEl } = createLikeButton(item);
  const buyButton = createBuyButton(item);
  // Create vote container with button and count stacked
  const voteContainer = document.createElement('div');
  voteContainer.className = 'vote-container';
  voteContainer.append(heartButton, votesCountEl);
  
  footer.append(priceContainer, voteContainer, buyButton);

  card.append(footer);
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
    const img      = document.createElement("img");
    img.src        = signedURL; // Use direct Firebase Storage URL
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
  console.log(`🖐️ Adding swipe to container with ${count} images`);
  let startX = 0, idx = 0, threshold = 50;
  let isDragging = false;
  let hasSwiped = false;
  
  const process = dx => {
    console.log(`👆 Swipe detected: dx=${dx}, threshold=${threshold}`);
    if (Math.abs(dx) < threshold) {
      console.log(`⚠️ Swipe too small, ignoring`);
      return false;
    }
    
    hasSwiped = true;
    const imgs = container.querySelectorAll(".carousel-image");
    console.log(`🖼️ Found ${imgs.length} images, current idx=${idx}`);
    
    imgs[idx].style.display = "none";
    indicator.children[idx].classList.remove("active");
    idx = dx < 0 ? (idx + 1) % count : (idx - 1 + count) % count;
    console.log(`➡️ New idx=${idx}`);
    imgs[idx].style.display = "block";
    indicator.children[idx].classList.add("active");
    return true;
  };

  // Add touch area styling to ensure touch events work
  container.style.touchAction = 'pan-y pinch-zoom';
  container.style.userSelect = 'none';
  container.style.cursor = 'grab';

  // Prevent modal opening when swiping
  container.addEventListener('click', (e) => {
    if (hasSwiped) {
      console.log(`🚫 Preventing modal open due to swipe`);
      e.stopPropagation();
      e.preventDefault();
      hasSwiped = false;
    }
  }, true);

  if (window.PointerEvent) {
    console.log(`📱 Using pointer events for swipe`);
    container.addEventListener("pointerdown", e => {
      startX = e.clientX;
      isDragging = true;
      hasSwiped = false;
      container.style.cursor = 'grabbing';
      console.log(`👇 Pointer down at ${startX}`);
      e.preventDefault();
    });
    
    container.addEventListener("pointermove", e => {
      if (isDragging) {
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 10) {
          hasSwiped = true;
        }
      }
    });
    
    container.addEventListener("pointerup", e => {
      if (isDragging) {
        const dx = e.clientX - startX;
        console.log(`👆 Pointer up at ${e.clientX}, dx=${dx}`);
        process(dx);
        isDragging = false;
        container.style.cursor = 'grab';
      }
    });
  } else {
    console.log(`📱 Using touch events for swipe`);
    container.addEventListener("touchstart", e => {
      startX = e.touches[0].clientX;
      isDragging = true;
      hasSwiped = false;
      console.log(`👇 Touch start at ${startX}`);
    }, {passive: false});
    
    container.addEventListener("touchmove", e => {
      if (isDragging) {
        const dx = e.touches[0].clientX - startX;
        if (Math.abs(dx) > 10) {
          hasSwiped = true;
          e.preventDefault(); // Prevent scrolling
        }
      }
    }, {passive: false});
    
    container.addEventListener("touchend", e => {
      if (isDragging) {
        const dx = e.changedTouches[0].clientX - startX;
        console.log(`👆 Touch end, dx=${dx}`);
        process(dx);
        isDragging = false;
      }
    });
    
    // Also add mouse events for desktop
    container.addEventListener("mousedown", e => {
      startX = e.clientX;
      isDragging = true;
      hasSwiped = false;
      container.style.cursor = 'grabbing';
      console.log(`🖱️ Mouse down at ${startX}`);
      e.preventDefault();
    });
    
    container.addEventListener("mousemove", e => {
      if (isDragging) {
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 10) {
          hasSwiped = true;
        }
      }
    });
    
    container.addEventListener("mouseup", e => {
      if (isDragging) {
        const dx = e.clientX - startX;
        console.log(`🖱️ Mouse up at ${e.clientX}, dx=${dx}`);
        process(dx);
        isDragging = false;
        container.style.cursor = 'grab';
      }
    });
    
    // Prevent mouse leave from breaking the interaction
    container.addEventListener("mouseleave", e => {
      if (isDragging) {
        isDragging = false;
        container.style.cursor = 'grab';
      }
    });
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
    const img      = document.createElement("img");
    img.src        = signedURL; // Use direct Firebase Storage URL
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
   4) Buy Button & Purchase Modal
   ========================================================================== */
function createBuyButton(item) {
  const container = document.createElement("div");
  container.className = "cart-button-container";
  
  const btn = document.createElement("button");
  btn.className = "cart-button";
  btn.dataset.productId = item.id;
  
  // Check if item is in cart
  const isInCart = window.cartManager && window.cartManager.hasProduct(item.id);
  if (isInCart) {
    btn.classList.add('in-cart');
  }
  
  // Icon + label
  const icon = document.createElement("span");
  icon.className = "material-icons cart-icon";
  icon.textContent = isInCart ? "shopping_cart" : "shopping_cart";
  
  const label = document.createElement("span");
  label.className = "cart-label";
  label.textContent = isInCart ? "In Cart" : "Buy";
  
  btn.append(icon, label);
  
  // Mini panel for size/gender selection
  const miniPanel = document.createElement("div");
  miniPanel.className = "cart-mini-panel";
  miniPanel.style.display = "none";
  
  const cartItem = isInCart ? window.cartManager.getItem(item.id) : null;
  
  miniPanel.innerHTML = `
    <div class="mini-panel-content">
      <div class="mini-panel-section">
        <label>Gender:</label>
        <div class="mini-gender-options">
          <button class="mini-option" data-gender="Male">Male</button>
          <button class="mini-option" data-gender="Female">Female</button>
          <button class="mini-option" data-gender="Teen">Teen</button>
          <button class="mini-option" data-gender="Child">Child</button>
          <button class="mini-option" data-gender="Infant">Infant</button>
        </div>
      </div>
      <div class="mini-panel-section">
        <label>Size:</label>
        <div class="mini-size-options">
          <button class="mini-option" data-size="XS">XS</button>
          <button class="mini-option" data-size="S">S</button>
          <button class="mini-option" data-size="M">M</button>
          <button class="mini-option" data-size="L">L</button>
          <button class="mini-option" data-size="XL">XL</button>
          <button class="mini-option" data-size="XXL">XXL</button>
        </div>
      </div>
      <div class="mini-panel-actions">
        <button class="mini-add-to-cart" disabled>${isInCart ? 'Update Cart' : 'Add to Cart'}</button>
        ${isInCart ? '<button class="mini-remove-from-cart">Remove</button>' : ''}
      </div>
    </div>
  `;
  
  let selectedGender = cartItem?.gender || null;
  let selectedSize = cartItem?.size || null;
  
  // Pre-select if editing
  if (cartItem) {
    setTimeout(() => {
      const genderBtn = miniPanel.querySelector(`[data-gender="${cartItem.gender}"]`);
      const sizeBtn = miniPanel.querySelector(`[data-size="${cartItem.size}"]`);
      if (genderBtn) genderBtn.classList.add('selected');
      if (sizeBtn) sizeBtn.classList.add('selected');
      miniPanel.querySelector('.mini-add-to-cart').disabled = false;
    }, 0);
  }
  
  // Gender selection
  miniPanel.querySelectorAll('[data-gender]').forEach(genderBtn => {
    genderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      miniPanel.querySelectorAll('[data-gender]').forEach(b => b.classList.remove('selected'));
      genderBtn.classList.add('selected');
      selectedGender = genderBtn.dataset.gender;
      updateAddButton();
    });
  });
  
  // Size selection
  miniPanel.querySelectorAll('[data-size]').forEach(sizeBtn => {
    sizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      miniPanel.querySelectorAll('[data-size]').forEach(b => b.classList.remove('selected'));
      sizeBtn.classList.add('selected');
      selectedSize = sizeBtn.dataset.size;
      updateAddButton();
    });
  });
  
  function updateAddButton() {
    const addBtn = miniPanel.querySelector('.mini-add-to-cart');
    addBtn.disabled = !(selectedGender && selectedSize);
  }
  
  // Add to cart action
  miniPanel.querySelector('.mini-add-to-cart').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!window.cartManager) return;
    
    // Convert price symbols to actual amounts
    const priceMap = {
      "$$$$": "$49.99",
      "$$$": "$39.99", 
      "$$": "$29.99",
      "$": "$19.99"
    };
    const actualPrice = priceMap[item.price] || item.price;
    
    const success = window.cartManager.addItem({
      productId: item.id,
      title: item.title,
      subtitle: item.description,
      price: actualPrice,
      imgSrc: item.imgSrc,
      size: selectedSize,
      gender: selectedGender
    });
    
    if (!success) {
      // Show sustainability alert
      if (window.showSustainabilityAlert) {
        window.showSustainabilityAlert();
      }
    } else {
      // Update button state
      icon.textContent = "shopping_cart";
      label.textContent = "In Cart";
      btn.classList.add('in-cart');
      miniPanel.style.display = "none";
    }
  });
  
  // Remove from cart action
  const removeBtn = miniPanel.querySelector('.mini-remove-from-cart');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.cartManager) {
        window.cartManager.removeItem(item.id);
        icon.textContent = "shopping_cart";
        label.textContent = "Buy";
        btn.classList.remove('in-cart');
        miniPanel.style.display = "none";
      }
    });
  }
  
  // Toggle mini panel
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isVisible = miniPanel.style.display === "block";
    
    if (isVisible) {
      miniPanel.style.display = "none";
      return;
    }
    
    // Close all other panels
    document.querySelectorAll('.cart-mini-panel').forEach(p => p.style.display = "none");
    
    // Regenerate panel content based on current cart state
    const currentlyInCart = window.cartManager && window.cartManager.hasProduct(item.id);
    const currentCartItem = currentlyInCart ? window.cartManager.getItem(item.id) : null;
    
    miniPanel.innerHTML = `
      <div class="mini-panel-content">
        <div class="mini-panel-section">
          <label>Gender:</label>
          <div class="mini-gender-options">
            <button class="mini-option ${currentCartItem?.gender === 'Male' ? 'selected' : ''}" data-gender="Male">Male</button>
            <button class="mini-option ${currentCartItem?.gender === 'Female' ? 'selected' : ''}" data-gender="Female">Female</button>
            <button class="mini-option ${currentCartItem?.gender === 'Teen' ? 'selected' : ''}" data-gender="Teen">Teen</button>
            <button class="mini-option ${currentCartItem?.gender === 'Child' ? 'selected' : ''}" data-gender="Child">Child</button>
            <button class="mini-option ${currentCartItem?.gender === 'Infant' ? 'selected' : ''}" data-gender="Infant">Infant</button>
          </div>
        </div>
        <div class="mini-panel-section">
          <label>Size:</label>
          <div class="mini-size-options">
            <button class="mini-option ${currentCartItem?.size === 'XS' ? 'selected' : ''}" data-size="XS">XS</button>
            <button class="mini-option ${currentCartItem?.size === 'S' ? 'selected' : ''}" data-size="S">S</button>
            <button class="mini-option ${currentCartItem?.size === 'M' ? 'selected' : ''}" data-size="M">M</button>
            <button class="mini-option ${currentCartItem?.size === 'L' ? 'selected' : ''}" data-size="L">L</button>
            <button class="mini-option ${currentCartItem?.size === 'XL' ? 'selected' : ''}" data-size="XL">XL</button>
            <button class="mini-option ${currentCartItem?.size === 'XXL' ? 'selected' : ''}" data-size="XXL">XXL</button>
          </div>
        </div>
        <div class="mini-panel-actions">
          <button class="mini-add-to-cart" ${currentCartItem ? '' : 'disabled'}>${currentlyInCart ? 'Update Cart' : 'Add to Cart'}</button>
          ${currentlyInCart ? '<button class="mini-remove-from-cart">Remove</button>' : ''}
        </div>
      </div>
    `;
    
    // Reset selection state
    selectedGender = currentCartItem?.gender || null;
    selectedSize = currentCartItem?.size || null;
    
    // Re-attach event listeners
    miniPanel.querySelectorAll('[data-gender]').forEach(genderBtn => {
      genderBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        miniPanel.querySelectorAll('[data-gender]').forEach(b => b.classList.remove('selected'));
        genderBtn.classList.add('selected');
        selectedGender = genderBtn.dataset.gender;
        const addBtn = miniPanel.querySelector('.mini-add-to-cart');
        addBtn.disabled = !(selectedGender && selectedSize);
      });
    });
    
    miniPanel.querySelectorAll('[data-size]').forEach(sizeBtn => {
      sizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        miniPanel.querySelectorAll('[data-size]').forEach(b => b.classList.remove('selected'));
        sizeBtn.classList.add('selected');
        selectedSize = sizeBtn.dataset.size;
        const addBtn = miniPanel.querySelector('.mini-add-to-cart');
        addBtn.disabled = !(selectedGender && selectedSize);
      });
    });
    
    const addBtn = miniPanel.querySelector('.mini-add-to-cart');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!window.cartManager) return;
        
        // Convert price symbols to actual amounts
        const priceMap = {
          "$$$$": "$49.99",
          "$$$": "$39.99", 
          "$$": "$29.99",
          "$": "$19.99"
        };
        const actualPrice = priceMap[item.price] || item.price;
        
        const success = window.cartManager.addItem({
          productId: item.id,
          title: item.title,
          subtitle: item.description,
          price: actualPrice,
          imgSrc: item.imgSrc,
          size: selectedSize,
          gender: selectedGender
        });
        
        if (!success) {
          if (window.showSustainabilityAlert) {
            window.showSustainabilityAlert();
          }
        } else {
          icon.textContent = "shopping_cart";
          label.textContent = "In Cart";
          btn.classList.add('in-cart');
          miniPanel.style.display = "none";
        }
      });
    }
    
    const removeBtn = miniPanel.querySelector('.mini-remove-from-cart');
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.cartManager) {
          window.cartManager.removeItem(item.id);
          icon.textContent = "shopping_cart";
          label.textContent = "Buy";
          btn.classList.remove('in-cart');
          miniPanel.style.display = "none";
        }
      });
    }
    
    miniPanel.style.display = "block";
  });
  
  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      miniPanel.style.display = "none";
    }
  });
  
  container.append(btn, miniPanel);
  return container;
}

function openPurchaseModal(item) {
  // Redirect to cart instead of opening modal
  window.location.href = '/cart.html';
  return;
  
  // Populate modal with product info
  const productImage = modal.querySelector("#purchase-product-image");
  const productTitle = modal.querySelector("#purchase-product-title");
  const productSubtitle = modal.querySelector("#purchase-product-subtitle");
  const productPrice = modal.querySelector("#purchase-product-price");
  const imageIndicator = modal.querySelector(".purchase-image-indicator");
  const sizeButtons = modal.querySelectorAll(".size-option");
  const checkoutBtn = modal.querySelector("#purchase-checkout-btn");
  
  // Setup image carousel
  let currentImageIndex = 0;
  productImage.src = item.imgSrc[0];
  productTitle.textContent = item.title;
  productSubtitle.textContent = item.description || '';
  productPrice.textContent = item.price;
  
  // Populate mobile product info
  const productTitleMobile = modal.querySelector('#purchase-product-title-mobile');
  const productSubtitleMobile = modal.querySelector('#purchase-product-subtitle-mobile');
  const productPriceMobile = modal.querySelector('#purchase-product-price-mobile');
  if (productTitleMobile) productTitleMobile.textContent = item.title;
  if (productSubtitleMobile) productSubtitleMobile.textContent = item.description || '';
  if (productPriceMobile) productPriceMobile.textContent = item.price;
  
  // Setup navigation arrows (if they exist)
  const prevArrow = modal.querySelector('.image-nav-prev');
  const nextArrow = modal.querySelector('.image-nav-next');
  
  const updateImageDisplay = (index) => {
    productImage.src = item.imgSrc[index];
    modal.querySelectorAll('.purchase-indicator-dot').forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
  };
  
  if (prevArrow) {
    prevArrow.addEventListener('click', () => {
      currentImageIndex = (currentImageIndex - 1 + item.imgSrc.length) % item.imgSrc.length;
      updateImageDisplay(currentImageIndex);
    });
  }
  
  if (nextArrow) {
    nextArrow.addEventListener('click', () => {
      currentImageIndex = (currentImageIndex + 1) % item.imgSrc.length;
      updateImageDisplay(currentImageIndex);
    });
  }
  
  // Update dot indicators
  const dotsContainer = modal.querySelector('.purchase-indicator-dots');
  dotsContainer.innerHTML = '';
  item.imgSrc.forEach((_, index) => {
    const dot = document.createElement('span');
    dot.className = 'purchase-indicator-dot' + (index === 0 ? ' active' : '');
    dot.addEventListener('click', () => {
      currentImageIndex = index;
      updateImageDisplay(index);
    });
    dotsContainer.appendChild(dot);
  });
  
  // Add swipe for image carousel
  let startX = 0;
  productImage.ontouchstart = (e) => startX = e.touches[0].clientX;
  productImage.ontouchmove = (e) => e.preventDefault();
  productImage.ontouchend = (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = startX - endX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        currentImageIndex = (currentImageIndex + 1) % item.imgSrc.length;
      } else {
        currentImageIndex = (currentImageIndex - 1 + item.imgSrc.length) % item.imgSrc.length;
      }
      updateImageDisplay(currentImageIndex);
    }
  };
  
  // Reset selections
  let selectedSize = 'M'; // Default size
  let selectedGender = 'Male'; // Default gender
  const paymentSection = modal.querySelector('.payment-section');
  const paymentForm = modal.querySelector('#payment-form');
  const paymentMessage = modal.querySelector('#payment-message');
  const modalBody = modal.querySelector('.purchase-modal-body');
  
  // Function to show payment section with slide animation (mobile only)
  const showPaymentSection = () => {
    if (selectedSize && selectedGender) {
      console.log('Both selections made - showing payment modal');
      
      // Add class to modal body to trigger slide animation (mobile)
      modalBody.classList.add('show-payment');
      
      // Initialize Stripe if not already done
      if (!stripeInitialized) {
        stripeInitialized = true;
        setTimeout(() => {
          initializeStripePayment(item, selectedSize, selectedGender, modal);
        }, 400);
      }
    } else {
      console.log('Waiting for both selections. Size:', selectedSize, 'Gender:', selectedGender);
    }
  };
  
  // Initialize Stripe immediately on desktop (it's always visible)
  let stripeInitialized = false;
  const isDesktop = window.innerWidth > 768;
  if (isDesktop) {
    stripeInitialized = true;
    // Wait a bit for modal to render
    setTimeout(() => {
      initializeStripePayment(item, 'M', 'Male', modal);
    }, 500);
  }
  
  // Gender selection buttons
  const genderButtons = modal.querySelectorAll('.gender-option');
  genderButtons.forEach(btn => {
    btn.classList.remove("selected");
    
    btn.onclick = () => {
      genderButtons.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedGender = btn.dataset.gender;
      console.log('Gender selected:', selectedGender);
      
      showPaymentSection();
    };
  });
  
  sizeButtons.forEach(btn => {
    btn.classList.remove("selected");
    
    btn.onclick = () => {
      sizeButtons.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      selectedSize = btn.dataset.size;
      console.log('Size selected:', selectedSize);
      
      showPaymentSection();
    };
  });
  
  // Mobile swipe-down to hide payment section
  const purchaseDetails = modal.querySelector('.purchase-details');
  let touchStartY = 0;
  let touchEndY = 0;
  
  purchaseDetails.addEventListener('touchstart', (e) => {
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });
  
  purchaseDetails.addEventListener('touchend', (e) => {
    touchEndY = e.changedTouches[0].screenY;
    const scrollTop = purchaseDetails.scrollTop;
    
    // If scrolled to top and swiped down, hide payment
    if (scrollTop === 0 && touchEndY > touchStartY + 50) {
      console.log('Swipe down detected - hiding payment');
      modalBody.classList.remove('show-payment');
    }
  }, { passive: true });
  
  modal.classList.add("active");
}

/* ==========================================================================
   4) Purchase Modal - REMOVED (Using cart.html checkout only)
   ========================================================================== */
// All purchase modal code removed per user request - using cart.html for all checkout

/* ========================================================================== 
                placeholder="you@example.com"
                required
                style="
                  width: 100%;
                  padding: 10px 12px;
                  background: #1a1a1a;
                  border: 2px solid #333;
                  border-radius: 6px;
                  color: #fff;
                  font-family: 'Josefin_Light', Arial, sans-serif;
                  font-size: 14px;
                  transition: border-color 0.2s;
                "
              />
              <div id="email-error-msg" style="display: none; color: #ff4444; font-size: 12px; margin-top: 4px; font-family: 'Josefin_Light', Arial, sans-serif;"></div>
            </div>
            
            <div>
              <label for="customer-phone-input" style="display: block; color: #ccc; font-family: 'Josefin_Light', Arial, sans-serif; font-size: 14px; margin-bottom: 6px;">
                Phone <span style="color: #999;">(optional)</span>
              </label>
              <input 
                type="tel" 
                id="customer-phone-input" 
                placeholder="+1 (555) 123-4567"
                style="
                  width: 100%;
                  padding: 10px 12px;
                  background: #1a1a1a;
                  border: 2px solid #333;
                  border-radius: 6px;
                  color: #fff;
                  font-family: 'Josefin_Light', Arial, sans-serif;
                  font-size: 14px;
                  transition: border-color 0.2s;
                "
              />
            </div>
            
            <p style="color: #999; font-size: 12px; margin-top: 12px; font-family: 'Josefin_Light', Arial, sans-serif;">
              We'll send your order confirmation and receipt to this email.
            </p>
          </div>
          
          <div class="selection-overlay">
            <div class="gender-selection">
              <h3>Gender:</h3>
              <div class="gender-options">
                <button class="gender-option" data-gender="Male">Male</button>
                <button class="gender-option" data-gender="Female">Female</button>
                <button class="gender-option" data-gender="Teen">Teen</button>
                <button class="gender-option" data-gender="Child">Child</button>
                <button class="gender-option" data-gender="Infant">Infant</button>
              </div>
            </div>
            
            <div class="size-selection">
              <h3>Select Size:</h3>
              <div class="size-options">
                <button class="size-option" data-size="XS">XS</button>
                <button class="size-option" data-size="S">S</button>
                <button class="size-option" data-size="M">M</button>
                <button class="size-option" data-size="L">L</button>
                <button class="size-option" data-size="XL">XL</button>
                <button class="size-option" data-size="XXL">XXL</button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="purchase-details">
          <h2 id="purchase-product-title"></h2>
          <p class="purchase-subtitle" id="purchase-product-subtitle"></p>
          <p class="purchase-price" id="purchase-product-price"></p>
          
          <div class="payment-section">
            <h3>Complete Your Purchase</h3>
            <p class="payment-prompt">Secure checkout powered by Stripe</p>
            
            <form id="payment-form">
              <div id="payment-element">
                <!-- Stripe Payment Element will be inserted here -->
              </div>
              <div id="payment-message" class="payment-message"></div>
              <button id="purchase-checkout-btn" class="checkout-button" type="submit" disabled>
                <span class="spinner hidden" id="spinner"></span>
                <span class="button-text">Complete Order</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Close button handler
  const closeBtn = modal.querySelector(".purchase-modal-close");
  closeBtn.addEventListener("click", () => {
    modal.classList.remove("active");
  });
  
  // Selection toggle button handler (mobile)
  const toggleBtn = modal.querySelector(".selection-toggle-button");
  const selectionOverlay = modal.querySelector(".selection-overlay");
  if (toggleBtn && selectionOverlay) {
    // Add nudge animation on load
    setTimeout(() => {
      toggleBtn.classList.add('nudge');
      setTimeout(() => toggleBtn.classList.remove('nudge'), 2000);
    }, 500);
    
    toggleBtn.addEventListener("click", () => {
      const isExpanded = selectionOverlay.classList.toggle("expanded");
      const icon = toggleBtn.querySelector(".material-icons");
      icon.textContent = isExpanded ? "expand_more" : "expand_less";
    });
  }
  
  // Click outside to close
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
    }
  });
  
  return modal;
}

// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51Sb3SRGhBi2rBXlYPnG9eqAUfRUGyHKYcATYekHRX0IvmggnVbJSNpKNDUcv3m8z1vokdf8pieFXfQf8T0aEQrFN00WKO0aymr';
let stripe = null;
let elements = null;

async function initializeStripePayment(item, size, gender, modal) {
  const paymentElement = modal.querySelector('#payment-element');
  const submitButton = modal.querySelector('#purchase-checkout-btn');
  const paymentForm = modal.querySelector('#payment-form');
  const paymentMessage = modal.querySelector('#payment-message');
  const emailInput = modal.querySelector('#customer-email-input');
  const phoneInput = modal.querySelector('#customer-phone-input');
  const emailError = modal.querySelector('#email-error-msg');
  
  // Initialize Stripe (only once)
  if (!stripe) {
    stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
  }
  
  // Email validation
  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };
  
  // Real-time email validation
  emailInput.addEventListener('input', () => {
    const email = emailInput.value.trim();
    if (!email) {
      emailInput.style.borderColor = '#333';
      emailError.style.display = 'none';
      submitButton.disabled = true;
    } else if (validateEmail(email)) {
      emailInput.style.borderColor = '#10b981';
      emailError.style.display = 'none';
      submitButton.disabled = false;
    } else {
      emailInput.style.borderColor = '#ff4444';
      emailError.textContent = 'Please enter a valid email';
      emailError.style.display = 'block';
      submitButton.disabled = true;
    }
  });
  
  try {
    // Detect local vs production environment
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiBaseUrl = isLocalhost 
      ? 'http://127.0.0.1:5001/kaaykostore/us-central1/api'
      : 'https://api-vwcc5j4qda-uc.a.run.app';
    
    const requestBody = {
      productId: item.id || item.title || 'unknown',
      productTitle: item.title || 'Product',
      size: size,
      gender: gender,
      price: item.price || '$0.00'
    };
    
    console.log('Creating payment intent:', requestBody);
    
    // Call your backend to create a payment intent
    const response = await fetch(`${apiBaseUrl}/createPaymentIntent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Payment intent error:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const { clientSecret, paymentIntentId } = await response.json();
    
    // Store payment intent ID for later use
    modal.setAttribute('data-payment-intent-id', paymentIntentId);
    
    // Create the Payment Element
    elements = stripe.elements({ 
      clientSecret,
      appearance: {
        theme: 'night',
        variables: {
          colorPrimary: '#ffd700',
        }
      }
    });
    
    const paymentElementInstance = elements.create('payment', {
      layout: 'tabs',
      fields: {
        billingDetails: {
          name: 'auto',
          email: 'auto',  // Let Stripe collect email
          address: 'auto'
        }
      },
      terms: {
        card: 'auto',  // Show Link/save option
      },
      wallets: {
        applePay: 'auto',
        googlePay: 'auto'
      }
    });
    
    paymentElementInstance.mount('#payment-element');
    
    // Enable button when payment element is ready
    paymentElementInstance.on('ready', () => {
      submitButton.disabled = false;
      submitButton.querySelector('.button-text').textContent = 'Complete Order';
    });
    
    // Handle form submission
    paymentForm.removeEventListener('submit', handleStripeSubmit);
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleStripeSubmit(e, stripe, elements, submitButton, paymentMessage, modal, emailInput, phoneInput, emailError);
    });
    
  } catch (error) {
    console.error('Error initializing Stripe:', error);
    paymentMessage.textContent = 'Unable to initialize payment. Please try again.';
    paymentMessage.classList.add('error');
  }
}

async function handleStripeSubmit(e, stripe, elements, submitButton, paymentMessage, modal, emailInput, phoneInput, emailError) {
  // Final email validation
  const customerEmail = emailInput.value.trim();
  const customerPhone = phoneInput.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!customerEmail || !emailRegex.test(customerEmail)) {
    emailError.textContent = 'Please enter a valid email before completing purchase';
    emailError.style.display = 'block';
    emailInput.style.borderColor = '#ff4444';
    emailInput.focus();
    return;
  }
  
  submitButton.disabled = true;
  submitButton.querySelector('.spinner').classList.remove('hidden');
  submitButton.querySelector('.button-text').textContent = 'Processing...';
  
  try {
    console.log('📧 Customer email:', customerEmail);
    console.log('📱 Customer phone:', customerPhone);
    
    // Confirm payment with customer email included
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-success.html?email=${encodeURIComponent(customerEmail)}`,
        receipt_email: customerEmail,
        payment_method_data: {
          billing_details: {
            email: customerEmail,
            phone: customerPhone || undefined
          }
        }
      },
    });
    
    if (error) {
      paymentMessage.textContent = error.message;
      paymentMessage.classList.add('error');
      submitButton.disabled = false;
      submitButton.querySelector('.spinner').classList.add('hidden');
      submitButton.querySelector('.button-text').textContent = 'Complete Order';
    } else {
      // Payment successful - will redirect to return_url
      paymentMessage.textContent = 'Payment successful! Redirecting...';
      paymentMessage.classList.remove('error');
      paymentMessage.classList.add('success');
    }
  } catch (error) {
    console.error('Payment error:', error);
    paymentMessage.textContent = 'Payment failed. Please try again.';
    paymentMessage.classList.add('error');
    submitButton.disabled = false;
    submitButton.querySelector('.spinner').classList.add('hidden');
    submitButton.querySelector('.button-text').textContent = 'Complete Order';
  }
}

/* ==========================================================================
   5) Modal-Close Handler (Image Gallery)
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

/* ==========================================================================
   6) Cart Checkout - Opens Stripe modal with cart items
   ========================================================================== */
export function openCheckoutWithCart(cartItems) {
  // Create a combined item for checkout
  if (!cartItems || cartItems.length === 0) {
    alert('Your cart is empty');
    return;
  }
  
  // For now, open modal for first item and attach cart data
  // In production, you'd modify the backend to accept multiple items
  const firstItem = cartItems[0];
  
  // Create a virtual "cart" item
  const cartItem = {
    id: 'cart_' + Date.now(),
    title: `Cart (${cartItems.length} item${cartItems.length > 1 ? 's' : ''})`,
    description: cartItems.map(i => i.title).join(', '),
    price: `$${window.cartManager.getTotalPrice().toFixed(2)}`,
    imgSrc: cartItems.map(i => i.imgSrc),
    cartItems: cartItems // Attach full cart data
  };
  
  // Open purchase modal with cart data
  openPurchaseModal(cartItem);
  
  // Pre-fill selections if single item
  if (cartItems.length === 1) {
    const modal = document.getElementById("purchase-modal");
    setTimeout(() => {
      const genderBtn = modal.querySelector(`[data-gender="${firstItem.gender}"]`);
      const sizeBtn = modal.querySelector(`[data-size="${firstItem.size}"]`);
      if (genderBtn) genderBtn.click();
      if (sizeBtn) sizeBtn.click();
    }, 100);
  }
}

// Make globally available
window.openCheckoutWithCart = openCheckoutWithCart;
