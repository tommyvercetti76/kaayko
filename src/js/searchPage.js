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
// Single source of truth — tiers match the verdict label + legend (>=3.7 / >=2.7)
function scoreColor(s) { return window.KaaykoPrefs.paddleScoreColor(s); }

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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Nominatim geocode cache ───────────────────────────────────────────────
const geocodeCache = new Map(); // query -> { lat, lng, label, radiusKm }
const suggestionCache = new Map(); // query -> [suggestions]
const suggestionChoiceCache = new Map(); // label -> { lat, lng, radiusKm }

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
    // Cached server-side proxy (keeps users off Nominatim's per-IP rate limit).
    const res  = await fetch(
      `${API_BASE}/paddlingOut/geocode?q=${encodeURIComponent(query)}&limit=1`,
      { signal: ctrl.signal }
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

function scoreSuggestion(item, query) {
  const q = query.toLowerCase();
  const text = `${item.display_name || ''} ${(item.class || '')} ${(item.type || '')}`.toLowerCase();
  const type = (item.type || '').toLowerCase();
  const cls = (item.class || '').toLowerCase();

  let score = Number(item.importance || 0) * 40;

  if (['water', 'lake', 'reservoir', 'river', 'bay', 'canal'].includes(type)) score += 40;
  if (cls === 'natural' || cls === 'waterway') score += 30;
  if (text.includes('lake') || text.includes('reservoir') || text.includes('river')) score += 25;

  if (['city', 'town', 'village', 'administrative'].includes(type)) score += 18;

  if (['road', 'house', 'residential', 'postcode'].includes(type)) score -= 35;

  const qTokens = q.split(/\s+/).filter(t => t.length > 2);
  const tokenMatches = qTokens.filter(t => text.includes(t)).length;
  score += tokenMatches * 8;

  return score;
}

async function fetchGeocodeSuggestions(query) {
  const q = query.toLowerCase().trim();
  if (q.length < 3) return [];
  if (suggestionCache.has(q)) return suggestionCache.get(q);

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(
      `${API_BASE}/paddlingOut/geocode?q=${encodeURIComponent(query)}&limit=5`,
      { signal: ctrl.signal }
    );
    clearTimeout(tid);
    if (!res.ok) return [];

    const data = await res.json();
    const suggestions = (data || [])
      .map(item => ({
        value: item.display_name.split(',').slice(0, 3).join(', '),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        radiusKm: inferSearchRadiusKm(item),
        _rank: scoreSuggestion(item, query)
      }))
      .sort((a, b) => b._rank - a._rank)
      .slice(0, 6)
      .map(({ _rank, ...rest }) => rest);

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

// ── Kaayko covered spots (matched first) ───────────────────────────────────
// Load the curated spot list once so a search for a spot we already cover
// surfaces our own forecast instantly, above the general nearby-water results.
let COVERED_SPOTS = [];
async function loadCoveredSpots() {
  try {
    const res = await fetch(`${API_BASE}/paddlingOut`);
    if (!res.ok) return;
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data.data || data.spots || []);
    COVERED_SPOTS = list.map(s => {
      const loc = s.location || {};
      return {
        id: s.id,
        // `title` is the display name ("White Rock Lake"); `lakeName` is the slug.
        name: s.title || s.lakeName || s.id || '',
        subtitle: s.subtitle || '',
        lat: Number(loc.latitude ?? s.lat),
        lng: Number(loc.longitude ?? s.lng)
      };
    }).filter(s => s.name && Number.isFinite(s.lat) && Number.isFinite(s.lng));
    // If a search already ran before the list loaded (auto-load path), refresh
    // the covered card now that we can match.
    const q = inputEl.value.trim();
    if (q) renderCovered(matchCovered(q));
  } catch { /* covered-spot matching is a bonus — ignore failures */ }
}

function matchCovered(query) {
  const q = String(query || '').toLowerCase().trim();
  if (q.length < 2 || !COVERED_SPOTS.length) return [];
  const toks = q.split(/\s+/).filter(Boolean);
  return COVERED_SPOTS
    .map(s => {
      const name = s.name.toLowerCase();
      const hay = (s.name + ' ' + s.subtitle).toLowerCase();
      let score = 0;
      if (name.startsWith(q)) score += 100;
      else if (name.includes(q)) score += 60;
      const matched = toks.filter(t => hay.includes(t)).length;
      score += matched * 20;
      return { s, score, all: matched === toks.length };
    })
    .filter(x => x.score > 0 && x.all)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(x => x.s);
}

function coveredSection() {
  let el = document.getElementById('covered-section');
  if (!el) {
    el = document.createElement('div');
    el.id = 'covered-section';
    el.className = 'covered-section';
    // Directly under the search bar, so a spot we cover is the first thing shown.
    statusEl.parentNode.insertBefore(el, statusEl.nextSibling);
  }
  return el;
}
function clearCovered() {
  const el = document.getElementById('covered-section');
  if (el) { el.innerHTML = ''; el.classList.remove('visible'); }
}
function renderCovered(spots) {
  const el = coveredSection();
  if (!spots.length) { clearCovered(); return; }
  el.innerHTML = `<div class="covered-head">Kaayko spots</div>` + spots.map(s => `
    <div class="covered-card" tabindex="0" role="button"
         data-lat="${s.lat}" data-lng="${s.lng}" data-name="${escapeHtml(s.name)}">
      <div class="covered-info">
        <div class="covered-name">${escapeHtml(s.name)}</div>
        ${s.subtitle ? `<div class="covered-sub">${escapeHtml(s.subtitle)}</div>` : ''}
      </div>
      <span class="covered-badge">✓ We cover this</span>
    </div>`).join('');
  el.classList.add('visible');
  el.querySelectorAll('.covered-card').forEach((card, i) => {
    const s = spots[i];
    // Navigate by id (same as the map pin) so the forecast page + favorite ★ stay
    // consistent — a lat/lng nav would synthesize a throwaway custom_ id instead.
    const go = () => {
      if (s && s.id) window.location.href = '/paddlingout/forecast?id=' + encodeURIComponent(s.id);
      else openForecast({ lat: Number(card.dataset.lat), lng: Number(card.dataset.lng), name: card.dataset.name });
    };
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    // Favorite ★ for covered lakes (needs a spot id)
    if (window.KaaykoPrefs && s && s.id) {
      const fav = window.KaaykoPrefs.makeFavButton(
        { id: s.id, title: s.name, subtitle: s.subtitle || '' },
        { className: 'covered-fav' }
      );
      card.insertBefore(fav, card.querySelector('.covered-badge'));
    }
  });
}
const coveredReady = loadCoveredSpots();  // awaited by runSearch before rendering

// ── Map of found lakes (score-colored pins) ────────────────────────────────
let searchMap = null, pinLayer = null;
function ensureMap() {
  const wrap = document.getElementById('search-map-wrap');
  const el = document.getElementById('search-map');
  if (!el || typeof L === 'undefined') return null;
  wrap.hidden = false;
  if (!searchMap) {
    // Buttery interaction: scroll/pinch zoom + inertia drag on, smooth animations.
    searchMap = L.map(el, {
      scrollWheelZoom: true,
      wheelPxPerZoomLevel: 110,
      zoomControl: true,
      zoomAnimation: true,
      fadeAnimation: true,
      inertia: true
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(searchMap);
    pinLayer = L.layerGroup().addTo(searchMap);
    searchMap.setView([39.5, -98.35], 4);
    wireSearchHere();
  }
  showSearchHere();
  setTimeout(() => searchMap.invalidateSize(), 120);
  return searchMap;
}
function hideMap() { const w = document.getElementById('search-map-wrap'); if (w) w.hidden = true; }

// "Search this area" — lets users pan/zoom the map and rediscover lakes at the
// new centre without typing. Radius is derived from what's currently on screen.
let searchHereWired = false;
function showSearchHere() { const b = document.getElementById('search-here-btn'); if (b) b.hidden = false; }
function wireSearchHere() {
  if (searchHereWired) return;
  const btn = document.getElementById('search-here-btn');
  if (!btn) return;
  searchHereWired = true;
  btn.addEventListener('click', () => {
    if (!searchMap) return;
    const c = searchMap.getCenter();
    let radiusKm = 30;
    try {
      const ne = searchMap.getBounds().getNorthEast();
      radiusKm = Math.round(searchMap.distance(c, ne) / 1000);   // centre → corner
    } catch {}
    radiusKm = Math.max(10, Math.min(60, radiusKm || 30));       // runSearch clamps too
    btn.classList.add('busy');
    Promise.resolve(runSearch(c.lat, c.lng, 'this area', true, radiusKm))
      .finally(() => btn.classList.remove('busy'));
  });
}
function scorePinIcon(score, covered) {
  const s = (score != null && !isNaN(score)) ? Number(score).toFixed(1) : null;
  const bg = covered ? '#b5935a' : (s != null ? scoreColor(s) : '#555');
  const label = covered ? '◆' : (s != null ? s : '–');
  return L.divIcon({
    className: '',
    html: `<div class="score-pin${covered ? ' cover' : ''}" style="background:${bg}"><span>${label}</span></div>`,
    iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28]
  });
}
function renderMapPins(bodies, covered, scoreMap) {
  const map = ensureMap();
  if (!map) return;
  pinLayer.clearLayers();
  const pts = [];
  // Tapping a pin takes you straight to that lake. Name shows on hover/long-press.
  (covered || []).forEach(s => {
    const url = s.id
      ? `/paddlingout/forecast?id=${encodeURIComponent(s.id)}`
      : `/paddlingout/forecast?${new URLSearchParams({ lat: s.lat, lng: s.lng, name: s.name }).toString()}`;
    pinLayer.addLayer(
      L.marker([s.lat, s.lng], { icon: scorePinIcon(null, true), title: s.name, keyboard: true })
        .bindTooltip(`${s.name} · we cover this`, { direction: 'top', offset: [0, -30], opacity: 0.96 })
        .on('click', () => { window.location.href = url; })
    );
    pts.push([s.lat, s.lng]);
  });
  (bodies || []).forEach(b => {
    if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) return;
    const score = scoreMap && scoreMap.get(`${b.lat.toFixed(6)},${b.lng.toFixed(6)}`);
    const lab = scoreLabel(score);
    const tip = `${b.name}${lab ? ' · ' + lab : ''} · tap to open`;
    pinLayer.addLayer(
      L.marker([b.lat, b.lng], { icon: scorePinIcon(score, false), title: b.name, keyboard: true })
        .bindTooltip(tip, { direction: 'top', offset: [0, -30], opacity: 0.96 })
        .on('click', () => openForecast({ name: b.name, lat: b.lat, lng: b.lng, type: b.type }))
    );
    pts.push([b.lat, b.lng]);
  });
  // The wrap may have just un-hidden — settle the container size BEFORE fitting
  // bounds / requesting tiles, or Leaflet only paints a partial tile grid.
  setTimeout(() => {
    map.invalidateSize();
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 12 });
  }, 180);
}

