/**
 * Kreators View Module
 * Review queue for seller applications, and the list of sellers.
 *
 * Built 26 Oct 2026. The old review console (src/kreator/admin/index.html) was
 * deleted on 3 Oct with the X-Admin-Key backdoor it shipped, which left approval
 * reachable only by curl. These are the same endpoints, behind the admin sign-in:
 *   GET  /kreators/admin/applications?status=…          → { applications, total }
 *   PUT  /kreators/admin/applications/:id/approve {notes} → creates the seller, emails the activation link
 *   PUT  /kreators/admin/applications/:id/reject  {reason, notes}
 *   GET  /kreators/admin/list?status=active|pending_password → { kreators }
 *   POST /kreators/admin/:uid/resend-link                → a new activation link (the old one stops working)
 *   GET  /kreators/admin/listings?status=pending|approved → listings by review state
 *   PUT  /kreators/admin/listings/:id/review {decision, note} → approve (on the store) or send back
 *   GET  /kreators/admin/store-address?name=|handle=      → the shop address and whether it is free
 *   POST /kreators/admin/:uid/store-address {handle}      → give a seller an address (kaay.store/kreator/<h>, kaay.link/<h>)
 *   PUT  /kreators/admin/:uid/qr-limit {limit}            → how many product QR codes (kaay.link/<h>/<piece>) the shop may hold
 *   POST /kreators/admin/:uid/qr-codes                    → make the codes its approved pieces are owed (safe to repeat)
 * Approving names the shop: kaay.store/kreator/<handle> and kaay.link/<handle>,
 * checked free on both and on every shelf before the account is created.
 * Every route is requirePlatformAdmin: a self-serve tenant admin gets 403.
 *
 * SECURITY: everything an applicant typed is untrusted. Text goes through
 * escapeHtml; links are shown only when they are plain http(s); actions use
 * data-attributes and one delegated listener, never onclick strings.
 */

import { apiFetch, CONFIG } from '../../js/config.js';
import { escapeHtml, formatDate, showSuccess, showError } from '../../js/utils.js';

const TABS = [
  { key: 'pending',  label: 'Applications',  load: () => applications('pending') },
  { key: 'listings', label: 'Listings to review', load: () => listings('pending') },
  { key: 'approved', label: 'Approved', load: () => applications('approved') },
  { key: 'rejected', label: 'Rejected', load: () => applications('rejected') },
  { key: 'sellers',  label: 'Sellers',  load: sellers },
  { key: 'live',     label: 'Live listings', load: () => listings('approved') },
  { key: 'ratings',  label: 'Ratings',  load: ratingsTab },
  { key: 'payouts',  label: 'Payouts',  load: payoutsTab },
];

const usd = (cents) => `$${((Number(cents) || 0) / 100).toFixed(2)}`;
const STANDING = { review: ['rejected', 'needs a look'], watch: ['pending', 'slipping'], good: ['approved', 'rated well'], new: ['expired', 'too few to say'] };
const URGENT_LABEL = { no_show: 'Teacher did not come', cancelled: 'Moved or called off without notice', not_arrived: 'Never arrived', damaged: 'Arrived damaged', unsafe: 'Did not feel safe' };

