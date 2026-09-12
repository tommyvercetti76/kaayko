/**
 * pages/rate.js — controller for /paddlingout/rate
 * Extracted from the page 12 Sep 2026. Depends on prod-config, prefs, util, PoHeader (loaded before).
 */
/* ═══════════════════════════════════════════════════════════════════════════
   Rate My Paddle — Client Logic
   ═══════════════════════════════════════════════════════════════════════════ */

const API_BASE = (window.KaaykoUtil ? window.KaaykoUtil.apiBase() : (window.KAAYKO_API_BASE || '/api'));
const STORAGE_PREFIX = 'kaayko_rate_';
const UPDATE_WINDOW_MS = 2 * 60 * 60 * 1000;

/* ── State ────────────────────────────────────────────────────────────────── */
let spotId = null;
let lakeData = null;
let weatherData = null;
let predictedScore = null;
let selectedRating = null;
let selectedChips = new Set();
let profileState = { skill: 'beginner', craft: 'kayak', group: 'solo' };
let gpsCoords = null;
let gpsVerified = false;
let existingRating = null;
let deviceFp = null;

/* ── Device fingerprint (stable per device) ──────────────────────────────── */
function generateFingerprint() {
  const parts = [
    screen.width, screen.height, screen.colorDepth,
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.maxTouchPoints || 0,
    navigator.hardwareConcurrency || 0,
  ];
  let hash = 0;
  const str = parts.join('|');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return 'fp_' + Math.abs(hash).toString(36);
}

/* ── Init ─────────────────────────────────────────────────────────────────── */
async function init() {
  deviceFp = generateFingerprint();
  const params = new URLSearchParams(window.location.search);
  spotId = params.get('id');
  if (!spotId || !/^[a-zA-Z0-9_-]+$/.test(spotId)) {
    showError('No lake specified. Use a link from Paddling Out or scan a QR code at the lake.');
    return;
  }

  checkExistingRating();
  // GPS is OPT-IN. This used to call requestGPS() here, firing the browser
  // permission prompt on page load before the user had done anything —
  // heavier than Search or Submit, where location is a deliberate tap.
  if (!localStorage.getItem('kaayko_rate_onboarded')) showOnboard();

  try {
    const [spotRes, scoreRes] = await Promise.allSettled([
      fetch(API_BASE + '/paddlingOut/' + encodeURIComponent(spotId)),
      fetch(API_BASE + '/paddleScore?spotId=' + encodeURIComponent(spotId)),
    ]);

    let spot = null;
    if (spotRes.status === 'fulfilled' && spotRes.value.ok) {
      spot = await spotRes.value.json();
    }

    if (!spot) {
      showError('This lake isn\'t available for rating yet. It may not be in our system.');
      return;
    }

    lakeData = spot;

    if (scoreRes.status === 'fulfilled' && scoreRes.value.ok) {
      const scoreData = await scoreRes.value.json();
      weatherData = scoreData.conditions || scoreData;
      predictedScore = scoreData.rating || scoreData.paddleScore?.rating;
    }

    renderForm();
  } catch (err) {
    showError('Could not load lake data. Check your connection and try again.');
  }
}

/* ── Check existing rating ────────────────────────────────────────────────── */
function checkExistingRating() {
  const today = new Date().toISOString().split('T')[0];
  const key = STORAGE_PREFIX + spotId + '_' + today;
  const saved = localStorage.getItem(key);
  if (saved) {
    try {
      existingRating = JSON.parse(saved);
      const elapsed = Date.now() - existingRating.timestamp;
      if (elapsed > UPDATE_WINDOW_MS) {
        existingRating.locked = true;
      }
    } catch (e) { existingRating = null; }
  }
}

/* ── GPS ──────────────────────────────────────────────────────────────────── */
function requestGPS() {
  if (!navigator.geolocation) {
    setGPS(false, 'GPS not available on this device');
    return;
  }
  setGPS(false, 'Checking location...');
  navigator.geolocation.getCurrentPosition(
    pos => {
      gpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (lakeData) checkGPSDistance();
    },
    () => setGPS(false, 'Location not shared'),
    { timeout: 8000, maximumAge: 60000 }
  );
}

