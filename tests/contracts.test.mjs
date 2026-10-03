/**
 * contracts/paddling.js — the runtime half of the API typedefs. These are the
 * two promises the API broke unnoticed until 3 Oct 2026: the forecast never
 * sent the lake's timezone, and four community spots had no water type.
 * scripts/browser-check.mjs runs the same contracts against the live API.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { checkContract } = require('../src/js/contracts/paddling.js');

const goodSpot = {
  id: 'powell', title: 'Lake Powell', waterType: 'lake',
  location: { latitude: 37.02, longitude: -111.54 },
  paddleScore: { rating: 3.5, interpretation: 'Careful' }
};
const goodForecast = {
  success: true,
  location: { name: 'Wahweap', timeZone: 'America/Denver', coordinates: { latitude: 37.0, longitude: -111.5 } },
  forecast: [{ date: '2026-10-03', hourly: { 13: { rating: 3 } } }, { date: '2026-10-04', hourly: { 9: { rating: 4 } } }],
  metadata: { algorithmVersion: '2.7.0', cached: false, cacheAge: 0 }
};

test('a spot and a forecast that keep their promises pass', () => {
  assert.deepEqual(checkContract('spot', goodSpot), []);
  assert.deepEqual(checkContract('fastForecast', goodForecast), []);
});

test('a spot without a water type is caught (the four community lakes)', () => {
  const problems = checkContract('spot', { ...goodSpot, waterType: null });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /spot\.waterType/);
});

test("a forecast without the lake's timezone is caught", () => {
  const { timeZone, ...loc } = goodForecast.location;
  const problems = checkContract('fastForecast', { ...goodForecast, location: loc });
  assert.equal(problems.length, 1);
  assert.match(problems[0], /location\.timeZone/);
});

test('a made-up zone, a verdict off the canonical scale and a day without a date are caught', () => {
  assert.match(checkContract('fastForecast', { ...goodForecast, location: { ...goodForecast.location, timeZone: 'Mars/Olympus' } })[0], /timeZone/);
  assert.match(checkContract('spot', { ...goodSpot, paddleScore: { rating: 3.5, interpretation: 'Good' } })[0], /interpretation/);
  const noDate = { ...goodForecast, forecast: [{ hourly: { 1: {} } }, ...goodForecast.forecast] };
  assert.match(checkContract('fastForecast', noDate)[0], /forecast\[\]\.date.*1 of 3/);
});
