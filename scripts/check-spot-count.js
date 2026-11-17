#!/usr/bin/env node
/**
 * No page states how many spots there are.
 *
 * A count written into static HTML goes stale the day a spot is added, and it
 * has, three times: "17" while there were 21, then "22 hand-picked" for 17
 * curated + 7 paddler-added, then (16 Nov 2026) "17 hand-picked spots" in
 * titles, descriptions, structured data and the share image on a site whose
 * list shows 24 — which the owner read, correctly, as the site not knowing how
 * many spots it has. Splitting the number into "hand-picked" and "the rest"
 * was true and still read as wrong.
 *
 * So the rule is the opposite of the old one: this fails when ANY of these
 * files claims a number of spots. Counts a visitor sees come from the API at
 * the moment they look (the list and the grid), never from copy.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const FILES = [
  'index.html', 'about.html', 'paddlingout.html', 'paddlingout/list.html', 'paddlingout/search.html',
  'paddlingout/scouts.html', 'paddlingout/methodology.html', 'paddlingout/forecast.html',
  'paddlingout/settings.html', 'assets/kaayko-og.svg',
];
const RE = /\b(\d+)\s+(hand-?picked|curated|paddling destinations|(?:paddle |paddling )?spots\b|lakes,? rivers)/gi;

const bad = [];
for (const rel of FILES) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    for (const m of line.matchAll(RE)) bad.push(`  src/${rel}:${i + 1}  "${m[0]}"`);
  });
}

if (bad.length) {
  console.error('Spot count check FAILED — a page states a number of spots. Say what they are, not how many:');
  console.error(bad.join('\n'));
  process.exit(1);
}
console.log(`Spot count check passed — no hard-coded spot count in ${FILES.length} files.`);
