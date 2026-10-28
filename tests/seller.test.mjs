// Who the store says sells a Kreator listing (28 Oct 2026 profit and legal review).
import test from 'node:test';
import assert from 'node:assert/strict';
import { sellerNote } from '/js/seller.js';

test('Kaayko staff selling as a Kreator is never called independent', () => {
  assert.equal(sellerNote({ sellerTeam: true, productType: 'lesson' }), 'run by the Kaayko team');
});

test('a lesson is taught by a teacher, a piece made by a maker, in the bag too', () => {
  assert.equal(sellerNote({ productType: 'lesson' }), 'an independent teacher');
  assert.equal(sellerNote({ kind: 'lesson' }), 'an independent teacher');
  assert.equal(sellerNote({ productType: 'mug' }), 'an independent maker');
  assert.equal(sellerNote(null), 'an independent maker');
});
