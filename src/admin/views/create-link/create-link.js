/**
 * Create/Edit Link View Module
 * Full feature parity with backend API v2.1
 * Role-aware: super-admin sees Advanced Routing; tenant admins see essentials only
 */

import { STATE, CONFIG, AUTH, utils, ui } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';

let CURRENT_EDIT_LINK = null;

// ── Kaayko API base (ROOTS sync proxy) ──
const KAAYKO_API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:5001/kaaykostore/us-central1/api'
  : 'https://us-central1-kaaykostore.cloudfunctions.net/api';

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function init(state) {
  console.log('[CreateLink] Initializing view');

  initCreateForm();
  initTooltips();
  applyRoleVisibility();
  showDomainHint();

  // Listen for editLink events from other views
  document.addEventListener('editLink', async (e) => {
    const { code } = e.detail;
    if (code) await loadLinkForEditing(code);
  });

  // If editing, populate form
  if (state.editingCode) {
    await loadLinkForEditing(state.editingCode);
  }
}

// ============================================================================
// ROLE-AWARE UI
// ============================================================================

function getUserRole() {
  const user = JSON.parse(localStorage.getItem('kaayko_user') || '{}');
  return user.role || 'tenant-admin';
}

function isSuperAdmin() {
  return getUserRole() === 'super-admin';
}

/**
 * Show/hide form sections based on user role.
 * Super-admins see the Advanced Routing (V2 intent) section.
 * Tenant admins see only essential fields.
 */
function applyRoleVisibility() {
  const advancedSection = document.getElementById('advanced-routing-section');
  if (advancedSection) {
    advancedSection.style.display = isSuperAdmin() ? 'block' : 'none';
  }
}

// ============================================================================
// DOMAIN HINT FOR TENANT ADMINS
// ============================================================================

function showDomainHint() {
  const user = JSON.parse(localStorage.getItem('kaayko_user') || '{}');
  if (user.role === 'super-admin') return;

  const destInput = document.getElementById('webDestination');
  if (!destInput) return;

  const tenantName = user.tenantName || localStorage.getItem('kaayko_tenant_id') || '';
  if (!tenantName || tenantName === 'Kaayko' || tenantName === 'kaayko-default') return;

  // Remove existing hint if re-initialized
  const existing = destInput.parentNode.querySelector('.domain-hint');
  if (existing) existing.remove();

  const hint = document.createElement('span');
  hint.className = 'form-hint domain-hint';
  hint.style.color = 'var(--gold, #d4af37)';
  hint.textContent = `Links must point to ${tenantName} domains. Other destinations will be rejected.`;
  destInput.parentNode.appendChild(hint);
}

// ============================================================================
// TOOLTIPS
// ============================================================================

function initTooltips() {
  const icons = document.querySelectorAll('#create-view .info-icon');

  icons.forEach((icon, index) => {
    const tooltip = icon.querySelector('.tooltip');
    if (!tooltip) return;

    const tooltipId = `tooltip-${index}`;
    tooltip.id = tooltipId;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    icon.setAttribute('aria-describedby', tooltipId);

    const show = () => tooltip.setAttribute('aria-hidden', 'false');
    const hide = () => tooltip.setAttribute('aria-hidden', 'true');

    icon.addEventListener('mouseenter', show);
    icon.addEventListener('mouseleave', hide);
    icon.addEventListener('focusin', show);
    icon.addEventListener('focusout', hide);
    icon.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { hide(); icon.blur(); }
    });

    let touchTimeout;
    icon.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (tooltip.getAttribute('aria-hidden') === 'false') { hide(); return; }
      show();
      clearTimeout(touchTimeout);
      touchTimeout = setTimeout(hide, 5000);
    });

    document.addEventListener('touchstart', (e) => {
      if (!icon.contains(e.target) && !tooltip.contains(e.target)) {
        hide();
        clearTimeout(touchTimeout);
      }
    });
  });
}

