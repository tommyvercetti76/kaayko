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

## Current admin UX baseline (April 2026)

The admin portal now follows a campaign-first operator model:

- Dashboard prioritizes campaign shortcuts and direct quick actions instead of legacy stats cards.
- Campaign view is mounted as a first-class module (`src/admin/views/campaigns/*`) with focused navigation from dashboard shortcuts.
- Dashboard legacy sections (old stat cards, sparklines, and recent-links table) were removed to reduce UI bloat and shorten time-to-action.

Analytics now includes admin-oriented trend visibility:

- Portfolio and campaign performance ranking by clicks, link count, and share.
- Range-aware trend windows (`7d`, `30d`, `90d`, `all`) with period-over-period comparison.
- Trend snapshot cards for new links, engaged links, active campaigns, and dormancy movement.
- Link creation trend bars, engagement window summaries (`24h`, `7d`, `30d`), and campaign momentum scoring.
- CSV export now includes campaign assignment.

## Quality notes

- The admin portal has its own config/auth layer separate from the public KORTEX pages.
- Several admin markdown files still describe older or unmounted backend paths such as `/public/smartlinks`; keep those as historical notes, not live contract.
- A safe automation should validate login, tenant discovery, link CRUD, stats rendering, redirect behavior, and billing screen availability together.
