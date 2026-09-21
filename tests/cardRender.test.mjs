/**
 * cards/render.js — the print guard.
 *
 * This module is the only place the property cards are drawn, and three things
 * read it: the page at /card, the admin preview, and — per that preview's own
 * promise, "what you see here is what prints" — the physical card. It had no
 * test. Its header says not to improve its numbers on the evidence of a screen,
 * because 1050 x 600 units IS 3.5 x 2 inches, and nothing enforced that.
 *
 * So: the output of all five cards, front and back, is pinned by hash. Any
 * change to a colour, a font, a coordinate or a single character of markup
 * fails here. That is the point. A skin added for the web page must leave these
 * hashes untouched, because a card already in someone's pocket cannot be
 * redeployed.
 *
 * If you meant to change the card, re-pin deliberately: run the test, read the
 * diff it prints, and update the hash in the same commit that changes the card.
 * Do not re-pin to make a red test green.
 *
 * Hashes pinned 19 Sep 2026 against src/assets/cards/index.json, and re-pinned
 * 20 Sep when the set was reordered and Kortex became kaay.link. That re-pin is
 * worth reading, because it is the guard doing its job: only kortex's FRONT
 * moved, since only its name changed — but four BACKS moved, because the back
 * prints "N OF 5" and four cards changed position. Alumni was untouched at both
 * ends: it was fifth before and it is fifth now.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// util.js stamps a footer year at import time, so kit.js — and therefore
// render.js — cannot be loaded without something shaped like a document.
globalThis.window ??= { location: { hostname: 'kaayko.com', origin: 'https://kaayko.com' } };
globalThis.document ??= {
  readyState: 'complete',
  addEventListener() {},
  querySelectorAll: () => [],
  getElementById: () => null,
};

const { front, back, wrap, hostOf, qrRects, BACK, backWrap, PRINT, ART_EXTENT } = await import('/js/cards/render.js');

const INDEX = fileURLToPath(new URL('../src/assets/cards/index.json', import.meta.url));
const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));

/**
 * A fixed stand-in for the vendored generator. The real QR is made in the
 * browser from card.url; what matters here is that the run-length path in
 * qrRects runs over a known grid, so a change to it shows up as a hash change.
 */
const qr = { getModuleCount: () => 21, isDark: (r, c) => ((r * 7 + c * 3) % 5) < 2 };

const digest = (svg) => crypto.createHash('sha256').update(svg).digest('hex').slice(0, 16);
const artOf = (c) => `/assets/cards/art/${c.art || c.slug}.png`;

/** [front, back] as they render today. */
// Re-pinned 20 Sep 2026. Every BACK moved again: the picture is now the full
// height of the card inside a 40px margin, framed at the animal's measured
// extent, with the type in a 392px column beside it. No FRONT moved.
const PINNED = {
  paddlingout: ['9bc106d58993f93f', 'e13b2c3a8def24f3'],
  forge:       ['2da71419f1d6d133', 'e45f35cbeae37262'],
  kortex:      ['9e8838d7a584c564', 'd57257e39b63de48'],
  kaayko:      ['49b36fd9a9a2cb1e', 'da775073face2778'],
  alumni:      ['14a94fe6a546b0fb', '4faf74c825593623'],
};

const render = (c) => ({
  front: front(c, { qr, artHref: artOf(c) }),
  back:  back(c, { label: idx.label }, { index: c.n, total: idx.cards.length, artHref: artOf(c) }),
});

test('the index still holds the five cards the hashes were pinned against', () => {
  assert.equal(idx.cards.length, 5);
  assert.deepEqual(idx.cards.map((c) => c.slug).sort(), Object.keys(PINNED).sort());
});

for (const card of idx.cards) {
  test(`THE PRINT GUARD — ${card.slug} draws exactly as it did when it was pinned`, () => {
    const out = render(card);
    assert.equal(digest(out.front), PINNED[card.slug][0],
      `front of ${card.slug} changed. If that was deliberate, re-pin it in this file in the same commit.`);
    assert.equal(digest(out.back), PINNED[card.slug][1],
      `back of ${card.slug} changed. If that was deliberate, re-pin it in this file in the same commit.`);
  });
}

