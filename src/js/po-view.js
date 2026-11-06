/**
 * po-view.js — which Paddling Out page the visitor chose: the photo grid (/paddlingout)
 * or the HUD list (/paddlingout/list). Settings → Layout keeps the choice in
 * KaaykoPrefs (localStorage `kaayko_po_view`); this script, in the <head> of both
 * pages right after prefs.js, sends the visitor to the page they chose.
 *
 * Three moments (6 Nov 2026, Rohan: "actions I take in settings DO NOT apply"):
 *   1. load — before paint, so there is no flash of the other page;
 *   2. pageshow with `persisted` — the page came back from the back-forward cache
 *      (the ‹ chevron after a change in Settings): no script re-ran, the choice did;
 *   3. kaayko:listviewchange — the choice changed in another tab (prefs.js relays the
 *      `storage` event) or was re-broadcast on a bfcache restore.
 * `?view=grid` / `?view=list` on the address is a deliberate visit and is never bounced.
 *
 * The page says which one it is with <html data-po-view="grid|hud">. Plain script.
 */
(function () {
  'use strict';
  var P = window.KaaykoPrefs;
  if (!P || typeof P.getListView !== 'function') return;
  var here = document.documentElement.getAttribute('data-po-view') === 'hud' ? 'hud' : 'grid';
  var bypass = here === 'hud' ? /[?&]view=list\b/ : /[?&]view=grid\b/;
  var to = { grid: '/paddlingout', hud: '/paddlingout/list' };
  function route() {
    try {
      var want = P.getListView();
      if (want !== here && !bypass.test(location.search)) location.replace(to[want] + location.search);
    } catch (e) { /* storage blocked: stay */ }
  }
  route();
  window.addEventListener('pageshow', function (e) { if (e.persisted) route(); });
  window.addEventListener('kaayko:listviewchange', route);
}());
