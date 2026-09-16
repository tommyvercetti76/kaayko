/* Kortex app: the maker, the access-code gate, the free workspace, the link
   detail and the team-workspace request form. Shared by kaayko.com/kortex and
   kaay.link. Expects window.KortexViews, window.KortexUtm and the vendored
   qrcode() to be loaded first, and the page to carry the maker/manage markup
   (ids mk-*, rs-*, mg-*, ws-*, rq-*, result, workspace, detail, links-list).
   Admin/tenant sign-in lives in kortex-login.js and is optional. */
/* ── CONFIG ── */
const CONFIG = {
  ENVIRONMENT: localStorage.getItem('kaayko_environment') || 'production',
  LOCAL_API: 'http://127.0.0.1:5001/kaaykostore/us-central1/api',
  PROD_API: 'https://api-vwcc5j4qda-uc.a.run.app',
  get API_BASE() { return this.ENVIRONMENT === 'production' ? this.PROD_API : this.LOCAL_API; }
};

/* Where the code card and the maker tell people to come back to. */
const HOME = /(^|\.)kaay\.link$/.test(location.hostname) ? 'kaay.link' : 'kaayko.com/kortex';

/* ── SMALL HELPERS ── */
const $ = (id) => document.getElementById(id);
function setAlert(id, type, msg) { const el = $(id); if (!el) return; el.className = msg ? `alert ${type} show` : 'alert'; el.textContent = msg || ''; }
function setStatus(id, msg, tone) { const el = $(id); if (!el) return; el.hidden = !msg; el.textContent = msg || ''; el.className = 'status' + (tone ? ' ' + tone : ''); }
function escapeHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function normaliseUrl(v) {
  let s = String(v || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : ''; } catch { return ''; }
}
async function copyText(text, btn) {
  let done = false;
  try { await navigator.clipboard.writeText(text); done = true; } catch {}
  if (!done) { // older or locked-down browsers: select-and-copy through a hidden field
    try { const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(t); t.select(); done = document.execCommand('copy'); t.remove(); } catch {}
  }
  if (btn) { const old = btn.textContent; btn.textContent = done ? 'Copied' : 'Select and copy it'; setTimeout(() => { btn.textContent = old; }, 1600); }
  return done;
}
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function fmtDate(iso) { if (!iso) return '—'; const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtAgo(iso) {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime(); if (isNaN(ms)) return '—';
  const m = Math.round(ms / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
function stripScheme(url) { return String(url || '').replace(/^https?:\/\//, ''); }
/* The apex kaay.link has no certificate yet; www.kaay.link serves the same image. Drop this once the apex mints. */
function qrSrc(url) { return String(url || '').replace(/^https:\/\/kaay\.link\//, 'https://www.kaay.link/'); }
/* ── STATIC QR (client-side, nothing leaves the browser) ── */
function scanTarget(shortUrl) { try { const u = new URL(shortUrl); u.searchParams.set('s', 'qr'); return u.toString(); } catch { return shortUrl; } }
function buildStaticQr(text) { const qr = qrcode(0, 'M'); qr.addData(text); qr.make(); return qr; }
function qrCanvas(qr, size, margin) {
  const n = qr.getModuleCount(); const cell = size / (n + margin * 2);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size); ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col)) {
    ctx.fillRect(Math.floor((col + margin) * cell), Math.floor((r + margin) * cell), Math.ceil(cell), Math.ceil(cell));
  }
  return c;
}
function qrSvg(qr) { return qr.createSvgTag({ cellSize: 8, margin: 16, scalable: true }); }
/* ── GUEST WORKSPACE STATE ── */
const GUEST_KEY = 'kortex_guest_session';
function guestSession() { try { const s = JSON.parse(localStorage.getItem(GUEST_KEY) || 'null'); if (s && s.token && s.exp > Date.now()) return s; } catch {} return null; }
function saveGuestSession(token, workspace, demoFocus) { localStorage.setItem(GUEST_KEY, JSON.stringify({ token, exp: Date.now() + (demoFocus ? 1.5 : (CAPS.sessionHours || 12) - 0.5) * 3600e3, workspaceId: workspace && workspace.id, demoFocus: demoFocus || null })); }
function clearGuestSession() { localStorage.removeItem(GUEST_KEY); }
/* The sample workspace is read at /kortex/samples only. A session for it, left
   behind by an earlier version of this page, is dropped before anything reads
   it, and a read-only workspace answer is never rendered: "already have a
   code?" belongs to real codes. */
const SAMPLE_WORKSPACE_ID = 'g_demo00';
function isSampleWorkspace(ws) { return !!ws && (ws.id === SAMPLE_WORKSPACE_ID || ws.demo === true); }
function forgetSampleSession() { const s = guestSession(); if (s && s.workspaceId === SAMPLE_WORKSPACE_ID && !s.demoFocus) clearGuestSession(); }
/* Demo codes: the three cards on the page. Opening one issues a read-only
   session for the sample workspace and shows ONLY that card's link, so a
   visitor sees exactly what the owner of that card would see. */
const DEMO_CODES = { 'KX-DEMO-LAKE': 'kx-lakecard', 'KX-DEMO-SHELF': 'mum-shop-20', 'KX-DEMO-BAITHAK': 'kx-baithak' };
function demoCodeOf(raw) { const k = String(raw || '').trim().toUpperCase().replace(/\s+/g, ''); return DEMO_CODES[k] || null; }
let demoFocus = null;
/* The session is gone (expired, or the workspace was switched off): show the code entry again, say so, and focus it. */
function sessionEnded() {
  clearGuestSession(); openCode = null;
  if ($('detail')) $('detail').hidden = true;
  renderWorkspace(null);
  setAlert('mg-alert', 'error', 'Your session ended. Enter your access code again.');
  if (location.hash !== '#manage') location.hash = '#manage';
  setTimeout(() => $('mg-code').focus(), 300);
}
async function guestApi(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = opts.session || (guestSession() || {}).token;
  if (token) headers['X-Kortex-Guest-Session'] = token;
  let res;
  try {
    res = await fetch(`${CONFIG.API_BASE}/kortex/guest${path}`, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } catch { return { ok: false, status: 0, data: { error: 'Network problem. Check your connection and try again.' } }; }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && data.code === 'GUEST_SESSION_REQUIRED') sessionEnded();
  return { ok: res.ok, status: res.status, data };
}
/* Fetch a file (CSV) with the workspace session and hand it to the browser. */
async function guestDownload(path, filename, btn) {
  const token = (guestSession() || {}).token;
  if (!token) { location.hash = '#manage'; return; }
  const old = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Preparing…'; }
  try {
    const res = await fetch(`${CONFIG.API_BASE}/kortex/guest${path}`, { headers: { 'X-Kortex-Guest-Session': token } });
    if (!res.ok) throw new Error(res.status === 429 ? 'Too many exports for now. Try again in a while.' : 'Could not prepare the file.');
    download(filename, await res.blob());
    if (btn) btn.textContent = 'Downloaded';
  } catch (e) {
    if (btn) btn.textContent = e.message;
  } finally {
    setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = old; } }, 2200);
  }
}
const FRIENDLY = {
  DESTINATION_BLOCKED: 'That destination was refused by our safety check.',
  RATE_LIMIT_UNAVAILABLE: 'We are briefly unable to take new links. Try again in a minute.',
  get PLAN_LIMIT_EXCEEDED() { return `This free workspace has reached ${CAPS.linkLimit} links.`; },
  INVALID_ACCESS_CODE: 'That access code is not valid. It has 22 letters and numbers after KX.',
  ACCESS_CODE_LOCKED: 'Too many attempts. Try again in about an hour.',
  GUEST_NOT_CONFIGURED: 'Free links are not available right now.',
  GUEST_SESSION_REQUIRED: 'Enter your access code to continue.',
  READ_ONLY_DEMO: 'This is a sample card, read-only. Make your own link above and the code you receive can change it.'
};
function friendly(data, fallback) { return (data && (FRIENDLY[data.code] || data.error)) || fallback; }
/* ── WHAT THE SERVER CAN DO RIGHT NOW ──
   Email delivery is optional infrastructure. The page asks before it
   promises anything, so a first-timer is never offered a feature that
   would silently do nothing. Numbers come from the same config the
   limits use, so the copy here cannot drift from the behaviour. */
const CAPS = { email: false, lifetimeDays: 365, linkLimit: 25, analyticsDays: 7, sessionHours: 12 };
function applyCaps() {
  const on = !!CAPS.email;
  ['mk-email-field', 'ws-email', 'ws-email-dot', 'mg-lost'].forEach(id => { $(id).hidden = !on; });
  $('mg-lost-off').hidden = on;
  if (!on) { $('mk-email').value = ''; $('recover-form').hidden = true; $('ws-email-form').hidden = true; }
  renderFacts();
}
async function loadCaps() {
  const { ok, data } = await guestApi('/capabilities');
  if (ok && data) { CAPS.email = !!data.email; ['lifetimeDays', 'linkLimit', 'analyticsDays', 'sessionHours'].forEach(k => { if (data[k]) CAPS[k] = data[k]; }); }
  applyCaps();
}
/* ── THE CODE, WHILE THIS TAB LIVES ──
   The server keeps only a hash, so the code can never be shown again by
   asking for it. This tab remembers it (sessionStorage: gone when the tab
   closes, never shared with other tabs or sites) so a reload or a trip to
   the dashboard does not lose it before it has been saved. */
const CODE_KEY = 'kortex_guest_code';
let codeSaved = true;
function rememberCode(code, workspaceId) { try { sessionStorage.setItem(CODE_KEY, JSON.stringify({ code, workspaceId })); } catch {} }
function knownCode() { try { const c = JSON.parse(sessionStorage.getItem(CODE_KEY) || 'null'); const s = guestSession(); return c && c.code && s && c.workspaceId === s.workspaceId ? c.code : null; } catch { return null; } }
function forgetCode() { try { sessionStorage.removeItem(CODE_KEY); } catch {} }
function markCodeSaved() { codeSaved = true; $('rs-confirm').hidden = true; }
window.addEventListener('beforeunload', (e) => { if (!codeSaved) { e.preventDefault(); e.returnValue = ''; } });

/* A private key card: the code, what it opens, until when, and where to
   use it. Deliberately separate from the QR download, so the secret never
   ends up on the poster. */
async function keyCard(code, link, ws) {
  if (!code) return;
  try { if (document.fonts && document.fonts.load) await Promise.all([document.fonts.load('italic 32px "Cormorant Garamond"'), document.fonts.load('500 32px "Cormorant Garamond"')]); } catch {}
  const W = 1200, H = 760, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), serif = '"Cormorant Garamond", Georgia, serif';
  x.fillStyle = '#080808'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(181,147,90,0.55)'; x.lineWidth = 2; x.strokeRect(40, 40, W - 80, H - 80);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#b5935a'; x.font = `italic 28px ${serif}`; x.fillText('K O R T E X   ·   A C C E S S   C O D E', W / 2, 120);
  x.fillStyle = '#ede8df'; x.font = '600 60px ui-monospace, Menlo, Consolas, monospace'; x.fillText(code, W / 2, 245);
  x.fillStyle = 'rgba(237,232,223,0.8)'; x.font = `italic 32px ${serif}`;
  const title = link && link.title ? String(link.title).slice(0, 40) : '';
  x.fillText(link ? stripScheme(link.shortUrl) + (title ? '   ·   ' + title : '') : 'Your free Kortex workspace', W / 2, 345);
  if (ws && ws.expiresAt) x.fillText(`Live until ${fmtDate(ws.expiresAt)}. Opening it with this code renews it.`, W / 2, 395);
  x.fillText(`Open it at ${HOME}, then “I have a code”.`, W / 2, 465);
  x.fillStyle = '#d9bd7b'; x.font = `italic 28px ${serif}`;
  x.fillText('Private. Keep it away from the printed QR.', W / 2, 550);
  x.fillText('Anyone holding this code can re-point the link.', W / 2, 590);
  x.fillStyle = 'rgba(237,232,223,0.5)'; x.font = `italic 24px ${serif}`;
  x.fillText('Saved ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, 665);
  c.toBlob(b => download(`kortex-key-${String(code).split('-')[1] || 'card'}.png`, b), 'image/png');
}
/* ── MAKE ── */
let mode = 'dynamic';
let lastResult = null;
const MODE_NOTES = {
  dynamic: 'A kaay.link address behind the QR. Re-point it after printing; see every scan. Free for a year.',
  static: 'The address itself, drawn as a code. Nothing stored, nothing to see later, never changeable.'
};
function modeFacts(next) {
  if (next === 'static') return ['the address itself', 'works forever', 'nothing stored', 'no access code', 'no scan counts', 'cannot be changed'];
  const year = CAPS.lifetimeDays >= 365 ? 'a year' : `${CAPS.lifetimeDays} days`;
  return ['short kaay.link address', 'change where it points', 'scans by day, device, country', 'night and day destinations', 'scan caps and end dates', 'campaign tags', 'access code shown once', `free for ${year}`];
}
function renderFacts() { $('mode-facts').innerHTML = modeFacts(mode).map(f => `<li>${escapeHtml(f)}</li>`).join(''); }
function setMode(next) {
  mode = next;
  $('mode-dynamic').classList.toggle('active', next === 'dynamic'); $('mode-dynamic').setAttribute('aria-pressed', next === 'dynamic');
  $('mode-static').classList.toggle('active', next === 'static'); $('mode-static').setAttribute('aria-pressed', next === 'static');
  $('mode-note').textContent = MODE_NOTES[next];
  $('mk-options').hidden = next === 'static';
  $('mk-submit').textContent = next === 'static' ? 'Make QR' : 'Create';
  renderFacts();
  $('mk-foot').hidden = next === 'static';
  if (next === 'static' && $('mk-utm-hint')) { $('mk-utm-hint').hidden = true; $('mk-utm-hint').innerHTML = ''; }
}
$('mode-dynamic').addEventListener('click', () => setMode('dynamic'));
$('mode-static').addEventListener('click', () => setMode('static'));

/* Night routing (time-of-day windows, evaluated on the server in this zone) */
function browserTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } }
$('mk-tz').value = browserTz();
$('mk-night-on').addEventListener('change', () => { $('mk-night-fields').hidden = !$('mk-night-on').checked; if ($('mk-night-on').checked) $('mk-night-url').focus(); });
$('mk-ask-on').addEventListener('change', () => { $('mk-ask-fields').hidden = !$('mk-ask-on').checked; if ($('mk-ask-on').checked) $('mk-ask-q').focus(); });