// ============================================================================
// URL DETECTION — ALUMNI & ROOTS
// ============================================================================

function isAlumniLink(url) {
  const raw = (url || '').trim().toLowerCase();
  if (!raw) return false;
  let path = raw;
  try {
    const normalized = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw)
      : new URL(raw.startsWith('/') ? raw : `/${raw}`, 'https://kaayko.com');
    path = (normalized.pathname || '').toLowerCase();
  } catch (_) { path = raw; }
  return path === '/alumni' || path.startsWith('/alumni/');
}

function isROOTSLink(url) {
  const raw = (url || '').trim().toLowerCase();
  if (!raw) return false;
  try {
    const parsed = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw)
      : new URL(raw.startsWith('/') ? raw : `/${raw}`, 'https://kaayko.com');
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return (
      host === 'roots.kaayko.com' ||
      path.includes('/knowledge') ||
      path.includes('/roots/parent-assessment') ||
      path.includes('/roots/teacher-assessment') ||
      path === '/parent-assessment' ||
      path === '/teacher-assessment' ||
      path.startsWith('/parent-assessment/') ||
      path.startsWith('/teacher-assessment/')
    );
  } catch (_) {
    return raw.includes('/knowledge') ||
      raw.includes('roots.kaayko.com') ||
      raw.includes('/parent-assessment') ||
      raw.includes('/teacher-assessment');
  }
}

function checkAlumniDestination() {
  const dest = document.getElementById('webDestination')?.value || '';
  const section = document.getElementById('alumni-campaign-section');
  if (section) section.style.display = isAlumniLink(dest) ? 'block' : 'none';
}

function checkROOTSDestination() {
  const dest = document.getElementById('webDestination')?.value || '';
  const section = document.getElementById('roots-assessment-section');
  if (section) section.style.display = isROOTSLink(dest) ? 'block' : 'none';
  const typeSelect = document.getElementById('rootsAssessmentType');
  const childAgeGroup = document.getElementById('roots-child-age-group');
  if (typeSelect && childAgeGroup) {
    childAgeGroup.style.display = typeSelect.value === 'parent' ? '' : 'none';
  }
}

// ============================================================================
// FORM SETUP
// ============================================================================

function initCreateForm() {
  const form = document.getElementById('create-form');
  if (!form) return;

  form.removeEventListener('submit', handleCreateLink);
  form.addEventListener('submit', handleCreateLink);

  // Destination URL watcher — auto-detect ROOTS / Alumni
  const destInput = document.getElementById('webDestination');
  if (destInput) {
    const onDestChange = () => { checkROOTSDestination(); checkAlumniDestination(); };
    destInput.removeEventListener('input', onDestChange);
    destInput.addEventListener('input', onDestChange);
    onDestChange(); // Check initial value
  }

  // ROOTS child-age toggle
  const typeSelect = document.getElementById('rootsAssessmentType');
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      const childAgeGroup = document.getElementById('roots-child-age-group');
      if (childAgeGroup) childAgeGroup.style.display = typeSelect.value === 'parent' ? '' : 'none';
    });
  }
}

// ============================================================================
// FORM SUBMISSION — CREATE / UPDATE
// ============================================================================

