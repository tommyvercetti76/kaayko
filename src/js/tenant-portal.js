(function () {
  const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://127.0.0.1:5001/kaaykostore/us-central1/api'
    : 'https://api-vwcc5j4qda-uc.a.run.app';

  const state = {
    tenant: null,
    link: null,
    clickId: null
  };

  const el = {
    tenantChip: document.getElementById('tenantChip'),
    eyebrow: document.getElementById('eyebrow'),
    title: document.getElementById('title'),
    description: document.getElementById('description'),
    actions: document.getElementById('actions'),
    metrics: document.getElementById('metrics'),
    form: document.getElementById('registrationForm'),
    status: document.getElementById('status')
  };

  function setStatus(message, kind) {
    el.status.textContent = message;
    el.status.className = `status ${kind || ''}`.trim();
  }

  function hideStatus() {
    el.status.className = 'status hidden';
    el.status.textContent = '';
  }

  function setTenant(tenant) {
    state.tenant = tenant;
    el.tenantChip.textContent = tenant ? tenant.name : 'Kaayko';
  }

  function apiUrl(path, params) {
    const url = new URL(`${API_BASE}${path}`);
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  async function getJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error || payload.message || `Request failed: ${response.status}`);
    }
    return payload;
  }

  function parseRoute() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const host = window.location.hostname;
    const alumniMatch = host.match(/^([a-z0-9_-]+)\.alumni\.kaayko\.com$/i);

    if (alumniMatch) {
      return {
        mode: parts[0] || 'login',
        tenantSlug: alumniMatch[1],
        code: null,
        namespace: null
      };
    }

    if (parts[0] === 'a' && parts[1] && parts.length === 2) {
      return {
        mode: 'link',
        tenantSlug: null,
        code: parts[1],
        namespace: 'a'
      };
    }

    if (parts[0] === 'a' && parts[1]) {
      return {
        mode: parts[2] || 'home',
        tenantSlug: parts[1],
        campaignSlug: parts[2] === 'campaigns' ? parts[3] : null,
        code: null,
        namespace: null
      };
    }

    return {
      mode: parts[0] || 'home',
      tenantSlug: null,
      code: null,
      namespace: null
    };
  }

  function button(label, href, secondary) {
    const a = document.createElement('a');
    a.className = secondary ? 'button secondary' : 'button';
    a.href = href;
    a.textContent = label;
    return a;
  }

  async function track(type, metadata) {
    try {
      await fetch(`${API_BASE}/kortex/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          tenantId: state.tenant && state.tenant.id,
          linkCode: state.link && state.link.code,
          campaignId: state.link && state.link.campaignId,
          clickId: state.clickId,
          source: new URLSearchParams(window.location.search).get('src') || 'manual',
          audience: state.link && state.link.audience,
          intent: state.link && state.link.intent,
          metadata: metadata || {}
        })
      });
    } catch (error) {
      console.warn('[Kortex] event tracking failed', error);
    }
  }

  async function resolveShortLink(route) {
    const payload = await getJson(apiUrl(`/kortex/links/${encodeURIComponent(route.code)}/resolve`, {
      namespace: route.namespace,
      host: window.location.host,
      path: window.location.pathname,
      src: new URLSearchParams(window.location.search).get('src') || ''
    }));

    setTenant(payload.tenant);
    state.link = payload.link;
    state.clickId = payload.clickId;
    el.eyebrow.textContent = payload.link.destinationType.replace(/_/g, ' ');
    el.title.textContent = payload.link.title || 'Opening tenant link';
    el.description.textContent = payload.link.requiresAuth
      ? 'This KORTEX link is tracked and requires the tenant login before continuing.'
      : 'This KORTEX link is tracked and ready to open.';
    el.actions.replaceChildren(
      button('Continue', payload.destination, false),
      button('Tenant Home', `/a/${encodeURIComponent(payload.tenant.slug || payload.tenant.id)}`, true)
    );

    window.setTimeout(() => {
      window.location.href = payload.destination;
    }, 600);
  }

  async function bootstrapTenant(route) {
    const tenantSlug = route.tenantSlug || 'kaayko';
    const payload = await getJson(apiUrl(`/kortex/tenants/${encodeURIComponent(tenantSlug)}/bootstrap`, {
      host: window.location.host,
      path: window.location.pathname
    }));
    setTenant(payload.tenant);
    return payload;
  }

  function renderHome(payload) {
    el.eyebrow.textContent = 'Tenant Portal';
    el.title.textContent = `${payload.tenant.name} alumni portal`;
    el.description.textContent = 'Use tenant links to launch admin access, registration, alumni campaigns, and performance reporting.';
    el.actions.replaceChildren(
      button('Admin Login', payload.routes.login, false),
      button('Registration', payload.routes.register, true),
      button('Campaigns', payload.routes.campaigns, true)
    );
  }

  async function renderAdmin(payload) {
    el.eyebrow.textContent = 'Admin Login';
    el.title.textContent = `${payload.tenant.name} admin`;
    el.description.textContent = 'Opening the branded tenant login with KORTEX attribution context.';
    el.actions.replaceChildren(button('Continue to Login', payload.routes.login, false));
    await track('login_started', { route: 'admin' });
    window.setTimeout(() => {
      window.location.href = payload.routes.login;
    }, 600);
  }

  function renderRegistration(payload) {
    el.eyebrow.textContent = 'Alumni Registration';
    el.title.textContent = `${payload.tenant.name} registration`;
    el.description.textContent = 'Submit the tenant-scoped alumni page request. KORTEX keeps the tenant and source attached to this intake.';
    el.actions.replaceChildren();
    el.form.className = '';
  }

  async function renderCampaign(payload, campaignSlug) {
    el.eyebrow.textContent = 'Campaign';
    el.title.textContent = campaignSlug
      ? `${payload.tenant.name}: ${campaignSlug.replace(/[-_]/g, ' ')}`
      : `${payload.tenant.name} campaigns`;
    el.description.textContent = 'Campaign pages can be public or login-gated and every view is recorded against the tenant.';
    el.actions.replaceChildren(
      button('Admin Login', payload.routes.login, false),
      button('Registration', payload.routes.register, true)
    );
    await track('campaign_viewed', { campaignSlug: campaignSlug || null });
  }

  function renderMetrics() {
    el.metrics.className = 'grid';
    el.metrics.innerHTML = [
      ['0', 'Live dashboard pending login'],
      ['Tracked', 'Clicks and source'],
      ['Ready', 'Campaign attribution']
    ].map(([value, label]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`).join('');
  }

  async function handleRegistrationSubmit(event) {
    event.preventDefault();
    hideStatus();
    const body = {
      organization: {
        name: document.getElementById('orgName').value,
        domain: state.tenant && state.tenant.domain ? state.tenant.domain : window.location.hostname
      },
      contact: {
        email: document.getElementById('contactEmail').value
      },
      request: {
        message: document.getElementById('message').value,
        tenantId: state.tenant && state.tenant.id,
        tenantSlug: state.tenant && state.tenant.slug,
        sourcePath: window.location.pathname,
        clickId: state.clickId
      }
    };

    try {
      await track('registration_started', { sourcePath: window.location.pathname });
      await getJson(`${API_BASE}/kortex/tenant-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      await track('registration_submitted', { sourcePath: window.location.pathname });
      setStatus('Registration submitted. The Kaayko team will review and follow up.', 'ok');
      el.form.reset();
    } catch (error) {
      setStatus(error.message, 'bad');
    }
  }

  async function init() {
    try {
      const route = parseRoute();
      el.form.addEventListener('submit', handleRegistrationSubmit);

      if (route.mode === 'link') {
        await resolveShortLink(route);
        return;
      }

      const payload = await bootstrapTenant(route);
      if (route.mode === 'admin' || route.mode === 'login') {
        await renderAdmin(payload);
      } else if (route.mode === 'register') {
        renderRegistration(payload);
      } else if (route.mode === 'campaigns') {
        await renderCampaign(payload, route.campaignSlug);
      } else {
        renderHome(payload);
      }
      renderMetrics();
    } catch (error) {
      el.tenantChip.textContent = 'KORTEX';
      el.eyebrow.textContent = 'Link unavailable';
      el.title.textContent = 'This tenant link could not be opened';
      el.description.textContent = error.message;
      el.actions.replaceChildren(button('Go to Kaayko', '/', false));
      setStatus('Check that the tenant, campaign, or short code is active.', 'bad');
    }
  }

  init();
}());
