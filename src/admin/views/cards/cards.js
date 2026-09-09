/**
 * Cards — the words on the Kaayko property cards, editable.
 *
 *   GET   /admin/cards        → every card, hidden ones included, plus the back
 *   PATCH /admin/cards/:slug  → whitelisted partial update of one card
 *   PATCH /admin/cards        → the block shared by the back of every card
 *
 * These are physical objects. A field that is one character too long does not
 * wrap on a printed card, it collides with the rule beneath it — so the server
 * refuses an overlong value rather than truncating, and this view shows the
 * refusal against the field that caused it.
 *
 * The preview is the real renderer, the same module the public /card page uses.
 * It is not a mock-up: what is drawn here is what prints, so a bad line length
 * is visible before it is saved rather than after it is on paper.
 */

import { apiFetch } from '../../js/config.js';
import { escapeHtml, showSuccess, showError } from '../../js/utils.js';
import { front, back } from '../../../js/cards/render.js';

const SITE = 'https://kaayko.com';

const FIELDS = [
  { key: 'name', label: 'Name', hint: 'The big word. 24 characters.' },
  { key: 'hook', label: 'Hook', hint: 'Two lines at most, italic, in the accent colour.' },
  { key: 'host', label: 'Printed link', hint: 'How the address reads on the card. Not the QR.' },
  { key: 'url', label: 'URL', hint: 'Where the QR goes. https only — a printed QR cannot be corrected.' },
  { key: 'accent', label: 'Accent', hint: 'Hex. The spine, the hook and the rule on the back.', type: 'color' },
  { key: 'n', label: 'Order', hint: 'Position in the set.', type: 'number' }
];

const BRAND_FIELDS = [
  { key: 'label', label: 'Lockup' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'properties', label: 'Properties line' },
  { key: 'contact', label: 'Contact line' }
];

let cards = [];
let brand = {};
let artNames = [];
let openSlug = null;
let container = null;

/* ── data ─────────────────────────────────────────────── */

/* apiFetch hands back the raw Response and never throws: it returns null on a
   401 having already logged us out, and a non-ok response is an ordinary value.
   Everything below reads it that way rather than wrapping it in try/catch. */
async function problem(res) {
  try {
    const body = await res.json();
    return { message: body.error || body.message || `Request failed (${res.status})`, problems: body.problems };
  } catch (_) {
    return { message: `Request failed (${res.status})`, problems: null };
  }
}

async function load() {
  const list = document.getElementById('cards-list');
  if (list) list.innerHTML = `<p class="cv-loading">Loading the cards…</p>`;

  const res = await apiFetch('/admin/cards');
  if (!res) return;                       // 401 — apiFetch already logged us out
  if (!res.ok) {
    const { message } = await problem(res);
    if (list) list.innerHTML = `<p class="cv-empty">${escapeHtml(message)}</p>`;
    return;
  }
  const body = await res.json();
  cards = body.cards || [];
  brand = body.brand || {};
  artNames = body.art || [];
  paint();
}

/** Draw the card exactly as it will print, from whatever is in the form now. */
function preview(card) {
  const qr = (() => {
    try {
      const q = window.qrcode(0, 'M');
      q.addData(card.url || SITE);
      q.make();
      return q;
    } catch (_) { return null; }
  })();
  return front(card, { qr, artHref: `${SITE}/assets/cards/art/${card.art || card.slug}.png` }) +
         back(card, brand, { index: card.n, total: cards.length });
}

/** What the open editor currently holds, so the preview tracks typing. */
function draft(slug) {
  const saved = cards.find((c) => c.slug === slug) || {};
  const form = document.getElementById(`cv-form-${slug}`);
  if (!form) return saved;
  const out = { ...saved };
  for (const { key, type } of FIELDS) {
    const el = form.elements[key];
    if (!el) continue;
    out[key] = type === 'number' ? Number(el.value) : el.value;
  }
  const art = form.elements.art;
  if (art) out.art = art.value;
  return out;
}

