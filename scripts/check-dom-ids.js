#!/usr/bin/env node
/**
 * Every `getElementById('x')` must have an `id="x"` that can actually exist.
 *
 * Written after /card shipped broken on every phone for a day. The page copy was
 * cut back and the `#tilt-note` span went with it, but the module still did
 * `document.getElementById('tilt-note').textContent = …` on the touch branch.
 * That is a TypeError at the top level of an ES module, so execution stopped
 * there and the code below — the part that draws the card — never ran. Desktop
 * took the other branch and looked perfect. `npm run check` passed, because the
 * file parses fine: the reference is only wrong at runtime.
 *
 * So the check is: resolve which HTML pages can load each module (directly, or by
 * importing it), and require every literal id it looks up to appear either in one
 * of those pages or in markup the module graph writes itself.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const rel = (f) => path.relative(SRC, f);

const html = [];
const js = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // kutz is a Vite/React app with its own build; vendor is third party.
      if (!['vendor', 'kutz', 'node_modules'].includes(entry.name)) walk(full);
      continue;
    }
    if (entry.name.endsWith('.html')) html.push(full);
    else if (entry.name.endsWith('.js')) js.push(full);
  }
})(SRC);

const read = (f) => fs.readFileSync(f, 'utf8');
const matches = (text, re) => [...text.matchAll(re)].map((m) => m[1]);

/** A site-absolute script path as written in an HTML tag or an import. */
const resolveModule = (spec) => {
  if (!spec.startsWith('/')) return null;            // bare and relative specs: not ours
  const full = path.join(SRC, spec.replace(/^\//, '').split('?')[0]);
  return fs.existsSync(full) ? full : null;
};

// Which modules does each file pull in — <script src> for pages, static imports
// for modules. Both are literal strings, so both are greppable.
const edges = new Map();
const deps = (file, text) => {
  const out = new Set();
  const specs = file.endsWith('.html')
    ? matches(text, /<script\b[^>]*\bsrc="([^"]+)"/g)
    : matches(text, /(?:^|\n)\s*import\s+(?:[^'"]*?from\s*)?['"]([^'"]+)['"]/g);
  for (const spec of specs) { const m = resolveModule(spec); if (m) out.add(m); }
  return out;
};

const text = new Map();
for (const f of [...html, ...js]) { text.set(f, read(f)); }
for (const f of [...html, ...js]) { edges.set(f, deps(f, text.get(f))); }

// Every page that can reach a module, following imports transitively.
const reachedBy = new Map();
for (const page of html) {
  const seen = new Set();
  const stack = [...edges.get(page)];
  while (stack.length) {
    const m = stack.pop();
    if (seen.has(m)) continue;
    seen.add(m);
    if (!reachedBy.has(m)) reachedBy.set(m, new Set());
    reachedBy.get(m).add(page);
    for (const next of edges.get(m) ?? []) stack.push(next);
  }
}

// An id counts as available whether it is written in markup or assigned to an
// element in code — several of these modules build their own furniture with
// `el.id = 'x'` and then look it up on the next visit to decide not to build it
// twice, which is correct and must not be flagged.
const idsIn = (text) => new Set([
  ...matches(text, /\bid="([A-Za-z][-\w:.]*)"/g),
  ...matches(text, /\bid='([A-Za-z][-\w:.]*)'/g),
  ...matches(text, /\.id\s*=\s*['"]([^'"]+)['"]/g),
  ...matches(text, /setAttribute\(\s*['"]id['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g),
]);

let failed = 0;
for (const file of js) {
  const pages = reachedBy.get(file);
  // A module no page loads is either dead or loaded some way this cannot see.
  // Either is a separate question from whether its ids exist.
  if (!pages || pages.size === 0) continue;

  const looked = new Set(matches(text.get(file), /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g));
  if (!looked.size) continue;

  // Ids the module graph writes itself count as present: plenty of these pages
  // build their own markup and then look it up.
  const available = new Set();
  for (const page of pages) {
    for (const id of idsIn(text.get(page))) available.add(id);
    for (const m of [...edges.get(page)]) for (const id of idsIn(text.get(m) ?? '')) available.add(id);
  }
  for (const id of idsIn(text.get(file))) available.add(id);
  for (const dep of edges.get(file)) for (const id of idsIn(text.get(dep) ?? '')) available.add(id);

  for (const id of looked) {
    if (available.has(id)) continue;
    failed++;
    console.error(`✗ ${rel(file)} looks up #${id}, which no page that loads it has`);
    console.error(`    loaded by: ${[...pages].map(rel).join(', ')}`);
  }
}

console.log(failed
  ? `${failed} dangling getElementById reference${failed === 1 ? '' : 's'}`
  : 'DOM id check passed — every getElementById target exists.');
process.exit(failed ? 1 : 0);
