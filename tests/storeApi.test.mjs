/**
 * storeApi.request(): the contract every store page relies on.
 *   offline  → status 0, offline:true   (fetch rejected — DNS, CORS, no network)
 *   timeout  → status 0, timeout:true   (AbortController fired)
 *   ok/4xx/5xx → status + parsed JSON, never a throw
 * Helpers turn failures into ApiError with a shopper-readable message.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.document = { readyState: 'complete', getElementById: () => null, addEventListener: () => {} };
globalThis.location = { hostname: 'kaay.store', origin: 'https://kaay.store' };
globalThis.KAAYKO_API_BASE = 'https://api.example.test';

const calls = [];
function fetchStub(behaviour) {
  globalThis.fetch = (url, init) => {
    calls.push({ url, init });
    if (behaviour.reject) return Promise.reject(new TypeError('Failed to fetch'));
    if (behaviour.hang) return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    return Promise.resolve({ ok: behaviour.status < 400, status: behaviour.status, json: () => Promise.resolve(behaviour.body) });
  };
}

const api = await import('../src/js/services/storeApi.js');

test('request() posts JSON to the configured base and returns the parsed body', async () => {
  fetchStub({ status: 200, body: { clientSecret: 'cs', amount: 2499 } });
  const r = await api.createPaymentIntent({ items: [] });
  assert.equal(calls.at(-1).url, 'https://api.example.test/createPaymentIntent');
  assert.equal(calls.at(-1).init.method, 'POST');
  assert.equal(calls.at(-1).init.headers['Content-Type'], 'application/json');
  assert.deepEqual(r, { ok: true, status: 200, data: { clientSecret: 'cs', amount: 2499 }, offline: false, timeout: false });
});

test('a rejected fetch is offline, not a throw', async () => {
  fetchStub({ reject: true });
  const r = await api.request('/products');
  assert.deepEqual(r, { ok: false, status: 0, data: null, offline: true, timeout: false });
});

test('a hung request times out and says so', async () => {
  fetchStub({ hang: true });
  const r = await api.request('/products', { timeoutMs: 20 });
  assert.equal(r.ok, false);
  assert.equal(r.timeout, true);
  assert.equal(r.offline, false);
});

test('getAllProducts unwraps {products} and throws an ApiError with the shopper message on 5xx', async () => {
  fetchStub({ status: 200, body: { success: true, products: [{ id: 'a' }] } });
  assert.deepEqual(await api.getAllProducts(), [{ id: 'a' }]);
  fetchStub({ status: 503, body: { error: 'internal stack trace text' } });
  await assert.rejects(api.getAllProducts(), (err) => {
    assert.ok(err instanceof api.ApiError);
    assert.equal(err.status, 503);
    assert.doesNotMatch(err.message, /stack trace/);     // raw server text never reaches the page
    return true;
  });
});

test('getProduct surfaces 404 as an ApiError the page can branch on', async () => {
  fetchStub({ status: 404, body: { error: 'not found' } });
  await assert.rejects(api.getProduct('nope'), (err) => err.status === 404);
});

test('a 4xx message from the server is passed to the shopper; friendlyMessage never leaks other errors', async () => {
  fetchStub({ status: 400, body: { message: 'That piece just sold out.' } });
  await assert.rejects(api.voteOnProduct('p', 1), (err) => err.message === 'That piece just sold out.');
  assert.equal(api.friendlyMessage(new Error('ReferenceError: x is not defined'), 'fallback'), 'fallback');
});
