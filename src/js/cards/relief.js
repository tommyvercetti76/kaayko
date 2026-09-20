/**
 * cards/relief.js — reading the card with a fingertip.
 *
 * WHAT THIS IS
 * ------------
 * On a phone, dragging a finger across an engraved card ticks once per raised
 * feature it crosses: once per letter of the name, once at each hairline rule,
 * twice at the plate mark, and continuously across the animal in proportion to
 * how deep the die went there. Slide across STORE and you feel five things.
 * It is the card read the way a blind emboss is actually read.
 *
 * WHAT IT CANNOT DO, AND YOU SHOULD KNOW BEFORE JUDGING IT
 * --------------------------------------------------------
 * navigator.vibrate does not exist in Safari on iOS. Not "is unreliable" —
 * Apple has never shipped the Vibration API on iPhone, and there is no flag,
 * no permission prompt and no polyfill. Every web page that appears to buzz an
 * iPhone is either a native wrapper or a `switch` control doing it inside the
 * system's own toggle. So: this is real haptics on Android, and on iOS it is
 * the visual trace below and nothing in the hand. The code does not pretend
 * otherwise, and it does not ask a device that cannot do it to try.
 *
 * The visual trace runs everywhere, because a thing you can see being read is
 * worth having on its own, and it is the whole of the feature on an iPhone.
 *
 * HOW THE RELIEF IS KNOWN
 * -----------------------
 * Not guessed from the design — measured from the drawing. The card is live
 * inline SVG, so every letter can be asked for its own box with
 * getExtentOfChar, every rule for its bounding box, and the animal is sampled
 * once into a small luminance grid. That is why the ticks land on the letters
 * rather than near them, and why changing the type in the skin needs no change
 * here: the map is rebuilt from whatever was actually drawn.
 */

/** Feature kinds, in the order a finger meets them. */
const GLYPH = 'glyph', RULE = 'rule', PLATE = 'plate', ART = 'art';

// Short. A tick you notice as a tick, not as a buzz. The art scales with depth
// between these two, so a dense passage of the animal feels heavier than its
// outline does.
const PULSE = {
  [GLYPH]: 7,
  [RULE]: 13,
  [PLATE]: [8, 16, 8],
  artMin: 5,
  artMax: 20,
};

const MIN_GAP_MS = 42;          // below this, separate ticks read as one buzz
const ART_GRID_W = 132;         // the animal, sampled once
const RAISED_BELOW = 0.74;      // luminance under which the die has bitten

/** One animal, sampled once, shared by both faces and by every later visit. */
const SAMPLES = new Map();

export const canVibrate = () => typeof navigator !== 'undefined'
  && typeof navigator.vibrate === 'function';

/**
 * Sample the artwork into a luminance grid.
 *
 * The <image> is drawn with preserveAspectRatio="xMidYMid slice", so the same
 * cover-and-centre arithmetic has to be repeated here or every tick lands
 * offset from the animal a finger can see.
 */
function sampleArt(href, boxW, boxH) {
  const key = `${href}@${boxW}x${boxH}`;
  if (SAMPLES.has(key)) return SAMPLES.get(key);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.max(boxW / img.naturalWidth, boxH / img.naturalHeight);
        const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
        const gw = ART_GRID_W, gh = Math.round(gw * (boxH / boxW));
        const c = document.createElement('canvas');
        c.width = gw; c.height = gh;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        // Draw the same crop the SVG shows: cover the box, centred, then read
        // only the box.
        ctx.drawImage(img, (boxW - dw) / 2 * (gw / boxW), (boxH - dh) / 2 * (gh / boxH),
          dw * (gw / boxW), dh * (gh / boxH));
        const px = ctx.getImageData(0, 0, gw, gh).data;
        const grid = new Float32Array(gw * gh);
        for (let i = 0, p = 0; i < grid.length; i++, p += 4) {
          const a = px[p + 3] / 255;
          const l = (0.2126 * px[p] + 0.7152 * px[p + 1] + 0.0722 * px[p + 2]) / 255;
          // Depth, on the same rule the filter uses: alpha minus luminance.
          grid[i] = Math.max(0, a - l);
        }
        resolve({ grid, gw, gh, boxW, boxH });
      } catch (_) { resolve(null); }   // a tainted canvas costs the animal, not the card
    };
    img.onerror = () => resolve(null);
    img.src = href;
  });
  SAMPLES.set(key, p);
  return p;
}

/**
 * Sample an animal before anything asks for it.
 *
 * The first drag across a card used to be silent, because the artwork had not
 * finished decoding into its grid yet — which reads exactly like a feature that
 * does not work, and is the worst possible first impression of one that does.
 */
export const warmArt = (href, boxW = 401, boxH = 600) => sampleArt(href, boxW, boxH);

/**
 * Everything on this face a finger can find, in the card's own units.
 * Read from the drawing, so it follows the skin rather than duplicating it.
 */
