/**
 * AUDIT-2026-09-18 #22 — read the structured penaltyDetails[], not the
 * pre-formatted display strings.
 *
 * The payloads below are verbatim from the live API on 18 Sep 2026
 * (GET https://kaayko.com/api/paddleScore?spotId=…).
 *
 * The regression that matters: Lake Crescent publishes
 *   "Gusty conditions (gusts 15.2 mph, +11.2 over wind): -1"
 * and the old unanchored /([-+]\d+\.?\d*)/ took the FIRST signed number in the
 * line — +11.2 — as the penalty. The real magnitude is 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const MODAL = fileURLToPath(new URL('../src/js/advancedModal.js', import.meta.url));
const HERO = fileURLToPath(new URL('../src/js/components/RatingHero.js', import.meta.url));

function loadModalClass() {
  const ctx = {
    window: {},
    document: { addEventListener() {}, createElement: () => ({ style: {} }) },
    console: { log() {}, warn() {}, error() {} }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(MODAL, 'utf8'), ctx, { filename: MODAL });
  assert.ok(ctx.window.advancedModal, 'advancedModal.js must expose window.advancedModal');
  const Klass = ctx.window.advancedModal.constructor;
  assert.equal(typeof Klass.readPenalties, 'function', 'readPenalties must exist');
  return Klass;
}

function loadHero() {
  const ctx = {
    window: {
      KaaykoPrefs: {
        fmtTemp: v => `${v}°C`, fmtWind: v => `${v} km/h`,
        fmtDist: v => `${v} km`, fmtPrecip: v => `${v} mm`,
        paddleScoreColor: () => '#000', localizeUnits: t => t
      }
    },
    localStorage: { getItem: () => null, setItem() {} },
    document: { createElement: () => ({ style: {}, set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, firstElementChild: null }) },
    console: { log() {}, warn() {}, error() {} }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(HERO, 'utf8'), ctx, { filename: HERO });
  assert.ok(ctx.window.RatingHero, 'RatingHero.js must expose window.RatingHero');
  return new ctx.window.RatingHero();
}

// ── Live payloads ───────────────────────────────────────────────────────────

const TRINITY = {
  penaltiesApplied: ['Extreme heat (37.4°C): -1', 'Moderate UV (6.6): -0.5'],
  penaltyDetails: [
    { code: 'TEMP_VERY_HOT', amount: 1, message: 'Extreme heat (37.4°C)', context: {} },
    { code: 'UV_MODERATE', amount: 0.5, message: 'Moderate UV (6.6)', context: {} }
  ],
  totalPenalty: 1.5
};

const CRESCENT = {
  penaltiesApplied: ['Gusty conditions (gusts 15.2 mph, +11.2 over wind): -1'],
  penaltyDetails: [
    { code: 'GUSTS_MAJOR', amount: 1, message: 'Gusty conditions (gusts 15.2 mph, +11.2 over wind)', context: {} }
  ],
  totalPenalty: 1
};

// ── readPenalties ───────────────────────────────────────────────────────────

test('structured details carry the code and the magnitude', () => {
  const R = loadModalClass().readPenalties(TRINITY);
  assert.equal(R.source, 'structured');
  assert.deepEqual(Array.from(R.items, i => i.code), ['TEMP_VERY_HOT', 'UV_MODERATE']);
  assert.deepEqual(Array.from(R.items, i => i.magnitude), [1, 0.5]);
  assert.deepEqual(Array.from(R.items, i => i.delta), [-1, -0.5]);
  // Same convention as the API's own field.
  assert.equal(R.totalPenalty, TRINITY.totalPenalty);
});

test('REGRESSION — an inner signed figure is not mistaken for the penalty', () => {
  const Klass = loadModalClass();

  // What the old code did, reproduced here so the bug is visible, not asserted
  // from memory:
  const old = CRESCENT.penaltiesApplied.reduce((sum, p) => {
    const m = p.match(/([-+]\d+\.?\d*)/);
    return sum + (m ? parseFloat(m[1]) : 0);
  }, 0);
  assert.equal(old, 11.2, 'the old parse really did read +11.2');

  // Structured path.
  assert.equal(Klass.readPenalties(CRESCENT).totalPenalty, 1);

  // And the string fallback, for a cached response with no penaltyDetails.
  const legacy = Klass.readPenalties({ penaltiesApplied: CRESCENT.penaltiesApplied });
  assert.equal(legacy.source, 'legacy-strings');
  assert.equal(legacy.totalPenalty, 1);
  assert.equal(legacy.items[0].message, 'Gusty conditions (gusts 15.2 mph, +11.2 over wind)');
  assert.equal(legacy.items[0].code, null, 'the string format never carried a code');
});

test('empty penaltyDetails means no penalties, and says so without inventing one', () => {
  // Verified live: penaltyDetails and adjustments are often [] (Chilika).
  const R = loadModalClass().readPenalties({ penaltyDetails: [], penaltiesApplied: [] });
  assert.equal(R.source, 'structured');
  assert.equal(R.items.length, 0);
  assert.equal(R.totalPenalty, 0);
  assert.equal(R.strings.length, 0);
});

test('a response carrying neither array is ABSENT, not "nothing was penalised"', () => {
  const R = loadModalClass().readPenalties({ rating: 3.5 });
  assert.equal(R.source, 'absent');
  assert.equal(R.items.length, 0);
  assert.equal(R.totalPenalty, 0);
});

test('a detail with no magnitude, or no message, is dropped rather than guessed at', () => {
  const R = loadModalClass().readPenalties({
    penaltyDetails: [
      { code: 'NO_AMOUNT', message: 'Something happened' },
      { code: 'ZERO', amount: 0, message: 'Nothing moved' },
      { code: 'GOOD', amount: 0.5, message: 'Moderate UV (6.6)' },
      null
    ]
  });
  assert.deepEqual(Array.from(R.items, i => i.code), ['GOOD']);
  assert.equal(R.totalPenalty, 0.5);
});

test('junk input never throws', () => {
  const Klass = loadModalClass();
  for (const bad of [null, undefined, 42, 'x', { penaltyDetails: 'nope' }]) {
    const R = Klass.readPenalties(bad);
    assert.equal(R.items.length, 0);
    assert.equal(R.totalPenalty, 0);
  }
});

// ── RatingHero consumes the structured form ─────────────────────────────────

test('the briefing renders the structured penalties, magnitudes intact', () => {
  const hero = loadHero();
  const pen = loadModalClass().readPenalties(TRINITY);
  const items = hero.analyzeConditions({ penaltyDetails: pen.items }, 2.0);
  const heat = items.find(i => /Extreme heat/.test(i.label));
  assert.ok(heat, 'the heat penalty must appear');
  assert.equal(heat.detail, 'Score impact: -1.0 pts');
  const uv = items.find(i => i.label === 'Moderate UV (6.6)');
  assert.ok(uv, 'the UV penalty must appear');
  assert.equal(uv.detail, 'Score impact: -0.5 pts');
});

test('the briefing falls back to strings only when penaltyDetails is absent', () => {
  const hero = loadHero();
  const items = hero.analyzeConditions({ penalties: CRESCENT.penaltiesApplied }, 2.0);
  const gust = items.find(i => /Gusty conditions/.test(i.label));
  assert.ok(gust, 'the fallback must still render the penalty');
  assert.equal(gust.detail, 'Score impact: -1.0 pts', 'not -11.2, and not +11.2');
});

test('an empty structured array does not fall through to the strings', () => {
  const hero = loadHero();
  // penaltyDetails: [] is a positive statement ("nothing was penalised"). The
  // stale strings beside it must not be re-read as if they were current.
  const items = hero.analyzeConditions(
    { penaltyDetails: [], penalties: TRINITY.penaltiesApplied }, 4.0
  );
  assert.equal(items.filter(i => /Extreme heat/.test(i.label)).length, 0);
});

test('no penalties at all still yields a non-empty briefing — never a bare heading', () => {
  const hero = loadHero();
  const items = hero.analyzeConditions({ penaltyDetails: [] }, 4.2);
  assert.ok(items.length > 0, 'the briefing must never render an empty container');
});
