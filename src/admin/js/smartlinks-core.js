/**
 * Smart Links Enterprise - Core Application
 * Main app initialization, routing, and state management
 * 
 * Version: 6.0 Modular Architecture
 */

import { CONFIG, AUTH } from './config.js';
import * as utils from './utils.js';
import * as ui from './ui.js';

// ============================================================================
// GLOBAL STATE
// ============================================================================

export const STATE = {
  links: [],
  currentView: 'dashboard',
  apiStatus: 'checking',
  editingCode: null,
  viewModules: {} // Store loaded view modules
};

// ============================================================================
// VIEW LOADER - Dynamic Module Loading
// ============================================================================

const VIEW_CONFIGS = {
  dashboard: {
    module: '../views/dashboard/dashboard.js',
    css: 'views/dashboard/dashboard.css',
    container: '#dashboard-view'
  },
  create: {
    module: '../views/create-link/create-link.js',
    css: 'views/create-link/create-link.css',
    container: '#create-view'
  },
  links: {
    module: '../views/all-links/all-links.js',
    css: 'views/all-links/all-links.css',
    container: '#links-view'
  },
  qrcodes: {
    module: '../views/qr-codes/qr-codes.js',
    css: 'views/qr-codes/qr-codes.css',
    container: '#qrcodes-view'
  },
  analytics: {
    module: '../views/analytics/analytics.js',
    css: 'views/analytics/analytics.css',
    container: '#analytics-view'
  },
  'tenant-onboarding': {
    module: '../views/tenant-onboarding/tenant-onboarding.js',
    css: 'views/tenant-onboarding/tenant-onboarding.css',
    container: '#tenant-onboarding-view'
  }
};

/**
 * Dynamically load and initialize a view
 */
