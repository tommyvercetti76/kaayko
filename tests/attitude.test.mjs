/**
 * The card's attitude.
 *
 * It was wired to nothing twice, and then it was jittery, and in both cases
 * the only way to judge it was to hold a phone and squint. So the arithmetic
 * has no DOM in it and the claims are made out loud here — including the one
 * that matters most and is hardest to eyeball: that a noisy sensor does not
 * reach the card.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { wrap180, clamp, oneEuro, smoothDamp, rest, step, aimFromDevice, feedRate } =
  await import('/js/cards/attitude.js');

const FRAME = 1 / 60;

test('wrap180 takes the short way round', () => {
  assert.equal(wrap180(10), 10);
  assert.equal(wrap180(350), -10);
  assert.equal(wrap180(-350), 10);
  assert.equal(wrap180(0), 0);
});

test('clamp never returns negative zero, which would reach CSS as "-0deg"', () => {
  assert.ok(Object.is(clamp(-0, 17), 0));
  assert.equal(clamp(50, 17), 17);
  assert.equal(clamp(-50, 17), -17);
});

/* ── the filter, which is the part that makes it smooth ─────────────────── */

/** A still hand: a fixed angle plus the wander a real handset reports. */
function* stillHand(angle, noise, n, seed = 7) {
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    yield angle + ((s / 0x7fffffff) * 2 - 1) * noise;
  }
}

const spread = (xs) => Math.max(...xs) - Math.min(...xs);

test('THE POINT — a still hand stops shaking the card', () => {
  const raw = [...stillHand(12, 1.2, 240)];
  const f = oneEuro();
  const out = raw.map((v) => f.filter(v, FRAME)).slice(60);   // past the settle
  const before = spread(raw), after = spread(out);
  assert.ok(after < before / 4,
    `noise ${before.toFixed(2)}° in, ${after.toFixed(2)}° out — not enough rejection`);
  assert.ok(after < 0.6, `${after.toFixed(2)}° of residual wander is still visible`);
});

test('but a deliberate move is not smothered — it keeps up', () => {
  const f = oneEuro();
  let v = 0;
  // A fast sweep: thirty degrees over a third of a second.
  for (let i = 0; i < 20; i++) v = f.filter(i * 1.5, FRAME);
  assert.ok(v > 20, `only reached ${v.toFixed(1)}° of 28.5° — that is lag you would feel`);
});

test('the filter tracks a slow drift without a permanent offset', () => {
  const f = oneEuro();
  let v = 0;
  for (let i = 0; i < 300; i++) v = f.filter(10, FRAME);
  assert.ok(Math.abs(v - 10) < 0.05, `settled at ${v.toFixed(3)}, wanted 10`);
});

/* ── the spring ─────────────────────────────────────────────────────────── */

const settle = (a, seconds, dt = FRAME) => {
  for (let t = 0; t < seconds; t += dt) step(a, dt);
  return a;
};

test('THE SPRING — it arrives, and it is still when it gets there', () => {
  const a = rest();
  a.ty = 12;
  settle(a, 1.5);
  assert.ok(Math.abs(a.ry - 12) < 0.05, `settled at ${a.ry.toFixed(3)}`);
  assert.ok(Math.abs(a.vy.v) < 0.5);
});

test('it NEVER overshoots — critically damped, so nothing wobbles', () => {
  const a = rest();
  a.ty = 10;
  let peak = 0;
  for (let t = 0; t < 2; t += FRAME) { step(a, FRAME); peak = Math.max(peak, a.ry); }
  assert.ok(peak <= 10.0001, `overshot to ${peak.toFixed(4)}`);
});

test('it moves monotonically — no frame ever goes backwards', () => {
  const a = rest();
  a.ty = 14;
  let prev = -Infinity, backs = 0;
  for (let t = 0; t < 1.5; t += FRAME) {
    step(a, FRAME);
    if (a.ry < prev - 1e-9) backs++;
    prev = a.ry;
  }
  assert.equal(backs, 0, `${backs} frames went the wrong way — that reads as a stutter`);
});

