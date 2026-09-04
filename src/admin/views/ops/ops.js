/**
 * Operate — everything that needs a human, on one screen (super-admin).
 *
 * Queues:    held / blocked links   GET  /kortex/review?allTenants=true   → approve | block
 *            appeals                GET  /kortex/appeals                  → resolve (+ approve link)
 *            abuse reports          GET  /kortex/reports                  → resolve
 *            support requests       GET  /kortex/support                  → resolve
 * Workspaces: GET /kortex/tenants → kill; restore by id (killed ones drop out of the list)
 * Jobs:       POST /kortex/security/feeds/sync | /kortex/security/rescan | /kortex/digest/trigger
 * Health:     GET /kortex/health, /kortex/guest/capabilities, /kortex/security/alerts
 *
 * SECURITY: every displayed field (link titles, destinations, appeal and report
 * text, emails) is user-submitted. All text goes through escapeHtml; ids reach
 * the DOM only as data attributes read back by one delegated listener.
 */

import { apiFetch } from '../../js/config.js';
import { escapeHtml, showSuccess, showError } from '../../js/utils.js';
import * as router from '../../js/router.js';

const esc = (v) => escapeHtml(v == null ? '' : String(v));
let root = null;
const state = { review: null, appeals: null, reports: null, support: null, tenants: null, alerts: null, health: null, caps: null, errors: {} };

async function call(path, method = 'GET', body) {
  const r = await apiFetch(path, method === 'GET' ? undefined : { method, body: JSON.stringify(body || {}) });
  if (!r) throw new Error('Signed out');
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.success === false) throw new Error(d.error || (r.status === 403 ? 'Super-admin only' : `Request failed (${r.status})`));
  return d;
}

function msOf(x, ...keys) {
  for (const k of keys) {
    const v = x && x[k];
    if (typeof v === 'number') return v;
    if (v && typeof v._seconds === 'number') return v._seconds * 1000;
    if (v && typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) return Date.parse(v);
  }
  return null;
}
function ago(ms) {
  if (!ms) return '';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 172800) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
const host = (u) => { try { return new URL(u).host; } catch (_) { return u || ''; } };

/* ── render ─────────────────────────────────────────────────────────────── */

function card(key, title, sub, body, count) {
  const err = state.errors[key];
  return `<section class="ops-card" data-card="${key}">
    <header class="ops-card-head"><div><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>${count != null ? `<b class="ops-count${count ? ' is-live' : ''}">${count}</b>` : ''}</header>
    ${err ? `<p class="ops-empty ops-err">${esc(err)}</p>` : body}
  </section>`;
}
const empty = (t) => `<p class="ops-empty">${esc(t)}</p>`;