function repaintPreview(slug) {
  const holder = document.getElementById(`cv-preview-${slug}`);
  if (holder) holder.innerHTML = preview(draft(slug));
}

/* ── rendering ────────────────────────────────────────── */

function row(card) {
  const open = card.slug === openSlug;
  const fields = FIELDS.map(({ key, label, hint, type }) => `
    <label class="cv-field">
      <span class="cv-label">${escapeHtml(label)}</span>
      <input name="${key}" type="${type === 'number' ? 'number' : type === 'color' ? 'text' : 'text'}"
             value="${escapeHtml(String(card[key] ?? ''))}" autocomplete="off" spellcheck="false">
      <span class="cv-hint">${escapeHtml(hint)}</span>
      <span class="cv-problem" data-for="${key}"></span>
    </label>`).join('');

  const art = `
    <label class="cv-field">
      <span class="cv-label">Art</span>
      <select name="art">${artNames.map((a) =>
        `<option value="${escapeHtml(a)}"${a === card.art ? ' selected' : ''}>${escapeHtml(a)}</option>`).join('')}</select>
      <span class="cv-hint">The animal panel. Only files that exist are listed.</span>
      <span class="cv-problem" data-for="art"></span>
    </label>`;

  return `
    <article class="cv-card${open ? ' is-open' : ''}" data-slug="${escapeHtml(card.slug)}">
      <header class="cv-row">
        <span class="cv-n">${String(card.n).padStart(2, '0')}</span>
        <span class="cv-spine" style="background:${escapeHtml(card.accent)}"></span>
        <span class="cv-name">${escapeHtml(card.name)}</span>
        <span class="cv-hook">${escapeHtml(card.hook)}</span>
        <span class="cv-state ${card.live ? 'is-live' : 'is-off'}">${card.live ? 'On the page' : 'Hidden'}</span>
        <button type="button" class="cv-btn" data-act="toggle-live">${card.live ? 'Hide' : 'Show'}</button>
        <button type="button" class="cv-btn" data-act="expand">${open ? 'Close' : 'Edit'}</button>
      </header>
      ${open ? `
      <div class="cv-body">
        <form class="cv-form" id="cv-form-${escapeHtml(card.slug)}">
          ${fields}${art}
          <div class="cv-actions">
            <button type="submit" class="cv-btn cv-btn-primary">Save</button>
            <button type="button" class="cv-btn" data-act="revert">Revert</button>
            <a class="cv-btn" href="${SITE}/card" target="_blank" rel="noopener">See it live</a>
          </div>
        </form>
        <div class="cv-preview" id="cv-preview-${escapeHtml(card.slug)}">${preview(card)}</div>
      </div>` : ''}
    </article>`;
}

function paint() {
  const list = document.getElementById('cards-list');
  if (!list) return;
  list.innerHTML = cards.length
    ? cards.map(row).join('')
    : `<p class="cv-empty">No cards yet. Run scripts/seed-cards.js in the API repo.</p>`;

  const b = document.getElementById('cards-brand');
  if (b) {
    b.innerHTML = `
      <form class="cv-form cv-brand" id="cv-brand-form">
        ${BRAND_FIELDS.map(({ key, label }) => `
          <label class="cv-field">
            <span class="cv-label">${escapeHtml(label)}</span>
            <input name="${key}" type="text" value="${escapeHtml(String(brand[key] ?? ''))}" autocomplete="off">
            <span class="cv-problem" data-for="${key}"></span>
          </label>`).join('')}
        <div class="cv-actions"><button type="submit" class="cv-btn cv-btn-primary">Save the back</button></div>
      </form>`;
  }
}

function showProblems(form, problems) {
  form.querySelectorAll('.cv-problem').forEach((el) => { el.textContent = ''; });
  for (const [key, why] of Object.entries(problems || {})) {
    const el = form.querySelector(`.cv-problem[data-for="${key}"]`);
    if (el) el.textContent = why;
  }
}