async function loadView(viewName) {
  const config = VIEW_CONFIGS[viewName];
  if (!config) {
    console.error(`Unknown view: ${viewName}`);
    return;
  }
  
  try {
    console.log(`📦 Loading view: ${viewName}`);
    console.log(`   Module: ${config.module}`);
    console.log(`   Environment: ${CONFIG.ENVIRONMENT}`);
    console.log(`   API: ${CONFIG.API_BASE}`);
    
    // Load CSS if not already loaded
    if (!document.querySelector(`link[href="${config.css}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = config.css;
      document.head.appendChild(link);
      console.log(`   ✅ CSS loaded: ${config.css}`);
    }
    
    // Load and cache view module
    if (!STATE.viewModules[viewName]) {
      console.log(`   📥 Importing module...`);
      const module = await import(config.module);
      STATE.viewModules[viewName] = module;
      console.log(`   ✅ Module imported`);
    } else {
      console.log(`   ♻️  Using cached module`);
    }
    
    // Initialize view
    const module = STATE.viewModules[viewName];
    if (module.init) {
      console.log(`   🎬 Initializing view...`);
      await module.init(STATE);
      console.log(`   ✅ View initialized`);
    }
    
  } catch (error) {
    console.error(`❌ Failed to load view ${viewName}:`, error);
    console.error('Stack:', error.stack);
    utils.showError(`Failed to load ${viewName} view: ${error.message}`);
  }
}

/**
 * Switch between views
 */
async function switchView(viewName) {
  console.log(`🔄 Switching to view: ${viewName}`);
  
  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === viewName);
  });
  
  // Hide all views
  console.log('   Hiding all views...');
  document.querySelectorAll('.view').forEach(view => {
    view.classList.add('hidden');
  });
  
  // Show target view
  const config = VIEW_CONFIGS[viewName];
  if (config) {
    console.log(`   Looking for container: ${config.container}`);
    const viewEl = document.querySelector(config.container);
    console.log(`   Container found:`, !!viewEl);
    if (viewEl) {
      viewEl.classList.remove('hidden');
      console.log(`   ✅ View shown (hidden class removed)`);
      console.log(`   View display:`, window.getComputedStyle(viewEl).display);
    } else {
      console.error(`   ❌ Container ${config.container} not found!`);
    }
  }
  
  // Update state
  STATE.currentView = viewName;
  
  // Load view module
  await loadView(viewName);
}

// ============================================================================
// NAVIGATION
// ============================================================================

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      switchView(view);
    });
  });
}

// ============================================================================
// COLLAPSIBLES
// ============================================================================

function initCollapsibles() {
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const collapsible = header.parentElement;
      const isOpen = collapsible.classList.toggle('active');
      
      // Update toggle icon
      const toggle = header.querySelector('.collapsible-toggle');
      if (toggle) {
        toggle.textContent = isOpen ? '▲' : '▼';
      }
    });
  });
}

// ============================================================================
// ENVIRONMENT SWITCHER
// ============================================================================

function initEnvironmentSwitcher() {
  const envSelect = document.getElementById('env-select');
  if (!envSelect) return;
  
  envSelect.value = CONFIG.ENVIRONMENT;
  
  const syncActions = document.getElementById('sync-actions');
  if (syncActions) {
    syncActions.style.display = CONFIG.ENVIRONMENT === 'local' ? 'flex' : 'none';
  }
  
  envSelect.addEventListener('change', (e) => {
    const newEnv = e.target.value;
    const oldEnv = CONFIG.ENVIRONMENT;
    
    if (newEnv === oldEnv) return;
    
    // Confirm environment switch
    const envName = newEnv === 'production' ? 'PRODUCTION' : 'LOCAL';
    const confirmed = confirm(
      `⚠️ Switch to ${envName} Environment?\n\n` +
      `You are about to switch from ${oldEnv.toUpperCase()} to ${envName}.\n\n` +
      (newEnv === 'production' 
        ? '🔴 PRODUCTION: Real data, real users!\n' 
        : '🟢 LOCAL: Emulator data only\n') +
      '\nContinue?'
    );
    
    if (!confirmed) {
      // Revert dropdown
      envSelect.value = oldEnv;
      return;
    }
    
    CONFIG.setEnvironment(newEnv);
  });
}

// ============================================================================
// USER MENU
// ============================================================================

function initUserMenu() {
  console.log('👤 Initializing user menu...');
  console.log('   AUTH.user:', AUTH.user);
  console.log('   AUTH.token:', AUTH.token ? 'exists' : 'missing');
  
  const emailEl = document.getElementById('user-email');
  const roleEl = document.getElementById('user-role');
  const tenantEl = document.getElementById('user-tenant');
  const initialEl = document.getElementById('user-initial');
  const logoutBtn = document.getElementById('logout-btn');
  const tenantSwitcher = document.getElementById('tenant-switcher');
  const tenantSelect = document.getElementById('tenant-select');
  
  console.log('   Elements found:', {
    emailEl: !!emailEl,
    roleEl: !!roleEl,
    tenantEl: !!tenantEl,
    initialEl: !!initialEl,
    logoutBtn: !!logoutBtn,
    tenantSwitcher: !!tenantSwitcher
  });
  
  if (AUTH.user && AUTH.user.email) {
    console.log('   Setting user info:', AUTH.user.email, '/', AUTH.user.role);
    if (emailEl) {
      emailEl.textContent = AUTH.user.email;
      console.log('   ✅ Email set to:', emailEl.textContent);
    }
    if (roleEl) {
      roleEl.textContent = AUTH.user.role || 'user';
      console.log('   ✅ Role set to:', roleEl.textContent);
    }
    if (tenantEl) {
      const tenantName = AUTH.user.tenantName || localStorage.getItem('kaayko_tenant_id') || 'Default';
      tenantEl.textContent = `Tenant: ${tenantName}`;
      console.log('   ✅ Tenant set to:', tenantName);
    }
    if (initialEl) {
      initialEl.textContent = (AUTH.user.email || '?')[0].toUpperCase();
      console.log('   ✅ Initial set to:', initialEl.textContent);
    }
    
    // Show tenant switcher for super-admins
    if (AUTH.user.role === 'super-admin' && tenantSwitcher && tenantSelect) {
      console.log('   👑 Super-admin detected - showing tenant switcher');
      tenantSwitcher.style.display = 'block';
      initTenantSwitcher(tenantSelect);
    }
  } else {
    console.error('   ❌ AUTH.user is missing or invalid:', AUTH.user);
    // Set fallback values
    if (emailEl) emailEl.textContent = 'Unknown User';
    if (roleEl) roleEl.textContent = 'N/A';
    if (tenantEl) tenantEl.textContent = 'Tenant: N/A';
    if (initialEl) initialEl.textContent = '?';
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to logout?')) {
        await AUTH.logout();
      }
    });
  }
}

async function initTenantSwitcher(tenantSelect) {
  try {
    // Fetch all tenants
    const response = await fetch(`${CONFIG.API_BASE}/tenants`, {
      headers: { 'Authorization': `Bearer ${AUTH.token}` }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch tenants for switcher');
      return;
    }
    
    const data = await response.json();
    const tenants = data.tenants || [];
    
    // Clear and populate dropdown
    tenantSelect.innerHTML = '';
    const currentTenantId = localStorage.getItem('kaayko_tenant_id') || 'kaayko-default';
    
    tenants.forEach(tenant => {
      const option = document.createElement('option');
      option.value = tenant.id;
      option.textContent = tenant.name;
      if (tenant.id === currentTenantId) {
        option.selected = true;
      }
      tenantSelect.appendChild(option);
    });
    
    // Handle tenant switch
    tenantSelect.addEventListener('change', async (e) => {
      const newTenantId = e.target.value;
      if (!newTenantId) return;
      
      if (confirm(`Switch to tenant: ${e.target.options[e.target.selectedIndex].text}?`)) {
        // Update localStorage
        localStorage.setItem('kaayko_tenant_id', newTenantId);
        
        // Update user object
        const user = JSON.parse(localStorage.getItem('kaayko_user'));
        user.tenantId = newTenantId;
        user.tenantName = e.target.options[e.target.selectedIndex].text;
        localStorage.setItem('kaayko_user', JSON.stringify(user));
        
        // Reload page to apply new tenant context
        window.location.reload();
      } else {
        // Revert selection
        tenantSelect.value = currentTenantId;
      }
    });
    
    console.log('   ✅ Tenant switcher initialized with', tenants.length, 'tenants');
  } catch (error) {
    console.error('Error initializing tenant switcher:', error);
  }
}

// ============================================================================
// API HEALTH CHECK
// ============================================================================

async function checkHealth() {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/smartlinks/health`, {
      headers: { 'Authorization': `Bearer ${AUTH.token}` }
    });
    const data = await res.json();
    
    STATE.apiStatus = data.success ? 'connected' : 'error';
    updateAPIStatus();
    
  } catch (err) {
    console.error('Health check failed:', err);
    STATE.apiStatus = 'error';
    updateAPIStatus();
  }
}

function updateAPIStatus() {
  const statusEl = document.querySelector('.api-status');
  if (!statusEl) return;
  
  const dot = statusEl.querySelector('.status-dot');
  const text = statusEl.querySelector('span:last-child');
  
  if (STATE.apiStatus === 'connected') {
    dot.style.background = 'var(--success)';
    text.textContent = 'API Connected';
  } else if (STATE.apiStatus === 'error') {
    dot.style.background = 'var(--error)';
    text.textContent = 'API Error';
  } else {
    dot.style.background = 'var(--warning)';
    text.textContent = 'Checking...';
  }
}

// ============================================================================
// SYNC TO PRODUCTION
// ============================================================================

async function syncToProduction() {
  if (CONFIG.ENVIRONMENT !== 'local') {
    alert('Sync is only available in local environment!');
    return;
  }
  
  const confirm1 = confirm('⚠️ SYNC TO PRODUCTION\n\nThis will copy ALL links from local to production. Continue?');
  if (!confirm1) return;
  
  utils.showInfo('Sync feature coming soon in modular architecture');
}

// Make globally accessible
window.syncToProduction = syncToProduction;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log(`🚀 Kaayko Smart Links v6.0 (Modular)`);
  console.log(`🌍 Environment: ${CONFIG.ENVIRONMENT.toUpperCase()}`);
  console.log(`📡 API: ${CONFIG.API_BASE}`);
  
  // Debug localStorage
  console.log('🔍 Checking localStorage...');
  console.log('   Token exists:', !!localStorage.getItem('kaayko_auth_token'));
  console.log('   User exists:', !!localStorage.getItem('kaayko_user'));
  
  // Initialize auth first
  console.log('🔐 Initializing authentication...');
  const authInitialized = AUTH.init();
  console.log('   Auth initialized:', authInitialized);
  
  if (AUTH.user) {
    console.log('   User:', AUTH.user.email);
    console.log('   Role:', AUTH.user.role);
    console.log('   Token:', AUTH.token ? `${AUTH.token.substring(0, 20)}...` : 'none');
  }
  
  // Check authentication
  if (!AUTH.isAuthenticated()) {
    console.log('❌ Not authenticated, redirecting to login...');
    window.location.href = './login.html';
    return;
  }
  
  console.log(`✅ Logged in as: ${AUTH.user?.email} (${AUTH.user?.role})`);
  
  // Initialize core components
  console.log('⚙️  Initializing UI components...');
  initNavigation();
  initCollapsibles();
  initEnvironmentSwitcher();
  initUserMenu();
  checkHealth();
  
  // Load initial view (dashboard)
  console.log('📱 Loading dashboard view...');
  await switchView('dashboard');
  console.log('✅ App initialization complete');
});

// Export for use by view modules
export { CONFIG, AUTH, utils, ui, switchView };
