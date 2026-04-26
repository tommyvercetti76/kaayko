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

const SELECTED_GROUP_KEYS = new Set();

let controlsInitialized = false;
let searchTimer = null;
let filterPanelOpen = false;
let currentGroups = [];
let documentEventsBound = false;

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
  const filterToggle = document.getElementById('links-filter-toggle');
  const newLinkBtn = document.getElementById('links-new-link');

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
      clearLinkFilters({ includeSearch: true });
    });
  }

  if (filterToggle) {
    filterToggle.addEventListener('click', event => {
      event.stopPropagation();
      setFilterPanelOpen(!filterPanelOpen);
    });
  }

  if (newLinkBtn) {
    newLinkBtn.addEventListener('click', () => openCreateLink());
  }

  if (!documentEventsBound) {
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleDocumentKeydown);
    documentEventsBound = true;
  }

  controlsInitialized = true;
}

function syncControls() {
  const searchInput = document.getElementById('links-search');
  const kindSelect = document.getElementById('links-kind-filter');
  const groupSelect = document.getElementById('links-campaign-filter');

  if (searchInput) searchInput.value = FILTER_STATE.search;
  if (kindSelect) kindSelect.value = FILTER_STATE.kind;
  if (groupSelect) {
    groupSelect.value = FILTER_STATE.groupKey || '';
  }

  updateFilterToggleState();
}

function clearLinkFilters({ includeSearch = false } = {}) {
  if (includeSearch) FILTER_STATE.search = '';
  FILTER_STATE.kind = 'all';
  FILTER_STATE.groupKey = '';
  SELECTED_GROUP_KEYS.clear();
  syncControls();
  renderLinksView();
}

function setFilterPanelOpen(nextState) {
  filterPanelOpen = !!nextState;

  const panel = document.getElementById('links-filter-panel');
  if (panel) panel.classList.toggle('hidden', !filterPanelOpen);

  updateFilterToggleState();
}

function updateFilterToggleState() {
  const filterToggle = document.getElementById('links-filter-toggle');
  if (!filterToggle) return;

  const activeCount = Number(FILTER_STATE.kind !== 'all') + Number(Boolean(FILTER_STATE.groupKey));
  filterToggle.setAttribute('aria-expanded', String(filterPanelOpen));
  filterToggle.classList.toggle('is-active', filterPanelOpen || activeCount > 0);

  if (activeCount > 0) {
    filterToggle.dataset.count = String(activeCount);
  } else {
    delete filterToggle.dataset.count;
  }
}

function handleDocumentClick(event) {
  if (!filterPanelOpen) return;

  const panel = document.getElementById('links-filter-panel');
  const toggle = document.getElementById('links-filter-toggle');
  const target = event.target;

  if (panel?.contains(target) || toggle?.contains(target)) {
    return;
  }

  setFilterPanelOpen(false);
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    setFilterPanelOpen(false);
    document.querySelectorAll('.campaign-menu[open]').forEach(menu => menu.removeAttribute('open'));
  }
}

