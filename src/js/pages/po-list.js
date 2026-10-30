/**
 * /paddlingout — the decision-first list, HUD cards (shipped 30 Oct 2026; Rohan picked
 * HUD over Gallery and Ledger after four rounds of local prototypes).
 *
 * Card → tap → it opens in place (every photo, the day hour by hour, details) → one
 * button → the forecast page's heatmap. Nothing else on a card navigates.
 *
 * Each spot's best window (3 daylight hours with the highest mean half-point rating)
 * today if at least 2 daylight hours are left at the spot, else tomorrow, read
 * from the cached 3-day hourly forecast: GET /fastForecast/list, one request for
 * every open spot (the compact ?view=list shape, ~25 KB a spot instead of ~110 KB).
 * Tiers are the canonical 3.7 / 2.7. The score model is not touched.
 */
(function () {
  'use strict';

  var U = window.KaaykoUtil, P = window.KaaykoPrefs;
  var esc = U.escapeHtml, API = U.apiBase();
  var $ = function (id) { return document.getElementById(id); };
  var WIN = 3;   // hours in a window

  var state = { spots: [], paused: [], q: '', sort: 'best', filters: new Set(), near: null };

  // Display policy v2.2.1: cards show the half-point `rating`, and the label comes from
  // that number (4.0 / 3.0). `ratingPrecise` is never rendered.
  function tier(r) { return r >= 4 ? ['t-good', 'Worth it'] : r >= 3 ? ['t-mid', 'Careful'] : ['t-bad', 'Hard pass']; }
  function fmtR(r) { return (Math.round(r * 2) / 2).toFixed(1); }
  function hourLabel(h) { var x = h % 12 || 12; return x + (h < 12 || h === 24 ? ' am' : ' pm'); }
  function localNow(tz) {
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    var g = function (t) { return (p.find(function (x) { return x.type === t; }) || {}).value; };
    return { date: g('year') + '-' + g('month') + '-' + g('day'), hour: Number(g('hour')) };
  }
  function state_(spot) { return spot.status && spot.status.state; }
  function region(spot) { var parts = String(spot.subtitle || '').split(', '); return parts[parts.length - 1] || ''; }

  /** The best WIN-hour daylight block of one forecast day, from hour `from` on.
   *  Ranked by the mean half-point rating (precise only breaks ties, never shown);
   *  the card shows the window's LOWEST rating: the whole window is at least that. */
  function bestBlock(day, from) {
    var hrs = [];
    for (var h = 0; h < 24; h++) {
      var x = day.hourly[String(h)];
      if (!x || !x.isDay || h < from || !x.prediction || !Number.isFinite(x.prediction.rating)) continue;
      hrs.push({ h: h, r: x.prediction.rating, p: x.prediction.ratingPrecise || x.prediction.rating, ex: x.prediction.explanations || [], c: x });
    }
    if (!hrs.length) return null;
    var want = Math.min(WIN, hrs.length), best = null;
    for (var i = 0; i < hrs.length; i++) {
      var run = [hrs[i]];
      for (var j = i + 1; j < hrs.length && run.length < want && hrs[j].h === run[run.length - 1].h + 1; j++) run.push(hrs[j]);
      if (run.length < want) continue;
      var mean = run.reduce(function (a, r) { return a + r.r; }, 0) / run.length;
      var tie = run.reduce(function (a, r) { return a + r.p; }, 0) / run.length;
      if (!best || mean > best.mean + 1e-9 || (Math.abs(mean - best.mean) < 1e-9 && tie > best.tie)) best = { run: run, mean: mean, tie: tie };
    }
    if (!best) return null;
    var ex = [];
    best.run.forEach(function (r) { r.ex.forEach(function (e) { ex.push(e); }); });
    ex.sort(function (a, b) { return (a.value || 0) - (b.value || 0); });
    var cs = best.run.map(function (r) { return r.c; });
    var max = function (k) { return Math.max.apply(null, cs.map(function (c) { return Number(c[k]) || 0; })); };
    var avg = function (k) { var v = cs.map(function (c) { return Number(c[k]); }).filter(Number.isFinite); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; };
    return {
      start: best.run[0].h, end: best.run[best.run.length - 1].h + 1,
      rating: Math.min.apply(null, best.run.map(function (r) { return r.r; })),
      // Sorted by the number on the card first, so a 1.5 never sits under a 1.0
      rank: Math.min.apply(null, best.run.map(function (r) { return r.r; })) * 100 + best.mean + best.tie / 100,
      why: ex.length ? P.localizeUnits(ex[0].text) : '',
      wind: max('windSpeed'), gust: max('gustSpeed'), temp: avg('temperature'), rain: max('chanceOfRain'), uv: max('uvIndex'),
      water: cs.some(function (c) { return c.waterTempMeasured; }) ? avg('waterTemp') : null,
      daylight: hrs.map(function (r) { return { h: r.h, r: r.r }; })
    };
  }

  function windowFor(ff) {
    var tz = ff.location && ff.location.timeZone;
    var now = localNow(tz);
    var days = ff.forecast || [];
    var i = days.findIndex(function (d) { return d.date === now.date; });
    if (i === -1) i = 0;
    var heatOf = function (d, k) {
      var hrs = [];
      for (var h = 0; h < 24; h++) {
        var x = d && d.hourly[String(h)];
        if (x && x.isDay && x.prediction && Number.isFinite(x.prediction.rating)) hrs.push({ h: h, r: x.prediction.rating, past: k === 0 && h <= now.hour, wind: x.windSpeed, gust: x.gustSpeed, temp: x.temperature, rain: x.chanceOfRain });
      }
      return hrs;
    };
    var today = days[i] && bestBlock(days[i], now.hour + 1);
    if (today && today.daylight.length >= 2) return Object.assign(today, { when: 'Today', hours: heatOf(days[i], 0) });
    var tomorrow = days[i + 1] && bestBlock(days[i + 1], 0);
    return tomorrow ? Object.assign(tomorrow, { when: 'Tomorrow', hours: heatOf(days[i + 1], 1) }) : null;
  }

  var I = function (n) { return (window.KaaykoIcons && window.KaaykoIcons.get(n)) || ''; };
  function photo(sp) {
    var img = Array.isArray(sp.imgSrc) && sp.imgSrc[0];
    return img ? '<img class="pn-img" src="' + esc(img) + '" alt="" loading="lazy" decoding="async">' : '<span class="pn-img"></span>';
  }
  function when(w) { return w.when + ' ' + hourLabel(w.start) + '–' + hourLabel(w.end); }
  function fUrl(id, hash) {
    var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    return '/paddlingout/forecast' + (local ? '.html' : '') + '?id=' + encodeURIComponent(id) + (hash || '');
  }
  function row(sp, feat) { return rowHud(sp, feat); }
  function hShort(h) { var x = h % 12 || 12; return x + (h < 12 ? 'a' : 'p'); }

  /** The window's day, one cell an hour, coloured by the half-point rating; the
   *  window raised, past hours dimmed. `tap` makes each hour a button that reads out. */
  function heat(w, tap, sid) {
    return '<span class="pn-heat' + (tap ? ' pn-heat--tap' : '') + '"' + (tap ? '' : ' aria-hidden="true"') + '>' + w.hours.map(function (x) {
      var cls = tier(x.r)[0] + (x.h >= w.start && x.h < w.end ? ' in' : '') + (x.past ? ' past' : '');
      return tap ? '<button type="button" class="pn-hc ' + cls + '" data-sid="' + esc(sid) + '" data-h="' + x.h + '" aria-label="' + hourLabel(x.h) + ', ' + tier(x.r)[1] + '"></button>'
        : '<i class="' + cls + '"></i>';
    }).join('') + '</span>';
  }
  function verdict(w) {
    var t = tier(w.rating);
    return '<span class="pn-vd ' + t[0] + '"><b>' + t[1] + '</b><span>' + fmtR(w.rating) + '<small>/5</small></span></span>';
  }
  function hourRead(sp, h) {
    var x = sp.win.hours.find(function (y) { return y.h === h; }); if (!x) return '';
    var t = tier(x.r);
    return '<b class="' + t[0] + '">' + hourLabel(x.h) + ' · ' + t[1] + ' ' + fmtR(x.r) + '</b><span><i aria-hidden="true">' + I('wind') + '</i>' + P.fmtWind(x.wind) + ' · gusts ' + P.fmtWind(x.gust) + '</span><span><i aria-hidden="true">' + I('thermometer') + '</i>' + P.fmtTemp(x.temp) + '</span><span><i aria-hidden="true">' + I('rain') + '</i>' + Math.round(x.rain || 0) + '%</span>';
  }

  /** HUD card. Card → tap → it opens in place (every photo, the day hour by hour,
   *  the details) → one button → the forecast page. Nothing else navigates. */
  function rowHud(sp, feat) {
    var w = sp.win, fav = P.isFavorite(sp.id) ? ' is-fav' : '', id = 'more-' + sp.id;
    var t = w ? tier(w.rating) : ['t-off', ''];
    var reads = w ? '<span class="pn-hr"><span title="Best window" class="pn-hw"><i aria-hidden="true">' + I('clock') + '</i>' + (w.when === 'Today' ? '' : 'Tmrw ') + hShort(w.start) + '–' + hShort(w.end) + '</span>' +
      '<span title="Wind / gust"><i aria-hidden="true">' + I('wind') + '</i>' + P.fmtWind(w.wind).replace(/ .*/, '') + '<small>/' + P.fmtWind(w.gust).replace(/ .*/, '') + '</small></span>' +
      '<span title="Air"><i aria-hidden="true">' + I('thermometer') + '</i>' + P.fmtTemp(w.temp).replace(/[CF]$/, '') + '</span></span>'
      : '<span class="pn-hr pn-off">' + esc((sp.status && sp.status.summary) || 'Out of season') + '</span>';
    var imgs = (Array.isArray(sp.imgSrc) ? sp.imgSrc : []).filter(function (u) { return typeof u === 'string' && /^https:\/\//.test(u); });
    var fee = sp.factsBrief && sp.factsBrief.fee;
    var more = '<div class="pn-more" id="' + esc(id) + '" hidden>' +
      (imgs.length ? '<div class="pn-gal" role="group" aria-label="Photos of ' + esc(sp.title) + '">' + imgs.map(function (u, k) {
        return '<img src="' + esc(u) + '" alt="' + esc(sp.title) + ', photo ' + (k + 1) + ' of ' + imgs.length + '" loading="lazy" decoding="async">';
      }).join('') + '</div>' + (imgs.length > 1 ? '<p class="pn-gal-n">' + imgs.length + ' photos · swipe</p>' : '') : '') +
      (w ? '<p class="pn-more-l">' + verdict(w) + ' <span>' + when(w) + (w.why ? ' · ' + esc(w.why) : '') + '</span></p>' +
        heat(w, true, sp.id) + '<p class="pn-hread" aria-live="polite" data-sid="' + esc(sp.id) + '">Tap an hour</p>'
        : '<p class="pn-more-l">' + esc((sp.status && sp.status.summary) || 'Out of season') + '</p>') +
      '<p class="pn-more-a">' + [sp.subtitle && esc(sp.subtitle), sp.waterType && esc(sp.waterType), sp.parkingAvl === 'Y' && 'Parking', sp.restroomsAvl === 'Y' && 'Restrooms',
        fee === 'paid' && 'Entry fee', fee === 'free' && 'Free entry', sp.communitySubmission && (sp.addedByName ? 'Added by ' + esc(sp.addedByName) : 'Added by a paddler')].filter(Boolean).join(' · ') + '</p>' +
      '<a class="pn-more-go" href="' + fUrl(sp.id, '#heatmapContainer') + '">Open forecast &rarr;</a></div>';
    return '<li class="pn-card pn-h ' + t[0] + (feat ? ' pn-feat' : '') + fav + '" data-spot-id="' + esc(sp.id) + '">' +
      '<button type="button" class="pn-h-tap" aria-expanded="false" aria-controls="' + esc(id) + '">' +
        '<span class="pn-media">' + photo(sp) + (imgs.length > 1 ? '<span class="pn-cnt">' + imgs.length + '</span>' : '') + (sp.communitySubmission ? '<span class="pn-dot" title="Added by a paddler"><i aria-hidden="true">' + I('users') + '</i></span>' : '') + '</span>' +
        '<span class="pn-h-txt"><span class="pn-h-top"><span class="pn-name">' + esc(sp.title || sp.lakeName) + '</span>' + (w ? verdict(w) : '') + '</span>' + reads + (w ? heat(w, false) : '') + '</span>' +
      '</button>' + more + '</li>';
  }

  function visible(list) {
    var q = state.q.toLowerCase();
    return list.filter(function (sp) {
      if (q && (String(sp.title) + ' ' + String(sp.subtitle) + ' ' + String(sp.waterType)).toLowerCase().indexOf(q) === -1) return false;
      var f = state.filters;
      var regions = [...f].filter(function (k) { return k.indexOf('r:') === 0; });
      if (regions.length && regions.indexOf('r:' + region(sp)) === -1) return false;
      var types = [...f].filter(function (k) { return k.indexOf('w:') === 0; });
      if (types.length && types.indexOf('w:' + sp.waterType) === -1) return false;
      if (f.has('parking') && sp.parkingAvl !== 'Y') return false;
      if (f.has('restrooms') && sp.restroomsAvl !== 'Y') return false;
      if (f.has('saved') && !P.isFavorite(sp.id)) return false;
      return true;
    });
  }

  function sorted(list) {
    var a = list.slice();
    if (state.sort === 'az') return a.sort(function (x, y) { return String(x.title).localeCompare(String(y.title)); });
    if (state.sort === 'near' && state.near) {
      var d = function (s) { return U.haversineKm(state.near.lat, state.near.lng, s.location.latitude, s.location.longitude); };
      return a.sort(function (x, y) { return d(x) - d(y); });
    }
    return a.sort(function (x, y) { return ((y.win && y.win.rank) || -1) - ((x.win && x.win.rank) || -1); });
  }

  var NEAR_KM = 50;   // past this, "nearest" is not near: hand over to the map search

  // The way on when the list runs out: never a dead end (30 Oct 2026).
  function handoff(kind) {
    var q = state.q, n = state.near, link;
    if (kind === 'search') link = '<a class="pn-go" href="/paddlingout/search?q=' + encodeURIComponent(q) + '">Search any lake, river or town for “' + esc(q) + '” &rarr;</a>' +
      '<a class="pn-go2" href="/paddlingout/search?mode=add">Or add it as a spot</a>';
    else if (kind === 'near') link = '<a class="pn-go" href="/paddlingout/search?lat=' + n.lat.toFixed(4) + '&lng=' + n.lng.toFixed(4) + '">Find any water near you, with live scores &rarr;</a>' +
      '<a class="pn-go2" href="/paddlingout/search?mode=add">Know one? Add it</a>';
    else if (kind === 'filters') link = '<button type="button" class="pn-go" id="pn-clear">Clear filters</button>';
    else if (kind === 'saved') link = '<span class="pn-go2">Tap the heart on any spot&rsquo;s page to save it here.</span>';
    return link;
  }
  function note(title, kind) { return '<li class="pn-note"><p class="pn-note-t">' + title + '</p>' + handoff(kind) + '</li>'; }

  function paint() {
    var list = sorted(visible(state.spots)), html = '';
    if (state.sort === 'near' && state.near) {
      var nearest = list.map(function (s) { return U.haversineKm(state.near.lat, state.near.lng, s.location.latitude, s.location.longitude); }).sort(function (a, b) { return a - b; })[0];
      if (!(nearest <= NEAR_KM)) html += note('Nothing we score is within ' + NEAR_KM + ' km of you' + (Number.isFinite(nearest) ? '; the closest is ' + Math.round(nearest) + ' km away.' : '.'), 'near');
    }
    if (list.length) html += list.map(function (sp, k) { return row(sp, state.sort === 'best' && !state.q && !state.filters.size && k < 3); }).join('');
    else if (state.filters.has('saved') && !P.getFavorites().length) html += note('No saved spots yet.', 'saved');
    else if (state.q) html += note('No spot we score matches “' + esc(state.q) + '”.', 'search');
    else html += note('No spots match these filters.', 'filters');
    // A search that matched something can still mean a place we do not cover.
    if (list.length && state.q) html += note('Looking for somewhere else?', 'search');
    $('pn-list').innerHTML = html;
    var c = $('pn-clear'); if (c) c.onclick = function () { state.filters.clear(); document.querySelectorAll('.pn-chip').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); paint(); };
    var paused = visible(state.paused);
    $('pn-paused').innerHTML = paused.map(function (sp) { return row(sp); }).join('');
    $('pn-paused-t').hidden = !paused.length;
    $('pn-paused-t').textContent = paused.length + (paused.length === 1 ? ' spot' : ' spots') + ' out of season or closed · ' + ($('pn-paused').hidden ? 'Show' : 'Hide');
  }

  // No separate "best" block: the list is sorted best-first and the first three carry
  // the mark. The date line says whether the windows are today's or tomorrow's.
  function paintBest() {
    context(state.spots.filter(function (s) { return s.win && s.win.when === 'Tomorrow'; }).length > state.spots.length / 2);
  }

  function paintChips() {
    var regions = {}, types = {};
    state.spots.concat(state.paused).forEach(function (s) { regions[region(s)] = 1; types[s.waterType] = 1; });
    var chip = function (k, label) { return '<button type="button" class="pn-chip" data-k="' + esc(k) + '" aria-pressed="false">' + esc(label) + '</button>'; };
    $('pn-chips').innerHTML = chip('saved', 'Saved') +
      Object.keys(regions).sort().map(function (r) { return chip('r:' + r, r); }).join('') +
      Object.keys(types).sort().map(function (t) { return chip('w:' + t, t + 's'); }).join('') +
      chip('parking', 'Parking') + chip('restrooms', 'Restrooms');
  }

  function context(tomorrow) {
    var d = new Date(); if (tomorrow) d.setDate(d.getDate() + 1);
    var units = P.isMetric() ? '°C' : '°F';
    $('pn-context').textContent = 'Scores for ' + d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + P.boatTypeLabel() + ' · ' + units + ' · ±0.6';
  }

  async function load() {
    $('pn-list').innerHTML = Array(8).fill('<li class="pn-skel" aria-hidden="true"></li>').join('');
    var r = await U.fetchJson(P.withCraft(API + '/paddlingOut'), { timeoutMs: 12000 });
    if (!r.ok || !Array.isArray(r.data)) { document.body.classList.remove('pn-wait'); $('pn-list').innerHTML = '<li class="pn-empty">Could not load spots. Try again in a moment.</li>'; return; }
    state.paused = r.data.filter(function (s) { return s.status && /season|closed/.test(state_(s) || ''); });
    state.spots = r.data.filter(function (s) { return state.paused.indexOf(s) === -1; });
    paintChips(); context(false);
    // One placeholder per lake, and the paused count, so nothing below the list moves when the cards land
    $('pn-list').innerHTML = Array(state.spots.length).fill('<li class="pn-skel" aria-hidden="true"></li>').join('');
    $('pn-paused-t').hidden = !state.paused.length;
    $('pn-paused-t').textContent = state.paused.length + (state.paused.length === 1 ? ' spot' : ' spots') + ' out of season or closed · Show';
    document.body.classList.remove('pn-wait');
    // One request for the whole list (40 lakes each): one per lake ran into the rate limit by the seventh reload
    var chunks = [];
    for (var i = 0; i < state.spots.length; i += 40) chunks.push(state.spots.slice(i, i + 40));
    await Promise.all(chunks.map(function (c) {
      return U.fetchJson(P.withCraft(API + '/fastForecast/list?spotIds=' + c.map(function (sp) { return encodeURIComponent(sp.id); }).join(',')), { timeoutMs: 20000 })
        .then(function (x) { var m = x.ok && x.data && x.data.spots; if (m) c.forEach(function (sp) { if (m[sp.id] && m[sp.id].forecast) sp.win = windowFor(m[sp.id]); }); });
    }));
    paintBest(); paint();
  }

  $('pn-q').addEventListener('input', U.debounce(function (e) { state.q = e.target.value.trim(); paint(); }, 120));
  $('pn-sort').addEventListener('change', function (e) {
    state.sort = e.target.value;
    if (state.sort === 'near' && !state.near) {
      var area = P.getArea && P.getArea();
      if (area && Number.isFinite(area.lat)) state.near = { lat: area.lat, lng: area.lng };
      else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (p) { state.near = { lat: p.coords.latitude, lng: p.coords.longitude }; paint(); }, function () {
          e.target.value = state.sort = 'best'; paint();
          $('pn-list').insertAdjacentHTML('afterbegin', '<li class="pn-note"><p class="pn-note-t">Location is off, so we can&rsquo;t sort by distance.</p><a class="pn-go" href="/paddlingout/search">Type a town instead &rarr;</a></li>');
        });
        return;
      }
    }
    paint();
  });
  $('pn-chips').addEventListener('click', function (e) {
    var b = e.target.closest('.pn-chip'); if (!b) return;
    var k = b.dataset.k, on = !state.filters.has(k);
    if (on) state.filters.add(k); else state.filters.delete(k);
    b.setAttribute('aria-pressed', String(on)); paint();
  });
  // A tapped icon says what it is, then fades; a second tap or another icon closes it.
  document.addEventListener('click', function (e) {
    var hc = e.target.closest('.pn-hc');
    if (hc) { var sp = state.spots.find(function (x) { return x.id === hc.dataset.sid; }); var out = hc.closest('.pn-more').querySelector('.pn-hread');
      hc.parentNode.querySelectorAll('.pn-hc.on').forEach(function (x) { x.classList.remove('on'); }); hc.classList.add('on');
      if (sp && out) out.innerHTML = hourRead(sp, Number(hc.dataset.h)); return; }
    var tap = e.target.closest('.pn-h-tap');
    if (tap) { var m = document.getElementById(tap.getAttribute('aria-controls')), open = tap.getAttribute('aria-expanded') !== 'true';
      tap.setAttribute('aria-expanded', String(open)); if (m) m.hidden = !open; tap.closest('.pn-card').classList.toggle('is-open', open); return; }
    var b = e.target.closest('.pn-ic');
    document.querySelectorAll('.pn-ic.is-tip').forEach(function (x) { if (x !== b) x.classList.remove('is-tip'); });
    if (b) { b.classList.toggle('is-tip'); clearTimeout(b._t); b._t = setTimeout(function () { b.classList.remove('is-tip'); }, 2200); }
  });
  $('pn-paused-t').addEventListener('click', function () { var l = $('pn-paused'); l.hidden = !l.hidden; paint(); });

  load();
}());
