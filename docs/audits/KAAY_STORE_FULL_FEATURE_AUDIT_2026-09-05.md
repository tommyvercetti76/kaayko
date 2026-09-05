# Kaay Store Full Feature Audit

Date: 2026-09-05
Audited surfaces: `https://kaay.store`, public product API, checkout, order success, admin product/order fulfillment APIs, email queue, Firestore rules, and store frontend UX.

## Executive Verdict

The checkout architecture is stronger than the public storefront polish. The money path uses server-authoritative pricing, Stripe PaymentIntents, webhook-created orders, locked-down Firestore rules, admin-only fulfillment APIs, and deterministic buyer/admin email queue documents. Focused backend tests for checkout, webhook, tax, fulfillment, admin products, auth, mail, retention, refunds, and disputes all passed: 11 suites, 248 tests.

The store should not be treated as ready for live real-money purchasing until these are resolved:

1. The deployed frontend still uses a Stripe test publishable key.
2. Terms contain legal placeholders.
3. Mail delivery depends on `MAIL_SMTP_URL` and has no automatic redrive for retry-state mail docs.
4. Admin delay-notice UI reads the wrong response shape and can falsely say an email was not sent.

The purchase/receipt/fulfillment design is basically sound. The launch blockers are configuration, legal copy, mail operations, and a few trust/UX gaps.

## Live Evidence

Live pages checked:

- `https://kaay.store` -> 200, `Last-Modified: Sat, 05 Sep 2026 14:46:03 GMT`.
- `https://kaay.store/cart` -> 200, strict checkout CSP, `Cache-Control: no-store`.
- `https://kaay.store/order-success` -> 200.

Live APIs checked:

- `GET https://kaay.store/api/products` -> success, 30 public products.
- Sample products had `actualPrice: null`, tier `price` values such as `$$$`, images present, `soldOut: false`.
- `POST https://api-vwcc5j4qda-uc.a.run.app/createPaymentIntent` with `Origin: https://kaay.store` and empty body -> 400 `MISSING_ITEMS`, proving the origin is allowed and validation runs.
- Same request with `Origin: https://evil.example` -> 403 `ORIGIN_NOT_ALLOWED`, proving the checkout origin guard is active.
- `GET /admin/listOrders` without auth -> `AUTH_TOKEN_MISSING`.

Backend verification:

- Passed focused checkout/store suite:
  - `store-api.test.js`
  - `checkout-payment-intent.test.js`
  - `checkout-webhook.test.js`
  - `checkout-tax.test.js`
  - `checkout-refunds-disputes.test.js`
  - `order-fulfilment.test.js`
  - `order-delay-notice.test.js`
  - `mail-sender.test.js`
  - `order-retention.test.js`
  - `admin-products.test.js`
  - `auth-platform-admin.test.js`
- Result: 11 test suites passed, 248 tests passed.

## Store Feature Inventory And Connectivity

