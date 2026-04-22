/**
 * All Links View Module
 * Displays and manages all smart links with campaign-aware grouping.
 */

import { STATE, utils, ui, switchView } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';

const LINK_LIMIT = 250;

const FILTER_STATE = {
  search: '',
  kind: 'all',
  groupKey: ''
};

let controlsInitialized = false;
let searchTimer = null;

/**
 * Initialize All Links view
 */
export async function init(state) {
  console.log('[AllLinks] Initializing view');
  initControls();
  syncControls();
  await loadLinks();
}

function initControls() {
  if (controlsInitialized) return;

  const searchInput = document.getElementById('links-search');
  const kindSelect = document.getElementById('links-kind-filter');
  const groupSelect = document.getElementById('links-campaign-filter');
  const clearBtn = document.getElementById('links-clear-filters');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      FILTER_STATE.search = searchInput.value || '';
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => renderLinksView(), 120);
    });
  }

  if (kindSelect) {
    kindSelect.addEventListener('change', () => {
      FILTER_STATE.kind = kindSelect.value || 'all';
      FILTER_STATE.groupKey = '';
      renderLinksView();
    });
  }

  if (groupSelect) {
    groupSelect.addEventListener('change', () => {
      FILTER_STATE.groupKey = groupSelect.value || '';
      renderLinksView();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      FILTER_STATE.search = '';
      FILTER_STATE.kind = 'all';
      FILTER_STATE.groupKey = '';
      syncControls();
      renderLinksView();
    });
  }

  controlsInitialized = true;
}

function syncControls() {
  const searchInput = document.getElementById('links-search');
  const kindSelect = document.getElementById('links-kind-filter');
  const groupSelect = document.getElementById('links-campaign-filter');

  if (searchInput) searchInput.value = FILTER_STATE.search;
  if (kindSelect) kindSelect.value = FILTER_STATE.kind;
  if (groupSelect && FILTER_STATE.groupKey) groupSelect.value = FILTER_STATE.groupKey;
}

/**
 * Load all links from API
 */
