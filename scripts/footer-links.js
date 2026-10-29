// scripts/footer-links.js
//
// The definitive footer link sets. One footer component (src/css/footer.css),
// four contextual link sets so each page only offers what is relevant to it.
//
// Rules:
//   - Every set ends with Privacy. It is the one link that is always relevant.
//   - A set never links to the page you are already in the section of, except
//     the section index itself (a spot page links back to Paddling Out).
//   - No cross-selling. A paddler checking wind does not need the store; a
//     shopper does not need the scoring methodology.
//   - Only real, existing pages. Never link something that 404s.
//
// Used by scripts/generate-spot-pages.js and scripts/apply-footer.js, and
// enforced by scripts/verify-seo.js.

// A link may carry a third element: the name of a feature flag from
// src/js/site-features.js. The link is emitted with data-feature="<name>",
// so pages that load site-features.js hide it while that flag is off.
// The store set below stays untagged on purpose — checkout pages are already
// inside the store flow, and a buyer mid-flow always keeps a way back.
const SETS = {
  // The brand's own pages — the home card (whose colophon this mirrors), About
  // and Privacy. Exactly the home footer: YouTube · About · Privacy, small caps,
  // a hairline above, no copyright line. The page you are on stays in the row,
  // marked aria-current, so the three read as ONE footer (24 Oct 2026, Rohan:
  // "consistent with that on home page"). Home's own copy is index.html .colophon.
  brand: [
    ['https://www.youtube.com/@travelingout', 'YouTube'],
    ['/about', 'About'],
    ['/privacy', 'Privacy'],
  ],

  // Root and general-interest pages: show the products.
  site: [
    ['/paddlingout', 'Paddling Out'],
    ['/forge', 'Forge'],
    ['/store', 'Store', 'store'],
    ['/about', 'About'],
    ['/privacy', 'Privacy'],
  ],

  // Anything under Paddling Out: stay in the paddling context.
  paddling: [
    ['/paddlingout', 'Paddling Out'],
    ['/paddlingout/scouts', 'Scouts'],
    ['/paddlingout/methodology', 'Methodology'],
    ['/about', 'About'],
    ['/privacy', 'Privacy'],
  ],

  // Forge pages: the product, the renders, the source.
  forge: [
    ['/forge', 'Forge'],
    ['/forge-gallery', 'Gallery'],
    ['https://github.com/tommyvercetti76/Forge', 'Source'],
    ['/about', 'About'],
    ['/privacy', 'Privacy'],
  ],

  // Kortex is its own product surface. Keep it to Kortex + its legal pages;
  // a link manager user has no use for paddle forecasts.
  kortex: [
    ['/kortex', 'Kortex'],
    ['/legal/kortex-terms', 'Terms'],
    ['/privacy', 'Privacy'],
    ['mailto:kortex@kaayko.com', 'Contact'],   // what the live Kortex pages say
  ],

  // Store and checkout: nothing that pulls a buyer out of the flow.
  // /store/about and /store/privacy resolve on BOTH hosts (kaay.store rewrites
  // them too); /about and /privacy would be the Kaayko marketing pages on kaayko.com.
  store: [
    ['/store', 'Store'],
    ['/store/about', 'About'],
    ['/store/privacy', 'Privacy'],
    ['/legal/terms', 'Terms'],
    ['/legal/returns', 'Returns'],
    ['/legal/shipping', 'Shipping'],
  ],
};

// Which set each public page uses. Anything not listed here is a utility,
// redirect, auth or non-Kaayko-brand surface and is left alone on purpose.
const PAGES = {
  // index.html is one fixed screen with its own pinned nav; a shared footer
  // under it was 131px of scroll that revealed nothing, since the splash
  // covers it. Not generated there.
  'about.html': 'brand',
  'privacy.html': 'brand',
  '404.html': 'site',
  'stories.html': 'site',
  'stories/never-give-up.html': 'site',
  'testimonials.html': 'site',

  'paddlingout.html': 'paddling',
  'paddlingout/search.html': 'paddling',
  'paddlingout/methodology.html': 'paddling',
  'paddlingout/scouts.html': 'paddling',
  'paddlingout/scouts/rules.html': 'paddling',
  'paddlingout/rate.html': 'paddling',
  'paddlingout/forecast.html': 'paddling',

  // Not here on purpose: paddlingout/submitentry.html (a noindex redirect stub
  // into search?mode=add, no body to put a footer under) and kortex.html (Kortex
  // has its own designed .foot — brand, Terms, Privacy, Support, Report — shared
  // with kaay.link's copy). Both were listed until 24 Oct 2026 and failed every run.
  'forge.html': 'forge',
  'forge-gallery.html': 'forge',

  'legal/kortex-terms.html': 'kortex',
  'tenant.html': 'kortex',

  'store.html': 'store',
  'cart.html': 'store',
  'product.html': 'store',
  'animal.html': 'store',
  'order-success.html': 'store',
  'order-status.html': 'store',
  'store-about.html': 'store',
  'store-privacy.html': 'store',
  'legal/terms.html': 'store',
  'legal/returns.html': 'store',
  'legal/shipping.html': 'store',
};

// Pages rendered on a light background need the light variant.
// Pages that render on a light background. store/cart/product are body.store-v2
// (--v2-bg #f5f1e7). They also have a dark-mode toggle — footer.css reverts the
// light variant under html.dark-theme so the footer follows the theme.
const LIGHT = new Set([
  'stories.html', 'stories/never-give-up.html', 'testimonials.html',
  'store.html', 'cart.html', 'product.html', 'animal.html',
  'order-status.html', 'store-about.html', 'store-privacy.html',
  'legal/terms.html', 'legal/returns.html', 'legal/shipping.html',
]);

// `self` is the page's own URL path (e.g. '/about'). A link to the page you
// are already on is not a relevant option, so it is dropped.
// Sets drawn as the home colophon (.site-footer.is-colophon): every link kept,
// the current page marked rather than dropped, and no copyright line.
const COLOPHON = new Set(['brand']);

function render(setName, { light = false, indent = '  ', self = null } = {}) {
  const all = SETS[setName];
  if (!all) throw new Error(`unknown footer set: ${setName}`);
  const colophon = COLOPHON.has(setName);
  const links = self && !colophon ? all.filter(([href]) => href !== self) : all;
  const i = indent;
  const cls = `site-footer${light ? ' is-light' : ''}${colophon ? ' is-colophon' : ''}`;
  return (
    `${i}<footer class="${cls}">\n` +
    `${i}  <nav aria-label="Footer">\n` +
    links
      .map(([href, label, feature]) => {
        const rel = href.startsWith('http') ? ' rel="noopener noreferrer"' : '';
        const feat = feature ? ` data-feature="${feature}"` : '';
        const cur = colophon && href === self ? ' aria-current="page"' : '';
        return `${i}    <a href="${href}"${rel}${feat}${cur}>${label}</a>`;
      })
      .join('\n') +
    `\n${i}  </nav>\n` +
    (colophon ? '' : `${i}  <p>&copy; <span id="year">2026</span> Kaayko. All rights reserved.</p>\n`) +
    `${i}</footer>`
  );
}

module.exports = { SETS, PAGES, LIGHT, COLOPHON, render };
