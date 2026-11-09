#!/usr/bin/env node
//
// scripts/generate-product-sitemap.js
//
// Writes src/sitemap-products.xml: one URL per product the public catalogue
// serves, at its canonical address https://kaayko.com/store/p/<id> (the same
// address js/product.js puts in <link rel="canonical"> on both hosts).
//
//   node scripts/generate-product-sitemap.js            # fetch the live catalogue, write the file
//   node scripts/generate-product-sitemap.js --check    # the committed file parses and every URL has the right shape
//
// Run it after every product upload or delisting (store_uploader, Kortex → Products)
// and commit the result. It is the only sitemap that needs the network, which is
// why it is not part of `npm run check` — verify-seo.js only validates the file.
//
// No <lastmod>: the catalogue does not record when a product last changed, and a
// made-up date is worse than none (Google ignores lastmod it has caught lying).

const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://kaayko.com';
const API = process.env.KAAYKO_API || `${ORIGIN}/api`;
const out = path.join(__dirname, '..', 'src', 'sitemap-products.xml');
const checkOnly = process.argv.includes('--check');

const URL_SHAPE = /^https:\/\/kaayko\.com\/store\/p\/[A-Za-z0-9_-]+$/;

function parseLocs(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
}

if (checkOnly) {
  if (!fs.existsSync(out)) { console.error('sitemap-products.xml is missing. Run: node scripts/generate-product-sitemap.js'); process.exit(1); }
  const xml = fs.readFileSync(out, 'utf8');
  const locs = parseLocs(xml);
  const bad = locs.filter((u) => !URL_SHAPE.test(u));
  if (!xml.startsWith('<?xml') || !/<urlset /.test(xml)) { console.error('sitemap-products.xml is not a sitemap'); process.exit(1); }
  if (!locs.length) { console.error('sitemap-products.xml lists no products'); process.exit(1); }
  if (bad.length) { console.error(`sitemap-products.xml: ${bad.length} URL(s) are not canonical product addresses:\n  ${bad.join('\n  ')}`); process.exit(1); }
  if (new Set(locs).size !== locs.length) { console.error('sitemap-products.xml has duplicate URLs'); process.exit(1); }
  console.log(`sitemap-products.xml OK (${locs.length} products)`);
  process.exit(0);
}

(async () => {
  const res = await fetch(`${API}/products`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${API}/products → HTTP ${res.status}`);
  const body = await res.json();
  const products = Array.isArray(body) ? body : body.products || [];
  // The API already hides unavailable, deleted and unapproved products; a sold-out
  // piece keeps its page (the Offer says OutOfStock), so it stays listed.
  const ids = [...new Set(products.map((p) => p && p.id).filter((id) => typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id)))].sort();
  if (ids.length < 10) throw new Error(`only ${ids.length} products came back; refusing to write a near-empty sitemap`);

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...ids.map((id) => `  <url>\n    <loc>${ORIGIN}/store/p/${id}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`),
    '</urlset>',
    '',
  ].join('\n');
  fs.writeFileSync(out, xml);
  console.log(`Wrote ${path.relative(process.cwd(), out)} with ${ids.length} products`);
})().catch((e) => { console.error(e.message); process.exit(1); });
