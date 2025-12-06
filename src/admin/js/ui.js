/**
 * Smart Links Enterprise - UI Components
 * Reusable UI components and modal handlers
 */

import { escapeHtml, generateQRCodeURL } from './utils.js';

export function showModal(title, content) {
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  if (modalTitle) modalTitle.textContent = title;
  if (modalBody) modalBody.innerHTML = content;
  if (modal) modal.classList.add('active');
}

export function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.classList.remove('active');
}

export function showQRCodeModal(link) {
  const code = link.code || link.shortCode || link.id;
  // Always use kaayko.com/l/ format (never k.kaayko.com)
  const url = `https://kaayko.com/l/${code}`;
  const qrUrl = generateQRCodeURL(url, 512);
  
  const html = `
    <div style="text-align: center;">
      <h3 style="color: var(--kaayko-gold); margin-bottom: 20px;">Link Created Successfully!</h3>
      <div class="qr-container">
        <img src="${qrUrl}" alt="QR Code" class="qr-code" id="qr-image">
      </div>
      <p style="margin: 20px 0;">
        <strong>Short URL:</strong><br>
        <span class="code" style="font-size: 18px;">${url}</span>
      </p>
      <div class="qr-actions" style="justify-content: center; margin-top: 24px;">
        <button class="btn btn-primary" onclick="window.downloadQRCode('${code}', '${url}')">
          Download PNG
        </button>
        <button class="btn btn-secondary" onclick="window.copyLink('${code}')">
          Copy Link
        </button>
      </div>
    </div>
  `;
  
  showModal('QR Code Generated', html);
}

export function renderLinksTable(links) {
  return `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Active</th>
            <th>Code</th>
            <th>Title</th>
            <th>Created By</th>
            <th>Clicks</th>
            <th>Created</th>
            <th>Expires</th>
            <th>Edit</th>
            <th>QR</th>
            <th>Delete</th>
          </tr>
        </thead>
        <tbody>
          ${links.map(link => renderLinkRow(link)).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderLinkRow(link) {
  // UPDATED: Backend v2.1.0 returns link.code (no fallback needed)
  const code = link.code;
  const rowClass = getRowClass(link);
  const created = formatDate(link.createdAt);
  const expires = link.expiresAt ? formatDate(link.expiresAt) : '∞ Never';
  const isEnabled = link.enabled !== false;
  const toggleClass = isEnabled ? 'toggle-active' : 'toggle-inactive';
  const toggleTitle = isEnabled ? 'Disable' : 'Enable';
  const shortUrl = link.shortUrl || `kaayko.com/l/${code}`;
  
  // Backend no longer returns clickCount (use analytics endpoint for stats)
  const displayClicks = link.clickCount !== undefined ? link.clickCount : '-';
  
  return `
    <tr class="${rowClass}">
      <td style="text-align:center;">
        <button class="btn-toggle ${toggleClass}" onclick="window.toggleLink('${code}')" title="${toggleTitle}">
          <span class="toggle-track"></span>
        </button>
      </td>
      <td>
        <span class="code">${code}</span>
      </td>
      <td>
        <div class="title-cell">
          <strong>${escapeHtml(link.title || 'Untitled')}</strong>
          <button class="copy-inline" onclick="window.copyLink('${code}')" title="Copy link">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <div class="link-url">${shortUrl}</div>
        </div>
      </td>
      <td style="color:var(--text-secondary);font-size:13px;">${escapeHtml(link.createdBy || 'system')}</td>
      <td style="text-align:center;"><strong style="color:var(--gold-primary);">${displayClicks}</strong></td>
      <td style="font-size:11px;color:var(--text-muted);">${created}</td>
      <td style="font-size:11px;color:var(--text-muted);">${expires}</td>
      <td style="text-align:center;">
        <button class="action-btn-labeled action-edit" onclick="window.editLink('${code}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span>Edit</span>
        </button>
      </td>
      <td style="text-align:center;">
        <button class="action-btn-labeled action-qr" onclick="window.showQRSidebar('${code}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>QR</span>
        </button>
      </td>
      <td style="text-align:center;">
        <button class="action-btn-icon action-delete" onclick="window.deleteLink('${code}')" title="Delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </td>
    </tr>
  `;
}

// Re-export utilities needed by this module
import { getRowClass, getStatusBadge, formatDate } from './utils.js';
