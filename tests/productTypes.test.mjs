/**
 * productTypes.js is the storefront's view of the server registry: labels, order and
 * the coming-soon line. It carries no money; that is priceMap.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setProductTypes, productTypes, typeFor, labelForType, typeRank, comingSoonTypes } from '../src/js/productTypes.js';

const REGISTRY = [
  { key: 'tshirt',  label: 'T-Shirts', singular: 'T-Shirt', priceCents: 1999, status: 'live' },
  { key: 'hoodie',  label: 'Hoodies',  singular: 'Hoodie',  priceCents: 2499, status: 'live' },
  { key: 'tote',    label: 'Totes',    singular: 'Tote',    priceCents: 2999, status: 'live' },
  { key: 'mug',     label: 'Mugs',     singular: 'Mug',     priceCents: 999,  status: 'coming_soon' },
  { key: 'sticker', label: 'Stickers', singular: 'Sticker', priceCents: 499,  status: 'coming_soon' }
];

test('without a registry, labels fall back and nothing is coming soon', () => {
  setProductTypes(null);
  assert.deepEqual(productTypes(), []);
  assert.equal(labelForType('tote'), 'Totes');
  assert.equal(labelForType('tote', { singular: true }), 'Tote');
  assert.equal(labelForType('bottle', { singular: true }), 'Bottle');
  assert.equal(labelForType(''), 'Other');
  assert.equal(labelForType('', { singular: true }), '');
  assert.equal(labelForType('gizmo'), 'Gizmo');           // unknown: capitalised, never blank
  assert.deepEqual(comingSoonTypes(), []);
  assert.ok(typeRank('tote') < typeRank('magnet'));
  assert.ok(typeRank('gizmo') > typeRank('magnet'));       // unknown sorts last
});

test('with the registry from the API, labels, order and coming-soon come from it', () => {
  setProductTypes(REGISTRY);
  assert.equal(productTypes().length, 5);
  assert.equal(typeFor(' Hoodie ').priceCents, 2499);
  assert.equal(typeFor('poster'), null);
  assert.equal(labelForType('HOODIE'), 'Hoodies');
  assert.equal(labelForType('hoodie', { singular: true }), 'Hoodie');
  assert.deepEqual(comingSoonTypes().map((t) => `${t.label} ${t.priceCents}`), ['Mugs 999', 'Stickers 499']);
  assert.equal(typeRank('tshirt'), 0);
  assert.equal(typeRank('tote'), 2);
  assert.equal(typeRank('bottle'), 5);                     // not in this registry → after every row
});

test('a malformed registry is ignored row by row', () => {
  setProductTypes([{ key: 'tote', label: 'Totes', singular: 'Tote' }, null, { label: 'no key' }, 'tshirt']);
  assert.deepEqual(productTypes().map((t) => t.key), ['tote']);
});
