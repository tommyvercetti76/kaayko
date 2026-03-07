/**
 * Analytics View Module
 * Executive summary analytics with Chart.js visualizations
 */

import { STATE, utils } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';

// Chart instances for cleanup
let clicksTrendChart = null;
let platformChart = null;
let performanceChart = null;
let chartJSLoaded = false;

/**
 * Initialize analytics view
 */
export async function init(state) {
  console.log('📊 Loading Analytics...');
  
  // Try to load Chart.js but don't block on failure
  try {
    await loadChartJS();
    chartJSLoaded = true;
    console.log('✅ Chart.js loaded successfully');
  } catch (err) {
    console.warn('⚠️ Chart.js failed to load, continuing without charts:', err.message);
    chartJSLoaded = false;
  }
  
  // Initialize date range picker
  initDateRangePicker();
  
  // Load and render analytics (always runs, with or without charts)
  await loadAnalytics();
}

/**
 * Dynamically load Chart.js
 */
async function loadChartJS() {
  if (window.Chart) {
    chartJSLoaded = true;
    return;
  }
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    script.onload = () => {
      chartJSLoaded = true;
      resolve();
    };
    script.onerror = () => {
      chartJSLoaded = false;
      reject(new Error('Failed to load Chart.js'));
    };
    document.head.appendChild(script);
  });
}

/**
 * Initialize date range picker
 */
function initDateRangePicker() {
  const buttons = document.querySelectorAll('.range-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Reload with new range (future enhancement)
      console.log('Date range:', btn.dataset.range);
    });
  });
}

/**
 * Load and render analytics dashboard
 */
async function loadAnalytics() {
  const container = document.getElementById('analytics-content');
  if (!container) return;
  
  container.innerHTML = '<div class="loading">Loading analytics...</div>';
  
  // Load links if not already loaded
  if (STATE.links.length === 0) {
    try {
      const res = await apiFetch('/smartlinks');
      const data = await res.json();
      
      console.log('📊 Analytics API Response:', JSON.stringify(data, null, 2));
      
      if (data.success) {
        if (data.links) {
          STATE.links = data.links;
        } else if (data.short || data.structured) {
          STATE.links = [...(data.structured || []), ...(data.short || [])];
        }
      }
      
      console.log('📊 Processed Links:', STATE.links.length);
      STATE.links.forEach(link => {
        console.log(`   → ${link.code || link.shortCode}: ${link.clickCount || 0} clicks | "${link.title || 'Untitled'}" | ${link.enabled !== false ? 'enabled' : 'disabled'}`);
      });
      
    } catch (err) {
      console.error('Failed to load links:', err);
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Failed to load analytics</p></div>';
      return;
    }
  }
  
  if (STATE.links.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><h3>No Analytics Yet</h3><p>Create some links to see analytics data</p></div>';
    return;
  }
  
  // Calculate all metrics
  const metrics = calculateMetrics(STATE.links);
  console.log('📊 Calculated Metrics:', metrics);
  
  // Render charts only if Chart.js loaded successfully
  if (chartJSLoaded && window.Chart) {
    renderCharts(metrics);
  } else {
    // Hide chart containers if charts unavailable
    hideChartContainers();
  }
  
  // Render the dashboard tables (always renders)
  const html = renderAnalyticsDashboard(metrics);
  container.innerHTML = html;
  console.log('📊 Analytics dashboard rendered successfully');
}

/**
 * Hide chart containers when Chart.js is unavailable
 */
function hideChartContainers() {
  const chartSection = document.querySelector('.charts-section');
  if (chartSection) {
    chartSection.innerHTML = `
      <div class="chart-unavailable">
        <div class="chart-unavailable-icon">📊</div>
        <p>Charts temporarily unavailable</p>
        <small>Analytics data is shown below</small>
      </div>
    `;
  }
}

/**
 * Render Chart.js visualizations
 */