function checkGPSDistance() {
  if (!gpsCoords || !lakeData?.location) return;
  const dist = haversine(
    gpsCoords.lat, gpsCoords.lng,
    lakeData.location.latitude, lakeData.location.longitude
  );
  if (dist <= 5) {
    gpsVerified = true;
    setGPS(true, 'At ' + (lakeData.title || lakeData.lakeName || spotId.replace(/_/g, ' ')));
  } else if (dist <= 30) {
    setGPS(false, window.KaaykoPrefs.fmtDist(dist) + ' away');
  } else {
    setGPS(false, 'Rating remotely');
  }
}

function haversine(lat1, lon1, lat2, lon2) { return window.KaaykoUtil.haversineKm(lat1, lon1, lat2, lon2); }

function setGPS(verified, text) {
  const badge = document.getElementById('gpsBadge');
  badge.className = 'gps-badge ' + (verified ? 'verified' : 'unverified');
  document.getElementById('gpsText').textContent = text;
}

/* ── Render form ─────────────────────────────────────────────────────────── */
/** Canonical Paddle Score wording, shared with the rest of Paddling Out. */
function rateScoreLabel(score) {
  if (score >= 3.5) return 'Worth it';
  if (score >= 2) return 'Careful';
  return 'Hard pass';
}

function renderModelCall() {
  const n = Number(predictedScore);
  const card = document.getElementById('modelCall');
  if (!Number.isFinite(n)) { card.style.display = 'none'; return; }
  document.getElementById('modelScoreVal').textContent = n.toFixed(1);
  document.getElementById('modelScoreLabel').textContent = rateScoreLabel(n);
  card.style.display = '';
}

function renderForm() {
  renderModelCall();
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('formState').style.display = 'block';

  const displayName = lakeData.title || lakeData.lakeName || spotId.replace(/_/g, ' ');
  document.getElementById('lakeName').textContent = displayName;
  document.getElementById('lakeSub').textContent =
    lakeData.subtitle || lakeData.location?.region || '';

  if (gpsCoords && lakeData.location) checkGPSDistance();

  renderWeather();

  if (existingRating && !existingRating.locked) {
    document.getElementById('updateBanner').style.display = 'flex';
    const remaining = UPDATE_WINDOW_MS - (Date.now() - existingRating.timestamp);
    const mins = Math.max(0, Math.ceil(remaining / 60000));
    document.getElementById('updateTime').textContent = mins + ' minutes remaining to update';
    selectedRating = existingRating.rating;
    profileState = { ...profileState, ...existingRating.profile };
    restoreProfile();
    restoreRating();
  } else if (existingRating && existingRating.locked) {
    showThankYou(true);
    return;
  }

  bindPills();
  bindRatingButtons();
  bindNotes();
}

function renderWeather() {
  const w = weatherData || {};
  const P = window.KaaykoPrefs;
  // Inputs are metric; the shared formatters convert + label per the user's unit choice.
  const cells = [
    { v: P.fmtTemp(w.temperature ?? w.temp_c),        l: 'Air' },
    { v: P.fmtWind(w.windSpeed ?? w.wind_kph),        l: 'Wind' },
    { v: P.fmtWind(w.gustSpeed ?? w.gust_kph),        l: 'Gust' },
    { v: P.fmtTemp(w.waterTemp ?? w.water_temp_c),    l: 'Water' },
    { v: P.fmtHeight(w.waveHeight ?? w.wave_height_m), l: 'Waves' },
    { v: (w.humidity != null ? Math.round(w.humidity) + '%' : '--'), l: 'Humid' },
  ];
  document.getElementById('wxGrid').innerHTML = cells.map(c =>
    `<div class="wx-cell"><div class="wx-val">${c.v}</div><div class="wx-lbl">${c.l}</div></div>`
  ).join('');
}

