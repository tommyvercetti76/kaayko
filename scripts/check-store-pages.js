#!/usr/bin/env node
/**
 * The store's definition of done, as a check (ENGINEERING-IDENTITY.md §9):
 *   • no store page carries more than 30 lines of inline JavaScript
 *     (logic lives in js/pages/*; the synchronous kaay.store gate is the exception it allows)
 *   • every page that loads header.css or storestyle.css loads css/tokens.css first
 *   • no first-party script defines its own escape helper or API base
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src');
const STORE_PAGES = ['index.html', 'store.html', 'product.html', 'animal.html', 'cart.html',
  'order-success.html', 'store-about.html', 'store-privacy.html', 'shipping.html', 'card.html', 'testimonials.html'];
const INLINE_BUDGET = 30;
const failures = [];

function inlineJsLines(html) {
  let n = 0;
  const re = /<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) n += m[1].split('\n').filter((l) => l.trim()).length;
  return n;
}

for (const page of STORE_PAGES) {
  const html = fs.readFileSync(path.join(src, page), 'utf8');
  const n = inlineJsLines(html);
  if (n > INLINE_BUDGET) failures.push(`${page}: ${n} inline JS lines (budget ${INLINE_BUDGET})`);
}

(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['node_modules', 'admin', 'kutz', 'karma'].includes(entry.name)) walk(full); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const html = fs.readFileSync(full, 'utf8');
    const usesChrome = /css\/(header|storestyle)\.css/.test(html);
    if (usesChrome) {
      const t = html.indexOf('css/tokens.css'), c = html.search(/css\/(header|storestyle)\.css/);
      const isStore = /<body[^>]*\bstore-v2\b/.test(html);
      if (t < 0) failures.push(`${path.relative(src, full)}: loads header/storestyle.css without css/tokens.css`);
      // Store pages: tokens first. Paddling pages load tokens LAST on purpose (they win over inline :root).
      else if (isStore && t > c) failures.push(`${path.relative(src, full)}: css/tokens.css must come before header.css / storestyle.css`);
    }
  }
})(src);

const jsRoot = path.join(src, 'js');
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'vendor') walk(full); continue; }
    if (!entry.name.endsWith('.js')) continue;
    const rel = path.relative(src, full);
    if (rel === 'js/util.js' || rel === 'js/kit.js' || rel === 'js/prod-config.js' || rel === 'js/prefs.js') continue;   // the sources themselves
    const s = fs.readFileSync(full, 'utf8');
    // An escape helper is a definition whose body does the replacing; a one-line delegate to util.js is fine.
    if (/(?:const|function)\s+esc(?:apeHtml)?\b[^\n]*\n?[^\n]*replace\(\/\[&<>/.test(s) && !/kortex|tenant|kamera/.test(rel)) failures.push(`${rel}: defines its own escape helper — import { esc } from /js/kit.js`);
    if (/a\.run\.app/.test(s) && !/kortex|tenant/.test(rel)) failures.push(`${rel}: hard-codes the API host — use apiBase() from /js/kit.js`);
  }
})(jsRoot);

if (failures.length) { console.error('Store page check failed:\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('Store page check passed — inline budget, token sheet order, one esc, one API base.');