function renderCharts(metrics) {
  if (!window.Chart) {
    console.warn('Chart.js not available, skipping chart render');
    return;
  }
  
  // Destroy existing charts
  if (clicksTrendChart) clicksTrendChart.destroy();
  if (platformChart) platformChart.destroy();
  if (performanceChart) performanceChart.destroy();
  
  // Generate mock time series data (in real app, this would come from API)
  const last7Days = generateTimeSeriesData(metrics.totalClicks, 7);
  
  // 1. Clicks Trend Chart (Line)
  const clicksCtx = document.getElementById('clicks-trend-chart');
  if (clicksCtx) {
    clicksTrendChart = new Chart(clicksCtx, {
      type: 'line',
      data: {
        labels: last7Days.labels,
        datasets: [{
          label: 'Clicks',
          data: last7Days.data,
          borderColor: '#D4AF37',
          backgroundColor: 'rgba(212, 175, 55, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#D4AF37',
          pointBorderColor: '#1a1a1a',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a1a',
            titleColor: '#fff',
            bodyColor: '#D4AF37',
            borderColor: '#D4AF37',
            borderWidth: 1,
            padding: 12,
            displayColors: false
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#888' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#888' }
          }
        }
      }
    });
  }
  
  // 2. Platform Distribution Chart (Doughnut)
  const platformCtx = document.getElementById('platform-chart');
  if (platformCtx) {
    platformChart = new Chart(platformCtx, {
      type: 'doughnut',
      data: {
        labels: ['iOS', 'Android', 'Web Only'],
        datasets: [{
          data: [metrics.linksWithIOS, metrics.linksWithAndroid, metrics.webOnlyLinks],
          backgroundColor: ['#007AFF', '#3DDC84', '#D4AF37'],
          borderColor: '#1a1a1a',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#ccc', padding: 15, usePointStyle: true }
          }
        },
        cutout: '65%'
      }
    });
  }
  
  // 3. Performance Breakdown Chart (Bar)
  const perfCtx = document.getElementById('performance-chart');
  if (perfCtx) {
    performanceChart = new Chart(perfCtx, {
      type: 'bar',
      data: {
        labels: ['High (8+)', 'Medium (3-7)', 'Low (<3)'],
        datasets: [{
          label: 'Links',
          data: [metrics.highPerformers, metrics.mediumPerformers, metrics.lowPerformers],
          backgroundColor: ['#4ade80', '#fbbf24', '#f87171'],
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#888' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#888', stepSize: 1 }
          }
        }
      }
    });
  }
}

/**
 * Generate time series data for chart
 */
function generateTimeSeriesData(totalClicks, days) {
  const labels = [];
  const data = [];
  const avgPerDay = Math.ceil(totalClicks / days);
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    // Generate realistic-looking data with some variance
    const variance = Math.random() * 0.6 - 0.3; // -30% to +30%
    const dayClicks = Math.max(0, Math.round(avgPerDay * (1 + variance)));
    data.push(dayClicks);
  }
  
  return { labels, data };
}

/**
 * Export analytics to CSV
 */
window.exportAnalyticsCSV = function() {
  const headers = ['Code', 'Title', 'Clicks', 'Created', 'Status', 'Creator', 'Platforms'];
  const rows = STATE.links.map(l => [
    l.code || l.shortCode || l.id,
    `"${(l.title || 'Untitled').replace(/"/g, '""')}"`,
    l.clickCount || 0,
    l.createdAt?._seconds ? new Date(l.createdAt._seconds * 1000).toISOString() : '',
    l.enabled !== false ? 'Active' : 'Disabled',
    l.createdBy || 'Unknown',
    [l.destinations?.ios ? 'iOS' : '', l.destinations?.android ? 'Android' : '', l.destinations?.web ? 'Web' : ''].filter(Boolean).join('+')
  ]);
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kortex-analytics-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};


/**
 * Calculate comprehensive metrics from links data
 */
