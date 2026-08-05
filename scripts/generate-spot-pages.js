#!/usr/bin/env node
//
// scripts/generate-spot-pages.js
//
// Emits one static HTML page per curated spot into src/paddlingout/<slug>.html.
//
// The output is committed plain static HTML — there is no build step at serve
// time, per the repo rule in CLAUDE.md. Re-run this script after editing
// scripts/spot-content.js, then commit the regenerated pages.
//
// Every page is fully readable with JavaScript disabled. JS only hydrates the
// live score on top of static content, and a failed fetch leaves the page
// intact and shows a small inline notice.
//
//   node scripts/generate-spot-pages.js
//   node scripts/generate-spot-pages.js --check   (verify only, non-zero on drift)

const fs = require('fs');
const path = require('path');
const spots = require('./spot-content');

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

function prose(spot) {
  return [spot.intro, spot.scoring, spot.note];
}

function wordCount(spot) {
  return prose(spot).join(' ').split(/\s+/).filter(Boolean).length;
}

function jsonLd(spot) {
  const url = `${ORIGIN}/paddlingout/${spot.slug}`;
  return JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@graph': [
        {
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
        },
        {
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: `${spot.name} Kayak & Paddle Conditions — Live Forecast | Kaayko`,
          description: metaDescription(spot),
          about: { '@id': `${url}#place` },
          isPartOf: { '@type': 'WebSite', name: 'Kaayko', url: `${ORIGIN}/` },
          inLanguage: 'en',
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

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#080808;--fg:#ede8df;--muted:rgba(237,232,223,.62);--faint:rgba(237,232,223,.38);
--gold:#b5935a;--gold-bright:#d9bd7b;--line:rgba(181,147,90,.2);
--serif:"Cormorant Garamond",Georgia,serif;--display:"Bebas Neue",Impact,sans-serif}
body{background:var(--bg);color:var(--fg);font-family:var(--serif);-webkit-font-smoothing:antialiased;line-height:1.6}
a{color:inherit}
.label{font-family:var(--display);letter-spacing:.14em;text-transform:uppercase;font-size:.8rem;color:var(--gold);text-decoration:none}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:1.25rem clamp(1.25rem,5vw,4rem);border-bottom:1px solid var(--line)}
.wrap{max-width:52rem;margin:0 auto;padding:clamp(2rem,6vw,4rem) clamp(1.25rem,5vw,4rem)}
nav.crumb{font-size:.92rem;color:var(--faint);margin-bottom:1.5rem}
nav.crumb a{color:var(--muted);text-decoration:none;border-bottom:1px solid transparent}
nav.crumb a:hover{color:var(--gold-bright);border-color:var(--gold)}
h1{font-weight:500;font-size:clamp(2rem,6vw,3.2rem);letter-spacing:-.015em;line-height:1.1}
.sub{font-family:var(--display);letter-spacing:.12em;text-transform:uppercase;font-size:.82rem;color:var(--gold);margin-top:.6rem}
.facts{display:flex;flex-wrap:wrap;gap:.5rem 2rem;margin:1.75rem 0;padding:1rem 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:.95rem;color:var(--muted)}
.facts b{color:var(--fg);font-weight:600}
.live{margin:1.75rem 0;padding:1rem 1.25rem;border:1px solid var(--line);border-radius:4px;font-size:1rem;color:var(--muted)}
.live b{color:var(--gold-bright)}
.note-inline{color:var(--faint);font-size:.9rem}
h2{font-weight:500;font-size:clamp(1.3rem,3.4vw,1.8rem);margin:2.5rem 0 .75rem;letter-spacing:-.01em}
p{font-size:clamp(1.04rem,2.2vw,1.18rem);color:var(--muted);margin-bottom:1rem}
p strong{color:var(--fg);font-weight:600}
ul.spots{list-style:none;display:flex;flex-wrap:wrap;gap:.6rem 1.5rem;margin-top:.5rem}
ul.spots a{color:var(--fg);text-decoration:none;border-bottom:1px solid var(--line);padding-bottom:2px}
ul.spots a:hover{color:var(--gold-bright);border-color:var(--gold)}
.cta{display:inline-block;margin-top:1rem;font-family:var(--display);letter-spacing:.12em;text-transform:uppercase;font-size:.82rem;color:var(--gold);text-decoration:none;border-bottom:1px solid var(--gold);padding-bottom:3px}
.cta:hover{color:var(--gold-bright)}
footer{border-top:1px solid var(--line);padding:1.5rem clamp(1.25rem,5vw,4rem);color:var(--faint);font-size:.9rem;display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;justify-content:space-between}
footer a{color:var(--muted);text-decoration:none}
footer a:hover{color:var(--gold-bright)}
`.trim();

function render(spot) {
  const url = `${ORIGIN}/paddlingout/${spot.slug}`;
  const title = `${spot.name} Kayak & Paddle Conditions — Live Forecast | Kaayko`;
  const desc = metaDescription(spot);
  const [intro, scoring, note] = prose(spot);
  const near = spot.nearby.map((s) => bySlug.get(s)).filter(Boolean);
  const feet = Math.round(spot.elevationM * 3.28084).toLocaleString('en-US');

  return `<!DOCTYPE html>
<html lang="en">
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
<meta property="og:image" content="${ORIGIN}/assets/kaayko-og.png">
<meta property="og:site_name" content="Kaayko">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(spot.h1)} — Kayak &amp; Paddle Conditions">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${ORIGIN}/assets/kaayko-og.png">

