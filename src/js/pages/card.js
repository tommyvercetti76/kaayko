/**
 * pages/card.js — the collectible card (/card): lighting model, flip, inspect, QR.
 * Moved out of card.html on 12 Sep 2026 unchanged.
 */
import { front, back, PRINT, BACK, ART_EXTENT, ART_COLUMN } from '/js/cards/render.js?v=53a507e';
import { engravedFor, stockOf, embossParams, reliefType, DIRS } from '/js/cards/skins/engraved.js?v=53a507e';
import { embossOf, stillCanvas } from '/js/cards/emboss.js?v=53a507e';
import { readFace, warmArt } from '/js/cards/relief.js?v=53a507e';
import { rest, step, clamp } from '/js/cards/attitude.js?v=53a507e';
import { lightFace, pointerLamp, v } from '/js/cards/lamp.js?v=53a507e';
import { dustMorph } from '/js/cards/morph.js?v=53a507e';
import { esc, apiBase } from '/js/kit.js?v=53a507e';

/* ── the light ─────────────────────────────────────────────────────────────
   One lamp. Everything the eye reads as light on this card — the glint, its
   shape, the wash round it, how dark the sheet goes as it turns away, the
   rim at a grazing angle, which way the emboss throws its shadow, the glow
   on the wall behind — is one function of that lamp and the card's true
   attitude, solved in cards/lamp.js and checked there against a brute-force
   render. It used to be three unrelated formulas that happened to move at
   the same time, and it read that way.

   On a desk the lamp is the pointer, a little above the sheet; the card leans
   to face it. In the hand the lamp is fixed in the room, above and to the
   left, and the card turns under it.

   What this writes is a dozen CSS custom properties, and every one of them
   lands in a transform or an opacity. The face is never repainted by light.  */

const card = document.getElementById('card');
const room = document.getElementById('room');
const cardWrap = card.parentElement;
const TILT = 11;                            // degrees the card leans toward the pointer
// Card widths from the centre; y is down, z toward you. Near, and only a
// little above the sheet's middle, on purpose: a desk lamp is five card
// widths off and its glint crosses a turned card in a flash, which is true
// and unwatchable. This close, a turn of thirty degrees walks the glint
// from one edge to the other, and it sits on the sheet at rest.
const ROOM_LAMP = v(-0.42, -0.14, 0.9);
const PERSPECTIVE = parseFloat(getComputedStyle(cardWrap).perspective) || 1400;
const lampEl = document.getElementById('lamp');

let eye = v(0, 0, PERSPECTIVE / 600), cardW = 600, cardBox = null, roomBox = null;
/** Where the eye is, in card widths: the CSS perspective over the card's real width. */
function measure() {
  cardBox = cardWrap.getBoundingClientRect();
  roomBox = room.getBoundingClientRect();
  cardW = cardBox.width || 600;
  eye = v(0, 0, PERSPECTIVE / cardW);
}
measure();
window.addEventListener('resize', measure);

let raf = 0, target = { x: .5, y: .35 }, cur = { x: .5, y: .35 }, live = false;

/* ── how the light is written ──────────────────────────────────────────────
   Straight onto each layer's own style, and NEVER as a custom property on
   the card. For a phone this is the most important decision in the file.
   WebKit inherits a custom property through the whole subtree, and every
   filtered SVG element under the card answers the change with a repaint —
   measured on the iOS Simulator with the same turn: 283ms a frame with the
   light written as properties on the card, 17ms written like this. Chrome
   never showed it, which is how it shipped. The custom properties left in
   the stylesheet are resting defaults for a page that never runs the loop.

   Two more WebKit facts, measured the same way and encoded below: a layer
   whose opacity reaches zero is dropped and re-rendered when it comes back,
   so the relief never goes below RELIEF_FLOOR; and a change of scale on the
   card re-rasters every layer under it, so the card is never scaled.       */
const write = (el, prop, val) => { if (el && el.style[prop] !== val) el.style[prop] = val; };
const SIG = 14;               // the sheen gradient's own sigma is a fourteenth of the card, see .sheen
const RELIEF_FLOOR = 0.02;
let quiet = false;            // the probe rig, isolating the light
let reliefParts = 'all';      // the probe rig, weighing the relief: 'all' | 'art' | 'flat'

/** The layers of one face, found once. `stills` is filled by layStills. */
function faceLayers(host) {
  const face = host.parentElement;
  const q = (sel) => face.querySelector(sel);
  return { host, face, sheen: q('.sheen'), wash: q('.wash'), shade: q('.shade'), foil: q('.foil'), rim: q('.rim-lit'), relief: q('.relief'), stills: {} };
}
let faces = null;
const layersOf = () => (faces ??= [faceLayers(frontEl), faceLayers(backEl)]);

