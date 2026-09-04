/**
 * Thin product PDP (legacy SKUs without an animal page).
 * Fetches /api/products/<productID> and renders title + description + gallery + buy.
 */

import { priceText } from "/js/priceMap.js";
import { showBagToast, sizesFor, defaultFit, saveFitPref } from "/js/kaayko_ui.js";

const API_BASE = window.FORCE_PRODUCTION_MODE
  ? window.PRODUCTION_API_BASE
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? `${window.location.origin}/api`
      : "https://api-vwcc5j4qda-uc.a.run.app");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderError(root, msg) {
  root.innerHTML = `
    <section class="animal-empty">
      <h2>${esc(msg)}</h2>
      <a href="/store">← Browse the store</a>
    </section>`;
}

const GENDERS = ["Male", "Female", "Teen", "Child", "Infant"];

// The picker only earns its two taps for a multi-size t-shirt. Everything else
// (one-size SKUs, totes, magnets, prints…) goes straight into the bag.
function needsPicker(product) {
  if ((product.productType || "").toLowerCase() !== "tshirt") return false;
  const sizes = (product.availableSizes || []).filter(Boolean);
  const isOneSizeOrNone = sizes.length === 0 || (sizes.length === 1 && /one size/i.test(sizes[0]));
  if (isOneSizeOrNone) return false;
  return sizes.length > 1;
}

// The bag holds 2 unique products. Check BEFORE opening the picker so the
// shopper is never rejected after choosing a gender and a size.
function bagCapReached(product) {
  const cm = window.cartManager;
  if (!cm) return false;
  if (cm.hasProduct(product.id)) return false;
  const count = cm.getCount();
  if (count < 2) return false;
  if (window.showSustainabilityAlert) {
    window.showSustainabilityAlert({ attemptedProduct: product.title, cartCount: count });
  }
  return true;
}

function addToBagSmart(product) {
  const cm = window.cartManager;
  if (!cm) return false;

  // Already in the bag → take them to it rather than silently re-adding.
  if (cm.hasProduct(product.id) && !needsPicker(product)) {
    window.location.href = "/cart";
    return true;
  }

  if (bagCapReached(product)) return false;

  if (needsPicker(product)) {
    return openSizeGenderPopup(product);
  }

  const sizes = (product.availableSizes || []).filter(Boolean);
  const ok = cm.addItem({
    productId: product.id,
    title: product.title,
    subtitle: product.description,
    price: priceText(product),
    imgSrc: product.imgSrc,
    size: sizes[0] || "One Size",
    gender: null
  });
  if (!ok && window.showSustainabilityAlert) window.showSustainabilityAlert({ attemptedProduct: product.title });
  if (ok) showBagToast(`${product.title} added to bag`);
  return ok;
}

