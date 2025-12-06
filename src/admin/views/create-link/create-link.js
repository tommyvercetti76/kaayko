/**
 * Create Link View Module
 * Handles link creation and editing form
 */

import { STATE, CONFIG, AUTH, utils, ui } from '../../js/smartlinks-core.js';
import { apiFetch } from '../../js/config.js';

/**
 * Initialize Create Link view
 */
export async function init(state) {
  console.log('[CreateLink] Initializing view');
  
  // Initialize form handler
  initCreateForm();
  
  // Initialize tooltip positioning
  initTooltips();
  
  // Listen for editLink events from other views
  document.addEventListener('editLink', async (e) => {
    const { code } = e.detail;
    if (code) {
      await loadLinkForEditing(code);
    }
  });
  
  // If editing, populate form
  if (state.editingCode) {
    await loadLinkForEditing(state.editingCode);
  }
}

/**
 * Initialize minimal viewport-safe tooltips
 * Single function with edge guards - no placement variants needed
 */
function initTooltips() {
  const icons = document.querySelectorAll('.info-icon');
  
  icons.forEach((icon, index) => {
    const tooltip = icon.querySelector('.tooltip');
    if (!tooltip) return;
    
    // Setup accessibility attributes
    const tooltipId = `tooltip-${index}`;
    tooltip.id = tooltipId;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    
    icon.setAttribute('aria-describedby', tooltipId);
    
    // Show tooltip - CSS handles positioning
    const showTooltip = () => {
      tooltip.setAttribute('aria-hidden', 'false');
    };
    
    // Hide tooltip
    const hideTooltip = () => {
      tooltip.setAttribute('aria-hidden', 'true');
    };
    
    // Mouse events
    icon.addEventListener('mouseenter', showTooltip);
    icon.addEventListener('mouseleave', hideTooltip);
    
    // Keyboard events
    icon.addEventListener('focusin', showTooltip);
    icon.addEventListener('focusout', hideTooltip);
    
    // ESC key handler
    icon.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideTooltip();
        icon.blur();
      }
    });
    
    // Touch events (mobile)
    let touchTimeout;
    icon.addEventListener('touchstart', (e) => {
      e.preventDefault();
      
      if (tooltip.getAttribute('aria-hidden') === 'false') {
        hideTooltip();
        return;
      }
      
      showTooltip();
      
      clearTimeout(touchTimeout);
      touchTimeout = setTimeout(hideTooltip, 5000);
    });
    
    document.addEventListener('touchstart', (e) => {
      if (!icon.contains(e.target) && !tooltip.contains(e.target)) {
        hideTooltip();
        clearTimeout(touchTimeout);
      }
    });
  });
}

/**
 * Place tooltip with viewport-safe coordinates
 * Uses DIRECT inline styles - no CSS variables
 */
function placeTooltip(icon, tip) {
  const pad = 12;
  const m = pad; // viewport margin
  const ir = icon.getBoundingClientRect();
  
  // Force show to measure (but invisible)
  tip.style.position = 'fixed';
  tip.style.visibility = 'hidden';
  tip.style.opacity = '0';
  tip.style.display = 'block';
  tip.style.maxWidth = `min(36ch, calc(100vw - ${2 * m}px))`;
  tip.style.left = '0px';
  tip.style.top = '0px';
  tip.style.transform = 'none';
  
  // Measure
  const tr = tip.getBoundingClientRect();
  
  // Calculate position
  let x = ir.left + ir.width / 2;
  let y = ir.top - m;
  let transform = 'translate(-50%, -100%)';
  let arrowRotation = '45deg';
  
  // Check if enough room above
  const roomAbove = ir.top - m;
  const needH = tr.height + m;
  
  if (roomAbove >= needH) {
    // TOP placement
    y = ir.top - m;
    transform = 'translate(-50%, -100%)';
    arrowRotation = '45deg';
  } else {
    // BOTTOM placement (flip)
    y = ir.bottom + m;
    transform = 'translate(-50%, 0%)';
    arrowRotation = '-135deg';
  }
  
  // Clamp X to viewport with margin
  const clampedX = Math.max(m, Math.min(x, window.innerWidth - m));
  
  // Apply ALL positioning via inline styles
  tip.style.left = clampedX + 'px';
  tip.style.top = y + 'px';
  tip.style.transform = transform;
  tip.style.setProperty('--tt-rot', arrowRotation);
  
  // Make visible (CSS transition will handle fade)
  tip.style.opacity = '';
  tip.style.visibility = '';
}

