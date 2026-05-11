/**
 * searchPage.js — Discover Paddle Spots
 * /paddlingout/search.html
 *
 * Data flow:
 *  - Popular chip tap OR GPS → runSearch(lat, lng, label)
 *  - Text input → Nominatim geocode → runSearch
 *  - runSearch → /nearbyWater (HydroLAKES + USGS NHD, Firestore-cached)
 *  - Cards render instantly; score rings fill reactively per-card
 */

const API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://127.0.0.1:5001/kaaykostore/us-central1/api'
  : 'https://api-vwcc5j4qda-uc.a.run.app';

// ── Score helpers ─────────────────────────────────────────────────────────
function scoreColor(s) {
  const v = parseFloat(s);
  if (v >= 4.5) return '#255a3a';
  if (v >= 4.0) return '#316d43';
  if (v >= 3.5) return '#c59a61';
  if (v >= 3.0) return '#eb8127';
  if (v >= 2.5) return '#bd3b2b';
  if (v >= 2.0) return '#86170f';
  return '#4a0a08';
}

function buildRing(score) {
  const r    = 18, cx = 24, cy = 24;
  const circ = 2 * Math.PI * r;
  const pct  = Math.max(0, Math.min(1, parseFloat(score) / 5));
  const fill = (pct * circ).toFixed(2);
  const gap  = ((1 - pct) * circ).toFixed(2);
  const color = scoreColor(score);
  // rotate(-90) starts the arc at 12 o'clock — no dashoffset needed
  return `
    <div class="score-ring-wrap">
      <svg class="score-ring-svg" viewBox="0 0 48 48">
        <circle class="score-track" cx="${cx}" cy="${cy}" r="${r}"/>
        <circle class="score-fill" cx="${cx}" cy="${cy}" r="${r}"
          stroke="${color}"
          stroke-dasharray="${fill} ${gap}"
          transform="rotate(-90 ${cx} ${cy})"/>
      </svg>
      <div class="score-label" style="color:#fff">${score}</div>
    </div>`;
}

// ── Nominatim geocode cache ───────────────────────────────────────────────
const geocodeCache = new Map(); // query -> { lat, lng, label, radiusKm }
const suggestionCache = new Map(); // query -> [suggestions]

function inferSearchRadiusKm(item) {
  const placeClass = (item.class || '').toLowerCase();
  const placeType = (item.type || '').toLowerCase();
  const cityLikeTypes = new Set([
    'city', 'town', 'village', 'municipality',
    'administrative', 'state', 'county', 'province', 'region'
  ]);
  const isCityLike = placeClass === 'boundary' || cityLikeTypes.has(placeType);
  return isCityLike ? 60 : 30;
}

async function geocode(query) {
  const cacheKey = query.toLowerCase().trim();
  
  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }
  
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 8000);
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1`,
      { signal: ctrl.signal, headers: { 'User-Agent': 'Kaayko/1.0', 'Accept-Language': 'en' } }
    );
    clearTimeout(tid);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    const result = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      label: data[0].display_name.split(',').slice(0, 2).join(', '),
      radiusKm: inferSearchRadiusKm(data[0])
    };
    // Cache the result
    geocodeCache.set(cacheKey, result);
    return result;
  } catch { return null; }
}

async function fetchGeocodeSuggestions(query) {
  const q = query.toLowerCase().trim();
  if (q.length < 3) return [];
  if (suggestionCache.has(q)) return suggestionCache.get(q);

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
      { signal: ctrl.signal, headers: { 'User-Agent': 'Kaayko/1.0', 'Accept-Language': 'en' } }
    );
    clearTimeout(tid);
    if (!res.ok) return [];

    const data = await res.json();
    const suggestions = (data || []).map(item => ({
      value: item.display_name.split(',').slice(0, 3).join(', '),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      radiusKm: inferSearchRadiusKm(item)
    }));

    suggestionCache.set(q, suggestions);
    return suggestions;
  } catch {
    return [];
  }
}

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// ── DOM refs ──────────────────────────────────────────────────────────────
const inputEl        = document.getElementById('search-input');
const clearBtn       = document.getElementById('search-clear');
const gpsBtn         = document.getElementById('btn-gps');
const refreshBtn     = document.getElementById('refresh-btn');
const statusEl       = document.getElementById('search-status');
const popularSection = document.getElementById('popular-section');
const resultsHeader  = document.getElementById('results-header');
const resultsCount   = document.getElementById('results-count');
const resultsHint    = document.getElementById('results-hint');
const resultsList    = document.getElementById('results-list');
const suggestionsEl  = document.getElementById('search-suggestions');

let isSearching = false;
let scoreGen    = 0;
let lastSearchParams = null;  // Track last search for refresh

const updateSuggestions = debounce(async () => {
  const query = inputEl.value.trim();
  if (!suggestionsEl) return;

  if (query.length < 3) {
    suggestionsEl.innerHTML = '';
    return;
  }

  const suggestions = await fetchGeocodeSuggestions(query);
  suggestionsEl.innerHTML = suggestions
    .map(s => `<option value="${s.value.replace(/"/g, '&quot;')}"></option>`)
    .join('');
}, 220);

