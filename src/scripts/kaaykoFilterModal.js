/**
 * File: scripts/kaaykoFilterModal.js
 * Builds & controls the filter modal:
 *  • Price (single-step slider)
 *  • Tags  (multi-checkbox)
 *  • Min votes (slider)
 *
 * On Apply → re-renders carousel & toggles header icon active.
 */

import { getAllProducts } from './kaayko_apiClient.js';
import { populateCarousel } from './kaayko_ui.js';

let allItems = [];
let priceList = [];
const currentFilters = {
  price:    null,
  tags:     new Set(),
  minVotes: 0,
};

const FILTER_BTN_ID = 'filter-toggle';
const OVERLAY_CLS   = 'filter-overlay';

window.addEventListener('DOMContentLoaded', initializeFilterModal);

async function initializeFilterModal() {
  try {
    allItems = await getAllProducts();
  } catch (err) {
    console.error('Filter → failed to load products', err);
    return;
  }
  buildFilterModal();    // setup sliders & checkboxes
  setupFilterToggle();   // wire header button
}

function setupFilterToggle() {
  const btn = document.getElementById(FILTER_BTN_ID);
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.querySelector(`.${OVERLAY_CLS}`).classList.add('active');
  });
}

function closeFilter() {
  document.querySelector(`.${OVERLAY_CLS}`).classList.remove('active');
}

function buildFilterModal() {
  const overlay = document.querySelector(`.${OVERLAY_CLS}`);
  const panel   = overlay.querySelector('.filter-panel');

  // — PRICE SLIDER —
  priceList = Array.from(new Set(allItems.map(i => i.price)))
                   .sort((a,b) => a.length - b.length);
  const priceSlider = panel.querySelector('#price-slider');
  const priceValue  = panel.querySelector('#price-value');
  priceSlider.min   = 0;
  priceSlider.max   = priceList.length - 1;
  priceSlider.step  = 1;
  priceSlider.value = 0;
  currentFilters.price = priceList[0] || null;
  priceValue.textContent = priceList[0] || '';
  priceSlider.addEventListener('input', e => {
    const idx = +e.target.value;
    currentFilters.price = priceList[idx];
    priceValue.textContent = priceList[idx];
  });

  // — TAG CHECKBOXES —
  const tagContainer = panel.querySelector('#tag-options');
  const tags = Array.from(new Set(allItems.flatMap(i => i.tags || []))).sort();
  tags.forEach(tag => {
    const label = document.createElement('label');
    label.innerHTML = `
      <input type="checkbox" value="${tag}" />
      <span>${tag}</span>
    `;
    tagContainer.append(label);
    const cb = label.querySelector('input');
    cb.addEventListener('change', () => {
      if (cb.checked) currentFilters.tags.add(tag);
      else             currentFilters.tags.delete(tag);
    });
  });

  // — VOTES SLIDER —
  const maxVote      = Math.max(0, ...allItems.map(i => i.votes || 0));
  const votesSlider  = panel.querySelector('#votes-slider');
  const votesValueEl = panel.querySelector('#votes-value');
  votesSlider.min    = 0;
  votesSlider.max    = maxVote;
  votesSlider.step   = 1;
  votesSlider.value  = 0;
  votesValueEl.textContent = '0';
  votesSlider.addEventListener('input', e => {
    currentFilters.minVotes = +e.target.value;
    votesValueEl.textContent = e.target.value;
  });

  // — RESET BUTTON —
  panel.querySelector('#filter-reset').addEventListener('click', () => {
    currentFilters.price    = priceList[0] || null;
    currentFilters.tags.clear();
    currentFilters.minVotes = 0;
    // reset UI
    priceSlider.value = 0;
    priceValue.textContent = priceList[0] || '';
    panel.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    votesSlider.value = 0;
    votesValueEl.textContent = '0';
  });

  // — APPLY BUTTON —
  panel.querySelector('#filter-apply').addEventListener('click', () => {
    applyFilters();
    closeFilter();
  });

  // — CLOSE ICON & BACKDROP —
  panel.querySelector('.filter-close').addEventListener('click', closeFilter);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeFilter();
  });
}

function applyFilters() {
  const filtered = allItems.filter(item => {
    if (currentFilters.price && item.price !== currentFilters.price) return false;
    if (currentFilters.tags.size && !item.tags?.some(t => currentFilters.tags.has(t))) return false;
    if ((item.votes || 0) < currentFilters.minVotes) return false;
    return true;
  });

  populateCarousel(filtered);

  // toggle header icon active style
  const btn = document.getElementById(FILTER_BTN_ID);
  const anyActive = currentFilters.price !== priceList[0]
                 || currentFilters.tags.size > 0
                 || currentFilters.minVotes > 0;
  btn.classList.toggle('active', anyActive);

  // optional toast (uncomment if you have a toast system)
  // showToast(`✅ Filters applied — ${filtered.length} items`);
}