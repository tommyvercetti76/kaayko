/**
 * Create/Edit Link View Module
 * Full feature parity with backend API v2.1
 * Role-aware: super-admin sees Advanced Routing; tenant admins see essentials only
 */

import { STATE, CONFIG, AUTH, utils, ui } from '../../js/kortex-core.js';
import { apiFetch } from '../../js/config.js';

let CURRENT_EDIT_LINK = null;
let SELECTED_CATEGORY = null;
let SELECTED_PAGE = null;

// ── Destination Registry — whitelisted Kaayko destinations ──
// Only real, deployed domains: kaayko.com, coolschools.kaayko.com, alumni.kaayko.com, blog.kaayko.com
const DEST_GROUPS = [
  { id: 'kaayko', label: 'Kaayko', baseUrl: 'https://kaayko.com/', defaultTenantOnly: true },
  { id: 'alumni', label: 'Alumni', baseUrl: 'https://kaayko.com/alumni' },
  { id: 'coolschools', label: 'CoolSchools', baseUrl: 'https://coolschools.kaayko.com/' },
  { id: 'kreator', label: 'Kreator', baseUrl: 'https://kaayko.com/kreator', defaultTenantOnly: true },
  { id: 'custom', label: 'Custom URL', superAdminOnly: true },
];

const DEST_PAGES = [
  // kaayko.com — main site
  { id: 'kaayko_home', group: 'kaayko', label: 'Homepage', url: 'https://kaayko.com/' },
  { id: 'kaayko_store', group: 'kaayko', label: 'Store', url: 'https://kaayko.com/store' },
  { id: 'kaayko_paddling', group: 'kaayko', label: 'Paddling Out', url: 'https://kaayko.com/paddlingout' },
  { id: 'kaayko_paddling_forecast', group: 'kaayko', label: 'Forecast', url: 'https://kaayko.com/paddlingout/forecast' },
  { id: 'kaayko_about', group: 'kaayko', label: 'About', url: 'https://kaayko.com/about' },
  { id: 'kaayko_reads', group: 'kaayko', label: 'Reads', url: 'https://kaayko.com/reads' },
  { id: 'kaayko_testimonials', group: 'kaayko', label: 'Testimonials', url: 'https://kaayko.com/testimonials' },

  // Alumni — kaayko.com/alumni + alumni.kaayko.com
  { id: 'alumni_survey', group: 'alumni', label: 'Alumni Interest Survey', url: 'https://kaayko.com/alumni' },

  // CoolSchools — coolschools.kaayko.com
  { id: 'cs_portal', group: 'coolschools', label: 'CoolSchools Home', url: 'https://coolschools.kaayko.com/' },
  { id: 'cs_alumni', group: 'coolschools', label: 'Alumni Portal', url: 'https://coolschools.kaayko.com/en/alumni' },
  { id: 'cs_donations', group: 'coolschools', label: 'Donations', url: 'https://coolschools.kaayko.com/en/alumni/donations' },
  { id: 'cs_roots', group: 'coolschools', label: 'ROOTS', url: 'https://coolschools.kaayko.com/en/roots' },

  // Kreator — kaayko.com/kreator
  { id: 'kreator_portal', group: 'kreator', label: 'Kreator Portal', url: 'https://kaayko.com/kreator' },
  { id: 'kreator_apply', group: 'kreator', label: 'Apply as Kreator', url: 'https://kaayko.com/kreator/apply' },
];

/** Reverse-map a URL back to a registry entry (for edit mode).
 *  Matches exact URLs first, then falls back to base-path matching
 *  so that URLs with query params or extra segments still resolve. */
function reverseMapUrl(url) {
  if (!url) return null;
  const norm = url.toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\/www\./, 'https://');

  // Exact match first
  const exact = DEST_PAGES.find(d => norm === d.url.toLowerCase().replace(/\/+$/, ''));
  if (exact) return exact;

  // Base-path match — URL starts with a registry entry's URL (covers query params, sub-paths)
  // Sort by longest URL first so /paddlingout/forecast matches before /paddlingout
  const sorted = [...DEST_PAGES].sort((a, b) => b.url.length - a.url.length);
  return sorted.find(d => {
    const base = d.url.toLowerCase().replace(/\/+$/, '');
    return norm.startsWith(base + '?') || norm.startsWith(base + '/') || norm.startsWith(base + '#');
  }) || null;
}

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