/** Buyers' ratings (27 Oct 2026): who needs a look, and the reports holding a payout. */
async function ratingsTab() {
  const d = await getJson('/kreators/admin/ratings');
  const urgent = (d.urgent || []).map((r) => `
    <article class="kreators-item">
      <header class="kreators-item-head">
        <div><h3>${escapeHtml(r.storeName || r.kreatorId)} · ${escapeHtml(r.productTitle || '')}${r.sessionLabel ? ` · ${escapeHtml(r.sessionLabel)}` : ''}</h3>
          <p>Order ${escapeHtml(r.orderNumber || r.parentOrderId || '')} · ${escapeHtml(r.atMs ? new Date(r.atMs).toLocaleString() : '')} · overall ${escapeHtml(String(r.answers?.overall ?? '—'))}/5</p></div>
        <span class="kreators-status kreators-status-rejected">${escapeHtml((r.flags || []).filter((f) => URGENT_LABEL[f]).map((f) => URGENT_LABEL[f]).join(' · '))}</span>
      </header>
      ${r.note ? `<p class="kreators-desc">“${escapeHtml(r.note)}”</p>` : ''}
      <div class="kreators-actions">${(r.holds || []).length
        ? `<button type="button" class="btn btn-secondary" data-act="release-rating" data-id="${escapeHtml(r.lineId)}" data-name="${escapeHtml((r.holds || []).join(','))}">Resolved — release the payout hold</button><span class="kreators-note">Refund it from Orders if the buyer is owed.</span>`
        : r.urgentPending ? '<span class="kreators-flag">The payout hold has not been placed yet; it is retried every hour.</span>'
        : (r.flags || []).some((f) => URGENT_LABEL[f] && !(r.resolvedFlags || []).includes(f))
          ? `<button type="button" class="btn btn-secondary" data-act="resolve-rating" data-id="${escapeHtml(r.lineId)}">Mark resolved</button><span class="kreators-note">No payout held; this takes it out of their standing.</span>`
          : '<span class="kreators-note">Resolved.</span>'}</div>
    </article>`).join('');
  const people = (d.kreators || []).map((k) => {
    const s = k.summary;
    const [cls, label] = STANDING[k.standing.level] || STANDING.new;
    return `
    <article class="kreators-item">
      <header class="kreators-item-head">
        <div><h3>${escapeHtml(k.storeName || k.kreatorId)}</h3><p>${escapeHtml(k.standing.reason || '')}</p></div>
        <span class="kreators-status kreators-status-${cls}">${escapeHtml(label)}</span>
      </header>
      ${s ? `<dl class="kreators-rows">
        ${row('Overall', escapeHtml(s.average != null ? `${s.average} / 5 from ${s.count} (${s.responses} answered)` : `${s.responses} answered, none scored`))}
        ${row('3 stars or below', escapeHtml(s.lowPct != null ? `${s.lowPct}%` : ''))}
        ${row('Would book again', escapeHtml(s.rebookPct != null ? `${s.rebookPct}%` : ''))}
        ${row('As described', escapeHtml(s.aspects.accuracy != null ? `${s.aspects.accuracy} / 4` : ''))}
        ${row('Clear teaching', escapeHtml(s.aspects.clarity != null ? `${s.aspects.clarity} / 4` : ''))}
        ${row('Organised', escapeHtml(s.aspects.organisation != null ? `${s.aspects.organisation} / 4` : ''))}
        ${row('Quality', escapeHtml(s.aspects.quality != null ? `${s.aspects.quality} / 4` : ''))}
        ${row('Worth the price', escapeHtml(s.aspects.value != null ? `${s.aspects.value} / 4` : ''))}
        ${row('Reports', escapeHtml(Object.entries(s.flags || {}).filter(([f]) => f !== 'low').map(([f, n]) => `${n} ${f.replace(/_/g, ' ')}`).join(', ')))}
        ${row('Left out', escapeHtml([s.insiders && `${s.insiders} who know them`, s.missed && `${s.missed} who missed it`].filter(Boolean).join(', ')))}
      </dl>` : ''}
      ${k.lessonsPaused ? `<div class="kreators-actions"><span class="kreators-flag">New lesson bookings paused after a safety report</span><button type="button" class="btn btn-secondary" data-act="resume-lessons" data-uid="${escapeHtml(k.kreatorId)}">Resume bookings</button></div>`
        : s && s.sessions ? `<div class="kreators-actions"><button type="button" class="btn btn-secondary" data-act="pause-lessons" data-uid="${escapeHtml(k.kreatorId)}">Pause lesson bookings</button><span class="kreators-note">People already booked keep their place; the teacher is emailed.</span></div>` : ''}
    </article>`;
  }).join('');
  return `${urgent ? `<h4 class="kreators-subhead">Reports holding a payout</h4>${urgent}` : ''}<h4 class="kreators-subhead">Kreators by standing</h4>${people || empty('No ratings yet. Buyers are asked after each lesson ends and ten days after a maker ships.')}`;
}

/** Monthly statements (Seller Terms 5–6). Money moves only on Pay. */
async function payoutsTab() {
  const d = await getJson('/kreators/admin/payouts');
  const READY = { ready: 'Stripe ready', verifying: 'Stripe verifying', incomplete: 'Stripe set-up unfinished', action_needed: 'Stripe needs more from them', rejected: 'Stripe REJECTED the account', not_started: 'no Stripe account', unavailable: 'Stripe unreachable' };
  const rows = (d.statements || []).map((s) => `
    <article class="kreators-item">
      <header class="kreators-item-head">
        <div><h3>${escapeHtml(s.storeName)} · ${escapeHtml(usd(s.totalCents))}</h3>
          <p>${escapeHtml(s.period)} · ${escapeHtml(String(s.entries))} item${s.entries === 1 ? '' : 's'} · ${escapeHtml(READY[s.payoutsState] || s.payoutsState)}${s.transferId ? ` · ${escapeHtml(s.transferId)}` : ''}</p></div>
        <span class="kreators-status kreators-status-${s.status === 'paid' ? 'approved' : s.status === 'draft' ? 'pending' : 'expired'}">${escapeHtml(s.status)}</span>
      </header>
      ${s.lastError ? `<p class="kreators-desc">Last try: ${escapeHtml(s.lastError)}</p>` : ''}
      ${s.status === 'draft' || s.status === 'paying'
        ? `<div class="kreators-actions"><button type="button" class="btn btn-primary" data-act="pay" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.storeName)}" data-limit="${escapeHtml(String(s.totalCents))}">${s.transferMade ? 'Finish recording this payout' : `Pay ${escapeHtml(usd(s.totalCents))}…`}</button>
            ${s.transferMade ? '<span class="kreators-note">The transfer was made; pressing this only finishes the records. It never sends money twice.</span>' : s.reportOpen ? '<span class="kreators-flag">Paused: a buyer\'s report about this seller is open (Ratings tab). Pay refuses until it is resolved.</span>' : s.payoutsState === 'ready' ? '' : '<span class="kreators-note">Stripe set-up may be unfinished; Pay checks with Stripe first.</span>'}</div>` : ''}
    </article>`).join('');
  const HOLD = (h) => h.startsWith('rating:') ? `buyer report: ${h.slice(7).replace(/_/g, ' ')}` : h.startsWith('dispute:') ? 'card dispute open'
    : h.startsWith('dispute-review:') ? 'lost chargeback to assign' : h.startsWith('refund-review:') ? 'refund to assign' : h === 'review:own_purchase' ? 'bought by the seller'
    : h === 'session-cancelled' ? 'teacher cancelled; refund not made' : h;
  const held = (d.held || []).map((e) => {
    const assign = (e.holds || []).some((h) => h.startsWith('refund-review:') || h.startsWith('dispute-review:'));
    return `
    <article class="kreators-item">
      <header class="kreators-item-head">
        <div><h3>${escapeHtml(e.storeName)} · ${escapeHtml(usd(e.netCents))}</h3><p>${escapeHtml(e.orderNumber || '')} · ${escapeHtml(e.productTitle)} · ${escapeHtml(e.status)}</p></div>
        <span class="kreators-status kreators-status-pending">${escapeHtml((e.holds || []).map(HOLD).join(' · '))}</span>
      </header>
      <div class="kreators-actions">${assign
        ? `<button type="button" class="btn btn-secondary" data-act="assign" data-id="${escapeHtml(e.id)}" data-name="charge">Charge to maker</button><button type="button" class="btn btn-secondary" data-act="assign" data-id="${escapeHtml(e.id)}" data-name="kaayko">Kaayko bears it</button>`
        : `<button type="button" class="btn btn-secondary" data-act="release-hold" data-id="${escapeHtml(e.id)}">Release the hold</button>`}</div>
    </article>`;
  }).join('');
  return `<div class="kreators-actions" style="margin-bottom:12px"><button type="button" class="btn btn-secondary" data-act="draft-statements">Draft statements now</button>
    <span class="kreators-note">Statements are drafted on the 1st of each month from earnings 37+ days past shipping (or the lesson) with no hold. Nothing is sent until you press Pay.</span></div>
    ${held ? `<h4 class="kreators-subhead">Held — not paid until you decide</h4>${held}` : ''}
    <h4 class="kreators-subhead">Statements</h4>
    ${rows || empty('No statements yet.')}`;
}