// ── Lock my city (saved area, localStorage only) ───────────────────────────
const MY_AREA_KEY = 'kaayko_my_area';
function getSavedArea() {
  try { return JSON.parse(localStorage.getItem(MY_AREA_KEY) || 'null'); } catch { return null; }
}
function saveArea() {
  if (lastSearchParams) { try { localStorage.setItem(MY_AREA_KEY, JSON.stringify(lastSearchParams)); } catch {} }
  updateSaveAreaUI();
}
function clearArea() { try { localStorage.removeItem(MY_AREA_KEY); } catch {} updateSaveAreaUI(); }
function updateSaveAreaUI() {
  const saved = getSavedArea();
  const btn = document.getElementById('save-area-btn');
  const chip = document.getElementById('my-area-chip');
  const label = document.getElementById('my-area-label');
  const isSaved = !!(saved && lastSearchParams &&
    Math.abs(saved.lat - lastSearchParams.lat) < 1e-4 && Math.abs(saved.lng - lastSearchParams.lng) < 1e-4);
  if (btn) {
    btn.style.display = lastSearchParams ? 'inline-flex' : 'none';
    btn.classList.toggle('saved', isSaved);
    const ic = btn.querySelector('.material-icons'); if (ic) ic.textContent = isSaved ? 'star' : 'star_border';
    btn.title = isSaved ? 'Saved as my area (tap to remove)' : 'Save this as my area';
  }
  if (chip && label) {
    if (saved && saved.label) { label.textContent = saved.label; chip.classList.add('visible'); }
    else chip.classList.remove('visible');
  }
}
document.getElementById('save-area-btn')?.addEventListener('click', () => {
  const saved = getSavedArea();
  const isSaved = saved && lastSearchParams &&
    Math.abs(saved.lat - lastSearchParams.lat) < 1e-4 && Math.abs(saved.lng - lastSearchParams.lng) < 1e-4;
  isSaved ? clearArea() : saveArea();
});
document.getElementById('my-area-change')?.addEventListener('click', () => {
  clearArea();
  inputEl.value = '';
  inputEl.focus();
});