/* One question at the scan. Read from the maker (mk) or the detail form (dt).
   Returns { value } (an object, or null when the box is unticked) or { error }. */
function askFromFields(prefix) {
  if (!$(`${prefix}-ask-on`).checked) return { value: null };
  const question = $(`${prefix}-ask-q`).value.trim();
  const options = ['o1', 'o2', 'o3'].map(k => $(`${prefix}-ask-${k}`).value.trim()).filter(Boolean);
  if (!question) return { error: 'Write the question people will see.' };
  if (options.length < 2) return { error: 'Give at least two answers.' };
  if (new Set(options.map(o => o.toLowerCase())).size !== options.length) return { error: 'The answers must be different from each other.' };
  return { value: { question, options, guests: $(`${prefix}-ask-guests`).checked } };
}

/* What people answered, in plain words. */
function answersHtml(t) {
  if (!t) return '';
  const parts = t.options.map(o => `<li><span>${escapeHtml(o.label)}</span><b>${o.count}${t.guestsAsked && o.guests !== o.count ? ` <small>(${o.guests} people)</small>` : ''}</b></li>`).join('');
  const line = t.answered
    ? `${t.answered} answered${t.guestsAsked ? `, ${t.guests} people in all` : ''}${t.changed ? `; ${t.changed} changed their mind` : ''}.`
    : 'Nobody has answered yet. The question shows the moment someone scans.';
  return `<div class="mini-list answers"><div><h4>${escapeHtml(t.question)}</h4><ul>${parts}</ul><p class="note">${escapeHtml(line)}</p></div></div>`;
}
$('mk-utm-on').addEventListener('change', () => { $('mk-utm-fields').hidden = !$('mk-utm-on').checked; if ($('mk-utm-on').checked) $('mk-utm-source').focus(); });
$('mk-limit-on').addEventListener('change', () => { $('mk-limit-fields').hidden = !$('mk-limit-on').checked; if ($('mk-limit-on').checked) $('mk-max').focus(); });

