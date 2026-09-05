// File: scripts/kaayko_ui.js
/**
 * Manages Kaayko Store page UI:
 *  1) Carousel rendering & swipe
 *  2) Image-zoom modal + navigation
 *  3) Voting (♥ button)
 *  4) Buy button (fit picker lives in fitPicker.js)
 *
 * Updated: now skips any item where `isAvailable !== true`
 */

import { voteOnProduct } from "./kaayko_apiClient.js";
import { attachExpandingPicker, needsPicker, isSoldOut } from "/js/fitPicker.js";

// Cloud Function image proxy base - auto-detect environment
const IMAGE_PROXY_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `${window.location.origin}/api/images`  // Local Firebase emulator
  : "https://api-vwcc5j4qda-uc.a.run.app/images";  // Production

// Price symbol → dollar amount mapping (single source of truth)
import { PRICE_MAP } from "/js/priceMap.js";

// Product type → section heading. Determines render order on the store page.
// Unknown / missing productType lands in the "Other" bucket at the end.
const PRODUCT_TYPE_SECTIONS = [
  { type: "tote",    label: "Totes" },
  { type: "magnet",  label: "Magnets" },
  { type: "tshirt",  label: "T-Shirts" },
  { type: "print",   label: "Prints" },
  { type: "poster",  label: "Posters" },
  { type: "sticker", label: "Stickers" },
  { type: "mug",     label: "Mugs" },
  { type: "cap",     label: "Caps" }
];
const OTHER_SECTION = { type: "other", label: "Other" };

