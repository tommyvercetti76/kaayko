// File: scripts/kaayko_ui.js
/**
 * Manages Kaayko Store page UI:
 *  1) Carousel rendering & swipe
 *  2) Image-zoom modal + navigation
 *  3) Voting (♥ button)
 *  4) Buy button & cart mini-panel
 *
 * Updated: now skips any item where `isAvailable !== true`
 */

import { voteOnProduct } from "./kaayko_apiClient.js";

// Cloud Function image proxy base - auto-detect environment
const IMAGE_PROXY_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `${window.location.origin}/api/images`  // Local Firebase emulator
  : "https://api-vwcc5j4qda-uc.a.run.app/images";  // Production

// Price symbol → dollar amount mapping (single source of truth)
const PRICE_MAP = {
  "$$$$": "$49.99",
  "$$$": "$39.99",
  "$$": "$29.99",
  "$": "$19.99"
};

// Single delegated handler for closing mini panels on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.cart-button-container')) {
    document.querySelectorAll('.cart-mini-panel').forEach(p => p.style.display = 'none');
  }
});

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
    actualPrice.textContent = PRICE_MAP[item.price] || item.price;
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
  let startX = 0, idx = 0, threshold = 50;
  let isDragging = false;
  let hasSwiped = false;

  const process = dx => {
    if (Math.abs(dx) < threshold) return false;

    hasSwiped = true;
    const imgs = container.querySelectorAll(".carousel-image");

    imgs[idx].style.display = "none";
    indicator.children[idx].classList.remove("active");
    idx = dx < 0 ? (idx + 1) % count : (idx - 1 + count) % count;
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
      e.stopPropagation();
      e.preventDefault();
      hasSwiped = false;
    }
  }, true);

  if (window.PointerEvent) {
    container.addEventListener("pointerdown", e => {
      startX = e.clientX;
      isDragging = true;
      hasSwiped = false;
      container.style.cursor = 'grabbing';
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
        process(e.clientX - startX);
        isDragging = false;
        container.style.cursor = 'grab';
      }
    });
  } else {
    container.addEventListener("touchstart", e => {
      startX = e.touches[0].clientX;
      isDragging = true;
      hasSwiped = false;
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
        process(e.changedTouches[0].clientX - startX);
        isDragging = false;
      }
    });

    // Also add mouse events for desktop
    container.addEventListener("mousedown", e => {
      startX = e.clientX;
      isDragging = true;
      hasSwiped = false;
      container.style.cursor = 'grabbing';
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
        process(e.clientX - startX);
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
  document.body.style.overflow = 'hidden';
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
  btn.setAttribute("aria-label", "Vote for this product");

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
   4) Buy Button & Cart Mini-Panel
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
  icon.textContent = "shopping_cart";

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

  function addItemToCart() {
    if (!window.cartManager) return;

    const actualPrice = PRICE_MAP[item.price] || item.price;

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
  }

  function removeItemFromCart() {
    if (window.cartManager) {
      window.cartManager.removeItem(item.id);
      icon.textContent = "shopping_cart";
      label.textContent = "Buy";
      btn.classList.remove('in-cart');
      miniPanel.style.display = "none";
    }
  }

  // Add to cart action
  miniPanel.querySelector('.mini-add-to-cart').addEventListener('click', (e) => {
    e.stopPropagation();
    addItemToCart();
  });

  // Remove from cart action
  const removeBtn = miniPanel.querySelector('.mini-remove-from-cart');
  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeItemFromCart();
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
        addItemToCart();
      });
    }

    const removeBtnNew = miniPanel.querySelector('.mini-remove-from-cart');
    if (removeBtnNew) {
      removeBtnNew.addEventListener('click', (e) => {
        e.stopPropagation();
        removeItemFromCart();
      });
    }

    miniPanel.style.display = "block";
  });

  container.append(btn, miniPanel);
  return container;
}

/* ==========================================================================
   5) Modal-Close Handler (Image Gallery)
   ========================================================================== */
export function setupModalCloseHandlers() {
  const modal = document.getElementById("modal");
  const btn   = document.getElementById("close-modal-button");
  if (!modal) return;

  function closeModal() {
    modal.classList.remove("active");
    document.body.style.overflow = '';
  }

  btn?.addEventListener("click", closeModal);
  modal.addEventListener("click", e => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("active")) closeModal();
  });
}