/* Campaign tags a pasted address already carries, read back in plain words. */
$('mk-url').addEventListener('input', () => {
  const hint = $('mk-utm-hint');
  const d = (window.KortexUtm && mode === 'dynamic') ? KortexUtm.decode(normaliseUrl($('mk-url').value) || $('mk-url').value) : null;
  if (!d || !d.hasTags) { hint.hidden = true; hint.innerHTML = ''; return; }
  // The form carries source, medium and campaign; term and content stay on the address.
  const movable = ['utm_source', 'utm_medium', 'utm_campaign'];
  try { const keep = new URL(d.cleanUrl); ['utm_term', 'utm_content'].forEach(k => { if (d.tags[k]) keep.searchParams.set(k, d.tags[k]); }); d.cleanUrl = keep.toString(); } catch {}
  if (!movable.some(k => d.tags[k])) { hint.hidden = true; hint.innerHTML = ''; return; }
  hint.hidden = false;
  hint.innerHTML = `This address already carries campaign tags: ${KortexUtm.chips(d.tags).map(c => `<b>${escapeHtml(c.label)}</b> ${escapeHtml(c.value)}`).join(' · ')}. ${escapeHtml(KortexUtm.sentence(d.tags))} <button type="button" class="action-link quiet" id="mk-utm-move">Move them into the link</button>`;
  $('mk-utm-move').addEventListener('click', () => {
    $('mk-url').value = d.cleanUrl;
    $('mk-options').open = true; $('mk-utm-on').checked = true; $('mk-utm-fields').hidden = false;
    $('mk-utm-source').value = d.tags.utm_source || ''; $('mk-utm-medium').value = d.tags.utm_medium || ''; $('mk-utm-campaign').value = d.tags.utm_campaign || '';
    hint.hidden = true; hint.innerHTML = '';
  });
});

function dateInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/* A date picked in the form means "through the end of that day, where I am". */
function expiryFromDateInput(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}
function limitSummary(link) {
  const parts = [];
  if (link.limits && link.limits.maxClicks) parts.push(`stops after ${link.limits.maxClicks} scans`);
  if (link.expiresAt) parts.push(`ends ${fmtDate(link.expiresAt)}`);
  if (!parts.length) return '';
  const then = link.limits && link.limits.fallbackUrl ? `, then sends people to ${stripScheme(link.limits.fallbackUrl)}` : ', then shows a plain "no longer available" page';
  return `This link ${parts.join(' and ')}${then}.`;
}
function utmFromFields(prefix) {
  const get = id => ($(id) ? $(id).value.trim() : '');
  const out = {};
  if (get(`${prefix}-utm-source`)) out.utm_source = get(`${prefix}-utm-source`);
  if (get(`${prefix}-utm-medium`)) out.utm_medium = get(`${prefix}-utm-medium`);
  if (get(`${prefix}-utm-campaign`)) out.utm_campaign = get(`${prefix}-utm-campaign`);
  return out;
}
/* ── WHERE THE CODE LIVES ──
   A controlled list, so placements can be compared; any key can carry a short
   label of the owner's own ("Poster · front window"). Older links hold free
   text, which sits under "other" until the next save. */
const PLACEMENTS = [['poster', 'Poster'], ['flyer', 'Flyer'], ['menu', 'Menu'], ['table_tent', 'Table tent'], ['packaging', 'Packaging'], ['badge', 'Badge'], ['business_card', 'Business card'], ['window', 'Storefront window'], ['screen', 'Screen'], ['vehicle', 'Vehicle'], ['other', 'Other']];
const PERSONAL_LOOKING = /@|https?:\/\/|www\.|\d{6,}/;
function placementOptions(selectedKey) {
  return '<option value="">Not set</option>' + PLACEMENTS.map(([key, name]) => `<option value="${key}"${key === selectedKey ? ' selected' : ''}>${escapeHtml(name)}</option>`).join('');
}
function placementSelection(link) {
  const raw = String(link.placement || '').trim();
  if (!raw) return { key: '', label: '' };
  const known = PLACEMENTS.find(([key, name]) => key === raw || name.toLowerCase() === raw.toLowerCase());
  return known ? { key: known[0], label: link.placementLabel || '' } : { key: 'other', label: link.placementLabel || raw };
}
function bindPlacementLabel(prefix) {
  const select = $(`${prefix}-placement`), field = $(`${prefix}-placement-label-field`), input = $(`${prefix}-placement-label`);
  // Shown for every chosen placement, and emptied when the placement is cleared
  // so a label typed for one surface can never ride along to another.
  const sync = () => { field.hidden = !select.value; if (field.hidden) input.value = ''; };
  select.addEventListener('change', () => { sync(); if (!field.hidden) input.focus(); });
  sync();
}
$('mk-placement').innerHTML = placementOptions('');
bindPlacementLabel('mk');
/* Each reader returns { value, error }: the value the API takes (null clears) or the sentence to show. */
function placementFromFields(prefix) {
  const key = $(`${prefix}-placement`).value;
  if (!key) return { value: null, error: null };
  const label = $(`${prefix}-placement-label`).value.trim();
  if (PERSONAL_LOOKING.test(label)) return { value: null, error: 'Name the place in a few words, without an email, phone number or address.' };
  return { value: { key, label: label || null }, error: null };
}
function economicsFromFields(prefix, currency) {
  const cost = $(`${prefix}-print-cost`).value.trim(), value = $(`${prefix}-value`).value.trim();
  if ((cost && !(Number(cost) >= 0)) || (value && !(Number(value) >= 0))) return { value: null, error: 'Print cost and value per visit must be numbers of zero or more.' };
  if (!cost && !value) return { value: null, error: null };
  return { value: { printCost: cost ? Number(cost) : undefined, valuePerVisit: value ? Number(value) : undefined, currency: currency || undefined }, error: null };
}
function campaignWindowFromFields(prefix) {
  const start = $(`${prefix}-camp-start`).value, end = $(`${prefix}-camp-end`).value;
  if (start && end && end < start) return { value: null, error: 'The campaign end must be after its start.' };
  return { value: (start || end) ? { startAt: start || undefined, endAt: end || undefined } : null, error: null };
}
function nightWindowOf(schedule) { return (schedule && schedule.windows && (schedule.windows.find(w => w.label === 'night') || schedule.windows[0])) || null; }
function nightSummary(schedule) {
  const win = nightWindowOf(schedule);
  if (!win) return '';
  return `Night routing on: ${win.start}–${win.end} (${schedule.timezone}) → ${stripScheme(win.url)}`;
}

