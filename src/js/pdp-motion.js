/**
 * Store ⇄ product shared-element transition.
 *
 * All the animation lives in css/pdp-motion.css. This file does one job: make
 * sure exactly ONE image in each document carries
 * `view-transition-name: product-hero`, and that on the way back it is the
 * same card the shopper left from — otherwise the browser has nothing to match
 * and falls back to a plain cross-fade.
 *
 * Classic script, loaded in <head>, because the destination has to be stamped
 * before its first render.
 */
(function () {
  'use strict';

  var NAME  = 'product-hero';
  var PREV  = 'kaayko:heroPreview';   // src + card key, for the outward trip
  var BACK  = 'kaayko:heroReturn';    // which card to morph back into
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clearStamps() {
    var prev = document.querySelectorAll('[data-pdp-stamped]');
    for (var i = 0; i < prev.length; i++) {
      prev[i].style.viewTransitionName = '';
      prev[i].removeAttribute('data-pdp-stamped');
    }
  }

  function stamp(img) {
    if (!img) return;
    clearStamps();                       // the name must be unique per document
    img.style.viewTransitionName = NAME;
    img.setAttribute('data-pdp-stamped', '1');
  }

  /* ── Store grid: stamp what was pressed, and remember it ──────────────── */
  function cardKey(img) {
    var card = img.closest && img.closest('.carousel-item');
    if (!card) return '';
    var link = card.querySelector('a[href*="/animals/"], a[href*="/store/p/"]');
    return link ? link.getAttribute('href') : '';
  }

  function onPress(img) {
    if (reduced || !img) return;
    stamp(img);
    try {
      sessionStorage.setItem(PREV, JSON.stringify({ src: img.currentSrc || img.src, t: Date.now() }));
      sessionStorage.setItem(BACK, cardKey(img));
    } catch (e) { /* private mode: the morph still runs, the preview does not */ }
  }

  document.addEventListener('pointerdown', function (e) {
    var img = e.target && e.target.closest && e.target.closest('img.carousel-image');
    if (img) onPress(img);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target && e.target.closest && e.target.closest('.carousel-item');
    if (card) onPress(card.querySelector('img.carousel-image'));
  }, true);

  /* ── Coming back: stamp the card we left from, so it reverses ─────────── */
  function stampReturnCard() {
    if (reduced) return;
    var href = '';
    try { href = sessionStorage.getItem(BACK) || ''; } catch (e) {}
    if (!href) return;
    var link = document.querySelector('.carousel-item a[href="' + href.replace(/"/g, '\\"') + '"]');
    var card = link && link.closest('.carousel-item');
    if (card) stamp(card.querySelector('img.carousel-image'));
  }

  /* ── Product page: give the photograph somewhere to land ─────────────── */
  function paintPreview() {
    var host = document.querySelector('.an-art, .animal-hero-art-skeleton, .product-gallery-main, .product-gallery-skeleton');
    if (!host || host.querySelector('img')) return;   // real image already there
    var data = null;
    try { data = JSON.parse(sessionStorage.getItem(PREV) || 'null'); } catch (e) {}
    if (!data || !data.src || Date.now() - data.t > 20000) return;
    var img = document.createElement('img');
    img.className = 'pdp-hero-preview';
    img.alt = '';
    img.decoding = 'sync';
    img.src = data.src;                 // already cached — it was on screen a moment ago
    host.appendChild(img);
  }

  /* Which page are we on? This script runs in <head>, so <body> is not parsed
     yet and DOM queries answer nothing — the path is the only thing available
     this early. (An earlier version gated the observer below on
     `querySelector('#carousel')` and it therefore never ran at all.) */
  var isPDP = /^\/(animals|store\/p)\//.test(location.pathname);

  /* `pagereveal` fires before the new document's first render — the only
     moment early enough for the browser to match the shared element. */
  window.addEventListener('pagereveal', function () {
    if (isPDP) paintPreview();
    else stampReturnCard();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (isPDP) paintPreview(); else stampReturnCard();
    }, { once: true });
  }

  /* The grid is rendered from an API response, so on a back-navigation the
     card we must stamp usually does not exist yet. Keep looking as the store
     paints.
     Worth being straight about the limit: the browser captures the arriving
     page at `pagereveal`. If the grid has not rendered by then — a cold
     re-render rather than a restore from the back/forward cache — there is
     nothing to match and the return degrades to a cross-fade. The forward
     morph is unaffected. */
  if (!isPDP) {
    var tries = 0;
    var mo = new MutationObserver(function () {
      if (++tries > 60 || document.querySelector('[data-pdp-stamped]')) return mo.disconnect();
      stampReturnCard();
    });
    var start = function () {
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(function () { mo.disconnect(); }, 10000);
    };
    if (document.documentElement) start();
    else document.addEventListener('readystatechange', start, { once: true });
  }
})();
