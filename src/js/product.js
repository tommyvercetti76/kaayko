/**
 * Thin product PDP (legacy SKUs without an animal page).
 * Fetches /api/products/<productID> and renders title + description + gallery + buy.
 */

import { priceText } from "/js/priceMap.js";

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

function addToBagSmart(product) {
  const cm = window.cartManager;
  if (!cm) return false;
  const sizes = product.availableSizes || [];
  const isOneSizeOrNone = sizes.length === 0 || (sizes.length === 1 && /one size/i.test(sizes[0]));

  if (product.productType === "tshirt") {
    return openSizeGenderPopup(product);
  }
  const ok = cm.addItem({
    productId: product.id,
    title: product.title,
    subtitle: product.description,
    price: priceText(product),
    imgSrc: product.imgSrc,
    size: isOneSizeOrNone ? (sizes[0] || "One Size") : sizes[0],
    gender: null
  });
  if (!ok && window.showSustainabilityAlert) window.showSustainabilityAlert();
  return ok;
}

function openSizeGenderPopup(product) {
  const overlay = document.createElement("div");
  overlay.className = "filter-overlay active";
  overlay.style.zIndex = 3000;
  const sizes = (product.availableSizes && product.availableSizes.length)
    ? product.availableSizes
    : ["XS","S","M","L","XL","XXL"];
  overlay.innerHTML = `
    <div class="filter-panel" style="max-width:380px;">
      <h2>Choose your fit</h2>
      <button class="filter-close material-icons" type="button" aria-label="Close" id="vs-close">close</button>
      <div class="filter-section">
        <strong>Gender</strong>
        <div class="chip-group" id="vs-gender">
          ${["Male","Female","Teen","Child","Infant"].map(g => `<button type="button" class="chip" data-g="${g}">${g}</button>`).join("")}
        </div>
      </div>
      <div class="filter-section">
        <strong>Size</strong>
        <div class="chip-group" id="vs-size">
          ${sizes.map(s => `<button type="button" class="chip" data-s="${s}">${s}</button>`).join("")}
        </div>
      </div>
      <div class="filter-actions">
        <button type="button" id="vs-cancel">Cancel</button>
        <button type="button" id="vs-confirm">Add to bag</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  let g = null, s = null;
  overlay.querySelectorAll('[data-g]').forEach(btn => btn.addEventListener('click', () => {
    overlay.querySelectorAll('[data-g]').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected'); g = btn.dataset.g;
  }));
  overlay.querySelectorAll('[data-s]').forEach(btn => btn.addEventListener('click', () => {
    overlay.querySelectorAll('[data-s]').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected'); s = btn.dataset.s;
  }));
  const close = () => overlay.remove();
  overlay.querySelector('#vs-close').addEventListener('click', close);
  overlay.querySelector('#vs-cancel').addEventListener('click', close);
  overlay.querySelector('#vs-confirm').addEventListener('click', () => {
    if (!g || !s) return;
    const ok = window.cartManager.addItem({
      productId: product.id, title: product.title, subtitle: product.description,
      price: priceText(product), imgSrc: product.imgSrc, size: s, gender: g
    });
    if (!ok && window.showSustainabilityAlert) window.showSustainabilityAlert();
    close();
  });
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

  const thumbs = previews.map((url, i) => `
    <div class="product-thumb${i === 0 ? ' active' : ''}" data-idx="${i}">
      <img src="${esc(url)}" alt="${esc(product.title)} view ${i+1}" loading="lazy" />
    </div>`).join("");

  root.innerHTML = `
    <section class="product-shell">
      <div class="product-gallery">
        <div class="product-gallery-main" id="pg-main">
          <img id="pg-main-img" src="${esc(previews[0])}" alt="${esc(product.title)}" />
        </div>
        ${previews.length > 1 ? `<div class="product-thumbs">${thumbs}</div>` : ""}
      </div>
      <div class="product-info">
        <h1 class="product-title">${esc(product.title)}</h1>
        <div class="product-price">${priceText(product)}</div>
        ${product.description ? `<p class="product-description">${esc(product.description)}</p>` : ""}
        <button type="button" class="product-cta" id="pdp-add">
          <span class="material-icons cta-check" style="display:none">check</span>
          <span class="cta-label">Add to bag</span>
        </button>
      </div>
    </section>`;

  // Thumb switch (uses preview tier — same fidelity as main display)
  root.querySelectorAll('.product-thumb').forEach(t => {
    t.addEventListener('click', () => {
      root.querySelectorAll('.product-thumb').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById('pg-main-img').src = previews[parseInt(t.dataset.idx)];
    });
  });

  // Zoom on main click
  document.getElementById('pg-main').addEventListener('click', () => openModalFn(product));

  // Add to bag + cart sync
  const cta = document.getElementById('pdp-add');
  cta.addEventListener('click', () => addToBagSmart(product));
  const sync = () => {
    const inCart = window.cartManager?.hasProduct(product.productID);
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
