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

export function renderLinkAccordion(code) {
  return `
    <tr class="link-accordion-row" id="accordion-${escapeHtml(code)}">
      <td colspan="10">
        <div class="link-accordion">
          <div class="link-accordion-loading">
            <div class="acc-loader"></div>Loading analytics...
          </div>
        </div>
      </td>
    </tr>
  `;
}

export function renderLinkAccordionContent(data, link) {
  const { code, breakdown, daily } = data;
  const clicks = link?.clickCount ?? data.totalClicks ?? 0;
  const health = getLinkHealth(data);

  const last7 = buildLast7Days(daily || {});
  const maxDaily = Math.max(...last7.map(e => e[1]), 1);
  const hasChart = last7.some(e => e[1] > 0);
  const hasBd = Object.keys(breakdown?.platforms || {}).length > 0;

  return `
    <div class="acc-panel">
      <div class="acc-header">
        <div class="acc-stat acc-stat-primary">
          <span class="acc-stat-value">${clicks.toLocaleString()}</span>
          <span class="acc-stat-label">Total Clicks</span>
        </div>
        <div class="acc-stat">
          <span class="acc-stat-value">${prettifyName(getTopKey(breakdown?.platforms))}</span>
          <span class="acc-stat-label">Top Platform</span>
        </div>
        <div class="acc-stat">
          <span class="acc-stat-value">${prettifyName(getTopKey(breakdown?.browsers))}</span>
          <span class="acc-stat-label">Top Browser</span>
        </div>
        <div class="acc-stat">
          <span class="acc-stat-value">${prettifyName(getTopKey(breakdown?.devices))}</span>
          <span class="acc-stat-label">Top Device</span>
        </div>
        <div class="acc-stat">
          <span class="acc-health acc-health-${health.key}">${health.label}</span>
          <span class="acc-stat-label">Status</span>
        </div>
      </div>
      ${hasChart || hasBd ? `
      <div class="acc-body">
        ${hasChart ? `
        <div class="acc-chart">
          <span class="acc-section-title">7-Day Trend</span>
          <div class="acc-chart-bars">
            ${last7.map(([day, count]) => {
              const pct = count === 0 ? 0 : Math.max((count / maxDaily) * 100, 8);
              const dayLabel = new Date(day + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
              return `<div class="acc-bar-col" title="${day}: ${count} clicks">
                <span class="acc-bar-val">${count || ''}</span>
                <div class="acc-bar${count === 0 ? ' acc-bar-zero' : ''}" style="height:${pct || 2}%"></div>
                <span class="acc-bar-day">${dayLabel}</span>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}
        <div class="acc-breakdowns">
          ${renderBreakdownMini('Platform', breakdown?.platforms)}
          ${renderBreakdownMini('Browser', breakdown?.browsers)}
          ${renderBreakdownMini('Device', breakdown?.devices)}
        </div>
      </div>` : ''}
    </div>
  `;
}

function buildLast7Days(daily) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push([d, daily[d] || 0]);
  }
  if (days.some(e => e[1] > 0)) return days;
  const sorted = Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));
  if (!sorted.length) return days;
  const last = sorted[sorted.length - 1][0];
  const lastDate = new Date(last + 'T00:00:00');
  const historic = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(lastDate.getTime() - i * 86400000).toISOString().slice(0, 10);
    historic.push([d, daily[d] || 0]);
  }
  return historic;
}

function prettifyName(name) {
  if (!name || name === '—') return '—';
  const map = { ios: 'iOS', android: 'Android', macos: 'macOS', windows: 'Windows', linux: 'Linux', web: 'Web', mobile: 'Mobile', desktop: 'Desktop', tablet: 'Tablet', chrome: 'Chrome', safari: 'Safari', firefox: 'Firefox', edge: 'Edge', unknown: 'Other' };
  return map[name.toLowerCase()] || name.charAt(0).toUpperCase() + name.slice(1);
}

