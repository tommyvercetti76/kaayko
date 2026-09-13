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

import { voteOnProduct } from "/js/services/storeApi.js";
import { cartManager } from "/js/cartManager.js";
import { attachExpandingPicker, needsPicker, isSoldOut } from "/js/fitPicker.js";

// Price: priceMap.js is the client's one authority (a mirror of the server's).
import { priceCents, priceText } from "/js/priceMap.js";

// Type names and order come from the registry the API sent with the catalogue
// (productTypes.js); unknown / missing productType lands in "Other".
import { labelForType, comingSoonTypes, searchTermsFor } from "/js/productTypes.js";
import { esc, money } from "/js/kit.js";

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
    .sort((a, b) =>
      ((b.featured === true) - (a.featured === true)) ||
      (getCreatedAtMs(b) - getCreatedAtMs(a)));

  announceProductCount(visibleItems.length);

  // Single-card deep-link mode: skip section UI entirely.
  if (carousel.classList.contains("single-card") && visibleItems.length === 1) {
    carousel.appendChild(createCarouselItem(visibleItems[0]));
    animateCarouselItems();
    return;
  }

  // One mixed grid. Products are interleaved rather than walled off by type: shoppers browse a
  // whole store, not a filing cabinet. The toolbar above does the narrowing and the sorting.
  const toolbar = buildBrowseToolbar(visibleItems, carousel);
  carousel.appendChild(toolbar);

  const grid = document.createElement("div");
  grid.className = "carousel-section-items store-grid";
  grid.id = "carousel-items-all";
  const mixRank = buildMixedOrder(visibleItems);
  for (const item of visibleItems) grid.appendChild(decorateCard(item, mixRank.get(item) ?? 0));
  carousel.appendChild(grid);
  carousel.appendChild(buildBrowseEmpty());

  const soon = comingSoonStrip();
  if (soon) carousel.appendChild(soon);

  applyBrowseState(carousel);
  animateCarouselItems();
}

/**
 * One quiet line under the grid naming the types that are on their way and what they
 * will cost (registry rows with status "coming_soon"). Nothing to click and nothing to
 * join: the brand does not collect emails. Flipping the row to "live" on the server and
 * uploading the first images is the launch; this line then disappears on its own.
 */
function comingSoonStrip() {
  const soon = comingSoonTypes();
  if (!soon.length) return null;
  const aside = document.createElement("aside");
  aside.className = "coming-soon";
  aside.setAttribute("aria-label", "Coming soon");
  const items = soon.map((t) =>
    `<span class="coming-soon-item">${esc(t.label)}<span class="coming-soon-price">${esc(money(t.priceCents))}</span></span>`
  ).join("");
  aside.innerHTML = `
    <p class="coming-soon-eyebrow">Coming soon</p>
    <p class="coming-soon-items">${items}</p>
    <p class="coming-soon-note">Same drawings, smaller things. No list to join; they will simply appear here.</p>`;
  return aside;
}

/**
 * A card plus the facet data the toolbar filters on, so narrowing is a class toggle
 * rather than a re-render (which would drop carousel position and focus).
 */
function decorateCard(item, mixRank = 0) {
  const card = createCarouselItem(item);
  card.dataset.facetMix = String(mixRank);
  card.dataset.facetType = (item.productType || "").toLowerCase();
  card.dataset.facetCategory = (item.category || "").toLowerCase();
  card.dataset.facetTheme = (item.theme || "").toLowerCase();
  card.dataset.facetPark = (item.nationalPark || "").toLowerCase();
  card.dataset.facetTags = (item.tags || []).join("|").toLowerCase();
  card.dataset.facetPrice = String(getPriceValue(item));
  card.dataset.facetVotes = String(Number(item.votes) || 0);
  card.dataset.facetCreated = String(getCreatedAtMs(item));
  card.dataset.facetFeatured = item.featured === true ? "1" : "0";
  card.dataset.facetTitle = (item.title || "").toLowerCase();
  // Everything a shopper might type, folded once: title, what it is (and the words
  // people use for it), the theme, the tags, the description, the animal, the park.
  const type = (item.productType || "").toLowerCase();
  card.dataset.facetSearch = foldSearch([
    item.title, labelForType(type), labelForType(type, { singular: true }), searchTermsFor(type),
    item.theme, (item.tags || []).join(" "), item.description, item.animalSlug, item.nationalPark, item.category
  ].join(" "));
  return card;
}