// ── Canonical Paddle Score labels (match paddlingout.js getScoreSeverity) ────
function scoreLabel(score) {
  const v = parseFloat(score);
  if (isNaN(v)) return '';
  return v >= 3.7 ? 'Worth it' : v >= 2.7 ? 'Careful' : 'Hard pass';
}

// ── Covered-spot cross-reference (so a lake we cover never reads as generic) ─
function haversineMi(aLat, aLng, bLat, bLng) {
  const R = 3958.8, dLat = (bLat - aLat) * Math.PI / 180, dLng = (bLng - aLng) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * Math.PI / 180) * Math.cos(bLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function coveredWithin(lat, lng, radiusKm) {
  const mi = (Number(radiusKm) || 30) * 0.621371;
  return COVERED_SPOTS
    .filter(s => haversineMi(lat, lng, s.lat, s.lng) <= mi)
    .sort((a, b) => haversineMi(lat, lng, a.lat, a.lng) - haversineMi(lat, lng, b.lat, b.lng));
}
function normName(n) { return String(n || '').toLowerCase().replace(/\s+(lake|reservoir|river)$/,'').trim(); }
function bodyIsCovered(body, coveredList) {
  const bn = normName(body.name);
  return coveredList.some(c => {
    const d = haversineMi(body.lat, body.lng, c.lat, c.lng);
    if (d < 2) return true;                                  // same water body
    const cn = normName(c.name);
    return d < 12 && cn && bn && (cn === bn || cn.includes(bn) || bn.includes(cn));
  });
}

const updateSuggestions = debounce(async () => {
  const query = inputEl.value.trim();
  if (!suggestionsEl) return;

  if (query.length < 3) {
    suggestionsEl.innerHTML = '';
    return;
  }

  const suggestions = await fetchGeocodeSuggestions(query);
  suggestionChoiceCache.clear();
  suggestions.forEach(s => {
    suggestionChoiceCache.set(s.value.toLowerCase(), {
      lat: s.lat,
      lng: s.lng,
      radiusKm: s.radiusKm || 30
    });
  });

  // Our own covered spots first, then geocoded places.
  const coveredOpts = matchCovered(query).map(s => {
    suggestionChoiceCache.set(s.name.toLowerCase(), { lat: s.lat, lng: s.lng, radiusKm: 25 });
    return `<option value="${s.name.replace(/"/g, '&quot;')}"></option>`;
  });
  suggestionsEl.innerHTML = coveredOpts
    .concat(suggestions.map(s => `<option value="${s.value.replace(/"/g, '&quot;')}"></option>`))
    .join('');
}, 500);

// ── Search input interactions ─────────────────────────────────────────────
inputEl.addEventListener('input', () => {
  clearBtn.classList.toggle('visible', inputEl.value.length > 0);
  updateSuggestions();
});
clearBtn.addEventListener('click', () => {
  inputEl.value = '';
  clearBtn.classList.remove('visible');
  if (suggestionsEl) suggestionsEl.innerHTML = '';
  clearCovered();
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
      clearCovered();
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
    clearCovered();
    runSearch(lat, lng, label);
  });
});