// ── Search input interactions ─────────────────────────────────────────────
inputEl.addEventListener('input', () => {
  clearBtn.classList.toggle('visible', inputEl.value.length > 0);
  updateSuggestions();
});
clearBtn.addEventListener('click', () => {
  inputEl.value = '';
  clearBtn.classList.remove('visible');
  if (suggestionsEl) suggestionsEl.innerHTML = '';
  inputEl.focus();
});
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') triggerTextSearch();
  if (e.key === 'Escape') {
    inputEl.value = '';
    clearBtn.classList.remove('visible');
  }
});

// ── Refresh button ──────────────────────────────────────────────────────────
refreshBtn.addEventListener('click', () => {
  if (lastSearchParams) {
    const { lat, lng, label, radiusKm } = lastSearchParams;
    runSearch(lat, lng, label, true, radiusKm);  // Force refresh
  }
});

// ── GPS button ────────────────────────────────────────────────────────────
gpsBtn.addEventListener('click', requestGPS);

function requestGPS() {
  if (!navigator.geolocation) return setStatus('Geolocation not supported.', 'error');
  gpsBtn.classList.add('loading');
  setStatus('Locating you…', 'loading');
  navigator.geolocation.getCurrentPosition(
    pos => {
      gpsBtn.classList.remove('loading');
      const { latitude: lat, longitude: lng } = pos.coords;
      inputEl.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      clearBtn.classList.add('visible');
      runSearch(lat, lng, 'your location');
    },
    err => {
      gpsBtn.classList.remove('loading');
      setStatus(
        err.code === 1 ? 'Location denied — try a place name below.' : 'Could not get location.',
        'error'
      );
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

// ── Popular spot chips ────────────────────────────────────────────────────
document.querySelectorAll('.popular-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const lat   = parseFloat(chip.dataset.lat);
    const lng   = parseFloat(chip.dataset.lng);
    const label = chip.textContent.trim();
    inputEl.value = label;
    clearBtn.classList.add('visible');
    runSearch(lat, lng, label);
  });
});

// ── Text search ───────────────────────────────────────────────────────────
async function triggerTextSearch() {
  const query = inputEl.value.trim();
  if (!query) { setStatus('Enter a lake, city, or place name.', 'error'); return; }
  setStatus('Finding location…', 'loading');

  // If user picked a suggested option, use that exact lat/lng instead of re-geocoding.
  const cachedSuggestions = suggestionCache.get(query.toLowerCase());
  if (cachedSuggestions?.length) {
    const exact = cachedSuggestions.find(s => s.value.toLowerCase() === query.toLowerCase());
    if (exact) {
      runSearch(exact.lat, exact.lng, exact.value, false, exact.radiusKm || 30);
      return;
    }
  }

  const geo = await geocode(query);
  if (!geo) {
    setStatus(`Couldn't find "${query}". Try a more specific name.`, 'error');
    return;
  }
  runSearch(geo.lat, geo.lng, geo.label, false, geo.radiusKm || 30);
}

