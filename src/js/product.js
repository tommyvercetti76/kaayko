/**
 * THE product page — every type, one layout. (/animals/<slug> forwards here.)
 *
 * Three things live here and nowhere else on this route:
 *   - the gallery (main image + thumbs, click to zoom), and for a mug, a magnet or a bottle a
 *     3D frame you can hold and turn over (js/inspect/inspect3d.js)
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
import { getProduct, getCatalogue, friendlyMessage } from "/js/services/storeApi.js";
import { cartManager } from "/js/cartManager.js";
import { esc } from "/js/kit.js";
import { labelForType } from "/js/productTypes.js";
import { pickSuggestions } from "/js/suggest.js";
import { mountProductGrid } from "/js/kaayko_ui.js";

/** A web address in already-escaped story text becomes a link; it used to print as
 *  a bare URL (the India Post line on every stamp piece). Trailing punctuation stays text. */
const linkify = (escaped) => escaped.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g,
  (url) => `<a href="${url}" target="_blank" rel="noopener">${url.replace(/^https?:\/\/(www\.)?/, "")}</a>`);

function renderError(root, msg) {
  root.innerHTML = `
    <section class="animal-empty">
      <h2>${esc(msg)}</h2>
      <a href="/store">← Browse the store</a>
    </section>`;
}