// ── Text search ───────────────────────────────────────────────────────────
async function triggerTextSearch() {
  const query = inputEl.value.trim();
  if (!query) { setStatus('Enter a lake, city, or place name.', 'error'); return; }
  const coveredNow = matchCovered(query);      // instant: spots we already cover
  renderCovered(coveredNow);
  if (coveredNow.length) renderMapPins([], coveredNow, null);  // drop covered pins now; nearby fill in when ready
  setStatus('Finding location…', 'loading');

  // If user picked a suggested option, use that exact lat/lng instead of re-geocoding.
  const exact = suggestionChoiceCache.get(query.toLowerCase());
  if (exact) {
    runSearch(exact.lat, exact.lng, query, false, exact.radiusKm || 30);
    return;
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
  updateSaveAreaUI();  // reveal the ★ save-my-area control
  await coveredReady;  // ensure covered-spot list is loaded before we cross-reference
  
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
      popularSection.style.display = ''; hideMap();
      refreshBtn.style.display = 'none';
      setStatus('Search failed — check connection and try again.', 'error');
      return;
    }

    if (data.status === 'no_results' || !data.waterBodies?.length) {
      // No water bodies found in radius (but search succeeded)
      resultsList.innerHTML = '';
      popularSection.style.display = ''; hideMap();
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
    popularSection.style.display = ''; hideMap();
    refreshBtn.style.display = 'none';
    setStatus('Search returned unexpected response.', 'error');

  } catch (err) {
    resultsList.innerHTML = '';
    popularSection.style.display = ''; hideMap();
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

  // Spots we already cover near this search — rendered as covered (link to their
  // forecast) and removed from the generic list, so a covered lake (e.g.
  // Lewisville) never shows a "Request" CTA or appears twice.
  const coveredNear = lastSearchParams
    ? coveredWithin(lastSearchParams.lat, lastSearchParams.lng, lastSearchParams.radiusKm)
    : [];
  renderCovered(coveredNear);

  const items = bodies.slice(0, 15).filter(b => !bodyIsCovered(b, coveredNear));

  const noun = items.length !== 1 ? 'spots' : 'spot';
  resultsCount.textContent = items.length
    ? `${items.length} ${coveredNear.length ? 'more ' : ''}${noun} near ${label}`
    : (coveredNear.length ? `Spots we cover near ${label}` : `No spots near ${label}`);
  
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
    // Area + distance follow the global unit preference (shared formatters)
    const areaStr = body.areaKm2 ? ` · ${window.KaaykoPrefs.fmtArea(body.areaKm2)}` : '';
    // distanceMiles is supplied in miles by the API; fmtDist takes km, so convert first
    const distKm = parseFloat(body.distanceMiles) * 1.60934;
    const distStr = window.KaaykoPrefs.fmtDist(distKm);
    const bodyName = escapeHtml(body.name);
    const bodyType = escapeHtml(body.type);
    const bodyDistance = escapeHtml(distStr);
    const bodyArea = escapeHtml(areaStr);

    card.innerHTML = `
      <div class="water-card-info">
        <div class="water-card-name">${bodyName}</div>
        <div class="water-card-meta">
          <span class="type-chip">${bodyType}</span>
          <span>${bodyDistance}${bodyArea}</span>
        </div>
      </div>
      <div id="${scoreId}"><div class="score-spinner"></div></div>
      <button class="btn-request-lake" type="button">Request</button>
      <button class="btn-map material-icons" title="Open in Maps">place</button>
    `;

    card.querySelector('.btn-request-lake').addEventListener('click', e => {
      e.stopPropagation();
      openLakeRequestModal(body);
    });

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

  const coveredForMap = coveredNear;   // proximity-matched covered spots (computed above)

  // Fetch all scores in batch, then fill in cards
  fetchBatchScores(items).then(scoreMap => {
    if (scoreGen !== gen || !scoreMap) {
      // Batch failed — fall back to individual fetches
      renderMapPins(items, coveredForMap, null);
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

    renderMapPins(items, coveredForMap, scoreMap);

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

function openLakeRequestModal(body = null) {
  const params = new URLSearchParams();
  if (body) {
    if (body.name) params.set('name', body.name);
    if (body.type) params.set('type', body.type);
    if (body.lat != null) params.set('lat', body.lat);
    if (body.lng != null) params.set('lng', body.lng);
  } else {
    const query = inputEl.value.trim();
    if (query) params.set('name', query);
    if (lastSearchParams?.lat != null) params.set('lat', lastSearchParams.lat);
    if (lastSearchParams?.lng != null) params.set('lng', lastSearchParams.lng);
    if (lastSearchParams?.label) params.set('place', lastSearchParams.label);
  }
  window.location.href = `/paddlingout/submitentry${params.toString() ? '?' + params.toString() : ''}`;
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
  const safeLabel = escapeHtml(label);
  resultsList.innerHTML = `
    <div class="empty-state">
      <div class="mat material-icons">water_off</div>
      <h3>No spots found near ${safeLabel}</h3>
      <p>Try a larger lake name or a nearby city.</p>
      <button class="btn-request-lake" id="empty-request-lake" type="button">Submit a lake</button>
    </div>`;
  document.getElementById('empty-request-lake')?.addEventListener('click', () => openLakeRequestModal(null));
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
  const q   = (p.get('q') || '').trim();
  if (!isNaN(lat) && !isNaN(lng)) {
    inputEl.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    clearBtn.classList.add('visible');
    runSearch(lat, lng, `${lat.toFixed(3)}, ${lng.toFixed(3)}`);
  } else if (q) {
    inputEl.value = q;
    clearBtn.classList.add('visible');
    triggerTextSearch();
  } else {
    // No URL target — if the visitor locked a city before, open straight to it
    // (their saved area; no GPS prompt, no re-typing).
    const saved = getSavedArea();
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) {
      inputEl.value = saved.label || `${saved.lat.toFixed(4)}, ${saved.lng.toFixed(4)}`;
      clearBtn.classList.add('visible');
      runSearch(saved.lat, saved.lng, saved.label || 'your area', false, saved.radiusKm || 30);
    }
  }
  updateSaveAreaUI();
})();

// Location is opt-in: we do NOT auto-request GPS on load (that shows an
// immediate permission prompt on first visit). Visitors choose it via the
// "Use my location" button, type a place, or tap a popular spot. If the page
// was opened with ?lat/lng or ?q, checkUrlParams above already searched.
