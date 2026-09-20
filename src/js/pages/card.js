/**
 * pages/card.js — the collectible card (/card): lighting model, flip, share, QR.
 * Moved out of card.html on 12 Sep 2026 unchanged.
 */
import { front, back, PRINT } from '/js/cards/render.js?v=8fa7d55';
import { engravedFor, stockOf } from '/js/cards/skins/engraved.js?v=8fa7d55';
import { readFace, canVibrate, warmArt } from '/js/cards/relief.js?v=8fa7d55';
import { esc, apiBase } from '/js/kit.js?v=8fa7d55';

/* ── the lighting model ────────────────────────────────────────────────────
   Blinn-Phong with a Schlick Fresnel term. The pointer is a light at (lx, ly)
   a little way above the card; the card's normal comes from its own tilt. The
   highlight is drawn where the reflection actually lands, not where the cursor
   happens to be, which is why it slides the "wrong" way as the card turns.   */

const card = document.getElementById('card');
const room = document.getElementById('room');
const TILT = 11;              // degrees of attitude at the edges
const LIGHT_H = 1.35;         // how high the lamp sits, in card widths
const SHINE = 42;             // specular exponent — higher is a tighter hotspot
const F0 = 0.045;             // reflectance at normal incidence, for paper with foil

const v = (x, y, z) => ({ x, y, z });
const norm = (a) => { const m = Math.hypot(a.x, a.y, a.z) || 1; return v(a.x/m, a.y/m, a.z/m); };
const dot = (a, b) => a.x*b.x + a.y*b.y + a.z*b.z;

let raf = 0, target = { x: .5, y: .35 }, cur = { x: .5, y: .35 }, live = false;
// The lamp writes --spec/--fres/--hue as INLINE properties on #card every
// frame, and an inline property beats any stylesheet — so a class that merely
// re-declares them loses. Turning the foil off means stopping the loop AND
// removing what it last wrote, or the card keeps the highlight it happened to
// be wearing.
let lamp = true;

function light(px, py) {
  // Attitude: the card leans toward the light.
  const rx = (0.5 - py) * 2 * TILT;
  const ry = (px - 0.5) * 2 * TILT;
  const rxr = rx * Math.PI / 180, ryr = ry * Math.PI / 180;

  // Surface normal after that rotation.
  const N = norm(v(Math.sin(ryr), -Math.sin(rxr), Math.cos(rxr) * Math.cos(ryr)));
  const V = v(0, 0, 1);                                   // viewer, straight on
  const L = norm(v((px - 0.5) * 2, (0.5 - py) * 2, LIGHT_H));
  const H = norm(v(L.x + V.x, L.y + V.y, L.z + V.z));     // half-vector

  const spec = Math.pow(Math.max(0, dot(N, H)), SHINE);
  const nv = Math.max(0, dot(N, V));
  const fres = F0 + (1 - F0) * Math.pow(1 - nv, 5);        // Schlick

  // Where the reflection lands on the card face: mirror the light about N.
  const d = 2 * dot(L, N);
  const R = v(d * N.x - L.x, d * N.y - L.y, d * N.z - L.z);
  const sx = 50 + (R.x / Math.max(0.15, R.z)) * 46;
  const sy = 50 - (R.y / Math.max(0.15, R.z)) * 46;

  const s = card.style;
  s.setProperty('--rx', rx.toFixed(2) + 'deg');
  s.setProperty('--ry', ry.toFixed(2) + 'deg');
  s.setProperty('--spec', (0.28 + spec * 0.85).toFixed(3));
  s.setProperty('--fres', Math.min(1, fres * 5).toFixed(3));
  s.setProperty('--hue', ((px - 0.5) * 46).toFixed(1) + 'deg');
  s.setProperty('--sx', sx.toFixed(1) + '%');
  s.setProperty('--sy', sy.toFixed(1) + '%');
  room.style.setProperty('--sx', (px * 100).toFixed(1) + '%');
  room.style.setProperty('--sy', (py * 100).toFixed(1) + '%');
}

/** Where the lamp should sit for a pointer or a tilt at (px, py) over the card. */
const lampAngle = (px, py) => 180 + Math.atan2(0.5 - py, px - 0.5) * 180 / Math.PI;

const LAMP_VARS = ['--rx', '--ry', '--spec', '--fres', '--hue', '--sx', '--sy'];