function calculateMetrics(links) {
  const totalLinks = links.length;
  const totalClicks = links.reduce((sum, l) => sum + (l.clickCount || 0), 0);
  const activeLinks = links.filter(l => l.enabled !== false).length;
  const disabledLinks = totalLinks - activeLinks;
  const avgClicksPerLink = totalLinks > 0 ? (totalClicks / totalLinks).toFixed(1) : 0;
  
  // Platform distribution
  const linksWithIOS = links.filter(l => l.destinations?.ios).length;
  const linksWithAndroid = links.filter(l => l.destinations?.android).length;
  const webOnlyLinks = links.filter(l => l.destinations?.web && !l.destinations?.ios && !l.destinations?.android).length;
  const multiPlatform = links.filter(l => 
    (l.destinations?.ios && l.destinations?.android) || 
    (l.destinations?.ios && l.destinations?.web) || 
    (l.destinations?.android && l.destinations?.web)
  ).length;
  
  // Performance distribution
  const highPerformers = links.filter(l => (l.clickCount || 0) >= 8).length;
  const mediumPerformers = links.filter(l => (l.clickCount || 0) >= 3 && (l.clickCount || 0) < 8).length;
  const lowPerformers = links.filter(l => (l.clickCount || 0) < 3).length;
  
  // Creator analysis
  const creators = [...new Set(links.map(l => l.createdBy || 'Unknown'))];
  const creatorStats = creators.map(creator => ({
    name: creator,
    count: links.filter(l => (l.createdBy || 'Unknown') === creator).length,
    clicks: links.filter(l => (l.createdBy || 'Unknown') === creator).reduce((sum, l) => sum + (l.clickCount || 0), 0)
  })).sort((a, b) => b.clicks - a.clicks);
  
  // UTM tracking
  const linksWithUTM = links.filter(l => l.utm && Object.keys(l.utm).length > 0).length;
  const utmCampaigns = [...new Set(links.filter(l => l.utm?.utm_campaign).map(l => l.utm.utm_campaign))];
  
  // Top performers with full data
  const topLinks = [...links]
    .sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0))
    .slice(0, 10)
    .map(l => ({
      code: l.code || l.shortCode || l.id,
      title: l.title || l.metadata?.title || 'Untitled',
      clicks: l.clickCount || 0,
      creator: l.createdBy || 'Unknown',
      enabled: l.enabled !== false,
      hasUTM: l.utm && Object.keys(l.utm).length > 0,
      platforms: [
        l.destinations?.ios ? 'iOS' : null,
        l.destinations?.android ? 'Android' : null,
        l.destinations?.web ? 'Web' : null
      ].filter(Boolean)
    }));
  
  // Time analysis
  const linksWithLastClick = links.filter(l => l.lastClickedAt);
  const recentlyActive = linksWithLastClick.filter(l => {
    const lastClick = l.lastClickedAt?._seconds ? new Date(l.lastClickedAt._seconds * 1000) : null;
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return lastClick && lastClick.getTime() > dayAgo;
  }).length;
  
  // Top and bottom performers
  const topPerformerClicks = topLinks[0]?.clicks || 0;
  const topPerformerShare = totalClicks > 0 ? ((topPerformerClicks / totalClicks) * 100).toFixed(1) : 0;
  const activeRate = totalLinks > 0 ? ((activeLinks / totalLinks) * 100).toFixed(0) : 100;
  
  // Engagement velocity (clicks per day since creation)
  const velocityData = links.map(l => {
    const created = l.createdAt?._seconds ? new Date(l.createdAt._seconds * 1000) : new Date();
    const daysSinceCreation = Math.max(1, Math.floor((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000)));
    return {
      code: l.code || l.shortCode || l.id,
      velocity: ((l.clickCount || 0) / daysSinceCreation).toFixed(2)
    };
  }).sort((a, b) => b.velocity - a.velocity);
  
  return {
    totalLinks,
    totalClicks,
    activeLinks,
    disabledLinks,
    avgClicksPerLink,
    linksWithIOS,
    linksWithAndroid,
    webOnlyLinks,
    multiPlatform,
    highPerformers,
    mediumPerformers,
    lowPerformers,
    topLinks,
    topPerformerClicks,
    topPerformerShare,
    activeRate,
    creators: creatorStats,
    linksWithUTM,
    utmCampaigns: utmCampaigns.length,
    recentlyActive,
    topVelocity: velocityData[0]
  };
}

