#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'src', 'sitemap.xml');

const routes = [
  { loc: '/', source: 'src/index.html', changefreq: 'daily', priority: '1.0' },
  { loc: '/paddlingout', source: 'src/paddlingout.html', changefreq: 'daily', priority: '1.0' },
  { loc: '/paddlingout/search', source: 'src/paddlingout/search.html', changefreq: 'weekly', priority: '0.9' },
  { loc: '/paddlingout/methodology', source: 'src/paddlingout/methodology.html', changefreq: 'monthly', priority: '0.8' },
  { loc: '/store', source: 'src/store.html', changefreq: 'weekly', priority: '0.9' },
  { loc: '/about', source: 'src/about.html', changefreq: 'monthly', priority: '0.8' },
  { loc: '/reads', source: 'src/reads.html', changefreq: 'weekly', priority: '0.7' },
  { loc: '/testimonials', source: 'src/testimonials.html', changefreq: 'monthly', priority: '0.6' },
  { loc: '/privacy', source: 'src/privacy.html', changefreq: 'yearly', priority: '0.3' },
  { loc: '/forge', source: 'src/forge.html', changefreq: 'monthly', priority: '0.5' },
  { loc: '/forge-gallery', source: 'src/forge-gallery.html', changefreq: 'monthly', priority: '0.6' },
  { loc: '/kreator', source: 'src/kreator/index.html', changefreq: 'monthly', priority: '0.6' },
  { loc: '/kreator/apply', source: 'src/kreator/apply.html', changefreq: 'monthly', priority: '0.5' },
  { loc: '/kortex', source: 'src/kortex.html', changefreq: 'monthly', priority: '0.5' },
  { loc: '/admin/tenant-registration', source: 'src/admin/tenant-registration.html', changefreq: 'monthly', priority: '0.4' },
];

function sourceLastmod(source) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', source], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function assertIndexable(route) {
  const sourcePath = path.join(repoRoot, route.source);
  const html = fs.readFileSync(sourcePath, 'utf8');
  if (/<meta\s+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
    throw new Error(`${route.source} is marked noindex but appears in the sitemap.`);
  }
  if (/\.html$|\/$/.test(route.loc) && route.loc !== '/') {
    throw new Error(`${route.loc} is not extensionless without a trailing slash.`);
  }
}

function xmlEscape(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

for (const route of routes) {
  assertIndexable(route);
}

const body = routes.map((route) => {
  const loc = route.loc === '/' ? 'https://kaayko.com/' : `https://kaayko.com${route.loc}`;
  const lastmod = sourceLastmod(route.source) || currentDate();

  return [
    '  <url>',
    `    <loc>${xmlEscape(loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${route.changefreq}</changefreq>`,
    `    <priority>${route.priority}</priority>`,
    '  </url>',
  ].join('\n');
}).join('\n\n');

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  body,
  '</urlset>',
  '',
].join('\n');

fs.writeFileSync(outputPath, xml);
console.log(`Generated ${path.relative(repoRoot, outputPath)} with ${routes.length} URLs.`);
