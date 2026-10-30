/**
 * /paddlingout/scouts — the live parts of the Kaayko Scouts page.
 *
 *   - Old links to /paddlingout/mapmakers#rules 301 here with the #rules kept; they
 *     meant the rules, so they go on to the rules page.
 *   - The dock: once the hero's button has scrolled away, "Add a spot" stays on
 *     screen, so the form is one tap from anywhere on the page.
 *
 * Plain script, no module. Without it the page is complete, only static.
 * (30 Oct 2026: the live spot count and the countdown went with the long copy.)
 */
(function () {
  'use strict';

  if (location.hash === '#rules') { location.replace('/paddlingout/scouts/rules'); return; }

  var U = window.KaaykoUtil;
  var $ = function (id) { return document.getElementById(id); };

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

  wireDock();
  if (U && U.stampYear) U.stampYear();
}());
