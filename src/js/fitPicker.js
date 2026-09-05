/**
 * fitPicker.js — the one fit-and-size control for the whole storefront.
 *
 * Replaces three drifting copies of the same picker (the grid card in
 * kaayko_ui.js, the PDP in product.js, the animal PDP in animal.js). Every
 * decision about "what may this shopper choose, and what do we send to
 * checkout" lives here and nowhere else.
 *
 * THREE RULES THIS FILE EXISTS TO ENFORCE
 *
 * 1. Wire values are not display labels. resolveGender() in
 *    kaayko-api/functions/api/checkout/pricing.js validates `gender` against a
 *    frozen enum (Male/Female/Teen/Child/Infant/Unisex) and rejects the WHOLE
 *    cart on a miss. So each fit carries a `wire` value from that enum plus a
 *    `label` the shopper actually reads. Renaming a label is free; changing a
 *    wire value needs a server deploy.
 *
 * 2. We only offer sizes the SKU stocks. resolveSize() validates the posted
 *    size against the product's `availableSizes`, so a hopeful invented "XL"
 *    fails at the last step of checkout. Sizes come from the product document,
 *    never from a hardcoded run.
 *
 * 3. We only offer a fit we can actually ship. Each fit owns its own size
 *    vocabulary and is offered only when the SKU stocks at least one size from
 *    it. This is why Teen/Child/Infant disappeared: no SKU carries youth or
 *    baby sizes, so the old picker happily took an "Infant, size S" order that
 *    could only ever be fulfilled as an adult S. Stock a "3-6M" and the Baby
 *    fit comes back on its own, with no code change.
 */

import { priceText } from "/js/priceMap.js";

/* ==========================================================================
   Vocabulary
   ========================================================================== */

/**
 * A fit is an audience plus the size vocabulary that audience is sold in.
 * `wire` MUST stay inside ALLOWED_GENDERS in the API's pricing.js.
 */
const FITS = Object.freeze([
  { wire: "Unisex", label: "Unisex",  sizes: ["XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL"] },
  { wire: "Female", label: "Women's", sizes: ["XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL"] },
  { wire: "Teen",   label: "Youth",   sizes: ["YXS", "YS", "YM", "YL", "YXL"] },
  { wire: "Child",  label: "Kids",    sizes: ["2T", "3T", "4T", "5T", "6", "7", "8"] },
  { wire: "Infant", label: "Baby",    sizes: ["NB", "0-3M", "3-6M", "6-12M", "12-18M", "18-24M"] }
]);

/** Older carts hold retired wire values; map them onto a fit we still offer. */
const LEGACY_FIT = Object.freeze({ Male: "Unisex", Men: "Unisex", Women: "Female" });

/**
 * Approximate body chest, in inches, for the standard unisex crew these are
 * printed on. Shown as guidance, not as a garment spec — it is the single
 * biggest cause of sizing returns, so it is worth the eight lines.
 */
const SIZE_GUIDE = Object.freeze({
  XS: "32–34", S: "34–37", M: "38–41", L: "42–45", XL: "46–49", XXL: "50–53", "2XL": "50–53", "3XL": "54–57"
});

const FIT_PREF_KEY = "kaayko.lastFit";
const MAX_UNIQUE_PRODUCTS = 2;

let pickerSeq = 0;

/* ==========================================================================
   Catalogue questions
   ========================================================================== */

const norm = (s) => String(s ?? "").trim();

/** Sizes the SKU actually stocks. "One Size" is not a choice, so it is not one. */
export function stockedSizes(product) {
  return (product?.availableSizes || [])
    .map(norm)
    .filter(Boolean)
    .filter((s) => !/^one\s*size$/i.test(s));
}

/**
 * Apparel gets a fit row; a tote with two sizes does not. Category is the
 * catalogue's own answer, with productType as the fallback for the 9 SKUs
 * whose productType was never filled in.
 */
function isApparel(product) {
  if (/^apparel$/i.test(norm(product?.category))) return true;
  return /^(tshirt|t-shirt|tee|hoodie|sweatshirt)$/i.test(norm(product?.productType));
}

/**
 * Does this product need a choice before it can go in the bag?
 *
 * Deliberately NOT keyed on productType: 9 apparel SKUs ship with an empty
 * productType, and the old `productType === "tshirt"` test silently skipped
 * their picker and added every one of them as the first listed size.
 */
export function needsPicker(product) {
  return stockedSizes(product).length > 1;
}

