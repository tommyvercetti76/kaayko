/**
 * KaaykoPrefs — shared user preferences (classic script, exposes window.KaaykoPrefs)
 * -------------------------------------------------------------------------------
 * One source of truth for the three preference surfaces the site shares:
 *   • Units      — 'imperial' (default) | 'metric'   (localStorage: kaayko_units)
 *   • My area    — locked search city                (localStorage: kaayko_my_area)
 *   • Favorites  — saved lakes shown first           (localStorage: kaayko_favorites)
 *
 * Load this BEFORE page/module scripts (classic <script> runs before deferred modules)
 * so window.KaaykoPrefs is ready. Emits window CustomEvents on change:
 *   kaayko:unitschange  · kaayko:areachange · kaayko:favchange
 */
(function () {
  'use strict';

  const UNITS_KEY = 'kaayko_units';
  const AREA_KEY  = 'kaayko_my_area';
  const FAV_KEY   = 'kaayko_favorites';

  const GOLD        = '#d9bd7b'; // --gold-bright
  const GOLD_MUTED  = 'rgba(217,189,123,0.85)';

  function readJSON(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch { return fallback; }
  }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
  function dispatch(name, detail) { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {} }

  // ── Units ──────────────────────────────────────────────────────────────────
  function getUnits() { return localStorage.getItem(UNITS_KEY) === 'metric' ? 'metric' : 'imperial'; }
  function isMetric() { return getUnits() === 'metric'; }
  function setUnits(u) {
    const val = u === 'metric' ? 'metric' : 'imperial';
    try { localStorage.setItem(UNITS_KEY, val); } catch {}
    dispatch('kaayko:unitschange', { units: val });
    return val;
  }

  // ── My area (lock my city) ───────────────────────────────────────────────────
  function getArea() { return readJSON(AREA_KEY, null); }
  function clearArea() { try { localStorage.removeItem(AREA_KEY); } catch {} dispatch('kaayko:areachange', {}); }

  // ── Favorites ────────────────────────────────────────────────────────────────
  function getFavorites() {
    const list = readJSON(FAV_KEY, []);
    return Array.isArray(list) ? list.filter(f => f && f.id) : [];
  }
  function isFavorite(id) { return getFavorites().some(f => f.id === id); }
  function addFavorite(spot) {
    if (!spot || !spot.id) return;
    const list = getFavorites();
    if (list.some(f => f.id === spot.id)) return;
    list.push({
      id: spot.id,
      title: spot.title || spot.lakeName || spot.name || spot.id,
      subtitle: spot.subtitle || spot.location || ''
    });
    writeJSON(FAV_KEY, list);
    dispatch('kaayko:favchange', { id: spot.id, favorite: true });
  }
  function removeFavorite(id) {
    writeJSON(FAV_KEY, getFavorites().filter(f => f.id !== id));
    dispatch('kaayko:favchange', { id, favorite: false });
  }
  function toggleFavorite(spot) {
    if (!spot || !spot.id) return false;
    if (isFavorite(spot.id)) { removeFavorite(spot.id); return false; }
    addFavorite(spot); return true;
  }
  /** Stable sort: favorites first (preserving each group's original order). */
  function sortFavoritesFirst(spots, idOf) {
    const getId = idOf || (s => s && s.id);
    const favs = spots.filter(s => isFavorite(getId(s)));
    const rest = spots.filter(s => !isFavorite(getId(s)));
    return favs.concat(rest);
  }

  // ── Reusable star button ─────────────────────────────────────────────────────
  const STAR_FILLED = '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden="true"><path d="M12 17.3l-6.18 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73 1.64 7.03z"/></svg>';
  const STAR_OUTLINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="20" height="20" aria-hidden="true"><path d="M12 17.3l-6.18 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73 1.64 7.03z"/></svg>';

  function makeFavButton(spot, opts) {
    opts = opts || {};
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kaayko-fav-btn' + (opts.className ? ' ' + opts.className : '');
    function paint() {
      const on = spot && spot.id ? isFavorite(spot.id) : false;
      btn.classList.toggle('is-fav', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');
      btn.title = on ? 'In your favorites' : 'Save to favorites';
      btn.innerHTML = on ? STAR_FILLED : STAR_OUTLINE;
    }
    paint();
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      const nowFav = toggleFavorite(spot);
      paint();
      if (opts.onToggle) opts.onToggle(nowFav);
    });
    // Keep every star in sync if the same lake is toggled elsewhere on the page.
    window.addEventListener('kaayko:favchange', paint);
    return btn;
  }

  // ── Inject shared star CSS once (self-contained; works on any page) ───────────
  function injectStyle() {
    if (document.getElementById('kaayko-prefs-style')) return;
    const css = `
      .kaayko-fav-btn{display:inline-flex;align-items:center;justify-content:center;
        width:38px;height:38px;padding:0;border:none;border-radius:50%;
        background:rgba(20,18,16,.55);color:${GOLD_MUTED};cursor:pointer;
        -webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);
        transition:transform .15s ease,background .2s ease,color .2s ease;}
      .kaayko-fav-btn:hover{transform:scale(1.08);background:rgba(20,18,16,.78);color:${GOLD};}
      .kaayko-fav-btn:focus-visible{outline:2px solid ${GOLD};outline-offset:2px;}
      .kaayko-fav-btn.is-fav{color:${GOLD};}
      .kaayko-fav-btn svg{display:block;}
      .card .img-container{position:relative;}
      .card .img-container .kaayko-fav-btn{position:absolute;top:10px;left:10px;z-index:6;}
      @media (prefers-reduced-motion: reduce){.kaayko-fav-btn{transition:none;}}
    `;
    const style = document.createElement('style');
    style.id = 'kaayko-prefs-style';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStyle, { once: true });
  } else {
    injectStyle();
  }

  window.KaaykoPrefs = {
    getUnits, isMetric, setUnits,
    getArea, clearArea,
    getFavorites, isFavorite, addFavorite, removeFavorite, toggleFavorite, sortFavoritesFirst,
    makeFavButton
  };
})();