// A product is "new" if it was created in the last NEW_WINDOW_DAYS days.
const NEW_WINDOW_DAYS = 14;
const NEW_WINDOW_MS = NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function getCreatedAtMs(item) {
  if (!item.createdAt) return 0;
  const t = new Date(item.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isNew(item) {
  const created = getCreatedAtMs(item);
  return created > 0 && (Date.now() - created) < NEW_WINDOW_MS;
}


// Screen-reader announcement for the product grid. The grid is rebuilt
// wholesale on every filter, so it must NOT be a live region (that would read
// every card); the one-line #carousel-status region carries the result.
function announceProductCount(n) {
  const status = document.getElementById("carousel-status");
  if (!status) return;
  status.textContent = `${n} product${n === 1 ? "" : "s"} shown`;
}

/* ==========================================================================
   1) Carousel Rendering & Swipe
   ========================================================================== */
/**
 * Renders the product carousel into the #carousel element,
 * skipping any product where `isAvailable` is explicitly `false`.
 *
 * @param {Array<Object>} items – array of product objects, each with an `isAvailable` boolean
 */
const COLLAPSED_SECTIONS_KEY = "kaayko.collapsedSections";

function getCollapsedSections() {
  try {
    const raw = localStorage.getItem(COLLAPSED_SECTIONS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (_) {
    return new Set();
  }
}

function persistCollapsedSections(set) {
  try {
    localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify([...set]));
  } catch (_) { /* localStorage full / unavailable; non-fatal */ }
}

export function populateCarousel(items) {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;

  carousel.innerHTML = "";

  // Newest items first within each section. Items without a createdAt fall to the end.
  const visibleItems = items
    .filter(item => item.isAvailable !== false)
    .slice()
    .sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a));

  announceProductCount(visibleItems.length);

  // Single-card deep-link mode: skip section UI entirely.
  if (carousel.classList.contains("single-card") && visibleItems.length === 1) {
    carousel.appendChild(createCarouselItem(visibleItems[0]));
    animateCarouselItems();
    return;
  }

  const buckets = new Map();
  for (const item of visibleItems) {
    const key = (item.productType || "").toLowerCase();
    const sectionKey = PRODUCT_TYPE_SECTIONS.some(s => s.type === key) ? key : OTHER_SECTION.type;
    if (!buckets.has(sectionKey)) buckets.set(sectionKey, []);
    buckets.get(sectionKey).push(item);
  }

  const orderedSections = [...PRODUCT_TYPE_SECTIONS, OTHER_SECTION].filter(s => buckets.has(s.type));
  const showHeaders = orderedSections.length > 1;
  const collapsed = getCollapsedSections();

  for (const section of orderedSections) {
    const sectionEl = document.createElement("div");
    sectionEl.className = "carousel-section";
    sectionEl.dataset.sectionType = section.type;

    const sectionItems = buckets.get(section.type);

    if (showHeaders) {
      // The row is a plain flex container: a real <h2> (so heading navigation
      // goes h1 → h2 → h3 product titles) wrapping the collapse toggle, with
      // the Refine control as a sibling — never a focusable control nested
      // inside another button. The whole row still toggles on click for
      // mouse/touch, exactly as before.
      const heading = document.createElement("div");
      heading.className = "carousel-section-title";
      heading.dataset.sectionType = section.type;

      const startsCollapsed = collapsed.has(section.type);
      const count = sectionItems.length;

      heading.innerHTML = `
        <h2 class="carousel-section-heading">
          <button type="button" class="carousel-section-toggle" aria-controls="carousel-items-${section.type}" aria-expanded="${String(!startsCollapsed)}">
            <span class="carousel-section-label">${section.label}</span>
            <span class="carousel-section-count">${count}</span>
            <span class="visually-hidden">${count === 1 ? "item" : "items"}</span>
          </button>
        </h2>
        <button type="button" class="carousel-section-refine" hidden aria-expanded="false" aria-controls="carousel-facets-${section.type}" aria-label="Refine this section">
          <span class="refine-label">Refine</span>
          <span class="refine-count" hidden>0</span>
          <svg class="refine-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <svg class="carousel-section-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      const toggle = heading.querySelector(".carousel-section-toggle");

      heading.addEventListener("click", (e) => {
        // Refine button captures its own clicks; don't propagate to collapse.
        if (e.target.closest(".carousel-section-refine")) return;
        const wasExpanded = toggle.getAttribute("aria-expanded") === "true";
        const nowExpanded = !wasExpanded;
        toggle.setAttribute("aria-expanded", String(nowExpanded));
        sectionEl.classList.toggle("collapsed", !nowExpanded);

        const next = getCollapsedSections();
        if (nowExpanded) next.delete(section.type);
        else next.add(section.type);
        persistCollapsedSections(next);
      });

      if (startsCollapsed) sectionEl.classList.add("collapsed");
      sectionEl.appendChild(heading);
    }

    // Sub-chip facets per section (Theme / Park / Tags) — only render rows
    // whose facet has ≥2 distinct values within this section. Hidden by
    // default behind the Refine toggle in the section header.
    if (showHeaders) {
      const facetsEl = buildSectionFacets(sectionEl, sectionItems);
      if (facetsEl) {
        facetsEl.classList.add("collapsed");
        sectionEl.appendChild(facetsEl);
        // Reveal the Refine toggle on this section's header now that we
        // know facets exist.
        const refine = sectionEl.querySelector(".carousel-section-refine");
        if (refine) {
          refine.hidden = false;
          const onToggle = () => {
            const open = facetsEl.classList.toggle("collapsed");
            // After toggle, `collapsed` is REMOVED on open; flip the value.
            const isOpen = !open;
            refine.setAttribute("aria-expanded", String(isOpen));
          };
          // A real <button> now: Enter/Space arrive as click natively.
          refine.addEventListener("click", (e) => { e.stopPropagation(); onToggle(); });
        }
      }
    }

    const itemsWrap = document.createElement("div");
    itemsWrap.className = "carousel-section-items";
    itemsWrap.id = `carousel-items-${section.type}`;
    for (const item of sectionItems) {
      const card = createCarouselItem(item);
      // Stash filterable facets on the card so chip clicks can hide/show without re-render.
      card.dataset.facetTheme = (item.theme || "").toLowerCase();
      card.dataset.facetPark  = (item.nationalPark || "").toLowerCase();
      card.dataset.facetTags  = (item.tags || []).join("|").toLowerCase();
      itemsWrap.appendChild(card);
    }
    sectionEl.appendChild(itemsWrap);

    carousel.appendChild(sectionEl);
  }

  animateCarouselItems();
}

// Tags hidden from the "Tags" sub-chip row (they're already represented elsewhere
// or are redundant with the productType section header).
const HIDDEN_FACET_TAGS = new Set([
  "t-shirt", "tote", "magnet", "tshirt",
  "kaayko-original", "wildlife", "india",
  "heritage", "philosophy", "rebel", "originals", "nostalgia", "friendship", "places",
]);

function buildSectionFacets(sectionEl, items) {
  const themeCounts = new Map();
  const parkCounts  = new Map();
  const tagCounts   = new Map();
  for (const it of items) {
    if (it.theme) themeCounts.set(it.theme, (themeCounts.get(it.theme) || 0) + 1);
    if (it.nationalPark) parkCounts.set(it.nationalPark, (parkCounts.get(it.nationalPark) || 0) + 1);
    for (const t of (it.tags || [])) {
      if (HIDDEN_FACET_TAGS.has(t.toLowerCase())) continue;
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
  }

  const rows = [];
  if (themeCounts.size >= 2) rows.push({ label: "Theme", key: "theme", entries: [...themeCounts.entries()] });
  if (parkCounts.size  >= 2) rows.push({ label: "Park",  key: "park",  entries: [...parkCounts.entries()] });
  if (tagCounts.size   >= 2) {
    const top = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    rows.push({ label: "Tags", key: "tags", entries: top, multi: true });
  }
  if (rows.length === 0) return null;

  const sectionType = sectionEl.dataset.sectionType || "section";
  const wrap = document.createElement("div");
  wrap.className = "section-facets";
  wrap.id = `carousel-facets-${sectionType}`;
  for (const row of rows) {
    const rowEl = document.createElement("div");
    rowEl.className = "section-facet-row";
    const labelId = `section-facet-label-${sectionType}-${row.key}`;
    rowEl.innerHTML = `<span class="section-facet-label" id="${labelId}">${row.label}</span>`;
    const chips = document.createElement("div");
    chips.className = "section-facet-chips";
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-labelledby", labelId);
    for (const [val, count] of row.entries) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "section-facet-chip";
      chip.dataset.facet = row.key;
      chip.dataset.value = val.toLowerCase();
      chip.setAttribute("aria-pressed", "false");
      chip.innerHTML = `${val}<span class="section-facet-count">${count}</span>`;
      chip.addEventListener("click", () => {
        // Single-select within a non-multi row (Theme/Park). Multi-select for Tags.
        if (!row.multi) {
          rowEl.querySelectorAll(".section-facet-chip.selected").forEach(c => {
            if (c !== chip) c.classList.remove("selected");
          });
        }
        chip.classList.toggle("selected");
        rowEl.querySelectorAll(".section-facet-chip").forEach(c => {
          c.setAttribute("aria-pressed", String(c.classList.contains("selected")));
        });
        applySectionFilters(sectionEl);
      });
      chips.appendChild(chip);
    }
    rowEl.appendChild(chips);
    wrap.appendChild(rowEl);
  }
  return wrap;
}

function applySectionFilters(sectionEl) {
  const picked = { theme: [], park: [], tags: [] };
  sectionEl.querySelectorAll(".section-facet-chip.selected").forEach(c => {
    picked[c.dataset.facet]?.push(c.dataset.value);
  });
  const totalActive = picked.theme.length + picked.park.length + picked.tags.length;
  const cards = sectionEl.querySelectorAll(".carousel-item");
  let visibleCount = 0;
  cards.forEach(card => {
    let ok = true;
    if (picked.theme.length && !picked.theme.includes(card.dataset.facetTheme)) ok = false;
    if (picked.park.length  && !picked.park.includes(card.dataset.facetPark))  ok = false;
    if (picked.tags.length) {
      const cardTags = (card.dataset.facetTags || "").split("|");
      if (!picked.tags.some(t => cardTags.includes(t))) ok = false;
    }
    card.style.display = ok ? "" : "none";
    if (ok) visibleCount++;
  });
  // Update the section header count to show filtered/total.
  const countEl = sectionEl.querySelector(".carousel-section-count");
  if (countEl) {
    const total = cards.length;
    countEl.textContent = visibleCount === total ? String(total) : `${visibleCount} / ${total}`;
  }
  // Update the Refine button's active-count pill.
  const refine = sectionEl.querySelector(".carousel-section-refine");
  if (refine) {
    refine.classList.toggle("has-active", totalActive > 0);
    const pill = refine.querySelector(".refine-count");
    if (pill) {
      pill.textContent = String(totalActive);
      pill.hidden = totalActive === 0;
    }
  }
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
  if (isSoldOut(item)) card.classList.add("is-sold-out");

  const { metadataPill, heartButton } = createLikeButton(item);
  const imgContainer = buildImageContainer(item, metadataPill, heartButton);
  if (isSoldOut(item)) {
    const flag = document.createElement("span");
    flag.className = "sold-out-flag";
    flag.textContent = "Sold out";
    imgContainer.append(flag);
  }
  const indicator = createImageIndicator(item.imgSrc.length, 0);
  if (indicator) {
    imgContainer.append(indicator);
  }

  // Title becomes a link to the PDP. Animal SKUs → /animals/<slug>; legacy → /store/p/<docId>.
  // NOTE: /store/p/:id resolves the Firestore DOC id (exposed as item.id) — the
  // same identifier the cart/checkout uses. `item.productID` is a legacy label
  // and 404s on the PDP route.
  const pdpUrl = item.animalSlug
    ? `/animals/${encodeURIComponent(item.animalSlug)}`
    : (item.id ? `/store/p/${encodeURIComponent(item.id)}` : null);

  const titleEl = document.createElement("h3");
  titleEl.className = "title";
  if (pdpUrl) {
    const titleLink = document.createElement("a");
    titleLink.href = pdpUrl;
    titleLink.className = "title-link";
    titleLink.textContent = item.title;
    titleEl.appendChild(titleLink);
  } else {
    titleEl.textContent = item.title;
  }

  const descEl  = textEl("p",  "description", item.description);
  const content = document.createElement("div");
  content.className = "product-copy";

  // Add store/seller attribution if available
  if (item.storeName && item.storeSlug) {
    const storeLink = document.createElement("a");
    storeLink.className = "product-store-link";
    storeLink.href = `/store?store=${encodeURIComponent(item.storeSlug)}`;
    storeLink.textContent = `by ${item.storeName}`;
    storeLink.addEventListener("click", (e) => e.stopPropagation());
    content.append(titleEl, storeLink, descEl);
  } else {
    content.append(titleEl, descEl);
  }
  // Description text is also a link to the PDP — wider tap target.
  if (pdpUrl) {
    descEl.style.cursor = "pointer";
    descEl.addEventListener("click", () => { window.location.href = pdpUrl; });
  }

  const footer = document.createElement("div");
  footer.className = "footer-elements";

  // Price indicators container
  const priceContainer = document.createElement("div");
  priceContainer.className = "price-container";

  // Convert price symbols to actual dollar amount - use actualPrice if available
  const actualPrice = document.createElement("p");
  actualPrice.className = "actual-price";
  if (item.actualPrice) {
    actualPrice.textContent = `$${item.actualPrice.toFixed(2)}`;
  } else {
    actualPrice.textContent = PRICE_MAP[item.price] || item.price;
  }

  priceContainer.append(actualPrice);

  const cartControl = createBuyButton(item);
  footer.append(priceContainer, cartControl);

  content.append(footer);
  card.append(imgContainer, content);

  if (item.imgSrc.length > 1) {
    addSwipe(imgContainer, item.imgSrc.length, indicator);
  }

  // Photo → product page (retail convention). The zoom modal stays available on
  // the PDP hero. Only when there is no PDP to go to do we fall back to zoom.
  if (pdpUrl && item.imgSrc.length <= 1) {
    imgContainer.style.cursor = "pointer";
  }
  imgContainer.addEventListener("click", (e) => {
    if (e.target.closest(".image-overlay-control")) {
      return;
    }
    // Dots switch the visible photo; they must not also navigate.
    if (e.target.closest(".image-indicator")) {
      return;
    }
    if (pdpUrl) {
      window.location.href = pdpUrl;
      return;
    }
    openModal(item);
  });

  // The fit picker expands the card itself; a tap outside shrinks it back.
  attachExpandingPicker({
    host: card,
    trigger: cartControl.querySelector(".cart-link"),
    product: item
  });

  return card;
}

function textEl(tag, cls, txt) {
  const e = document.createElement(tag);
  e.className   = cls;
  e.textContent = txt;
  return e;
}

// Alt text for a gallery frame (1.1.1). Frame 1 is the product; later frames
// are alternate views and stay named because only one frame is displayed at a
// time — an empty alt would leave the visible frame nameless after a dot/swipe.
function galleryAlt(title, i, total) {
  const name = title || "Product image";
  return i === 0 ? name : `${name} — view ${i + 1} of ${total}`;
}

function buildImageContainer(item, metadataPill, heartButton) {
  const container = document.createElement("div");
  container.className = "img-container";

  // Use the 1600px preview tier for carousel cards. Falls back to the full
  // imgSrc for legacy products without previews. The zoom modal still opens
  // the full 3600px imgSrc — see openModal().
  const previews = (item.previewSrc && item.previewSrc.length === item.imgSrc.length)
    ? item.previewSrc
    : item.imgSrc;
  previews.forEach((url, i) => {
    const img      = document.createElement("img");
    img.src        = url;
    img.alt        = galleryAlt(item.title, i, previews.length);
    img.className  = "carousel-image";
    img.style.display = i === 0 ? "block" : "none";
    container.append(img);
  });

  container.append(metadataPill, heartButton);

  if (isNew(item)) {
    const badge = document.createElement("span");
    badge.className = "new-badge";
    badge.textContent = "New";
    badge.setAttribute("aria-label", "New product");
    container.append(badge);
  }

  return container;
}

// Mark dot `idx` as the current frame — class for the visuals, aria-pressed
// for assistive tech. Used by the dots themselves and by swipe.
function setActiveDot(dots, idx) {
  Array.from(dots.children).forEach((d, i) => {
    const active = i === idx;
    d.classList.toggle("active", active);
    d.setAttribute("aria-pressed", String(active));
  });
}

function createImageIndicator(count, current) {
  if (count <= 1) {
    return null;
  }

  const dots = document.createElement("div");
  dots.className = "image-indicator";
  dots.setAttribute("role", "group");
  dots.setAttribute("aria-label", "Product photos");
  for (let i = 0; i < count; i++) {
    // Real buttons so keyboard users can reach every frame (2.1.1).
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "indicator-dot" + (i === current ? " active" : "");
    dot.setAttribute("aria-label", `Show image ${i + 1} of ${count}`);
    dot.setAttribute("aria-pressed", String(i === current));
    dot.addEventListener("click", () => {
      const imgs = dots.parentElement.querySelectorAll(".carousel-image");
      imgs.forEach(img => (img.style.display = "none"));
      imgs[i].style.display = "block";
      setActiveDot(dots, i);
    });
    dots.append(dot);
  }
  return dots;
}

// A finger never lands perfectly still. Anything under this is a tap (→ open the
// product page), not a swipe.
const TAP_SLOP = 24;

function addSwipe(container, count, indicator) {
  let startX = 0, startY = 0, idx = 0, threshold = 50;
  let isDragging = false;
  let hasSwiped = false;
  // Axis lock for the touch fallback: once a gesture is judged vertical we never
  // preventDefault, so page scrolling always wins a diagonal thumb-flick.
  let axis = null; // null = undecided, "x" = swipe photos, "y" = page scroll

  const process = dx => {
    if (Math.abs(dx) < threshold) return false;

    hasSwiped = true;
    const imgs = container.querySelectorAll(".carousel-image");

    imgs[idx].style.display = "none";
    idx = dx < 0 ? (idx + 1) % count : (idx - 1 + count) % count;
    imgs[idx].style.display = "block";
    if (indicator) {
      setActiveDot(indicator, idx);
    }
    return true;
  };

  // Add touch area styling to ensure touch events work
  container.style.touchAction = 'pan-y pinch-zoom';
  container.style.userSelect = 'none';
  container.style.cursor = 'grab';

  // Swallow the click that follows a real swipe so it doesn't also navigate.
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
        if (Math.abs(dx) > TAP_SLOP) {
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
      startY = e.touches[0].clientY;
      isDragging = true;
      hasSwiped = false;
      axis = null;
    }, {passive: false});

    container.addEventListener("touchmove", e => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      // Decide the axis once, on the first meaningful movement.
      if (axis === null) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }

      // Vertical intent → hands the gesture back to the page. Never block scroll.
      if (axis === "y") {
        isDragging = false;
        return;
      }

      if (Math.abs(dx) > TAP_SLOP) hasSwiped = true;
      e.preventDefault(); // Horizontal photo swipe — suppress the rubber-band only.
    }, {passive: false});

    container.addEventListener("touchend", e => {
      if (isDragging && axis === "x") {
        process(e.changedTouches[0].clientX - startX);
      }
      isDragging = false;
      axis = null;
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
        if (Math.abs(dx) > TAP_SLOP) {
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
    img.alt        = galleryAlt(item.title, i, item.imgSrc.length);
    img.className  = "modal-image";
    img.style.display = i === 0 ? "block" : "none";
    box.append(img);
  });

  // Remember who opened the dialog so close can hand focus back (2.4.3).
  modalNav.opener = document.activeElement;

  modal.classList.add("active");
  document.body.style.overflow = 'hidden';
  setupModalNav(box, item.imgSrc.length);

  const closeBtn = document.getElementById("close-modal-button");
  if (closeBtn) closeBtn.focus();
}

// Gallery state lives at module scope so the listeners below can be bound ONCE
// against the static modal chrome. Binding them per openModal() call made a
// single arrow-click advance several frames.
const modalNav = { imgs: [], count: 0, idx: 0, bound: false, opener: null };

function showModalImage(i) {
  const { imgs, count } = modalNav;
  if (!count || !imgs.length) return;
  imgs[modalNav.idx].style.display = "none";
  modalNav.idx = (i + count) % count;
  imgs[modalNav.idx].style.display = "block";
}

function setupModalNav(container, count) {
  modalNav.imgs = container.querySelectorAll(".modal-image");
  modalNav.count = count;
  modalNav.idx = 0;

  const prev = document.querySelector(".modal-nav-left");
  const next = document.querySelector(".modal-nav-right");
  // A one-photo product gets no arrows at all.
  const navDisplay = count > 1 ? "" : "none";
  if (prev) prev.style.display = navDisplay;
  if (next) next.style.display = navDisplay;

  if (modalNav.bound) return;
  modalNav.bound = true;

  prev?.addEventListener("click", e => { e.stopPropagation(); showModalImage(modalNav.idx - 1); });
  next?.addEventListener("click", e => { e.stopPropagation(); showModalImage(modalNav.idx + 1); });

  let startX = 0;
  container.addEventListener("mousedown", e => startX = e.clientX);
  container.addEventListener(
    "mouseup",
    e => Math.abs(e.clientX - startX) > 50 && showModalImage(e.clientX - startX < 0 ? modalNav.idx + 1 : modalNav.idx - 1)
  );
  container.addEventListener("touchstart", e => startX = e.touches[0].clientX, {passive:true});
  container.addEventListener(
    "touchend",
    e => Math.abs(e.changedTouches[0].clientX - startX) > 50 && showModalImage(e.changedTouches[0].clientX - startX < 0 ? modalNav.idx + 1 : modalNav.idx - 1)
  );
}

/* ==========================================================================
   3) Voting (♥ button)
   ========================================================================== */
function createLikeButton(item) {
  const btn = document.createElement("button");
  btn.className = "heart-button image-overlay-control material-icons";
  btn.type = "button";
  btn.setAttribute("aria-label", "Vote for this product");

  let liked = false;
  let votes = item.votes || 0;

  const countEl = document.createElement("span");
  countEl.className = "image-meta-pill";

  function refresh() {
    btn.classList.toggle("liked", liked);
    btn.setAttribute("aria-pressed", String(liked));
    btn.textContent = liked ? "favorite" : "favorite_border";
    countEl.textContent = `${votes} vote${votes === 1 ? "" : "s"}`;
  }
  refresh();

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const delta = liked ? -1 : 1;
    liked = !liked;
    refresh();
    try {
      await voteOnProduct(item.id, delta);
      votes += delta;
      refresh();
    } catch (err) {
      console.error("Vote error:", err);
      liked = !liked;
      refresh();
      console.warn("Vote update failed — UI rolled back.");
    }
  });

  return { heartButton: btn, metadataPill: countEl };
}

/* ==========================================================================
/* ==========================================================================
   4) Buy Button

   The fit and size choice itself lives in /js/fitPicker.js and expands inside
   the card. This builds the trigger and keeps its label in step with the bag.
   ========================================================================== */

// One subscription for the whole grid rather than one per card: cards are
// rebuilt wholesale on every filter change, and a per-card subscribe would
// leave a listener behind for each destroyed card.
window.cartManager?.subscribe?.(() => {
  document.querySelectorAll(".cart-button-container").forEach((el) => el._syncBag?.());
});

function createBuyButton(item) {
  const container = document.createElement("div");
  container.className = "cart-button-container";
  container.dataset.productId = item.id;

  // A real <button>: this opens a picker, it does not navigate.
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "cart-link";
  trigger.dataset.productId = item.id;

  const icon = document.createElement("span");
  icon.className = "material-icons cart-link-icon";
  icon.textContent = "check";
  icon.setAttribute("aria-hidden", "true");   // ligature text must not be read

  const label = document.createElement("span");
  label.className = "cart-label";
  trigger.append(icon, label);
  container.append(trigger);

  function syncBag() {
    // Sold out is terminal for this control: no label churn, no picker, and the
    // button is genuinely disabled rather than merely styled that way.
    if (isSoldOut(item)) {
      container.classList.add("is-sold-out");
      trigger.disabled = true;
      icon.style.display = "none";
      label.textContent = "Sold out";
      trigger.setAttribute("aria-label", `${item.title} is sold out`);
      return;
    }

    const inBag = !!window.cartManager?.hasProduct(item.id);
    const choosable = needsPicker(item);
    container.classList.toggle("in-cart", inBag);
    trigger.classList.toggle("in-cart", inBag);
    label.textContent = inBag ? "In bag" : "Add to bag";
    icon.style.display = inBag ? "inline-flex" : "none";
    trigger.setAttribute("aria-label",
      inBag
        ? (choosable ? `Change size for ${item.title}` : `${item.title} is in your bag — view bag`)
        : (choosable ? `Choose a size for ${item.title}` : `Add ${item.title} to bag`));
  }

  container._syncBag = syncBag;
  syncBag();
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
    // Hand focus back to whatever opened the gallery (2.4.3).
    const opener = modalNav.opener;
    modalNav.opener = null;
    if (opener && typeof opener.focus === "function" && document.contains(opener)) {
      opener.focus();
    }
  }

  btn?.addEventListener("click", closeModal);

  // Keep Tab inside the open dialog (2.1.2). The only focusable chrome is the
  // close button and the two arrows (the arrows are hidden for one-photo items).
  modal.addEventListener("keydown", e => {
    if (e.key !== "Tab" || !modal.classList.contains("active")) return;
    const focusables = Array.from(modal.querySelectorAll("button"))
      .filter(b => !b.disabled && getComputedStyle(b).display !== "none");
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // `.modal-content` is 100%×100%, so it — not `#modal` — is always the click
  // target. Dismiss on anything that is not the photo itself or an arrow, so a
  // tap anywhere on the dark surround gets the shopper out.
  modal.addEventListener("click", e => {
    if (e.target.closest(".modal-nav")) return;
    if (e.target.classList.contains("modal-image")) return; // swipe lands here
    closeModal();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("active")) closeModal();
  });

  // Belt and braces: never leave the page scroll-locked. If the modal is not
  // showing (fresh load, back/forward cache restore, tab return) the lock goes.
  const somethingElseLocksScroll = () =>
    !!document.querySelector(".filter-overlay.active, .cart-overlay.active");
  const releaseIfClosed = () => {
    if (modal.classList.contains("active")) return;
    if (somethingElseLocksScroll()) return;
    document.body.style.overflow = '';
  };
  window.addEventListener("pageshow", releaseIfClosed);
  window.addEventListener("popstate", () => {
    if (modal.classList.contains("active")) closeModal();
  });
  document.addEventListener("visibilitychange", releaseIfClosed);
  releaseIfClosed();
}