function reviewBody() {
  const list = state.review || [];
  if (!list.length) return empty('Nothing waiting. New destinations are checked on create and held here when unsure.');
  return `<ul class="ops-list">${list.map(l => `<li class="ops-row" data-code="${esc(l.code)}">
    <div class="ops-row-main">
      <div class="ops-row-title"><span class="ops-chip is-${esc(l.status)}">${esc(l.status)}</span> <b>${esc(l.title || l.code)}</b> <span class="mono">${esc(l.code)}</span></div>
      <div class="ops-row-sub">${esc(host((l.destinations && l.destinations.web) || ''))} · ${esc(l.tenantId || 'kaayko-default')}${l.safety && l.safety.reasons && l.safety.reasons.length ? ` · ${esc(l.safety.reasons.map(r => r.detail || r.rule || r).join('; ').slice(0, 140))}` : ''}</div>
    </div>
    <div class="ops-actions">
      <button type="button" class="ops-btn" data-act="open" data-code="${esc(l.code)}">Open</button>
      ${l.status !== 'blocked' ? `<button type="button" class="ops-btn is-danger" data-act="block" data-code="${esc(l.code)}">Block</button>` : ''}
      <button type="button" class="ops-btn is-primary" data-act="approve" data-code="${esc(l.code)}">Approve</button>
    </div></li>`).join('')}</ul>`;
}
function appealsBody() {
  const list = state.appeals || [];
  if (!list.length) return empty('No open appeals.');
  return `<ul class="ops-list">${list.map(a => `<li class="ops-row">
    <div class="ops-row-main">
      <div class="ops-row-title"><b>${esc(a.code || '')}</b> <span class="ops-row-when">${esc(ago(msOf(a, 'createdAtMs', 'createdAt')))}</span></div>
      <div class="ops-row-sub">${esc((a.message || a.reason || '').slice(0, 240))}${a.email ? ` · ${esc(a.email)}` : ''}</div>
    </div>
    <div class="ops-actions">
      ${a.code ? `<button type="button" class="ops-btn" data-act="open" data-code="${esc(a.code)}">Open</button><button type="button" class="ops-btn is-primary" data-act="approve-appeal" data-id="${esc(a.id)}" data-code="${esc(a.code)}">Approve link</button>` : ''}
      <button type="button" class="ops-btn" data-act="resolve-appeal" data-id="${esc(a.id)}">Resolve</button>
    </div></li>`).join('')}</ul>`;
}
function reportsBody() {
  const list = state.reports || [];
  if (!list.length) return empty('No open abuse reports.');
  return `<ul class="ops-list">${list.map(r => `<li class="ops-row">
    <div class="ops-row-main">
      <div class="ops-row-title"><b>${esc(r.code || '')}</b> <span class="ops-chip">${esc(r.category || r.reason || 'report')}</span> <span class="ops-row-when">${esc(ago(msOf(r, 'createdAtMs', 'createdAt')))}</span></div>
      <div class="ops-row-sub">${esc((r.details || r.message || r.note || '').slice(0, 240))}${r.reporterCount ? ` · ${esc(r.reporterCount)} reporters` : ''}</div>
    </div>
    <div class="ops-actions">
      ${r.code ? `<button type="button" class="ops-btn" data-act="open" data-code="${esc(r.code)}">Open</button><button type="button" class="ops-btn is-danger" data-act="block" data-code="${esc(r.code)}">Block link</button>` : ''}
      <button type="button" class="ops-btn" data-act="resolve-report" data-id="${esc(r.id)}">Resolve</button>
    </div></li>`).join('')}</ul>`;
}
function supportBody() {
  const list = state.support || [];
  if (!list.length) return empty('No open support requests.');
  return `<ul class="ops-list">${list.map(s => `<li class="ops-row">
    <div class="ops-row-main">
      <div class="ops-row-title"><span class="ops-chip">${esc(s.plan || 'free')}</span> <b>${esc(s.subject || s.topic || 'Request')}</b> <span class="ops-row-when">${esc(ago(msOf(s, 'createdAtMs', 'createdAt')))}${s.targetBy ? ` · reply by ${esc(new Date(msOf(s, 'targetBy') || s.targetBy).toLocaleDateString())}` : ''}</span></div>
      <div class="ops-row-sub">${esc((s.message || '').slice(0, 240))}${s.email ? ` · ${esc(s.email)}` : ''}${s.workspace || s.tenantId ? ` · ${esc(s.workspace || s.tenantId)}` : ''}</div>
    </div>
    <div class="ops-actions"><button type="button" class="ops-btn" data-act="resolve-support" data-id="${esc(s.id)}">Resolve</button></div></li>`).join('')}</ul>`;
}
function tenantsBody() {
  const list = (state.tenants || []).filter(t => t.id !== 'kaayko-default');
  return `${list.length ? `<ul class="ops-list ops-list-compact">${list.slice(0, 40).map(t => `<li class="ops-row">
    <div class="ops-row-main"><div class="ops-row-title"><b>${esc(t.name || t.id)}</b> <span class="mono">${esc(t.id)}</span></div><div class="ops-row-sub">${esc(t.domain || '')}${t.pathPrefix ? esc(t.pathPrefix) : ''}</div></div>
    <div class="ops-actions"><button type="button" class="ops-btn is-danger" data-act="kill" data-id="${esc(t.id)}">Switch off</button></div></li>`).join('')}</ul>${list.length > 40 ? `<p class="ops-empty">${list.length - 40} more not shown.</p>` : ''}` : empty('Only the house workspace is listed here. Free workspaces (g_…) are switched off by id below.')}
  <form class="ops-inline" data-form="tenant">
    <input class="form-input" name="id" placeholder="workspace id, e.g. g_ab12cd34" spellcheck="false" required>
    <button type="submit" class="ops-btn is-danger" data-act="kill-id">Switch off</button>
    <button type="button" class="ops-btn is-primary" data-act="restore-id">Restore</button>
  </form>`;
}
function jobsBody() {
  return `<div class="ops-jobs">
    <button type="button" class="ops-btn" data-act="job" data-job="/kortex/security/feeds/sync">Sync threat feeds</button>
    <button type="button" class="ops-btn" data-act="job" data-job="/kortex/security/rescan">Re-scan destinations</button>
    <button type="button" class="ops-btn" data-act="job" data-job="/kortex/digest/trigger">Run weekly digest</button>
  </div><pre class="ops-out" id="ops-job-out" hidden></pre>
  <p class="ops-empty">The sample workspace refreshes itself weekly; a manual reseed uses the sync key from the server shell.</p>`;
}
function healthBody() {
  const h = state.health || {}, c = state.caps || {};
  const flag = (on, label, note) => `<li><i class="ops-dot ${on ? 'is-on' : ''}"></i><b>${esc(label)}</b><span>${esc(note)}</span></li>`;
  const alerts = (state.alerts || []).slice(0, 8);
  return `<ul class="ops-flags">
    ${flag(h.status === 'ok' || h.success !== false, 'API', h.version ? `v${h.version}` : 'answering')}
    ${flag(c.email, 'Email delivery', c.email ? 'recovery and code mail switched on' : 'not configured: recovery works without mail; code emails are queued')}
    ${flag(true, 'Free tier', `${c.linkLimit || '?'} links · ${c.analyticsDays || '?'}-day detail · ${c.lifetimeDays || '?'}-day lifetime · ${c.maxWindows || '?'} windows`)}
    ${flag(true, 'Sessions', `${c.sessionHours || '?'} h access-code sessions`)}
  </ul>
  <h4 class="ops-h4">Recent security alerts</h4>
  ${alerts.length ? `<ul class="ops-list ops-list-compact">${alerts.map(a => `<li class="ops-row"><div class="ops-row-main"><div class="ops-row-title"><span class="ops-chip is-${esc(a.severity || 'info')}">${esc(a.severity || 'info')}</span> <b>${esc(a.type || 'alert')}</b> <span class="ops-row-when">${esc(ago(msOf(a, 'timestampMs', 'timestamp')))}</span></div><div class="ops-row-sub">${esc((a.code ? `${a.code} · ` : '') + (a.detail || a.reason || a.message || ''))}</div></div></li>`).join('')}</ul>` : empty('No alerts recorded.')}`;
}