function lampOff() {
  // The loop keeps running: it is what carries the pointer into the rake. Only
  // the foil is switched off, and what it last wrote is removed, because an
  // inline property beats any stylesheet.
  lamp = false;
  LAMP_VARS.forEach((k) => card.style.removeProperty(k));
  // The room runs its own copy of the light, so the background pool would
  // otherwise go on following the pointer under a card that had stopped.
  room.style.removeProperty('--sx');
  room.style.removeProperty('--sy');
  card.classList.remove('is-live');
  live = false;
}

function lampOn() {
  if (still) return;
  lamp = true;
  if (!raf) raf = requestAnimationFrame(loop);
}

function loop() {
  cur.x += (target.x - cur.x) * 0.14;      // a little inertia; paper has mass
  cur.y += (target.y - cur.y) * 0.14;
  if (lamp) light(cur.x, cur.y);           // foil belongs to the colour card
  raf = requestAnimationFrame(loop);
}

function aim(e) {
  const r = card.getBoundingClientRect();
  target.x = Math.max(-0.2, Math.min(1.2, (e.clientX - r.left) / r.width));
  target.y = Math.max(-0.6, Math.min(1.6, (e.clientY - r.top) / r.height));
  if (engraved) aimLamp(lampAngle(target.x, target.y));
  if (!live) { live = true; card.classList.add('is-live'); }
}

const fine = matchMedia('(pointer: fine)').matches;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Decoration, and fenced off as such. The series below is the page; the lamp and
// the tilt are polish. A single bad line in here once took the whole module down
// on every touch device — the card never rendered at all — so a throw in the
// polish now costs the polish and nothing else.
try {
if (!still) {
  raf = requestAnimationFrame(loop);
  if (fine) {
    // aim() still runs while engraved — it feeds the rake — but light() is
    // fenced off inside the loop, so no foil is written.
    window.addEventListener('pointermove', aim, { passive: true });
    window.addEventListener('pointerleave', () => { target = { x: .5, y: .35 }; });
  } else {
    // A phone has a better pointer than a pointer: the device itself. There is no
    // on-screen note about it any more — the copy went when the page was cut back
    // to four strings, and the line that wrote into it took the whole module down
    // with a TypeError on every touch device, leaving one blank white card.
    const onTilt = (ev) => {
      const g = ev.gamma ?? 0, b = ev.beta ?? 0;
      target.x = Math.max(0, Math.min(1, 0.5 + g / 46));
      target.y = Math.max(0, Math.min(1, 0.5 + (b - 42) / 52));
      // On a phone this IS the gesture: tilting the card to the light, which
      // is how an emboss has been read since before there were phones.
      if (engraved) aimLamp(lampAngle(target.x, target.y));
      if (!live) { live = true; card.classList.add('is-live'); }
    };
    if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
      // iOS asks first. Do it on the same gesture that turns the card.
      card.addEventListener('click', async function once() {
        try { if (await DeviceOrientationEvent.requestPermission() === 'granted')
          window.addEventListener('deviceorientation', onTilt); } catch (_) {}
        card.removeEventListener('click', once);
      }, { once: true });
    } else {
      window.addEventListener('deviceorientation', onTilt);
    }
  }
}
} catch (err) { console.warn('card: lighting off —', err); }

/* ── turning it over ─────────────────────────────────────────────────────── */
const flip = () => card.classList.toggle('is-flipped');
// A swipe that changed the card must not also turn it over.
card.addEventListener('click', (e) => { if (!card.dataset.swiped && gestureMoved < 8) flip(); });
card.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
});
document.getElementById('turn').addEventListener('click', (e) => { e.stopPropagation(); flip(); });

/* ── the engraved set ────────────────────────────────────────────────────────
   Five cards whose only difference is the paper. It is opt-in, it is off by
   default, and it changes nothing about what the card SAYS — every card still
   prints its own name, because the stock it is on is a joke and not a label.

   The printed card is not reachable from here: this passes a second skin to
   the same renderer, and tests/cardRender pins the bytes the default one
   emits.                                                                     */
const KEY = 'kaayko.card.skin';
const skinBtn = document.getElementById('skin');
const stockEl = document.getElementById('stock');
const hintEl = document.getElementById('touchhint');
let engraved = false;

// localStorage throws outright in Safari's private mode, so every touch of it
// is fenced. A preference we cannot read is simply a preference that is off.
const remember = (v) => { try { localStorage.setItem(KEY, v ? 'engraved' : 'print'); } catch (_) {} };
const remembered = () => { try { return localStorage.getItem(KEY) === 'engraved'; } catch (_) { return false; } };