async function handleCreateLink(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('create-submit-btn');
  const originalText = submitBtn?.innerHTML;

  try {
    // Disable button and show loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Saving...';
    }

    const isEditing = !!STATE.editingCode;
    const formData = isEditing ? extractUpdatePayload() : extractCreatePayload();

    // Client validation
    if (!isEditing && formData.destinationType === 'external_url' && !formData.webDestination) {
      throw new Error('Destination URL is required');
    }

    const code = STATE.editingCode || formData.code;
    const endpoint = isEditing
      ? `/kortex/${code}`
      : (formData.namespace ? '/kortex/tenant-links' : '/kortex');
    const method = isEditing ? 'PUT' : 'POST';

    // For editing, code is in the URL path — don't duplicate in body
    if (isEditing) delete formData.code;

    const res = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(formData)
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || `Failed to ${isEditing ? 'update' : 'create'} link`);
    }

    // Success
    const linkCode = data.link?.code || data.link?.shortCode || code;
    const shortUrl = data.link?.shortUrl
      ? data.link.shortUrl.replace(/^https?:\/\//, '')
      : `kaayko.com/l/${linkCode}`;

    // ROOTS dual-write
    const webDest = formData.webDestination || formData.destinations?.web || '';
    if (isROOTSLink(webDest)) {
      try {
        await syncROOTSInvite(linkCode, formData);
      } catch (syncErr) {
        console.warn('[CreateLink] ROOTS sync failed:', syncErr.message);
        utils.showToast(`Link saved but ROOTS sync failed: ${syncErr.message}`, 'warning', 5000);
      }
    }

    if (isEditing) {
      utils.showToast(`Link "${linkCode}" updated successfully`, 'success', 4000);
    } else if (isAlumniLink(webDest) || formData.metadata?.isAdmin) {
      showAlumniSuccessModal(linkCode, data, webDest);
    } else {
      const rootsNote = isROOTSLink(webDest) ? ' + ROOTS invite created' : '';
      const generateQR = document.getElementById('generateQR')?.checked;
      if (generateQR && data.link) {
        utils.showToast(`Link created${rootsNote}! ${shortUrl}`, 'success', 5000);
        setTimeout(() => ui.showQRCodeModal(data.link), 500);
      } else {
        utils.showToast(`Link created${rootsNote}! ${shortUrl}`, 'success', 5000);
        navigator.clipboard.writeText(data.link?.shortUrl || `https://${shortUrl}`).then(() => {
          setTimeout(() => utils.showToast('Short URL copied to clipboard', 'info', 3000), 600);
        }).catch(() => {});
      }
      if (window.phTrack) phTrack('link_created', { intent: formData.intent || 'generic' });
    }

    resetCreateForm();

    // Reload the active data view
    if (STATE.currentView === 'dashboard') {
      const mod = STATE.viewModules['dashboard'];
      if (mod) await mod.init(STATE);
    } else if (STATE.currentView === 'links') {
      const mod = STATE.viewModules['links'];
      if (mod) await mod.init(STATE);
    }

  } catch (err) {
    console.error('[CreateLink] Submit error:', err);
    utils.showError(err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  }
}

// ============================================================================
// PAYLOAD EXTRACTION — CREATE vs UPDATE
// ============================================================================

/**
 * Build CREATE payload — flat destination fields (backend expects iosDestination, etc.)
 * Excludes dead fields: createdBy (backend overwrites), appStoreDefault, alumniDomain, tenantSlug
 */
