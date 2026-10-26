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

import { priceText, priceCents } from "/js/priceMap.js";
import { createFitPicker, needsPicker, addDirect, isSoldOut } from "/js/fitPicker.js";
import { satireFor } from "/js/store-satire.js";
import { getProduct, getCatalogue, friendlyMessage } from "/js/services/storeApi.js";
import { cartManager } from "/js/cartManager.js";
import { esc } from "/js/kit.js";
import { labelForType } from "/js/productTypes.js";
import { pickSuggestions } from "/js/suggest.js";
import { mountProductGrid } from "/js/kaayko_ui.js";
import { show as showToast } from "/js/components/Toast.js";

/** A web address in already-escaped story text becomes a link; it used to print as
 *  a bare URL (the India Post line on every stamp piece). Trailing punctuation stays text. */
const linkify = (escaped) => escaped.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g,
  (url) => `<a href="${url}" target="_blank" rel="noopener">${url.replace(/^https?:\/\/(www\.)?/, "")}</a>`);

// It borrowed the animal page's `.animal-empty`, which only that page styles, so a
// mistyped product link showed bare browser text and a blue link (25 Oct 2026).
function renderError(root, msg) {
  document.title = `${msg} · Kaayko`;
  root.innerHTML = `
    <section class="pdp-missing">
      <h1>${esc(msg)}</h1>
      <p>It may have sold out or moved. Everything we make is in the store.</p>
      <a class="pdp-missing-cta" href="/store">Browse the store</a>
    </section>`;
}

/* ── What search engines read ────────────────────────────────────
   Every product page used to carry the same description, no canonical
   address (kaayko.com and kaay.store serve the same page twice) and no
   product data. Google runs this script; a social preview does not, so
   share cards stay the store's own until pages are rendered server-side. */
const CANONICAL_ORIGIN = 'https://kaayko.com';

function describe(product, image) {
  const url = `${CANONICAL_ORIGIN}/store/p/${encodeURIComponent(product.id)}`;
  const text = String(product.description || '').replace(/\s+/g, ' ').trim();
  const summary = text.length > 155 ? `${text.slice(0, 152).replace(/\s+\S*$/, '')}…` : text;
  const head = document.head;
  const meta = (attr, key, value) => {
    if (!value) return;
    let m = head.querySelector(`meta[${attr}="${key}"]`);
    if (!m) { m = document.createElement('meta'); m.setAttribute(attr, key); head.appendChild(m); }
    m.setAttribute('content', value);
  };
  meta('name', 'description', summary);
  meta('property', 'og:title', `${product.title} · Kaayko`);
  meta('property', 'og:description', summary);
  meta('property', 'og:url', url);
  if (image) meta('property', 'og:image', new URL(image, location.href).href);

  let canonical = head.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; head.appendChild(canonical); }
  canonical.href = url;

  const cents = priceCents(product);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    sku: product.id,
    description: text || undefined,
    image: (product.previewSrc || product.imgSrc || []).slice(0, 3).map((u) => new URL(u, location.href).href),
    brand: { '@type': 'Brand', name: 'Kaayko' },
    offers: Number.isFinite(cents) && cents > 0 ? {
      '@type': 'Offer',
      url,
      priceCurrency: 'USD',
      price: (cents / 100).toFixed(2),
      itemCondition: 'https://schema.org/NewCondition',
      availability: isSoldOut(product) ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock'
    } : undefined
  };
  let ld = head.querySelector('script[data-pdp-ld]');
  if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.dataset.pdpLd = ''; head.appendChild(ld); }
  ld.textContent = JSON.stringify(data);
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
  describe(product, previews[0]);

  const copy = satireFor(product);
  const price = priceText(product);

  // Thumbnails are real buttons so keyboard users can reach every image
  // (2.1.1). The button carries the name; the picture inside is decorative.
  // a mug, magnet or bottle gets its "3D" thumb in the first paint, waiting, so the row
  // never reflows when the 3D view arrives (it shifted the page 0.06 on a phone)
  const has3d = INSPECT_TYPES.has(product.productType);
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
        ${previews.length > 1 || has3d ? `<div class="product-thumbs">${has3d ? THUMB_3D_PENDING : ""}${thumbs}</div>` : ""}
      </div>

      <div class="pdp-buy">
        <p class="pdp-eyebrow">${esc(eyebrowFor(product))}</p>
        <h1 class="pdp-title">${esc(product.title)}</h1>
        ${copy.hook ? `<p class="pdp-hook">${esc(copy.hook)}</p>` : ""}
        <p class="pdp-price">${esc(price)}</p>
        <div class="pdp-picker" id="pdp-picker"></div>
        <p class="pdp-reassure">Printed to order, on its way within 10 business days · Free US shipping · <a href="/legal/returns">30-day returns</a></p>
        <button type="button" class="pdp-share" id="pdp-share">Share this piece</button>
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
  const thumbEls = [...root.querySelectorAll('.product-thumb:not(.product-thumb-3d)')];
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
  // Share the page as the shopper sees it: the phone's own share sheet where
  // there is one, else the address on the clipboard.
  document.getElementById('pdp-share')?.addEventListener('click', async () => {
    const url = location.origin + location.pathname;
    try {
      if (navigator.share) { await navigator.share({ title: `${product.title} · Kaayko`, url }); return; }
      await navigator.clipboard.writeText(url);
      showToast('Link copied.', { kind: 'good' });
    } catch (err) {
      if (err && err.name === 'AbortError') return;      // the shopper closed the sheet
      showToast('Could not share from this browser. Copy the address bar instead.', { kind: 'notice' });
    }
  });

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
const THUMB_3D_PENDING = '<button type="button" class="product-thumb product-thumb-3d is-pending" aria-pressed="false" disabled aria-label="3D view loading"><span aria-hidden="true">3D</span></button>';

