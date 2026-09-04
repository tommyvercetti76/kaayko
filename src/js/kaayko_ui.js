// File: scripts/kaayko_ui.js
/**
 * Manages Kaayko Store page UI:
 *  1) Carousel rendering & swipe
 *  2) Image-zoom modal + navigation
 *  3) Voting (♥ button)
 *  4) Buy button & cart mini-panel
 *
 * Updated: now skips any item where `isAvailable !== true`
 */

import { voteOnProduct } from "./kaayko_apiClient.js";

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

// Single delegated handler for closing mini panels on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.cart-button-container')) {
    document.querySelectorAll('.cart-mini-panel').forEach(p => p.style.display = 'none');
  }
});

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
      const heading = document.createElement("button");
      heading.type = "button";
      heading.className = "carousel-section-title";
      heading.dataset.sectionType = section.type;
      heading.setAttribute("aria-controls", `carousel-items-${section.type}`);

      const startsCollapsed = collapsed.has(section.type);
      heading.setAttribute("aria-expanded", String(!startsCollapsed));

      heading.innerHTML = `
        <span class="carousel-section-label">${section.label}</span>
        <span class="carousel-section-count" aria-label="${sectionItems.length} item${sectionItems.length === 1 ? "" : "s"}">${sectionItems.length}</span>
        <span class="carousel-section-refine" hidden role="button" tabindex="0" aria-expanded="false" aria-label="Refine this section">
          <span class="refine-label">Refine</span>
          <span class="refine-count" hidden>0</span>
          <svg class="refine-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <svg class="carousel-section-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;

      heading.addEventListener("click", (e) => {
        // Refine button captures its own clicks; don't propagate to collapse.
        if (e.target.closest(".carousel-section-refine")) return;
        const wasExpanded = heading.getAttribute("aria-expanded") === "true";
        const nowExpanded = !wasExpanded;
        heading.setAttribute("aria-expanded", String(nowExpanded));
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
          refine.addEventListener("click", (e) => { e.stopPropagation(); onToggle(); });
          refine.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); }
          });
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

  const wrap = document.createElement("div");
  wrap.className = "section-facets";
  for (const row of rows) {
    const rowEl = document.createElement("div");
    rowEl.className = "section-facet-row";
    rowEl.innerHTML = `<span class="section-facet-label">${row.label}</span>`;
    const chips = document.createElement("div");
    chips.className = "section-facet-chips";
    for (const [val, count] of row.entries) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "section-facet-chip";
      chip.dataset.facet = row.key;
      chip.dataset.value = val.toLowerCase();
      chip.innerHTML = `${val}<span class="section-facet-count">${count}</span>`;
      chip.addEventListener("click", () => {
        // Single-select within a non-multi row (Theme/Park). Multi-select for Tags.
        if (!row.multi) {
          rowEl.querySelectorAll(".section-facet-chip.selected").forEach(c => {
            if (c !== chip) c.classList.remove("selected");
          });
        }
        chip.classList.toggle("selected");
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

  const { metadataPill, heartButton } = createLikeButton(item);
  const imgContainer = buildImageContainer(item, metadataPill, heartButton);
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

  return card;
}

function textEl(tag, cls, txt) {
  const e = document.createElement(tag);
  e.className   = cls;
  e.textContent = txt;
  return e;
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

function createImageIndicator(count, current) {
  if (count <= 1) {
    return null;
  }

  const dots = document.createElement("div");
  dots.className = "image-indicator";
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    dot.className = "indicator-dot" + (i === current ? " active" : "");
    dot.addEventListener("click", () => {
      const imgs = dots.parentElement.querySelectorAll(".carousel-image");
      imgs.forEach(img => (img.style.display = "none"));
      Array.from(dots.children).forEach(d => d.classList.remove("active"));
      imgs[i].style.display = "block";
      dot.classList.add("active");
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
    if (indicator) {
      indicator.children[idx].classList.remove("active");
    }
    idx = dx < 0 ? (idx + 1) % count : (idx - 1 + count) % count;
    imgs[idx].style.display = "block";
    if (indicator) {
      indicator.children[idx].classList.add("active");
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
    img.className  = "modal-image";
    img.style.display = i === 0 ? "block" : "none";
    box.append(img);
  });

  modal.classList.add("active");
  document.body.style.overflow = 'hidden';
  setupModalNav(box, item.imgSrc.length);
}

// Gallery state lives at module scope so the listeners below can be bound ONCE
// against the static modal chrome. Binding them per openModal() call made a
// single arrow-click advance several frames.
const modalNav = { imgs: [], count: 0, idx: 0, bound: false };

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
   4) Buy Button & Cart Mini-Panel
   ========================================================================== */

// Fit picker constants + last-used preference. Preselecting the shopper's last
// choice removes two taps from every t-shirt purchase.
const GENDER_OPTIONS = ["Male", "Female", "Teen", "Child", "Infant"];
const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const FIT_PREF_KEY = "kaayko.lastFit";

export function readFitPref() {
  try {
    const raw = localStorage.getItem(FIT_PREF_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function saveFitPref(gender, size) {
  try {
    localStorage.setItem(FIT_PREF_KEY, JSON.stringify({ gender, size }));
  } catch (_) { /* localStorage full / unavailable; non-fatal */ }
}

// The sizes a SKU actually stocks. Falls back to the full run only when the
// product carries no availableSizes at all.
export function sizesFor(item) {
  const sizes = (item.availableSizes || []).filter(Boolean);
  return sizes.length ? sizes : DEFAULT_SIZES;
}

// Sensible starting selection: last-used if it is still offered, else the first
// available size and the first gender.
export function defaultFit(item) {
  const sizes = sizesFor(item);
  const pref = readFitPref() || {};
  return {
    size: sizes.includes(pref.size) ? pref.size : sizes[0],
    gender: GENDER_OPTIONS.includes(pref.gender) ? pref.gender : GENDER_OPTIONS[0]
  };
}

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
    toast.querySelector(".bag-toast-close").addEventListener("click", () => {
      toast.classList.remove("visible");
    });
  }
  toast.querySelector(".bag-toast-msg").textContent = message;
  toast.classList.add("visible");
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove("visible"), 6000);
  return toast;
}

function createBuyButton(item) {
  const container = document.createElement("div");
  container.className = "cart-button-container";
  container.dataset.productId = item.id;

  // Check if item is in cart
  const link = document.createElement("a");
  link.className = "cart-link";
  link.href = "#";
  link.dataset.productId = item.id;
  link.setAttribute("role", "button");
  link.setAttribute("aria-haspopup", "dialog");

  const linkIcon = document.createElement("span");
  linkIcon.className = "material-icons cart-link-icon";
  linkIcon.textContent = "check";

  const label = document.createElement("span");
  label.className = "cart-label";

  function syncCartState() {
    const currentlyInCart = !!(window.cartManager && window.cartManager.hasProduct(item.id));
    container.classList.toggle("in-cart", currentlyInCart);
    link.classList.toggle("in-cart", currentlyInCart);
    label.textContent = currentlyInCart ? "In bag" : "Add to bag";
    linkIcon.style.display = currentlyInCart ? "inline-flex" : "none";
    if (currentlyInCart) {
      link.setAttribute("aria-label", needsPicker() ? "Edit bag item" : "In your bag — view bag");
      link.title = needsPicker() ? "Edit size and fit" : "View your bag";
    } else {
      link.setAttribute("aria-label", "Add item to bag");
      link.title = "Add to bag";
    }
  }

  link.append(linkIcon, label);

  // Mini panel for size/gender selection
  const miniPanel = document.createElement("div");
  miniPanel.className = "cart-mini-panel";
  miniPanel.style.display = "none";

  let selectedGender = null;
  let selectedSize = null;

  // One renderer for the panel so the "first paint" and the "reopen" paths can
  // never drift apart. Sizes come from the SKU, not a hardcoded XS–XXL run.
  function renderMiniPanel(cartItem) {
    const sizes = sizesFor(item);
    const fallback = defaultFit(item);
    selectedGender = cartItem?.gender || fallback.gender;
    selectedSize = sizes.includes(cartItem?.size) ? cartItem.size : fallback.size;

    const genderChips = GENDER_OPTIONS.map(g =>
      `<button class="mini-option${selectedGender === g ? " selected" : ""}" data-gender="${g}">${g}</button>`
    ).join("");
    const sizeChips = sizes.map(s =>
      `<button class="mini-option${selectedSize === s ? " selected" : ""}" data-size="${s}">${s}</button>`
    ).join("");

    miniPanel.innerHTML = `
      <div class="mini-panel-content">
        <div class="mini-panel-section">
          <label>Gender:</label>
          <div class="mini-gender-options">${genderChips}</div>
        </div>
        <div class="mini-panel-section">
          <label>Size:</label>
          <div class="mini-size-options">${sizeChips}</div>
        </div>
        <div class="mini-panel-actions">
          <button class="mini-add-to-cart">${cartItem ? "Update bag" : "Add to bag"}</button>
          ${cartItem ? '<button class="mini-remove-from-cart">Remove from bag</button>' : ""}
        </div>
      </div>
    `;

    bindMiniPanel();
  }

  function updateAddButton() {
    const addBtn = miniPanel.querySelector(".mini-add-to-cart");
    if (addBtn) addBtn.disabled = !(selectedGender && selectedSize);
  }

  function bindMiniPanel() {
    miniPanel.querySelectorAll("[data-gender]").forEach(genderBtn => {
      genderBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        miniPanel.querySelectorAll("[data-gender]").forEach(b => b.classList.remove("selected"));
        genderBtn.classList.add("selected");
        selectedGender = genderBtn.dataset.gender;
        updateAddButton();
      });
    });

    miniPanel.querySelectorAll("[data-size]").forEach(sizeBtn => {
      sizeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        miniPanel.querySelectorAll("[data-size]").forEach(b => b.classList.remove("selected"));
        sizeBtn.classList.add("selected");
        selectedSize = sizeBtn.dataset.size;
        updateAddButton();
      });
    });

    const addBtn = miniPanel.querySelector(".mini-add-to-cart");
    if (addBtn) {
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        addItemToCart();
      });
    }

    const removeBtn = miniPanel.querySelector(".mini-remove-from-cart");
    if (removeBtn) {
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeItemFromCart();
      });
    }

    updateAddButton();
  }

  function priceLabel() {
    return (item.actualPrice != null)
      ? `$${item.actualPrice.toFixed(2)}`
      : (PRICE_MAP[item.price] || item.price);
  }

  function addItemToCart() {
    if (!window.cartManager) return;

    const success = window.cartManager.addItem({
      productId: item.id,
      title: item.title,
      subtitle: item.description,
      price: priceLabel(),
      imgSrc: item.imgSrc,
      size: selectedSize,
      gender: selectedGender
    });

    if (!success) {
      if (window.showSustainabilityAlert) {
        window.showSustainabilityAlert({ attemptedProduct: item.title });
      }
    } else {
      saveFitPref(selectedGender, selectedSize);
      syncCartState();
      miniPanel.style.display = "none";
      showBagToast(`${item.title} added to bag`);
    }
  }

  function removeItemFromCart() {
    if (window.cartManager) {
      window.cartManager.removeItem(item.id);
      syncCartState();
      miniPanel.style.display = "none";
    }
  }

  // Add directly to cart without showing the gender/size picker — used for
  // non-tshirt SKUs (totes, magnets, etc.) where gender + multi-size choice
  // doesn't apply. Reads availableSizes from the product; falls back to
  // "One Size" if nothing is configured.
  function addDirect() {
    if (!window.cartManager) return;
    const currentCount = window.cartManager.getCount();
    const currentlyInCart = window.cartManager.hasProduct(item.id);
    if (currentlyInCart) {
      // Same label, opposite behaviour used to live here: "In bag" silently
      // deleted the item. Removal now happens on the bag page, where it is
      // labelled and reversible.
      window.location.href = "/cart";
      return;
    }
    if (currentCount >= 2) {
      if (window.showSustainabilityAlert) {
        window.showSustainabilityAlert({ attemptedProduct: item.title, cartCount: currentCount });
      }
      return;
    }
    const sizes = item.availableSizes || [];
    const ok = window.cartManager.addItem({
      productId: item.id,
      title: item.title,
      subtitle: item.description,
      price: priceLabel(),
      imgSrc: item.imgSrc,
      size: sizes[0] || "One Size",
      gender: null
    });
    if (!ok) {
      if (window.showSustainabilityAlert) window.showSustainabilityAlert({ attemptedProduct: item.title });
      return;
    }
    syncCartState();
    showBagToast(`${item.title} added to bag`);
  }

  // Decide whether this product needs the gender+size picker.
  // Picker shows ONLY for t-shirts with multi-size selection.
  function needsPicker() {
    if ((item.productType || "").toLowerCase() !== "tshirt") return false;
    const sizes = item.availableSizes || [];
    if (sizes.length <= 1) return false;
    return true;
  }

  // Toggle mini panel
  function toggleMiniPanel(e) {
    e.stopPropagation();
    e.preventDefault();

    if (!needsPicker()) {
      addDirect();
      return;
    }

    const isVisible = miniPanel.style.display === "block";

    const currentCount = window.cartManager ? window.cartManager.getCount() : 0;
    const currentlyInCart = !!(window.cartManager && window.cartManager.hasProduct(item.id));

    // Critical guard: if the cart already has 2 unique items and this product is not in bag,
    // show the sustainability modal from the top-layer CTA instead of opening size/gender panel.
    if (!currentlyInCart && currentCount >= 2) {
      if (window.showSustainabilityAlert) {
        window.showSustainabilityAlert({
          attemptedProduct: item.title,
          cartCount: currentCount
        });
      }
      return;
    }

    if (isVisible) {
      miniPanel.style.display = "none";
      return;
    }

    // Close all other panels
    document.querySelectorAll('.cart-mini-panel').forEach(p => p.style.display = "none");

    renderMiniPanel(currentlyInCart ? window.cartManager.getItem(item.id) : null);
    miniPanel.style.display = "block";
  }

  link.addEventListener("click", toggleMiniPanel);
  link.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      toggleMiniPanel(e);
    }
  });

  syncCartState();
  container.append(link, miniPanel);
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
  }

  btn?.addEventListener("click", closeModal);

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
