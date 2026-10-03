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
