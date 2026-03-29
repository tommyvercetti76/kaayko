You are working on the **Kortex module** of Kaayko (`/Users/Rohan/Kaayko_v6/kaayko`).

Kortex is the multi-tenant smart link manager + admin portal.

## Pages
| URL | File | Notes |
|-----|------|-------|
| `/kortex` | `kaayko/src/admin/kortex.html` | main admin dashboard |
| `/admin/login` | `kaayko/src/admin/login.html` | redirects → /kortex |
| `/admin/clear-cache` | `kaayko/src/admin/clear-cache.html` | |
| `/admin/tenant-registration` | `kaayko/src/admin/tenant-registration.html` | |
| `/admin/views/dashboard` | `kaayko/src/admin/views/dashboard/dashboard.html` | |
| `/admin/views/create-link` | `kaayko/src/admin/views/create-link/create-link.html` | |
| `/admin/views/all-links` | `kaayko/src/admin/views/all-links/all-links.html` | |
| `/admin/views/qr-codes` | `kaayko/src/admin/views/qr-codes/qr-codes.html` | |
| `/admin/views/analytics` | `kaayko/src/admin/views/analytics/analytics.html` | |
| `/admin/views/billing` | `kaayko/src/admin/views/billing/billing.html` | |
| `/admin/views/tenant-onboarding` | `kaayko/src/admin/views/tenant-onboarding/tenant-onboarding.html` | |
| `/admin/views/roots` | `kaayko/src/admin/views/roots/index.html` | |
| `/admin/reset-environment` | `kaayko/src/admin/reset-environment.html` | ⚠️ NO AUTH — sets localStorage env |
| `/create-kortex-link` | `kaayko/src/create-kortex-link.html` | |
| ~~`/admin/views/create-link/tooltip-test`~~ | `kaayko/src/admin/views/create-link/tooltip-test.html` | ⚠️ test artifact in production |

## API files (actual paths)
- `kaayko-api/functions/api/smartLinks/smartLinks.js` — main admin/tenant routes
- `kaayko-api/functions/api/smartLinks/publicRouter.js` — public redirect + click tracking
- `kaayko-api/functions/api/smartLinks/publicApiRouter.js` — public API (API key auth)
- `kaayko-api/functions/api/smartLinks/redirectHandler.js` — device-aware redirect logic
- `kaayko-api/functions/api/smartLinks/clickTracking.js` — click event recording
- `kaayko-api/functions/api/admin/` — order management
- `kaayko-api/functions/api/billing/` — subscriptions

## APIs used
```
# Smart links — admin (Firebase auth required)
POST   /api/smartlinks                         → create link
GET    /api/smartlinks                         → list all links
GET    /api/smartlinks/{id}                   → get link
PUT    /api/smartlinks/{id}                   → update (routing, A/B tests, webhooks)
DELETE /api/smartlinks/{id}                   → delete
GET    /api/smartlinks/{id}/stats             → click analytics
GET    /api/smartlinks/tenants                → list tenants
GET    /api/smartlinks/stats                  → global analytics
POST   /api/smartlinks/tenant-registration    → new tenant setup (rate-limited)
GET    /api/smartlinks/migrate                → migration endpoint (admin only)

# Smart links — public
GET    /api/smartlinks/r/{code}              → device-aware redirect
GET    /api/smartlinks/{id}/attribution      → attribution report (API key)
POST   /api/smartlinks/batch                 → batch create (API key)
POST   /api/smartlinks/{id}/click           → record click event

# Orders (admin)
GET    /api/admin/getOrder?id={id}
GET    /api/admin/listOrders
POST   /api/admin/updateOrderStatus          → body: { orderId, status, notes }

# Billing (admin)
GET/POST/PUT/DELETE /api/billing/subscriptions
```

## Smart link data shape
```js
{
  slug, title, destination,
  routes: [{ device: 'iOS'|'Android'|'web', destination }],
  abTests: [{ variant, destination, weight: 50 }],
  webhooks: [urls],
  analytics: { totalClicks, byDevice, conversions }
}
```

## Firestore collections
- `short_links` — smart link definitions (primary collection name in code)
- `link_analytics` — analytics events
- `click_events` — click records
- `install_events` — app install tracking
- `custom_events` — custom event logging
- `webhook_subscriptions` — webhook config
- `webhook_deliveries` — delivery log
- `pending_tenant_registrations` — tenant signup queue
- `admin_users` — admin profiles (shared with kreator module)
- `admin_audit_logs` — admin activity log
- `orders` — e-commerce orders
- `subscriptions` — billing

## Auth
- Admin ops: Firebase `admin` custom claim
- Public API: `requireApiKey(['create:links'])` header
- Redirect + click: public

## ⚠️ Issues to be aware of
- `/admin/reset-environment.html` has NO authentication — any visitor can toggle localStorage env
- `tooltip-test.html` is a test artifact — should be removed
- Collection name inconsistency: `short_links` in code vs `smartlinks` in older docs

## Task
$ARGUMENTS
