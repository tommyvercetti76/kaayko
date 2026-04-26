/**
 * Campaign Management View Module
 * Handles campaign CRUD, lifecycle management, member management, and audit logs
 */

import { STATE, CONFIG, AUTH, utils, ui } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';

let CURRENT_EDIT_CAMPAIGN = null;
let CURRENT_CAMPAIGNS = [];
const NEW_CAMPAIGN_DAYS = 14;

/**
 * Initialize Campaigns view
 */
export async function init(state) {
  console.log('[Campaigns] Initializing view');
  
  initializeEventListeners();
  await loadCampaigns();
}

/**
 * Initialize all event listeners
 */
function initializeEventListeners() {
  // Create campaign button
  document.getElementById('create-campaign-btn').addEventListener('click', openCreateModal);
  
  // Filter by status
  document.getElementById('campaign-filter-status').addEventListener('change', filterCampaigns);
  
  // Modal controls
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      this.closest('.modal').style.display = 'none';
    });
  });
  
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function() {
      this.closest('.modal').style.display = 'none';
    });
  });
  
  // Form submission
  document.getElementById('campaign-form').addEventListener('submit', handleSaveCampaign);
  document.getElementById('campaign-modal-cancel').addEventListener('click', closeCampaignModal);
}

/**
 * Load all campaigns for the authenticated user
 */