// ── Core search ───────────────────────────────────────────────────────────
async function runSearch(lat, lng, label = 'this location', forceRefresh = false, radiusKm = 30) {
  if (isSearching) return;
  isSearching = true;
  lastSearchParams = { lat, lng, label, radiusKm };  // Track for refresh button
  
  setStatus(`Searching near ${label}…`, 'loading');
  resultsHeader.classList.remove('visible');
  resultsList.innerHTML = '';
  popularSection.style.display = 'none';
  refreshBtn.style.display = 'none';
  showSkeletons(6);

  try {
    const q   = encodeURIComponent(inputEl.value.trim());
    const refreshParam = forceRefresh ? '&refresh=1' : '';
    const radius = Math.max(10, Math.min(60, parseInt(radiusKm, 10) || 30));
    const res = await fetch(`${API_BASE}/nearbyWater?lat=${lat}&lng=${lng}&radius=${radius}&q=${q}${refreshParam}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();

    // Distinguish between different response states
    if (!data.success) {
      // API error
      resultsList.innerHTML = '';
      popularSection.style.display = '';
      refreshBtn.style.display = 'none';
      setStatus('Search failed — check connection and try again.', 'error');
      return;
    }

    if (data.status === 'no_results' || !data.waterBodies?.length) {
      // No water bodies found in radius (but search succeeded)
      resultsList.innerHTML = '';
      popularSection.style.display = '';
      refreshBtn.style.display = 'none';
      showEmpty(label);
      setStatus('', '');
      return;
    }

    if (data.status === 'found') {
      // Success — render results
      renderResults(data.waterBodies, label, data.cached, data.sources);
      return;
    }

    // Unknown status
    resultsList.innerHTML = '';
    popularSection.style.display = '';
    refreshBtn.style.display = 'none';
    setStatus('Search returned unexpected response.', 'error');

  } catch (err) {
    resultsList.innerHTML = '';
    popularSection.style.display = '';
    refreshBtn.style.display = 'none';
    setStatus('Search failed — check connection and try again.', 'error');
    console.error('Search error:', err);
  } finally {
    isSearching = false;
    setStatus('', '');
  }
}

// ── Render results ────────────────────────────────────────────────────────
function renderResults(bodies, label, cached, sources) {
  const gen = ++scoreGen;
  resultsList.innerHTML = '';

  const items = bodies.slice(0, 15);

  resultsCount.textContent = `${items.length} spot${items.length !== 1 ? 's' : ''} near ${label}`;
  
  // Show source info + cache status
  let sourceStr = '';
  if (sources && Array.isArray(sources) && sources.length > 0) {
    sourceStr = sources.map(s => s.toUpperCase()).join(' + ');
  }
  resultsHint.innerHTML = sourceStr ? 
    `<span class="source-badge">${sourceStr}</span>${cached ? '· cached' : '· live'}` : 
    (cached ? '· cached' : '· live');
  
  resultsHeader.classList.add('visible');
  refreshBtn.style.display = 'inline-flex';  // Show refresh button

  items.forEach((body, idx) => {
    const card   = document.createElement('div');
    card.className = 'water-card';
    card.style.animationDelay = `${idx * 35}ms`;
    card.role = 'option';
    card.tabIndex = 0;  // Keyboard accessible

    const scoreId = `sc-${gen}-${idx}`;
    const areaStr = body.areaKm2 ? ` · ${body.areaKm2} km²` : '';

    card.innerHTML = `
      <div class="water-card-info">
        <div class="water-card-name">${body.name}</div>
        <div class="water-card-meta">
          <span class="type-chip">${body.type}</span>
          <span>${body.distanceMiles} mi${areaStr}</span>
        </div>
      </div>
      <div id="${scoreId}"><div class="score-spinner"></div></div>
      <button class="btn-map material-icons" title="Open in Maps">place</button>
    `;

    card.querySelector('.btn-map').addEventListener('click', e => {
      e.stopPropagation();
      window.open(`https://www.google.com/maps/search/?api=1&query=${body.lat},${body.lng}`, '_blank');
    });
    
    card.addEventListener('click', () => openForecast(body));
    
    // Keyboard navigation: Enter to open, arrow keys to move
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        openForecast(body);
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const next = card.nextElementSibling;
        if (next) next.focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = card.previousElementSibling;
        if (prev) prev.focus();
      } else if (e.key === 'Escape') {
        inputEl.focus();
      }
    });
    
    resultsList.appendChild(card);
  });

  // Fetch all scores in batch, then fill in cards
  fetchBatchScores(items).then(scoreMap => {
    if (scoreGen !== gen || !scoreMap) {
      // Batch failed — fall back to individual fetches
      items.forEach((body, idx) => {
        const scoreId = `sc-${gen}-${idx}`;
        fetchScore(body.lat, body.lng).then(score => {
          if (scoreGen !== gen) return;
          const el = document.getElementById(scoreId);
          if (!el) return;
          el.innerHTML = score
            ? buildRing(score)
            : `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;color:#444;font-size:10px;font-family:'Josefin_Light',Arial,sans-serif">N/A</div>`;
        });
      });
      return;
    }

    // Batch succeeded — fill in all scores
    items.forEach((body, idx) => {
      const scoreId = `sc-${gen}-${idx}`;
      const key = `${body.lat.toFixed(6)},${body.lng.toFixed(6)}`;
      const score = scoreMap.get(key);
      
      const el = document.getElementById(scoreId);
      if (!el) return;
      
      el.innerHTML = score
        ? buildRing(Number(score).toFixed(1))
        : `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;color:#444;font-size:10px;font-family:'Josefin_Light',Arial,sans-serif">N/A</div>`;
    });
  });
}

