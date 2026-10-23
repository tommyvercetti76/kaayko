/**
 * pages/card.js — the collectible card (/card): lighting model, flip, inspect, QR.
 * Moved out of card.html on 12 Sep 2026 unchanged.
 */
import { front, back, frontArt, backArt, SCREEN } from '/js/cards/render.js?v=24be160';
import { engravedFor, stockOf, embossParams, reliefType, DIRS } from '/js/cards/skins/engraved.js?v=24be160';
import { embossOf, stillCanvas } from '/js/cards/emboss.js?v=24be160';
import { readFace, warmArt } from '/js/cards/relief.js?v=24be160';
import { rest, step, clamp } from '/js/cards/attitude.js?v=24be160';
import { lightFace, v } from '/js/cards/lamp.js?v=24be160';
import { dustMorph } from '/js/cards/morph.js?v=24be160';
import { esc, apiBase } from '/js/kit.js?v=24be160';
import { artUrl } from '/js/cards/art.js?v=24be160';

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


/* ── lifecycle ─────────────────────────────────────────────────────────────
   The page used to wire itself up as the module loaded and assume it lived
   for the whole visit: no way to stop the frame loop, the window listeners,
   the timers, the fingertip readers or a dust morph in flight. mount() is that
   same code, unchanged in order (it is not re-indented, so the 12 Sep move
   stays diffable), and it returns stop(). start() runs it once on load.
   Anything that shows the card more than once (a modal, a client-side route,
   a React wrapper) calls KaaykoCard.stop() before it goes, and start() again.
   ─────────────────────────────────────────────────────────────────────── */
let current = null;
export function start() { if (!current) current = mount(); return current; }
export function stop() { if (current) { current(); current = null; } }
window.KaaykoCard = { start, stop };

function mount() {
const life = new AbortController();
let stopped = false;
const timers = new Set(), frames = new Set();
const on = (el, type, fn, opts) => el.addEventListener(type, fn,
  Object.assign({}, typeof opts === 'object' ? opts : { capture: !!opts }, { signal: life.signal }));
const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (!stopped) fn(); }, ms); timers.add(id); return id; };
const cancelLater = (id) => { clearTimeout(id); timers.delete(id); };
const frame = (fn) => { const id = requestAnimationFrame((t) => { frames.delete(id); if (!stopped) fn(t); }); frames.add(id); return id; };

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
// The eye is four card-widths from the card, at every card size. The CSS
// perspective was a fixed 1400px: four widths of a 353px phone card, but under
// two of the 720px desktop one — so a card turned in the hand on a desktop
// swung its near edge at the viewer and ran taller than the window.
const EYE_CARDS = 4;
const lampEl = document.getElementById('lamp');

let eye = v(0, 0, EYE_CARDS), cardW = 600, cardBox = null, roomBox = null;
/** The card's real width, and the perspective set from it. */
function measure() {
  cardBox = cardWrap.getBoundingClientRect();
  roomBox = room.getBoundingClientRect();
  cardW = cardBox.width || 600;
  cardWrap.style.perspective = `${Math.round(cardW * EYE_CARDS)}px`;   // runs before write() exists
}
measure();
on(window, 'resize', measure);

