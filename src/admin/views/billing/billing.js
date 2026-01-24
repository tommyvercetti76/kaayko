/**
 * Billing View Module
 * Subscription management and payment handling
 */

import { CONFIG, AUTH, utils, STATE } from '../../js/smartlinks-core.js';
import { apiFetch } from '../../js/config.js';

// Plan configurations
const PLANS = {
  starter: {
    name: 'Starter',
    price: 0,
    links: 25,
    clicks: Infinity,
    features: ['25 smart links', 'Basic analytics', 'Standard QR codes', 'Email support'],
    stripePriceId: null
  },
  pro: {
    name: 'Pro',
    price: 29,
    links: 500,
    clicks: Infinity,
    features: ['500 smart links', 'Advanced analytics', 'Branded QR codes', 'Priority support', '1 custom domain', 'API access (5K/mo)'],
    stripePriceId: 'price_pro_monthly'
  },
  business: {
    name: 'Business',
    price: 99,
    links: 2500,
    clicks: Infinity,
    features: ['2,500 smart links', 'Team analytics', 'White-label QR', 'Dedicated support', '5 custom domains', 'API access (25K/mo)'],
    stripePriceId: 'price_business_monthly'
  },
  enterprise: {
    name: 'Enterprise',
    price: null,
    links: Infinity,
    clicks: Infinity,
    features: ['Unlimited links', 'Enterprise analytics', 'Full customization', '24/7 support + SLA', 'Unlimited domains', 'Unlimited API'],
    stripePriceId: null
  }
};

// Current subscription state
let currentPlan = 'starter';
let stripeInstance = null;
let cardElement = null;

/**
 * Initialize billing view
 */
export async function init(state) {
  console.log('💳 Loading Billing...');
  
  // Load HTML template
  await loadBillingHTML();
  
  // Load current subscription
  await loadSubscription();
  
  // Setup event listeners
  setupEventListeners();
  
  console.log('✅ Billing view initialized');
}

/**
 * Load billing HTML template
 */
async function loadBillingHTML() {
  const container = document.getElementById('billing-view');
  if (!container) return;
  
  try {
    const response = await fetch('views/billing/billing.html');
    if (response.ok) {
      const html = await response.text();
      container.innerHTML = html;
    } else {
      container.innerHTML = '<div class="error">Failed to load billing view</div>';
    }
  } catch (err) {
    console.error('Failed to load billing HTML:', err);
    container.innerHTML = '<div class="error">Failed to load billing view</div>';
  }
}

/**
 * Load current subscription details
 */
async function loadSubscription() {
  const planCard = document.getElementById('current-plan-card');
  
  try {
    // Try to get subscription from API
    const res = await apiFetch('/billing/subscription');
    
    if (res && res.ok) {
      const data = await res.json();
      if (data.success && data.subscription) {
        currentPlan = data.subscription.plan || 'starter';
        renderCurrentPlan(data.subscription);
        return;
      }
    }
    
    // Default to starter plan
    currentPlan = 'starter';
    renderCurrentPlan({
      plan: 'starter',
      linksUsed: STATE.links?.length || 0,
      clicksUsed: STATE.links?.reduce((sum, l) => sum + (l.clickCount || 0), 0) || 0
    });
    
  } catch (err) {
    console.error('Failed to load subscription:', err);
    // Fall back to showing starter plan
    renderCurrentPlan({
      plan: 'starter',
      linksUsed: 0,
      clicksUsed: 0
    });
  }
}

/**
 * Render current plan details
 */