/**
 * Generate AI-powered strategic insights
 */
function generateInsights(m) {
  const insights = [];
  
  if (m.highPerformers === 0 && m.totalLinks > 0 && m.totalClicks > 0) {
    insights.push({
      type: 'warning',
      icon: '⚠️',
      text: `No high-performing links yet. Your best link has ${m.topPerformerClicks} clicks. Consider boosting distribution or optimizing content to reach the 10+ click threshold.`
    });
  }
  
  if (m.mediumPerformers > m.highPerformers * 1.5 && m.mediumPerformers > 1) {
    insights.push({
      type: 'opportunity',
      icon: '🚀',
      text: `${m.mediumPerformers} medium-performing links (5-10 clicks) show potential. Small optimizations—better CTAs, improved targeting, or increased promotion—could elevate these to high-performer status.`
    });
  }
  
  if (insights.length === 0 && m.totalLinks > 0) {
    insights.push({
      type: 'success',
      icon: '✅',
      text: 'Portfolio health is solid. All links are active and performing within expected parameters.'
    });
  }
  
  return insights;
}

/**
 * Render complete analytics dashboard HTML
 */
function renderAnalyticsDashboard(m) {
  return `
    ${renderQuickStats(m)}
    ${renderPlatformBreakdown(m)}
    ${renderPerformanceTables(m)}
  `;
}

function renderQuickStats(m) {
  const topCreator = m.creators[0];
  const topLink = m.topLinks[0];
  
  const gold = m.topLinks[0];
  const silver = m.topLinks[1];
  const bronze = m.topLinks[2];
  
  return `
    <div class="podium-container">
      <div class="podium-winners">
        <div class="podium-position position-silver">
          <div class="winner-card">
            <div class="medal-icon">🥈</div>
            <div class="winner-rank">#2</div>
            <div class="winner-name">${silver?.title || 'No Data'}</div>
            <div class="winner-code">${silver?.code || '—'}</div>
            <div class="winner-score">${silver?.clicks || 0} clicks</div>
            <div class="winner-meta">${silver?.creator || 'Unknown'}</div>
          </div>
          <div class="podium-block podium-silver"><div class="block-height">2nd</div></div>
        </div>
        <div class="podium-position position-gold">
          <div class="winner-card">
            <div class="medal-icon">🥇</div>
            <div class="winner-rank">#1</div>
            <div class="winner-name">${gold?.title || 'No Data'}</div>
            <div class="winner-code">${gold?.code || '—'}</div>
            <div class="winner-score">${gold?.clicks || 0} clicks</div>
            <div class="winner-meta">${gold?.creator || 'Unknown'} · ${((gold?.clicks || 0) / m.totalClicks * 100).toFixed(0)}%</div>
          </div>
          <div class="podium-block podium-gold"><div class="block-height">1st</div></div>
        </div>
        <div class="podium-position position-bronze">
          <div class="winner-card">
            <div class="medal-icon">🥉</div>
            <div class="winner-rank">#3</div>
            <div class="winner-name">${bronze?.title || 'No Data'}</div>
            <div class="winner-code">${bronze?.code || '—'}</div>
            <div class="winner-score">${bronze?.clicks || 0} clicks</div>
            <div class="winner-meta">${bronze?.creator || 'Unknown'}</div>
          </div>
          <div class="podium-block podium-bronze"><div class="block-height">3rd</div></div>
        </div>
      </div>
    </div>
    <div class="quick-stats-grid" style="display:none">
      <div class="stat-pod">
        <div class="stat-icon">🎯</div>
        <div class="stat-content">
          <div class="stat-number">${m.highPerformers}</div>
          <div class="stat-label">TOP PERFORMERS</div>
          <div class="stat-detail">${topLink?.title || 'N/A'} leads with ${topLink?.clicks || 0}</div>
        </div>
      </div>
      <div class="stat-pod">
        <div class="stat-icon">⚡</div>
        <div class="stat-content">
          <div class="stat-number">${m.topVelocity?.velocity || '0.0'}</div>
          <div class="stat-label">DAILY VELOCITY</div>
          <div class="stat-detail">${m.topVelocity?.code || 'N/A'}</div>
        </div>
      </div>
      <div class="stat-pod">
        <div class="stat-icon">�</div>
        <div class="stat-content">
          <div class="stat-number">${m.linksWithUTM}/${m.totalLinks}</div>
          <div class="stat-label">UTM TRACKING</div>
          <div class="stat-detail">${m.utmCampaigns} active campaign${m.utmCampaigns !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div class="stat-pod">
        <div class="stat-icon">�</div>
        <div class="stat-content">
          <div class="stat-number">${topCreator?.clicks || 0}</div>
          <div class="stat-label">TOP CREATOR</div>
          <div class="stat-detail">${topCreator?.name || 'N/A'} (${topCreator?.count || 0} links)</div>
        </div>
      </div>
      <div class="stat-pod">
        <div class="stat-icon">�</div>
        <div class="stat-content">
          <div class="stat-number">${m.linksWithIOS + m.linksWithAndroid}</div>
          <div class="stat-label">MOBILE READY</div>
          <div class="stat-detail">${m.linksWithIOS} iOS · ${m.linksWithAndroid} Android</div>
        </div>
      </div>
      <div class="stat-pod">
        <div class="stat-icon">✨</div>
        <div class="stat-content">
          <div class="stat-number">${m.multiPlatform}</div>
          <div class="stat-label">CROSS-PLATFORM</div>
          <div class="stat-detail">${((m.multiPlatform/m.totalLinks)*100).toFixed(0)}% of portfolio</div>
        </div>
      </div>
    </div>
  `;
}