function openCreateLink() {
  if (typeof window.resetCreateForm === 'function') {
    window.resetCreateForm();
  } else {
    STATE.editingCode = null;
  }

  switchView('create');
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
    let res;
    try {
      res = await apiFetch(`/kortex?limit=${LINK_LIMIT}`);
    } catch (primaryError) {
      console.warn('[AllLinks] Primary load failed, retrying without limit query:', primaryError);
      res = await apiFetch('/kortex');
    }
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
  currentGroups = groups;
  pruneSelectedGroups(groups);

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
  const selectedGroup = groups.find(group => group.key === FILTER_STATE.groupKey);
  const totalClicks = visibleLinks.reduce((sum, link) => sum + getDisplayClicks(link), 0);
  const liveLinks = visibleLinks.filter(link => link.enabled !== false).length;
  const context = selectedGroup
    ? `Viewing ${selectedGroup.label}`
    : FILTER_STATE.search
      ? `Search: “${FILTER_STATE.search.trim()}”`
      : `${eligibleLinks.length} matching link${eligibleLinks.length === 1 ? '' : 's'}`;

  container.innerHTML = `
    <div class="links-summary-bar">
      <div class="links-summary-metrics">
        ${SummaryMetric('Campaigns', groups.length)}
        ${SummaryMetric('Links', visibleLinks.length)}
        ${SummaryMetric('Clicks', totalClicks)}
        ${SummaryMetric('Live', liveLinks)}
      </div>
      <div class="links-summary-context">
        <span class="links-summary-context-label">${selectedGroup ? 'Focused Campaign' : 'Workspace'}</span>
        <span class="links-summary-context-value">${utils.escapeHtml(context)}</span>
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
    <div class="campaign-section-header">
      <div class="campaign-section-copy">
        <h3>Campaign Groups</h3>
        <p>Scan status, jump into a campaign, and keep bulk actions out of the way until you need them.</p>
      </div>
      <div class="campaign-section-meta">${groups.length} campaign${groups.length === 1 ? '' : 's'}</div>
    </div>
    ${renderBulkSelectionBar(groups)}
    <div class="campaign-list" role="list">
      ${groups.map(CampaignRow).join('')}
    </div>
  `;
  container.classList.remove('hidden');

  container.querySelectorAll('[data-action="view-group"]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      toggleGroup(button.dataset.groupKey || '');
    });
  });

  container.querySelectorAll('[data-action="open-links"]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      closeOverflowMenu(button);
      openGroupLinks(button.dataset.groupKey || '');
    });
  });

  container.querySelectorAll('[data-action="enable-group"]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      closeOverflowMenu(button);
      bulkSetGroupEnabled(button.dataset.groupKey || '', true);
    });
  });

  container.querySelectorAll('[data-action="disable-group"]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      closeOverflowMenu(button);
      bulkSetGroupEnabled(button.dataset.groupKey || '', false);
    });
  });

  container.querySelectorAll('[data-action="assign-campaign"]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      assignCampaignId(button.dataset.groupKey || '');
    });
  });

  container.querySelectorAll('[data-action="edit-group"]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      closeOverflowMenu(button);
      editGroup(button.dataset.groupKey || '');
    });
  });

  container.querySelectorAll('[data-action="delete-group"]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      closeOverflowMenu(button);
      deleteGroupEntry(button.dataset.groupKey || '');
    });
  });

  container.querySelectorAll('.campaign-row').forEach(row => {
    row.addEventListener('click', event => {
      if (event.target.closest('button, a, input, label, details, summary, .campaign-accordion')) return;
      toggleGroup(row.dataset.groupKey || '');
    });

    row.addEventListener('keydown', event => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button, a, input, label, details, summary, .campaign-accordion')) {
        event.preventDefault();
        toggleGroup(row.dataset.groupKey || '');
      }
    });
  });

  container.querySelectorAll('.campaign-select-input').forEach(input => {
    input.addEventListener('change', event => {
      event.stopPropagation();
      updateGroupSelection(input.value, input.checked);
    });
  });

  container.querySelectorAll('[data-action="bulk-enable"]').forEach(button => {
    button.addEventListener('click', () => bulkSetSelectedGroupsEnabled(true));
  });

  container.querySelectorAll('[data-action="bulk-disable"]').forEach(button => {
    button.addEventListener('click', () => bulkSetSelectedGroupsEnabled(false));
  });

  container.querySelectorAll('[data-action="bulk-clear"]').forEach(button => {
    button.addEventListener('click', () => {
      SELECTED_GROUP_KEYS.clear();
      renderLinksView();
    });
  });

  container.querySelectorAll('.campaign-menu > summary').forEach(summary => {
    summary.addEventListener('click', event => {
      event.stopPropagation();
    });
  });
}

function renderTable(container, links) {
  const selectedGroup = currentGroups.find(group => group.key === FILTER_STATE.groupKey);

  container.classList.toggle('hidden', Boolean(selectedGroup));

  if (selectedGroup) {
    container.innerHTML = '';
    return;
  }

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
      resetBtn.addEventListener('click', () => clearLinkFilters({ includeSearch: true }));
    }
    return;
  }

  container.innerHTML = `
    <div class="links-table-shell">
      <div class="links-table-header">
        <div>
          <h3>${utils.escapeHtml(selectedGroup ? `Links in ${selectedGroup.label}` : 'Matching Links')}</h3>
          <p>${utils.escapeHtml(selectedGroup ? 'Edit, open QR, or delete individual links in this campaign.' : 'All links that match your current search and filters.')}</p>
        </div>
      </div>
      ${ui.renderLinksTable(links)}
    </div>
  `;
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

