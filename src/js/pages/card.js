/**
 * pages/card.js — the collectible card (/card): lighting model, flip, inspect, QR.
 * Moved out of card.html on 12 Sep 2026 unchanged.
 */
import { front, back, PRINT, BACK, ART_EXTENT } from '/js/cards/render.js?v=639e44c';
import { engravedFor, stockOf } from '/js/cards/skins/engraved.js?v=639e44c';
import { readFace, warmArt } from '/js/cards/relief.js?v=639e44c';
import { rest, step, lampFor, wrap180, clamp } from '/js/cards/attitude.js?v=639e44c';
import { esc, apiBase } from '/js/kit.js?v=639e44c';

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
  s.setProperty('--spec', (0.28 + spec * 0.85).toFixed(3));
  s.setProperty('--fres', Math.min(1, fres * 5).toFixed(3));
  s.setProperty('--hue', ((px - 0.5) * 46).toFixed(1) + 'deg');
  s.setProperty('--sx', sx.toFixed(1) + '%');
  s.setProperty('--sy', sy.toFixed(1) + '%');
  room.style.setProperty('--sx', (px * 100).toFixed(1) + '%');
  room.style.setProperty('--sy', (py * 100).toFixed(1) + '%');
}

/** Where the lamp should sit for a pointer at (px, py) over the card. */
const lampAngle = (px, py) => 180 + Math.atan2(0.5 - py, px - 0.5) * 180 / Math.PI;

/* ── how the card hangs ──────────────────────────────────────────────────────
   The arithmetic is in cards/attitude.js, where it can be tested: a
   critically damped spring solved rather than integrated. This file only
   feeds it — from the pointer, or from a finger holding the card — and
   writes the result.                                                          */
const MAX_TILT = 17;       // degrees at full deflection
const att = rest();
let lastT = 0;

function loop(t) {
  // Real elapsed time, so the spring behaves the same on a 120Hz phone as on a
  // 60Hz laptop. Clamped, because a backgrounded tab returns a huge first step.
  const dt = lastT ? Math.min(0.25, (t - lastT) / 1000) : 1 / 60;
  lastT = t;
  cur.x += (target.x - cur.x) * 0.14;
  cur.y += (target.y - cur.y) * 0.14;
  // light() always runs now. What it writes is the same either way; which of
  // those layers is visible is the stylesheet's business, and the engraved skin
  // hides the foil and neutralises the sheen. Gating the whole function was how
  // the card lost its attitude and stopped tilting at all — the attitude was
  // computed in here.
  light(cur.x, cur.y);
  if (grab.on) {
    // While held, the card is exactly where the finger put it. No spring: a
    // spring under a hand is what makes an object feel like it is on a string.
    att.rx = att.tx; att.ry = att.ty;
  } else {
    step(att, dt, { smoothTime: inspecting ? INSPECT_SETTLE : 0.12 });
    if (inspecting) settleInspect();
  }
  if (inspecting) {
    // The lamp is fixed in the room, so the reflection travels as the card
    // turns under it. Lit from the angle RELATIVE TO THE FACE THAT IS UP:
    // at 180° the back is square to the viewer exactly as the front is at 0°,
    // so the lamp must agree at both — otherwise the fold from 180 to 0 that
    // ends a turn swept a highlight across a card that had already stopped.
    const a = wrap180(att.ry);
    const rel = Math.abs(a) > 90 ? a - Math.sign(a) * 180 : a;
    target.x = 0.5 - rel / (INSPECT_MAX_RX * 2.4);
    target.y = 0.5 + att.rx / (INSPECT_MAX_RX * 2.4);
    if (engraved) aimLamp(lampFor(rel));
  }
  card.style.setProperty('--rx', att.rx.toFixed(2) + 'deg');
  card.style.setProperty('--ry', att.ry.toFixed(2) + 'deg');
  raf = requestAnimationFrame(loop);
}

/* ── inspect ─────────────────────────────────────────────────────────────────
   The weapon rack at the gun shop: hold the button and the thing comes off
   the table into your hands; drag and it turns; let go and it keeps turning
   with what you gave it, then settles. Spun past halfway, it settles on the
   other face.

   Three ideas make it feel like an object rather than a slider:
     1. Held, it is a rigid body under the finger: no smoothing at all.
     2. Released, the finger's last angular velocity is handed to the spring's
        own velocity state, so it coasts on its momentum and the same critically
        damped solve that lands the tilt lands this — no overshoot, no bounce.
     3. It settles on the nearest FACE, not the nearest angle: a flick that would
        coast past 90° is asked where it would have ended up, and that is
        snapped to 0° or 180° before the spring is told.                       */
const INSPECT_MAX_RX = 48;     // degrees of pitch before it stops following
const INSPECT_SETTLE = 0.46;   // seconds — long enough to feel the coast
const INSPECT_GAIN = 0.42;     // degrees per pixel of drag
const inspectBtn = document.getElementById('inspect');
const cardWrap = card.parentElement;
let inspecting = false;
const grab = { on: false, id: null, x: 0, y: 0, t: 0, wx: 0, wy: 0 };   // w = angular velocity, deg/s

