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

  // Show filter modal
  function showFilter() {
    console.log('🎯 Attempting to show filter modal...');
    if (filterOverlay) {
      filterOverlay.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
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
    });
  }
});

function initializeFilterChips() {
  // Initialize price chips
  const priceChips = document.getElementById('price-chips');
  if (priceChips) {
    const priceOptions = ['$', '$$', '$$$', '$$$$'];
    priceOptions.forEach(price => {
      const chip = createChip(price, 'price');
      priceChips.appendChild(chip);
    });
  }

  // Initialize tag chips
  const tagChips = document.getElementById('tag-chips');
  if (tagChips) {
    const tagOptions = ['T-Shirt', 'Rebel', 'Heritage', 'Philosophy', 'Nostalgia', 'Originals'];
    tagOptions.forEach(tag => {
      const chip = createChip(tag, 'tag');
      tagChips.appendChild(chip);
    });
  }
}

function createChip(text, type) {
  const chip = document.createElement('button');
  chip.className = 'chip';
  chip.textContent = text;
  chip.dataset.type = type;
  chip.dataset.value = text;
  
  chip.addEventListener('click', function() {
    chip.classList.toggle('selected');
    console.log(`📝 ${type} filter ${chip.classList.contains('selected') ? 'selected' : 'deselected'}: ${text}`);
  });
  
  return chip;
}

function initializeSlider() {
  const slider = document.getElementById('votes-slider');
  const valueDisplay = document.getElementById('votes-value');
  
  if (slider && valueDisplay) {
    // Set initial range (you might want to get this from your data)
    slider.min = 0;
    slider.max = 25;
    slider.value = 0;
    
    slider.addEventListener('input', function() {
      valueDisplay.textContent = slider.value;
    });
    
    slider.addEventListener('change', function() {
      console.log(`📊 Min votes filter: ${slider.value}`);
    });
  }
}

function resetAllFilters() {
  // Reset all chip selections
  const selectedChips = document.querySelectorAll('.chip.selected');
  selectedChips.forEach(chip => {
    chip.classList.remove('selected');
  });
  
  // Reset slider
  const slider = document.getElementById('votes-slider');
  const valueDisplay = document.getElementById('votes-value');
  if (slider && valueDisplay) {
    slider.value = 0;
    valueDisplay.textContent = '0';
  }
  
  console.log('🔄 All filters reset');
}

// Store original products for filtering
let originalProducts = [];

// Function to store original products (called from kaayko-main.js)
function storeOriginalProducts(products) {
  originalProducts = products;
  console.log('💾 Stored', originalProducts.length, 'original products for filtering');
}

// Function to get current filter criteria
function getCurrentFilters() {
  const filters = {
    prices: [],
    tags: [],
    minVotes: 0
  };
  
  // Get selected price chips
  const selectedPriceChips = document.querySelectorAll('.chip[data-type="price"].selected');
  filters.prices = Array.from(selectedPriceChips).map(chip => chip.dataset.value);
  
  // Get selected tag chips
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

// Function to apply filters to products
function applyFilters() {
  const filters = getCurrentFilters();
  
  if (originalProducts.length === 0) {
    console.warn('⚠️ No original products stored. Cannot filter.');
    return;
  }
  
  let filteredProducts = originalProducts.filter(product => {
    // Price filter
    if (filters.prices.length > 0 && !filters.prices.includes(product.price)) {
      return false;
    }
    
    // Tags filter
    if (filters.tags.length > 0) {
      const hasMatchingTag = filters.tags.some(filterTag => 
        product.tags && product.tags.includes(filterTag)
      );
      if (!hasMatchingTag) {
        return false;
      }
    }
    
    // Min votes filter
    if (product.votes < filters.minVotes) {
      return false;
    }
    
    return true;
  });
  
  console.log(`🔍 Filtered ${originalProducts.length} products down to ${filteredProducts.length}`);
  
  // Re-populate carousel with filtered products
  if (window.populateCarousel) {
    window.populateCarousel(filteredProducts);
  } else {
    console.error('❌ populateCarousel function not available');
  }
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