/* ── Profile pills ────────────────────────────────────────────────────────── */
function bindPills() {
  document.querySelectorAll('.pill[data-group]').forEach(pill => {
    pill.addEventListener('click', () => {
      const group = pill.dataset.group;
      if (['skill', 'craft', 'group'].includes(group)) {
        document.querySelectorAll(`.pill[data-group="${group}"]`).forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        profileState[group] = pill.dataset.val;
      } else {
        pill.classList.toggle('active');
      }
    });
  });

  // Prefill craft from the saved boat-type preference (Settings → My boat)
  const savedCraft = window.KaaykoPrefs?.getBoatType?.();
  if (savedCraft && savedCraft !== profileState.craft) {
    const pill = document.querySelector(`.pill[data-group="craft"][data-val="${savedCraft}"]`);
    if (pill) {
      document.querySelectorAll('.pill[data-group="craft"]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      profileState.craft = savedCraft;
    }
  }
}

function restoreProfile() {
  Object.entries(profileState).forEach(([group, val]) => {
    document.querySelectorAll(`.pill[data-group="${group}"]`).forEach(p => {
      p.classList.toggle('active', p.dataset.val === val);
    });
  });
}

/* ── Rating buttons ──────────────────────────────────────────────────────── */
function bindRatingButtons() {
  document.querySelectorAll('.rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRating = parseInt(btn.dataset.val);
      selectedChips.clear();
      document.querySelectorAll('.rate-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      renderChips();
      document.getElementById('detailCard').style.display = 'block';
      document.getElementById('submitBtn').disabled = false;
    });
  });
}

function restoreRating() {
  if (!selectedRating) return;
  const btn = document.querySelector(`.rate-btn[data-val="${selectedRating}"]`);
  if (btn) {
    btn.classList.add('selected');
    renderChips();
    document.getElementById('detailCard').style.display = 'block';
    document.getElementById('submitBtn').disabled = false;
  }
}

/* ── Smart chips engine ──────────────────────────────────────────────────── */
function getEligibleChips() {
  const w = weatherData || {};
  const wind = parseFloat(w.windSpeed || w.wind_kph) || 0;
  const gust = parseFloat(w.gustSpeed || w.gust_kph) || 0;
  const temp = parseFloat(w.temperature || w.temp_c) || 15;
  const water = parseFloat(w.waterTemp || w.water_temp_c) || 15;
  const wave = parseFloat(w.waveHeight || w.wave_height_m) || 0;
  const rain = parseFloat(w.precipitation || w.precip_mm || w.precipMm) || 0;
  const vis = parseFloat(w.visibility || w.vis_km) || 15;
  const isNeg = selectedRating <= 2;
  const isPos = selectedRating >= 4;
  const chips = [];

  if (isNeg || selectedRating === 3) {
    if (wind > 20) chips.push({ label: 'Strong wind', type: 'weather', s: wind });
    if (gust > 0 && wind > 0 && gust / wind > 2) chips.push({ label: 'Gusty', type: 'weather', s: gust });
    if (water < 12) chips.push({ label: 'Cold water', type: 'weather', s: 15 - water });
    if (rain > 0.5) chips.push({ label: 'Rain / storm', type: 'weather', s: rain * 5 });
    if (wave > 0.25) chips.push({ label: 'Rough waves', type: 'weather', s: wave * 20 });
    if (vis < 5) chips.push({ label: 'Poor visibility', type: 'weather', s: 10 - vis });
    if (temp > 32) chips.push({ label: 'Too hot', type: 'weather', s: temp - 28 });
    if (temp < 5) chips.push({ label: 'Too cold', type: 'weather', s: 8 - temp });
    chips.push({ label: 'Crowded', type: 'context', s: 0 });
    chips.push({ label: 'Hard launch', type: 'context', s: 0 });
    chips.push({ label: 'Felt unsafe', type: 'context', s: 0 });
  } else if (isPos) {
    if (wind < 12) chips.push({ label: 'Perfect wind', type: 'weather', s: 5 });
    if (water > 18) chips.push({ label: 'Warm water', type: 'weather', s: 4 });
    if (wave < 0.1 && wind < 15) chips.push({ label: 'Glassy water', type: 'weather', s: 5 });
    if (vis > 10) chips.push({ label: 'Great visibility', type: 'weather', s: 3 });
    if (temp > 15 && temp < 30) chips.push({ label: 'Comfortable temp', type: 'weather', s: 4 });
    chips.push({ label: 'Easy launch', type: 'context', s: 0 });
    chips.push({ label: 'Uncrowded', type: 'context', s: 0 });
  }

  chips.sort((a, b) => b.s - a.s);
  return chips.slice(0, 4);
}

