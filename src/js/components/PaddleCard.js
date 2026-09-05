/**
 * PaddleCard — the one "singular" lake card, shared by the Paddling Out list and
 * the About page (classic script, exposes window.PaddleCard).
 * ---------------------------------------------------------------------------
 * Two looks, one component:
 *   • variant:'full'    — the detailed list card (image carousel, name/location/
 *                         description, Forecast/Rate actions, conditions badge,
 *                         favorite ★ top-left). Uses paddlingout.css classes.
 *   • variant:'minimal' — the image-first tile (About look): photo, scrim, name +
 *                         location + Paddle Score overlaid, image carousel, and
 *                         LONG-PRESS-TO-LOVE (haptic + gold saved outline).
 *
 * Both variants share ONE carousel/swipe engine and normalize the raw spot
 * ({id,title,subtitle,text,imgSrc[],paddleScore.rating}) the same way, so a lake
 * looks and behaves identically wherever it appears.
 *
 * Requires window.KaaykoPrefs (js/prefs.js) loaded first for favorites + score color.
 */
(function () {
  'use strict';

  var API_FALLBACK = 'https://api-vwcc5j4qda-uc.a.run.app';
  var SWIPE = 40;   // px — commit an image change
  var MOVE  = 10;   // px — "the finger moved" gate (cancels a long-press / arms swipe)
  var LONG_MS = 500;

  // ── data shaping ────────────────────────────────────────────────────────────
  function normalize(spot) {
    spot = spot || {};
    var imgs = Array.isArray(spot.imgSrc) ? spot.imgSrc.filter(Boolean)
             : (spot.imgSrc ? [spot.imgSrc] : []);
    return {
      id: spot.id,
      // Full names only — title first (e.g. "White Rock Lake"), never the slug-ish lakeName.
      title: spot.title || spot.lakeName || spot.name || spot.id || 'Unnamed spot',
      subtitle: spot.subtitle || spot.location || '',
      text: spot.text || spot.description || '',
      images: imgs,
      // Display the half-point rating — precise decimals read as pseudo-precision
      // on a card (ratingPrecise stays in the API for research/evals).
      rating: (spot.paddleScore && spot.paddleScore.rating != null) ? spot.paddleScore.rating : null,
      youtubeURL: spot.youtubeURL || '',
      waterType: spot.waterType || null,
      coverageGrade: (spot.cellCoverage && spot.cellCoverage.grade) || null
    };
  }

  // Canonical 3-tier scale (matches prefs.js paddleScoreColor + the verdict labels).
  function scoreMeta(rating) {
    var P = window.KaaykoPrefs;
    if (rating == null) return { color: '#555', label: 'N/A', severity: null, display: '—' };
    var sev = rating >= 3.7 ? 'good' : rating >= 2.7 ? 'moderate' : 'critical';
    var label = sev === 'good' ? 'Worth it' : sev === 'moderate' ? 'Careful' : 'Hard pass';
    var color = (P && P.paddleScoreColor) ? P.paddleScoreColor(rating)
              : (sev === 'good' ? '#316d43' : sev === 'moderate' ? '#c59a61' : '#bd3b2b');
    return { color: color, label: label, severity: sev, display: Number(rating).toFixed(1) };
  }

  // Delegates to the single source of truth in prefs.js (loaded first on every
  // page that uses this component); the literal stays only as a hard fallback.
  function apiBase() {
    if (window.KaaykoPrefs && window.KaaykoPrefs.kaaykoApiBase) return window.KaaykoPrefs.kaaykoApiBase();
    if (window.FORCE_PRODUCTION_MODE && window.PRODUCTION_API_BASE) return window.PRODUCTION_API_BASE;
    var h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return window.location.origin + '/api';
    return API_FALLBACK;
  }

  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  // ── shared carousel + gesture engine ─────────────────────────────────────────
  // Wires swipe (both variants) and, when opts.longPressFavorite, long-press-to-love.
  // sel = { box, img, dot } CSS selectors within `root`.
  function wireGestures(root, media, sel, opts, spot) {
    var imgs = root.querySelectorAll(sel.img);
    var dots = sel.dot ? root.querySelectorAll(sel.dot) : [];

    function show(n) {
      if (!imgs.length) return;
      var i = ((n % imgs.length) + imgs.length) % imgs.length;
      for (var k = 0; k < imgs.length; k++) imgs[k].classList.toggle('active', k === i);
      for (var d = 0; d < dots.length; d++) dots[d].classList.toggle('active', d === i);
    }
    function activeIdx() {
      for (var k = 0; k < imgs.length; k++) if (imgs[k].classList.contains('active')) return k;
      return 0;
    }
    root._pcShow = show;
    root._pcActive = activeIdx;

    var startX = 0, startY = 0, pressing = false, moved = false, swiped = false, lpFired = false, lpTimer = null, chargeEl = null;
    function stopCharge() { if (chargeEl) { if (chargeEl.parentNode) chargeEl.parentNode.removeChild(chargeEl); chargeEl = null; } }
    function clearLP() { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } stopCharge(); }
    // A "charging" heart grows during the hold, so the long-press is discoverable + shows progress.
    function startCharge() {
      stopCharge();
      chargeEl = document.createElement('span');
      chargeEl.className = 'pcard-charge';
      chargeEl.innerHTML = HEART_OUTLINE;
      media.appendChild(chargeEl);
      void chargeEl.offsetWidth;
      chargeEl.classList.add('go');
    }
    // Gestures live on the media box; a press that starts on a control inside it
    // (fav, caret, dot, arrow, badge, actions) belongs to that control, not to a swipe/long-press.
    var CONTROLS = '.pcard-fav, .pcard-caret, .kaayko-fav-btn, .pcard-dot, .carousel-dot, .carousel-nav, .conditions-badge, .card-actions';

    function down(e, x, y) {
      if (e.target && e.target.closest && e.target.closest(CONTROLS)) { pressing = false; return; }
      startX = x; startY = y; pressing = true; moved = false; swiped = false; lpFired = false;
      if (opts.longPressFavorite && spot && spot.id) {
        clearLP();
        startCharge();
        lpTimer = setTimeout(function () {
          if (pressing && !moved) { lpFired = true; stopCharge(); love(root, spot); }
        }, LONG_MS);
      }
    }
    function move(x, y) {
      if (!pressing) return;
      if (Math.abs(x - startX) > MOVE || Math.abs(y - startY) > MOVE) { moved = true; clearLP(); }
    }
    function up(x) {
      if (!pressing) return;
      pressing = false; clearLP();
      var dx = x - startX;
      // carouselSwipe:false (e.g. inside a horizontal scroll-snap rail) → let the
      // rail own horizontal drags; images change via the dots instead.
      if (opts.carouselSwipe !== false && imgs.length > 1 && Math.abs(dx) >= SWIPE) {
        swiped = true; show(activeIdx() + (dx < 0 ? 1 : -1));
      }
    }

    // Only the media area listens for gestures (so buttons/links keep working).
    if (window.PointerEvent) {
      media.addEventListener('pointerdown', function (e) { down(e, e.clientX, e.clientY); });
      media.addEventListener('pointermove', function (e) { move(e.clientX, e.clientY); });
      media.addEventListener('pointerup',   function (e) { up(e.clientX); });
      media.addEventListener('pointercancel', function () { pressing = false; clearLP(); });
    } else {
      media.addEventListener('touchstart', function (e) { var t = e.touches[0]; down(e, t.clientX, t.clientY); }, { passive: true });
      media.addEventListener('touchmove',  function (e) { var t = e.touches[0]; move(t.clientX, t.clientY); }, { passive: true });
      media.addEventListener('touchend',   function (e) { var t = e.changedTouches[0]; up(t.clientX); });
      media.addEventListener('mousedown',  function (e) { down(e, e.clientX, e.clientY); });
      media.addEventListener('mousemove',  function (e) { move(e.clientX, e.clientY); });
      media.addEventListener('mouseup',    function (e) { up(e.clientX); });
      media.addEventListener('mouseleave', function () { pressing = false; clearLP(); });
    }

    // Swallow the click/navigation that a swipe or a long-press would otherwise trigger.
    root.addEventListener('click', function (e) {
      if (swiped || lpFired) { e.preventDefault(); e.stopPropagation(); swiped = false; lpFired = false; }
    }, true);
    // No iOS text-callout / context menu while long-pressing to love.
    if (opts.longPressFavorite) {
      media.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }
  }

  // ── long-press-to-love: save + haptic + gold outline + satisfying animation ──
  var HEART = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20.7s-6.9-4.4-9.3-8.6C1.2 9.4 2.4 6.1 5.6 6.1c1.9 0 3.1 1.1 3.8 2.2l.6.9.6-.9c.7-1.1 1.9-2.2 3.8-2.2 3.2 0 4.4 3.3 2.9 6-2.4 4.2-9.3 8.6-9.3 8.6z"/></svg>';

  // Plays the completion animation (card pop; gold heart bloom only when it becomes saved).
  function animateLove(root, saved) {
    root.classList.remove('pcard-loved');
    void root.offsetWidth;                       // restart on repeated presses
    root.classList.add('pcard-loved');
    setTimeout(function () { root.classList.remove('pcard-loved'); }, 480);
    if (!saved) return;
    var heart = document.createElement('span');
    heart.className = 'pcard-heart';
    heart.innerHTML = HEART;
    root.appendChild(heart);
    void heart.offsetWidth;
    heart.classList.add('go');
    setTimeout(function () { if (heart.parentNode) heart.parentNode.removeChild(heart); }, 720);
  }

  function love(root, spot) {
    var P = window.KaaykoPrefs;
    if (!P || !spot || !spot.id) return;
    var nowFav = P.toggleFavorite({ id: spot.id, title: spot.title, subtitle: spot.subtitle });
    try { if (navigator.vibrate) navigator.vibrate(nowFav ? [14, 8, 14] : 18); } catch (e) {}
    root.classList.toggle('is-fav', nowFav);
    animateLove(root, nowFav);
  }

  // Registered with the shared self-pruning painter registry — a per-card window
  // listener leaked one (or three) listeners per card on every re-render.
  function keepFavSynced(root, spot) {
    if (!spot || !spot.id || !window.KaaykoPrefs || !window.KaaykoPrefs.registerFavPainter) return;
    window.KaaykoPrefs.registerFavPainter(root, function () {
      root.classList.toggle('is-fav', !!window.KaaykoPrefs.isFavorite(spot.id));
    });
  }

  // Sharp chevron (square caps, mitre joins) — matches the hard-edged card language.
  var CHEVRON_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M15 4l-8 8 8 8"/></svg>';
  var CHEVRON_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M9 4l8 8-8 8"/></svg>';
  var HEART_OUTLINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="miter" aria-hidden="true"><path d="M12 20.4S3.6 15.1 3.6 9.6C3.6 7 5.6 5.4 7.7 5.4c1.6 0 2.9.9 3.7 2l.6.9.6-.9c.8-1.1 2.1-2 3.7-2 2.1 0 4.1 1.6 4.1 4.2 0 5.5-8.4 10.8-8.4 10.8z"/></svg>';
  var HEART_FILLED  = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20.7s-6.9-4.4-9.3-8.6C1.2 9.4 2.4 6.1 5.6 6.1c1.9 0 3.1 1.1 3.8 2.2l.6.9.6-.9c.7-1.1 1.9-2.2 3.8-2.2 3.2 0 4.4 3.3 2.9 6-2.4 4.2-9.3 8.6-9.3 8.6z"/></svg>';

  // Accessible non-anchor control (valid inside the card's <a>): a keyboard-operable span.
  function ctrlBtn(cls, label) { return el('span', cls, { role: 'button', tabindex: '0', 'aria-label': label }); }
  function onActivate(node, fn) {
    node.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(e); });
    node.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); e.stopPropagation(); fn(e); }
    });
  }

  // ── MINIMAL variant (image-first tile; chamfered frame, edge carets, long-press) ─
  function buildMinimal(data, opts) {
    var forecastUrl = '/paddlingout/forecast?id=' + encodeURIComponent(data.id);
    var href = opts.href || forecastUrl;

    var root = el('a', 'pcard pcard--minimal', { href: href });
    if (window.KaaykoPrefs && window.KaaykoPrefs.isFavorite(data.id)) root.classList.add('is-fav');
    root.setAttribute('aria-label', data.title + (data.subtitle ? ' — ' + data.subtitle : ''));

    // Inner body sits inset from the root by the frame width; the root's gold shows
    // through as a chamfered border (thin hairline normally, brighter when saved).
    var body = el('div', 'pcard-body');
    var media = el('div', 'pcard-media');

    if (data.images.length) {
      data.images.forEach(function (url, i) {
        var img = el('img', 'pcard-img' + (i === 0 ? ' active' : ''));
        img.dataset.index = i;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.alt = data.title;
        img.src = url;
        media.appendChild(img);
      });
    } else {
      media.classList.add('pcard-media--empty');
    }

    media.appendChild(el('div', 'pcard-scrim'));

    // Edge carets (only with >1 image) — sharp chamfered chips; keyboard-operable.
    if (data.images.length > 1) {
      var prev = ctrlBtn('pcard-caret prev', 'Previous photo'); prev.innerHTML = CHEVRON_L;
      var next = ctrlBtn('pcard-caret next', 'Next photo'); next.innerHTML = CHEVRON_R;
      onActivate(prev, function () { if (root._pcShow) root._pcShow(root._pcActive() - 1); });
      onActivate(next, function () { if (root._pcShow) root._pcShow(root._pcActive() + 1); });
      media.appendChild(prev); media.appendChild(next);
    }

    // Save control — accessible (keyboard/mouse/AT) heart chip, revealed on hover/focus,
    // faint on touch, gold-filled when saved. Long-press stays the touch power-gesture.
    if (opts.showFavorite !== false && data.id && window.KaaykoPrefs) {
      var fav = ctrlBtn('pcard-fav', '');
      var paintFav = function () {
        var on = window.KaaykoPrefs.isFavorite(data.id);
        fav.classList.toggle('is-on', on);
        fav.setAttribute('aria-pressed', String(!!on));
        fav.setAttribute('aria-label', on ? 'Saved — remove from favorites' : 'Save this lake');
        fav.title = on ? 'In your favorites' : 'Save to favorites';
        fav.innerHTML = on ? HEART_FILLED : HEART_OUTLINE;
      };
      paintFav();
      onActivate(fav, function () {
        var nowFav = window.KaaykoPrefs.toggleFavorite({ id: data.id, title: data.title, subtitle: data.subtitle });
        root.classList.toggle('is-fav', nowFav);
        animateLove(root, nowFav);
        paintFav();
      });
      window.KaaykoPrefs.registerFavPainter(fav, paintFav);
      media.appendChild(fav);
    }

    // meta overlay
    var meta = el('div', 'pcard-meta');
    var title = el('span', 'pcard-title'); title.textContent = data.title;
    meta.appendChild(title);
    if (data.subtitle) { var sub = el('span', 'pcard-sub'); sub.textContent = data.subtitle; meta.appendChild(sub); }
    if (data.rating != null) {
      var sm = scoreMeta(data.rating);
      var stat = el('div', 'pcard-stat');
      var val = el('span', 'pcard-stat-val'); val.textContent = sm.display; val.style.color = sm.color;
      var lab = el('span', 'pcard-stat-label'); lab.textContent = sm.label;
      stat.appendChild(val); stat.appendChild(lab);
      meta.appendChild(stat);
    }

    body.appendChild(media);
    body.appendChild(meta);
    root.appendChild(body);

    // In a horizontal rail (About), let the rail scroll; elsewhere allow image swipe.
    media.style.touchAction = opts.carouselSwipe === false ? 'auto' : 'pan-y';
    if (opts.carouselSwipe === false) media.style.cursor = 'pointer';
    wireGestures(root, media, { box: '.pcard-media', img: '.pcard-img' },
      { longPressFavorite: opts.longPressFavorite !== false, carouselSwipe: opts.carouselSwipe }, data);

    keepFavSynced(root, data);
    return root;
  }

  // ── FULL variant (detailed list card; reuses paddlingout.css classes) ─────────
  function buildFull(data, opts) {
    var card = el('article', 'card');
    var sm = scoreMeta(data.rating);
    if (sm.severity) card.classList.add('score-' + sm.severity);

    var media = el('div', 'img-container');

    var prev = el('button', 'carousel-nav prev', { 'aria-label': 'Previous image', type: 'button' }); prev.textContent = '‹';
    var next = el('button', 'carousel-nav next', { 'aria-label': 'Next image', type: 'button' }); next.textContent = '›';
    media.appendChild(prev); media.appendChild(next);

    // favorite ★ (top-left)
    if (opts.showFavorite !== false && window.KaaykoPrefs && data.id) {
      media.appendChild(window.KaaykoPrefs.makeFavButton({ id: data.id, title: data.title, subtitle: data.subtitle }));
    }

    // images
    data.images.forEach(function (url, i) {
      var img = el('img', 'carousel-image' + (i === 0 ? ' active' : ''));
      img.dataset.index = i; img.loading = 'lazy'; img.decoding = 'async'; img.alt = data.title; img.src = url;
      media.appendChild(img);
    });

    // conditions badge (top-right) → forecast
    var badge = el('div', 'conditions-badge' + (sm.severity && sm.severity !== 'good' ? ' ' + sm.severity : ''));
    badge.innerHTML = '<span class="badge-dot"></span><span class="badge-score">' + sm.display +
      '</span><span class="badge-status">' + sm.label + '</span>';
    badge.addEventListener('click', function (e) {
      e.stopPropagation();
      window.location.href = '/paddlingout/forecast?id=' + encodeURIComponent(data.id);
    });
    media.appendChild(badge);

    // dots
    var dots = el('div', 'carousel-dots');
    data.images.forEach(function (url, i) {
      var dot = el('span', 'carousel-dot' + (i === 0 ? ' active' : ''));
      dot.dataset.index = i;
      dot.addEventListener('click', function (e) {
        e.stopPropagation();
        if (card._pcShow) card._pcShow(i);
      });
      dots.appendChild(dot);
    });
    media.appendChild(dots);

    if (data.images.length <= 1) { prev.style.display = 'none'; next.style.display = 'none'; }

    // content
    var content = el('div', 'card-content');
    var name = el('h2', 'lake-name');
    var slug = opts.slug || (window.KAAYKO_SPOT_SLUGS || {})[data.id];
    if (slug) {
      var link = el('a', 'lake-name-link', { href: '/paddlingout/' + slug });
      link.textContent = data.title;
      link.addEventListener('click', function (e) { e.stopPropagation(); });
      name.appendChild(link);
    } else {
      name.textContent = data.title;
    }
    // Real spot facts appended inline: water type, and an offline-maps nudge
    // only when FCC-derived coverage data says signal is patchy/absent.
    var locBits = [data.subtitle];
    if (data.waterType === 'river') locBits.push('River');
    if (data.coverageGrade === 'patchy' || data.coverageGrade === 'none') locBits.push('Offline maps advised');
    var loc = el('p', 'location'); loc.textContent = locBits.filter(Boolean).join(' · ');
    var desc = el('p', 'description'); desc.textContent = data.text;

    var actions = el('div', 'card-actions');
    var fBtn = el('button', 'forecast-button', { type: 'button' });
    fBtn.innerHTML = '<span>Forecast</span><span>→</span>';
    fBtn.addEventListener('click', function (e) { e.stopPropagation(); window.location.href = '/paddlingout/forecast?id=' + encodeURIComponent(data.id); });
    var rBtn = el('button', 'rate-button', { type: 'button' });
    rBtn.innerHTML = '<span>Rate</span>';
    // Public rate page, NOT the trainer. The trainer frontend calls /status,
    // GET /ratings, /priority-lakes, /lakes, /weather, /scenarios, /admin-prefs
    // and /reset-training, none of which exist in the backend — a normal user
    // tapping Rate hit 404s. Trainer is internal model tooling.
    rBtn.addEventListener('click', function (e) { e.stopPropagation(); window.location.href = '/paddlingout/rate?id=' + encodeURIComponent(data.id); });
    actions.appendChild(fBtn); actions.appendChild(rBtn);

    content.appendChild(name); content.appendChild(loc); content.appendChild(desc); content.appendChild(actions);

    card.appendChild(media); card.appendChild(content);

    // arrows
    prev.addEventListener('click', function (e) { e.stopPropagation(); if (card._pcShow) card._pcShow(card._pcActive() - 1); });
    next.addEventListener('click', function (e) { e.stopPropagation(); if (card._pcShow) card._pcShow(card._pcActive() + 1); });

    // card click → detail (unless linkTo overrides)
    var target = opts.linkTo === 'forecast'
      ? '/paddlingout/forecast?id=' + encodeURIComponent(data.id)
      : 'paddlingout?id=' + data.id;
    card.addEventListener('click', function () { window.location.href = target; });

    media.style.touchAction = 'pan-y';
    media.style.userSelect = 'none';
    media.style.cursor = data.images.length > 1 ? 'grab' : 'default';
    wireGestures(card, media, { box: '.img-container', img: '.carousel-image', dot: '.carousel-dot' },
      { longPressFavorite: false }, data);

    keepFavSynced(card, data);
    return card;
  }

  // ── public API ───────────────────────────────────────────────────────────────
  function create(spot, opts) {
    opts = opts || {};
    var data = normalize(spot);
    return opts.variant === 'minimal' ? buildMinimal(data, opts) : buildFull(data, opts);
  }

  window.PaddleCard = {
    create: create,
    normalize: normalize,
    scoreMeta: scoreMeta,
    apiBase: apiBase,
    animateLove: function (el) { if (el) animateLove(el, true); }   // for the walkthrough demo
  };
})();
