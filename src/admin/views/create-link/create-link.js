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
// The finding whose proposal was prefilled into this form; recorded as an applied checkpoint on save.
let PENDING_ACTION = null;

const UTM_FIELDS = { utm_source: 'utmSource', utm_medium: 'utmMedium', utm_campaign: 'utmCampaign', utm_term: 'utmTerm', utm_content: 'utmContent' };

// ── Destination Registry — whitelisted Kaayko destinations ──
// Only real, deployed domains: kaayko.com, roots.kaayko.com, alumni.kaayko.com
// (coolschools.kaayko.com and blog.kaayko.com no longer resolve — do not add them back)
const DEST_GROUPS = [
  { id: 'kaayko', label: 'Kaayko', baseUrl: 'https://kaayko.com/', defaultTenantOnly: true },
  { id: 'alumni', label: 'Alumni', baseUrl: 'https://kaayko.com/alumni' },
  { id: 'coolschools', label: 'CoolSchools', baseUrl: 'https://roots.kaayko.com/' },
  { id: 'kreator', label: 'Kreator', baseUrl: 'https://kaayko.com/kreator', defaultTenantOnly: true },
  // Any URL. Tenant admins may point links at their own properties now that the
  // backend runs destination safety checks (private hosts, blocklists, Safe
  // Browsing, domain review). On the Kaayko house tenant the whitelist still
  // applies, so there it stays super-admin only.
  { id: 'custom', label: 'Your URL', customUrl: true },
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

  // CoolSchools — roots.kaayko.com (coolschools.kaayko.com no longer resolves)
  { id: 'cs_portal', group: 'coolschools', label: 'CoolSchools Home', url: 'https://roots.kaayko.com/' },
  { id: 'cs_alumni', group: 'coolschools', label: 'Alumni Portal', url: 'https://alumni.kaayko.com/' },
  { id: 'cs_roots', group: 'coolschools', label: 'ROOTS Request', url: 'https://roots.kaayko.com/request' },

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

  // If editing, populate form; a finding's proposal handed over from the link page lands on top of it.
  if (state.editingCode) {
    await loadLinkForEditing(state.editingCode);
  }
  applyPendingPrefill();
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
    if (g.customUrl && defaultTenant && !superAdmin) return;
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

  // 3. Unrecognized domain — custom URL (tenant admins, or super-admin on the house tenant)
  if (url && (isSuperAdmin() || !isDefaultTenant())) {
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

  // Short code (optional, but if provided must be valid)
  const shortCode = document.getElementById('short-code')?.value?.trim();
  if (shortCode && !isEditing) {
    if (/[:\/\?#]/.test(shortCode)) {
      showFieldError('short-code', 'err-shortcode', 'Just the code, not a URL — e.g. "antero"');
      errors.push('shortcode');
    } else if (shortCode.length < 3) {
      showFieldError('short-code', 'err-shortcode', 'Must be at least 3 characters');
      errors.push('shortcode');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(shortCode)) {
      showFieldError('short-code', 'err-shortcode', 'Only letters, numbers, hyphens, underscores');
      errors.push('shortcode');
    }
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
function _onDestChange() { checkROOTSDestination(); checkAlumniDestination(); showUtmHint(); }

/* Campaign tags a pasted address already carries, read back in plain words,
   with one click to move them into the UTM fields (shared helper: /js/kortex-utm.js). */
function showUtmHint() {
  const destInput = document.getElementById('webDestination');
  if (!destInput || !window.KortexUtm) return;
  let hint = document.getElementById('utm-decode-hint');
  const d = KortexUtm.decode(destInput.value);
  if (!d.hasTags) { if (hint) hint.remove(); return; }
  if (!hint) {
    hint = document.createElement('p');
    hint.id = 'utm-decode-hint';
    hint.className = 'form-hint';
    hint.style.cssText = 'margin-top:8px;font-size:13px;line-height:1.5';
    destInput.insertAdjacentElement('afterend', hint);
  }
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  hint.innerHTML = `This address already carries campaign tags: ${KortexUtm.chips(d.tags).map(c => `<b>${esc(c.label)}</b> ${esc(c.value)}`).join(' · ')}. ${esc(KortexUtm.sentence(d.tags))} <button type="button" class="btn-link" id="utm-decode-move">Move them into the UTM fields</button>`;
  const move = document.getElementById('utm-decode-move');
  if (move) move.addEventListener('click', () => {
    destInput.value = d.cleanUrl;
    Object.entries(UTM_FIELDS).forEach(([k, id]) => { const el = document.getElementById(id); if (el && d.tags[k]) el.value = d.tags[k]; });
    hint.remove();
  });
}

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
  const codeInput = document.getElementById('short-code');
  if (codeInput) codeInput.addEventListener('input', () => clearFieldError('short-code', 'err-shortcode'));

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
      if (data.code === 'DOMAIN_NOT_WHITELISTED' || data.code === 'DOMAIN_NOT_ALLOWED') {
        showFieldError('webDestination', 'err-destination', data.error);
        document.getElementById('webDestination')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        throw new Error(data.error);
      }
      if (data.code === 'DESTINATION_BLOCKED') {
        const why = (data.reasons || []).map(r => r.detail).join(' ') || data.error;
        showFieldError('webDestination', 'err-destination', `This destination was refused: ${why}`);
        document.getElementById('webDestination')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        throw new Error('Destination refused by the safety check');
      }
      if (data.code === 'EMAIL_NOT_VERIFIED') {
        throw new Error('Verify your email address first — use the banner at the top of the page.');
      }
      if (data.code === 'ALREADY_EXISTS') {
        showFieldError('short-code', 'err-shortcode', 'This short code is already taken');
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
      await recordAppliedAction(code);
    } else if (isAlumniLink(webDest) || formData.metadata?.isAdmin) {
      showAlumniSuccessModal(linkCode, data, webDest);
    } else {
      if (data.status === 'held') {
        utils.showToast(
          `Link created and held for a quick review: ${shortUrl}. The destination is new to Kortex; it goes live once checked (usually under a day).`,
          'warning', 9000
        );
      }
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
/** Rules shared with the public maker: night window, caps + fallback, placement, ROI inputs, campaign window. */
function extractRules() {
  const nightUrl = getVal('nightUrl');
  const schedule = nightUrl ? { timezone: getVal('nightTz') || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'), windows: [{ label: 'night', start: getVal('nightStart') || '18:00', end: getVal('nightEnd') || '06:00', url: nightUrl }] } : null;
  const maxClicks = getVal('maxClicks'), fallbackUrl = getVal('fallbackUrl');
  const limits = (maxClicks || fallbackUrl) ? { maxClicks: maxClicks ? Number(maxClicks) : undefined, fallbackUrl: fallbackUrl || undefined } : null;
  const printCost = getVal('printCost'), valuePerVisit = getVal('valuePerVisit');
  const economics = (printCost || valuePerVisit) ? { printCost: printCost ? Number(printCost) : undefined, valuePerVisit: valuePerVisit ? Number(valuePerVisit) : undefined, currency: getVal('currency') || undefined } : null;
  const cs = getVal('campaignStart'), ce = getVal('campaignEnd');
  const campaignWindow = (cs || ce) ? { startAt: cs || undefined, endAt: ce || undefined } : null;
  return { schedule, limits, placement: placementPayload(), economics, campaignWindow };
}
/** Controlled placement key plus an optional display label; null clears. */
function placementPayload() {
  const key = getVal('placement');
  if (!key) return null;
  const label = getVal('placementLabel');
  return label ? { key, label } : { key };
}
/** Fill the rule fields from a link being edited. */
function prefillRules(link) {
  if (!link) return;
  setScheduleFields(link.schedule);
  setText('maxClicks', link.limits && link.limits.maxClicks ? link.limits.maxClicks : ''); setText('fallbackUrl', link.limits ? link.limits.fallbackUrl : '');
  setPlacementFields(link.placement, link.placementLabel);
  setText('printCost', link.economics ? link.economics.printCost : ''); setText('valuePerVisit', link.economics ? link.economics.valuePerVisit : ''); setText('currency', link.economics ? link.economics.currency : '');
  const day = (x) => (x ? String(x).slice(0, 10) : '');
  setText('campaignStart', link.campaignWindow ? day(link.campaignWindow.startAt) : ''); setText('campaignEnd', link.campaignWindow ? day(link.campaignWindow.endAt) : '');
}
/** Night-window fields from a schedule (or the defaults when there is none). */
function setScheduleFields(schedule) {
  const windows = schedule && Array.isArray(schedule.windows) ? schedule.windows : [];
  const win = windows.find(w => w.label === 'night') || windows[0] || null;
  setText('nightUrl', win ? win.url : ''); setText('nightStart', win ? win.start : '18:00'); setText('nightEnd', win ? win.end : '06:00'); setText('nightTz', schedule ? schedule.timezone : '');
}
/** Select a controlled key; legacy free text (pre-controlled-list links) lands on "other" with the text as its label. */
function setPlacementFields(key, label) {
  const select = document.getElementById('placement');
  if (!select) return;
  const known = !!key && [...select.options].some(o => o.value === key);
  select.value = known ? key : (key ? 'other' : '');
  setText('placementLabel', label || (known ? '' : key));
}
/** UTM inputs from a link's tags — accepts both canonical (utm_source) and legacy shorthand (source) keys. */
function setUtmFields(utm) {
  Object.entries(UTM_FIELDS).forEach(([key, id]) => setText(id, utm[key] || utm[key.slice(4)] || ''));
}
/** datetime-local reads local time back, so write local components; Firestore timestamps and ISO strings both accepted. */
function setExpiresAt(value) {
  const el = document.getElementById('expiresAt');
  if (!el) return;
  if (!value) { el.value = ''; return; }
  const date = value._seconds ? new Date(value._seconds * 1000) : new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  el.value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ============================================================================
// PREFILL FROM A FINDING — the link page hands over { code, action } via STATE.prefill
// ============================================================================

/* Each applier writes one PATCH-body field into the form and returns the ids it touched. */
const PREFILL_APPLIERS = {
  limits: (limits) => {
    if (limits === null) { setText('maxClicks', ''); setText('fallbackUrl', ''); return ['maxClicks', 'fallbackUrl']; }
    return Object.keys(limits).filter(k => k === 'maxClicks' || k === 'fallbackUrl').map(k => { setText(k, limits[k]); return k; });
  },
  expiresAt: (iso) => { setExpiresAt(iso); return ['expiresAt']; },
  iosDestination: (url) => { setText('iosDestination', url); return ['iosDestination']; },
  androidDestination: (url) => { setText('androidDestination', url); return ['androidDestination']; },
  schedule: (schedule) => { setScheduleFields(schedule); return ['nightUrl', 'nightStart', 'nightEnd', 'nightTz']; },
  utm: (utm) => Object.entries(UTM_FIELDS).filter(([key]) => key in (utm || {})).map(([key, id]) => { setText(id, utm[key]); return id; }),
  placement: (p) => {
    const { key, label } = typeof p === 'string' ? { key: p, label: '' } : (p || {});
    setPlacementFields(key, label);
    return ['placement', 'placementLabel'];
  },
  enabled: (on) => { setChecked('enabled', on); return ['enabled']; },
};

function applyActionPrefill(prefill) {
  return Object.entries(prefill || {}).flatMap(([field, value]) => (PREFILL_APPLIERS[field] ? PREFILL_APPLIERS[field](value) : []));
}

const PREFILL_FLASH = [
  { boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.75)', borderColor: '#d4af37' },
  { boxShadow: '0 0 0 8px rgba(212, 175, 55, 0)', borderColor: '#d4af37' }
];
/** Pulse the touched fields gold, scroll to the first and focus the first one still empty. Nothing is saved. */
function highlightFields(ids) {
  const targets = ids.map(id => document.getElementById(id)).filter(Boolean).map(el => el.closest('.toggle-option') || el);
  if (!targets.length) return;
  targets.forEach(el => el.animate(PREFILL_FLASH, { duration: 1200, iterations: 3 }));
  targets[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  (targets.find(el => 'value' in el && el.value === '') || targets[0]).focus({ preventScroll: true });
}

/** One-shot: consume STATE.prefill, and apply it only when it belongs to the link now loaded. */
function applyPendingPrefill() {
  const pending = STATE.prefill;
  STATE.prefill = null;
  if (!pending || !pending.action || !CURRENT_EDIT_LINK || pending.code !== STATE.editingCode) return;
  const touched = applyActionPrefill(pending.action.prefill);
  PENDING_ACTION = { code: pending.code, type: pending.action.type };
  highlightFields(touched);
  utils.showInfo(`Prefilled "${pending.action.label || pending.action.type}" — review the highlighted fields, then save to apply.`, 5000);
}

/** After a save that carried a finding's proposal, record it as an applied checkpoint so the link page can say whether it helped. */
async function recordAppliedAction(code) {
  if (!PENDING_ACTION || PENDING_ACTION.code !== code) return;
  const { type } = PENDING_ACTION;
  PENDING_ACTION = null;
  try {
    const res = await apiFetch(`/kortex/${encodeURIComponent(code)}/actions`, { method: 'POST', body: JSON.stringify({ type, applied: true }) });
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok || !data.success) throw new Error(data.error || 'checkpoint not recorded');
    utils.showInfo('Checkpoint recorded — the link page will show whether this change helped.', 4000);
  } catch (err) {
    utils.showToast(`Saved, but the checkpoint was not recorded: ${err.message}`, 'warning', 5000);
  }
}

function extractCreatePayload() {
  const utm = buildUTM();
  const rules = Object.fromEntries(Object.entries(extractRules()).filter(([, val]) => val !== null));
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
    ...rules,
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
  const rules = extractRules(); // null clears a rule on update
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
    // null clears; undefined would be dropped from the body and the stored
    // end date would survive, so REMOVE_END_DATE could never take effect.
    expiresAt: expiresAtInput ? new Date(expiresAtInput).toISOString() : null,
    enabled: document.getElementById('enabled').checked,
    ...rules,
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
  Object.entries(UTM_FIELDS).forEach(([key, id]) => {
    const val = getVal(id);
    if (val) utm[key] = val;
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
          <button class="btn btn-secondary" style="flex-shrink:0;padding:8px 14px;font-size:12px;text-transform:none;" onclick="navigator.clipboard.writeText('${utils.jsAttr(reportUrl)}').then(()=>this.textContent='Copied!').catch(()=>{})">Copy</button>
        </div>
      </div>`
    : `<p style="font-size:12px;color:var(--kaayko-muted);margin-top:12px;">Report link unavailable. Visit /admin/alumni to create one.</p>`;

  ui.showModal('Link Created', `
    <div>
      <div style="font-size:11px;color:var(--kaayko-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">Share this link</div>
      <div style="display:flex;gap:8px;align-items:center;">
        <code style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:8px 10px;font-size:13px;">${utils.escapeHtml(campaignUrl)}</code>
        <button class="btn btn-primary" style="flex-shrink:0;padding:8px 14px;font-size:12px;text-transform:none;" onclick="navigator.clipboard.writeText('${utils.jsAttr(campaignUrl)}').then(()=>this.textContent='Copied!').catch(()=>{})">Copy</button>
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
    expiresAt: formData.expiresAt || undefined,
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
    prefillRules(link);
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

    setUtmFields(utm);
    setExpiresAt(link.expiresAt);

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

/** Like setField, but null/undefined clear the input instead of leaving it alone. */
function setText(id, val) {
  setField(id, val == null ? '' : String(val));
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
  PENDING_ACTION = null;

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

  // Rules
  ['maxClicks', 'fallbackUrl', 'nightUrl', 'nightTz', 'placement', 'placementLabel', 'printCost', 'valuePerVisit', 'currency', 'campaignStart', 'campaignEnd'].forEach(id => setField(id, ''));
  setField('nightStart', '18:00'); setField('nightEnd', '06:00');
}

window.resetCreateForm = resetCreateForm;

// ============================================================================
// EXPORTS
// ============================================================================

export function editLink(code) {
  STATE.editingCode = code;
}
