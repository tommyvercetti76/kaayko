/**
 * Dashboard View Module
 * Dashboard View — Campaign shortcuts and quick actions
 */

import { switchView } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';
import { escapeHtml } from '../../js/utils.js';

/**
 * Initialize dashboard view
 */
export async function init() {
  setupQuickActions();
  await loadCampaignShortcuts();
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
    const res = await apiFetch('/smartlinks?limit=300');
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

function slugify(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'uncategorized';
}


