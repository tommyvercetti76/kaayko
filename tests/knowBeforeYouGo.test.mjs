/**
 * Know before you go (3 Oct 2026): sourced facts and closures.
 * Nothing renders without a source; a closed spot shows no score anywhere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const K = require('../src/js/components/KnowBeforeYouGo.js');

const fact = (summary, extra = {}) => ({ summary, source: 'https://www.nps.gov/grte/planyourvisit/boat.htm', official: true, checked: '2026-10-03', ...extra });

test('every fact row names its source and the date it was checked', () => {
  const html = K.facts({ facts: { permits: fact('Every craft needs a $25 permit and an AIS inspection.', { required: true }), fees: fact('$35 per vehicle', { free: false }), hazards: [fact('Wind picks up in the afternoon.')] } });
  assert.match(html, /Permits &amp; inspection/);
  assert.equal((html.match(/class="kbg-src"/g) || []).length, 3, 'one source line per fact');
  assert.match(html, /href="https:\/\/www\.nps\.gov\/grte\/planyourvisit\/boat\.htm"/);
  assert.match(html, /checked 3 Oct 2026/);
  assert.ok(html.indexOf('Permits') < html.indexOf('Fees'), 'what stops a trip comes first');
});

test('an unofficial source says so; a non-https source is not linked', () => {
  const html = K.facts({ facts: { hazards: [fact('Four low-head dams on the trail', { official: false, source: 'https://trinitycoalition.org/' })] } });
  assert.match(html, /\(unofficial\)/);
  const bad = K.facts({ facts: { parking: fact('x', { source: 'javascript:alert(1)' }) } });
  assert.doesNotMatch(bad, /javascript:/);
});

test('text is escaped', () => {
  const html = K.facts({ facts: { parking: fact('<img src=x onerror=alert(1)>') } });
  assert.doesNotMatch(html, /<img/);
});

test('no facts, no panel; a put-in with coordinates gets directions', () => {
  assert.equal(K.facts({}), '');
  const html = K.facts({ facts: { launch: fact('Matchless boating site', { lat: 39.27, lng: -106.35 }) } });
  assert.match(html, /maps\/dir\/\?api=1&amp;destination=39\.27,-106\.35|maps\/dir\/\?api=1&destination=39\.27,-106\.35/);
});

test('closed: a closure panel with its source, and isClosed for every surface', () => {
  const spot = { status: { state: 'closed', summary: 'Closed to all recreation for the rest of 2026.', source: 'https://www.denverwater.org/recreation/antero-resevoir', checked: '2026-10-03' } };
  assert.equal(K.isClosed(spot), true);
  assert.equal(K.isClosed({ status: null }), false);
  const html = K.closure(spot);
  assert.match(html, /Closed to all recreation/);
  assert.match(html, /denverwater\.org/);
  assert.match(html, /no Paddle Score/);
  assert.equal(K.closure({}), '');
});