function showResult(r) {
  lastResult = r;
  $('make-form').hidden = true; $('result').classList.add('show');
  const frame = $('qr-frame'); frame.innerHTML = '';
  $('rs-email-form').hidden = true; $('rs-confirm').hidden = true; setStatus('rs-status', '');
  const isStatic = r.kind === 'static';
  $('rs-static-note').hidden = !isStatic;
  $('rs-make-dynamic').hidden = !isStatic; $('rs-dyn-dot').hidden = !isStatic;
  $('rs-open').hidden = isStatic; $('rs-open-dot').hidden = isStatic;
  if (isStatic) {
    frame.appendChild(qrCanvas(r.qr, 480, 2));
    $('rs-url').textContent = r.text;
    ['rs-night-note', 'rs-limit-note', 'rs-code-card', 'rs-expiry', 'rs-next', 'rs-ws-note', 'rs-email-toggle', 'rs-email-dot'].forEach(id => { $(id).hidden = true; });
    codeSaved = true;
  } else {
    const img = document.createElement('img'); img.alt = 'QR code for ' + r.link.shortUrl; img.src = r.qrPng; frame.appendChild(img);
    $('rs-url').textContent = stripScheme(r.link.shortUrl);
    const night = nightSummary(r.link.schedule);
    $('rs-night-note').hidden = !night; $('rs-night-note').textContent = night;
    const lim = limitSummary(r.link);
    $('rs-limit-note').hidden = !lim; $('rs-limit-note').textContent = lim;
    const newWorkspace = !!r.accessCode;
    const wsId = r.workspace && r.workspace.id;
    if (newWorkspace) rememberCode(r.accessCode, wsId);
    const code = r.accessCode || knownCode();
    $('rs-code-card').hidden = !code;
    if (code) {
      $('rs-code').textContent = code;
      $('rs-code-label').textContent = newWorkspace ? 'Your access code' : 'Your access code, same as before';
      $('rs-code-note').innerHTML = newWorkspace
        ? 'Shown <strong>once</strong>. It is the only key to this link\'s scans and settings, and anyone holding it can re-point the QR. Keep it private, away from the printed code.'
        : 'This link joined the workspace that code already opens. Nothing new to keep.';
    }
    $('rs-email-toggle').hidden = !CAPS.email || !newWorkspace || !!r.emailSent; $('rs-email-dot').hidden = $('rs-email-toggle').hidden;
    if (newWorkspace && r.emailSent) {
      setStatus('rs-status', r.emailDelivery === 'sent' ? `A copy went to ${r.email}.` : r.emailDelivery === 'failed' ? `The email to ${r.email} could not be sent, so keep the code shown here.` : `A copy is on its way to ${r.email}.`, r.emailDelivery === 'failed' ? 'err' : 'ok');
    }
    const exp = r.workspace && r.workspace.expiresAt;
    $('rs-expiry').hidden = !exp;
    if (exp) $('rs-expiry').textContent = `Live until ${fmtDate(exp)}. Opening it with your code renews it for another ${CAPS.lifetimeDays >= 365 ? 'year' : CAPS.lifetimeDays + ' days'}.`;
    $('rs-next').hidden = !newWorkspace;
    $('rs-ws-note').hidden = newWorkspace;
    if (!newWorkspace) $('rs-ws-note').textContent = `Added to your workspace: ${r.workspace.links} of ${r.workspace.linkLimit} links.`;
    codeSaved = !newWorkspace || r.emailDelivery === 'sent';
  }
  $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function resetMaker() {
  $('result').classList.remove('show'); $('make-form').hidden = false;
  $('mk-url').value = ''; $('mk-title').value = ''; $('mk-url').focus();
}

$('make-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setAlert('mk-alert');
  const url = normaliseUrl($('mk-url').value);
  if (!url) { setAlert('mk-alert', 'error', 'Enter a full web address, like https://your-site.com/tickets'); $('mk-url').focus(); return; }
  if (mode === 'static') {
    let qr;
    try { qr = buildStaticQr(url); } catch { setAlert('mk-alert', 'error', 'That address is too long for a QR code. Shorten it, or make it dynamic.'); return; }
    showResult({ kind: 'static', text: url, qr });
    return;
  }
  let schedule;
  if ($('mk-night-on').checked) {
    const nightUrl = normaliseUrl($('mk-night-url').value);
    if (!nightUrl) { setAlert('mk-alert', 'error', 'Enter the night destination, or untick night routing.'); $('mk-options').open = true; $('mk-night-url').focus(); return; }
    schedule = { timezone: $('mk-tz').value.trim() || browserTz(), windows: [{ label: 'night', start: $('mk-night-start').value || '18:00', end: $('mk-night-end').value || '06:00', url: nightUrl }] };
  }
  let limits, expiresAt, utm;
  if ($('mk-limit-on').checked) {
    const max = $('mk-max').value.trim();
    const fallbackRaw = $('mk-fallback').value.trim();
    const fallbackUrl = fallbackRaw ? normaliseUrl(fallbackRaw) : null;
    $('mk-options').open = true;
    if (fallbackRaw && !fallbackUrl) { setAlert('mk-alert', 'error', 'Enter a full web address for the fallback, or leave it empty.'); $('mk-fallback').focus(); return; }
    if (max && !/^\d+$/.test(max)) { setAlert('mk-alert', 'error', 'The scan limit must be a whole number.'); $('mk-max').focus(); return; }
    expiresAt = expiryFromDateInput($('mk-expires').value);
    if (!max && !expiresAt) { setAlert('mk-alert', 'error', 'Enter a number of scans or an end date, or untick the limit.'); $('mk-max').focus(); return; }
    if ($('mk-expires').value && !expiresAt) { setAlert('mk-alert', 'error', 'That end date is not valid.'); $('mk-expires').focus(); return; }
    if (expiresAt && new Date(expiresAt) < new Date()) { setAlert('mk-alert', 'error', 'The end date is already in the past.'); $('mk-expires').focus(); return; }
    if (max || fallbackUrl) limits = { maxClicks: max ? Number(max) : undefined, fallbackUrl: fallbackUrl || undefined };
  }
  if ($('mk-utm-on').checked) { const tags = utmFromFields('mk'); if (Object.keys(tags).length) utm = tags; }
  const placement = placementFromFields('mk'), economics = economicsFromFields('mk', ''), campaignWindow = campaignWindowFromFields('mk');
  const measureProblem = placement.error || economics.error || campaignWindow.error;
  if (measureProblem) { setAlert('mk-alert', 'error', measureProblem); $('mk-options').open = true; $('mk-measure').open = true; return; }
  const ask = askFromFields('mk');
  if (ask.error) { setAlert('mk-alert', 'error', ask.error); $('mk-options').open = true; $('mk-ask-q').focus(); return; }
  const campaign = $('mk-campaign').value.trim();
  if (campaign && !(utm && utm.utm_campaign)) utm = { ...utm, utm_campaign: campaign };
  const btn = $('mk-submit'); btn.disabled = true; btn.textContent = 'Checking…';
  const body = {
    destination: url,
    title: $('mk-title').value.trim() || undefined,
    iosDestination: normaliseUrl($('mk-ios').value) || undefined,
    androidDestination: normaliseUrl($('mk-android').value) || undefined,
    email: $('mk-email').value.trim() || undefined,
    schedule,
    limits,
    expiresAt,
    utm,
    placement: placement.value || undefined,
    economics: economics.value || undefined,
    campaignWindow: campaignWindow.value || undefined,
    ask: ask.value || undefined,
    website: $('mk-website').value || undefined
  };
  const { ok, data } = await guestApi('/links', { method: 'POST', body });
  btn.disabled = false; btn.textContent = 'Create';
  if (!ok) {
    const why = data.reasons && data.reasons.length ? ' ' + data.reasons.map(r => r.detail).join(' ') : '';
    setAlert('mk-alert', 'error', friendly(data, 'Could not create the link. Please try again.') + why);
    return;
  }
  saveGuestSession(data.session, data.workspace);
  showResult({ kind: 'dynamic', link: data.link, qrPng: data.qr.png, accessCode: data.accessCode, email: body.email, emailSent: !!(data.accessCode && body.email), emailDelivery: data.emailDelivery, workspace: data.workspace });
});

$('rs-copy-url').addEventListener('click', () => copyText(lastResult.kind === 'static' ? lastResult.text : lastResult.link.shortUrl, $('rs-copy-url')));
$('rs-dl-png').addEventListener('click', async () => {
  if (!lastResult) return;
  if (lastResult.kind === 'static') { qrCanvas(lastResult.qr, 1024, 2).toBlob(b => download('kortex-qr.png', b), 'image/png'); return; }
  const b64 = String(lastResult.qrPng).split(',')[1] || '';
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  download(`kortex-${lastResult.link.code}.png`, new Blob([bytes], { type: 'image/png' }));
});
$('rs-dl-svg').addEventListener('click', () => {
  if (!lastResult) return;
  const qr = lastResult.kind === 'static' ? lastResult.qr : buildStaticQr(scanTarget(lastResult.link.shortUrl));
  download(lastResult.kind === 'static' ? 'kortex-qr.svg' : `kortex-${lastResult.link.code}.svg`, new Blob([qrSvg(qr)], { type: 'image/svg+xml' }));
});
$('rs-copy-code').addEventListener('click', async () => { if (await copyText($('rs-code').textContent, $('rs-copy-code'))) markCodeSaved(); });
$('rs-keycard').addEventListener('click', () => { keyCard($('rs-code').textContent, lastResult && lastResult.link, lastResult && lastResult.workspace); markCodeSaved(); });
$('rs-confirm-copy').addEventListener('click', async () => { if (await copyText($('rs-code').textContent, $('rs-confirm-copy'))) markCodeSaved(); });
$('rs-confirm-go').addEventListener('click', () => { markCodeSaved(); resetMaker(); $('make').scrollIntoView({ behavior: 'smooth' }); });
$('rs-another').addEventListener('click', () => {
  // Not letting anyone walk away from a code they have not kept.
  if (!codeSaved) { $('rs-confirm').hidden = false; $('rs-confirm').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
  resetMaker(); $('make').scrollIntoView({ behavior: 'smooth' });
});
$('rs-make-dynamic').addEventListener('click', () => {
  const url = lastResult && lastResult.kind === 'static' ? lastResult.text : '';
  $('result').classList.remove('show'); $('make-form').hidden = false;
  setMode('dynamic'); $('mk-url').value = url; $('mk-url').focus();
  $('make').scrollIntoView({ behavior: 'smooth' });
});
$('rs-open').addEventListener('click', () => { location.hash = '#manage'; openWorkspaceFromSession(); });
$('rs-email-toggle').addEventListener('click', () => { $('rs-email-form').hidden = !$('rs-email-form').hidden; if (!$('rs-email-form').hidden) $('rs-email').focus(); });
$('rs-email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const address = $('rs-email').value.trim(); if (!address) return;
  const btn = $('rs-email-btn'); btn.disabled = true;
  const { ok, data } = await guestApi('/email', { method: 'POST', body: { email: address } });
  btn.disabled = false;
  if (!ok) { setStatus('rs-status', friendly(data, 'Could not send the email.'), 'err'); return; }
  // Attaching an email issues a fresh code (the old one is never stored).
  $('rs-code').textContent = data.accessCode; saveGuestSession(data.session, data.workspace); rememberCode(data.accessCode, data.workspace && data.workspace.id); markCodeSaved();
  $('rs-email-form').hidden = true; $('rs-email-toggle').hidden = true; $('rs-email-dot').hidden = true;
  setStatus('rs-status', data.emailDelivery === 'sent' ? `Sent to ${address}. This new code replaces the earlier one.` : `We'll email it to ${address} shortly. The code shown is the new one.`, 'ok');
});
/* ── MANAGE ── */
let wsLinks = [];
let wsMeta = null;
let openCode = null;

