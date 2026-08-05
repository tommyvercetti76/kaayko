#!/usr/bin/env node
//
// scripts/generate-spot-pages.js
//
// Emits one static HTML page per curated spot into src/paddlingout/<slug>.html.
//
// Design: these pages are part of Paddling Out, not a separate microsite. They
// load /css/paddlingout.css for the design tokens and shared components
// (.po-page-header, .seo-lake) and /css/spot.css for detail-page layout. No
// page-specific colours or fonts are defined here — if it looks different from
// the Paddling Out card grid, that is a bug.
//
// Content comes from scripts/spot-content.js (hand-authored prose, verifiable
// facts only) and scripts/spot-media.json (photography and subtitles cached
// from the production API at build time, so the build is deterministic and
// nothing is fetched from a third party at runtime).
//
// The output is committed plain static HTML — there is no build step at serve
// time, per CLAUDE.md. Re-run after editing either data file, then commit.
//
//   node scripts/generate-spot-pages.js
//   node scripts/generate-spot-pages.js --check   (verify only, non-zero on drift)

const fs = require('fs');
const path = require('path');
const spots = require('./spot-content');
const media = require('./spot-media.json');

const repoRoot = path.resolve(__dirname, '..');
const outDir = path.join(repoRoot, 'src', 'paddlingout');
const ORIGIN = 'https://kaayko.com';
const checkOnly = process.argv.includes('--check');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const bySlug = new Map(spots.map((s) => [s.slug, s]));

function metaDescription(spot) {
  // Target 150-160 chars. Unique per spot: water body, activity, what the score covers.
  // `descRegion` lets a spot override a long official place name that would push
  // the description past the SERP truncation point.
  const region = spot.descRegion || spot.region;
  return `${spot.name} kayak and paddle conditions. Live Paddle Score from wind, water temperature and UV, plus a 3-day hourly forecast. ${region}.`;
}

const prose = (spot) => [spot.intro, spot.scoring, spot.note];
const wordCount = (spot) => prose(spot).join(' ').split(/\s+/).filter(Boolean).length;
const heroImage = (spot) => (media[spot.id] && media[spot.id].images && media[spot.id].images[0]) || null;

function jsonLd(spot) {
  const url = `${ORIGIN}/paddlingout/${spot.slug}`;
  const img = heroImage(spot);
  const place = {
    '@type': 'Place',
    '@id': `${url}#place`,
    name: spot.name,
    description: spot.intro,
    url,
    geo: {
      '@type': 'GeoCoordinates',
      latitude: spot.lat,
      longitude: spot.lon,
      elevation: `${spot.elevationM} m`,
    },
    containedInPlace: { '@type': 'Place', name: spot.containedInPlace },
  };
  if (img) place.photo = { '@type': 'ImageObject', contentUrl: img };

  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        place,
        {
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: `${spot.name} Kayak & Paddle Conditions — Live Forecast | Kaayko`,
          description: metaDescription(spot),
          about: { '@id': `${url}#place` },
          isPartOf: { '@type': 'WebSite', name: 'Kaayko', url: `${ORIGIN}/` },
          inLanguage: 'en',
          ...(img ? { primaryImageOfPage: { '@type': 'ImageObject', contentUrl: img } } : {}),
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
            { '@type': 'ListItem', position: 2, name: 'Paddling Out', item: `${ORIGIN}/paddlingout` },
            { '@type': 'ListItem', position: 3, name: spot.h1, item: url },
          ],
        },
      ],
    },
    null,
    2
  );
}

