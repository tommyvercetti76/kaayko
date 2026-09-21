/**
 * cards/emboss.js — the relief, computed once, as pictures.
 *
 * WHY NOT A FILTER
 * ----------------
 * The emboss used to be SVG filters: a height field from the artwork, blurred,
 * differentiated, coloured — fourteen primitives per still, four stills per
 * face, two faces. On iOS that cost 267ms to lay, and it cost the same at
 * half the resolution, which is the tell: WebKit pays per PRIMITIVE, in
 * buffer set-up, not per pixel. Two hundred primitives is two hundred
 * buffers. Without the filters the same layers cost 21ms.
 *
 * So the same arithmetic runs here, once per animal, in a typed array: the
 * height field, a separable Gaussian, a central difference along each axis,
 * and the sign of that difference split into a lit side and a shadowed side.
 * Fifteen milliseconds or so, cached, and what the page lays is five plain
 * canvases per face — the impression's tint and the four stills — which
 * raster as blits.
 *
 * It is the same physics as before, see skins/engraved.js: a Lambert emboss
 * is linear in the light, so each axis is one picture scaled by that axis's
 * component of the lamp, split by sign because a picture cannot be shown at
 * a negative opacity.
 */

const W = 512, H = 768;          // the art files are 802 x 1200; this is enough for a phone at 3x
const COLUMN_UNITS = 401;        // the front's art column, in the face's units: the file is shown at this width

const LIT = [255, 255, 255];
const DARK = [74, 64, 52];       // #4A4034
const TINT = [140, 131, 117];    // #8C8375

const CACHE = new Map();

function load(href) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`emboss: could not load ${href}`));
    img.src = href;
  });
}

/** In place, separable, reflecting at the edges. */
function gaussian(h, w, ht, sigma) {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); sum += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(h.length);
  for (let y = 0; y < ht; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) { let xx = x + i; if (xx < 0) xx = -xx; else if (xx >= w) xx = 2 * w - xx - 2; v += h[row + xx] * k[i + r]; }
      tmp[row + x] = v;
    }
  }
  for (let y = 0; y < ht; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let i = -r; i <= r; i++) { let yy = y + i; if (yy < 0) yy = -yy; else if (yy >= ht) yy = 2 * ht - yy - 2; v += tmp[yy * w + x] * k[i + r]; }
      h[y * w + x] = v;
    }
  }
}

/**
 * The stills of one artwork.
 *
 * @param {string} href           the art file, same-origin
 * @param {object} o
 *   blur   the die's edge, in the face's units (a stdDeviation, as the filter took it)
 *   gain   how hard the light catches a slope
 *   tone   the impression's tint, 0..1, whatever the light does
 * @returns {Promise<{w, h, tint: ImageData, xp: ImageData, xn: ImageData, yp: ImageData, yn: ImageData}>}
 */
export function embossOf(href, { blur = 1.1, gain = 2.4, tone = 0.11 } = {}) {
  const key = `${href}|${blur}|${gain}|${tone}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const p = load(href).then((img) => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;

    // Height: alpha minus luminance, then the same transfer the filter used,
    // so a near-white ground carries no height and the edge of the image
    // does not print as a panel.
    const n = W * H;
    const h = new Float32Array(n);
    for (let i = 0, q = 0; i < n; i++, q += 4) {
      const a = px[q + 3] / 255;
      const l = (0.2126 * px[q] + 0.7152 * px[q + 1] + 0.0722 * px[q + 2]) / 255;
      const v = (a - l) * 1.9 - 0.17;
      h[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
    const unit = W / COLUMN_UNITS;                    // bitmap pixels per face unit
    gaussian(h, W, H, Math.max(0.4, blur * unit));
    const step = Math.max(1, Math.round(1.5 * unit)); // the filter's ±1.5 units

    const out = {};
    for (const k of ['tint', 'xp', 'xn', 'yp', 'yn']) out[k] = new ImageData(W, H);
    const put = (d, i, rgb, a) => { const q = i * 4; d[q] = rgb[0]; d[q + 1] = rgb[1]; d[q + 2] = rgb[2]; d[q + 3] = a > 1 ? 255 : a < 0 ? 0 : Math.round(a * 255); };
    const T = out.tint.data, XP = out.xp.data, XN = out.xn.data, YP = out.yp.data, YN = out.yn.data;
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - step), y1 = Math.min(H - 1, y + step);
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const x0 = Math.max(0, x - step), x1 = Math.min(W - 1, x + step);
        // The rise of the surface toward +x and toward +y (y is down).
        const rx = (h[y * W + x1] - h[y * W + x0]) * gain;
        const ry = (h[y1 * W + x] - h[y0 * W + x]) * gain;
        put(T, i, TINT, h[i] * tone);
        // Light from +x: the surface that climbs toward it is its far side,
        // in shadow; the side that falls toward it is lit. And the reverse.
        if (rx >= 0) { put(XP, i, DARK, rx); put(XN, i, LIT, rx); }
        else { put(XP, i, LIT, -rx); put(XN, i, DARK, -rx); }
        if (ry >= 0) { put(YP, i, DARK, ry); put(YN, i, LIT, ry); }
        else { put(YP, i, LIT, -ry); put(YN, i, DARK, -ry); }
      }
    }
    return { w: W, h: H, ...out };
  });
  CACHE.set(key, p);
  p.catch(() => CACHE.delete(key));
  return p;
}

/** A canvas showing one still, sized to the bitmap; the page sizes it in CSS. */
export function stillCanvas(imageData) {
  const c = document.createElement('canvas');
  c.width = imageData.width; c.height = imageData.height;
  c.getContext('2d').putImageData(imageData, 0, 0);
  return c;
}