/**
 * Dollars for sorting and price facets — the same figure the server would charge
 * (priceMap.priceCents), or 0 when the product cannot be priced.
 */
export function getPriceValue(item) {
  return (priceCents(item) ?? 0) / 100;
}

/**
 * Default browse order: featured products lead, then everything else is dealt round-robin across
 * product types. Without this the grid still reads as blocks — six bottles, then eleven totes —
 * because items of a type share a creation date. Shoppers should meet the range, not a filing
 * cabinet with the dividers removed.
 */
function buildMixedOrder(items) {
  const rank = new Map();
  const featured = items.filter(i => i.featured === true);
  const rest = items.filter(i => i.featured !== true);

  let n = 0;
  for (const item of featured) rank.set(item, n++);

  const queues = new Map();
  for (const item of rest) {
    const key = (item.productType || "other").toLowerCase();
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(item);
  }
  // Largest groups first so the deal stays even as smaller queues run dry.
  const lanes = [...queues.values()].sort((a, b) => b.length - a.length);
  for (let i = 0; lanes.some(q => q.length); i++) {
    for (const lane of lanes) {
      const next = lane.shift();
      if (next) rank.set(next, n++);
    }
  }
  return rank;
}

const SORTS = [
  { id: "featured", label: "Featured & mixed" },
  { id: "newest",   label: "Newest" },
  { id: "price-asc",  label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" }
];

/**
 * The ONE browse state. The toolbar owns sort, type and search; the Refine dialog
 * (kaaykoFilterModal.js) owns themes and tags. Every facet is ANDed; within themes
 * and within tags a card matches if it carries any selected value. Nothing here
 * re-renders the grid: cards are shown, hidden and re-ordered in place.
 */
const BROWSE_STATE = { sort: "featured", type: "all", query: "", themes: [], tags: [] };

/** Lower-case, accent-free, punctuation folded to spaces — for both the haystack and the query. */
export function foldSearch(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Query words that count: two letters or more, unless the whole query is one short word. */
function searchWords(query) {
  const words = foldSearch(query).split(" ").filter(Boolean);
  const real = words.filter((w) => w.length >= 2);
  return real.length ? real : words;
}

function cardMatches(card, state) {
  if (state.type !== "all" && card.dataset.facetType !== state.type) return false;
  if (state.themes.length && !state.themes.includes(card.dataset.facetTheme)) return false;
  if (state.tags.length) {
    const tags = card.dataset.facetTags.split("|");
    if (!state.tags.some((t) => tags.includes(t))) return false;
  }
  const words = searchWords(state.query);
  if (words.length) {
    // Word prefixes, not substrings: "tee" finds tees, not "steel"; "cat" still
    // finds the fishing cat. Every query word must start some word of the card.
    const tokens = (card.dataset.facetSearch || "").split(" ");
    if (!words.every((w) => tokens.some((t) => t.startsWith(w)))) return false;
  }
  return true;
}

function anyBrowseActive(state = BROWSE_STATE) {
  return state.type !== "all" || !!searchWords(state.query).length || state.themes.length > 0 || state.tags.length > 0;
}

/** The Refine dialog hands its selection here; the grid updates in place. */
export function setBrowseRefinements({ themes = [], tags = [] } = {}) {
  BROWSE_STATE.themes = themes.map(foldSearch);
  BROWSE_STATE.tags = tags.map((t) => String(t).toLowerCase());
  applyBrowseState(document.getElementById("carousel"));
}

export function getBrowseState() {
  return { ...BROWSE_STATE, themes: [...BROWSE_STATE.themes], tags: [...BROWSE_STATE.tags] };
}

/** How many cards a candidate refinement would show, with the toolbar's type and search as they are. */
export function countBrowseMatches({ themes = [], tags = [] } = {}) {
  const grid = document.querySelector("#carousel .store-grid");
  if (!grid) return 0;
  const state = { ...BROWSE_STATE, themes: themes.map(foldSearch), tags: tags.map((t) => String(t).toLowerCase()) };
  return [...grid.children].filter((card) => cardMatches(card, state)).length;
}

/** Everything back to the whole store: type, search, themes, tags. Sort is a preference and stays. */
export function resetBrowse() {
  BROWSE_STATE.type = "all";
  BROWSE_STATE.query = "";
  BROWSE_STATE.themes = [];
  BROWSE_STATE.tags = [];
  const carousel = document.getElementById("carousel");
  const search = carousel?.querySelector(".browse-search");
  if (search) search.value = "";
  applyBrowseState(carousel);
  document.dispatchEvent(new CustomEvent("kaayko:browsereset"));
}

/** ?q= and ?type= deep links (a QR can land on "the magnets"); kept in the URL as the shopper narrows. */
function readBrowseFromUrl() {
  const p = new URLSearchParams(location.search);
  const q = p.get("q");
  const type = p.get("type");
  if (q) BROWSE_STATE.query = q.slice(0, 80);
  if (type) BROWSE_STATE.type = foldSearch(type).replace(/\s+/g, "");
}

let urlSyncTimer = null;
function syncBrowseToUrl() {
  clearTimeout(urlSyncTimer);
  urlSyncTimer = setTimeout(() => {
    const p = new URLSearchParams(location.search);
    for (const k of ["q", "type"]) p.delete(k);
    if (searchWords(BROWSE_STATE.query).length) p.set("q", BROWSE_STATE.query.trim());
    if (BROWSE_STATE.type !== "all") p.set("type", BROWSE_STATE.type);
    const qs = p.toString();
    history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}`);
  }, 250);
}

/**
 * Sort + type + search, in one row above the grid. Type chips carry live counts so a shopper can
 * see what is behind each one before spending a click.
 */
function buildBrowseToolbar(items, carousel) {
  readBrowseFromUrl();
  if (BROWSE_STATE.type !== "all" && !items.some((it) => (it.productType || "").toLowerCase() === BROWSE_STATE.type)) {
    BROWSE_STATE.type = "all";   // a ?type= nobody stocks is ignored, not an empty grid
  }
  const bar = document.createElement("div");
  bar.className = "browse-toolbar";

  const counts = new Map();
  for (const it of items) {
    const t = (it.productType || "other").toLowerCase();
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  const types = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  const chips = document.createElement("div");
  chips.className = "browse-chips";
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "Filter by product type");
  const mkChip = (value, label, count) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "browse-chip";
    b.dataset.value = value;
    b.setAttribute("aria-pressed", String(BROWSE_STATE.type === value));
    b.innerHTML = `<span>${label}</span><span class="browse-chip-count">${count}</span>`;
    b.addEventListener("click", () => {
      BROWSE_STATE.type = value;
      applyBrowseState(carousel);
    });
    return b;
  };
  chips.appendChild(mkChip("all", "Everything", items.length));
  for (const [type, count] of types) chips.appendChild(mkChip(type, labelForType(type), count));
  bar.appendChild(chips);

  const right = document.createElement("div");
  right.className = "browse-controls";

  const search = document.createElement("input");
  search.type = "search";
  search.className = "browse-search";
  search.placeholder = "Search: tiger, tote, stamp…";
  search.setAttribute("aria-label", "Search the store");
  search.autocomplete = "off";
  search.spellcheck = false;
  search.value = BROWSE_STATE.query;
  search.addEventListener("input", () => {
    BROWSE_STATE.query = search.value;
    applyBrowseState(carousel);
  });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { search.value = ""; BROWSE_STATE.query = ""; applyBrowseState(carousel); }
  });
  right.appendChild(search);

  const sortId = "browse-sort";
  const sortLabel = document.createElement("label");
  sortLabel.className = "visually-hidden";
  sortLabel.setAttribute("for", sortId);
  sortLabel.textContent = "Sort products";
  const sort = document.createElement("select");
  sort.className = "browse-sort";
  sort.id = sortId;
  for (const s of SORTS) {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.label;
    if (s.id === BROWSE_STATE.sort) o.selected = true;
    sort.appendChild(o);
  }
  sort.addEventListener("change", () => {
    BROWSE_STATE.sort = sort.value;
    applyBrowseState(carousel);
  });
  right.append(sortLabel, sort);

  const count = document.createElement("p");
  count.className = "browse-count";
  count.setAttribute("aria-live", "polite");
  right.appendChild(count);

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "browse-clear";
  clear.textContent = "Clear";
  clear.hidden = true;
  clear.addEventListener("click", resetBrowse);
  right.appendChild(clear);

  bar.appendChild(right);
  return bar;
}

/** Shown in place of the grid when nothing matches; one button back to everything. */
function buildBrowseEmpty() {
  const empty = document.createElement("div");
  empty.className = "browse-empty";
  empty.hidden = true;
  empty.setAttribute("role", "status");
  empty.innerHTML = `
    <p class="browse-empty-title">Nothing by that name.</p>
    <p class="browse-empty-copy">Try the animal, the object or the theme: tiger, tote, stamp, satire.</p>
    <button type="button" class="browse-empty-btn">Show everything</button>`;
  empty.querySelector(".browse-empty-btn").addEventListener("click", resetBrowse);
  return empty;
}

/** Re-order and show/hide cards in place to match the current sort, type, search, themes and tags. */
function applyBrowseState(carousel) {
  if (!carousel) return;
  const grid = carousel.querySelector(".store-grid");
  if (!grid) return;
  const cards = [...grid.children];

  const num = (card, key) => Number(card.dataset[key]) || 0;
  const comparators = {
    featured: (a, b) => num(a, "facetMix") - num(b, "facetMix"),
    newest:   (a, b) => num(b, "facetCreated") - num(a, "facetCreated"),
    "price-asc":  (a, b) => num(a, "facetPrice") - num(b, "facetPrice"),
    "price-desc": (a, b) => num(b, "facetPrice") - num(a, "facetPrice")
  };
  cards.sort(comparators[BROWSE_STATE.sort] || comparators.featured);
  cards.forEach((card, i) => { card.style.order = String(i); });

  let shown = 0;
  for (const card of cards) {
    const visible = cardMatches(card, BROWSE_STATE);
    card.hidden = !visible;
    if (visible) shown += 1;
  }

  for (const chip of carousel.querySelectorAll(".browse-chip")) {
    chip.setAttribute("aria-pressed", String(chip.dataset.value === BROWSE_STATE.type));
  }
  const active = anyBrowseActive();
  const refined = BROWSE_STATE.themes.length + BROWSE_STATE.tags.length;
  const countEl = carousel.querySelector(".browse-count");
  if (countEl) countEl.textContent = `${shown} ${shown === 1 ? "product" : "products"}${refined ? ` · ${refined} refinement${refined === 1 ? "" : "s"}` : ""}`;
  const clearEl = carousel.querySelector(".browse-clear");
  if (clearEl) clearEl.hidden = !active;
  const empty = carousel.querySelector(".browse-empty");
  if (empty) empty.hidden = shown !== 0;
  grid.classList.toggle("is-empty", shown === 0);

  // The Refine button in the header carries the number of refinements in force.
  const toggle = document.getElementById("filter-toggle");
  if (toggle) {
    toggle.classList.toggle("active", refined > 0);
    toggle.dataset.count = refined ? String(refined) : "";
    toggle.setAttribute("aria-label", refined ? `Refine (${refined} in force)` : "Refine");
  }
  syncBrowseToUrl();
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
      // textContent, never innerHTML: `val` is a product tag, and tags are
      // written by kreators through api/kreators/kreatorProductRoutes.js. An
      // unescaped tag here was a stored-XSS path into every store visitor —
      // and the admin ID token lives in localStorage on this same origin.
      chip.append(document.createTextNode(val));
      const countEl = document.createElement("span");
      countEl.className = "section-facet-count";
      countEl.textContent = count;
      chip.append(countEl);
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
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll("#carousel .carousel-item:not(.animate)").forEach(card => {
    const delay = (Math.random() * 0.8).toFixed(2) + "s";
    card.style.animationDelay = delay;
    card.classList.add("animate");
  });
}

function createCarouselItem(item) {
  const card = document.createElement("div");
  card.className = "carousel-item";
  if (isSoldOut(item)) card.classList.add("is-sold-out");
  if (item.featured === true) card.classList.add("is-featured");

  const heartButton = createLikeButton(item);
  const imgContainer = buildImageContainer(item, heartButton);
  // "Featured" is a sort order, not a sticker: the image carries the heart and
  // nothing else (and "Sold out", when it is true, because that changes the price).
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

  // Title becomes a link to THE product page — one page, one layout, every type.
  // Animal pieces used to route to /animals/<slug>, a second layout with its own
  // headings; that page now forwards here. /store/p/:id resolves the Firestore
  // DOC id (item.id), the same identifier the cart uses.
  const pdpUrl = item.id ? `/store/p/${encodeURIComponent(item.id)}` : null;

  // The card says the name and one line under it; the paragraph belongs on the
  // product page. "Bengal Tiger Bottle" + a two-line description that truncated
  // read as clutter; "Bengal Tiger" over "Bottle · 1963 stamp" reads as a label.
  const titleEl = document.createElement("h3");
  titleEl.className = "title";
  titleEl.title = item.title;
  if (pdpUrl) {
    const titleLink = document.createElement("a");
    titleLink.href = pdpUrl;
    titleLink.className = "title-link";
    titleLink.textContent = cardName(item);
    titleEl.appendChild(titleLink);
  } else {
    titleEl.textContent = cardName(item);
  }

  const descEl  = textEl("p",  "description", cardMeta(item));
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
  // priceText() in priceMap.js tests `typeof === "number"`; this used to test
  // truthiness, so a product priced 0 showed the "$" tier here and $0.00 on the
  // PDP. One rule, one place.
  actualPrice.textContent = priceText(item);

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

/** The type word people already see in the meta line, so the name drops it. */
const TYPE_WORDS = /\s*[-–·]?\s*\b(t-?shirts?|tees?|shirts?|totes?|tote bags?|bags?|bottles?|water bottles?|flasks?|magnets?|fridge magnets?|hoodies?|mugs?|stickers?)\b(?=\s*(?:[·\-–]\s*no\.?\s*\d+)?\s*$)/i;
export function cardName(item) {
  const raw = String(item.title || "").replace(/^kaayko\s+/i, "").trim();
  const short = raw.replace(TYPE_WORDS, "").replace(/^\s*[·\-–]\s*/, "").trim();
  return short.length >= 3 ? short : raw;
}

/** One quiet line: New · Bottle · 1963 stamp. The year comes from the description when it names one. */
export function cardMeta(item) {
  const parts = [];
  if (isNew(item)) parts.push("New");
  const type = labelForType(item.productType, { singular: true });
  if (type) parts.push(type);
  const year = String(item.description || "").match(/\b(1[89]\d{2}|20[0-2]\d)\b/);
  if (year) parts.push(`${year[1]} stamp`);
  else if (item.theme) parts.push(String(item.theme).slice(0, 24));
  return parts.join(" · ");
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

function buildImageContainer(item, heartButton) {
  const container = document.createElement("div");
  container.className = "img-container";

  // Use the 1600px preview tier for carousel cards. Falls back to the full
  // imgSrc for legacy products without previews. The zoom modal still opens
  // the full 3600px imgSrc — see openModal().
  const previews = (item.previewSrc && item.previewSrc.length === item.imgSrc.length)
    ? item.previewSrc
    : item.imgSrc;
  // Only the cover carries a real src. display:none does NOT stop a browser
  // fetching an <img>, so the grid used to pull every photo of every product
  // (143 files) before the shopper scrolled. Hidden slides get their src the
  // first time they are shown (dot click / swipe) — see showSlide().
  previews.forEach((url, i) => {
    const img      = document.createElement("img");
    if (i === 0) { img.src = url; img.loading = "lazy"; }
    else { img.dataset.src = url; }
    img.decoding   = "async";
    img.alt        = galleryAlt(item.title, i, previews.length);
    img.className  = "carousel-image";
    img.style.display = i === 0 ? "block" : "none";
    container.append(img);
  });

  container.append(heartButton);

  // "New" is said in the meta line under the name, not as a pill on the photograph.

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

/** Reveal slide i, attaching its src on first show and warming the next one. */
function showSlide(imgs, i) {
  const img = imgs[i];
  if (!img) return;
  if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
  const next = imgs[(i + 1) % imgs.length];
  if (next && next.dataset.src) { next.src = next.dataset.src; delete next.dataset.src; }
  img.style.display = "block";
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
      showSlide(imgs, i);
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
    showSlide(imgs, idx);
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
   3) The heart. A private mark, not a score: the count is never shown, there is
   no "most loved" sort and no vote filter — the store keeps no social proof.
   The vote still reaches the server as the one signal the owner reads.
   ========================================================================== */
function createLikeButton(item) {
  const btn = document.createElement("button");
  btn.className = "heart-button image-overlay-control material-icons";
  btn.type = "button";
  btn.setAttribute("aria-label", "Love this");

  let liked = false;

  function refresh() {
    btn.classList.toggle("liked", liked);
    btn.setAttribute("aria-pressed", String(liked));
    btn.textContent = liked ? "favorite" : "favorite_border";
  }
  refresh();

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const delta = liked ? -1 : 1;
    liked = !liked;
    refresh();
    try {
      await voteOnProduct(item.id, delta);
    } catch (err) {
      console.error("Vote error:", err);
      liked = !liked;
      refresh();
    }
  });

  return btn;
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
cartManager.subscribe(() => {
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

    const inBag = !!cartManager.hasProduct(item.id);
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