function isDefaultTenant() {
  const tid = localStorage.getItem('kaayko_tenant_id') || 'kaayko-default';
  return tid === 'kaayko-default';
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
// DESTINATION PICKER
// ============================================================================

function initDestinationPicker() {
  const pillsWrap = document.getElementById('dest-pills');
  if (!pillsWrap) return;

  pillsWrap.innerHTML = '';
  const superAdmin = isSuperAdmin();
  const defaultTenant = isDefaultTenant();

  DEST_GROUPS.forEach(g => {
    if (g.superAdminOnly && !superAdmin) return;
    if (g.defaultTenantOnly && !defaultTenant) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dest-pill';
    btn.dataset.group = g.id;
    btn.textContent = g.label;
    btn.addEventListener('click', () => selectGroup(g.id));
    pillsWrap.appendChild(btn);
  });

  // Wire clear button
  const clearBtn = document.getElementById('dest-clear-btn');
  if (clearBtn) {
    clearBtn.removeEventListener('click', clearDestinationPicker);
    clearBtn.addEventListener('click', clearDestinationPicker);
  }
}

function selectGroup(groupId) {
  SELECTED_CATEGORY = groupId;
  SELECTED_PAGE = null;

  // Highlight active pill
  document.querySelectorAll('#dest-pills .dest-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.group === groupId);
  });

  const pageWrap = document.getElementById('dest-page-wrap');
  const pageSelect = document.getElementById('dest-page');
  const preview = document.getElementById('dest-preview');
  const destInput = document.getElementById('webDestination');
  const catInput = document.getElementById('destinationCategory');
  const tplInput = document.getElementById('destinationTemplate');

  if (catInput) catInput.value = groupId;

  // Custom URL — show free-text input
  if (groupId === 'custom') {
    if (pageWrap) pageWrap.style.display = 'none';
    if (preview) preview.style.display = 'none';
    if (destInput) {
      destInput.style.display = '';
      destInput.value = '';
      destInput.placeholder = 'https://example.com/page';
      destInput.focus();
    }
    if (tplInput) tplInput.value = 'custom';
    return;
  }

  // Registry group — populate dropdown with known pages + freeform option
  if (destInput) destInput.style.display = 'none';
  if (preview) preview.style.display = 'none';

  const group = DEST_GROUPS.find(g => g.id === groupId);
  const pages = DEST_PAGES.filter(p => p.group === groupId);
  if (pageSelect) {
    pageSelect.innerHTML = '<option value="">Select a page…</option>';
    pages.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.label;
      pageSelect.appendChild(opt);
    });
    // Freeform option — lets user type any path on this domain
    if (group?.baseUrl) {
      const freeOpt = document.createElement('option');
      freeOpt.value = '__freeform';
      freeOpt.textContent = 'Other — enter URL';
      pageSelect.appendChild(freeOpt);
    }
    pageSelect.onchange = () => {
      if (pageSelect.value === '__freeform') {
        selectFreeform(groupId);
      } else if (pageSelect.value) {
        selectDestination(pageSelect.value);
      }
    };
  }
  if (pageWrap) pageWrap.style.display = '';
}