function setSkin(on, { save = true } = {}) {
  engraved = !!on;
  document.documentElement.dataset.skin = engraved ? 'engraved' : '';
  if (!engraved) document.documentElement.removeAttribute('data-skin');
  skinBtn.setAttribute('aria-pressed', String(engraved));
  skinBtn.textContent = engraved ? 'In colour' : 'American Psycho';
  // Foil belongs to the loud card. Stop the lamp before the skin lands, or the
  // first engraved frame arrives still wearing a gold highlight.
  if (engraved) lampOff(); else lampOn();
  if (save) remember(engraved);
  if (!engraved) { unread(); stopRaking(); }
  if (series.length) { paintMarks(); show(at); }
  showHint();
}

skinBtn.addEventListener('click', (e) => { e.stopPropagation(); setSkin(!engraved); });

/* Whether a phone will actually buzz is not knowable from here.
   navigator.vibrate is absent in every browser on iOS — Safari has never
   shipped the Vibration API and every other iOS browser is Safari underneath —
   and a privacy browser on Android may keep the function and quietly do
   nothing with it, which is indistinguishable from a broken feature.

   So the hint is a control. One tap asks for a long unmistakable buzz, and
   what happens next is the answer: felt it, and the ticks will work; nothing,
   and it is the browser rather than the card. Saying that out loud is better
   than an interface that silently promises something it cannot deliver. */
function showHint() {
  if (!engraved) { hintEl.hidden = true; return; }
  if (!touchy) { hintEl.hidden = false; hintEl.textContent = 'Move across the card to catch the light'; return; }
  hintEl.hidden = false;
  hintEl.textContent = canVibrate()
    ? 'Tilt to catch the light \u00b7 tap to buzz'
    : 'Tilt to catch the light';
}

hintEl.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!canVibrate()) {
    hintEl.textContent = 'No vibration on iOS, in any browser \u00b7 the trace is shown instead';
    return;
  }
  navigator.vibrate([70, 60, 70]);
  hintEl.textContent = 'Felt nothing? Your browser is blocking it \u00b7 try Chrome';
  setTimeout(showHint, 5200);
});

/* ── the series ──────────────────────────────────────────────────────────────
   Eight cards, one chassis. Only the face and the four facts change, which is the
   whole idea, so the switcher only swaps two images and one line of type.        */
// Card names and lines come from a JSON file, so they are escaped (kit.esc) before they
// reach innerHTML. The API base is the one every page uses.
const API = apiBase();

// Only used when the API cannot be reached at all.
const FALLBACK_BRAND = {
  label: 'KAAYKO',
  tagline: 'BUILDS THINGS, AND PUBLISHES THE FAILURES NEXT TO THE RESULTS',
  properties: 'Kaayko \u00b7 Paddling Out \u00b7 Forge \u00b7 Kortex \u00b7 Alumni',
  contact: 'kaayko.com \u00b7 hello@kaayko.com'
};

const marks = document.getElementById('marks');
const nowEl = document.getElementById('now');
const frontEl = document.getElementById('face-front');
const backEl = document.getElementById('face-back');
let series = [], brand = {}, at = 0;

/* The card is drawn here, not fetched as a finished picture. It used to be five
   pre-rendered SVG files with the words baked in, which meant a typo needed a
   laptop and a script. Now the copy comes from the API, the art is a plain PNG,
   and the QR is generated from whatever URL the card currently carries — so a
   corrected link can never leave a stale QR behind.

   These are drawn INLINE rather than into an <img>: an SVG inside an <img> runs
   in secure static mode and refuses to load the external art file. */
function draw(el, svg, label) {
  el.innerHTML = svg;
  el.setAttribute('aria-label', label);
}

function qrFor(url) {
  try {
    const q = qrcode(0, 'M');       // smallest version that fits, medium recovery
    q.addData(url);
    q.make();
    return q;
  } catch (_) { return null; }
}

/**
 * The strip under the card.
 *
 * Five bars, no numbers — the card's own name is printed beneath it. Engraved,
 * each bar takes the colour of the stock that card is printed on, so the strip
 * becomes the one place the five papers are seen together and the chrome never
 * changes shape. It was briefly five little cards instead; that put a cut-off
 * horizontal rail under the hero on a phone and made the page look broken at
 * the exact moment it is trying to look expensive.
 */
