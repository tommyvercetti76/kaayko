/**
 * Shared spot editor — used by the Spots catalogue view and the Submissions
 * review queue so an admin edits a community entry with the same form that
 * edits a curated lake.
 *
 * Talks to (all platform-admin only):
 *   PATCH  /paddlingOut/admin/spots/:id            fields, tags, archived
 *   POST   /paddlingOut/admin/spots/:id/images     multipart add (1–5)
 *   DELETE /paddlingOut/admin/spots/:id/images     ?path=…
 *   POST   /paddlingOut/admin/spots/:id/warm-score
 *
 * SECURITY: every value rendered here originated from a submitter or an admin
 * and is escaped. Photo URLs must be https on our Storage host.
 */

import { apiFetch, AUTH, CONFIG } from '../../js/config.js';
import { escapeHtml, jsAttr, showSuccess, showError } from '../../js/utils.js';

export const DEFAULT_TAGS = {
  'community': 'Community', 'new': 'New', 'verified': 'Verified', 'staff-pick': 'Staff pick',
  'seasonal': 'Seasonal', 'river': 'River', 'boat-ramp': 'Boat ramp'
};

const WATER_TYPES = ['', 'lake', 'reservoir', 'river', 'coastal', 'bay', 'canal'];
const MAX_UPLOAD = 5;
const MAX_PER_SPOT = 8;

function coords(spot) {
  const lat = Number(spot.location?.latitude);
  const lng = Number(spot.location?.longitude);
  return (Number.isFinite(lat) && Number.isFinite(lng)) ? { lat, lng } : null;
}

