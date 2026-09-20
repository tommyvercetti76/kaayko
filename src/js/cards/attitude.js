/**
 * cards/attitude.js — how the card hangs, and how it answers the handset.
 *
 * Arithmetic only: no DOM, no events. It lives apart from pages/card.js so it
 * can be run in a test rather than squinted at on a phone, which is how the
 * tilt came to be wired to nothing and shipped twice with nobody able to prove
 * it either way.
 *
 * WHY THE FIRST VERSION WAS NOT SMOOTH
 * ------------------------------------
 * Two reasons, and the second mattered more.
 *
 * It integrated a spring by hand. Stepping velocity and position forward by dt
 * is only approximately right, and how wrong it is depends on the frame time,
 * so the card behaved differently on every device and visibly hitched whenever
 * a frame ran long.
 *
 * And nothing filtered the sensor. A handset's orientation is a fusion of
 * gyroscope and accelerometer and it is NOISY — a phone lying still on a table
 * reports an angle that wanders by a degree or more. Feeding that straight into
 * a spring means faithfully reproducing the jitter. No amount of work on the
 * spring fixes a shaky input.
 *
 * WHAT IT DOES NOW, AND WHERE IT COMES FROM
 * -----------------------------------------
 * The sensor goes through a One Euro filter (Casiez, Roussel & Vogel, CHI
 * 2012), which is the standard answer to exactly this: an adaptive low-pass
 * whose cutoff rises with speed. Hold still and it smooths hard, so the jitter
 * disappears; move fast and it barely filters, so there is no lag. A fixed
 * low-pass has to choose one or the other and is wrong half the time.
 *
 * The angle is then carried by a critically damped spring solved analytically
 * rather than integrated — the SmoothDamp every game engine ships, using a
 * Padé approximation of e^-x. It is unconditionally stable at any timestep,
 * cannot overshoot, and cannot explode when a frame takes 200ms.
 */

/** Shortest way round the circle, so 179° to -179° is 2° and not 358°. */
export const wrap180 = (d) => ((d % 360) + 540) % 360 - 180;

/** Negating zero gives -0, which survives into a CSS string as "-0.00deg". */
export const clamp = (v, lim) => (v > lim ? lim : v < -lim ? -lim : v) + 0;

/* ── One Euro ───────────────────────────────────────────────────────────────
   Two low-passes: one on the value, one on its rate of change. The rate sets
   the cutoff for the value, so the filter loosens its grip exactly when you
   start moving.

   minCutoff sets how still it is when you are still; beta how fast it lets go
   when you move. These three were measured, not guessed: against a simulated
   still hand wandering 2.4 degrees peak to peak, they leave 0.45 and still
   track a thirty-degree sweep.

   dCutoff matters more than it looks. The derivative of noise is enormous —
   1.2 degrees of wander at 60Hz reads as 72 degrees per second — so with the
   derivative loosely filtered, beta held the gate open permanently and
   minCutoff did nothing at all. Filtering the rate hard is what makes the
   adaptive part work.                                                        */

const alpha = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export function oneEuro({ minCutoff = 0.3, beta = 0.01, dCutoff = 0.3 } = {}) {
  let x = null, dx = 0;
  return {
    reset() { x = null; dx = 0; },
    /** @param {number} v raw reading @param {number} dt seconds since the last */
    filter(v, dt) {
      if (dt <= 0) return x === null ? v : x;
      if (x === null) { x = v; return v; }
      // Rate of change, itself smoothed, or one noisy sample opens the gate.
      const rate = (v - x) / dt;
      dx += alpha(dCutoff, dt) * (rate - dx);
      // Moving fast raises the cutoff, which lets more of the signal through.
      const cutoff = minCutoff + beta * Math.abs(dx);
      x += alpha(cutoff, dt) * (v - x);
      return x;
    },
  };
}

/* ── the spring ─────────────────────────────────────────────────────────── */

/**
 * Critically damped spring, solved rather than integrated.
 *
 * `smoothTime` is roughly how long it takes to arrive — the only knob, and it
 * means the same thing on every device. Returns the new position and writes
 * the new velocity back into `v`.
 *
 * Stable at ANY dt: a tab that was backgrounded for ten seconds comes back
 * with the card at its rest angle rather than halfway across the room.
 */
