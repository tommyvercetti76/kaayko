/**
 * Smart Links Enterprise - Utility Functions
 * Helper functions used across the application
 */

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp._seconds ? new Date(timestamp._seconds * 1000) : new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function isExpired(expiresAt) {
  if (!expiresAt) return false;
  const date = expiresAt._seconds ? new Date(expiresAt._seconds * 1000) : new Date(expiresAt);
  return date < new Date();
}

export function isExpiringSoon(expiresAt) {
  if (!expiresAt) return false;
  const date = expiresAt._seconds ? new Date(expiresAt._seconds * 1000) : new Date(expiresAt);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return date > new Date() && (date - new Date()) < sevenDays;
}

export function getStatusBadge(link) {
  if (!link.enabled) return '<span class="badge badge-error">Disabled</span>';
  if (isExpired(link.expiresAt)) return '<span class="badge badge-error">Expired</span>';
  if (isExpiringSoon(link.expiresAt)) return '<span class="badge badge-warning">Expiring</span>';
  return '<span class="badge badge-success">Active</span>';
}

export function getRowClass(link) {
  if (!link.enabled) return 'row-disabled';
  if (isExpired(link.expiresAt)) return 'row-expired';
  if (isExpiringSoon(link.expiresAt)) return 'row-expiring';
  return '';
}

export function showSuccess(message, duration = 4000) {
  showToast(message, 'success', duration);
}

export function showError(message, duration = 5000) {
  showToast(message, 'error', duration);
}

export function showInfo(message, duration = 3000) {
  showToast(message, 'info', duration);
}

export function showToast(message, type = 'info', duration = 3000) {
  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icon based on type
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-message">${escapeHtml(message)}</div>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  // Add to container
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('toast-show'), 10);
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function generateQRCodeURL(url, size = 512) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
}

export function timeAgo(date) {
  if (!date) return 'Never';
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return formatDate(date);
}

export function updateStat(id, value) {
  const el = document.getElementById(`stat-${id}`);
  if (el) el.textContent = value;
}

export function calculateConversionRate(stats) {
  if (!stats.totalLinks || stats.totalLinks === 0) return '0%';
  const enabledRate = ((stats.enabledLinks || 0) / stats.totalLinks) * 100;
  return `${enabledRate.toFixed(1)}%`;
}
