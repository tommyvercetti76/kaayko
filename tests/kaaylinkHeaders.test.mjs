// kaay.link/m (Kaayko Scouts, was Mapmakers, 28 Oct 2026): Firebase Hosting applies its own header
// rules over a function's on 2xx/3xx answers, so the site-wide CSP ("form-action
// 'self'", no Firebase Storage images) would stop the claim reaching Stripe and hide
// every photo. The site-wide block must skip /m, and /m must carry the router's own
// headers (kaayko-api/functions/api/kortex/mapmakerRouter.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../firebase.json', import.meta.url), 'utf8'));
const site = config.hosting.find((s) => s.site === 'kaay-link');

function headersFor(path) {
  const out = {};
  for (const rule of site.headers) {
    const hit = rule.regex
      ? new RegExp(rule.regex).test(path)
      : rule.source === path || (rule.source.endsWith('/**') && path.startsWith(rule.source.slice(0, -2)));
    if (hit) rule.headers.forEach((h) => { out[h.key] = h.value; });
  }
  return out;
}

test('the site-wide headers skip /m and keep everything else', () => {
  const siteWide = site.headers[0];
  assert.ok(siteWide.regex, 'the first rule is the site-wide one, as a regex');
  const re = new RegExp(siteWide.regex);
  for (const p of ['/', '/abc', '/manifest.json', '/mfoo', '/r/x', '/qr/a.png']) assert.ok(re.test(p), p);
  for (const p of ['/m', '/m/', '/m/home', '/m/pick/2026-10_x/claim']) assert.ok(!re.test(p), p);
});

test('/m carries the router\'s own headers: Stripe form-action, Storage images, no-store, no-referrer', () => {
  for (const p of ['/m', '/m/home', '/m/pick/2026-10_x']) {
    const h = headersFor(p);
    assert.match(h['Content-Security-Policy'], /form-action 'self' https:\/\/checkout\.stripe\.com/);
    assert.match(h['Content-Security-Policy'], /img-src https:\/\/firebasestorage\.googleapis\.com/);
    assert.match(h['Content-Security-Policy'], /default-src 'none'/);
    // Paddling Out's fonts (29 Oct 2026); must match mapmakerRouter.js CSP in kaayko-api.
    assert.match(h['Content-Security-Policy'], /style-src 'unsafe-inline' https:\/\/fonts\.googleapis\.com;/);
    assert.match(h['Content-Security-Policy'], /font-src https:\/\/fonts\.gstatic\.com;/);
    assert.equal(h['Cache-Control'], 'private, no-store');
    assert.equal(h['Referrer-Policy'], 'no-referrer');
    assert.equal(h['X-Frame-Options'], 'DENY');
  }
});
