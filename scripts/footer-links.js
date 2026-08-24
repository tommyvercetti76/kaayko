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
    ['mailto:rohan@kaayko.com', 'Contact'],
  ],

  // Store and checkout: nothing that pulls a buyer out of the flow.
  store: [
    ['/store', 'Store'],
    ['/about', 'About'],
    ['/privacy', 'Privacy'],
  ],
};

// Which set each public page uses. Anything not listed here is a utility,
// redirect, auth or non-Kaayko-brand surface and is left alone on purpose.
const PAGES = {
  'index.html': 'site',
  'about.html': 'site',
  'privacy.html': 'site',
  '404.html': 'site',
  'reads.html': 'site',
  'testimonials.html': 'site',
  'animal.html': 'site',

  'paddlingout.html': 'paddling',
  'paddlingout/search.html': 'paddling',
  'paddlingout/methodology.html': 'paddling',
  'paddlingout/rate.html': 'paddling',
  'paddlingout/submitentry.html': 'paddling',
  'paddlingout/forecast.html': 'paddling',

  'forge.html': 'forge',
  'forge-gallery.html': 'forge',

  'kortex.html': 'kortex',
  'legal/kortex-terms.html': 'kortex',
  'tenant.html': 'kortex',

  'store.html': 'store',
  'cart.html': 'store',
  'product.html': 'store',
  'order-success.html': 'store',
};

// Pages rendered on a light background need the light variant.
// Pages that render on a light background. store/cart/product are body.store-v2
// (--v2-bg #f5f1e7). They also have a dark-mode toggle — footer.css reverts the
// light variant under html.dark-theme so the footer follows the theme.
const LIGHT = new Set([
  'reads.html', 'testimonials.html',
  'store.html', 'cart.html', 'product.html',
]);

// `self` is the page's own URL path (e.g. '/about'). A link to the page you
// are already on is not a relevant option, so it is dropped.
function render(setName, { light = false, indent = '  ', self = null } = {}) {
  const all = SETS[setName];
  if (!all) throw new Error(`unknown footer set: ${setName}`);
  const links = self ? all.filter(([href]) => href !== self) : all;
  const i = indent;
  return (
    `${i}<footer class="site-footer${light ? ' is-light' : ''}">\n` +
    `${i}  <nav aria-label="Footer">\n` +
    links
      .map(([href, label, feature]) => {
        const ext = /^(https?:|mailto:)/.test(href);
        const rel = href.startsWith('http') ? ' rel="noopener noreferrer"' : '';
        const feat = feature ? ` data-feature="${feature}"` : '';
        return `${i}    <a href="${href}"${rel}${feat}>${label}</a>`;
      })
      .join('\n') +
    `\n${i}  </nav>\n` +
    `${i}  <p>&copy; <span id="year">2026</span> Kaayko. All rights reserved.</p>\n` +
    `${i}</footer>`
  );
}

module.exports = { SETS, PAGES, LIGHT, render };