function render() {
  if (!root) return;
  const open = (state.review || []).length + (state.appeals || []).length + (state.reports || []).length + (state.support || []).length;
  const badge = document.getElementById('ops-badge');
  if (badge) { badge.textContent = String(open); badge.hidden = !open; }
  root.innerHTML = `
    <header class="view-header">
      <div><h1>Operate</h1><p class="view-subtitle">Everything that needs a human, on one screen. Queues first; then workspaces, jobs and health. ${open ? `<b>${open} open</b>.` : 'Nothing open.'}</p></div>
      <button type="button" class="btn btn-secondary" id="ops-refresh">Refresh</button>
    </header>
    <div class="ops-grid">
      ${card('review', 'Links held or blocked', 'Approve puts a link live; block keeps it dark and alerts.', reviewBody(), (state.review || []).length)}
      ${card('appeals', 'Appeals', 'Owners asking for a second look at a held or blocked link.', appealsBody(), (state.appeals || []).length)}
      ${card('reports', 'Abuse reports', 'Three distinct reporters hold a free link automatically.', reportsBody(), (state.reports || []).length)}
      ${card('support', 'Support requests', 'Plan-aware response targets; resolving notes the outcome.', supportBody(), (state.support || []).length)}
      ${card('tenants', 'Workspaces', 'The kill switch stops every link of a workspace within a minute.', tenantsBody())}
      ${card('jobs', 'Jobs', 'The nightly and weekly jobs, run now.', jobsBody())}
      ${card('health', 'Health', 'What is switched on, and what the safety engine flagged lately.', healthBody())}
    </div>`;
}

/* ── data ───────────────────────────────────────────────────────────────── */

async function load() {
  state.errors = {};
  const tasks = {
    review: () => call('/kortex/review?allTenants=true&limit=100').then(d => d.links || []),
    appeals: () => call('/kortex/appeals').then(d => d.appeals || []),
    reports: () => call('/kortex/reports').then(d => d.reports || []),
    support: () => call('/kortex/support').then(d => d.requests || []),
    tenants: () => call('/kortex/tenants').then(d => d.tenants || d.data || []),
    alerts: () => call('/kortex/security/alerts').then(d => d.alerts || []),
    health: () => call('/kortex/health').catch(() => ({ status: 'ok' })),
    caps: () => call('/kortex/guest/capabilities').catch(() => ({}))
  };
  const results = await Promise.allSettled(Object.entries(tasks).map(([k, fn]) => fn().then(v => [k, v])));
  results.forEach((r, i) => {
    const key = Object.keys(tasks)[i];
    if (r.status === 'fulfilled') state[key] = r.value[1];
    else { state[key] = Array.isArray(state[key]) ? [] : state[key]; state.errors[key === 'alerts' || key === 'caps' ? 'health' : key] = r.reason.message; }
  });
  render();
}

