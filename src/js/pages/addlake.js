/**
 * pages/addlake.js — Add a lake, and Suggest an edit (21 Oct 2026).
 *
 * One question per screen, one button:
 *   Photos → "Where do you put in?" → "Which water is this?" → Sent
 * The map moves under a fixed cross (no 25 px pin to drag on a phone). The
 * server fills in town / county / state / country from the pin
 * (GET /paddlingOut/locate, and again on submit), so nobody types a place.
 * The water list comes from USGS (US) and is ranked by distance to the
 * shoreline. Note, parking, restrooms and email are asked AFTER the entry is
 * in, with a one-time token (POST /submissions/:id/details).
 *
 * Suggest an edit (?mode=add&edit=<spotId>) is one screen with the spot's
 * current values; "Move it" reuses the cross map. It goes to the same review
 * queue and changes nothing until the owner approves.
 *
 * Exposes window.KaaykoAddLake.show(params) — search.js calls it when the Add
 * tab opens, with whatever the Find tab already knows (name, lat, lng).
 * Requires util.js, services/geo.js, services/exifgps.js, PinPicker.js.
 */
(function () {
  'use strict';
  var U = window.KaaykoUtil;
  var G = window.KaaykoGeo;
  var $ = function (id) { return document.getElementById(id); };
  var root = $('al');
  if (!root || !U) return;
  var API = U.apiBase();

  var MAX_PHOTOS = 5;
  var MAX_BYTES = 5 * 1024 * 1024;
  var ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  // Phone cameras produce 3–12 MB photos (and iOS shoots HEIC): downscale and
  // re-encode to JPEG in the browser, which also drops EXIF from what is sent.
  var MAX_DIMENSION = 1800;
  var COMPRESS_TARGET = 900 * 1024;
  var MIN_ZOOM_TO_PLACE = 13;       // below this the cross covers a whole bay
  var ON_WATER_WARN_M = 75;         // further than this inside a lake outline = not a launch
  var MIN_MOVE_M = 15;

  var STEPS = { add: ['photos', 'pin', 'water', 'sent'], edit: ['edit', 'pin', 'sent'] };

  var S = freshState();
  function freshState() {
    return {
      mode: 'add', step: 'photos',
      photos: [], optimizing: 0, fix: null,
      handoff: null, point: null,
      located: null, locatedKey: '', locating: null,
      water: null, otherOpen: false, allowOnWater: false,
      sending: false, result: null,
      spot: null, spotId: null, editPhotos: [], editPoint: null
    };
  }

  // ── Small helpers ──────────────────────────────────────────────────────
  function num(v) { if (v == null || v === '') return null; var n = Number(v); return Number.isFinite(n) ? n : null; }
  function esc(s) { return U.escapeHtml(String(s == null ? '' : s)); }
  function say(id, text, kind) {
    var el = $(id); if (!el) return;
    el.textContent = text || '';
    el.className = 'al-msg' + (id === 'al-pin-msg' ? ' al-footmsg' : '') + (kind ? ' is-' + kind : '');
    // A problem the person has to act on must be on screen, not under the button.
    if (text && (kind === 'error' || kind === 'warn') && id !== 'al-pin-msg') {
      setTimeout(function () { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }, 30);
    }
  }
  function metres(m) {
    if (m == null) return '';
    return m < 1000 ? Math.round(m / 5) * 5 + ' m' : (Math.round(m / 100) / 10) + ' km';
  }
  function haversineM(a, b) { return U.haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000; }

  // ── Steps ──────────────────────────────────────────────────────────────
  function goto(step, opts) {
    opts = opts || {};
    S.step = step;
    root.dataset.step = step;
    root.dataset.mode = S.mode;
    root.querySelectorAll('.al-step').forEach(function (sec) { sec.hidden = sec.dataset.step !== step; });
    var order = STEPS[S.mode];
    var idx = order.indexOf(step);
    root.querySelectorAll('#al-steps li').forEach(function (li) {
      var i = order.indexOf(li.dataset.s);
      li.classList.toggle('is-done', i > -1 && i < idx);
      li.classList.toggle('is-current', i === idx);
      if (i === idx) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('al-back').hidden = idx <= 0 || step === 'sent';
    if (step !== 'pin') say('al-pin-msg', '');
    if (step === 'pin') enterPin();
    if (step === 'water') enterWater();
    renderFoot();
    if (opts.push !== false) {
      try { history[opts.replace ? 'replaceState' : 'pushState']({ al: step }, ''); } catch (e) {}
    }
    if (!opts.quiet) {
      // Short screens (320×568, landscape): the site header and tabs pushed the
      // choice — pre-picked water included — under the button. Start at the question.
      var sec = root.querySelector('.al-step[data-step="' + step + '"]');
      window.scrollTo({ top: window.innerHeight < 700 && sec ? Math.max(0, sec.getBoundingClientRect().top + window.scrollY - 8) : 0 });
      var h = root.querySelector('.al-step[data-step="' + step + '"] .al-h');
      if (h) setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (e) {} }, 50);
    }
  }
  function back() {
    if (S.mode === 'edit' && S.step === 'pin') { goto('edit'); return; }
    var order = STEPS[S.mode];
    var i = order.indexOf(S.step);
    if (i > 0) goto(order[i - 1]);
  }
  $('al-back').addEventListener('click', back);
  window.addEventListener('popstate', function (e) {
    if ($('add-pane').hidden || !started) return;
    // search.js replaces the first entry's state when the tab opens, so an
    // entry with no step of ours is the first step.
    var target = (e.state && e.state.al) || STEPS[S.mode][0];
    if (STEPS[S.mode].indexOf(target) === -1) return;
    // After sending, going back starts a fresh entry rather than re-opening a sent one.
    if (S.result && target !== 'sent') { if (S.mode === 'edit') { goto('sent', { push: false }); return; } startOver(); return; }
    goto(target, { push: false });
  });

  // ── The one button ─────────────────────────────────────────────────────
  var nextBtn = $('al-next');
  function renderFoot() {
    var foot = $('al-foot');
    foot.hidden = S.step === 'sent';
    var label = 'Next', disabled = false;
    if (S.step === 'photos') {
      if (S.optimizing) { label = 'Preparing photos…'; disabled = true; }
      else label = S.photos.length ? 'Next' : 'Add photos';
    } else if (S.step === 'pin') {
      label = S.locating ? 'Checking the spot…' : (S.mode === 'edit' ? 'Use this spot' : 'Put in here');
      disabled = !!S.locating;
    } else if (S.step === 'water') {
      label = S.sending ? 'Sending…' : 'Send';
      disabled = S.sending || !chosenName();
    } else if (S.step === 'edit') {
      var n = editChanges().length;
      label = S.sending ? 'Sending…' : (n ? 'Send edit (' + n + (n === 1 ? ' change)' : ' changes)') : 'No changes yet');
      disabled = S.sending || !n || S.optimizing > 0;
    }
    nextBtn.textContent = label;
    nextBtn.disabled = disabled;
  }
  nextBtn.addEventListener('click', function () {
    if (S.step === 'photos') { if (!S.photos.length) $('al-files').click(); else goto('pin'); return; }
    if (S.step === 'pin') { confirmPin(); return; }
    if (S.step === 'water') { sendNew(); return; }
    if (S.step === 'edit') { sendEdit(); }
  });

  // ── Photos ─────────────────────────────────────────────────────────────
  function loadImageEl(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }
  function canvasToBlob(canvas, q) { return new Promise(function (r) { canvas.toBlob(r, 'image/jpeg', q); }); }
  async function compressImage(file) {
    if (ALLOWED.indexOf(file.type) !== -1 && file.size <= COMPRESS_TARGET) return file;
    var img;
    try { img = await loadImageEl(file); } catch (e) { return file; }
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) return file;
    var scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
    w = Math.round(w * scale); h = Math.round(h * scale);
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    var q = 0.82, blob = await canvasToBlob(canvas, q);
    while (blob && blob.size > COMPRESS_TARGET && q > 0.5) { q -= 0.08; blob = await canvasToBlob(canvas, q); }
    if (!blob) return file;
    var base = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], base + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
  }

  async function addFiles(fileList, list, msgId, onChange) {
    var incoming = Array.from(fileList || []).filter(function (f) { return f && f.size > 0; });
    if (!incoming.length) return;
    var room = MAX_PHOTOS - list.length;
    var dropped = Math.max(0, incoming.length - room);
    incoming = incoming.slice(0, Math.max(0, room));
    if (!incoming.length) { say(msgId, 'Five photos is the most. Remove one to add another.', 'warn'); return; }
    say(msgId, '');

    // GPS from the originals, before re-encoding throws EXIF away. Only the
    // Add flow uses it (an edit's photos never move the pin).
    var fixP = (list === S.photos && !S.fix && window.KaaykoExif)
      ? window.KaaykoExif.firstGps(incoming).catch(function () { return null; }) : Promise.resolve(null);

    S.optimizing++; onChange();
    var ready;
    try { ready = await Promise.all(incoming.map(compressImage)); } catch (e) { ready = incoming; }
    S.optimizing--;
    var skipped = 0;
    ready.forEach(function (f) {
      if (ALLOWED.indexOf(f.type) === -1 || f.size > MAX_BYTES) { skipped++; return; }
      list.push({ file: f, url: URL.createObjectURL(f) });
    });
    var hit = await fixP;
    if (hit && hit.fix && Number.isFinite(hit.fix.lat) && Number.isFinite(hit.fix.lng) && list === S.photos) {
      S.fix = { lat: hit.fix.lat, lng: hit.fix.lng, accuracyM: hit.fix.accuracyM || null };
    }
    if (skipped) say(msgId, skipped + (skipped === 1 ? ' photo' : ' photos') + ' could not be read. JPEG, PNG, WebP or iPhone photos work.', 'error');
    else if (dropped) say(msgId, 'Five photos is the most; ' + dropped + ' left out.', 'warn');
    else if (list === S.photos && S.fix) say(msgId, 'Your photo knows where it was taken, so the map will start there.', 'ok');
    onChange();
  }

  function renderThumbs(list, containerId, dropEl, onChange) {
    var box = $(containerId);
    box.innerHTML = '';
    list.forEach(function (p, i) {
      var d = document.createElement('div');
      d.className = 'al-thumb';
      d.innerHTML = '<img alt="Photo ' + (i + 1) + '"><button type="button" aria-label="Remove photo ' + (i + 1) + '">&times;</button>';
      d.querySelector('img').src = p.url;
      d.querySelector('button').addEventListener('click', function () {
        URL.revokeObjectURL(p.url);
        list.splice(i, 1);
        if (list === S.photos && !list.length) S.fix = null;
        onChange();
      });
      box.appendChild(d);
    });
    if (dropEl) {
      dropEl.classList.toggle('is-compact', list.length > 0);
      dropEl.classList.toggle('is-full', list.length >= MAX_PHOTOS);
      var label = dropEl.querySelector('.al-drop-label');
      if (label) label.textContent = list.length ? 'Add more' : 'Add photos';
    }
  }

  function photosChanged() { renderThumbs(S.photos, 'al-thumbs', $('al-drop'), photosChanged); renderFoot(); }
  $('al-files').addEventListener('change', function () { var f = this.files; addFiles(f, S.photos, 'al-photos-msg', photosChanged); this.value = ''; });
  wireDrop($('al-drop'), function (files) { addFiles(files, S.photos, 'al-photos-msg', photosChanged); });

  function editPhotosChanged() { renderThumbs(S.editPhotos, 'al-e-thumbs', root.querySelector('.al-drop--small'), editPhotosChanged); renderFoot(); }
  $('al-e-files').addEventListener('change', function () { var f = this.files; addFiles(f, S.editPhotos, 'al-edit-msg', editPhotosChanged); this.value = ''; });

  function wireDrop(el, onFiles) {
    el.addEventListener('dragover', function (e) { e.preventDefault(); el.classList.add('is-dragging'); });
    el.addEventListener('dragleave', function () { el.classList.remove('is-dragging'); });
    el.addEventListener('drop', function (e) { e.preventDefault(); el.classList.remove('is-dragging'); onFiles(e.dataTransfer && e.dataTransfer.files); });
  }

  // ── Where do you put in? (the cross map) ───────────────────────────────
  var picker = null;
  function ensureMap() {
    if (picker || !window.PinPicker) return;
    picker = window.PinPicker.create($('al-map'), {
      center: [39.5, -98.35], zoom: 4, pickable: false, draggable: false, scrollWheelZoom: true,
      onMove: function () { if (S.step === 'pin') { say('al-pin-msg', ''); S.allowOnWater = false; } }
    });
  }
  function startView() {
    if (S.mode === 'edit') {
      var p = S.editPoint || spotPoint();
      if (p) { $('al-pin-sub').textContent = 'Move the map until the cross sits on the launch.'; return [p.lat, p.lng, 17]; }
    }
    if (S.point) { $('al-pin-sub').textContent = 'Move the map until the cross sits on the launch.'; return [S.point.lat, S.point.lng, 17]; }
    if (S.fix) { $('al-pin-sub').textContent = 'Your photo was taken here. Nudge the map if the launch is a few steps off.'; return [S.fix.lat, S.fix.lng, 17]; }
    if (S.handoff && S.handoff.lat != null) { $('al-pin-sub').textContent = 'Move the map until the cross sits on the shore where you put in.'; return [S.handoff.lat, S.handoff.lng, 15]; }
    $('al-pin-sub').textContent = 'Search for the lake or a nearby town, or use your location. Then move the map until the cross sits on the launch.';
    return null;
  }
  function enterPin() {
    ensureMap();
    if (!picker) { say('al-pin-msg', 'The map could not load. Check your connection and try again.', 'error'); return; }
    var v = startView();
    picker.invalidate();
    setTimeout(function () {
      picker.map.invalidateSize();
      if (v) picker.map.setView([v[0], v[1]], v[2]);
    }, 90);
    S.allowOnWater = false;
    say('al-pin-msg', '');
    // Small phones and landscape: header, tabs and title left the map under
    // the button (320×568) or entirely below it (844×390). Bring the map up.
    if (window.innerHeight < 700) {
      setTimeout(function () {
        var top = root.querySelector('.al-mapwrap').getBoundingClientRect().top + window.scrollY - 8;
        window.scrollTo({ top: Math.max(0, top) });
      }, 120);
    }
  }

  function locate(lat, lng) {
    var key = lat.toFixed(5) + ',' + lng.toFixed(5);
    if (S.located && S.locatedKey === key) return Promise.resolve(S.located);
    return U.fetchJson(API + '/paddlingOut/locate?lat=' + lat.toFixed(6) + '&lng=' + lng.toFixed(6), { timeoutMs: 14000 })
      .then(function (r) {
        var d = r.ok && r.data && r.data.success ? r.data : null;
        S.located = d; S.locatedKey = key;
        return d;
      });
  }

  async function confirmPin() {
    if (!picker) return;
    var c = picker.center();
    if (picker.map.getZoom() < MIN_ZOOM_TO_PLACE) {
      say('al-pin-msg', 'Zoom in until the cross sits on the launch itself.', 'warn');
      return;
    }
    S.locating = true; renderFoot();
    var loc = await locate(c.lat, c.lng);
    S.locating = null; renderFoot();
    var top = loc && loc.waters && loc.waters[0];
    if (top && top.inside && top.edgeM > ON_WATER_WARN_M && !S.allowOnWater) {
      var el = $('al-pin-msg');
      el.className = 'al-msg al-footmsg is-warn';
      el.textContent = 'That is out on ' + top.name + ', about ' + metres(top.edgeM) + ' from shore. Slide the map so the cross is on the shore where you launch.';
      var keep = document.createElement('button');
      keep.type = 'button'; keep.className = 'al-link'; keep.textContent = 'It is right, keep it';
      keep.addEventListener('click', function () { S.allowOnWater = true; confirmPin(); });
      el.appendChild(document.createTextNode(' '));
      el.appendChild(keep);
      return;
    }
    if (S.mode === 'edit') { S.editPoint = { lat: c.lat, lng: c.lng }; renderEditPin(); goto('edit'); return; }
    S.point = { lat: c.lat, lng: c.lng };
    goto('water');
  }

  // search on the map: a lake, a town, or "31.893, -99.457"
  var searchEl = $('al-search'), listEl = $('al-search-list'), options = [];
  var COORDS = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;
  function renderOptions() {
    searchEl.setAttribute('aria-expanded', options.length ? 'true' : 'false');
    if (!options.length) { listEl.hidden = true; listEl.innerHTML = ''; return; }
    listEl.innerHTML = options.map(function (o, i) {
      return '<div class="search-suggest-item" role="option" data-i="' + i + '"><span>' + esc(o.label) + '</span></div>';
    }).join('');
    listEl.hidden = false;
  }
  function goToOption(o) {
    options = []; renderOptions();
    searchEl.value = o.label; searchEl.blur();
    if (picker) picker.map.setView([o.lat, o.lng], o.zoom);
  }
  var suggest = U.debounce(function () {
    var q = searchEl.value.trim();
    var m = q.match(COORDS);
    if (m) {
      var la = Number(m[1]), ln = Number(m[2]);
      if (Math.abs(la) <= 85 && Math.abs(ln) <= 180) { options = [{ label: 'Go to ' + la + ', ' + ln, lat: la, lng: ln, zoom: 17 }]; renderOptions(); return; }
    }
    if (q.length < 3 || !G) { options = []; renderOptions(); return; }
    G.suggest(q).then(function (list) {
      if (searchEl.value.trim() !== q) return;
      options = (list || []).map(function (s) { return { label: s.label || s.value || s.name, lat: s.lat, lng: s.lng, zoom: s.water ? 15 : 13 }; });
      // Nearest to what the map shows first: "Lake Coleman" from a US map is
      // the Texas one, not Victoria, Australia.
      var c = picker && picker.center();
      if (c) options.sort(function (x, y) { return U.haversineKm(c.lat, c.lng, x.lat, x.lng) - U.haversineKm(c.lat, c.lng, y.lat, y.lng); });
      renderOptions();
    });
  }, 260);
  searchEl.addEventListener('input', suggest);
  searchEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); if (options[0]) goToOption(options[0]); }
    if (e.key === 'Escape') { options = []; renderOptions(); }
  });
  listEl.addEventListener('mousedown', function (e) {
    var item = e.target.closest('[data-i]');
    if (item) { e.preventDefault(); goToOption(options[Number(item.dataset.i)]); }
  });
  searchEl.addEventListener('blur', function () { setTimeout(function () { options = []; renderOptions(); }, 150); });

  var gpsBtn = $('al-gps');
  gpsBtn.addEventListener('click', function () {
    if (!navigator.geolocation) { say('al-pin-msg', 'This browser cannot share a location. Search instead.', 'error'); return; }
    gpsBtn.classList.add('is-busy');
    navigator.geolocation.getCurrentPosition(function (pos) {
      gpsBtn.classList.remove('is-busy');
      if (picker) picker.map.setView([pos.coords.latitude, pos.coords.longitude], 17);
    }, function (err) {
      gpsBtn.classList.remove('is-busy');
      say('al-pin-msg', err && err.code === 1 ? 'Location is off for this site. Search for the lake instead.' : 'Could not get your location. Search for the lake instead.', 'error');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  });

  // ── Which water is this? ───────────────────────────────────────────────
  function placeLine(place) {
    if (!place) return '';
    var where = [place.county, place.region].filter(Boolean);
    if (place.country && place.country !== 'United States') where.push(place.country);
    var lead = place.town ? (place.townDistanceKm === 0 ? 'In ' + place.town : 'Near ' + place.town) : '';
    return [lead, where.join(', ')].filter(Boolean).join(' · ');
  }
  function chosenName() {
    if (S.otherOpen) { var t = $('al-other').value.trim(); return t.length >= 2 ? t : ''; }
    return S.water ? S.water.name : '';
  }
  async function enterWater() {
    var p = S.point;
    $('al-waters').innerHTML = '';
    $('al-place').textContent = 'Looking up this spot…';
    say('al-water-msg', '');
    var loc = await locate(p.lat, p.lng);
    if (S.step !== 'water') return;
    var waters = (loc && loc.waters) || [];
    $('al-place').textContent = loc && loc.place ? placeLine(loc.place) : 'We could not look this spot up. Type the name of the water.';

    var rows = waters.map(function (w) {
      var meta = [w.type ? w.type.charAt(0).toUpperCase() + w.type.slice(1) : 'Water'];
      if (w.inside) meta.push('your pin is on it');
      else if (w.distanceM != null) meta.push(w.distanceM <= 30 ? 'at your pin' : metres(w.distanceM) + ' from your pin');
      else if (w.approximate) meta.push('nearby');
      return { name: w.name, meta: meta.join(' · '), type: w.type };
    });
    var hn = S.handoff && S.handoff.name ? S.handoff.name.trim() : '';
    if (hn && !rows.some(function (r) { return r.name.toLowerCase() === hn.toLowerCase(); })) {
      rows.push({ name: hn, meta: 'The name you searched' });
    }
    // Pre-pick only what is certain: the name they searched, if it is here,
    // else the water right at the pin.
    if (!S.water) {
      var pre = rows.find(function (r) { return hn && r.name.toLowerCase() === hn.toLowerCase() && r.meta !== 'The name you searched'; }) ||
        (waters[0] && (waters[0].inside || waters[0].distanceM <= 150) ? rows[0] : null);
      if (pre) S.water = { name: pre.name, type: pre.type };
    }
    var box = $('al-waters');
    rows.forEach(function (r) { box.appendChild(choiceEl(r.name, r.meta, function () { S.water = { name: r.name, type: r.type }; S.otherOpen = false; syncChoices(); })); });
    box.appendChild(choiceEl('Something else', 'Type the name', function () {
      S.otherOpen = true; S.water = null; syncChoices();
      setTimeout(function () { $('al-other').focus(); $('al-other').scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 30);
    }, true));
    if (!rows.length) { S.otherOpen = true; }
    syncChoices();
  }
  function choiceEl(name, meta, onPick, other) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'al-choice' + (other ? ' al-choice--other' : '');
    b.setAttribute('role', 'radio');
    b.dataset.name = other ? '' : name;
    b.innerHTML = '<span class="al-choice-name">' + esc(name) + '</span><span class="al-choice-mark" aria-hidden="true"></span>' +
      (meta ? '<span class="al-choice-meta">' + esc(meta) + '</span>' : '');
    b.addEventListener('click', onPick);
    return b;
  }
  function syncChoices() {
    $('al-waters').querySelectorAll('.al-choice').forEach(function (b) {
      var on = b.classList.contains('al-choice--other') ? S.otherOpen : (!S.otherOpen && S.water && b.dataset.name === S.water.name);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    $('al-other-wrap').hidden = !S.otherOpen;
    renderFoot();
  }
  $('al-other').addEventListener('input', renderFoot);
  $('al-other').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (chosenName()) sendNew(); } });

  function errorText(r, fallback) {
    if (r && r.data && r.data.error) return r.data.error;
    if (r && r.aborted) return 'That took too long. Check your connection and try again; your photos are still here.';
    if (r && r.status === 0) return 'Could not reach Kaayko. Check your connection and try again; your photos are still here.';
    return fallback;
  }

  async function sendNew() {
    var name = chosenName();
    if (!name || S.sending || !S.point) return;
    if (!S.photos.length) { goto('photos'); say('al-photos-msg', 'Add a photo first.', 'error'); return; }
    S.sending = true; renderFoot(); say('al-water-msg', '');
    var fd = new FormData();
    fd.append('lakeName', name);
    fd.append('lat', S.point.lat.toFixed(6));
    fd.append('lng', S.point.lng.toFixed(6));
    fd.append('website', $('al-website').value);
    fd.append('pageUrl', location.href);
    fd.append('referrer', document.referrer);
    S.photos.forEach(function (p) { fd.append('images', p.file, p.file.name); });
    var r = await U.fetchJson(API + '/paddlingOut/submitEntry', { timeoutMs: 90000, init: { method: 'POST', body: fd } });
    S.sending = false;
    if (!r.ok || !r.data || !r.data.success) { renderFoot(); say('al-water-msg', errorText(r, 'Could not send it. Please try again.'), 'error'); return; }
    S.result = { id: r.data.id, token: r.data.detailsToken || null, place: r.data.place || null, name: name };
    var where = r.data.place ? [r.data.place.town, r.data.place.region].filter(Boolean).join(', ') : '';
    $('al-sent-sub').textContent = 'We have ' + name + (where ? ', near ' + where : '') + '. A person checks every entry before it goes on the map.';
    $('al-extras').hidden = !S.result.token;
    goto('sent', { replace: true });
  }

  // ── Sent: the optional part, asked after the entry is in ────────────────
  $('al-extras').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!S.result || !S.result.token) return;
    var email = $('al-email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('al-extras-msg', 'That email address does not look right.', 'error'); return; }
    // Mapmakers: the name for "Added by" and the monthly-picks opt-in. The
    // server checks both again; the picks need an email to reach the person.
    var name = $('al-name').value.replace(/\s+/g, ' ').trim();
    var picks = $('al-picks').checked;
    if (name && name.length < 2) { say('al-extras-msg', 'Use at least 2 characters for your name.', 'error'); $('al-name').focus(); return; }
    if (picks && !email) { say('al-extras-msg', 'Add your email so we can tell you if your lake is picked.', 'error'); $('al-email').focus(); return; }
    var body = {
      token: S.result.token,
      parkingAvl: $('al-parking').checked ? 'Y' : 'N',
      restroomsAvl: $('al-restrooms').checked ? 'Y' : 'N',
      creditName: name,
      mapmakerOptIn: picks
    };
    var note = $('al-note').value.trim();
    if (note) body.note = note;
    if (email) body.email = email;
    var btn = $('al-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    var r = await U.fetchJson(API + '/paddlingOut/submissions/' + encodeURIComponent(S.result.id) + '/details', {
      timeoutMs: 15000, init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    });
    btn.disabled = false; btn.textContent = 'Save';
    if (!r.ok || !r.data || !r.data.success) { say('al-extras-msg', errorText(r, 'Could not save. Please try again.'), 'error'); return; }
    say('al-extras-msg', picks ? 'Saved. Your lake is up for the monthly picks, and we will email you when it is live.'
      : email ? 'Saved. We will email you when it is live.' : 'Saved. Thank you.', 'ok');
  });
  $('al-another').addEventListener('click', startOver);
  $('al-tomap').addEventListener('click', function () {
    var find = $('mode-find');
    if (find) find.click(); else location.href = '/paddlingout/search';
  });

  function clearInputs() {
    ['al-note', 'al-email', 'al-name', 'al-other', 'al-search', 'al-e-name', 'al-e-note', 'al-e-email'].forEach(function (id) { if ($(id)) $(id).value = ''; });
    ['al-parking', 'al-restrooms', 'al-picks', 'al-e-parking', 'al-e-restrooms'].forEach(function (id) { if ($(id)) $(id).checked = false; });
    ['al-photos-msg', 'al-pin-msg', 'al-water-msg', 'al-extras-msg', 'al-edit-msg'].forEach(function (id) { say(id, ''); });
  }
  function startOver() {
    S.photos.concat(S.editPhotos).forEach(function (p) { URL.revokeObjectURL(p.url); });
    S = freshState();
    clearInputs();
    photosChanged();
    goto('photos', { replace: true });
  }

  // ── Suggest an edit ────────────────────────────────────────────────────
  function spotPoint() {
    var l = S.spot && S.spot.location;
    var la = l && Number(l.latitude), ln = l && Number(l.longitude);
    return Number.isFinite(la) && Number.isFinite(ln) ? { lat: la, lng: ln } : null;
  }
  function yn(v) { return v === true || String(v).toUpperCase() === 'Y'; }
  function renderEditPin() {
    var cur = spotPoint();
    if (S.editPoint && cur) {
      var d = haversineM(S.editPoint, cur);
      $('al-e-pin').textContent = d >= MIN_MOVE_M ? 'Moved ' + metres(d) : 'Where the pin is now';
    } else $('al-e-pin').textContent = 'Where the pin is now';
    renderFoot();
  }
  function editChanges() {
    if (S.mode !== 'edit' || !S.spot) return [];
    var c = [];
    var name = $('al-e-name').value.trim();
    if (name && name !== (S.spot.title || S.spot.lakeName || '')) c.push('name');
    if ($('al-e-note').value.trim() !== (S.spot.text || '').trim()) c.push('note');
    if ($('al-e-parking').checked !== yn(S.spot.parkingAvl)) c.push('parking');
    if ($('al-e-restrooms').checked !== yn(S.spot.restroomsAvl)) c.push('restrooms');
    var cur = spotPoint();
    if (S.editPoint && cur && haversineM(S.editPoint, cur) >= MIN_MOVE_M) c.push('launch');
    if (S.editPhotos.length) c.push('photos');
    return c;
  }
  ['al-e-name', 'al-e-note'].forEach(function (id) { $(id).addEventListener('input', renderFoot); });
  ['al-e-parking', 'al-e-restrooms'].forEach(function (id) { $(id).addEventListener('change', renderFoot); });
  $('al-e-move').addEventListener('click', function () { goto('pin'); });

  async function startEdit(id) {
    if (S.mode === 'edit' && S.spotId === id && S.spot) { goto(S.step === 'pin' ? 'pin' : (S.step === 'sent' ? 'sent' : 'edit'), { push: false, quiet: true }); return; }
    S = freshState();
    S.mode = 'edit'; S.spotId = id;
    clearInputs();
    document.documentElement.setAttribute('data-lake-edit', '');
    if (window.PoHeader) window.PoHeader.setTitle('Suggest an edit');
    document.title = 'Suggest an edit | Kaayko Paddling Out';
    goto('edit', { replace: true });
    $('al-edit-sub').textContent = 'Loading…';
    var r = await U.fetchJson(API + '/paddlingOut/' + encodeURIComponent(id), { timeoutMs: 12000 });
    if (!r.ok || !r.data || !r.data.id) {
      $('al-edit-sub').textContent = 'That spot is not on the map.';
      nextBtn.disabled = true;
      return;
    }
    S.spot = r.data;
    var title = S.spot.title || S.spot.lakeName || 'this spot';
    $('al-edit-sub').innerHTML = 'to <b>' + esc(title) + '</b>. A person checks it before anything changes on the map.';
    $('al-e-name').value = title;
    $('al-e-note').value = S.spot.text || '';
    $('al-e-parking').checked = yn(S.spot.parkingAvl);
    $('al-e-restrooms').checked = yn(S.spot.restroomsAvl);
    var strip = $('al-cur-photos');
    strip.innerHTML = '';
    (S.spot.imgSrc || []).slice(0, 6).forEach(function (src) {
      var img = document.createElement('img'); img.src = src; img.alt = ''; img.loading = 'lazy'; strip.appendChild(img);
    });
    renderEditPin();
  }

  async function sendEdit() {
    var changes = editChanges();
    if (!changes.length || S.sending) return;
    var email = $('al-e-email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('al-edit-msg', 'That email address does not look right.', 'error'); return; }
    S.sending = true; renderFoot(); say('al-edit-msg', '');
    var fd = new FormData();
    if (changes.indexOf('name') !== -1) fd.append('lakeName', $('al-e-name').value.trim());
    if (changes.indexOf('note') !== -1) fd.append('description', $('al-e-note').value.trim());
    if (changes.indexOf('parking') !== -1) fd.append('parkingAvl', $('al-e-parking').checked ? 'Y' : 'N');
    if (changes.indexOf('restrooms') !== -1) fd.append('restroomsAvl', $('al-e-restrooms').checked ? 'Y' : 'N');
    if (changes.indexOf('launch') !== -1) { fd.append('lat', S.editPoint.lat.toFixed(6)); fd.append('lng', S.editPoint.lng.toFixed(6)); }
    if (email) fd.append('email', email);
    fd.append('website', $('al-website').value);
    fd.append('pageUrl', location.href);
    fd.append('referrer', document.referrer);
    S.editPhotos.forEach(function (p) { fd.append('images', p.file, p.file.name); });
    var r = await U.fetchJson(API + '/paddlingOut/spots/' + encodeURIComponent(S.spotId) + '/suggest', { timeoutMs: 90000, init: { method: 'POST', body: fd } });
    S.sending = false;
    if (!r.ok || !r.data || !r.data.success) { renderFoot(); say('al-edit-msg', errorText(r, 'Could not send the edit. Please try again.'), 'error'); return; }
    S.result = { id: r.data.id, token: null };
    var list = (r.data.changes || []).join('; ');
    $('al-sent-sub').textContent = (list ? list + '. ' : '') + 'A person checks it before anything changes on the map' + (email ? ', and we will email you either way.' : '.');
    $('al-extras').hidden = true;
    $('al-another').textContent = 'Back to ' + (S.spot.title || 'the spot');
    goto('sent', { replace: true });
  }

  // "Add another" after an edit goes back to the spot's page instead.
  $('al-another').addEventListener('click', function (e) {
    if (S.mode === 'edit' && S.spotId) { e.stopImmediatePropagation(); location.href = '/paddlingout/forecast?id=' + encodeURIComponent(S.spotId); }
  }, true);

  // ── Entry ──────────────────────────────────────────────────────────────
  var started = false;
  window.KaaykoAddLake = {
    show: function (params) {
      var p = params || new URLSearchParams(location.search);
      var editId = p.get('edit');
      if (editId && /^[a-zA-Z0-9_-]+$/.test(editId)) { started = true; startEdit(editId); return; }
      if (S.mode === 'edit') {
        document.documentElement.removeAttribute('data-lake-edit');
        S = freshState(); clearInputs(); photosChanged(); started = false;
      }
      var name = (p.get('name') || '').trim(), lat = num(p.get('lat')), lng = num(p.get('lng'));
      if (name || (lat != null && lng != null)) {
        if (S.result) startOver();
        S.handoff = { name: name, lat: lat, lng: lng };
        S.water = null; S.located = null; S.locatedKey = '';
      }
      if (!started) { started = true; goto(STEPS.add[0], { replace: true, quiet: true }); }
      else { renderFoot(); if (S.step === 'pin' && picker) picker.invalidate(); }
    }
  };
  photosChanged();
  if (!$('add-pane').hidden && !started) window.KaaykoAddLake.show();
}());
