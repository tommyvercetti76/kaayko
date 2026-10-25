/**
 * "You may also like": the order is a claim about what a shopper reaches for next, so
 * it is written down here rather than judged by scrolling a product page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { pickSuggestions, regionFor, capFor } = await import('/js/suggest.js');

const P = (id, productType, extra = {}) => ({ id, productType, imgSrc: ['x.webp'], votes: 0, ...extra });
const catalogue = [
  P('kaayko_sloth-bear_mug', 'mug'),
  P('kaayko_sloth-bear_magnet', 'magnet'),
  P('kaayko_red-panda_mug', 'mug', { votes: 5 }),
  P('kaayko_indian-pangolin_mug', 'mug', { votes: 4 }),
  P('kaayko_golden-langur_mug', 'mug', { votes: 3 }),
  P('kaayko_gaur_mug', 'mug', { votes: 2 }),
  P('kaayko_peacock_magnet', 'magnet', { votes: 1 }),
  P('kaayko_peacock_tote', 'tote'),
  P('kaayko_lion_mug', 'mug', { votes: 50 }),          // Serengeti: Africa
  P('kaayko_hippo_magnet', 'magnet', { votes: 40 }),
  P('broke_tee', 'tshirt', { theme: 'Rebel', votes: 99 }),
  P('kaayko_cheetah_mug', 'mug', { soldOut: true, votes: 100 }),
];

test('the same animal in its other forms comes first', () => {
  const out = pickSuggestions(catalogue[0], catalogue, 8).map((p) => p.id);
  assert.equal(out[0], 'kaayko_sloth-bear_magnet');
  assert.ok(!out.includes('kaayko_sloth-bear_mug'), 'never the product itself');
});

test('then the same part of the world, ahead of a more-loved piece from elsewhere', () => {
  const out = pickSuggestions(catalogue[0], catalogue, 20).map((p) => p.id);   // the whole order
  assert.ok(out.indexOf('kaayko_red-panda_mug') < out.indexOf('kaayko_hippo_magnet'));
  assert.ok(out.indexOf('kaayko_hippo_magnet') < out.indexOf('broke_tee'), 'other wildlife before an unrelated tee');
  assert.equal(regionFor({ id: 'kaayko_lion_mug' }), 'africa');
  assert.equal(regionFor({ id: 'kaayko_gaur_mug' }), 'india');
  assert.equal(regionFor({ id: 'kaayko_raccoon_mug' }), null);
});

test('no wall of one kind: at most half the list of a type beyond the same animal', () => {
  const out = pickSuggestions(catalogue[0], catalogue, 6);
  const mugs = out.filter((p) => p.productType === 'mug' && !p.id.startsWith('kaayko_sloth-bear'));
  assert.ok(mugs.length <= capFor(6), `${mugs.length} mugs`);
  assert.equal(capFor(8), 4);
});

test('sold out is never suggested, and the list never runs short while stock remains', () => {
  const out = pickSuggestions(catalogue[0], catalogue, 20);
  assert.ok(!out.some((p) => p.id === 'kaayko_cheetah_mug'));
  assert.equal(out.length, catalogue.length - 2);       // all but itself and the sold-out mug
});

test('a piece with no animal leans on its theme', () => {
  const tee = P('fresh_tee', 'tshirt', { theme: 'Rebel' });
  assert.equal(pickSuggestions(tee, [...catalogue, tee], 1)[0].id, 'broke_tee');
});