function renderCurrentPlan(subscription) {
  const plan = PLANS[subscription.plan] || PLANS.starter;
  
  // Update plan badge
  const badge = document.getElementById('plan-badge');
  if (badge) {
    badge.textContent = plan.name.toUpperCase();
    badge.className = `plan-badge plan-badge-${subscription.plan}`;
  }
  
  // Update plan name
  const nameEl = document.getElementById('plan-name');
  if (nameEl) {
    nameEl.textContent = `${plan.name} Plan`;
  }
  
  // Update price
  const priceEl = document.getElementById('plan-price');
  if (priceEl) {
    priceEl.textContent = plan.price === 0 ? 'Free' : `$${plan.price}`;
  }
  
  // Update features
  const featuresEl = document.getElementById('plan-features');
  if (featuresEl) {
    featuresEl.innerHTML = plan.features.map(f => `
      <div class="feature-item">✓ ${f}</div>
    `).join('');
  }
  
  // Update usage
  const linksUsed = subscription.linksUsed || STATE.links?.length || 0;
  const linksLimit = plan.links;
  const linksPercent = linksLimit === Infinity ? 0 : Math.min(100, (linksUsed / linksLimit) * 100);
  
  const linksUsageFill = document.getElementById('links-usage-fill');
  const linksUsageCount = document.getElementById('links-usage-count');
  if (linksUsageFill) {
    linksUsageFill.style.width = `${linksPercent}%`;
    linksUsageFill.className = `usage-fill ${linksPercent > 80 ? 'warning' : ''} ${linksPercent > 95 ? 'danger' : ''}`;
  }
  if (linksUsageCount) {
    linksUsageCount.textContent = `${linksUsed} / ${linksLimit === Infinity ? '∞' : linksLimit}`;
  }
  
  const clicksUsed = subscription.clicksUsed || STATE.links?.reduce((sum, l) => sum + (l.clickCount || 0), 0) || 0;
  const clicksLimit = plan.clicks;
  const clicksUsageCount = document.getElementById('clicks-usage-count');
  if (clicksUsageCount) {
    clicksUsageCount.textContent = `${clicksUsed.toLocaleString()} / ${clicksLimit === Infinity ? '∞' : clicksLimit.toLocaleString()}`;
  }
  
  // Update plan buttons
  updatePlanButtons(subscription.plan);
}

/**
 * Update plan selection buttons
 */
function updatePlanButtons(currentPlanId) {
  const planOptions = document.querySelectorAll('.plan-option');
  planOptions.forEach(option => {
    const planId = option.dataset.plan;
    const btn = option.querySelector('.plan-btn');
    const badge = option.querySelector('.plan-option-badge');
    
    if (planId === currentPlanId) {
      option.classList.add('current');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Current Plan';
        btn.className = 'btn-secondary plan-btn current-plan-btn';
      }
      if (!badge) {
        const newBadge = document.createElement('span');
        newBadge.className = 'plan-option-badge';
        newBadge.textContent = 'CURRENT';
        option.querySelector('.plan-option-header').appendChild(newBadge);
      }
    } else {
      option.classList.remove('current');
      if (btn && planId !== 'enterprise') {
        btn.disabled = false;
        btn.className = 'btn-primary plan-btn';
        
        // Check if upgrade or downgrade
        const currentPlanIndex = Object.keys(PLANS).indexOf(currentPlanId);
        const thisPlanIndex = Object.keys(PLANS).indexOf(planId);
        
        if (thisPlanIndex > currentPlanIndex) {
          btn.textContent = `Upgrade to ${PLANS[planId].name}`;
          btn.dataset.action = 'upgrade';
        } else {
          btn.textContent = `Downgrade to ${PLANS[planId].name}`;
          btn.dataset.action = 'downgrade';
        }
      }
      if (badge) badge.remove();
    }
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Upgrade button in header
  const upgradeBtn = document.getElementById('upgrade-btn');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', () => openUpgradeModal('pro'));
  }
  
  // Plan buttons - use event delegation for reliability
  const plansGrid = document.getElementById('plans-grid');
  if (plansGrid) {
    plansGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.plan-btn');
      if (!btn || btn.disabled) return;
      
      const action = btn.dataset.action;
      const plan = btn.dataset.plan || btn.closest('.plan-option')?.dataset.plan;
      
      if (action === 'upgrade' && plan) {
        openUpgradeModal(plan);
      } else if (action === 'downgrade' && plan) {
        confirmDowngrade(plan);
      } else if (action === 'contact') {
        openContactSales();
      }
    });
  }
  
  // Modal controls
  const closeModal = document.getElementById('close-upgrade-modal');
  const cancelUpgrade = document.getElementById('cancel-upgrade');
  const confirmUpgrade = document.getElementById('confirm-upgrade');
  const modal = document.getElementById('upgrade-modal');
  
  if (closeModal) closeModal.addEventListener('click', closeUpgradeModal);
  if (cancelUpgrade) cancelUpgrade.addEventListener('click', closeUpgradeModal);
  if (confirmUpgrade) confirmUpgrade.addEventListener('click', processUpgrade);
  
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeUpgradeModal();
    });
  }
  
  // Add payment method button
  const addPaymentBtn = document.getElementById('add-payment-btn');
  if (addPaymentBtn) {
    addPaymentBtn.addEventListener('click', showPaymentForm);
  }
  
  // Download invoices button
  const downloadInvoicesBtn = document.getElementById('download-invoices-btn');
  if (downloadInvoicesBtn) {
    downloadInvoicesBtn.addEventListener('click', downloadInvoices);
  }
}

