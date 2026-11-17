/**
 * /paddlingout/scouts/rules — "Explain me like I am a child" (6 Nov 2026; rebuilt 16 Nov).
 *
 * One button under the title. Pressed, it opens a picture book: one page a rule,
 * a picture drawn for it (Forge, traced to a vector), a title a child would
 * give it, and one or two short sentences in a child's words. Next, Back, a swipe,
 * the arrow keys, Enter, Esc. Ten pages, then a last page that goes somewhere:
 * add a spot, or read the rules. Nothing on the page behind is read out or re-used.
 *
 * What the 16 Nov 2026 audit found, by pressing every control in a real browser:
 *   - the × could not be pressed (the picture sat on it; fixed in scouts.css);
 *   - the "child's words" were the rules again, 19 to 31 words a page, with the
 *     legal headings as titles ("Not a safety endorsement");
 *   - the last page said Done and dropped you back where you started;
 *   - Tab walked out of the open book into the page behind it.
 * The words below hold to: a title of four words or fewer, sentences of eight
 * words or fewer, and no word a seven-year-old would have to ask about.
 *
 * Pictures: /assets/scouts/rules/<rule>-v<date>.svg (scripts/scouts-rules-svg.py). Assets
 * are cached immutable, so a redraw gets a new date in the name. Plain script; without
 * it the page is complete and the button simply does not exist (it is drawn here).
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var V = 'v20261106d';   // d: the HD set (1280, 24 steps) traced to SVG, 6 Nov 2026 night
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ADD = '/paddlingout/search?mode=add';

  // One page a rule, keyed by the section id, in the order the sections stand:
  // [a child's title, a child's words, what the picture shows (for a screen reader)].
  var SAY = {
    who:     ['Who can play', 'Anyone can send a spot. Want the thank-you? Tell us your email.', 'People'],
    earns:   ['What gets a prize', 'We say yes to your spot. You get one code. One spot, one code.', 'A prize tag'],
    code:    ['What the code does', 'It takes a fifth off the price. You can use it once. It lasts 180 days.', 'A price tag with a percent sign'],
    hearing: ['How you get it', 'We email you when your spot is live. The code is inside.', 'An envelope'],
    check:   ['Who says yes', 'A real person looks. Can anyone launch there? Are the photos yours?', 'A magnifying glass'],
    name:    ['Your name', 'Put your name on the spot. Or don’t. Take it off any time.', 'A name tag'],
    photos:  ['Your photos', 'They stay yours. You let us show them. Want the spot gone? Just ask.', 'A camera'],
    page:    ['Your own page', 'Your email and a code open it. See your spots. Pull one back.', 'A key'],
    changes: ['If things change', 'We may change the thank-you. A code you have still works.', 'A calendar'],
    safety:  ['Stay safe', 'The map shows where. It can’t say the water is safe. Check before you go.', 'A life ring']
  };
  var pic = function (id) { return '/assets/scouts/rules/' + id + '-' + V + '.svg'; };

  var head = document.querySelector('.sc-doc-head');
  var rules = Array.prototype.slice.call(document.querySelectorAll('.sc-rule')).filter(function (s) { return SAY[s.id]; });
  if (!head || !rules.length) return;
  var LAST = rules.length;           // the page after the last rule: where to go now

  var btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'sc-explain'; btn.className = 'sc-btn sc-explain';
  btn.textContent = 'Explain me like I am a child';
  head.appendChild(btn);

  var walk = document.createElement('div');
  walk.id = 'rt-walk'; walk.setAttribute('role', 'dialog'); walk.setAttribute('aria-modal', 'true'); walk.setAttribute('aria-label', 'The rules, as a picture book');
  walk.hidden = true;
  walk.innerHTML =
    '<div class="rt-pop" id="rt-pop" tabindex="-1">' +
      '<button type="button" class="rt-close" id="rt-close" aria-label="Close the picture book">&times;</button>' +
      '<div class="rt-pic"><img id="rt-img" alt="" width="1024" height="1024" decoding="async"></div>' +
      '<p class="rt-k" id="rt-k"></p><h2 class="rt-t" id="rt-t"></h2><p class="rt-s" id="rt-s" aria-live="polite"></p>' +
      '<div class="rt-end" id="rt-end" hidden><a class="sc-btn" id="rt-add" href="' + ADD + '">Add a spot</a>' +
        '<button type="button" class="rt-back" id="rt-read">Read the rules</button></div>' +
      '<div class="rt-foot"><span class="rt-count" id="rt-count"></span><span class="rt-dots" id="rt-dots" aria-hidden="true"></span>' +
      '<div class="rt-btns"><button type="button" class="rt-back" id="rt-back">Back</button><button type="button" class="rt-next" id="rt-next">Next</button></div></div>' +
    '</div>';
  document.body.appendChild(walk);
  $('rt-dots').innerHTML = rules.map(function () { return '<i></i>'; }).join('');

  var i = 0, open = false;

  function show(n) {
    i = Math.max(0, Math.min(LAST, n));
    var end = i === LAST, sec = rules[end ? LAST - 1 : i], img = $('rt-img');
    var say = end ? ['That’s all ten', 'Know a spot we don’t? Send it.', 'A price tag with a percent sign'] : SAY[sec.id];
    $('rt-k').textContent = end ? 'The end' : 'Rule ' + (i + 1) + ' of ' + rules.length;
    $('rt-t').textContent = say[0];
    $('rt-s').textContent = say[1];
    $('rt-count').textContent = end ? '' : (i + 1) + ' / ' + rules.length;
    $('rt-end').hidden = !end;
    $('rt-next').hidden = end;                       // the last page has its own two ways on
    $('rt-back').disabled = i === 0;
    Array.prototype.forEach.call($('rt-dots').children, function (d, k) { d.classList.toggle('on', k === i); });
    img.alt = say[2];
    img.src = pic(end ? 'code' : sec.id);
    if (!reduce) { img.classList.remove('in'); void img.offsetWidth; img.classList.add('in'); }
    if (rules[i + 1]) new Image().src = pic(rules[i + 1].id);   // the next page is ready before it is turned
    (end ? $('rt-add') : $('rt-pop')).focus({ preventScroll: true });
  }
  function start() { open = true; walk.hidden = false; document.body.classList.add('rt-on'); show(0); }
  function stop() { open = false; walk.hidden = true; document.body.classList.remove('rt-on'); btn.focus(); }
  function next() { if (i < LAST) show(i + 1); }
  function back() { if (i > 0) show(i - 1); }

  btn.addEventListener('click', start);
  $('rt-next').addEventListener('click', next);
  $('rt-back').addEventListener('click', back);
  $('rt-close').addEventListener('click', stop);
  $('rt-read').addEventListener('click', stop);
  walk.addEventListener('click', function (e) { if (e.target === walk) stop(); });

  // A swipe turns the page, as a picture book's would.
  var sx = null, sy = 0;
  walk.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
  walk.addEventListener('touchend', function (e) {
    if (sx === null) return;
    var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) next(); else back(); }
  }, { passive: true });

  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); stop(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') { e.preventDefault(); next(); }
    else if (e.key === 'Tab') {
      // The book is modal: Tab goes round its own controls, never into the page behind.
      var f = Array.prototype.filter.call(walk.querySelectorAll('button, a[href]'), function (el) { return !el.disabled && !el.hidden && el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1], at = document.activeElement;
      if (e.shiftKey && (at === first || !walk.contains(at) || at === $('rt-pop'))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (at === last || !walk.contains(at))) { e.preventDefault(); first.focus(); }
    }
  });

  window.ScoutsRulesTour = { start: start, stop: stop, steps: rules.length, picture: pic, words: SAY };
}());
