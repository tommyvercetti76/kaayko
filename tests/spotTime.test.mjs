/**
 * AUDIT-2026-10-03 F1 — the forecast runs on the LAKE's clock.
 *
 * Seen live on 3 Oct 2026 from Dallas: at 1:33 am on 4 Oct in Nagpur, Ambazari
 * Lake's heatmap called India's 4 Oct "Today, Oct 3", put "THIS HOUR" at 3 PM
 * (the viewer's hour), and the night gate said the next daylight window was
 * "later today at 4 PM", skipping the whole morning. Every assertion here fixes
 * the instant and the lake's zone, and none depends on the machine's timezone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const T = require('../src/js/services/spotTime.js');
const SPOT_TIME = fileURLToPath(new URL('../src/js/services/spotTime.js', import.meta.url));
const HEAT = fileURLToPath(new URL('../src/js/components/KonditionsHeatmap.js', import.meta.url));

// 20:03 UTC on 3 Oct 2026 = 15:03 in Dallas, 14:03 in Utah, 01:33 on 4 Oct in Nagpur.
const INSTANT = new Date('2026-10-03T20:03:00Z');
const NAGPUR = { timeZone: 'Asia/Kolkata', coordinates: { latitude: 21.13, longitude: 79.05 } };
const POWELL = { timeZone: 'America/Denver', coordinates: { latitude: 37.02, longitude: -111.54 } };

test("the lake's now is its own date and hour, not the viewer's", () => {
  const n = T.nowAt(NAGPUR, null, INSTANT);
  assert.equal(n.date, '2026-10-04');
  assert.equal(n.hour, 1);
  assert.equal(n.estimated, false);
  const p = T.nowAt(POWELL, null, INSTANT);
  assert.equal(p.date, '2026-10-03');
  assert.equal(p.hour, 14);
});

test('without a zone from the API, the coordinates give an estimate, and say so', () => {
  const n = T.nowAt({ coordinates: NAGPUR.coordinates }, null, INSTANT);
  assert.equal(n.zone, 'Asia/Kolkata');
  assert.equal(n.estimated, true);
  assert.equal(n.date, '2026-10-04');
});

test('days are labelled from the forecast date against the lake today', () => {
  const now = T.nowAt(NAGPUR, null, INSTANT);
  assert.deepEqual(T.dayLabels('2026-10-04', now), { primary: 'Today', secondary: 'Oct 4' });
  assert.deepEqual(T.dayLabels('2026-10-05', now), { primary: 'Tomorrow', secondary: 'Oct 5' });
  assert.equal(T.dayLabels('2026-10-03', now).primary, 'Yesterday');   // a forecast cached over midnight
  assert.equal(T.relativeDay('2026-10-04', now), 'Later today');
  assert.equal(T.relativeDay('2026-10-06', now), 'Tuesday');
});

test('what is still ahead is decided by date and lake hour, not by array position', () => {
  const now = T.nowAt(NAGPUR, null, INSTANT);   // 01:33 on 4 Oct
  assert.equal(T.isAhead({ date: '2026-10-04' }, 6, now, 0), true, 'the morning is ahead');
  assert.equal(T.isAhead({ date: '2026-10-04' }, 1, now, 0), false, 'this hour is not ahead');
  assert.equal(T.isAhead({ date: '2026-10-03' }, 23, now, 0), false, 'yesterday is never ahead');
  assert.equal(T.isAhead({ date: '2026-10-05' }, 0, now, 1), true);
});

/** The heatmap rendered in a sandbox whose clock is INSTANT. */
function renderHeatmap(location) {
  let html = '';
  const container = {
    set innerHTML(v) { html = String(v); }, get innerHTML() { return html; },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
    dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    get firstElementChild() { return { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} }; }
  };
  const FixedDate = class extends Date {
    constructor(...a) { super(...(a.length ? a : [INSTANT.getTime()])); }
    static now() { return INSTANT.getTime(); }
  };
  const window = {
    KaaykoPrefs: { paddleScoreColor: () => '#c59a61', fmtTemp: v => `${v}`, fmtWind: v => `${v}`, localizeUnits: t => t,
      scoreMeta: () => ({ label: 'Careful', color: '#c59a61', severity: 'moderate' }) },
    KaaykoIcons: { get: () => '' }
  };
  const ctx = { window, Date: FixedDate, Intl, console: { log() {}, warn() {}, error() {} },
    document: { createElement: () => container, addEventListener() {} }, requestAnimationFrame: () => {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SPOT_TIME, 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(HEAT, 'utf8'), ctx);
  const hours = Object.fromEntries([6, 9, 12, 15, 18, 20].map(h => [String(h), { rating: h === 9 ? 4 : 3, isDay: h < 19 }]));
  const forecastData = {
    location,
    forecast: ['2026-10-04', '2026-10-05', '2026-10-06'].map(date => ({ date, hourly: hours }))
  };
  const H = ctx.window.KonditionsHeatmap || ctx.KonditionsHeatmap;
  H.render(container, forecastData, { paddleScore: { rating: 3 } });
  return { html, best: H.findBestWindow({ paddleScore: { rating: 3 } }, forecastData) };
}

