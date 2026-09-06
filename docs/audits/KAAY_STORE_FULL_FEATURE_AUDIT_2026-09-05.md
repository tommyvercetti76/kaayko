# Kaay Store Full Feature Audit

Date: 2026-09-05
Audited surfaces: `https://kaay.store`, public product API, checkout, order success, admin product/order fulfillment APIs, email queue, Firestore rules, and store frontend UX.

## Executive Verdict

The checkout architecture is stronger than the public storefront polish. The money path uses server-authoritative pricing, Stripe PaymentIntents, webhook-created orders, locked-down Firestore rules, admin-only fulfillment APIs, and deterministic buyer/admin email queue documents. Focused backend tests for checkout, webhook, tax, fulfillment, admin products, auth, mail, retention, refunds, and disputes all passed: 11 suites, 248 tests.

Current working-tree status: the main UX/operations issues found during this
audit were addressed after the initial pass. Invite-gate failure copy is neutral,
cart contact-update failure now blocks payment, admin delay notice reads the
backend response correctly, and Kortex Orders now exposes mail queue health.

The store should not be treated as ready for live real-money purchasing until
these remaining launch blockers are resolved:

1. The deployed frontend still uses a Stripe test publishable key.
2. Terms contain legal placeholders.
3. Buyer support email is centralized but still needs owner confirmation before changing to `orders@kaayko.com`.
4. Mail delivery depends on `MAIL_SMTP_URL`; admin health visibility now exists, but there is still no automatic redrive for retry-state mail docs.
5. A real Stripe test-mode purchase/receipt/admin receipt/fulfillment smoke has not been run in this branch.

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
| Invite/access gate | `src/store.html`, `src/js/storeAccess.js`, `src/js/secretStore.js` | localStorage only | Functional; tone fixed; not security | Public product API is still readable. Treat this as invite UX, not protection. |
| Product list | `src/store.html`, `src/js/kaayko_ui.js`, `src/js/kaayko_apiClient.js` | `GET /api/products` | Connected | Live API returned 30 products. |
| Product detail | `src/product.html`, `src/js/product.js`, `src/js/fitPicker.js` | `GET /api/products/:id` | Connected | Supports `/p/:id` and `/store/p/:id` rewrites. |
| Voting | product/list UI | `POST /api/products/:id/vote` | Connected with rate-limit caveat | Public endpoint uses in-memory IP limit; not money critical. |
| Cart | `src/js/cartManager.js`, `src/cart.html` | localStorage before checkout | Functional | Frontend caps to 2 unique items and has no quantity editor. Backend allows up to 10 line items and quantity 10. |
| PaymentIntent create | `src/cart.html:981` | `POST /createPaymentIntent` | Connected | Server discards client price and resolves product, size, gender, quantity. |
| Sales tax | `src/cart.html:1192` | `POST /createPaymentIntent/tax` | Connected | Tax is optional by config. If enabled and calculation fails, checkout fails closed. |
| Buyer contact update | `src/cart.html:1265` | `POST /createPaymentIntent/updateEmail` | Connected in working tree | Non-OK responses now block payment before Stripe confirmation. |
| Stripe payment | `src/cart.html:1282` | Stripe Payment Element + webhook | Connected in test mode | Current publishable key is `pk_test`. |
| Order success | `src/order-success.html` | Stripe retrieve PaymentIntent | Connected | Clears cart after Stripe confirms status. Does not read backend order/fulfillment state. |
| Order creation | no direct frontend | `functions/api/checkout/stripeWebhook.js` | Connected | Webhook writes `payment_intents` and one `orders` doc per line item. |
| Buyer/admin receipts | no direct frontend | webhook -> `mail/{pi}_customer`, `mail/{pi}_admin` -> `mailSender` | Connected in tests | Live SMTP secret not verifiable from source. Retry redrive not automated in current code. |
| Fulfillment admin | `src/admin/views/orders/orders.js` | `GET /admin/listOrders`, `POST /admin/updateOrderStatus` | Connected | Admin can pack, mark shipped, add tracking, copy address. |
| Delay notice | `src/admin/views/orders/orders.js` | `POST /admin/orderDelayNotice` | Connected in working tree | UI reads top-level `{ queued, mailId, ... }` and handles already-sent as informational. |
| Mail health | `src/admin/views/orders/orders.js` | `GET /admin/mailHealth` | Connected in working tree | Admin sees counts/ids for `ERROR`, stale `RETRY`, and stuck `PROCESSING` mail docs without exposing PII. |
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

### P1 - Mail Delivery Is Designed, Tested, But Still Needs Redrive

`functions/triggers/mailSender.js:14-50` requires `MAIL_SMTP_URL`. If the secret is missing, mail docs enter `ERROR`. If SMTP has a transient issue, docs can enter retry state, but there is no scheduled redrive wired in this source tree.

Working-tree update: Kortex Orders now calls `/admin/mailHealth`, which reports
counts and ids for mail docs in `ERROR`, stale `RETRY`, or stuck `PROCESSING`.
That closes the silent-admin-visibility gap, but it does not resend stuck mail.

