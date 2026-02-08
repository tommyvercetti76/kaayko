/**
 * All Links View Module
 * Displays and manages all smart links
 */

import { STATE, utils, ui, switchView } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';

/**
 * Initialize All Links view
 */
export async function init(state) {
  console.log('[AllLinks] Initializing view');
  await loadLinks();
}

/**
 * Load all links from API
 */
async function loadLinks() {
  const container = document.getElementById('links-table');
  const loading = document.getElementById('links-loading');
  const empty = document.getElementById('links-empty');
  
  // Show loading state
  if (loading) loading.classList.remove('hidden');
  if (container) container.innerHTML = '';
  if (empty) empty.classList.add('hidden');
  
  try {
    const res = await apiFetch('/smartlinks');
    const data = await res.json();
    
    if (!data.success) throw new Error('Failed to load links');
    
    // Parse links from response
    if (data.links) {
      STATE.links = data.links;
    } else if (data.short || data.structured) {
      STATE.links = [...(data.structured || []), ...(data.short || [])];
    } else {
      STATE.links = [];
    }
    
    // Hide loading
    if (loading) loading.classList.add('hidden');
    
    // Show empty state ONLY if actually no links
    if (STATE.links.length === 0) {
      if (empty) empty.classList.remove('hidden');
      if (container) container.innerHTML = '';
      return;
    }
    
    // Render the table with links
    if (container) {
      container.innerHTML = ui.renderLinksTable(STATE.links);
    }
    
    // Ensure empty state is hidden when we have links
    if (empty) empty.classList.add('hidden');
    
  } catch (err) {
    if (loading) loading.classList.add('hidden');
    if (empty) empty.classList.add('hidden');
    if (container) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error Loading Links</h3><p>${err.message}</p></div>`;
    }
  }
}

/**
 * Edit link - switch to create view with editing mode
 */
export function editLink(code) {
  STATE.editingCode = code;
  switchView('create');
}

/**
 * Copy link to clipboard
 */
export function copyLink(code) {
  const url = `https://kaayko.com/l/${code}`;
  navigator.clipboard.writeText(url).then(() => {
    utils.showToast(`📋 Copied: ${url}`, 'success', 3000);
  }).catch(err => {
    utils.showError('Failed to copy link');
  });
}

/**
 * Toggle link enabled/disabled
 * ROBUST: Handles multiple code field formats
 */
export async function toggleLink(code) {
  const link = STATE.links.find(l => (l.code || l.shortCode || l.id) === code);
  if (!link) return;
  
  const newStatus = !link.enabled;
  const action = newStatus ? 'enable' : 'disable';
  
  if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} link "${code}"?`)) {
    return;
  }
  
  try {
    const res = await apiFetch(`/smartlinks/${code}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: newStatus })
    });
    
    const data = await res.json();
    
    if (!data.success) {
      throw new Error(data.error || `Failed to ${action} link`);
    }
    
    utils.showSuccess(`✅ Link "${code}" ${action}d successfully`);
    
    // Reload links
    await loadLinks();
    
  } catch (err) {
    utils.showError(err.message);
  }
}

/**
 * Delete link
 */
export async function deleteLink(code) {
  if (!confirm(`⚠️ Delete link "${code}"?\n\nThis action cannot be undone.`)) {
    return;
  }
  
  try {
    const res = await apiFetch(`/smartlinks/${code}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete link');
    }
    
    utils.showSuccess(`✅ Link "${code}" deleted successfully`);
    
    // Reload links
    await loadLinks();
    
  } catch (err) {
    utils.showError(err.message);
  }
}

/**
 * Show QR code in sidebar
 */
export function showQRSidebar(code) {
  // For now, just switch to QR codes view
  // Later we can implement a sidebar overlay
  switchView('qrcodes');
  utils.showToast(`📱 Opening QR code for: ${code}`, 'info', 2000);
}

// Make functions globally accessible for onclick handlers
window.toggleLink = toggleLink;
window.editLink = editLink;
window.copyLink = copyLink;
window.deleteLink = deleteLink;
window.showQRSidebar = showQRSidebar;
