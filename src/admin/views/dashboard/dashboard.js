/**
 * Dashboard View Module
 * Dashboard View — Campaign shortcuts and quick actions
 */

import { switchView } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';
import { escapeHtml } from '../../js/utils.js';
import { renderLinkAccordion, renderLinkAccordionContent } from '../../js/ui.js';

const dashAccordionCache = new Map();

/**
 * Initialize dashboard view
 */
export async function init() {
  setupQuickActions();
  await Promise.all([loadKPIs(), loadCampaignShortcuts(), loadRecentLinks()]);
}

/**
 * Setup quick action buttons
 */
function setupQuickActions() {
  const buttons = document.querySelectorAll('.quick-action-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });
}

async function loadKPIs() {
  try {
    const res = await apiFetch('/kortex?limit=300');
    if (!res || !res.ok) return;
    const data = await res.json();
    const links = data.links || [];

    const totalClicks = links.reduce((sum, l) => sum + (l.clickCount || 0), 0);
    const activeLinks = links.filter(l => l.enabled !== false).length;

    let topPerformer = '—';
    if (links.length) {
      const sorted = links.slice().sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0));
      topPerformer = sorted[0].title || sorted[0].code || sorted[0].id || '—';
    }

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const expiringSoon = links.filter(l => {
      if (!l.expiresAt) return false;
      const exp = l.expiresAt._seconds ? l.expiresAt._seconds * 1000 : new Date(l.expiresAt).getTime();
      return exp > now && exp - now < sevenDays;
    }).length;

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('kpi-total-clicks', totalClicks.toLocaleString());
    el('kpi-active-links', activeLinks);
    el('kpi-top-performer', topPerformer.length > 18 ? topPerformer.slice(0, 18) + '...' : topPerformer);
    el('kpi-expiring-soon', expiringSoon);
  } catch (_) {}
}

async function loadCampaignShortcuts() {
  const container = document.getElementById('dashboard-campaign-shortcuts');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading campaign shortcuts...</div>';

  try {
    const res = await apiFetch('/campaigns?limit=200');
    if (!res || !res.ok) {
      throw new Error('Failed to load campaigns');
    }

    const data = await res.json();
    let campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];

    if (campaigns.length === 0) {
      campaigns = await deriveCampaignsFromLinks();
    }

    renderCampaignShortcuts(campaigns, container);
  } catch (error) {
    console.warn('[Dashboard] Campaign shortcuts fallback to links:', error.message);
    const campaigns = await deriveCampaignsFromLinks();
    renderCampaignShortcuts(campaigns, container);
  }
}

async function deriveCampaignsFromLinks() {
  try {
    const res = await apiFetch('/kortex?limit=300');
    if (!res || !res.ok) return [];

    const data = await res.json();
    const links = data.links || [];
    const groups = new Map();

    links.forEach(link => {
      const metadata = link.metadata || {};
      const destination = String(link.destinations?.web || link.webDestination || '').toLowerCase();
      let type = 'general';

      if (metadata.campaign === 'alumni') type = 'alumni';
      else if (metadata.campaign === 'roots' || destination.includes('/knowledge')) type = 'roots';
      else if (metadata.isAdmin) type = 'admin';
      else if (link.utm?.utm_campaign) type = 'marketing';

      const name = metadata.campaignId || link.utm?.utm_campaign || metadata.schoolName || link.title || `${type} campaign`;
      const key = `${type}:${slugify(name)}`;

      if (!groups.has(key)) {
        groups.set(key, {
          campaignId: key,
          name,
          type,
          status: 'legacy',
          links: 0
        });
      }

      groups.get(key).links += 1;
    });

    return Array.from(groups.values());
  } catch (_) {
    return [];
  }
}