$('mg-lost').addEventListener('click', (e) => { e.preventDefault(); $('recover-form').hidden = !$('recover-form').hidden; });
$('code-form').addEventListener('submit', async (e) => {
  e.preventDefault(); setAlert('mg-alert');
  const code = $('mg-code').value.trim(); if (!code) return;
  const btn = $('mg-submit'); btn.disabled = true; btn.textContent = 'Checking…';
  const focus = demoCodeOf(code);
  const { ok, data } = focus ? await guestApi('/demo') : await guestApi('/session', { method: 'POST', body: { accessCode: code } });
  btn.disabled = false; btn.textContent = 'Open';
  if (!ok) { setAlert('mg-alert', 'error', friendly(data, 'Could not open the workspace.')); return; }
  saveGuestSession(data.session, data.workspace, focus);
  $('mg-code').value = '';
  await openWorkspaceFromSession(data.revivedLinks);
});
$('recover-form').addEventListener('submit', async (e) => {
  e.preventDefault(); setAlert('rc-alert');
  const address = $('rc-email').value.trim(); if (!address) return;
  const rbtn = e.submitter || $('recover-form').querySelector('button[type="submit"]'); if (rbtn) rbtn.disabled = true;
  const { ok, data } = await guestApi('/recover', { method: 'POST', body: { email: address } });
  if (rbtn) rbtn.disabled = false;
  if (!ok) { setAlert('rc-alert', 'error', friendly(data, 'Could not send a new code.')); return; }
  setAlert('rc-alert', 'success', data.emailConfigured === false ? 'Request received. Email delivery is being set up, so this may take a little while.' : data.message);
});

async function openWorkspaceFromSession(revived) {
  if (!guestSession()) return false;
  const { ok, status, data } = await guestApi('/workspace');
  if (!ok) {
    if (status === 401 || (data && data.code === 'WORKSPACE_DISABLED')) { sessionEnded(); }
    else { setAlert('mg-alert', 'error', friendly(data, 'Could not reach your workspace right now. Try again in a moment.')); }
    return false;
  }
  const sess = guestSession() || {};
  demoFocus = sess.demoFocus || null;
  if ((data.readOnly || isSampleWorkspace(data.workspace)) && !demoFocus) { clearGuestSession(); renderWorkspace(null); return false; }
  wsLinks = demoFocus ? data.links.filter(l => l.code === demoFocus) : data.links;
  wsMeta = data.workspace; renderWorkspace(data.workspace, revived);
  if (demoFocus && wsLinks.length) { await openDetail(demoFocus); const d = $('detail'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  return true;
}
function renderWorkspace(ws, revived) {
  $('manage-enter').hidden = !!ws; $('workspace').hidden = !ws;
  if (!ws) return;
  if (wsLinks.length && !demoFocus) loadOverview(ws); else $('ws-overview').hidden = true;
  $('ws-meta').innerHTML = demoFocus
    ? `<b>Sample card</b> · read-only · scans simulated to a realistic rhythm, refreshed weekly · your own code opens your own`
    : `<b>${ws.links}</b> of ${ws.linkLimit} free links · live until <b>${fmtDate(ws.expiresAt)}</b> · ${ws.hasEmail ? `recovery email <b>${escapeHtml(ws.email)}</b>` : 'no email on file'}${revived ? ` · <b>${revived} link${revived === 1 ? '' : 's'} revived</b>` : ''}`;
  ['ws-email', 'ws-email-dot', 'ws-rotate', 'ws-export'].forEach(id => { const el = $(id); if (el && demoFocus) el.hidden = true; });
  $('ws-lifetime').textContent = `Free links stay live for ${Math.round(ws.lifetimeDays / 30)} months and renew every time you open them with your code. Scan detail covers the last ${ws.analyticsDays} days; lifetime totals never reset.`;
  const kc = knownCode();
  if (kc && $('ws-code-card').hidden) showWsCode(kc, 'Your access code', 'Kept in this tab only. Copy it or save the key card if you have not already.', false);
  if (!kc) $('ws-code-card').hidden = true;
  const list = $('links-list'); list.innerHTML = '';
  if (!wsLinks.length) { list.innerHTML = '<p class="note" style="padding:16px 0;text-align:center">No links yet. Make one above and it will appear here.</p>'; }
  wsLinks.forEach(l => {
    const row = document.createElement('div'); row.className = 'link-row' + (l.code === openCode ? ' active' : ''); row.tabIndex = 0; row.setAttribute('role', 'button');
    const state = l.status === 'blocked' ? '<span class="st off">blocked</span>' : l.status === 'held' ? '<span class="st">under review</span>' : !l.enabled ? '<span class="st off">paused</span>' : '<span class="st">live</span>';
    const dest = (l.destinations && (l.destinations.web || l.destinations.ios || l.destinations.android)) || '';
    row.innerHTML = `<div><div class="link-title">${escapeHtml(l.title || l.code)}</div><div class="link-sub">${state}${escapeHtml(stripScheme(l.shortUrl))} → ${escapeHtml(stripScheme(dest))}</div></div><div class="link-count">${l.clickCount}<small>scans</small></div>`;
    row.addEventListener('click', () => openDetail(l.code));
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(l.code); } });
    list.appendChild(row);
  });
  if (openCode && !wsLinks.some(l => l.code === openCode)) { openCode = null; $('detail').hidden = true; }
}

/* ── ACTION CENTER → SETTINGS ──
   A finding proposes the PATCH body that would fix it. Accepting it types
   the proposal into the settings form and lights the fields; the save (or
   the Pause) that follows records a checkpoint, so the next window can say
   whether it helped. Dismissing records the reason instead. */
let pendingAction = null;
const PREFILL_FIELDS = {
  'limits.maxClicks': 'dt-max', 'limits.fallbackUrl': 'dt-fallback', expiresAt: 'dt-expires',
  iosDestination: 'dt-ios', androidDestination: 'dt-android', placement: 'dt-placement', enabled: 'dt-toggle',
  'utm.utm_source': 'dt-utm-source', 'utm.utm_medium': 'dt-utm-medium', 'utm.utm_campaign': 'dt-utm-campaign'
};
/* [field id, value] pairs for a proposed body; null on a branch clears every field under it. The schedule is applied whole, separately. */
function prefillEntries(prefill) {
  const out = [];
  const walk = (value, path) => {
    if (value && typeof value === 'object' && path !== 'schedule') { Object.entries(value).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k)); return; }
    Object.entries(PREFILL_FIELDS).filter(([p]) => p === path || p.startsWith(`${path}.`)).forEach(([, id]) => out.push([id, value ?? '']));
  };
  walk(prefill || {}, '');
  return out;
}
function fillNightFields(schedule) {
  const win = nightWindowOf(schedule);
  $('dt-night-url').value = win ? win.url : ''; $('dt-night-start').value = win ? win.start : '18:00'; $('dt-night-end').value = win ? win.end : '06:00';
  $('dt-tz').value = (schedule && schedule.timezone) || browserTz();
}
function lightFields(fields) {
  const els = fields.filter(Boolean);
  els.forEach(el => el.classList.add('prefill-hl'));
  if (!els.length) return;
  els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => els[0].focus({ preventScroll: true }), 400);
}
function applyPrefill(prefill) {
  const lit = prefillEntries(prefill).map(([id, value]) => {
    const el = $(id);
    if (el && el.tagName !== 'BUTTON') { el.value = id === 'dt-expires' ? dateInputValue(value) : String(value); el.dispatchEvent(new Event('change')); }
    return el;
  });
  if (prefill && prefill.schedule !== undefined) { fillNightFields(prefill.schedule); lit.push($('dt-night-url'), $('dt-night-start'), $('dt-night-end'), $('dt-tz')); }
  lightFields(lit);
}
function actOnFinding(code, finding, { dismissed } = {}) {
  if (!finding) return;
  const action = finding.action;
  // A finding that carries no action can still be dismissed, by its own key.
  if (dismissed) { dismissFinding(code, action ? { type: action.type } : { key: finding.key }, dismissed); return; }
  if (!action) return;
  if (action.type === 'REQUEST_REVIEW') { location.href = `/kortex/appeal?code=${encodeURIComponent(code)}`; return; }
  const prefill = action.prefill || {};
  pendingAction = { code, type: action.type, viaToggle: prefill.enabled !== undefined };
  applyPrefill(prefill);
  setStatus('dt-status', `${action.label}: ready below. Apply it, and the next window will say whether it helped.`, '');
}
async function dismissFinding(code, what, dismissed) {
  const { ok, data } = await guestApi(`/links/${encodeURIComponent(code)}/actions`, { method: 'POST', body: { ...what, applied: false, dismissed } });
  if (!ok) { setStatus('dt-status', friendly(data, 'Could not record that.'), 'err'); return; }
  await openDetail(code);
}
/* After a change lands: the pending action, if it was the one just applied, becomes a checkpoint. False only when the record failed. */
async function recordApplied(code, viaToggle) {
  if (!pendingAction || pendingAction.code !== code || pendingAction.viaToggle !== viaToggle) return true;
  const { type } = pendingAction; pendingAction = null;
  const { ok } = await guestApi(`/links/${encodeURIComponent(code)}/actions`, { method: 'POST', body: { type, applied: true } });
  return ok;
}

