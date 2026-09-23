/**
 * The browser's copy of the spot list must not be poisoned by a scoreless answer.
 *
 * Measured on kaayko.com, 21 Sep 2026. The server pre-computes every Paddle
 * Score on a 15-minute schedule; between the moment the old batch expires and
 * the moment the new one is written, GET /paddlingOut answers with every spot
 * present and every `paddleScore` null. The page guarded only the EMPTY answer
 * ("if (!spots.length && cached) return"), so a scoreless one sailed past,
 * overwrote thirty minutes of good cached cards, and was then served back to
 * that visitor, blank, until it aged out. Forced live, 21 cached scores became
 * 0 in a single fetch.
 *
 * These load the real page script against a small fake DOM and drive the two
 * answers through it, because the guard's whole value is in which of them it
 * lets through.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const PAGE = fileURLToPath(new URL('../src/js/paddlingout.js', import.meta.url));
const KEY = 'kaayko_po_list_v1';
const API = 'https://api.example.test';

const spot = (id, rating) => ({
  id, title: id, subtitle: '', text: '', imgSrc: [],
  paddleScore: rating == null ? null : { rating, conditions: {}, computedAt: '2026-09-21T22:45:10.077Z' }
});
const scored   = () => [spot('whiterock', 3), spot('jenny', 4), spot('kens', 1.5)];
const unscored = () => [spot('whiterock', null), spot('jenny', null), spot('kens', null)];

/** Just enough DOM for the list page: elements that accept the calls it makes. */
function makeEl(tag = 'div') {
  const el = {
    tagName: tag, children: [], style: {}, dataset: {}, tabIndex: 0,
    _html: '', className: '', textContent: '',
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; if (v === '') this.children = []; },
    classList: {
      _s: new Set(),
      add(...c) { c.forEach((x) => this._s.add(x)); },
      remove(...c) { c.forEach((x) => this._s.delete(x)); },
      toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    append(...n) { this.children.push(...n); },
    appendChild(n) { this.children.push(n); return n; },
    setAttribute() {}, addEventListener() {}, querySelector: () => null
  };
  return el;
}

/**
 * Run the page once. `cachedSpots` seeds localStorage the way a previous visit
 * would have; `answer` is what the API returns this time.
 * @returns {{cache: object|null, renders: number}}
 */
function run({ cachedSpots, answer, holdFetch = null }) {
  const container = makeEl('section');
  const store = new Map();
  if (cachedSpots) store.set(KEY, JSON.stringify({ url: `${API}/paddlingOut`, at: Date.now(), spots: cachedSpots }));

  let renders = 0;
  const listeners = {};
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout: (fn) => 0, clearTimeout() {},
    URLSearchParams,
    Date,
    JSON,
    Array,
    CustomEvent: class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } },
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, v),
      removeItem: (k) => store.delete(k)
    },
    fetch: async () => { if (holdFetch) await holdFetch; return { json: async () => answer }; },
    document: {
      addEventListener: (t, fn) => { listeners[t] = fn; },
      getElementById: (id) => (id === 'cardsContainer' ? container : null),
      createElement: (t) => makeEl(t)
    }
  };
  ctx.window = {
    location: { search: '', href: '' },
    KAAYKO_API_BASE: API,
    KaaykoPrefs: null,
    PaddleCard: { create: () => { renders++; return makeEl('article'); } },
    addEventListener() {},
    dispatchEvent() {}
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(PAGE, 'utf8'), ctx, { filename: PAGE });
  listeners.DOMContentLoaded();
  return { ctx, store, renders: () => renders };
}

const cacheOf = (store) => JSON.parse(store.get(KEY) || 'null');
const withScores = (spots) => (spots || []).filter((s) => s && s.paddleScore).length;

/**
 * Found 22 Sep 2026 by this very test. The two cache constants were declared
 * BELOW the `if (spotId) ... else fetchAll()` dispatch that reaches them, so
 * readListCache hit the temporal dead zone on every first load, its try/catch
 * reported that as "no cache", and the stale copy was written on every visit
 * and never once read. Every visitor waited for the API. The assertion is
 * "cards are on screen before the network answers", because that is the thing
 * the cache exists to buy.
 */
test('the cached copy paints before the network answers', async () => {
  let release;
  const held = new Promise((r) => { release = r; });
  const { renders } = run({ cachedSpots: scored(), answer: scored(), holdFetch: held });
  assert.equal(renders(), 3, 'last visit\'s cards must be on screen already');
  release();
  await new Promise((r) => setImmediate(r));
});

test('a scoreless answer does not overwrite cards that still have numbers', async () => {
  const { store } = run({ cachedSpots: scored(), answer: unscored() });
  await new Promise((r) => setImmediate(r));
  assert.equal(withScores(cacheOf(store).spots), 3,
    'the cached copy must keep its three scores, not be replaced by three nulls');
});

test('a normal answer still replaces the cache', async () => {
  const fresher = [spot('whiterock', 2), spot('jenny', 2.5), spot('kens', 5)];
  const { store } = run({ cachedSpots: scored(), answer: fresher });
  await new Promise((r) => setImmediate(r));
  const ratings = cacheOf(store).spots.map((s) => s.paddleScore.rating);
  assert.deepEqual(ratings, [2, 2.5, 5], 'real new scores must be written through');
});

test('with nothing cached, a scoreless answer is still shown — it is all there is', async () => {
  const { store, renders } = run({ cachedSpots: null, answer: unscored() });
  await new Promise((r) => setImmediate(r));
  assert.equal(withScores(cacheOf(store).spots), 0);
  assert.equal(renders(), 3, 'the spots must render, scored or not');
});

test('an empty answer is still refused, as it always was', async () => {
  const { store } = run({ cachedSpots: scored(), answer: [] });
  await new Promise((r) => setImmediate(r));
  assert.equal(withScores(cacheOf(store).spots), 3);
});
