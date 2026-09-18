/**
 * pages/card.js — the collectible card (/card): lighting model, flip, share, QR.
 * Moved out of card.html on 12 Sep 2026 unchanged.
 */
import { front, back } from '/js/cards/render.js';
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
card.addEventListener('click', (e) => { if (!card.dataset.swiped) flip(); });
card.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
});
document.getElementById('turn').addEventListener('click', (e) => { e.stopPropagation(); flip(); });

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

function show(i, { focus = false } = {}) {
  if (!series.length) return;
  at = (i + series.length) % series.length;
  const c = series[at];
  const artHref = `/assets/cards/art/${c.art || c.slug}.png`;
  draw(frontEl, front(c, { qr: qrFor(c.url), artHref }),
       `${c.name}, front of the card`);
  // The back gets the same art, ghosted behind its words.
  draw(backEl, back(c, brand, { index: at + 1, total: series.length, artHref }),
       `${c.name}, back of the card`);
  nowEl.innerHTML = `<b>${esc(c.name)}</b>` +
    `<i><a class="to-product" href="${esc(c.url)}">${esc(c.url.replace('https://', ''))}</a></i>`;
  [...marks.children].forEach((b, j) => {
    b.setAttribute('aria-checked', String(j === at));
    b.tabIndex = j === at ? 0 : -1;
    if (focus && j === at) b.focus();
  });
  card.classList.remove('is-flipped');            // a new card arrives face up
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

  // No number inside the button any more: the strip is a slider, and the card's
  // name is already printed under it. The name becomes the accessible label so a
  // screen reader still hears "Alumni", not "button 5".
  marks.innerHTML = series.map((c, i) =>
    `<button type="button" class="mark" role="radio" aria-checked="false" tabindex="-1"
       data-i="${i}" title="${esc(c.name)}" aria-label="${esc(c.name)}"></button>`).join('');
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
  let x0 = null;
  card.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  card.addEventListener('pointerup', (e) => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 46) {
      card.dataset.swiped = '1';
      show(at + (dx < 0 ? 1 : -1));
      setTimeout(() => { delete card.dataset.swiped; }, 0);
    }
  });
  show(0);
})();
