/**
 * searchPage.js — full-page water body discovery
 * Handles /paddlingout/search.html
 */

const SEARCH_API_BASE = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  ? 'http://127.0.0.1:5001/kaaykostore/us-central1/api'
  : 'https://api-vwcc5j4qda-uc.a.run.app';

// ── Score colors (matches heatmap / homepage ring scale) ──────────────────
function scoreColor(score) {
  const s = parseFloat(score);
  if (s >= 4.5) return '#22C55E';
  if (s >= 4.0) return '#4ADE80';
  if (s >= 3.5) return '#CD853F';
  if (s >= 3.0) return '#E36414';
  if (s >= 2.5) return '#C0392B';
  if (s >= 2.0) return '#A01010';
  if (s >= 1.5) return '#8B1212';
  return '#6B0000';
}

function scoreLabel(score) {
  const s = parseFloat(score);
  if (s >= 4.5) return 'Excellent';
  if (s >= 4.0) return 'Great';
  if (s >= 3.5) return 'Good';
  if (s >= 3.0) return 'Fair';
  if (s >= 2.5) return 'Risky';
  if (s >= 2.0) return 'Poor';
  if (s >= 1.5) return 'Danger';
  return 'Critical';
}

// ── Build mini SVG donut ring ─────────────────────────────────────────────
function buildScoreRing(score) {
  if (!score) {
    return `<div class="water-score-loading">◌</div>`;
  }
  const r = 20, cx = 26, cy = 26;
  const circ  = +(2 * Math.PI * r).toFixed(1);
  const pct   = Math.max(0, Math.min(1, parseFloat(score) / 5));
  const fill  = +(pct * circ).toFixed(1);
  const offset = +(-circ / 4).toFixed(1);
  const color  = scoreColor(score);

  return `
    <div class="water-score-wrap">
      <svg class="water-score-svg" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
        <circle class="water-score-track" cx="${cx}" cy="${cy}" r="${r}"/>
        <circle class="water-score-fill"
          cx="${cx}" cy="${cy}" r="${r}"
          stroke="${color}"
          stroke-dasharray="${fill} ${circ}"
          stroke-dashoffset="${offset}"/>
      </svg>
      <div class="water-score-label" style="color:${color}">${score}</div>
    </div>
  `;
}

// ── DOM refs ──────────────────────────────────────────────────────────────
const btnLocation  = document.getElementById('btn-use-location');
const btnSearch    = document.getElementById('btn-search');
const inpLat       = document.getElementById('inp-lat');
const inpLng       = document.getElementById('inp-lng');
const errorEl      = document.getElementById('search-error');
const loadingEl    = document.getElementById('search-loading');
const loadingBar   = document.getElementById('loading-bar');
const resultsSec   = document.getElementById('results-section');
const resultsList  = document.getElementById('results-list');
const resultsCount = document.getElementById('results-count');
const resultsLoc   = document.getElementById('results-location');

let isSearching    = false;
let scoreGeneration = 0;

// ── UI helpers ────────────────────────────────────────────────────────────
function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
}
function hideError() { errorEl.style.display = 'none'; }

function setLoading(on) {
  loadingEl.style.display = on ? 'block' : 'none';
  loadingBar.style.width  = on ? '60%' : '100%';
  btnSearch.disabled = on;
  btnLocation.disabled = on;
  if (!on) setTimeout(() => { loadingBar.style.width = '0%'; loadingEl.style.display = 'none'; }, 400);
}

// ── Use current location ──────────────────────────────────────────────────
btnLocation.addEventListener('click', () => {
  if (!navigator.geolocation) return showError('Geolocation not supported by this browser.');
  hideError();
  setLoading(true);
  navigator.geolocation.getCurrentPosition(
    pos => {
      inpLat.value = pos.coords.latitude.toFixed(6);
      inpLng.value = pos.coords.longitude.toFixed(6);
      setLoading(false);
      runSearch(pos.coords.latitude, pos.coords.longitude);
    },
    err => {
      setLoading(false);
      showError('Could not get your location. Enter coordinates manually.');
    },
    { timeout: 8000 }
  );
});

// ── Manual search ─────────────────────────────────────────────────────────
btnSearch.addEventListener('click', () => {
  const lat = parseFloat(inpLat.value);
  const lng = parseFloat(inpLng.value);
  if (isNaN(lat) || lat < -90 || lat > 90) return showError('Latitude must be between −90 and 90.');
  if (isNaN(lng) || lng < -180 || lng > 180) return showError('Longitude must be between −180 and 180.');
  hideError();
  runSearch(lat, lng);
});

// Enter key in coord fields
[inpLat, inpLng].forEach(el => el.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnSearch.click();
}));

