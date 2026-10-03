/**
 * components/KnowBeforeYouGo.js — the facts a paddler needs that no weather app
 * has: what it costs, what you need, where you put in, what else is on the water.
 *
 *   KaaykoKBYG.facts(spot)      → HTML: fees, permits & inspections, put-in,
 *                                 motor boats, season, hazards, rentals, dogs,
 *                                 parking. Every row names its source and the
 *                                 date it was checked; unofficial sources say so.
 *   KaaykoKBYG.closure(spot)    → HTML for a closed or out-of-season spot, or ''.
 *   KaaykoKBYG.isPaused(spot)   → true when the spot gets no rating (closed, or a
 *                                 cold-weather lake from October to late April).
 *
 * Data: GET /api/paddlingOut/:id → facts, status (kaayko-api
 * spotFacts.js is the only gate: no fact without a source URL and a date).
 * Nothing here is inferred: a missing fact is a missing row.
 *
 * Classic script (window.KaaykoKBYG). Needs KaaykoPrefs (units) and KaaykoIcons.
 */
(function (root) {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];   // for 'checked 3 Oct 2026'
  // Order = what stops a trip first: permits and fees before trivia.
  var ROWS = [
    ['permits', 'Permits & inspection', 'shield'],
    ['fees', 'Fees', 'tag'],
    ['launch', 'Put-in', 'pin'],
    ['motorized', 'Motor boats', 'wave'],
    ['season', 'Season', 'sun'],
    ['rentals', 'Rentals', 'compass'],
    ['dogs', 'Dogs', 'heart'],
    ['parking', 'Parking', 'grid']
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function icon(name) { var I = root.KaaykoIcons; return I && I.get ? I.get(name) : ''; }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return 'source'; } }
  function safeUrl(u) { try { var x = new URL(u); return x.protocol === 'https:' ? x.toString() : null; } catch (_) { return null; } }
  function checkedOn(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
    return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : '';
  }

  /** "Source: nps.gov · checked 3 Oct 2026" (+ any second source). */
  function sourceLine(f) {
    var u = safeUrl(f && f.source);
    if (!u) return '';
    var also = (f.alsoSources || []).map(function (a) {
      var au = safeUrl(a && a.source);
      return au ? ' · <a href="' + esc(au) + '" target="_blank" rel="noopener">' + esc(host(au)) + '</a>' : '';
    }).join('');
    return '<span class="kbg-src">Source: <a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(host(u)) + '</a>' +
      also + (f.official === false ? ' <em>(unofficial)</em>' : '') +
      (f.checked ? ' · checked ' + esc(checkedOn(f.checked)) : '') + '</span>';
  }

  function row(cls, iconName, label, f, extra) {
    return '<div class="kbg-row kbg-fact ' + cls + '"><span class="kbg-icon">' + icon(iconName) + '</span>' +
      '<span><strong>' + esc(label) + '</strong> ' + esc(f.summary) + (extra || '') + sourceLine(f) + '</span></div>';
  }

  // Closed to recreation, or a cold-weather lake out of season: no rating (the
  // API does not send one either). One state, two honest wordings.
  function pausedState(spot) {
    var st = spot && spot.status && spot.status.state;
    return st === 'closed' || st === 'season' ? st : null;
  }
  function isPaused(spot) { return !!pausedState(spot); }
  function isClosed(spot) { return pausedState(spot) === 'closed'; }

  function resumeLabel(status) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((status && status.resumes) || '');
    return m ? MONTHS[+m[2] - 1] + ' ' + (+m[3]) : '';
  }

  function closure(spot) {
    var st = pausedState(spot);
    if (!st) return '';
    var s = spot.status;
    var season = st === 'season';
    return '<div class="kbg-closed' + (season ? ' is-season' : '') + '" role="status">' +
      '<div class="kbg-closed-eyebrow">' + (season ? 'Out of season' : 'Closed') + '</div>' +
      '<p class="kbg-closed-copy">' + esc(s.summary) + '</p>' +
      (season && s.reason ? '<p class="kbg-closed-note">' + esc(s.reason) + '</p>' : '') +
      '<p class="kbg-closed-note">' + (season
        ? 'No Paddle Score until then. Cold water and short, freezing days make a rating misleading.'
        : 'There is no Paddle Score while it is closed: a score would say the water is fine to go out on.') + '</p>' +
      (s.source ? sourceLine(s) : '') + '</div>';
  }

  function facts(spot) {
    var f = spot && spot.facts;
    var tips = (spot && Array.isArray(spot.localTips) ? spot.localTips : []).filter(function (t) { return t && t.text; });
    if (!f && !tips.length) return '';
    var out = [];
    tips.slice(0, 4).forEach(function (t) {
      out.push('<div class="kbg-row kbg-' + esc(t.category || 'general') + '"><span class="kbg-icon">' + icon('info') + '</span><span>' + esc(t.text) + '</span></div>');
    });
    if (f) {
      ROWS.forEach(function (r) {
        var x = f[r[0]];
        if (!x || !x.summary) return;
        var extra = '';
        if (r[0] === 'launch' && Number.isFinite(Number(x.lat)) && Number.isFinite(Number(x.lng)) && x.lat != null && x.lng != null) {
          extra = ' <a class="kbg-dir" href="https://www.google.com/maps/dir/?api=1&destination=' + Number(x.lat) + ',' + Number(x.lng) + '" target="_blank" rel="noopener">Directions to the put-in &rarr;</a>';
        }
        out.push(row('kbg-' + r[0], r[2], r[1], x, extra));
      });
      (f.hazards || []).forEach(function (h) { if (h && h.summary) out.push(row('kbg-hazard', 'alert', 'Hazard', h)); });
    }
    if (!out.length) return '';
    return '<div class="kbg-block kbg-facts" id="kbg-facts"><div class="kbg-title">Know before you go</div>' + out.join('') + '</div>';
  }

  var api = { facts: facts, closure: closure, isClosed: isClosed, isPaused: isPaused, pausedState: pausedState, resumeLabel: resumeLabel };
  root.KaaykoKBYG = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
