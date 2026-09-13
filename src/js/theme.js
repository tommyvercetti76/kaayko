/**
 * theme.js — resolves the colour theme before first paint.
 * Load as the FIRST script in <head> (after prod-config.js) on paddling pages.
 *
 * Preference (localStorage kaayko_theme): 'dark' | 'light' | 'system'.
 * Default is 'dark' — the brand's home ground. ?theme=light|dark|system in the
 * URL previews a theme for that page load without saving it.
 *
 * Stamps <html data-theme="dark|light"> (tokens in css/po-tokens.css switch on
 * it) and keeps the legacy .dark-theme class for stylesheets that still key on
 * it. Exposes window.KaaykoTheme { get, set, resolved } and dispatches
 * kaayko:themechange.
 */
(function () {
  'use strict';
  var KEY = 'kaayko_theme';
  var VALID = ['dark', 'light', 'system'];
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function stored() {
    try { var v = localStorage.getItem(KEY); return VALID.indexOf(v) !== -1 ? v : 'dark'; } catch (e) { return 'dark'; }
  }
  function fromUrl() {
    try { var v = new URLSearchParams(location.search).get('theme'); return VALID.indexOf(v) !== -1 ? v : null; } catch (e) { return null; }
  }
  function resolve(pref) {
    if (pref === 'system') return (mq && mq.matches) ? 'light' : 'dark';
    return pref === 'light' ? 'light' : 'dark';
  }
  function apply(pref) {
    var t = resolve(pref);
    var root = document.documentElement;
    root.setAttribute('data-theme', t);
    root.classList.toggle('dark-theme', t === 'dark');
    root.classList.toggle('light-theme', t === 'light');
    root.style.colorScheme = t;
    try { window.dispatchEvent(new CustomEvent('kaayko:themechange', { detail: { theme: t, pref: pref } })); } catch (e) {}
    return t;
  }

  var pref = fromUrl() || stored();
  apply(pref);
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (stored() === 'system' && !fromUrl()) apply('system'); });

  window.KaaykoTheme = {
    get: stored,
    resolved: function () { return document.documentElement.getAttribute('data-theme') || 'dark'; },
    set: function (v) {
      if (VALID.indexOf(v) === -1) v = 'dark';
      try { localStorage.setItem(KEY, v); } catch (e) {}
      return apply(v);
    }
  };
}());
