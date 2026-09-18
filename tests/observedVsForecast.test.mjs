/**
 * AUDIT-2026-09-18 #6 — the hero and the 3-day strip must be labelled
 * DISTINCTLY, not forced to agree.
 *
 * Measured on Trinity River, 18 Sep 2026: the hero (current.json, an
 * OBSERVATION) read air 33.9 °C / UV 6.8 / humidity 37 % / cloud 41 %, while
 * the same clock hour of the forecast array read 35.4 / 8 / 31 / 33. Both
 * surfaces printed the word "NOW" at the same minute, so a reader saw one page
 * contradicting itself.
 *
 * Owner decision B: label the two sources, do not fabricate agreement. These
 * tests hold the labels in place — including the negative one, that the two
 * surfaces never again print the same bare "NOW".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERO = fileURLToPath(new URL('../src/js/components/RatingHero.js', import.meta.url));
const HEAT = fileURLToPath(new URL('../src/js/components/KonditionsHeatmap.js', import.meta.url));

const PREFS = {
  fmtTemp: v => `${v}°C`, fmtWind: v => `${v} km/h`,
  fmtDist: v => `${v} km`, fmtPrecip: v => `${v} mm`,
  fmtHeight: v => `${v} m`,
  paddleScoreColor: () => '#c59a61', localizeUnits: t => t
};

/** Captures whatever a component writes into `innerHTML`. */
function sink() {
  const node = {
    _html: '',
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    set innerHTML(v) { this._html = String(v); },
    get innerHTML() { return this._html; },
    get firstElementChild() {
      return {
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener() {}
      };
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}
  };
  return node;
}

function renderHero() {
  const captured = sink();
  const ctx = {
    window: { KaaykoPrefs: PREFS, KaaykoIcons: { get: () => '' } },
    localStorage: { getItem: () => null, setItem() {} },
    document: { createElement: () => captured },
    requestAnimationFrame: () => {},
    console: { log() {}, warn() {}, error() {} }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(HERO, 'utf8'), ctx, { filename: HERO });
  const hero = new ctx.window.RatingHero();
  // Trinity River's observed hero reading, 18 Sep 2026.
  hero.render(2.0, {}, {
    temperature: 33.9, windSpeed: 5.4, windDirection: 'SE',
    uvIndex: 6.8, cloudCover: 41, humidity: 37
  });
  return captured.innerHTML;
}

function renderHeatmap() {
  const container = sink();
  const ctx = {
    window: { KaaykoPrefs: PREFS, KaaykoIcons: { get: () => '' } },
    console: { log() {}, warn() {}, error() {} }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(HEAT, 'utf8'), ctx, { filename: HEAT });
  // The same clock hour of the forecast, which reads 35.4 °C — not 33.9.
  const hourly = {};
  for (let h = 6; h <= 20; h++) hourly[String(h)] = { rating: 1.5, airTemp: 35.4, uvIndex: 8, windSpeed: 5.4 };
  ctx.window.KonditionsHeatmap.render(container, {
    forecast: [{ date: '2026-09-18', hourly }, { date: '2026-09-19', hourly }, { date: '2026-09-20', hourly }]
  }, null);
  return container.innerHTML;
}

test('the hero names itself an OBSERVATION', () => {
  const html = renderHero();
  assert.match(html, /OBSERVED/, 'the hero chip must say OBSERVED');
  assert.match(html, /class="reading-source"/, 'the hero must name its source');
  assert.match(html, /Measured now at the nearest station/);
});

test('the 3-day strip names itself a FORECAST', () => {
  const html = renderHeatmap();
  assert.match(html, /3-day forecast/, 'the eyebrow must say forecast, not "outlook"');
  assert.match(html, /class="khm-source"/);
  assert.match(html, /Forecast, not observed conditions/);
});

test('THE POINT — the two surfaces no longer print the same bare word', () => {
  const heroHtml = renderHero();
  const heatHtml = renderHeatmap();

  // The strip's current-hour marker used to read exactly "NOW", the same word
  // the hero chip used, over a different number for the same minute.
  assert.ok(!/>NOW</.test(heatHtml), 'the strip must not print a bare "NOW"');
  assert.match(heatHtml, /THIS HOUR/, 'the strip marks the hour, and says it is a forecast');
  assert.match(heatHtml, /aria-label="Current hour — forecast"/);

  // The hero may still say NOW — it IS now — but qualified by its source.
  assert.ok(!/>NOW</.test(heroHtml), 'the hero chip must be qualified, not a bare "NOW"');
  assert.match(heroHtml, /OBSERVED · NOW/);
});

test('an opened forecast hour is labelled Forecast', () => {
  // The hour panel is built on click; assert on the template the click path
  // writes, read straight from the shipped source rather than simulated.
  const src = fs.readFileSync(HEAT, 'utf8');
  assert.match(src, /khm-panel-kind">Forecast</, 'the hour panel must say Forecast');
});

test('the current-hour marker flips away from the right edge so the wider label fits', () => {
  const src = fs.readFileSync(HEAT, 'utf8');
  assert.match(src, /khm-now--flip/, '"THIS HOUR" is wider than "NOW" and must not run off the bar');
  const css = fs.readFileSync(
    fileURLToPath(new URL('../src/js/components/KonditionsHeatmap.css', import.meta.url)), 'utf8');
  assert.match(css, /\.khm-now--flip span \{[^}]*right:4px/);
  assert.match(css, /\.khm-now span \{[^}]*white-space:nowrap/);
});

test('the hero source line is styled on both surfaces that mount the hero', () => {
  const heroCss = fs.readFileSync(
    fileURLToPath(new URL('../src/js/components/RatingHero.css', import.meta.url)), 'utf8');
  const pageCss = fs.readFileSync(
    fileURLToPath(new URL('../src/css/forecast.css', import.meta.url)), 'utf8');
  assert.match(heroCss, /\.reading-source \{/, 'the modal needs the base rule');
  assert.match(pageCss, /#ratingHeroContainer \.reading-source \{/, 'the forecast page restyles the hero');
});
