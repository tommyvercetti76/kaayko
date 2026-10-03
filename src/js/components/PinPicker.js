/**
 * components/PinPicker.js — the ONE map on Paddling Out.
 * Wraps Leaflet (self-hosted at /vendor/leaflet). Exposes window.PinPicker.
 *
 *   var pp = PinPicker.create(el, {
 *     center: [lat, lng], zoom: 4,
 *     pickable: true,        // tap the map → onPick(lat, lng, 'tap')
 *     draggable: true,       // the single pin can be dragged → onPick(lat, lng, 'drag')
 *     onPick: fn, onMove: fn // onMove(center, radiusKm) after pan/zoom settles
 *   });
 *   pp.setPin(lat, lng, { fly: true, zoom: 14 })   one "chosen point" pin
 *   pp.clearPin()
 *   pp.flyTo(lat, lng, zoom)
 *   pp.setResults([{ lat, lng, label, tooltip, color, cover, onClick }])   result pins
 *   pp.fitResults()  pp.clearResults()  pp.invalidate()  pp.center()  pp.radiusKm()
 *   pp.destroy()     cancels pending timers, removes every listener and the map;
 *                    every method is a no-op afterwards. Pages that live for the
 *                    whole visit never need it; anything that mounts a map more
 *                    than once (a modal, a re-rendered panel) must call it.
 *
 * Used by Search (tap-to-search, result pins) and Add-a-lake (draggable pin).
 * Tile source is one constant below; swap it for a keyed provider later.
 */
(function () {
  'use strict';
  var TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var TILE_ATTRIB = '&copy; OpenStreetMap contributors';
  var ICON_BASE = '/vendor/leaflet/images/';

  function pinIcon() {
    return L.icon({
      iconUrl: ICON_BASE + 'marker-icon.png', iconRetinaUrl: ICON_BASE + 'marker-icon-2x.png',
      shadowUrl: ICON_BASE + 'marker-shadow.png',
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
    });
  }

  function resultIcon(p) {
    var bg = p.cover ? 'var(--gold, #b5935a)' : (p.color || '#555');
    var label = p.cover ? '◆' : (p.label != null ? p.label : '–');
    return L.divIcon({
      className: '',
      html: '<div class="pp-pin' + (p.cover ? ' cover' : '') + '" style="background:' + bg + '"><span>' + label + '</span></div>',
      iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28]
    });
  }

  function create(el, opts) {
    opts = opts || {};
    if (!el || typeof L === 'undefined') return null;
    var map = L.map(el, {
      scrollWheelZoom: opts.scrollWheelZoom !== false,
      wheelPxPerZoomLevel: 110,
      zoomControl: true, zoomAnimation: true, fadeAnimation: true, inertia: true,
      tap: true
    }).setView(opts.center || [39.5, -98.35], opts.zoom || 4);
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIB }).addTo(map);
    var results = L.layerGroup().addTo(map);
    var pin = null;
    var pts = [];
    var dead = false;
    var timers = new Set();
    // Every delayed call goes through here, so destroy() can cancel it and a
    // late one never touches a removed map.
    function later(fn, ms) {
      var id = setTimeout(function () { timers.delete(id); if (!dead) fn(); }, ms);
      timers.add(id);
      return id;
    }
    function cancel(id) { if (id != null) { clearTimeout(id); timers.delete(id); } }

    function emitPick(lat, lng, how) { if (typeof opts.onPick === 'function') opts.onPick(lat, lng, how); }

    function setPin(lat, lng, o) {
      if (dead) return null;
      o = o || {};
      if (pin) pin.setLatLng([lat, lng]);
      else {
        pin = L.marker([lat, lng], { draggable: opts.draggable === true, icon: pinIcon(), keyboard: true, title: o.title || 'Chosen point' }).addTo(map);
        if (opts.draggable === true) pin.on('dragend', function () { var p = pin.getLatLng(); emitPick(p.lat, p.lng, 'drag'); });
      }
      if (o.fly) map.flyTo([lat, lng], o.zoom || Math.max(map.getZoom(), 12), { duration: 0.6 });
      else if (o.zoom) map.setView([lat, lng], o.zoom);
      return pin;
    }
    function clearPin() { if (!dead && pin) { map.removeLayer(pin); pin = null; } }
    function flyTo(lat, lng, zoom) { if (!dead) map.flyTo([lat, lng], zoom || map.getZoom(), { duration: 0.6 }); }

    function setResults(list) {
      if (dead) return;
      results.clearLayers(); pts = [];
      (list || []).forEach(function (p) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
        var m = L.marker([p.lat, p.lng], { icon: resultIcon(p), title: p.title || '', keyboard: true });
        if (p.tooltip) m.bindTooltip(p.tooltip, { direction: 'top', offset: [0, -30], opacity: 0.96 });
        if (typeof p.onClick === 'function') m.on('click', function () { p.onClick(p); });
        results.addLayer(m);
        pts.push([p.lat, p.lng]);
      });
    }
    function fitResults(pad) {
      if (dead || !pts.length) return;
      later(function () { map.invalidateSize(); map.fitBounds(pts, { padding: [pad || 40, pad || 40], maxZoom: 12 }); }, 60);
    }
    function clearResults() { if (!dead) { results.clearLayers(); pts = []; } }
    function invalidate() { if (!dead) later(function () { map.invalidateSize(); }, 80); }
    function center() { if (dead) return null; var c = map.getCenter(); return { lat: c.lat, lng: c.lng }; }
    function radiusKm() {
      try { var c = map.getCenter(); return Math.round(map.distance(c, map.getBounds().getNorthEast()) / 1000); }
      catch (e) { return 30; }
    }

    if (opts.pickable === true) {
      map.on('click', function (e) { emitPick(e.latlng.lat, e.latlng.lng, 'tap'); });
    }
    if (typeof opts.onMove === 'function') {
      var t = null;
      map.on('moveend zoomend', function () { cancel(t); t = later(function () { opts.onMove(center(), radiusKm()); }, 250); });
    }
    invalidate();

    function destroy() {
      if (dead) return;
      dead = true;
      timers.forEach(function (id) { clearTimeout(id); });
      timers.clear();
      if (pin) pin.off();
      results.eachLayer(function (m) { m.off(); });
      map.off();       // every map listener
      map.remove();    // tiles, layers, DOM, Leaflet's own window listeners
      pin = null; pts = [];
    }

    return { map: map, setPin: setPin, clearPin: clearPin, flyTo: flyTo, setResults: setResults, fitResults: fitResults,
      clearResults: clearResults, invalidate: invalidate, center: center, radiusKm: radiusKm,
      hasPin: function () { return !!pin; }, destroy: destroy, isDestroyed: function () { return dead; } };
  }

  window.PinPicker = { create: create };
}());