/**
 * Open upgrade modal
 */
async function openUpgradeModal(planId) {
  const plan = PLANS[planId];
  if (!plan || !plan.stripePriceId) {
    utils.showError('This plan is not available for online upgrade');
    return;
  }
  
  // Update modal content
  document.getElementById('upgrade-plan-name').textContent = plan.name;
  document.getElementById('upgrade-amount').textContent = `$${plan.price}`;
  
  const featuresEl = document.getElementById('upgrade-features');
  if (featuresEl) {
    featuresEl.innerHTML = plan.features.map(f => `<li>✓ ${f}</li>`).join('');
  }
  
  // Show modal
  const modal = document.getElementById('upgrade-modal');
  modal.style.display = 'flex';
  modal.dataset.plan = planId;
  
  // Initialize Stripe if needed
  await initializeStripe();
}

/**
 * Close upgrade modal
 */
function closeUpgradeModal() {
  const modal = document.getElementById('upgrade-modal');
  modal.style.display = 'none';
}

/**
 * Initialize Stripe Elements
 */
async function initializeStripe() {
  if (stripeInstance) return true;
  
  const cardContainer = document.getElementById('card-element');
  
  // Load Stripe.js
  if (!window.Stripe) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Stripe.js'));
        document.head.appendChild(script);
      });
    } catch (err) {
      console.warn('Stripe.js not available:', err);
      if (cardContainer) {
        cardContainer.innerHTML = '<div class="stripe-unavailable">Payment processing unavailable. Please contact support.</div>';
      }
      return false;
    }
  }
  
  // Get publishable key from API
  try {
    const res = await apiFetch('/billing/config');
    if (res && res.ok) {
      const data = await res.json();
      if (data.publishableKey) {
        stripeInstance = Stripe(data.publishableKey);
        
        // Create card element
        const elements = stripeInstance.elements();
        cardElement = elements.create('card', {
          style: {
            base: {
              color: '#ffffff',
              fontFamily: '"SF Pro Display", -apple-system, sans-serif',
              fontSize: '16px',
              '::placeholder': { color: '#666' }
            },
            invalid: { color: '#ff4444' }
          }
        });
        
        if (cardContainer) {
          cardElement.mount('#card-element');
        }
        return true;
      }
    }
    
    // No publishable key configured
    if (cardContainer) {
      cardContainer.innerHTML = '<div class="stripe-unavailable">Payment processing not configured yet. Contact support to upgrade.</div>';
    }
    return false;
    
  } catch (err) {
    console.error('Failed to initialize Stripe:', err);
    if (cardContainer) {
      cardContainer.innerHTML = '<div class="stripe-unavailable">Payment system temporarily unavailable. Please try again later.</div>';
    }
    return false;
  }
}

