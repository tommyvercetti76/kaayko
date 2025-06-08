/**
 * File: scripts/kaaykoFilterModal.js
 *
 * Builds & controls the filter modal with faceted chips for Price & Tags,
 * plus a Min-Votes slider.
 *
 * Features:
 *  - Price & Tag selection via chips (toggleable)
 *  - On Apply → re-renders carousel & toggles filter icon active
 *  - On Reset → clears state, shows ALL products & resets icon
 *  - Escape-key to close, scroll-lock, focus management
 *  - Dynamically disables chips with no matching products
 */

import { getAllProducts } from './kaayko_apiClient.js';
import { populateCarousel } from './kaayko_ui.js';

/////////////////////
// Module-level State
/////////////////////
let allItems = [];
let priceList = [];
let tagList = [];
const currentFilters = {
  price: null,
  tags: new Set(),
  minVotes: 0,
};

const FILTER_BTN_ID = 'filter-toggle';
const OVERLAY_CLS   = 'filter-overlay';

/////////////////////
// Initialization
/////////////////////
window.addEventListener('DOMContentLoaded', initializeFilterModal);

async function initializeFilterModal() {
  try {
    allItems = await getAllProducts();
  } catch (err) {
    console.error('Filter → failed to load products', err);
    return;
  }
  buildFilterModal();    // generate chips & slider, wire events
  setupFilterToggle();   // open/close
  setupEscapeKey();      // Esc to close
}

/////////////////////
// Open / Close
/////////////////////
function setupFilterToggle() {
  const btn = document.getElementById(FILTER_BTN_ID);
  if (!btn) return;
  btn.addEventListener('click', openFilter);
}

function openFilter() {
  const overlay = document.querySelector(`.${OVERLAY_CLS}`);
  overlay.classList.add('active');
  document.body.classList.add('no-scroll');
  overlay.querySelector('.filter-panel').focus();
}

function closeFilter() {
  const overlay = document.querySelector(`.${OVERLAY_CLS}`);
  overlay.classList.remove('active');
  document.body.classList.remove('no-scroll');
  document.getElementById(FILTER_BTN_ID)?.focus();
}

function setupEscapeKey() {
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.querySelector(`.${OVERLAY_CLS}.active`)) {
      closeFilter();
    }
  });
}

/////////////////////
// Build Modal UI
/////////////////////
function buildFilterModal() {
  const overlay = document.querySelector(`.${OVERLAY_CLS}`);
  const panel   = overlay.querySelector('.filter-panel');

  // compute unique sorted lists
  priceList = Array.from(new Set(allItems.map(i => i.price))).sort();
  tagList   = Array.from(new Set(allItems.flatMap(i => i.tags || []))).sort();

  // — PRICE CHIPS —
  const priceContainer = panel.querySelector('#price-chips');
  priceList.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = p;
    chip.dataset.value = p;
    chip.addEventListener('click', () => {
      // single-select price
      if (currentFilters.price === p) {
        currentFilters.price = null;
      } else {
        currentFilters.price = p;
      }
      updateChipSelection('#price-chips', currentFilters.price);
      updateDynamicState();
    });
    priceContainer.appendChild(chip);
  });

  // — TAG CHIPS —
  const tagContainer = panel.querySelector('#tag-chips');
  tagList.forEach(t => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = t;
    chip.dataset.value = t;
    chip.addEventListener('click', () => {
      if (currentFilters.tags.has(t)) currentFilters.tags.delete(t);
      else                              currentFilters.tags.add(t);
      updateChipSelection('#tag-chips', currentFilters.tags);
      updateDynamicState();
    });
    tagContainer.appendChild(chip);
  });

  // — VOTES SLIDER —
  const maxVote      = Math.max(0, ...allItems.map(i => i.votes || 0));
  const votesSlider  = panel.querySelector('#votes-slider');
  const votesValue   = panel.querySelector('#votes-value');
  votesSlider.min    = 0;
  votesSlider.max    = maxVote;
  votesSlider.value  = 0;
  votesValue.textContent = '0';
  votesSlider.addEventListener('input', e => {
    currentFilters.minVotes = +e.target.value;
    votesValue.textContent = e.target.value;
    updateDynamicState();
  });

  // — RESET —
  panel.querySelector('#filter-reset').addEventListener('click', () => {
    currentFilters.price = null;
    currentFilters.tags.clear();
    currentFilters.minVotes = 0;
    // reset UI
    updateChipSelection('#price-chips', null);
    updateChipSelection('#tag-chips', new Set());
    votesSlider.value = 0;
    votesValue.textContent = '0';
    // show all
    populateCarousel(allItems);
    document.getElementById(FILTER_BTN_ID).classList.remove('active');
    updateDynamicState();
  });

  // — APPLY —
  panel.querySelector('#filter-apply').addEventListener('click', () => {
    applyFilters();
    closeFilter();
  });

  // — CLOSE ICON & BACKDROP —
  panel.querySelector('.filter-close').addEventListener('click', closeFilter);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeFilter();
  });

  // initial state
  updateDynamicState();
}

/////////////////////
// Dynamic UI Updates
/////////////////////
function updateDynamicState() {
  // recompute baseline under price & votes
  const baseline = allItems.filter(item => {
    if (currentFilters.price && item.price !== currentFilters.price) return false;
    if ((item.votes || 0) < currentFilters.minVotes) return false;
    return true;
  });

  // price availability
  const availPrices = new Set(baseline.map(i => i.price));
  document.querySelectorAll('#price-chips .chip').forEach(chip => {
    const val = chip.dataset.value;
    chip.classList.toggle('selected', currentFilters.price === val);
    chip.classList.toggle('disabled', !availPrices.has(val));
  });

  // tag availability
  const availTags = new Set(baseline.flatMap(i => i.tags || []));
  document.querySelectorAll('#tag-chips .chip').forEach(chip => {
    const val = chip.dataset.value;
    chip.classList.toggle('selected', currentFilters.tags.has(val));
    chip.classList.toggle('disabled', !availTags.has(val));
  });
}

/////////////////////
// Filtering Logic
/////////////////////
function applyFilters() {
  const filtered = allItems.filter(item => {
    if (currentFilters.price && item.price !== currentFilters.price) return false;
    if (currentFilters.tags.size && !item.tags?.some(t => currentFilters.tags.has(t))) return false;
    if ((item.votes || 0) < currentFilters.minVotes) return false;
    return true;
  });

  populateCarousel(filtered);
  const btn = document.getElementById(FILTER_BTN_ID);
  const anyActive = currentFilters.price !== null
                 || currentFilters.tags.size > 0
                 || currentFilters.minVotes > 0;
  btn.classList.toggle('active', anyActive);
}

/////////////////////
// Utility: update selection visuals
/////////////////////
function updateChipSelection(selector, selected) {
  const chips = document.querySelectorAll(`${selector} .chip`);
  chips.forEach(chip => {
    const val = chip.dataset.value;
    if (selected instanceof Set) {
      chip.classList.toggle('selected', selected.has(val));
    } else {
      chip.classList.toggle('selected', val === selected);
    }
  });
}