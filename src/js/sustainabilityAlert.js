// File: js/sustainabilityAlert.js
/**
 * Sustainability Alert Modal
 * Shows when user tries to add more than 2 unique products
 */

export function showSustainabilityAlert() {
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
          <span class="material-icons">eco</span>
        </div>
        <h2>Sustainability First</h2>
        <p>
          We believe in mindful consumption. You can select up to <strong>2 unique designs</strong> per order.
        </p>
        <p class="sustainability-reason">
          This conscious choice reduces waste, minimizes environmental impact, and supports our 
          commitment to sustainable print-on-demand practices.
        </p>
        <div class="sustainability-alert-actions">
          <button class="alert-btn alert-btn-secondary" data-action="ok">OK</button>
          <button class="alert-btn alert-btn-primary" data-action="checkout">Checkout Now</button>
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
      window.location.href = 'cart.html';
    });
    
    // Close on overlay click
    modal.querySelector('.sustainability-alert-overlay').addEventListener('click', () => {
      hideAlert();
    });
  }
  
  function hideAlert() {
    modal.classList.remove('active');
  }
  
  // Show modal
  modal.classList.add('active');
}

// Make globally available
window.showSustainabilityAlert = showSustainabilityAlert;