test('identical at 60Hz, 120Hz and a ragged frame rate', () => {
  const at = (dt) => { const a = rest(); a.ty = 14; settle(a, 1.2, dt); return a.ry; };
  const a60 = at(FRAME), a120 = at(1 / 120);
  assert.ok(Math.abs(a60 - a120) < 0.05, `60Hz ${a60.toFixed(3)} vs 120Hz ${a120.toFixed(3)}`);
  // and a stuttering device, alternating long and short frames
  const ragged = rest(); ragged.ty = 14;
  for (let i = 0; i < 90; i++) step(ragged, i % 2 ? 0.004 : 0.029);
  assert.ok(Math.abs(ragged.ry - a60) < 0.4, `ragged ended at ${ragged.ry.toFixed(3)}`);
});

test('a backgrounded tab does not fling the card across the room', () => {
  const a = rest();
  a.ty = 15;
  step(a, 10);
  assert.ok(Number.isFinite(a.ry));
  assert.ok(Math.abs(a.ry) <= 15.0001, `flew to ${a.ry}`);
});

/* ── the reversal ───────────────────────────────────────────────────────── */

test('THE REVERSAL — tip the phone right, the card turns left', () => {
  const a = rest();
  aimFromDevice(a, 52, 0, FRAME);                 // first reading is level
  for (let i = 0; i < 40; i++) aimFromDevice(a, 52, 15, FRAME);
  assert.ok(a.ty < 0, `phone right should give negative rotateY, got ${a.ty}`);

  const b = rest();
  aimFromDevice(b, 52, 0, FRAME);
  for (let i = 0; i < 40; i++) aimFromDevice(b, 52, -15, FRAME);
  assert.ok(b.ty > 0, `phone left should give positive rotateY, got ${b.ty}`);
});

test('THE REVERSAL — tip the top away, the card leans toward you', () => {
  const a = rest();
  for (let i = 0; i < 15; i++) aimFromDevice(a, 52, 0, FRAME);
  for (let i = 0; i < 40; i++) aimFromDevice(a, 74, 0, FRAME);
  assert.ok(a.tx < 0, `got ${a.tx}`);
});

test('level is wherever you were holding it, not an assumed posture', () => {
  for (const [beta, gamma] of [[0, 0], [52, 3], [88, -40]]) {
    const a = rest();
    for (let i = 0; i < 15; i++) aimFromDevice(a, beta, gamma, FRAME);
    assert.ok(Math.abs(a.tx) < 0.001, `${beta}/${gamma} gave tx ${a.tx}`);
    assert.ok(Math.abs(a.ty) < 0.001, `${beta}/${gamma} gave ty ${a.ty}`);
  }
});

test('a violent tilt is clamped, so the card never turns edge-on', () => {
  const a = rest();
  for (let i = 0; i < 15; i++) aimFromDevice(a, 0, 0, FRAME);
  for (let i = 0; i < 80; i++) aimFromDevice(a, 90, 90, FRAME);
  assert.ok(Math.abs(a.tx) <= 17 && Math.abs(a.ty) <= 17);
});

test('crossing the 180 boundary does not spin the card', () => {
  const a = rest();
  for (let i = 0; i < 15; i++) aimFromDevice(a, 0, 179, FRAME);   // level, at the seam
  for (let i = 0; i < 40; i++) aimFromDevice(a, 0, -179, FRAME);  // two degrees across it
  assert.ok(Math.abs(a.ty) < 5, `two degrees of movement gave ${a.ty.toFixed(1)}°`);
});

