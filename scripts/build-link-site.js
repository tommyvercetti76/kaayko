#!/usr/bin/env node
/**
 * Build the kaay.link hosting folder.
 *
 * `link-site/` is the public folder of the `kaay-link` Firebase Hosting site.
 * It is deliberately NOT `src/`: every file under the public folder is served
 * at its own path, and on kaay.link a path is a link, so a page like
 * src/reads.html would shadow the link named "reads". The folder therefore
 * holds only index.html, robots.txt and the shared Kortex scripts and images
 * copied from src/ by this script. The copies are gitignored; run this before
 * deploying (deploy-hosting-safe.sh does).
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');
const out = path.join(root, 'link-site');

const FILES = [
  'js/vendor/qrcode-generator.js',
  'js/kortex-utm.js',
  'js/kortex-views.js',
  'js/kortex-app.js',
  'js/kortex-sky.js',
  'js/kortex-meteors.js',
  'css/kortex-views.css',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'assets/kortex-og-image.png',
  'assets/kortex-twitter-card.png',
];

let copied = 0;
for (const rel of FILES) {
  const from = path.join(src, rel);
  const to = path.join(out, rel);
  if (!fs.existsSync(from)) { console.error(`build-link-site: missing ${rel}`); process.exit(1); }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  copied++;
}
for (const must of ['index.html', 'robots.txt']) {
  if (!fs.existsSync(path.join(out, must))) { console.error(`build-link-site: link-site/${must} is missing`); process.exit(1); }
}
console.log(`build-link-site: ${copied} files copied into link-site/`);
