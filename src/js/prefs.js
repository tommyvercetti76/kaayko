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
  const CARD_KEY  = 'kaayko_card_style';
  const BOAT_KEY  = 'kaayko_boat_type';

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

  // ── Unit formatters (SINGLE source of truth — every surface calls these) ─────
  // Inputs are metric (°C, km/h, mm, km, m, km²). Rounding/labels are canonical:
  //   temp/wind → whole · precip mm .1 / in .2 · dist/height/area → .1
  function _num(v) { return (v === '' || v == null || isNaN(parseFloat(v))) ? null : parseFloat(v); }
  function fmtTemp(c)    { const n = _num(c);    return n == null ? '--' : (isMetric() ? `${Math.round(n)}°C`        : `${Math.round(n * 9 / 5 + 32)}°F`); }
  function fmtWind(kph)  { const n = _num(kph);  return n == null ? '--' : (isMetric() ? `${Math.round(n)} km/h`     : `${Math.round(n * 0.621371)} mph`); }
  function fmtPrecip(mm) { const n = _num(mm);   return n == null ? '--' : (isMetric() ? `${n.toFixed(1)} mm`        : `${(n / 25.4).toFixed(2)} in`); }
  function fmtDist(km)   { const n = _num(km);   return n == null ? '--' : (isMetric() ? `${n.toFixed(1)} km`        : `${(n * 0.621371).toFixed(1)} mi`); }
  function fmtHeight(m)  { const n = _num(m);    return n == null ? '--' : (isMetric() ? `${n.toFixed(1)} m`         : `${(n * 3.28084).toFixed(1)} ft`); }
  function fmtArea(km2)  { const n = _num(km2);  return n == null ? '--' : (isMetric() ? `${n.toFixed(1)} km²`       : `${(n * 0.386102).toFixed(1)} mi²`); }
  function fmtVolume(l)  { const n = _num(l);    return n == null ? '--' : (isMetric() ? `${n.toFixed(1)} L`         : `~${Math.round(n * 33.814 / 8) * 8} fl oz`); }
  function fmtFlow(cms)  { const n = _num(cms);  return n == null ? '--' : (isMetric() ? `${n.toFixed(1)} m³/s`      : `${Math.round(n * 35.3147)} cfs`); }
  // Rewrite metric units embedded in server-generated strings (e.g. "Extreme heat (42.5°C)").
  function localizeUnits(text) {
    if (isMetric()) return String(text);
    let t = String(text);
    t = t.replace(/(-?\d+(?:\.\d+)?)\s*°\s*C\b/g,     (_, n) => `${Math.round(parseFloat(n) * 9 / 5 + 32)}°F`);
    t = t.replace(/(-?\d+(?:\.\d+)?)\s*km\/h\b/gi,    (_, n) => `${Math.round(parseFloat(n) * 0.621371)} mph`);
    t = t.replace(/(-?\d+(?:\.\d+)?)\s*mm\b/gi,       (_, n) => `${(parseFloat(n) / 25.4).toFixed(2)} in`);
    t = t.replace(/(-?\d+(?:\.\d+)?)\s*km\b(?!\/)/gi, (_, n) => `${(parseFloat(n) * 0.621371).toFixed(1)} mi`);
    t = t.replace(/(-?\d+(?:\.\d+)?)\s*m\b(?!\/)/gi,  (_, n) => `${(parseFloat(n) * 3.28084).toFixed(1)} ft`);
    return t;
  }

  // ── Paddle Score color (SINGLE source; tiers match the verdict labels) ───────
  // Canonical 3-tier: >=3.7 Worth it (green) · >=2.7 Careful (amber) · else Hard pass (red)
  function paddleScoreColor(score) {
    const n = _num(score);
    if (n == null) return '#555';
    if (n >= 3.7) return '#316d43';   // Worth it — green
    if (n >= 2.7) return '#c59a61';   // Careful — amber
    return '#bd3b2b';                 // Hard pass — red
  }

  // ── Card style (list layout: 'full' detailed | 'minimal' image-tile) ─────────
  // Default is 'minimal' — first-time visitors land in the image-first look; only an
  // explicit 'full' choice opts out.
  function getCardStyle() { return localStorage.getItem(CARD_KEY) === 'full' ? 'full' : 'minimal'; }
  function setCardStyle(s) {
    const val = s === 'minimal' ? 'minimal' : 'full';
    try { localStorage.setItem(CARD_KEY, val); } catch {}
    dispatch('kaayko:cardstylechange', { style: val });
    return val;
  }

  // ── Boat type (craft the Paddle Score adjusts for) ───────────────────────────
  // Ids match the API's craft taxonomy (rate.html + ?craft= param). Kayak is the
  // scoring baseline — absent/kayak sends no param, so old URLs stay clean.
  const BOAT_TYPES = [
    { id: 'kayak',      label: 'Kayak' },
    { id: 'canoe',      label: 'Canoe' },
    { id: 'sup',        label: 'SUP' },
    { id: 'row',        label: 'Rowboat' },
    { id: 'pedal',      label: 'Pedal boat' },
    { id: 'inflatable', label: 'Inflatable kayak' }
  ];
  function getBoatType() {
    const v = localStorage.getItem(BOAT_KEY);
    return BOAT_TYPES.some(b => b.id === v) ? v : 'kayak';
  }
  function setBoatType(id) {
    const val = BOAT_TYPES.some(b => b.id === id) ? id : 'kayak';
    try { localStorage.setItem(BOAT_KEY, val); } catch {}
    dispatch('kaayko:boattypechange', { boatType: val });
    return val;
  }
  function boatTypeLabel(id) {
    const b = BOAT_TYPES.find(b => b.id === (id || getBoatType()));
    return b ? b.label : 'Kayak';
  }
  /** Query-string fragment for API calls: '' for kayak (identity), 'craft=sup' otherwise. */
  function craftParam() {
    const b = getBoatType();
    return b === 'kayak' ? '' : 'craft=' + b;
  }
  /** Append the craft param to a URL that may or may not already have a query. */
  function withCraft(url) {
    const p = craftParam();
    if (!p) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + p;
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
        width:38px;height:38px;padding:0;border:none;border-radius:0;
        clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px),0 8px);
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
    fmtTemp, fmtWind, fmtPrecip, fmtDist, fmtHeight, fmtArea, fmtVolume, fmtFlow, localizeUnits,
    paddleScoreColor,
    getCardStyle, setCardStyle,
    BOAT_TYPES, getBoatType, setBoatType, boatTypeLabel, craftParam, withCraft,
    getArea, clearArea,
    getFavorites, isFavorite, addFavorite, removeFavorite, toggleFavorite, sortFavoritesFirst,
    makeFavButton
  };
})();
