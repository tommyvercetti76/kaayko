/**
 * Animal PDP renderer.
 * Fetches /api/animals/<slug> and paints the editorial layout.
 */

import { priceText } from "/js/priceMap.js";
import { showBagToast, sizesFor, defaultFit, saveFitPref } from "/js/kaayko_ui.js";

const API_BASE = window.FORCE_PRODUCTION_MODE
  ? window.PRODUCTION_API_BASE
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? `${window.location.origin}/api`
      : "https://api-vwcc5j4qda-uc.a.run.app");

const IUCN_SEVERITY = {
  "critically endangered": "critical",
  "endangered": "endangered",
  "vulnerable": "vulnerable",
  "near threatened": "vulnerable",
  "least concern": "low",
  "data deficient": "low"
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderNotFound(root, slug) {
  root.innerHTML = `
    <section class="animal-empty">
      <h2>This trail doesn't lead anywhere yet</h2>
      <p>The animal page for <em>${esc(slug)}</em> hasn't been published.</p>
      <a href="/store">← Browse the store</a>
    </section>`;
}

function renderError(root) {
  // A `javascript:` href is blocked by our CSP — use a real button.
  root.innerHTML = `
    <section class="animal-empty">
      <h2>Couldn't load this page</h2>
      <p>Something hiccupped on our end.</p>
      <button type="button" class="animal-retry" id="animal-retry">Try again</button>
    </section>`;
  root.querySelector('#animal-retry')?.addEventListener('click', () => location.reload());
}

function severity(status) {
  return IUCN_SEVERITY[(status || "").toLowerCase()] || "low";
}

function renderStats(animal) {
  const statBlocks = [];
  if (animal.iucnStatus) statBlocks.push(`<div class="animal-stat"><dt>IUCN Status</dt><dd>${esc(animal.iucnStatus)}</dd></div>`);
  if (animal.population) statBlocks.push(`<div class="animal-stat"><dt>Population</dt><dd>${esc(animal.population)}</dd></div>`);
  if (animal.park)       statBlocks.push(`<div class="animal-stat"><dt>Best seen at</dt><dd>${esc(animal.park)}</dd></div>`);
  if ((animal.regions || []).length) statBlocks.push(`<div class="animal-stat"><dt>Range</dt><dd>${animal.regions.map(esc).join(", ")}</dd></div>`);
  if (!statBlocks.length) return "";
  return `<dl class="animal-stats">${statBlocks.join("")}</dl>`;
}

/** Compact buy block for the hero. Same .variant-card contract the bindings
 *  and cart-sync already query by data-product-id, so nothing else changes. */
function heroBuy(p) {
  if (!p) return "";
  return `
    <article class="variant-card is-compact" data-product-id="${esc(p.id)}">
      <div class="variant-img" data-zoom role="button" tabindex="0" aria-label="${esc(p.title)} — open full-size image">${variantImage(p)}</div>
      <div class="an-buy-meta">
        <h2 class="variant-title">${esc(p.title)}</h2>
        <span class="variant-price">${variantPriceText(p)}</span>
        <button type="button" class="variant-cta" data-add-to-bag>
          <span class="material-icons cta-check" style="display:none" aria-hidden="true">check</span>
          <span class="cta-label">Add to bag</span>
        </button>
      </div>
    </article>`;
}

function renderHero(animal, products) {
  const heroSrc = animal.artPreviewUrl || animal.artUrl;

  // Not every animal has its transparent artwork drawn yet. Publishing a grey
  // "art will appear here" box is worse than showing the piece it lives on.
  const fallbackSrc = heroSrc ? "" : firstProductImage(products);
  const src = heroSrc || fallbackSrc;
  const kind = heroSrc ? "is-art" : fallbackSrc ? "is-product" : "is-empty";
  const zoomAttr = heroSrc ? ` data-zoom-full="${esc(animal.artUrl || heroSrc)}"` : "";
  const alt = heroSrc ? `${esc(animal.name)} illustration` : `${esc(animal.name)} on a Kaayko piece`;

  // The first sentence of the bio carries the hero; the rest waits below.
  const lede = animal.bio ? String(animal.bio).split(/(?<=\.)\s+/)[0] : "";

  return `
    <header class="an-hero ${kind}">
      <figure class="an-figure">
        <div class="an-plate" aria-hidden="true"></div>
        <div class="an-art"${zoomAttr}>
          ${src ? `<img src="${esc(src)}" alt="${alt}" fetchpriority="high" />` : ""}
        </div>
      </figure>

      <div class="an-panel">
        ${animal.iucnStatus ? `<p class="an-eyebrow" data-severity="${esc(String(animal.iucnStatus).toLowerCase().split(" ")[0])}">${esc(animal.iucnStatus)}</p>` : ""}
        <h1 class="an-name">${esc(animal.name)}</h1>
        ${animal.scientificName ? `<p class="an-scientific">${esc(animal.scientificName)}</p>` : ""}
        ${lede ? `<p class="an-lede">${esc(lede)}</p>` : ""}
        ${heroBuy(products[0])}
      </div>
    </header>`;
}

function renderStory(animal, products) {
  const stats = renderStats(animal);
  const rest = (products || []).slice(1);
  const hasProse = Boolean(animal.bio);
  if (!hasProse && !stats && !rest.length) return "";

  return `
    ${hasProse ? `
    <section class="an-story">
      <h2 class="an-kicker">The Story</h2>
      <p class="an-bio">${esc(animal.bio)}</p>
    </section>` : ""}
    ${stats ? `<section class="an-facts"><h2 class="an-kicker">Field Notes</h2>${stats}</section>` : ""}
    ${renderVariants(animal, rest)}`;
}

/**
 * A product photo for the hero, when an animal has no artwork of its own.
 *
 * Deliberately prefers the SECOND frame: the variant card lower down the page
 * already shows the first, and the same photograph twice on one screen reads
 * as a mistake. Products with a single image fall back to it.
 */
function firstProductImage(products) {
  const list = Array.isArray(products) ? products : [];
  for (const p of list) {
    const frames = (p.previewSrc && p.previewSrc.length ? p.previewSrc : p.imgSrc) || [];
    const src = frames[1] || frames[0];
    if (src) return src;
  }
  return "";
}

function variantImage(p) {
  // Prefer preview tier for the variant card thumbnail.
  const src = (p.previewSrc && p.previewSrc[0]) || (p.imgSrc && p.imgSrc[0]) || "";
  return src ? `<img src="${esc(src)}" alt="${esc(p.title)}" loading="lazy" />` : "";
}

function variantPriceText(p) {
  if (typeof p.actualPrice === "number") return `$${p.actualPrice.toFixed(2)}`;
  return esc(p.price || "");
}

function renderVariants(animal, products) {
  if (!products.length) return "";
  const heading = `More ${esc(animal.name.split(" ").pop())} pieces`;
  const cards = products.map(p => `
    <article class="variant-card" data-product-id="${esc(p.id)}">
      <div class="variant-img" data-zoom role="button" tabindex="0" aria-label="${esc(p.title)} — open full-size image">${variantImage(p)}</div>
      <div class="variant-meta">
        <h3 class="variant-title">${esc(p.title)}</h3>
        <span class="variant-price">${variantPriceText(p)}</span>
      </div>
      ${p.description ? `<p class="variant-description">${esc(p.description)}</p>` : ""}
      <button type="button" class="variant-cta" data-add-to-bag>
        <span class="material-icons cta-check" style="display:none" aria-hidden="true">check</span>
        <span class="cta-label">Add to bag</span>
      </button>
    </article>`).join("");
  return `
    <section class="an-wear">
      <h2 class="an-kicker">${heading}</h2>
      <div class="animal-variants">${cards}</div>
    </section>`;
}

const GENDERS = ["Male", "Female", "Teen", "Child", "Infant"];

// The picker only earns its two taps for a multi-size t-shirt. One-size and
// sizeless SKUs go straight into the bag.
function needsPicker(product) {
  if ((product.productType || "").toLowerCase() !== "tshirt") return false;
  const sizes = (product.availableSizes || []).filter(Boolean);
  const isOneSizeOrNone = sizes.length === 0 || (sizes.length === 1 && /one size/i.test(sizes[0]));
  if (isOneSizeOrNone) return false;
  return sizes.length > 1;
}

// The bag holds 2 unique products. Check BEFORE opening the picker so nobody
// picks a gender and a size only to be turned away.
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

// Cart-add logic that respects product type — the size/gender picker bug fix.
// T-shirts → open the fit popup. Tote/Magnet/one-size → add directly.
function addToBagSmart(product) {
  const cm = window.cartManager;
  if (!cm) return false;
  const priceLabel = priceText(product);

  // Already in the bag → take them to it rather than silently re-adding.
  if (cm.hasProduct(product.id) && !needsPicker(product)) {
    window.location.href = "/cart";
    return true;
  }

  if (bagCapReached(product)) return false;

  if (needsPicker(product)) {
    return openSizeGenderPopup(product, priceLabel);
  }

  // Direct add for totes / magnets / one-size / sizeless products
  const sizes = (product.availableSizes || []).filter(Boolean);
  const item = {
    productId: product.id,
    title: product.title,
    subtitle: product.description,
    price: priceLabel,
    imgSrc: product.imgSrc,
    size: sizes[0] || "One Size",
    gender: null
  };
  const ok = cm.addItem(item);
  if (!ok && window.showSustainabilityAlert) window.showSustainabilityAlert({ attemptedProduct: product.title });
  if (ok) showBagToast(`${product.title} added to bag`);
  return ok;
}

function openSizeGenderPopup(product, priceLabel) {
  // Minimal centered popup for sizing — only used for multi-size t-shirts.
  const existing = window.cartManager?.getItem(product.id) || null;
  const sizes = sizesFor(product);
  const fallback = defaultFit(product);

  // Start with a real selection so the confirm button is live on open.
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
      price: priceLabel, imgSrc: product.imgSrc, size: s, gender: g
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

function syncVariantCtas(products) {
  products.forEach(p => {
    // Cards are keyed on the Firestore doc id — the same id addItem() stores.
    const card = document.querySelector(`.variant-card[data-product-id="${CSS.escape(p.id)}"]`);
    if (!card) return;
    const inCart = window.cartManager?.hasProduct(p.id);
    const cta = card.querySelector('.variant-cta');
    const check = cta.querySelector('.cta-check');
    const label = cta.querySelector('.cta-label');
    cta.classList.toggle('in-cart', !!inCart);
    if (check) check.style.display = inCart ? 'inline-flex' : 'none';
    if (label) label.textContent = inCart ? 'In bag' : 'Add to bag';
  });
}

function bindVariantActions(animal, products, openModalFn) {
  products.forEach(p => {
    const card = document.querySelector(`.variant-card[data-product-id="${CSS.escape(p.id)}"]`);
    if (!card) return;
    const zoom = card.querySelector('[data-zoom]');
    zoom.addEventListener('click', () => openModalFn(p));
    zoom.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModalFn(p); }
    });
    card.querySelector('[data-add-to-bag]').addEventListener('click', e => {
      e.stopPropagation();
      addToBagSmart(p);
    });
  });
  // Click the hero art → open the full-res zoom modal.
  const heroArt = document.querySelector('.an-art[data-zoom-full]');
  if (heroArt && animal.artUrl) {
    heroArt.style.cursor = 'zoom-in';
    // Keyboard-reachable zoom (2.1.1); the label keeps the illustration's name.
    heroArt.setAttribute('role', 'button');
    heroArt.setAttribute('tabindex', '0');
    heroArt.setAttribute('aria-label', `${animal.name} illustration — open full-size image`);
    const zoomHero = () => openModalFn({ title: animal.name, imgSrc: [animal.artUrl] });
    heroArt.addEventListener('click', zoomHero);
    heroArt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zoomHero(); }
    });
  }
  syncVariantCtas(products);
  window.cartManager?.subscribe(() => syncVariantCtas(products));
}