function renderCampaignShortcuts(campaigns, container) {
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    container.innerHTML = '<div class="campaign-shortcuts-empty">No campaigns yet. Use Campaigns to create and organize your first one.</div>';
    return;
  }

  const sorted = campaigns
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  container.innerHTML = sorted.map(campaign => {
    const type = String(campaign.type || 'general').toUpperCase();
    const status = String(campaign.status || 'active').toUpperCase();
    const count = Number(campaign.links || 0);

    return `
      <button class="campaign-shortcut-btn" data-view="campaigns" data-campaign-id="${escapeHtml(campaign.campaignId || '')}" title="Open Campaigns">
        <span class="campaign-shortcut-title">${escapeHtml(campaign.name || 'Untitled Campaign')}</span>
        <span class="campaign-shortcut-meta">
          <span>${type}</span>
          <span>•</span>
          <span>${count} links</span>
          <span>•</span>
          <span class="campaign-shortcut-status">${status}</span>
        </span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.campaign-shortcut-btn').forEach(button => {
    button.addEventListener('click', () => {
      const campaignId = button.dataset.campaignId || '';
      if (campaignId) {
        sessionStorage.setItem('dashboardCampaignFocus', campaignId);
      } else {
        sessionStorage.removeItem('dashboardCampaignFocus');
      }
    });
  });
}

async function loadRecentLinks() {
  const container = document.getElementById('dashboard-recent-links');
  if (!container) return;

  try {
    const res = await apiFetch('/kortex?limit=50');
    if (!res || !res.ok) throw new Error('Failed to load links');

    const data = await res.json();
    const links = data.links || [];

    if (links.length === 0) {
      container.innerHTML = '<div class="campaign-shortcuts-empty">No links yet.</div>';
      return;
    }

    const recent = links.slice(0, 10);
    container.innerHTML = `
      <table class="dash-links-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Code</th>
            <th>Clicks</th>
            <th>Status</th>
            <th>Tenant</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map(link => {
            const code = escapeHtml(link.code || link.id || '');
            const enabled = link.enabled !== false;
            const status = enabled ? '<span style="color:#4CAF50">Active</span>' : '<span style="color:#f44336">Disabled</span>';
            const tenant = escapeHtml(link.tenantId || 'kaayko');
            return `<tr class="dash-link-row" data-link-code="${code}">
              <td style="color:#f0f0f0">${escapeHtml(link.title || link.code || '—')}</td>
              <td style="font-family:monospace;color:#D4A84B">${code}</td>
              <td>${link.clickCount || 0}</td>
              <td>${status}</td>
              <td style="color:#666">${tenant}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div style="text-align:center;padding:12px;color:#666;font-size:12px">
        Showing ${recent.length} of ${links.length} links — click any row for analytics
      </div>
    `;

    container.querySelectorAll('.dash-link-row').forEach(row => {
      row.addEventListener('click', () => {
        const code = row.dataset.linkCode;
        if (code) toggleDashAccordion(code);
      });
    });
  } catch (error) {
    console.error('[Dashboard] Failed to load recent links:', error);
    container.innerHTML = '<div class="campaign-shortcuts-empty">Failed to load links.</div>';
  }
}

async function toggleDashAccordion(code) {
  const existing = document.getElementById(`accordion-${code}`);
  if (existing) {
    existing.remove();
    document.querySelector(`.dash-link-row[data-link-code="${code}"]`)?.classList.remove('is-expanded');
    return;
  }

  const row = document.querySelector(`.dash-link-row[data-link-code="${code}"]`);
  if (!row) return;

  row.classList.add('is-expanded');
  row.insertAdjacentHTML('afterend', renderLinkAccordion(code));

  const inner = document.getElementById(`accordion-${code}`)?.querySelector('.link-accordion');
  if (!inner) return;

  if (dashAccordionCache.has(code)) {
    inner.innerHTML = renderLinkAccordionContent(dashAccordionCache.get(code));
    return;
  }

  try {
    const res = await apiFetch(`/kortex/${code}/clicks?limit=100`);
    if (!res || !res.ok) throw new Error('Failed');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed');
    dashAccordionCache.set(code, data);
    inner.innerHTML = renderLinkAccordionContent(data);
  } catch (err) {
    inner.innerHTML = `<div class="link-accordion-error">Could not load analytics: ${escapeHtml(err.message)}</div>`;
  }
}

function slugify(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'uncategorized';
}


