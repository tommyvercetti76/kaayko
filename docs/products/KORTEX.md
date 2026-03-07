# KORTEX Frontend

## Scope

KORTEX is the smart-link product surface, spanning public creation flows, authenticated admin workflows, billing, analytics, and redirect handling.

## Primary entrypoints

Public and operator surfaces:

- `src/kortex.html`
- `src/create-kortex-link.html`
- `src/redirect.html`
- `src/admin/kortex.html`
- `src/admin/login.html`
- `src/admin/tenant-registration.html`

Admin implementation files:

- `src/admin/js/config.js`
- `src/admin/js/kortex-core.js`
- `src/admin/js/ui.js`
- `src/admin/views/dashboard/*`
- `src/admin/views/create-link/*`
- `src/admin/views/all-links/*`
- `src/admin/views/analytics/*`
- `src/admin/views/billing/*`
- `src/admin/views/tenant-onboarding/*`
- `src/admin/views/qr-codes/*`

## Backend routes consumed

- `/smartlinks/*`
- `/auth/*`
- `/billing/*`
- `/l/:id`
- `/resolve`

## UX responsibilities

- Tenant and link creation
- Admin authentication and dashboarding
- Analytics and QR code operations
- Billing visibility for subscription-backed flows
- Redirect resolution

## Quality notes

- The admin portal has its own config/auth layer separate from the public KORTEX pages.
- Several admin markdown files still describe older or unmounted backend paths such as `/public/smartlinks`; keep those as historical notes, not live contract.
- A safe automation should validate login, tenant discovery, link CRUD, stats rendering, redirect behavior, and billing screen availability together.