/**
 * Initialize create form
 */
function initCreateForm() {
  const form = document.getElementById('create-form');
  if (!form) return;
  
  // Remove existing listeners
  form.removeEventListener('submit', handleCreateLink);
  form.addEventListener('submit', handleCreateLink);
}

/**
 * Handle form submission (create or update link)
 */
async function handleCreateLink(e) {
  e.preventDefault();
  
  try {
    // Extract form data (minimal client-side validation)
    const formData = extractFormData();
    const isEditing = !!STATE.editingCode;
    const code = STATE.editingCode || formData.code;
    
    const endpoint = isEditing ? `/smartlinks/${code}` : '/smartlinks';
    const method = isEditing ? 'PUT' : 'POST';
    
    // For editing, remove code from payload (it's in the URL path)
    if (isEditing) {
      delete formData.code;
    }
    
    // Call backend API - all business logic handled server-side
    const res = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(formData)
    });
    
    const data = await res.json();
    
    // Backend handles all validation and returns standardized response
    if (!data.success) {
      throw new Error(data.error || `Failed to ${isEditing ? 'update' : 'create'} link`);
    }
    
    // Show success notification (email sent by backend automatically)
    const linkCode = data.link?.code || data.link?.shortCode || code;
    const shortUrl = `kaayko.com/l/${linkCode}`;
    
    const generateQR = document.getElementById('generateQR')?.checked;
    
    if (isEditing) {
      // Edit success
      utils.showToast(`✅ Link "${linkCode}" updated successfully!`, 'success', 5000);
    } else {
      // Create success
      if (generateQR && data.link) {
        utils.showToast(`🎉 Link created! Your short URL: ${shortUrl}`, 'success', 6000);
        setTimeout(() => ui.showQRCodeModal(data.link), 500);
      } else {
        utils.showToast(`🎉 Link created! Your short URL: ${shortUrl}`, 'success', 6000);
        // Copy short URL to clipboard
        navigator.clipboard.writeText(`https://${shortUrl}`).then(() => {
          setTimeout(() => utils.showToast('📋 Short URL copied to clipboard!', 'info', 3000), 500);
        }).catch(() => {
          console.log('Clipboard write failed');
        });
      }
    }
    
    resetCreateForm();
    
    // Reload data from backend (single source of truth)
    if (STATE.currentView === 'dashboard') {
      const dashboardModule = STATE.viewModules['dashboard'];
      if (dashboardModule) await dashboardModule.init(STATE);
    } else if (STATE.currentView === 'links') {
      const linksModule = STATE.viewModules['links'];
      if (linksModule) await linksModule.init(STATE);
    }
    
  } catch (err) {
    utils.showError(err.message);
  }
}

/**
 * Extract form data - PRESENTATION LAYER ONLY
 * No business logic validation (backend handles all validation)
 * Only extracts values from DOM
 * 
 * UPDATED: Matches backend API v2.1.0 schema
 */
