/**
 * /paddlingout/scouts — the live parts of the Kaayko Scouts page (29 Oct 2026,
 * renamed from Mapmakers and cut to the four questions the page answers).
 *
 *   - The count: spots on the map and how many are in India, from GET /paddlingOut.
 *     A spot outside the US carries its country last in `subtitle` (spotSchema
 *     formatSubtitle), so "…, India" is how an Indian spot is known. Nothing
 *     shows until the numbers arrive; the line keeps its height so nothing moves.
 *   - Days to the first picks (end of November 2026), then "end of each month".
 *   - The dock: once the hero's button has scrolled away, "Add a spot" stays on
 *     screen, so the form is one tap from anywhere on the page.
 *
 * Plain script, no module. Without it the page is complete, only static.
 */
(function () {
  'use strict';

  var U = window.KaaykoUtil;
  var API = U.apiBase();
  var $ = function (id) { return document.getElementById(id); };
  // Local end of 30 November 2026: the first picks (scouts/rules.html).
  var FIRST_PICKS = new Date(2026, 10, 30, 23, 59, 59);

  function paintWhen() {
    var el = $('sc-when');
    if (!el) return;
    var days = Math.ceil((FIRST_PICKS.getTime() - Date.now()) / 86400000);
    if (days > 1) el.textContent = 'The first picks are made at the end of November 2026, in ' + days + ' days.';
    else if (days === 1) el.textContent = 'The first picks are made tomorrow.';
    else el.textContent = 'Picks are made at the end of every month.';
  }

  async function paintCount() {
    var el = $('sc-count');
    if (!el) return;
    var r = await U.fetchJson(API + '/paddlingOut', { timeoutMs: 12000 });
    if (!r.ok || !Array.isArray(r.data) || !r.data.length) return;
    var india = r.data.filter(function (s) { return s && /,\s*India$/.test(String(s.subtitle || '')); }).length;
    var total = r.data.length;
    el.textContent = 'On the map today: ' + total + (total === 1 ? ' spot' : ' spots') + ', ' + india + ' in India.';
  }

  function wireDock() {
    var dock = $('sc-dock');
    var heroCta = $('sc-hero-cta');
    var foot = document.querySelector('.site-footer');
    if (!dock || !heroCta || !('IntersectionObserver' in window)) return;
    var heroSeen = true, footSeen = false;
    var paint = function () { dock.classList.toggle('is-on', !heroSeen && !footSeen); };
    dock.hidden = false;
    new IntersectionObserver(function (es) { heroSeen = es[0].isIntersecting; paint(); }).observe(heroCta);
    if (foot) new IntersectionObserver(function (es) { footSeen = es[0].isIntersecting; paint(); }).observe(foot);
  }

  paintWhen();
  wireDock();
  paintCount();
  if (U.stampYear) U.stampYear();
}());