export function smoothDamp(current, target, v, smoothTime, dt) {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * Math.max(0, dt);
  // Padé approximation of e^-x: cheap, and accurate to well past any real dt.
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (v.v + omega * change) * Math.max(0, dt);
  v.v = (v.v - omega * temp) * exp;
  let out = target + (change + temp) * exp;
  // Never sail past the target — the sign of the remaining distance flipping
  // is the only thing that can make a critically damped spring look springy.
  if ((target - current > 0) === (out > target)) {
    out = target;
    v.v = dt > 0 ? (out - target) / dt : 0;
  }
  return out;
}

/* ── the card ───────────────────────────────────────────────────────────── */

/** A fresh attitude, at rest and level. */
export const rest = () => ({
  rx: 0, ry: 0,
  vx: { v: 0 }, vy: { v: 0 },
  tx: 0, ty: 0,
  fb: oneEuro(), fg: oneEuro(),
  rate: { beta: 0, gamma: 0 },
  ref: null,
});

/**
 * Take a handset reading and set the rest angle from it.
 *
 * Measured from the FIRST reading, so level is however you happened to be
 * holding the phone — on a desk, on a knee, or over a table.
 *
 * Both axes are NEGATED. Tip the phone right and the card turns left; tip its
 * top away and it leans toward you. The card holds its plane while the screen
 * moves around it, which is what makes it read as an object in front of you
 * rather than a picture printed on the glass.
 */
export function aimFromDevice(a, beta, gamma, dt, { gain = 1.15, max = 17, lead = 0 } = {}) {
  // Level is averaged over the first fifth of a second, not taken from one
  // sample. A single reading carries the same wander as every other reading,
  // so calibrating on it leaves the card permanently crooked by up to a
  // degree — which is small, constant, and exactly the kind of thing that
  // reads as "the physics is off" without ever being identifiable.
  // The first sample is the anchor; the average is taken over the OFFSETS from
  // it, never over the raw angles. Averaging 179 and -179 gives 0, which is
  // the opposite side of the circle — the card would snap a half turn the
  // moment a hand crossed the boundary.
  if (!a.ref) a.ref = { beta, gamma, ob: 0, og: 0, n: 0 };
  if (a.ref.n < 12) {
    a.ref.n += 1;
    a.ref.ob += (wrap180(beta - a.ref.beta) - a.ref.ob) / a.ref.n;
    a.ref.og += (wrap180(gamma - a.ref.gamma) - a.ref.og) / a.ref.n;
  }
  const b = a.fb.filter(wrap180(beta - a.ref.beta) - a.ref.ob, dt);
  const g = a.fg.filter(wrap180(gamma - a.ref.gamma) - a.ref.og, dt);
  // Lead the filtered angle by the gyroscope. Every smoother costs lag, and on
  // a wrist flick that lag is the whole difference between an object and a
  // recording of one. The rate gyro is a separate sensor that is already
  // reporting the turn while the fused orientation is still catching up, so a
  // short extrapolation along it cancels the smoothing's delay without
  // reintroducing its noise — the noise lives in the ANGLE, not the rate.
  a.tx = clamp(-(b + a.rate.beta * lead) * gain, max);
  a.ty = clamp(-(g + a.rate.gamma * lead) * gain, max);
  return a;
}

/**
 * A gyroscope sample, in degrees per second about the device axes.
 * Smoothed lightly on its own account: the rate is much cleaner than the
 * angle, but it is not clean.
 */
export function feedRate(a, beta, gamma) {
  const k = 0.35;
  a.rate.beta += ((beta || 0) - a.rate.beta) * k;
  a.rate.gamma += ((gamma || 0) - a.rate.gamma) * k;
  return a;
}

/** Advance the card toward its rest angle. */
export function step(a, dt, { smoothTime = 0.12 } = {}) {
  const d = Math.min(Math.max(0, dt), 0.25);
  a.rx = smoothDamp(a.rx, a.tx, a.vx, smoothTime, d);
  a.ry = smoothDamp(a.ry, a.ty, a.vy, smoothTime, d);
  return a;
}

/** Where the lamp sits for a card at this attitude. The room's light is fixed. */
export const lampFor = (ry, base = 228, sweep = 3.2) => base + ry * sweep;