async function loadCampaigns() {
  try {
    const container = document.getElementById('campaigns-list');
    container.innerHTML = '<div class="loading">Loading campaigns...</div>';
    
    const response = await apiFetch('/campaigns', {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to load campaigns: ${response.statusText}`);
    }
    
    const data = await response.json();
    const apiCampaigns = (data.campaigns || []).sort((a, b) => {
      const aCreated = parseCampaignDateMs(a.createdAt);
      const bCreated = parseCampaignDateMs(b.createdAt);
      return bCreated - aCreated;
    });

    if (apiCampaigns.length === 0) {
      CURRENT_CAMPAIGNS = await loadDerivedCampaignsFromLinks();
    } else {
      CURRENT_CAMPAIGNS = apiCampaigns;
    }
    
    displayCampaigns(CURRENT_CAMPAIGNS);
    applyDashboardCampaignFocus();
  } catch (error) {
    console.error('[Campaigns] Error loading campaigns:', error);
    document.getElementById('campaigns-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <p>Error loading campaigns: ${error.message}</p>
        <button class="btn-primary" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

/**
 * Display campaigns in table format
 */
function displayCampaigns(campaigns) {
  const container = document.getElementById('campaigns-list');
  
  if (!campaigns || campaigns.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>No campaigns yet. Create one to get started!</p>
        <button class="btn-primary" id="empty-create-btn">Create Campaign</button>
      </div>
    `;
    document.getElementById('empty-create-btn').addEventListener('click', openCreateModal);
    return;
  }
  
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Campaign</th>
        <th>Type</th>
        <th>Status</th>
        <th>Links</th>
        <th>Members</th>
        <th>Created</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      ${campaigns.map(campaign => createCampaignRow(campaign)).join('')}
    </tbody>
  `;
  
  container.innerHTML = '';
  container.appendChild(table);
  
  // Attach event listeners to action buttons
  attachActionListeners();
}

/**
 * Create a table row for a campaign
 */
function createCampaignRow(campaign) {
  const statusClass = campaign.status.toLowerCase();
  const createdDateMs = parseCampaignDateMs(campaign.createdAt);
  const createdDate = createdDateMs > 0 ? new Date(createdDateMs).toLocaleDateString() : 'Unknown';
  const ageMeta = getCampaignAgeMeta(campaign.createdAt);
  const linkCount = Array.isArray(campaign.links) ? campaign.links.length : 0;
  const memberCount = Array.isArray(campaign.members) ? campaign.members.length : 0;
  
  return `
    <tr data-campaign-id="${campaign.campaignId}">
      <td>
        <div class="campaign-name-cell">
          <div class="campaign-name">${escapeHtml(campaign.name)}</div>
          <div class="campaign-slug">/${campaign.slug}</div>
        </div>
      </td>
      <td>${escapeHtml(campaign.type)}</td>
      <td>
        <span class="status-badge ${statusClass}">${campaign.status}</span>
      </td>
      <td><span class="stat-badge">${linkCount}</span></td>
      <td><span class="stat-badge">${memberCount}</span></td>
      <td>
        <div class="campaign-created-cell">
          <span>${createdDate}</span>
          <span class="age-badge ${ageMeta.className}">${ageMeta.label}</span>
        </div>
      </td>
      <td>
        <div class="action-buttons">
          ${campaign.isDerived ? '' : `<button class="action-btn edit-btn" data-id="${campaign.campaignId}" title="Edit campaign">Edit</button>`}
          ${campaign.isDerived ? '' : getLifecycleButton(campaign)}
          ${campaign.isDerived ? '' : `<button class="action-btn members-btn" data-id="${campaign.campaignId}" title="Manage members">Members</button>`}
          <button class="action-btn links-btn" data-id="${campaign.campaignId}" title="View links">Links</button>
          ${campaign.isDerived ? '' : `<button class="action-btn logs-btn" data-id="${campaign.campaignId}" title="View audit logs">Logs</button>`}
        </div>
      </td>
    </tr>
  `;
}

/**
 * Get lifecycle action button based on campaign status
 */
function getLifecycleButton(campaign) {
  const status = campaign.status.toLowerCase();
  
  if (status === 'active') {
    return `<button class="action-btn pause-btn" data-id="${campaign.campaignId}" title="Pause campaign">Pause</button>`;
  } else if (status === 'paused') {
    return `<button class="action-btn resume-btn" data-id="${campaign.campaignId}" title="Resume campaign">Resume</button>`;
  } else if (status === 'draft' || status === 'active') {
    return `<button class="action-btn danger archive-btn" data-id="${campaign.campaignId}" title="Archive campaign">Archive</button>`;
  }
  
  return '';
}

/**
 * Attach event listeners to dynamically created action buttons
 */
function applyDashboardCampaignFocus() {
  const campaignId = sessionStorage.getItem('dashboardCampaignFocus');
  if (!campaignId) return;

  sessionStorage.removeItem('dashboardCampaignFocus');

  const rows = Array.from(document.querySelectorAll('#campaigns-list tr[data-campaign-id]'));
  const targetRow = rows.find(row => row.dataset.campaignId === campaignId);
  if (!targetRow) return;

  targetRow.classList.add('campaign-focus-row');
  targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });

  setTimeout(() => {
    targetRow.classList.remove('campaign-focus-row');
  }, 2200);
}

function attachActionListeners() {
  // Edit buttons
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const campaignId = e.target.dataset.id;
      openEditModal(campaignId);
    });
  });
  
  // Pause buttons
  document.querySelectorAll('.pause-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const campaignId = e.target.dataset.id;
      changeCampaignStatus(campaignId, 'paused');
    });
  });
  
  // Resume buttons
  document.querySelectorAll('.resume-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const campaignId = e.target.dataset.id;
      changeCampaignStatus(campaignId, 'active');
    });
  });
  
  // Archive buttons
  document.querySelectorAll('.archive-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const campaignId = e.target.dataset.id;
      if (confirm('Archive this campaign? Links will be disabled. You can resume it later.')) {
        changeCampaignStatus(campaignId, 'archived');
      }
    });
  });
  
  // Members buttons
  document.querySelectorAll('.members-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const campaignId = e.target.dataset.id;
      openMembersModal(campaignId);
    });
  });
  
  // Links buttons
  document.querySelectorAll('.links-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const campaignId = e.target.dataset.id;
      openLinksModal(campaignId);
    });
  });
  
  // Logs buttons
  document.querySelectorAll('.logs-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const campaignId = e.target.dataset.id;
      openAuditLogModal(campaignId);
    });
  });
}

/**
 * Filter campaigns by status
 */
function filterCampaigns() {
  const filterValue = document.getElementById('campaign-filter-status').value;
  
  let filtered = CURRENT_CAMPAIGNS;
  if (filterValue === 'new') {
    filtered = CURRENT_CAMPAIGNS.filter(c => getCampaignAgeMeta(c.createdAt).isNew);
  } else if (filterValue === 'old') {
    filtered = CURRENT_CAMPAIGNS.filter(c => !getCampaignAgeMeta(c.createdAt).isNew);
  } else if (filterValue) {
    filtered = CURRENT_CAMPAIGNS.filter(c => c.status.toLowerCase() === filterValue.toLowerCase());
  }
  
  displayCampaigns(filtered);
}

function parseCampaignDateMs(createdAt) {
  if (!createdAt) return 0;
  if (typeof createdAt === 'number') return createdAt;
  if (createdAt && typeof createdAt === 'object') {
    if (Number.isFinite(createdAt._seconds)) return createdAt._seconds * 1000;
    if (Number.isFinite(createdAt.seconds)) return createdAt.seconds * 1000;
  }
  const parsed = new Date(createdAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'uncategorized';
}

async function loadDerivedCampaignsFromLinks() {
  try {
    const response = await apiFetch('/kortex?limit=500', { method: 'GET' });
    if (!response || !response.ok) return [];
    const data = await response.json();
    const links = data.links || [];
    if (!links.length) return [];

    const groups = new Map();
    links.forEach(link => {
      const metadata = link.metadata || {};
      const destination = String(link.destinations?.web || link.webDestination || '').toLowerCase();

      let type = 'general';
      if (metadata.campaign === 'alumni') type = 'alumni';
      else if (metadata.campaign === 'roots' || destination.includes('/knowledge')) type = 'roots';
      else if (metadata.isAdmin) type = 'admin';
      else if (link.utm?.utm_campaign) type = 'marketing';

      const source = metadata.campaignId || link.utm?.utm_campaign || metadata.schoolName || metadata.schoolId || link.title || `${type} campaign`;
      const key = `${type}:${slugify(source)}`;

      if (!groups.has(key)) {
        groups.set(key, {
          campaignId: `derived:${key}`,
          name: source,
          slug: slugify(source),
          type,
          status: 'legacy',
          createdAt: link.createdAt || null,
          links: [],
          members: [],
          isDerived: true
        });
      }

      const group = groups.get(key);
      group.links.push(link);
      if (parseCampaignDateMs(link.createdAt) > parseCampaignDateMs(group.createdAt)) {
        group.createdAt = link.createdAt;
      }
    });

    return Array.from(groups.values()).sort((a, b) => parseCampaignDateMs(b.createdAt) - parseCampaignDateMs(a.createdAt));
  } catch (error) {
    console.warn('[Campaigns] Failed to load derived campaigns fallback:', error);
    return [];
  }
}

function getCampaignAgeMeta(createdAt) {
  const createdMs = parseCampaignDateMs(createdAt);
  if (!createdMs) {
    return {
      isNew: false,
      label: 'OLD',
      className: 'old'
    };
  }

  const ageInDays = Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24));
  const isNew = ageInDays <= NEW_CAMPAIGN_DAYS;

  return {
    isNew,
    label: isNew ? `NEW (${ageInDays}d)` : `OLD (${ageInDays}d)`,
    className: isNew ? 'new' : 'old'
  };
}

/**
 * Open the create campaign modal
 */
function openCreateModal() {
  CURRENT_EDIT_CAMPAIGN = null;
  document.getElementById('campaign-modal-title').textContent = 'New Campaign';
  document.getElementById('campaign-form').reset();
  document.getElementById('campaign-modal').style.display = 'flex';
}

/**
 * Open the edit campaign modal
 */
async function openEditModal(campaignId) {
  try {
    const campaign = CURRENT_CAMPAIGNS.find(c => c.campaignId === campaignId);
    if (!campaign) {
      alert('Campaign not found');
      return;
    }
    
    CURRENT_EDIT_CAMPAIGN = campaign;
    document.getElementById('campaign-modal-title').textContent = `Edit: ${campaign.name}`;
    
    // Populate form
    document.getElementById('campaign-name').value = campaign.name;
    document.getElementById('campaign-slug').value = campaign.slug;
    document.getElementById('campaign-type').value = campaign.type;
    document.getElementById('campaign-maxuses').value = campaign.settings?.maxUsesPerLink || 0;
    document.getElementById('campaign-public-stats').checked = campaign.settings?.allowPublicStats || false;
    
    if (campaign.settings?.expiresAt) {
      const date = new Date(campaign.settings.expiresAt);
      document.getElementById('campaign-expiry').value = date.toISOString().slice(0, 16);
    }
    
    document.getElementById('campaign-modal').style.display = 'flex';
  } catch (error) {
    console.error('[Campaigns] Error opening edit modal:', error);
    alert('Error loading campaign details');
  }
}

/**
 * Close the campaign modal
 */
function closeCampaignModal() {
  document.getElementById('campaign-modal').style.display = 'none';
  CURRENT_EDIT_CAMPAIGN = null;
}

/**
 * Save campaign (create or update)
 */
async function handleSaveCampaign(e) {
  e.preventDefault();
  
  try {
    const name = document.getElementById('campaign-name').value.trim();
    const slug = document.getElementById('campaign-slug').value.trim();
    const type = document.getElementById('campaign-type').value;
    const maxUsesPerLink = parseInt(document.getElementById('campaign-maxuses').value) || 0;
    const allowPublicStats = document.getElementById('campaign-public-stats').checked;
    const expiresAt = document.getElementById('campaign-expiry').value ? 
      new Date(document.getElementById('campaign-expiry').value).toISOString() : null;
    
    if (!name || !slug || !type) {
      alert('Please fill in all required fields');
      return;
    }
    
    const payload = {
      name,
      slug,
      type,
      settings: {
        maxUsesPerLink,
        allowPublicStats,
        expiresAt
      }
    };
    
    const method = CURRENT_EDIT_CAMPAIGN ? 'PUT' : 'POST';
    const url = CURRENT_EDIT_CAMPAIGN ? `/campaigns/${CURRENT_EDIT_CAMPAIGN.campaignId}` : '/campaigns';
    
    const response = await apiFetch(url, {
      method,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save campaign');
    }
    
    closeCampaignModal();
    await loadCampaigns();
  } catch (error) {
    console.error('[Campaigns] Error saving campaign:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Change campaign status (pause, resume, archive)
 */
async function changeCampaignStatus(campaignId, newStatus) {
  try {
    const endpoint = newStatus === 'active' ? 'resume' : newStatus;
    const response = await apiFetch(`/campaigns/${campaignId}/${endpoint}`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update campaign');
    }
    
    await loadCampaigns();
  } catch (error) {
    console.error('[Campaigns] Error changing status:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Open members management modal
 */
async function openMembersModal(campaignId) {
  try {
    document.getElementById('members-modal').style.display = 'flex';
    const content = document.getElementById('members-content');
    content.innerHTML = '<div class="loading">Loading members...</div>';
    
    const response = await apiFetch(`/campaigns/${campaignId}`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error('Failed to load campaign details');
    }
    
    const data = await response.json();
    const campaign = data.campaign;
    
    // Mock members data - would come from backend
    const members = [
      { uid: 'owner-uid', email: 'owner@example.com', role: 'owner' },
      { uid: 'editor-uid', email: 'editor@example.com', role: 'editor' },
      { uid: 'viewer-uid', email: 'viewer@example.com', role: 'viewer' }
    ];
    
    const membersList = members.map(m => `
      <div class="member-item">
        <div class="member-info">
          <div class="member-email">${escapeHtml(m.email)}</div>
          <span class="member-role">${m.role}</span>
        </div>
        <div class="action-buttons">
          <button class="action-btn" onclick="removeMember('${campaignId}', '${m.uid}')">Remove</button>
        </div>
      </div>
    `).join('');
    
    content.innerHTML = `
      <div class="members-list">
        ${membersList || '<div class="empty-state">No members yet</div>'}
      </div>
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08);">
        <h4 style="margin-bottom: 12px;">Add Member</h4>
        <div style="display: flex; gap: 8px;">
          <input type="email" id="new-member-email" placeholder="email@example.com" style="flex: 1; padding: 8px 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; background: rgba(10,10,10,0.5); color: #f5f5f5;">
          <select id="new-member-role" style="padding: 8px 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; background: rgba(10,10,10,0.5); color: #f5f5f5;">
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
            <option value="operator">Operator</option>
          </select>
          <button class="btn-primary" onclick="addMember('${campaignId}')">Add</button>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('[Campaigns] Error opening members modal:', error);
    document.getElementById('members-content').innerHTML = `
      <div class="empty-state">
        <p>Error loading members: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Open campaign links modal
 */
async function openLinksModal(campaignId) {
  try {
    document.getElementById('campaign-links-modal').style.display = 'flex';
    const content = document.getElementById('campaign-links-content');
    content.innerHTML = '<div class="loading">Loading campaign links...</div>';

    const campaign = CURRENT_CAMPAIGNS.find(c => c.campaignId === campaignId);
    if (campaign && campaign.isDerived) {
      const links = campaign.links || [];
      if (links.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>No links in this campaign yet</p></div>';
        return;
      }

      const linksTable = document.createElement('table');
      linksTable.innerHTML = `
        <thead>
          <tr>
            <th>Code</th>
            <th>Destination</th>
            <th>Status</th>
            <th>Uses</th>
          </tr>
        </thead>
        <tbody>
          ${links.map(link => `
            <tr>
              <td><code>${escapeHtml(link.code || link.id || '—')}</code></td>
              <td>${escapeHtml(link.destinations?.web || link.webDestination || '—')}</td>
              <td><span class="status-badge ${(link.enabled === false ? 'paused' : 'active')}">${link.enabled === false ? 'paused' : 'active'}</span></td>
              <td>${link.usesCount || link.clickCount || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      `;

      content.innerHTML = '';
      content.appendChild(linksTable);
      return;
    }
    
    const response = await apiFetch(`/campaigns/${campaignId}/links`, {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error('Failed to load campaign links');
    }
    
    const data = await response.json();
    const links = data.links || [];
    
    if (links.length === 0) {
      content.innerHTML = '<div class="empty-state"><p>No links in this campaign yet</p></div>';
      return;
    }
    
    const linksTable = document.createElement('table');
    linksTable.innerHTML = `
      <thead>
        <tr>
          <th>Code</th>
          <th>Destination</th>
          <th>Status</th>
          <th>Uses</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${links.map(link => `
          <tr>
            <td><code>${escapeHtml(link.code)}</code></td>
            <td>${escapeHtml(link.destinations?.web || '—')}</td>
            <td><span class="status-badge ${link.status}">${link.status}</span></td>
            <td>${link.usesCount || 0}</td>
            <td>
              <button class="action-btn">Edit</button>
              <button class="action-btn">Delete</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
    
    content.innerHTML = '';
    content.appendChild(linksTable);
  } catch (error) {
    console.error('[Campaigns] Error opening links modal:', error);
    document.getElementById('campaign-links-content').innerHTML = `
      <div class="empty-state">
        <p>Error loading links: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Open audit log modal
 */
async function openAuditLogModal(campaignId) {
  try {
    document.getElementById('audit-log-modal').style.display = 'flex';
    const content = document.getElementById('audit-log-content');
    content.innerHTML = '<div class="loading">Loading audit logs...</div>';
    
    // Mock audit logs - in production would come from campaign_audit_logs collection
    const logs = [
      {
        action: 'CAMPAIGN_CREATED',
        message: 'Campaign created',
        timestamp: new Date().toISOString(),
        actor: 'user@example.com'
      },
      {
        action: 'CAMPAIGN_PAUSED',
        message: 'Campaign paused',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        actor: 'user@example.com'
      }
    ];
    
    content.innerHTML = logs.map(log => `
      <div class="audit-log-item">
        <div class="audit-action">${log.action}</div>
        <div class="audit-detail">
          <div class="audit-message">${log.message}</div>
          <div class="audit-timestamp">
            ${new Date(log.timestamp).toLocaleString()} by ${escapeHtml(log.actor)}
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('[Campaigns] Error opening audit log modal:', error);
    document.getElementById('audit-log-content').innerHTML = `
      <div class="empty-state">
        <p>Error loading audit logs: ${error.message}</p>
      </div>
    `;
  }
}

/**
 * Utility: Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export global functions for onclick handlers
window.removeMember = async function(campaignId, uid) {
  if (confirm('Remove this member?')) {
    try {
      const response = await apiFetch(`/campaigns/${campaignId}/members/${uid}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        alert('Member removed');
        openMembersModal(campaignId);
      } else {
        throw new Error('Failed to remove member');
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  }
};

window.addMember = async function(campaignId) {
  const email = document.getElementById('new-member-email').value.trim();
  const role = document.getElementById('new-member-role').value;
  
  if (!email) {
    alert('Please enter an email address');
    return;
  }
  
  try {
    const response = await apiFetch(`/campaigns/${campaignId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role })
    });
    
    if (response.ok) {
      alert('Member added');
      openMembersModal(campaignId);
    } else {
      throw new Error('Failed to add member');
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
};