function extractFormData() {
  // Backend expects: { source, medium, campaign, term, content } (no utm_ prefix)
  const utm = {};
  ['Source', 'Medium', 'Campaign', 'Term', 'Content'].forEach(field => {
    const value = document.getElementById(`utm${field}`).value.trim();
    if (value) utm[field.toLowerCase()] = value;  // Changed from utm_${field} to just ${field}
  });
  
  const expiresAtInput = document.getElementById('expiresAt').value;
  const shortCodeInput = document.getElementById('short-code').value.trim();
  
  // Backend API v2.1.0 schema
  return {
    // REQUIRED FIELDS
    webDestination: document.getElementById('webDestination').value.trim(),
    createdBy: document.getElementById('createdBy').value.trim(),
    title: document.getElementById('title').value.trim(),
    
    // OPTIONAL FIELDS
    code: shortCodeInput || undefined, // Custom short code (backend auto-generates if not provided)
    iosDestination: document.getElementById('iosDestination').value.trim() || undefined,
    androidDestination: document.getElementById('androidDestination').value.trim() || undefined,
    utm: Object.keys(utm).length ? utm : undefined,
    expiresAt: expiresAtInput ? new Date(expiresAtInput).toISOString() : undefined,
    enabled: document.getElementById('enabled').checked,
    appStoreDefault: document.getElementById('appStoreDefault')?.checked || false
  };
}

/**
 * Reset create form to defaults
 */
function resetCreateForm() {
  const form = document.getElementById('create-form');
  if (form) form.reset();
  
  document.getElementById('enabled').checked = true;
  document.getElementById('short-code').readOnly = false;
  
  const formHeader = document.querySelector('#create-view .view-header h1');
  if (formHeader) formHeader.textContent = 'Create New Link';
  
  const submitBtn = document.querySelector('#create-view .btn-primary[type="submit"]');
  if (submitBtn) submitBtn.innerHTML = '✨ Create Link';
  
  STATE.editingCode = null;
}

/**
 * Load link data for editing
 * UPDATED: Matches backend API v2.1.0 response format
 */
async function loadLinkForEditing(code) {
  try {
    // Load all links to find the one to edit
    const res = await apiFetch('/smartlinks');
    const data = await res.json();
    
    if (!data.success) throw new Error('Failed to load links');
    
    // Backend returns simple array of links
    const links = data.links || [];
    const link = links.find(l => l.code === code);
    
    if (!link) {
      utils.showError('Link not found');
      return;
    }
    
    // Store editing code in STATE
    STATE.editingCode = code;
    
    // Populate form with link data (backend v2.1.0 schema)
    const utm = link.utm || {};
    
    document.getElementById('short-code').value = code;
    document.getElementById('short-code').readOnly = true;
    document.getElementById('title').value = link.title || '';
    document.getElementById('webDestination').value = link.webDestination || '';
    document.getElementById('createdBy').value = link.createdBy || '';
    document.getElementById('iosDestination').value = link.iosDestination || '';
    document.getElementById('androidDestination').value = link.androidDestination || '';
    
    // Backend UTM format: { source, medium, campaign } (no utm_ prefix)
    ['Source', 'Medium', 'Campaign', 'Term', 'Content'].forEach(field => {
      const el = document.getElementById(`utm${field}`);
      if (el) el.value = utm[field.toLowerCase()] || '';
    });
    
    const expiresAt = document.getElementById('expiresAt');
    if (expiresAt && link.expiresAt) {
      const date = link.expiresAt._seconds 
        ? new Date(link.expiresAt._seconds * 1000)
        : new Date(link.expiresAt);
      expiresAt.value = date.toISOString().slice(0, 16);
    }
    
    document.getElementById('enabled').checked = link.enabled !== false;
    
    const appStoreDefault = document.getElementById('appStoreDefault');
    if (appStoreDefault) {
      appStoreDefault.checked = link.appStoreDefault || false;
    }
    
    // Update form header
    const formHeader = document.querySelector('#create-view .view-header h1');
    if (formHeader) formHeader.textContent = `Edit Link: ${code}`;
    
    const submitBtn = document.querySelector('#create-view .btn-primary[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '💾 Update Link';
    
  } catch (err) {
    console.error('[CreateLink] Error loading link for editing:', err);
    utils.showError(err.message);
  }
}

// Export edit function to be called from other modules
export function editLink(code) {
  STATE.editingCode = code;
  // View will be switched by smartlinks-core
}