async function loadLinks() {
  const tableContainer = document.getElementById('links-table');
  const groupsContainer = document.getElementById('links-groups');
  const summary = document.getElementById('links-summary');
  const loading = document.getElementById('links-loading');
  const empty = document.getElementById('links-empty');

  if (loading) loading.classList.remove('hidden');
  if (empty) empty.classList.add('hidden');
  if (tableContainer) tableContainer.innerHTML = '';
  if (groupsContainer) {
    groupsContainer.innerHTML = '';
    groupsContainer.classList.add('hidden');
  }
  if (summary) {
    summary.innerHTML = '';
    summary.classList.add('hidden');
  }

  try {
    const res = await apiFetch(`/smartlinks?limit=${LINK_LIMIT}`);
    if (!res) return;
    const data = await res.json();

    if (!data.success) throw new Error('Failed to load links');

    if (data.links) {
      STATE.links = data.links;
    } else if (data.short || data.structured) {
      STATE.links = [...(data.structured || []), ...(data.short || [])];
    } else {
      STATE.links = [];
    }

    if (loading) loading.classList.add('hidden');

    if (STATE.links.length === 0) {
      if (empty) empty.classList.remove('hidden');
      return;
    }

    renderLinksView();
  } catch (err) {
    if (loading) loading.classList.add('hidden');
    if (empty) empty.classList.add('hidden');
    if (tableContainer) {
      tableContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Error Loading Links</h3><p>${utils.escapeHtml(err.message)}</p></div>`;
    }
  }
}

function renderLinksView() {
  const tableContainer = document.getElementById('links-table');
  const groupsContainer = document.getElementById('links-groups');
  const summary = document.getElementById('links-summary');
  const empty = document.getElementById('links-empty');

  if (!tableContainer || !groupsContainer || !summary) return;

  if (!STATE.links.length) {
    if (empty) empty.classList.remove('hidden');
    tableContainer.innerHTML = '';
    groupsContainer.innerHTML = '';
    groupsContainer.classList.add('hidden');
    summary.innerHTML = '';
    summary.classList.add('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');

  const eligibleLinks = STATE.links.filter(link => {
    const descriptor = getCampaignDescriptor(link);
    return matchesKind(link) && matchesSearch(link, descriptor);
  });

  const groups = buildCampaignGroups(eligibleLinks);
  const selectedGroup = groups.find(group => group.key === FILTER_STATE.groupKey);
  if (!selectedGroup) FILTER_STATE.groupKey = '';

  populateGroupFilter(groups);
  syncControls();

  const visibleLinks = FILTER_STATE.groupKey
    ? eligibleLinks.filter(link => getCampaignDescriptor(link).key === FILTER_STATE.groupKey)
    : eligibleLinks;

  renderSummary(summary, groups, eligibleLinks, visibleLinks);
  renderGroups(groupsContainer, groups);
  renderTable(tableContainer, visibleLinks);
}

function renderSummary(container, groups, eligibleLinks, visibleLinks) {
  const totalClicks = visibleLinks.reduce((sum, link) => sum + getDisplayClicks(link), 0);
  const liveLinks = visibleLinks.filter(link => link.enabled !== false).length;
  const selectedGroup = groups.find(group => group.key === FILTER_STATE.groupKey);
  const heading = selectedGroup ? selectedGroup.label : 'Campaign Workspace';
  const subheading = selectedGroup
    ? `${selectedGroup.linkCount} related link${selectedGroup.linkCount === 1 ? '' : 's'} in focus. Bulk actions here affect only this campaign group.`
    : 'Search every smart link, isolate a campaign group, and manage related outreach from one surface.';
  const warning = selectedGroup?.warning
    ? `<div class="links-summary-alert">${utils.escapeHtml(selectedGroup.warning)}</div>`
    : '';

  container.innerHTML = `
    <div class="links-summary-shell">
      <div class="links-summary-copy">
        <span class="links-summary-kicker">${selectedGroup ? 'Focused campaign group' : 'Campaign operations'}</span>
        <h3>${utils.escapeHtml(heading)}</h3>
        <p>${utils.escapeHtml(subheading)}</p>
        ${warning}
      </div>
      <div class="links-summary-stats">
        <div class="links-summary-stat">
          <span class="links-summary-label">Campaign Groups</span>
          <strong class="links-summary-value">${groups.length}</strong>
        </div>
        <div class="links-summary-stat">
          <span class="links-summary-label">Links Shown</span>
          <strong class="links-summary-value">${visibleLinks.length}</strong>
        </div>
        <div class="links-summary-stat">
          <span class="links-summary-label">Clicks</span>
          <strong class="links-summary-value">${totalClicks}</strong>
        </div>
        <div class="links-summary-stat">
          <span class="links-summary-label">Live Links</span>
          <strong class="links-summary-value">${liveLinks}</strong>
          <span class="links-summary-caption">${eligibleLinks.length} matching total</span>
        </div>
      </div>
    </div>
  `;
  container.classList.remove('hidden');
}

function renderGroups(container, groups) {
  if (!groups.length) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }

  container.innerHTML = `
    <div class="campaign-groups-header">
      <div>
        <h3>Campaign Groups</h3>
        <p>Each row clusters related links so you can inspect, filter, and bulk-manage a campaign without losing the full table below.</p>
      </div>
      <div class="campaign-groups-count">${groups.length} group${groups.length === 1 ? '' : 's'}</div>
    </div>
    <div class="campaign-groups-grid">
      ${groups.map(renderGroupCard).join('')}
    </div>
  `;
  container.classList.remove('hidden');

  container.querySelectorAll('[data-action="focus-group"]').forEach(button => {
    button.addEventListener('click', () => {
      const groupKey = button.dataset.groupKey || '';
      FILTER_STATE.groupKey = FILTER_STATE.groupKey === groupKey ? '' : groupKey;
      const groupSelect = document.getElementById('links-campaign-filter');
      if (groupSelect) groupSelect.value = FILTER_STATE.groupKey;
      renderLinksView();
    });
  });

  container.querySelectorAll('[data-action="enable-group"]').forEach(button => {
    button.addEventListener('click', () => bulkSetGroupEnabled(button.dataset.groupKey, true));
  });

  container.querySelectorAll('[data-action="disable-group"]').forEach(button => {
    button.addEventListener('click', () => bulkSetGroupEnabled(button.dataset.groupKey, false));
  });
}

function renderTable(container, links) {
  if (!links.length) {
    container.innerHTML = `
      <div class="empty-state links-empty-state">
        <div class="empty-icon">🧭</div>
        <h3>No Links Match These Filters</h3>
        <p>Try another campaign group or clear your filters.</p>
        <button type="button" class="btn btn-secondary" id="links-empty-reset">Clear Filters</button>
      </div>
    `;
    const resetBtn = document.getElementById('links-empty-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        FILTER_STATE.search = '';
        FILTER_STATE.kind = 'all';
        FILTER_STATE.groupKey = '';
        syncControls();
        renderLinksView();
      });
    }
    return;
  }

  container.innerHTML = ui.renderLinksTable(links);
}

function populateGroupFilter(groups) {
  const groupSelect = document.getElementById('links-campaign-filter');
  if (!groupSelect) return;

  const options = ['<option value="">All campaign groups</option>']
    .concat(groups.map(group => (
      `<option value="${utils.escapeHtml(group.key)}">${utils.escapeHtml(group.label)} (${group.linkCount})</option>`
    )));

  groupSelect.innerHTML = options.join('');

  if (FILTER_STATE.groupKey && groups.some(group => group.key === FILTER_STATE.groupKey)) {
    groupSelect.value = FILTER_STATE.groupKey;
  } else {
    groupSelect.value = '';
  }
}

function buildCampaignGroups(links) {
  const map = new Map();

  links.forEach(link => {
    const descriptor = getCampaignDescriptor(link);
    const existing = map.get(descriptor.key);

    if (!existing) {
      map.set(descriptor.key, {
        ...descriptor,
        links: [link],
        linkCount: 1,
        totalClicks: getDisplayClicks(link),
        liveLinks: link.enabled !== false ? 1 : 0,
        previewBits: new Set(getPreviewBits(link))
      });
      return;
    }

    existing.links.push(link);
    existing.linkCount += 1;
    existing.totalClicks += getDisplayClicks(link);
    existing.liveLinks += link.enabled !== false ? 1 : 0;
    getPreviewBits(link).forEach(bit => existing.previewBits.add(bit));
  });

  return Array.from(map.values())
    .map(group => ({
      ...group,
      previewList: Array.from(group.previewBits).slice(0, 4),
      disabledLinks: group.linkCount - group.liveLinks
    }))
    .sort((a, b) => {
      if (a.kindRank !== b.kindRank) return a.kindRank - b.kindRank;
      if (b.linkCount !== a.linkCount) return b.linkCount - a.linkCount;
      if (b.totalClicks !== a.totalClicks) return b.totalClicks - a.totalClicks;
      return a.label.localeCompare(b.label);
    });
}

function renderGroupCard(group) {
  const selected = FILTER_STATE.groupKey === group.key;
  const manageLabel = selected ? 'Showing Links' : `Open ${group.linkCount} Link${group.linkCount === 1 ? '' : 's'}`;
  const detailBits = String(group.detail || '')
    .split(' · ')
    .map(bit => bit.trim())
    .filter(Boolean)
    .slice(0, 4);
  const previewBits = Array.isArray(group.previewList) ? group.previewList : [];
  const liveState = group.disabledLinks === 0
    ? '<span class="campaign-state-chip campaign-state-live">All live</span>'
    : `<span class="campaign-state-chip campaign-state-muted">${group.disabledLinks} paused</span>`;
  const focusState = selected
    ? '<span class="campaign-state-chip campaign-state-focus">Focused</span>'
    : '';

  return `
    <article class="campaign-card ${selected ? 'active' : ''}">
      <div class="campaign-card-main">
        <div class="campaign-card-copy">
          <div class="campaign-card-kicker">
            <span class="campaign-kind">${utils.escapeHtml(group.kindLabel)}</span>
            ${liveState}
            ${focusState}
          </div>
          <div class="campaign-card-title-row">
            <div class="campaign-card-title-copy">
              <h4>${utils.escapeHtml(group.label)}</h4>
              <p>${utils.escapeHtml(group.subtitle)}</p>
            </div>
            <div class="campaign-card-stats">
              <div class="campaign-stat">
                <span>Links</span>
                <strong>${group.linkCount}</strong>
              </div>
              <div class="campaign-stat">
                <span>Clicks</span>
                <strong>${group.totalClicks}</strong>
              </div>
              <div class="campaign-stat">
                <span>Live</span>
                <strong>${group.liveLinks}</strong>
              </div>
            </div>
          </div>
          ${detailBits.length ? `<div class="campaign-meta-chips">${renderChipList(detailBits, 'campaign-meta-chip')}</div>` : ''}
          ${group.warning ? `<div class="campaign-warning">${utils.escapeHtml(group.warning)}</div>` : ''}
          <div class="campaign-preview-block">
            <span class="campaign-preview-label">Signals</span>
            <div class="campaign-preview-chips">
              ${previewBits.length
                ? renderChipList(previewBits, 'campaign-preview-chip')
                : '<span class="campaign-preview-empty">No campaign details yet</span>'
              }
            </div>
          </div>
        </div>
        <div class="campaign-card-actions">
          <button type="button" class="btn ${selected ? 'btn-primary' : 'btn-secondary'} campaign-card-button" data-action="focus-group" data-group-key="${utils.escapeHtml(group.key)}">${manageLabel}</button>
          <button type="button" class="btn btn-secondary campaign-card-button campaign-card-button-muted" data-action="enable-group" data-group-key="${utils.escapeHtml(group.key)}">Enable All</button>
          <button type="button" class="btn btn-secondary campaign-card-button campaign-card-button-muted" data-action="disable-group" data-group-key="${utils.escapeHtml(group.key)}">Disable All</button>
        </div>
      </div>
    </article>
  `;
}

function renderChipList(values, className) {
  return values
    .filter(Boolean)
    .map(value => `<span class="${className}">${utils.escapeHtml(String(value))}</span>`)
    .join('');
}

function matchesKind(link) {
  if (FILTER_STATE.kind === 'all') return true;
  return getLinkKind(link) === FILTER_STATE.kind;
}

function matchesSearch(link, descriptor) {
  const needle = normalizeText(FILTER_STATE.search);
  if (!needle) return true;

  const metadata = link.metadata || {};
  const searchable = [
    getLinkCode(link),
    link.title,
    link.description,
    link.createdBy,
    link.shortUrl,
    link.destinations?.web,
    metadata.campaignId,
    metadata.campaign,
    metadata.schoolName,
    metadata.schoolId,
    metadata.sourceGroup,
    metadata.sourceBatch,
    metadata.channel,
    metadata.chapterOrRegion,
    link.utm?.utm_campaign,
    link.utm?.utm_source,
    descriptor.label,
    descriptor.subtitle,
    descriptor.detail
  ]
    .filter(Boolean)
    .join(' ');

  return normalizeText(searchable).includes(needle);
}

function getLinkKind(link) {
  const metadata = link.metadata || {};
  const webDestination = (link.destinations?.web || link.webDestination || '').toLowerCase();

  if (metadata.campaign === 'alumni') return 'alumni';
  if (metadata.campaign === 'roots' || webDestination.includes('/knowledge')) return 'roots';
  if (metadata.isAdmin) return 'admin';
  if (link.utm?.utm_campaign) return 'marketing';
  return 'general';
}

function getCampaignDescriptor(link) {
  const metadata = link.metadata || {};
  const kind = getLinkKind(link);
  const school = metadata.schoolName || metadata.schoolId || '';
  const campaignId = metadata.campaignId || link.utm?.utm_campaign || '';
  const sourceGroup = metadata.sourceGroup || '';
  const batch = metadata.sourceBatch ? `Batch ${metadata.sourceBatch}` : '';
  const channel = metadata.channel || link.utm?.utm_source || '';

  if (kind === 'alumni') {
    if (campaignId) {
      return {
        key: `alumni:${slugify(campaignId)}`,
        label: campaignId,
        subtitle: school ? `${school} alumni campaign` : 'Alumni campaign',
        detail: [sourceGroup, batch, channel].filter(Boolean).join(' · '),
        kindLabel: 'Alumni',
        kindRank: 1,
        warning: ''
      };
    }

    if (school) {
      return {
        key: `alumni-school:${slugify(school)}`,
        label: school,
        subtitle: 'Alumni links without a campaign ID',
        detail: [sourceGroup, batch, channel].filter(Boolean).join(' · '),
        kindLabel: 'Alumni',
        kindRank: 1,
        warning: 'Add a Campaign ID to separate multiple school campaigns cleanly.'
      };
    }

    if (sourceGroup) {
      return {
        key: `alumni-group:${slugify(sourceGroup)}`,
        label: sourceGroup,
        subtitle: 'Alumni source-group cluster',
        detail: [batch, channel].filter(Boolean).join(' · '),
        kindLabel: 'Alumni',
        kindRank: 1,
        warning: 'Use a Campaign ID if this group belongs to a larger campaign.'
      };
    }

    return {
      key: 'alumni:ungrouped',
      label: 'Alumni · Unassigned',
      subtitle: 'Alumni links missing campaign setup',
      detail: batch || channel || '',
      kindLabel: 'Alumni',
      kindRank: 1,
      warning: 'Set School Name and Campaign ID to manage these links separately.'
    };
  }

  if (kind === 'roots') {
    const rootsLabel = campaignId || school || link.title || 'ROOTS campaign';
    return {
      key: `roots:${slugify(rootsLabel)}`,
      label: rootsLabel,
      subtitle: school ? `${school} ROOTS campaign` : 'ROOTS campaign',
      detail: [metadata.assessmentType, channel].filter(Boolean).join(' · '),
      kindLabel: 'ROOTS',
      kindRank: 2,
      warning: ''
    };
  }

  if (kind === 'admin') {
    const adminLabel = campaignId || school || link.title || 'Admin links';
    return {
      key: `admin:${slugify(adminLabel)}`,
      label: adminLabel,
      subtitle: 'Admin / report links',
      detail: [sourceGroup, batch].filter(Boolean).join(' · '),
      kindLabel: 'Admin',
      kindRank: 4,
      warning: ''
    };
  }

  if (kind === 'marketing') {
    const marketingLabel = campaignId || link.title || 'Marketing campaign';
    return {
      key: `marketing:${slugify(marketingLabel)}`,
      label: marketingLabel,
      subtitle: 'UTM-driven marketing campaign',
      detail: [link.utm?.utm_source, link.utm?.utm_medium].filter(Boolean).join(' · '),
      kindLabel: 'Marketing',
      kindRank: 3,
      warning: ''
    };
  }

  const generalLabel = campaignId || metadata.campaign || link.title || 'General links';
  return {
    key: `general:${slugify(generalLabel)}`,
    label: generalLabel,
    subtitle: 'General KORTEX links',
    detail: [school, channel].filter(Boolean).join(' · '),
    kindLabel: 'General',
    kindRank: 5,
    warning: campaignId ? '' : 'Add a Campaign ID to manage related general links together.'
  };
}

function getPreviewBits(link) {
  const metadata = link.metadata || {};
  const bits = [
    metadata.sourceGroup,
    metadata.channel,
    metadata.chapterOrRegion,
    metadata.schoolName,
    link.utm?.utm_source
  ].filter(Boolean);

  if (metadata.sourceBatch) {
    bits.push(`Batch ${metadata.sourceBatch}`);
  }

  return bits;
}

function getDisplayClicks(link) {
  if (link.metadata?.campaign === 'alumni') {
    return Number(link.uniqueVisitCount ?? link.clickCount ?? 0);
  }
  return Number(link.clickCount ?? 0);
}

function getLinkCode(link) {
  return link.code || link.shortCode || link.id || '';
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function slugify(value) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'uncategorized';
}

async function setLinkEnabled(code, enabled) {
  const res = await apiFetch(`/smartlinks/${code}`, {
    method: 'PUT',
    body: JSON.stringify({ enabled })
  });

  if (!res) throw new Error('Authentication failed');

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || `Failed to ${enabled ? 'enable' : 'disable'} link`);
  }
}

async function bulkSetGroupEnabled(groupKey, enabled) {
  const groups = buildCampaignGroups(STATE.links);
  const group = groups.find(item => item.key === groupKey);
  if (!group) {
    utils.showError('Campaign group not found');
    return;
  }

  const targets = group.links.filter(link => (link.enabled !== false) !== enabled);
  if (!targets.length) {
    utils.showInfo(`${group.label} is already ${enabled ? 'enabled' : 'disabled'}`);
    return;
  }

  const action = enabled ? 'enable' : 'disable';
  const confirmed = confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${targets.length} link${targets.length === 1 ? '' : 's'} in "${group.label}"?`);
  if (!confirmed) return;

  try {
    const results = await Promise.allSettled(
      targets.map(link => setLinkEnabled(getLinkCode(link), enabled))
    );

    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    if (failureCount > 0) {
      utils.showToast(`${successCount} link${successCount === 1 ? '' : 's'} updated, ${failureCount} failed`, 'warning', 5000);
    } else {
      utils.showSuccess(`${group.label} ${enabled ? 'enabled' : 'disabled'} successfully`);
    }

    await loadLinks();
  } catch (err) {
    utils.showError(err.message);
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
  }).catch(() => {
    utils.showError('Failed to copy link');
  });
}

/**
 * Toggle link enabled/disabled
 */
export async function toggleLink(code) {
  const link = STATE.links.find(l => getLinkCode(l) === code);
  if (!link) return;

  const newStatus = !link.enabled;
  const action = newStatus ? 'enable' : 'disable';

  if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} link "${code}"?`)) {
    return;
  }

  try {
    await setLinkEnabled(code, newStatus);
    utils.showSuccess(`✅ Link "${code}" ${action}d successfully`);
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

    if (!res) throw new Error('Authentication failed');
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to delete link');
    }

    utils.showSuccess(`✅ Link "${code}" deleted successfully`);
    await loadLinks();
  } catch (err) {
    utils.showError(err.message);
  }
}

/**
 * Show QR code in sidebar
 */
export function showQRSidebar(code) {
  switchView('qrcodes');
  utils.showToast(`📱 Opening QR code for: ${code}`, 'info', 2000);
}

window.toggleLink = toggleLink;
window.editLink = editLink;
window.copyLink = copyLink;
window.deleteLink = deleteLink;
window.showQRSidebar = showQRSidebar;
