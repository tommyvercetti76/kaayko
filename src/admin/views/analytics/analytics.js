/**
 * Analytics View Module
 * Portfolio-level analytics rendered from real Smart Links data only.
 */

import { STATE, utils } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';

const LINK_LIMIT = 250;

export async function init() {
  await loadAnalytics();
}

async function loadAnalytics() {
  const container = document.getElementById('analytics-content');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading analytics...</div>';

  try {
    const links = await fetchLinks();
    STATE.links = links;

    if (!links.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>No Analytics Yet</h3>
          <p>Create some links to see portfolio analytics.</p>
        </div>
      `;
      return;
    }

    const metrics = calculateMetrics(links);
    container.innerHTML = renderAnalyticsDashboard(metrics);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h3>Analytics Unavailable</h3>
        <p>${utils.escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

async function fetchLinks() {
  const res = await apiFetch(`/smartlinks?limit=${LINK_LIMIT}`);
  if (!res) throw new Error('Authentication failed');

  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to load analytics');

  if (Array.isArray(data.links)) return data.links;
  if (Array.isArray(data.short) || Array.isArray(data.structured)) {
    return [...(data.structured || []), ...(data.short || [])];
  }

  return [];
}

function calculateMetrics(links) {
  const normalizedLinks = links.map(link => normalizeLink(link));
  const totalLinks = normalizedLinks.length;
  const totalClicks = normalizedLinks.reduce((sum, link) => sum + link.clicks, 0);
  const activeLinks = normalizedLinks.filter(link => link.enabled).length;
  const disabledLinks = totalLinks - activeLinks;
  const avgClicksPerLink = totalLinks ? totalClicks / totalLinks : 0;
  const zeroClickLinks = normalizedLinks.filter(link => link.clicks === 0).length;
  const recentlyActive = normalizedLinks.filter(link => {
    if (!link.lastClickedAt) return false;
    return Date.now() - link.lastClickedAt.getTime() < 24 * 60 * 60 * 1000;
  }).length;

  const linksWithUTM = normalizedLinks.filter(link => link.hasUTM).length;
  const utmCampaigns = new Set(
    normalizedLinks
      .map(link => link.utmCampaign)
      .filter(Boolean)
  ).size;

  const performanceBuckets = [
    {
      key: 'high',
      label: 'High',
      detail: '8+ clicks',
      count: normalizedLinks.filter(link => link.clicks >= 8).length,
      tone: 'good'
    },
    {
      key: 'medium',
      label: 'Medium',
      detail: '3-7 clicks',
      count: normalizedLinks.filter(link => link.clicks >= 3 && link.clicks < 8).length,
      tone: 'warm'
    },
    {
      key: 'low',
      label: 'Low',
      detail: '1-2 clicks',
      count: normalizedLinks.filter(link => link.clicks > 0 && link.clicks < 3).length,
      tone: 'muted'
    },
    {
      key: 'zero',
      label: 'Dormant',
      detail: '0 clicks',
      count: zeroClickLinks,
      tone: 'quiet'
    }
  ];

  const platformProfiles = {
    webOnly: 0,
    iosOnly: 0,
    androidOnly: 0,
    multiPlatform: 0,
    unconfigured: 0
  };

  normalizedLinks.forEach(link => {
    platformProfiles[link.platformProfile] += 1;
  });

  const platformRows = [
    { key: 'webOnly', label: 'Web only', count: platformProfiles.webOnly, tone: 'gold' },
    { key: 'iosOnly', label: 'iOS only', count: platformProfiles.iosOnly, tone: 'blue' },
    { key: 'androidOnly', label: 'Android only', count: platformProfiles.androidOnly, tone: 'green' },
    { key: 'multiPlatform', label: 'Multi-platform', count: platformProfiles.multiPlatform, tone: 'white' }
  ].filter(row => row.count > 0 || totalLinks === 0);

  if (platformProfiles.unconfigured > 0) {
    platformRows.push({
      key: 'unconfigured',
      label: 'No destination',
      count: platformProfiles.unconfigured,
      tone: 'muted'
    });
  }

  const creatorMap = new Map();
  normalizedLinks.forEach(link => {
    if (!creatorMap.has(link.creator)) {
      creatorMap.set(link.creator, {
        name: link.creator,
        links: 0,
        clicks: 0,
        live: 0
      });
    }

    const row = creatorMap.get(link.creator);
    row.links += 1;
    row.clicks += link.clicks;
    row.live += link.enabled ? 1 : 0;
  });

  const creators = Array.from(creatorMap.values())
    .map(creator => ({
      ...creator,
      avgClicks: creator.links ? creator.clicks / creator.links : 0,
      sharePct: totalClicks ? (creator.clicks / totalClicks) * 100 : 0
    }))
    .sort((a, b) => {
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      return a.name.localeCompare(b.name);
    });

  const topLinks = [...normalizedLinks]
    .sort((a, b) => {
      if (b.clicks !== a.clicks) return b.clicks - a.clicks;
      return a.title.localeCompare(b.title);
    })
    .slice(0, 8);

  const topLink = topLinks[0] || null;
  const topCreator = creators[0] || null;
  const activeRate = totalLinks ? (activeLinks / totalLinks) * 100 : 0;

  return {
    normalizedLinks,
    totalLinks,
    totalClicks,
    activeLinks,
    disabledLinks,
    avgClicksPerLink,
    zeroClickLinks,
    recentlyActive,
    linksWithUTM,
    utmCampaigns,
    activeRate,
    performanceBuckets,
    platformRows,
    creators,
    topLinks,
    topLink,
    topCreator
  };
}

function normalizeLink(link) {
  const title = link.title || link.metadata?.title || 'Untitled';
  const code = link.code || link.shortCode || link.id || 'unknown';
  const clicks = getLinkClicks(link);
  const createdAt = parseTimestamp(link.createdAt);
  const lastClickedAt = parseTimestamp(link.lastClickedAt);
  const creator = link.createdBy || 'Unknown';
  const enabled = link.enabled !== false;
  const hasUTM = Boolean(link.utm && Object.keys(link.utm).length);
  const utmCampaign = link.utm?.utm_campaign || link.metadata?.campaignId || '';
  const family = getLinkFamily(link);
  const platforms = getLinkPlatforms(link);

  return {
    raw: link,
    title,
    shortTitle: truncate(title, 42),
    code,
    clicks,
    createdAt,
    createdLabel: createdAt ? formatDate(createdAt) : 'Unknown',
    lastClickedAt,
    creator,
    enabled,
    hasUTM,
    utmCampaign,
    family,
    platforms,
    platformProfile: getPlatformProfile(platforms)
  };
}

function getLinkClicks(link) {
  if (link.metadata?.campaign === 'alumni') {
    return Number(link.uniqueVisitCount ?? link.clickCount ?? 0);
  }

  return Number(link.clickCount ?? 0);
}

function getLinkFamily(link) {
  const metadata = link.metadata || {};
  const webDestination = (link.destinations?.web || link.webDestination || '').toLowerCase();

  if (metadata.campaign === 'alumni') return 'Alumni';
  if (metadata.campaign === 'roots' || webDestination.includes('/knowledge')) return 'ROOTS';
  if (metadata.isAdmin) return 'Admin';
  if (link.utm?.utm_campaign) return 'Marketing';
  return 'General';
}

function getLinkPlatforms(link) {
  const platforms = [];
  if (link.destinations?.web || link.webDestination) platforms.push('Web');
  if (link.destinations?.ios || link.iosDestination) platforms.push('iOS');
  if (link.destinations?.android || link.androidDestination) platforms.push('Android');
  return platforms;
}

function getPlatformProfile(platforms) {
  if (platforms.length >= 2) return 'multiPlatform';
  if (platforms.includes('iOS')) return 'iosOnly';
  if (platforms.includes('Android')) return 'androidOnly';
  if (platforms.includes('Web')) return 'webOnly';
  return 'unconfigured';
}

function parseTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && typeof value._seconds === 'number') {
    return new Date(value._seconds * 1000);
  }
  return null;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0))}%`;
}

function truncate(value, limit) {
  const text = String(value || '');
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function getHeadline(metrics) {
  if (!metrics.totalLinks) {
    return {
      title: 'No active link portfolio yet',
      detail: 'Create links to start building portfolio analytics.'
    };
  }

  const topLinkShare = metrics.totalClicks
    ? Math.round((metrics.topLink?.clicks || 0) / metrics.totalClicks * 100)
    : 0;

  const title = metrics.topLink
    ? `${metrics.topLink.shortTitle} leads the portfolio with ${formatNumber(metrics.topLink.clicks)} clicks`
    : `${formatNumber(metrics.totalClicks)} total clicks across ${formatNumber(metrics.totalLinks)} links`;

  const detail = metrics.topCreator
    ? `${metrics.topCreator.name} owns the most traffic, while ${formatPercent(metrics.activeRate)} of links are currently live. ${topLinkShare}% of all clicks are concentrated in the top link.`
    : `${formatPercent(metrics.activeRate)} of links are live, with ${formatNumber(metrics.zeroClickLinks)} dormant links ready for cleanup or redistribution.`;

  return { title, detail };
}

function renderAnalyticsDashboard(metrics) {
  const headline = getHeadline(metrics);

  return `
    <section class="analytics-overview-card">
      <div class="analytics-overview-copy">
        <span class="analytics-kicker">Portfolio Overview</span>
        <h2>${utils.escapeHtml(headline.title)}</h2>
        <p>${utils.escapeHtml(headline.detail)}</p>
      </div>

      <div class="analytics-metric-strip">
        ${renderMetricStripItem('Clicks', formatNumber(metrics.totalClicks), `${formatNumber(metrics.totalLinks)} links`)}
        ${renderMetricStripItem('Live', formatNumber(metrics.activeLinks), `${formatPercent(metrics.activeRate)} active rate`)}
        ${renderMetricStripItem('Average', metrics.avgClicksPerLink.toFixed(1), 'clicks per link')}
        ${renderMetricStripItem('UTM', formatNumber(metrics.linksWithUTM), `${formatNumber(metrics.utmCampaigns)} campaigns tagged`)}
        ${renderMetricStripItem('Dormant', formatNumber(metrics.zeroClickLinks), 'links with zero clicks')}
        ${renderMetricStripItem('Recent', formatNumber(metrics.recentlyActive), 'clicked in the last 24h')}
      </div>
    </section>

    <section class="analytics-panel-grid">
      <article class="analytics-panel analytics-panel-wide">
        <div class="analytics-panel-header">
          <div>
            <h3>Top Links</h3>
            <p>Where portfolio attention is concentrating right now.</p>
          </div>
        </div>
        <div class="signal-list">
          ${renderTopLinkRows(metrics)}
        </div>
      </article>

      <article class="analytics-panel">
        <div class="analytics-panel-header">
          <div>
            <h3>Platform Mix</h3>
            <p>How destinations are distributed across the portfolio.</p>
          </div>
        </div>
        ${renderPlatformMix(metrics)}
      </article>

      <article class="analytics-panel">
        <div class="analytics-panel-header">
          <div>
            <h3>Performance Buckets</h3>
            <p>How many links are driving traction versus sitting idle.</p>
          </div>
        </div>
        ${renderPerformanceBuckets(metrics)}
      </article>

      <article class="analytics-panel">
        <div class="analytics-panel-header">
          <div>
            <h3>Creator Output</h3>
            <p>Which creators are producing the most clicks.</p>
          </div>
        </div>
        ${renderCreatorRows(metrics)}
      </article>
    </section>

    <section class="analytics-table-grid">
      <article class="analytics-panel">
        <div class="analytics-panel-header">
          <div>
            <h3>Top Link Details</h3>
            <p>The most clicked links in the current portfolio snapshot.</p>
          </div>
        </div>
        ${renderTopLinksTable(metrics)}
      </article>

      <article class="analytics-panel">
        <div class="analytics-panel-header">
          <div>
            <h3>Creator Breakdown</h3>
            <p>Link count, click volume, and output quality by creator.</p>
          </div>
        </div>
        ${renderCreatorTable(metrics)}
      </article>
    </section>
  `;
}

function renderMetricStripItem(label, value, detail) {
  return `
    <div class="analytics-metric-item">
      <span class="analytics-metric-label">${utils.escapeHtml(label)}</span>
      <strong class="analytics-metric-value">${utils.escapeHtml(value)}</strong>
      <span class="analytics-metric-detail">${utils.escapeHtml(detail)}</span>
    </div>
  `;
}

function renderTopLinkRows(metrics) {
  const maxClicks = Math.max(...metrics.topLinks.map(link => link.clicks), 1);

  return metrics.topLinks.slice(0, 5).map((link, index) => `
    <div class="signal-row">
      <div class="signal-rank">${index + 1}</div>
      <div class="signal-copy">
        <div class="signal-title">${utils.escapeHtml(link.title)}</div>
        <div class="signal-meta">
          <span>${utils.escapeHtml(link.family)}</span>
          <span>${utils.escapeHtml(link.creator)}</span>
          <span>${utils.escapeHtml(link.code)}</span>
        </div>
      </div>
      <div class="signal-bar-wrap">
        <div class="signal-bar">
          <div class="signal-bar-fill" style="width:${Math.max(8, (link.clicks / maxClicks) * 100)}%"></div>
        </div>
      </div>
      <div class="signal-value">${formatNumber(link.clicks)}</div>
    </div>
  `).join('');
}

function renderPlatformMix(metrics) {
  const total = Math.max(metrics.totalLinks, 1);

  return `
    <div class="mix-stack">
      ${metrics.platformRows.map(row => `
        <div
          class="mix-segment tone-${row.tone}"
          style="width:${(row.count / total) * 100}%"
          title="${utils.escapeHtml(row.label)} · ${formatNumber(row.count)}"
        ></div>
      `).join('')}
    </div>

    <div class="mix-legend">
      ${metrics.platformRows.map(row => `
        <div class="mix-legend-row">
          <div class="mix-legend-label">
            <span class="mix-dot tone-${row.tone}"></span>
            <span>${utils.escapeHtml(row.label)}</span>
          </div>
          <div class="mix-legend-value">${formatNumber(row.count)} <span>${formatPercent((row.count / total) * 100)}</span></div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPerformanceBuckets(metrics) {
  const maxCount = Math.max(...metrics.performanceBuckets.map(bucket => bucket.count), 1);

  return `
    <div class="bucket-list">
      ${metrics.performanceBuckets.map(bucket => `
        <div class="bucket-row">
          <div class="bucket-copy">
            <span class="bucket-label">${utils.escapeHtml(bucket.label)}</span>
            <span class="bucket-detail">${utils.escapeHtml(bucket.detail)}</span>
          </div>
          <div class="bucket-bar">
            <div class="bucket-bar-fill tone-${bucket.tone}" style="width:${Math.max(bucket.count ? 10 : 0, (bucket.count / maxCount) * 100)}%"></div>
          </div>
          <div class="bucket-value">${formatNumber(bucket.count)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCreatorRows(metrics) {
  const maxClicks = Math.max(...metrics.creators.map(creator => creator.clicks), 1);

  return `
    <div class="creator-list">
      ${metrics.creators.slice(0, 5).map(creator => `
        <div class="creator-row">
          <div class="creator-name-block">
            <div class="creator-name">${utils.escapeHtml(creator.name)}</div>
            <div class="creator-subtext">${formatNumber(creator.links)} link${creator.links === 1 ? '' : 's'} · ${creator.live} live</div>
          </div>
          <div class="creator-bar">
            <div class="creator-bar-fill" style="width:${Math.max(8, (creator.clicks / maxClicks) * 100)}%"></div>
          </div>
          <div class="creator-value">${formatNumber(creator.clicks)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTopLinksTable(metrics) {
  return `
    <div class="analytics-table">
      <div class="analytics-table-head analytics-table-links">
        <span>Link</span>
        <span>Creator</span>
        <span>Platforms</span>
        <span>Clicks</span>
        <span>Status</span>
      </div>
      ${metrics.topLinks.map(link => `
        <div class="analytics-table-row analytics-table-links">
          <div class="analytics-link-cell" data-label="Link">
            <strong>${utils.escapeHtml(link.title)}</strong>
            <span>${utils.escapeHtml(link.code)} · ${utils.escapeHtml(link.createdLabel)}</span>
          </div>
          <div data-label="Creator">${utils.escapeHtml(link.creator)}</div>
          <div data-label="Platforms">${utils.escapeHtml(link.platforms.join(' / ') || 'No destination')}</div>
          <div class="mono-cell" data-label="Clicks">${formatNumber(link.clicks)}</div>
          <div data-label="Status">
            <span class="analytics-status ${link.enabled ? 'is-live' : 'is-paused'}">${link.enabled ? 'Live' : 'Paused'}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCreatorTable(metrics) {
  return `
    <div class="analytics-table">
      <div class="analytics-table-head analytics-table-creators">
        <span>Creator</span>
        <span>Links</span>
        <span>Clicks</span>
        <span>Average</span>
        <span>Share</span>
      </div>
      ${metrics.creators.slice(0, 8).map(creator => `
        <div class="analytics-table-row analytics-table-creators">
          <div class="analytics-link-cell" data-label="Creator">
            <strong>${utils.escapeHtml(creator.name)}</strong>
            <span>${creator.live} live · ${creator.links - creator.live} paused</span>
          </div>
          <div class="mono-cell" data-label="Links">${formatNumber(creator.links)}</div>
          <div class="mono-cell" data-label="Clicks">${formatNumber(creator.clicks)}</div>
          <div class="mono-cell" data-label="Average">${creator.avgClicks.toFixed(1)}</div>
          <div class="mono-cell" data-label="Share">${formatPercent(creator.sharePct)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function exportAnalyticsCSV() {
  const headers = ['Code', 'Title', 'Clicks', 'Created', 'Status', 'Creator', 'Family', 'Platforms', 'UTM Campaign'];
  const rows = STATE.links.map(link => {
    const normalized = normalizeLink(link);
    return [
      normalized.code,
      `"${normalized.title.replace(/"/g, '""')}"`,
      normalized.clicks,
      normalized.createdAt ? normalized.createdAt.toISOString() : '',
      normalized.enabled ? 'Live' : 'Paused',
      `"${normalized.creator.replace(/"/g, '""')}"`,
      normalized.family,
      normalized.platforms.join('+'),
      `"${String(normalized.utmCampaign || '').replace(/"/g, '""')}"`
    ];
  });

  const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kortex-analytics-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

window.exportAnalyticsCSV = exportAnalyticsCSV;

export { loadAnalytics };
