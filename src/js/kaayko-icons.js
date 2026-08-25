/**
 * KaaykoIcons — a small, cohesive inline-SVG line-icon set (classic script).
 * ---------------------------------------------------------------------------
 * One consistent visual language for the text-heavy pages: 24px viewBox,
 * 2px rounded strokes, gold (currentColor). Icons are decorative (aria-hidden).
 *
 * Usage: add data-kicon="name" to any heading/element; this script prepends the
 * icon on load. window.KaaykoIcons.get(name) returns the raw SVG string too.
 * Include: <script src="/js/kaayko-icons.js" defer></script>
 */
(function () {
  'use strict';

  // Stroke icon: inner path(s) wrapped in a common <svg>.
  // Default width/height = 1em so an icon is NEVER invisible if a consumer's CSS
  // is missing/stale; explicit CSS (.kicon svg, etc.) still overrides.
  function s(inner) {
    return '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }
  // Filled icon (e.g. star).
  function f(inner) {
    return '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" stroke="none" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }

  var ICONS = {
    // measurement / scoring
    gauge:    s('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
    grid:     s('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'),
    ruler:    s('<path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4z"/><path d="M7.5 12.5l2 2M11 9l2 2M14.5 5.5l2 2"/>'),
    // data / systems
    database: s('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 5v6c0 1.66-4 3-9 3s-9-1.34-9-3V5"/><path d="M21 11v6c0 1.66-4 3-9 3s-9-1.34-9-3v-6"/>'),
    inbox:    s('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    flow:     s('<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>'),
    cog:      s('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
    link:     s('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    device:   s('<line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/>'),
    clock:    s('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    refresh:  s('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'),
    // people / trust / safety
    users:    s('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    shield:   s('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
    scale:    s('<path d="M12 3v18"/><path d="M6 21h12"/><path d="M5 7h14l-3.5 7a3 3 0 0 0 7 0z" fill="none"/><path d="M5 7l-3.5 7a3 3 0 0 0 7 0z"/><path d="M5 7 8 4"/>'),
    globe:    s('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
    alert:    s('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
    info:     s('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
    eye:      s('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'),
    document: s('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'),
    mail:     s('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>'),
    // paddling / brand
    wave:     s('<path d="M2 6c2 0 2 1.8 4 1.8S8 6 10 6s2 1.8 4 1.8S16 6 18 6s2 1.8 4 1.8"/><path d="M2 12c2 0 2 1.8 4 1.8S8 12 10 12s2 1.8 4 1.8S16 12 18 12s2 1.8 4 1.8"/><path d="M2 18c2 0 2 1.8 4 1.8S8 18 10 18s2 1.8 4 1.8S16 18 18 18s2 1.8 4 1.8"/>'),
    spark:    s('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),
    tag:      s('<path d="M20.59 13.41 11 3.84A2 2 0 0 0 9.59 3H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83z"/><line x1="7" y1="7" x2="7.01" y2="7"/>'),
    heart:    s('<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'),
    pin:      s('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>'),
    star:     f('<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"/>'),

    // ── weather / conditions ──
    thermometer: s('<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>'),
    wind:        s('<path d="M9.59 4.59A2 2 0 1 1 11 8H2"/><path d="M12.59 19.41A2 2 0 1 0 14 16H2"/><path d="M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/>'),
    compass:     s('<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>'),
    sun:         s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/>'),
    cloud:       s('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>'),
    droplet:     s('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>'),
    'water-temp':s('<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/><line x1="12" y1="10" x2="12" y2="15.5"/>'),
    humidity:    s('<path d="M7 3.7l3 3a4.2 4.2 0 1 1-6 0z"/><path d="M16 10.7l3 3a4.2 4.2 0 1 1-6 0z"/>'),
    rain:        s('<path d="M17 13a4.5 4.5 0 0 0-1-8.87A6 6 0 0 0 5 8.5"/><path d="M4 13a3.5 3.5 0 0 0 1 6.87"/><line x1="9" y1="19" x2="8" y2="22"/><line x1="14" y1="19" x2="13" y2="22"/><line x1="19" y1="18" x2="18" y2="21"/>'),
    // ── controls ──
    search:      s('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
    close:       s('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    gps:         s('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><line x1="12" y1="1" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="23"/><line x1="1" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="23" y2="12"/>'),
    play:        f('<path d="M6 4l14 8-14 8z"/>')
  };

  function get(name) { return ICONS[name] || ''; }

  function injectStyle() {
    if (document.getElementById('kaayko-icons-style')) return;
    var css =
      '.kicon{display:inline-flex;align-items:center;justify-content:center;' +
      'color:var(--gold-bright,#d9bd7b);margin-right:.5em;vertical-align:-0.14em;flex:0 0 auto;}' +
      '.kicon svg{width:.92em;height:.92em;display:block;}' +
      // icon-only controls: no wrapper/margin; SVG scales to the element's font-size
      '[data-kicon-raw]{display:inline-flex;align-items:center;justify-content:center;}' +
      '[data-kicon-raw] svg{width:1em;height:1em;display:block;}';
    var st = document.createElement('style');
    st.id = 'kaayko-icons-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function render() {
    injectStyle();
    // Headers/text: prepend a .kicon span before the text
    var els = document.querySelectorAll('[data-kicon]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.querySelector(':scope > .kicon')) continue;   // idempotent
      var svg = get(el.getAttribute('data-kicon'));
      if (!svg) continue;
      var span = document.createElement('span');
      span.className = 'kicon';
      span.innerHTML = svg;
      el.insertBefore(span, el.firstChild);
    }
    // Icon-only controls: replace content with the raw SVG (sized by the element)
    var raws = document.querySelectorAll('[data-kicon-raw]');
    for (var j = 0; j < raws.length; j++) {
      var r = raws[j];
      if (r.querySelector(':scope > svg')) continue;        // idempotent
      var rsvg = get(r.getAttribute('data-kicon-raw'));
      if (rsvg) r.innerHTML = rsvg;
    }
  }

  window.KaaykoIcons = { get: get, render: render, names: Object.keys(ICONS) };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render, { once: true });
  } else {
    render();
  }
})();