// ── Core search ───────────────────────────────────────────────────────────
async function runSearch(lat, lng) {
  if (isSearching) return;
  isSearching = true;
  setLoading(true);
  hideError();
  resultsSec.classList.remove('visible');

  try {
    const url = `${SEARCH_API_BASE}/nearbyWater?lat=${lat}&lng=${lng}&radius=50&nocache=1`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();

    if (!data.success || !data.waterBodies?.length) {
      showError('No water bodies found nearby. Try a different location or check back shortly.');
      return;
    }

    renderResults(data.waterBodies, lat, lng);
  } catch (err) {
    if (err.name === 'TimeoutError') {
      showError('Search timed out. The water body database can be slow — please try again.');
    } else {
      showError('Search failed. Check your connection and try again.');
    }
    console.error('Search error:', err);
  } finally {
    isSearching = false;
    setLoading(false);
  }
}

// ── Render results ────────────────────────────────────────────────────────
function renderResults(bodies, searchLat, searchLng) {
  // Filter & sort
  const filtered = bodies
    .filter(b => {
      if (b.distanceMiles > 30 && (!b.relevancy || b.relevancy < 60)) return false;
      if (b.type === 'Pond' && b.distanceMiles > 8 && (!b.relevancy || b.relevancy < 50)) return false;
      if (b.access === 'private' || b.access === 'no') return false;
      return true;
    })
    .sort((a, b) => {
      if (a.relevancy && b.relevancy) return b.relevancy - a.relevancy;
      return a.distanceMiles - b.distanceMiles;
    })
    .slice(0, 15);

  const gen = ++scoreGeneration;

  resultsList.innerHTML = '';
  resultsCount.textContent = `${filtered.length} paddle spot${filtered.length !== 1 ? 's' : ''} found`;
  resultsLoc.textContent   = `near ${searchLat.toFixed(3)}, ${searchLng.toFixed(3)}`;
  resultsSec.classList.add('visible');

  filtered.forEach((body, idx) => {
    const card = document.createElement('div');
    card.className = 'water-card';

    const features = body.paddlingFeatures || {};
    const badges   = [];
    if (features.boatLaunch)                            badges.push('Launch');
    if (features.boatRental)                            badges.push('Rental');
    if (features.canoeAccess || features.kayakAccess)  badges.push('Paddle Access');
    if (features.publicAccess || body.access === 'public') badges.push('Public');
    if (body.publicLand)                                badges.push(body.publicLand.name);

    let meta = `${body.type} · ${body.distanceMiles} mi`;
    if (body.areaKm2 > 1) meta += ` · ${body.areaKm2} km²`;

    const scoreId = `ws-${gen}-${idx}`;
    card.innerHTML = `
      <div class="water-card-info">
        <h3>${body.name}</h3>
        <div class="water-card-meta">${meta}</div>
        ${badges.length ? `<div class="water-card-badges">${badges.map(b => `<span class="badge">${b}</span>`).join('')}</div>` : ''}
      </div>
      <div id="${scoreId}"><div class="water-score-loading">◌</div></div>
      <button class="btn-map-action" title="Open in Maps">
        <span class="material-icons" style="font-size:18px">place</span>
      </button>
    `;

    card.querySelector('.btn-map-action').addEventListener('click', e => {
      e.stopPropagation();
      window.open(`https://www.google.com/maps/search/?api=1&query=${body.lat},${body.lng}`, '_blank');
    });

    card.addEventListener('click', () => openForecast(body));
    resultsList.appendChild(card);

    // Fetch score reactively
    fetchScore(body.lat, body.lng).then(score => {
      if (scoreGeneration !== gen) return;
      const el = document.getElementById(scoreId);
      if (!el) return;
      el.innerHTML = buildScoreRing(score);
      body.score = score;
    });
  });
}

// ── Fetch single score with real timeout ──────────────────────────────────
async function fetchScore(lat, lng) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 5000);
  try {
    const res  = await fetch(`${SEARCH_API_BASE}/paddleScore?lat=${lat}&lng=${lng}`, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    const data  = await res.json();
    const score = data.paddleScore?.rating ?? data.paddleScore ?? data.data?.paddleScore?.rating ?? data.score;
    if (score == null || isNaN(score)) return null;
    return Number(score).toFixed(1);
  } catch {
    clearTimeout(tid);
    return null;
  }
}

// ── Open full forecast modal ──────────────────────────────────────────────
function openForecast(body) {
  if (!window.advancedModal) return;
  window.advancedModal.open({
    title: body.name,
    subtitle: `${body.type} · ${body.distanceMiles} mi away`,
    isCustom: true,
    location: { latitude: body.lat, longitude: body.lng }
  });
}

// ── Pre-fill from URL params (/paddlingout/search?lat=33.1&lng=-96.7) ─────
(function checkUrlParams() {
  const p   = new URLSearchParams(window.location.search);
  const lat = parseFloat(p.get('lat'));
  const lng = parseFloat(p.get('lng'));
  if (!isNaN(lat) && !isNaN(lng)) {
    inpLat.value = lat;
    inpLng.value = lng;
    runSearch(lat, lng);
  }
})();