function CampaignRow(group) {
  const selected = FILTER_STATE.groupKey === group.key;
  const status = getGroupStatus(group);
  const subtext = getGroupSubtext(group);
  const signalMarkup = renderSignalChips(group);
  const isChecked = SELECTED_GROUP_KEYS.has(group.key);

  return `
    <article class="campaign-row ${selected ? 'is-focused' : ''} ${group.isUnassigned ? 'is-unassigned' : ''} ${isChecked ? 'is-selected' : ''}" role="listitem" tabindex="0" data-group-key="${utils.escapeHtml(group.key)}">
      <div class="campaign-row-shell">
        <div class="campaign-row-select">
          <input
            type="checkbox"
            class="campaign-select-input"
            value="${utils.escapeHtml(group.key)}"
            aria-label="Select ${utils.escapeHtml(group.label)}"
            ${isChecked ? 'checked' : ''}
          >
        </div>

        <div class="campaign-row-main">
          <div class="campaign-row-titleline">
            <div class="campaign-status ${status.tone}">
              <span class="campaign-status-dot"></span>
              <span class="campaign-status-label">${utils.escapeHtml(status.label)}</span>
            </div>
            <h4>${utils.escapeHtml(group.label)}</h4>
            ${group.needsCampaignId ? `<button type="button" class="campaign-inline-link" data-action="assign-campaign" data-group-key="${utils.escapeHtml(group.key)}">Assign Campaign ID</button>` : ''}
          </div>
          <div class="campaign-row-subtext">${utils.escapeHtml(subtext)}</div>
          ${signalMarkup}
        </div>

        ${MetricsInline(group)}

        <div class="campaign-row-actions">
          <button
            type="button"
            class="campaign-row-toggle"
            data-action="view-group"
            data-group-key="${utils.escapeHtml(group.key)}"
            aria-expanded="${selected ? 'true' : 'false'}"
            aria-label="${selected ? `Collapse ${group.label}` : `Expand ${group.label}`}"
            title="${selected ? 'Collapse' : 'Expand'}"
          >
            <span class="campaign-row-toggle-line campaign-row-toggle-line-horizontal"></span>
            <span class="campaign-row-toggle-line campaign-row-toggle-line-vertical"></span>
          </button>
          ${OverflowMenu(group)}
        </div>
      </div>
      ${selected ? CampaignAccordion(group) : ''}
    </article>
  `;
}

function CampaignAccordion(group) {
  return `
    <div class="campaign-accordion" data-group-key="${utils.escapeHtml(group.key)}">
      <div class="campaign-accordion-head">
        <div>
          <h5>${group.linkCount} link${group.linkCount === 1 ? '' : 's'} in ${utils.escapeHtml(group.label)}</h5>
          <p>Edit, open QR, enable or disable, and remove individual links without leaving this campaign row.</p>
        </div>
        ${group.needsCampaignId ? `<button type="button" class="btn btn-secondary campaign-accordion-assign" data-action="assign-campaign" data-group-key="${utils.escapeHtml(group.key)}">Assign Campaign ID</button>` : ''}
      </div>
      ${group.warning ? `<div class="campaign-accordion-note">${utils.escapeHtml(group.warning)}</div>` : ''}
      <div class="campaign-accordion-table">
        ${ui.renderLinksTable(group.links)}
      </div>
    </div>
  `;
}

function MetricsInline(group) {
  return `
    <div class="campaign-row-metrics" aria-label="Campaign metrics">
      ${MetricPill('Links', group.linkCount)}
      ${MetricPill('Clicks', group.totalClicks)}
      ${MetricPill('Live', group.liveLinks)}
    </div>
  `;
}

function OverflowMenu(group) {
  const singleLink = group.links.length === 1;
  const editState = singleLink ? '' : 'is-disabled';
  const deleteState = singleLink ? 'is-danger' : 'is-disabled';

  return `
    <details class="campaign-menu">
      <summary class="campaign-menu-trigger" aria-label="More actions for ${utils.escapeHtml(group.label)}">
        <span></span><span></span><span></span>
      </summary>
      <div class="campaign-menu-popover" role="menu">
        <button type="button" class="campaign-menu-item" data-action="open-links" data-group-key="${utils.escapeHtml(group.key)}" role="menuitem">Open Links</button>
        <button type="button" class="campaign-menu-item" data-action="enable-group" data-group-key="${utils.escapeHtml(group.key)}" role="menuitem">Enable All</button>
        <button type="button" class="campaign-menu-item" data-action="disable-group" data-group-key="${utils.escapeHtml(group.key)}" role="menuitem">Disable All</button>
        <button type="button" class="campaign-menu-item ${editState}" data-action="edit-group" data-group-key="${utils.escapeHtml(group.key)}" role="menuitem" ${singleLink ? '' : 'disabled title="Use View to edit an individual link in this campaign"'}>Edit</button>
        <button type="button" class="campaign-menu-item ${deleteState}" data-action="delete-group" data-group-key="${utils.escapeHtml(group.key)}" role="menuitem" ${singleLink ? '' : 'disabled title="Use View to delete an individual link in this campaign"'}>Delete</button>
      </div>
    </details>
  `;
}

