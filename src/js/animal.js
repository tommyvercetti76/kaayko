/**
 * Animal PDP renderer.
 * Fetches /api/animals/<slug> and paints the editorial layout.
 */

import { priceText } from "/js/priceMap.js";
import { attachExpandingPicker } from "/js/fitPicker.js";
import { getAnimal } from "/js/services/storeApi.js";
import { cartManager } from "/js/cartManager.js";
import { esc } from "/js/kit.js";
import { typeRank } from "/js/productTypes.js";

const IUCN_SEVERITY = {
  "critically endangered": "critical",
  "endangered": "endangered",
  "vulnerable": "vulnerable",
  "near threatened": "vulnerable",
  "least concern": "low",
  "data deficient": "low"
};

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
        <span class="variant-price">${esc(priceText(p))}</span>
        <button type="button" class="variant-cta" data-add-to-bag>
          <span class="material-icons cta-check" style="display:none" aria-hidden="true">check</span>
          <span class="cta-label">Add to bag</span>
        </button>
      </div>
    </article>`;
}

/** The photographs of the piece for sale, preview tier. */
function heroFrames(products) {
  const p = (Array.isArray(products) ? products : [])[0];
  if (!p) return [];
  return ((p.previewSrc && p.previewSrc.length ? p.previewSrc : p.imgSrc) || []).filter(Boolean);
}

function renderHero(animal, products) {
  // The hero is the piece for sale, photographed — every frame of it, swipeable.
  const frames = heroFrames(products);
  const kind = frames.length ? "is-product" : "is-empty";
  const alt = `${esc(animal.name)} on a Kaayko piece`;
  const dots = frames.length > 1 ? `
        <div class="an-dots" role="tablist" aria-label="Photographs">${frames.map((_, i) => `
          <button type="button" class="an-dot${i === 0 ? " is-on" : ""}" role="tab" aria-selected="${i === 0}" aria-label="Photo ${i + 1} of ${frames.length}" data-frame="${i}"></button>`).join("")}
        </div>` : "";

  return `
    <header class="an-hero ${kind}">
      <figure class="an-figure">
        <div class="an-plate" aria-hidden="true"></div>
        <div class="an-art" data-gallery role="button" tabindex="0" aria-label="${alt} — open full-size image">
          ${frames.length ? `<img src="${esc(frames[0])}" alt="${alt}" fetchpriority="high" draggable="false" />` : ""}
        </div>
        ${dots}
      </figure>

      <div class="an-panel">
        ${animal.iucnStatus ? `<p class="an-eyebrow" data-severity="${esc(String(animal.iucnStatus).toLowerCase().split(" ")[0])}">${esc(animal.iucnStatus)}</p>` : ""}
        <h1 class="an-name">${esc(animal.name)}</h1>
        ${animal.scientificName ? `<p class="an-scientific">${esc(animal.scientificName)}</p>` : ""}
        ${heroBuy(products[0])}
      </div>
    </header>`;
}

/** Swipe, dots and arrow keys on the hero; a tap opens the zoom. */
function bindHeroGallery(products, openModalFn) {
  const art = document.querySelector('.an-art[data-gallery]');
  const img = art && art.querySelector('img');
  const frames = heroFrames(products);
  if (!art || !img || !frames.length) return;
  const dots = [...document.querySelectorAll('.an-dot')];
  let frame = 0, swiped = false;
  const setFrame = (i) => {
    const n = frames.length; frame = ((i % n) + n) % n;
    img.src = frames[frame];
    dots.forEach((d, k) => { d.classList.toggle('is-on', k === frame); d.setAttribute('aria-selected', k === frame ? 'true' : 'false'); });
  };
  dots.forEach(d => d.addEventListener('click', (e) => { e.stopPropagation(); setFrame(parseInt(d.dataset.frame, 10)); }));
  art.addEventListener('click', () => { if (swiped) { swiped = false; return; } openModalFn(products[0]); });
  art.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModalFn(products[0]); }
    if (e.key === 'ArrowRight') { e.preventDefault(); setFrame(frame + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setFrame(frame - 1); }
  });
  if (frames.length < 2) return;
  let x0 = 0, y0 = 0, axis = null, active = false;
  art.style.touchAction = 'pan-y';
  art.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; x0 = e.clientX; y0 = e.clientY; axis = null; active = true; });
  art.addEventListener('pointermove', (e) => {
    if (!active || axis) return;
    const dx = Math.abs(e.clientX - x0), dy = Math.abs(e.clientY - y0);
    if (dx > 8 || dy > 8) axis = dx > dy ? 'x' : 'y';
  });
  art.addEventListener('pointerup', (e) => {
    if (!active) return; active = false;
    if (axis !== 'x') return;
    const dx = e.clientX - x0;
    if (Math.abs(dx) < 40) return;
    swiped = true; setFrame(frame + (dx < 0 ? 1 : -1));
  });
  art.addEventListener('pointercancel', () => { active = false; });
}

function renderStory(animal, products) {
  // No prose here. The animal bios in Firestore were generated text, not writing the
  // owner had approved, and the hero repeated their first sentence — so the page
  // said the same thing twice and neither time was true. Facts (Field Notes) and
  // the other pieces remain; the bio comes back when there is one worth printing.
  const stats = renderStats(animal);
  const rest = (products || []).slice(1);
  if (!stats && !rest.length) return "";

  return `
    ${stats ? `<section class="an-facts"><h2 class="an-kicker">Field Notes</h2>${stats}</section>` : ""}
    ${renderVariants(animal, rest)}`;
}

function variantImage(p) {
  // Prefer preview tier for the variant card thumbnail.
  const src = (p.previewSrc && p.previewSrc[0]) || (p.imgSrc && p.imgSrc[0]) || "";
  return src ? `<img src="${esc(src)}" alt="${esc(p.title)}" loading="lazy" />` : "";
}

function renderVariants(animal, products) {
  if (!products.length) return "";
  const heading = `More ${esc(animal.name.split(" ").pop())} pieces`;
  const cards = products.map(p => `
    <article class="variant-card" data-product-id="${esc(p.id)}">
      <div class="variant-img" data-zoom role="button" tabindex="0" aria-label="${esc(p.title)} — open full-size image">${variantImage(p)}</div>
      <div class="variant-meta">
        <h3 class="variant-title">${esc(p.title)}</h3>
        <span class="variant-price">${esc(priceText(p))}</span>
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