function mapOf(svg) {
  const glyphs = [], rules = [], plates = [];
  for (const t of svg.querySelectorAll('text')) {
    const text = t.textContent || '';
    let n = 0;
    try { n = t.getNumberOfChars(); } catch (_) { continue; }
    for (let i = 0; i < n; i++) {
      if (!/\S/.test(text[i] || '')) continue;      // a space is not a letter
      try {
        const r = t.getExtentOfChar(i);
        if (r.width > 0.5) glyphs.push({ x: r.x, y: r.y, w: r.width, h: r.height, id: `g${glyphs.length}` });
      } catch (_) { /* a glyph that will not measure is one we cannot feel */ }
    }
  }
  for (const p of svg.querySelectorAll('path')) {
    try {
      const b = p.getBBox();
      // A rule is wide and flat. Anything else drawn as a path is not one.
      if (b.width > 40 && b.height < 6) rules.push({ x: b.x, y: b.y - 3, w: b.width, h: b.height + 6, id: `r${rules.length}` });
    } catch (_) {}
  }
  for (const r of svg.querySelectorAll('rect[fill="none"]')) {
    try {
      const b = r.getBBox();
      plates.push({ x: b.x, y: b.y, w: b.width, h: b.height, id: `p${plates.length}` });
    } catch (_) {}
  }
  return { glyphs, rules, plates };
}

const inside = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/** On the plate mark's line, rather than merely inside the rectangle it draws. */
function onPlateEdge(p, x, y, t = 5) {
  if (x < p.x - t || x > p.x + p.w + t || y < p.y - t || y > p.y + p.h + t) return false;
  const nearV = Math.abs(x - p.x) <= t || Math.abs(x - (p.x + p.w)) <= t;
  const nearH = Math.abs(y - p.y) <= t || Math.abs(y - (p.y + p.h)) <= t;
  return nearV || nearH;
}

/**
 * Attach the reader to one face.
 *
 * @param {SVGElement} svg      the drawn card
 * @param {object} opts         { artHref, artBox:{w,h}, haptics, onRead }
 * @returns {function} detach
 */
export function readFace(svg, { artHref, artBox = { w: 401, h: 600 }, haptics = true, onRead } = {}) {
  let map = mapOf(svg);
  let art = null;
  let lastId = '', lastAt = 0;
  let alive = true;

  if (artHref) sampleArt(artHref, artBox.w, artBox.h).then((a) => { if (alive) art = a; });

  const toUser = (clientX, clientY) => {
    const m = svg.getScreenCTM();
    if (!m) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    return pt.matrixTransform(m.inverse());
  };

  /** Depth of the animal under a point, 0 when there is none. */
  function artDepth(x, y) {
    if (!art || x < 0 || y < 0 || x > art.boxW || y > art.boxH) return 0;
    const gx = Math.floor((x / art.boxW) * art.gw);
    const gy = Math.floor((y / art.boxH) * art.gh);
    if (gx < 0 || gy < 0 || gx >= art.gw || gy >= art.gh) return 0;
    const d = art.grid[gy * art.gw + gx];
    return d > (1 - RAISED_BELOW) ? d : 0;
  }

  /** What the finger is on. Letters first: they sit over everything else. */
  function featureAt(x, y) {
    for (const g of map.glyphs) if (inside(g, x, y)) return { kind: GLYPH, id: g.id };
    for (const p of map.plates) if (onPlateEdge(p, x, y)) return { kind: PLATE, id: p.id };
    for (const r of map.rules) if (inside(r, x, y)) return { kind: RULE, id: r.id };
    const d = artDepth(x, y);
    // The animal is one continuous surface, so its "identity" is its depth in
    // steps — otherwise a slow drag across it would tick once and go quiet.
    if (d > 0) return { kind: ART, id: `a${Math.round(x / 9)}:${Math.round(y / 9)}`, depth: d };
    return null;
  }

  function pulse(f) {
    if (!haptics || !canVibrate()) return;
    if (f.kind === ART) {
      const ms = Math.round(PULSE.artMin + (PULSE.artMax - PULSE.artMin) * Math.min(1, f.depth));
      navigator.vibrate(ms);
    } else {
      navigator.vibrate(PULSE[f.kind]);
    }
  }

  function read(clientX, clientY) {
    const u = toUser(clientX, clientY);
    if (!u) return;
    const f = featureAt(u.x, u.y);
    const now = performance.now();
    if (f && f.id !== lastId && now - lastAt >= MIN_GAP_MS) {
      lastId = f.id; lastAt = now;
      pulse(f);
    } else if (!f) {
      lastId = '';
    }
    if (onRead) onRead(f, u);
  }

  // Reading on the way down as well as on the way across: putting a fingertip
  // straight onto a letter should answer, not wait for the finger to travel.
  const onDown = (e) => {
    if (e.pointerType !== 'touch') return;
    lastId = '';
    read(e.clientX, e.clientY);
  };
  const onMove = (e) => { if (e.pointerType === 'touch') read(e.clientX, e.clientY); };
  const onLeave = () => { lastId = ''; if (onRead) onRead(null, null); };

  svg.addEventListener('pointerdown', onDown, { passive: true });
  svg.addEventListener('pointermove', onMove, { passive: true });
  svg.addEventListener('pointerleave', onLeave, { passive: true });
  svg.addEventListener('pointercancel', onLeave, { passive: true });

  return function detach() {
    alive = false;
    svg.removeEventListener('pointerdown', onDown);
    svg.removeEventListener('pointermove', onMove);
    svg.removeEventListener('pointerleave', onLeave);
    svg.removeEventListener('pointercancel', onLeave);
  };
}