function renderPlatformBreakdown(m) {
  const maxPlatform = Math.max(m.linksWithIOS, m.linksWithAndroid, m.webOnlyLinks);
  
  return `
    <div class="platform-section">
      <h3>📱 Platform Distribution</h3>
      <div class="platform-bars">
        <div class="platform-bar-item">
          <div class="platform-bar-header">
            <span class="platform-name">🍎 iOS Links</span>
            <span class="platform-count">${m.linksWithIOS}</span>
          </div>
          <div class="platform-bar-track">
            <div class="platform-bar-fill ios-fill" style="width: ${(m.linksWithIOS / maxPlatform * 100)}%"></div>
          </div>
          <div class="platform-percentage">${(m.linksWithIOS / m.totalLinks * 100).toFixed(0)}% of portfolio</div>
        </div>
        <div class="platform-bar-item">
          <div class="platform-bar-header">
            <span class="platform-name">🤖 Android Links</span>
            <span class="platform-count">${m.linksWithAndroid}</span>
          </div>
          <div class="platform-bar-track">
            <div class="platform-bar-fill android-fill" style="width: ${(m.linksWithAndroid / maxPlatform * 100)}%"></div>
          </div>
          <div class="platform-percentage">${(m.linksWithAndroid / m.totalLinks * 100).toFixed(0)}% of portfolio</div>
        </div>
        <div class="platform-bar-item">
          <div class="platform-bar-header">
            <span class="platform-name">🌐 Web Only</span>
            <span class="platform-count">${m.webOnlyLinks}</span>
          </div>
          <div class="platform-bar-track">
            <div class="platform-bar-fill web-fill" style="width: ${(m.webOnlyLinks / maxPlatform * 100)}%"></div>
          </div>
          <div class="platform-percentage">${(m.webOnlyLinks / m.totalLinks * 100).toFixed(0)}% of portfolio</div>
        </div>
        <div class="platform-bar-item highlight">
          <div class="platform-bar-header">
            <span class="platform-name">✨ Multi-Platform</span>
            <span class="platform-count">${m.multiPlatform}</span>
          </div>
          <div class="platform-bar-track">
            <div class="platform-bar-fill multi-fill" style="width: ${(m.multiPlatform / maxPlatform * 100)}%"></div>
          </div>
          <div class="platform-percentage">${(m.multiPlatform / m.totalLinks * 100).toFixed(0)}% of portfolio</div>
        </div>
      </div>
    </div>
  `;
}