function syncVariantCtas(products) {
  products.forEach(p => {
    // Cards are keyed on the Firestore doc id — the same id addItem() stores.
    const card = document.querySelector(`.variant-card[data-product-id="${CSS.escape(p.id)}"]`);
    if (!card) return;
    const inCart = cartManager.hasProduct(p.id);
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
    attachExpandingPicker({
      host: card,
      trigger: card.querySelector('[data-add-to-bag]'),
      product: p
    });
  });
  bindHeroGallery(products, openModalFn);

  syncVariantCtas(products);
  cartManager.subscribe(() => syncVariantCtas(products));
}

export async function animalPageInit(slug, { openModal }) {
  // Since 13 Sep 2026 there is ONE product page. This route only forwards an old
  // link or a printed QR code to the piece it was about; nothing is rendered here.
  void openModal;
  const root = document.getElementById('animal-root');
  if (!root || !slug) { renderNotFound(root, slug || ''); return; }
  let payload;
  try {
    payload = await getAnimal(slug);
  } catch (err) {
    if (err?.status === 404) return renderNotFound(root, slug);
    console.error('animal fetch failed:', err);
    return renderError(root);
  }
  const products = (payload.products || []).slice().sort((a, b) => typeRank(a.productType) - typeRank(b.productType));
  if (!products[0]?.id) return renderNotFound(root, slug);
  location.replace(`/store/p/${encodeURIComponent(products[0].id)}`);
}