export function safeImageUrl(url) {
  return typeof url === 'string' && /^https:\/\/firebasestorage\.googleapis\.com\/[^\s"'<>]+$/i.test(url) ? url : '';
}

/** HTML for the editor form. `spot` is an admin-shaped spot payload. */
export function renderEditor(spot, tagLabels = DEFAULT_TAGS) {
  const c = coords(spot);
  const tags = Array.isArray(spot.tags) ? spot.tags : [];
  const images = Array.isArray(spot.images) ? spot.images : [];
  const yn = (v) => v === 'Y' || v === true || v === 'true';

  const photoTiles = images.map((img) => {
    const url = safeImageUrl(img.url);
    if (!url) return '';
    return `<figure class="se-photo">
      <img src="${escapeHtml(url)}" alt="" loading="lazy">
      <button type="button" class="se-photo-del" data-se="del-photo" data-path="${jsAttr(img.path)}" title="Remove photo" aria-label="Remove photo">×</button>
    </figure>`;
  }).join('');

  return `
    <form class="se-editor" data-se-id="${jsAttr(spot.id)}" novalidate>
      <div class="se-grid">
        <label>Name
          <input name="title" type="text" maxlength="120" value="${escapeHtml(spot.title || spot.lakeName || '')}" required>
        </label>
        <label>Water type
          <select name="waterType">
            ${WATER_TYPES.map(t => `<option value="${t}"${(spot.waterType || '') === t ? ' selected' : ''}>${t || '—'}</option>`).join('')}
          </select>
        </label>
        <label>City / nearest town
          <input name="city" type="text" maxlength="80" value="${escapeHtml(spot.city || '')}">
        </label>
        <label>State / region
          <input name="region" type="text" maxlength="80" value="${escapeHtml(spot.region || '')}">
        </label>
        <label>Country
          <input name="country" type="text" maxlength="80" value="${escapeHtml(spot.country || '')}">
        </label>
        <label>Subtitle
          <input name="subtitle" type="text" maxlength="160" value="${escapeHtml(spot.subtitle || '')}" placeholder="Auto from city, region, country">
        </label>
        <label>Latitude
          <input name="lat" type="number" step="0.00001" min="-85" max="85" value="${c ? c.lat.toFixed(5) : ''}">
        </label>
        <label>Longitude
          <input name="lng" type="number" step="0.00001" min="-180" max="180" value="${c ? c.lng.toFixed(5) : ''}">
          ${c ? `<a class="se-hint" href="https://www.google.com/maps?q=${c.lat},${c.lng}" target="_blank" rel="noopener">Check on map ↗</a>` : ''}
        </label>
        <label class="se-wide">Launch hint
          <input name="launchHint" type="text" maxlength="160" value="${escapeHtml(spot.launchHint || '')}">
        </label>
        <label class="se-wide">Description
          <textarea name="text" rows="3" maxlength="800">${escapeHtml(spot.text || '')}</textarea>
        </label>
        <label>Parking
          <select name="parkingAvl"><option value="Y"${yn(spot.parkingAvl) ? ' selected' : ''}>Available</option><option value="N"${!yn(spot.parkingAvl) ? ' selected' : ''}>Not sure / none</option></select>
        </label>
        <label>Restrooms
          <select name="restroomsAvl"><option value="Y"${yn(spot.restroomsAvl) ? ' selected' : ''}>Available</option><option value="N"${!yn(spot.restroomsAvl) ? ' selected' : ''}>Not sure / none</option></select>
        </label>
        <label class="se-wide">YouTube URL
          <input name="youtubeURL" type="url" maxlength="300" value="${escapeHtml(spot.youtubeURL || '')}" placeholder="https://youtube.com/…">
        </label>
        <fieldset class="se-wide se-tags">
          <legend>Display tags <span class="se-hint">shown as chips on the card</span></legend>
          ${Object.entries(tagLabels).map(([key, label]) => `
            <label class="se-tag"><input type="checkbox" name="tags" value="${jsAttr(key)}"${tags.includes(key) ? ' checked' : ''}> ${escapeHtml(label)}</label>
          `).join('')}
        </fieldset>
      </div>

      <div class="se-photos-head">
        <strong>Photos</strong>
        <span class="se-hint">${images.length} of ${MAX_PER_SPOT}. First photo is the card cover.</span>
        <label class="btn btn-secondary btn-sm se-add">
          Add photos
          <input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple hidden data-se="add-photos">
        </label>
      </div>
      <div class="se-photos" data-se="photos">${photoTiles || '<div class="se-empty">No photos yet.</div>'}</div>

      <div class="se-actions">
        <span class="se-status" data-se="status" aria-live="polite"></span>
        <button type="button" class="btn btn-secondary btn-sm" data-se="warm">Recompute score</button>
        <button type="submit" class="btn btn-primary" data-se="save">Save changes</button>
      </div>
    </form>
  `;
}

/**
 * Wire an editor that renderEditor() produced inside `root`.
 * `onChange(spot)` receives the fresh admin-shaped spot after every write.
 */
export function bindEditor(root, { onChange } = {}) {
  const form = root.querySelector('.se-editor');
  if (!form) return;
  const id = form.dataset.seId;
  const statusEl = form.querySelector('[data-se="status"]');
  const setStatus = (msg, cls) => { if (statusEl) { statusEl.textContent = msg || ''; statusEl.className = 'se-status' + (cls ? ' ' + cls : ''); } };
  const busy = (on) => form.querySelectorAll('button, input, select, textarea').forEach(el => { el.disabled = on; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const patch = {};
    ['title', 'city', 'region', 'country', 'subtitle', 'launchHint', 'text', 'parkingAvl', 'restroomsAvl', 'youtubeURL', 'waterType']
      .forEach(k => { patch[k] = String(fd.get(k) ?? '').trim(); });
    patch.tags = fd.getAll('tags');
    const lat = String(fd.get('lat') || '').trim();
    const lng = String(fd.get('lng') || '').trim();
    if (lat || lng) {
      if (!lat || !lng) { setStatus('Both latitude and longitude are needed.', 'err'); return; }
      patch.lat = Number(lat); patch.lng = Number(lng);
    }
    if (!patch.title) { setStatus('Name cannot be empty.', 'err'); return; }

    busy(true); setStatus('Saving…');
    try {
      const spot = await patchSpot(id, patch);
      setStatus(spot.paddleScore?.warmed ? 'Saved. Score recomputed.' : 'Saved.', 'ok');
      showSuccess('Spot updated.');
      if (onChange) onChange(spot.spot);
    } catch (err) {
      setStatus(err.message, 'err');
      showError(err.message);
    } finally {
      busy(false);
    }
  });

  form.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-se="add-photos"]');
    if (!input || !input.files?.length) return;
    const files = Array.from(input.files).slice(0, MAX_UPLOAD);
    input.value = '';
    busy(true); setStatus(`Uploading ${files.length} photo${files.length === 1 ? '' : 's'}…`);
    try {
      const result = await addPhotos(id, files);
      setStatus(`Added ${result.added.length}.`, 'ok');
      showSuccess('Photos added.');
      if (onChange) onChange(await fetchSpot(id));
    } catch (err) {
      setStatus(err.message, 'err');
      showError(err.message);
    } finally {
      busy(false);
    }
  });

  form.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-se="del-photo"]');
    if (del) {
      e.preventDefault();
      if (!window.confirm('Remove this photo? This cannot be undone.')) return;
      busy(true); setStatus('Removing photo…');
      try {
        await deletePhoto(id, del.dataset.path);
        setStatus('Photo removed.', 'ok');
        if (onChange) onChange(await fetchSpot(id));
      } catch (err) {
        setStatus(err.message, 'err');
        showError(err.message);
      } finally {
        busy(false);
      }
      return;
    }
    const warm = e.target.closest('[data-se="warm"]');
    if (warm) {
      e.preventDefault();
      busy(true); setStatus('Computing score…');
      try {
        const r = await warmScore(id);
        setStatus(r.warmed ? `Score cached: ${Number(r.rating).toFixed(1)}` : `No score: ${r.reason || 'unavailable'}`, r.warmed ? 'ok' : 'err');
        if (onChange) onChange(await fetchSpot(id));
      } catch (err) {
        setStatus(err.message, 'err');
      } finally {
        busy(false);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function errorMessage(res, fallback) {
  try {
    const d = await res.json();
    if (d && (d.error || d.message)) return d.error || d.message;
  } catch (_) { /* non-JSON */ }
  return `${fallback} (${res.status})`;
}

export async function fetchSpots() {
  const res = await apiFetch('/paddlingOut/admin/spots');
  if (!res) throw new Error('Session expired.');
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load spots'));
  return res.json();
}

export async function fetchSpot(id) {
  const res = await apiFetch(`/paddlingOut/admin/spots/${encodeURIComponent(id)}`);
  if (!res) throw new Error('Session expired.');
  if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load spot'));
  const data = await res.json();
  return data.spot;
}

export async function patchSpot(id, patch) {
  const res = await apiFetch(`/paddlingOut/admin/spots/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!res) throw new Error('Session expired.');
  if (!res.ok) throw new Error(await errorMessage(res, 'Save failed'));
  return res.json();
}

export async function addPhotos(id, files) {
  const fd = new FormData();
  files.forEach(f => fd.append('images', f, f.name));
  // apiFetch forces Content-Type: application/json, which would strip the
  // multipart boundary. Build the auth headers by hand and let the browser
  // set the multipart header itself.
  const headers = { ...AUTH.getHeaders() };
  delete headers['Content-Type'];
  const tenantId = localStorage.getItem('kaayko_tenant_id');
  if (tenantId) headers['X-Kaayko-Tenant-Id'] = tenantId;
  const res = await fetch(`${CONFIG.API_BASE}/paddlingOut/admin/spots/${encodeURIComponent(id)}/images`, {
    method: 'POST', headers, body: fd
  });
  if (res.status === 401) { AUTH.logout(); throw new Error('Session expired.'); }
  if (!res.ok) throw new Error(await errorMessage(res, 'Upload failed'));
  return res.json();
}

export async function deletePhoto(id, path) {
  const res = await apiFetch(`/paddlingOut/admin/spots/${encodeURIComponent(id)}/images?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
  if (!res) throw new Error('Session expired.');
  if (!res.ok) throw new Error(await errorMessage(res, 'Delete failed'));
  return res.json();
}

export async function warmScore(id) {
  const res = await apiFetch(`/paddlingOut/admin/spots/${encodeURIComponent(id)}/warm-score`, { method: 'POST' });
  if (!res) throw new Error('Session expired.');
  if (!res.ok) throw new Error(await errorMessage(res, 'Score failed'));
  const data = await res.json();
  return data.paddleScore || { warmed: false };
}