function SummaryMetric(label, value) {
  return `
    <div class="links-summary-item">
      <span class="links-summary-item-label">${label}</span>
      <strong class="links-summary-item-value">${value}</strong>
    </div>
  `;
}

function MetricPill(label, value) {
  return `
    <div class="metric-inline">
      <span class="metric-inline-label">${label}</span>
      <strong class="metric-inline-value">${value}</strong>
    </div>
  `;
}

function renderBulkSelectionBar(groups) {
  if (!SELECTED_GROUP_KEYS.size) return '';

  const selectedGroups = groups.filter(group => SELECTED_GROUP_KEYS.has(group.key));
  const totalLinks = selectedGroups.reduce((sum, group) => sum + group.linkCount, 0);

  return `
    <div class="campaign-bulk-bar">
      <div class="campaign-bulk-copy">
        <strong>${selectedGroups.length}</strong>
        <span>campaign${selectedGroups.length === 1 ? '' : 's'} selected · ${totalLinks} link${totalLinks === 1 ? '' : 's'}</span>
      </div>
      <div class="campaign-bulk-actions">
        <button type="button" class="btn btn-secondary campaign-bulk-btn" data-action="bulk-enable">Enable Selected</button>
        <button type="button" class="btn btn-secondary campaign-bulk-btn" data-action="bulk-disable">Disable Selected</button>
        <button type="button" class="btn btn-secondary campaign-bulk-btn" data-action="bulk-clear">Clear</button>
      </div>
    </div>
  `;
}

function renderSignalChips(group) {
  const previewBits = Array.isArray(group.previewList) ? group.previewList.filter(Boolean) : [];
  if (!previewBits.length) return '';

  const visible = previewBits.slice(0, 2);
  const hidden = previewBits.slice(2);

  return `
    <div class="campaign-signals">
      ${visible.map(signal => `<span class="campaign-signal-chip" title="${utils.escapeHtml(String(signal))}">${utils.escapeHtml(String(signal))}</span>`).join('')}
      ${hidden.length ? `<span class="campaign-signal-chip campaign-signal-more" title="${utils.escapeHtml(hidden.join(' • '))}">+${hidden.length} more</span>` : ''}
    </div>
  `;
}

function getGroupStatus(group) {
  if (group.liveLinks === 0) {
    return { tone: 'paused', label: 'Paused' };
  }

  if (group.liveLinks === group.linkCount) {
    return { tone: 'live', label: 'Live' };
  }

  return { tone: 'partial', label: 'Partial' };
}

function getGroupSubtext(group) {
  const detailBits = String(group.detail || '')
    .split(' · ')
    .map(bit => bit.trim())
    .filter(Boolean)
    .slice(0, 2);

  const parts = [group.kindLabel];
  if (detailBits.length) {
    parts.push(...detailBits);
  } else if (group.subtitle) {
    parts.push(group.subtitle);
  }

  return parts.join(' • ');
}

function closeOverflowMenu(source) {
  const menu = source?.closest('.campaign-menu');
  if (menu) menu.removeAttribute('open');
}

function pruneSelectedGroups(groups) {
  const available = new Set(groups.map(group => group.key));
  Array.from(SELECTED_GROUP_KEYS).forEach(groupKey => {
    if (!available.has(groupKey)) SELECTED_GROUP_KEYS.delete(groupKey);
  });
}

function updateGroupSelection(groupKey, selected) {
  if (!groupKey) return;

  if (selected) {
    SELECTED_GROUP_KEYS.add(groupKey);
  } else {
    SELECTED_GROUP_KEYS.delete(groupKey);
  }

  renderLinksView();
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
        warning: '',
        needsCampaignId: false,
        isUnassigned: false
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
        warning: 'Add a Campaign ID to separate multiple school campaigns cleanly.',
        needsCampaignId: true,
        isUnassigned: false
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
        warning: 'Use a Campaign ID if this group belongs to a larger campaign.',
        needsCampaignId: true,
        isUnassigned: false
      };
    }

    return {
      key: 'alumni:ungrouped',
      label: 'Alumni · Unassigned',
      subtitle: 'Alumni links missing campaign setup',
      detail: batch || channel || '',
      kindLabel: 'Alumni',
      kindRank: 1,
      warning: 'Set School Name and Campaign ID to manage these links separately.',
      needsCampaignId: true,
      isUnassigned: true
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
      warning: '',
      needsCampaignId: false,
      isUnassigned: false
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
      warning: '',
      needsCampaignId: false,
      isUnassigned: false
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
      warning: '',
      needsCampaignId: false,
      isUnassigned: false
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
    warning: campaignId ? '' : 'Add a Campaign ID to manage related general links together.',
    needsCampaignId: false,
    isUnassigned: false
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
  const res = await apiFetch(`/kortex/${code}`, {
    method: 'PUT',
    body: JSON.stringify({ enabled })
  });

  if (!res) throw new Error('Authentication failed');

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || `Failed to ${enabled ? 'enable' : 'disable'} link`);
  }
}