const LABELS = {
  years: { under_1: 'under a year', '1_2': '1–2 years', '3_5': '3–5 years', '6_10': '6–10 years', over_10: 'over 10 years' },
  formats: { in_person: 'In person', online: 'Online' },
  audience: { adults: 'Adults (18+)', with_guardian: 'Under-18s with a guardian' },
  insurance: { yes: 'Yes', no: 'No', not_sure: 'Not sure' },
};

/** Up to three links to the applicant's work (`website` on applications before 28 Oct 2026). */
function linkList(urls) {
  return (urls || []).map((u) => safeUrl(u)).filter(Boolean)
    .map((u) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u.replace(/^https?:\/\//, '').slice(0, 60))}</a>`).join('<br>');
}

/** What a teacher told the reviewer (27 Oct 2026): the answers worth reading before approving. */
function teachingRows(t) {
  if (!t) return '';
  const flags = [
    t.audience === 'with_guardian' ? 'teaches under-18s' : '',
    t.insuranceProofNeeded ? 'ask for the insurance certificate' : ''
  ].filter(Boolean);
  return `
      <h4 class="kreators-subhead">Teaching${flags.length ? ` <span class="kreators-flag">${escapeHtml(flags.join(' · '))}</span>` : ''}</h4>
      <dl class="kreators-rows">
        ${row('Teaches', escapeHtml(t.subjects || ''))}
        ${row('Done / taught', escapeHtml(`${label('years', t.practiceYears)} / ${label('years', t.teachingYears)}`))}
        ${row('Where', escapeHtml((t.formats || []).map((f) => label('formats', f)).join(' + ')))}
        ${row('Involves', escapeHtml((t.risks || []).length ? `${t.risks.join(', ')} · ${t.insurance === 'yes' ? 'says they are insured' : 'insurance not confirmed'}` : ''))}
        ${row('For', escapeHtml(label('audience', t.audience)))}
        ${t.audience === 'with_guardian' ? row('Background check', escapeHtml(t.backgroundCheckOk ? 'Agrees if asked' : 'Not agreed')) : ''}
      </dl>`;
}

let current = 'pending';
let listEl = null;

export async function init() {
  const container = document.getElementById('kreators-view');
  if (!container) return;
  current = 'pending';
  container.innerHTML = `
    <header class="view-header">
      <div>
        <h1>Kreators</h1>
        <p class="view-subtitle">Seller applications and the sellers you have approved. Approving creates the seller account (or uses the Kaayko sign-in the applicant already has) and emails them how to open it.</p>
      </div>
      <button type="button" class="btn btn-secondary" id="kreators-refresh">Refresh</button>
    </header>
    <div class="card kreators-card">
      <div class="kreators-tabs" role="tablist">
        ${TABS.map((t) => `<button type="button" class="kreators-tab${t.key === current ? ' active' : ''}" role="tab" data-tab="${t.key}" aria-selected="${t.key === current}">${t.label}</button>`).join('')}
      </div>
      <div class="kreators-list" id="kreators-list"><p class="kreators-empty">Loading…</p></div>
    </div>`;
  listEl = container.querySelector('#kreators-list');
  container.querySelector('#kreators-refresh').addEventListener('click', render);
  container.querySelector('.kreators-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    current = tab.dataset.tab;
    container.querySelectorAll('.kreators-tab').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === current);
      b.setAttribute('aria-selected', String(b.dataset.tab === current));
    });
    render();
  });
  listEl.addEventListener('click', onAction);
  await render();
}

