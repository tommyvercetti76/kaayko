/**
 * cards/lamp.js — one lamp, one sheet, and everything the light does to it.
 *
 * Arithmetic only: no DOM, no events, so every claim below is checked in
 * tests/lamp.test.mjs against a brute-force render rather than by holding a
 * phone up to a window.
 *
 * WHY THIS EXISTS
 * ---------------
 * The card used to be lit three times over: a Blinn-Phong sheen with its own
 * idea of where the lamp was, an SVG relief lamp swung by a linear guess
 * (228° + 3.2° per degree of turn), and a room glow parked wherever the
 * pointer happened to be. None of them agreed, the sheen's normal was built
 * for the wrong rotation order with a y-up lamp against a y-down surface, and
 * the glint was drawn where the light *went* after bouncing rather than where
 * you would *see* it. So it never read as one light. This file is the one
 * light: a point in the room, and everything — glint, its shape, how bright
 * it is, how dark the turned-away sheet goes, which way the emboss throws its
 * shadow — is derived from that point and the card's true attitude.
 *
 * THE FRAME
 * ---------
 * CSS's own, measured against DOMMatrix rather than remembered: x right,
 * y DOWN, z toward the viewer. rotateX(+a) tips the top edge away; rotateY(+b)
 * turns the right edge away; `transform: rotateX(a) rotateY(b)` applies Y
 * first and then X. Units are card widths — the card lies in z = 0 at rest,
 * centred on the origin, one wide and 1/ASPECT tall — so the same numbers
 * are right on a 335px phone and a 600px desktop once the eye is placed at
 * `perspective / width`.
 *
 * THE GLINT
 * ---------
 * A card is a plane mirror. The image of a lamp P in a mirror is P reflected
 * through the plane, and you see it where the line from your eye to that
 * image crosses the sheet. That point is exact, not a fit, and at it the
 * half-vector equals the normal, so it is also the peak of Blinn-Phong. The
 * highlight's spread around it is Blinn-Phong's log-intensity, fitted to a
 * quadratic — an ellipse whose long axis lies along the lamp, which is why a
 * glint on a turned sheet is a streak and not a spot.
 */

export const ASPECT = 3.5 / 2;             // width over height
const D2R = Math.PI / 180, R2D = 180 / Math.PI;

export const v = (x, y, z) => ({ x, y, z });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const sub = (a, b) => v(a.x - b.x, a.y - b.y, a.z - b.z);
export const add = (a, b) => v(a.x + b.x, a.y + b.y, a.z + b.z);
export const mul = (a, k) => v(a.x * k, a.y * k, a.z * k);
export const norm = (a) => { const m = Math.hypot(a.x, a.y, a.z) || 1; return v(a.x / m, a.y / m, a.z / m); };

/** Shortest way round the circle, so 179° to -179° is 2° and not 358°. */
export const wrap180 = (d) => ((d % 360) + 540) % 360 - 180;

/**
 * The card's axes after `rotateX(rx) rotateY(ry)`, in the room.
 *
 * ex is the card's own +x (its right edge), ey its +y (down the sheet), n its
 * +z — out of the front face, toward the viewer at rest. Checked in the tests
 * against the numbers DOMMatrix gives for the same transform.
 */
export function frame(rxDeg, ryDeg) {
  const a = rxDeg * D2R, b = ryDeg * D2R;
  const sa = Math.sin(a), ca = Math.cos(a), sb = Math.sin(b), cb = Math.cos(b);
  return {
    ex: v(cb, sa * sb, -ca * sb),
    ey: v(0, ca, sa),
    n: v(sb, -sa * cb, ca * cb),
  };
}

/**
 * Which face is toward the viewer: +1 for the one at rotateY(0) inside the
 * card, -1 for the one at rotateY(180). Which ELEMENT that is depends on
 * whether the card is flipped, which is the page's business, not this one's.
 */
export const facing = (ryDeg) => (Math.abs(wrap180(ryDeg)) < 90 ? 1 : -1);

/**
 * The axes of the face that is up. A face on the far side of the card is the
 * card's frame turned half round about y: its x and its normal both reverse.
 * Everything below is computed in THIS frame, so a value handed to a face's
 * own CSS is already in that face's own coordinates and needs no mirroring.
 */
export function faceFrame(rxDeg, ryDeg) {
  const F = frame(rxDeg, ryDeg);
  const s = facing(ryDeg);
  return { ex: mul(F.ex, s), ey: F.ey, n: mul(F.n, s), side: s };
}

/** A point on the face, in card widths, placed in the room. */
const place = (F, x, y, lift) => mul(add(mul(F.ex, x), mul(F.ey, y)), lift);

/**
 * Where the lamp's reflection is seen on the sheet, in the face's own units
 * (card widths from the centre, y down). null when the lamp is behind it.
 */
export function glint(F, lamp, eye, lift = 1) {
  const pn = dot(lamp, F.n);
  if (pn <= 1e-6) return null;                 // lit from behind: no reflection
  const image = sub(lamp, mul(F.n, 2 * pn));   // the lamp, seen in the mirror
  const ray = sub(image, eye);
  const den = dot(ray, F.n);
  if (den >= -1e-9) return null;               // eye behind the sheet
  const t = -dot(eye, F.n) / den;
  const q = add(eye, mul(ray, t));
  return { x: dot(q, F.ex) / lift, y: dot(q, F.ey) / lift };
}

