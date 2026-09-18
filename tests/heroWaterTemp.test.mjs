// AUDIT #24 — the hero must never invent a water temperature.
//
// Found live on kaayko.com: every one of 18 spots had no water sensor and the
// hero showed a figure derived as "air - 3C", directly under the heading
// "Measured now at the nearest station". The API was already publishing
// waterTemp: null, waterTempMeasured: false.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/js/components/RatingHero.js', import.meta.url), 'utf8');

test('the air-minus-3 fallback is gone from the source', () => {
  assert.ok(!/parseFloat\(temp\)\s*-\s*3/.test(src),
    'RatingHero still derives a water temperature from air temperature');
});

test('the tile renders "No sensor" when nothing was measured', () => {
  assert.ok(src.includes("'No sensor'"),
    'RatingHero has no "No sensor" branch for the water-temperature tile');
  assert.ok(/hasWaterTemp\s*\?\s*P\.fmtTemp\(waterTemp\)\s*:\s*'No sensor'/.test(src),
    'the water tile is not gated on hasWaterTemp');
});

test('a null reading is stored as null, not coerced to a number', () => {
  assert.ok(/const waterTemp = hasWaterTemp \? parseFloat\(rawWt\) : null;/.test(src));
});

test('cold-water warnings cannot fire on an absent reading', () => {
  // parseFloat(null) is NaN and the warning block is guarded by !isNaN.
  assert.ok(/const wt = parseFloat\(w\.waterTemp\);\s*\n\s*if \(!isNaN\(wt\)\)/.test(src));
  assert.ok(Number.isNaN(parseFloat(null)));
});

test('the "measured" marker retries instead of losing the render race', () => {
  const page = readFileSync(new URL('../src/paddlingout/forecast.html', import.meta.url), 'utf8');
  assert.ok(/markEstimatedWaterTemp\(currentData, attempt \+ 1\)/.test(page),
    'markEstimatedWaterTemp does not retry when the hero has not rendered yet');
  assert.ok(!/valueEl\.textContent = 'No sensor'/.test(page),
    'forecast.html still patches the value after render; the hero should render it');
});

test('the component carries its own wt-none / wt-measured styles', () => {
  const css = readFileSync(new URL('../src/js/components/RatingHero.css', import.meta.url), 'utf8');
  assert.ok(css.includes('.weather-value.wt-none'));
  assert.ok(css.includes('.wt-measured'));
});