function mountInspectFrame(product, root, thumbEls) {
  if (!INSPECT_TYPES.has(product.productType)) return null;
  const stage = root.querySelector('.pdp-stage');
  let layer = null, view = null;
  const thumb = root.querySelector('.product-thumb-3d');
  // no 3D after all (not in the index, or no WebGL): the waiting thumb goes, and with a
  // single photograph the row it held open goes too
  const drop = () => {
    const row = thumb?.parentElement;
    thumb?.remove();
    if (row && row.querySelectorAll('.product-thumb').length <= 1) row.remove();
  };

  const pickedShape = () => {
    const v = root.querySelector('#pdp-picker .fitp-sizes [aria-checked="true"]')?.dataset.value || '';
    return /square/i.test(v) ? 'square' : 'round';
  };

  // The layer stays laid out the whole time and only fades (CSS .is-shown): the
  // canvas keeps its size, so choosing 3D is a crossfade with no blank frame.
  function show() {
    if (!layer) return;
    layer.classList.add('is-shown');
    stage.classList.add('is-3d');
    thumbEls.forEach((x) => { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); });
    thumb.classList.add('active'); thumb.setAttribute('aria-pressed', 'true');
  }
  function hide() {
    if (!layer) return;
    layer.classList.remove('is-shown');
    stage.classList.remove('is-3d');
    thumb.classList.remove('active'); thumb.setAttribute('aria-pressed', 'false');
  }

  (async () => {
    let entry;
    try {
      const res = await fetch('/js/inspect/index.json');
      entry = res.ok ? (await res.json())[product.id] : null;
    } catch (_) { entry = null; }
    if (!entry) { drop(); return; }
    const { mountInspect } = await import('/js/inspect/inspect3d.js');

    // laid out from the start and transparent until it is drawn and chosen (CSS
    // .is-ready.is-shown): built while hidden it rendered at a stand-in size, and
    // the resize on showing cleared it to a blank stage for a frame
    layer = document.createElement('div');
    layer.className = 'pdp-inspect';
    layer.innerHTML = `<p class="pdp-inspect-hint">${entry.kind === 'magnet' ? 'Drag to tilt it in the light' : 'Drag to turn it any way'}</p>`;
    stage.appendChild(layer);
    view = await mountInspect(layer, {
      kind: entry.kind, wrap: entry.wrap, faces: { round: entry.round, square: entry.square },
      shape: pickedShape(), title: product.title,
    });
    if (!view) { layer.remove(); layer = null; drop(); return; }   // no WebGL: photographs only
    layer.addEventListener('pointerdown', () => layer.classList.add('was-held'), { once: true });

    thumb.disabled = false;
    thumb.classList.remove('is-pending');
    thumb.setAttribute('aria-label', `Hold and turn the ${entry.kind} in 3D`);
    // 3D waits to be asked for. Switching to it on its own swapped the photo the
    // shopper had just tapped for a smaller render on another ground (25 Oct 2026).
    thumb.addEventListener('click', show);

    if (entry.kind === 'magnet') {
      const picker = root.querySelector('#pdp-picker');
      new MutationObserver(() => view.setShape(pickedShape()))
        .observe(picker, { subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
    }
  })().catch((err) => { console.warn('3D view unavailable:', err); drop(); });

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
