// File: js/sustainabilityAlert.js
/**
 * Sustainability Alert Modal
 * Shows when user tries to add more than 2 unique products
 */

export function showSustainabilityAlert(context = {}) {
  const attemptedProduct = context?.attemptedProduct || null;
  const cartCount = context?.cartCount ?? 2;

  // Create modal if doesn't exist
  let modal = document.getElementById('sustainability-alert');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'sustainability-alert';
    modal.className = 'sustainability-alert-modal';
    
    modal.innerHTML = `
      <div class="sustainability-alert-overlay"></div>
      <div class="sustainability-alert-content">
        <div class="sustainability-alert-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true" class="sustainability-alert-leaf">
            <path d="M20.2 3.9c-5.6-.5-9.9 1-12.7 3.8-3.2 3.2-3.9 7.7-1.9 11.2l3.1-3.1c.2-2.1 1.1-4.1 2.7-5.7 1.8-1.8 4.2-2.8 7.3-3-.2 3.1-1.2 5.5-3 7.3-1.6 1.6-3.6 2.5-5.7 2.7l-3.1 3.1c3.5 2 8 1.3 11.2-1.9 2.8-2.8 4.3-7.1 3.8-12.7-.1-.5-.5-.9-1-.9-.2 0-.4 0-.7.2z"/>
          </svg>
        </div>
        <h2>2-design limit reached</h2>
        <p class="sustainability-limit-copy">
          Your bag currently has <strong>${cartCount} unique designs</strong>.
        </p>
        <p class="sustainability-context-copy"></p>
        <p class="sustainability-reason">
          We cap each order at two designs to reduce waste and keep print-on-demand production intentional.
        </p>
        <div class="sustainability-alert-actions">
          <button class="alert-btn alert-btn-secondary" data-action="ok">Keep browsing</button>
          <button class="alert-btn alert-btn-primary" data-action="checkout">Review bag</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Button handlers
    modal.querySelector('[data-action="ok"]').addEventListener('click', () => {
      hideAlert();
    });
    
    modal.querySelector('[data-action="checkout"]').addEventListener('click', () => {
      hideAlert();
      // Navigate to cart page
      window.location.href = 'cart';
    });
    
    // Close on overlay click
    modal.querySelector('.sustainability-alert-overlay').addEventListener('click', () => {
      hideAlert();
    });
  }

  const contextEl = modal.querySelector('.sustainability-context-copy');
  if (contextEl) {
    contextEl.textContent = attemptedProduct
      ? `Add ${attemptedProduct} after removing one design from your current bag.`
      : 'Remove one current design if you want to add another item.';
  }
  
  function hideAlert() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Show modal
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Make globally available
window.showSustainabilityAlert = showSustainabilityAlert;