| Feature | Frontend entry | Backend/API | Current state | Notes |
|---|---|---|---|---|
| Invite/access gate | `src/store.html`, `src/js/storeAccess.js`, `src/js/secretStore.js` | localStorage only | Functional but not security | Public product API is still readable. Treat this as invite UX, not protection. |
| Product list | `src/store.html`, `src/js/kaayko_ui.js`, `src/js/kaayko_apiClient.js` | `GET /api/products` | Connected | Live API returned 30 products. |
| Product detail | `src/product.html`, `src/js/product.js`, `src/js/fitPicker.js` | `GET /api/products/:id` | Connected | Supports `/p/:id` and `/store/p/:id` rewrites. |
| Voting | product/list UI | `POST /api/products/:id/vote` | Connected with rate-limit caveat | Public endpoint uses in-memory IP limit; not money critical. |
| Cart | `src/js/cartManager.js`, `src/cart.html` | localStorage before checkout | Functional | Frontend caps to 2 unique items and has no quantity editor. Backend allows up to 10 line items and quantity 10. |
| PaymentIntent create | `src/cart.html:981` | `POST /createPaymentIntent` | Connected | Server discards client price and resolves product, size, gender, quantity. |
| Sales tax | `src/cart.html:1192` | `POST /createPaymentIntent/tax` | Connected | Tax is optional by config. If enabled and calculation fails, checkout fails closed. |
| Buyer contact update | `src/cart.html:1265` | `POST /createPaymentIntent/updateEmail` | Connected with UX gap | Frontend ignores non-OK responses if the fetch resolves. Stripe receipt email still helps webhook recover email. |
| Stripe payment | `src/cart.html:1282` | Stripe Payment Element + webhook | Connected in test mode | Current publishable key is `pk_test`. |
| Order success | `src/order-success.html` | Stripe retrieve PaymentIntent | Connected | Clears cart after Stripe confirms status. Does not read backend order/fulfillment state. |
| Order creation | no direct frontend | `functions/api/checkout/stripeWebhook.js` | Connected | Webhook writes `payment_intents` and one `orders` doc per line item. |
| Buyer/admin receipts | no direct frontend | webhook -> `mail/{pi}_customer`, `mail/{pi}_admin` -> `mailSender` | Connected in tests | Live SMTP secret not verifiable from source. Retry redrive not automated in current code. |
| Fulfillment admin | `src/admin/views/orders/orders.js` | `GET /admin/listOrders`, `POST /admin/updateOrderStatus` | Connected | Admin can pack, mark shipped, add tracking, copy address. |
| Delay notice | `src/admin/views/orders/orders.js` | `POST /admin/orderDelayNotice` | Backend connected, frontend bug | UI checks `res.customerNotification`, backend returns `{ queued, mailId, ... }`. |
| Product admin | `src/admin/views/products/products.js` | `GET/POST /admin/products` | Connected | Platform-admin protected; updates `actualPrice`, availability, sold-out status, sizes. |
| Refunds/disputes | Stripe dashboard + webhook | `charge.refunded`, dispute handlers | Connected in tests | Webhook updates order/payment status and alerts owner. |
| Privacy/legal/shipping/returns | `src/legal/*.html`, `src/store-privacy.html` | none | Present with blockers | Terms still have placeholders. |

## Purchase, Receipt, Fulfillment Flow

This is the intended critical path:

1. Buyer enters store through `kaay.store`.
2. Buyer adds an item to the bag from the product card/detail page. Cart stores product id, size, gender, quantity, title, image, and display price locally.
3. Cart posts only purchasable facts to the backend: productId, size, gender, and quantity. Client-side price is not trusted.
4. `createPaymentIntent` uses `resolveCart` to read Firestore products and compute authoritative line totals.
5. If tax is enabled, cart posts the shipping address to `/createPaymentIntent/tax`. The backend applies tax to the Stripe PaymentIntent and fails closed if Stripe Tax errors.
6. Cart posts email/phone/name to `/createPaymentIntent/updateEmail`.
7. Stripe confirms the PaymentIntent and returns to `/order-success`.
8. Stripe webhook receives `payment_intent.succeeded`, verifies signature, loads the server-priced cart, resolves shipping address, updates `payment_intents/{pi}`, writes `orders/{pi}_itemN`, and queues buyer/admin emails.
9. `mailSender` sends queued mail from Firestore `mail/{id}` docs.
10. Admin opens Kortex Orders, sees one shipment per PaymentIntent, packs the order, and marks it shipped with optional tracking.
11. `updateOrderStatus` updates all line items under the parent PaymentIntent and queues a shipping confirmation email exactly once.
12. Refund/dispute webhooks update payment and fulfillment state and queue owner alerts so nothing ships after money moves back.

## Critical Findings

### P0 - Storefront Is In Stripe Test Mode

`src/js/prod-config.js:24` sets:

`window.KAAYKO_STRIPE_PK = "pk_test_..."`

Impact: The deployed buyer checkout is test-mode from the browser side. A real live purchase cannot be completed until publishable key, backend `STRIPE_SECRET_KEY`, webhook endpoint secret, Stripe Tax mode, and dashboard webhook destination are all moved together.

Recommendation:

- Keep test mode for sandbox purchases.
- Before launch, switch all Stripe config together and run one live $1 or low-price smoke purchase only when legal/mail/shipping are ready.
- Never mix live frontend key with test backend secret or test webhook secret.

