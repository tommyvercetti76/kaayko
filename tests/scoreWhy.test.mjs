// The score leads with its band and says why; the number is an aside with its
// typical error (14 Oct 2026). Real prefs.js, real util.js, real RatingHero.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const f = (p) => fileURLToPath(new URL(p, import.meta.url));

let lastRoot = null;
function hero(weather, units = 'imperial') {
  let html = '';
  const node = { set innerHTML(v) { html = String(v); }, get innerHTML() { return html; },
    querySelector: () => null, querySelectorAll: () => [], addEventListener() {},
    get firstElementChild() { return { querySelector: () => null, querySelectorAll: () => [], addEventListener() {} }; } };
  const store = { kaayko_units: units };
  const document = { createElement: () => node, getElementById: () => null, readyState: 'complete', addEventListener() {},
    head: { appendChild() {} }, documentElement: { appendChild() {} } };
  const ctx = { console, document, requestAnimationFrame: () => {},
    localStorage: { getItem: (k) => store[k] ?? null, setItem() {} } };
  ctx.window = ctx; ctx.window.location = { hostname: 'kaayko.com', origin: 'https://kaayko.com' };
  ctx.window.KaaykoIcons = { get: () => '' };
  ctx.addEventListener = () => {}; ctx.dispatchEvent = () => {}; ctx.CustomEvent = function () {};
  vm.createContext(ctx);
  for (const p of ['../src/js/prefs.js', '../src/js/util.js', '../src/js/components/RatingHero.js']) {
    vm.runInContext(fs.readFileSync(f(p), 'utf8'), ctx, { filename: p });
  }
  lastRoot = new ctx.RatingHero().render(3.0, {}, { temperature: 12, windSpeed: 4, windDirection: 'SW', uvIndex: 0, cloudCover: 100, ...weather });
  return html;
}

test('band first, the model\'s reason in the viewer\'s units, number as an aside with its error', () => {
  const h = hero({ explanations: [{ factor: 'cold', text: 'Cool: feels like 11°C', value: -1.4 }], uncertainty: { residualMae: 0.6026 } });
  assert.match(h, /score-mark-verdict[^>]*>Careful</);
  assert.match(h, /score-mark-reason[^>]*>Cool: feels like 52°F</);
  assert.match(h, /3 of 5 · typical error ±0\.6/);
  assert.doesNotMatch(h, /score-mark-number/);           // the 5 rem "3.0 / 5" is gone
});

test('a score with no account of why says nothing rather than inventing one', () => {
  assert.doesNotMatch(hero({}), /score-mark-reason/);
});

test('an empty account says no single factor stands out', () => {
  assert.match(hero({ explanations: [] }), /No single weather factor stands out/);
});

test('the "Was this score accurate?" vote is part of what the hero puts on the page', () => {
  const h = hero({});
  assert.match(lastRoot.innerHTML, /paddle-feedback/);           // was dropped: only the first block was returned
  assert.match(lastRoot.innerHTML, /skill-level-section/);
});