function getGroupByKey(groupKey) {
  return currentGroups.find(group => group.key === groupKey) || null;
}

function focusGroup(groupKey, { scrollToAccordion = false } = {}) {
  if (!groupKey) return;

  FILTER_STATE.groupKey = groupKey;
  syncControls();
  setFilterPanelOpen(false);
  renderLinksView();

  if (scrollToAccordion) {
    window.requestAnimationFrame(() => {
      document.querySelector(`.campaign-accordion[data-group-key="${groupKey}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
}

function toggleGroup(groupKey) {
  if (!groupKey) return;

  if (FILTER_STATE.groupKey === groupKey) {
    FILTER_STATE.groupKey = '';
    syncControls();
    renderLinksView();
    return;
  }

  focusGroup(groupKey);
}

function openGroupLinks(groupKey) {
  focusGroup(groupKey, { scrollToAccordion: true });
}

function assignCampaignId(groupKey) {
  const group = getGroupByKey(groupKey);
  if (!group) return;

  if (group.links.length === 1) {
    editLink(getLinkCode(group.links[0]));
    return;
  }

  openGroupLinks(groupKey);
  utils.showInfo('Filtered to this campaign group. Edit any link below to assign a Campaign ID.');
}

function editGroup(groupKey) {
  const group = getGroupByKey(groupKey);
  if (!group) return;

  if (group.links.length === 1) {
    editLink(getLinkCode(group.links[0]));
    return;
  }

  openGroupLinks(groupKey);
  utils.showInfo('This campaign has multiple links. Use the filtered table below to edit an individual link.');
}

function deleteGroupEntry(groupKey) {
  const group = getGroupByKey(groupKey);
  if (!group) return;

  if (group.links.length === 1) {
    deleteLink(getLinkCode(group.links[0]));
    return;
  }

  openGroupLinks(groupKey);
  utils.showInfo('This campaign has multiple links. Use the filtered table below to delete an individual link.');
}

function buildEnabledTargets(groupKeys, enabled) {
  const seen = new Set();
  const groups = groupKeys
    .map(getGroupByKey)
    .filter(Boolean);

  const targets = [];
  groups.forEach(group => {
    group.links.forEach(link => {
      const code = getLinkCode(link);
      if (!code || seen.has(code)) return;
      if ((link.enabled !== false) === enabled) return;
      seen.add(code);
      targets.push(link);
    });
  });

  return { groups, targets };
}

async function bulkSetGroupEnabled(groupKey, enabled) {
  const { groups, targets } = buildEnabledTargets([groupKey], enabled);
  const group = groups[0];

  if (!group) {
    utils.showError('Campaign group not found');
    return;
  }

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

async function bulkSetSelectedGroupsEnabled(enabled) {
  const selectedKeys = Array.from(SELECTED_GROUP_KEYS);
  if (!selectedKeys.length) return;

  const { groups, targets } = buildEnabledTargets(selectedKeys, enabled);
  if (!targets.length) {
    utils.showInfo(`Selected campaigns are already ${enabled ? 'enabled' : 'disabled'}`);
    return;
  }

  const action = enabled ? 'enable' : 'disable';
  const confirmed = confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${targets.length} link${targets.length === 1 ? '' : 's'} across ${groups.length} campaign${groups.length === 1 ? '' : 's'}?`);
  if (!confirmed) return;

  try {
    const results = await Promise.allSettled(
      targets.map(link => setLinkEnabled(getLinkCode(link), enabled))
    );

    const successCount = results.filter(result => result.status === 'fulfilled').length;
    const failureCount = results.length - successCount;

    SELECTED_GROUP_KEYS.clear();

    if (failureCount > 0) {
      utils.showToast(`${successCount} link${successCount === 1 ? '' : 's'} updated, ${failureCount} failed`, 'warning', 5000);
    } else {
      utils.showSuccess(`${groups.length} campaign${groups.length === 1 ? '' : 's'} ${enabled ? 'enabled' : 'disabled'} successfully`);
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
    const res = await apiFetch(`/kortex/${code}`, {
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
