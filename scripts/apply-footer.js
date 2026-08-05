#!/usr/bin/env node
//
// scripts/apply-footer.js
//
// Applies the one site footer (src/css/footer.css + scripts/footer-links.js)
// to every public page, replacing whatever variant was there before.
//
//   node scripts/apply-footer.js
//   node scripts/apply-footer.js --check   (verify only, non-zero on drift)
//
// For each page it:
//   1. replaces the existing <footer>…</footer>, or inserts one before </body>
//   2. ensures /css/footer.css is linked in <head>
//   3. ensures the shared year-injection snippet is present exactly once
//
// The 17 generated spot pages are NOT touched here — they get the same footer
// from scripts/generate-spot-pages.js, which imports the same link sets.

const fs = require('fs');
const path = require('path');
const { PAGES, LIGHT, render } = require('./footer-links');

const root = path.resolve(__dirname, '..');
const checkOnly = process.argv.includes('--check');

const CSS_LINK = '<link rel="stylesheet" href="/css/footer.css">';
const YEAR_MARK = 'kaayko-footer-year';
const YEAR_SCRIPT = `<script>
  /* ${YEAR_MARK} */
  (function () {
    var y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  })();
</script>`;

let changed = 0;
const drift = [];

for (const [rel, setName] of Object.entries(PAGES)) {
  const file = path.join(root, 'src', rel);
  if (!fs.existsSync(file)) {
    console.warn(`  skip (missing): ${rel}`);
    continue;
  }
  const before = fs.readFileSync(file, 'utf8');
  let s = before;

  // 1) Footer markup — replace every existing <footer>, keep exactly one.
  // Map the source file to its public URL so the footer can drop its self-link.
  const self = '/' + rel.replace(/\.html$/, '').replace(/^index$/, '');
  const footer = render(setName, { light: LIGHT.has(rel), self: self === '/' ? '/' : self });
  // Anchor to start-of-line so the literal text "<footer>" appearing inside a
  // CSS/HTML comment cannot be mistaken for the opening tag — that would make
  // the lazy match run on to the page's real </footer> and swallow everything
  // in between. Emitted footers always begin a line.
  const all = [...s.matchAll(/^[ \t]*<footer[\s\S]*?<\/footer>/gim)];
  if (all.length) {
    // Replace the last one in document order; drop any others.
    for (let i = all.length - 1; i >= 0; i--) {
      const m = all[i];
      const replacement = i === all.length - 1 ? footer : '';
      s = s.slice(0, m.index) + replacement + s.slice(m.index + m[0].length);
    }
  } else if (/<\/body>/i.test(s)) {
    s = s.replace(/([ \t]*)<\/body>/i, `${footer}\n\n$1</body>`);
  } else {
    console.warn(`  skip (no </body>): ${rel}`);
    continue;
  }

  // 2) Stylesheet link.
  if (!s.includes('/css/footer.css')) {
    if (/<\/head>/i.test(s)) s = s.replace(/([ \t]*)<\/head>/i, `$1  ${CSS_LINK}\n$1</head>`);
  }

  // 3) Year injection, exactly once.
  if (!s.includes(YEAR_MARK)) {
    s = s.replace(/([ \t]*)<\/body>/i, `$1  ${YEAR_SCRIPT.replace(/\n/g, '\n$1  ')}\n\n$1</body>`);
  }

  if (s !== before) {
    changed++;
    drift.push(rel);
    if (!checkOnly) fs.writeFileSync(file, s, 'utf8');
  }
}

if (checkOnly) {
  if (changed) {
    console.error(`Footer out of date on ${changed} page(s):`);
    drift.forEach((d) => console.error('  • ' + d));
    console.error('Run: node scripts/apply-footer.js');
    process.exit(1);
  }
  console.log(`Footer consistent across ${Object.keys(PAGES).length} pages.`);
} else {
  console.log(`Applied the site footer to ${changed} of ${Object.keys(PAGES).length} pages.`);
  drift.forEach((d) => console.log('  • ' + d));
}