function renderChips() {
  const section = document.getElementById('chipsSection');
  const wrap = document.getElementById('chipsWrap');
  const chips = getEligibleChips();

  if (chips.length === 0) { section.classList.remove('visible'); return; }

  const isNeg = selectedRating <= 2;
  const isPos = selectedRating >= 4;
  document.getElementById('chipsPrompt').textContent =
    isNeg ? 'What made it bad?' : isPos ? 'What made it great?' : 'What held it back?';

  wrap.innerHTML = chips.map(c =>
    `<div class="chip ${c.type} ${selectedChips.has(c.label) ? 'selected' : ''}" onclick="toggleChip('${c.label}')">${c.label}</div>`
  ).join('');

  const wxCount = chips.filter(c => c.type === 'weather').length;
  document.getElementById('chipsCount').textContent =
    wxCount + ' verified from conditions · select up to 4';

  section.classList.add('visible');
}

function toggleChip(label) {
  if (selectedChips.has(label)) selectedChips.delete(label);
  else if (selectedChips.size < 4) selectedChips.add(label);
  renderChips();
}

/* ── Notes ────────────────────────────────────────────────────────────────── */
function bindNotes() {
  const input = document.getElementById('notesInput');
  input.addEventListener('input', () => {
    document.getElementById('notesLen').textContent = input.value.length;
  });
}

/* ── Submit ───────────────────────────────────────────────────────────────── */
async function submitRating() {
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const payload = {
    spotId,
    rating: selectedRating,
    chips: [...selectedChips],
    profile: { skill: profileState.skill, craft: profileState.craft, group: profileState.group },
    windFelt: getActive('windFelt'),
    waterFelt: getActive('waterFelt'),
    notes: sanitize(document.getElementById('notesInput').value),
    gps: gpsCoords ? { lat: gpsCoords.lat, lng: gpsCoords.lng } : null,
    fingerprint: deviceFp,
    predictedScore: predictedScore || null,
    weather: weatherData || null,
  };

  const today = new Date().toISOString().split('T')[0];
  const storageKey = STORAGE_PREFIX + spotId + '_' + today;
  const saved = {
    ...payload,
    timestamp: Date.now(),
    profile: { skill: profileState.skill, craft: profileState.craft, group: profileState.group },
  };

  // The rating only counts if the SERVER took it. This used to swallow every
  // failure and show the thank-you regardless, so a person could be told they
  // had helped train the model when no label existed anywhere but their own
  // browser. If the post fails we keep the form open and let them retry.
  let serverAccepted = false;
  let failureMessage = '';
  try {
    const res = await fetch(API_BASE + '/paddleScore/publicRating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      serverAccepted = true;
      saved.serverId = data.id;
    } else if (res.status === 409) {
      failureMessage = data.error || 'This rating is locked — the two-hour window has passed.';
    } else if (res.status === 429) {
      failureMessage = data.error || 'You have rated the daily maximum. Try again tomorrow.';
    } else if (res.status === 404) {
      failureMessage = 'We could not find this lake. Open Rate from a lake card or a QR code at the water.';
    } else {
      failureMessage = data.error || 'We could not save your rating just now.';
    }
  } catch (e) {
    failureMessage = 'No connection. Your rating was not saved.';
  }

  if (!serverAccepted) {
    // Form stays open and the button stays live so the tap can be repeated.
    btn.disabled = false;
    btn.textContent = 'Try again';
    setSubmitError(failureMessage + ' Nothing has been recorded yet.');
    return;
  }

  localStorage.setItem(storageKey, JSON.stringify(saved));
  existingRating = saved;
  showThankYou(false);
}

