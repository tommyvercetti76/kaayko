/**
 * Product detail page for SKUs without an animal page.
 *
 * Three things live here and nowhere else on this route:
 *   - the gallery (main image + thumbs, click to zoom)
 *   - the buy block, which mounts the shared fit picker from /js/fitPicker.js
 *     directly beside the product rather than in a modal over it
 *   - "the file": the satirical dossier (or, for wildlife pieces, the field
 *     note) supplied by /js/store-satire.js
 *
 * The main image keeps the class `product-gallery-main` because
 * css/pdp-motion.css names it for the shared-element transition from the grid.
 */

import { priceText } from "/js/priceMap.js";
import { createFitPicker, needsPicker, addDirect, isSoldOut } from "/js/fitPicker.js";
import { satireFor } from "/js/store-satire.js";

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

/** "Originals · T-Shirt" — theme first, then what the thing physically is. */
const TYPE_LABEL = { tshirt: "T-Shirt", tote: "Tote", magnet: "Magnet", print: "Print", poster: "Poster", sticker: "Sticker", mug: "Mug", cap: "Cap" };

function eyebrowFor(product) {
  const type = TYPE_LABEL[String(product.productType || "").toLowerCase()]
    || (String(product.category || "").toLowerCase() === "apparel" ? "T-Shirt" : "");
  return [product.theme, type].filter(Boolean).join(" · ") || "Kaayko";
}

function renderProduct(product, openModalFn) {
  const root = document.getElementById('product-root');
  if (!product.imgSrc?.length) {
    renderError(root, "No images yet for this product");
    return;
  }

  document.title = `${product.title} · Kaayko`;

  // Preview tier for thumbnails and the main display; zoom opens full res.
  const previews = (product.previewSrc && product.previewSrc.length === product.imgSrc.length)
    ? product.previewSrc
    : product.imgSrc;

  const copy = satireFor(product);
  const price = priceText(product);

  // Thumbnails are real buttons so keyboard users can reach every image
  // (2.1.1). The button carries the name; the picture inside is decorative.
  const thumbs = previews.map((url, i) => `
    <button type="button" class="product-thumb${i === 0 ? ' active' : ''}" data-idx="${i}" aria-label="Show image ${i + 1} of ${previews.length}" aria-pressed="${i === 0}">
      <img src="${esc(url)}" alt="" loading="lazy" />
    </button>`).join("");

  const rows = copy.rows.map(([label, value]) => `
    <div class="pdp-row">
      <dt>${esc(label)}</dt>
      <dd>${esc(value)}</dd>
    </div>`).join("");

  root.innerHTML = `
    <article class="pdp">
      <div class="pdp-gallery">
        <div class="product-gallery-main pdp-main" id="pg-main" role="button" tabindex="0" aria-label="${esc(product.title)} — open full-size image">
          <img id="pg-main-img" src="${esc(previews[0])}" alt="${esc(product.title)}" />
        </div>
        ${previews.length > 1 ? `<div class="product-thumbs">${thumbs}</div>` : ""}
      </div>

      <div class="pdp-buy">
        <p class="pdp-eyebrow">${esc(eyebrowFor(product))}</p>
        <h1 class="pdp-title">${esc(product.title)}</h1>
        ${copy.hook ? `<p class="pdp-hook">${esc(copy.hook)}</p>` : ""}
        <p class="pdp-price">${esc(price)}</p>
        <div class="pdp-picker" id="pdp-picker"></div>
        <p class="pdp-reassure">Printed to order · <a href="/legal/returns">Free returns within 30 days</a></p>
      </div>

      <aside class="pdp-file" data-voice="${esc(copy.voice)}">
        <h2 class="pdp-file-head">${copy.voice === "field" ? "Field note" : "The file"}</h2>
        <p class="pdp-story">${esc(copy.story)}</p>
        <dl class="pdp-rows">${rows}</dl>
        ${copy.atRisk ? `<p class="pdp-flag">On the IUCN Red List. We draw them while they are still here.</p>` : ""}
      </aside>
    </article>`;

  // ── Gallery ──────────────────────────────────────────────
  root.querySelectorAll('.product-thumb').forEach(t => {
    t.addEventListener('click', () => {
      root.querySelectorAll('.product-thumb').forEach(x => {
        x.classList.remove('active');
        x.setAttribute('aria-pressed', 'false');
      });
      t.classList.add('active');
      t.setAttribute('aria-pressed', 'true');
      document.getElementById('pg-main-img').src = previews[parseInt(t.dataset.idx, 10)];
    });
  });

  // Zoom on click, and on Enter/Space since the wrapper acts as a button.
  const main = document.getElementById('pg-main');
  main.addEventListener('click', () => openModalFn(product));
  main.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModalFn(product); }
  });

  // ── Buy ──────────────────────────────────────────────────
  // Sizes belong next to the thing being bought, not behind a modal, so the
  // picker is rendered inline and open. Its own confirm button is the CTA.
  const slot = document.getElementById('pdp-picker');

  // Sold out replaces the whole buy control — offering a size for something we
  // cannot ship is the wrong kind of helpful.
  if (isSoldOut(product)) {
    const note = document.createElement('p');
    note.className = 'pdp-sold-out';
    note.textContent = 'Sold out';
    slot.appendChild(note);
    return;
  }

  if (needsPicker(product)) {
    slot.appendChild(createFitPicker(product).el);
    return;
  }

  // Nothing to choose: one button, and it says what it will do.
  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'fitp-confirm pdp-single-cta';
  const syncCta = () => {
    const inBag = !!window.cartManager?.hasProduct(product.id);
    cta.textContent = inBag ? 'In your bag · View bag' : `Add to bag${price ? ` · ${price}` : ''}`;
  };
  cta.addEventListener('click', () => addDirect(product));
  syncCta();
  window.cartManager?.subscribe?.(syncCta);
  slot.appendChild(cta);
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