function selectFreeform(groupId) {
  const group = DEST_GROUPS.find(g => g.id === groupId);
  if (!group?.baseUrl) return;

  SELECTED_PAGE = null;
  const destInput = document.getElementById('webDestination');
  const tplInput = document.getElementById('destinationTemplate');
  const preview = document.getElementById('dest-preview');
  const previewUrl = document.getElementById('dest-preview-url');
  const pageWrap = document.getElementById('dest-page-wrap');

  if (destInput) {
    destInput.value = group.baseUrl;
    destInput.style.display = '';
    destInput.placeholder = group.baseUrl + '...';
    destInput.focus();
    // Place cursor at end so user can type the path
    destInput.setSelectionRange(destInput.value.length, destInput.value.length);
    destInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (tplInput) tplInput.value = groupId + '_freeform';
  if (previewUrl) previewUrl.textContent = group.label + ' — type any path';
  if (preview) preview.style.display = '';
  if (pageWrap) pageWrap.style.display = 'none';
}

function selectDestination(destId) {
  const entry = DEST_PAGES.find(p => p.id === destId);
  if (!entry) return;

  SELECTED_PAGE = entry;
  const destInput = document.getElementById('webDestination');
  const tplInput = document.getElementById('destinationTemplate');
  const preview = document.getElementById('dest-preview');
  const previewUrl = document.getElementById('dest-preview-url');
  const pageWrap = document.getElementById('dest-page-wrap');

  // Pre-fill base URL into editable input — user can append query params, sub-paths, etc.
  if (destInput) {
    destInput.value = entry.url;
    destInput.style.display = '';
    destInput.placeholder = entry.url;
    destInput.focus();
    destInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (tplInput) tplInput.value = entry.id;

  // Show base hint in preview, keep input editable below it
  if (previewUrl) previewUrl.textContent = entry.label + ' — edit URL below';
  if (preview) preview.style.display = '';
  if (pageWrap) pageWrap.style.display = 'none';
}

function clearDestinationPicker() {
  SELECTED_CATEGORY = null;
  SELECTED_PAGE = null;

  document.querySelectorAll('#dest-pills .dest-pill').forEach(btn => btn.classList.remove('active'));

  const pageWrap = document.getElementById('dest-page-wrap');
  const pageSelect = document.getElementById('dest-page');
  const preview = document.getElementById('dest-preview');
  const destInput = document.getElementById('webDestination');
  const catInput = document.getElementById('destinationCategory');
  const tplInput = document.getElementById('destinationTemplate');

  if (pageWrap) pageWrap.style.display = 'none';
  if (pageSelect) pageSelect.innerHTML = '';
  if (preview) preview.style.display = 'none';
  if (destInput) { destInput.style.display = 'none'; destInput.value = ''; destInput.placeholder = ''; destInput.dispatchEvent(new Event('input', { bubbles: true })); }
  if (catInput) catInput.value = '';
  if (tplInput) tplInput.value = '';
}

/** Detect which group a URL belongs to by domain match */
function detectGroupFromUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return DEST_GROUPS.find(g => {
      if (!g.baseUrl) return false;
      const gHost = new URL(g.baseUrl).hostname.replace(/^www\./, '').toLowerCase();
      return host === gHost;
    }) || null;
  } catch { return null; }
}

/** Pre-select picker state from a URL (edit mode) */
function restorePickerFromUrl(url) {
  // 1. Try exact/prefix match against registry pages
  const match = reverseMapUrl(url);
  if (match) {
    selectGroup(match.group);
    selectDestination(match.id);
    const destInput = document.getElementById('webDestination');
    if (destInput && url !== match.url) destInput.value = url;
    const pageSelect = document.getElementById('dest-page');
    if (pageSelect) pageSelect.value = match.id;
    return;
  }

  // 2. Try domain match → freeform within that group
  const group = detectGroupFromUrl(url);
  if (group) {
    selectGroup(group.id);
    selectFreeform(group.id);
    const destInput = document.getElementById('webDestination');
    if (destInput) destInput.value = url;
    return;
  }

  // 3. Unrecognized domain — super-admin custom
  if (url && isSuperAdmin()) {
    selectGroup('custom');
    const destInput = document.getElementById('webDestination');
    if (destInput) destInput.value = url;
    const tplInput = document.getElementById('destinationTemplate');
    if (tplInput) tplInput.value = 'custom';
  }
}

// ============================================================================
// INLINE VALIDATION
// ============================================================================

function showFieldError(fieldId, errId, msg) {
  const field = document.getElementById(fieldId);
  const err = document.getElementById(errId);
  if (field) field.classList.add('input-error');
  if (err) { err.textContent = msg; err.classList.add('visible'); }
}

function clearFieldError(fieldId, errId) {
  const field = document.getElementById(fieldId);
  const err = document.getElementById(errId);
  if (field) field.classList.remove('input-error');
  if (err) { err.textContent = ''; err.classList.remove('visible'); }
}

function clearAllErrors() {
  document.querySelectorAll('#create-view .field-error').forEach(el => {
    el.textContent = ''; el.classList.remove('visible');
  });
  document.querySelectorAll('#create-view .input-error').forEach(el => {
    el.classList.remove('input-error');
  });
}