test("Nagpur seen from anywhere: today is India's 4 Oct, no 'this hour' at 1:33 am, the morning is the best window", () => {
  const { html, best } = renderHeatmap(NAGPUR);
  assert.match(html, /<strong>Today<\/strong><span>Oct 4<\/span>/);
  assert.doesNotMatch(html, /Oct 3/);
  assert.doesNotMatch(html, /THIS HOUR/, '1:33 am is outside the 6 AM–8 PM strip');
  assert.equal(best.date, '2026-10-04');
  assert.equal(best.hour, 9);
  assert.equal(best.dayLabel, 'Later today');
});

test("Lake Powell at 14:03 Utah time: 'this hour' sits on the lake's 2 PM", () => {
  const location = { timeZone: 'America/Denver', coordinates: POWELL.coordinates };
  let html = '';
  // the forecast's first day is the lake's today here
  const r = renderHeatmapOn(location, ['2026-10-03', '2026-10-04', '2026-10-05']);
  html = r.html;
  const m = html.match(/class="khm-now[^"]*" style="left:([\d.]+)%"/);
  assert.ok(m, 'marker drawn on the lake today');
  // KHM strip runs 6..20 (span 14): 14:00 → (14-6)/14 = 57.14 %
  assert.equal(Number(m[1]).toFixed(1), (((14 - 6) / 14) * 100).toFixed(1));
});

function renderHeatmapOn(location, dates) {
  let html = '';
  const container = {
    set innerHTML(v) { html = String(v); }, get innerHTML() { return html; },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
    dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    get firstElementChild() { return { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} }; }
  };
  const FixedDate = class extends Date {
    constructor(...a) { super(...(a.length ? a : [INSTANT.getTime()])); }
    static now() { return INSTANT.getTime(); }
  };
  const window = { KaaykoPrefs: { paddleScoreColor: () => '#c59a61', localizeUnits: t => t }, KaaykoIcons: { get: () => '' } };
  const ctx = { window, Date: FixedDate, Intl, console: { log() {}, warn() {}, error() {} },
    document: { createElement: () => container, addEventListener() {} }, requestAnimationFrame: () => {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SPOT_TIME, 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(HEAT, 'utf8'), ctx);
  const hours = Object.fromEntries([6, 9, 12, 14, 15, 18, 20].map(h => [String(h), { rating: 3, isDay: true }]));
  const H = ctx.window.KonditionsHeatmap || ctx.KonditionsHeatmap;
  H.render(container, { location, forecast: dates.map(date => ({ date, hourly: hours })) }, null);
  return { html };
}

// ── one night rule for every surface (3 Oct 2026, "complete consistency") ──
// Ambazari, 4 Oct: sunrise 06:05 IST (00:35Z), sunset 18:02 IST (12:32Z).
const AMBAZARI = {
  rating: 4, night: { isNight: true, nextDaylight: { hour: 7 } },
  daylight: { zone: 'Asia/Kolkata', sunrise: '2026-10-04T00:35:00Z', sunset: '2026-10-04T12:32:00Z', nextSunrise: '2026-10-05T00:36:00Z' }
};

test('night at the lake is decided by its sunrise and sunset, not by the viewer', () => {
  // 21:03Z: night in Nagpur (02:33), mid-afternoon in Dallas
  assert.equal(T.isNightAt(AMBAZARI, new Date('2026-10-03T21:03:00Z')), true);
  // 09:00Z: 14:30 in Nagpur (day) while it is 4 am in Dallas
  assert.equal(T.isNightAt({ ...AMBAZARI, night: null }, new Date('2026-10-04T09:00:00Z')), false,
    "night in Texas does not make it night at Ambazari");
  // a copy whose cached flag says night, read after sunrise: the instants win
  assert.equal(T.isNightAt(AMBAZARI, new Date('2026-10-04T01:00:00Z')), false, 'stale night flag after dawn');
  // after sunset, before tomorrow's dawn
  assert.equal(T.isNightAt({ ...AMBAZARI, night: null }, new Date('2026-10-04T15:00:00Z')), true, 'stale day flag after dusk');
});