/** Whatever half-turn the card is on, make it the real state and start at 0. */
function foldTurn() {
  const half = Math.round(att.ry / 180);
  if (half % 2 !== 0) card.classList.toggle('is-flipped');
  att.ry -= half * 180; att.ty -= half * 180;
}

function setInspect(on) {
  inspecting = !!on;
  card.classList.toggle('is-inspecting', inspecting);
  cardWrap.classList.toggle('is-inspecting', inspecting);
  inspectBtn.setAttribute('aria-pressed', String(inspecting));
  inspectBtn.textContent = inspecting ? 'Put it down' : 'Inspect';
  if (!inspecting) {
    // Put down mid-coast, the card keeps the face it was heading for rather
    // than swinging 150° back to the one it left.
    grab.on = false; grab.id = null;
    foldTurn(); att.tx = 0; att.ty = 0;
  }
  if (!live) { live = true; card.classList.add('is-live'); }
}

function grabStart(e) {
  if (!inspecting) return;
  // One finger holds the card. A second touch used to re-seat the grab and
  // then both fed it, so the card thrashed between two hands.
  if (grab.on) return;
  grab.on = true; grab.id = e.pointerId; grab.x = e.clientX; grab.y = e.clientY; grab.t = performance.now();
  grab.wx = 0; grab.wy = 0;
  att.tx = att.rx; att.ty = att.ry;
  att.vx.v = 0; att.vy.v = 0;
  try { card.setPointerCapture(e.pointerId); } catch (_) {}
}

function grabMove(e) {
  if (!grab.on || e.pointerId !== grab.id) return;
  const now = performance.now();
  const dt = Math.max(1 / 240, (now - grab.t) / 1000);
  const dx = e.clientX - grab.x, dy = e.clientY - grab.y;
  grab.x = e.clientX; grab.y = e.clientY; grab.t = now;
  // Yaw is unbounded — you can turn it right round. Pitch stops before the
  // card becomes a line.
  att.ty += dx * INSPECT_GAIN;
  att.tx = clamp(att.tx - dy * INSPECT_GAIN, INSPECT_MAX_RX);
  // Angular velocity, smoothed: the last few pixels of a drag say more about
  // the throw than the last one.
  const a = 0.35;
  grab.wy = grab.wy * (1 - a) + (dx * INSPECT_GAIN / dt) * a;
  grab.wx = grab.wx * (1 - a) + (-dy * INSPECT_GAIN / dt) * a;
}

function grabEnd(e) {
  if (!grab.on || (e.pointerId != null && e.pointerId !== grab.id)) return;
  grab.on = false; grab.id = null;
  try { card.releasePointerCapture(e.pointerId); } catch (_) {}
  // Hand the throw to the spring, then ask where it would coast to and land
  // on the face nearest THAT — so a flick spins it over and a nudge does not.
  att.vy.v = grab.wy; att.vx.v = grab.wx;
  const coastY = att.ry + grab.wy * INSPECT_SETTLE * 0.75;
  att.ty = Math.round(coastY / 180) * 180;
  att.tx = 0;
}

/** Once it has come to rest on its other face, make that the real state. */
function settleInspect() {
  if (grab.on || Math.abs(att.vy.v) > 2 || Math.abs(att.ry - att.ty) > 0.4) return;
  if (Math.round(att.ty / 180) === 0) return;
  // ry of 180 (or −180, or 540) IS the back. Fold it into the flip state so
  // the card and the accessibility tree agree on which face is up, and start
  // the next turn from zero.
  foldTurn(); att.ry = 0; att.ty = 0; att.vy.v = 0;
}

if (inspectBtn) {
  inspectBtn.addEventListener('click', (e) => { e.stopPropagation(); setInspect(!inspecting); });
  card.addEventListener('pointerdown', grabStart);
  card.addEventListener('pointermove', grabMove);
  card.addEventListener('pointerup', grabEnd);
  card.addEventListener('pointercancel', grabEnd);
  card.addEventListener('lostpointercapture', grabEnd);
}

function aim(e) {
  if (inspecting) return;
  const r = card.getBoundingClientRect();
  target.x = Math.max(-0.2, Math.min(1.2, (e.clientX - r.left) / r.width));
  target.y = Math.max(-0.6, Math.min(1.6, (e.clientY - r.top) / r.height));
  att.tx = (0.5 - target.y) * 2 * TILT;
  att.ty = (target.x - 0.5) * 2 * TILT;
  if (engraved) aimLamp(lampAngle(target.x, target.y));
  if (!live) { live = true; card.classList.add('is-live'); }
}

