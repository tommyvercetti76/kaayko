/**
 * PoHeader — the single Paddling Out page header.
 *
 * Usage (any paddling page):
 *   <div id="po-header" data-title="Search" data-eyebrow="Paddling Out"
 *        data-back="/paddlingout" data-current="search"></div>
 *   <script>PoHeader.mount()</script>      (inline, right after the placeholder)
 * with, in <head>, after js/util.js:
 *   <link rel="stylesheet" href="/js/components/PoHeader.css">
 *   <script src="/js/components/PoHeader.js"></script>
 *
 * data-title    page title (default "Paddling Out"); data-eyebrow default "Kaayko"
 * data-back     href for the ‹ chevron; omit on the section home
 * data-current  which action is "here": search | scouts | settings | none ("submit" = search)
 * data-brand-href  where the title links (default "/paddlingout"; the home
 *                  page points at "/")
 *
 * Every page gets the same three actions in the same order (Search, Scouts,
 * Settings), all quiet text+icon links: no filled button (Rohan, 6 Nov 2026: the
 * gold block read as a preselected choice). The current page's action carries a
 * hairline. Plain script, no module — pages load it before their own scripts.
 */
(function () {
  var ICONS = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
    submit: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm1 8v3h-2v-3H8V8h3V5h2v3h3v2h-3z"/></svg>',
    // Binoculars, drawn with Forge (minimalist-tshirt engine, FLUX.1-dev, seed 205 of the
    // 6 Nov 2026 mono batch; ~/Desktop/Kaayko_Derived/forge-binoculars-icon-2026-11-06-mono-seed200),
    // keyed and traced to one filled path. A filled mark at 20px carries the same weight as
    // the 2px strokes beside it. The hand-drawn outline before it, Rohan rejected.
    scouts: '<svg viewBox="0 0 128 128" fill="currentColor" fill-rule="evenodd" aria-hidden="true"><path d="M0 0 C0.8 -0 1.7 -0 2.5 -0.1 C2.9 -0.1 2.9 -0.1 4.9 -0.1 C5.7 -0.1 6.4 -0.1 7.1 -0.1 C9.7 0.4 10.6 1.2 12.1 3.2 C11.9 5.9 11.4 7.8 10.1 10.1 C8.9 12.7 8.9 14.6 9 17.5 C9 18.4 9 19.3 9.1 20.2 C9.1 20.9 9.1 21.6 9.1 22.2 C13.1 22.7 13.1 22.7 15.1 22.2 C16.6 20.7 17.2 19.2 18.1 17.2 C19.7 15.7 21.4 16.1 23.6 16.1 C24 16.1 24 16.1 26 16 C28.1 16.2 28.1 16.2 30.1 18.2 C30.8 20.4 30.8 20.4 31.1 22.2 C33.1 22.2 35.1 22.2 37.1 22.2 C37.2 20.3 37.2 18.4 37.2 16.4 C37.3 16.2 37.3 16.2 37.3 14.8 C37.3 11.6 37.1 9.8 35.1 7.2 C34.9 4.7 34.9 4.7 35.1 2.2 C37.1 0.2 37.1 0.2 39.1 0 C39.9 0 40.7 0 41.5 0.1 C42.3 0.1 43.2 0.1 44.1 0.1 C44.5 0.1 44.5 0.1 46.8 0.1 C47.2 0.1 47.2 0.1 49.5 0.2 C51.7 0.2 53.9 0.2 56.1 0.2 C58.3 4.6 58.3 4.6 57.7 7.4 C57.4 8.1 57.1 8.8 56.8 9.6 C55.1 13.9 54.8 17.6 55.1 22.2 C55.8 22.2 56.5 22.2 57.2 22.1 C58.1 22.1 59 22.1 59.9 22.1 C60.4 22 60.4 22 62.6 22 C65.1 22.2 65.1 22.2 66.7 23.3 C68.8 26.2 69.1 29.1 69.6 32.6 C69.7 33.4 69.8 34.1 69.9 34.9 C70.3 37.3 70.7 39.7 71.1 42.1 C71.3 43.7 71.6 45.4 71.8 47 C72.2 49.5 72.6 51.9 73 54.4 C74.1 60.9 75.2 67.4 76.4 73.9 C76.5 74.8 76.7 75.6 76.8 76.5 C77.7 81.1 78.6 85.7 79.7 90.3 C80.3 93.1 80.5 95.4 80.1 98.2 C78 100.1 76.5 100.5 73.7 100.5 C73.1 100.5 72.4 100.5 71.7 100.6 C71.3 100.6 71.3 100.6 69.5 100.6 C69.2 100.6 69.2 100.6 67.3 100.6 C65.7 100.6 64.2 100.6 62.6 100.6 C60.2 100.6 57.8 100.6 55.4 100.6 C53.9 100.6 52.4 100.6 50.8 100.6 C50.5 100.6 50.5 100.6 48.7 100.6 C44.6 100.6 42.2 100.3 39.1 97.2 C39.8 93.8 40.5 90.3 41.2 86.8 C41.4 85.6 41.7 84.4 41.9 83.2 C42.3 81.5 42.6 79.8 42.9 78.1 C43 77.6 43.1 77.1 43.2 76.5 C43.7 74.3 44.1 72.2 44.7 70 C45.2 67.8 45.2 65.8 45.2 63.5 C45.2 62.7 45.2 61.9 45.2 61.1 C45.1 60.5 45.1 59.9 45.1 59.2 C44.4 59 43.6 58.8 42.8 58.6 C40.1 57.2 40.1 57.2 38.8 54.6 C37.1 52.2 37.1 52.2 35.3 51.8 C33.1 51.7 31.2 51.8 29.1 52.2 C28.6 52.8 28.1 53.3 27.6 53.8 C27.1 54.3 26.6 54.8 26.1 55.2 C23.7 55.2 21.5 54.8 19.1 54.2 C19.1 53.6 19.1 52.9 19.1 52.2 C15.8 52.2 12.5 52.2 9.1 52.2 C8.9 53 8.7 53.8 8.5 54.6 C7.5 57.1 6.4 57.9 4 59.1 C3 59.5 2.1 59.9 1.1 60.2 C1.8 66.8 2.9 73.2 4.1 79.6 C4.3 80.6 4.5 81.6 4.7 82.6 C4.8 83.6 5 84.5 5.2 85.5 C5.3 86.4 5.5 87.2 5.7 88.1 C6.1 90.3 6.1 90.3 7.1 92.2 C7.3 93.7 7.3 93.7 7.4 95.2 C7.4 95.8 7.4 96.3 7.5 96.8 C7.1 98.2 7.1 98.2 5.8 99.3 C4 100.3 2.9 100.5 0.8 100.5 C0.5 100.5 0.5 100.5 -1.1 100.5 C-1.8 100.5 -2.5 100.5 -3.2 100.5 C-4 100.5 -4.7 100.5 -5.4 100.5 C-6.9 100.5 -8.5 100.5 -10 100.5 C-12.3 100.4 -14.6 100.4 -16.9 100.4 C-18.4 100.4 -19.9 100.4 -21.4 100.4 C-22.1 100.4 -22.8 100.4 -23.5 100.4 C-26.8 100.4 -29.7 100.3 -32.9 99.2 C-34 95.9 -33.9 93.7 -33 90.2 C-32.2 86.8 -31.5 83.3 -30.8 79.8 C-30.7 78.9 -30.5 78 -30.3 77.1 C-30 75.2 -29.6 73.3 -29.3 71.5 C-29.1 70.6 -29 69.7 -28.8 68.7 C-28.7 68.3 -28.7 68.3 -28.3 66.3 C-27.9 64.2 -27.9 64.2 -26.9 62.2 C-26.7 61.1 -26.5 60 -26.4 58.9 C-26.4 58.5 -26.4 58.5 -26.2 56.8 C-26.1 56.1 -26 55.4 -25.9 54.7 C-25.3 49.5 -24.6 44.4 -23.4 39.3 C-22.8 36.9 -22.4 34.5 -21.9 32 C-20.4 24.8 -20.4 24.8 -17.9 22.2 C-14.9 21.5 -11.9 21.3 -8.9 21.2 C-8 18.4 -7.8 16.2 -8.2 13.2 C-8.3 12.5 -8.3 11.8 -8.4 11.2 C-8.9 9.2 -8.9 9.2 -9.9 7.7 C-10.9 6.2 -10.9 6.2 -10.6 3.6 C-9.1 -1.5 -4.6 0 0 0 Z M7.1 31.2 C6.8 33.4 6.8 35.1 6.8 37.2 C6.8 37.8 6.8 38.3 6.8 38.9 C6.9 43 6.9 43 9.1 45.2 C11.3 45.5 11.3 45.5 13.7 45.4 C14.1 45.4 14.1 45.4 16.1 45.4 C18.1 45.2 18.1 45.2 19.1 44.2 C19.2 42.9 19.2 42.9 19.2 41.1 C19.2 40.5 19.2 39.8 19.2 39.2 C19.2 38.5 19.2 37.9 19.2 37.2 C19.2 36.5 19.2 35.9 19.2 35.2 C19.2 33.5 19.1 31.9 19.1 30.2 C17 29.2 16 29.1 13.7 29.1 C13.1 29 12.5 29 11.9 29 C9.6 29.3 8.7 29.6 7.1 31.2 Z M27.1 31.2 C26.7 33.5 26.8 35.6 26.9 37.9 C27 38.5 27 39.1 27 39.7 C27 41.2 27.1 42.7 27.1 44.2 C30.7 45.8 32.8 46.6 36.5 45.4 C37.4 45 38.2 44.6 39.1 44.2 C39.2 42.1 39.3 40 39.3 37.9 C39.3 37.3 39.4 36.7 39.4 36 C39.5 31.6 39.5 31.6 37.8 29.9 C36.1 29.3 34.9 29 33.1 29 C32.6 29 32.1 29 31.6 29 C29.5 29.4 28.6 29.7 27.1 31.2 Z "  transform="translate(40.875,13.75)"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  };

  // Search and Add are one page since 3 Oct 2026 (two tabs): search any water, and
  // if we do not cover it, add it there with the name and pin carried.
  var ACTIONS = [
    { key: 'search',   href: '/paddlingout/search',      label: 'Search',   aria: 'Search any water, or add a spot' },
    // Kaayko Scouts (28 Oct 2026 as Mapmakers, renamed 29 Oct): names on spots and the monthly picks.
    { key: 'scouts',    href: '/paddlingout/scouts',     label: 'Scouts',    aria: 'Kaayko Scouts: add a spot, get your name on it' },
    { key: 'settings', href: '/paddlingout/settings',    label: 'Settings', aria: 'Settings and saved lakes' }
  ];

  // One escape helper for the whole frontend (js/util.js, loaded before this file).
  function esc(s) { return window.KaaykoUtil.escapeHtml(s); }

  function render(host) {
    var d = host.dataset;
    var title = d.title || 'Paddling Out';
    var eyebrow = d.eyebrow || 'Kaayko';
    var back = d.back || '';
    var current = d.current === 'submit' ? 'search' : (d.current || '');
    var brandHref = d.brandHref || '/paddlingout';
    var titleTag = d.titleTag === 'h2' ? 'h2' : 'h1';

    var backHtml = back
      ? '<a class="po-btn po-back" href="' + esc(back) + '" aria-label="Back to Paddling Out">' + ICONS.back + '</a>'
      : '';

    // The List / Grid layout choice lives in Settings only (Rohan, 6 Nov 2026), not here.
    var actions = ACTIONS.map(function (a) {
      var here = a.key === current;
      var cls = 'po-btn po-btn--' + a.key + (here ? ' is-current' : '');
      return '<a class="' + cls + '" href="' + a.href + '" aria-label="' + esc(a.aria) + '"' +
        (here ? ' aria-current="page"' : '') + '>' + ICONS[a.key] +
        '<span class="po-btn-label">' + esc(a.label) + '</span></a>';
    }).join('');

    host.innerHTML =
      '<div class="po-page-header">' +
        '<div class="po-brand-row">' + backHtml +
          '<a href="' + esc(brandHref) + '" class="po-brand">' +
            '<span class="po-eyebrow">' + esc(eyebrow) + '</span>' +
            '<' + titleTag + ' class="po-title" id="po-title">' + esc(title) + '</' + titleTag + '>' +
          '</a>' +
        '</div>' +
        '<nav class="po-actions" aria-label="Paddling Out">' + actions + '</nav>' +
      '</div>';
  }

  // Smart back: when the visitor arrived from another page on this site, go
  // back in history so search results / scroll position survive; direct links
  // and bookmarks fall back to the section home.
  function wireBack(host) {
    var back = host.querySelector('.po-back');
    if (!back) return;
    back.addEventListener('click', function (e) {
      var sameSite = document.referrer && document.referrer.indexOf(window.location.host) !== -1;
      if (window.history.length > 1 && sameSite) { e.preventDefault(); window.history.back(); }
    });
  }

  // Each page calls PoHeader.mount() inline, right after its placeholder, so the
  // header is in the first paint. Waiting for DOMContentLoaded (which also waits
  // for the module scripts) let the browser paint the page headerless and then
  // push everything down 108 px: a 0.075 layout shift on every desktop Paddling
  // Out page (scripts/browser-check.mjs, 3 Oct 2026). DOMContentLoaded stays as
  // the fallback for a page without the inline call; a host is drawn once, so the
  // second pass cannot undo a setTitle.
  function init() {
    var hosts = document.querySelectorAll('[id="po-header"], [data-po-header]');
    for (var i = 0; i < hosts.length; i++) {
      if (hosts[i].dataset.poMounted) continue;
      render(hosts[i]); wireBack(hosts[i]);
      hosts[i].dataset.poMounted = '1';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Pages that learn their title later (forecast) can update it in place.
  window.PoHeader = {
    setTitle: function (text) { var t = document.getElementById('po-title'); if (t) t.textContent = text; },
    render: render,
    mount: init
  };
}());
