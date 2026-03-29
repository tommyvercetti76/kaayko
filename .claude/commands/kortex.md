You are working on the **Kortex module** of Kaayko (`/Users/Rohan/Kaayko_v6`).

Kortex is the multi-tenant smart link manager + admin portal.

## Scope — pages
| URL | File |
|-----|------|
| `/kortex` | `kaayko/src/admin/kortex.html` — main admin dashboard |
| `/admin/login` | `kaayko/src/admin/login.html` (redirects → /kortex) |
| `/admin/clear-cache` | `kaayko/src/admin/clear-cache.html` |
| `/admin/tenant-registration` | `kaayko/src/admin/tenant-registration.html` |
| `/admin/views/dashboard` | `kaayko/src/admin/views/dashboard/dashboard.html` |
| `/admin/views/create-link` | `kaayko/src/admin/views/create-link/create-link.html` |
| `/admin/views/all-links` | `kaayko/src/admin/views/all-links/all-links.html` |
| `/admin/views/qr-codes` | `kaayko/src/admin/views/qr-codes/qr-codes.html` |
| `/admin/views/analytics` | `kaayko/src/admin/views/analytics/analytics.html` |
| `/admin/views/billing` | `kaayko/src/admin/views/billing/billing.html` |
| `/admin/views/tenant-onboarding` | `kaayko/src/admin/views/tenant-onboarding/tenant-onboarding.html` |
| `/admin/views/roots` | `kaayko/src/admin/views/roots/index.html` |
| `/create-kortex-link` | `kaayko/src/create-kortex-link.html` |

## Scope — API files
- `kaayko-api/functions/api/smartlinks.js`
- `kaayko-api/functions/api/admin.js`
- `kaayko-api/functions/api/billing.js`

## APIs used
```
# Smart links (admin auth required)
POST   /api/smartlinks               → create link
GET    /api/smartlinks               → list all links
GET    /api/smartlinks/{id}          → get link details
PUT    /api/smartlinks/{id}          → update (routing rules, A/B tests, webhooks)
DELETE /api/smartlinks/{id}          → delete
GET    /api/smartlinks/{id}/stats    → click analytics
POST   /api/smartlinks/{id}/click   → record click + redirect (public)
GET    /api/smartlinks/redirect/{slug} → follow link — device-aware routing (public)

# Orders (admin auth required)
GET  /api/admin/getOrder?id={id}     → fetch order
GET  /api/admin/listOrders           → list all orders
POST /api/admin/updateOrderStatus    → update status
     body: { orderId, status, notes }

# Billing (admin auth required)
GET    /api/billing/subscriptions
POST   /api/billing/subscriptions
PUT    /api/billing/subscriptions/{id}
DELETE /api/billing/subscriptions/{id}
```

## Smart link data shape
```js
{
  slug, title, destination,
  routes: [{ device: 'iOS'|'Android'|'web', destination }],
  abTests: [{ variant, destination, weight: 50 }],
  webhooks: [urls],
  analytics: { totalClicks, byDevice: {iOS, Android, web}, conversions }
}
```

## Firestore collections
- `smartlinks` — link definitions
- `smartLinkClicks` — click event log (attribution, device, referrer)
- `orders` — e-commerce orders
- `subscriptions` — Kortex billing

## External services
None beyond Firebase.

## Auth pattern
Firebase ID token with `admin` custom claim required for all Kortex operations.
Exception: `/api/smartlinks/{id}/click` and `/redirect/{slug}` are public (tracking + redirect).

## Task
$ARGUMENTS
