/**
 * Tenant Onboarding View Module
 * Multi-step wizard for onboarding new external clients/tenants to Smart Links Platform
 */

import { CONFIG, AUTH, STATE, switchView } from '../../js/smartlinks-core.js';
import { apiFetch } from '../../js/config.js';
import * as utils from '../../js/utils.js';

// ============================================================================
// WIZARD STATE
// ============================================================================

const wizardState = {
  currentStep: 1,
  totalSteps: 6,
  tenant: null,
  adminUser: null,
  apiKeys: [],
  webhooks: [],
  dnsStatus: null,
  errors: {},
  
  // Form data
  formData: {
    tenantName: '',
    tenantId: '',
    domain: '',
    pathPrefix: '/l',
    brandingColor: '',
    brandingLogoUrl: '',
    createAdminUser: false,
    adminEmail: '',
    adminDisplayName: '',
    createProductionKey: false,
    createAnalyticsKey: false,
    configureWebhook: false,
    webhookUrl: '',
    webhookSecret: '',
    webhookEvents: []
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function init(state) {
  console.log('🎯 Initializing Tenant Onboarding...');
  
  // Reset wizard state
  wizardState.currentStep = 1;
  wizardState.tenant = null;
  wizardState.adminUser = null;
  wizardState.apiKeys = [];
  wizardState.webhooks = [];
  wizardState.errors = {};
  
  // Attach event listeners
  attachEventListeners();
  
  // Render first step
  goToStep(1);
  
  console.log('✅ Tenant Onboarding initialized');
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function attachEventListeners() {
  const prevBtn = document.getElementById('wizard-prev');
  const nextBtn = document.getElementById('wizard-next');
  
  if (prevBtn) {
    prevBtn.onclick = handlePrev;
  }
  
  if (nextBtn) {
    nextBtn.onclick = handleNext;
  }
}

// ============================================================================
// NAVIGATION
// ============================================================================

function goToStep(stepNumber) {
  if (stepNumber < 1 || stepNumber > wizardState.totalSteps) return;
  
  wizardState.currentStep = stepNumber;
  
  // Update step indicator
  updateStepIndicator();
  
  // Render step content
  renderCurrentStep();
  
  // Update navigation buttons
  updateNavigationButtons();
}

function updateStepIndicator() {
  const steps = document.querySelectorAll('.wizard-step');
  steps.forEach((step, index) => {
    const stepNum = index + 1;
    step.classList.remove('active', 'completed');
    
    if (stepNum === wizardState.currentStep) {
      step.classList.add('active');
    } else if (stepNum < wizardState.currentStep) {
      step.classList.add('completed');
      // Change circle content to checkmark for completed steps
      const circle = step.querySelector('.step-circle');
      if (circle) circle.textContent = '✓';
    } else {
      const circle = step.querySelector('.step-circle');
      if (circle) circle.textContent = stepNum;
    }
  });
}

function updateNavigationButtons() {
  const prevBtn = document.getElementById('wizard-prev');
  const nextBtn = document.getElementById('wizard-next');
  
  if (prevBtn) {
    prevBtn.disabled = wizardState.currentStep === 1;
    prevBtn.style.visibility = wizardState.currentStep === 1 ? 'hidden' : 'visible';
  }
  
  if (nextBtn) {
    const isLastStep = wizardState.currentStep === wizardState.totalSteps;
    nextBtn.innerHTML = isLastStep 
      ? '<span>Finish</span>' 
      : '<span>Next →</span>';
  }
}

async function handlePrev() {
  if (wizardState.currentStep > 1) {
    goToStep(wizardState.currentStep - 1);
  }
}

async function handleNext() {
  // Validate current step
  const valid = await validateCurrentStep();
  if (!valid) return;
  
  // Process current step (API calls if needed)
  const success = await processCurrentStep();
  if (!success) return;
  
  // Move to next step or finish
  if (wizardState.currentStep < wizardState.totalSteps) {
    goToStep(wizardState.currentStep + 1);
  } else {
    // Finish wizard
    finishWizard();
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

async function validateCurrentStep() {
  clearErrors();
  
  switch (wizardState.currentStep) {
    case 1:
      return validateStep1();
    case 2:
      return validateStep2();
    case 3:
      return validateStep3();
    case 4:
      return validateStep4();
    case 5:
      return validateStep5();
    case 6:
      return true; // Summary step, always valid
    default:
      return true;
  }
}

function validateStep1() {
  const { tenantName, tenantId, domain, pathPrefix } = wizardState.formData;
  
  if (!tenantName || !tenantName.trim()) {
    showError('Tenant Name is required');
    return false;
  }
  
  if (!tenantId || !tenantId.trim()) {
    showError('Tenant ID is required');
    return false;
  }
  
  // Validate tenant ID format (lowercase, hyphens, no spaces)
  if (!/^[a-z0-9-]+$/.test(tenantId)) {
    showError('Tenant ID must be lowercase letters, numbers, and hyphens only');
    return false;
  }
  
  if (!domain || !domain.trim()) {
    showError('Domain is required');
    return false;
  }
  
  if (!pathPrefix || !pathPrefix.trim()) {
    showError('Path Prefix is required');
    return false;
  }
  
  return true;
}

function validateStep2() {
  const { createAdminUser, adminEmail } = wizardState.formData;
  
  if (createAdminUser) {
    if (!adminEmail || !adminEmail.trim()) {
      showError('Admin email is required when creating an admin user');
      return false;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(adminEmail)) {
      showError('Please enter a valid email address');
      return false;
    }
  }
  
  return true;
}

function validateStep3() {
  // DNS step is informational, always valid
  return true;
}

function validateStep4() {
  const { createProductionKey, createAnalyticsKey } = wizardState.formData;
  
  if (!createProductionKey && !createAnalyticsKey) {
    // Show warning but allow proceeding
    utils.showInfo('No API keys will be created. You can create them later.');
  }
  
  return true;
}

function validateStep5() {
  const { configureWebhook, webhookUrl, webhookSecret } = wizardState.formData;
  
  if (configureWebhook) {
    if (!webhookUrl || !webhookUrl.trim()) {
      showError('Webhook URL is required');
      return false;
    }
    
    // Validate URL format
    try {
      new URL(webhookUrl);
    } catch (e) {
      showError('Please enter a valid webhook URL');
      return false;
    }
    
    if (!webhookSecret || !webhookSecret.trim()) {
      showError('Webhook secret is required');
      return false;
    }
  }
  
  return true;
}

// ============================================================================
// PROCESSING (API CALLS)
// ============================================================================

async function processCurrentStep() {
  switch (wizardState.currentStep) {
    case 1:
      return await processStep1CreateTenant();
    case 2:
      return await processStep2CreateAdminUser();
    case 3:
      return true; // DNS step is informational
    case 4:
      return await processStep4CreateApiKeys();
    case 5:
      return await processStep5CreateWebhook();
    case 6:
      return true; // Summary step
    default:
      return true;
  }
}

async function processStep1CreateTenant() {
  // Skip if tenant already created
  if (wizardState.tenant) return true;
  
  const { tenantName, tenantId, domain, pathPrefix, brandingColor, brandingLogoUrl } = wizardState.formData;
  
  try {
    utils.showInfo('Creating tenant...');
    
    const response = await apiFetch('/tenants', {
      method: 'POST',
      body: JSON.stringify({
        id: tenantId,
        name: tenantName,
        domain: domain,
        pathPrefix: pathPrefix,
        settings: {
          branding: {
            primaryColor: brandingColor || undefined,
            logo: brandingLogoUrl || undefined
          }
        }
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      wizardState.tenant = data.tenant;
      utils.showSuccess('Tenant created successfully!');
      return true;
    } else {
      showError(data.error || 'Failed to create tenant');
      return false;
    }
  } catch (error) {
    console.error('Failed to create tenant:', error);
    showError('Network error: Unable to create tenant');
    return false;
  }
}

async function processStep2CreateAdminUser() {
  // Skip if not creating admin user or already created
  if (!wizardState.formData.createAdminUser || wizardState.adminUser) return true;
  
  const { adminEmail, adminDisplayName } = wizardState.formData;
  
  try {
    utils.showInfo('Creating admin user...');
    
    const response = await apiFetch('/admin-users', {
      method: 'POST',
      body: JSON.stringify({
        email: adminEmail,
        displayName: adminDisplayName || adminEmail.split('@')[0],
        tenantId: wizardState.tenant.id,
        role: 'admin'
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      wizardState.adminUser = data.user;
      utils.showSuccess('Admin user created successfully!');
      return true;
    } else {
      showError(data.error || 'Failed to create admin user');
      return false;
    }
  } catch (error) {
    console.error('Failed to create admin user:', error);
    showError('Network error: Unable to create admin user');
    return false;
  }
}

async function processStep4CreateApiKeys() {
  // Skip if no keys to create or already created
  if ((!wizardState.formData.createProductionKey && !wizardState.formData.createAnalyticsKey) || wizardState.apiKeys.length > 0) {
    return true;
  }
  
  try {
    const keysToCreate = [];
    
    if (wizardState.formData.createProductionKey) {
      keysToCreate.push({
        name: 'Production',
        scopes: ['create:links', 'read:links', 'update:links', 'delete:links', 'read:stats'],
        rateLimitPerMinute: 120
      });
    }
    
    if (wizardState.formData.createAnalyticsKey) {
      keysToCreate.push({
        name: 'Analytics',
        scopes: ['read:links', 'read:stats'],
        rateLimitPerMinute: 300
      });
    }
    
    utils.showInfo(`Creating ${keysToCreate.length} API key(s)...`);
    
    for (const keyConfig of keysToCreate) {
      const response = await apiFetch('/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: wizardState.tenant.id,
          name: keyConfig.name,
          scopes: keyConfig.scopes,
          rateLimitPerMinute: keyConfig.rateLimitPerMinute
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        wizardState.apiKeys.push({
          name: keyConfig.name,
          apiKey: data.apiKey,
          keyId: data.keyId,
          scopes: keyConfig.scopes,
          rateLimitPerMinute: keyConfig.rateLimitPerMinute
        });
      } else {
        showError(`Failed to create ${keyConfig.name} API key: ${data.error}`);
        return false;
      }
    }
    
    utils.showSuccess('API keys created successfully!');
    return true;
  } catch (error) {
    console.error('Failed to create API keys:', error);
    showError('Network error: Unable to create API keys');
    return false;
  }
}

async function processStep5CreateWebhook() {
  // Skip if not configuring webhook or already created
  if (!wizardState.formData.configureWebhook || wizardState.webhooks.length > 0) {
    return true;
  }
  
  const { webhookUrl, webhookSecret, webhookEvents } = wizardState.formData;
  
  if (webhookEvents.length === 0) {
    showError('Please select at least one webhook event');
    return false;
  }
  
  try {
    utils.showInfo('Creating webhook subscription...');
    
    const response = await apiFetch('/webhooks', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: wizardState.tenant.id,
        targetUrl: webhookUrl,
        secret: webhookSecret,
        events: webhookEvents,
        description: `${wizardState.tenant.name} Webhook`
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      wizardState.webhooks.push({
        subscriptionId: data.subscriptionId,
        targetUrl: webhookUrl,
        events: webhookEvents
      });
      utils.showSuccess('Webhook created successfully!');
      return true;
    } else {
      showError(data.error || 'Failed to create webhook');
      return false;
    }
  } catch (error) {
    console.error('Failed to create webhook:', error);
    showError('Network error: Unable to create webhook');
    return false;
  }
}

// ============================================================================
// RENDER STEPS
// ============================================================================

function renderCurrentStep() {
  const content = document.getElementById('wizard-content');
  if (!content) return;
  
  switch (wizardState.currentStep) {
    case 1:
      content.innerHTML = renderStep1TenantDetails();
      attachStep1Listeners();
      break;
    case 2:
      content.innerHTML = renderStep2AdminUser();
      attachStep2Listeners();
      break;
    case 3:
      content.innerHTML = renderStep3DomainDns();
      attachStep3Listeners();
      break;
    case 4:
      content.innerHTML = renderStep4ApiKeys();
      attachStep4Listeners();
      break;
    case 5:
      content.innerHTML = renderStep5Webhooks();
      attachStep5Listeners();
      break;
    case 6:
      content.innerHTML = renderStep6Summary();
      attachStep6Listeners();
      break;
  }
}

// ============================================================================
// STEP 1: TENANT DETAILS
// ============================================================================

function renderStep1TenantDetails() {
  const { tenantName, tenantId, domain, pathPrefix, brandingColor, brandingLogoUrl } = wizardState.formData;
  
  return `
    <div class="step-content">
      <h2>Tenant Details</h2>
      <p class="step-description">
        Set up the basic information for the new tenant. This will create an isolated data space for the client.
      </p>
      
      <div class="form-section">
        <div class="form-group">
          <label for="tenantName">
            Tenant Name <span class="required">*</span>
          </label>
          <input 
            type="text" 
            id="tenantName" 
            placeholder="e.g., Client X, Acme Corp" 
            value="${utils.escapeHtml(tenantName)}"
            ${wizardState.tenant ? 'disabled' : ''}
          >
          <div class="form-hint">Display name for the tenant</div>
        </div>
        
        <div class="form-group">
          <label for="tenantId">
            Tenant ID <span class="required">*</span>
          </label>
          <input 
            type="text" 
            id="tenantId" 
            placeholder="e.g., client-x, acme-corp" 
            value="${utils.escapeHtml(tenantId)}"
            ${wizardState.tenant ? 'disabled' : ''}
          >
          <div class="form-hint">Unique identifier (lowercase, hyphens allowed, no spaces)</div>
        </div>
        
        <div class="input-group">
          <div class="form-group">
            <label for="domain">
              Primary Domain <span class="required">*</span>
            </label>
            <input 
              type="text" 
              id="domain" 
              placeholder="e.g., go.clientx.com" 
              value="${utils.escapeHtml(domain)}"
              ${wizardState.tenant ? 'disabled' : ''}
            >
            <div class="form-hint">Custom domain for short links</div>
          </div>
          
          <div class="form-group">
            <label for="pathPrefix">
              Path Prefix <span class="required">*</span>
            </label>
            <input 
              type="text" 
              id="pathPrefix" 
              placeholder="/l" 
              value="${utils.escapeHtml(pathPrefix)}"
              ${wizardState.tenant ? 'disabled' : ''}
            >
            <div class="form-hint">URL path prefix (e.g., /l)</div>
          </div>
        </div>
        
        <div class="input-group">
          <div class="form-group">
            <label for="brandingColor">Branding Color (Optional)</label>
            <input 
              type="text" 
              id="brandingColor" 
              placeholder="#FF6B00" 
              value="${utils.escapeHtml(brandingColor)}"
              ${wizardState.tenant ? 'disabled' : ''}
            >
            <div class="form-hint">Hex color code</div>
          </div>
          
          <div class="form-group">
            <label for="brandingLogoUrl">Logo URL (Optional)</label>
            <input 
              type="url" 
              id="brandingLogoUrl" 
              placeholder="https://clientx.com/logo.png" 
              value="${utils.escapeHtml(brandingLogoUrl)}"
              ${wizardState.tenant ? 'disabled' : ''}
            >
            <div class="form-hint">Public URL to logo image</div>
          </div>
        </div>
        
        ${wizardState.tenant ? `
          <div class="info-box">
            <div class="info-box-icon">✓</div>
            <div class="info-box-content">
              <p><strong>Tenant created successfully!</strong> You can proceed to the next steps.</p>
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function attachStep1Listeners() {
  const tenantNameInput = document.getElementById('tenantName');
  const tenantIdInput = document.getElementById('tenantId');
  const domainInput = document.getElementById('domain');
  const pathPrefixInput = document.getElementById('pathPrefix');
  const brandingColorInput = document.getElementById('brandingColor');
  const brandingLogoUrlInput = document.getElementById('brandingLogoUrl');
  
  if (tenantNameInput) {
    tenantNameInput.addEventListener('input', (e) => {
      wizardState.formData.tenantName = e.target.value;
      
      // Auto-generate tenant ID from name if not manually edited
      if (!wizardState.formData.tenantId || wizardState.formData.tenantId === slugify(wizardState.formData.tenantName)) {
        const slug = slugify(e.target.value);
        wizardState.formData.tenantId = slug;
        if (tenantIdInput) tenantIdInput.value = slug;
      }
    });
  }
  
  if (tenantIdInput) {
    tenantIdInput.addEventListener('input', (e) => {
      wizardState.formData.tenantId = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
      tenantIdInput.value = wizardState.formData.tenantId;
    });
  }
  
  if (domainInput) {
    domainInput.addEventListener('input', (e) => {
      wizardState.formData.domain = e.target.value;
    });
  }
  
  if (pathPrefixInput) {
    pathPrefixInput.addEventListener('input', (e) => {
      wizardState.formData.pathPrefix = e.target.value;
    });
  }
  
  if (brandingColorInput) {
    brandingColorInput.addEventListener('input', (e) => {
      wizardState.formData.brandingColor = e.target.value;
    });
  }
  
  if (brandingLogoUrlInput) {
    brandingLogoUrlInput.addEventListener('input', (e) => {
      wizardState.formData.brandingLogoUrl = e.target.value;
    });
  }
}

// ============================================================================
// STEP 2: ADMIN USER
// ============================================================================

function renderStep2AdminUser() {
  const { createAdminUser, adminEmail, adminDisplayName } = wizardState.formData;
  
  return `
    <div class="step-content">
      <h2>Tenant Admin User</h2>
      <p class="step-description">
        Optionally create an admin user for this tenant to access the web portal.
      </p>
      
      <div class="form-section">
        <div class="toggle-group">
          <div class="toggle-switch ${createAdminUser && !wizardState.adminUser ? 'active' : ''}" id="toggleAdminUser" ${wizardState.adminUser ? 'style="pointer-events:none; opacity:0.5;"' : ''}>
          </div>
          <div class="toggle-label">Create admin user for this tenant</div>
        </div>
        
        ${createAdminUser || wizardState.adminUser ? `
          <div class="form-group">
            <label for="adminEmail">
              Admin Email <span class="required">*</span>
            </label>
            <input 
              type="email" 
              id="adminEmail" 
              placeholder="admin@clientx.com" 
              value="${utils.escapeHtml(adminEmail)}"
              ${wizardState.adminUser ? 'disabled' : ''}
            >
            <div class="form-hint">Email address for the admin user</div>
          </div>
          
          <div class="form-group">
            <label for="adminDisplayName">Display Name (Optional)</label>
            <input 
              type="text" 
              id="adminDisplayName" 
              placeholder="Client X Admin" 
              value="${utils.escapeHtml(adminDisplayName)}"
              ${wizardState.adminUser ? 'disabled' : ''}
            >
            <div class="form-hint">Friendly name for the admin</div>
          </div>
          
          ${wizardState.adminUser ? `
            <div class="info-box">
              <div class="info-box-icon">✓</div>
              <div class="info-box-content">
                <p><strong>Admin user created!</strong> Email: ${utils.escapeHtml(wizardState.adminUser.email)}</p>
              </div>
            </div>
          ` : ''}
        ` : `
          <div class="info-box">
            <div class="info-box-icon">ℹ</div>
            <div class="info-box-content">
              <p>You can manage this tenant purely via API keys without creating a web portal user.</p>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

function attachStep2Listeners() {
  const toggleSwitch = document.getElementById('toggleAdminUser');
  const adminEmailInput = document.getElementById('adminEmail');
  const adminDisplayNameInput = document.getElementById('adminDisplayName');
  
  if (toggleSwitch && !wizardState.adminUser) {
    toggleSwitch.addEventListener('click', () => {
      wizardState.formData.createAdminUser = !wizardState.formData.createAdminUser;
      renderCurrentStep();
    });
  }
  
  if (adminEmailInput) {
    adminEmailInput.addEventListener('input', (e) => {
      wizardState.formData.adminEmail = e.target.value;
    });
  }
  
  if (adminDisplayNameInput) {
    adminDisplayNameInput.addEventListener('input', (e) => {
      wizardState.formData.adminDisplayName = e.target.value;
    });
  }
}

// ============================================================================
// STEP 3: DOMAIN & DNS
// ============================================================================

function renderStep3DomainDns() {
  const domain = wizardState.tenant?.domain || wizardState.formData.domain;
  const subdomain = domain.split('.')[0];
  const rootDomain = domain.split('.').slice(1).join('.');
  
  return `
    <div class="step-content">
      <h2>Domain & DNS Configuration</h2>
      <p class="step-description">
        Configure DNS records for the custom domain. The client needs to add these records to their DNS provider.
      </p>
      
      <div class="form-section">
        <div class="info-box">
          <div class="info-box-icon">🌐</div>
          <div class="info-box-content">
            <p><strong>Domain:</strong> ${utils.escapeHtml(domain)}</p>
            <p style="margin-top: 8px;">The client must configure the following DNS records:</p>
          </div>
        </div>
        
        <h3 style="margin-top: 24px; margin-bottom: 16px; font-size: 16px; color: var(--text-primary);">Required DNS Records</h3>
        
        <div class="dns-records">
          <div class="dns-record">
            <div class="dns-field">
              <div class="dns-field-label">Type</div>
              <div class="dns-field-value">CNAME</div>
            </div>
            <div class="dns-field">
              <div class="dns-field-label">Name</div>
              <div class="dns-field-value">${utils.escapeHtml(subdomain)}</div>
            </div>
            <div class="dns-field">
              <div class="dns-field-label">Value</div>
              <div class="dns-field-value">kaaykostore.web.app</div>
            </div>
            <button class="btn-copy" onclick="navigator.clipboard.writeText('kaaykostore.web.app').then(() => alert('Copied!'))">
              Copy
            </button>
          </div>
          
          <div class="dns-record">
            <div class="dns-field">
              <div class="dns-field-label">Type</div>
              <div class="dns-field-value">TXT</div>
            </div>
            <div class="dns-field">
              <div class="dns-field-label">Name</div>
              <div class="dns-field-value">_kaayko-verify.${utils.escapeHtml(subdomain)}</div>
            </div>
            <div class="dns-field">
              <div class="dns-field-label">Value</div>
              <div class="dns-field-value">kaayko-site-verification=${wizardState.tenant?.id || 'pending'}</div>
            </div>
            <button class="btn-copy" onclick="navigator.clipboard.writeText('kaayko-site-verification=${wizardState.tenant?.id || 'pending'}').then(() => alert('Copied!'))">
              Copy
            </button>
          </div>
        </div>
        
        <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>DNS Status:</strong>
            <span class="dns-status ${wizardState.dnsStatus === 'verified' ? 'verified' : wizardState.dnsStatus === 'pending' ? 'pending' : 'not-configured'}">
              ${wizardState.dnsStatus === 'verified' ? '✓ Verified' : wizardState.dnsStatus === 'pending' ? '⏳ Pending' : '○ Not Configured'}
            </span>
          </div>
          <button class="btn-refresh" id="refreshDnsBtn">
            🔄 Refresh DNS Status
          </button>
        </div>
        
        <div class="info-box" style="margin-top: 24px;">
          <div class="info-box-icon">ℹ</div>
          <div class="info-box-content">
            <p><strong>Note:</strong> DNS propagation can take up to 48 hours. You can proceed with onboarding and verify DNS later.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function attachStep3Listeners() {
  const refreshBtn = document.getElementById('refreshDnsBtn');
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      if (!wizardState.tenant) {
        utils.showError('Tenant not created yet');
        return;
      }
      
      try {
        utils.showInfo('Checking DNS status...');
        
        const response = await apiFetch(`/tenants/${wizardState.tenant.id}/dns-status`);
        const data = await response.json();
        
        if (data.success) {
          wizardState.dnsStatus = data.status;
          renderCurrentStep();
          
          if (data.status === 'verified') {
            utils.showSuccess('DNS verified successfully!');
          } else if (data.status === 'pending') {
            utils.showInfo('DNS records found, waiting for propagation...');
          } else {
            utils.showInfo('DNS records not found yet');
          }
        } else {
          utils.showError('Failed to check DNS status');
        }
      } catch (error) {
        console.error('DNS check failed:', error);
        utils.showError('Network error: Unable to check DNS status');
      }
    });
  }
}

// ============================================================================
// STEP 4: API KEYS
// ============================================================================

function renderStep4ApiKeys() {
  const { createProductionKey, createAnalyticsKey } = wizardState.formData;
  
  return `
    <div class="step-content">
      <h2>API Keys</h2>
      <p class="step-description">
        Generate API keys for programmatic access to the Smart Links API.
      </p>
      
      <div class="form-section">
        ${wizardState.apiKeys.length > 0 ? `
          <div class="warning-box">
            <div class="warning-box-icon">⚠</div>
            <div style="flex: 1;">
              <p style="margin: 0; font-size: 14px; color: var(--text-primary); font-weight: 600;">API Keys Shown Only Once</p>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: var(--text-secondary);">Copy and store these keys securely now. They cannot be retrieved later.</p>
            </div>
          </div>
          
          <div class="api-key-list">
            ${wizardState.apiKeys.map(key => `
              <div class="api-key-card">
                <div class="api-key-header">
                  <div class="api-key-name">${utils.escapeHtml(key.name)} API Key</div>
                  <div style="font-size: 12px; color: var(--text-muted);">${key.rateLimitPerMinute} req/min</div>
                </div>
                <div class="api-key-scopes">
                  ${key.scopes.map(scope => `<span class="scope-badge">${utils.escapeHtml(scope)}</span>`).join('')}
                </div>
                <div class="api-key-value">
                  <code>${utils.escapeHtml(key.apiKey)}</code>
                  <button class="btn-copy" onclick="navigator.clipboard.writeText('${key.apiKey}').then(() => alert('API key copied to clipboard!'))">
                    📋 Copy
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="checkbox-group">
            <div class="checkbox-item">
              <input type="checkbox" id="createProductionKey" ${createProductionKey ? 'checked' : ''}>
              <label for="createProductionKey">
                <strong>Production API Key</strong>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                  Full access: create, read, update, delete links + analytics (120 req/min)
                </div>
              </label>
            </div>
            
            <div class="checkbox-item">
              <input type="checkbox" id="createAnalyticsKey" ${createAnalyticsKey ? 'checked' : ''}>
              <label for="createAnalyticsKey">
                <strong>Analytics Read-Only Key</strong>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                  Read-only access to links and analytics data (300 req/min)
                </div>
              </label>
            </div>
          </div>
          
          <div class="info-box" style="margin-top: 16px;">
            <div class="info-box-icon">ℹ</div>
            <div class="info-box-content">
              <p>Select the API keys you want to generate. Keys will be created when you proceed to the next step.</p>
            </div>
          </div>
        `}
      </div>
    </div>
  `;
}

function attachStep4Listeners() {
  const productionKeyCheckbox = document.getElementById('createProductionKey');
  const analyticsKeyCheckbox = document.getElementById('createAnalyticsKey');
  
  if (productionKeyCheckbox) {
    productionKeyCheckbox.addEventListener('change', (e) => {
      wizardState.formData.createProductionKey = e.target.checked;
    });
  }
  
  if (analyticsKeyCheckbox) {
    analyticsKeyCheckbox.addEventListener('change', (e) => {
      wizardState.formData.createAnalyticsKey = e.target.checked;
    });
  }
}

// ============================================================================
// STEP 5: WEBHOOKS
// ============================================================================

function renderStep5Webhooks() {
  const { configureWebhook, webhookUrl, webhookSecret, webhookEvents } = wizardState.formData;
  
  const availableEvents = [
    { id: 'link.created', label: 'Link Created', description: 'Fired when a new link is created' },
    { id: 'link.updated', label: 'Link Updated', description: 'Fired when a link is modified' },
    { id: 'link.deleted', label: 'Link Deleted', description: 'Fired when a link is deleted' },
    { id: 'link.clicked', label: 'Link Clicked', description: 'Fired when a link is clicked' },
    { id: 'app.installed', label: 'App Installed', description: 'Fired when app install is attributed' }
  ];
  
  return `
    <div class="step-content">
      <h2>Webhooks (Optional)</h2>
      <p class="step-description">
        Configure webhook subscriptions to receive real-time event notifications.
      </p>
      
      <div class="form-section">
        ${wizardState.webhooks.length > 0 ? `
          <div class="info-box">
            <div class="info-box-icon">✓</div>
            <div class="info-box-content">
              <p><strong>Webhook configured successfully!</strong></p>
              <p style="margin-top: 8px;">Target: ${utils.escapeHtml(wizardState.webhooks[0].targetUrl)}</p>
              <p style="margin-top: 4px;">Events: ${wizardState.webhooks[0].events.join(', ')}</p>
            </div>
          </div>
        ` : `
          <div class="toggle-group">
            <div class="toggle-switch ${configureWebhook ? 'active' : ''}" id="toggleWebhook"></div>
            <div class="toggle-label">Configure webhook subscription</div>
          </div>
          
          ${configureWebhook ? `
            <div class="form-group">
              <label for="webhookUrl">
                Webhook URL <span class="required">*</span>
              </label>
              <input 
                type="url" 
                id="webhookUrl" 
                placeholder="https://clientx.com/api/webhooks/kaayko" 
                value="${utils.escapeHtml(webhookUrl)}"
              >
              <div class="form-hint">HTTPS endpoint to receive webhook events</div>
            </div>
            
            <div class="form-group">
              <label for="webhookSecret">
                Webhook Secret <span class="required">*</span>
              </label>
              <input 
                type="text" 
                id="webhookSecret" 
                placeholder="secret-key-xyz" 
                value="${utils.escapeHtml(webhookSecret)}"
              >
              <div class="form-hint">Secret key for HMAC signature verification</div>
            </div>
            
            <div class="form-group">
              <label>Select Events to Subscribe <span class="required">*</span></label>
              <div class="checkbox-group">
                ${availableEvents.map(event => `
                  <div class="checkbox-item">
                    <input 
                      type="checkbox" 
                      id="event-${event.id}" 
                      value="${event.id}"
                      ${webhookEvents.includes(event.id) ? 'checked' : ''}
                    >
                    <label for="event-${event.id}">
                      <strong>${event.label}</strong>
                      <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                        ${event.description}
                      </div>
                    </label>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `
            <div class="info-box">
              <div class="info-box-icon">ℹ</div>
              <div class="info-box-content">
                <p>Webhooks can be configured later if needed. You can proceed without setting them up now.</p>
              </div>
            </div>
          `}
        `}
      </div>
    </div>
  `;
}

function attachStep5Listeners() {
  const toggleSwitch = document.getElementById('toggleWebhook');
  const webhookUrlInput = document.getElementById('webhookUrl');
  const webhookSecretInput = document.getElementById('webhookSecret');
  
  if (toggleSwitch) {
    toggleSwitch.addEventListener('click', () => {
      wizardState.formData.configureWebhook = !wizardState.formData.configureWebhook;
      renderCurrentStep();
    });
  }
  
  if (webhookUrlInput) {
    webhookUrlInput.addEventListener('input', (e) => {
      wizardState.formData.webhookUrl = e.target.value;
    });
  }
  
  if (webhookSecretInput) {
    webhookSecretInput.addEventListener('input', (e) => {
      wizardState.formData.webhookSecret = e.target.value;
    });
  }
  
  // Event checkboxes
  const eventCheckboxes = document.querySelectorAll('[id^="event-"]');
  eventCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const eventId = e.target.value;
      if (e.target.checked) {
        if (!wizardState.formData.webhookEvents.includes(eventId)) {
          wizardState.formData.webhookEvents.push(eventId);
        }
      } else {
        wizardState.formData.webhookEvents = wizardState.formData.webhookEvents.filter(id => id !== eventId);
      }
    });
  });
}

// ============================================================================
// STEP 6: SUMMARY
// ============================================================================

function renderStep6Summary() {
  const tenant = wizardState.tenant;
  const adminUser = wizardState.adminUser;
  const apiKeys = wizardState.apiKeys;
  const webhooks = wizardState.webhooks;
  
  return `
    <div class="step-content">
      <h2>Onboarding Complete! 🎉</h2>
      <p class="step-description">
        Review the configuration summary and download client instructions.
      </p>
      
      <div class="summary-grid">
        <div class="summary-card">
          <h3>Tenant Information</h3>
          <div class="summary-item">
            <div class="summary-item-label">Tenant ID</div>
            <div class="summary-item-value">${utils.escapeHtml(tenant.id)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">Name</div>
            <div class="summary-item-value">${utils.escapeHtml(tenant.name)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">Domain</div>
            <div class="summary-item-value">${utils.escapeHtml(tenant.domain)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-item-label">Path Prefix</div>
            <div class="summary-item-value">${utils.escapeHtml(tenant.pathPrefix)}</div>
          </div>
        </div>
        
        ${adminUser ? `
          <div class="summary-card">
            <h3>Admin User</h3>
            <div class="summary-item">
              <div class="summary-item-label">Email</div>
              <div class="summary-item-value">${utils.escapeHtml(adminUser.email)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-item-label">Role</div>
              <div class="summary-item-value">Admin</div>
            </div>
            <div class="summary-item">
              <div class="summary-item-label">Portal Access</div>
              <div class="summary-item-value">Enabled</div>
            </div>
          </div>
        ` : ''}
        
        ${apiKeys.length > 0 ? `
          <div class="summary-card">
            <h3>API Keys</h3>
            ${apiKeys.map(key => `
              <div class="summary-item">
                <div class="summary-item-label">${utils.escapeHtml(key.name)}</div>
                <div class="summary-item-value">${key.scopes.length} scopes</div>
              </div>
            `).join('')}
            <div style="margin-top: 12px; padding: 12px; background: var(--warning-bg); border-radius: 6px; font-size: 12px; color: var(--text-secondary);">
              ⚠ API keys were shown earlier and cannot be retrieved again
            </div>
          </div>
        ` : ''}
        
        ${webhooks.length > 0 ? `
          <div class="summary-card">
            <h3>Webhooks</h3>
            <div class="summary-item">
              <div class="summary-item-label">Target URL</div>
              <div class="summary-item-value" style="font-size: 12px; word-break: break-all;">${utils.escapeHtml(webhooks[0].targetUrl)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-item-label">Events</div>
              <div class="summary-item-value">${webhooks[0].events.length} subscribed</div>
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="summary-actions">
        <button class="btn-generate" id="downloadConfigBtn">
          📥 Download Configuration JSON
        </button>
        
        <button class="btn-generate" id="copyInstructionsBtn">
          📋 Copy Client Instructions
        </button>
        
        <button class="btn-secondary" id="openDashboardBtn" style="width: 100%;">
          🎯 Go to Tenant Dashboard
        </button>
      </div>
    </div>
  `;
}

function attachStep6Listeners() {
  const downloadBtn = document.getElementById('downloadConfigBtn');
  const copyBtn = document.getElementById('copyInstructionsBtn');
  const dashboardBtn = document.getElementById('openDashboardBtn');
  
  if (downloadBtn) {
    downloadBtn.addEventListener('click', downloadConfiguration);
  }
  
  if (copyBtn) {
    copyBtn.addEventListener('click', copyClientInstructions);
  }
  
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
      // Navigate to dashboard with tenant filter
      utils.showInfo('Opening tenant dashboard...');
      switchView('dashboard');
    });
  }
}

function downloadConfiguration() {
  const config = {
    tenant: wizardState.tenant,
    adminUser: wizardState.adminUser,
    apiKeys: wizardState.apiKeys.map(key => ({
      name: key.name,
      scopes: key.scopes,
      rateLimitPerMinute: key.rateLimitPerMinute
      // Note: actual API key value not included for security
    })),
    webhooks: wizardState.webhooks
  };
  
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tenant-${wizardState.tenant.id}-config.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  utils.showSuccess('Configuration downloaded!');
}

function copyClientInstructions() {
  const tenant = wizardState.tenant;
  const apiKeys = wizardState.apiKeys;
  
  const instructions = `
# ${tenant.name} - Kaayko Smart Links Configuration

## API Access

**Base URL:** ${CONFIG.API_BASE}
**Tenant ID:** ${tenant.id}

## Authentication

Use your API key in the request header:
\`\`\`
X-API-Key: your-api-key-here
\`\`\`

## Creating a Short Link

\`\`\`bash
curl -X POST ${CONFIG.API_BASE}/public/smartlinks \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "webDestination": "https://example.com",
    "iosDestination": "yourapp://path",
    "androidDestination": "yourapp://path",
    "title": "My Link",
    "utm": {
      "utm_source": "campaign",
      "utm_campaign": "summer2024"
    }
  }'
\`\`\`

## Short Link Domain

Your short links will be available at:
**${tenant.domain}${tenant.pathPrefix}/[code]**

Example: ${tenant.domain}${tenant.pathPrefix}/abc123

## DNS Configuration

Add these DNS records to your domain provider:

**CNAME Record:**
- Type: CNAME
- Name: ${tenant.domain.split('.')[0]}
- Value: kaaykostore.web.app

**TXT Verification Record:**
- Type: TXT
- Name: _kaayko-verify.${tenant.domain.split('.')[0]}
- Value: kaayko-site-verification=${tenant.id}

${apiKeys.length > 0 ? `
## API Keys Generated

${apiKeys.map(key => `- ${key.name}: ${key.scopes.join(', ')}`).join('\n')}

⚠️ Store your API keys securely - they cannot be retrieved later.
` : ''}

## Support

For questions or support, contact: support@kaayko.com
`.trim();
  
  navigator.clipboard.writeText(instructions).then(() => {
    utils.showSuccess('Instructions copied to clipboard!');
  }).catch(() => {
    utils.showError('Failed to copy instructions');
  });
}

// ============================================================================
// FINISH WIZARD
// ============================================================================

function finishWizard() {
  utils.showSuccess('Tenant onboarding complete!');
  // Could redirect to tenant management view
  // For now, stay on summary
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

function showError(message) {
  const content = document.getElementById('wizard-content');
  if (!content) return;
  
  // Check if error banner already exists
  let errorBanner = content.querySelector('.error-banner');
  if (!errorBanner) {
    errorBanner = document.createElement('div');
    errorBanner.className = 'error-banner';
    content.insertBefore(errorBanner, content.firstChild);
  }
  
  errorBanner.innerHTML = `
    <div class="error-banner-icon">✕</div>
    <div class="error-banner-text">${utils.escapeHtml(message)}</div>
    <button class="btn-icon" onclick="this.parentElement.remove()" style="margin-left: auto;">✕</button>
  `;
  
  utils.showError(message);
}

function clearErrors() {
  const content = document.getElementById('wizard-content');
  if (!content) return;
  
  const errorBanner = content.querySelector('.error-banner');
  if (errorBanner) {
    errorBanner.remove();
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