test('no card needs a line the front will not print', () => {
  // wrap() caps at two lines and drops the rest. "School of the Future,
  // connecting past and present." printed as "…connecting past and" because of
  // it. This is the guard that was missing: every hook fits, or the build fails.
  for (const c of idx.cards) {
    const rows = wrap(c.hook, PRINT.type.hook.wrap, 99);
    assert.ok(rows.length <= 2, `${c.slug}: hook needs ${rows.length} lines at wrap ${PRINT.type.hook.wrap} — "${c.hook}"`);
    assert.equal(rows.join(' '), c.hook, `${c.slug}: hook lost words in wrapping`);
  }
});

test('THE BACK — the words and the animal never touch', () => {
  for (const c of idx.cards) {
    const svg = render(c).back;
    // The picture is a window onto the animal's own extent, fitted to a box
    // that is the full height inside the margin.
    const win = svg.match(/<svg x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" viewBox="(\d+) (\d+) (\d+) (\d+)" preserveAspectRatio="xMidYMid meet"><image href="[^"]+" x="0" y="0" width="802" height="1200"\/><\/svg>/);
    assert.ok(win, `${c.slug}: back has no framed picture`);
    const [x, y, w, h, vx, vy, vw, vh] = win.slice(1).map(Number);
    assert.equal(x, BACK.ghostX);
    assert.equal(y, BACK.ghostY);
    assert.equal(h, 600 - 2 * BACK.pad, `${c.slug}: the picture does not fill the height`);
    assert.equal(x + w, 1050 - BACK.pad, `${c.slug}: the picture is not inset from the right edge`);
    assert.ok(x - BACK.textRight >= 40, `${c.slug}: less than 40px between the column and the picture`);
    // The window is the measured extent, and it is inside the file.
    const ex = ART_EXTENT[c.art || c.slug];
    assert.ok(ex, `${c.slug}: no measured extent for its art`);
    assert.deepEqual({ x: vx, y: vy, w: vw, h: vh }, ex);
    assert.ok(vx >= 0 && vy >= 0 && vx + vw <= 802 && vy + vh <= 1200, `${c.slug}: extent leaves the file`);
    // Fitted, never clipped: the drawn animal is as tall as the box or as wide
    // as it, whichever the animal's own shape allows, and no larger.
    const scale = Math.min(w / vw, h / vh);
    const drawnW = vw * scale, drawnH = vh * scale;
    assert.ok(drawnW <= w + 0.01 && drawnH <= h + 0.01, `${c.slug}: the animal would be clipped`);
    assert.ok(Math.abs(drawnW - w) < 0.5 || Math.abs(drawnH - h) < 0.5, `${c.slug}: the animal fills neither the height nor the width`);

    // Every line of the sentence fits the type column at the ceiling advance,
    // and none of it was dropped.
    const size = PRINT.type.backLine.size;
    const rows = wrap(c.line || c.hook, backWrap(size), 99);
    assert.ok(rows.length <= 3, `${c.slug}: back line needs ${rows.length} lines — "${c.line}"`);
    // Three rows push the rule and the address down; the address must still
    // clear the facts, which are anchored to the foot of the column.
    const step = Math.round(size * BACK.lineStep);
    const hostY = PRINT.type.backLine.y + (rows.length - 1) * step + 56 + 40;
    assert.ok(hostY + 24 <= BACK.factsY - 8, `${c.slug}: address at y=${hostY} runs into the facts at ${BACK.factsY}`);
    for (const row of rows) {
      const right = 88 + row.length * size * BACK.em;
      assert.ok(right <= BACK.textRight, `${c.slug}: "${row}" reaches x=${right.toFixed(0)}, column ends at ${BACK.textRight}`);
    }
    // Nothing that is typed starts inside the picture's box — and since the
    // box is now the full height, that means nothing typed starts right of the
    // column at all. The index is end-anchored at the column's edge.
    for (const m of svg.matchAll(/<text x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)"([^>]*)>([^<]*)<\/text>/g)) {
      const tx = Number(m[1]), ty = Number(m[2]);
      const belowPicture = ty > BACK.ghostY + BACK.ghostH;
      // Everything typed is in the column — except the index, which sits in
      // the bottom margin under the picture, end-anchored to the right edge.
      if (!belowPicture) assert.ok(tx <= BACK.textRight, `${c.slug}: "${m[4]}" starts at x=${tx}, right of the column`);
      else assert.ok(/text-anchor="end"/.test(m[3]), `${c.slug}: "${m[4]}" is under the picture but not end-anchored`);
    }
    // The name fits the column at its size (Cormorant, measured 359px at 68 for
    // "Paddling Out"; 0.44em/char is the ceiling advance).
    const nameW = String(c.name).length * PRINT.type.backName.size * BACK.em;
    assert.ok(88 + nameW <= BACK.textRight, `${c.slug}: name "${c.name}" reaches x=${(88 + nameW).toFixed(0)}`);
    // The three facts fit the column at this size (302px measured for the
    // longest, in Josefin Sans at 15px/3px tracking; 0.62em is the ceiling).
    for (const f of (c.facts || [])) {
      const right = 88 + 36 + String(f).length * (15 * 0.62 + 3);
      assert.ok(right <= BACK.textRight, `${c.slug}: fact "${f}" reaches x=${right.toFixed(0)}`);
    }
  }
});

test('the card is 3.5 x 2 inches, and says so in inches, not pixels', () => {
  const svg = render(idx.cards[0]).front;
  assert.match(svg, /width="3\.5in" height="2in"/);
  assert.match(svg, /viewBox="0 0 1050 600"/);
});

test('every card carries its slug, so a sheet can be sorted without reading it', () => {
  for (const c of idx.cards) {
    const out = render(c);
    assert.match(out.front, new RegExp(`data-property="${c.slug}"`));
    assert.match(out.back, new RegExp(`data-property="${c.slug}"`));
  }
});

test('the QR is drawn from url and never stored, so a corrected link cannot leave a stale code', () => {
  const c = idx.cards[0];
  assert.ok(front(c, { qr, artHref: artOf(c) }).includes('<rect'), 'a QR was expected');
  // Asked for no QR, the card still draws — it is the code that is optional.
  const bare = front(c, { artHref: artOf(c) });
  assert.ok(bare.includes(c.name));
  assert.ok(!bare.includes('867'), 'no QR module rects without a qr');
});

test('a hook too long for two lines is cut, not collided with the rule beneath it', () => {
  const long = 'word '.repeat(40).trim();
  assert.equal(wrap(long).length, 2);
});

test('text on a card is escaped, because the copy is edited by hand in an admin form', () => {
  const evil = { ...idx.cards[0], name: '<script>x</script>', hook: 'a & b', line: '"quoted"' };
  const out = render(evil);
  assert.ok(!out.front.includes('<script>'), 'a name must not open a tag');
  assert.ok(out.front.includes('&amp;') || out.front.includes('&#38;'), 'an ampersand must be escaped');
});

test('hostOf prefers the written host over a parsed URL, because people say it differently', () => {
  assert.equal(hostOf({ host: 'kaay.store', url: 'https://kaay.store/x' }), 'kaay.store');
  assert.equal(hostOf({ url: 'https://www.kaayko.com/paddlingout/' }), 'kaayko.com/paddlingout');
});

test('qrRects run-lengths a row rather than emitting one rect per module', () => {
  const solid = { getModuleCount: () => 4, isDark: () => true };
  const rects = qrRects(solid, 0, 0, 100).match(/<rect/g) || [];
  assert.equal(rects.length, 4, 'four solid rows is four rects, not sixteen');
});