function paintMarks() {
  marks.innerHTML = series.map((c, i) => {
    const st = stockOf(c);
    // The stock is in the label as well as the colour. Nothing here is carried
    // by a paper difference a reader may not be able to see.
    const label = engraved ? `${c.name} — ${st.name}, ${st.note}` : c.name;
    const tint = engraved ? ` style="--stock:${st.hex}"` : '';
    return `<button type="button" class="mark" role="radio" aria-checked="false" tabindex="-1"
       data-i="${i}" title="${esc(label)}" aria-label="${esc(label)}"${tint}></button>`;
  }).join('');
}

/* ── reading a blind emboss ──────────────────────────────────────────────────
   There is no ink on the animal and barely any on the letters. The only way
   anyone has ever read an emboss is to tilt it until the light rakes across
   and the relief throws a shadow, so that is the interaction: the lamp inside
   the SVG filters moves, and the shadows swing with it.

   It is driven by whatever the device has. A pointer over the card moves it
   directly. A phone moves it by its own attitude, which is the real gesture —
   you are tilting the card. And when nobody is doing either it drifts slowly
   on its own, because a card that is only legible once you have discovered a
   gesture is a card most people will never read.

   This replaces the haptics as the primary answer rather than joining it.
   Haptics were never going to arrive on an iPhone, and a visual that works
   everywhere beats a tick that works in one browser on one platform.         */
let lamps = [], rakeDeg = 228, rakeTarget = 228, idle = 0, rakeRaf = 0;

function collectLamps() {
  lamps = [];
  for (const host of [frontEl, backEl]) {
    const svg = host.querySelector('svg');
    if (!svg) continue;
    // By element, not by a marker attribute: these SVGs arrive through
    // innerHTML, and the HTML parser drops data-* from filter primitives — an
    // afternoon of a feature that silently did nothing lives in that sentence.
    const art = svg.querySelector('feDistantLight');
    const drops = svg.querySelectorAll('feDropShadow');
    if (art || drops.length) lamps.push({ art, sh: drops[0] || null, so: drops[1] || null });
  }
}

/** Point every lamp on the card at one angle. */
function rake(deg) {
  const r = deg * Math.PI / 180;
  // SVG azimuth runs anticlockwise from east; the drop shadows are in ordinary
  // screen coordinates, so they get the opposite sign on y.
  const sx = -Math.cos(r), sy = Math.sin(r);
  for (const l of lamps) {
    if (l.art) l.art.setAttribute('azimuth', deg.toFixed(1));
    if (l.sh) { l.sh.setAttribute('dx', (sx * 2.6).toFixed(2)); l.sh.setAttribute('dy', (sy * 2.6).toFixed(2)); }
    if (l.so) { l.so.setAttribute('dx', (-sx * 1.7).toFixed(2)); l.so.setAttribute('dy', (-sy * 1.7).toFixed(2)); }
  }
}

function rakeLoop() {
  // Nobody has touched it for a moment: drift, so the relief is visible to
  // someone who just opened the page and is not doing anything.
  if (++idle > 90) rakeTarget = 228 + Math.sin(idle / 150) * 52;
  const d = rakeTarget - rakeDeg;
  if (Math.abs(d) > 0.15) { rakeDeg += d * 0.12; rake(rakeDeg); }
  rakeRaf = requestAnimationFrame(rakeLoop);
}

function aimLamp(deg) { rakeTarget = deg; idle = 0; }

function startRaking() {
  collectLamps();
  if (!lamps.length || rakeRaf) return;
  rakeRaf = requestAnimationFrame(rakeLoop);
}

function stopRaking() {
  if (rakeRaf) { cancelAnimationFrame(rakeRaf); rakeRaf = 0; }
  lamps = [];
}

/* The fingertip reader. Where a browser can vibrate it ticks per letter; where
   it cannot — which is every browser on iOS — the trace still draws. It is a
   bonus on top of the rake now, not the main way the card is read. */
let readers = [];
let gestureMoved = 0;
const touchy = matchMedia('(hover: none)').matches
  || matchMedia('(pointer: coarse)').matches
  || (navigator.maxTouchPoints || 0) > 0;

function unread() { readers.forEach((d) => d.detach()); readers = []; }

