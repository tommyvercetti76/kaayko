#!/usr/bin/env node
/**
 * Stamp the card page's modules with the current commit.
 *
 * WHY THIS EXISTS
 * ---------------
 * card.html is served `no-cache` and revalidates on every load, so the page
 * itself is always current. Its ES modules are a different matter: a phone
 * browser will keep a module it already has and hand back a page that is half
 * new and half last week. That is not hypothetical — the control on a live
 * phone still read "Bone" for an hour after the server had started sending
 * "American Psycho", which made a shipped fix look like a broken feature and
 * cost an afternoon of looking in the wrong place.
 *
 * Every module reference therefore carries ?v=<commit>. When the commit
 * changes, the URL changes, and a stale module simply cannot be reached.
 *
 * RUN THIS BEFORE EVERY DEPLOY: `npm run stamp`.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const rev = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();

const FILES = [
  'src/card.html',
  'src/js/pages/card.js',
  'src/js/cards/render.js',
  'src/js/cards/skins/engraved.js',
  'src/js/cards/relief.js',
  'src/js/cards/attitude.js',
  'src/js/cards/lamp.js',
  'src/js/cards/morph.js',
  // kit.js imports /js/util.js; it was the one module below the stamped ones
  // that could still be served stale — exactly the failure this exists for.
  'src/js/kit.js',
];

let touched = 0;
for (const rel of FILES) {
  const file = path.join(root, rel);
  const before = fs.readFileSync(file, 'utf8');
  // Any /js/… reference, whether already stamped or not.
  const after = before.replace(
    /(["'])(\/js\/[^"'?]+\.js)(\?v=[0-9a-f]+)?\1/g,
    (_m, q, p) => `${q}${p}?v=${rev}${q}`
  );
  if (after !== before) { fs.writeFileSync(file, after); touched++; }
}

console.log(`stamped ${touched} file(s) at ${rev}`);