let detailSeq = 0;
let shareReveal = null;
async function openDetail(code) {
  const seq = ++detailSeq;
  openCode = code; pendingAction = null; renderWorkspace(wsMeta);
  const box = $('detail'); box.hidden = false; box.innerHTML = '<p class="note">Loading scans…</p>';
  const { ok, data } = await guestApi(`/links/${encodeURIComponent(code)}/analytics?tz=${encodeURIComponent(browserTz())}`);
  if (seq !== detailSeq) return; // a newer link was opened meanwhile
  if (!ok) { box.innerHTML = `<p class="alert error show">${escapeHtml(friendly(data, 'Could not load this link.'))}</p>`; return; }
  const link = data.link, a = data.analytics, days = a.window.retentionDays;
  const scans = (a.recentScans || []).slice(0, 5).map(s => `<li><span>${fmtAgo(s.at)} · ${escapeHtml(s.deviceType || '?')}</span><b>${escapeHtml(s.country || '')}</b></li>`).join('') || '<li><span>No scans yet</span></li>';
  const nightWin = nightWindowOf(link.schedule);
  const stateLine = (link.status === 'blocked' ? `Blocked by the safety check. <a href="/kortex/appeal?code=${encodeURIComponent(link.code)}" style="color:var(--gold)">Request a review</a>.` : link.status === 'held' ? 'Under review; it goes live once checked.' : (!link.enabled ? 'Paused: scans see a "link disabled" page.' : 'Live.'))
    + (nightWin ? ` ${escapeHtml(nightSummary(link.schedule))}.` : '') + (limitSummary(link) ? ` ${escapeHtml(limitSummary(link))}` : '')
    + ` <b>${data.lifetime.clicks}</b> scans lifetime, last ${fmtAgo(data.lifetime.lastClickedAt)}; scan detail covers the last ${days} days.`;
  const points = (a.points || []).map(p => ptOf(p, false));
  const lostPoints = ((a.outcomes && a.outcomes.points) || []).map(ptOfLost);
  const variation = variationOf(link);
  const placement = placementSelection(link);
  const reveal = shareReveal && shareReveal.code === code ? shareReveal : null; shareReveal = null;
  const shareLine = link.shared ? `Shared, read-only, ${link.shareExpiresAt ? `until ${fmtDate(link.shareExpiresAt)}` : 'with no end date'}. The address was shown once; a new one replaces it.` : '';
  box.innerHTML = `
    <div>
      <p class="note">${escapeHtml(variation.blurb)}</p>
      <div id="dt-actions"></div>
      ${answersHtml(data.answers)}
      ${viewsHtml('dt')}
      <div class="mini-list">
        <div><h4>Recent scans</h4><ul>${scans}</ul></div>
        <div><h4>Status</h4><p class="note">${stateLine}</p></div>
      </div>
    </div>
    <div class="detail-side">
      ${link.status === 'held' || link.status === 'blocked' ? '<p class="note">The QR image is available once the link is live.</p>' : `<div class="qr-frame"><img alt="QR code" src="${escapeHtml(qrSrc(link.qrUrl))}"></div>`}
      <div class="short-line"><span class="short-url">${escapeHtml(stripScheme(link.shortUrl))}</span><button type="button" class="action-link quiet" id="dt-copy">Copy</button></div>
      <form id="dt-form">
        <div class="field"><label class="field-label" for="dt-title">Name</label><input class="field-input" id="dt-title" maxlength="120" value="${escapeHtml(link.title || '')}"></div>
        <div class="field"><label class="field-label" for="dt-url">Points to</label><input class="field-input" id="dt-url" type="url" value="${escapeHtml((link.destinations && link.destinations.web) || '')}"></div>
        <div class="field-row">
          <div class="field"><label class="field-label" for="dt-ios">iPhone destination</label><input class="field-input" id="dt-ios" type="url" placeholder="same as above" value="${escapeHtml((link.destinations && link.destinations.ios) || '')}"></div>
          <div class="field"><label class="field-label" for="dt-android">Android destination</label><input class="field-input" id="dt-android" type="url" placeholder="same as above" value="${escapeHtml((link.destinations && link.destinations.android) || '')}"></div>
        </div>
        <div class="field">
          <label class="check"><input type="checkbox" id="dt-ask-on"${link.ask ? ' checked' : ''}> Ask one question when they scan</label>
          <div id="dt-ask-fields"${link.ask ? '' : ' hidden'}>
            <div class="field"><label class="field-label" for="dt-ask-q">The question</label><input class="field-input" id="dt-ask-q" maxlength="120" value="${escapeHtml(link.ask ? link.ask.question : 'Are you coming?')}"></div>
            <div class="field-row">
              <div class="field"><label class="field-label" for="dt-ask-o1">Answer one</label><input class="field-input" id="dt-ask-o1" maxlength="24" value="${escapeHtml(link.ask && link.ask.options[0] ? link.ask.options[0].label : 'Yes')}"></div>
              <div class="field"><label class="field-label" for="dt-ask-o2">Answer two</label><input class="field-input" id="dt-ask-o2" maxlength="24" value="${escapeHtml(link.ask && link.ask.options[1] ? link.ask.options[1].label : 'Maybe')}"></div>
            </div>
            <div class="field"><label class="field-label" for="dt-ask-o3">Answer three (optional)</label><input class="field-input" id="dt-ask-o3" maxlength="24" value="${escapeHtml(link.ask ? (link.ask.options[2] ? link.ask.options[2].label : '') : 'No')}"></div>
            <label class="check"><input type="checkbox" id="dt-ask-guests"${!link.ask || link.ask.guests !== false ? ' checked' : ''}> Also ask how many they are bringing</label>
          </div>
        </div>
        <div class="field"><label class="field-label" for="dt-night-url">At night, go to</label><input class="field-input" id="dt-night-url" type="url" placeholder="leave empty for none" value="${escapeHtml(nightWin ? nightWin.url : '')}"></div>
        <div class="field-row">
          <div class="field"><label class="field-label" for="dt-night-start">Night starts</label><input class="field-input" id="dt-night-start" type="time" value="${escapeHtml(nightWin ? nightWin.start : '18:00')}"></div>
          <div class="field"><label class="field-label" for="dt-night-end">Night ends</label><input class="field-input" id="dt-night-end" type="time" value="${escapeHtml(nightWin ? nightWin.end : '06:00')}"></div>
        </div>
        <div class="field"><label class="field-label" for="dt-tz">Time zone</label><input class="field-input" id="dt-tz" spellcheck="false" value="${escapeHtml((link.schedule && link.schedule.timezone) || browserTz())}"></div>
        <div class="field-row">
          <div class="field"><label class="field-label" for="dt-max">Stop after (scans)</label><input class="field-input" id="dt-max" type="number" min="1" step="1" inputmode="numeric" placeholder="no limit" value="${link.limits && link.limits.maxClicks ? link.limits.maxClicks : ''}"></div>
          <div class="field"><label class="field-label" for="dt-expires">Ends on (end of day, your time)</label><input class="field-input" id="dt-expires" type="date" value="${escapeHtml(dateInputValue(link.expiresAt))}"></div>
        </div>
        <div class="field"><label class="field-label" for="dt-fallback">After the limit, send people to</label><input class="field-input" id="dt-fallback" type="url" placeholder="leave empty for a plain page" value="${escapeHtml((link.limits && link.limits.fallbackUrl) || '')}"></div>
        <div class="field-row">
          <div class="field"><label class="field-label" for="dt-utm-source">Tag: source</label><input class="field-input" id="dt-utm-source" maxlength="100" placeholder="poster" value="${escapeHtml((link.utm && link.utm.utm_source) || '')}"></div>
          <div class="field"><label class="field-label" for="dt-utm-medium">Tag: medium</label><input class="field-input" id="dt-utm-medium" maxlength="100" placeholder="qr" value="${escapeHtml((link.utm && link.utm.utm_medium) || '')}"></div>
        </div>
        <div class="field"><label class="field-label" for="dt-utm-campaign">Tag: campaign</label><input class="field-input" id="dt-utm-campaign" maxlength="100" placeholder="spring-fest" value="${escapeHtml((link.utm && link.utm.utm_campaign) || '')}"></div>
        <div class="field-row">
          <div class="field"><label class="field-label" for="dt-placement">Where the code lives</label><select class="field-select" id="dt-placement">${placementOptions(placement.key)}</select></div>
          <div class="field" id="dt-placement-label-field" hidden><label class="field-label" for="dt-placement-label">Call it</label><input class="field-input" id="dt-placement-label" maxlength="40" placeholder="lobby easel" value="${escapeHtml(placement.label)}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label class="field-label" for="dt-print-cost">Print cost</label><input class="field-input" id="dt-print-cost" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" value="${link.economics && link.economics.printCost != null ? link.economics.printCost : ''}"></div>
          <div class="field"><label class="field-label" for="dt-value">Value of one useful visit</label><input class="field-input" id="dt-value" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" value="${link.economics && link.economics.valuePerVisit != null ? link.economics.valuePerVisit : ''}"></div>
        </div>
        <div class="field"><label class="field-label" for="dt-currency">Currency</label><input class="field-input" id="dt-currency" maxlength="3" spellcheck="false" placeholder="USD" value="${escapeHtml((link.economics && link.economics.currency) || '')}"></div>
        <div class="field-row">
          <div class="field"><label class="field-label" for="dt-camp-start">Campaign starts</label><input class="field-input" id="dt-camp-start" type="date" value="${escapeHtml(dateInputValue(link.campaignWindow && link.campaignWindow.startAt))}"></div>
          <div class="field"><label class="field-label" for="dt-camp-end">Campaign ends</label><input class="field-input" id="dt-camp-end" type="date" value="${escapeHtml(dateInputValue(link.campaignWindow && link.campaignWindow.endAt))}"></div>
        </div>
        <button type="submit" class="btn-submit">Save</button>
        <div class="actions" style="margin-top:8px">
          <button type="button" class="action-link quiet" id="dt-toggle">${link.enabled ? 'Pause' : 'Resume'}</button>
          <span class="action-dot" aria-hidden="true">&middot;</span>
          <button type="button" class="action-link quiet" id="dt-delete">Delete</button>
          <span class="action-dot" aria-hidden="true">&middot;</span>
          <button type="button" class="action-link quiet" id="dt-csv">Download CSV</button>
          <span class="action-dot" aria-hidden="true">&middot;</span>
          <button type="button" class="action-link quiet" id="dt-share">${link.shared ? 'Stop sharing' : 'Share report'}</button>
          ${link.shared ? '<span class="action-dot" aria-hidden="true">&middot;</span><button type="button" class="action-link quiet" id="dt-share-rotate">New share address</button>' : ''}
        </div>
        ${shareLine ? `<p class="note">${shareLine}</p>` : ''}
        ${reveal ? `<div class="share-box"><div class="short-line"><span class="short-url">${escapeHtml(reveal.shareUrl)}</span><button type="button" class="action-link quiet" id="dt-share-copy">Copy</button></div><p class="note">Shown once. Anyone holding this address can read this one report${reveal.expiresAt ? ` until ${fmtDate(reveal.expiresAt)}` : ''}, nothing else.</p></div>` : ''}
        <p class="status" id="dt-status" hidden></p>
      </form>
    </div>`;
  renderActionCenter($('dt-actions'), a, { onAction: (finding, opts) => actOnFinding(code, finding, opts) });
  mountViews('dt', { points, lostPoints, hasCode: false, uniquePeople: a.unique ? a.unique.distinctVisitors : null, windowRows: link.schedule ? tallyOf(points, 'win').map(r => ({ ...r, value: r.value === '—' ? 'day address' : 'night address' })) : null, skyTitle: 'This link\'s scans, as a star each', mapTitle: 'Where each scan went' });
  bindPlacementLabel('dt');
  $('dt-copy').addEventListener('click', () => copyText(link.shortUrl, $('dt-copy')));
  if (reveal) $('dt-share-copy').addEventListener('click', () => copyText(reveal.shareUrl, $('dt-share-copy')));
  const mintShare = async (suffix) => {
    const { ok: k, data: d } = await guestApi(`/links/${encodeURIComponent(code)}/share${suffix}`, { method: 'POST', body: {} });
    if (!k) { setStatus('dt-status', friendly(d, 'Could not share the report.'), 'err'); return; }
    shareReveal = { code, shareUrl: d.shareUrl, expiresAt: d.expiresAt };
    await openDetail(code);
    setStatus('dt-status', 'Shared. Copy the address now: it is shown once.', 'ok');
  };
  $('dt-share').addEventListener('click', async () => {
    if (!link.shared) { mintShare(''); return; }
    const { ok: k, data: d } = await guestApi(`/links/${encodeURIComponent(code)}/share`, { method: 'DELETE' });
    if (!k) { setStatus('dt-status', friendly(d, 'Could not stop sharing.'), 'err'); return; }
    await openDetail(code);
    setStatus('dt-status', 'Sharing stopped. The public address no longer works.', 'ok');
  });
  if (link.shared) $('dt-share-rotate').addEventListener('click', () => mintShare('/rotate'));
  $('dt-csv').addEventListener('click', () => guestDownload(`/links/${encodeURIComponent(code)}/analytics.csv`, `kortex-${code}-scans.csv`, $('dt-csv')));
  $('dt-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = normaliseUrl($('dt-url').value); if (!url) { setStatus('dt-status', 'Enter a full web address.', 'err'); return; }
    const nightRaw = $('dt-night-url').value.trim();
    let schedule = null;
    if (nightRaw) {
      const nightUrl = normaliseUrl(nightRaw);
      if (!nightUrl) { setStatus('dt-status', 'Enter a full web address for the night destination.', 'err'); return; }
      schedule = { timezone: $('dt-tz').value.trim() || browserTz(), windows: [{ label: 'night', start: $('dt-night-start').value || '18:00', end: $('dt-night-end').value || '06:00', url: nightUrl }] };
    }
    const maxRaw = $('dt-max').value.trim();
    if (maxRaw && !/^\d+$/.test(maxRaw)) { setStatus('dt-status', 'The scan limit must be a whole number.', 'err'); return; }
    const fallbackRaw = $('dt-fallback').value.trim();
    const fallbackUrl = fallbackRaw ? normaliseUrl(fallbackRaw) : null;
    if (fallbackRaw && !fallbackUrl) { setStatus('dt-status', 'Enter a full web address for the fallback, or leave it empty.', 'err'); return; }
    const expiresAt = $('dt-expires').value ? expiryFromDateInput($('dt-expires').value) : null;
    if ($('dt-expires').value && !expiresAt) { setStatus('dt-status', 'That end date is not valid.', 'err'); return; }
    const limits = (maxRaw || fallbackUrl) ? { maxClicks: maxRaw ? Number(maxRaw) : undefined, fallbackUrl: fallbackUrl || undefined } : null;
    const utm = utmFromFields('dt');
    const placementIn = placementFromFields('dt'), economics = economicsFromFields('dt', $('dt-currency').value.trim()), campaignWindow = campaignWindowFromFields('dt');
    const measureProblem = placementIn.error || economics.error || campaignWindow.error;
    if (measureProblem) { setStatus('dt-status', measureProblem, 'err'); return; }
    const askIn = askFromFields('dt');
    if (askIn.error) { setStatus('dt-status', askIn.error, 'err'); return; }
    const iosRaw = $('dt-ios').value.trim(), androidRaw = $('dt-android').value.trim();
    const iosUrl = iosRaw ? normaliseUrl(iosRaw) : '', androidUrl = androidRaw ? normaliseUrl(androidRaw) : '';
    if ((iosRaw && !iosUrl) || (androidRaw && !androidUrl)) { setStatus('dt-status', 'Enter full web addresses for the iPhone and Android destinations, or leave them empty.', 'err'); return; }
    const { ok: k, data: d } = await guestApi(`/links/${encodeURIComponent(code)}`, { method: 'PATCH', body: { destination: url, iosDestination: iosUrl, androidDestination: androidUrl, title: $('dt-title').value.trim(), placement: placementIn.value, economics: economics.value, campaignWindow: campaignWindow.value, ask: askIn.value, schedule, limits, expiresAt, utm } });
    if (!k) { setStatus('dt-status', friendly(d, 'Could not save.') + (d.reasons ? ' ' + d.reasons.map(r => r.detail).join(' ') : ''), 'err'); return; }
    const noted = await recordApplied(code, false);
    await openWorkspaceFromSession(); await openDetail(code);
    setStatus('dt-status', noted ? 'Saved. Every scan now goes to the new address.' : 'Saved, but the change could not be recorded as a checkpoint.', noted ? 'ok' : 'err');
  });
  $('dt-ask-on').addEventListener('change', () => { $('dt-ask-fields').hidden = !$('dt-ask-on').checked; });
  $('dt-toggle').addEventListener('click', async () => {
    const { ok: k, data: d } = await guestApi(`/links/${encodeURIComponent(code)}`, { method: 'PATCH', body: { enabled: !link.enabled } });
    if (!k) { setStatus('dt-status', friendly(d, 'Could not update.'), 'err'); return; }
    const noted = await recordApplied(code, true);
    await openWorkspaceFromSession(); await openDetail(code);
    if (!noted) setStatus('dt-status', 'Changed, but it could not be recorded as a checkpoint.', 'err');
  });
  $('dt-delete').addEventListener('click', async () => {
    if (!confirm('Delete this link? Anything printed with this QR will stop working. This cannot be undone.')) return;
    const { ok: k, data: d } = await guestApi(`/links/${encodeURIComponent(code)}`, { method: 'DELETE' });
    if (!k) { setStatus('dt-status', friendly(d, 'Could not delete.'), 'err'); return; }
    openCode = null; $('detail').hidden = true; await openWorkspaceFromSession();
  });
}

