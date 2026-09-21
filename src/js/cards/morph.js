/**
 * cards/morph.js — the skull becomes the rose.
 *
 * WHAT THIS IS
 * ------------
 * The control that turns the engraved set on is a picture: a skull for the
 * set in colour, a rose for the set engraved. Pressing it used to crossfade
 * the one into the other by way of a third drawing, which is what a slide
 * deck does. This is the other thing a drawing can do: come apart.
 *
 * Every line of the skull is sampled into a cloud of gold dust — the ink is
 * read off the actual image, so the dust IS the skull, to the pixel — and
 * every grain is given a place in the rose. Pressed, the skull lifts off the
 * page as dust, turns once through the air, and settles as the rose. Pressed
 * again it goes back the same way. Nothing is invented between the two: the
 * grains are the same grains, and a grain's journey is a curve from the one
 * place it was to the one place it is going.
 *
 * WHO GOES WHERE
 * --------------
 * A grain of the skull's left eye should become a grain of the rose's left
 * petal, not fly across to the right — or the cloud passes through itself and
 * reads as static. Both clouds are sorted along a Hilbert curve, which visits
 * a plane in an order that keeps neighbours together, and the n-th grain of
 * one is paired with the n-th grain of the other. It is the cheap answer to
 * an assignment problem, and for two shapes of about the same size and place
 * it is nearly the right one.
 *
 * It is a canvas because a thousand dots moving for a second is what a
 * canvas is for. It runs at the frame rate, on the compositor's schedule,
 * and is gone from the page as soon as it is done.
 */

const D2R = Math.PI / 180;

/** Position on a Hilbert curve of order n (n a power of two) for a cell (x, y). */
function hilbert(n, x, y) {
  let d = 0;
  for (let s = n >> 1; s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
      const t = x; x = y; y = t;
    }
  }
  return d;
}

/** A cheap, deterministic hash to (0, 1): the same grain jitters the same way every time. */
const hash = (i, k) => {
  let h = (i * 374761393 + k * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * Read the ink off an image into `count` points in a unit frame: x and y in
 * -0.5..0.5, y down, the frame being the box the image is drawn in with
 * `object-fit: contain`. The image must be decoded and same-origin.
 */
function inkOf(img, count, w = 112, h = 156) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
  const s = Math.min(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  let px;
  try { px = ctx.getImageData(0, 0, w, h).data; } catch (_) { return null; }
  const pts = [];
  const N = 256;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = px[(y * w + x) * 4 + 3];
    if (a < 48) continue;
    pts.push({ x: (x + 0.5) / w - 0.5, y: (y + 0.5) / h - 0.5, d: hilbert(N, Math.floor(x * N / w), Math.floor(y * N / h)) });
  }
  if (!pts.length) return null;
  pts.sort((a, b) => a.d - b.d);
  // `count` grains spread evenly along the curve, so the cloud is the whole
  // drawing at a uniform density and not the first half of it.
  const out = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const p = pts[Math.min(pts.length - 1, Math.floor((i + 0.5) * pts.length / count))];
    out[i * 2] = p.x; out[i * 2 + 1] = p.y;
  }
  return out;
}

/**
 * @param {object} o
 *   stage    the element the two images sit in; the canvas is centred on it
 *   canvas   a <canvas> already in the stage, sized `scale` times the stage
 *   from     the skull <img>
 *   to       the rose <img>
 *   count    grains
 *   scale    how many stage-widths across the canvas is
 *   colour   [r, g, b] of the dust
 * @returns {{ play(dir: 'to'|'back'): Promise<void>, busy(): boolean }}
 */
export function dustMorph({ stage, canvas, from, to, count = 720, scale = 3, colour = [214, 183, 120], duration = 1150 }) {
  let A = null, B = null, raf = 0, running = false;
  const [cr, cg, cb] = colour;

  function prepare() {
    if (A && B) return true;
    if (!(from.complete && to.complete && from.naturalWidth && to.naturalWidth)) return false;
    A = inkOf(from, count); B = inkOf(to, count);
    return !!(A && B);
  }

  function fit() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = r.width * scale, ch = r.height * scale;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    }
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    return { sw: r.width, sh: r.height, dpr };
  }

  /**
   * One frame. `e` is the overall progress, 0..1; each grain runs its own
   * clock inside it, so the cloud leaves as a wave and arrives as one.
   */
  function draw(ctx, e, src, dst, geom) {
    const { sw, sh, dpr } = geom;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Additive, so grains that cross each other flare — but the grains are
    // small and faint enough that only a crossing does. Big bright dots
    // drawn this way fuse into one white blob, which is what the first
    // version was: a cloud with no grain in it.
    ctx.globalCompositeOperation = 'lighter';
    const dot = 0.42 * (sw / 26) * dpr;
    for (let i = 0; i < count; i++) {
      const j = i * 2;
      const stagger = hash(i, 1) * 0.30;
      let t = (e - stagger) / 0.70;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const s = t * t * t * (t * (t * 6 - 15) + 10);         // smootherstep: still at both ends
      const ax = src[j] * sw, ay = src[j + 1] * sh;
      const bx = dst[j] * sw, by = dst[j + 1] * sh;
      const dx = bx - ax, dy = by - ay;
      // The path bows to one side, all grains the same way, so the cloud
      // turns once in the air rather than sliding. It bows more for grains
      // that have further to go.
      const bow = Math.sin(Math.PI * s) * (0.28 + 0.22 * hash(i, 2));
      let x = ax + dx * s - dy * bow;
      let y = ay + dy * s + dx * bow;
      // And the whole cloud breathes out mid-flight and settles back in.
      const breath = 1 + 0.32 * Math.sin(Math.PI * s);
      x *= breath; y *= breath;
      // A grain in the air catches the light; on the page it is ink.
      const air = Math.sin(Math.PI * s);
      const a = 0.34 + 0.30 * air;
      const r = dot * (0.75 + 0.5 * hash(i, 3)) * (1 + 0.5 * air);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx + x * dpr, cy + y * dpr, r, 0, 6.2832);
      ctx.fill();
    }
  }

  function play(dir) {
    if (running || !prepare()) return Promise.resolve(false);
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(false);
    const src = dir === 'back' ? B : A, dst = dir === 'back' ? A : B;
    const geom = fit();
    running = true;
    stage.classList.add('is-dusting');
    canvas.style.opacity = '1';
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = (now) => {
        const e = Math.min(1, (now - t0) / duration);
        draw(ctx, e, src, dst, geom);
        // The real drawing fades in under the last of the dust, so the
        // hand-off is a settle and not a cut.
        if (e >= 0.86) stage.classList.remove('is-dusting');
        if (e < 1) { raf = requestAnimationFrame(tick); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.opacity = '0';
        running = false; raf = 0;
        resolve(true);
      };
      raf = requestAnimationFrame(tick);
    });
  }

  return { play, busy: () => running };
}
