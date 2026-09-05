/**
 * Products — the storefront catalogue, editable.
 *
 *   GET   /admin/products      → every product, hidden and sold-out included
 *   PATCH /admin/products/:id  → whitelisted partial update
 *
 * Two things are one click from the list, because they are the two you reach
 * for most: Hide/Show and Sold out/In stock. Everything else lives behind an
 * expander so the list stays scannable.
 *
 * The server owns every rule. This file validates nothing on its own — it
 * sends the edit and renders whatever the server says came back, so the UI can
 * never disagree with what checkout will actually honour.
 */

import { apiFetch } from '../../js/config.js';
import { escapeHtml, jsAttr, showSuccess, showError } from '../../js/utils.js';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'hidden', label: 'Hidden' },
  { key: 'soldout', label: 'Sold out' }
];

const PRODUCT_TYPES = ['tshirt', 'tote', 'magnet', 'print', 'sticker', 'mug', 'cap', 'poster'];
const CATEGORIES = ['apparel', 'accessories', 'art', 'other'];

let products = [];
let activeTab = 'all';
let expandedId = null;
let container = null;

/* ── Data ─────────────────────────────────────────────── */

async function load() {
  const list = document.getElementById('products-list');
  if (list) list.innerHTML = `<p class="pv-loading">Loading the catalogue…</p>`;

  const res = await apiFetch('/admin/products');
  if (!res) return;                      // 401 → apiFetch already logged us out

  if (!res.ok) {
    if (list) list.innerHTML = `<p class="pv-error">${escapeHtml(await errorMessage(res))}</p>`;
    return;
  }
  const body = await res.json();
  products = body.products || [];
  render();
}

async function errorMessage(res) {
  try {
    const body = await res.json();
    return body.error || body.message || `Request failed (${res.status})`;
  } catch (_) {
    return `Request failed (${res.status})`;
  }
}

/**
 * Send one partial update and fold the result back into local state.
 * @param {string} id product id
 * @param {object} patch fields to change
 * @returns {Promise<boolean>} whether it saved
 */