function renderBreakdownMini(title, obj) {
  if (!obj || !Object.keys(obj).length) return '';
  const sorted = Object.entries(obj)
    .filter(([k, v]) => v > 0 && k.toLowerCase() !== 'unknown')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (!sorted.length) return '';
  const max = sorted[0][1];
  return `
    <div class="acc-bd">
      <span class="acc-bd-title">${title}</span>
      ${sorted.map(([key, count]) => `
        <div class="acc-bd-row">
          <span class="acc-bd-key">${escapeHtml(prettifyName(key))}</span>
          <div class="acc-bd-bar"><div class="acc-bd-fill" style="width:${Math.max((count / max) * 100, 8)}%"></div></div>
          <span class="acc-bd-ct">${count}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function getLinkHealth(data) {
  const total = data.totalClicks || 0;
  const daily = data.daily || {};
  const days = Object.keys(daily);
  if (!days.length || total === 0) return { key: 'dormant', label: 'Dormant' };

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const recentDays = days.filter(d => d >= yesterday);
  if (recentDays.length && (daily[today] || 0) + (daily[yesterday] || 0) >= 5) {
    return { key: 'hot', label: 'Hot' };
  }
  const lastDay = days.sort().pop();
  const daysSince = Math.floor((Date.now() - new Date(lastDay).getTime()) / 86400000);
  if (daysSince > 14) return { key: 'dormant', label: 'Dormant' };
  return { key: 'active', label: 'Active' };
}

function getTopKey(obj) {
  if (!obj || !Object.keys(obj).length) return '—';
  return Object.entries(obj).sort((a, b) => b[1] - a[1])[0][0];
}

function renderIntentBadge(link) {
  const intent = link.intent || link.metadata?.intent;
  if (!intent || intent === 'view') return '';

  const INTENT_COLORS = {
    donate: { bg: 'rgba(76,175,80,.1)', border: 'rgba(76,175,80,.3)', text: '#4caf50' },
    register: { bg: 'rgba(33,150,243,.1)', border: 'rgba(33,150,243,.3)', text: '#2196f3' },
    apply: { bg: 'rgba(156,39,176,.1)', border: 'rgba(156,39,176,.3)', text: '#9c27b0' },
    purchase: { bg: 'rgba(255,152,0,.1)', border: 'rgba(255,152,0,.3)', text: '#ff9800' },
    attend: { bg: 'rgba(0,188,212,.1)', border: 'rgba(0,188,212,.3)', text: '#00bcd4' },
    download: { bg: 'rgba(96,125,139,.1)', border: 'rgba(96,125,139,.3)', text: '#607d8b' },
    survey: { bg: 'rgba(255,87,34,.1)', border: 'rgba(255,87,34,.3)', text: '#ff5722' }
  };

  const c = INTENT_COLORS[intent] || { bg: 'rgba(255,215,0,.08)', border: 'rgba(255,215,0,.25)', text: '#d4a84b' };
  return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:${c.bg};border:1px solid ${c.border};color:${c.text};border-radius:4px;padding:2px 6px;">${escapeHtml(intent)}</span>`;
}

function renderMetadataBadges(link) {
  const m = link.metadata || {};
  const parts = [];
  const pushMeta = (label, value) => {
    if (!value && value !== 0) return;
    parts.push(`<span style="font-size:11px;color:var(--text-muted);">${label}: ${escapeHtml(String(value))}</span>`);
  };

  // Health badge
  const healthBadge = renderHealthBadge(link);
  if (healthBadge) parts.push(healthBadge);

  // Intent badge
  const intentBadge = renderIntentBadge(link);
  if (intentBadge) parts.push(intentBadge);

  // Tenant context badge
  if (link.tenantId && link.tenantId !== 'kaayko-default') {
    parts.push(`<span style="display:inline-block;font-size:10px;font-weight:600;letter-spacing:.04em;background:rgba(100,181,246,.08);border:1px solid rgba(100,181,246,.25);color:#64b5f6;border-radius:4px;padding:2px 6px;">${escapeHtml(link.tenantName || link.tenantId)}</span>`);
  }

  if (m.campaign === 'alumni') {
    parts.push(`<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(212,168,75,.12);border:1px solid rgba(212,168,75,.3);color:#d4a84b;border-radius:4px;padding:2px 6px;">ALUMNI</span>`);
    pushMeta('Campaign', m.campaignId || link.utm?.utm_campaign);
    pushMeta('School', m.schoolName || m.schoolId);
    pushMeta('Group', m.sourceGroup);
    pushMeta('Batch', m.sourceBatch);
    pushMeta('Channel', m.channel);
    if (m.maxUses) pushMeta('Max', m.maxUses);
  }
  if (m.campaign === 'roots' || link.webDestination?.includes('/knowledge')) {
    parts.push(`<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(76,175,80,.1);border:1px solid rgba(76,175,80,.3);color:#4caf50;border-radius:4px;padding:2px 6px;">ROOTS</span>`);
    pushMeta('Campaign', m.campaignId || link.utm?.utm_campaign);
    pushMeta('Assessment', m.assessmentType);
    pushMeta('School', m.schoolName || m.schoolId);
  }
  if (m.isAdmin) {
    parts.push(`<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);color:#aaa;border-radius:4px;padding:2px 6px;">ADMIN</span>`);
  }
  if (m.campaign !== 'alumni' && m.campaign !== 'roots') {
    pushMeta('Campaign', m.campaignId || link.utm?.utm_campaign || m.campaign);
  }

  const goal = link.conversionGoal || m.conversionGoal;
  if (goal) {
    pushMeta('Goal', goal.replace(/_/g, ' '));
  }

  return parts.length
    ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;align-items:center;">${parts.join('')}</div>`
    : '';
}

function renderHealthBadge(link) {
  const clicks = link.clickCount || 0;
  const now = Date.now();

  if (link.expiresAt) {
    const exp = link.expiresAt._seconds ? link.expiresAt._seconds * 1000 : new Date(link.expiresAt).getTime();
    if (exp < now) {
      return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(244,67,54,.1);border:1px solid rgba(244,67,54,.3);color:#f44336;border-radius:4px;padding:2px 6px;">EXPIRED</span>`;
    }
    if (exp - now < 7 * 24 * 60 * 60 * 1000) {
      return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,152,0,.1);border:1px solid rgba(255,152,0,.3);color:#ff9800;border-radius:4px;padding:2px 6px;">EXPIRING</span>`;
    }
  }

  if (link.enabled === false) return '';

  const lastClick = link.lastClickAt;
  if (lastClick) {
    const lastClickMs = lastClick._seconds ? lastClick._seconds * 1000 : new Date(lastClick).getTime();
    const hoursSinceClick = (now - lastClickMs) / (1000 * 60 * 60);
    if (hoursSinceClick < 24 && clicks >= 3) {
      return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(255,87,34,.1);border:1px solid rgba(255,87,34,.3);color:#ff5722;border-radius:4px;padding:2px 6px;">HOT</span>`;
    }
    if (hoursSinceClick > 14 * 24) {
      return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(120,120,120,.1);border:1px solid rgba(120,120,120,.3);color:#777;border-radius:4px;padding:2px 6px;">DORMANT</span>`;
    }
  } else if (clicks === 0) {
    return `<span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:rgba(120,120,120,.1);border:1px solid rgba(120,120,120,.3);color:#777;border-radius:4px;padding:2px 6px;">DORMANT</span>`;
  }

  return '';
}

