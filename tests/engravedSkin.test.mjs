/**
 * The engraved set — the two measurements it rests on.
 *
 * Its stocks and its inks were not chosen by eye, and this file is why. Both
 * numbers are the kind that a later "just warm it up a touch" would break
 * silently, because nothing about a colour looks wrong until someone cannot
 * read it, or until a joke that depended on two papers being nearly the same
 * stops being funny.
 *
 *   1. CONTRAST. Text has to clear 4.5:1 on every stock, and the QR has to
 *      clear enough for a phone to find it. Asserted, not asserted-to.
 *   2. dE00. The five stocks have to sit inside a perceptual band: close
 *      enough that the set reads as one sheet, far enough that laying them
 *      side by side is not pointless. Below about 1.0 a pair is invisible to a
 *      normal-vision reader; by about 3.5 a pair is obviously two papers.
 *
 * The maths here is deliberately a second implementation. Copying the values
 * out of the module would only assert that the module equals itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window ??= { location: { hostname: 'kaayko.com', origin: 'https://kaayko.com' } };
globalThis.document ??= {
  readyState: 'complete', addEventListener() {}, querySelectorAll: () => [], getElementById: () => null,
};

const { PRINT } = await import('/js/cards/render.js');
const { STOCKS, engravedFor, stockOf } = await import('/js/cards/skins/engraved.js');

/* ── colour, from first principles ──────────────────────────────────────── */

const srgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h) => { const [r, g, b] = srgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** sRGB -> CIELAB (D65), the input CIEDE2000 actually wants. */
function lab(hex) {
  const [r, g, b] = srgb(hex).map(lin);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000. Long, but it is the only difference metric that matches an eye. */
function de00(h1, h2) {
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const [L1, a1, b1] = lab(h1), [L2, a2, b2] = lab(h2);
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const A1 = (1 + G) * a1, A2 = (1 + G) * a2;
  const P1 = Math.hypot(A1, b1), P2 = Math.hypot(A2, b2);
  const h1p = (Math.atan2(b1, A1) * deg + 360) % 360;
  const h2p = (Math.atan2(b2, A2) * deg + 360) % 360;
  const dLp = L2 - L1, dCp = P2 - P1;
  let dhp = 0;
  if (P1 * P2 !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(P1 * P2) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2, Cbp = (P1 + P2) / 2;
  let hbp = h1p + h2p;
  if (P1 * P2 !== 0) {
    hbp = Math.abs(h1p - h2p) <= 180 ? (h1p + h2p) / 2
      : (h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2);
  }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad)
    + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * (30 * Math.exp(-(((hbp - 275) / 25) ** 2))) * rad)
    * 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2
    + Rt * (dCp / Sc) * (dHp / Sh));
}

test('the difference metric agrees with its own anchors', () => {
  assert.equal(Math.round(de00('#000000', '#FFFFFF')), 100);
  assert.equal(de00('#F6EFE3', '#F6EFE3'), 0);
});

/* ── 1. nothing on the card is unreadable ───────────────────────────────── */

const skins = Object.keys(STOCKS).map((slug) => ({ slug, skin: engravedFor({ slug }, PRINT) }));

test('THE FLOOR — every word on every stock clears 4.5:1', () => {
  for (const { slug, skin } of skins) {
    for (const [role, colour] of [['ink', skin.ink], ['mute', skin.mute]]) {
      const ratio = contrast(colour, skin.paper);
      assert.ok(ratio >= 4.5,
        `${role} ${colour} on ${slug} (${skin.paper}) is ${ratio.toFixed(2)}:1 — under 4.5`);
    }
  }
});

test('the QR is quieted but still has something for a scanner to find', () => {
  for (const { slug, skin } of skins) {
    const ratio = contrast(skin.qrInk, skin.qrPaper);
    assert.ok(ratio >= 4, `QR on ${slug} is ${ratio.toFixed(2)}:1`);
  }
});

/* ── 2. the stocks are almost, but not quite, the same ──────────────────── */

const hexes = Object.values(STOCKS).map((s) => s.hex);
const pairs = hexes.flatMap((a, i) => hexes.slice(i + 1).map((b) => [a, b]));

test('THE JOKE — no two stocks are more than dE00 3.5 apart', () => {
  for (const [a, b] of pairs) {
    const d = de00(a, b);
    assert.ok(d <= 3.5,
      `${a} vs ${b} is dE00 ${d.toFixed(2)} — far enough apart to be obviously two papers, which is not the joke`);
  }
});

test('at least one pair is genuinely indistinguishable, which is the point', () => {
  const closest = Math.min(...pairs.map(([a, b]) => de00(a, b)));
  assert.ok(closest <= 1.2, `the closest pair is dE00 ${closest.toFixed(2)} — nothing here is hard to tell apart`);
});

test('and no two stocks are the same colour, because then there is nothing to compare', () => {
  assert.equal(new Set(hexes).size, hexes.length);
  for (const [a, b] of pairs) assert.ok(de00(a, b) > 0.3, `${a} and ${b} are the same paper`);
});

/* ── the skin stays a skin ──────────────────────────────────────────────── */

test('THE GUARD — asking for the engraved skin does not disturb the printed one', () => {
  const before = JSON.stringify(PRINT, (k, v) => (typeof v === 'function' ? 'fn' : v));
  Object.keys(STOCKS).forEach((slug) => engravedFor({ slug }, PRINT, 'f'));
  assert.equal(JSON.stringify(PRINT, (k, v) => (typeof v === 'function' ? 'fn' : v)), before);
  assert.ok(Object.isFrozen(PRINT));
});

test('filter ids are unique per card AND per face, since an id is document-wide', () => {
  const ids = [];
  for (const slug of Object.keys(STOCKS)) {
    for (const face of ['f', 'b']) {
      const s = engravedFor({ slug }, PRINT, face);
      ids.push(...[...s.defs.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    }
  }
  assert.equal(new Set(ids).size, ids.length, `duplicate filter id among ${ids.length}`);
});

test('the five accents become one, which is the largest single subtraction', () => {
  const accents = new Set(skins.map(({ skin }) => skin.accentOf({ accent: '#8A5A2B' })));
  assert.equal(accents.size, 1);
});

test('a card nobody planned for still gets a stock rather than a crash', () => {
  const s = engravedFor({ slug: 'a-sixth-thing' }, PRINT);
  assert.ok(s.paper.startsWith('#'));
  assert.equal(stockOf({ slug: 'a-sixth-thing' }).name, 'Bone');
  assert.ok(!/[^a-z0-9-]/.test(s.artFilter.slice(5, -1).replace(/-(deboss|raise)$/, '').replace(/^kx-/, '')));
});

test('a slug that is trying to break out of the filter id cannot', () => {
  const s = engravedFor({ slug: 'x"/><script>alert(1)</script>' }, PRINT);
  assert.ok(!s.defs.includes('<script>'));
  assert.ok(!s.artFilter.includes('"'));
});