test('a copy without instants falls back to its own flag', () => {
  assert.equal(T.isNightAt({ night: { isNight: true } }), true);
  assert.equal(T.isNightAt({ conditions: { isDay: false } }), true);
  assert.equal(T.isNightAt({ rating: 3 }), false);
  assert.equal(T.isNightAt(null), false);
});

test("'daylight returns' is the lake's sunrise in the lake's own time", () => {
  assert.equal(T.daylightReturns(AMBAZARI, new Date('2026-10-03T21:03:00Z')), '6:05 AM');
  assert.equal(T.daylightReturns(AMBAZARI, new Date('2026-10-04T15:00:00Z')), '6:06 AM');
  assert.equal(T.daylightReturns({ night: { isNight: true, nextDaylight: { hour: 7 } } }), '7 AM');
});

/** Heatmap in a sandbox at INSTANT, with an observed current score. */
function renderWith(location, dates, hourly, currentData) {
  let html = '';
  const container = {
    set innerHTML(v) { html = String(v); }, get innerHTML() { return html; },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
    dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }
  };
  const FixedDate = class extends Date {
    constructor(...a) { super(...(a.length ? a : [INSTANT.getTime()])); }
    static now() { return INSTANT.getTime(); }
  };
  const ctx = { window: { KaaykoPrefs: { paddleScoreColor: () => '#c59a61', localizeUnits: t => t }, KaaykoIcons: { get: () => '' } },
    Date: FixedDate, Intl, console: { log() {}, warn() {}, error() {} }, document: { createElement: () => container }, requestAnimationFrame: () => {} };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SPOT_TIME, 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(HEAT, 'utf8'), ctx);
  const H = ctx.window.KonditionsHeatmap;
  const data = { location, forecast: dates.map(date => ({ date, hourly })) };
  H.render(container, data, currentData);
  return { html, best: H.findBestWindow(currentData, data) };
}

test('F5: the current hour shows the observed score the hero shows, not a second number', () => {
  const POW = { timeZone: 'America/Denver', coordinates: POWELL.coordinates };   // 14:03 at the lake
  const hourly = Object.fromEntries([6, 9, 12, 14, 15, 18, 20].map(h => [String(h), { rating: 3, isDay: true }]));
  const observed = { paddleScore: { rating: 4 }, conditions: { isDay: true, windSpeed: 5, temperature: 20 } };
  const { html } = renderWith(POW, ['2026-10-03', '2026-10-04'], hourly, observed);
  const today = html.match(/class="khm-bar" data-day="0" style="background:([^"]+)"/)[1];
  assert.match(today, /#316d43 57\.14%/, 'the 2 PM stop is the observed 4.0 (Worth it), not the forecast 3.0');
  assert.match(html, /aria-label="Current hour — observed"/);
  const tomorrow = html.match(/class="khm-bar" data-day="1" style="background:([^"]+)"/)[1];
  assert.doesNotMatch(tomorrow, /#316d43/, 'only the current hour takes the observed score');
});

test('hours after dark at the lake are never coloured, offered as best, or suggested', () => {
  const hourly = Object.fromEntries([6, 9, 12, 15, 18, 19, 20].map(h => [String(h), { rating: h >= 19 ? 5 : 2, isDay: h < 19 }]));
  const { html, best } = renderWith(NAGPUR, ['2026-10-04', '2026-10-05', '2026-10-06'], hourly, null);
  const bar = html.match(/class="khm-bar" data-day="0" style="background:([^"]+)"/)[1];
  assert.match(bar, /#120f0a 92\.86%/, '7 PM is night: no colour');
  assert.doesNotMatch(bar, /#316d43/, 'the 5.0 night hours never paint green');
  assert.ok(best && best.hour < 19, `a 5.0 at 7-8 PM after dark is never "the best window" (got ${best && best.hour})`);
});

test('one hour format on every surface', () => {
  assert.equal(T.hourLabel(0), '12 AM');
  assert.equal(T.hourLabel(6), '6 AM');
  assert.equal(T.hourLabel(12), '12 PM');
  assert.equal(T.hourLabel(23), '11 PM');
  assert.equal(T.isDaylightHour({ isDay: false }, 12), false);
  assert.equal(T.isDaylightHour({}, 12), true);
  assert.equal(T.isDaylightHour({}, 21), false);
});
