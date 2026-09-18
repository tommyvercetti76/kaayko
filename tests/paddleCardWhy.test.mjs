/**
 * PaddleCard's "why" strip — honest attribution only.
 *
 * The card may show ONLY what the scoring pipeline itself reported in
 * penaltyDetails[] / adjustments[]. These tests pin the three ways that can go
 * wrong: inventing a reason when the response was silent, claiming "nothing
 * moved it" when the response never carried the arrays at all, and letting a
 * factor outrank the night / not-scored flags.
 *
 * PaddleCard.js is a classic <script> (window.PaddleCard), not a module, so it
 * is evaluated here in a vm with a stub window + a minimal DOM. That is the
 * real shipped file, not a copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/js/components/PaddleCard.js', import.meta.url));

function fakeDocument() {
  function make(tag) {
    return {
      tagName: String(tag).toUpperCase(),
      className: '',
      dataset: {},
      attrs: {},
      textContent: '',
      innerHTML: '',
      childNodes: [],
      parentNode: null,
      setAttribute(k, v) { this.attrs[k] = String(v); },
      appendChild(n) { this.childNodes.push(n); n.parentNode = this; return n; },
      removeChild(n) {
        const i = this.childNodes.indexOf(n);
        if (i >= 0) this.childNodes.splice(i, 1);
        n.parentNode = null;
        return n;
      },
      addEventListener() {},
      querySelectorAll() { return []; },
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }
    };
  }
  return { createElement: make };
}

function loadPaddleCard(prefs) {
  const ctx = {
    window: prefs ? { KaaykoPrefs: prefs } : {},
    document: fakeDocument(),
    setTimeout, clearTimeout, navigator: {}, console
  };
  ctx.window.PointerEvent = undefined;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx, { filename: SRC });
  assert.ok(ctx.window.PaddleCard, 'PaddleCard.js must expose window.PaddleCard');
  return ctx.window.PaddleCard;
}

/** Flatten a built why-node to [{cls, text}] so assertions read like the card. */
function lines(node) {
  const out = [];
  (function walk(n) {
    if (!n) return;
    if (n.textContent && !n.childNodes.length) out.push({ cls: n.className, text: n.textContent });
    n.childNodes.forEach(walk);
  })(node);
  return out;
}
const texts = (node) => lines(node).map((l) => l.text);

const PC = loadPaddleCard();

// ── state classification ────────────────────────────────────────────────────

test('a response with neither array is "unknown" and renders nothing', () => {
  // The search endpoint returns a bare {rating}. Saying "nothing moved it"
  // there would be a claim the response does not support.
  assert.equal(PC.whyState({ rating: 3.5 }).state, 'unknown');
  assert.equal(PC.buildWhy({ rating: 3.5 }, false), null);
  assert.equal(PC.buildWhy({ rating: 3.5 }, true), null);
});

test('no paddleScore at all renders nothing', () => {
  assert.equal(PC.whyState(null).state, 'unknown');
  assert.equal(PC.whyState(undefined).state, 'unknown');
  assert.equal(PC.buildWhy(null, false), null);
});

test('both arrays present and empty is "none" — truthful, not filler', () => {
  const score = { rating: 3.5, penaltyDetails: [], adjustments: [] };
  assert.equal(PC.whyState(score).state, 'none');
  assert.deepEqual(texts(PC.buildWhy(score, false)), ['Nothing pushed this score up or down.']);
  assert.equal(PC.buildWhy(score, true), null, 'the row variant stays quiet');
});

test('rating null is "not scored" and wins over everything else', () => {
  const score = {
    rating: null,
    penaltyDetails: [{ code: 'TEMP_HOT', amount: 1, message: 'Extreme heat (35.5C)' }],
    adjustments: [{ type: 'seasonal', adjustment: 0.2, reason: 'Spring/Fall (+0.2)' }]
  };
  assert.equal(PC.whyState(score).state, 'unscored');
  const t = texts(PC.buildWhy(score, false));
  assert.equal(t[0], 'Not scored');
  assert.ok(!t.some((x) => /heat|Spring/.test(x)), 'no factor may appear on an unscored card');
});

// ── ranking + direction ─────────────────────────────────────────────────────

test('factors rank by absolute contribution across both arrays, top 3', () => {
  const score = {
    rating: 2.5,
    penaltyDetails: [
      { code: 'UV_MODERATE', amount: 0.5, message: 'Moderate UV (6.4)' },
      { code: 'TEMP_VERY_HOT', amount: 1, message: 'Extreme heat (35.5C)' }
    ],
    adjustments: [
      { type: 'forecast_trend', adjustment: 0.2, reason: 'Improving wind conditions in forecast (+0.2)' },
      { type: 'location', adjustment: 0.7, reason: 'Sheltered water (+0.7)' },
      { type: 'seasonal', adjustment: 0.1, reason: 'Spring/Fall temperate zone adjustment (+0.1)' }
    ]
  };
  const w = PC.whyState(score);
  assert.equal(w.state, 'factors');
  assert.equal(w.factors.length, 3, 'capped at three');
  assert.deepEqual(Array.from(w.factors, (f) => f.value), [-1, 0.7, -0.5]);
  assert.deepEqual(Array.from(w.factors, (f) => f.dir), ['down', 'up', 'down']);
  assert.equal(w.factors[0].text, 'Extreme heat (35.5C)');
  assert.equal(w.factors[1].text, 'Sheltered water', 'the duplicated "(+0.7)" tail is stripped');
});

test('a penalty always reads as downward, whatever sign the server used', () => {
  const w = PC.whyState({
    rating: 3,
    penaltyDetails: [{ code: 'X', amount: -0.5, message: 'Marginal visibility (9.0 km)' }],
    adjustments: []
  });
  assert.equal(w.factors[0].value, -0.5);
  assert.equal(w.factors[0].dir, 'down');
});