/** Light the card at this attitude, and the room behind it. */
function lit(rx, ry) {
  if (quiet) return;
  const lamp = (fine && !inspecting) ? pointerLamp(cur.x, cur.y) : ROOM_LAMP;
  const o = lightFace({
    rx, ry, lamp, eye,
    // Paper: a soft glint in a broad wash. Foil: a tighter, harder one.
    shine: engraved ? 46 : 90, soft: engraved ? 9 : 14, f0: 0.045, gain: engraved ? 30 : 24,
  });
  const px = (n) => (n * cardW).toFixed(1) + 'px';
  // The glint's ellipse. The gradient's own sigma is a fourteenth of the
  // card's width, so a scale of 14σ is the model's sigma exactly.
  const at = `translate(${px(o.gx)}, calc(${px(o.gy)} - 50%))`;
  const glint = `${at} rotate(${o.angle.toFixed(1)}deg) scale(${(o.s1 * SIG).toFixed(3)}, ${(o.s2 * SIG).toFixed(3)})`;
  const wash = `${at} rotate(${o.wangle.toFixed(1)}deg) scale(${(o.w1 * SIG).toFixed(3)}, ${(o.w2 * SIG).toFixed(3)})`;
  // Exposure is set for the glint, not the paper: a floor of shade on the
  // whole sheet, so the lamp's reflection — which cannot be brighter than
  // white on a screen — still stands off the stock around it.
  const spec = (o.peak * (engraved ? 0.92 : 0.62)).toFixed(3);
  const washO = (o.peak * (engraved ? 0.38 : 0.22)).toFixed(3);
  const shade = (engraved ? 0.10 + o.shade * 0.62 : 0.07 + o.shade * 0.60).toFixed(3);
  const rim = Math.min(1, o.fres * 5).toFixed(3);
  const foil = `rotate(${(o.L.x * 46).toFixed(1)}deg)`, foilO = (o.peak * 0.5).toFixed(3);
  // The relief: how much of each still shows is how far the lamp is on that side.
  const still = (wt) => Math.max(RELIEF_FLOOR, Math.min(1, wt * 1.7)).toFixed(3);
  const stills = { xp: still(o.weights.xp), xn: still(o.weights.xn), yp: still(o.weights.yp), yn: still(o.weights.yn) };
  for (const f of layersOf()) {
    write(f.sheen, 'transform', glint); write(f.sheen, 'opacity', spec);
    write(f.wash, 'transform', wash); write(f.wash, 'opacity', washO);
    write(f.shade, 'opacity', shade);
    write(f.foil, 'transform', foil); write(f.foil, 'opacity', foilO);
    write(f.rim, 'opacity', rim);
    for (const dir in f.stills) for (const st of f.stills[dir]) write(st.el, 'opacity', (stills[dir] * st.k).toFixed(3));
  }
  // The glow on the wall: the lamp itself, seen from the eye, on the desk's plane.
  if (cardBox && roomBox && lampEl) {
    const k = eye.z / Math.max(0.2, eye.z - lamp.z);
    const lx = cardBox.left + cardBox.width / 2 + lamp.x * cardW * k - (roomBox.left + roomBox.width / 2);
    const ly = cardBox.top + cardBox.height / 2 + lamp.y * cardW * k - (roomBox.top + roomBox.height / 2);
    write(lampEl, 'transform', `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`);
  }
}

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
  if (grab.on) {
    // While held, the card is exactly where the finger put it. No spring: a
    // spring under a hand is what makes an object feel like it is on a string.
    att.rx = att.tx; att.ry = att.ty;
  } else {
    step(att, dt, { smoothTime: inspecting ? INSPECT_SETTLE : 0.12 });
    if (inspecting) settleInspect();
  }
  // Lit from the true attitude, every frame, in both skins, whether it is
  // leaning to a pointer or turning in a hand. The model works in the frame
  // of whichever face is up: at 180° the back is square to the viewer exactly
  // as the front is at 0°, and a full turn ends where it began.
  lit(att.rx, att.ry);
  write(card, 'transform', `rotateX(${att.rx.toFixed(2)}deg) rotateY(${att.ry.toFixed(2)}deg)`);
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
  // A held card is being turned, not read: the fingertip readers — a glyph
  // scan and a vibration per feature on every pointermove — come off while
  // it is in the hand and go back on when it is put down.
  if (inspecting) unread();
  else if (engraved && series.length) attachReaders(series[at]);
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
  // The card leans to face the lamp over it, as a sheet on a desk does.
  att.tx = (0.5 - target.y) * 2 * TILT;
  att.ty = (target.x - 0.5) * 2 * TILT;
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
const skinStage = document.getElementById('skin-stage');
const stockEl = document.getElementById('stock');
let engraved = false;

