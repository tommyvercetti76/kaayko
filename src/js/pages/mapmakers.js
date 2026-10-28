/**
 * /paddlingout/mapmakers — the live parts of the Mapmakers page (28 Oct 2026).
 *
 *   - The rail: lakes paddlers added, from GET /paddlingOut (their own photos,
 *     the name they chose, "a paddler" when they gave none). Tap → its forecast.
 *   - The hero's counts: lakes on the map, how many paddlers added. Real numbers
 *     from the same list; nothing shows until they arrive.
 *   - Days to the first picks (end of November 2026), then "end of each month".
 *   - The dock: once the hero's button has scrolled away, "Add a lake" stays on
 *     screen, so the form is one tap from anywhere on the page.
 *
 * Plain script, no module. Without it the page is complete, only static.
 */
(function () {
  'use strict';

  var U = window.KaaykoUtil;
  var esc = U.escapeHtml;
  var API = U.apiBase();
  var $ = function (id) { return document.getElementById(id); };
  // Local end of 30 November 2026: the first picks (mapmakers.html, rules).
  var FIRST_PICKS = new Date(2026, 10, 30, 23, 59, 59);

  function daysToFirstPicks() {
    return Math.ceil((FIRST_PICKS.getTime() - Date.now()) / 86400000);
  }

  function paintCountdown(days) {
    var el = $('mm-countdown');
    if (!el) return;
    if (days > 1) el.textContent = days + ' days to the first picks, at the end of November 2026. Every lake added from today counts.';
    else if (days === 1) el.textContent = 'The first picks are made tomorrow. Every lake added this month counts.';
    else el.textContent = 'Picks are made at the end of every month. Every new lake you add counts toward the next ones.';
  }

  // ── The rail ────────────────────────────────────────────────────────────
  var rail = $('mm-rail');
  var you = rail && rail.querySelector('.mm-lake--you');

  function skeletons(n) {
    for (var i = 0; i < n; i++) {
      var li = document.createElement('li');
      li.className = 'mm-lake mm-lake--skel';
      li.setAttribute('aria-hidden', 'true');
      li.innerHTML = '<a tabindex="-1"></a>';
      rail.insertBefore(li, you);
    }
  }

  function lakeCard(s) {
    var img = Array.isArray(s.imgSrc) ? s.imgSrc[0] : null;
    var by = s.addedByName ? 'Added by ' + esc(s.addedByName) : 'Added by a paddler';
    return '<a href="/paddlingout/forecast?id=' + encodeURIComponent(s.id) + '">' +
      (typeof img === 'string' && /^https:\/\//.test(img) ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async">' : '') +
      '<span class="mm-chip">Community</span>' +
      '<span class="mm-lake-t">' + esc(s.title || s.lakeName || 'A lake') + '</span>' +
      (s.subtitle ? '<span class="mm-lake-p">' + esc(s.subtitle) + '</span>' : '') +
      '<span class="mm-lake-by">' + by + '</span></a>';
  }

  function paintStats(total, community, days) {
    var el = $('mm-stats');
    if (!el) return;
    var items = ['<li><b>' + total + '</b>lakes on the map</li>'];
    if (community > 0) items.push('<li><b>' + community + '</b>added by paddlers</li>');
    if (days > 0) items.push('<li><b>' + days + '</b>' + (days === 1 ? 'day' : 'days') + ' to the first picks</li>');
    el.innerHTML = items.join('');
    el.hidden = false;
  }

  async function loadLakes(days) {
    if (!rail || !you) return;
    skeletons(3);
    var r = await U.fetchJson(API + '/paddlingOut', { timeoutMs: 12000 });
    rail.querySelectorAll('.mm-lake--skel').forEach(function (li) { li.remove(); });
    if (!r.ok || !Array.isArray(r.data)) return;
    var community = r.data.filter(function (s) { return s && s.communitySubmission === true && s.id; });
    // Named lakes first: they show what signing one looks like.
    community.sort(function (a, b) { return (b.addedByName ? 1 : 0) - (a.addedByName ? 1 : 0); });
    community.forEach(function (s) {
      var li = document.createElement('li');
      li.className = 'mm-lake';
      li.innerHTML = lakeCard(s);
      rail.insertBefore(li, you);
    });
    paintStats(r.data.length, community.length, days);
  }

  document.querySelectorAll('[data-rail]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      rail.scrollBy({ left: Number(btn.dataset.rail) * rail.clientWidth * 0.8, behavior: 'smooth' });
    });
  });

  // ── The dock ────────────────────────────────────────────────────────────
  function wireDock() {
    var dock = $('mm-dock');
    var heroCta = $('mm-hero-cta');
    var foot = document.querySelector('.site-footer');
    if (!dock || !heroCta || !('IntersectionObserver' in window)) return;
    var heroSeen = true, footSeen = false;
    var paint = function () { dock.classList.toggle('is-on', !heroSeen && !footSeen); };
    dock.hidden = false;
    new IntersectionObserver(function (es) { heroSeen = es[0].isIntersecting; paint(); }).observe(heroCta);
    if (foot) new IntersectionObserver(function (es) { footSeen = es[0].isIntersecting; paint(); }).observe(foot);
  }

  var days = daysToFirstPicks();
  paintCountdown(days);
  wireDock();
  loadLakes(days);
  if (U.stampYear) U.stampYear();
}());