function render(spot) {
  const url = `${ORIGIN}/paddlingout/${spot.slug}`;
  const title = `${spot.name} Kayak & Paddle Conditions — Live Forecast | Kaayko`;
  const desc = metaDescription(spot);
  const [intro, scoring, note] = prose(spot);
  const near = spot.nearby.map((s) => bySlug.get(s)).filter(Boolean);
  const feet = Math.round(spot.elevationM * 3.28084).toLocaleString('en-US');
  const m = media[spot.id] || {};
  const hero = heroImage(spot);
  const ogImage = hero || `${ORIGIN}/assets/kaayko-og.png`;
  const alt = `${spot.name}, ${spot.region}`;
  const typeLabel = spot.waterType.charAt(0).toUpperCase() + spot.waterType.slice(1);

  return `<!DOCTYPE html>
<html lang="en" class="dark-theme">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
<link rel="canonical" href="${url}">

<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(spot.h1)} — Kayak &amp; Paddle Conditions">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:alt" content="${esc(alt)}">
<meta property="og:site_name" content="Kaayko">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(spot.h1)} — Kayak &amp; Paddle Conditions">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(ogImage)}">
<meta name="twitter:image:alt" content="${esc(alt)}">

<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://api-vwcc5j4qda-uc.a.run.app">
${hero ? `<link rel="preload" as="image" href="${esc(hero)}" fetchpriority="high">\n` : ''}<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Josefin+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/paddlingout.css">
<link rel="stylesheet" href="/css/spot.css">
<meta name="theme-color" content="#080808">

<script type="application/ld+json">
${jsonLd(spot)}
</script>
</head>
<body>

<header class="po-page-header">
  <a class="po-brand" href="/paddlingout" style="text-decoration:none;color:inherit">
    <span class="po-eyebrow">kaayko</span>
    <span class="po-title">Paddling Out</span>
  </a>
  <a class="spot-link" href="/paddlingout/methodology"><span class="lbl-long">How the score works</span><span class="lbl-short">Methodology</span></a>
</header>

<main>

  <section class="spot-hero">
    ${hero
      ? `<img src="${esc(hero)}" alt="${esc(alt)}" width="1600" height="900" fetchpriority="high" decoding="async">`
      : ''}
    <div class="spot-hero-inner">
      <nav class="spot-crumb" aria-label="Breadcrumb">
        <a href="/">Home</a> &rsaquo; <a href="/paddlingout">Paddling Out</a> &rsaquo;
        <span aria-current="page">${esc(spot.h1)}</span>
      </nav>
      <h1 class="spot-title">${esc(spot.h1)}</h1>
      <div class="spot-region">${esc(spot.region)}</div>

      <a class="spot-score" id="live-score" data-spot-id="${esc(spot.id)}"
         href="/paddlingout/forecast?id=${encodeURIComponent(spot.id)}">
        <span class="dot" id="live-dot"></span>
        <span id="live-text">See live conditions</span>
      </a>
    </div>
  </section>

  <dl class="spot-facts">
    <div class="spot-fact"><dt>Type</dt><dd>${esc(typeLabel)}</dd></div>
    <div class="spot-fact"><dt>Elevation</dt><dd>${spot.elevationM.toLocaleString('en-US')} m &middot; ${feet} ft</dd></div>
    <div class="spot-fact"><dt>Coordinates</dt><dd>${spot.lat}, ${spot.lon}</dd></div>
    ${m.parking !== undefined ? `<div class="spot-fact"><dt>Parking</dt><dd>${m.parking ? 'Available' : 'Not listed'}</dd></div>` : ''}
  </dl>

  <article class="spot-body">
    <p class="spot-lede">${esc(intro)}</p>

    <h2>What drives the score here</h2>
    <p>${esc(scoring)}</p>

    <h2>What the Paddle Score measures</h2>
    <p>
      A single number from 1 (Danger) to 5 (Excellent), built from wind speed and gusts, air and water
      temperature, UV index, cloud cover, precipitation and visibility &mdash; then constrained by fixed
      safety rules the model is not allowed to override. Wind above 25&nbsp;mph costs two full points.
      Water below 5&deg;C is penalised hard regardless of how good the day looks.
    </p>
    <p><a class="spot-link" href="/paddlingout/methodology">Read the full methodology</a></p>

    <h2>What the score can&rsquo;t see</h2>
    <p>${esc(note)}</p>

    <div class="spot-safety">
      <p>
        Wear a life jacket, every time. The Paddle Score is a decision aid, not clearance to go out.
        It cannot account for your skill, your equipment, currents, traffic, or hazards at your launch site.
      </p>
    </div>
  </article>

  <section class="spot-nearby">
    <h2>Nearby and similar spots</h2>
    <div class="spot-nearby-grid">
      ${near
        .map((n) => {
          const nm = media[n.id] || {};
          return `<a class="seo-lake" href="/paddlingout/${n.slug}">
        <h2>${esc(n.name)}</h2>
        <p>${esc(nm.subtitle || n.region)}</p>
      </a>`;
        })
        .join('\n      ')}
      <a class="seo-lake" href="/paddlingout">
        <h2>All spots</h2>
        <p>Every water body Kaayko covers</p>
      </a>
    </div>
  </section>

</main>

<footer class="spot-footer">
  <span>&copy; 2026 Kaayko</span>
  <nav>
    <a href="/paddlingout">Paddling Out</a>
    <a href="/paddlingout/methodology">Methodology</a>
    <a href="/about">About</a>
    <a href="/privacy">Privacy</a>
  </nav>
</footer>

<script>
// Progressive enhancement only. Everything above is complete without this.
// On any failure the static page is untouched and the pill keeps its static label.
(function () {
  var box = document.getElementById('live-score');
  var el = document.getElementById('live-text');
  var dot = document.getElementById('live-dot');
  if (!box || !el) return;
  var id = box.getAttribute('data-spot-id');
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);

  fetch('https://api-vwcc5j4qda-uc.a.run.app/paddlingOut', ctrl ? { signal: ctrl.signal } : undefined)
    .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
    .then(function (list) {
      clearTimeout(timer);
      var spot = Array.isArray(list) ? list.filter(function (s) { return s && s.id === id; })[0] : null;
      if (!spot) throw new Error('spot not in feed');
      // paddleScore is an object: { rating, interpretation, confidence, ... }
      var ps = spot.paddleScore;
      var rating = ps && typeof ps === 'object' ? ps.rating : ps;
      var reading = ps && typeof ps === 'object' ? ps.interpretation : null;
      if (typeof rating !== 'number' || !isFinite(rating)) return;
      if (dot) dot.className = 'dot ' + (rating < 2.5 ? 's-critical' : rating < 3.5 ? 's-moderate' : 's-good');
      el.innerHTML = 'Paddle Score <b>' + rating + ' / 5</b>'
        + (reading ? ' <span class="reading">' + String(reading) + '</span>' : '');
    })
    .catch(function () { clearTimeout(timer); /* keep the static label */ });
})();
</script>

</body>
</html>
`;
}

