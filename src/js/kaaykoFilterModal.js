/**
 * File: kaaykoFilterModal.js
 * Handles the filter modal functionality for the store page.
 * Shows/hides the filter overlay and manages filter interactions.
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('🔧 Filter modal script loaded');
  
  const filterToggle = document.getElementById('filter-toggle');
  const filterOverlay = document.querySelector('.filter-overlay');
  const filterClose = document.getElementById('filter-close');
  const filterApply = document.getElementById('filter-apply');
  const filterReset = document.getElementById('filter-reset');

  console.log('🔍 Filter elements found:', {
    toggle: !!filterToggle,
    overlay: !!filterOverlay,
    close: !!filterClose,
    apply: !!filterApply,
    reset: !!filterReset
  });

  // The control that opened the dialog; focus returns there on close (2.4.3).
  let filterOpener = null;

  // Show filter modal
  function showFilter() {
    console.log('🎯 Attempting to show filter modal...');
    if (filterOverlay) {
      filterOpener = (document.activeElement && document.activeElement !== document.body)
        ? document.activeElement
        : filterToggle;
      filterOverlay.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      // Move focus into the dialog; its name (#filter-title) is announced on entry.
      const first = filterOverlay.querySelector('#filter-close');
      if (first) first.focus();
      console.log('✅ Filter modal shown');
    } else {
      console.error('❌ Filter overlay not found');
    }
  }

  // Hide filter modal
  function hideFilter() {
    console.log('🎯 Hiding filter modal...');
    if (filterOverlay) {
      filterOverlay.classList.remove('active');
      document.body.style.overflow = ''; // Restore scrolling
      if (filterOpener && typeof filterOpener.focus === 'function' && document.contains(filterOpener)) {
        filterOpener.focus();
      }
      filterOpener = null;
      console.log('✅ Filter modal hidden');
    }
  }

  // Event listeners
  if (filterToggle) {
    console.log('🎯 Adding click listener to filter toggle');
    filterToggle.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('🖱️ Filter toggle clicked!');
      showFilter();
    });
  } else {
    console.error('❌ Filter toggle button not found');
  }

  if (filterClose) {
    filterClose.addEventListener('click', hideFilter);
  }

  if (filterOverlay) {
    // Close when clicking outside the panel
    filterOverlay.addEventListener('click', function(e) {
      if (e.target === filterOverlay) {
        hideFilter();
      }
    });

    // Keep Tab inside the open dialog (2.1.2).
    filterOverlay.addEventListener('keydown', function(e) {
      if (e.key !== 'Tab' || !filterOverlay.classList.contains('active')) return;
      const focusables = Array.from(
        filterOverlay.querySelectorAll('button:not([disabled]), input:not([disabled]), a[href]')
      ).filter(el => el.offsetParent !== null);
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
  }

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && filterOverlay && filterOverlay.classList.contains('active')) {
      hideFilter();
    }
  });

  // Initialize filter chips and functionality
  initializeFilterChips();
  initializeSlider();

  // Filter apply button
  if (filterApply) {
    filterApply.addEventListener('click', function() {
      console.log('🔍 Applying filters...');
      applyFilters();
      hideFilter();
    });
  }

  // Filter reset button
  if (filterReset) {
    filterReset.addEventListener('click', function() {
      console.log('🔄 Resetting filters...');
      resetAllFilters();
      clearFiltersAndShowAll();
      // Reset IS the intent — don't make the shopper close the modal as well.
      hideFilter();
    });
  }
});

const TYPE_CHIP_OPTIONS = [
  { value: 'tote',    label: 'Totes' },
  { value: 'magnet',  label: 'Magnets' },
  { value: 'tshirt',  label: 'T-Shirts' },
  { value: 'print',   label: 'Prints' },
  { value: 'poster',  label: 'Posters' },
  { value: 'sticker', label: 'Stickers' },
  { value: 'mug',     label: 'Mugs' },
  { value: 'cap',     label: 'Caps' },
  { value: 'bottle',  label: 'Bottles' }
];

// Price is filtered as a number, not as a tier symbol. Tier symbols excluded every product
// carrying a literal price (the bottles at $24.99), and they mean nothing to a shopper.
const PRICE_BANDS = [
  { value: 'under-25', label: 'Under $25', min: 0,  max: 25 },
  { value: '25-35',    label: '$25 – $35', min: 25, max: 35 },
  { value: '35-50',    label: '$35 – $50', min: 35, max: 50 },
  { value: 'over-50',  label: '$50+',      min: 50, max: Infinity }
];

// This file is loaded as a classic script, not a module, so it cannot import priceMap.js.
// Mirror of PRICE_MAP in /js/priceMap.js — change both together.
const PRICE_TIER_VALUES = { '$': 19.99, '$$': 29.99, '$$$': 39.99, '$$$$': 49.99 };

function priceOf(product) {
  if (typeof product?.actualPrice === 'number' && product.actualPrice > 0) return product.actualPrice;
  const raw = String(product?.price ?? '').trim();
  if (PRICE_TIER_VALUES[raw]) return PRICE_TIER_VALUES[raw];
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function matchesPriceBands(product, bandValues) {
  if (!bandValues.length) return true;
  const value = priceOf(product);
  return bandValues.some(v => {
    const band = PRICE_BANDS.find(b => b.value === v);
    return band && value >= band.min && value < band.max;
  });
}

// How many tag chips to surface in the modal (top-N by frequency).
const MAX_TAG_CHIPS = 8;

function initializeFilterChips() {
  // Type chips — always all the supported types (so the catalogue can grow).
  const typeChips = document.getElementById('type-chips');
  if (typeChips) {
    typeChips.innerHTML = '';
    TYPE_CHIP_OPTIONS.forEach(opt => {
      const chip = createChip(opt.label, 'type');
      chip.dataset.value = opt.value;
      typeChips.appendChild(chip);
    });
  }

  // Price chips — fixed symbol set.
  const priceChips = document.getElementById('price-chips');
  if (priceChips) {
    priceChips.innerHTML = '';
    PRICE_BANDS.forEach(band => {
      priceChips.appendChild(createChip(band.label, 'price', band.value));
    });
  }

  // Tag chips are populated dynamically once products land.
}

function createChip(text, type, value) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = text;
  chip.dataset.type = type;
  // Label and value differ for price bands ("Under $25" -> "under-25").
  chip.dataset.value = value === undefined ? text : value;
  chip.setAttribute('aria-pressed', 'false');

  chip.addEventListener('click', function() {
    const nowSelected = !chip.classList.contains('selected');
    chip.classList.toggle('selected', nowSelected);
    chip.setAttribute('aria-pressed', String(nowSelected));
    updateSectionCounts();
    updateApplyButtonLabel();
  });

  return chip;
}

function updateSectionCounts() {
  document.querySelectorAll('.filter-section-count').forEach(el => {
    const section = el.dataset.section;
    const n = document.querySelectorAll(`.chip[data-type="${section}"].selected`).length;
    el.dataset.count = String(n);
    el.textContent = `${n} selected`;
  });
}

function updateApplyButtonLabel() {
  const btn = document.getElementById('filter-apply');
  if (!btn) return;
  // Apply current chip selections + slider against originalProducts to get the live count.
  const previewFilters = getCurrentFilters();
  const anyActive = previewFilters.types.length || previewFilters.prices.length || previewFilters.themes.length || previewFilters.tags.length || previewFilters.minVotes > 0;
  if (!anyActive) {
    btn.textContent = `Show all products`;
    return;
  }
  const count = matchCount(originalProducts, previewFilters);
  btn.textContent = count === 1 ? `Show 1 product` : `Show ${count} products`;
}

function matchCount(products, filters) {
  return products.filter(p => {
    if (p.isAvailable === false) return false;
    if (filters.types.length && !filters.types.includes((p.productType || '').toLowerCase())) return false;
    if (!matchesPriceBands(p, filters.prices)) return false;
    if (filters.themes?.length && !filters.themes.includes(p.theme)) return false;
    if (filters.tags.length) {
      const ok = filters.tags.some(t => (p.tags || []).includes(t));
      if (!ok) return false;
    }
    if ((p.votes || 0) < filters.minVotes) return false;
    return true;
  }).length;
}

function initializeSlider() {
  const slider = document.getElementById('votes-slider');
  const valueDisplay = document.getElementById('votes-value');
  if (!slider || !valueDisplay) return;

  slider.min = 0;
  slider.max = slider.max || 25;
  slider.value = 0;

  const syncProgress = () => {
    const max = parseFloat(slider.max) || 1;
    const pct = Math.max(0, Math.min(100, (parseFloat(slider.value) / max) * 100));
    slider.style.setProperty('--progress', `${pct}%`);
    valueDisplay.textContent = slider.value;
  };

  slider.addEventListener('input', () => {
    syncProgress();
    updateApplyButtonLabel();
  });
  syncProgress();
}

function resetAllFilters() {
  document.querySelectorAll('.chip.selected').forEach(chip => {
    chip.classList.remove('selected');
    chip.setAttribute('aria-pressed', 'false');
  });

  const slider = document.getElementById('votes-slider');
  const valueDisplay = document.getElementById('votes-value');
  if (slider && valueDisplay) {
    slider.value = 0;
    slider.style.setProperty('--progress', '0%');
    valueDisplay.textContent = '0';
  }

  updateSectionCounts();
  updateApplyButtonLabel();
}

// Store original products for filtering
let originalProducts = [];

// Function to store original products (called from kaayko-main.js).
// We use this moment to populate tag chips dynamically + size the slider.
function storeOriginalProducts(products) {
  hydrateThemeChips(products);
  originalProducts = products;
  console.log('💾 Stored', originalProducts.length, 'original products for filtering');
  hydrateDynamicFilters(products);
}

function hydrateDynamicFilters(products) {
  const tagChips = document.getElementById('tag-chips');
  if (tagChips) {
    tagChips.innerHTML = '';
    // Type-token tags are redundant with the Type filter; hide them here.
    const typeTokens = new Set(['T-Shirt', 't-shirt', 'tote', 'magnet', 'print', 'poster', 'sticker', 'mug', 'cap']);
    const counts = new Map();
    for (const p of products) {
      if (p.isAvailable === false) continue;
      for (const tag of (p.tags || [])) {
        if (!tag || typeTokens.has(tag)) continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TAG_CHIPS);
    if (top.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'filter-empty';
      empty.textContent = 'No tags yet.';
      tagChips.appendChild(empty);
    } else {
      top.forEach(([tag]) => tagChips.appendChild(createChip(tag, 'tag')));
    }
  }

  const slider = document.getElementById('votes-slider');
  const valueDisplay = document.getElementById('votes-value');
  if (slider && valueDisplay) {
    const maxVotes = products.reduce((m, p) => Math.max(m, p.votes || 0), 0);
    slider.max = Math.max(1, maxVotes);
    slider.value = 0;
    slider.style.setProperty('--progress', '0%');
    valueDisplay.textContent = '0';
  }

  updateSectionCounts();
  updateApplyButtonLabel();
}

// Function to get current filter criteria
/** Theme is a first-class facet on the product model now (Wildlife, Heritage, Philately…). */
function hydrateThemeChips(products) {
  const host = document.getElementById('theme-chips');
  if (!host) return;
  const counts = new Map();
  for (const p of products) {
    const t = (p.theme || '').trim();
    if (t) counts.set(t, (counts.get(t) || 0) + 1);
  }
  host.innerHTML = '';
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([theme]) => host.appendChild(createChip(theme, 'theme')));
  const section = host.closest('.filter-section');
  if (section) section.hidden = counts.size < 2;
}

