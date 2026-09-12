/**
 * PoHeader — the single Paddling Out page header.
 *
 * Usage (any paddling page, before this script runs):
 *   <div id="po-header" data-title="Search" data-eyebrow="Paddling Out"
 *        data-back="/paddlingout" data-current="search"></div>
 *   <link rel="stylesheet" href="/js/components/PoHeader.css">
 *   <script src="/js/components/PoHeader.js"></script>
 *
 * data-title    page title (default "Paddling Out"); data-eyebrow default "Kaayko"
 * data-back     href for the ‹ chevron; omit on the section home
 * data-current  which action is "here": search | submit | settings | none
 * data-brand-href  where the title links (default "/paddlingout"; the home
 *                  page points at "/")
 *
 * Every page gets the same three actions in the same order, so the way to
 * Search, Add a lake and Settings never moves. Plain script, no module —
 * pages load it before their own scripts.
 */
(function () {
  var ICONS = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
    submit: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm1 8v3h-2v-3H8V8h3V5h2v3h3v2h-3z"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
  };

  var ACTIONS = [
    { key: 'search',   href: '/paddlingout/search',      label: 'Search',   aria: 'Search lakes and rivers' },
    { key: 'submit',   href: '/paddlingout/submitentry', label: 'Add a lake', aria: 'Add a lake', primary: true },
    { key: 'settings', href: '/paddlingout/settings',    label: 'Settings', aria: 'Settings and saved lakes' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render(host) {
    var d = host.dataset;
    var title = d.title || 'Paddling Out';
    var eyebrow = d.eyebrow || 'Kaayko';
    var back = d.back || '';
    var current = d.current || '';
    var brandHref = d.brandHref || '/paddlingout';
    var titleTag = d.titleTag === 'h2' ? 'h2' : 'h1';

    var backHtml = back
      ? '<a class="po-btn po-back" href="' + esc(back) + '" aria-label="Back to Paddling Out">' + ICONS.back + '</a>'
      : '';

    var actions = ACTIONS.map(function (a) {
      var here = a.key === current;
      var cls = 'po-btn po-btn--' + a.key + (a.primary ? ' po-btn--primary' : '') + (here ? ' is-current' : '');
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

  function init() {
    var hosts = document.querySelectorAll('[id="po-header"], [data-po-header]');
    for (var i = 0; i < hosts.length; i++) { render(hosts[i]); wireBack(hosts[i]); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Pages that learn their title later (forecast) can update it in place.
  window.PoHeader = {
    setTitle: function (text) { var t = document.getElementById('po-title'); if (t) t.textContent = text; },
    render: render
  };
}());
