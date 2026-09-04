# Checkout page script inventory

PCI DSS v4.0 asks the merchant to know, authorise and justify every script that
runs on the page where card data is collected, and to be able to say the page
is not susceptible to script attacks. This is that list for `/cart` and
`/order-success`. The enforcing control is the page-specific
`Content-Security-Policy` in `firebase.json` (sources `/cart`, `/cart.html`,
`/order-success`, `/order-success.html`). Anything not listed here is blocked
by that header.

| Script / origin | Why it is on the page | Integrity control |
|---|---|---|
| `https://js.stripe.com/v3/` | Stripe.js — renders the Payment and Address Elements in Stripe-served iframes. Card data never enters our document. | Stripe versions this URL in place and instructs against SRI; integrity rests on the `script-src`/`frame-src` allow-list and Stripe's PCI DSS Level 1 attestation. |
| `https://maps.googleapis.com` | Loaded *by Stripe.js* for Address Element autocomplete. Not loaded by our code. | Listed in Stripe's published CSP guidance; allowed only on `script-src` and `connect-src`. |
| Inline `<script type="module">` in `cart.html` | First-party checkout logic: bag rendering, calling our API for a server-priced PaymentIntent, mounting Stripe Elements, confirming. | Source-controlled; reviewed in git history. Requires `'unsafe-inline'` because Hosting is static and cannot issue nonces — this is the single accepted exception. |
| `/js/prod-config.js`, `/js/cartManager.js`, `/js/header.js` | First-party: publishable key, bag storage, header. | `'self'` only. |
| `https://fonts.googleapis.com` (CSS) / `https://fonts.gstatic.com` (fonts) | Typography. Not script. | `style-src` / `font-src` only. |

Explicitly **not** authorised on these pages: `'unsafe-eval'`, `cdn.jsdelivr.net`,
`*.posthog.com`, `www.gstatic.com`, `apis.google.com`, and any `https://*.run.app`
other than our own API host. Removing them is what makes the attestation honest.

## Change detection
Firebase Hosting serves immutable, versioned releases; a change to `/cart` is a
git commit and a deploy. Review: `git log -- src/cart.html firebase.json`.
Console CSP violation reports show up in the browser during the weekly manual
checkout test; a `report-to` endpoint is the next step if volume warrants.

_Last reviewed: 4 September 2026._