/** The fits this SKU can actually be shipped in, in catalogue order. */
export function fitsFor(product) {
  if (!isApparel(product)) return [];
  const sizes = stockedSizes(product).map((s) => s.toUpperCase());
  return FITS.filter((f) => f.sizes.some((s) => sizes.includes(s.toUpperCase())));
}

/* ==========================================================================
   Remembered preference
   ========================================================================== */

export function readFitPref() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FIT_PREF_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function saveFitPref(gender, size) {
  try {
    localStorage.setItem(FIT_PREF_KEY, JSON.stringify({ gender, size }));
  } catch (_) { /* private mode / quota — losing a convenience is not an error */ }
}

/**
 * Opening selection: whatever is already in the bag, else the last fit this
 * shopper used, else the first thing we stock. Always returns a valid pair, so
 * "Add to bag" is live the moment the picker opens.
 */
export function defaultSelection(product) {
  const sizes = stockedSizes(product);
  const fits = fitsFor(product);
  const inBag = window.cartManager?.getItem?.(product.id) || null;
  const pref = readFitPref() || {};

  const wanted = [inBag?.gender, LEGACY_FIT[inBag?.gender], pref.gender, LEGACY_FIT[pref.gender]]
    .filter(Boolean)
    .find((w) => fits.some((f) => f.wire === w));

  const wantedSize = [inBag?.size, pref.size]
    .filter(Boolean)
    .find((s) => sizes.some((x) => x.toLowerCase() === String(s).toLowerCase()));

  return {
    gender: wanted || fits[0]?.wire || null,
    size: wantedSize || sizes[0] || "One Size"
  };
}

/* ==========================================================================
   Bag toast
   ========================================================================== */

/**
 * Confirmation with a route to checkout. Sits under the sticky header (never
 * over the footer) and clears itself after a few seconds.
 */
