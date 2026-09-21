/**
 * One lamp. Every number the card's lighting writes comes from cards/lamp.js,
 * and the claims it makes are checked here against a brute-force render of
 * the same Blinn-Phong rather than by eye — the previous model had its
 * normal built for the wrong rotation order and its glint drawn where the
 * light went instead of where it was seen, and nobody could tell by looking.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  v, dot, norm, sub, frame, faceFrame, facing, glint, blinn, lobe, lightFace, pointerLamp, ASPECT,
} = await import('/js/cards/lamp.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const nearV = (a, b, tol, msg) => { near(a.x, b.x, tol, msg + '.x'); near(a.y, b.y, tol, msg + '.y'); near(a.z, b.z, tol, msg + '.z'); };

/* ── the frame is CSS's, to four places ────────────────────────────────────
   These are the numbers DOMMatrix('rotateX(20deg) rotateY(40deg)') returns in
   Chrome for the three unit vectors, copied rather than derived, so the test
   fails if anyone "corrects" the rotation order again.                       */
test('frame matches DOMMatrix for rotateX(20deg) rotateY(40deg)', () => {
  const F = frame(20, 40);
  nearV(F.n, v(0.6428, -0.262, 0.7198), 1e-3, 'normal');
  nearV(F.ex, v(0.766, 0.2198, -0.604), 1e-3, 'right');
  nearV(F.ey, v(0, 0.9397, 0.342), 1e-3, 'down');
});

test('rotateX tips the top away and rotateY turns the right edge away', () => {
  near(frame(30, 0).n.y, -0.5, 1e-9, 'rotateX(30) normal points up (y is down)');
  near(frame(0, 30).ex.z, -0.5, 1e-9, 'rotateY(30) right edge goes away');
  // The three axes stay a right-handed orthonormal frame at any attitude.
  for (const [a, b] of [[0, 0], [48, 170], [-30, -95], [12, 359]]) {
    const F = frame(a, b);
    near(dot(F.ex, F.ey), 0, 1e-12, 'ex ⟂ ey');
    near(dot(F.ey, F.n), 0, 1e-12, 'ey ⟂ n');
    near(dot(F.ex, F.n), 0, 1e-12, 'ex ⟂ n');
    const cross = v(F.ex.y * F.ey.z - F.ex.z * F.ey.y, F.ex.z * F.ey.x - F.ex.x * F.ey.z, F.ex.x * F.ey.y - F.ex.y * F.ey.x);
    nearV(cross, F.n, 1e-12, 'ex × ey = n');
  }
});

test('the far face is the card frame turned half round, and it is up past 90°', () => {
  assert.equal(facing(0), 1); assert.equal(facing(89), 1); assert.equal(facing(91), -1);
  assert.equal(facing(180), -1); assert.equal(facing(270), -1); assert.equal(facing(300), 1); assert.equal(facing(-100), -1);
  // At 180° the back face is square to the viewer exactly as the front is at 0°.
  const back = faceFrame(20, 180), front = faceFrame(20, 0);
  nearV(back.n, front.n, 1e-12, 'normal');
  nearV(back.ex, front.ex, 1e-12, 'right');
  nearV(back.ey, front.ey, 1e-12, 'down');
});

/* ── the glint ─────────────────────────────────────────────────────────── */
const EYE = v(0, 0, 1400 / 600);
const LAMP = v(-0.62, -0.80, 1.60);

test('an upper-left lamp is seen upper-left on a square-on sheet', () => {
  const q = glint(faceFrame(0, 0), LAMP, EYE);
  assert.ok(q.x < -0.1 && q.y < -0.1, `glint at ${q.x}, ${q.y}`);
});

test('the glint obeys the law of reflection', () => {
  for (const [a, b] of [[0, 0], [20, -35], [-40, 60], [10, 200], [45, 310]]) {
    const F = faceFrame(a, b);
    const q = glint(F, LAMP, EYE, 1.06);
    if (!q) continue;
    const p = v((F.ex.x * q.x + F.ey.x * q.y) * 1.06, (F.ex.y * q.x + F.ey.y * q.y) * 1.06, (F.ex.z * q.x + F.ey.z * q.y) * 1.06);
    const l = norm(sub(LAMP, p)), e = norm(sub(EYE, p));
    near(dot(l, F.n), dot(e, F.n), 1e-9, `angle in = angle out at ${a},${b}`);
    near(dot(F.n, norm(v(l.x + e.x, l.y + e.y, l.z + e.z))), 1, 1e-9, 'half-vector is the normal');
  }
});

