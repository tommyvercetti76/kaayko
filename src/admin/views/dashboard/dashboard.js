/**
 * Dashboard View Module
 * Displays stats overview and recent links with sparklines
 */

import { CONFIG, AUTH, utils, ui, STATE, switchView } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';
import { escapeHtml } from '../../js/utils.js';

// Sparkline instances
let sparklineInstances = {};

/**
 * Initialize dashboard view
 */
export async function init(state) {
  console.log('📊 Loading Dashboard...');
  console.log('   State:', state);
  console.log('   CONFIG:', CONFIG);
  console.log('   AUTH:', AUTH);
  
  // Show/hide sync actions based on environment
  const syncActions = document.getElementById('sync-actions');
  console.log('   Sync actions element:', !!syncActions);
  if (syncActions) {
    syncActions.style.display = CONFIG.ENVIRONMENT === 'local' ? 'block' : 'none';
  }
  
  // Setup quick actions
  setupQuickActions();
  
  console.log('   📈 Loading stats...');
  await loadStats();
  console.log('   ✅ Stats loaded');
  
  console.log('   🔗 Loading recent links...');
  await loadRecentLinks();
  console.log('   ✅ Recent links loaded');
  console.log('✅ Dashboard initialization complete');
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

/**
 * Load stats cards
 */
async function loadStats() {
  console.log('📈 Loading stats...');
  console.log('   utils:', typeof utils);
  console.log('   utils.updateStat:', typeof utils.updateStat);
  
  utils.updateStat('totalLinks', '—');
  utils.updateStat('totalClicks', '—');
  utils.updateStat('activeLinks', '—');
  utils.updateStat('conversionRate', '—');
  
  try {
    console.log('📊 Fetching stats from:', `${CONFIG.API_BASE}/smartlinks/stats`);
    const res = await apiFetch('/smartlinks/stats');
    
    if (!res) {
      throw new Error('Stats API request failed - no response');
    }
    
    console.log('📦 Stats response status:', res.status);
    const data = await res.json();
    console.log('📊 Stats data:', data);
    
    if (data.success) {
      console.log('✅ Stats loaded successfully');
      const stats = data.stats;
      
      utils.updateStat('totalLinks', stats.totalLinks || 0);
      utils.updateStat('totalClicks', stats.totalClicks || 0);
      utils.updateStat('activeLinks', stats.enabledLinks || 0);
      
      // Calculate avg clicks per link
      const avgClicks = stats.totalLinks > 0 
        ? (stats.totalClicks / stats.totalLinks).toFixed(1) 
        : '0.0';
      utils.updateStat('conversionRate', avgClicks);
      
      // Update weekly changes
      updateWeeklyChanges(stats);
      
      // Render sparklines
      renderSparklines(stats);
    } else {
      throw new Error(data.error || 'Failed to load stats');
    }
  } catch (err) {
    console.error('❌ Failed to load stats:', err);
    console.error('   Stack:', err.stack);
    utils.updateStat('totalLinks', 'Error');
    utils.updateStat('totalClicks', 'Error');
    utils.updateStat('activeLinks', 'Error');
    utils.updateStat('conversionRate', 'Error');
  }
}

/**
 * Update weekly change indicators
 */
function updateWeeklyChanges(stats) {
  // Total Links change
  const linksChange = document.querySelector('#stat-totalLinks-change .change-indicator');
  if (linksChange) {
    const weeklyNew = stats.weeklyNewLinks || 0;
    linksChange.textContent = weeklyNew >= 0 ? `+${weeklyNew}` : weeklyNew;
    linksChange.className = `change-indicator ${weeklyNew > 0 ? 'positive' : weeklyNew < 0 ? 'negative' : ''}`;
  }
  
  // Total Clicks change
  const clicksChange = document.querySelector('#stat-totalClicks-change .change-indicator');
  if (clicksChange) {
    const weeklyClicks = stats.weeklyClicks || stats.totalClicks;
    clicksChange.textContent = weeklyClicks >= 0 ? `+${weeklyClicks}` : weeklyClicks;
    clicksChange.className = `change-indicator ${weeklyClicks > 0 ? 'positive' : ''}`;
  }
  
  // Active Links change
  const activeChange = document.querySelector('#stat-activeLinks-change .change-indicator');
  if (activeChange) {
    const activePercent = stats.totalLinks > 0 
      ? Math.round((stats.enabledLinks / stats.totalLinks) * 100) 
      : 100;
    activeChange.textContent = activePercent === 100 ? '●' : `${activePercent}%`;
    activeChange.className = `change-indicator ${activePercent >= 80 ? 'positive' : activePercent >= 50 ? 'warning' : 'negative'}`;
  }
  
  // Performance change
  const perfChange = document.querySelector('#stat-conversionRate-change .change-indicator');
  if (perfChange) {
    const avgClicks = stats.totalLinks > 0 ? stats.totalClicks / stats.totalLinks : 0;
    const trend = avgClicks >= 3 ? '↑' : avgClicks >= 1 ? '→' : '↓';
    perfChange.textContent = trend;
    perfChange.className = `change-indicator ${avgClicks >= 3 ? 'positive' : avgClicks >= 1 ? '' : 'negative'}`;
  }
}

/**
 * Render mini sparkline charts
 */
function renderSparklines(stats) {
  const sparklineIds = ['sparkline-links', 'sparkline-clicks', 'sparkline-active', 'sparkline-rate'];
  
  sparklineIds.forEach(id => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Generate mock weekly data based on current stats
    let data = [];
    if (id === 'sparkline-links') {
      data = generateSparklineData(stats.totalLinks, 7, 0.15);
    } else if (id === 'sparkline-clicks') {
      data = generateSparklineData(stats.totalClicks, 7, 0.25);
    } else if (id === 'sparkline-active') {
      data = generateSparklineData(stats.enabledLinks, 7, 0.05);
    } else {
      const avg = stats.totalLinks > 0 ? stats.totalClicks / stats.totalLinks : 0;
      data = generateSparklineData(avg, 7, 0.3);
    }
    
    // Draw sparkline
    drawSparkline(ctx, data, width, height);
  });
}

