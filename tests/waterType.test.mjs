/**
 * KaaykoWaterType — AUDIT-2026-09-18 #8.
 *
 * The forecast page headed its alert drawer "Lake alerts" on Trinity River,
 * whose /paddlingOut payload says waterType: "river". These tests pin the
 * vocabulary and, more importantly, the rule that makes it honest: a spot with
 * NO waterType must not be called a lake.
 *
 * The distribution asserted below was measured against the live list on
 * 18 Sep 2026 (GET https://kaayko.com/api/paddlingOut, 18 spots):
 *   lake 14 · river 3 · absent 1 (community-lake-arlington-…).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/js/waterType.js', import.meta.url));

function load() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx, { filename: SRC });
  assert.ok(ctx.window.KaaykoWaterType, 'waterType.js must expose window.KaaykoWaterType');
  return ctx.window.KaaykoWaterType;
}

test('a river is named a river, not a lake', () => {
  const W = load();
  assert.equal(W.of({ waterType: 'river' }).alertsLabel, 'River alerts');
  assert.equal(W.of({ waterType: 'river' }).noun, 'river');
  assert.equal(W.of({ waterType: 'river' }).known, true);
});

test('a lake is still named a lake', () => {
  const W = load();
  assert.equal(W.of({ waterType: 'lake' }).alertsLabel, 'Lake alerts');
});

test('THE RULE — a spot with no waterType is never called a lake', () => {
  const W = load();
  // The live community spot (community-lake-arlington-…) carries no waterType.
  for (const spot of [{}, { waterType: null }, { waterType: undefined }, { waterType: '' }, { waterType: '  ' }]) {
    const v = W.of(spot);
    assert.equal(v.known, false, `known must be false for ${JSON.stringify(spot)}`);
    assert.equal(v.alertsLabel, 'Water alerts');
    assert.equal(v.noun, 'water');
    assert.ok(!/lake/i.test(v.alertsLabel), v.alertsLabel);
    assert.ok(!/lake/i.test(v.dismissLabel), v.dismissLabel);
  }
});

test('an unrecognised waterType falls back to neutral and is never echoed into the page', () => {
  const W = load();
  const v = W.of({ waterType: 'estuary<script>' });
  assert.equal(v.known, false);
  assert.equal(v.alertsLabel, 'Water alerts');
  assert.ok(!v.Noun.includes('<'), 'raw server text must not reach a label');
});

test('every value the admin editor offers resolves to a known label', () => {
  const W = load();
  // src/admin/views/spots/spot-editor.js WATER_TYPES, minus the blank option,
  // plus 'ramp', which forecast.html already handled.
  for (const t of ['lake', 'reservoir', 'river', 'coastal', 'bay', 'canal', 'ramp']) {
    const v = W.of({ waterType: t });
    assert.equal(v.known, true, `${t} must be known`);
    assert.ok(v.alertsLabel.endsWith(' alerts'), `${t} label: ${v.alertsLabel}`);
    assert.ok(v.Noun.length > 0);
  }
  assert.equal(W.of({ waterType: 'reservoir' }).alertsLabel, 'Reservoir alerts');
  assert.equal(W.of({ waterType: 'ramp' }).alertsLabel, 'Boat ramp alerts');
  assert.equal(W.of({ waterType: 'coastal' }).alertsLabel, 'Coastal alerts');
});

test('case and whitespace on the wire do not change the answer', () => {
  const W = load();
  assert.equal(W.of({ waterType: ' River ' }).alertsLabel, 'River alerts');
  assert.equal(W.of({ waterType: 'LAKE' }).alertsLabel, 'Lake alerts');
});

test('a bare string is accepted as well as a spot', () => {
  const W = load();
  assert.equal(W.alertsLabel('river'), 'River alerts');
  assert.equal(W.noun('canal'), 'canal');
  assert.equal(W.resolve('river').key, 'river');
});

test('the live 18-spot distribution produces no wrong noun', () => {
  const W = load();
  // Measured 18 Sep 2026 against https://kaayko.com/api/paddlingOut.
  const live = [
    ['ambazari', 'lake'], ['antero', 'lake'], ['colorado', 'river'],
    ['community-lake-arlington-arlington-texas-c4937af1', undefined],
    ['cottonwood', 'lake'], ['crescent', 'lake'], ['diablo', 'lake'],
    ['jackson', 'lake'], ['jenny', 'lake'], ['kens', 'lake'],
    ['lewisville', 'lake'], ['mcdonald', 'lake'], ['merrimack', 'river'],
    ['powell', 'lake'], ['taylorpark', 'lake'], ['trinity', 'river'],
    ['union', 'lake'], ['whiterock', 'lake']
  ];
  assert.equal(live.length, 18);
  const labels = live.map(([id, t]) => [id, W.of({ waterType: t }).alertsLabel]);
  // No river is called a lake, and the spot with no type is called neither.
  for (const [id, t] of live) {
    const label = W.of({ waterType: t }).alertsLabel;
    if (t === 'river') assert.equal(label, 'River alerts', id);
    if (t === undefined) assert.equal(label, 'Water alerts', id);
  }
  assert.equal(labels.filter(([, l]) => l === 'Lake alerts').length, 14);
  assert.equal(labels.filter(([, l]) => l === 'River alerts').length, 3);
  assert.equal(labels.filter(([, l]) => l === 'Water alerts').length, 1);
});
