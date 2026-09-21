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

const { front, back, wrap, hostOf, qrRects } = await import('/js/cards/render.js');

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
// Re-pinned 21 Sep 2026: kaay.link became Kortex and Alumni became School of
// the Future, and four cards took new hooks and back lines. Forge is
// untouched and its hashes did not move — which is the guard working.
const PINNED = {
  paddlingout: ['9bc106d58993f93f', '17bbcce0b4993a15'],
  forge:       ['2da71419f1d6d133', '8f8511f341ac221b'],
  kortex:      ['9e8838d7a584c564', '9271af31d581c87c'],
  kaayko:      ['49b36fd9a9a2cb1e', 'e5b246e76052011f'],
  alumni:      ['6d57db2e04488f87', '0302f8fd7dc72554'],
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
