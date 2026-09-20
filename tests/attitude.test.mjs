/**
 * The card's attitude — the part that was wired to nothing three times.
 *
 * The tilt shipped twice looking correct and doing nothing, because the only
 * way anyone could check it was to hold a phone and squint. The arithmetic now
 * lives in a module with no DOM in it, and these are the claims it makes:
 * the reversal is a real reversal, level is wherever you started, and the
 * spring settles rather than sliding or wobbling.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { wrap180, clamp, restAngle, rest, step, lampFor } =
  await import('/js/cards/attitude.js');

test('wrap180 takes the short way round', () => {
  assert.equal(wrap180(10), 10);
  assert.equal(wrap180(-10), -10);
  assert.equal(wrap180(350), -10);      // not 350
  assert.equal(wrap180(-350), 10);
  assert.equal(wrap180(180), -180);
  assert.equal(wrap180(0), 0);
});

test('THE REVERSAL — tip the phone right, the card turns left', () => {
  const ref = { beta: 52, gamma: 0 };
  const right = restAngle(ref, 52, 15);
  const left = restAngle(ref, 52, -15);
  assert.ok(right.ry < 0, `phone right should give negative rotateY, got ${right.ry}`);
  assert.ok(left.ry > 0, `phone left should give positive rotateY, got ${left.ry}`);
  assert.equal(right.ry, -left.ry);
});

test('THE REVERSAL — tip the top away, the card leans toward you', () => {
  const ref = { beta: 52, gamma: 0 };
  assert.ok(restAngle(ref, 70, 0).rx < 0);
  assert.ok(restAngle(ref, 34, 0).rx > 0);
});

test('level is wherever you were holding it, not an assumed posture', () => {
  // Flat on a desk, and propped up on a knee, must both start at zero.
  for (const posture of [{ beta: 0, gamma: 0 }, { beta: 52, gamma: 3 }, { beta: 88, gamma: -40 }]) {
    const a = restAngle(posture, posture.beta, posture.gamma);
    assert.equal(a.rx, 0);
    assert.equal(a.ry, 0);
  }
});

test('a violent tilt is clamped, so the card never turns edge-on', () => {
  const ref = { beta: 0, gamma: 0 };
  const a = restAngle(ref, 90, 90, { max: 17 });
  assert.equal(a.rx, -17);
  assert.equal(a.ry, -17);
  assert.ok(Math.abs(restAngle(ref, -90, -90).rx) <= 17);
});

test('crossing the 180 boundary does not spin the card', () => {
  const ref = { beta: 0, gamma: 179 };
  const a = restAngle(ref, 0, -179);   // two degrees of real movement
  assert.ok(Math.abs(a.ry) < 4, `expected a small angle, got ${a.ry}`);
});

/* ── the spring ─────────────────────────────────────────────────────────── */

const settle = (a, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) step(a, dt);
  return a;
};

test('THE SPRING — it reaches the angle it was asked for', () => {
  const a = rest();
  a.ty = 12;
  settle(a, 2);
  assert.ok(Math.abs(a.ry - 12) < 0.1, `settled at ${a.ry}, wanted 12`);
  assert.ok(Math.abs(a.vy) < 0.5, 'and it should be still when it gets there');
});

test('it overshoots once, because paper has mass', () => {
  const a = rest();
  a.ty = 10;
  let peak = 0;
  for (let t = 0; t < 2; t += 1 / 60) { step(a, 1 / 60); peak = Math.max(peak, a.ry); }
  assert.ok(peak > 10, `expected a little overshoot, peaked at ${peak}`);
  assert.ok(peak < 12.5, `but not a wobble — peaked at ${peak}`);
});

test('it settles once and does not oscillate', () => {
  const a = rest();
  a.ty = 10;
  const trail = [];
  for (let t = 0; t < 2.5; t += 1 / 60) { step(a, 1 / 60); trail.push(a.ry); }
  // count direction changes after the first overshoot
  let turns = 0;
  for (let i = 2; i < trail.length; i++) {
    const p = trail[i - 1] - trail[i - 2], q = trail[i] - trail[i - 1];
    if (p > 0.001 && q < -0.001) turns++;
  }
  assert.ok(turns <= 1, `a damped card turns back once at most, turned ${turns}`);
});

test('the same spring behaves the same at 60Hz and at 120Hz', () => {
  const slow = rest(); slow.ty = 14; settle(slow, 1.5, 1 / 60);
  const fast = rest(); fast.ty = 14; settle(fast, 1.5, 1 / 120);
  assert.ok(Math.abs(slow.ry - fast.ry) < 0.2,
    `60Hz ended at ${slow.ry.toFixed(2)}, 120Hz at ${fast.ry.toFixed(2)}`);
});

test('a huge frame gap cannot fling the card across the room', () => {
  const a = rest();
  a.ty = 15;
  step(a, 5);                    // tab was in the background for five seconds
  assert.ok(Number.isFinite(a.ry) && Math.abs(a.ry) < 60, `flew to ${a.ry}`);
});

test('the lamp swings with the card, since the room light is fixed', () => {
  assert.ok(lampFor(10) > lampFor(-10));
  assert.equal(lampFor(0), 228);
});
