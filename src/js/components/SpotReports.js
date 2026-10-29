/**
 * components/SpotReports.js — what paddlers saw at a spot: wildlife, hazards, and
 * whether paddling is allowed, each with the day it was seen (29 Oct 2026, India
 * first). A person at Kaayko approves every report; nothing here feeds the score.
 *
 *   KaaykoReports.mount(spot)   → fetches GET /api/paddlingOut/spots/:id/reports and
 *                                 renders the block into #prepStack, with a
 *                                 "Report something" form (POST, multipart).
 *
 * The choices (kinds and types) come from the API with the list, so the page and the
 * server cannot disagree. A report older than 90 days says so; after a year it is
 * not shown. "No report" never means "nothing there": the block says it, at the top.
 *
 * Classic script (window.KaaykoReports). Needs KaaykoPrefs (API base) and KaaykoIcons.
 */
(function (root) {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ICON = { wildlife: 'eye', hazard: 'alert', access: 'shield' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function icon(name) { var I = root.KaaykoIcons; return I && I.get ? I.get(name) : ''; }
  function apiBase() {
    return (root.KaaykoPrefs && root.KaaykoPrefs.kaaykoApiBase) ? root.KaaykoPrefs.kaaykoApiBase() : root.KAAYKO_API_BASE;
  }
  function day(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1] : '';
  }
  function localToday() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function yearAgo() {
    var d = new Date(Date.now() - 363 * 86400000);   // a day inside the server's year, west of UTC too
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function safeImg(u) { try { var x = new URL(u); return x.protocol === 'https:' && /(^|\.)googleapis\.com$/.test(x.hostname) ? x.toString() : null; } catch (_) { return null; } }

  // A phone photo can be 10 MB or a HEIC: resized to a JPEG the server accepts, as in
  // Add a spot (pages/addlake.js). A file the browser cannot read is refused here.
  var ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  function shrink(file) {
    return new Promise(function (resolve) {
      if (ALLOWED.indexOf(file.type) !== -1 && file.size <= 900 * 1024) { resolve(file); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, 1800 / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        var ctx = c.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        var q = 0.82;
        (function next() {
          c.toBlob(function (b) {
            if (b && b.size > 900 * 1024 && q > 0.5) { q -= 0.08; next(); return; }
            resolve(b ? new File([b], 'report.jpg', { type: 'image/jpeg' }) : null);
          }, 'image/jpeg', q);
        })();
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  function row(r) {
    var img = safeImg(r.imgSrc);
    return '<div class="kbg-row spr-row spr-' + esc(r.kind) + (r.old ? ' spr-old' : '') + '"><span class="kbg-icon">' + icon(ICON[r.kind] || 'info') + '</span><span>' +
      '<strong>' + esc(r.label) + '</strong> <span class="spr-when">seen ' + esc(day(r.seenOn)) + (r.old ? ' &middot; old report' : '') + '</span>' +
      (r.note ? '<span class="spr-note">' + esc(r.note) + '</span>' : '') +
      '<span class="spr-by">' + (r.by ? 'Reported by ' + esc(r.by) : 'Reported by a paddler') +
      (img ? ' &middot; <a href="' + esc(img) + '" target="_blank" rel="noopener">photo</a>' : '') + '</span></span></div>';
  }

  function form(spot, kinds, token) {
    var kindChips = Object.keys(kinds).map(function (k, i) {
      return '<label class="spr-chip"><input type="radio" name="kind" value="' + esc(k) + '"' + (i === 0 ? ' checked' : '') + '>' + esc(kinds[k].label) + '</label>';
    }).join('');
    return '<form class="spr-form" id="spr-form" hidden novalidate>' +
      '<input type="text" name="website" class="spr-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      (token ? '<input type="hidden" name="token" value="' + esc(token) + '">' : '') +
      '<fieldset class="spr-set"><legend>What was it?</legend><div class="spr-chips" id="spr-kinds">' + kindChips + '</div>' +
      '<div class="spr-chips" id="spr-types" role="radiogroup" aria-label="Which one"></div></fieldset>' +
      '<label class="spr-field"><span>The day you saw it</span><input type="date" name="seenOn" required max="' + localToday() + '" min="' + yearAgo() + '" value="' + localToday() + '"></label>' +
      '<label class="spr-field"><span>A note <i>optional</i></span><textarea name="note" maxlength="280" rows="2" placeholder="Where exactly, and anything the next paddler should know."></textarea></label>' +
      '<label class="spr-field"><span>A photo <i>optional</i></span><input type="file" name="images" accept="image/*"></label>' +
      '<label class="spr-field"><span>Your name, shown with it <i>optional</i></span><input type="text" name="creditName" maxlength="40" autocomplete="nickname"></label>' +
      '<label class="spr-field"><span>Your email <i>optional</i>: to follow it on your Scout page</span><input type="email" name="email" autocomplete="email"></label>' +
      '<p class="spr-fine">By sending, you confirm the photo is yours and let Kaayko show this report, its note and photo, the day and the name you give on Paddling Out. A person at Kaayko checks every report before it shows. <a href="/privacy#spot-reports">Privacy</a></p>' +
      '<div class="spr-actions"><button type="submit" class="spr-send">Send report</button><button type="button" class="spr-cancel" id="spr-cancel">Cancel</button></div>' +
      '<p class="spr-msg" id="spr-msg" aria-live="polite"></p></form>' +
      '<p class="spr-done" id="spr-done" tabindex="-1" aria-live="polite" hidden></p>';
  }

  function paintTypes(kinds) {
    var host = document.getElementById('spr-types');
    var k = (document.querySelector('#spr-kinds input:checked') || {}).value;
    if (!host || !kinds[k]) return;
    host.innerHTML = Object.keys(kinds[k].types).map(function (t, i) {
      return '<label class="spr-chip"><input type="radio" name="type" value="' + esc(t) + '"' + (i === 0 ? ' checked' : '') + '>' + esc(kinds[k].types[t]) + '</label>';
    }).join('');
  }

  function wire(spot, kinds) {
    var open = document.getElementById('spr-open');
    var f = document.getElementById('spr-form');
    if (!open || !f) return;
    var done = document.getElementById('spr-done');
    paintTypes(kinds);
    open.addEventListener('click', function () {
      f.hidden = false; open.hidden = true; if (done) done.hidden = true;
      var first = f.querySelector('input[name=kind]'); if (first) first.focus();
    });
    document.getElementById('spr-cancel').addEventListener('click', function () { f.hidden = true; open.hidden = false; open.focus(); });
    document.getElementById('spr-kinds').addEventListener('change', function () { paintTypes(kinds); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('spr-msg');
      var btn = f.querySelector('.spr-send');
      var fd = new FormData(f);
      if (!fd.get('type')) { msg.textContent = 'Choose what you saw.'; return; }
      var file = f.querySelector('input[type=file]').files[0];
      fd.delete('images');
      fd.append('pageUrl', location.href.slice(0, 500));
      btn.disabled = true;
      msg.textContent = file ? 'Preparing the photo…' : 'Sending…';
      (file ? shrink(file) : Promise.resolve(null))
        .then(function (photo) {
          if (file && !photo) throw new Error('photo');
          if (photo) fd.append('images', photo, photo.name);
          msg.textContent = 'Sending…';
          return fetch(apiBase() + '/paddlingOut/spots/' + encodeURIComponent(spot.id) + '/reports', { method: 'POST', body: fd });
        })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, b: b }; }); })
        .then(function (x) {
          if (!x.ok || !x.b.success) { msg.textContent = (x.b && x.b.error) || 'Could not send it. Please try again.'; btn.disabled = false; return; }
          // Said in a live region outside the form, focus moved to it; the form resets for another.
          f.reset(); paintTypes(kinds); f.hidden = true; btn.disabled = false; msg.textContent = '';
          if (done) {
            done.textContent = 'Sent: ' + x.b.label + '. A person at Kaayko checks it before it shows.' + (fd.get('email') ? ' Check your email for a link to follow it.' : '');
            done.hidden = false; done.focus();
          }
          open.textContent = 'Report something else'; open.hidden = false;
        })
        .catch(function (err) {
          msg.textContent = err && err.message === 'photo' ? 'That photo could not be read. Try a JPEG or PNG.' : 'Could not send it. Please try again.';
          btn.disabled = false;
        });
    });
  }

  function mount(spot) {
    var host = document.getElementById('prepStack');
    if (!host || !spot || !spot.id || String(spot.id).indexOf('custom_') === 0) return;
    var old = document.getElementById('spr-block');
    if (old) old.remove();
    fetch(apiBase() + '/paddlingOut/spots/' + encodeURIComponent(spot.id) + '/reports')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (b) {
        if (!b || !b.success || document.getElementById('spr-block')) return;
        var list = (b.reports || []).map(row).join('');
        host.insertAdjacentHTML('beforeend',
          '<div class="kbg-block spr-block" id="spr-block"><div class="kbg-title">Reported by paddlers</div>' +
          '<p class="spr-warn">What paddlers say they saw here, and the day. Kaayko checks each report before it shows but cannot confirm it. It is not a safety check and not permission to paddle, and no report does not mean there is nothing there. Check the local rules before you go.</p>' +
          (list || '<p class="spr-empty">No reports from the last year yet.</p>') +
          '<button type="button" class="spr-open" id="spr-open">Report something: wildlife, a hazard, or whether paddling is allowed</button>' +
          form(spot, b.kinds || {}) + '</div>');
        wire(spot, b.kinds || {});
      })
      .catch(function () { /* the rest of the page does not depend on this */ });
  }

  /**
   * The form alone, for a spot still in review (the end of Add a spot): the sender
   * proves it is theirs with the details token. Shows the same choices.
   */
  function mountForm(host, spotId, opts) {
    if (!host || !spotId) return;
    host.innerHTML = '';
    var token = opts && opts.token;
    fetch(apiBase() + '/paddlingOut/spots/' + encodeURIComponent(spotId) + '/reports')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (b) {
        if (!b || !b.success) return;
        host.innerHTML = '<div class="spr-block spr-inline"><h3 class="al-extras-h">Seen anything? <span>optional</span></h3>' +
          '<p class="spr-warn">Wildlife, a hazard, or whether paddling is allowed here, with the day you saw it.</p>' +
          '<button type="button" class="spr-open" id="spr-open">Add a report</button>' + form({ id: spotId }, b.kinds || {}, token) + '</div>';
        wire({ id: spotId }, b.kinds || {});
      })
      .catch(function () {});
  }

  var api = { mount: mount, mountForm: mountForm, _day: day };
  root.KaaykoReports = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