/* ── actions ────────────────────────────────────────────────────────────── */

async function act(btn) {
  const a = btn.dataset.act, code = btn.dataset.code, id = btn.dataset.id;
  const ask = (q) => { const v = window.prompt(q); return v === null ? null : v.trim(); };
  try {
    btn.disabled = true;
    if (a === 'open') { router.navigate('link-detail', code); return; }
    if (a === 'approve') { await call(`/kortex/review/${encodeURIComponent(code)}/approve`, 'POST', {}); showSuccess(`${code} is live.`); }
    if (a === 'block') { const reason = ask(`Block ${code}. Reason (shown in the audit log):`); if (reason === null) return; await call(`/kortex/review/${encodeURIComponent(code)}/block`, 'POST', { reason }); showSuccess(`${code} blocked.`); }
    if (a === 'approve-appeal') { await call(`/kortex/review/${encodeURIComponent(code)}/approve`, 'POST', {}); await call(`/kortex/appeals/${encodeURIComponent(id)}/resolve`, 'POST', { resolution: 'Approved after appeal' }); showSuccess(`${code} is live; appeal resolved.`); }
    if (a === 'resolve-appeal') { const note = ask('Resolution note (the owner may be told this):'); if (note === null) return; await call(`/kortex/appeals/${encodeURIComponent(id)}/resolve`, 'POST', { resolution: note }); showSuccess('Appeal resolved.'); }
    if (a === 'resolve-report') { const note = ask('Resolution (kept with the report):'); if (note === null) return; await call(`/kortex/reports/${encodeURIComponent(id)}/resolve`, 'POST', { resolution: note }); showSuccess('Report resolved.'); }
    if (a === 'resolve-support') { const note = ask('Outcome note:'); if (note === null) return; await call(`/kortex/support/${encodeURIComponent(id)}/resolve`, 'POST', { note }); showSuccess('Request resolved.'); }
    if (a === 'kill') { const reason = ask(`Switch off workspace ${id}? Every one of its links stops within a minute. Reason:`); if (reason === null) return; await call(`/kortex/tenants/${encodeURIComponent(id)}/kill`, 'POST', { reason }); showSuccess(`${id} switched off.`); }
    if (a === 'kill-id' || a === 'restore-id') {
      const form = btn.closest('form'); const wid = (form.querySelector('[name="id"]').value || '').trim();
      if (!wid) { showError('Enter a workspace id.'); return; }
      if (a === 'kill-id') { const reason = ask(`Switch off ${wid}? Reason:`); if (reason === null) return; await call(`/kortex/tenants/${encodeURIComponent(wid)}/kill`, 'POST', { reason }); showSuccess(`${wid} switched off.`); }
      else { await call(`/kortex/tenants/${encodeURIComponent(wid)}/restore`, 'POST', {}); showSuccess(`${wid} restored.`); }
    }
    if (a === 'job') {
      const out = document.getElementById('ops-job-out'); out.hidden = false; out.textContent = 'Running…';
      const d = await call(btn.dataset.job, 'POST', {});
      out.textContent = JSON.stringify(d.summary || d.result || { drops: d.drops, topLinks: d.topLinks } || d, null, 2).slice(0, 4000);
      showSuccess('Job finished.'); btn.disabled = false; return;
    }
    await load();
  } catch (e) {
    showError(e.message || 'Action failed');
  } finally { btn.disabled = false; }
}

function onClick(e) {
  const btn = e.target.closest('[data-act]');
  if (btn) { e.preventDefault(); act(btn); return; }
  if (e.target.closest('#ops-refresh')) { e.preventDefault(); load(); }
}
function onSubmit(e) { if (e.target.matches('[data-form="tenant"]')) { e.preventDefault(); const b = e.target.querySelector('[data-act="kill-id"]'); if (b) act(b); } }

export async function init() {
  root = document.getElementById('ops-view');
  if (!root) return;
  root.removeEventListener('click', onClick); root.addEventListener('click', onClick);
  root.removeEventListener('submit', onSubmit); root.addEventListener('submit', onSubmit);
  root.innerHTML = '<header class="view-header"><div><h1>Operate</h1><p class="view-subtitle">Loading the queues…</p></div></header>';
  await load();
}
