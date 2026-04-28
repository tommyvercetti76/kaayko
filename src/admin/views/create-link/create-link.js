/**
 * Create Link View Module
 * Handles link creation and editing form
 */

import { STATE, CONFIG, AUTH, utils, ui } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';

let CURRENT_EDIT_LINK = null;

/**
 * Initialize Create Link view
 */
export async function init(state) {
  console.log('[CreateLink] Initializing view');
  
  // Initialize form handler
  initCreateForm();
  
  // Initialize tooltip positioning
  initTooltips();
  
  // Listen for editLink events from other views
  document.addEventListener('editLink', async (e) => {
    const { code } = e.detail;
    if (code) {
      await loadLinkForEditing(code);
    }
  });
  
  // If editing, populate form
  if (state.editingCode) {
    await loadLinkForEditing(state.editingCode);
  }
}

/**
 * Initialize minimal viewport-safe tooltips
 * Single function with edge guards - no placement variants needed
 */
function initTooltips() {
  const icons = document.querySelectorAll('.info-icon');
  
  icons.forEach((icon, index) => {
    const tooltip = icon.querySelector('.tooltip');
    if (!tooltip) return;
    
    // Setup accessibility attributes
    const tooltipId = `tooltip-${index}`;
    tooltip.id = tooltipId;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    
    icon.setAttribute('aria-describedby', tooltipId);
    
    // Show tooltip - CSS handles positioning
    const showTooltip = () => {
      tooltip.setAttribute('aria-hidden', 'false');
    };
    
    // Hide tooltip
    const hideTooltip = () => {
      tooltip.setAttribute('aria-hidden', 'true');
    };
    
    // Mouse events
    icon.addEventListener('mouseenter', showTooltip);
    icon.addEventListener('mouseleave', hideTooltip);
    
    // Keyboard events
    icon.addEventListener('focusin', showTooltip);
    icon.addEventListener('focusout', hideTooltip);
    
    // ESC key handler
    icon.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideTooltip();
        icon.blur();
      }
    });
    
    // Touch events (mobile)
    let touchTimeout;
    icon.addEventListener('touchstart', (e) => {
      e.preventDefault();
      
      if (tooltip.getAttribute('aria-hidden') === 'false') {
        hideTooltip();
        return;
      }
      
      showTooltip();
      
      clearTimeout(touchTimeout);
      touchTimeout = setTimeout(hideTooltip, 5000);
    });
    
    document.addEventListener('touchstart', (e) => {
      if (!icon.contains(e.target) && !tooltip.contains(e.target)) {
        hideTooltip();
        clearTimeout(touchTimeout);
      }
    });
  });
}

/**
 * Place tooltip with viewport-safe coordinates
 * Uses DIRECT inline styles - no CSS variables
 */
function placeTooltip(icon, tip) {
  const pad = 12;
  const m = pad; // viewport margin
  const ir = icon.getBoundingClientRect();
  
  // Force show to measure (but invisible)
  tip.style.position = 'fixed';
  tip.style.visibility = 'hidden';
  tip.style.opacity = '0';
  tip.style.display = 'block';
  tip.style.maxWidth = `min(36ch, calc(100vw - ${2 * m}px))`;
  tip.style.left = '0px';
  tip.style.top = '0px';
  tip.style.transform = 'none';
  
  // Measure
  const tr = tip.getBoundingClientRect();
  
  // Calculate position
  let x = ir.left + ir.width / 2;
  let y = ir.top - m;
  let transform = 'translate(-50%, -100%)';
  let arrowRotation = '45deg';
  
  // Check if enough room above
  const roomAbove = ir.top - m;
  const needH = tr.height + m;
  
  if (roomAbove >= needH) {
    // TOP placement
    y = ir.top - m;
    transform = 'translate(-50%, -100%)';
    arrowRotation = '45deg';
  } else {
    // BOTTOM placement (flip)
    y = ir.bottom + m;
    transform = 'translate(-50%, 0%)';
    arrowRotation = '-135deg';
  }
  
  // Clamp X to viewport with margin
  const clampedX = Math.max(m, Math.min(x, window.innerWidth - m));
  
  // Apply ALL positioning via inline styles
  tip.style.left = clampedX + 'px';
  tip.style.top = y + 'px';
  tip.style.transform = transform;
  tip.style.setProperty('--tt-rot', arrowRotation);
  
  // Make visible (CSS transition will handle fade)
  tip.style.opacity = '';
  tip.style.visibility = '';
}

