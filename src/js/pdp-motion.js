/**
 * Store ⇄ product: the tapped photograph grows into the product page, and
 * shrinks back into its card on the way out.
 *
 * One mechanism, both ways. The page we arrive on draws the photograph as a
 * fixed <img> exactly where it sat on the page we left, then animates its box
 * to where it belongs. It is a live element with object-fit: cover, so it
 * re-crops continuously from the card's shape (5:4 for a mug, 1:1 for a
 * magnet) to the 4:5 frame. A view-transition snapshot cannot do that: it is a
 * picture of the already-cropped photo, and stretching it to the other shape
 * squeezed it before it grew (filmed on a phone, 25 Oct 2026).
 *
 * The browser's cross-document view transition still runs underneath, fading
 * the old page into the new one. The flyer carries its own view-transition-name
 * so it rides above that fade instead of fading with it, and the photo it
 * replaces on the old page carries `hero-src` and leaves its slot.
 *
 * Classic script in <head>: `pagereveal` fires before the new page's first
 * render, the only moment the flyer can be in place for frame one.
 */
(function () {
  'use strict';

  var FLY  = 'kaayko:heroFly';     // outward: { src, from, to, t }
  var BACK = 'kaayko:heroReturn';  // { href, from, store }: the card we left from
  var HOME = 'kaayko:heroHome';    // homeward: the product frame we left, { from, t }
  var OUT_MS = 420, HOME_MS = 360;
  var EASE = 'cubic-bezier(.32, .72, 0, 1)';   // quick away, long soft settle
  var root = document.documentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isPDP = /^\/(animals|store\/p|p)\//.test(location.pathname);

  function get(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function put(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function drop(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function fresh(d) { return d && Date.now() - d.t < 8000; }
  function shown(img) { return img.offsetParent !== null; }
  function box(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, radius: getComputedStyle(el).borderRadius };
  }

  /* The photo leaves its slot: it is dropped from the old page's snapshot. */
  function lift(el) {
    var prev = document.querySelector('[data-hero-src]');
    if (prev) { prev.style.viewTransitionName = ''; prev.removeAttribute('data-hero-src'); }
    el.style.viewTransitionName = 'hero-src';
    el.setAttribute('data-hero-src', '');
  }

  function at(b) {
    return { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px', borderRadius: b.radius };
  }

  /* The photograph, drawn where it was on the page we left. */
  function takeOff(src, from, kind) {
    var f = new Image();
    f.className = 'hero-fly';
    f.alt = '';
    f.decoding = 'sync';
    f.src = src;                        // on screen a moment ago, so already cached
    Object.assign(f.style, at(from));
    root.setAttribute('data-hero-flying', kind);
    (document.body || root).appendChild(f);
    return f;
  }

  function done(f) {
    root.removeAttribute('data-hero-flying');   // the photo underneath shows in the same frame
    f.remove();
  }

  function land(f, from, to, ms, then) {
    var a = f.animate([at(from), at(box(to))], { duration: ms, easing: EASE, fill: 'forwards' });
    a.onfinish = a.oncancel = function () { done(f); if (then) then(); };
  }

  /* A product page's HTML is fetched the moment a card is pointed at (hover on
     a desktop, touch on a phone), so the photo starts to move sooner. HTML
     only: nothing on the page runs until the shopper actually opens it. */
  if (window.HTMLScriptElement && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
    var rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({ prefetch: [{ where: { href_matches: '/store/p/*' }, eagerness: 'moderate' }] });
    document.head.appendChild(rules);
  }

  /* ── Leaving through a card (the store grid, or "You may also like") ──── */
  document.addEventListener('click', function (e) {
    if (reduced) return;
    var t = e.target;
    var card = t.closest && t.closest('.carousel-item');
    if (!card || t.closest('button, .cart-link, .fitp')) return;
    var link = card.querySelector('a[href*="/store/p/"]');
    var img = [].filter.call(card.querySelectorAll('img.carousel-image'), shown)[0];
    if (!link || !img) return;
    lift(img);
    put(FLY, { src: img.currentSrc || img.src, from: box(img), to: link.pathname, t: Date.now() });
    put(BACK, { href: link.getAttribute('href'), from: location.href, store: !isPDP });
  }, true);

  /* ── Leaving a product page any other way: the frame is what goes home ── */
  window.addEventListener('pageswap', function () {
    if (reduced || !isPDP || fresh(get(FLY))) return;   // a card was tapped: that photo flies instead
    var frame = document.querySelector('.product-gallery-main');
    if (!frame) return;
    lift(document.querySelector('.pdp-inspect.is-ready.is-shown') || frame);
    // the card shows the first photograph, whichever one the frame is showing now
    var first = document.querySelector('.product-thumb:not(.product-thumb-3d) img') || frame.querySelector('img');
    put(HOME, { from: box(frame), src: first && (first.currentSrc || first.src), t: Date.now() });
  });

  /* "← All products" goes BACK to the grid the shopper came from, not to a
     fresh copy of it: they keep their place, and the photo has a card to
     shrink into. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('.animal-breadcrumb a');
    var b = get(BACK);
    if (!a || !b || !b.store || b.from !== document.referrer || history.length < 2) return;
    if (new URL(b.href, location.href).pathname !== location.pathname) return;
    e.preventDefault();
    history.back();
  });

  /* ── Arriving on a product page: grow from the card into the frame ───── */
  function arrive() {
    var d = get(FLY);
    if (!fresh(d) || d.to !== location.pathname) return false;
    var host = document.querySelector('.product-gallery-main, .product-gallery-skeleton, .an-art, .animal-hero-art-skeleton');
    if (!host) return false;
    drop(FLY); drop(HOME);
    if (!host.querySelector('img')) {   // somewhere to land while the product loads
      var p = new Image();
      p.className = 'pdp-hero-preview';
      p.alt = '';
      p.decoding = 'sync';
      p.src = d.src;
      host.appendChild(p);
    }
    land(takeOff(d.src, d.from, 'out'), d.from, host, OUT_MS);
    return true;
  }

  /* ── Arriving back: shrink from the frame into the card we left from ─── */
  function cardImg(b) {
    var link = document.querySelector('.carousel-item a[href="' + b.href.replace(/"/g, '\\"') + '"]');
    var card = link && link.closest('.carousel-item');
    return card && [].filter.call(card.querySelectorAll('img.carousel-image'), shown)[0];
  }
  function onScreen(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }

  function home() {
    var d = get(HOME), b = get(BACK);
    if (!fresh(d) || !b) return false;
    var img = cardImg(b);
    if (img ? !onScreen(img) : !d.src) return false;
    drop(HOME);
    var f = takeOff(img ? img.currentSrc || img.src : d.src, d.from, 'home');
    function settle(img) {
      land(f, d.from, img, HOME_MS, function () { img.removeAttribute('data-hero-land'); });
    }
    if (img) { img.setAttribute('data-hero-land', ''); settle(img); return true; }

    // Not restored from the back/forward cache (iPhone Safari reloaded the store
    // every time when filmed, 25 Oct 2026), so the card does not exist yet. The
    // photo waits where it was and settles once its card is drawn, or fades if
    // the card never shows on screen.
    var mo = new MutationObserver(function () {
      var img = cardImg(b);
      if (!img) return;
      stop();
      img.setAttribute('data-hero-land', '');          // hidden before it can paint
      requestAnimationFrame(function () {              // measured once the grid has laid out
        if (onScreen(img)) settle(img);
        else { img.removeAttribute('data-hero-land'); fade(); }
      });
    });
    var timer = setTimeout(function () { stop(); fade(); }, 1500);
    function stop() { mo.disconnect(); clearTimeout(timer); }
    function fade() { f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).onfinish = function () { done(f); }; }
    mo.observe(document.body || root, { childList: true, subtree: true });
    return true;
  }

  function reveal() {
    // a page restored from the back/forward cache still wears the name it left
    // with; matched against the page we came from it would morph on its own
    var prev = document.querySelector('[data-hero-src]');
    if (prev) { prev.style.viewTransitionName = ''; prev.removeAttribute('data-hero-src'); }
    if (reduced) return;
    if (!(isPDP && arrive())) home();
  }

  if ('onpagereveal' in window) window.addEventListener('pagereveal', reveal);
  else document.addEventListener('DOMContentLoaded', reveal, { once: true });
})();