function renderLinkRow(link) {
  const code = link.code || link.shortCode || link.id;
  if (!code) return '';

  const rowClass = getRowClass(link);
  const created = formatDate(link.createdAt);
  const expires = link.expiresAt ? formatDate(link.expiresAt) : '∞ Never';
  const isEnabled = link.enabled !== false;
  const toggleClass = isEnabled ? 'toggle-active' : 'toggle-inactive';
  const toggleTitle = isEnabled ? 'Click to disable' : 'Click to enable';
  const shortUrl = link.shortUrl || `https://kaayko.com/l/${code}`;

  const displayClicks = link.metadata?.campaign === 'alumni'
    ? (link.uniqueVisitCount !== undefined ? link.uniqueVisitCount : (link.clickCount !== undefined ? link.clickCount : '-'))
    : (link.clickCount !== undefined ? link.clickCount : '-');

  return `
    <tr class="${rowClass} link-row-expandable" data-link-code="${escapeHtml(code)}">
      <td style="text-align:center;">
        <button class="btn-toggle ${toggleClass}" onclick="event.stopPropagation();window.toggleLink('${code}')" title="${toggleTitle}">
          <span class="toggle-track"></span>
        </button>
      </td>
      <td>
        <span class="code">${code}</span>
      </td>
      <td>
        <div class="title-cell">
          <strong>${escapeHtml(link.title || 'Untitled')}</strong>
          <button class="copy-inline" onclick="event.stopPropagation();window.copyLink('${code}')" title="Copy link">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          <div class="link-url">${shortUrl}</div>
          ${renderMetadataBadges(link)}
        </div>
      </td>
      <td style="color:var(--text-secondary);font-size:13px;">${escapeHtml(link.createdBy || 'system')}</td>
      <td style="text-align:center;"><strong style="color:var(--gold-primary);">${displayClicks}</strong></td>
      <td style="font-size:11px;color:var(--text-muted);">${created}</td>
      <td style="font-size:11px;color:var(--text-muted);">${expires}</td>
      <td style="text-align:center;">
        <button class="action-btn-labeled action-edit" onclick="event.stopPropagation();window.editLink('${code}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span>Edit</span>
        </button>
      </td>
      <td style="text-align:center;">
        <button class="action-btn-labeled action-qr" onclick="event.stopPropagation();window.showQRSidebar('${code}')">
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
        <button class="action-btn-icon action-delete" onclick="event.stopPropagation();window.deleteLink('${code}')" title="Delete">
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
