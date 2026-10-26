/**
 * safeStorage: localStorage when it works; a cookie when storage is blocked; the
 * page's memory when cookies are blocked too. Each case gets a fresh module, since
 * the mode is probed once per page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const blocked = { get() { throw new Error('SecurityError'); } };
function browser({ storage = true, cookies = true } = {}) {
  const jar = new Map();
  const doc = {};
  Object.defineProperty(doc, 'cookie', {
    configurable: true,
    get: () => (cookies ? [...jar].map(([k, v]) => `${k}=${v}`).join('; ') : ''),
    set: (line) => {
      if (!cookies) return;
      const [pair, ...attrs] = line.split('; ');
      const [k, v] = pair.split('=');
      if (attrs.some((a) => a === 'max-age=0')) jar.delete(k); else jar.set(k, v);
    },
  });
  const mem = new Map();
  const ls = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  globalThis.window = globalThis;
  globalThis.document = doc;
  for (const k of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(globalThis, k, storage ? { value: ls, configurable: true, writable: true } : { ...blocked, configurable: true });
  }
  return { jar, mem };
}
let n = 0;
const fresh = () => import(`../src/js/services/safeStorage.js?case=${++n}`);

test('localStorage when it works', async () => {
  const { mem, jar } = browser();
  const s = await fresh();
  assert.equal(s.storageMode(), 'local');
  assert.equal(s.set('kaayko_cart', '[1]'), true);
  assert.equal(mem.get('kaayko_cart'), '[1]');
  assert.equal(jar.size, 0);
});

test('a cookie when storage is blocked, and it reads back on the next page', async () => {
  const { jar } = browser({ storage: false });
  const s = await fresh();
  assert.equal(s.storageMode(), 'cookie');
  assert.equal(s.set('kaayko:currency', 'USD'), true);
  assert.equal(jar.get('kaayko_currency'), 'USD');
  const next = await fresh();                       // a new page, same browser
  assert.equal(next.get('kaayko:currency'), 'USD');
  next.remove('kaayko:currency');
  assert.equal(jar.has('kaayko_currency'), false);
});

test('a value too big for a cookie stays in memory, and says so', async () => {
  browser({ storage: false });
  const s = await fresh();
  assert.equal(s.set('big', 'x'.repeat(5000)), false);
  assert.equal(s.get('big').length, 5000);
});

test('memory only when cookies are blocked too', async () => {
  browser({ storage: false, cookies: false });
  const s = await fresh();
  assert.equal(s.storageMode(), 'memory');
  assert.equal(s.set('k', 'v'), false);
  assert.equal(s.get('k'), 'v');
});