### P0 - Terms Still Contain Legal Placeholders

`src/legal/terms.html:37` contains:

- `[legal business name]`
- `[business mailing address]`

The terms also reference jurisdiction copy that still needs a real state/legal review.

Impact: This is a real-money blocker. Checkout asks buyers to agree to Terms; those Terms cannot contain placeholders.

Recommendation: Fill legal operator, mailing address, governing law/jurisdiction, notice address, and support address before enabling live Stripe mode.

### P1 - Mail Delivery Is Designed, Tested, But Operationally Fragile

`functions/triggers/mailSender.js:14-50` requires `MAIL_SMTP_URL`. If the secret is missing, mail docs enter `ERROR`. If SMTP has a transient issue, docs can enter retry state, but there is no scheduled redrive wired in this source tree.

Impact: Payment can succeed and orders can exist, but buyer receipt/admin receipt/shipping email can fail silently unless Kortex or owner watches mail docs/errors.

Recommendation:

- Verify `MAIL_SMTP_URL` exists in deployed functions before launch.
- Add a scheduled retry/redrive for `delivery.state == RETRY`.
- Add an admin alert or dashboard badge for `mail` docs in `ERROR` or stale `RETRY`.

### P1 - Admin Delay Notice UI Reads Wrong Response Shape

Frontend:

- `src/admin/views/orders/orders.js:325-328` expects `res.customerNotification.queued`.

Backend:

- `functions/api/admin/orderNotices.js` returns `{ success, parentOrderId, newEstimatedDate, queued, mailId, ... }`.

Impact: Admin can send a delay notice successfully, but the UI can falsely report that the email was not sent. That undermines fulfillment confidence.

Recommendation: change the UI to read `res.queued`, or change the backend to also return `customerNotification`.

### P1 - Store Access Copy Is Hostile For Legit Buyers

`src/js/storeAccess.js:23-35` and `src/js/secretStore.js:429` include intentionally sarcastic/hostile failure copy.

Impact: From the lens of a person who may use both Paddling Out and the store, this breaks trust. The paddling product feels useful and safety-aware; the store gate can make the brand feel dismissive at the exact moment a buyer is trying to pay.

Recommendation: replace failed invite messages with neutral, stylish, short copy such as "That code did not open the store. Check the spelling or request access."

### P1 - Contact Emails Are Inconsistent

Observed addresses:

- Store invite request: `rohan@kaayko.com`
- Terms notice/contact: `rohanramekar17@gmail.com`
- Email policy/support: `orders@kaayko.com`
- Order admin notifications default: `rohanramekar17@gmail.com`

Impact: Buyers, legal notices, and order operations point to different inboxes.

Recommendation: choose one support address for buyer-facing pages and one owner/admin notification address in config. Use `orders@kaayko.com` for buyers if that mailbox is real.

## Security And No-Leak Review

Good:

- Checkout origin guard allows `https://kaay.store` and blocks unknown origins.
- Firestore rules block direct client reads/writes for `orders`, `payment_intents`, `stripe_events`, `webhook_failures`, and `mail` (`kaayko-api/firestore.rules:56-82`).
- Admin store routes are protected by Firebase auth plus platform-admin checks.
- Checkout pages have `Cache-Control: no-store`, strict checkout CSP, and `frame-ancestors 'none'`.
- Server-authoritative pricing in `functions/api/checkout/pricing.js` discards client prices and validates product availability, size, gender, quantity, line count, and total.
- Webhook verifies Stripe signature and is the only writer of the `orders` collection.
- Admin order UI escapes customer/order data and does not log shipping addresses; copy-to-clipboard is direct.
- Shipping confirmation is deterministic/idempotent, so "Mark shipped" should not spam the buyer.

Risks:

- Invite gate is not security. Access codes are client-side and the product API is public.
- Product votes and some public analytics/rating APIs use spoofable first `x-forwarded-for`.
- Mail queue contains buyer PII until retention removes it; retention is exported, but deployment status should be verified.
- Live secret values cannot be proven from source. Stripe and SMTP deployment config must be checked in Firebase/Stripe before live launch.