/** "Originals · T-Shirt" — theme first, then what the thing physically is (registry name). */
function eyebrowFor(product) {
  const type = labelForType(product.productType, { singular: true })
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
        <div class="pdp-stage">
          <div class="product-gallery-main pdp-main" id="pg-main" role="button" tabindex="0" aria-label="${esc(product.title)} — open full-size image">
            <img id="pg-main-img" src="${esc(previews[0])}" alt="${esc(product.title)}" />
          </div>
        </div>
        ${previews.length > 1 ? `<div class="product-thumbs">${thumbs}</div>` : ""}
      </div>

      <div class="pdp-buy">
        <p class="pdp-eyebrow">${esc(eyebrowFor(product))}</p>
        <h1 class="pdp-title">${esc(product.title)}</h1>
        ${copy.hook ? `<p class="pdp-hook">${esc(copy.hook)}</p>` : ""}
        <p class="pdp-price">${esc(price)}</p>
        <div class="pdp-picker" id="pdp-picker"></div>
        <p class="pdp-reassure">Printed to order · Five pieces to a bag · <a href="/legal/returns">30-day returns</a></p>
      </div>

      <aside class="pdp-file" data-voice="${esc(copy.voice)}">
        <h2 class="pdp-file-head">What inspired this piece</h2>
        <p class="pdp-story">${linkify(esc(copy.story))}</p>
        <dl class="pdp-rows">${rows}</dl>
        ${copy.atRisk ? `<p class="pdp-flag">On the IUCN Red List. We print them while they are still here.</p>` : ""}
      </aside>
    </article>`;

  // ── Gallery ──────────────────────────────────────────────
  // One place sets the frame: thumbs, a swipe on the picture, and the arrow keys
  // all go through it, so the active thumb can never disagree with the image.
  const mainImg = document.getElementById('pg-main-img');
  const thumbEls = [...root.querySelectorAll('.product-thumb')];
  let frame = 0;
  function setFrame(i) {
    const n = previews.length;
    frame = ((i % n) + n) % n;
    mainImg.src = previews[frame];
    thumbEls.forEach((x, k) => {
      x.classList.toggle('active', k === frame);
      x.setAttribute('aria-pressed', k === frame ? 'true' : 'false');
    });
    inspect?.hide();
  }
  thumbEls.forEach(t => t.addEventListener('click', () => setFrame(parseInt(t.dataset.idx, 10))));
  const inspect = mountInspectFrame(product, root, thumbEls);

  // Zoom on click, and on Enter/Space since the wrapper acts as a button.
  const main = document.getElementById('pg-main');
  let swiped = false;
  main.addEventListener('click', () => { if (swiped) { swiped = false; return; } openModalFn(product); });
  main.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModalFn(product); }
    if (previews.length > 1 && e.key === 'ArrowRight') { e.preventDefault(); setFrame(frame + 1); }
    if (previews.length > 1 && e.key === 'ArrowLeft') { e.preventDefault(); setFrame(frame - 1); }
  });

  // Swipe on the picture. Axis-locked like the store cards: a mostly-horizontal
  // drag of 40px changes the frame and swallows the click that follows it; a
  // vertical one is the page scrolling and is left alone.
  if (previews.length > 1) {
    let x0 = 0, y0 = 0, axis = null, active = false;
    main.style.touchAction = 'pan-y';
    main.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      x0 = e.clientX; y0 = e.clientY; axis = null; active = true;
    });
    main.addEventListener('pointermove', (e) => {
      if (!active || axis) return;
      const dx = Math.abs(e.clientX - x0), dy = Math.abs(e.clientY - y0);
      if (dx > 8 || dy > 8) axis = dx > dy ? 'x' : 'y';
    });
    const end = (e) => {
      if (!active) return;
      active = false;
      if (axis !== 'x') return;
      const dx = e.clientX - x0;
      if (Math.abs(dx) < 40) return;
      swiped = true;
      setFrame(frame + (dx < 0 ? 1 : -1));
    };
    main.addEventListener('pointerup', end);
    main.addEventListener('pointercancel', () => { active = false; });
    mainImg.draggable = false;
  }

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
    const inBag = !!cartManager.hasProduct(product.id);
    cta.textContent = inBag ? 'In your bag · View bag' : `Add to bag${price ? ` · ${price}` : ''}`;
  };
  cta.addEventListener('click', () => addDirect(product));
  syncCta();
  cartManager.subscribe(syncCta);
  slot.appendChild(cta);
}

/* ── 3D ───────────────────────────────────────────────────────
   A mug, a magnet or a bottle with textures in /js/inspect/index.json gets a frame you can
   hold: a "3D" thumb first in the row, and a layer over the photo frame (a sibling,
   so the photo's own zoom and swipe never see the stage's drags). Nothing loads —
   not the index, not three.js — for any other product, and if WebGL is missing the
   thumb never appears. The magnet's Round / Square choice turns the stage's shape. */
const INSPECT_TYPES = new Set(['mug', 'magnet', 'bottle']);

function mountInspectFrame(product, root, thumbEls) {
  if (!INSPECT_TYPES.has(product.productType)) return null;
  const stage = root.querySelector('.pdp-stage');
  let layer = null, view = null, thumb = null;

  const pickedShape = () => {
    const v = root.querySelector('#pdp-picker .fitp-sizes [aria-checked="true"]')?.dataset.value || '';
    return /square/i.test(v) ? 'square' : 'round';
  };

  function show() {
    if (!layer) return;
    layer.hidden = false;
    stage.classList.add('is-3d');
    thumbEls.forEach((x) => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
    thumb.classList.add('active'); thumb.setAttribute('aria-pressed', 'true');
  }
  function hide() {
    if (!layer) return;
    layer.hidden = true;
    stage.classList.remove('is-3d');
    thumb.classList.remove('active'); thumb.setAttribute('aria-pressed', 'false');
  }

  (async () => {
    let entry;
    try {
      const res = await fetch('/js/inspect/index.json');
      entry = res.ok ? (await res.json())[product.id] : null;
    } catch (_) { entry = null; }
    if (!entry) return;
    const { mountInspect } = await import('/js/inspect/inspect3d.js');

    layer = document.createElement('div');
    layer.className = 'pdp-inspect';
    layer.hidden = true;
    layer.innerHTML = `<p class="pdp-inspect-hint">${entry.kind === 'magnet' ? 'Drag to tilt it in the light' : 'Drag to turn it any way'}</p>`;
    stage.appendChild(layer);
    view = await mountInspect(layer, {
      kind: entry.kind, wrap: entry.wrap, faces: { round: entry.round, square: entry.square },
      shape: pickedShape(), title: product.title,
    });
    if (!view) { layer.remove(); layer = null; return; }   // no WebGL: photographs only
    layer.addEventListener('pointerdown', () => layer.classList.add('was-held'), { once: true });

    thumb = document.createElement('button');
    thumb.type = 'button';
    thumb.className = 'product-thumb product-thumb-3d';
    thumb.setAttribute('aria-pressed', 'false');
    thumb.setAttribute('aria-label', `Hold and turn the ${entry.kind} in 3D`);
    thumb.innerHTML = '<span aria-hidden="true">3D</span>';
    thumb.addEventListener('click', show);
    let row = root.querySelector('.product-thumbs');
    if (!row) {                                   // one photo: the row did not exist
      row = document.createElement('div');
      row.className = 'product-thumbs';
      root.querySelector('.pdp-gallery').appendChild(row);
      thumbEls.length || row.appendChild(photoThumb());
    }
    row.prepend(thumb);
    show();

    if (entry.kind === 'magnet') {
      const picker = root.querySelector('#pdp-picker');
      new MutationObserver(() => view.setShape(pickedShape()))
        .observe(picker, { subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
    }
  })().catch((err) => console.warn('3D view unavailable:', err));

  // with a single photograph there are no thumbs to go back by; give it one
  function photoThumb() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'product-thumb';
    b.setAttribute('aria-label', 'Show the photograph');
    b.innerHTML = `<img src="${esc(root.querySelector('#pg-main-img').src)}" alt="" />`;
    b.addEventListener('click', () => { hide(); b.classList.add('active'); });
    thumbEls.push(b);
    return b;
  }

  return { hide };
}

/* ── You may also like ───────────────────────────────────────
   Under every product: the same animal in its other forms, then the same part of the
   world (or theme), then the same kind of thing (js/suggest.js), drawn with the store's
   own cards. Loaded after the product, so it never holds the page up; if the catalogue
   cannot be reached the section simply does not appear. */
async function mountSuggestions(product, root) {
  let items;
  try { items = (await getCatalogue({ timeoutMs: 10000 })).products; } catch (_) { return; }
  const picks = pickSuggestions(product, items, 8);
  if (!picks.length) return;
  const section = document.createElement('section');
  section.className = 'pdp-suggest';
  section.setAttribute('aria-labelledby', 'pdp-suggest-head');
  section.innerHTML = '<h2 class="pdp-suggest-head" id="pdp-suggest-head">You may also like</h2>';
  root.appendChild(section);
  mountProductGrid(section, picks);
}

export async function productPageInit(productID, { openModal }) {
  const root = document.getElementById('product-root');
  if (!root || !productID) return renderError(root, "Product not found");

  try {
    const product = await getProduct(productID);
    renderProduct(product, openModal);
    mountSuggestions(product, root);
  } catch (err) {
    if (err?.status === 404) return renderError(root, "Product not found");
    console.error('product fetch failed:', err);
    renderError(root, friendlyMessage(err, "Couldn't load this product"));
  }
}