test('a factor with no server text is dropped, never labelled from its code', () => {
  const w = PC.whyState({
    rating: 3,
    penaltyDetails: [{ code: 'MYSTERY_PENALTY', amount: 1 }],
    adjustments: [{ type: 'wind_pattern', adjustment: 0.2, reason: '' }]
  });
  assert.deepEqual(Array.from(w.factors), []);
  assert.equal(w.state, 'none');
});

test('zero and non-numeric magnitudes are not factors', () => {
  const w = PC.whyState({
    rating: 3,
    penaltyDetails: [{ code: 'A', amount: 0, message: 'Nothing' }],
    adjustments: [
      { type: 'b', adjustment: null, reason: 'Null' },
      { type: 'c', adjustment: 'NaN', reason: 'String' },
      { type: 'd', adjustment: 0.3, reason: 'Real one (+0.3)' }
    ]
  });
  assert.deepEqual(Array.from(w.factors, (f) => f.text), ['Real one']);
});

test('malformed array entries do not throw', () => {
  const w = PC.whyState({ rating: 3, penaltyDetails: [null, undefined], adjustments: [null] });
  assert.equal(w.state, 'none');
});

// ── night ───────────────────────────────────────────────────────────────────

test('night is printed first and keeps its factors underneath', () => {
  const score = {
    rating: 3.5,
    night: { isNight: true, nextDaylight: { date: '2026-09-19', hour: 6, time: '2026-09-19 06:00' } },
    penaltyDetails: [],
    adjustments: [{ type: 'wind_pattern', adjustment: 0.1, reason: 'Very light winds (+0.1)' }]
  };
  const w = PC.whyState(score);
  assert.equal(w.state, 'night');
  const node = PC.buildWhy(score, false);
  assert.equal(node.dataset.state, 'night');
  const t = texts(node);
  assert.equal(t[0], 'Night here · daylight about 6 AM local');
  assert.ok(t.includes('Very light winds'));
});

test('night with no factors says only the night line — no filler', () => {
  const score = { rating: 3.5, night: { isNight: true }, penaltyDetails: [], adjustments: [] };
  assert.deepEqual(texts(PC.buildWhy(score, false)), ['Night here']);
});

test('night survives a response that carries no factor arrays', () => {
  const score = { rating: 3.5, night: { isNight: true, nextDaylight: { hour: 13 } } };
  assert.equal(PC.whyState(score).state, 'night');
  assert.deepEqual(texts(PC.buildWhy(score, true)), ['Night here · daylight about 1 PM local']);
});

test('isNight false or missing is not night', () => {
  assert.equal(PC.whyState({ rating: 3, night: { isNight: false }, penaltyDetails: [], adjustments: [] }).state, 'none');
  assert.equal(PC.whyState({ rating: 3, penaltyDetails: [], adjustments: [] }).night, null);
});

test('a bad nextDaylight hour is omitted rather than guessed', () => {
  for (const hour of [undefined, null, 24, -1, 'six']) {
    const score = { rating: 3, night: { isNight: true, nextDaylight: { hour } }, penaltyDetails: [], adjustments: [] };
    assert.deepEqual(texts(PC.buildWhy(score, false)), ['Night here'], `hour=${String(hour)}`);
  }
});

// ── rendering details ───────────────────────────────────────────────────────

test('deltas render signed to one decimal with a real minus sign', () => {
  const score = {
    rating: 3,
    penaltyDetails: [{ code: 'A', amount: 1, message: 'Down one' }],
    adjustments: [{ type: 'b', adjustment: 0.2, reason: 'Up a fifth' }]
  };
  const got = lines(PC.buildWhy(score, false))
    .filter((l) => l.cls === 'pcard-why-delta')
    .map((l) => l.text);
  assert.deepEqual(got, ['−1.0', '+0.2']);
  assert.ok(!got.some((d) => d.includes('-')), 'hyphen-minus reads as a dash at small sizes');
});

test('server text is localized through KaaykoPrefs when units are metric', () => {
  const Metric = loadPaddleCard({ localizeUnits: (t) => String(t).replace('35.5C', '96F') });
  const w = Metric.whyState({
    rating: 3,
    penaltyDetails: [{ code: 'A', amount: 1, message: 'Extreme heat (35.5C)' }],
    adjustments: []
  });
  assert.equal(w.factors[0].text, 'Extreme heat (96F)');
});

test('a throwing localizeUnits does not take the card down', () => {
  const Broken = loadPaddleCard({ localizeUnits: () => { throw new Error('boom'); } });
  const w = Broken.whyState({
    rating: 3, penaltyDetails: [{ code: 'A', amount: 1, message: 'Extreme heat' }], adjustments: []
  });
  assert.equal(w.factors[0].text, 'Extreme heat');
});

// ── the minimal variant must stay minimal ───────────────────────────────────

test('scoreMeta carries the rating the row ring needs', () => {
  // ringSvg() reads sm.rating; the local fallback used to omit it, so the ring
  // rendered permanently empty whenever prefs.js had not loaded.
  assert.equal(PC.scoreMeta(3.5).rating, 3.5);
  assert.equal(PC.scoreMeta(null).rating, null);
});

test('normalize keeps the raw score block but still shows the half-point rating', () => {
  const d = PC.normalize({ id: 'x', title: 'X', paddleScore: { rating: 3.5, ratingPrecise: 3.6, adjustments: [] } });
  assert.equal(d.rating, 3.5);
  assert.equal(d.score.ratingPrecise, 3.6);
  assert.equal(PC.normalize({ id: 'x' }).score, null);
});