function renderKPICards(m) {
  return `
    <div class="analytics-metrics-grid">
      <div class="metric-card primary">
        <div class="metric-header">
          <div class="metric-icon">🖱</div>
          <div class="metric-trend ${m.totalClicks > 20 ? 'neutral' : 'building'}">
            ${m.totalClicks > 20 ? '→ Growing' : '↘ Early'}
          </div>
        </div>
        <div class="metric-value">${m.totalClicks.toLocaleString()}</div>
        <div class="metric-label">Total Clicks</div>
        <div class="metric-detail">
          ${m.totalClicks > 50 ? 'Good traction—optimize top performers' : 'Building audience—increase distribution'}
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">�</div>
          <div class="metric-badge success">Healthy</div>
        </div>
        <div class="metric-value">${m.totalLinks}</div>
        <div class="metric-label">Active Portfolio</div>
        <div class="metric-detail">${m.activeLinks} enabled · ${m.disabledLinks} disabled</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">⭐</div>
          <div class="metric-badge performance">${m.topPerformerShare}% share</div>
        </div>
        <div class="metric-value">${m.topPerformerClicks.toLocaleString()}</div>
        <div class="metric-label">Best Campaign</div>
        <div class="metric-detail">
          ${m.topLinks[0] ? `"${(m.topLinks[0].title || m.topLinks[0].code).substring(0, 24)}"` : 'No data'}
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">🎯</div>
          <div class="metric-badge ${m.highPerformers > 0 ? 'good' : 'building'}">
            ${m.highPerformers > 0 ? 'Good' : 'Growing'}
          </div>
        </div>
        <div class="metric-value">${m.highPerformers}</div>
        <div class="metric-label">High Performers</div>
        <div class="metric-detail">>10 clicks each · ${Math.round((m.highPerformers/m.totalLinks)*100)}% of portfolio</div>
      </div>
    </div>
  `;
}

