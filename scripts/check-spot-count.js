#!/usr/bin/env node
/**
 * The spot count is written into meta descriptions, Open Graph tags and
 * schema.org FAQ answers across five files. It said 17 for long enough that
 * the real number reached 21 — including inside a structured-data answer
 * search engines quote verbatim.
 *
 * Static HTML cannot read the API, so the number stays hardcoded. This makes
 * it drift loudly instead of silently: it fails when the files disagree with
 * each other, and warns when they disagree with production.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const FILES = [
  'index.html', 'paddlingout.html', 'paddlingout/search.html', 'assets/kaayko-og.svg',
];
// Case-INSENSITIVE on purpose. It was /hand-picked/g, so the two title-cased
// claims ("21 Hand-Picked Spots", in <title> and og:title) were invisible to
// this check — which is exactly how the page came to say 17 in its title and
// 21 in its description at the same time, and pass.
const RE = /(\d+)\s+hand-picked/gi;

const found = new Map();
for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(RE)) {
    if (!found.has(m[1])) found.set(m[1], []);
    found.get(m[1]).push(rel);
  }
}

if (!found.size) {
  console.log('Spot count check: no "<n> hand-picked" claims found.');
  process.exit(0);
}

if (found.size > 1) {
  console.error('Spot count check FAILED — the site contradicts itself:');
  for (const [n, files] of found) console.error(`  ${n}: ${[...new Set(files)].join(', ')}`);
  process.exit(1);
}

const claimed = [...found.keys()][0];
const places = [...new Set([...found.values()].flat())].length;

(async () => {
  try {
    const res = await fetch('https://api-vwcc5j4qda-uc.a.run.app/paddlingOut', {
      signal: AbortSignal.timeout(12000),
    });
    const body = await res.json();
    const rows = Array.isArray(body) ? body : (body.data || body.spots || []);
    const live = rows.length;
    if (!live) throw new Error('empty spot list');
    if (String(live) !== claimed) {
      console.warn(`Spot count WARNING: pages say ${claimed}, production serves ${live}.`);
      console.warn(`  Update all ${places} places: sed -i '' 's/${claimed} hand-picked/${live} hand-picked/g' \\`);
      console.warn(`    ${FILES.map((f) => 'src/' + f).join(' ')}`);
      process.exit(0);           // a warning, not a build break — the API may be down
    }
    console.log(`Spot count check passed — ${claimed} in ${places} places, ${live} live.`);
  } catch (err) {
    console.log(`Spot count check: ${claimed} used consistently in ${places} places (live count unavailable: ${err.message}).`);
  }
})();