/**
 * Generate sparkline data points
 */
function generateSparklineData(currentValue, points, variance) {
  const data = [];
  for (let i = 0; i < points; i++) {
    const randomVariance = 1 + (Math.random() - 0.5) * variance * 2;
    // Trend upward toward current value
    const progress = i / (points - 1);
    const baseValue = currentValue * (0.7 + progress * 0.3);
    data.push(Math.max(0, baseValue * randomVariance));
  }
  // Ensure last value is close to current
  data[points - 1] = currentValue;
  return data;
}

/**
 * Draw a sparkline on canvas
 */
function drawSparkline(ctx, data, width, height) {
  ctx.clearRect(0, 0, width, height);
  
  if (data.length === 0) return;
  
  const max = Math.max(...data) || 1;
  const min = Math.min(...data);
  const range = max - min || 1;
  const padding = 2;
  
  const stepX = (width - padding * 2) / (data.length - 1);
  
  // Draw line
  ctx.beginPath();
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  data.forEach((value, i) => {
    const x = padding + i * stepX;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.stroke();
  
  // Draw end point
  const lastX = padding + (data.length - 1) * stepX;
  const lastY = height - padding - ((data[data.length - 1] - min) / range) * (height - padding * 2);
  
  ctx.beginPath();
  ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#D4AF37';
  ctx.fill();
}

/**
 * Load recent links
 */
async function loadRecentLinks() {
  const container = document.getElementById('recent-links');
  if (!container) {
    console.error('❌ recent-links container not found!');
    alert('ERROR: recent-links container not found in HTML!');
    return;
  }
  
  container.innerHTML = '<div class="loading">🔄 Fetching links from API...</div>';
  
  try {
    console.log('🔗 Fetching links from API...');
    console.log('   API endpoint:', `${CONFIG.API_BASE}/smartlinks`);
    
    const res = await apiFetch('/smartlinks');
    
    if (!res) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>API returned null (401 or network error)</p></div>`;
      throw new Error('API request failed - no response (likely 401)');
    }
    
    console.log('📦 Response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">❌</div><p>API Error ${res.status}: ${errorText}</p></div>`;
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    
    const data = await res.json();
    console.log('📊 Response data:', data);
    console.log('   Success:', data.success);
    console.log('   Links count:', data.links?.length || 0);
    
    if (data.success) {
      let allLinks = [];
      if (data.links) {
        allLinks = data.links;
      } else if (data.short || data.structured) {
        allLinks = [...(data.structured || []), ...(data.short || [])];
      }
      
      console.log(`✅ Loaded ${allLinks.length} links`);
      
      // Store in global state for other views
      STATE.links = allLinks;
      
      const recent = allLinks.slice(0, 5);
      console.log('   Rendering', recent.length, 'recent links');
      renderRecentLinks(recent, container);
      console.log('   ✅ Rendering complete');
    } else {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>API Error: ${data.error || 'Unknown error'}</p></div>`;
      throw new Error(data.error || 'Failed to load links');
    }
  } catch (err) {
    console.error('❌ Failed to load recent links:', err);
    console.error('   Error name:', err.name);
    console.error('   Error message:', err.message);
    console.error('   Stack:', err.stack);
    
    // Only update HTML if not already updated above
    if (container.innerHTML.includes('Loading') || container.innerHTML.includes('🔄')) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p style="color:#ff4444;">ERROR: ${err.message}</p><small style="color:#888;">Check console for details</small></div>`;
    }
  }
}

/**
 * Render recent links - using same UI as All Links view for consistency
 */
function renderRecentLinks(links, container) {
  if (links.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔗</div>
        <h3>No links yet</h3>
        <p>Create your first smart link to get started</p>
        <a href="#" class="btn-primary" data-view="create">Create First Link</a>
      </div>
    `;
    return;
  }
  
  // Use the same rendering function as All Links view for consistency
  container.innerHTML = ui.renderLinksTable(links);
}

/**
 * Copy link to clipboard
 * ROBUST: Handles multiple code field formats
 */
async function copyLink(code) {
  const link = STATE.links.find(l => (l.code || l.shortCode || l.id) === code);
  if (!link) return;
  
  // Always use kaayko.com/l/ format (never k.kaayko.com)
  const shortUrl = `https://kaayko.com/l/${code}`;
  
  try {
    await navigator.clipboard.writeText(shortUrl);
    utils.showSuccess('Link copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy:', err);
    utils.showError('Failed to copy link');
  }
}

/**
 * Edit link
 */
function editLink(code) {
  switchView('create');
  // The create-link view will handle loading the link data
  setTimeout(() => {
    const event = new CustomEvent('editLink', { detail: { code } });
    document.dispatchEvent(event);
  }, 100);
}

/**
 * Toggle link enabled/disabled (shared functionality)
 * ROBUST: Handles multiple code field formats
 */
async function toggleLink(code) {
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
    
    // Reload recent links
    await loadRecentLinks();
    
  } catch (err) {
    utils.showError(err.message);
  }
}

/**
 * Delete link (shared functionality)
 */
async function deleteLink(code) {
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
    
    // Reload recent links
    await loadRecentLinks();
    
  } catch (err) {
    utils.showError(err.message);
  }
}

/**
 * Show QR code (shared functionality)
 */
function showQRSidebar(code) {
  switchView('qrcodes');
  utils.showToast(`📱 Opening QR code for: ${code}`, 'info', 2000);
}

// Expose functions globally for onclick handlers (same as All Links view)
window.toggleLink = toggleLink;
window.editLink = editLink;
window.copyLink = copyLink;
window.deleteLink = deleteLink;
window.showQRSidebar = showQRSidebar;

// Export functions for global access
export { loadStats, loadRecentLinks };
