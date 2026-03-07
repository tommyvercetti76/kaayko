# Kreator Frontend

## Scope

Kreator is the creator-facing application and account-management experience for Kaayko.

## Primary entrypoints

- `src/kreator/index.html`
- `src/kreator/apply.html`
- `src/kreator/check-status.html`
- `src/kreator/onboarding.html`
- `src/kreator/kreator-login.html`
- `src/kreator/dashboard.html`
- `src/kreator/add-product.html`
- `src/kreator/admin/index.html`

Shared implementation file:

- `src/kreator/js/kreator-api.js`

## Backend routes consumed

- `/kreators/apply`
- `/kreators/applications/:id/status`
- `/kreators/onboarding/verify`
- `/kreators/onboarding/complete`
- `/kreators/auth/google/signin`
- `/kreators/auth/google/connect`
- `/kreators/auth/google/disconnect`
- `/kreators/me`
- `/kreators/admin/*`

Expected but currently mismatched:

- `/kreators/products`

## UX responsibilities

- New creator applications
- Status lookup and onboarding completion
- Account login and dashboard rendering
- Admin review and approval workflows

## Current mismatch on `main`

- `src/kreator/dashboard.html` and `src/kreator/add-product.html` call `/kreators/products`.
- The companion `kaayko-api/main` branch does not mount the `kreatorProductRoutes.js` module from its entrypoint, so product-management UI is ahead of the deployed contract.

## Quality notes

- Treat dashboard/account flows and product-management flows separately in maintenance. The first set is live. The second depends on a backend mount decision.
