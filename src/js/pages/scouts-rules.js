/**
 * /paddlingout/scouts/rules — "Explain me like I am a child" (6 Nov 2026).
 *
 * One button under the title. Pressed, it opens a picture book: one page a rule,
 * a picture drawn for it (Forge, the same gold-mark style as the Scouts binoculars
 * in the header), the rule's name, and one line in a child's words. Next, Back,
 * the arrow keys, Enter, Esc. Ten pages, then Done. Nothing on the page behind
 * is read out or re-used: the rules page reads as the rules, the book as the book.
 *
 * Pictures: /assets/scouts/rules/<rule>-v<date>.webp (assets are cached immutable,
 * so a redraw gets a new date in the name). Plain script; without it the page is
 * complete and the button simply does not exist (it is drawn here).
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var V = 'v20261106';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // One page a rule, keyed by the section id, in the order the sections stand.
  var SAY = {
    who: 'Anyone can send a spot. If you want the thank-you code, tell us your email, so we know where to send it.',
    earns: 'Every spot we say yes to gets one code. Three spots, three codes. Fixing someone else’s spot, or sending a report, gets none.',
    code: 'The code takes 20% off one shopping trip at the Kaayko store. Use it once, within 180 days. It works on Kaayko’s own things, not on things other makers sell there.',
    hearing: 'When your spot goes live, we email you. The code is in that email. Lost it? Write to help@kaayko.com and say which spot.',
    check: 'A real person looks. Is the launch open to everyone? Is the pin on the launch? Are the photos yours? Yes to all: it goes up. No: we email you why.',
    name: 'You can put your name on the spot, or not. You can take it off later. We might fix the spelling.',
    photos: 'The photos stay yours. You let us show them next to the spot. Want the spot gone? Ask on your Scout page, and a person decides.',
    page: 'Your first email gets you a Scout code. With it you can see your spots, take your name off, pull one back before it goes live, or get a new code.',
    changes: 'We might change the thank-you one day. A code you already have keeps working until its time is up.',
    safety: 'The map shows where. It cannot tell you if the water is safe today. Check the weather and the rules before you go.'
  };
  var pic = function (id) { return '/assets/scouts/rules/' + id + '-' + V + '.webp'; };

  var head = document.querySelector('.sc-doc-head');
  var rules = Array.prototype.slice.call(document.querySelectorAll('.sc-rule')).filter(function (s) { return SAY[s.id]; });
  if (!head || !rules.length) return;

  var btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'sc-explain'; btn.className = 'sc-btn sc-explain';
  btn.textContent = 'Explain me like I am a child';
  head.appendChild(btn);

  var walk = document.createElement('div');
  walk.id = 'rt-walk'; walk.setAttribute('role', 'dialog'); walk.setAttribute('aria-modal', 'true'); walk.setAttribute('aria-label', 'The rules, as a picture book');
  walk.hidden = true;
  walk.innerHTML =
    '<div class="rt-pop" id="rt-pop" tabindex="-1">' +
      '<button type="button" class="rt-close" id="rt-close" aria-label="Close">&times;</button>' +
      '<div class="rt-pic"><img id="rt-img" alt="" width="720" height="720" decoding="async"></div>' +
      '<p class="rt-k" id="rt-k"></p><h2 class="rt-t" id="rt-t"></h2><p class="rt-s" id="rt-s" aria-live="polite"></p>' +
      '<div class="rt-foot"><span class="rt-count" id="rt-count"></span><span class="rt-dots" id="rt-dots" aria-hidden="true"></span>' +
      '<div class="rt-btns"><button type="button" class="rt-back" id="rt-back">Back</button><button type="button" class="rt-next" id="rt-next">Next</button></div></div>' +
    '</div>';
  document.body.appendChild(walk);
  $('rt-dots').innerHTML = rules.map(function () { return '<i></i>'; }).join('');

  var i = 0, open = false;

  function show(n) {
    i = Math.max(0, Math.min(rules.length - 1, n));
    var sec = rules[i], h2 = sec.querySelector('h2'), img = $('rt-img');
    $('rt-k').textContent = 'Rule ' + (i + 1) + ' of ' + rules.length;
    $('rt-t').textContent = h2 ? h2.textContent.trim() : '';
    $('rt-s').textContent = SAY[sec.id];
    $('rt-count').textContent = (i + 1) + ' / ' + rules.length;
    $('rt-next').textContent = i === rules.length - 1 ? 'Done' : 'Next';
    $('rt-back').disabled = i === 0;
    Array.prototype.forEach.call($('rt-dots').children, function (d, k) { d.classList.toggle('on', k === i); });
    img.src = pic(sec.id);
    if (!reduce) { img.classList.remove('in'); void img.offsetWidth; img.classList.add('in'); }
    if (rules[i + 1]) new Image().src = pic(rules[i + 1].id);   // the next page is ready before it is turned
    $('rt-pop').focus({ preventScroll: true });
  }
  function start() { open = true; walk.hidden = false; document.body.classList.add('rt-on'); show(0); }
  function stop() { open = false; walk.hidden = true; document.body.classList.remove('rt-on'); btn.focus(); }
  function next() { if (i === rules.length - 1) stop(); else show(i + 1); }
  function back() { if (i > 0) show(i - 1); }

  btn.addEventListener('click', start);
  $('rt-next').addEventListener('click', next);
  $('rt-back').addEventListener('click', back);
  $('rt-close').addEventListener('click', stop);
  walk.addEventListener('click', function (e) { if (e.target === walk) stop(); });
  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); stop(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); next(); }
  });

  window.ScoutsRulesTour = { start: start, stop: stop, steps: rules.length, picture: pic };
}());
