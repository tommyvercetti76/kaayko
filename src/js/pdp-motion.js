/**
 * Store → product page motion. Classic script, loaded in <head> on the store
 * page and both product pages, so it is in place before first paint.
 *
 * Grid page:  stamp the tapped photo with view-transition-name so the
 *             browser can morph it into the product hero, and stash its URL.
 * Product page: paint that photo into the hero skeleton BEFORE first render
 *             (in `pagereveal`, which fires before the new document's
 *             transition snapshot), so the morph has a destination even
 *             though the real hero arrives later from the API. Then run the
 *             scroll parallax where CSS scroll timelines are unavailable.
 *
 * No dependencies. Does nothing harmful where View Transitions are absent.
 */
(function () {
  'use strict';

  var KEY = 'kaayko:heroPreview';
  var NAME = 'product-hero';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Grid: stamp the pressed photo ──────────────────────────────────── */
  function stamp(img) {
    // Only one element in the document may carry the name.
    var prev = document.querySelectorAll('[data-pdp-stamped]');
    for (var i = 0; i < prev.length; i++) {
      prev[i].style.viewTransitionName = '';
      prev[i].removeAttribute('data-pdp-stamped');
    }
    img.style.viewTransitionName = NAME;
    img.setAttribute('data-pdp-stamped', '1');
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ src: img.currentSrc || img.src, t: Date.now() }));
    } catch (e) { /* private mode — the morph still works, the preview does not */ }
  }

  document.addEventListener('pointerdown', function (e) {
    if (reduced) return;
    var img = e.target && e.target.closest && e.target.closest('img.carousel-image');
    if (img) stamp(img);
  }, true);

  // Keyboard users: stamp the card's visible image when its link is activated.
  document.addEventListener('keydown', function (e) {
    if (reduced || (e.key !== 'Enter' && e.key !== ' ')) return;
    var card = e.target && e.target.closest && e.target.closest('.carousel-item');
    var img = card && card.querySelector('img.carousel-image');
    if (img) stamp(img);
  }, true);

  /* ── Product page: destination for the morph, painted before first render ── */
  function paintPreview() {
    var host = document.querySelector('.animal-hero-art-skeleton, .product-gallery-skeleton');
    if (!host || host.querySelector('.pdp-hero-preview')) return;
    var data = null;
    try { data = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); } catch (e) {}
    if (!data || !data.src || Date.now() - data.t > 15000) return;
    var img = document.createElement('img');
    img.className = 'pdp-hero-preview';
    img.alt = '';
    img.decoding = 'sync';
    img.src = data.src;                 // already in cache — it was on screen a moment ago
    host.appendChild(img);
  }

  if ('onpagereveal' in window) {
    window.addEventListener('pagereveal', paintPreview, { once: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paintPreview, { once: true });
  } else {
    paintPreview();
  }

  /* ── Parallax fallback (no CSS scroll timelines) ─────────────────────── */
  var cssTimelines = window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()');
  if (reduced || cssTimelines) return;

  document.documentElement.classList.add('pdp-parallax-js');
  var ticking = false;
  function frame() {
    ticking = false;
    var hero = document.querySelector('.animal-v2 .animal-hero-art img, .product-gallery-main img');
    if (!hero) return;
    var range = window.innerHeight * 0.7;
    var p = Math.min(Math.max(window.scrollY / range, 0), 1);
    hero.style.setProperty('--pdp-parallax-y', (-6 * p).toFixed(2) + '%');
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  // The hero is rendered after an API fetch; catch it when it appears.
  new MutationObserver(onScroll).observe(document.documentElement, { childList: true, subtree: true });
  onScroll();
})();