function extractCreatePayload() {
  const utm = buildUTM();
  const shortCodeInput = document.getElementById('short-code').value.trim();
  const expiresAtInput = document.getElementById('expiresAt').value;
  const webDest = document.getElementById('webDestination').value.trim();
  const isAdmin = document.getElementById('isAdminLink')?.checked || false;
  const isAlumniDest = isAlumniLink(webDest);
  const alumniCampaignId = document.getElementById('alumniCampaignId')?.value.trim() || undefined;

  // V2 intent fields (super-admin only — defaults for tenant admins)
  const destinationType = getVal('destinationType') || 'external_url';
  const namespace = getVal('linkNamespace')?.toLowerCase() || undefined;
  const audience = getVal('linkAudience') || 'public';
  const intent = getVal('linkIntent') || 'view';
  const source = getVal('linkSource') || 'manual';
  const requiresAuth = document.getElementById('requiresAuth')?.checked || false;

  if (alumniCampaignId && !utm.utm_campaign) {
    utm.utm_campaign = alumniCampaignId;
  }

  const payload = {
    // Required
    webDestination: webDest,
    title: document.getElementById('title').value.trim(),

    // Optional
    description: document.getElementById('description')?.value.trim() || undefined,
    code: shortCodeInput || undefined,
    destinationType,
    namespace,
    audience,
    intent,
    source,
    requiresAuth,
    conversionGoal: intent === 'donate' ? 'donation_completed'
      : intent === 'register' ? 'registration_submitted' : undefined,
    iosDestination: document.getElementById('iosDestination').value.trim() || undefined,
    androidDestination: document.getElementById('androidDestination').value.trim() || undefined,
    utm: Object.keys(utm).length ? utm : undefined,
    expiresAt: expiresAtInput ? new Date(expiresAtInput).toISOString() : undefined,
    enabled: document.getElementById('enabled').checked,
  };

  // Alumni metadata
  if (isAlumniDest) {
    const existingMeta = CURRENT_EDIT_LINK?.metadata || {};
    payload.metadata = {
      ...existingMeta,
      campaign: 'alumni',
      sourceGroup: getVal('alumniSourceGroup') || '',
      sourceBatch: getVal('alumniSourceBatch') || '',
      schoolName: getVal('alumniSchoolName') || undefined,
      schoolId: getVal('alumniSchoolId') || undefined,
      campaignId: alumniCampaignId,
      channel: getVal('alumniChannel') || undefined,
      chapterOrRegion: getVal('alumniChapterOrRegion') || undefined,
      audienceType: getVal('alumniAudienceType') || undefined,
      organizerRole: getVal('alumniOrganizerRole') || undefined,
      messageTemplateId: getVal('alumniMessageTemplateId') || undefined,
      sender: getVal('alumniSender') || null,
      maxUses: parseInt(document.getElementById('alumniMaxUses')?.value || '50', 10),
      votingDeadline: existingMeta.votingDeadline || new Date(Date.now() + 7 * 86400000).toISOString(),
      isAdmin,
      destinationType,
      audience,
      intent,
      source,
      requiresAuth,
    };
  } else if (isAdmin) {
    payload.metadata = { isAdmin: true, destinationType, audience, intent, source, requiresAuth };
  }

  return payload;
}

/**
 * Build UPDATE payload — nested destinations object (backend expects destinations.ios/android/web)
 * Only sends fields that have values, letting backend preserve untouched fields.
 */
function extractUpdatePayload() {
  const utm = buildUTM();
  const expiresAtInput = document.getElementById('expiresAt').value;
  const webDest = document.getElementById('webDestination').value.trim();
  const isAdmin = document.getElementById('isAdminLink')?.checked || false;
  const isAlumniDest = isAlumniLink(webDest);
  const alumniCampaignId = document.getElementById('alumniCampaignId')?.value.trim() || undefined;

  const destinationType = getVal('destinationType') || 'external_url';
  const audience = getVal('linkAudience') || 'public';
  const intent = getVal('linkIntent') || 'view';
  const source = getVal('linkSource') || 'manual';
  const requiresAuth = document.getElementById('requiresAuth')?.checked || false;

  if (alumniCampaignId && !utm.utm_campaign) {
    utm.utm_campaign = alumniCampaignId;
  }

  const payload = {
    title: document.getElementById('title').value.trim(),
    description: document.getElementById('description')?.value.trim() || undefined,
    destinations: {
      web: webDest || null,
      ios: document.getElementById('iosDestination').value.trim() || null,
      android: document.getElementById('androidDestination').value.trim() || null,
    },
    destinationType,
    audience,
    intent,
    source,
    requiresAuth,
    conversionGoal: intent === 'donate' ? 'donation_completed'
      : intent === 'register' ? 'registration_submitted' : undefined,
    utm: Object.keys(utm).length ? utm : undefined,
    expiresAt: expiresAtInput ? new Date(expiresAtInput).toISOString() : undefined,
    enabled: document.getElementById('enabled').checked,
  };

  // Alumni metadata on update
  if (isAlumniDest) {
    const existingMeta = CURRENT_EDIT_LINK?.metadata || {};
    payload.metadata = {
      ...existingMeta,
      campaign: 'alumni',
      sourceGroup: getVal('alumniSourceGroup') || '',
      sourceBatch: getVal('alumniSourceBatch') || '',
      schoolName: getVal('alumniSchoolName') || undefined,
      schoolId: getVal('alumniSchoolId') || undefined,
      campaignId: alumniCampaignId,
      channel: getVal('alumniChannel') || undefined,
      chapterOrRegion: getVal('alumniChapterOrRegion') || undefined,
      audienceType: getVal('alumniAudienceType') || undefined,
      organizerRole: getVal('alumniOrganizerRole') || undefined,
      messageTemplateId: getVal('alumniMessageTemplateId') || undefined,
      sender: getVal('alumniSender') || null,
      maxUses: parseInt(document.getElementById('alumniMaxUses')?.value || '50', 10),
      votingDeadline: existingMeta.votingDeadline || new Date(Date.now() + 7 * 86400000).toISOString(),
      isAdmin,
      destinationType,
      audience,
      intent,
      source,
      requiresAuth,
    };
  } else if (isAdmin) {
    payload.metadata = { isAdmin: true, destinationType, audience, intent, source, requiresAuth };
  }

  return payload;
}

