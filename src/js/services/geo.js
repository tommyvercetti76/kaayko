/**
 * services/geo.js — the ONE geocoding client for Paddling Out.
 * Exposes window.KaaykoGeo. Requires util.js. No DOM.
 *
 *   forward(query)          → { lat, lng, label, radiusKm, address } | null
 *   suggest(query)          → [{ name, value, lat, lng, water, radiusKm }]  (ranked, ≤6)
 *   reverse(lat, lng)       → { city, region, country, countryCode, water, displayName } | null
 *
 * All three go through the API's cached Nominatim proxies (never Nominatim
 * directly), memoise per session, and abort a superseded call: a newer suggest()
 * cancels the older one so a fast typist never sees stale options land late.
 */
(function () {
  'use strict';
  var U = window.KaaykoUtil;
  var forwardCache = new Map();   // query → result
  var suggestCache = new Map();   // query → suggestions
  var reverseCache = new Map();   // "lat,lng" (3dp) → result
  var suggestCtrl = null;

  var CITY_TYPES = ['city', 'town', 'village', 'municipality', 'administrative', 'state', 'county', 'province', 'region'];
  var WATER_TYPES = ['water', 'lake', 'reservoir', 'river', 'bay', 'canal'];

  /** How wide to search around a geocoded place: a city deserves a wider net than a lake. */
  function inferRadiusKm(item) {
    var cls = String(item.class || '').toLowerCase();
    var type = String(item.type || '').toLowerCase();
    return (cls === 'boundary' || CITY_TYPES.indexOf(type) !== -1) ? 60 : 30;
  }

  function rank(item, query) {
    var q = query.toLowerCase();
    var text = ((item.display_name || '') + ' ' + (item.class || '') + ' ' + (item.type || '')).toLowerCase();
    var type = String(item.type || '').toLowerCase();
    var cls = String(item.class || '').toLowerCase();
    var s = Number(item.importance || 0) * 40;
    if (WATER_TYPES.indexOf(type) !== -1) s += 40;
    if (cls === 'natural' || cls === 'waterway') s += 30;
    if (/lake|reservoir|river/.test(text)) s += 25;
    if (['city', 'town', 'village', 'administrative'].indexOf(type) !== -1) s += 18;
    if (['road', 'house', 'residential', 'postcode'].indexOf(type) !== -1) s -= 35;
    q.split(/\s+/).filter(function (t) { return t.length > 2; }).forEach(function (t) { if (text.indexOf(t) !== -1) s += 8; });
    return s;
  }

  function placeFromAddress(a) {
    a = a || {};
    return {
      city: a.city || a.town || a.village || a.hamlet || a.municipality || a.county || '',
      region: a.state || a.region || a.province || a.state_district || '',
      country: a.country || ''
    };
  }

  function forward(query) {
    var key = String(query || '').toLowerCase().trim();
    if (key.length < 2) return Promise.resolve(null);
    if (forwardCache.has(key)) return Promise.resolve(forwardCache.get(key));
    return U.fetchJson(U.apiBase() + '/paddlingOut/geocode?q=' + encodeURIComponent(query) + '&limit=1', { timeoutMs: 8000 })
      .then(function (r) {
        var d = r.ok && Array.isArray(r.data) && r.data[0];
        if (!d) return null;
        var out = {
          lat: parseFloat(d.lat), lng: parseFloat(d.lon),
          label: String(d.display_name || '').split(',').map(function (x) { return x.trim(); })
                   .filter(Boolean).slice(0, 2).join(', '),
          radiusKm: inferRadiusKm(d),
          address: placeFromAddress(d.address)
        };
        forwardCache.set(key, out);
        return out;
      });
  }

  function suggest(query) {
    var key = String(query || '').toLowerCase().trim();
    if (key.length < 3) return Promise.resolve([]);
    if (suggestCache.has(key)) return Promise.resolve(suggestCache.get(key));
    if (suggestCtrl) suggestCtrl.abort();
    suggestCtrl = new AbortController();
    return U.fetchJson(U.apiBase() + '/paddlingOut/geocode?q=' + encodeURIComponent(query) + '&limit=5', { timeoutMs: 3000, signal: suggestCtrl.signal })
      .then(function (r) {
        if (!r.ok || !Array.isArray(r.data)) return [];
        var list = r.data.map(function (d) {
          // "Dillon Reservoir, Dillon, Summit County, Colorado, ..." — the
          // first part is the thing itself, the rest is where it is. Joining
          // the raw slices re-inserted the leading spaces, so trim each part.
          var parts = String(d.display_name || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
          return {
            name: parts[0] || '',
            value: parts.slice(0, 3).join(', '),
            lat: parseFloat(d.lat), lng: parseFloat(d.lon),
            // Whether this is actually water, so a list can say so. Both the
            // Search page and Add-a-lake read it; neither should have to
            // re-derive it from class/type strings.
            water: WATER_TYPES.indexOf(String(d.type || '').toLowerCase()) !== -1 ||
                   ['natural', 'waterway'].indexOf(String(d.class || '').toLowerCase()) !== -1,
            radiusKm: inferRadiusKm(d), _r: rank(d, query)
          };
        }).sort(function (a, b) { return b._r - a._r; }).slice(0, 6)
          .map(function (x) { delete x._r; return x; });
        suggestCache.set(key, list);
        return list;
      });
  }

  function reverse(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve(null);
    var key = lat.toFixed(3) + ',' + lng.toFixed(3);
    if (reverseCache.has(key)) return Promise.resolve(reverseCache.get(key));
    return U.fetchJson(U.apiBase() + '/paddlingOut/reverse-geocode?lat=' + encodeURIComponent(lat) + '&lng=' + encodeURIComponent(lng), { timeoutMs: 8000 })
      .then(function (r) {
        var d = r.ok && r.data && r.data.success ? r.data : null;
        if (d) reverseCache.set(key, d);
        return d;
      });
  }

  window.KaaykoGeo = { forward: forward, suggest: suggest, reverse: reverse, inferRadiusKm: inferRadiusKm };
}());