function renderDistributionCharts(m) {
  return `
    <div class="analytics-distribution">
      <div class="distribution-card">
        <h3>Link Status</h3>
        <div class="distribution-bars">
          <div class="distribution-item">
            <div class="distribution-label">
              <span class="status-dot active"></span>
              <span>Active</span>
            </div>
            <div class="distribution-bar-container">
              <div class="distribution-bar active" style="width: ${(m.activeLinks / m.totalLinks * 100)}%"></div>
            </div>
            <div class="distribution-value">${m.activeLinks}</div>
          </div>
          <div class="distribution-item">
            <div class="distribution-label">
              <span class="status-dot disabled"></span>
              <span>Disabled</span>
            </div>
            <div class="distribution-bar-container">
              <div class="distribution-bar disabled" style="width: ${(m.disabledLinks / m.totalLinks * 100)}%"></div>
            </div>
            <div class="distribution-value">${m.disabledLinks}</div>
          </div>
        </div>
      </div>
      
      <div class="distribution-card">
        <h3>Performance</h3>
        <div class="distribution-bars">
          <div class="distribution-item">
            <div class="distribution-label">
              <span class="perf-dot high"></span>
              <span>High (>10)</span>
            </div>
            <div class="distribution-bar-container">
              <div class="distribution-bar high" style="width: ${(m.highPerformers / m.totalLinks * 100)}%"></div>
            </div>
            <div class="distribution-value">${m.highPerformers}</div>
          </div>
          <div class="distribution-item">
            <div class="distribution-label">
              <span class="perf-dot medium"></span>
              <span>Medium (5-10)</span>
            </div>
            <div class="distribution-bar-container">
              <div class="distribution-bar medium" style="width: ${(m.mediumPerformers / m.totalLinks * 100)}%"></div>
            </div>
            <div class="distribution-value">${m.mediumPerformers}</div>
          </div>
          <div class="distribution-item">
            <div class="distribution-label">
              <span class="perf-dot low"></span>
              <span>Low (<5)</span>
            </div>
            <div class="distribution-bar-container">
              <div class="distribution-bar low" style="width: ${(m.lowPerformers / m.totalLinks * 100)}%"></div>
            </div>
            <div class="distribution-value">${m.lowPerformers}</div>
          </div>
        </div>
      </div>
      
      <div class="distribution-card">
        <h3>Platform Distribution</h3>
        <div class="distribution-bars">
          <div class="distribution-item">
            <div class="distribution-label">
              <span class="platform-icon">🌐</span>
              <span>Web Only</span>
            </div>
            <div class="distribution-bar-container">
              <div class="distribution-bar web" style="width: ${(m.webOnlyLinks / m.totalLinks * 100)}%"></div>
            </div>
            <div class="distribution-value">${m.webOnlyLinks}</div>
          </div>
          <div class="distribution-item">
            <div class="distribution-label">
              <span class="platform-icon">📱</span>
              <span>iOS Links</span>
            </div>
            <div class="distribution-bar-container">
              <div class="distribution-bar ios" style="width: ${(m.linksWithIOS / m.totalLinks * 100)}%"></div>
            </div>
            <div class="distribution-value">${m.linksWithIOS}</div>
          </div>
          <div class="distribution-item">
            <div class="distribution-label">
              <span class="platform-icon">🤖</span>
              <span>Android Links</span>
            </div>
            <div class="distribution-bar-container">
              <div class="distribution-bar android" style="width: ${(m.linksWithAndroid / m.totalLinks * 100)}%"></div>
            </div>
            <div class="distribution-value">${m.linksWithAndroid}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPerformanceTables(m) {
  return `
    <div class="analytics-tables-grid">
      <div class="analytics-card">
        <div class="analytics-card-header">
          <h3>🏆 Top Performers</h3>
          <span class="card-subtitle">Most engaged campaigns</span>
        </div>
        <div class="performance-table">
          <div class="table-header-row">
            <div class="th-rank">#</div>
            <div class="th-link">Link</div>
            <div class="th-creator">Creator</div>
            <div class="th-platforms">Platforms</div>
            <div class="th-clicks">Clicks</div>
            <div class="th-status">Status</div>
          </div>
          ${m.topLinks.map((link, i) => `
            <div class="table-data-row ${i < 3 ? 'row-podium' : ''}">
              <div class="td-rank">
                <div class="rank-badge ${i === 0 ? 'rank-gold' : i === 1 ? 'rank-silver' : i === 2 ? 'rank-bronze' : 'rank-default'}">
                  ${i + 1}
                </div>
              </div>
              <div class="td-link">
                <div class="link-title">${link.title}</div>
                <div class="link-code">${link.code}</div>
              </div>
              <div class="td-creator">
                <div class="creator-chip">${link.creator}</div>
              </div>
              <div class="td-platforms">
                <div class="platform-tags">
                  ${link.platforms.map(p => `<span class="platform-tag platform-${p.toLowerCase()}">${p}</span>`).join('')}
                </div>
              </div>
              <div class="td-clicks">
                <div class="clicks-number">${link.clicks}</div>
                <div class="clicks-bar">
                  <div class="clicks-bar-fill" style="width: ${(link.clicks / m.topLinks[0].clicks * 100)}%"></div>
                </div>
              </div>
              <div class="td-status">
                ${link.enabled ? 
                  '<span class="status-badge status-active">Active</span>' : 
                  '<span class="status-badge status-disabled">Disabled</span>'
                }
                ${link.hasUTM ? '<span class="utm-indicator">📊 UTM</span>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

export { loadAnalytics };
