/**
 * /paddlingout/claim — claim a Mapmakers pick at $0 (28 Oct 2026).
 *
 * Arrives three ways:
 *   #t=<token>      from the pick email: the lake, then every store piece the pick
 *                   can be (Kaayko's own, under $25, real photos). Tap one, choose
 *                   its size in the bar that rises, Claim → Stripe Checkout, which
 *                   asks only where to send it (nothing to pay).
 *   ?session=cs_…   back from Stripe: confirm → "It's yours" + the order link.
 *   ?cancelled=1    back without finishing: nothing taken, the link still works.
 *
 * The token never travels in a URL a server sees: it is read from the fragment,
 * the fragment is removed at once, and it rides in a POST body. It is kept in
 * sessionStorage (this tab only) so "Try again" after a closed checkout needs no
 * trip back to the email; it is dropped the moment the claim is done or refused.
 * Server side: api/weather/mapmakerRoutes.js → services/mapmakerPicks.js.
 */
(function () {
  'use strict';

  var U = window.KaaykoUtil;
  var esc = U.escapeHtml;
  var API = U.apiBase();
  var $ = function (id) { return document.getElementById(id); };
  var root = $('cl');
  var KEY = 'kaayko.mapmakers.claim';
  var HELP = 'If you think that’s wrong, write to <a href="mailto:help@kaayko.com">help@kaayko.com</a>.';
  var token = '';
  var pieces = [];
  var filter = 'all';
  var chosen = null;   // { piece, size }

  function setState(s) { root.dataset.state = s; }
  function keep(t) { try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch (_) { /* storage blocked: the email link still works */ } }
  function kept() { try { return sessionStorage.getItem(KEY) || ''; } catch (_) { return ''; } }
  function post(path, body) {
    return U.fetchJson(API + '/paddlingOut/mapmakers/claim/' + path, {
      timeoutMs: 20000,
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    });
  }
  function heading(h1, lede) { $('cl-h1').textContent = h1; $('cl-lede').textContent = lede || ''; }
  // messageHtml is this file's own copy only (HELP + plain text), never server text.
  function note(kicker, title, messageHtml, canRetry) {
    $('cl-note-k').textContent = kicker;
    $('cl-note-t').textContent = title;
    $('cl-note-s').innerHTML = messageHtml;
    $('cl-again').hidden = !canRetry;
    setState('note');
  }

  function showPick(p) {
    if (typeof p.imgSrc === 'string' && /^https:\/\//.test(p.imgSrc)) { $('cl-img').src = p.imgSrc; $('cl-img').alt = p.lakeName || ''; }
    $('cl-eyebrow').textContent = 'Kaayko Mapmakers \u00b7 No. ' + p.number + ' \u00b7 ' + p.monthLabel;
    heading(p.lakeName || 'Your lake', (p.finderName ? p.finderName + ', you' : 'You') + ' put it on the map, and it was picked by hand.');
    $('cl-choice').textContent = 'Any one piece from the Kaayko store: ' + (p.choiceWords || 'a piece') + '. Nothing to pay; shipping is free.';
    pieces = Array.isArray(p.pieces) ? p.pieces : [];
    var until = new Date(p.expiresAt);
    $('cl-fine').innerHTML = 'The link is yours alone and works once, until ' +
      esc(until.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })) +
      '. Your address is used only to send your piece. <a href="/privacy#lake-submissions">Privacy</a> \u00b7 <a href="/paddlingout/mapmakers#rules">Rules</a>';
    if (!pieces.length) {
      return note('Nothing to choose', 'Right now', 'The store has no piece a pick can be at the moment. Your link still works; try again soon, or write to <a href="mailto:help@kaayko.com">help@kaayko.com</a>.', true);
    }
    var back = p.chosen && pieces.find(function (x) { return x.id === p.chosen.productId; });
    chosen = back ? { piece: back, size: p.chosen.size } : null;
    renderFilters();
    renderGrid();
    renderBar();
    setState('ready');
  }

  function kinds() {
    var seen = [];
    pieces.forEach(function (x) { if (!seen.some(function (k) { return k.type === x.productType; })) seen.push({ type: x.productType, label: x.typeLabel }); });
    return seen;
  }

  function renderFilters() {
    var ks = kinds();
    var html = '<button type="button" class="cl-chip" role="tab" data-type="all" aria-selected="' + (filter === 'all') + '">All<span>' + pieces.length + '</span></button>';
    ks.forEach(function (k) {
      var n = pieces.filter(function (x) { return x.productType === k.type; }).length;
      html += '<button type="button" class="cl-chip" role="tab" data-type="' + esc(k.type) + '" aria-selected="' + (filter === k.type) + '">' + esc(k.label) + '<span>' + n + '</span></button>';
    });
    $('cl-filters').innerHTML = ks.length > 1 ? html : '';
  }

  function renderGrid() {
    var shown = pieces.filter(function (x) { return filter === 'all' || x.productType === filter; });
    $('cl-grid').innerHTML = shown.map(function (x) {
      var on = chosen && chosen.piece.id === x.id;
      var img = typeof x.img === 'string' && /^https:\/\//.test(x.img) ? x.img : '';
      return '<li><button type="button" class="cl-card" data-id="' + esc(x.id) + '" aria-pressed="' + !!on + '">' +
        (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" decoding="async">' : '<img src="data:," alt="">') +
        '<span class="cl-card-t"><span class="cl-card-k">' + esc(x.typeOne || x.typeLabel) + '</span>' + esc(x.title) + '</span></button></li>';
    }).join('');
  }

  // The bar: what you chose, its size, Claim. A single-size piece needs no choice;
  // a magnet starts on its first shape; a tee waits for you to say which size.
  function renderBar() {
    if (!chosen) { $('cl-bar').hidden = true; return; }
    var x = chosen.piece;
    var i = x.sizes.indexOf(chosen.size);
    var img = (Array.isArray(x.imgBySize) && x.imgBySize[i]) || x.img;
    $('cl-bar-img').src = typeof img === 'string' && /^https:\/\//.test(img) ? img : 'data:,';
    $('cl-bar-t').textContent = x.title;
    $('cl-bar-sizes').innerHTML = x.sizes.length > 1 ? x.sizes.map(function (z) {
      return '<button type="button" class="cl-size" role="radio" data-size="' + esc(z) + '" aria-checked="' + (z === chosen.size) + '">' + esc(z) + '</button>';
    }).join('') : '<span class="cl-card-k">' + esc(x.sizes[0]) + '</span>';
    $('cl-msg').textContent = '';
    $('cl-bar').hidden = false;
  }

  $('cl-filters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-type]');
    if (!b) return;
    filter = b.dataset.type;
    renderFilters();
    renderGrid();
  });
  $('cl-grid').addEventListener('click', function (e) {
    var b = e.target.closest('.cl-card');
    if (!b) return;
    var x = pieces.find(function (y) { return y.id === b.dataset.id; });
    if (!x) return;
    var size = x.sizes.length === 1 ? x.sizes[0] : (x.productType === 'magnet' ? x.sizes[0] : null);
    chosen = { piece: x, size: chosen && chosen.piece.id === x.id ? chosen.size : size };
    renderGrid();
    renderBar();
  });
  $('cl-bar-sizes').addEventListener('click', function (e) {
    var b = e.target.closest('[data-size]');
    if (!b || !chosen) return;
    chosen.size = b.dataset.size;
    renderBar();
  });

  async function open(t) {
    token = t;
    keep(t);
    var r = await post('peek', { token: t });
    if (r.ok && r.data && r.data.pick) { showPick(r.data.pick); return; }
    if (r.status === 0) {
      heading('Your pick');
      return note('No connection', 'We couldn’t reach Kaayko', 'Check your connection and try again.', true);
    }
    keep('');
    heading('Your pick');
    if (r.status === 429) return note('Too many tries', 'Try again tomorrow', 'This network has opened claim links many times today. ' + HELP, false);
    note('This link', 'Can’t be used', 'It has been used, has expired, or isn’t complete. ' + HELP, false);
  }

  $('cl-go').addEventListener('click', async function () {
    var btn = this;
    if (!chosen) return;
    if (!chosen.size) { $('cl-msg').textContent = 'Choose a size first.'; return; }
    btn.disabled = true;
    btn.textContent = 'Opening checkout\u2026';
    $('cl-msg').textContent = '';
    var r = await post('checkout', { token: token, productId: chosen.piece.id, size: chosen.size });
    if (r.ok && r.data && typeof r.data.url === 'string' && /^https:\/\/checkout\.stripe\.com\//.test(r.data.url)) {
      location.href = r.data.url;
      return;
    }
    btn.disabled = false;
    btn.textContent = 'Claim it';
    $('cl-msg').textContent = (r.data && r.data.error) || 'Could not open the checkout. Please try again.';
  });

  $('cl-again').addEventListener('click', function () {
    var t = kept();
    if (!t) { location.href = '/paddlingout/mapmakers'; return; }
    setState('loading');
    open(t);
  });

  async function confirmReturn(sessionId) {
    $('cl-lede').textContent = 'Checking with the checkout…';
    var r = await post('confirm', { sessionId: sessionId });
    var d = r.data || {};
    if (r.ok && d.state === 'claimed') {
      keep('');
      heading('It’s yours', 'Thank you for putting your lake on the map.');
      $('cl-order').textContent = d.orderNumber ? 'Order ' + d.orderNumber : 'Being made';
      if (typeof d.statusUrl === 'string' && /^https:\/\/kaay\.store\/order\//.test(d.statusUrl)) {
        $('cl-status').href = d.statusUrl;
        $('cl-status').hidden = false;
      }
      setState('claimed');
      return;
    }
    if (r.ok && d.state === 'held') {
      keep('');
      heading('Almost');
      return note('Your claim is in', 'One thing to check', 'A person at Kaayko needs to check one detail before your piece is made, and will email you. ' + HELP, false);
    }
    if (r.ok && (d.state === 'open' || d.state === 'expired')) {
      heading('Not finished');
      return note('The checkout', 'Wasn’t finished', 'Nothing was taken, and your link still works.', !!kept());
    }
    heading('Your pick');
    note('We couldn’t confirm it', 'Yet', 'If you finished the checkout, your claim still goes through within the hour and you will get an email. ' + HELP, false);
  }

  // ── Entry ────────────────────────────────────────────────────────────────
  var frag = new URLSearchParams(location.hash.replace(/^#/, ''));
  var fromEmail = frag.get('t');
  var q = new URLSearchParams(location.search);
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);   // the token leaves the address bar
  if (q.get('session')) confirmReturn(q.get('session'));
  else if (q.get('cancelled')) { heading('Not claimed yet'); note('The checkout', 'Was closed', 'Nothing was taken, and your link still works.', !!kept()); }
  else if (fromEmail) open(fromEmail);
  else if (kept()) open(kept());
  else { heading('Your pick'); note('This page', 'Needs your link', 'Open the link in the email we sent you. ' + HELP, false); }
}());