test('END TO END — a shaky hand holding still leaves the card still', () => {
  const a = rest();
  for (let i = 0; i < 15; i++) aimFromDevice(a, 52, 0, FRAME);
  const seen = [];
  for (const g of stillHand(0, 1.0, 300)) {
    aimFromDevice(a, 52, g, FRAME);
    step(a, FRAME);
    seen.push(a.ry);
  }
  const tail = seen.slice(150);
  assert.ok(spread(tail) < 0.35,
    `the card still wanders ${spread(tail).toFixed(2)}° with a still hand`);
});
/* ── the gyroscope lead ──────────────────────────────────────────────────────
   Every smoother costs lag. On a wrist flick that lag is the difference
   between an object and a recording of one, and it is the thing that cannot be
   checked by reading the code. These run the whole chain — noisy fused angle
   in, card angle out — at the rate a handset actually reports.              */

const HAND = 1 / 60;

/** A hand: a held angle, sensor wander, and an honest gyro reading. */
function* hand(gammaAt, seconds, noise = 1.1, seed = 4) {
  let s = seed, t = 0, prev = gammaAt(0);
  while (t < seconds) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const g = gammaAt(t);
    const rate = (g - prev) / HAND;            // deg/s, as rotationRate reports
    prev = g;
    yield { gamma: g + ((s / 0x7fffffff) * 2 - 1) * noise, rate, t };
    t += HAND;
  }
}

function run(gammaAt, seconds, lead) {
  const a = rest();
  const out = [];
  for (const { gamma, rate, t } of hand(gammaAt, seconds)) {
    feedRate(a, 0, rate);
    aimFromDevice(a, 52, gamma, HAND, { lead });
    step(a, HAND);
    out.push({ t, ry: a.ry, want: -gammaAt(t) * 1.15 });
  }
  return out;
}

test('THE LEAD — it cancels the smoothing lag on a wrist flick', () => {
  // A flick: twenty degrees in a fifth of a second, then held.
  const flick = (t) => (t < 0.2 ? (t / 0.2) * 20 : 20);
  const lagOf = (lead) => {
    const r = run(flick, 0.6, lead).find((p) => p.t >= 0.2);
    return Math.abs(r.want - r.ry);           // how far behind at the end of the flick
  };
  const without = lagOf(0), withLead = lagOf(0.07);
  assert.ok(withLead < without,
    `lead made it worse: ${withLead.toFixed(2)}° behind vs ${without.toFixed(2)}°`);
  assert.ok(withLead < without * 0.75,
    `only ${(100 - withLead / without * 100).toFixed(0)}% of the lag removed`);
});

test('and the lead does NOT reintroduce jitter when the hand is still', () => {
  const tail = run(() => 0, 3, 0.07).slice(120).map((p) => p.ry);
  const wander = Math.max(...tail) - Math.min(...tail);
  assert.ok(wander < 0.4, `${wander.toFixed(2)}° of wander with the lead on`);
});

test('the card lands exactly where the hand is, lead or no lead', () => {
  // Level is the FIRST reading, so the hand has to start somewhere and move.
  const held = (t) => (t < 0.35 ? 0 : 12);   // hold level while it calibrates
  for (const lead of [0, 0.07]) {
    const end = run(held, 2.5, lead).at(-1);
    assert.ok(Math.abs(end.ry - (-12 * 1.15)) < 0.4,
      `lead ${lead}: settled at ${end.ry.toFixed(2)}, hand is at ${(-12 * 1.15).toFixed(2)}`);
  }
});

test('a gyro that reports nothing degrades to the filtered angle, not to zero', () => {
  const a = rest();
  for (let i = 0; i < 15; i++) aimFromDevice(a, 52, 0, HAND, { lead: 0.07 });   // level
  for (let i = 0; i < 200; i++) {
    aimFromDevice(a, 52, 10, HAND, { lead: 0.07 });   // feedRate never called
    step(a, HAND);
  }
  assert.ok(Math.abs(a.ry - (-10 * 1.15)) < 0.4,
    `a card with no gyroscope should still follow the angle; got ${a.ry.toFixed(2)}`);
});
