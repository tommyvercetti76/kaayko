/**
 * /paddlingout/scouts/rules — "Explain me like I am a child" (6 Nov 2026).
 *
 * One button under the title. Pressed, it walks the ten rules one at a time: the
 * page dims, a cut-out spotlights the rule, and a small gold callout says the rule
 * in a child's words. Next / Back / Skip, the arrow keys, Enter and Esc. The same
 * shape as the first-launch tour on the grid page (#po-walk), on tokens.css.
 *
 * The child's-words text lives here, not in the page: the rules page reads as the
 * rules, and the tour reads as the tour. Plain script; without it the page is
 * complete and the button simply does not exist (it is drawn here).
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // One line a rule, in the order the sections stand. Keyed by section id so a
  // reordered page still says the right thing next to the right rule.
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

  var head = document.querySelector('.sc-doc-head');
  var rules = Array.prototype.slice.call(document.querySelectorAll('.sc-rule'));
  if (!head || !rules.length) return;

  // The button, drawn by the script that answers it
  var btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'sc-explain'; btn.className = 'sc-btn sc-explain';
  btn.textContent = 'Explain me like I am a child';
  head.appendChild(btn);

  // The overlay: a mask with a hole, a ring, and the callout
  var walk = document.createElement('div');
  walk.id = 'rt-walk'; walk.setAttribute('role', 'dialog'); walk.setAttribute('aria-modal', 'true'); walk.setAttribute('aria-label', 'The rules, explained simply');
  walk.hidden = true;
  walk.innerHTML =
    '<svg class="rt-svg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><mask id="rt-mask"><rect x="0" y="0" width="100%" height="100%" fill="white"></rect><rect id="rt-hole" x="0" y="0" width="0" height="0" fill="black"></rect></mask></defs>' +
    '<rect x="0" y="0" width="100%" height="100%" fill="rgba(6,6,6,0.84)" mask="url(#rt-mask)"></rect><rect id="rt-ring" x="0" y="0" width="0" height="0" fill="none" stroke="#d9bd7b" stroke-width="2"></rect></svg>' +
    '<div class="rt-pop" id="rt-pop" tabindex="-1"><p class="rt-k" id="rt-k"></p><h2 class="rt-t" id="rt-t"></h2><p class="rt-s" id="rt-s" aria-live="polite"></p>' +
    '<div class="rt-foot"><span class="rt-count" id="rt-count"></span><div class="rt-btns"><button type="button" class="rt-skip" id="rt-skip">Skip</button><button type="button" class="rt-back" id="rt-back">Back</button><button type="button" class="rt-next" id="rt-next">Next</button></div></div></div>';
  document.body.appendChild(walk);

  var i = 0, open = false, raf = 0, timer = 0;

  function place() {
    var sec = rules[i], r = sec.getBoundingClientRect(), pad = 10;
    var hole = $('rt-hole'), ring = $('rt-ring');
    [hole, ring].forEach(function (el) {
      el.setAttribute('x', Math.max(4, r.left - pad)); el.setAttribute('y', Math.max(4, r.top - pad));
      el.setAttribute('width', Math.min(window.innerWidth - 8, r.width + pad * 2)); el.setAttribute('height', r.height + pad * 2);
    });
    // The callout sits under the rule when there is room, else above it; on a phone
    // it is pinned to the bottom (CSS), so only the desktop position is computed.
    var pop = $('rt-pop');
    if (window.innerWidth >= 700) {
      var below = r.bottom + pad + 12, h = pop.offsetHeight;
      var top = below + h < window.innerHeight - 12 ? below : Math.max(12, r.top - pad - 12 - h);
      pop.style.top = top + 'px';
      pop.style.left = Math.max(12, Math.min(r.left, window.innerWidth - pop.offsetWidth - 12)) + 'px';
    } else { pop.style.top = ''; pop.style.left = ''; }
  }

  function show(n) {
    i = Math.max(0, Math.min(rules.length - 1, n));
    var sec = rules[i], h2 = sec.querySelector('h2');
    $('rt-k').textContent = 'Rule ' + (i + 1) + ' of ' + rules.length;
    $('rt-t').textContent = h2 ? h2.textContent.trim() : '';
    $('rt-s').textContent = SAY[sec.id] || (sec.querySelector('p') || {}).textContent || '';
    $('rt-count').textContent = (i + 1) + ' / ' + rules.length;
    $('rt-next').textContent = i === rules.length - 1 ? 'Done' : 'Next';
    $('rt-back').disabled = i === 0;
    sec.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    // Place now, then keep placing while the scroll settles (frames, and timers for a
    // tab that gets no frames while it is in the background).
    place();
    var t = 0;
    var settle = function () { place(); if (++t < (reduce ? 1 : 24)) raf = requestAnimationFrame(settle); };
    cancelAnimationFrame(raf); raf = requestAnimationFrame(settle);
    clearTimeout(timer); timer = setTimeout(place, 350); setTimeout(place, 800);
    $('rt-pop').focus({ preventScroll: true });
  }

  function start() {
    open = true; walk.hidden = false; walk.classList.add('active'); document.body.classList.add('rt-on');
    show(0);
  }
  function stop() {
    open = false; walk.classList.remove('active'); walk.hidden = true; document.body.classList.remove('rt-on');
    cancelAnimationFrame(raf);
    btn.focus();
  }
  function next() { if (i === rules.length - 1) stop(); else show(i + 1); }
  function back() { if (i > 0) show(i - 1); }

  btn.addEventListener('click', start);
  $('rt-next').addEventListener('click', next);
  $('rt-back').addEventListener('click', back);
  $('rt-skip').addEventListener('click', stop);
  document.addEventListener('keydown', function (e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); stop(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { if (e.target.tagName !== 'BUTTON' || e.key === 'ArrowRight') { e.preventDefault(); next(); } }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
  });
  window.addEventListener('resize', function () { if (open) place(); });
  window.addEventListener('scroll', function () { if (open) place(); }, { passive: true });

  window.ScoutsRulesTour = { start: start, stop: stop, steps: rules.length };
}());