// The skull comes apart into gold dust and settles as the rose. Built on the
// first press, from the two drawings already on the page.
let morph = null;
function morphNow(dir) {
  if (still) return;
  try {
    morph ??= dustMorph({
      stage: skinStage,
      canvas: document.getElementById('mode-dust'),
      from: document.getElementById('mode-skull'),
      to: document.getElementById('mode-rose'),
      duration: MORPH_MS,
    });
    morph.play(dir);
  } catch (err) { console.warn('card: morph off —', err); }
}

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
  // The skull becomes the rose as dust. Only when a person presses it: on
  // load the icon is simply in its state.
  skinBtn.dataset.mode = engraved ? 'rose' : 'skull';
  if (save) remember(engraved);
  if (!engraved) unread();
  // show() lands a NEW card face up. This is the same card in a different
  // stock, so whichever face was up stays up — pressing the rose while
  // reading a back must not turn the card over.
  const wasFlipped = card.classList.contains('is-flipped');
  // Order matters on a phone. The card changes stock at once (cheap: the
  // base faces carry one small filter), the dust flies over the changed
  // card from the NEXT frame — so its first frame is not the one that paid
  // for the new faces — and the relief, which is the expensive raster,
  // rises into the paper only after the dust has settled.
  const timed = save && !still;
  if (series.length) { paintMarks(); show(at, { relief: timed ? 'after-morph' : 'soon', fade: timed ? MORPH_MS : 0 }); if (wasFlipped) card.classList.add('is-flipped'); }
  if (save) requestAnimationFrame(() => morphNow(engraved ? 'to' : 'back'));
}

skinBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (morph && morph.busy()) return;       // let the dust land
  setSkin(!engraved);
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
/* How long the skull takes to become the rose, and so how long the card
   takes to change stock under it: the two are one gesture and run on one
   clock. The stylesheet's 1.15s transitions on the page's colours are this
   number too. */
const MORPH_MS = 1150;

function draw(el, svg, label, fade = 0) {
  el.setAttribute('aria-label', label);
  const old = el.querySelector('svg');
  if (!fade || !old) { el.innerHTML = svg; return; }
  // A crossfade, timed to the dust: the new face comes in over the old one
  // on its own compositing layer, and the old one goes once it is under.
  el.insertAdjacentHTML('beforeend', svg);
  const nu = el.lastElementChild;
  nu.classList.add('incoming');
  nu.style.opacity = '0';
  nu.style.transition = `opacity ${fade}ms ease`;
  requestAnimationFrame(() => requestAnimationFrame(() => { nu.style.opacity = '1'; }));
  setTimeout(() => {
    if (nu.parentElement !== el) return;              // the page moved on
    for (const n of [...el.children]) if (n !== nu) n.remove();
    nu.classList.remove('incoming'); nu.style.transition = ''; nu.style.opacity = '';
  }, fade + 40);
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

/* ── the relief ─────────────────────────────────────────────────────────────
   There is no ink on the animal and barely any on the letters. The only way
   anyone has ever read an emboss is to tilt it until the light rakes across
   and the relief throws a shadow — so the relief has to move with the lamp.

   It used to move by rewriting the lamp inside the SVG filters, which re-ran
   a blur and a specular pass over the face for every write, and that was the
   stutter in the engraved set: the turn was waiting on the raster. Now each
   face carries four STILLS of its relief — lit from the right, the left,
   below, above — and the lamp only sets their opacities, which the
   compositor changes for nothing. cards/skins/engraved.js has the maths;
   this only lays them over the face.                                        */
let reliefTimer = 0, reliefSeq = 0;

/**
 * Take the relief off both faces now, and lay it again in two phases: the
 * impression's tint at once — the base face has no animal of its own, so
 * this IS the animal — and the lit stills after `delayMs`: one frame later
 * for a card change, or once the dust has settled for a skin change. The
 * stills are the one moment of work on this page, and it must never land
 * in a frame that is showing motion.
 */
function scheduleRelief(c, delayMs, fade = 0) {
  clearTimeout(reliefTimer);
  const seq = ++reliefSeq;
  for (const f of layersOf()) {
    f.stills = {};
    // On a timed switch the old relief fades out on the same clock as the
    // face under it, and the new impression fades in on it. Otherwise the
    // change is a cut, as a new card is.
    f.relief.style.transitionDuration = fade ? `${fade}ms` : '';
    f.relief.classList.remove('is-set');
    // What fades out is the impression alone. The lit stills go at once:
    // eight of them carry filters, and a group fading over filtered layers
    // is a frame of work on WebKit — measured at 100ms a frame.
    if (fade) { const r = f.relief; r.querySelector('.stills')?.remove(); setTimeout(() => { if (seq === reliefSeq && !r.classList.contains('is-set')) r.innerHTML = ''; }, fade + 40); }
    else f.relief.innerHTML = '';
  }
  if (!engraved) return;
  const alive = () => engraved && seq === reliefSeq && series[at] === c;
  const params = embossParams(c);
  const emboss = embossOf(`/assets/cards/art/${c.art || c.slug}.png`, params);
  emboss.then((e) => {
    if (!alive()) return;
    for (const f of layersOf()) { f.relief.innerHTML = ''; layTint(f, c, e, params); }
    requestAnimationFrame(() => requestAnimationFrame(() => { if (alive()) for (const f of layersOf()) f.relief.classList.add('is-set'); }));
  }).catch((err) => console.warn('card: relief —', err));
  reliefTimer = setTimeout(() => {
    emboss.then((e) => {
      if (!alive()) return;
      for (const f of layersOf()) layStills(f, c, e, params);
      // Two frames: one for the insert to be laid out, one for the transition to
      // have something to start from. The raster lands in the first.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (alive()) for (const f of layersOf()) { const st = f.relief.querySelector('.stills'); if (st) st.classList.add('is-set'); }
      }));
    }).catch(() => {});
  }, delayMs);
}