// ── ROOTS sync goes through Kaayko API proxy (key stays server-side) ──
const KAAYKO_API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:5001/kaaykostore/us-central1/api'
  : 'https://us-central1-kaaykostore.cloudfunctions.net/api';

/**
 * Check if the destination URL points to the Alumni interest survey.
 * Shows/hides the Alumni campaign configuration section accordingly.
 */
function checkAlumniDestination() {
  const dest = document.getElementById('webDestination')?.value || '';
  const alumniSection = document.getElementById('alumni-campaign-section');
  if (!alumniSection) return;
  alumniSection.style.display = isAlumniLink(dest) ? '' : 'none';
}

/**
 * Check if the destination URL points to the ROOTS Knowledge Engine.
 * Shows/hides the ROOTS assessment configuration section accordingly.
 */
function checkROOTSDestination() {
  const dest = (document.getElementById('webDestination')?.value || '').toLowerCase();
  const rootsSection = document.getElementById('roots-assessment-section');
  if (!rootsSection) return;
  const isKnowledge = dest.includes('/knowledge');
  rootsSection.style.display = isKnowledge ? '' : 'none';
  // Toggle child-age visibility based on assessment type
  const typeSelect = document.getElementById('rootsAssessmentType');
  const childAgeGroup = document.getElementById('roots-child-age-group');
  if (typeSelect && childAgeGroup) {
    childAgeGroup.style.display = typeSelect.value === 'parent' ? '' : 'none';
  }
}

/**
 * Initialize create form
 */
function initCreateForm() {
  const form = document.getElementById('create-form');
  if (!form) return;
  
  // Remove existing listeners
  form.removeEventListener('submit', handleCreateLink);
  form.addEventListener('submit', handleCreateLink);

  // Auto-detect ROOTS / Alumni links when destination URL changes
  const destInput = document.getElementById('webDestination');
  if (destInput) {
    destInput.removeEventListener('input', checkROOTSDestination);
    destInput.addEventListener('input', checkROOTSDestination);
    destInput.removeEventListener('input', checkAlumniDestination);
    destInput.addEventListener('input', checkAlumniDestination);
    // Check initial value
    checkROOTSDestination();
    checkAlumniDestination();
  }

  // Toggle child-age field when assessment type changes
  const typeSelect = document.getElementById('rootsAssessmentType');
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      const childAgeGroup = document.getElementById('roots-child-age-group');
      if (childAgeGroup) childAgeGroup.style.display = typeSelect.value === 'parent' ? '' : 'none';
    });
  }
}

/**
 * Handle form submission (create or update link)
 */