/* ── the handset's tilt is gone ──────────────────────────────────────────
   It rotated the card to the phone on its own, which was never quite in
   anyone's hands: the permission prompt landed on the first tap of whatever
   you were tapping, iOS asked twice, and a card that moved while you were
   trying to read it read as broken more often than as alive. Inspect, below,
   is the same physics under a finger that asked for it.                    */

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
    // aim() feeds both the lamp and, while engraved, the rake.
    window.addEventListener('pointermove', aim, { passive: true });
    window.addEventListener('pointerleave', () => { target = { x: .5, y: .35 }; });
  }
}
} catch (err) { console.warn('card: lighting off —', err); }

/* ── turning it over ─────────────────────────────────────────────────────── */
const flip = () => card.classList.toggle('is-flipped');
// A swipe that changed the card must not also turn it over, and neither must
// letting go of a card you were inspecting.
card.addEventListener('click', (e) => { if (!inspecting && !card.dataset.swiped && gestureMoved < 8) flip(); });
card.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
});

/* ── the engraved set ────────────────────────────────────────────────────────
   Five cards whose only difference is the paper. It is opt-in, it is off by
   default, and it changes nothing about what the card SAYS — every card still
   prints its own name, because the stock it is on is a joke and not a label.

   The printed card is not reachable from here: this passes a second skin to
   the same renderer, and tests/cardRender pins the bytes the default one
   emits.                                                                     */
const KEY = 'kaayko.card.skin';
const skinBtn = document.getElementById('skin');
const skinIcon = document.getElementById('skin-icon');
const stockEl = document.getElementById('stock');
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
  // The control is the picture. A skull is the set in colour; press it and the
  // set goes engraved, and the rose is how you know.
  skinBtn.setAttribute('aria-label', engraved ? 'Back to colour' : 'American Psycho');
  skinIcon.src = engraved ? '/assets/card/rose.webp' : '/assets/card/skull.webp';
  if (save) remember(engraved);
  if (!engraved) { unread(); stopRaking(); }
  // show() lands a NEW card face up. This is the same card in a different
  // stock, so whichever face was up stays up — pressing the rose while
  // reading a back must not turn the card over.
  const wasFlipped = card.classList.contains('is-flipped');
  if (series.length) { paintMarks(); show(at); if (wasFlipped) card.classList.add('is-flipped'); }
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
  properties: 'Kaayko \u00b7 Paddling Out \u00b7 Forge \u00b7 Kortex \u00b7 School',
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
   directly. On a phone, Inspect puts the card in the hand and the lamp
   follows the turn. There is no idle drift: a card that moves on its own
   reads as broken more often than as alive.

   This replaces the haptics as the primary answer rather than joining it.
   Haptics were never going to arrive on an iPhone, and a visual that works
   everywhere beats a tick that works in one browser on one platform.         */
let lamps = [], rakeDeg = 228, rakeTarget = 228, rakeRaf = 0;

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
  // No idle animation. The lamp moves when the card moves and at no other
  // time — a card that sways on its own while sitting on a desk is a screensaver.
  const d = rakeTarget - rakeDeg;
  if (Math.abs(d) > 0.15) { rakeDeg += d * 0.12; rake(rakeDeg); }
  rakeRaf = requestAnimationFrame(rakeLoop);
}

function aimLamp(deg) { rakeTarget = deg; }

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
  // Where the animal is on each face. The front's column covers from the
  // origin; the back's picture is boxed on the right and fitted inside.
  const FRONT_ART = { x: 0, y: 0, w: 401, h: 600, fit: 'slice' };
  const BACK_ART = { x: BACK.ghostX, y: BACK.ghostY, w: BACK.ghostW, h: BACK.ghostH, fit: 'meet',
                     crop: ART_EXTENT[c.art || c.slug] || null };
  warmArt(artHref, FRONT_ART); warmArt(artHref, BACK_ART);
  for (const host of [frontEl, backEl]) {
    const svg = host.querySelector('svg');
    if (!svg) continue;
    const stylus = host.parentElement.querySelector('.stylus');
    const detach = readFace(svg, {
      artHref,
      artBox: host === backEl ? BACK_ART : FRONT_ART,
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
  // The card prints its own name in 50pt caps directly above this; repeating it
  // here was the page reading itself out loud. Only the link is not on the card
  // already — because the one on the card is ink, and this one is a link.
  nowEl.innerHTML = `<i><a class="to-product" href="${esc(c.url)}">${esc(c.url.replace('https://', ''))}</a></i>`;
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
    if (!inspecting && Math.abs(dx) > 46 && (!engraved || dt < 420)) {
      card.dataset.swiped = '1';
      show(at + (dx < 0 ? 1 : -1));
      setTimeout(() => { delete card.dataset.swiped; }, 0);
    }
  });
  show(0);
  // Unconditionally, not only when a preference exists: the control's label
  // lives in two places otherwise, and the copy in the HTML is the one nobody
  // remembers to change. It read "Bone" on every cold load for three deploys
  // after the module had stopped saying it.
  setSkin(remembered(), { save: false });
})();