test('the glint is where a brute-force Blinn-Phong peaks', () => {
  for (const [a, b] of [[0, 0], [25, -30], [-20, 40], [30, 190]]) {
    const F = faceFrame(a, b);
    const q = glint(F, LAMP, EYE);
    // Sample the sheet and a wide margin around it: a mirror turned by θ
    // sends the reflection 2θ away, so the peak sits well past an edge at
    // quite modest attitudes, and the test has to look there for it.
    let best = -1, bx = 0, by = 0;
    for (let y = -2; y <= 2; y += 0.01) for (let x = -2; x <= 2; x += 0.01) {
      const i = blinn(F, LAMP, EYE, 1, 14, x, y);
      if (i > best) { best = i; bx = x; by = y; }
    }
    near(bx, q.x, 0.011, `peak x at ${a},${b}`);
    near(by, q.y, 0.011, `peak y at ${a},${b}`);
    near(best, 1, 2e-3, 'the peak is unity');
  }
});

test('the fitted lobe predicts the real lobe to within a few percent', () => {
  for (const [a, b] of [[0, 0], [25, -30], [-15, 25], [10, 200]]) {
    const F = faceFrame(a, b);
    const q = glint(F, LAMP, EYE);
    const { s1, s2, angle } = lobe(F, LAMP, EYE, 1, 14, q);
    const ca = Math.cos(angle * Math.PI / 180), sa = Math.sin(angle * Math.PI / 180);
    // One sigma along each axis should read e^-1/2.
    for (const [dx, dy] of [[s1 * ca, s1 * sa], [-s2 * sa, s2 * ca]]) {
      const i = blinn(F, LAMP, EYE, 1, 14, q.x + dx, q.y + dy);
      near(i, Math.exp(-0.5), 0.05, `1σ at ${a},${b}`);
    }
  }
});

test('the lobe stretches along the lamp as the sheet goes oblique', () => {
  const flat = lightFace({ rx: 0, ry: 0, lamp: LAMP, eye: EYE });
  const turned = lightFace({ rx: 0, ry: -55, lamp: LAMP, eye: EYE });
  assert.ok(turned.s2 / turned.s1 > flat.s2 / flat.s1, 'more eccentric when turned');
});

/* ── the whole frame ───────────────────────────────────────────────────── */
test('lightFace is finite and bounded at every attitude', () => {
  for (let rx = -48; rx <= 48; rx += 12) for (let ry = -180; ry < 180; ry += 15) {
    const r = lightFace({ rx, ry, lamp: LAMP, eye: EYE, lift: 1.06 });
    for (const k of ['gx', 'gy', 's1', 's2', 'angle', 'peak', 'shade', 'fres']) {
      assert.ok(Number.isFinite(r[k]), `${k} at ${rx},${ry}`);
    }
    assert.ok(r.peak >= 0 && r.peak <= 1 && r.shade >= 0 && r.shade <= 1 && r.fres >= 0 && r.fres <= 1);
    const w = r.weights;
    assert.ok(w.xp * w.xn === 0 && w.yp * w.yn === 0, 'one side per axis');
  }
});

test('turning the sheet away from the lamp darkens it, toward brightens it', () => {
  const rest = lightFace({ rx: 0, ry: 0, lamp: LAMP, eye: EYE });
  const toward = lightFace({ rx: 0, ry: -35, lamp: LAMP, eye: EYE });   // faces left, where the lamp is
  const away = lightFace({ rx: 0, ry: 35, lamp: LAMP, eye: EYE });
  assert.ok(toward.shade < rest.shade && rest.shade < away.shade, `${toward.shade} < ${rest.shade} < ${away.shade}`);
});

test('the relief follows the lamp, and flattens when lit head-on', () => {
  const rest = lightFace({ rx: 0, ry: 0, lamp: LAMP, eye: EYE });
  assert.ok(rest.weights.xn > 0 && rest.weights.xp === 0, 'lit from the left at rest');
  assert.ok(rest.weights.yn > 0 && rest.weights.yp === 0, 'lit from above at rest');
  const headOn = lightFace({ rx: 0, ry: 0, lamp: v(0, 0, 2), eye: EYE });
  near(headOn.weights.xn + headOn.weights.xp + headOn.weights.yn + headOn.weights.yp, 0, 1e-12, 'no relief head-on');
  // The face at 180° is lit from the same side of ITS frame as the front is
  // at 0°: the lamp is on the left of whichever face you are looking at.
  const back = lightFace({ rx: 0, ry: 180, lamp: LAMP, eye: EYE });
  near(back.weights.xn, rest.weights.xn, 1e-9, 'back face, same side');
  near(back.gx, rest.gx, 1e-9, 'back face, same glint');
});

test('a lamp behind the sheet gives no glint and full shade', () => {
  const r = lightFace({ rx: 0, ry: 0, lamp: v(0.2, 0.1, -2), eye: EYE });
  assert.equal(r.peak, 0);
  assert.equal(r.shade, 1);
});

test('the pointer lamp sits over the cursor', () => {
  const p = pointerLamp(0, 0);
  near(p.x, -0.5, 1e-12, 'left edge');
  near(p.y, -0.5 / ASPECT, 1e-12, 'top edge');
  const q = glint(faceFrame(0, 0), pointerLamp(0.5, 0.5), EYE);
  near(q.x, 0, 1e-9, 'centred cursor, centred glint');
  near(q.y, 0, 1e-9, 'centred cursor, centred glint');
});
