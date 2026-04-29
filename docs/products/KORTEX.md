# KORTEX Frontend

## Scope

KORTEX is the smart-link product surface, spanning public creation flows, authenticated admin workflows, billing, analytics, and redirect handling.

Canonical tenant architecture and next-level `kortex.kaayko.com` plan: [`KORTEX_TENANT_ARCHITECTURE_PLAN.md`](./KORTEX_TENANT_ARCHITECTURE_PLAN.md).

Execution plan and definition of done for the button-only delivery workflow: [`KORTEX_DELIVERY_PLAN_AND_DOD.md`](./KORTEX_DELIVERY_PLAN_AND_DOD.md).

## Primary entrypoints

Public and operator surfaces:

- `src/kortex.html`
- `src/create-kortex-link.html`
- `src/redirect.html`
- `src/tenant.html`
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
- `src/js/tenant-portal.js`

## Backend routes consumed

- `/kortex/*` (canonical)
- `/smartlinks/*` (backend compatibility only)
- `/campaigns/*`
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
- Tenant alias routing for `/a/:code`
- Tenant path routing for `/a/:tenantSlug/...`

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

## KORTEX V2 tenant-link baseline

The frontend now supports KORTEX V2 link intent fields in the admin create-link screen:

- destination type
- namespace
- tenant slug
- alumni domain
- audience
- intent
- source
- auth requirement

If a namespace is supplied, create-link calls `/kortex/tenant-links` and can produce clean public aliases like `https://kaayko.com/a/adminP12`. Normal links continue to use `/kortex` and public URLs like `https://kaayko.com/l/:code`.

The path-based tenant shell is implemented by `src/tenant.html` and `src/js/tenant-portal.js`. Firebase Hosting sends `/a/**` and `/login` to that shell. The shell resolves compact aliases through `/kortex/links/:code/resolve`, bootstraps tenant paths through `/kortex/tenants/:tenantSlug/bootstrap`, and records V2 events through `/kortex/events`.

## Quality notes

- The admin portal has its own config/auth layer separate from the public KORTEX pages.
- Several admin markdown files still describe older or unmounted backend paths such as `/public/smartlinks`; keep those as historical notes, not live contract.
- A safe automation should validate login, tenant discovery, link CRUD, stats rendering, redirect behavior, and billing screen availability together.