// ── Helpers ──

function getVal(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function buildUTM() {
  const utm = {};
  const map = { Source: 'utm_source', Medium: 'utm_medium', Campaign: 'utm_campaign', Term: 'utm_term', Content: 'utm_content' };
  Object.entries(map).forEach(([field, key]) => {
    const v = document.getElementById(`utm${field}`)?.value?.trim();
    if (v) utm[key] = v;
  });
  return utm;
}

// ============================================================================
// ALUMNI SUCCESS MODAL
// ============================================================================

function showAlumniSuccessModal(linkCode, data, webDest) {
  let reportUrl = '';
  if (isAlumniLink(webDest)) {
    apiFetch('/alumni/report-key', {
      method: 'POST',
      body: JSON.stringify({ linkCode })
    }).then(r => r.json()).then(d => {
      reportUrl = d.reportUrl || '';
      renderAlumniModal(linkCode, data, reportUrl);
    }).catch(() => renderAlumniModal(linkCode, data, ''));
  } else {
    renderAlumniModal(linkCode, data, '');
  }
}

function renderAlumniModal(linkCode, data, reportUrl) {
  const campaignUrl = data.link?.shortUrl || `https://kaayko.com/l/${linkCode}`;
  const reportLine = reportUrl
    ? `<div style="margin-top:16px;">
        <div style="font-size:11px;color:var(--kaayko-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Report Dashboard</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <code style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:8px 10px;font-size:12px;word-break:break-all;">${utils.escapeHtml(reportUrl)}</code>
          <button class="btn btn-secondary" style="flex-shrink:0;padding:8px 14px;font-size:12px;text-transform:none;" onclick="navigator.clipboard.writeText('${reportUrl}').then(()=>this.textContent='Copied!').catch(()=>{})">Copy</button>
        </div>
      </div>`
    : `<p style="font-size:12px;color:var(--kaayko-muted);margin-top:12px;">Report link unavailable. Visit /admin/alumni to create one.</p>`;

  ui.showModal('Link Created', `
    <div>
      <div style="font-size:11px;color:var(--kaayko-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Share this link</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <code style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:8px 10px;font-size:13px;">${campaignUrl}</code>
        <button class="btn btn-primary" style="flex-shrink:0;padding:8px 14px;font-size:12px;text-transform:none;" onclick="navigator.clipboard.writeText('${campaignUrl}').then(()=>this.textContent='Copied!').catch(()=>{})">Copy</button>
      </div>
      ${reportLine}
    </div>
  `);
}

// ============================================================================
// ROOTS DUAL-WRITE
// ============================================================================

async function syncROOTSInvite(code, formData) {
  const assessmentType = getVal('rootsAssessmentType') || 'parent';
  const childAgeVal = document.getElementById('rootsChildAge')?.value;
  const schoolId = getVal('rootsSchoolId') || undefined;
  const schoolName = getVal('rootsSchoolName') || undefined;
  const maxUsesVal = document.getElementById('rootsMaxUses')?.value;

  const body = {
    code,
    assessmentType,
    title: formData.title || `ROOTS ${assessmentType} invite`,
    createdBy: 'kortex-admin',
    schoolId,
    schoolName,
    childAge: childAgeVal ? parseInt(childAgeVal, 10) : undefined,
    maxUses: maxUsesVal ? parseInt(maxUsesVal, 10) : 0,
    utm: formData.utm,
    expiresAt: formData.expiresAt,
    metadata: { source: 'kortex', kortexCode: code },
  };

  const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  const user = getAuth().currentUser;
  const idToken = user ? await user.getIdToken() : '';

  const res = await fetch(`${KAAYKO_API_BASE}/kortex/roots-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `ROOTS sync HTTP ${res.status}`);
  }
  return res.json();
}

// ============================================================================
// LOAD LINK FOR EDITING
// ============================================================================

async function loadLinkForEditing(code) {
  try {
    const res = await apiFetch('/kortex');
    const data = await res.json();
    if (!data.success) throw new Error('Failed to load links');

    const links = data.links || [];
    const link = links.find(l => (l.code || l.shortCode || l.id) === code);
    if (!link) { utils.showError('Link not found'); return; }

    const actualCode = link.code || link.shortCode || link.id;
    STATE.editingCode = actualCode;
    CURRENT_EDIT_LINK = link;

    // Destinations — handle both flat and nested formats
    const webDest = link.webDestination || link.destinations?.web || '';
    const iosDest = link.iosDestination || link.destinations?.ios || '';
    const androidDest = link.androidDestination || link.destinations?.android || '';
    const utm = link.utm || {};
    const metadata = link.metadata || {};

    // Essential fields
    setField('short-code', actualCode);
    document.getElementById('short-code').readOnly = true;
    setField('title', link.title || '');
    setField('description', link.description || '');
    setField('webDestination', webDest);
    setField('iosDestination', iosDest);
    setField('androidDestination', androidDest);

    // V2 intent fields
    setField('destinationType', link.destinationType || metadata.destinationType || 'external_url');
    setField('linkNamespace', metadata.namespace || '');
    setField('linkAudience', link.audience || metadata.audience || 'public');
    setField('linkIntent', link.intent || metadata.intent || 'view');
    setField('linkSource', link.source || metadata.source || 'manual');
    setChecked('requiresAuth', link.requiresAuth || metadata.requiresAuth);

    // UTM — accept both legacy shorthand and canonical keys
    ['Source', 'Medium', 'Campaign', 'Term', 'Content'].forEach(f => {
      const el = document.getElementById(`utm${f}`);
      if (el) el.value = utm[`utm_${f.toLowerCase()}`] || utm[f.toLowerCase()] || '';
    });

    // Expiration
    const expiresAt = document.getElementById('expiresAt');
    if (expiresAt && link.expiresAt) {
      const date = link.expiresAt._seconds
        ? new Date(link.expiresAt._seconds * 1000)
        : new Date(link.expiresAt);
      expiresAt.value = date.toISOString().slice(0, 16);
    }

    // Toggles
    setChecked('enabled', link.enabled !== false);
    setChecked('isAdminLink', metadata.isAdmin);

    // Update form header and submit button
    const formHeader = document.querySelector('#create-view .view-header h1');
    if (formHeader) formHeader.textContent = `Edit Link: ${actualCode}`;

    const subtitle = document.querySelector('#create-view .view-subtitle');
    if (subtitle) subtitle.textContent = `Editing ${actualCode} — changes apply immediately on save`;

    const submitBtn = document.getElementById('create-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Update Link';

    // Conditional sections
    checkAlumniDestination();
    checkROOTSDestination();

    // Repopulate alumni metadata
    if (isAlumniLink(webDest) && metadata) {
      setField('alumniSourceGroup', metadata.sourceGroup || '');
      setField('alumniSourceBatch', metadata.sourceBatch || '');
      setField('alumniSchoolName', metadata.schoolName || '');
      setField('alumniSchoolId', metadata.schoolId || '');
      setField('alumniCampaignId', metadata.campaignId || '');
      setField('alumniChannel', metadata.channel || '');
      setField('alumniChapterOrRegion', metadata.chapterOrRegion || '');
      setField('alumniAudienceType', metadata.audienceType || '');
      setField('alumniOrganizerRole', metadata.organizerRole || '');
      setField('alumniMessageTemplateId', metadata.messageTemplateId || '');
      setField('alumniSender', metadata.sender || '');
      if (metadata.maxUses != null) setField('alumniMaxUses', metadata.maxUses);
      setChecked('isAdminLink', metadata.isAdmin);
    }

    // Repopulate ROOTS metadata
    if (isROOTSLink(webDest) && metadata) {
      setField('rootsAssessmentType', metadata.assessmentType || 'parent');
      setField('rootsSchoolId', metadata.schoolId || '');
      setField('rootsSchoolName', metadata.schoolName || '');
      if (metadata.maxUses != null) setField('rootsMaxUses', metadata.maxUses);
    }

  } catch (err) {
    console.error('[CreateLink] Error loading link for editing:', err);
    utils.showError(err.message);
  }
}

// ── DOM helpers ──

function setField(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined && val !== null) el.value = val;
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

// ============================================================================
// RESET FORM
// ============================================================================

function resetCreateForm() {
  const form = document.getElementById('create-form');
  if (form) form.reset();

  // Re-apply defaults that form.reset() doesn't handle
  setChecked('enabled', true);
  document.getElementById('short-code').readOnly = false;
  setChecked('isAdminLink', false);
  setChecked('requiresAuth', false);

  // Reset selects to defaults
  ['destinationType:external_url', 'linkAudience:public', 'linkIntent:view', 'linkSource:manual'].forEach(pair => {
    const [id, val] = pair.split(':');
    setField(id, val);
  });

  // Clear text inputs
  ['linkNamespace', 'description'].forEach(id => setField(id, ''));

  // Reset header
  const formHeader = document.querySelector('#create-view .view-header h1');
  if (formHeader) formHeader.textContent = 'Create New Link';

  const subtitle = document.querySelector('#create-view .view-subtitle');
  if (subtitle) subtitle.textContent = 'Build smart links with device routing, campaign attribution, and real-time analytics';

  const submitBtn = document.getElementById('create-submit-btn');
  if (submitBtn) submitBtn.textContent = 'Create Link';

  STATE.editingCode = null;
  CURRENT_EDIT_LINK = null;

  // Reset Alumni section
  const alumniSection = document.getElementById('alumni-campaign-section');
  if (alumniSection) alumniSection.style.display = 'none';
  ['alumniSourceGroup', 'alumniSourceBatch', 'alumniSchoolName', 'alumniSchoolId',
    'alumniCampaignId', 'alumniChapterOrRegion', 'alumniMessageTemplateId', 'alumniSender'
  ].forEach(id => setField(id, ''));
  ['alumniChannel', 'alumniAudienceType', 'alumniOrganizerRole'].forEach(id => setField(id, ''));
  setField('alumniMaxUses', '50');

  // Reset ROOTS section
  const rootsSection = document.getElementById('roots-assessment-section');
  if (rootsSection) rootsSection.style.display = 'none';
  setField('rootsAssessmentType', 'parent');
  ['rootsChildAge', 'rootsSchoolId', 'rootsSchoolName'].forEach(id => setField(id, ''));
  setField('rootsMaxUses', '0');
}

window.resetCreateForm = resetCreateForm;

// ============================================================================
// EXPORTS
// ============================================================================

export function editLink(code) {
  STATE.editingCode = code;
}