export async function animalPageInit(slug, { openModal }) {
  const root = document.getElementById('animal-root');
  if (!root || !slug) { renderNotFound(root, slug || ''); return; }

  let payload;
  try {
    const res = await fetch(`${API_BASE}/animals/${encodeURIComponent(slug)}`);
    if (res.status === 404) return renderNotFound(root, slug);
    if (!res.ok) throw new Error(res.statusText);
    payload = await res.json();
  } catch (err) {
    console.error('animal fetch failed:', err);
    return renderError(root);
  }

  const animal = payload.animal;
  const products = (payload.products || []).slice().sort((a,b) => {
    // Order: totes first, then magnets, then everything else
    const order = { tote: 0, magnet: 1, tshirt: 2 };
    return (order[a.productType] ?? 9) - (order[b.productType] ?? 9);
  });

  document.title = `${animal.name} · Kaayko`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', `${animal.name} — ${animal.scientificName}. ${animal.bio ? animal.bio.slice(0, 140) : ''}`);

  // Hero (image + identity + stats) and Story (bio + variants) sit side by side,
  // separated by a vertical hairline. Variants live inside the Story column.
  root.innerHTML = `
    ${renderHero(animal, products)}
    <div class="an-body">
      ${renderStory(animal, products)}
    </div>`;
  bindVariantActions(animal, products, openModal);
}