## Product, Pricing, And Checkout Notes

- Public product API returned 30 products and none were unavailable/sold out in the live sample.
- Live products use tier `price` values with `actualPrice: null`. Backend maps tier symbols to cents as fallback (`functions/api/checkout/pricing.js:74-110`).
- Admin products API supports setting `actualPrice` and derives `price` from it (`functions/api/admin/products.js:244-245`).
- Recommendation: set `actualPrice` for every sellable SKU before live launch so the price source is explicit, not a tier fallback.
- Cart says a bag holds two pieces (`src/cart.html:854`), while backend supports more lines and quantities. That is okay for a limited drop, but it should be an intentional product rule.

## Real Purchase Readiness Checklist

Do not use live Stripe until every item below passes:

1. Terms placeholders replaced.
2. Buyer support email, admin notification email, returns email, and invite request email normalized.
3. Stripe frontend publishable key, backend secret key, webhook secret, webhook destination, and tax mode all confirmed to be the same environment.
4. `MAIL_SMTP_URL` configured in Firebase Secret Manager.
5. Mail retry/redrive or alerting exists for stale `RETRY`/`ERROR` mail docs.
6. One test-mode purchase runs end-to-end:
   - Add item.
   - Enter shipping address.
   - Tax calculates if enabled.
   - Pay with Stripe test card.
   - `/order-success` shows success and clears cart.
   - Webhook writes `payment_intents/{pi}` and `orders/{pi}_itemN`.
   - Buyer receipt mail doc exists and reaches `SUCCESS`.
   - Admin receipt mail doc exists and reaches `SUCCESS`.
   - Kortex Orders shows the shipment with address.
   - Mark shipped with tracking.
   - Shipping email doc exists and reaches `SUCCESS`.
7. One failed-payment test leaves no shippable order.
8. One refund test marks unshipped order cancelled/refunded and sends owner alert.
9. One dispute test marks order disputed and prevents shipment until resolved.

## Agent Task Queue

P0:

- Replace Stripe test key only when the full live Stripe/backend/webhook setup is ready.
- Fill Terms legal placeholders and final support/notice details.

P1:

- Verify SMTP secret and add retry/redrive or alerting for mail failures.
- Fix delay notice response mismatch.
- Replace hostile invite-code copy.
- Normalize buyer/admin/support email addresses.
- Decide whether `kaay.store` should be `noindex` and canonicalized to `kaayko.com/store`, or be its own canonical storefront.

P2:

- Handle non-OK `/createPaymentIntent/updateEmail` responses in cart.
- Add quantity editing or make the 2-piece limit clearer across product/cart copy.
- Ensure all live sellable SKUs have `actualPrice`.
- Add admin pagination/search so older unshipped orders cannot hide behind the first page.


---

# Resolution Notes — 5 September 2026

Implemented and deployed. Tests: 13 suites, 288 passed (checkout, webhook, tax,
refunds/disputes, fulfilment, delay-notice, mail-sender, retention, admin
products, platform auth, store API, paddling).

**No live purchase was attempted. Stripe remains in test mode throughout.**

## Completed

**P1 — Delay notice UI read the wrong response shape.** The frontend checked
`res.customerNotification.queued`; the backend returns `queued` at the top level.
It was always `undefined`, so a successfully queued notice reported "email was
not sent". Now reads `res.queued`, and distinguishes the legitimate
`already_sent_for_date` no-op from a real failure.
*Files:* `src/admin/views/orders/orders.js`

**P1 — Hostile invite copy removed.** `storeAccess.js` cycled through eleven
insults ("Wrong, dumbass", "Are you actually stupid or just pretending") and
`secretStore.js` carried two more arrays of the same. All replaced with three
neutral hints: "That code did not open the store. Check the spelling." /
"Still no match. Codes are case-sensitive." / "That code is not recognised.
Request access below and we will send you one." Verified live.
*Files:* `src/js/storeAccess.js`, `src/js/secretStore.js`