/**
 * Recoverable submit error, shown next to the button. Deliberately NOT a
 * thank-you: the rating did not reach the server, and saying otherwise is the
 * exact trust bug this replaced.
 */
function setSubmitError(message) {
  let el = document.getElementById('submitError');
  if (!el) {
    el = document.createElement('div');
    el.id = 'submitError';
    el.className = 'submit-error';
    el.setAttribute('role', 'alert');
    document.getElementById('submitBtn').insertAdjacentElement('afterend', el);
  }
  el.textContent = message;
  el.style.display = message ? 'block' : 'none';
}

function getActive(group) {
  const el = document.querySelector(`.pill[data-group="${group}"].active`);
  return el?.dataset.val || null;
}

function sanitize(str) {
  return str.replace(/<[^>]*>/g, '').replace(/[<>"']/g, '').slice(0, 280).trim();
}

/* ── Thank you ───────────────────────────────────────────────────────────── */
function showThankYou(locked) {
  document.getElementById('formState').style.display = 'none';
  document.getElementById('thankState').style.display = 'block';
  document.getElementById('thankLake').textContent =
    document.getElementById('lakeName').textContent;

  const r = existingRating?.rating || selectedRating;
  document.getElementById('thankYouSaid').textContent = r + '/5';

  const p = predictedScore ? parseFloat(predictedScore).toFixed(1) : '--';
  document.getElementById('thankModelSaid').textContent = p === '--' ? '--' : p + '/5';

  if (p !== '--') {
    const delta = (r - parseFloat(p)).toFixed(1);
    const sign = delta > 0 ? '+' : '';
    document.getElementById('thankDelta').textContent = sign + delta;
    document.getElementById('thankDelta').style.color =
      Math.abs(delta) <= 0.5 ? 'var(--good)' : 'var(--moderate)';
  } else {
    document.getElementById('thankDelta').textContent = '--';
    document.getElementById('thankDelta').style.color = 'var(--muted)';
  }

  if (locked) {
    document.getElementById('thankHint').textContent = 'Your rating has been locked. Thanks for contributing!';
    document.getElementById('thankUpdateBtn').style.display = 'none';
  } else {
    const remaining = UPDATE_WINDOW_MS - (Date.now() - (existingRating?.timestamp || Date.now()));
    const mins = Math.max(0, Math.ceil(remaining / 60000));
    document.getElementById('thankHint').textContent =
      'You can update your rating for ' + mins + ' more minutes.';
  }
}

function enableUpdate() {
  document.getElementById('thankState').style.display = 'none';
  document.getElementById('formState').style.display = 'block';
  document.getElementById('submitBtn').textContent = 'Update Rating';
  document.getElementById('submitBtn').disabled = false;
}

/* ── Error / loading ─────────────────────────────────────────────────────── */
function showError(msg) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'block';
  document.getElementById('errorMsg').textContent = msg;
}

/* ── Onboarding ──────────────────────────────────────────────────────────── */
function showOnboard() {
  document.getElementById('onboard').style.display = 'flex';
  document.getElementById('onboard').classList.remove('hiding');
}

function dismissOnboard() {
  const el = document.getElementById('onboard');
  el.classList.add('hiding');
  setTimeout(() => { el.style.display = 'none'; }, 300);
  localStorage.setItem('kaayko_rate_onboarded', '1');
}

/* ── Boot ─────────────────────────────────────────────────────────────────── */
init();
