/**
 * pages/home-entrance.js — the landing page's layout and its one entrance.
 *
 * Loaded as a blocking script in <head> (so it is fetched before the body
 * exists and nothing can wait on the network after the panels), and called
 * by a one-line inline script straight after #pg-home, so it runs before the
 * first paint. That is the point: the page used to paint with no
 * panel count (headlines twice their size, broken mid-word) and one divider,
 * then index.js corrected all of it 150–400 ms later, and the hover
 * transitions animated the correction. Here the layout is final before
 * anything is drawn, and the only motion on load is the entrance:
 *
 *   first frame painted → .is-in on the page:
 *     the dividers draw (CSS, 120 ms delay, 760 ms)
 *     the wordmarks fade in once the dividers are drawn (CSS, at 880 ms)
 *   fonts loaded (and a frame painted) → .is-lit:
 *     the headlines resolve from scrambled letters (in an overlay, so no
 *       headline ever changes size or rewraps)
 *     on touch screens, each section's subheading rises in (CSS)
 *
 * With reduced motion the page simply appears finished. index.js still owns
 * hover, focus, the menus and the store modal; it moves the dividers through
 * KaaykoHome.place().
 */
window.KaaykoHomeEntrance = function (home) {
  "use strict";

  if (!home || home.dataset.panels) return;

  // Nothing below may animate. Chrome sometimes computes styles in the middle
  // of this (reading the window width can do it), which would give a divider
  // a "before" position or a headline a "before" colour to transition from.
  // .is-placing turns transitions off until the final layout has been styled.
  home.classList.add("is-placing");
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // A disabled panel leaves the DOM entirely: the divider math counts panels.
  var features = window.KaaykoFeatures;
  Array.prototype.forEach.call(home.querySelectorAll(":scope > .choice[data-feature]"), function (panel) {
    if (features && !features.isOn(panel.dataset.feature)) panel.remove();
  });

  var panels = Array.prototype.slice.call(home.querySelectorAll(":scope > .choice"));
  var n = panels.length;
  home.dataset.panels = String(n);

  // One divider and one wordmark per division, created before the first paint.
  for (var i = 0; i < n - 1; i++) {
    var seam = document.createElement("div");
    seam.className = "seam";
    var mark = document.createElement("div");
    mark.className = "mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "kaayko";
    home.insertBefore(seam, panels[0]);
    home.insertBefore(mark, panels[0]);
  }

  // Each panel has weight 1; a highlighted one has weight 2, which gives it
  // half the axis and a quarter to each of two others. Keep in step with
  // .choice--wide in index.html.
  var EXPAND_WEIGHT = 2;
  function place(expandedIndex) {
    var choices = home.querySelectorAll(":scope > .choice");
    var weights = Array.prototype.map.call(choices, function (_, k) { return k === expandedIndex ? EXPAND_WEIGHT : 1; });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var desktop = window.innerWidth >= 720;
    var axis = desktop ? "left" : "top";
    var reset = desktop ? "top" : "left";
    var cum = 0;
    var seams = home.querySelectorAll(":scope > .seam");
    var marks = home.querySelectorAll(":scope > .mark");
    for (var k = 0; k < weights.length - 1; k++) {
      cum += weights[k];
      var at = (cum / total) * 100 + "%";
      if (seams[k]) { seams[k].style[axis] = at; seams[k].style[reset] = ""; }
      if (marks[k]) { marks[k].style[axis] = at; marks[k].style[reset] = ""; }
    }
  }
  place(-1);

  // Every section is announced by its plain name, whatever its headline shows.
  var labels = Array.prototype.slice.call(home.querySelectorAll(".choice-label"));
  labels.forEach(function (label) {
    var text = label.dataset.text || label.textContent.trim();
    label.dataset.text = text;
    label.textContent = text;
    var choice = label.closest(".choice");
    if (choice) choice.setAttribute("aria-label", text);
  });

  // Two cues. .is-in: the dividers draw and the wordmarks follow; they need no
  // font, so they start on the first painted frame and a slow phone sees
  // something happen at once. .is-lit: the headlines resolve and the touch
  // subheadings rise; they wait for the fonts, so no letter ever swaps face.
  var drawn = false, lit = false;
  function draw() {
    if (drawn) return;
    drawn = true;
    home.classList.add("is-in");
  }
  function enter() {
    if (lit) return;
    lit = true;
    draw();
    home.classList.add("is-lit");
    labels.forEach(function (label) {
      if (reduced) { unveil(label); return; }
      try { scramble(label); } catch (_) { unveil(label); }   // a headline is never left hidden
    });
  }

  // ── the scramble ──────────────────────────────────────────────────────
  // The real headline stays where it is, transparent, holding its box. The
  // scrambled letters run in an overlay, one unbreakable line per line of the
  // real headline, so random letters of other widths can never rewrap it.
  var POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var TICK = 38, NOISE_TICKS = 5, LOCK_STEP = 42;

  function veil(label) { label.classList.add("is-veiled"); }
  function unveil(label) {
    label.style.transition = "none";        // the text is already in place: no fade
    label.classList.remove("is-veiled");
    var overlay = label.querySelector(".label-scramble");
    if (overlay) overlay.remove();
    requestAnimationFrame(function () { requestAnimationFrame(function () { label.style.transition = ""; }); });
  }

  function linesOf(label) {
    var words = label.dataset.text.split(" ");
    label.textContent = "";
    var spans = words.map(function (w, k) {
      var s = document.createElement("span");
      s.textContent = w;
      label.appendChild(s);
      if (k < words.length - 1) label.appendChild(document.createTextNode(" "));
      return s;
    });
    var rows = [], top = null;
    spans.forEach(function (s) {
      var t = s.offsetTop;
      if (top === null || Math.abs(t - top) > 2) { rows.push([]); top = t; }
      rows[rows.length - 1].push(s.textContent);
    });
    label.textContent = label.dataset.text;
    return rows.map(function (r) { return r.join(" "); });
  }

  function scramble(label) {
    var rows = linesOf(label);
    var overlay = document.createElement("span");
    overlay.className = "label-scramble";
    overlay.setAttribute("aria-hidden", "true");
    var lines = rows.map(function (row) {
      var line = document.createElement("span");
      line.className = "label-scramble-line";
      line.textContent = row;
      overlay.appendChild(line);
      return { el: line, chars: Array.from(row) };
    });
    label.appendChild(overlay);

    var all = [];
    lines.forEach(function (l) { l.locked = l.chars.map(function (c) { return c === " "; }); l.chars.forEach(function (c, k) { if (c !== " ") all.push([l, k]); }); });
    all.forEach(function (pair, k) {
      setTimeout(function () { pair[0].locked[pair[1]] = true; }, NOISE_TICKS * TICK + k * LOCK_STEP);
    });
    var timer = 0;
    function tick() {
      var done = true;
      lines.forEach(function (l) {
        l.el.textContent = l.chars.map(function (c, k) {
          if (l.locked[k]) return c;
          done = false;
          return POOL[Math.floor(Math.random() * POOL.length)];
        }).join("");
      });
      if (done) { clearInterval(timer); unveil(label); }
    }
    tick();   // scrambled from its first frame: the overlay never shows the answer first
    timer = setInterval(tick, TICK);
  }

  // Hide the headlines until the entrance reveals them. Not with reduced
  // motion: then they are simply there. Until .is-placed the CSS keeps them
  // hidden anyway, so a paint before this point never shows a wrong size.
  if (!reduced) labels.forEach(veil);
  home.classList.add("is-placed");
  void home.offsetWidth;                    // style the final layout with transitions still off
  home.classList.remove("is-placing");

  // Start once the fonts are in (so nothing swaps mid-motion) and a frame
  // has been painted (so the drawing-in has a "before" to animate from).
  // Never wait more than 1.5 s for fonts, and whatever happens, show the
  // page by 3 s.
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([
      document.fonts.load('400 1em "Bebas Neue"'),
      document.fonts.load('italic 500 1em "Cormorant Garamond"')
    ]).catch(function () {});
  }
  function painted() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () { requestAnimationFrame(resolve); });
    });
  }
  function cap(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  painted().then(draw);
  Promise.all([Promise.race([fontsReady(), cap(1500)]), painted()]).then(enter, enter);
  setTimeout(enter, 3000);

  window.KaaykoHome = { place: place };
};