export function showBagToast(message = "Added to bag") {
  let toast = document.getElementById("bag-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "bag-toast";
    toast.className = "bag-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.innerHTML = `
      <span class="bag-toast-msg"></span>
      <a class="bag-toast-cta" href="/cart">Go to bag →</a>
      <button type="button" class="bag-toast-close material-icons" aria-label="Dismiss">close</button>
    `;
    document.body.appendChild(toast);
    toast.querySelector(".bag-toast-close").addEventListener("click", () => toast.classList.remove("visible"));
  }
  toast.querySelector(".bag-toast-msg").textContent = message;
  toast.classList.add("visible");
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove("visible"), 6000);
  return toast;
}

/* ==========================================================================
   Adding to the bag
   ========================================================================== */

/**
 * The bag holds two unique products. Check BEFORE opening a picker so nobody
 * is rejected after choosing a fit and a size.
 * @returns {boolean} true when the cap blocks this product (alert already shown)
 */
export function bagCapReached(product) {
  const cm = window.cartManager;
  if (!cm || cm.hasProduct(product.id)) return false;
  const count = cm.getCount();
  if (count < MAX_UNIQUE_PRODUCTS) return false;
  window.showSustainabilityAlert?.({ attemptedProduct: product.title, cartCount: count });
  return true;
}

/**
 * Put a product in the bag with an explicit selection. The single write path —
 * every surface goes through here so the toast, the remembered fit and the
 * bag cap can never drift apart.
 * @returns {boolean} whether the item made it into the bag
 */
export function addToBag(product, { size, gender } = {}) {
  const cm = window.cartManager;
  if (!cm) return false;
  if (bagCapReached(product)) return false;

  const ok = cm.addItem({
    productId: product.id,
    title: product.title,
    subtitle: product.description,
    price: priceText(product),
    imgSrc: product.imgSrc,
    size: size || stockedSizes(product)[0] || "One Size",
    gender: gender || null
  });

  if (!ok) {
    window.showSustainabilityAlert?.({ attemptedProduct: product.title });
    return false;
  }
  if (gender && size) saveFitPref(gender, size);
  showBagToast(`${product.title} added to bag`);
  return true;
}

/**
 * One-tap path for SKUs with nothing to choose (totes, magnets, prints).
 * A product already in the bag routes to the bag rather than silently
 * re-adding or — as an earlier version did — silently deleting itself.
 */
export function addDirect(product) {
  if (window.cartManager?.hasProduct(product.id)) {
    window.location.href = "/cart";
    return true;
  }
  return addToBag(product, { size: stockedSizes(product)[0] || "One Size", gender: null });
}

/* ==========================================================================
   The control
   ========================================================================== */

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Mutually exclusive chips, done to the ARIA radiogroup pattern: one tab stop
 * for the group, arrow keys move between options, Home/End jump to the ends.
 * @param {HTMLElement} group the [role="radiogroup"] element
 * @param {(value: string) => void} onSelect
 */
function wireRadioGroup(group, onSelect) {
  const radios = () => Array.from(group.querySelectorAll('[role="radio"]'));

  function select(radio, { focus = false } = {}) {
    radios().forEach((r) => {
      const on = r === radio;
      r.setAttribute("aria-checked", String(on));
      r.tabIndex = on ? 0 : -1;
      r.classList.toggle("is-selected", on);
    });
    if (focus) radio.focus();
    onSelect(radio.dataset.value);
  }

  group.addEventListener("click", (e) => {
    const radio = e.target.closest('[role="radio"]');
    if (radio && !radio.hasAttribute("aria-disabled")) select(radio);
  });

  group.addEventListener("keydown", (e) => {
    const all = radios();
    const i = all.indexOf(document.activeElement);
    if (i < 0) return;
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (keys[e.key]) {
      e.preventDefault();
      select(all[(i + keys[e.key] + all.length) % all.length], { focus: true });
    } else if (e.key === "Home") {
      e.preventDefault();
      select(all[0], { focus: true });
    } else if (e.key === "End") {
      e.preventDefault();
      select(all[all.length - 1], { focus: true });
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      select(all[i]);
    }
  });

  return { select };
}

/**
 * Build a fit picker for a product.
 *
 * @param {object} product catalogue product
 * @param {object} [opts]
 * @param {(sel: {size: string, gender: string|null}) => void} [opts.onConfirm]
 *        called when the shopper commits; omit to use the built-in add-to-bag
 * @param {boolean} [opts.showAction] render the confirm button (default true)
 * @returns {{el: HTMLElement, selection: () => object, focusFirst: () => void, refresh: () => void}}
 */
export function createFitPicker(product, { onConfirm, showAction = true } = {}) {
  const uid = ++pickerSeq;
  const sizes = stockedSizes(product);
  const fits = fitsFor(product);
  const el = document.createElement("div");
  el.className = "fitp";

  let sel = defaultSelection(product);

  const fitRow = fits.length > 1 ? `
    <div class="fitp-row">
      <div class="fitp-legend" id="fitp-fit-${uid}">Fit</div>
      <div class="fitp-opts" role="radiogroup" aria-labelledby="fitp-fit-${uid}" data-group="fit">
        ${fits.map((f) => `<button type="button" class="fitp-chip${f.wire === sel.gender ? " is-selected" : ""}" role="radio" aria-checked="${f.wire === sel.gender}" tabindex="${f.wire === sel.gender ? 0 : -1}" data-value="${esc(f.wire)}">${esc(f.label)}</button>`).join("")}
      </div>
    </div>` : "";

  const guideRows = sizes
    .filter((s) => SIZE_GUIDE[s.toUpperCase()])
    .map((s) => `<tr><th scope="row">${esc(s)}</th><td>${SIZE_GUIDE[s.toUpperCase()]}"</td></tr>`)
    .join("");

  el.innerHTML = `
    ${fitRow}
    <div class="fitp-row">
      <div class="fitp-legend" id="fitp-size-${uid}">
        <span>Size</span>
        ${guideRows ? `<button type="button" class="fitp-guide-toggle" aria-expanded="false" aria-controls="fitp-guide-${uid}">Size guide</button>` : ""}
      </div>
      <div class="fitp-opts fitp-sizes" role="radiogroup" aria-labelledby="fitp-size-${uid}" data-group="size">
        ${sizes.map((s) => `<button type="button" class="fitp-box${s === sel.size ? " is-selected" : ""}" role="radio" aria-checked="${s === sel.size}" tabindex="${s === sel.size ? 0 : -1}" data-value="${esc(s)}">${esc(s)}</button>`).join("")}
      </div>
    </div>
    ${guideRows ? `
    <div class="fitp-guide" id="fitp-guide-${uid}" hidden>
      <table>
        <caption>Approximate body chest, in inches. Standard unisex crew.</caption>
        <thead><tr><th scope="col">Size</th><th scope="col">Chest</th></tr></thead>
        <tbody>${guideRows}</tbody>
      </table>
      <p>Between sizes? Take the larger one — these are cut close.</p>
    </div>` : ""}
    ${showAction ? `<div class="fitp-actions"><button type="button" class="fitp-confirm"></button></div>` : ""}
  `;

  const confirmBtn = el.querySelector(".fitp-confirm");

  function syncConfirm() {
    if (!confirmBtn) return;
    const inBag = !!window.cartManager?.hasProduct(product.id);
    const price = priceText(product);
    confirmBtn.textContent = inBag ? "Update bag" : `Add to bag${price ? ` · ${price}` : ""}`;
    confirmBtn.disabled = !sel.size;
  }

  el.querySelectorAll('[role="radiogroup"]').forEach((group) => {
    const key = group.dataset.group === "fit" ? "gender" : "size";
    wireRadioGroup(group, (value) => {
      sel = { ...sel, [key]: value };
      syncConfirm();
    });
  });

  const guideToggle = el.querySelector(".fitp-guide-toggle");
  if (guideToggle) {
    const guide = el.querySelector(".fitp-guide");
    guideToggle.addEventListener("click", () => {
      const open = guideToggle.getAttribute("aria-expanded") === "true";
      guideToggle.setAttribute("aria-expanded", String(!open));
      guide.hidden = open;
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      if (!sel.size) return;
      if (onConfirm) onConfirm({ ...sel });
      else addToBag(product, sel);
    });
  }

  syncConfirm();
  // cartManager.subscribe returns its own unsubscribe; hold onto it so a
  // picker that is rebuilt (every card open) does not leave a listener behind.
  const unsubscribe = window.cartManager?.subscribe?.(syncConfirm) || (() => {});

  return {
    el,
    selection: () => ({ ...sel }),
    focusFirst: () => el.querySelector('[role="radio"][aria-checked="true"], [role="radio"]')?.focus(),
    refresh: () => { sel = defaultSelection(product); syncConfirm(); },
    destroy: () => unsubscribe()
  };
}

/* ==========================================================================
   Expanding-card behaviour
   ========================================================================== */

/** Every picker currently expanded, so one outside click can close them all. */
const openPickers = new Set();

function closeAll(except) {
  openPickers.forEach((p) => { if (p !== except) p.close(); });
}

document.addEventListener("click", (e) => {
  if (openPickers.size === 0) return;
  openPickers.forEach((p) => { if (!p.host.contains(e.target)) p.close(); });
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || openPickers.size === 0) return;
  openPickers.forEach((p) => p.close({ restoreFocus: true }));
});