Impact: Payment can succeed and orders can exist, but buyer receipt/admin
receipt/shipping email can still require human intervention if SMTP was missing
or transiently down.

Recommendation:

- Verify `MAIL_SMTP_URL` exists in deployed functions before launch.
- Add a scheduled retry/redrive for `delivery.state == RETRY`.
- Keep the admin health banner and add either scheduled redrive or explicit resend controls for `mail` docs in `ERROR` or stale `RETRY`.

### P1 - Admin Delay Notice UI Response Shape Was Fixed In Working Tree

Frontend:

- `src/admin/views/orders/orders.js` now reads top-level `res.queued`.

Backend:

- `functions/api/admin/orderNotices.js` returns `{ success, parentOrderId, newEstimatedDate, queued, mailId, ... }`.

Impact before fix: Admin could send a delay notice successfully, but the UI
could falsely report that the email was not sent. That undermined fulfillment
confidence.

Current state: fixed in the working tree. Keep regression coverage around
`order-delay-notice.test.js` and the admin UI.

### P1 - Store Access Copy Was Replaced In Working Tree

`src/js/storeAccess.js` and `src/js/secretStore.js` now use neutral failed-code
messages and a request-access path.

Impact before fix: From the lens of a person who may use both Paddling Out and
the store, hostile gate copy broke trust at the exact moment a buyer was trying
to shop.

Current state: fixed in the working tree. Do not reintroduce insult/sarcasm in
buyer-facing failure states.

### P1 - Support Address Mechanism Is Centralized, But The Address Is Owner-Required

Observed addresses:

- Store invite request: `rohan@kaayko.com`
- Terms notice/contact: `rohanramekar17@gmail.com`
- Email policy/support: `orders@kaayko.com`
- Order admin notifications default: `rohanramekar17@gmail.com`

Working-tree update: frontend buyer-facing support links now load from
`src/js/support-contact.js`, so Terms, Shipping, Returns, and Privacy can be
switched in one place. That file deliberately still points to
`rohanramekar17@gmail.com` until the owner confirms `orders@kaayko.com` is real
and monitored. Owner/admin order notifications remain separate server-side
config through `ORDER_NOTIFY_EMAIL`.

Impact: The mechanism is fixed; the final buyer support address is still a live
operations decision.

Recommendation: once `orders@kaayko.com` is confirmed, change only
`SUPPORT_EMAIL` in `src/js/support-contact.js` and keep owner/admin notification
delivery separate.

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
- Product votes still use a spoofable first `x-forwarded-for` value; this is not money-critical but should be hardened before relying on votes as signal.
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
2. Buyer support email, admin notification email, returns email, and invite request email confirmed as monitored addresses.
3. Stripe frontend publishable key, backend secret key, webhook secret, webhook destination, and tax mode all confirmed to be the same environment.
4. `MAIL_SMTP_URL` configured in Firebase Secret Manager.
5. Mail health visibility remains active and either scheduled retry/redrive or explicit resend controls exist for stale `RETRY`/`ERROR` mail docs.
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

## Resolution Notes - 5 September 2026

Resolved in the current working tree:

- Invite-gate failed-code copy is neutral.
- Buyer contact update failure blocks payment before Stripe confirmation.
- Admin delay notice UI reads top-level `queued`.
- Kortex Orders includes mail health counts/ids for failed or stuck mail.
- Buyer-facing support links are centralized through `src/js/support-contact.js`.
- Product/cart copy clarifies the two-piece bag limit.
- `src/js/prod-config.js` documents the Stripe live-mode gates.

Not resolved by code:

- Stripe remains in test mode until all live-mode secrets and webhook settings move together.
- Terms still contain legal placeholders.
- `MAIL_SMTP_URL` and owner/admin notification secrets cannot be verified from source.
- Stale `RETRY`/`ERROR` mail docs are visible, but not automatically redriven.
- Buyer support address still needs owner confirmation before switching to `orders@kaayko.com`.
- Full Stripe test purchase, buyer receipt, admin receipt, Kortex fulfillment, and shipping email smoke must still be run.

## Agent Task Queue

P0:

- Replace Stripe test key only when the full live Stripe/backend/webhook setup is ready.
- Fill Terms legal placeholders and final support/notice details.
- Run the full Stripe test-mode purchase/receipt/admin/fulfillment smoke.

P1:

- Verify SMTP secret and add retry/redrive or resend controls for mail failures.
- Confirm the buyer support mailbox and switch `src/js/support-contact.js` if appropriate.
- Decide whether `kaay.store` should be `noindex` and canonicalized to `kaayko.com/store`, or be its own canonical storefront.

P2:

- Ensure all live sellable SKUs have `actualPrice`.
- Add admin pagination/search so older unshipped orders cannot hide behind the first page.
- Harden product vote IP handling if votes become a meaningful ranking/supply signal.
