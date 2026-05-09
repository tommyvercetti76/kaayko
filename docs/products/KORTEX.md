# KORTEX Frontend

## Scope

KORTEX is the smart-link product surface, spanning public creation flows, authenticated admin workflows, billing, analytics, and redirect handling.

Comprehensive agent command (file map, routes, collections, change patterns): `/.claude/commands/kortex.md`
Product strategy probe: [`KORTEX_PRODUCT_PROBE.md`](./KORTEX_PRODUCT_PROBE.md)

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

## Destination picker (May 2026)

The create-link form uses a **destination picker** system instead of raw URL entry:

- **Category pills** — Kaayko, Alumni, CoolSchools, Kreator, Custom URL
- **Page dropdown** — pre-defined pages within each category (e.g. paddlingout, store, alumni login)
- **"Other — enter URL"** — freeform option per category, pre-fills base domain
- **Editable URLs** — destination is editable after picker selection (for query params like `?id=antero`)
- **Tenant scoping** — non-default tenants only see Alumni + CoolSchools pills (`defaultTenantOnly` flag)
- **Analytics fields** — `destinationCategory` and `destinationTemplate` tracked per link in Firestore
- **Domain whitelist** — backend enforces `KAAYKO_DOMAIN_WHITELIST` on all create/update ops; super-admins with `destinationCategory=custom` bypass

Key functions: `initDestinationPicker()`, `selectGroup()`, `selectDestination()`, `selectFreeform()`, `restorePickerFromUrl()`, `detectGroupFromUrl()`, `isDefaultTenant()`

## KORTEX V2 tenant-link baseline

The frontend supports KORTEX V2 link intent fields (super-admin only) in the admin create-link screen:

- destination type, namespace, tenant slug, alumni domain
- audience, intent, source, auth requirement

If a namespace is supplied, create-link calls `/kortex/tenant-links` and produces clean public aliases like `https://kaayko.com/a/adminP12`. Normal links use `/kortex` and public URLs like `https://kaayko.com/l/:code`.

The path-based tenant shell is implemented by `src/tenant.html` and `src/js/tenant-portal.js`. Firebase Hosting sends `/a/**` and `/login` to that shell.

## Form validation (May 2026)

Comprehensive client-side validation via `validateForm()`:

- Title: required, max 200 chars
- Destination URL: required, valid URL format, whitelisted domain
- Short code: 3-50 chars, alphanumeric + hyphens/underscores, no leading/trailing hyphens
- Form uses `novalidate` — all validation is JS-based with inline error display
- Backend returns error codes: `INVALID_URL`, `VALIDATION_ERROR`, `INVALID_CODE`, `DUPLICATE_CODE`
- Inline errors: `showFieldError(id, msg)` / `clearFieldError(id)` with `.field-error.visible` CSS

## Quality notes

- The admin portal has its own config/auth layer separate from the public KORTEX pages.
- Several admin markdown files still describe older or unmounted backend paths such as `/public/smartlinks`; keep those as historical notes, not live contract.
- A safe automation should validate login, tenant discovery, link CRUD, stats rendering, redirect behavior, and billing screen availability together.