/** Blinn-Phong at one point of the face: (n · h)^shine, h between lamp and eye. */
export function blinn(F, lamp, eye, lift, shine, x, y) {
  const p = place(F, x, y, lift);
  const l = norm(sub(lamp, p)), e = norm(sub(eye, p));
  const h = norm(add(l, e));
  return Math.pow(Math.max(0, dot(F.n, h)), shine);
}

/**
 * The highlight as an ellipse: a 2D Gaussian fitted to Blinn-Phong's
 * log-intensity about the glint. Returns the two sigmas (card widths) and
 * the angle of the first, in degrees clockwise from the face's +x.
 *
 * The fit is exact for a Gaussian and the lobe is one to well under a
 * percent over the range that is visible; the tests measure that rather
 * than assume it.
 */
export function lobe(F, lamp, eye, lift, shine, q) {
  const d = 0.05;
  const g = (x, y) => -2 * Math.log(Math.max(1e-12, blinn(F, lamp, eye, lift, shine, q.x + x, q.y + y)));
  const A = (g(d, 0) + g(-d, 0)) / (2 * d * d);
  const C = (g(0, d) + g(0, -d)) / (2 * d * d);
  const B = (g(d, d) - g(d, -d) - g(-d, d) + g(-d, -d)) / (8 * d * d);
  // Eigen-decomposition of [[A,B],[B,C]]: the larger eigenvalue is the
  // tighter axis. Clamped: at a true grazing angle the lobe runs to infinity.
  const m = (A + C) / 2, r = Math.hypot((A - C) / 2, B);
  const lo = Math.max(1e-6, m + r), hi = Math.max(1e-6, m - r);
  const angle = 0.5 * Math.atan2(2 * B, A - C) * R2D;
  const sig = (l) => Math.min(3, Math.max(0.03, 1 / Math.sqrt(l)));
  return { s1: sig(lo), s2: sig(hi), angle };
}

/** Schlick's Fresnel: how much of the lamp a dielectric gives back at this angle. */
export const fresnel = (cosTheta, f0) => f0 + (1 - f0) * Math.pow(1 - Math.max(0, Math.min(1, cosTheta)), 5);

/**
 * Everything the page needs for one frame, from one lamp.
 *
 * @param {object} o
 *   rx, ry     the card's attitude, degrees, as written to CSS
 *   lamp       the lamp, a point in the room (card widths)
 *   eye        the viewer, a point in the room — (0, 0, perspective / width)
 *   lift       the card's scale while held
 *   shine      Blinn-Phong exponent of the glint itself
 *   soft       a second, broader exponent: the wash a satin sheet shows
 *              around its glint. Real paper is two lobes, not one — a
 *              one-lobe fit is either a milky sheet or a hard spot.
 *   f0         reflectance at normal incidence
 *   gain       how bright the lamp is next to the sheet; sets the tone-map
 * @returns {object}
 *   side       +1 / -1: which face of the card is up
 *   gx, gy     the glint, card widths from the face's centre, y down
 *   s1, s2     the glint's sigmas, card widths; `angle` of s1, degrees
 *   w1, w2     the wash's sigmas, same glint, same angle convention: `wangle`
 *   peak       0..1, the sheen's strength at the glint
 *   shade      0..1, how far the sheet has turned from the lamp (Lambert)
 *   fres       0..1, the rim's strength (Fresnel at the centre)
 *   L          the lamp's direction in the face's own frame (unit)
 *   rx, ry     the relief's weights: light from +x / -x / +y / -y, 0..1
 */
export function lightFace({ rx, ry, lamp, eye, lift = 1, shine = 46, soft = 9, f0 = 0.045, gain = 30 }) {
  const F = faceFrame(rx, ry);
  const centre = v(0, 0, 0);
  const Lw = norm(sub(lamp, centre));
  const L = v(dot(Lw, F.ex), dot(Lw, F.ey), dot(Lw, F.n));
  const Vc = norm(sub(eye, centre));
  const nv = Math.max(0, dot(F.n, Vc));

  // Lambert at the centre. The sheet is at full brightness facing the lamp
  // and dims as it turns away; a face lit from behind is fully in shade.
  const diff = Math.max(0, L.z);
  const shade = 1 - diff;

  const q = glint(F, lamp, eye, lift);
  let gx = 0, gy = 0, s1 = 1, s2 = 1, angle = 0, w1 = 1, w2 = 1, wangle = 0, peak = 0;
  if (q) {
    ({ x: gx, y: gy } = q);
    ({ s1, s2, angle } = lobe(F, lamp, eye, lift, shine, q));
    ({ s1: w1, s2: w2, angle: wangle } = lobe(F, lamp, eye, lift, soft, q));
    // How much comes back at the glint's angle of incidence, tone-mapped:
    // a lamp is hundreds of times brighter than the paper it lights, so
    // even F0 shows, and the curve saturates rather than clips.
    const p = place(F, gx, gy, lift);
    const cosI = Math.max(0, dot(F.n, norm(sub(eye, p))));
    peak = 1 - Math.exp(-fresnel(cosI, f0) * gain);
  }

  return {
    side: F.side,
    gx, gy, s1, s2, angle, w1, w2, wangle, peak,
    shade,
    fres: fresnel(nv, f0),
    L,
    weights: {
      xp: Math.max(0, L.x), xn: Math.max(0, -L.x),
      yp: Math.max(0, L.y), yn: Math.max(0, -L.y),
    },
  };
}

/** Where a pointer over the card puts the lamp: above the desk, over the cursor. */
export const pointerLamp = (px, py, height = 0.9) => v(px - 0.5, (py - 0.5) / ASPECT, height);
