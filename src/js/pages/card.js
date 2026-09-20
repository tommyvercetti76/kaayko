/**
 * pages/card.js — the collectible card (/card): lighting model, flip, share, QR.
 * Moved out of card.html on 12 Sep 2026 unchanged.
 */
import { front, back, PRINT } from '/js/cards/render.js';
import { engravedFor, stockOf } from '/js/cards/skins/engraved.js';
import { readFace, canVibrate, warmArt } from '/js/cards/relief.js';
import { esc, apiBase } from '/js/kit.js';

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

const LAMP_VARS = ['--rx', '--ry', '--spec', '--fres', '--hue', '--sx', '--sy'];

function lampOff() {
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
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
  if (lamp || still) return;
  lamp = true;
  raf = requestAnimationFrame(loop);
}

function loop() {
  cur.x += (target.x - cur.x) * 0.14;      // a little inertia; paper has mass
  cur.y += (target.y - cur.y) * 0.14;
  light(cur.x, cur.y);
  raf = requestAnimationFrame(loop);
}

function aim(e) {
  const r = card.getBoundingClientRect();
  target.x = Math.max(-0.2, Math.min(1.2, (e.clientX - r.left) / r.width));
  target.y = Math.max(-0.6, Math.min(1.6, (e.clientY - r.top) / r.height));
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
  if (!engraved) unread();
  if (series.length) { paintMarks(); show(at); }
  hintEl.textContent = engraved && touchy
    ? (canVibrate() ? 'Drag a finger across the card to feel it'
                    : 'Drag a finger across the card to read it')
    : '';
}

skinBtn.addEventListener('click', (e) => { e.stopPropagation(); setSkin(!engraved); });

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
 * In colour it is a slider: five bars, no numbers, because the card's own name
 * is already printed beneath it. Engraved it becomes the set — the five cards
 * themselves, laid side by side, because the joke is a comparison and a
 * comparison cannot happen one card at a time. It is still the same
 * radiogroup, so the arrow keys and the screen reader do not notice.
 *
 * The proofs carry no QR: at this size a code is unscannable noise, and the
 * only thing worth looking at across five cards is the paper.
 */
function paintMarks() {
  marks.innerHTML = series.map((c, i) => {
    const proof = engraved
      ? `<span class="proof">${front(c, { artHref: `/assets/cards/art/${c.art || c.slug}.png`, skin: { ...engravedFor(c, PRINT, `m${i}`), qrBox: false } })}</span>` +
        `<span class="stockname">${esc(stockOf(c).name)}</span>`
      : '';
    // The stock is in the label too. Someone who cannot see the paper still
    // hears what separates this card from the one beside it.
    const label = engraved ? `${c.name} — ${stockOf(c).name}, ${stockOf(c).note}` : c.name;
    return `<button type="button" class="mark" role="radio" aria-checked="false" tabindex="-1"
       data-i="${i}" title="${esc(label)}" aria-label="${esc(label)}">${proof}</button>`;
  }).join('');
}

/* ── reading the card with a finger ──────────────────────────────────────────
   Only on touch, only when the die has been cut. The readers are torn down and
   rebuilt on every card change because the map is measured from the drawing,
   and the drawing is replaced wholesale each time.                           */
let readers = [];
// How far this gesture travelled. A tap turns the card over; a drag across it
// is someone reading the relief, and turning the card over mid-read is the
// single most annoying thing the page could do.
let gestureMoved = 0;
// `hover: none` alone misses Android devices that report a coarse pointer and
// a hover capability, and those are exactly the devices that CAN vibrate.
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
        // The trace is what an iPhone gets instead of the haptics it cannot
        // have, so it has to be legible on its own and not merely a garnish.
        const r = svg.getBoundingClientRect();
        const hr = host.getBoundingClientRect();
        stylus.style.left = `${r.left - hr.left + (u.x / 1050) * r.width}px`;
        stylus.style.top = `${r.top - hr.top + (u.y / 600) * r.height}px`;
        stylus.dataset.on = f.kind;
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