async function save(id, patch) {
  const res = await apiFetch(`/admin/products/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  if (!res) return false;

  if (!res.ok) {
    showError(await errorMessage(res));
    return false;
  }
  const body = await res.json();
  const product = products.find(p => p.id === id);
  if (product) Object.assign(product, patch);

  showSuccess(body.unchanged ? 'Nothing changed' : 'Saved — live on the store now');
  render();
  return true;
}

/* ── Filtering ────────────────────────────────────────── */

function visible() {
  switch (activeTab) {
    case 'live':    return products.filter(p => p.isAvailable && !p.soldOut);
    case 'hidden':  return products.filter(p => !p.isAvailable);
    case 'soldout': return products.filter(p => p.soldOut);
    default:        return products;
  }
}

function countFor(key) {
  switch (key) {
    case 'live':    return products.filter(p => p.isAvailable && !p.soldOut).length;
    case 'hidden':  return products.filter(p => !p.isAvailable).length;
    case 'soldout': return products.filter(p => p.soldOut).length;
    default:        return products.length;
  }
}

/* ── Render ───────────────────────────────────────────── */

function money(p) {
  if (typeof p.actualPrice === 'number') return `$${p.actualPrice.toFixed(2)}`;
  return p.price || '—';           // legacy tier symbol, until someone sets a price
}

function statusPills(p) {
  const pills = [];
  if (!p.isAvailable) pills.push('<span class="pv-pill pv-pill-hidden">Hidden</span>');
  else if (p.soldOut) pills.push('<span class="pv-pill pv-pill-sold">Sold out</span>');
  else pills.push('<span class="pv-pill pv-pill-live">Live</span>');
  return pills.join('');
}

function row(p) {
  const thumb = p.previewSrc?.[0] || p.imgSrc?.[0] || '';
  const open = expandedId === p.id;

  return `
    <article class="pv-row${open ? ' is-open' : ''}${p.isAvailable ? '' : ' is-hidden-product'}" data-id="${jsAttr(p.id)}">
      <div class="pv-head">
        <div class="pv-thumb">${thumb ? `<img src="${escapeHtml(thumb)}" alt="" loading="lazy">` : ''}</div>
        <div class="pv-ident">
          <h3>${escapeHtml(p.title || 'Untitled')}</h3>
          <p class="pv-sub">${escapeHtml(p.description || '')}</p>
          <p class="pv-meta">${escapeHtml(p.productType || 'no type')} · ${escapeHtml(money(p))} · ${escapeHtml((p.availableSizes || []).join(' / ') || 'no sizes')}</p>
        </div>
        <div class="pv-state">${statusPills(p)}</div>
        <div class="pv-quick">
          <button type="button" class="pv-btn" data-action="toggle-visible" data-id="${jsAttr(p.id)}">
            ${p.isAvailable ? 'Hide' : 'Show'}
          </button>
          <button type="button" class="pv-btn" data-action="toggle-sold" data-id="${jsAttr(p.id)}" ${p.isAvailable ? '' : 'disabled'}>
            ${p.soldOut ? 'Back in stock' : 'Sold out'}
          </button>
          <button type="button" class="pv-btn pv-btn-ghost" data-action="expand" data-id="${jsAttr(p.id)}" aria-expanded="${open}">
            ${open ? 'Close' : 'Edit'}
          </button>
        </div>
      </div>
      ${open ? editor(p) : ''}
    </article>`;
}

function editor(p) {
  const rows = (p.fileRows || []).slice(0, 4);
  while (rows.length < 3) rows.push({ label: '', value: '' });

  return `
    <form class="pv-editor" data-id="${jsAttr(p.id)}">
      <div class="pv-grid">
        <label>Name
          <input name="title" type="text" maxlength="120" value="${escapeHtml(p.title || '')}" required>
        </label>
        <label>Price
          <input name="actualPrice" type="number" step="0.01" min="1" max="500"
                 value="${typeof p.actualPrice === 'number' ? p.actualPrice.toFixed(2) : ''}"
                 placeholder="${escapeHtml(p.price || '')}">
          <span class="pv-hint">This is what the customer is charged.</span>
        </label>
        <label class="pv-wide">Tagline
          <input name="description" type="text" maxlength="300" value="${escapeHtml(p.description || '')}">
          <span class="pv-hint">The big line on the product page.</span>
        </label>
        <label>Type
          <select name="productType">
            <option value="">—</option>
            ${PRODUCT_TYPES.map(t => `<option value="${t}"${t === p.productType ? ' selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>
        <label>Category
          <select name="category">
            <option value="">—</option>
            ${CATEGORIES.map(c => `<option value="${c}"${c === p.category ? ' selected' : ''}>${c}</option>`).join('')}
          </select>
        </label>
        <label>Sizes
          <input name="availableSizes" type="text" value="${escapeHtml((p.availableSizes || []).join(', '))}">
          <span class="pv-hint">Comma separated. Only these can be ordered.</span>
        </label>
        <label>Theme
          <input name="theme" type="text" maxlength="40" value="${escapeHtml(p.theme || '')}">
        </label>
        <label class="pv-wide">Tags
          <input name="tags" type="text" value="${escapeHtml((p.tags || []).join(', '))}">
        </label>
        <label class="pv-wide">Story
          <textarea name="storyCopy" rows="3" maxlength="600" placeholder="Leave empty to keep the built-in copy.">${escapeHtml(p.storyCopy || '')}</textarea>
          <span class="pv-hint">The paragraph in the panel under the product.</span>
        </label>
      </div>

      <fieldset class="pv-rows">
        <legend>Panel rows</legend>
        ${rows.map((r, i) => `
          <div class="pv-rowpair">
            <input name="rowLabel${i}" type="text" maxlength="40" placeholder="Label" value="${escapeHtml(r.label || '')}">
            <input name="rowValue${i}" type="text" maxlength="80" placeholder="Value" value="${escapeHtml(r.value || '')}">
          </div>`).join('')}
        <span class="pv-hint">Clear both boxes to remove a row.</span>
      </fieldset>

      <div class="pv-actions">
        <button type="submit" class="pv-btn pv-btn-primary">Save changes</button>
        <button type="button" class="pv-btn pv-btn-ghost" data-action="expand" data-id="${jsAttr(p.id)}">Cancel</button>
        ${p.updatedBy ? `<span class="pv-hint">Last edited by ${escapeHtml(p.updatedBy)}</span>` : ''}
      </div>
    </form>`;
}

function render() {
  const tabs = document.getElementById('products-tabs');
  const list = document.getElementById('products-list');
  if (!tabs || !list) return;

  tabs.innerHTML = TABS.map(t => `
    <button type="button" class="pv-tab${t.key === activeTab ? ' is-active' : ''}" data-tab="${t.key}" aria-pressed="${t.key === activeTab}">
      ${t.label} <span class="pv-count">${countFor(t.key)}</span>
    </button>`).join('');

  const rows = visible();
  list.innerHTML = rows.length
    ? rows.map(row).join('')
    : `<p class="pv-empty">Nothing in this tab.</p>`;
}

/* ── Interaction ──────────────────────────────────────── */

function onClick(e) {
  const tab = e.target.closest('[data-tab]');
  if (tab) { activeTab = tab.dataset.tab; render(); return; }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const product = products.find(p => p.id === id);
  if (!product) return;

  if (btn.dataset.action === 'expand') {
    expandedId = expandedId === id ? null : id;
    render();
    return;
  }

  if (btn.dataset.action === 'toggle-visible') {
    save(id, { isAvailable: !product.isAvailable });
    return;
  }

  if (btn.dataset.action === 'toggle-sold') {
    save(id, { soldOut: !product.soldOut });
  }
}

function onSubmit(e) {
  if (!e.target.matches('.pv-editor')) return;
  e.preventDefault();

  const form = e.target;
  const id = form.dataset.id;
  const product = products.find(p => p.id === id);
  if (!product) return;

  const val = (name) => (form.elements[name]?.value ?? '').trim();
  const list = (name) => val(name).split(',').map(s => s.trim()).filter(Boolean);

  const patch = {
    title: val('title'),
    description: val('description'),
    availableSizes: list('availableSizes'),
    theme: val('theme'),
    tags: list('tags'),
    storyCopy: val('storyCopy')
  };

  const type = val('productType');
  if (type) patch.productType = type;
  const category = val('category');
  if (category) patch.category = category;

  const fileRows = [];
  for (let i = 0; i < 4; i++) {
    const label = val(`rowLabel${i}`);
    const value = val(`rowValue${i}`);
    if (label || value) fileRows.push({ label, value });
  }
  patch.fileRows = fileRows;

  // Price is the one field that can cost real money, so it is confirmed
  // explicitly with the before and after rather than saved silently.
  const raw = val('actualPrice');
  if (raw !== '') {
    const next = Number(raw);
    const current = typeof product.actualPrice === 'number' ? product.actualPrice : null;
    if (Number.isFinite(next) && next !== current) {
      const from = current === null ? `the ${product.price || '—'} tier` : `$${current.toFixed(2)}`;
      if (!window.confirm(`Change the price of "${product.title}" from ${from} to $${next.toFixed(2)}?\n\nThis is what customers will be charged from the next order.`)) {
        return;
      }
      patch.actualPrice = next;
    }
  }

  expandedId = null;
  save(id, patch);
}

/* ── Entry ────────────────────────────────────────────── */

export async function init() {
  container = document.getElementById('products-view');
  if (!container) return;

  products = [];
  activeTab = 'all';
  expandedId = null;

  container.innerHTML = `
    <header class="pv-header">
      <div>
        <h1>Products</h1>
        <p class="pv-lede">What the store sells, and whether it can be bought. Changes are live on the next page load.</p>
      </div>
      <button type="button" class="pv-btn" id="products-refresh">Refresh</button>
    </header>
    <div class="pv-tabs" id="products-tabs"></div>
    <div class="pv-list" id="products-list"></div>
  `;

  container.addEventListener('click', onClick);
  container.addEventListener('submit', onSubmit);
  document.getElementById('products-refresh').addEventListener('click', load);

  await load();
}