let raf = 0, target = { x: .5, y: .35 }, live = false;

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
// How far the engraved material stands up, 0 (flat) to 1 (full relief). It is
// 1 except while the set is switching, when it rises as the colour drains and
// sinks as the colour fills (switchSkin). Applied per layer, in lit(), like
// every other light on the card — never as a fade over the group.
let reliefGain = 1;
// The lettering's share of the relief, ramped in on its own (typeRamp): its
// layers are laid a beat after the animal's so the two never cost one frame.
let typeGain = 1, typeRamp = 0;
let quiet = false;            // the probe rig, isolating the light
let reliefParts = 'all';      // the probe rig, weighing the relief: 'all' | 'art' | 'flat' | 'nogloss'

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
  // One lamp, fixed in the room, on every device (23 Oct 2026). On a desktop
  // the lamp used to BE the pointer, so a glint sat on the card under the
  // cursor and a glow followed it round the wall — a light on the mouse. The
  // card still leans to the pointer, so the light still moves across it.
  const lamp = ROOM_LAMP;
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
  // The engraved ink's gloss: the same glint, tighter (a hard ink catches a
  // smaller highlight than paper does), seen only through the letters. Capped
  // at .6 so the ink at its brightest is still read as ink.
  const gloss = `${at} rotate(${o.angle.toFixed(1)}deg) scale(${(o.s1 * SIG * 0.6).toFixed(3)}, ${(o.s2 * SIG * 0.6).toFixed(3)})`;
  const glossO = Math.max(RELIEF_FLOOR, Math.min(0.6, o.peak * 0.7)).toFixed(3);
  // The relief: how much of each still shows is how far the lamp is on that side.
  const still = (wt) => Math.max(RELIEF_FLOOR, Math.min(1, wt * 1.7)).toFixed(3);
  const stills = { xp: still(o.weights.xp), xn: still(o.weights.xn), yp: still(o.weights.yp), yn: still(o.weights.yn) };
  for (const f of layersOf()) {
    write(f.sheen, 'transform', glint); write(f.sheen, 'opacity', spec);
    write(f.wash, 'transform', wash); write(f.wash, 'opacity', washO);
    write(f.shade, 'opacity', shade);
    write(f.foil, 'transform', foil); write(f.foil, 'opacity', foilO);
    write(f.rim, 'opacity', rim);
    if (f.gloss) { write(f.gloss, 'transform', gloss); write(f.gloss, 'opacity', Math.max(RELIEF_FLOOR, glossO * reliefGain * typeGain).toFixed(3)); }
    for (const dir in f.stills) for (const st of f.stills[dir]) write(st.el, 'opacity', (Math.max(RELIEF_FLOOR, stills[dir] * reliefGain * (st.type ? typeGain : 1)) * st.k).toFixed(3));
    if (f.tint) write(f.tint.el, 'opacity', (f.tint.k * Math.max(RELIEF_FLOOR, reliefGain)).toFixed(3));
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
  if (stopped) return;
  // Real elapsed time, so the spring behaves the same on a 120Hz phone as on a
  // 60Hz laptop. Clamped, because a backgrounded tab returns a huge first step.
  const dt = lastT ? Math.min(0.25, (t - lastT) / 1000) : 1 / 60;
  lastT = t;
  if (grab.on) {
    // While held, the card is exactly where the finger put it. No spring: a
    // spring under a hand is what makes an object feel like it is on a string.
    att.rx = att.tx; att.ry = att.ty;
  } else {
    step(att, dt, { smoothTime: inspecting ? INSPECT_SETTLE : 0.12 });
    if (inspecting) { settleInspect(); putDownWhenStill(); }
  }
  // Lit from the true attitude, every frame, in both skins, whether it is
  // leaning to a pointer or turning in a hand. The model works in the frame
  // of whichever face is up: at 180° the back is square to the viewer exactly
  // as the front is at 0°, and a full turn ends where it began.
  if (switching) stepSwitch(t);
  if (typeRamp) { typeGain = smooth((t - typeRamp) / 350); if (typeGain >= 1) typeRamp = 0; }
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
let inspecting = false;
const grab = { on: false, id: null, x: 0, y: 0, t: 0, wx: 0, wy: 0 };   // w = angular velocity, deg/s

/** Whatever half-turn the card is on, make it the real state and start at 0. */
function foldTurn() {
  const half = Math.round(att.ry / 180);
  att.ry -= half * 180; att.ty -= half * 180;
  if (half % 2 !== 0) {
    // The card's angle and the face state change in the same frame, so the
    // picture does not move at all: the card stops being "turned 180°" and
    // starts being "flipped", which look identical.
    write(card, 'transform', `rotateX(${att.rx.toFixed(2)}deg) rotateY(${att.ry.toFixed(2)}deg)`);
    setFaceQuietly(!card.classList.contains('is-flipped'));
  }
}

/**
 * Which face is up, changed WITHOUT the faces' .7s turn. The only animated
 * flip is one a person asked for — a tap, or a turn in the hand. Bookkeeping
 * (folding a turn into the flip state) and a newly dealt card must never play
 * one: putting a card down used to flip it over again in front of you, and a
 * card dealt while you were reading a back spun round to its front.
 */
function setFaceQuietly(flipped) {
  if (card.classList.contains('is-flipped') === flipped) return;
  card.classList.add('no-turn');
  card.classList.toggle('is-flipped', flipped);
  void card.offsetWidth;                       // the new face transforms land untweened
  frame(() => card.classList.remove('no-turn'));
}

function setInspect(on) {
  inspecting = !!on;
  card.classList.toggle('is-inspecting', inspecting);
  cardWrap.classList.toggle('is-inspecting', inspecting);
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
  grab.face = Math.round(att.ry / 180) * 180;   // the face it was picked up on
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
  // A flick turns it over once, never twice: a hard one used to coast past
  // 270° and land face up again, which reads as the flick not working.
  att.ty = clamp(Math.round(coastY / 180) * 180 - grab.face, 180) + grab.face;
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

/* ── the card in the hand, by default ───────────────────────────────────────
   There used to be an Inspect / Put it down button, and then a 240ms hold
   before a drag would turn the card — while a plain drag dealt the next card,
   which is not what a hand on a card expects. Now: a tap turns it over; any
   drag that starts on the card turns it, at once, and a flick past halfway
   lands it on its other face; holding still lifts it off the table too. Let
   go and it settles, then goes back on the table by itself (putDownWhenStill,
   in the loop). The next card is dealt from the strip, or by a swipe in the
   space around the card — never by a drag on the card itself.             */
const HOLD_MS = 240;           // holding still this long lifts the card
const HOLD_SLOP = 8;           // px of movement that makes a press a turn, not a tap
let hold = null;

function liftWith(h) {
  if (hold !== h || grab.on) return;
  card.dataset.held = '1';
  setInspect(true);
  grabStart({ pointerId: h.id, clientX: h.x, clientY: h.y });
}

function holdCancel() { if (hold) { cancelLater(hold.timer); hold = null; } }

function holdStart(e) {
  if (still || (e.pointerType === 'mouse' && e.button !== 0)) return;
  holdCancel();
  const h = { id: e.pointerId, x: e.clientX, y: e.clientY, timer: 0 };
  h.timer = later(() => {
    if (hold !== h || grab.on) return;
    liftWith(h);
    try { navigator.vibrate?.(8); } catch (_) {}
  }, HOLD_MS);
  hold = h;
}

function holdMove(e) {
  if (!hold || e.pointerId !== hold.id) return;
  if (grab.on) return;
  // Past the slop it is a turn: pick the card up from where the finger went
  // down, and let grabMove take this same move from there.
  if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD_SLOP) { cancelLater(hold.timer); liftWith(hold); }
}

function holdEnd(e) {
  if (hold && e.pointerId === hold.id) { cancelLater(hold.timer); hold = null; }
  if (grab.on) grabEnd(e);
  // The click that follows the release must not also turn the card over.
  if (card.dataset.held) later(() => { delete card.dataset.held; }, 0);
}

/** Once a released card has come to rest, it is back on the table. */
function putDownWhenStill() {
  if (!inspecting || grab.on || (hold && grab.id === hold.id)) return;
  if (Math.abs(att.vy.v) > 2 || Math.abs(att.vx.v) > 2) return;
  if (Math.abs(att.ry - att.ty) > 0.4 || Math.abs(att.rx - att.tx) > 0.4) return;
  setInspect(false);
}

on(card, 'pointerdown', holdStart);
on(card, 'pointermove', (e) => { holdMove(e); grabMove(e); });
on(card, 'pointerup', holdEnd);
on(card, 'pointercancel', holdEnd);
on(card, 'lostpointercapture', (e) => { if (grab.on) grabEnd(e); });

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
    on(window, 'pointermove', aim, { passive: true });
    on(window, 'pointerleave', () => { target = { x: .5, y: .35 }; });
  }
}
} catch (err) { console.warn('card: lighting off —', err); }

