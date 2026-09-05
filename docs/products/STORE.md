# Store Frontend Product Map

Last reviewed: 2026-09-05

The Store frontend is the kaay.store shopping surface: invite/access screen, catalog, product detail, cart, Stripe checkout, and order success.

## Current Entrypoints

| Route | Source | Role |
|---|---|---|
| `https://kaay.store` | `src/store.html` | Storefront and invite/access UX. |
| `/p/<productId>` | `src/product.html`, `src/js/product.js`, `src/js/fitPicker.js` | Product detail page. |
| `/cart` | `src/cart.html`, `src/js/cartManager.js` | Bag, Stripe Payment Element, tax, contact, address, final pay. |
| `/order-success` | `src/order-success.html` | Stripe return page and buyer confirmation. |
| `/store/about`, `/about` | `src/store-about.html` | Store about page. |
| `/store/privacy`, `/privacy` | `src/store-privacy.html` | Store privacy page. |
| `/legal/terms` | `src/legal/terms.html` | Terms used by checkout. |
| `/legal/shipping` | `src/legal/shipping.html` | Shipping promise. |
| `/legal/returns` | `src/legal/returns.html` | Returns promise. |

## Shared Source Files

- `src/js/prod-config.js`
- `src/js/kaayko_apiClient.js`
- `src/js/kaayko_ui.js`
- `src/js/cartManager.js`
- `src/js/storeAccess.js`
- `src/js/secretStore.js`
- `src/css/storestyle.css`
- `src/css/product.css`
- `src/css/fitPicker.css`
- `src/css/storeAccess.css`

## Backend APIs Consumed

- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products/:id/vote`
- `POST /createPaymentIntent`
- `POST /createPaymentIntent/tax`
- `POST /createPaymentIntent/updateEmail`

Admin fulfillment is handled inside Kortex:

- `GET /api/admin/listOrders?groupByOrder=true`
- `GET /api/admin/getOrder`
- `POST /api/admin/updateOrderStatus`
- `POST /api/admin/orders/delay-notice`
- `GET /api/admin/products`
- `PATCH /api/admin/products/:id`

## Current Money Flow

The frontend sends product id, size, gender, and quantity to the backend. It must never send or trust final price as authority.

Checkout sequence:

1. Cart calls `/createPaymentIntent`.
2. Backend returns server-priced totals and Stripe client secret.
3. Address Element collects shipping address.
4. Cart calls `/createPaymentIntent/tax` when tax is available.
5. Cart calls `/createPaymentIntent/updateEmail`.
6. Stripe confirms the payment and redirects to `/order-success`.
7. Stripe webhook creates order records and queues buyer/admin email.

## Launch Blockers

See:

- `docs/audits/KAAY_STORE_FULL_FEATURE_AUDIT_2026-09-05.md`
- `docs/audits/CROSS_PRODUCT_USER_AND_OPERATIONS_AUDIT_2026-09-05.md`

Blocking issues as of this review:

- `src/js/prod-config.js` uses a Stripe `pk_test` publishable key.
- `src/legal/terms.html` contains legal placeholders.
- Buyer-facing support emails are inconsistent across frontend/backend docs.
- Store invite failure copy must be neutral and buyer-safe.
- Cart must handle non-OK contact update responses.
- Admin delay notice UI must read the actual backend response shape.
- Live SMTP secret and mail retry/redrive need operational verification.

## Verification

Frontend smoke:

- `https://kaay.store`
- `https://kaay.store/p/<productId>`
- `https://kaay.store/cart`
- `https://kaay.store/order-success`

Backend tests:

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

Do not attempt a real live purchase unless live Stripe config and legal/mail launch blockers are resolved by the owner.