// ── Fetch paddle scores (batch) ───────────────────────────────────────────
// Solves N+1 problem: 15 locations → 1 batch request instead of 15 individual calls
async function fetchBatchScores(bodies) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(
      `${API_BASE}/paddleScore/batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locations: bodies.map(b => ({ lat: b.lat, lng: b.lng }))
        }),
        signal: ctrl.signal
      }
    );
    clearTimeout(tid);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    
    // Map scores by lat,lng for quick lookup
    const scoreMap = new Map();
    data.scores.forEach(s => {
      const key = `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;
      scoreMap.set(key, s.rating ?? s.score ?? null);
    });
    return scoreMap;
  } catch { clearTimeout(tid); return null; }
}

// ── Fetch single score (fallback) ───────────────────────────────────────────
// Used only if batch fails or for individual spot detail pages
async function fetchScore(lat, lng) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res  = await fetch(`${API_BASE}/paddleScore?lat=${lat}&lng=${lng}`, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    const data = await res.json();
    const s = data.paddleScore?.rating ?? data.paddleScore ?? data.data?.paddleScore?.rating ?? data.score;
    if (s == null || isNaN(s)) return null;
    return Number(s).toFixed(1);
  } catch { clearTimeout(tid); return null; }
}

// ── Navigate to forecast page ─────────────────────────────────────────────
function openForecast(body) {
  const p = new URLSearchParams({ lat: body.lat, lng: body.lng, name: body.name });
  if (body.type) p.set('type', body.type);
  window.location.href = `/paddlingout/forecast?${p.toString()}`;
}

// ── Skeletons ─────────────────────────────────────────────────────────────
function showSkeletons(n) {
  resultsList.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'water-card skeleton';
    el.style.animationDelay = `${i * 40}ms`;
    el.innerHTML = `
      <div class="water-card-info">
        <div class="skel" style="width:${50 + Math.random() * 30}%;margin-bottom:8px"></div>
        <div class="skel" style="width:${30 + Math.random() * 20}%"></div>
      </div>
      <div class="score-spinner"></div>`;
    resultsList.appendChild(el);
  }
}

// ── Empty state ───────────────────────────────────────────────────────────
function showEmpty(label) {
  resultsList.innerHTML = `
    <div class="empty-state">
      <div class="mat material-icons">water_off</div>
      <h3>No spots found near ${label}</h3>
      <p>Try a larger lake name or a nearby city.</p>
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className   = 'search-status' + (type ? ` ${type}` : '');
}

// ── URL params: ?lat=33.1&lng=-96.7 ──────────────────────────────────────
(function checkUrlParams() {
  const p   = new URLSearchParams(window.location.search);
  const lat = parseFloat(p.get('lat'));
  const lng = parseFloat(p.get('lng'));
  if (!isNaN(lat) && !isNaN(lng)) {
    inputEl.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    clearBtn.classList.add('visible');
    runSearch(lat, lng, `${lat.toFixed(3)}, ${lng.toFixed(3)}`);
  }
})();

// ── Auto-detect on load (silent — don't prompt if already searching) ──────
window.addEventListener('DOMContentLoaded', () => {
  const p = new URLSearchParams(window.location.search);
  if (!p.has('lat') && !p.has('lng') && navigator.geolocation) {
    // Try silently — won't show prompt unless browser has prior permission
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (isSearching) return; // user already clicked something
        const { latitude: lat, longitude: lng } = pos.coords;
        inputEl.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        clearBtn.classList.add('visible');
        runSearch(lat, lng, 'your location');
      },
      () => { /* permission denied silently — user sees popular chips */ },
      { timeout: 3000, maximumAge: 300000 }
    );
  }
});