/* ── turning it over ─────────────────────────────────────────────────────── */
const flip = () => card.classList.toggle('is-flipped');
// A swipe that changed the card must not also turn it over, and neither must
// letting go of a card you were inspecting.
on(card, 'click', (e) => { if (!inspecting && !card.dataset.held && !card.dataset.swiped && gestureMoved < 8) flip(); });
on(card, 'keydown', (e) => {
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
  // A card in the hand is put down first, on whichever face it is nearest.
  if (inspecting) { grab.on = false; grab.id = null; setInspect(false); }
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
  if (series.length) {
    paintMarks();
    if (timed) switchSkin();
    else { show(at, { relief: 'soon' }); if (wasFlipped) card.classList.add('is-flipped'); }
  }
  if (save) frame(() => morphNow(engraved ? 'to' : 'back'));
}

on(skinBtn, 'click', (e) => {
  e.stopPropagation();
  if ((morph && morph.busy()) || switching) return;       // let the dust land
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
  properties: 'Kaayko \u00b7 Paddling Out \u00b7 Stories \u00b7 Forge \u00b7 Kortex \u00b7 School',
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
   clock. The stylesheet's .9s transitions on the page's colours are this
   number too. */
const MORPH_MS = 900;

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
  frame(() => frame(() => { nu.style.opacity = '1'; }));
  later(() => {
    if (nu.parentElement !== el) return;              // the page moved on
    for (const n of [...el.children]) if (n !== nu) n.remove();
    nu.classList.remove('incoming'); nu.style.transition = ''; nu.style.opacity = '';
  }, fade + 40);
}

/**
 * The QR is for a card seen on a screen across a room — a desktop. On a phone
 * it is a code you would have to scan with the phone it is on, so it is not
 * drawn there, box and all (23 Oct 2026). KAAYKO stays in its corner.
 */
function frontOpts(c, artHref, skin) {
  return fine ? { qr: qrFor(c.url), artHref, skin } : { qr: null, artHref, skin: { ...skin, qrBox: false } };
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
  cancelLater(reliefTimer);
  const seq = ++reliefSeq;
  for (const f of layersOf()) {
    f.stills = {};
    f.tint = null;
    dropGloss(f);
    // On a timed switch the old relief fades out on the same clock as the
    // face under it, and the new impression fades in on it. Otherwise the
    // change is a cut, as a new card is.
    f.relief.style.transitionDuration = fade ? `${fade}ms` : '';
    f.relief.classList.remove('is-set');
    // What fades out is the impression alone. The lit stills go at once:
    // eight of them carry filters, and a group fading over filtered layers
    // is a frame of work on WebKit — measured at 100ms a frame.
    if (fade) { const r = f.relief; r.querySelector('.stills')?.remove(); later(() => { if (seq === reliefSeq && !r.classList.contains('is-set')) r.innerHTML = ''; }, fade + 40); }
    else f.relief.innerHTML = '';
  }
  if (!engraved) return;
  const alive = () => engraved && seq === reliefSeq && series[at] === c;
  const params = embossParams(c);
  const emboss = embossOf(artUrl(c), params);
  emboss.then((e) => {
    if (!alive()) return;
    for (const f of layersOf()) { f.relief.innerHTML = ''; layTint(f, c, e, params); }
    frame(() => frame(() => { if (alive()) for (const f of layersOf()) f.relief.classList.add('is-set'); }));
  }).catch((err) => console.warn('card: relief —', err));
  reliefTimer = later(() => {
    emboss.then((e) => {
      if (!alive()) return;
      for (const f of layersOf()) layStills(f, c, e, params, 'art');
      later(() => { if (alive()) layTypeLater(c, e, params); }, 260);
      // Two frames: one for the insert to be laid out, one for the transition to
      // have something to start from. The raster lands in the first.
      frame(() => frame(() => {
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
 * arithmetic render.js used to draw it: on the front, render.js's own
 * frontArt() for the screen card (the animal framed at its extent in the
 * widened column); on the back, the box into which the animal's measured
 * extent is fitted. Either way the file hangs past the box on every side.
 */
function artRect(face, c) {
  return (face === 'b' ? backArt(c, SCREEN) : frontArt(c, SCREEN)).file;
}

/** The back's animal is the front's, seen through the sheet: drawn mirrored. */
const MIRRORED = { xp: 'xn', xn: 'xp', yp: 'yp', yn: 'yn' };

/** The window the animal's layers are cut to: its box, plus a margin for the relief, inside the sheet. */
function artWindow(face, c, W = 1050, H = 600) {
  const box = (face === 'b' ? backArt(c, SCREEN) : frontArt(c, SCREEN)).box;
  const m = Math.ceil(Math.max(box.w, box.h) * 0.06) + 2;
  const x0 = Math.max(0, box.x - m), y0 = Math.max(0, box.y - m);
  const x1 = Math.min(W, box.x + box.w + m), y1 = Math.min(H, box.y + box.h + m);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** One canvas of the animal, in a layer cut to the window, placed where the file is. */
function artLayer(face, c, imageData, cls) {
  const win = artWindow(face, c), rect = artRect(face, c);
  const el = document.createElement('div');
  el.className = cls;
  placeStill(el, win);
  const cv = stillCanvas(imageData);
  cv.style.cssText = `position:absolute;left:${((rect.x - win.x) / win.w * 100).toFixed(2)}%;top:${((rect.y - win.y) / win.h * 100).toFixed(2)}%;width:${(rect.w / win.w * 100).toFixed(2)}%;height:${(rect.h / win.h * 100).toFixed(2)}%${face === 'b' && backArt(c, SCREEN).mirror ? ';transform:scaleX(-1)' : ''}`;
  el.appendChild(cv);
  return el;
}

/** Phase one: the impression, at the watermark's strength on the back. */
function layTint(f, c, e, params) {
  const face = f.host === backEl ? 'b' : 'f';
  const el = artLayer(face, c, e.tint, 'art tint');
  const k = face === 'b' ? params.ghost : 1;
  el.style.opacity = String(k * Math.max(RELIEF_FLOOR, reliefGain));
  f.tint = { el, k };
  f.relief.appendChild(el);
}

/** Phase two: the four lit stills of the animal, and of the type. */
function layStills(f, c, e, params, part = 'all') {
  const face = f.host === backEl ? 'b' : 'f';
  const ghost = face === 'b' ? params.ghost : 1;
  // 'art' lays the animal's stills in a new wrap; 'type' adds the lettering's
  // stills and gloss to the wrap already there; 'all' does both at once.
  let wrap = part === 'type' ? f.relief.querySelector('.stills') : null;
  const fresh = !wrap;
  if (fresh) { wrap = document.createElement('div'); wrap.className = 'stills'; }
  const type = reliefParts === 'art' || part === 'art' ? null : reliefType(c, face);
  const svgs = f.host.querySelectorAll(':scope > svg');
  const svg = svgs[svgs.length - 1];                  // the arriving face, mid-switch
  const texts = svg ? [...svg.querySelectorAll('text')] : [];
  const tw = type && texts.length ? typeWindow(texts) : null;
  const flat = reliefParts === 'flat' ? (html) => html.replace(/ filter="url\(#[^"]+\)"/g, '') : (html) => html;
  if (part !== 'type') f.stills = {};
  for (const dir of Object.keys(DIRS)) {
    f.stills[dir] ??= [];
    if (part !== 'type') {
      const a = artLayer(face, c, e[face === 'b' && backArt(c, SCREEN).mirror ? MIRRORED[dir] : dir], 'art');
      a.dataset.dir = dir;
      a.style.opacity = String(RELIEF_FLOOR);
      wrap.appendChild(a); f.stills[dir].push({ el: a, k: ghost });
    }
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
    wrap.appendChild(t); f.stills[dir].push({ el: t, k: 1, type: true });
  }
  if (tw && reliefParts !== 'nogloss') layGloss(f, texts, tw, wrap);
  if (fresh) f.relief.appendChild(wrap);
}

/* ── the ink's gloss ─────────────────────────────────────────────────────────
   The animal catches the light because it has no ink: its strokes ARE the
   relief, and they swing from shadow to white as the card turns. The type is
   solid ink, so the stills above could only ever draw a hairline round it —
   measured, the colour inside a letter moved 2–5 levels over a full turn
   while the animal's moved 156. So the letters get the lamp's own glint,
   masked to their shapes: the same ellipse that crosses the paper, seen only
   through the ink, moved by the same transform. No filter primitives; one
   masked layer per face, raster once per card. Kortex is the flat job and
   has no type relief (reliefType returns null), so it never gets here.     */
function dropGloss(f) {
  f.gloss = null;
  if (f.glossUrl) { URL.revokeObjectURL(f.glossUrl); f.glossUrl = null; }
}

/** The letters of one face as an alpha mask, drawn with the page's own fonts at the browser's own glyph positions. */
function typeMask(texts, win) {
  const k = Math.min(2, Math.max(1, (cardW * (window.devicePixelRatio || 1)) / 1050));
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(win.w * k); cv.height = Math.ceil(win.h * k);
  const ctx = cv.getContext('2d');
  ctx.setTransform(k, 0, 0, k, -win.x * k, -win.y * k);
  ctx.fillStyle = '#000';
  for (const t of texts) {
    const cs = getComputedStyle(t);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const str = t.textContent || '';
    const n = t.getNumberOfChars ? t.getNumberOfChars() : 0;
    for (let i = 0; i < n; i++) {
      let p; try { p = t.getStartPositionOfChar(i); } catch (_) { continue; }
      ctx.fillText(str[i], p.x, p.y);
    }
  }
  return cv;
}

function layGloss(f, texts, tw, wrap) {
  const win = document.createElement('div');
  win.className = 'gloss-win';
  placeStill(win, tw);
  const g = document.createElement('i');
  g.className = 'gloss';
  // The glint's own frame is the whole face (it is the sheen's geometry), so
  // the layer is sized and placed in face terms inside the type's window.
  g.style.cssText = `left:${(-tw.x / tw.w * 100).toFixed(3)}%;top:${((300 - tw.y) / tw.h * 100).toFixed(3)}%;width:${(1050 / tw.w * 100).toFixed(3)}%`;
  win.appendChild(g);
  wrap.appendChild(win);
  const seq = reliefSeq;
  // The mask waits for the fonts, or it would be drawn in a stand-in face and
  // sit beside the real letters instead of on them.
  document.fonts.ready.then(() => new Promise((ok) => typeMask(texts, tw).toBlob(ok))).then((blob) => {
    if (!blob || seq !== reliefSeq || !win.isConnected) return;
    dropGloss(f);
    const url = URL.createObjectURL(blob);
    f.glossUrl = url;
    for (const p of ['maskImage', 'webkitMaskImage']) win.style[p] = `url(${url})`;
    f.gloss = g;
  }).catch((err) => console.warn('card: gloss —', err));
}

/* The fingertip reader. Where a browser can vibrate it ticks per letter; where
   it cannot — which is every browser on iOS — the trace still draws. It is a
   bonus on top of the relief under the lamp, not the main way the card is read. */
let readers = [];
let gestureMoved = 0;
const touchy = matchMedia('(hover: none)').matches
  || matchMedia('(pointer: coarse)').matches
  || (navigator.maxTouchPoints || 0) > 0;

function unread() {
  readers.forEach((d) => d.detach()); readers = [];
  // And no ring left on either face, whatever the reader last said.
  card.querySelectorAll('.stylus').forEach((st) => { st.dataset.on = ''; });
}

function attachReaders(c) {
  unread();
  if (!engraved || !touchy) return;
  const artHref = artUrl(c);
  // Where the animal is on each face. The front's column covers from the
  // origin; the back's picture is boxed on the right and fitted inside.
  const fa = frontArt(c, SCREEN);
  const FRONT_ART = { ...fa.box, fit: fa.fit, crop: fa.crop };
  const ba = backArt(c, SCREEN);
  const BACK_ART = { ...ba.box, fit: ba.fit, crop: ba.crop, mirror: ba.mirror };
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

/* ── changing the set: one motion ─────────────────────────────────────────────
   It used to be three things in a row: the faces crossfaded for 1150ms, and
   the relief — the raised paper, the whole point of the engraved set — was
   laid only after the dust had landed, and popped in at 1400ms. Now it is one
   gesture on one clock (MORPH_MS, which the skull's dust and the page's colour
   transitions share):
     to engraved — the colour drains out of the card while the material rises
                   out of the paper: saturation goes to nothing, the engraved
                   sheet takes over, and the relief's depth (reliefGain) grows
                   from flat to full;
     to colour   — the relief sinks flat while the colour fills back in: the
                   colour face arrives grey and saturates.
   The relief is laid in the first frame at zero depth (its one raster), and
   from then on everything is opacity, a saturate filter on two faces, and the
   per-layer writes lit() already makes every frame.                         */
let switching = null;
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** The lettering's relief and gloss, laid when nothing is moving and faded in. */
function layTypeLater(c, e, params) {
  if (!engraved || series[at] !== c) return;
  typeGain = 0;
  for (const f of layersOf()) layStills(f, c, e, params, 'type');
  typeRamp = performance.now();
}

function switchSkin() {
  const c = series[at];
  const artHref = artUrl(c);
  const skinF = engraved ? engravedFor(c, SCREEN, 'f') : SCREEN;
  const skinB = engraved ? engravedFor(c, SCREEN, 'b') : SCREEN;
  const faces = [
    [frontEl, front(c, frontOpts(c, artHref, skinF)), `${c.name}, front of the card`],
    [backEl, back(c, brand, { index: at + 1, total: series.length, artHref, skin: skinB }), `${c.name}, back of the card`],
  ];
  const incoming = faces.map(([host, svg, label]) => {
    host.setAttribute('aria-label', label);
    const svgs = [...host.querySelectorAll(':scope > svg')];
    for (const n of svgs.slice(0, -1)) n.remove();           // anything left from an earlier switch
    const old = svgs[svgs.length - 1] || null;
    host.insertAdjacentHTML('beforeend', svg);
    const nu = host.lastElementChild;
    nu.classList.add('incoming');
    nu.style.opacity = '0';
    if (!engraved) nu.style.filter = 'saturate(0)';
    if (old) old.style.willChange = 'opacity, filter';
    return { old, nu };
  });
  [...marks.children].forEach((b, j) => { b.setAttribute('aria-checked', String(j === at)); b.tabIndex = j === at ? 0 : -1; });
  unread();
  if (engraved) {
    // Laid now, at depth zero, so the rise has something to rise.
    reliefGain = 0;
    cancelLater(reliefTimer);
    const seq = ++reliefSeq;
    for (const f of layersOf()) { f.stills = {}; f.tint = null; dropGloss(f); f.relief.innerHTML = ''; f.relief.classList.remove('is-set'); }
    const params = embossParams(c);
    embossOf(artUrl(c), params).then((e) => {
      if (seq !== reliefSeq || !engraved || series[at] !== c) return;
      for (const f of layersOf()) {
        f.relief.style.transition = 'none';
        layTint(f, c, e, params);
        layStills(f, c, e, params, 'art');
        f.relief.classList.add('is-set');
        const st = f.relief.querySelector('.stills');
        if (st) { st.style.transition = 'none'; st.classList.add('is-set'); }
      }
    }).catch((err) => console.warn('card: relief —', err));
  }
  switching = { t0: performance.now(), toEngraved: engraved, incoming, c, emboss: engraved ? embossOf(artUrl(c), embossParams(c)) : null };
  if (still) finishSwitch();
}

function stepSwitch(now) {
  const s = switching;
  const p = Math.min(1, (now - s.t0) / MORPH_MS);
  // The two faces set different type, so they hand over quickly in the middle
  // rather than crossfading for long — two typefaces over each other read as
  // a smudge. The colour goes first; the material moves after the handover.
  for (const { old, nu } of s.incoming) {
    if (s.toEngraved) {
      if (old) {
        old.style.filter = `saturate(${(1 - smooth(p / 0.4)).toFixed(3)})`;
        old.style.opacity = (1 - smooth((p - 0.35) / 0.2)).toFixed(3);
      }
      nu.style.opacity = smooth((p - 0.45) / 0.25).toFixed(3);
    } else {
      if (old) old.style.opacity = (1 - smooth((p - 0.3) / 0.2)).toFixed(3);
      nu.style.opacity = smooth((p - 0.4) / 0.25).toFixed(3);
      nu.style.filter = `saturate(${smooth((p - 0.45) / 0.55).toFixed(3)})`;
    }
  }
  reliefGain = s.toEngraved ? smooth((p - 0.45) / 0.55) : 1 - smooth(p / 0.5);
  if (p >= 1) finishSwitch();
}

function finishSwitch() {
  const s = switching;
  if (!s) return;
  switching = null;
  for (const { old, nu } of s.incoming) {
    if (old && old.parentElement) old.remove();
    nu.classList.remove('incoming');
    nu.style.opacity = ''; nu.style.filter = '';
  }
  for (const f of layersOf()) {
    f.relief.style.transition = '';
    const st = f.relief.querySelector('.stills');
    if (st) st.style.transition = '';
    if (!s.toEngraved) { f.stills = {}; f.tint = null; dropGloss(f); f.relief.innerHTML = ''; f.relief.classList.remove('is-set'); }
  }
  reliefGain = 1;
  if (s.toEngraved && series[at] === s.c) {
    attachReaders(s.c);
    const params = embossParams(s.c);
    // 200ms after the motion: the dust and the rose have landed by then, so
    // the lettering's one raster falls in a frame where nothing is moving.
    s.emboss.then((e) => later(() => layTypeLater(s.c, e, params), 200)).catch(() => {});
  }
  measure();
}

function show(i, { focus = false, relief = 'soon', fade = 0 } = {}) {
  if (!series.length) return;
  if (switching) { switching = null; reliefGain = 1; }
  typeRamp = 0; typeGain = 1;
  at = (i + series.length) % series.length;
  const c = series[at];
  const artHref = artUrl(c);
  // A skin per face: the filter ids inside it are document-wide, and both faces
  // live in the same document.
  // SCREEN, not PRINT: the web card carries no address, rule or back edge,
  // and larger type. The printed card is render.js's PRINT and is not drawn here.
  const skinF = engraved ? engravedFor(c, SCREEN, 'f') : SCREEN;
  const skinB = engraved ? engravedFor(c, SCREEN, 'b') : SCREEN;
  draw(frontEl, front(c, frontOpts(c, artHref, skinF)),
       `${c.name}, front of the card`, fade);
  // The back gets the same art, ghosted behind its words.
  draw(backEl, back(c, brand, { index: at + 1, total: series.length, artHref, skin: skinB }),
       `${c.name}, back of the card`, fade);
  // The card prints its own name in 50pt caps directly above this; repeating it
  // here was the page reading itself out loud. Only the link is not on the card
  // already — because the one on the card is ink, and this one is a link.
  nowEl.innerHTML = `<i><a class="to-product" href="${esc(c.url)}">${esc(c.url.replace('https://', ''))}</a></i>`;
  [...marks.children].forEach((b, j) => {
    b.setAttribute('aria-checked', String(j === at));
    b.tabIndex = j === at ? 0 : -1;
    if (focus && j === at) b.focus();
  });
  setFaceQuietly(false);                          // a new card arrives face up — dealt, not turned
  // 1400ms: the dust lands at 1150 and the rose has faded in by 1330. The
  // raster must fall in a still moment, and this is the first one.
  scheduleRelief(c, relief === 'after-morph' ? 1400 : 16, fade);
  // The engraved relief for this card, computed while nothing is happening, so
  // a switch to the engraved set lays it from cache instead of on the tap.
  if (!engraved) {
    const warm = () => { if (series[at] === c && !engraved) embossOf(artUrl(c), embossParams(c)).catch(() => {}); };
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 1500 }); else later(warm, 600);
  }
  // The readers measure the face's glyphs, so they wait for the face that
  // is arriving rather than reading the one on its way out.
  if (fade) later(() => { if (series[at] === c) attachReaders(c); }, fade + 60);
  else attachReaders(c);
  measure();                                      // the caption under the card can change height
}

(async () => {
  try {
    // Live copy first. The static index is the fallback, so the cards still
    // render if the API is unreachable — with whatever words it was last built
    // with, which is better than a blank card.
    const r = await fetch(`${API}/cards`, { cache: 'no-cache', signal: life.signal });
    if (!r.ok) throw new Error(r.status);
    const idx = await r.json();
    series = idx.cards || [];
    brand = idx.brand || {};
  } catch (_) {
    try {
      const r = await fetch('/assets/cards/index.json', { cache: 'no-cache', signal: life.signal });
      const idx = await r.json();
      series = (idx.cards || []).map((c) => ({ ...c, art: c.slug }));
      brand = FALLBACK_BRAND;
    } catch (__) { series = []; }
  }
  if (stopped || !series.length) return;   // stopped while the catalog was loading

  paintMarks();
  // The other cards' art, fetched while nothing is happening, so a swipe to
  // any of them finds the picture already here (WebP, cached for a year).
  const prefetchArt = () => series.forEach((c, i) => { if (i !== at) { const im = new Image(); im.decoding = 'async'; im.src = artUrl(c); } });
  if ('requestIdleCallback' in window) requestIdleCallback(prefetchArt, { timeout: 2500 }); else later(prefetchArt, 1200);
  on(marks, 'click', (e) => {
    const b = e.target.closest('.mark');
    // The card already up is not dealt again: that turned a card you were
    // reading the back of over to its front.
    if (b && Number(b.dataset.i) !== at) show(Number(b.dataset.i));
  });
  on(marks, 'keydown', (e) => {
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
  // How far a press on the card travelled, so a turn is never also a tap.
  let gx = null, gy = 0;
  on(card, 'pointerdown', (e) => { gx = e.clientX; gy = e.clientY; gestureMoved = 0; });
  on(card, 'pointermove', (e) => {
    if (gx === null) return;
    gestureMoved = Math.max(gestureMoved, Math.hypot(e.clientX - gx, e.clientY - gy));
  }, { passive: true });
  // The next card is dealt by a swipe in the space AROUND the card (the drag
  // on the card turns it), or from the strip under it.
  const zone = cardWrap.parentElement;
  let x0 = null, y0 = 0;
  on(zone, 'pointerdown', (e) => { x0 = card.contains(e.target) ? null : e.clientX; y0 = e.clientY; });
  on(zone, 'pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if (!inspecting && Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy)) show(at + (dx < 0 ? 1 : -1));
  });
  on(zone, 'pointercancel', () => { x0 = null; });
  show(0);
  // Unconditionally, not only when a preference exists: the control's label
  // lives in two places otherwise, and the copy in the HTML is the one nobody
  // remembers to change. It read "Bone" on every cold load for three deploys
  // after the module had stopped saying it.
  setSkin(remembered(), { save: false });
  // A rig for measuring the page on a real engine, only when the URL asks
  // for it. Never fetched otherwise. See cards/probe.js.
  const probe = new URLSearchParams(location.search).get('probe');
  if (probe) import('/js/cards/probe.js?v=24be160').then((m) => m.run({ label: probe, setSkin, setInspect, att, grab, quiet: (on) => { quiet = !!on; }, parts: (p) => { reliefParts = p; } })).catch((err) => console.warn('card: probe —', err));
})();

return function stopCard() {
  stopped = true;
  life.abort();                                   // every listener, and a catalog fetch in flight
  cancelAnimationFrame(raf);
  timers.forEach((id) => clearTimeout(id)); timers.clear();
  frames.forEach((id) => cancelAnimationFrame(id)); frames.clear();
  reliefSeq++;                                    // relief work already under way sees a new sequence and stands down
  unread();                                       // fingertip readers
  if (morph && morph.cancel) morph.cancel();      // a dust morph in flight
};
}

start();
