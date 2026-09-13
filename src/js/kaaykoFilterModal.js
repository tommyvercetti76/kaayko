/**
 * kaaykoFilterModal.js — the Refine dialog on the store page.
 *
 * One browse system, two surfaces. The toolbar above the grid owns type, search
 * and sort; this dialog owns the two facets that need a moment's thought — theme
 * and tags — and hands its selection to kaayko_ui's browse state. Nothing here
 * re-renders the grid or keeps a second copy of the catalogue: Apply narrows the
 * cards in place, and the count on the Apply button is the count the grid will
 * show, computed by the same predicate.
 *
 * Deleted on 13 Sep 2026: the price bands (prices differ only by type, which the
 * toolbar already offers) and the "Min Votes" slider (a popularity contest the
 * store does not run).
 */
import { setBrowseRefinements, resetBrowse, countBrowseMatches, getBrowseState, foldSearch } from "/js/kaayko_ui.js";

const MAX_TAG_CHIPS = 8;

// Tags that only repeat what the type chips already say.
const TYPE_TOKENS = new Set(["t-shirt", "tshirt", "tee", "hoodie", "tote", "bottle", "magnet", "sticker", "mug"]);

let originalProducts = [];

/* ── Dialog plumbing ─────────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("filter-toggle");
  const overlay = document.querySelector(".filter-overlay");
  const close = document.getElementById("filter-close");
  const apply = document.getElementById("filter-apply");
  const reset = document.getElementById("filter-reset");
  if (!overlay) return;

  let opener = null;

  function show() {
    opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : toggle;
    syncChipsToState();
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
    close?.focus();
  }

  function hide() {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
    if (opener && typeof opener.focus === "function" && document.contains(opener)) opener.focus();
    opener = null;
  }

  toggle?.addEventListener("click", (e) => { e.preventDefault(); show(); });
  close?.addEventListener("click", hide);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) hide(); });

  // Keep Tab inside the open dialog.
  overlay.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !overlay.classList.contains("active")) return;
    const focusables = [...overlay.querySelectorAll("button:not([disabled]), input:not([disabled]), a[href]")]
      .filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("active")) hide();
  });

  apply?.addEventListener("click", () => {
    setBrowseRefinements(selectedRefinements());
    hide();
  });
  reset?.addEventListener("click", () => {
    clearChips();
    resetBrowse();
    hide();
  });

  // The toolbar's Clear button and the empty state both reset everything;
  // the chips in here must not still look selected afterwards.
  document.addEventListener("kaayko:browsereset", clearChips);
});

/* ── Chips ───────────────────────────────────────────────────────────────── */

function createChip(text, facet) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip";
  chip.textContent = text;
  chip.dataset.facet = facet;
  chip.dataset.value = text;
  chip.setAttribute("aria-pressed", "false");
  chip.addEventListener("click", () => {
    const on = !chip.classList.contains("selected");
    chip.classList.toggle("selected", on);
    chip.setAttribute("aria-pressed", String(on));
    updateSectionCounts();
    updateApplyLabel();
  });
  return chip;
}

function selectedRefinements() {
  const pick = (facet) => [...document.querySelectorAll(`.chip[data-facet="${facet}"].selected`)].map((c) => c.dataset.value);
  return { themes: pick("theme"), tags: pick("tag") };
}

function clearChips() {
  document.querySelectorAll(".chip.selected").forEach((chip) => {
    chip.classList.remove("selected");
    chip.setAttribute("aria-pressed", "false");
  });
  updateSectionCounts();
  updateApplyLabel();
}

/** Opening the dialog shows what is actually in force, not what was last clicked. */
function syncChipsToState() {
  const state = getBrowseState();
  document.querySelectorAll(".chip[data-facet]").forEach((chip) => {
    const facet = chip.dataset.facet;
    const on = facet === "theme"
      ? state.themes.includes(foldSearch(chip.dataset.value))
      : state.tags.includes(chip.dataset.value.toLowerCase());
    chip.classList.toggle("selected", on);
    chip.setAttribute("aria-pressed", String(on));
  });
  updateSectionCounts();
  updateApplyLabel();
}

function updateSectionCounts() {
  document.querySelectorAll(".filter-section-count").forEach((el) => {
    const n = document.querySelectorAll(`.chip[data-facet="${el.dataset.section}"].selected`).length;
    el.dataset.count = String(n);
    el.textContent = `${n} selected`;
  });
}

function updateApplyLabel() {
  const btn = document.getElementById("filter-apply");
  if (!btn) return;
  const picked = selectedRefinements();
  if (!picked.themes.length && !picked.tags.length) {
    btn.textContent = "Show all products";
    return;
  }
  const n = countBrowseMatches(picked);
  btn.textContent = n === 1 ? "Show 1 product" : `Show ${n} products`;
}

/* ── Hydration, once the catalogue lands ─────────────────────────────────── */

function hydrateThemeChips(products) {
  const host = document.getElementById("theme-chips");
  if (!host) return;
  const counts = new Map();
  for (const p of products) {
    if (p.isAvailable === false) continue;
    const t = (p.theme || "").trim();
    if (t) counts.set(t, (counts.get(t) || 0) + 1);
  }
  host.innerHTML = "";
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([theme]) => host.appendChild(createChip(theme, "theme")));
  const section = host.closest(".filter-section");
  if (section) section.hidden = counts.size < 2;
}

function hydrateTagChips(products) {
  const host = document.getElementById("tag-chips");
  if (!host) return;
  const themes = new Set(products.map((p) => (p.theme || "").toLowerCase()));
  const counts = new Map();
  for (const p of products) {
    if (p.isAvailable === false) continue;
    for (const tag of (p.tags || [])) {
      const key = String(tag).toLowerCase();
      if (!key || TYPE_TOKENS.has(key) || themes.has(key)) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  host.innerHTML = "";
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, MAX_TAG_CHIPS);
  if (!top.length) {
    const empty = document.createElement("p");
    empty.className = "filter-empty";
    empty.textContent = "No tags yet.";
    host.appendChild(empty);
    return;
  }
  top.forEach(([tag]) => host.appendChild(createChip(tag, "tag")));
}

/** Called from js/pages/store.js once the catalogue is in the grid. */
function storeOriginalProducts(products) {
  originalProducts = products;
  hydrateThemeChips(products);
  hydrateTagChips(products);
  updateSectionCounts();
  updateApplyLabel();
}

export { storeOriginalProducts };
