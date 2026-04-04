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
  if (v >= 4.5) return '#22C55E'; // vivid green
  if (v >= 4.0) return '#4ADE80'; // light green
  if (v >= 3.5) return '#D97706'; // amber
  if (v >= 3.0) return '#F97316'; // orange
  if (v >= 2.5) return '#EF4444'; // vivid red
  if (v >= 2.0) return '#DC2626'; // medium red
  if (v >= 1.5) return '#EF4444'; // vivid red — max visibility for dangerous scores
  return '#FF2D20';               // alarm red
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

// ── Nominatim geocode ─────────────────────────────────────────────────────
async function geocode(query) {
  try {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), 8000);
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { signal: ctrl.signal, headers: { 'User-Agent': 'Kaayko/1.0', 'Accept-Language': 'en' } }
    );
    clearTimeout(tid);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      label: data[0].display_name.split(',').slice(0, 2).join(', ')
    };
  } catch { return null; }
}

// ── DOM refs ──────────────────────────────────────────────────────────────
const inputEl        = document.getElementById('search-input');
const clearBtn       = document.getElementById('search-clear');
const gpsBtn         = document.getElementById('btn-gps');
const statusEl       = document.getElementById('search-status');
const popularSection = document.getElementById('popular-section');
const resultsHeader  = document.getElementById('results-header');
const resultsCount   = document.getElementById('results-count');
const resultsHint    = document.getElementById('results-hint');
const resultsList    = document.getElementById('results-list');

let isSearching = false;
let scoreGen    = 0;

// ── Search input interactions ─────────────────────────────────────────────
inputEl.addEventListener('input', () => {
  clearBtn.classList.toggle('visible', inputEl.value.length > 0);
});
clearBtn.addEventListener('click', () => {
  inputEl.value = '';
  clearBtn.classList.remove('visible');
  inputEl.focus();
});
inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter') triggerTextSearch();
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
  const geo = await geocode(query);
  if (!geo) {
    setStatus(`Couldn't find "${query}". Try a more specific name.`, 'error');
    return;
  }
  runSearch(geo.lat, geo.lng, geo.label);
}

// ── Core search ───────────────────────────────────────────────────────────
async function runSearch(lat, lng, label = 'this location') {
  if (isSearching) return;
  isSearching = true;
  setStatus(`Searching near ${label}…`, 'loading');
  resultsHeader.classList.remove('visible');
  resultsList.innerHTML = '';
  popularSection.style.display = 'none';
  showSkeletons(6);

  try {
    const q   = encodeURIComponent(inputEl.value.trim());
    const res = await fetch(`${API_BASE}/nearbyWater?lat=${lat}&lng=${lng}&radius=30&q=${q}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();

    if (!data.success || !data.waterBodies?.length) {
      resultsList.innerHTML = '';
      popularSection.style.display = '';
      showEmpty(label);
      setStatus('', '');
      return;
    }

    renderResults(data.waterBodies, label, data.cached);

  } catch (err) {
    resultsList.innerHTML = '';
    popularSection.style.display = '';
    setStatus('Search failed — check connection and try again.', 'error');
    console.error('Search error:', err);
  } finally {
    isSearching = false;
    setStatus('', '');
  }
}

// ── Render results ────────────────────────────────────────────────────────
function renderResults(bodies, label, cached) {
  const gen = ++scoreGen;
  resultsList.innerHTML = '';

  const items = bodies.slice(0, 15);

  resultsCount.textContent = `${items.length} spot${items.length !== 1 ? 's' : ''} near ${label}`;
  resultsHint.textContent  = cached ? '· cached' : '· live';
  resultsHeader.classList.add('visible');

  items.forEach((body, idx) => {
    const card   = document.createElement('div');
    card.className = 'water-card';
    card.style.animationDelay = `${idx * 35}ms`;

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
    resultsList.appendChild(card);

    // Fetch score reactively
    fetchScore(body.lat, body.lng).then(score => {
      if (scoreGen !== gen) return;
      const el = document.getElementById(scoreId);
      if (!el) return;
      el.innerHTML = score
        ? buildRing(score)
        : `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;color:#444;font-size:10px;font-family:'Josefin_Light',Arial,sans-serif">N/A</div>`;
    });
  });
}

// ── Fetch paddle score ────────────────────────────────────────────────────
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

// ── Open forecast modal ───────────────────────────────────────────────────
function openForecast(body) {
  if (!window.advancedModal) return;
  window.advancedModal.open({
    title: body.name,
    subtitle: `${body.type} · ${body.distanceMiles} mi away`,
    isCustom: true,
    location: { latitude: body.lat, longitude: body.lng }
  });
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
