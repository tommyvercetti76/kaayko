/**
 * cards/attitude.js — how the card hangs, and how it answers the handset.
 *
 * This is the arithmetic only: no DOM, no events, no listeners. It lives apart
 * from pages/card.js so it can be run and checked in a test rather than
 * squinted at in a phone, which is how the tilt came to be wired to nothing at
 * all and shipped three times without anybody able to prove it either way.
 *
 * THE MODEL
 * ---------
 * A card held in the fingers is a small stiff thing with mass. It does not
 * slide to a new angle and stop dead; it swings slightly past and settles. So
 * each axis is a damped spring — position, velocity, and a rest angle it is
 * pulled toward — and not an easing curve.
 *
 * THE REVERSAL
 * ------------
 * Rest angle comes from the handset's own attitude, negated. Tip the phone
 * right and the card turns left; tip its top away and the card leans toward
 * you. The card is holding still while the screen moves around it, which is
 * what makes it read as an object lying in front of you rather than a picture
 * printed on the glass.
 *
 * Everything is measured from the FIRST reading rather than from an assumed
 * posture, so level is however you happened to be holding the phone: on a
 * desk, on a knee, or over a table.
 */

/** Shortest way round the circle, so 179° to -179° is 2° and not 358°. */
export const wrap180 = (d) => ((d % 360) + 540) % 360 - 180;

// The `+ 0` is not decoration: negating zero gives -0, which survives all the
// way into a CSS string as "-0.00deg".
export const clamp = (v, lim) => (v > lim ? lim : v < -lim ? -lim : v) + 0;

/**
 * The rest angle for a handset reading, relative to where it started.
 * Both axes are negated — that is the whole point.
 *
 * @param {{beta:number, gamma:number}} ref   the first reading; level
 * @param {number} beta   front-to-back, degrees
 * @param {number} gamma  left-to-right, degrees
 * @param {{gain?:number, max?:number}} opts
 * @returns {{rx:number, ry:number}} degrees for rotateX and rotateY
 */
export function restAngle(ref, beta, gamma, { gain = 1.15, max = 17 } = {}) {
  const db = wrap180(beta - ref.beta);
  const dg = wrap180(gamma - ref.gamma);
  return { rx: clamp(-db * gain, max), ry: clamp(-dg * gain, max) };
}

/** A fresh attitude, at rest and level. */
export const rest = () => ({ rx: 0, ry: 0, vx: 0, vy: 0, tx: 0, ty: 0 });

/**
 * Advance the spring by dt seconds.
 *
 * DAMP is set near critical for this stiffness — 2*sqrt(SPRING) is about 24.5,
 * and 17 sits just under it, so the card overshoots once by a hair and stops.
 * Above critical it crawls in dead and feels like a slideshow; far below it
 * wobbles like jelly and feels cheap.
 *
 * dt is passed in rather than assumed, so the same spring behaves identically
 * on a 120Hz phone and a 60Hz laptop.
 */
export function step(a, dt, { spring = 150, damp = 17 } = {}) {
  const d = Math.min(dt, 0.05);            // a backgrounded tab returns a huge first step
  a.vx += ((a.tx - a.rx) * spring - a.vx * damp) * d;
  a.vy += ((a.ty - a.ry) * spring - a.vy * damp) * d;
  a.rx += a.vx * d;
  a.ry += a.vy * d;
  return a;
}

/** Where the lamp sits for a card at this attitude. The room's light is fixed. */
export const lampFor = (ry, base = 228, sweep = 3.2) => base + ry * sweep;