// ── emit ───────────────────────────────────────────────────────────────────
let drift = 0;
const report = [];

for (const spot of spots) {
  const file = path.join(outDir, `${spot.slug}.html`);
  const html = render(spot);
  const wc = wordCount(spot);
  const dlen = metaDescription(spot).length;

  if (wc < 150 || wc > 320) {
    throw new Error(`${spot.slug}: prose is ${wc} words, spec requires 150-300.`);
  }
  if (!heroImage(spot)) {
    console.warn(`  warning: ${spot.slug} has no hero image in spot-media.json`);
  }

  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (existing !== html) {
    drift++;
    if (!checkOnly) fs.writeFileSync(file, html, 'utf8');
  }
  report.push({ slug: spot.slug, words: wc, descLen: dlen, img: !!heroImage(spot) });
}

// Emit the id -> slug map the card grid uses to link each lake to its static
// page. Generated from the same source of truth so it cannot drift.
const slugMapPath = path.join(repoRoot, 'src', 'js', 'spot-slugs.js');
const slugMap =
  '// GENERATED by scripts/generate-spot-pages.js — do not edit by hand.\n' +
  '// Maps production spot ids to their static page slugs.\n' +
  'window.KAAYKO_SPOT_SLUGS = ' +
  JSON.stringify(Object.fromEntries(spots.map((s) => [s.id, s.slug])), null, 2) +
  ';\n';
const slugExisting = fs.existsSync(slugMapPath) ? fs.readFileSync(slugMapPath, 'utf8') : null;
if (slugExisting !== slugMap) {
  drift++;
  if (!checkOnly) fs.writeFileSync(slugMapPath, slugMap, 'utf8');
}

if (checkOnly) {
  if (drift) {
    console.error(`${drift} generated file(s) out of date. Run: node scripts/generate-spot-pages.js`);
    process.exit(1);
  }
  console.log(`All ${spots.length} spot pages up to date.`);
} else {
  console.log(`Wrote ${drift} generated file(s) to src/.`);
}

const warnDesc = report.filter((r) => r.descLen < 140 || r.descLen > 170);
const noImg = report.filter((r) => !r.img);
console.log(`\n${report.length} pages · ${report.length - noImg.length} with hero photography`);
if (warnDesc.length) {
  console.log(`descriptions outside 140-170 chars: ${warnDesc.map((r) => r.slug + '(' + r.descLen + ')').join(', ')}`);
}
