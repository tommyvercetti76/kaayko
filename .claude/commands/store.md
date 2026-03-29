You are working on the **Store module** of Kaayko (`/Users/Rohan/Kaayko_v6`).

## Scope — pages
| URL | File |
|-----|------|
| `/store` | `kaayko/src/store.html` |
| `/cart` | `kaayko/src/cart.html` |
| `/order-success` | `kaayko/src/order-success.html` |

## Scope — JS files
- `kaayko/src/js/kaayko_apiClient.js` — getAllProducts, getProductByID, voteOnProduct
- `kaayko/src/js/secretStore.js` — voting system
- `kaayko/src/js/kaaykoFilterModal.js` — filter/search UI
- `kaayko/src/js/cartManager.js` — cart state (localStorage)

## Scope — API files
- `kaayko-api/functions/api/products.js`
- `kaayko-api/functions/api/checkout.js`

## APIs used
```
# Products (public, no auth)
GET  /api/products                    → all products (Firestore: kaaykoproducts)
GET  /api/products/{id}              → single product
GET  /api/images                      → product images from Firebase Storage
POST /api/products/{id}/vote         → vote  body: { voteChange: 1 | -1 }
                                        rate-limited by IP — do not remove

# Checkout (public — auth via Stripe)
POST /api/createPaymentIntent         → create Stripe payment intent
     body: {
       items: [{productId, quantity, price}],
       totalAmount, customerEmail, shippingAddress,
       customerName, customerPhone,
       dataRetentionConsent: boolean
     }
POST /api/createPaymentIntent/updateEmail  → update email on existing intent
POST /api/createPaymentIntent/webhook      → Stripe webhook (raw body, NO auth header)
```

## Firestore collections
- `kaaykoproducts` — product catalog (votes, tags, sizes, colors, imgSrc[])
- `orders` — placed orders

## Firebase Storage
```
gs://bucket/kaaykoStoreTShirtImages/{productID}/*.{jpg,png}
```

## External services
- **Stripe** — payment processing, webhooks

## Auth pattern
- Browsing + voting + checkout: no auth required
- Webhook: Stripe signature verification (`STRIPE_WEBHOOK_SECRET`)

## Task
$ARGUMENTS
