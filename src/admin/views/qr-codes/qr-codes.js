/**
 * QR Codes View Module
 * Displays QR codes for all links in a gallery view
 */

import { STATE, CONFIG, utils } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';

/**
 * Initialize QR Codes view
 */
export async function init(state) {
  console.log('[QRCodes] Initializing view');
  await loadQRCodes();
}

/**
 * Load QR codes for all links
 */
async function loadQRCodes() {
  const gallery = document.getElementById('qr-gallery');
  const empty = document.getElementById('qr-empty');
  
  if (!gallery) return;
  
  // Load links if not already loaded
  if (STATE.links.length === 0) {
    try {
      const res = await apiFetch('/smartlinks');
      const data = await res.json();
      
      if (data.success) {
        if (data.links) {
          STATE.links = data.links;
        } else if (data.short || data.structured) {
          STATE.links = [...(data.structured || []), ...(data.short || [])];
        }
      }
    } catch (err) {
      console.error('Failed to load links:', err);
    }
  }
  
  if (STATE.links.length === 0) {
    gallery.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  
  if (empty) empty.classList.add('hidden');
  
  gallery.innerHTML = STATE.links.map(link => {
    const code = link.code || link.shortCode || link.id;
    // Always use kaayko.com/l/ format (never k.kaayko.com)
    const url = `https://kaayko.com/l/${code}`;
    const qrUrl = `${CONFIG.QR_API}?size=400x400&data=${encodeURIComponent(url)}`;
    const isActive = link.enabled !== false;
    
    return `
      <div class="qr-card">
        <div class="qr-card-image">
          <img src="${qrUrl}" alt="QR for ${code}" loading="lazy">
          
          <!-- URL Overlay - Shows on Hover -->
          <div class="qr-url-overlay">
            <div class="qr-url-label">Short URL</div>
            <div class="qr-url-display">${utils.escapeHtml(url)}</div>
          </div>
        </div>
        
        <div class="qr-card-content">
          <h4 class="qr-card-title">${utils.escapeHtml(link.title || 'Untitled')}</h4>
          <div class="qr-card-code">${code}</div>
          <div class="qr-card-stats">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              ${link.clickCount || 0} clicks
            </span>
            <span style="color: ${isActive ? '#4ade80' : '#94a3b8'};">
              ${isActive ? '✓ Active' : '✗ Disabled'}
            </span>
          </div>
        </div>
        
        <div class="qr-card-actions">
          <button class="qr-action-btn primary" onclick="window.downloadQRCode('${code}', '${qrUrl}')" title="Download QR Code">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download QR
          </button>
          
          <button class="qr-action-btn" onclick="window.copyLink('${code}')" title="Copy Short URL">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Show QR code sidebar with details
 */
export function showQRSidebar(code) {
  const link = STATE.links.find(l => (l.code || l.shortCode || l.id) === code);
  if (!link) {
    alert('Link not found');
    return;
  }
  
  const sidebar = document.getElementById('qr-sidebar');
  const body = document.getElementById('qr-sidebar-body');
  
  // Always use kaayko.com/l/ format (never k.kaayko.com)
  const url = `https://kaayko.com/l/${code}`;
  const qrUrl = `${CONFIG.QR_API}?size=300x300&data=${encodeURIComponent(url)}`;
  const destinations = link.destinations || {};
  
  body.innerHTML = `
    <div class="qr-display">
      <img src="${qrUrl}" alt="QR Code for ${code}">
      
      <div class="qr-info">
        <div class="qr-info-item">
          <div class="qr-info-label">Short Link</div>
          <div class="qr-info-value">${url}</div>
        </div>
        
        <div class="qr-info-item">
          <div class="qr-info-label">Title</div>
          <div class="qr-info-value">${utils.escapeHtml(link.title || 'Untitled')}</div>
        </div>
        
        ${link.description ? `
        <div class="qr-info-item">
          <div class="qr-info-label">Description</div>
          <div class="qr-info-value">${utils.escapeHtml(link.description)}</div>
        </div>
        ` : ''}
        
        <div class="qr-info-item">
          <div class="qr-info-label">Clicks</div>
          <div class="qr-info-value">${link.clickCount || 0} total clicks</div>
        </div>
        
        <div class="qr-info-item">
          <div class="qr-info-label">Status</div>
          <div class="qr-info-value">${utils.getStatusBadge(link)}</div>
        </div>
      </div>
      
      <div class="qr-actions">
        <button class="btn btn-primary" onclick="window.downloadQRCode('${code}', '${qrUrl}')">
          ⬇ Download QR Code
        </button>
        <button class="btn btn-secondary" onclick="window.copyLink('${code}')">
          📋 Copy Short URL
        </button>
      </div>
    </div>
  `;
  
  sidebar.classList.add('active');
}

/**
 * Close QR sidebar
 */
export function closeQRSidebar() {
  const sidebar = document.getElementById('qr-sidebar');
  sidebar.classList.remove('active');
}

/**
 * Download QR code as image
 */
export function downloadQRCode(code, qrUrl) {
  const link = document.createElement('a');
  link.href = qrUrl;
  link.download = `qr-${code}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  utils.showToast(`📥 Downloading QR code for ${code}`, 'success', 3000);
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

// Make functions globally accessible for onclick handlers
window.showQRSidebar = showQRSidebar;
window.closeQRSidebar = closeQRSidebar;
window.downloadQRCode = downloadQRCode;
if (!window.copyLink) {
  window.copyLink = copyLink;
}