$('ws-add').addEventListener('click', () => { setMode('dynamic'); resetMaker(); $('make').scrollIntoView({ behavior: 'smooth' }); });
$('ws-forget').addEventListener('click', () => { clearGuestSession(); forgetCode(); openCode = null; demoFocus = null; $('detail').hidden = true; renderWorkspace(null); });
/* A card's underlined verb hands the visitor its demo code: prefilled, one press of Open away. */
document.querySelectorAll('[data-demo-code]').forEach(a => a.addEventListener('click', (e) => {
  e.preventDefault();
  clearGuestSession(); demoFocus = null; openCode = null; $('detail').hidden = true; renderWorkspace(null);
  $('mg-code').value = a.dataset.demoCode; setAlert('mg-alert');
  location.hash = '#manage';
  setTimeout(() => { $('mg-submit').focus(); $('mg-submit').classList.add('prefill-hl'); setTimeout(() => $('mg-submit').classList.remove('prefill-hl'), 3600); }, 500);
}));
$('ws-email').addEventListener('click', () => { $('ws-email-form').hidden = !$('ws-email-form').hidden; if (!$('ws-email-form').hidden) $('ws-email-input').focus(); });
$('ws-email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const address = $('ws-email-input').value.trim(); if (!address) return;
  const ebtn = e.submitter || $('ws-email-form').querySelector('button[type="submit"]'); if (ebtn) ebtn.disabled = true;
  const { ok, data } = await guestApi('/email', { method: 'POST', body: { email: address } });
  if (ebtn) ebtn.disabled = false;
  if (!ok) { setStatus('ws-email-status', friendly(data, 'Could not send.'), 'err'); return; }
  saveGuestSession(data.session, data.workspace); wsMeta = data.workspace; rememberCode(data.accessCode, data.workspace && data.workspace.id); renderWorkspace(wsMeta);
  showWsCode(data.accessCode, 'Your new access code', 'The previous code no longer works. Copy this one or save the key card now.');
  $('ws-email-form').hidden = true;
  setStatus('ws-email-status', `New code ${data.accessCode} ${data.emailDelivery === 'sent' ? 'sent to' : 'will be emailed to'} ${address}. Your previous code no longer works.`, 'ok');
});
function showWsCode(code, label, note, scroll = true) {
  $('ws-code-card').hidden = false; $('ws-code').textContent = code; $('ws-code-label').textContent = label; $('ws-code-note').textContent = note;
  if (scroll) $('ws-code-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
$('ws-copy-code').addEventListener('click', () => copyText($('ws-code').textContent, $('ws-copy-code')));
$('ws-export').addEventListener('click', () => guestDownload('/workspace/export.csv', 'kortex-links.csv', $('ws-export')));
$('ws-keycard').addEventListener('click', () => keyCard($('ws-code').textContent, null, wsMeta));
$('ws-rotate').addEventListener('click', async () => {
  if (!confirm('Issue a new access code? The current one stops working the moment the new one appears, and the new one is shown once.')) return;
  if ($('ws-rotate').disabled) return; $('ws-rotate').disabled = true;
  const { ok, data } = await guestApi('/rotate', { method: 'POST' });
  $('ws-rotate').disabled = false;
  if (!ok) { setStatus('ws-email-status', friendly(data, 'Could not issue a new code.'), 'err'); return; }
  saveGuestSession(data.session, data.workspace || wsMeta); rememberCode(data.accessCode, (data.workspace || wsMeta || {}).id);
  showWsCode(data.accessCode, 'Your new access code', 'The previous code no longer works. Copy this one or save the key card now.');
});
/* ── REQUEST A TEAM WORKSPACE (lead capture; set up by hand) ── */
document.querySelectorAll('[data-request]').forEach(b => b.addEventListener('click', () => {
  $('rq-plan').value = b.dataset.request;
  location.hash = '#connect'; setTimeout(() => $('rq-name').focus(), 400);
}));
$('request-form').addEventListener('submit', async function(e) {
  e.preventDefault(); setAlert('rq-alert');
  const btn = this.querySelector('button[type="submit"]');
  const name = $('rq-name').value.trim(); const email = $('rq-email').value.trim(); const org = $('rq-org').value.trim();
  if (!name || !email || !org) { setAlert('rq-alert', 'error', 'Name, email and organisation are needed.'); return; }
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const res = await fetch(`${CONFIG.API_BASE}/kortex/tenants/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, organization: org, useCase: `${$('rq-plan').value} plan — ${$('rq-use-case').value}` })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'Something went wrong.');
    $('rq-ok-email').textContent = email; $('rq-ok').classList.add('show');
    btn.textContent = 'Request sent';
  } catch (err) {
    setAlert('rq-alert', 'error', err.message || 'Something went wrong. Please try again.');
    btn.disabled = false; btn.textContent = 'Request access';
  }
});
/* The five views, the action center, the work queue, the report framing and the hover tips live in /js/kortex-views.js (shared with the samples page and the admin). */
const { ptOf, ptOfLost, tallyOf, viewsHtml, mountViews, variationOf, renderInsights, renderActionCenter, renderWorkspaceQueue } = window.KortexViews;
if (window.KortexViews.setPlain) window.KortexViews.setPlain(true);   // the free dashboard speaks plainly

let overviewKey = null;
const WORKSPACE_INSIGHT_KEYS = ['placementPerformance', 'safetyImpact', 'utmHealth', 'anomalies'];
async function loadOverview(ws) {
  // One fetch per state of the workspace: re-rendering the list must not re-run 25 analytics reads.
  const key = `${ws.id || ''}:${wsLinks.map(l => `${l.code}:${l.clickCount || 0}:${l.enabled}:${l.status}`).join('|')}`;
  if (key === overviewKey) { $('ws-overview').hidden = false; return; }
  overviewKey = key;
  const box = $('ws-overview'); box.hidden = false; $('ov-queue').innerHTML = ''; $('ov-views-host').innerHTML = '<p class="note">Reading the last seven days…</p>';
  const { ok, data } = await guestApi(`/workspace/analytics?tz=${encodeURIComponent(browserTz())}`);
  if (!ok) { $('ov-views-host').innerHTML = `<p class="note">${escapeHtml(friendly(data, 'Could not load the overview.'))}</p>`; return; }
  const points = (data.points || []).map(p => ptOf(p, true));
  const observed = data.links.reduce((s, l) => s + l.observed, 0);
  $('ov-note').textContent = `${data.links.length} links · ${observed} scans in ${data.window.days} days · hours shown in ${browserTz()}`;
  renderWorkspaceQueue($('ov-queue'), data, { onOpen: async (code, finding) => { await openDetail(code); if (finding && finding.action) actOnFinding(code, finding); else $('detail').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
  $('ov-views-host').innerHTML = '<div id="ov-insights"></div>' + viewsHtml('ov');
  mountViews('ov', { points, lostPoints: [], hasCode: true, linkRows: data.links, uniquePeople: data.uniquePeople, skyTitle: 'Every scan in the workspace, as a star', mapTitle: 'Where the workspace\'s scans went' });
  renderInsights($('ov-insights'), data.insights, { keys: WORKSPACE_INSIGHT_KEYS, compact: true });
}

setMode('dynamic');
loadCaps();
forgetSampleSession();
if (guestSession()) { openWorkspaceFromSession(); }
if (location.hash === '#manage') setTimeout(() => $('mg-code').focus(), 600);