/** The window round a set of SVG text elements, in the face's units, with room for a shadow. */
function typeWindow(texts, W = 1050, H = 600, margin = 14) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of texts) {
    try { const b = t.getBBox(); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height); } catch (_) {}
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: W, h: H };
  x0 = Math.max(0, x0 - margin); y0 = Math.max(0, y0 - margin);
  x1 = Math.min(W, x1 + margin); y1 = Math.min(H, y1 + margin);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Place a layer over its window of the face, and no larger: a layer is a texture, and a texture is memory. */
const placeStill = (el, win, W = 1050, H = 600) => {
  el.style.cssText = `inset:auto;left:${(win.x / W * 100).toFixed(2)}%;top:${(win.y / H * 100).toFixed(2)}%;width:${(win.w / W * 100).toFixed(2)}%;height:${(win.h / H * 100).toFixed(2)}%`;
};

/**
 * Where the art FILE sits on this face, in the face's units — the same
 * arithmetic render.js used to draw it: the front's column, which the file
 * fills exactly; or the back's box, into which the animal's measured extent
 * is fitted, so the file itself hangs past the box on every side.
 */
function artRect(face, c) {
  if (face !== 'b') return { x: ART_COLUMN.x, y: ART_COLUMN.y, w: ART_COLUMN.w, h: ART_COLUMN.h };
  const ex = ART_EXTENT[c.art || c.slug] || { x: 0, y: 0, w: 802, h: 1200 };
  const k = Math.min(BACK.ghostW / ex.w, BACK.ghostH / ex.h);
  return {
    x: BACK.ghostX + (BACK.ghostW - ex.w * k) / 2 - ex.x * k,
    y: BACK.ghostY + (BACK.ghostH - ex.h * k) / 2 - ex.y * k,
    w: 802 * k, h: 1200 * k,
  };
}

