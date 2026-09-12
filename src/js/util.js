/**
 * util.js — the tiny helpers every Paddling Out page used to copy.
 * Plain script, no module: exposes window.KaaykoUtil. Load after prod-config.js.
 *
 * One source for: escapeHtml, debounce, haversineKm, clamp, num, fetchJson.
 * If you find yourself writing any of these in a page, import this instead.
 */
(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait);
    };
  }

  /** Great-circle distance in kilometres. */
  function haversineKm(aLat, aLng, bLat, bLng) {
    var R = 6371, toRad = function (d) { return d * Math.PI / 180; };
    var dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /** Number('') and Number(null) are 0. This returns null for absent input. */
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * fetch → JSON with a timeout. Resolves { ok, status, data } and never throws
   * on a network failure (ok:false, status:0). `signal` may be passed to cancel
   * earlier; the timeout aborts on its own.
   */
  function fetchJson(url, opts) {
    opts = opts || {};
    var ctrl = new AbortController();
    var tid = setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || 9000);
    if (opts.signal) opts.signal.addEventListener('abort', function () { ctrl.abort(); }, { once: true });
    var init = Object.assign({}, opts.init || {}, { signal: ctrl.signal });
    return fetch(url, init).then(function (r) {
      clearTimeout(tid);
      return r.json().catch(function () { return null; }).then(function (data) {
        return { ok: r.ok, status: r.status, data: data };
      });
    }).catch(function (err) {
      clearTimeout(tid);
      return { ok: false, status: 0, data: null, aborted: err && err.name === 'AbortError' };
    });
  }

  /** The API base every page must use. prefs.js owns the decision. */
  function apiBase() {
    if (window.KaaykoPrefs && window.KaaykoPrefs.kaaykoApiBase) return window.KaaykoPrefs.kaaykoApiBase();
    if (window.FORCE_PRODUCTION_MODE && window.PRODUCTION_API_BASE) return window.PRODUCTION_API_BASE;
    var h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return window.location.origin + '/api';
    return 'https://api-vwcc5j4qda-uc.a.run.app';
  }

  window.KaaykoUtil = { escapeHtml: escapeHtml, debounce: debounce, haversineKm: haversineKm, clamp: clamp, num: num, fetchJson: fetchJson, apiBase: apiBase };
}());