/**
 * Make a card open its own fit picker in place: the card grows to reveal the
 * choices, and a tap anywhere outside shrinks it back. Nothing overlays the
 * grid, so the options always sit on the product they belong to.
 *
 * @param {object} args
 * @param {HTMLElement} args.host   element that expands (the card)
 * @param {HTMLElement} args.trigger button that opens it
 * @param {object} args.product
 * @returns {{open: Function, close: Function, isOpen: Function}}
 */
export function attachExpandingPicker({ host, trigger, product }) {
  // Slot stays in the DOM at zero height so the open/close transition has
  // something stable to animate; `inert` keeps the collapsed controls out of
  // the tab order and off the accessibility tree.
  const slot = document.createElement("div");
  slot.className = "fitp-slot";
  const inner = document.createElement("div");
  slot.appendChild(inner);
  slot.inert = true;
  host.appendChild(slot);

  let picker = null;
  const controller = { host, open, close, isOpen: () => host.classList.contains("is-picking") };

  function open() {
    if (controller.isOpen()) return;
    if (bagCapReached(product)) return;
    closeAll(controller);

    // Rebuilt on every open: the bag may have changed since last time.
    picker?.destroy();
    inner.replaceChildren();
    picker = createFitPicker(product, {
      onConfirm: (sel) => { if (addToBag(product, sel)) close({ restoreFocus: true }); }
    });
    inner.appendChild(picker.el);

    slot.inert = false;
    host.classList.add("is-picking");
    trigger.setAttribute("aria-expanded", "true");
    openPickers.add(controller);
    picker.focusFirst();
  }

  function close({ restoreFocus = false } = {}) {
    if (!controller.isOpen()) return;
    // Move focus out before `inert` applies, or the browser drops it to <body>.
    if (restoreFocus || slot.contains(document.activeElement)) trigger.focus();
    slot.inert = true;
    host.classList.remove("is-picking");
    trigger.setAttribute("aria-expanded", "false");
    openPickers.delete(controller);
  }

  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");
  trigger.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!needsPicker(product)) { addDirect(product); return; }
    controller.isOpen() ? close({ restoreFocus: true }) : open();
  });

  return controller;
}