function isValidUrl(str) {
  if (!str) return false;
  try {
    const u = new URL(str);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch { return false; }
}

/** Validate form fields before submit. Returns array of error messages (empty = valid). */
function validateForm(isEditing) {
  clearAllErrors();
  const errors = [];

  // Title
  const title = document.getElementById('title')?.value?.trim();
  if (!title) {
    showFieldError('title', 'err-title', 'Link title is required');
    errors.push('title');
  } else if (title.length > 200) {
    showFieldError('title', 'err-title', 'Title must be under 200 characters');
    errors.push('title');
  }

  // Destination URL
  const webDest = document.getElementById('webDestination')?.value?.trim();
  if (!webDest) {
    showFieldError('webDestination', 'err-destination', 'Pick a destination or enter a URL');
    errors.push('destination');
  } else if (!isValidUrl(webDest)) {
    showFieldError('webDestination', 'err-destination', 'Enter a valid URL starting with https://');
    // Make sure input is visible so user can see the error
    const destInput = document.getElementById('webDestination');
    if (destInput) destInput.style.display = '';
    errors.push('destination');
  }

  // iOS/Android URLs — validate format only if provided
  const iosDest = document.getElementById('iosDestination')?.value?.trim();
  if (iosDest && !isValidUrl(iosDest)) {
    const el = document.getElementById('iosDestination');
    if (el) el.classList.add('input-error');
    errors.push('ios');
  }
  const androidDest = document.getElementById('androidDestination')?.value?.trim();
  if (androidDest && !isValidUrl(androidDest)) {
    const el = document.getElementById('androidDestination');
    if (el) el.classList.add('input-error');
    errors.push('android');
  }

  return errors;
}

// ============================================================================
// FORM SETUP
// ============================================================================

// Stable reference for event listener cleanup
function _onDestChange() { checkROOTSDestination(); checkAlumniDestination(); }

function initCreateForm() {
  const form = document.getElementById('create-form');
  if (!form) return;

  form.removeEventListener('submit', handleCreateLink);
  form.addEventListener('submit', handleCreateLink);

  // Init destination picker
  initDestinationPicker();

  // Destination URL watcher — stable reference so removeEventListener works
  const destInput = document.getElementById('webDestination');
  if (destInput) {
    destInput.removeEventListener('input', _onDestChange);
    destInput.addEventListener('input', _onDestChange);
    _onDestChange();
  }

  // Clear inline errors on input
  const title = document.getElementById('title');
  if (title) title.addEventListener('input', () => clearFieldError('title', 'err-title'));
  if (destInput) destInput.addEventListener('input', () => clearFieldError('webDestination', 'err-destination'));

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
    const isEditing = !!STATE.editingCode;

    // Client-side validation
    const validationErrors = validateForm(isEditing);
    if (validationErrors.length > 0) {
      // Scroll to first error
      const firstErr = document.querySelector('#create-view .input-error');
      if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Disable button and show loading state
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="btn-spinner"></span> Saving...';
    }

    const formData = isEditing ? extractUpdatePayload() : extractCreatePayload();

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

    // apiFetch returns null on 401 (session expired)
    if (!res) {
      throw new Error('Session expired. Please log in again.');
    }

    const data = await res.json();

    if (!data.success) {
      // Surface specific backend errors as inline field errors
      if (data.code === 'DOMAIN_NOT_WHITELISTED') {
        showFieldError('webDestination', 'err-destination', data.error);
        document.getElementById('webDestination')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        throw new Error(data.error);
      }
      if (data.code === 'ALREADY_EXISTS') {
        showFieldError('short-code', 'err-title', 'This short code is already taken');
        throw new Error('Short code already exists — try a different one');
      }
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
    const msg = err instanceof TypeError && err.message.includes('fetch')
      ? 'Network error — check your connection and try again'
      : err.message;
    utils.showError(msg);
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

  // Analytics vector fields from destination picker
  const destinationCategory = document.getElementById('destinationCategory')?.value || undefined;
  const destinationTemplate = document.getElementById('destinationTemplate')?.value || undefined;

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
    destinationCategory,
    destinationTemplate,
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

  // Analytics vector fields from destination picker
  const destinationCategory = document.getElementById('destinationCategory')?.value || undefined;
  const destinationTemplate = document.getElementById('destinationTemplate')?.value || undefined;

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
    destinationCategory,
    destinationTemplate,
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
    const res = await apiFetch(`/kortex/${encodeURIComponent(code)}`);
    if (!res) { utils.showError('Session expired. Please log in again.'); return; }
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to load link');

    const link = data.link;
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

    // Restore destination picker state from URL
    if (webDest) restorePickerFromUrl(webDest);

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

  // Clear all inline validation errors
  clearAllErrors();

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
  if (subtitle) subtitle.textContent = 'Create a short link with device routing, UTM tracking, and QR codes';

  const submitBtn = document.getElementById('create-submit-btn');
  if (submitBtn) submitBtn.textContent = 'Create Link';

  STATE.editingCode = null;
  CURRENT_EDIT_LINK = null;

  // Reset destination picker
  clearDestinationPicker();

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
