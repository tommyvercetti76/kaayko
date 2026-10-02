#!/usr/bin/env node
// scripts/stories-reading-time.js
//
// Read-only. After editing a chapter's text, run:
//   node scripts/stories-reading-time.js src/stories/never-give-up.html
//
// It counts the words of the story (body text only: not photo captions, not
// screen-reader-only labels), works out minutes at 250 words a minute for each
// part and for the whole, and compares them with what the page says in its five
// places: the byline, the postmark, the ring, the Contents list and the
// structured data. It exits 1 if any of them disagree, and prints what to change.

'use strict';
const fs = require('fs');

const WPM = 250;
const file = process.argv[2];
if (!file) { console.error('usage: node scripts/stories-reading-time.js src/stories/<chapter>.html'); process.exit(2); }
const html = fs.readFileSync(file, 'utf8');

const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const words = (fragment) => {
  const text = decode(fragment
    .replace(/<figure[\s\S]*?<\/figure>/g, ' ')
    .replace(/<span class="sr-only">[\s\S]*?<\/span>/g, ' ')
    .replace(/<[^>]+>/g, ' '));
  return (text.match(/[\p{L}\p{N}_’']+/gu) || []).length;
};

const bodyStart = html.indexOf('<div class="story-body">');
const bodyEnd = html.indexOf('<p class="finale">');
if (bodyStart < 0 || bodyEnd < 0) { console.error('Could not find the story body (div.story-body … p.finale).'); process.exit(2); }
const parts = html.slice(bodyStart, bodyEnd).split('<h2 class="chapter"').slice(1);
const counts = parts.map(words);
const total = counts.reduce((a, b) => a + b, 0);
const want = {
  total: Math.max(1, Math.round(total / WPM)),
  parts: counts.map((c) => Math.max(1, Math.round(c / WPM))),
};

const grab = (re) => { const m = html.match(re); return m ? Number(m[1]) : null; };
const has = {
  byline: grab(/<span>(\d+) min read<\/span>/),
  postmark: grab(/>(\d+) MIN<\/text>/),
  ring: grab(/id="ring-label">(\d+)</),
  timeRequired: grab(/"timeRequired": "PT(\d+)M"/),
  wordCount: grab(/"wordCount": (\d+)/),
  parts: [...html.matchAll(/<span class="toc-time">(\d+) min<\/span>/g)].map((m) => Number(m[1])),
};

console.log(`${file}`);
console.log(`  words: ${total} (parts ${counts.join(' + ')})`);
console.log(`  at ${WPM} wpm: ${(total / WPM).toFixed(1)} min → ${want.total} min; parts ${want.parts.join(', ')}`);

const wrong = [];
for (const k of ['byline', 'postmark', 'ring', 'timeRequired']) {
  if (has[k] !== want.total) wrong.push(`${k}: says ${has[k]}, should be ${want.total}`);
}
if (has.wordCount !== total) wrong.push(`wordCount: says ${has.wordCount}, should be ${total}`);
if (has.parts.join() !== want.parts.join()) wrong.push(`Contents part times: say ${has.parts.join(', ')}, should be ${want.parts.join(', ')}`);
if (want.parts.reduce((a, b) => a + b, 0) !== want.total) {
  console.log(`  note: the rounded parts add up to ${want.parts.reduce((a, b) => a + b, 0)}, the total rounds to ${want.total}`);
}

if (wrong.length) { console.log('  MISMATCH:'); wrong.forEach((w) => console.log(`    - ${w}`)); process.exit(1); }
console.log('  all five places agree');