/** The window the animal's layers are cut to: its box, plus a margin for the relief, inside the sheet. */
function artWindow(face, W = 1050, H = 600) {
  const box = face === 'b' ? { x: BACK.ghostX, y: BACK.ghostY, w: BACK.ghostW, h: BACK.ghostH } : ART_COLUMN;
  const m = Math.ceil(Math.max(box.w, box.h) * 0.06) + 2;
  const x0 = Math.max(0, box.x - m), y0 = Math.max(0, box.y - m);
  const x1 = Math.min(W, box.x + box.w + m), y1 = Math.min(H, box.y + box.h + m);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** One canvas of the animal, in a layer cut to the window, placed where the file is. */
function artLayer(face, c, imageData, cls) {
  const win = artWindow(face), rect = artRect(face, c);
  const el = document.createElement('div');
  el.className = cls;
  placeStill(el, win);
  const cv = stillCanvas(imageData);
  cv.style.cssText = `position:absolute;left:${((rect.x - win.x) / win.w * 100).toFixed(2)}%;top:${((rect.y - win.y) / win.h * 100).toFixed(2)}%;width:${(rect.w / win.w * 100).toFixed(2)}%;height:${(rect.h / win.h * 100).toFixed(2)}%`;
  el.appendChild(cv);
  return el;
}

/** Phase one: the impression, at the watermark's strength on the back. */
function layTint(f, c, e, params) {
  const face = f.host === backEl ? 'b' : 'f';
  const el = artLayer(face, c, e.tint, 'art tint');
  el.style.opacity = face === 'b' ? String(params.ghost) : '1';
  f.relief.appendChild(el);
}

/** Phase two: the four lit stills of the animal, and of the type. */
function layStills(f, c, e, params) {
  const face = f.host === backEl ? 'b' : 'f';
  const ghost = face === 'b' ? params.ghost : 1;
  const wrap = document.createElement('div');
  wrap.className = 'stills';
  const type = reliefParts === 'art' ? null : reliefType(c, face);
  const svg = f.host.querySelector('svg');
  const texts = svg ? [...svg.querySelectorAll('text')] : [];
  const tw = type && texts.length ? typeWindow(texts) : null;
  const flat = reliefParts === 'flat' ? (html) => html.replace(/ filter="url\(#[^"]+\)"/g, '') : (html) => html;
  f.stills = {};
  for (const dir of Object.keys(DIRS)) {
    f.stills[dir] = [];
    const a = artLayer(face, c, e[dir], 'art');
    a.dataset.dir = dir;
    a.style.opacity = String(RELIEF_FLOOR);
    wrap.appendChild(a); f.stills[dir].push({ el: a, k: ghost });
    if (!tw) continue;
    // The lettering is the face's own <text>, cloned: it is never set twice,
    // so it cannot drift from what the card says.
    const t = document.createElement('div');
    t.dataset.dir = dir; t.className = 'type';
    t.innerHTML = flat(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tw.x} ${tw.y} ${tw.w} ${tw.h}" aria-hidden="true"><defs>${type[dir].defs}</defs><g filter="url(#${type[dir].id})"></g></svg>`);
    const g = t.querySelector('g');
    for (const el of texts) { const k = el.cloneNode(true); k.removeAttribute('filter'); g.appendChild(k); }
    placeStill(t, tw);
    t.style.opacity = String(RELIEF_FLOOR);
    wrap.appendChild(t); f.stills[dir].push({ el: t, k: 1 });
  }
  f.relief.appendChild(wrap);
}

/* The fingertip reader. Where a browser can vibrate it ticks per letter; where
   it cannot — which is every browser on iOS — the trace still draws. It is a
   bonus on top of the relief under the lamp, not the main way the card is read. */
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
      },
    });
    readers.push({ detach });
  }
}

function show(i, { focus = false, relief = 'soon', fade = 0 } = {}) {
  if (!series.length) return;
  at = (i + series.length) % series.length;
  const c = series[at];
  const artHref = `/assets/cards/art/${c.art || c.slug}.png`;
  // A skin per face: the filter ids inside it are document-wide, and both faces
  // live in the same document.
  const skinF = engraved ? engravedFor(c, PRINT, 'f') : PRINT;
  const skinB = engraved ? engravedFor(c, PRINT, 'b') : PRINT;
  draw(frontEl, front(c, { qr: qrFor(c.url), artHref, skin: skinF }),
       `${c.name}, front of the card`, fade);
  // The back gets the same art, ghosted behind its words.
  draw(backEl, back(c, brand, { index: at + 1, total: series.length, artHref, skin: skinB }),
       `${c.name}, back of the card`, fade);
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
  // 1400ms: the dust lands at 1150 and the rose has faded in by 1330. The
  // raster must fall in a still moment, and this is the first one.
  scheduleRelief(c, relief === 'after-morph' ? 1400 : 16, fade);
  // The readers measure the face's glyphs, so they wait for the face that
  // is arriving rather than reading the one on its way out.
  if (fade) setTimeout(() => { if (series[at] === c) attachReaders(c); }, fade + 60);
  else attachReaders(c);
  measure();                                      // the caption under the card can change height
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
  // A rig for measuring the page on a real engine, only when the URL asks
  // for it. Never fetched otherwise. See cards/probe.js.
  const probe = new URLSearchParams(location.search).get('probe');
  if (probe) import('/js/cards/probe.js?v=53a507e').then((m) => m.run({ label: probe, setSkin, setInspect, att, grab, quiet: (on) => { quiet = !!on; }, parts: (p) => { reliefParts = p; } })).catch((err) => console.warn('card: probe —', err));
})();