<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://api-vwcc5j4qda-uc.a.run.app">
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<meta name="theme-color" content="#080808">

<script type="application/ld+json">
${jsonLd(spot)}
</script>

<style>${CSS}</style>
</head>
<body>

<header class="topbar">
  <a class="label" href="/paddlingout">&larr; Paddling Out</a>
  <a class="label" href="/paddlingout/methodology">How the score works</a>
</header>

<div class="wrap">

  <nav class="crumb" aria-label="Breadcrumb">
    <a href="/">Home</a> &rsaquo; <a href="/paddlingout">Paddling Out</a> &rsaquo; <span>${esc(spot.h1)}</span>
  </nav>

  <h1>${esc(spot.h1)}</h1>
  <div class="sub">${esc(spot.region)}</div>

  <div class="facts">
    <span>Type &nbsp;<b>${esc(spot.waterType)}</b></span>
    <span>Elevation &nbsp;<b>${spot.elevationM.toLocaleString('en-US')} m</b> (${feet} ft)</span>
    <span>Coordinates &nbsp;<b>${spot.lat}, ${spot.lon}</b></span>
  </div>

  <div class="live" id="live-score" data-spot-id="${esc(spot.id)}">
    <span id="live-text">Live Paddle Score loads here.
      <a class="cta" style="margin:0" href="/paddlingout/forecast?id=${encodeURIComponent(spot.id)}">Open the live forecast &rarr;</a>
    </span>
  </div>

  <p>${esc(intro)}</p>

  <h2>What drives the score here</h2>
  <p>${esc(scoring)}</p>

  <h2>What the Paddle Score measures</h2>
  <p>
    The Paddle Score is a single number from 1 (Danger) to 5 (Excellent). It combines wind speed and gusts,
    air temperature, water temperature, UV index, cloud cover, precipitation and visibility into one value,
    then applies fixed safety rules that the model is not allowed to override — wind above 25 mph costs two
    full points, and water below 5&deg;C is penalised hard regardless of how good the day looks.
  </p>
  <p>
    <a class="cta" href="/paddlingout/methodology">Read the full methodology, including its limits</a>
  </p>

  <h2>What the score can&rsquo;t see</h2>
  <p>${esc(note)}</p>
  <p class="note-inline">
    Wear a life jacket, every time. The Paddle Score is a decision aid, not clearance to go out —
    it cannot account for your skill, your equipment, currents, traffic, or hazards at your launch site.
  </p>

  <h2>Nearby and similar spots</h2>
  <ul class="spots">
    ${near.map((n) => `<li><a href="/paddlingout/${n.slug}">${esc(n.h1)}</a></li>`).join('\n    ')}
    <li><a href="/paddlingout">All spots</a></li>
  </ul>

</div>

<footer>
  <span>&copy; 2026 Kaayko</span>
  <span>
    <a href="/paddlingout">Paddling Out</a> &nbsp;
    <a href="/paddlingout/methodology">Methodology</a> &nbsp;
    <a href="/about">About</a> &nbsp;
    <a href="/privacy">Privacy</a>
  </span>
</footer>

<script>
// Progressive enhancement only. The page above is complete without this.
// On any failure we leave the static content untouched and say so quietly.
(function () {
  var box = document.getElementById('live-score');
  var el = document.getElementById('live-text');
  if (!box || !el) return;
  var id = box.getAttribute('data-spot-id');
  var link = '<a class="cta" style="margin:0" href="/paddlingout/forecast?id=' + encodeURIComponent(id) + '">Open the live forecast &rarr;</a>';
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
      if (typeof rating === 'number' && isFinite(rating)) {
        el.innerHTML = 'Current Paddle Score: <b>' + rating + ' / 5</b>'
          + (reading ? ' &mdash; ' + String(reading) : '')
          + ' &nbsp; ' + link;
      } else {
        el.innerHTML = 'Live conditions are available for this spot. ' + link;
      }
    })
    .catch(function () {
      clearTimeout(timer);
      el.innerHTML = '<span class="note-inline">Live conditions are unavailable right now. Everything below still applies.</span> ' + link;
    });
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

  if (wc < 150) throw new Error(`${spot.slug}: prose is ${wc} words, spec requires 150-300.`);
  if (wc > 320) throw new Error(`${spot.slug}: prose is ${wc} words, spec requires 150-300.`);

  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (existing !== html) {
    drift++;
    if (!checkOnly) fs.writeFileSync(file, html, 'utf8');
  }
  report.push({ slug: spot.slug, words: wc, descLen: dlen });
}

const warnDesc = report.filter((r) => r.descLen < 140 || r.descLen > 170);

if (checkOnly) {
  if (drift) {
    console.error(`${drift} spot page(s) out of date. Run: node scripts/generate-spot-pages.js`);
    process.exit(1);
  }
  console.log(`All ${spots.length} spot pages up to date.`);
} else {
  console.log(`Wrote ${drift} of ${spots.length} spot pages to src/paddlingout/.`);
}

console.log('\nslug                                words  desc');
for (const r of report) {
  console.log(`  ${r.slug.padEnd(34)} ${String(r.words).padStart(4)}  ${String(r.descLen).padStart(4)}`);
}
if (warnDesc.length) {
  console.log(`\nNote: ${warnDesc.length} description(s) outside the 140-170 char comfort band:`);
  warnDesc.forEach((r) => console.log(`  ${r.slug} (${r.descLen})`));
}