/* ── events ───────────────────────────────────────────── */

async function onClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const slug = btn.closest('.cv-card')?.dataset.slug;
  const card = cards.find((c) => c.slug === slug);
  if (!card) return;

  if (btn.dataset.act === 'expand') { openSlug = openSlug === slug ? null : slug; paint(); return; }
  if (btn.dataset.act === 'revert') { paint(); return; }
  if (btn.dataset.act === 'toggle-live') {
    const res = await apiFetch(`/admin/cards/${slug}`, {
      method: 'PATCH', body: JSON.stringify({ live: !card.live })
    });
    if (!res) return;
    if (!res.ok) { showError((await problem(res)).message); return; }
    const body = await res.json();
    Object.assign(card, body.card);
    paint();
    showSuccess(body.card.live ? `${body.card.name} is on the page.` : `${body.card.name} is hidden.`);
  }
}

async function onSubmit(e) {
  e.preventDefault();
  const form = e.target;

  if (form.id === 'cv-brand-form') {
    const patch = {};
    for (const { key } of BRAND_FIELDS) patch[key] = form.elements[key].value;
    const res = await apiFetch('/admin/cards', { method: 'PATCH', body: JSON.stringify(patch) });
    if (!res) return;
    if (!res.ok) {
      const { message, problems } = await problem(res);
      showProblems(form, problems);
      showError(message);
      return;
    }
    brand = (await res.json()).brand;
    showProblems(form, {});
    paint();
    showSuccess('The back of every card is updated.');
    return;
  }

  const slug = form.closest('.cv-card')?.dataset.slug;
  if (!slug) return;
  const body = {};
  for (const { key, type } of FIELDS) {
    const el = form.elements[key];
    if (el) body[key] = type === 'number' ? Number(el.value) : el.value;
  }
  body.art = form.elements.art.value;

  const res = await apiFetch(`/admin/cards/${slug}`, { method: 'PATCH', body: JSON.stringify(body) });
  if (!res) return;
  if (!res.ok) {
    const { message, problems } = await problem(res);
    showProblems(form, problems);
    showError(message);
    return;
  }
  const saved = (await res.json()).card;
  const at = cards.findIndex((c) => c.slug === slug);
  cards[at] = saved;
  cards.sort((a, b) => a.n - b.n);
  showProblems(form, {});
  paint();
  showSuccess(`${saved.name} saved. It is live on the next page load.`);
}

function onInput(e) {
  const slug = e.target.closest('.cv-card')?.dataset.slug;
  if (slug && slug === openSlug) repaintPreview(slug);
}

export async function init() {
  container = document.getElementById('cards-view');
  if (!container) return;
  cards = []; brand = {}; openSlug = null;

  container.innerHTML = `
    <header class="cv-header">
      <div>
        <h1>Cards</h1>
        <p class="cv-lede">The words on the property cards, at kaayko.com/card and on the printed set.
          The preview is the real renderer — what you see here is what prints.</p>
      </div>
      <button type="button" class="cv-btn" id="cards-refresh">Refresh</button>
    </header>
    <div class="cv-list" id="cards-list"></div>
    <section class="cv-section">
      <h2>The back of every card</h2>
      <p class="cv-lede">Shared by all five. Changing this changes the whole set.</p>
      <div id="cards-brand"></div>
    </section>
  `;

  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);
  container.addEventListener('input', onInput);
  document.getElementById('cards-refresh').addEventListener('click', load);

  // The QR generator is a global script, loaded once and shared with the site.
  if (!window.qrcode) {
    await new Promise((done, fail) => {
      const s = document.createElement('script');
      s.src = '/js/vendor/qrcode-generator.js';
      s.onload = done; s.onerror = fail;
      document.head.appendChild(s);
    }).catch(() => showError('The QR generator did not load; previews will show an empty code.'));
  }

  await load();
}