async function handleCreateLink(e) {
  e.preventDefault();
  
  try {
    // Extract form data (minimal client-side validation)
    const formData = extractFormData();
    if (formData.destinationType === 'external_url' && !formData.webDestination) {
      throw new Error('Web destination is required for external URL links');
    }
    const isEditing = !!STATE.editingCode;
    const code = STATE.editingCode || formData.code;
    
    const endpoint = isEditing
      ? `/kortex/${code}`
      : (formData.namespace ? '/kortex/tenant-links' : '/kortex');
    const method = isEditing ? 'PUT' : 'POST';
    
    // For editing, remove code from payload (it's in the URL path)
    if (isEditing) {
      delete formData.code;
    }
    
    // Call backend API - all business logic handled server-side
    const res = await apiFetch(endpoint, {
      method,
      body: JSON.stringify(formData)
    });
    
    const data = await res.json();
    
    // Backend handles all validation and returns standardized response
    if (!data.success) {
      throw new Error(data.error || `Failed to ${isEditing ? 'update' : 'create'} link`);
    }
    
    // Show success notification (email sent by backend automatically)
    const linkCode = data.link?.code || data.link?.shortCode || code;
    const shortUrl = data.link?.shortUrl
      ? data.link.shortUrl.replace(/^https?:\/\//, '')
      : `kaayko.com/l/${linkCode}`;
    
    const generateQR = document.getElementById('generateQR')?.checked;
    
    // ── ROOTS dual-write: create matching invite in ROOTS API ──
    if (!isEditing && isROOTSLink(formData.webDestination)) {
      try {
        await syncROOTSInvite(linkCode, formData);
        console.log('[CreateLink] ROOTS invite synced:', linkCode);
      } catch (syncErr) {
        console.warn('[CreateLink] ROOTS sync failed (link still created):', syncErr.message);
        utils.showToast(`⚠️ Link created but ROOTS invite sync failed: ${syncErr.message}`, 'warning', 5000);
      }
    }

    if (isEditing) {
      // Edit success
      utils.showToast(`✅ Link "${linkCode}" updated successfully!`, 'success', 5000);
    } else if (!isEditing && (isAlumniLink(formData.webDestination) || formData.metadata?.isAdmin)) {
      // Alumni campaign OR admin-toggled — generate report key and show both URLs in a modal
      let reportUrl = '';
      if (isAlumniLink(formData.webDestination)) {
        try {
          const rkRes = await apiFetch('/alumni/report-key', {
            method: 'POST',
            body: JSON.stringify({ linkCode })
          });
          const rkData = await rkRes.json();
          reportUrl = rkData.reportUrl || '';
        } catch (e) {
          console.warn('[CreateLink] report-key generation failed:', e.message);
        }
      }

      const campaignUrl = data.link?.shortUrl || `https://kaayko.com/l/${linkCode}`;
      const reportLine = reportUrl
        ? `<div style="margin-top:16px;">
            <div style="font-size:11px;color:var(--kaayko-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Your report dashboard</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <code style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:8px 10px;font-size:12px;word-break:break-all;">${utils.escapeHtml(reportUrl)}</code>
              <button class="btn btn-secondary" style="flex-shrink:0;" onclick="navigator.clipboard.writeText('${reportUrl}').then(()=>this.textContent='Copied!').catch(()=>{})">Copy</button>
              <a class="btn btn-secondary" style="flex-shrink:0;" href="${reportUrl}" target="_blank" rel="noopener">Open</a>
            </div>
            <p style="font-size:11px;color:var(--kaayko-muted);margin-top:6px;">Bookmark this — share with school management. No login needed.</p>
          </div>`
        : `<p style="font-size:12px;color:var(--kaayko-muted);margin-top:12px;">Report link could not be generated — visit /admin/alumni to create one.</p>`;

      ui.showModal('Alumni campaign link created', `
        <div>
          <div style="font-size:11px;color:var(--kaayko-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Share this link</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <code style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:8px 10px;font-size:13px;">${campaignUrl}</code>
            <button class="btn btn-primary" style="flex-shrink:0;" onclick="navigator.clipboard.writeText('${campaignUrl}').then(()=>this.textContent='Copied!').catch(()=>{})">Copy</button>
          </div>
          <p style="font-size:11px;color:var(--kaayko-muted);margin-top:6px;">Send via WhatsApp. Each click is single-use — no gaming.</p>
          ${reportLine}
        </div>
      `);
    } else {
      // Standard create success
      const rootsNote = isROOTSLink(formData.webDestination) ? ' + ROOTS invite created' : '';
      if (generateQR && data.link) {
        utils.showToast(`Link created${rootsNote}! Your short URL: ${shortUrl}`, 'success', 6000);
        setTimeout(() => ui.showQRCodeModal(data.link), 500);
      } else {
        utils.showToast(`Link created${rootsNote}! Your short URL: ${shortUrl}`, 'success', 6000);
        navigator.clipboard.writeText(data.link?.shortUrl || `https://${shortUrl}`).then(() => {
          setTimeout(() => utils.showToast('Short URL copied to clipboard', 'info', 3000), 500);
        }).catch(() => {});
      }
    }
    
    resetCreateForm();
    
    // Reload data from backend (single source of truth)
    if (STATE.currentView === 'dashboard') {
      const dashboardModule = STATE.viewModules['dashboard'];
      if (dashboardModule) await dashboardModule.init(STATE);
    } else if (STATE.currentView === 'links') {
      const linksModule = STATE.viewModules['links'];
      if (linksModule) await linksModule.init(STATE);
    }
    
  } catch (err) {
    utils.showError(err.message);
  }
}

/**
 * Extract form data - PRESENTATION LAYER ONLY
 * No business logic validation (backend handles all validation)
 * Only extracts values from DOM
 * 
 * UPDATED: Matches backend API v2.1.0 schema
 */
function extractFormData() {
  // Canonical KORTEX shape uses utm_* keys. Backend still accepts shorthand.
  const utm = {};
  const utmFieldMap = {
    Source: 'utm_source',
    Medium: 'utm_medium',
    Campaign: 'utm_campaign',
    Term: 'utm_term',
    Content: 'utm_content'
  };
  Object.entries(utmFieldMap).forEach(([field, key]) => {
    const value = document.getElementById(`utm${field}`).value.trim();
    if (value) utm[key] = value;
  });
  
  const expiresAtInput = document.getElementById('expiresAt').value;
  const shortCodeInput = document.getElementById('short-code').value.trim();
  
  // Backend API v2.1.0 schema
  const isAdmin = document.getElementById('isAdminLink')?.checked || false;
  const isAlumniDestination = isAlumniLink(document.getElementById('webDestination').value);
  const existingAlumniMetadata = isAlumniDestination ? (CURRENT_EDIT_LINK?.metadata || {}) : {};
  const alumniCampaignId = document.getElementById('alumniCampaignId')?.value.trim() || undefined;
  const destinationType = document.getElementById('destinationType')?.value || 'external_url';
  const namespace = document.getElementById('linkNamespace')?.value.trim().toLowerCase() || undefined;
  const tenantSlug = document.getElementById('tenantSlug')?.value.trim().toLowerCase() || undefined;
  const alumniDomain = document.getElementById('alumniDomain')?.value.trim().toLowerCase() || undefined;
  const audience = document.getElementById('linkAudience')?.value || 'public';
  const intent = document.getElementById('linkIntent')?.value || 'view';
  const source = document.getElementById('linkSource')?.value || 'manual';
  const requiresAuth = document.getElementById('requiresAuth')?.checked || false;

  if (alumniCampaignId && !utm.utm_campaign) {
    utm.utm_campaign = alumniCampaignId;
  }

  return {
    // REQUIRED FIELDS
    webDestination: document.getElementById('webDestination').value.trim(),
    createdBy: document.getElementById('createdBy').value.trim(),
    title: document.getElementById('title').value.trim(),
    
    // OPTIONAL FIELDS
    code: shortCodeInput || undefined, // Custom short code (backend auto-generates if not provided)
    destinationType,
    namespace,
    tenantSlug,
    alumniDomain,
    audience,
    intent,
    source,
    requiresAuth,
    conversionGoal: intent === 'donate' ? 'donation_completed' : intent === 'register' ? 'registration_submitted' : undefined,
    iosDestination: document.getElementById('iosDestination').value.trim() || undefined,
    androidDestination: document.getElementById('androidDestination').value.trim() || undefined,
    utm: Object.keys(utm).length ? utm : undefined,
    expiresAt: expiresAtInput ? new Date(expiresAtInput).toISOString() : undefined,
    enabled: document.getElementById('enabled').checked,
    appStoreDefault: document.getElementById('appStoreDefault')?.checked || false,
    // Alumni campaign metadata (included only when destination is /alumni)
    ...isAlumniDestination ? {
      metadata: {
        ...existingAlumniMetadata,
        campaign:        'alumni',
        sourceGroup:     document.getElementById('alumniSourceGroup')?.value.trim() || '',
        sourceBatch:     document.getElementById('alumniSourceBatch')?.value.trim() || '',
        schoolName:      document.getElementById('alumniSchoolName')?.value.trim() || undefined,
        schoolId:        document.getElementById('alumniSchoolId')?.value.trim() || undefined,
        campaignId:      alumniCampaignId,
        channel:         document.getElementById('alumniChannel')?.value.trim() || undefined,
        chapterOrRegion: document.getElementById('alumniChapterOrRegion')?.value.trim() || undefined,
        audienceType:    document.getElementById('alumniAudienceType')?.value.trim() || undefined,
        organizerRole:   document.getElementById('alumniOrganizerRole')?.value.trim() || undefined,
        messageTemplateId: document.getElementById('alumniMessageTemplateId')?.value.trim() || undefined,
        sender:          document.getElementById('alumniSender')?.value.trim() || null,
        maxUses:         parseInt(document.getElementById('alumniMaxUses')?.value || '50', 10),
        votingDeadline:  existingAlumniMetadata.votingDeadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isAdmin,
        destinationType,
        audience,
        intent,
        source,
        requiresAuth,
      }
    } : (isAdmin ? { metadata: { isAdmin: true, destinationType, audience, intent, source, requiresAuth } } : {})
  };
}

/**
 * Reset create form to defaults
 */
function resetCreateForm() {
  const form = document.getElementById('create-form');
  if (form) form.reset();
  
  document.getElementById('enabled').checked = true;
  document.getElementById('short-code').readOnly = false;
  const isAdminEl = document.getElementById('isAdminLink');
  if (isAdminEl) isAdminEl.checked = false;
  const resetSelect = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value;
  };
  const resetInput = (id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  };
  resetSelect('destinationType', 'external_url');
  resetSelect('linkAudience', 'public');
  resetSelect('linkIntent', 'view');
  resetSelect('linkSource', 'manual');
  resetInput('linkNamespace');
  resetInput('tenantSlug');
  resetInput('alumniDomain');
  const requiresAuthEl = document.getElementById('requiresAuth');
  if (requiresAuthEl) requiresAuthEl.checked = false;
  
  const formHeader = document.querySelector('#create-view .view-header h1');
  if (formHeader) formHeader.textContent = 'Create New Link';
  
  const submitBtn = document.querySelector('#create-view .btn-primary[type="submit"]');
  if (submitBtn) submitBtn.innerHTML = '✨ Create Link';
  
  STATE.editingCode = null;
  CURRENT_EDIT_LINK = null;

  // Reset Alumni section
  const alumniSection = document.getElementById('alumni-campaign-section');
  if (alumniSection) alumniSection.style.display = 'none';
  ['alumniSourceGroup','alumniSourceBatch','alumniSchoolName','alumniSchoolId','alumniCampaignId','alumniChapterOrRegion','alumniMessageTemplateId','alumniSender'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['alumniChannel','alumniAudienceType','alumniOrganizerRole'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const alumniMaxUses = document.getElementById('alumniMaxUses');
  if (alumniMaxUses) alumniMaxUses.value = '50';

  // Reset ROOTS section
  const rootsSection = document.getElementById('roots-assessment-section');
  if (rootsSection) rootsSection.style.display = 'none';
  const rootsType = document.getElementById('rootsAssessmentType');
  if (rootsType) rootsType.value = 'parent';
  const rootsChildAge = document.getElementById('rootsChildAge');
  if (rootsChildAge) rootsChildAge.value = '';
  const rootsSchool = document.getElementById('rootsSchoolId');
  if (rootsSchool) rootsSchool.value = '';
  const rootsSchoolName = document.getElementById('rootsSchoolName');
  if (rootsSchoolName) rootsSchoolName.value = '';
  const rootsMaxUses = document.getElementById('rootsMaxUses');
  if (rootsMaxUses) rootsMaxUses.value = '0';
}

window.resetCreateForm = resetCreateForm;

// ═══════════════════════════════════════════════════════════════
//  ROOTS KNOWLEDGE ENGINE — Dual-Write Bridge
// ═══════════════════════════════════════════════════════════════

/** Check if a URL points to the ROOTS Knowledge Engine */
/** Check if a URL points to the Alumni interest survey */
function isAlumniLink(url) {
  const raw = (url || '').trim().toLowerCase();
  if (!raw) return false;

  // Supports full URLs, relative paths, and in-progress typing like "/alumni"
  let path = raw;
  try {
    const normalized = raw.startsWith('http://') || raw.startsWith('https://')
      ? new URL(raw)
      : new URL(raw.startsWith('/') ? raw : `/${raw}`, 'https://kaayko.com');
    path = (normalized.pathname || '').toLowerCase();
  } catch (_) {
    // Fallback to raw input when URL parsing fails during partial typing
    path = raw;
  }

  return path === '/alumni' || path.startsWith('/alumni/');
}

/** Check if a URL points to the ROOTS Knowledge Engine */
function isROOTSLink(url) {
  return (url || '').toLowerCase().includes('/knowledge');
}

/**
 * Create a matching invite in the ROOTS API via Kaayko server-side proxy.
 * The sync key never touches the browser — it lives in Cloud Functions env.
 */
async function syncROOTSInvite(code, formData) {
  const assessmentType = document.getElementById('rootsAssessmentType')?.value || 'parent';
  const childAgeVal = document.getElementById('rootsChildAge')?.value;
  const schoolId = document.getElementById('rootsSchoolId')?.value?.trim() || undefined;
  const schoolName = document.getElementById('rootsSchoolName')?.value?.trim() || undefined;
  const maxUsesVal = document.getElementById('rootsMaxUses')?.value;

  const body = {
    code,
    assessmentType,
    title: formData.title || `ROOTS ${assessmentType} invite`,
    createdBy: formData.createdBy || 'kortex-admin',
    schoolId,
    schoolName,
    childAge: childAgeVal ? parseInt(childAgeVal, 10) : undefined,
    maxUses: maxUsesVal ? parseInt(maxUsesVal, 10) : 0,
    utm: formData.utm,
    expiresAt: formData.expiresAt,
    metadata: { source: 'kortex', kortexCode: code },
  };

  // Get Firebase Auth token for admin auth on the proxy route
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

/**
 * Load link data for editing
 * ROBUST: Handles multiple code field formats from legacy data
 */
async function loadLinkForEditing(code) {
  try {
    // Load all links to find the one to edit
    const res = await apiFetch('/kortex');
    const data = await res.json();
    
    if (!data.success) throw new Error('Failed to load links');
    
    // Backend returns simple array of links
    const links = data.links || [];
    const link = links.find(l => (l.code || l.shortCode || l.id) === code);
    
    if (!link) {
      utils.showError('Link not found');
      return;
    }
    
    // Get the actual code from the link (handles all formats)
    const actualCode = link.code || link.shortCode || link.id;
    
    // Store editing code in STATE
    STATE.editingCode = actualCode;
    CURRENT_EDIT_LINK = link;
    
    // Populate form with link data (robust field handling)
    const utm = link.utm || {};
    
    // Get destinations - handle both flat and nested formats
    const webDest = link.webDestination || link.destinations?.web || '';
    const iosDest = link.iosDestination || link.destinations?.ios || '';
    const androidDest = link.androidDestination || link.destinations?.android || '';
    
    document.getElementById('short-code').value = actualCode;
    document.getElementById('short-code').readOnly = true;
    document.getElementById('title').value = link.title || '';
    document.getElementById('webDestination').value = webDest;
    document.getElementById('createdBy').value = link.createdBy || '';
    document.getElementById('iosDestination').value = iosDest;
    document.getElementById('androidDestination').value = androidDest;
    const metadata = link.metadata || {};
    const setVal = (id, val) => {
      const field = document.getElementById(id);
      if (field && val !== undefined && val !== null) field.value = val;
    };
    const setChecked = (id, val) => {
      const field = document.getElementById(id);
      if (field) field.checked = !!val;
    };
    setVal('destinationType', link.destinationType || metadata.destinationType || 'external_url');
    setVal('linkNamespace', metadata.namespace || '');
    setVal('tenantSlug', link.tenantSlug || metadata.tenantSlug || link.tenantId || '');
    setVal('alumniDomain', metadata.alumniDomain || '');
    setVal('linkAudience', link.audience || metadata.audience || 'public');
    setVal('linkIntent', link.intent || metadata.intent || 'view');
    setVal('linkSource', link.source || metadata.source || 'manual');
    setChecked('requiresAuth', link.requiresAuth || metadata.requiresAuth);
    
    // Accept both legacy shorthand and canonical utm_* keys while editing.
    ['Source', 'Medium', 'Campaign', 'Term', 'Content'].forEach(field => {
      const el = document.getElementById(`utm${field}`);
      const shortKey = field.toLowerCase();
      const canonicalKey = `utm_${shortKey}`;
      if (el) el.value = utm[canonicalKey] || utm[shortKey] || '';
    });
    
    const expiresAt = document.getElementById('expiresAt');
    if (expiresAt && link.expiresAt) {
      const date = link.expiresAt._seconds 
        ? new Date(link.expiresAt._seconds * 1000)
        : new Date(link.expiresAt);
      expiresAt.value = date.toISOString().slice(0, 16);
    }
    
    document.getElementById('enabled').checked = link.enabled !== false;
    
    const appStoreDefault = document.getElementById('appStoreDefault');
    if (appStoreDefault) {
      appStoreDefault.checked = link.appStoreDefault || false;
    }
    
    // Update form header
    const formHeader = document.querySelector('#create-view .view-header h1');
    if (formHeader) formHeader.textContent = `Edit Link: ${actualCode}`;
    
    const submitBtn = document.querySelector('#create-view .btn-primary[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = '💾 Update Link';

    // Keep destination-based conditional sections in sync for edited links
    checkAlumniDestination();

    // Repopulate alumni metadata fields (prevents accidental wipe on re-save)
    if (isAlumniLink(webDest) && link.metadata) {
      const m = link.metadata;
      setVal('alumniSourceGroup',     m.sourceGroup      || '');
      setVal('alumniSourceBatch',     m.sourceBatch      || '');
      setVal('alumniSchoolName',      m.schoolName       || '');
      setVal('alumniSchoolId',        m.schoolId         || '');
      setVal('alumniCampaignId',      m.campaignId       || '');
      setVal('alumniChannel',         m.channel          || '');
      setVal('alumniChapterOrRegion', m.chapterOrRegion  || '');
      setVal('alumniAudienceType',    m.audienceType     || '');
      setVal('alumniOrganizerRole',   m.organizerRole    || '');
      setVal('alumniMessageTemplateId', m.messageTemplateId || '');
      setVal('alumniSender',          m.sender           || '');
      if (m.maxUses != null) setVal('alumniMaxUses', m.maxUses);
      const isAdminEl = document.getElementById('isAdminLink');
      if (isAdminEl) isAdminEl.checked = !!m.isAdmin;
    }

    // Show ROOTS section if this link points to /knowledge
    checkROOTSDestination();
    
  } catch (err) {
    console.error('[CreateLink] Error loading link for editing:', err);
    utils.showError(err.message);
  }
}

// Export edit function to be called from other modules
export function editLink(code) {
  STATE.editingCode = code;
  // View will be switched by kortex-core
}