function openSizeGenderPopup(product) {
  const cm = window.cartManager;
  const existing = cm?.getItem(product.id) || null;
  const sizes = sizesFor(product);
  const fallback = defaultFit(product);

  // Start with a real selection so "Add to bag" is live on open.
  let g = GENDERS.includes(existing?.gender) ? existing.gender : fallback.gender;
  let s = sizes.includes(existing?.size) ? existing.size : fallback.size;

  // Whoever opened the picker gets focus back when it closes (2.4.3).
  const opener = document.activeElement;

  const overlay = document.createElement("div");
  overlay.className = "filter-overlay active";
  overlay.style.zIndex = 3000;
  overlay.innerHTML = `
    <div class="filter-panel" style="max-width:380px;" role="dialog" aria-modal="true" aria-labelledby="vs-title">
      <h2 id="vs-title">Choose your fit</h2>
      <button class="filter-close material-icons" type="button" aria-label="Close" id="vs-close">close</button>
      <div class="filter-section">
        <strong id="vs-gender-label">Gender</strong>
        <div class="chip-group" id="vs-gender" role="group" aria-labelledby="vs-gender-label">
          ${GENDERS.map(x => `<button type="button" class="chip${x === g ? " selected" : ""}" data-g="${x}" aria-pressed="${x === g}">${x}</button>`).join("")}
        </div>
      </div>
      <div class="filter-section">
        <strong id="vs-size-label">Size</strong>
        <div class="chip-group" id="vs-size" role="group" aria-labelledby="vs-size-label">
          ${sizes.map(x => `<button type="button" class="chip${x === s ? " selected" : ""}" data-s="${esc(x)}" aria-pressed="${x === s}">${esc(x)}</button>`).join("")}
        </div>
      </div>
      <div class="filter-actions">
        <button type="button" id="vs-cancel">Cancel</button>
        <button type="button" id="vs-confirm">${existing ? "Update bag" : "Add to bag"}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Chips are toggle buttons: the class drives the visuals, aria-pressed the state.
  const selectChip = (chips, chosen) => chips.forEach(b => {
    const on = b === chosen;
    b.classList.toggle('selected', on);
    b.setAttribute('aria-pressed', String(on));
  });
  overlay.querySelectorAll('[data-g]').forEach(btn => btn.addEventListener('click', () => {
    selectChip(overlay.querySelectorAll('[data-g]'), btn); g = btn.dataset.g;
  }));
  overlay.querySelectorAll('[data-s]').forEach(btn => btn.addEventListener('click', () => {
    selectChip(overlay.querySelectorAll('[data-s]'), btn); s = btn.dataset.s;
  }));

  // Modal dialog behaviour (2.1.2 / 2.4.3 / 4.1.2): Escape closes, Tab stays
  // inside, focus returns to the opener on close.
  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const focusables = Array.from(overlay.querySelectorAll('button:not([disabled])'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function close() {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
    if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
  }
  document.addEventListener('keydown', onKeydown);
  overlay.querySelector('#vs-close').addEventListener('click', close);
  overlay.querySelector('#vs-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  // Land on the current gender choice; the dialog's name is announced on entry.
  (overlay.querySelector('[data-g].selected') || overlay.querySelector('#vs-close')).focus();
  overlay.querySelector('#vs-confirm').addEventListener('click', () => {
    if (!g || !s) return;
    const ok = window.cartManager.addItem({
      productId: product.id, title: product.title, subtitle: product.description,
      price: priceText(product), imgSrc: product.imgSrc, size: s, gender: g
    });
    if (!ok && window.showSustainabilityAlert) window.showSustainabilityAlert({ attemptedProduct: product.title });
    if (ok) {
      saveFitPref(g, s);
      showBagToast(`${product.title} added to bag`);
    }
    close();
  });
  return true;
}

function renderProduct(product, openModalFn) {
  const root = document.getElementById('product-root');
  if (!product.imgSrc?.length) {
    renderError(root, "No images yet for this product");
    return;
  }

  document.title = `${product.title} · Kaayko`;

  // Preview tier for thumbnails + main display. Click-to-zoom opens full res.
  const previews = (product.previewSrc && product.previewSrc.length === product.imgSrc.length)
    ? product.previewSrc
    : product.imgSrc;

  // Thumbnails are real buttons so keyboard users can view every image (2.1.1).
  // The button carries the name; the picture inside is decorative.
  const thumbs = previews.map((url, i) => `
    <button type="button" class="product-thumb${i === 0 ? ' active' : ''}" data-idx="${i}" aria-label="Show image ${i + 1} of ${previews.length}" aria-pressed="${i === 0}">
      <img src="${esc(url)}" alt="" loading="lazy" />
    </button>`).join("");

  root.innerHTML = `
    <section class="product-shell">
      <div class="product-gallery">
        <div class="product-gallery-main" id="pg-main" role="button" tabindex="0" aria-label="${esc(product.title)} — open full-size image">
          <img id="pg-main-img" src="${esc(previews[0])}" alt="${esc(product.title)}" />
        </div>
        ${previews.length > 1 ? `<div class="product-thumbs">${thumbs}</div>` : ""}
      </div>
      <div class="product-info">
        <h1 class="product-title">${esc(product.title)}</h1>
        <div class="product-price">${priceText(product)}</div>
        ${product.description ? `<p class="product-description">${esc(product.description)}</p>` : ""}
        <button type="button" class="product-cta" id="pdp-add">
          <span class="material-icons cta-check" style="display:none" aria-hidden="true">check</span>
          <span class="cta-label">Add to bag</span>
        </button>
      </div>
    </section>`;

  // Thumb switch (uses preview tier — same fidelity as main display)
  root.querySelectorAll('.product-thumb').forEach(t => {
    t.addEventListener('click', () => {
      root.querySelectorAll('.product-thumb').forEach(x => {
        x.classList.remove('active');
        x.setAttribute('aria-pressed', 'false');
      });
      t.classList.add('active');
      t.setAttribute('aria-pressed', 'true');
      document.getElementById('pg-main-img').src = previews[parseInt(t.dataset.idx)];
    });
  });

  // Zoom on main click — and on Enter/Space, since the wrapper acts as a button.
  const mainImg = document.getElementById('pg-main');
  mainImg.addEventListener('click', () => openModalFn(product));
  mainImg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModalFn(product); }
  });

  // Add to bag + cart sync
  const cta = document.getElementById('pdp-add');
  cta.addEventListener('click', () => addToBagSmart(product));
  const sync = () => {
    // The cart keys on the Firestore doc id (`product.id`) — the same id we
    // store with addItem(). `product.productID` never matched, so the CTA
    // stayed on "Add to bag" and shoppers added the same SKU twice.
    const inCart = window.cartManager?.hasProduct(product.id);
    cta.classList.toggle('in-cart', !!inCart);
    cta.querySelector('.cta-check').style.display = inCart ? 'inline-flex' : 'none';
    cta.querySelector('.cta-label').textContent = inCart ? 'In bag' : 'Add to bag';
  };
  sync();
  window.cartManager?.subscribe(sync);
}

export async function productPageInit(productID, { openModal }) {
  const root = document.getElementById('product-root');
  if (!root || !productID) return renderError(root, "Product not found");

  try {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(productID)}`);
    if (res.status === 404) return renderError(root, "Product not found");
    if (!res.ok) throw new Error(res.statusText);
    const payload = await res.json();
    renderProduct(payload.product, openModal);
  } catch (err) {
    console.error('product fetch failed:', err);
    renderError(root, "Couldn't load this product");
  }
}
