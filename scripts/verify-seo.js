#!/usr/bin/env node
//
// scripts/verify-seo.js
//
// Guardrail. Fails the build if any of the SEO invariants regress.
//
//   node scripts/verify-seo.js
//
// Checks, in order:
//   1. Generated spot pages and the slug map are up to date with their source
//   2. Every sitemap URL resolves to a real file
//   3. No sitemap URL is marked noindex
//   4. Every sitemap URL has a title, meta description and a self-referencing
//      extensionless canonical
//   5. Every indexable page has exactly one <h1>
//   6. Every JSON-LD block parses
//   7. No internal link 404s (the catch-all rewrite is gone, so a bad href is
//      now a real 404 rather than a silent homepage duplicate)
//   8. No <meta name="keywords"> anywhere
//   9. No <img> without an alt attribute in static markup

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const ORIGIN = 'https://kaayko.com';
const fail = [];
const note = (m) => fail.push(m);

const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
// Must be a FILE — /paddlingout would otherwise match the directory src/paddlingout.
const exists = (f) => {
  try { return fs.statSync(path.join(root, f)).isFile(); }
  catch { return false; }
};

// ── 1. generated artefacts in sync ─────────────────────────────────────────
try {
  execFileSync('node', ['scripts/generate-spot-pages.js', '--check'], { cwd: root, stdio: 'pipe' });
} catch (e) {
  note('Generated spot pages are stale. Run: node scripts/generate-spot-pages.js');
}

// ── resolve a URL path to a source file, mirroring firebase cleanUrls ───────
const fb = JSON.parse(read('firebase.json')).hosting;
const patterns = [...(fb.rewrites || []), ...(fb.redirects || [])].map((r) => r.source);
const explicit = (p) =>
  patterns.some((pat) =>
    pat === p ||
    (pat.endsWith('/**') && p.startsWith(pat.slice(0, -3) + '/')) ||
    (pat.endsWith('**') && p.startsWith(pat.slice(0, -2)))
  );
function sourceFor(urlPath) {
  const p = urlPath.split('?')[0].split('#')[0];
  if (p === '/' || p === '') return 'src/index.html';
  const q = p.replace(/^\//, '');
  if (exists(`src/${q}`)) return `src/${q}`;
  if (exists(`src/${q}.html`)) return `src/${q}.html`;
  if (exists(`src/${q}/index.html`)) return `src/${q}/index.html`;
  return null;
}

// ── 2-6. sitemap integrity ─────────────────────────────────────────────────
const sitemap = read('src/sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
if (!locs.length) note('sitemap.xml contains no URLs.');

for (const url of locs) {
  const p = url.replace(ORIGIN, '') || '/';
  const file = sourceFor(p);
  if (!file) { note(`sitemap: ${url} does not resolve to a file`); continue; }
  const html = read(file);

  const robots = html.match(/<meta\s+name=["']robots["'][^>]*content=["']([^"']*)["']/i);
  if (robots && /noindex/i.test(robots[1])) note(`sitemap: ${url} is noindex but listed`);

  if (!/<title>[^<]+<\/title>/i.test(html)) note(`${file}: missing <title>`);
  if (!/<meta\s+name=["']description["']/i.test(html)) note(`${file}: missing meta description`);

  const canon = html.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (!canon) note(`${file}: missing canonical`);
  else {
    const c = canon[1];
    if (c.replace(/\/$/, '') !== url.replace(/\/$/, '')) note(`${file}: canonical ${c} != ${url}`);
    if (/\.html($|\?)/.test(c)) note(`${file}: canonical is not extensionless (${c})`);
  }

  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1s !== 1) note(`${file}: expected exactly one <h1>, found ${h1s}`);
}

// ── walk every page we own for the remaining checks ─────────────────────────
const SKIP = ['/admin/', '/kreator/', '/karma/', '/kutz/', '/node_modules/'];
function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (SKIP.some((s) => rel.includes(s))) continue;
    if (e.isDirectory()) walk(rel, out);
    else if (e.name.endsWith('.html')) out.push(rel);
  }
  return out;
}
const pages = walk('src');

// ── 6. JSON-LD parses ──────────────────────────────────────────────────────
for (const f of pages) {
  const html = read(f);
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { JSON.parse(m[1]); }
    catch (e) { note(`${f}: invalid JSON-LD — ${String(e.message).slice(0, 70)}`); }
  }
  // ── 8. meta keywords ─────────────────────────────────────────────────────
  if (/<meta\s+name=["']keywords["']/i.test(html)) note(`${f}: has <meta name="keywords">`);
  // ── 9. images without alt (static markup only) ───────────────────────────
  for (const img of html.match(/<img\b[^>]*>/gi) || []) {
    if (!/\salt\s*=/i.test(img)) note(`${f}: <img> without alt — ${img.slice(0, 60)}`);
  }
}

// ── 7. internal links resolve ──────────────────────────────────────────────
const seen = new Map();
for (const f of pages) {
  for (const m of read(f).matchAll(/href="(\/[^"#]*)"/g)) {
    if (!seen.has(m[1])) seen.set(m[1], f);
  }
}
for (const [href, from] of seen) {
  if (!sourceFor(href) && !explicit(href.split('?')[0])) {
    note(`broken internal link ${href} (first seen in ${from})`);
  }
}

// ── report ─────────────────────────────────────────────────────────────────
if (fail.length) {
  console.error(`\nSEO verification FAILED — ${fail.length} problem(s):\n`);
  fail.forEach((m) => console.error('  • ' + m));
  console.error('');
  process.exit(1);
}
console.log(
  `SEO verification passed — ${locs.length} sitemap URLs, ${pages.length} pages, ` +
  `${seen.size} internal links, 0 problems.`
);