function attachReaders(c) {
  unread();
  if (!engraved || !touchy) return;
  const artHref = `/assets/cards/art/${c.art || c.slug}.png`;
  warmArt(artHref);
  for (const host of [frontEl, backEl]) {
    const svg = host.querySelector('svg');
    if (!svg) continue;
    const stylus = host.parentElement.querySelector('.stylus');
    const detach = readFace(svg, {
      artHref,
      haptics: true,
      onRead: (f, u) => {
        if (!stylus) return;
        if (!f || !u) { stylus.dataset.on = ''; return; }
        const r = svg.getBoundingClientRect();
        const hr = host.getBoundingClientRect();
        stylus.style.left = `${r.left - hr.left + (u.x / 1050) * r.width}px`;
        stylus.style.top = `${r.top - hr.top + (u.y / 600) * r.height}px`;
        stylus.dataset.on = f.kind;
        // A finger on the card is also a hand holding it up to the light.
        aimLamp(lampAngle(u.x / 1050, u.y / 600));
      },
    });
    readers.push({ detach });
  }
}

function show(i, { focus = false } = {}) {
  if (!series.length) return;
  at = (i + series.length) % series.length;
  const c = series[at];
  const artHref = `/assets/cards/art/${c.art || c.slug}.png`;
  // A skin per face: the filter ids inside it are document-wide, and both faces
  // live in the same document.
  const skinF = engraved ? engravedFor(c, PRINT, 'f') : PRINT;
  const skinB = engraved ? engravedFor(c, PRINT, 'b') : PRINT;
  draw(frontEl, front(c, { qr: qrFor(c.url), artHref, skin: skinF }),
       `${c.name}, front of the card`);
  // The back gets the same art, ghosted behind its words.
  draw(backEl, back(c, brand, { index: at + 1, total: series.length, artHref, skin: skinB }),
       `${c.name}, back of the card`);
  // The stock is named in text, so the one thing separating two cards is never
  // carried by a colour difference a reader may not be able to see.
  stockEl.textContent = engraved ? `${stockOf(c).name} \u00b7 ${stockOf(c).note}` : '';
  nowEl.innerHTML = `<b>${esc(c.name)}</b>` +
    `<i><a class="to-product" href="${esc(c.url)}">${esc(c.url.replace('https://', ''))}</a></i>`;
  [...marks.children].forEach((b, j) => {
    b.setAttribute('aria-checked', String(j === at));
    b.tabIndex = j === at ? 0 : -1;
    if (focus && j === at) b.focus();
  });
  card.classList.remove('is-flipped');            // a new card arrives face up
  attachReaders(c);
  if (engraved) { stopRaking(); startRaking(); } else stopRaking();
}

(async () => {
  try {
    // Live copy first. The static index is the fallback, so the cards still
    // render if the API is unreachable — with whatever words it was last built
    // with, which is better than a blank card.
    const r = await fetch(`${API}/cards`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    const idx = await r.json();
    series = idx.cards || [];
    brand = idx.brand || {};
  } catch (_) {
    try {
      const r = await fetch('/assets/cards/index.json', { cache: 'no-cache' });
      const idx = await r.json();
      series = (idx.cards || []).map((c) => ({ ...c, art: c.slug }));
      brand = FALLBACK_BRAND;
    } catch (__) { series = []; }
  }
  if (!series.length) return;

  paintMarks();
  marks.addEventListener('click', (e) => {
    const b = e.target.closest('.mark');
    if (b) show(Number(b.dataset.i));
  });
  marks.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); show(at + step, { focus: true }); }
    else if (e.key === 'Home') { e.preventDefault(); show(0, { focus: true }); }
    else if (e.key === 'End') { e.preventDefault(); show(series.length - 1, { focus: true }); }
  });
  // The card itself steps on a horizontal swipe, so a phone needs no buttons.
  // Once the card can be read with a finger, distance alone stops being enough
  // to tell what a drag meant: reading the animal is a long slow travel and
  // would otherwise deal the next card every time. A flick is fast; a read is
  // not. The gate only applies to the engraved set, so the colour card keeps
  // exactly the swipe it always had.
  let x0 = null, y0 = 0, t0 = 0;
  card.addEventListener('pointerdown', (e) => {
    x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); gestureMoved = 0;
  });
  card.addEventListener('pointermove', (e) => {
    if (x0 === null) return;
    gestureMoved = Math.max(gestureMoved, Math.hypot(e.clientX - x0, e.clientY - y0));
  }, { passive: true });
  card.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dt = performance.now() - t0; x0 = null;
    if (Math.abs(dx) > 46 && (!engraved || dt < 420)) {
      card.dataset.swiped = '1';
      show(at + (dx < 0 ? 1 : -1));
      setTimeout(() => { delete card.dataset.swiped; }, 0);
    }
  });
  show(0);
  if (remembered()) setSkin(true, { save: false });
})();
