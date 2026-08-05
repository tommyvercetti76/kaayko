/**
 * Animal PDP renderer.
 * Fetches /api/animals/<slug> and paints the editorial layout.
 */

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
  root.innerHTML = `
    <section class="animal-empty">
      <h2>Couldn't load this page</h2>
      <p>Something hiccupped on our end.</p>
      <a href="javascript:location.reload()">Try again</a>
    </section>`;
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

function renderHero(animal) {
  // Use the 1600px preview for the visible hero. The full 3600px artUrl is
  // stashed on the wrapper as a data attribute for the click-to-zoom path.
  const heroSrc = animal.artPreviewUrl || animal.artUrl;
  const art = heroSrc
    ? `<img src="${esc(heroSrc)}" alt="${esc(animal.name)} illustration" />`
    : "";
  const artClass = heroSrc ? "animal-hero-art" : "animal-hero-art empty";
  const zoomAttr = heroSrc ? ` data-zoom-full="${esc(animal.artUrl || heroSrc)}"` : "";
  return `
    <section class="animal-hero">
      <div class="${artClass}"${zoomAttr}>${art}</div>
      <div class="animal-hero-text">
        <h1 class="animal-name">${esc(animal.name)}</h1>
        ${animal.scientificName ? `<p class="animal-scientific">${esc(animal.scientificName)}</p>` : ""}
      </div>
      ${renderStats(animal)}
    </section>`;
}

function renderStory(animal, products) {
  if (!animal.bio && !(products || []).length) return "";
  // Story column: bio prose, then variant cards beneath.
  return `
    <section class="animal-story">
      <div class="animal-story-prose">
        <h2>The Story</h2>
        ${animal.bio ? `<p class="animal-bio">${esc(animal.bio)}</p>` : ""}
      </div>
      ${renderVariants(animal, products)}
    </section>`;
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
  const heading = `Wear the ${esc(animal.name.split(" ").pop())}`;
  const cards = products.map(p => `
    <article class="variant-card" data-product-id="${esc(p.productID)}">
      <div class="variant-img" data-zoom>${variantImage(p)}</div>
      <div class="variant-meta">
        <h3 class="variant-title">${esc(p.title)}</h3>
        <span class="variant-price">${variantPriceText(p)}</span>
      </div>
      ${p.description ? `<p class="variant-description">${esc(p.description)}</p>` : ""}
      <button type="button" class="variant-cta" data-add-to-bag>
        <span class="material-icons cta-check" style="display:none">check</span>
        <span class="cta-label">Add to bag</span>
      </button>
    </article>`).join("");
  return `
    <div class="animal-buy">
      <h2>${heading}</h2>
      <div class="animal-variants">${cards}</div>
    </div>`;
}

// Cart-add logic that respects product type — the size/gender picker bug fix.
// T-shirts → open mini-panel (gender + size). Tote/Magnet → add directly.
function addToBagSmart(product) {
  const cm = window.cartManager;
  if (!cm) return false;
  const priceText = typeof product.actualPrice === "number" ? `$${product.actualPrice.toFixed(2)}` : product.price;
  const sizes = product.availableSizes || [];
  const isOneSizeOrNone = sizes.length === 0 || (sizes.length === 1 && /one size/i.test(sizes[0]));

  if (product.productType === "tshirt") {
    // T-shirt → require size + gender via a popup
    return openSizeGenderPopup(product, priceText);
  }

  // Direct add for totes / magnets / one-size / sizeless products
  const item = {
    productId: product.productID,
    title: product.title,
    subtitle: product.description,
    price: priceText,
    imgSrc: product.imgSrc,
    size: isOneSizeOrNone ? (sizes[0] || "One Size") : sizes[0],
    gender: null
  };
  const ok = cm.addItem(item);
  if (!ok && window.showSustainabilityAlert) window.showSustainabilityAlert();
  return ok;
}

function openSizeGenderPopup(product, priceText) {
  // Minimal centered popup for sizing — only used when productType === 'tshirt'
  const overlay = document.createElement("div");
  overlay.className = "filter-overlay active";
  overlay.style.zIndex = 3000;
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
          ${(product.availableSizes && product.availableSizes.length ? product.availableSizes : ["XS","S","M","L","XL","XXL"]).map(s => `<button type="button" class="chip" data-s="${s}">${s}</button>`).join("")}
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
      productId: product.productID, title: product.title, subtitle: product.description,
      price: priceText, imgSrc: product.imgSrc, size: s, gender: g
    });
    if (!ok && window.showSustainabilityAlert) window.showSustainabilityAlert();
    close();
  });
  return true;
}

function syncVariantCtas(products) {
  products.forEach(p => {
    const card = document.querySelector(`.variant-card[data-product-id="${CSS.escape(p.productID)}"]`);
    if (!card) return;
    const inCart = window.cartManager?.hasProduct(p.productID);
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
    const card = document.querySelector(`.variant-card[data-product-id="${CSS.escape(p.productID)}"]`);
    if (!card) return;
    card.querySelector('[data-zoom]').addEventListener('click', () => openModalFn(p));
    card.querySelector('[data-add-to-bag]').addEventListener('click', e => {
      e.stopPropagation();
      addToBagSmart(p);
    });
  });
  // Click the hero art → open the full-res zoom modal.
  const heroArt = document.querySelector('.animal-hero-art[data-zoom-full]');
  if (heroArt && animal.artUrl) {
    heroArt.style.cursor = 'zoom-in';
    heroArt.addEventListener('click', () => {
      openModalFn({ title: animal.name, imgSrc: [animal.artUrl] });
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
    <section class="animal-spread">
      ${renderHero(animal)}
      ${renderStory(animal, products)}
    </section>`;
  bindVariantActions(animal, products, openModal);
}