/**
 * Process upgrade
 */
async function processUpgrade() {
  const modal = document.getElementById('upgrade-modal');
  const planId = modal.dataset.plan;
  const plan = PLANS[planId];
  
  const btnText = document.querySelector('#confirm-upgrade .btn-text');
  const btnLoading = document.querySelector('#confirm-upgrade .btn-loading');
  
  btnText.style.display = 'none';
  btnLoading.style.display = 'inline';
  
  try {
    // Create checkout session
    const res = await apiFetch('/billing/create-checkout', {
      method: 'POST',
      body: JSON.stringify({
        planId: planId,
        priceId: plan.stripePriceId
      })
    });
    
    if (res && res.ok) {
      const data = await res.json();
      if (data.sessionId && stripeInstance) {
        // Redirect to Stripe Checkout
        await stripeInstance.redirectToCheckout({ sessionId: data.sessionId });
      } else if (data.url) {
        // Direct URL redirect
        window.location.href = data.url;
      }
    } else {
      throw new Error('Failed to create checkout session');
    }
    
  } catch (err) {
    console.error('Upgrade failed:', err);
    utils.showError('Failed to process upgrade. Please try again.');
  } finally {
    btnText.style.display = 'inline';
    btnLoading.style.display = 'none';
  }
}

/**
 * Confirm downgrade
 */
function confirmDowngrade(planId) {
  const plan = PLANS[planId];
  
  if (confirm(`Are you sure you want to downgrade to the ${plan.name} plan? This will take effect at the end of your current billing period.`)) {
    processDowngrade(planId);
  }
}

/**
 * Process downgrade
 */
async function processDowngrade(planId) {
  try {
    const res = await apiFetch('/billing/downgrade', {
      method: 'POST',
      body: JSON.stringify({ planId })
    });
    
    if (res && res.ok) {
      utils.showSuccess(`Successfully scheduled downgrade to ${PLANS[planId].name} plan`);
      await loadSubscription();
    } else {
      throw new Error('Failed to process downgrade');
    }
  } catch (err) {
    console.error('Downgrade failed:', err);
    utils.showError('Failed to process downgrade. Please contact support.');
  }
}

/**
 * Open contact sales for enterprise
 */
function openContactSales() {
  const subject = encodeURIComponent('Enterprise Plan Inquiry - Kaayko Smart Links');
  const body = encodeURIComponent(`Hi Kaayko Team,

I'm interested in learning more about your Enterprise plan.

Company: 
Current usage: 
Requirements: 

Please get in touch at your earliest convenience.

Thanks!`);
  
  window.open(`mailto:enterprise@kaayko.com?subject=${subject}&body=${body}`, '_blank');
  utils.showSuccess('Opening email client...');
}

/**
 * Show payment form
 */
function showPaymentForm() {
  // For now, open upgrade modal which has payment form
  openUpgradeModal('pro');
}

/**
 * Download invoices
 */
async function downloadInvoices() {
  const btn = document.getElementById('download-invoices-btn');
  const originalHTML = btn.innerHTML;
  
  btn.innerHTML = `
    <svg class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
    </svg>
    Downloading...
  `;
  btn.disabled = true;
  
  try {
    const res = await apiFetch('/billing/invoices');
    
    if (res && res.ok) {
      const data = await res.json();
      
      if (data.invoices && data.invoices.length > 0) {
        // Download invoices as PDF links
        data.invoices.forEach(invoice => {
          if (invoice.pdfUrl) {
            window.open(invoice.pdfUrl, '_blank');
          }
        });
        utils.showSuccess(`Downloading ${data.invoices.length} invoice(s)`);
      } else {
        utils.showError('No invoices available to download');
      }
    } else {
      throw new Error('Failed to fetch invoices');
    }
  } catch (err) {
    console.error('Download invoices failed:', err);
    utils.showError('No invoices available yet. Invoices will appear after your first payment.');
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}