async function getJson(path, init) {
  const res = await apiFetch(path, init);
  if (!res) throw new Error('Signed out');
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const err = new Error(body.message || body.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body.data;
}

async function applications(status) {
  const data = await getJson(`/kreators/admin/applications?status=${status}&limit=100`);
  return (data.applications || []).map(applicationCard).join('') || empty(status === 'pending' ? 'No applications waiting.' : `No ${status} applications.`);
}

async function sellers() {
  const [active, waiting, suspended] = await Promise.all([
    getJson('/kreators/admin/list?status=active&limit=100'),
    getJson('/kreators/admin/list?status=pending_password&limit=100'),
    getJson('/kreators/admin/list?status=suspended&limit=100'),
  ]);
  // A seller with a shop description waiting comes first.
  const all = [...(suspended.kreators || []), ...(waiting.kreators || []), ...(active.kreators || [])]
    .sort((a, b) => Number(!!b.pendingBio) - Number(!!a.pendingBio));
  const rows = all.map(sellerCard).join('');
  return rows || empty('No sellers yet.');
}

async function listings(status) {
  const data = await getJson(`/kreators/admin/listings?status=${status}`);
  return (data.listings || []).map(listingCard).join('') || empty(status === 'pending' ? 'No listings waiting for review.' : 'No live kreator listings.');
}

/** A lesson under review: what buyers are promised, and the private details they are sent. */
function lessonRows(l) {
  const min = Number(l.durationMin) || 0;
  const length = !min ? '' : min % 60 === 0 ? `${min / 60} h` : `${min} min`;
  const LEVEL = { all: 'All levels', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  return `${row('Lesson', escapeHtml([l.format === 'online' ? 'Online' : 'In person', l.area, length, l.timeZone].filter(Boolean).join(' · ')))}
        ${row('Level · who', escapeHtml(`${LEVEL[l.level] || 'All levels'} · ${l.audience === 'with_guardian' ? 'under-18s with a guardian' : 'adults (18+)'}`))}
        ${row('Bring', escapeHtml(l.bring || ''))}
        ${row('Taught in', escapeHtml(l.language && l.language !== 'English' ? l.language : ''))}
        ${row('Sent to buyers', escapeHtml(l.details || ''))}`;
}

/** What the reviewer must weigh about the teacher of a lesson (Terms 6). */
function teacherRows(p) {
  if (!p.lesson || !p.teacher) return '';
  const t = p.teacher;
  const flags = [
    !t.vetted && 'not vetted as a teacher',
    p.lesson.audience === 'with_guardian' && !t.backgroundCheckOk && 'under-18s without a background-check agreement',
    t.insuranceProofNeeded && 'insurance certificate needed before it goes live',
    p.lessonsPaused && 'lessons paused after a safety report'
  ].filter(Boolean);
  return `<h4 class="kreators-subhead">Teacher${flags.length ? ` <span class="kreators-flag">${escapeHtml(flags.join(' · '))}</span>` : ''}</h4>
      <dl class="kreators-rows">
        ${row('Teaches', escapeHtml(t.subjects || ''))}
        ${row('Involves', escapeHtml((t.risks || []).join(', ')))}
      </dl>`;
}

function listingFields(v) {
  const img = (v.imgSrc || []).map(safeUrl).filter(Boolean);
  return `${img.length ? `<div class="kreators-photos">${img.map((u) => `<a href="${escapeHtml(u)}" target="_blank" rel="noopener"><img src="${escapeHtml(u)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
      <p class="kreators-desc"><strong>${escapeHtml(v.title || '')}</strong> — ${escapeHtml(v.description || '')}</p>
      <dl class="kreators-rows">
        ${row('Kind', escapeHtml([v.category, v.productType].filter(Boolean).join(' · ')))}
        ${v.lesson ? lessonRows(v.lesson) : row('Options', escapeHtml((v.availableSizes || []).join(', ')))}
        ${row('Tags', escapeHtml((v.tags || []).join(', ')))}
        ${row('Story', escapeHtml(v.storyCopy || ''))}
      </dl>`;
}

function listingCard(p) {
  const waiting = p.reviewStatus === 'pending' || !!p.pendingEdit;
  // version: what the reviewer is looking at; an edit after this makes the API refuse.
  const ver = `data-version="${escapeHtml(String(p.reviewVersion || 0))}"`;
  const actions = waiting
    ? `<div class="kreators-actions">
         <button type="button" class="btn btn-primary" data-act="list-approve" data-id="${escapeHtml(p.id)}" ${ver}>${p.pendingEdit ? 'Approve the changes' : 'Approve — put on the store'}</button>
         <button type="button" class="btn btn-secondary" data-act="list-reject" data-id="${escapeHtml(p.id)}" ${ver}>${p.pendingEdit ? 'Keep the current version…' : 'Send back…'}</button>
       </div>`
    : `<div class="kreators-actions"><button type="button" class="btn btn-secondary" data-act="list-reject" data-id="${escapeHtml(p.id)}" ${ver}>Take down and send back…</button></div>`;
  const badge = p.sellerSuspended ? ['rejected', 'seller suspended'] : p.pendingEdit ? ['pending', 'live · changes waiting'] : p.reviewStatus === 'approved' ? ['approved', 'live'] : ['pending', 'waiting'];
  return `
    <article class="kreators-item">
      <header class="kreators-item-head">
        <div>
          <h3>${escapeHtml(p.title)} · $${Number(p.actualPrice || 0).toFixed(2)}</h3>
          <p>${escapeHtml(p.storeName || '')} · ${escapeHtml(p.sellerEmail || '')} · ${p.isAvailable ? 'seller has it switched on' : 'seller has it switched off'}</p>
        </div>
        <span class="kreators-status kreators-status-${badge[0]}">${badge[1]}</span>
      </header>
      ${p.pendingEdit
        ? `<div class="kreators-compare">
             <section><h4>On sale now</h4>${listingFields(p)}</section>
             <section><h4>Proposed (changed: ${escapeHtml(p.pendingEdit.changed.join(', '))})</h4>${listingFields(p.pendingEdit)}</section>
           </div>`
        : listingFields(p)}
      ${teacherRows(p)}
      <dl class="kreators-rows">
        ${row('Shop description', escapeHtml(p.storeBio || ''))}
        ${Array.isArray(p.sessions) ? row('Sessions', p.sessions.length ? p.sessions.map((x) => `${escapeHtml(x.label)} · ${x.cancelled ? 'cancelled' : `${x.booked} of ${x.seats} booked`}`).join('<br>') : 'None yet') : ''}
        ${row('Submitted', escapeHtml(p.submittedForReviewAt ? formatDate(p.submittedForReviewAt) : ''))}
        ${row('Last note', escapeHtml(p.reviewNote || ''))}
        ${row('Earlier notes', (p.reviewHistory || []).filter((h) => h && h.note).slice(-3).reverse()
          .map((h) => `${escapeHtml(String(h.at || '').slice(0, 10))} · ${escapeHtml(h.outcome || '')}: ${escapeHtml(h.note)}`).join('<br>'))}
      </dl>
      ${actions}
    </article>`;
}

async function render() {
  if (!listEl) return;
  listEl.innerHTML = '<p class="kreators-empty">Loading…</p>';
  try {
    listEl.innerHTML = await TABS.find((t) => t.key === current).load();
  } catch (e) {
    listEl.innerHTML = empty(e.status === 403 ? 'Kreators needs a platform administrator.' : `Could not load: ${escapeHtml(e.message)}`);
  }
}

const empty = (text) => `<p class="kreators-empty">${escapeHtml(text)}</p>`;
const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : null);
const label = (field, v) => LABELS[field]?.[v] || v || '—';

function row(name, value) {
  return value ? `<div class="kreators-row"><dt>${escapeHtml(name)}</dt><dd>${value}</dd></div>` : '';
}

function applicationCard(a) {
  const expires = a.expiresAt ? new Date(a.expiresAt) : null;
  const expired = expires && expires < new Date() && a.status === 'pending';
  // Past its 30 days it can still be answered: the applicant should not go unanswered because
  // the review was late. Resending an activation email lives on the Sellers tab, which knows
  // whether the seller has activated (here it offered a resend that failed for active sellers).
  const actions = a.status === 'pending'
    ? `<div class="kreators-actions">
         <button type="button" class="btn btn-primary" data-act="approve" data-id="${escapeHtml(a.id)}" data-name="${escapeHtml(a.businessName || a.email)}">Approve…</button>
         <button type="button" class="btn btn-secondary" data-act="reject" data-id="${escapeHtml(a.id)}">Reject</button>
         ${expired ? '<span class="kreators-note">Past 30 days: they may have applied again (approving says so if they have).</span>' : ''}
       </div>`
    : '';
  return `
    <article class="kreators-item">
      <header class="kreators-item-head">
        <div>
          <h3>${escapeHtml(a.businessName || '(no business name)')}</h3>
          <p>${escapeHtml(a.displayName || [a.firstName, a.lastName].filter(Boolean).join(' '))} · <a href="mailto:${escapeHtml(a.email)}">${escapeHtml(a.email)}</a></p>
        </div>
        <span class="kreators-status kreators-status-${escapeHtml(expired ? 'expired' : a.status)}">${escapeHtml(expired ? 'expired' : a.status)}</span>
      </header>
      <p class="kreators-desc">${escapeHtml(a.productDescription || '')}</p>
      <dl class="kreators-rows">
        ${row('Sells', escapeHtml((a.productCategories || []).join(', ')))}
        ${row('Ships', escapeHtml(a.agreedToShip ? 'Agreed: within 5 business days, with tracking' : ''))}
        ${row('Location', escapeHtml(a.location || ''))}
        ${row('Terms', escapeHtml(a.termsVersion ? `Kreator Seller Terms ${a.termsVersion}` : ''))}
        ${row('Phone', escapeHtml(a.phone || ''))}
        ${row('Work', linkList(a.links || [a.website]))}
        ${row('Submitted', escapeHtml(a.submittedAt ? formatDate(a.submittedAt) : ''))}
        ${a.status === 'pending' ? row(expired ? 'Expired' : 'Expires', escapeHtml(expires ? formatDate(expires.toISOString()) : '')) : ''}
        ${row('Reason', escapeHtml(a.rejectionReason || ''))}
      </dl>
      ${teachingRows(a.teaching)}
      ${actions}
    </article>`;
}

const qrFor = (handle) => (CONFIG.ENVIRONMENT === 'production' || !CONFIG.API_BASE.includes('127.0.0.1')
  ? `https://kaay.link/qr/${encodeURIComponent(handle)}.png`
  : `${CONFIG.API_BASE}/qr/${encodeURIComponent(handle)}.png`);

function shopLines(k) {
  if (k.storeHandle && !k.storeLinkReady) {
    return `<p class="kreators-shopless">Shop address kaay.store/kreator/${escapeHtml(k.storeHandle)} is reserved, but its kaay.link link is not made yet.</p>`;
  }
  if (!k.storeHandle) {
    return `<p class="kreators-shopless">No shop address yet (approved before addresses existed).</p>`;
  }
  return `<div class="kreators-shop">
      <img src="${escapeHtml(qrFor(k.storeHandle))}" alt="QR for kaay.link/${escapeHtml(k.storeHandle)}" width="72" height="72" loading="lazy">
      <div>
        <a href="https://kaay.store/kreator/${encodeURIComponent(k.storeHandle)}" target="_blank" rel="noopener">kaay.store/kreator/${escapeHtml(k.storeHandle)}</a>
        <a href="https://kaay.link/${encodeURIComponent(k.storeHandle)}" target="_blank" rel="noopener">kaay.link/${escapeHtml(k.storeHandle)}</a>
      </div>
    </div>`;
}

function sellerCard(k) {
  const waiting = k.status === 'pending_password';
  const suspended = k.status === 'suspended';
  return `
    <article class="kreators-item">
      <header class="kreators-item-head">
        <div>
          <h3>${escapeHtml(k.businessName || k.displayName || '(no name)')}</h3>
          <p>${escapeHtml([k.firstName, k.lastName].filter(Boolean).join(' '))} · <a href="mailto:${escapeHtml(k.email)}">${escapeHtml(k.email)}</a></p>
        </div>
        <span class="kreators-status kreators-status-${suspended ? 'rejected' : waiting ? 'pending' : 'approved'}">${suspended ? 'suspended' : waiting ? 'not activated' : 'active'}</span>
      </header>
      ${shopLines(k)}
      ${suspended ? `<p class="kreators-shopless">Suspended: ${escapeHtml(k.suspendReason || '')}. Every listing is off sale and the shop page reads closed.</p>` : ''}
      ${k.pendingBio ? `<div class="kreators-bio"><p><strong>New shop description waiting:</strong> ${escapeHtml(k.pendingBio)}</p>
        <p class="kreators-shopless">Shoppers still see: ${escapeHtml(k.bio || '(none)')}</p>
        <div class="kreators-actions"><button type="button" class="btn btn-primary" data-act="bio-approve" data-uid="${escapeHtml(k.uid)}">Publish it</button><button type="button" class="btn btn-secondary" data-act="bio-reject" data-uid="${escapeHtml(k.uid)}">Return it…</button></div></div>` : ''}
      <dl class="kreators-rows">
        ${row('Listings', escapeHtml(String(k.stats?.totalProducts ?? 0)))}
        ${row('Product QR codes', escapeHtml(`${k.qrUsed ?? 0} of ${k.qrLimit ?? 25}`))}
        ${row('Location', escapeHtml(k.location || ''))}
        ${row('Approved', escapeHtml(k.createdAt ? formatDate(k.createdAt) : ''))}
      </dl>
      <div class="kreators-actions">
        ${waiting ? `<button type="button" class="btn btn-secondary" data-act="resend" data-uid="${escapeHtml(k.uid)}">Resend activation email</button>` : ''}
        ${!k.storeHandle
          ? `<button type="button" class="btn btn-secondary" data-act="address" data-uid="${escapeHtml(k.uid)}" data-name="${escapeHtml(k.businessName || '')}">Give shop address…</button>`
          : k.storeLinkReady ? '' : `<button type="button" class="btn btn-primary" data-act="finish-link" data-uid="${escapeHtml(k.uid)}" data-handle="${escapeHtml(k.storeHandle)}">Finish kaay.link link</button>`}
        ${k.storeLinkReady ? `<button type="button" class="btn btn-secondary" data-act="qr-make" data-uid="${escapeHtml(k.uid)}">Make missing QR codes</button>` : ''}
        <button type="button" class="btn btn-secondary" data-act="qr-limit" data-uid="${escapeHtml(k.uid)}" data-name="${escapeHtml(k.businessName || '')}" data-limit="${escapeHtml(String(k.qrLimit ?? 25))}">Change QR limit…</button>
        <button type="button" class="btn btn-secondary" data-act="vet-teacher" data-uid="${escapeHtml(k.uid)}">${k.teaching ? 'Update teacher vetting…' : 'Vet as a teacher…'}</button>
        ${suspended
          ? `<button type="button" class="btn btn-secondary" data-act="reinstate" data-uid="${escapeHtml(k.uid)}">Reinstate</button>`
          : `<button type="button" class="btn btn-secondary" data-act="suspend" data-uid="${escapeHtml(k.uid)}" data-name="${escapeHtml(k.businessName || '')}">Suspend…</button>`}
      </div>
    </article>`;
}

/**
 * Ask for the shop's address, starting from the server's suggestion, until it is
 * free on kaay.store, kaay.link and the shelves, or the admin cancels.
 */
async function chooseHandle(name) {
  let suggestion = (await getJson(`/kreators/admin/store-address?name=${encodeURIComponent(name || '')}`)).handle;
  for (;;) {
    const typed = prompt('Shop address — kaay.store/kreator/… and kaay.link/…\n(lower-case letters, numbers and hyphens)', suggestion || '');
    if (typed === null) return null;
    const check = await getJson(`/kreators/admin/store-address?handle=${encodeURIComponent(typed.trim().toLowerCase())}`);
    if (check.ok) return check.handle;
    alert(check.message);
    suggestion = typed;
  }
}

async function onAction(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const { act, id, uid, name, handle: knownHandle, version, limit: currentLimit } = btn.dataset;
  const mailNote = (d, who) => (d && d.emailQueued ? `${who} has been emailed.` : `The email to ${who.toLowerCase()} did NOT queue.`);
  try {
    if (act === 'approve') {
      const handle = await chooseHandle(name);
      if (!handle) return;
      if (!confirm(`Approve ${name}?\n\nShop: kaay.store/kreator/${handle}\nShort link and QR: kaay.link/${handle}\n\nThis creates their seller account and emails them how to open it (an activation link, or, if the email already signs in to Kaayko, to sign in as usual). The shop address cannot be changed later.`)) return;
      btn.disabled = true;
      const data = await getJson(`/kreators/admin/applications/${encodeURIComponent(id)}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle }) });
      const parts = [`Approved: kaay.store/kreator/${data.handle || handle}.`];
      parts.push(!data.emailQueued ? 'The activation email did NOT queue — use Resend on the Sellers tab.'
        : data.linkedAccount ? `${data.kreatorEmail} already signs in to Kaayko, so it is now their seller account too: they were emailed to sign in at the seller login as they already do (no new password).`
          : `Activation link emailed to ${data.kreatorEmail}.`);
      if (data.handleError) parts.push(`Shop address not finished (${data.handleError}) — use Give shop address on the Sellers tab.`);
      (data.emailQueued && !data.handleError ? showSuccess : showError)(parts.join(' '));
    } else if (act === 'address') {
      const handle = await chooseHandle(name);
      if (!handle) return;
      if (!confirm(`Give this shop kaay.store/kreator/${handle} and kaay.link/${handle}? It cannot be changed later.`)) return;
      btn.disabled = true;
      await getJson(`/kreators/admin/${encodeURIComponent(uid)}/store-address`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle }) });
      showSuccess(`Shop address set: kaay.store/kreator/${handle}`);
    } else if (act === 'reject') {
      const reason = prompt('Why is this application refused? The applicant sees this.', '');
      if (!reason || !reason.trim()) return;
      btn.disabled = true;
      await getJson(`/kreators/admin/applications/${encodeURIComponent(id)}/reject`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() }) });
      showSuccess('Rejected.');
    } else if (act === 'finish-link') {
      btn.disabled = true;
      await getJson(`/kreators/admin/${encodeURIComponent(uid)}/store-address`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle: knownHandle }) });
      showSuccess(`kaay.link/${knownHandle} now opens the shop.`);
    } else if (act === 'list-approve') {
      btn.disabled = true;
      const d = await getJson(`/kreators/admin/listings/${encodeURIComponent(id)}/review`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'approve', version: Number(version) }) });
      // Approval makes the piece's own kaay.link + QR (services/productLinks.js); say which.
      const qrNote = !d.qr ? '' : d.qr.status === 'ready' ? ` QR: ${String(d.qr.link || '').replace('https://', '')}.`
        : d.qr.status === 'limit' ? ` No QR code: the shop has used all ${d.qr.limit} (Sellers → Change QR limit).`
        : d.qr.status === 'waiting' ? ' QR code waits for the shop\'s kaay.link address.'
        : d.qr.status === 'error' ? ' The QR code was NOT made — Sellers → "Make missing QR codes" retries it.' : '';
      (d.emailQueued && (!d.qr || d.qr.status !== 'error') ? showSuccess : showError)(`${d.outcome === 'changes-approved' ? 'Changes are live.' : 'Approved: it is on the store.'}${qrNote} ${mailNote(d, 'The seller')}`);
    } else if (act === 'list-reject') {
      const note = prompt('What should the seller change? They see this.', '');
      if (!note || note.trim().length < 5) return;
      btn.disabled = true;
      const d = await getJson(`/kreators/admin/listings/${encodeURIComponent(id)}/review`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'reject', note: note.trim(), version: Number(version) }) });
      const what = { 'changes-returned': 'Changes returned; the current version stays on sale.', 'taken-down': 'Taken off the store.', returned: 'Sent back.' }[d.outcome] || 'Done.';
      (d.emailQueued ? showSuccess : showError)(`${what} ${mailNote(d, 'The seller')}`);
    } else if (act === 'resend') {
      if (!confirm('Send the activation email again? A link sent before keeps working until the new email has gone.')) return;
      btn.disabled = true;
      const data = await getJson(`/kreators/admin/${encodeURIComponent(uid)}/resend-link`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (data.emailQueued) showSuccess(data.linkedAccount ? `Emailed ${data.email} again: they sign in with their existing Kaayko sign-in.` : `New activation link emailed to ${data.email}.`);
      else showError(`The email did NOT queue, so nothing changed: ${data.email}'s current link still works. Check Mail health and try again.`);
    } else if (act === 'suspend') {
      const reason = prompt(`Suspend ${name || 'this seller'}? Every listing comes off sale, their sessions end and their shop reads closed.\n\nWhy? (kept in the audit log)`, '');
      if (!reason || reason.trim().length < 5) return;
      btn.disabled = true;
      const d = await getJson(`/kreators/admin/${encodeURIComponent(uid)}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'suspended', reason: reason.trim() }) });
      showSuccess(`Suspended. ${d.listings} listing${d.listings === 1 ? '' : 's'} off sale.`);
    } else if (act === 'reinstate') {
      if (!confirm('Reinstate this seller? Their approved listings go back on sale.')) return;
      btn.disabled = true;
      await getJson(`/kreators/admin/${encodeURIComponent(uid)}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) });
      showSuccess('Reinstated.');
    } else if (act === 'qr-make') {
      btn.disabled = true;
      const d = await getJson(`/kreators/admin/${encodeURIComponent(uid)}/qr-codes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      (d.failed ? showError : showSuccess)(`${d.made ? `${d.made} QR code${d.made === 1 ? '' : 's'} made` : 'No codes were missing'}; ${d.used} of ${d.limit} in use.${d.failed ? ` ${d.failed} could not be made — try again.` : ''}`);
    } else if (act === 'qr-limit') {
      const answer = prompt(`How many product QR codes may ${name || 'this shop'} hold? (now ${currentLimit}; 1–500)\n\nRaising it makes the codes its approved pieces are waiting for. Lowering it never removes a code already made.`, currentLimit);
      if (answer === null) return;
      const limit = Number(answer);
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) { showError('Enter a whole number from 1 to 500.'); return; }
      btn.disabled = true;
      const d = await getJson(`/kreators/admin/${encodeURIComponent(uid)}/qr-limit`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ limit }) });
      showSuccess(`QR limit ${d.limit}. ${d.used} in use${d.made ? `; ${d.made} new code${d.made === 1 ? '' : 's'} made` : ''}.`);
    } else if (act === 'release-rating') {
      if (!confirm('Mark this report resolved and release its payout hold? Only the rating hold is lifted; anything else waiting on the line stays.')) return;
      btn.disabled = true;
      await getJson(`/kreators/admin/earnings/${encodeURIComponent(id)}/release`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reasons: String(name || '').split(',').filter(Boolean) }) });
      showSuccess('Resolved and released.');
    } else if (act === 'resolve-rating') {
      if (!confirm('Mark this report resolved? It stops counting in the Kreator\'s standing.')) return;
      btn.disabled = true;
      await getJson(`/kreators/admin/ratings/${encodeURIComponent(id)}/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      showSuccess('Resolved.');
    } else if (act === 'vet-teacher') {
      const subjects = prompt('What do they teach? (This vets them as a teacher, so they can list lessons.)', '');
      if (!subjects || subjects.trim().length < 3) return;
      const insurance = (prompt('Liability insurance? yes / no / not_sure', 'not_sure') || 'not_sure').trim().toLowerCase();
      const bg = confirm('Have they agreed to a background check (needed to open a lesson to under-18s)? OK = yes, Cancel = no');
      btn.disabled = true;
      await getJson(`/kreators/admin/kreators/${encodeURIComponent(uid)}/teaching`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subjects: subjects.trim(), insurance, backgroundCheckOk: bg }) });
      showSuccess('Vetted as a teacher.');
    } else if (act === 'release-hold') {
      if (!confirm('Release the hold on this line? It is paid with the seller\'s next statement, and a buyer report counts as resolved.')) return;
      btn.disabled = true;
      await getJson(`/kreators/admin/earnings/${encodeURIComponent(id)}/release`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      showSuccess('Released.');
    } else if (act === 'pause-lessons') {
      if (!confirm('Pause new bookings of this Kreator\'s lessons? People already booked keep their place, and the teacher is emailed that Kaayko has paused them.')) return;
      btn.disabled = true;
      const d = await getJson(`/kreators/admin/kreators/${encodeURIComponent(uid)}/pause-lessons`, { method: 'POST' });
      showSuccess(`${d.paused} lesson${d.paused === 1 ? '' : 's'} paused.`);
    } else if (act === 'resume-lessons') {
      if (!confirm('Resume new bookings of this Kreator\'s lessons? Do this only once the report has been looked into.')) return;
      btn.disabled = true;
      const d = await getJson(`/kreators/admin/kreators/${encodeURIComponent(uid)}/resume-lessons`, { method: 'POST' });
      showSuccess(`${d.resumed} lesson${d.resumed === 1 ? '' : 's'} open for booking again.`);
    } else if (act === 'assign') {
      const charge = name === 'charge';
      if (!confirm(charge ? 'Charge this to the maker? They earn nothing on this line (taken from a later statement if already paid).' : 'Kaayko bears it: the maker keeps this earning.')) return;
      btn.disabled = true;
      await getJson(`/kreators/admin/earnings/${encodeURIComponent(id)}/assign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ outcome: charge ? 'charge' : 'kaayko' }) });
      showSuccess(charge ? 'Charged to the maker.' : 'Released; Kaayko bears it.');
    } else if (act === 'draft-statements') {
      btn.disabled = true;
      const d = await getJson('/kreators/admin/payouts/run', { method: 'POST' });
      const extra = [d.paused && `${d.paused} seller${d.paused === 1 ? '' : 's'} paused by an open buyer report (Ratings tab)`, d.failed && `${d.failed} could not be drafted — try again`].filter(Boolean).join('; ');
      showSuccess(`${d.statements ? `${d.statements} statement${d.statements === 1 ? '' : 's'} drafted.` : 'Nothing is due yet.'}${extra ? ` ${extra}.` : ''}`);
    } else if (act === 'pay') {
      if (!confirm(`Transfer ${usd(currentLimit)} to ${name} through Stripe now? This moves real money once Stripe is live.`)) return;
      btn.disabled = true;
      const d = await getJson(`/kreators/admin/payouts/${encodeURIComponent(id)}/pay`, { method: 'POST' });
      showSuccess(d.status === 'paid' ? `Paid ${usd(d.totalCents)} (${d.transferId}).` : 'Nothing left to pay on that statement.');
    } else if (act === 'bio-approve' || act === 'bio-reject') {
      const note = act === 'bio-reject' ? prompt('Why is the description not published? The seller sees this.', '') : '';
      if (act === 'bio-reject' && (!note || note.trim().length < 5)) return;
      btn.disabled = true;
      const d = await getJson(`/kreators/admin/${encodeURIComponent(uid)}/bio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: act === 'bio-approve' ? 'approve' : 'reject', note: (note || '').trim() }) });
      (d.emailQueued ? showSuccess : showError)(`${act === 'bio-approve' ? 'Published.' : 'Returned.'} ${mailNote(d, 'The seller')}`);
    }
    await render();
  } catch (err) {
    btn.disabled = false;
    showError(err.message);
  }
}