**P1 — Mail operations are now observable.** New `GET /admin/mailHealth`
(platform-admin only) reports counts and document ids for mail in `ERROR`, stale
`RETRY` (>1h) and stalled `PROCESSING`. The Orders view shows a banner when any
exist: *"Email needs attention: N failed... Nothing retries these
automatically."* Deliberately returns **counts and ids only** — mail documents
hold the buyer's name, address and order contents, and none of that crosses the
wire. Verified live: unauthenticated `GET /admin/mailHealth` → 401.
*Files:* `functions/api/admin/mailHealth.js` (new), `functions/index.js`,
`src/admin/views/orders/orders.js`, `src/admin/views/orders/orders.css`

**P2 — Checkout contact update no longer fails silently.** `/createPaymentIntent/
updateEmail` only caught a thrown fetch; a 4xx/5xx resolved normally and the card
was charged anyway, producing an order with no contact details to ship to. A
non-OK response now blocks payment with a recoverable message and restores the
button. Stripe's `receipt_email` is a receipt fallback, not a substitute for
fulfilment details.
*Files:* `src/cart.html`

**P1 — Support address centralised.** Six buyer-facing pages hardcoded a personal
Gmail. All now resolve through one constant in `js/support-contact.js`, with the
inline `mailto:` kept as a no-JS fallback. The buyer address and the owner
notification address stay explicitly separate — the latter is server-side in
`api/email/notifyAddress.js` via `ORDER_NOTIFY_EMAIL`.
*Files:* `src/js/support-contact.js` (new), `src/legal/terms.html`,
`src/legal/returns.html`, `src/legal/shipping.html`, `src/store-privacy.html`

**P2 — Bag limit stated before the shopper hits it.** The two-piece cap was stated
in the cart and on About but not on the product page, where a shopper first meets
it. Added to the PDP reassurance line.
*Files:* `src/js/product.js`

**P0 (documented, not changed) — Stripe live-mode preconditions.** A block comment
now sits directly above the publishable key listing the five changes that must
happen together (publishable key, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
dashboard webhook destination + event subscriptions, Stripe Tax mode) and warning
that a live key with a test secret fails at confirm time with a client-secret
mismatch that reads like a code bug.
*Files:* `src/js/prod-config.js`

## Deliberately NOT changed

**Stripe stays in test mode.** No live keys, secrets or webhook config were
provided, so `pk_test` is untouched. Real purchases remain blocked by design.

**Terms placeholders left in place.** `src/legal/terms.html` still contains
`[legal business name]`, `[business mailing address]` and `[state]`. These were
not invented. **This remains a live-purchase blocker.**

**Support address value unchanged.** The backend treats `orders@kaayko.com` as the
support address (`api/email/policy.js:36`), but I cannot verify that mailbox is
real and monitored. Pointing the returns page at an address that bounces is worse
than one that works, so the value still resolves to the current address —
now from a single place. **Owner: confirm the mailbox, then change one line in
`src/js/support-contact.js`.**

**`kaay.store` SEO left as-is.** The live site already sends
`<meta name="robots" content="noindex, follow">` with
`<link rel="canonical" href="https://kaayko.com/store">`. That is internally
consistent with an invite-only store and matches the audit's own guidance. No
change made. **Owner decision** if the store should become a public canonical
storefront.

## Remaining owner-required inputs

1. **Legal**: business name, mailing address, governing state, notice address.
2. **Stripe live config**: all five items together (see `prod-config.js`).
3. **`MAIL_SMTP_URL`** must exist in Secret Manager or every receipt lands in
   `ERROR`. The new banner makes that visible; it does not fix it.
4. **Support mailbox**: confirm `orders@kaayko.com`, then flip the constant.
5. **`actualPrice` on live SKUs**: the live sample still shows `actualPrice: null`
   with tier fallback pricing. The admin Products view can set these; until then
   price comes from the tier map, not an explicit number. Launch-readiness work.

## Remaining P2 / non-blocking

- No quantity editing; the two-piece cap is now stated in three places instead.
- No admin pagination/search on Orders, so older unshipped orders can hide behind
  the first page of 100.
- Mail `RETRY` documents still have no automatic redrive — only the new alert.
