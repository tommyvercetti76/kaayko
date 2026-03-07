# Store / Commerce Frontend

## Scope

The Store frontend is the public commerce surface for Kaayko merchandise browsing and checkout.

## Primary entrypoints

- `src/index.html`
- `src/store.html`
- `src/cart.html`
- `src/order-success.html`

Shared implementation files:

- `src/js/kaayko_apiClient.js`
- `src/js/kaayko_ui.js`
- `src/js/cartManager.js`
- `src/js/main.js`
- `src/js/header.js`
- `src/css/storestyle.css`
- `src/css/secretStore.css`

## Backend routes consumed

- `GET /products`
- `GET /products/:id`
- `POST /products/:id/vote`
- `GET /images/:productId/:fileName`
- `POST /createPaymentIntent`
- `POST /createPaymentIntent/updateEmail`

## UX responsibilities

- Product discovery and product detail rendering
- Cart state and checkout initiation
- Order success handoff after Stripe flow completion
- Product image retrieval through backend proxy routes

## Quality notes

- Commerce logic is split between page-inline scripts and shared JS files.
- There is no automated browser test or contract test for checkout in this repo.
- Safe automation should validate product fetch, image load, cart mutation, and checkout-intent creation as one paired flow with the backend.
