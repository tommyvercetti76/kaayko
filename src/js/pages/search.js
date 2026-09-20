/**
 * pages/search.js — Search controller for /paddlingout/search
 *
 * The map is the input. Three ways in, one path out:
 *   type → suggestions → pick (map flies there, search runs)
 *   tap the map → pin drops, search runs at the tap
 *   locate me → pin drops at the device, search runs
 * …→ searchAt(lat, lng, label, radiusKm) → /nearbyWater → rows + pins → batch scores.
 *
 * One `state`, one `render()`. Every DOM write goes through render() or a
 * small render* helper; handlers only change state and call the action.
 *
 * Depends on (load order in search.html): prefs.js, util.js, services/geo.js,
 * kaayko-icons.js, Leaflet, components/PinPicker.js, components/PaddleCard.js.
 */
(function () {
  'use strict';
  var U = window.KaaykoUtil, G = window.KaaykoGeo, P = window.KaaykoPrefs, I = window.KaaykoIcons;
  var API = U.apiBase();

  // ── State ──────────────────────────────────────────────────────────────────
  var state = {
    mode: 'idle',          // idle · locating · searching · results · empty · error
    query: '',
    center: null,          // { lat, lng }
    radiusKm: 30,
    label: '',
    bodies: [],            // generic water bodies from /nearbyWater
    coveredNear: [],       // curated spots within radius
    scores: new Map(),     // "lat,lng" → rating | null
    scoreNote: '',         // e.g. daily limit reached
    cached: false, sources: [],
    suggestions: [],       // [{ value, lat, lng, radiusKm, covered, id }]
    suggestIndex: -1,
    covered: [],           // every curated spot (loaded once)
    error: ''
  };
  var gen = 0;                       // invalidates late responses
  var rows = new Map();              // key → row element (for setScore)
  var picker = null;

  // ── DOM ────────────────────────────────────────────────────────────────────
  var $ = function (id) { return document.getElementById(id); };
  var inputEl = $('search-input'), clearBtn = $('search-clear'), gpsBtn = $('btn-gps'),
      suggestEl = $('search-suggest'), statusEl = $('search-status'), hintEl = $('search-map-hint'),
      hereBtn = $('search-here-btn'), popularSection = $('popular-section'), popularChips = $('popular-chips'),
      coveredEl = $('covered-section'), resultsHeader = $('results-header'), resultsCount = $('results-count'),
      resultsHint = $('results-hint'), resultsList = $('results-list'), refreshBtn = $('refresh-btn'),
      saveAreaBtn = $('save-area-btn'), areaChip = $('my-area-chip'), areaLabel = $('my-area-label'), areaChange = $('my-area-change');

  var POPULAR = [
    { name: 'Lavon Lake, TX', lat: 33.0815, lng: -96.4775 }, { name: 'Lewisville Lake, TX', lat: 33.1439, lng: -96.9759 },
    { name: 'Lake Washington, WA', lat: 47.6553, lng: -122.2571 }, { name: 'Lake Tahoe, CA', lat: 39.0931, lng: -120.0325 },
    { name: 'Yellowstone Lake, WY', lat: 44.4759, lng: -110.5886 }, { name: 'Lake Ontario, NY', lat: 43.9520, lng: -76.1743 },
    { name: 'London, UK', lat: 51.5085, lng: -0.1257 }, { name: 'Sydney, AU', lat: -33.8688, lng: 151.2093 }
  ];
  var MY_AREA_KEY = 'kaayko_my_area';
  var keyOf = function (lat, lng) { return Number(lat).toFixed(6) + ',' + Number(lng).toFixed(6); };

  // ── Map ────────────────────────────────────────────────────────────────────
  picker = window.PinPicker && window.PinPicker.create($('search-map'), {
    // Draggable: the pin lands where the geocoder thinks the lake is, and the
    // launch you care about is somewhere along the shore. Dragging it re-runs
    // the search from where you put it, exactly like tapping the map does.
    center: [39.5, -98.35], zoom: 4, pickable: true, draggable: true,
    onPick: function (lat, lng, how) {
      var r = U.clamp(picker.radiusKm(), 10, 30);
      searchAt(lat, lng, how === 'drag' ? 'this spot' : lat.toFixed(3) + ', ' + lng.toFixed(3), r,
        { pin: how !== 'drag', fly: false });
    },
    onMove: function () { if (state.mode === 'results' || state.mode === 'empty') hereBtn.hidden = false; }
  });
  hereBtn.addEventListener('click', function () {
    if (!picker) return;
    var c = picker.center();
    hereBtn.classList.add('busy');
    searchAt(c.lat, c.lng, 'this area', U.clamp(picker.radiusKm(), 10, 60), { pin: false, fly: false, force: true })
      .finally(function () { hereBtn.classList.remove('busy'); });
  });

  // ── Covered (curated) spots — loaded once, matched by name and by distance ─
  var coveredReady = U.fetchJson(API + '/paddlingOut', { timeoutMs: 12000 }).then(function (r) {
    var list = Array.isArray(r.data) ? r.data : [];
    state.covered = list.map(function (s) {
      var loc = s.location || {};
      return { id: s.id, name: s.title || s.lakeName || s.id || '', subtitle: s.subtitle || '',
        lat: Number(loc.latitude), lng: Number(loc.longitude), rating: s.paddleScore && s.paddleScore.rating != null ? s.paddleScore.rating : null };
    }).filter(function (s) { return s.name && Number.isFinite(s.lat) && Number.isFinite(s.lng); });
  }).catch(function () {});

  function matchCovered(q) {
    q = String(q || '').toLowerCase().trim();
    if (q.length < 2) return [];
    var toks = q.split(/\s+/).filter(Boolean);
    return state.covered.map(function (s) {
      var name = s.name.toLowerCase(), hay = (s.name + ' ' + s.subtitle).toLowerCase(), score = 0;
      if (name.indexOf(q) === 0) score += 100; else if (name.indexOf(q) !== -1) score += 60;
      var matched = toks.filter(function (t) { return hay.indexOf(t) !== -1; }).length;
      score += matched * 20;
      return { s: s, score: score, all: matched === toks.length };
    }).filter(function (x) { return x.score > 0 && x.all; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 4).map(function (x) { return x.s; });
  }
  function coveredWithin(lat, lng, radiusKm) {
    return state.covered
      .filter(function (s) { return U.haversineKm(lat, lng, s.lat, s.lng) <= radiusKm; })
      .sort(function (a, b) { return U.haversineKm(lat, lng, a.lat, a.lng) - U.haversineKm(lat, lng, b.lat, b.lng); });
  }
  function normName(n) { return String(n || '').toLowerCase().replace(/\s+(lake|reservoir|river)$/, '').trim(); }
  function bodyIsCovered(body) {
    var bn = normName(body.name);
    return state.coveredNear.some(function (c) {
      var d = U.haversineKm(body.lat, body.lng, c.lat, c.lng);
      if (d < 3.2) return true;
      var cn = normName(c.name);
      return d < 19 && cn && bn && (cn === bn || cn.indexOf(bn) !== -1 || bn.indexOf(cn) !== -1);
    });
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function setStatus(msg, type) { statusEl.textContent = msg || ''; statusEl.className = 'search-status' + (type ? ' ' + type : ''); }

  var updateSuggestions = U.debounce(function () {
    var q = inputEl.value.trim();
    state.query = q;
    if (q.length < 2) { state.suggestions = []; renderSuggestions(); return; }
    var covered = matchCovered(q).map(function (s) { return { value: s.name, lat: s.lat, lng: s.lng, radiusKm: 25, covered: true, id: s.id }; });
    state.suggestions = covered; renderSuggestions();
    if (q.length < 3) return;
    G.suggest(q).then(function (list) {
      if (inputEl.value.trim() !== q) return;           // stale
      state.suggestions = covered.concat(list.filter(function (x) { return !covered.some(function (c) { return c.value === x.value; }); }));
      state.suggestIndex = -1; renderSuggestions();
    });
  }, 300);

  function pickSuggestion(sg) {
    inputEl.value = sg.value; clearBtn.classList.add('visible');
    // Carry the water body's own name, not the whole address — it is what
    // Add-a-lake wants in its name field.
    state.query = sg.name || sg.value;
    state.suggestions = []; renderSuggestions();
    if (sg.covered && sg.id) { window.location.href = '/paddlingout/forecast?id=' + encodeURIComponent(sg.id); return; }
    searchAt(sg.lat, sg.lng, sg.value, sg.radiusKm || 30, { pin: true, fly: true });
  }

  function submitText() {
    var q = inputEl.value.trim();
    if (!q) { setStatus('Type a lake, river or city, drag the pin, or use your location.', 'error'); return; }
    // Only the debounced suggest path used to record this, so a submit that
    // skipped it (paste + Enter, a restored value, the ?q= deep link) lost the
    // name — and with it the "Add <name>" the empty state is supposed to offer.
    state.query = q;
    state.suggestions = []; renderSuggestions();
    var covered = matchCovered(q);
    renderCovered(covered);
    setStatus('Finding ' + q + '…', 'loading');
    G.forward(q).then(function (geo) {
      if (!geo) { setStatus('Couldn’t find “' + q + '”. Try a nearby town, or tap the map.', 'error'); state.mode = 'error'; return; }
      searchAt(geo.lat, geo.lng, geo.label, geo.radiusKm, { pin: true, fly: true });
    });
  }

  function locate() {
    if (!navigator.geolocation) { setStatus('Location is not available here. Tap the map instead.', 'error'); return; }
    state.mode = 'locating'; gpsBtn.classList.add('loading'); setStatus('Finding you…', 'loading');
    navigator.geolocation.getCurrentPosition(function (pos) {
      gpsBtn.classList.remove('loading');
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      inputEl.value = lat.toFixed(4) + ', ' + lng.toFixed(4); clearBtn.classList.add('visible');
      searchAt(lat, lng, 'your location', 30, { pin: true, fly: true });
    }, function (err) {
      gpsBtn.classList.remove('loading'); state.mode = 'idle';
      setStatus(err.code === 1 ? 'Location denied. Type a place or tap the map.' : 'Couldn’t get your location. Tap the map instead.', 'error');
    }, { timeout: 10000, maximumAge: 60000 });
  }

  /** The one search path. */
  function searchAt(lat, lng, label, radiusKm, o) {
    o = o || {};
    var myGen = ++gen;
    state.center = { lat: lat, lng: lng }; state.label = label || 'this location';
    state.radiusKm = U.clamp(parseInt(radiusKm, 10) || 30, 10, 60);
    state.mode = 'searching'; state.error = ''; state.scoreNote = ''; state.scores = new Map(); rows = new Map(); state._fitted = false;
    if (picker) {
      if (o.pin !== false) picker.setPin(lat, lng, { fly: o.fly !== false, zoom: 11 });
      hintEl.hidden = true; hereBtn.hidden = true;
    }
    render();
    return coveredReady.then(function () {
      state.coveredNear = coveredWithin(lat, lng, state.radiusKm);
      var url = API + '/nearbyWater?lat=' + lat + '&lng=' + lng + '&radius=' + state.radiusKm +
        '&q=' + encodeURIComponent(inputEl.value.trim()) + (o.force ? '&refresh=1' : '');
      return U.fetchJson(url, { timeoutMs: 15000 });
    }).then(function (r) {
      if (myGen !== gen) return;
      var d = r.data || {};
      if (!r.ok || !d.success) { state.mode = 'error'; state.error = r.aborted ? 'Search timed out. Try again.' : 'Search failed. Check your connection and try again.'; render(); return; }
      state.cached = !!d.cached; state.sources = Array.isArray(d.sources) ? d.sources : [];
      var bodies = (d.waterBodies || []).filter(function (b) { return Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng)); })
        .map(function (b) { b.lat = Number(b.lat); b.lng = Number(b.lng); return b; });
      state.bodies = bodies.slice(0, 15).filter(function (b) { return !bodyIsCovered(b); });
      state.mode = (state.bodies.length || state.coveredNear.length) ? 'results' : 'empty';
      render();
      if (state.bodies.length) fetchScores(myGen);
    });
  }

  function fetchScores(myGen) {
    var bodies = state.bodies;
    U.fetchJson(API + '/paddleScore/batch', { timeoutMs: 12000, init: {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: bodies.map(function (b) { return { lat: b.lat, lng: b.lng }; }), craft: P.getBoatType ? P.getBoatType() : undefined })
    } }).then(function (r) {
      if (myGen !== gen) return;
      if (r.status === 429) { state.scoreNote = 'Daily score limit reached; showing lakes without scores.'; bodies.forEach(function (b) { state.scores.set(keyOf(b.lat, b.lng), null); }); renderScores(); return; }
      if (r.ok && r.data && r.data.success && Array.isArray(r.data.scores)) {
        r.data.scores.forEach(function (s) { state.scores.set(keyOf(s.lat, s.lng), s.rating != null ? s.rating : (s.score != null ? s.score : null)); });
        bodies.forEach(function (b) { if (!state.scores.has(keyOf(b.lat, b.lng))) state.scores.set(keyOf(b.lat, b.lng), null); });
        renderScores(); return;
      }
      // Batch unavailable: a few single calls, never the whole list (they share the daily budget)
      var few = bodies.slice(0, 6);
      bodies.slice(6).forEach(function (b) { state.scores.set(keyOf(b.lat, b.lng), null); });
      Promise.all(few.map(function (b) {
        return U.fetchJson(API + '/paddleScore?lat=' + b.lat + '&lng=' + b.lng, { timeoutMs: 8000 }).then(function (rr) {
          var d = rr.data || {}, s = d.paddleScore && d.paddleScore.rating != null ? d.paddleScore.rating : (d.score != null ? d.score : null);
          state.scores.set(keyOf(b.lat, b.lng), rr.ok ? s : null);
        });
      })).then(function () { if (myGen === gen) renderScores(); });
    });
  }

  function openForecast(body) {
    var p = new URLSearchParams({ lat: body.lat, lng: body.lng, name: body.name });
    if (body.type) p.set('type', body.type);
    window.location.href = '/paddlingout/forecast?' + p.toString();
  }
  function requestLake(body) {
    var p = new URLSearchParams();
    if (body) { if (body.name) p.set('name', body.name); if (body.type) p.set('type', body.type); if (body.lat != null) p.set('lat', body.lat); if (body.lng != null) p.set('lng', body.lng); }
    else {
      // Everything the person has already told us travels with them: the name
      // they typed and the pin they are looking at. Re-asking for both is how
      // a search that found nothing turns into a form nobody finishes.
      var typed = (state.query || '').trim();
      if (typed) p.set('name', typed);
      if (state.center) { p.set('lat', state.center.lat.toFixed(5)); p.set('lng', state.center.lng.toFixed(5)); }
    }
    window.location.href = '/paddlingout/submitentry' + (p.toString() ? '?' + p.toString() : '');
  }

  // My area
  function getSavedArea() { try { return JSON.parse(localStorage.getItem(MY_AREA_KEY) || 'null'); } catch (e) { return null; } }
  function isSavedHere() { var s = getSavedArea(); return !!(s && state.center && Math.abs(s.lat - state.center.lat) < 1e-4 && Math.abs(s.lng - state.center.lng) < 1e-4); }
  function toggleArea() {
    if (isSavedHere()) { try { localStorage.removeItem(MY_AREA_KEY); } catch (e) {} }
    else if (state.center) { try { localStorage.setItem(MY_AREA_KEY, JSON.stringify({ lat: state.center.lat, lng: state.center.lng, label: state.label, radiusKm: state.radiusKm })); } catch (e) {} }
    try { window.dispatchEvent(new CustomEvent('kaayko:areachange', {})); } catch (e) {}
    renderArea();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    renderArea();
    popularSection.style.display = (state.mode === 'idle') ? '' : 'none';
    refreshBtn.style.display = (state.mode === 'results') ? 'inline-flex' : 'none';
    if (state.mode === 'searching') {
      setStatus('Searching near ' + state.label + '…', 'loading');
      resultsHeader.classList.remove('visible'); renderCovered([]);
      resultsList.innerHTML = ''; for (var i = 0; i < 5; i++) { var sk = document.createElement('div'); sk.className = 'pcard-row-skel'; resultsList.appendChild(sk); }
      return;
    }
    if (state.mode === 'error') { setStatus(state.error, 'error'); resultsHeader.classList.remove('visible'); resultsList.innerHTML = ''; return; }
    if (state.mode === 'idle' || state.mode === 'locating') return;
    setStatus('', '');
    renderCovered(state.coveredNear);
    renderPins();
    if (state.mode === 'empty') {
      resultsHeader.classList.remove('visible');
      var typed = (state.query || '').trim();
      resultsList.innerHTML = '<div class="empty-state"><div class="mat">' + (I ? I.get('search') : '') + '</div>' +
        '<h3>' + (typed ? 'We don\u2019t cover ' + U.escapeHtml(typed) + ' yet' : 'No water found near ' + U.escapeHtml(state.label)) + '</h3>' +
        '<p>' + (typed
          ? 'You are on it \u2014 add it and it goes in the map for everyone. The name and the pin carry over.'
          : 'Try a larger lake name, a nearby city, or drag the pin somewhere else.') + '</p>' +
        '<button class="btn-request-lake" type="button" data-action="request">' +
        (typed ? 'Add ' + U.escapeHtml(typed) : 'Add a lake here') + '</button></div>';
      return;
    }
    var n = state.bodies.length;
    resultsCount.textContent = n ? (n + (state.coveredNear.length ? ' more ' : ' ') + (n === 1 ? 'spot' : 'spots') + ' near ' + state.label) : ('Spots we cover near ' + state.label);
    var src = state.sources.map(function (s) { return String(s).toUpperCase(); }).join(' + ');
    resultsHint.textContent = (src ? src + ' ' : '') + (state.cached ? '· cached' : '· live');
    resultsHeader.classList.add('visible');
    resultsList.innerHTML = '';
    state.bodies.forEach(function (b, idx) {
      var distKm = parseFloat(b.distanceMiles) * 1.60934;
      var bits = [b.type || 'Water', P.fmtDist(distKm) + (b.areaKm2 ? ' · ' + P.fmtArea(b.areaKm2) : '')];
      var row = window.PaddleCard.create({ id: '', title: b.name, subtitle: bits[1], paddleScore: null }, {
        variant: 'row', metaBits: bits, showFavorite: false, onOpen: function () { openForecast(b); },
        actions: [{ label: 'Request', title: 'Ask us to cover this lake', onClick: function () { requestLake(b); } },
                  { label: 'Open in Maps', icon: I ? I.get('pin') : 'Map', onClick: function () { window.open('https://www.google.com/maps/search/?api=1&query=' + b.lat + ',' + b.lng, '_blank', 'noopener'); } }]
      });
      row.style.animationDelay = (idx * 35) + 'ms';
      rows.set(keyOf(b.lat, b.lng), row);
      resultsList.appendChild(row);
    });
    if (state.scoreNote) { var note = document.createElement('p'); note.className = 'search-status error'; note.textContent = state.scoreNote; resultsList.appendChild(note); }
    renderScores();
  }

  function renderScores() {
    rows.forEach(function (row, key) { if (state.scores.has(key)) row.setScore(state.scores.get(key)); });
    renderPins();
  }

  function renderPins() {
    if (!picker) return;
    var pins = state.coveredNear.map(function (s) {
      return { lat: s.lat, lng: s.lng, cover: true, title: s.name, tooltip: s.name + ' · we cover this',
        onClick: function () { window.location.href = '/paddlingout/forecast?id=' + encodeURIComponent(s.id); } };
    }).concat(state.bodies.map(function (b) {
      var sm = P.scoreMeta(state.scores.has(keyOf(b.lat, b.lng)) ? state.scores.get(keyOf(b.lat, b.lng)) : null);
      return { lat: b.lat, lng: b.lng, label: sm.rating == null ? '–' : sm.display, color: sm.color, title: b.name,
        tooltip: b.name + (sm.rating != null ? ' · ' + sm.label : '') + ' · tap to open', onClick: function () { openForecast(b); } };
    }));
    picker.setResults(pins);
    if (pins.length && state.mode === 'results' && !state._fitted) { picker.fitResults(40); state._fitted = true; }
  }

  function renderCovered(list) {
    coveredEl.innerHTML = '';
    if (!list || !list.length) { coveredEl.classList.remove('visible'); return; }
    var head = document.createElement('div'); head.className = 'covered-head'; head.textContent = 'Spots we cover'; coveredEl.appendChild(head);
    list.forEach(function (s) {
      var row = window.PaddleCard.create({ id: s.id, title: s.name, subtitle: s.subtitle, paddleScore: s.rating == null ? null : { rating: s.rating } }, {
        variant: 'row', badge: 'We cover this', onOpen: function () { window.location.href = '/paddlingout/forecast?id=' + encodeURIComponent(s.id); }
      });
      coveredEl.appendChild(row);
    });
    coveredEl.classList.add('visible');
  }

  function renderSuggestions() {
    var list = state.suggestions;
    inputEl.setAttribute('aria-expanded', list.length ? 'true' : 'false');
    if (!list.length) { suggestEl.hidden = true; suggestEl.innerHTML = ''; return; }
    suggestEl.innerHTML = list.map(function (s, i) {
      return '<div class="search-suggest-item" role="option" id="sg-' + i + '" aria-selected="' + (i === state.suggestIndex) + '" data-i="' + i + '">' +
        '<span>' + U.escapeHtml(s.value) + '</span>' + (s.covered ? '<span class="tag">We cover</span>' : '') + '</div>';
    }).join('');
    suggestEl.hidden = false;
  }

  function renderArea() {
    var saved = getSavedArea();
    saveAreaBtn.style.display = state.center ? 'inline-flex' : 'none';
    saveAreaBtn.classList.toggle('saved', isSavedHere());
    saveAreaBtn.title = isSavedHere() ? 'Saved as my area (tap to remove)' : 'Save this as my area';
    if (saved && saved.label) { areaLabel.textContent = saved.label; areaChip.classList.add('visible'); } else areaChip.classList.remove('visible');
  }

  // ── Wiring ─────────────────────────────────────────────────────────────────
  popularChips.innerHTML = POPULAR.map(function (p, i) {
    return '<button type="button" class="popular-chip" data-i="' + i + '"><span class="chip-icon" data-kicon-raw="droplet"></span>' + U.escapeHtml(p.name) + '</button>';
  }).join('');
  if (I && I.render) I.render();
  popularChips.addEventListener('click', function (e) {
    var b = e.target.closest('.popular-chip'); if (!b) return;
    var p = POPULAR[Number(b.dataset.i)]; inputEl.value = p.name; clearBtn.classList.add('visible');
    searchAt(p.lat, p.lng, p.name, 30, { pin: true, fly: true });
  });

  inputEl.addEventListener('input', function () { clearBtn.classList.toggle('visible', inputEl.value.length > 0); updateSuggestions(); });
  inputEl.addEventListener('keydown', function (e) {
    var n = state.suggestions.length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); state.suggestIndex = (state.suggestIndex + 1) % n; renderSuggestions(); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); state.suggestIndex = (state.suggestIndex - 1 + n) % n; renderSuggestions(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (n && state.suggestIndex >= 0) pickSuggestion(state.suggestions[state.suggestIndex]); else submitText(); }
    else if (e.key === 'Escape') { state.suggestions = []; renderSuggestions(); }
  });
  inputEl.addEventListener('blur', function () { setTimeout(function () { state.suggestions = []; renderSuggestions(); }, 150); });
  suggestEl.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep input focus
  suggestEl.addEventListener('click', function (e) { var it = e.target.closest('.search-suggest-item'); if (it) pickSuggestion(state.suggestions[Number(it.dataset.i)]); });
  clearBtn.addEventListener('click', function () { inputEl.value = ''; clearBtn.classList.remove('visible'); state.suggestions = []; renderSuggestions(); renderCovered([]); inputEl.focus(); });
  gpsBtn.addEventListener('click', locate);
  refreshBtn.addEventListener('click', function () { if (state.center) searchAt(state.center.lat, state.center.lng, state.label, state.radiusKm, { pin: false, fly: false, force: true }); });
  saveAreaBtn.addEventListener('click', toggleArea);
  areaChange.addEventListener('click', function () { try { localStorage.removeItem(MY_AREA_KEY); } catch (e) {} renderArea(); inputEl.value = ''; inputEl.focus(); });
  resultsList.addEventListener('click', function (e) { if (e.target.closest('[data-action="request"]')) requestLake(null); });
  resultsList.addEventListener('keydown', function (e) {
    var row = e.target.closest('.pcard--row'); if (!row) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); var nx = row.nextElementSibling; if (nx && nx.focus) nx.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); var pv = row.previousElementSibling; if (pv && pv.focus) pv.focus(); }
    else if (e.key === 'Escape') inputEl.focus();
  });

  // ── Entry: ?lat&lng · ?q · saved area · idle ───────────────────────────────
  (function start() {
    var p = new URLSearchParams(window.location.search);
    var lat = parseFloat(p.get('lat')), lng = parseFloat(p.get('lng')), q = (p.get('q') || '').trim();
    if (!isNaN(lat) && !isNaN(lng)) { inputEl.value = lat.toFixed(4) + ', ' + lng.toFixed(4); clearBtn.classList.add('visible'); searchAt(lat, lng, lat.toFixed(3) + ', ' + lng.toFixed(3), 30, { pin: true, fly: true }); return; }
    if (q) { inputEl.value = q; clearBtn.classList.add('visible'); submitText(); return; }
    var saved = getSavedArea();
    if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) {
      inputEl.value = saved.label || (saved.lat.toFixed(4) + ', ' + saved.lng.toFixed(4)); clearBtn.classList.add('visible');
      searchAt(saved.lat, saved.lng, saved.label || 'your area', saved.radiusKm || 30, { pin: true, fly: true }); return;
    }
    render();
  }());
}());