function getCurrentFilters() {
  const filters = {
    types: [],
    prices: [],
    themes: [],
    tags: [],
    minVotes: 0
  };

  // Get selected type chips
  const selectedTypeChips = document.querySelectorAll('.chip[data-type="type"].selected');
  filters.types = Array.from(selectedTypeChips).map(chip => chip.dataset.value);

  // Get selected price chips
  const selectedPriceChips = document.querySelectorAll('.chip[data-type="price"].selected');
  filters.prices = Array.from(selectedPriceChips).map(chip => chip.dataset.value);

  // Get selected tag chips
  const selectedThemeChips = document.querySelectorAll('.chip[data-type="theme"].selected');
  filters.themes = Array.from(selectedThemeChips).map(chip => chip.dataset.value);

  const selectedTagChips = document.querySelectorAll('.chip[data-type="tag"].selected');
  filters.tags = Array.from(selectedTagChips).map(chip => chip.dataset.value);

  // Get min votes
  const slider = document.getElementById('votes-slider');
  if (slider) {
    filters.minVotes = parseInt(slider.value) || 0;
  }

  console.log('🎯 Current filters:', filters);
  return filters;
}

function applyFilters() {
  if (originalProducts.length === 0) return;
  const filters = getCurrentFilters();
  const filteredProducts = originalProducts.filter(p => {
    if (filters.types.length && !filters.types.includes((p.productType || '').toLowerCase())) return false;
    if (!matchesPriceBands(p, filters.prices)) return false;
    if (filters.themes?.length && !filters.themes.includes(p.theme)) return false;
    if (filters.tags.length) {
      const ok = filters.tags.some(t => (p.tags || []).includes(t));
      if (!ok) return false;
    }
    if ((p.votes || 0) < filters.minVotes) return false;
    return true;
  });
  if (window.populateCarousel) window.populateCarousel(filteredProducts);
}

// Function to clear filters and show all products
function clearFiltersAndShowAll() {
  if (originalProducts.length > 0 && window.populateCarousel) {
    window.populateCarousel(originalProducts);
    console.log('🔄 Showing all', originalProducts.length, 'products');
  }
}

// Make functions available globally
window.storeOriginalProducts = storeOriginalProducts;
window.applyFilters = applyFilters;
window.clearFiltersAndShowAll = clearFiltersAndShowAll;