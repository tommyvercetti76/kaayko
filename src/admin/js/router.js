/**
 * Hash router for the Kortex admin panel.
 *
 * The panel previously swapped divs with no URL involvement, which meant the
 * browser Back button left the app, a refresh always dumped you on Dashboard,
 * and no screen could be bookmarked or shared. Every view now owns a URL.
 *
 * Hash routing (rather than the History API) is deliberate: the panel is served
 * as a static file from Firebase Hosting with no server-side rewrite for
 * /admin/kortex/*, so a real path would 404 on refresh. A hash survives.
 *
 * Contract:
 *   navigate('links')            → #/links
 *   navigate('link-detail','colo') → #/links/colo
 *   start(render)                → renders the current URL, then on every change
 *
 * @module js/router
 */

// view name → hash pattern. `:param` marks the single dynamic segment.
export const ROUTES = {
  dashboard: '/dashboard',
  campaigns: '/campaigns',
  create: '/create',
  links: '/links',
  'link-detail': '/links/:code',
  qrcodes: '/qrcodes',
  analytics: '/analytics',
  billing: '/billing',
  'tenant-onboarding': '/tenant-onboarding',
  submissions: '/submissions',
  orders: '/orders',
  ops: '/ops',
};

export const DEFAULT_VIEW = 'dashboard';

// Views that are a drill-down of another view keep that parent's nav item lit,
// so the sidebar never goes blank while you are somewhere legitimate.
export const NAV_PARENT = {
  'link-detail': 'links',
};

/** Build the hash for a view. */
export function buildHash(view, param) {
  const pattern = ROUTES[view];
  if (!pattern) return `#${ROUTES[DEFAULT_VIEW]}`;
  if (pattern.includes(':')) {
    if (!param) return `#${ROUTES[DEFAULT_VIEW]}`;
    return `#${pattern.replace(/:[^/]+/, encodeURIComponent(param))}`;
  }
  return `#${pattern}`;
}

/**
 * Resolve a hash to a view. Unknown or malformed hashes resolve to the default
 * rather than leaving the panel on a blank screen.
 * @returns {{view: string, param: string|null, matched: boolean}}
 */
export function parseHash(rawHash) {
  const hash = String(rawHash || '').replace(/^#/, '');
  const segments = hash.split('/').filter(Boolean).map(decodeURIComponent);

  if (!segments.length) return { view: DEFAULT_VIEW, param: null, matched: false };

  // Two-segment dynamic routes first (/links/colo before /links).
  if (segments.length >= 2) {
    for (const [view, pattern] of Object.entries(ROUTES)) {
      const parts = pattern.split('/').filter(Boolean);
      if (parts.length === 2 && parts[1].startsWith(':') && parts[0] === segments[0]) {
        return { view, param: segments[1], matched: true };
      }
    }
  }

  for (const [view, pattern] of Object.entries(ROUTES)) {
    const parts = pattern.split('/').filter(Boolean);
    if (parts.length === 1 && parts[0] === segments[0]) {
      return { view, param: null, matched: true };
    }
  }

  return { view: DEFAULT_VIEW, param: null, matched: false };
}

/**
 * Navigate to a view. Writing the hash is the only way views change, so history
 * stays truthful and Back/Forward work without any extra bookkeeping.
 *
 * @param {string} view
 * @param {string|null} param
 * @param {{replace?: boolean}} options `replace` swaps the current entry rather
 *   than pushing a new one — used for redirects, so Back doesn't land on a URL
 *   that immediately redirects again.
 */
export function navigate(view, param = null, options = {}) {
  const target = buildHash(view, param);
  if (window.location.hash === target) {
    // Same URL: hashchange will not fire, so dispatch directly. Re-selecting the
    // current nav item should still re-render rather than appear broken.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  if (options.replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

/** Current route. */
export function current() {
  return parseHash(window.location.hash);
}

/**
 * Begin routing. Calls `onRoute(view, param)` for the current URL and on every
 * subsequent change, including Back and Forward.
 *
 * @param {(view: string, param: string|null) => any} onRoute
 */
export function start(onRoute) {
  const dispatch = () => {
    const route = current();
    // Normalise the bar so an empty or bogus hash becomes a real URL, without
    // adding a history entry the user did not create.
    const canonical = buildHash(route.view, route.param);
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical);
    }
    onRoute(route.view, route.param);
  };

  window.addEventListener('hashchange', dispatch);
  dispatch();
}
