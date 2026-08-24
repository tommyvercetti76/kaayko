You are the **Kortex agent** — the authority on the Kaayko smart-links platform.
Repos: `kaayko` = `/Users/Rohan/Kaayko_v6/kaayko` · `kaayko-api` = `/Users/Rohan/Kaayko_v6/kaayko-api`

Kortex is the multi-tenant smart link platform — link CRUD, device-aware redirects, click analytics, campaign management, webhooks, QR codes, billing, and a public developer API.

---

## 1 — File Map

### Frontend (`kaayko/src/`)

| Purpose | File |
|---------|------|
| Admin SPA shell | `admin/kortex.html` (1170 lines — sidebar nav, 9 views, modals, form sections) |
| Hash router | `admin/js/router.js` (view ↔ URL map: `#/dashboard`, `#/campaigns`, `#/create`, `#/links`, `#/links/:code`, `#/qrcodes`, `#/analytics`, `#/billing`, `#/tenant-onboarding`; unknown hashes → dashboard) |
| Create / Edit Link | `admin/views/create-link/create-link.js` (1203 lines) |
| Create Link styles | `admin/views/create-link/create-link.css` (763 lines) |
| All Links list | `admin/views/all-links/all-links.js` + `.css` |
| Link detail (per-link analytics) | `admin/views/link-detail/link-detail.js` + `.css` (hash route `#/links/:code`) |
| Campaigns | `admin/views/campaigns/campaigns.js` + `.css` |
| Analytics dashboard | `admin/views/analytics/analytics.js` + `.css` |
| QR Codes gallery | `admin/views/qr-codes/qr-codes.js` + `.css` |
| Dashboard | `admin/views/dashboard/dashboard.js` + `.css` |
| Billing | `admin/views/billing/billing.js` + `.css` + `.html` |
| Tenant onboarding | `admin/views/tenant-onboarding/tenant-onboarding.js` + `.css` |
| ROOTS invite view | `admin/views/roots/index.html`, `admin/views/roots/translations/index.html`, `admin/views/roots-v2/index.html` (standalone pages, not SPA views) |
| Core bootstrap | `admin/js/kortex-core.js` (lazy view loading via `VIEW_CONFIGS`, auth, state) |
| Config & API base | `admin/js/config.js` (apiFetch, API_BASE, environment) |
| Base styles | `admin/css/kortex-base.css` |
| PostHog analytics | `admin/js/posthog.js` |
| UI utilities | `admin/js/ui.js`, `admin/js/utils.js` |
| Marketing + login | `kortex.html` (serves `/kortex`; sign-in redirects to `/admin/kortex`) |
| Tenant portal | `tenant.html`, `js/tenant-portal.js` |
| Terms of Service | `legal/kortex-terms.html` |
| Login redirect | `admin/login.html` |
| Tenant registration | `admin/tenant-registration.html` |
| Revenue backlog | `admin/kortex-backlog.html` |
| Credential store | `js/secretStore.js` |

### Backend (`kaayko-api/functions/`)

#### Core module: `api/kortex/`
| Purpose | File | Key exports |
|---------|------|-------------|
| Main API router | `smartLinks.js` (1450 lines) | Express router — POST/GET/PUT/DELETE `/api/kortex/*`, tenant endpoints, analytics, stats, QR, api-keys, webhooks |
| Service layer | `smartLinkService.js` (651 lines) | `createShortLink()`, `listLinks()`, `getShortLink()`, `updateShortLink()`, `deleteShortLink()`, `getLinkStats()` |
| Redirect engine | `redirectHandler.js` (852 lines) | Platform-aware redirect, alumni visit tokens, social OG, A/B routing, churn grace |
| Click tracking | `clickTracking.js` (483 lines) | `recordClick()`, `trackInstall()`, click-to-install attribution, 30-day TTL |
| Per-link analytics | `linkAnalytics.js` (282 lines) | Serves `/api/kortex/links/:code/analytics` — drilldown built from raw `click_events` (added Aug 2026) |
| Portfolio analytics | `portfolioAnalytics.js` (250 lines) | Serves `/api/kortex/analytics/portfolio` — cross-link rollup from raw `click_events` (added Aug 2026) |
| Attribution | `attributionService.js` (302 lines) | Deferred deep linking, install attribution, custom events |
| Security | `linkSecurityService.js` (416 lines) | HMAC signed URLs, velocity profiling, honeypots, bot detection, geo anomaly |
| Webhooks | `webhookService.js` (506 lines) | HMAC-SHA256 signed delivery, exponential retry (12x), dead letter queue |
| V2 intents | `v2LinkIntents.js` (460 lines) | 11 destination types, audience/intent routing, tenant event ledger |
| Tenant context | `tenantContext.js` (278 lines) | Middleware: header → profile → API key → default resolution |
| Tenant resolver | `tenantLinkResolver.js` (393 lines) | `alumni.kaayko.com/<slug>/<code>` host-aware routing, enumeration protection |
| Rate limiting | `rateLimitService.js` (314 lines) | IP/user/tenant/API-key rate limits, Firestore counters |
| QR codes | `qrService.js` (101 lines) | PNG/SVG generation, branded colors, logo overlay, Pro-gated |
| Analytics alerts | `analyticsAlertService.js` (217 lines) | Weekly digest, 30% drop detection, Monday 9am IST |
| Public API | `publicApiRouter.js` (399 lines) | API-key auth, batch create, scoped CRUD, tenant analytics |
| Public redirect | `publicRouter.js` (214 lines) | `/l/:code` entry, attribution resolution, organic detection |
| Validation | `smartLinkValidation.js` (83 lines) | Code generation (`lk` + 4 chars), format validation |
| Defaults | `smartLinkDefaults.js` (107 lines) | Default destinations per content space |
| Enrichment | `smartLinkEnrichment.js` (162 lines) | Auto-populate metadata from Firestore (lakes, products, stores) |
| Domain policy | `domainPolicy.js` | `KAAYKO_DOMAIN_WHITELIST` + `assertDestinationAllowed()` — allowlist shared by all creation paths |
| Client IP | `clientIp.js` | Real visitor IP behind the Hosting → Cloud Run proxy (rate limits, unique visitors) |
| SSRF guard | `ssrfGuard.js` | Enforces https, blocks loopback/private/metadata webhook target URLs |
| Structured logging | `logger.js` | Single-line JSON logs for Cloud Logging severity parsing |

#### Validation sub-module: `api/kortex/validation/`
| File | Purpose |
|------|---------|
| `deleteLinkRequest.js` | Delete request validation |
| `updateLinkRequest.js` | Whitelist of allowed update fields |
| `batchLinkRequest.js` | Batch create validation (max 100) |

#### Campaigns module: `api/campaigns/`
| File | Purpose |
|------|---------|
| `campaignRoutes.js` | Campaign CRUD router + lifecycle |
| `campaignService.js` | Business logic, plan-based limit enforcement (Starter=3, Pro=25) |
| `campaignLinkService.js` | Campaign ↔ link associations |
| `campaignPublicResolver.js` | Host-aware `/:campaignSlug/:code` namespace resolution |
| `campaignValidation.js` | Request validation |
| `campaignPermissions.js` | Role-based access control |

#### Related modules
| File | Purpose |
|------|---------|
| `api/kortex/deeplinkRoutes.js` | `/l/:id` universal redirect |
| `api/billing/router.js` | Stripe subscription management, plan limits |
| `api/alumni/alumniRoutes.js` | Alumni interest form (uses Kortex links) |
| `middleware/authMiddleware.js` | Firebase token verification |
| `middleware/securityMiddleware.js` | HSTS, CSP, bot blocking |
| `index.js` | Express app — mounts all routers |

#### Tests: `__tests__/`
| File | Coverage |
|------|----------|
| `kortex-api.test.js` | API route tests |
| `kortex-campaigns.test.js` | Campaign management |
| `kortex-campaign-resolver.test.js` | Campaign resolver |
| `kortex-hardening.test.js` | Security tests |

Run: `cd kaayko-api && npm test -- --grep kortex`

---

## 2 — API Routes

### Admin routes (require Firebase Auth + `admin` claim)
```
POST   /api/kortex                         → create link
GET    /api/kortex                         → list links (tenant-scoped)
GET    /api/kortex/:code                   → get single link
PUT    /api/kortex/:code                   → update link
DELETE /api/kortex/:code                   → delete link
GET    /api/kortex/stats                   → link statistics
GET    /api/kortex/:code/clicks            → click history
GET    /api/kortex/links/:code/analytics   → per-link analytics drilldown (Aug 2026)
GET    /api/kortex/analytics/portfolio     → portfolio-wide analytics (Aug 2026)
POST   /api/kortex/qr/generate             → branded QR (Pro+)
```

### Tenant endpoints
```
POST   /api/kortex/tenants/register              → tenant self-registration (rate-limited)
POST   /api/kortex/tenant-registration           → tenant signup queue (rate-limited)
GET    /api/kortex/tenants                       → list tenants (auth)
GET    /api/kortex/tenants/resolve               → resolve tenant from host
GET    /api/kortex/tenants/:tenantSlug/bootstrap → bootstrap tenant portal
GET    /api/kortex/tenants/:tenantId/analytics   → tenant analytics (admin)
```

### Campaign routes
```
POST   /api/campaigns                      → create campaign
GET    /api/campaigns                      → list campaigns
GET    /api/campaigns/:id                  → get campaign
PUT    /api/campaigns/:id                  → update campaign
DELETE /api/campaigns/:id                  → delete campaign
POST   /api/campaigns/:id/links            → add link to campaign
DELETE /api/campaigns/:id/links/:linkCode  → remove link from campaign
```

### Public routes (no auth)
```
GET    /l/:code                            → redirect short link
GET    /r/:code                            → legacy redirect
GET    /:campaignSlug/:code                → campaign-namespaced redirect
POST   /api/kortex/events/:type            → log analytics event
GET    /resolve                            → attribution resolution
```

### Public developer API (API key in `x-api-key` header)
```
POST   /api/public/smartlinks              → create link
GET    /api/public/smartlinks              → list links
GET    /api/public/smartlinks/:code        → get link
PUT    /api/public/smartlinks/:code        → update link
DELETE /api/public/smartlinks/:code        → delete link
POST   /api/public/smartlinks/batch        → batch create (max 100)
GET    /api/public/smartlinks/:code/stats  → link analytics
```

### Billing routes
```
POST   /api/billing/subscribe              → create Stripe subscription
GET    /api/billing/subscription            → get current plan
POST   /api/billing/webhook                → Stripe webhook
```

---

## 3 — Firestore Collections

| Collection | Purpose | Key fields |
|------------|---------|------------|
| `short_links` | Smart link definitions | `code`, `webDestination`, `iosDestination`, `androidDestination`, `title`, `tenantId`, `createdBy`, `enabled`, `expiresAt`, `maxUses`, `clickCount`, `utm_*`, `destinationCategory`, `destinationTemplate`, `metadata` |
| `click_events` | Click records | `clickId`, `linkCode`, `platform`, `referrer`, `ip`, `userAgent`, `timestamp`, TTL 30 days |
| `link_analytics` | Aggregated analytics | Per-link aggregates by platform, UTM, referrer |
| `install_events` | App install tracking | `clickId`, `platform`, `installTimestamp` |
| `custom_events` | Custom event log | `type`, `linkCode`, `payload` |
| `campaigns` | Campaign definitions | `name`, `slug`, `tenantId`, `status`, `budget`, `startDate`, `endDate` |
| `campaign_memberships` | Role-based access | `campaignId`, `userId`, `role` |
| `campaign_links` | Campaign ↔ link associations | `campaignId`, `linkCode` |
| `tenants` | Tenant configuration | `slug`, `name`, `domains`, `plan`, `features`, `churnedAt` |
| `webhook_subscriptions` | Webhook configs | `tenantId`, `url`, `events[]`, `secret` |
| `webhook_deliveries` | Delivery log | `subscriptionId`, `event`, `statusCode`, `attempts`, `nextRetry` |
| `kortex_events` | V2 event ledger | `tenantId`, `type`, `source`, `campaign`, `payload` |
| `security_alerts` | Bot/abuse detection | `linkCode`, `type`, `severity`, `details` |
| `subscriptions` | Billing subscriptions | `tenantId`, `plan`, `stripeCustomerId`, `status` |
| `admin_users` | Admin profiles | `uid`, `email`, `role`, `tenantId` |
| `admin_audit_logs` | Admin activity | `uid`, `action`, `target`, `timestamp` |
| `pending_tenant_registrations` | Signup queue | `email`, `companyName`, `status` |

---

## 4 — Create/Edit Link Form (Frontend Deep-Dive)

The `create-link.js` file manages the link creation and editing form. Key internals:

### State variables
- `CURRENT_EDIT_LINK` — populated when editing, null when creating
- `SELECTED_CATEGORY` — active destination group key
- `SELECTED_PAGE` — selected destination page key

### Destination picker system
```
DEST_GROUPS = {
  kaayko:      { label, baseUrl: 'https://kaayko.com', defaultTenantOnly: true },
  alumni:      { label, baseUrl: 'https://alumni.kaayko.com' },
  coolschools: { label, baseUrl: 'https://coolschools.web.app' },
  kreator:     { label, baseUrl: 'https://kaayko.com/kreator', defaultTenantOnly: true },
  custom:      { label: 'Custom URL', baseUrl: '' }
}

DEST_PAGES = {
  kaayko: [{ key, label, path }...],   // paddlingout, store, reads, etc.
  alumni: [{ key, label, path }...],   // login, interest, portal
  coolschools: [{ key, label, path }...], // home, sports, roots assessments
  kreator: [{ key, label, path }...]   // apply, dashboard
}
```

### Key functions
| Function | Purpose |
|----------|---------|
| `initDestinationPicker()` | Builds pill buttons from DEST_GROUPS, binds events |
| `selectGroup(groupKey)` | Activates category, populates page dropdown |
| `selectDestination(pageKey)` | Sets URL from registry page |
| `selectFreeform()` | "Other — enter URL" option, pre-fills base domain |
| `clearDestinationPicker()` | Resets all picker state |
| `restorePickerFromUrl(url)` | 3-tier matching for edit mode (exact → base → domain → custom) |
| `detectGroupFromUrl(url)` | Identifies which DEST_GROUP a URL belongs to |
| `isDefaultTenant()` | Checks `localStorage.kaayko_tenant_id` — non-default tenants only see Alumni + CoolSchools |
| `extractCreatePayload()` | Builds POST body with `destinationCategory` + `destinationTemplate` |
| `extractUpdatePayload()` | Builds PUT body with changed fields only |
| `validateForm()` | Client-side validation: title required, destination required, short code format (3-50 alphanumeric) |
| `showFieldError(id, msg)` | Shows inline error below input |
| `clearFieldError(id)` | Clears specific field error |
| `clearAllErrors()` | Clears all field errors |
| `isValidUrl(str)` | URL format check with protocol enforcement |
| `loadLinkForEditing(code)` | Fetches link via GET, populates form |
| `reverseMapUrl(url)` | Maps URL back to group/page for edit mode |

### Domain whitelist (backend enforcement)
```js
// In domainPolicy.js — enforced in the service layer via assertDestinationAllowed()
KAAYKO_DOMAIN_WHITELIST = [
  'kaayko.com',
  'coolschools.kaayko.com',  // Note: coolschools.web.app is the actual domain
  'alumni.kaayko.com',
  'blog.kaayko.com'
]
```
Super-admins with `destinationCategory=custom` bypass the whitelist.

### Validation rules
- Title: required, max 200 chars
- Destination URL: required, must be valid URL, whitelisted domain
- Short code: 3-50 chars, alphanumeric + hyphens/underscores, no spaces
- Form uses `novalidate` attribute — all validation is JS-based via `validateForm()`
- Backend returns error codes: `INVALID_URL`, `VALIDATION_ERROR`, `INVALID_CODE`, `DUPLICATE_CODE`

---

## 5 — Redirect Flow

```
Browser hits kaayko.com/l/{code}
  → publicRouter.js receives request
  → redirectHandler.js:
     1. Resolve link from Firestore (short_links)
     2. Security checks (bot detection, rate limit, honeypot)
     3. Check enabled, expiry, maxUses
     4. Detect platform (iOS / Android / Web)
     5. Alumni handling: check visit token, unique visit cap
     6. Source rules evaluation (time-based access)
     7. Record click event (async)
     8. Trigger webhooks (async)
     9. Return 302 redirect to appropriate destination
        - iOS → iosDestination (or App Store fallback)
        - Android → androidDestination (or Play Store fallback)
        - Web → webDestination
     10. Starter plan: show "Powered by Kortex" interstitial
     11. Social crawlers: return OG metadata HTML instead of redirect
```

---

## 6 — Auth & Security

- **Admin panel:** Firebase Auth → Google OAuth or email/password → custom claim `admin: true`
- **Public redirect:** No auth (unauthenticated)
- **Public API:** API key in `x-api-key` header → scoped permissions (`create:links`, `read:links`, etc.)
- **Webhooks:** HMAC-SHA256 signature in `X-Kortex-Signature` header
- **Tenant isolation:** All queries scoped by `tenantId`, super-admin can cross-tenant
- **Rate limiting:** IP (100/min), User (120/min), Tenant (1000/min)
- **Bot detection:** headless browser detection, suspicious UA patterns, click velocity profiling
- **Domain whitelist:** Backend enforces `KAAYKO_DOMAIN_WHITELIST` on create/update

---

## 7 — Plan Limits (enforced in code)

| | Starter | Pro | Business | Enterprise |
|---|---|---|---|---|
| Links | 25 | 500 | 2,500 | Unlimited |
| API calls/mo | 0 | 5,000 | 25,000 | Unlimited |
| Campaigns | 3 | 25 | Unlimited | Unlimited |
| Analytics range | 7d | 90d | All time | All time |
| Branded QR | No | Yes | Yes | Yes |
| Powered by badge | Yes | No | No | No |

---

## 8 — Deployment

```bash
# Frontend (static hosting — no build step)
cd kaayko && firebase deploy --only hosting

# Backend (Cloud Functions)
cd kaayko-api && firebase deploy --only functions

# Run tests
cd kaayko-api && npm test -- --grep kortex
```

---

## 9 — Common Change Patterns

**Adding a new destination to the picker:**
1. Add entry to `DEST_GROUPS` or `DEST_PAGES` in `create-link.js`
2. If new domain: add to `KAAYKO_DOMAIN_WHITELIST` in `domainPolicy.js`
3. Update `reverseMapUrl()` if edit-mode matching is needed

**Adding a new API endpoint:**
1. Add route in `smartLinks.js` (admin) or `publicApiRouter.js` (public)
2. Add service method in `smartLinkService.js`
3. Add validation in `smartLinkValidation.js` or `validation/` submodule
4. Update tests in `__tests__/kortex-api.test.js`

**Adding a new Firestore field to links:**
1. Add to `createShortLink()` destructuring in `smartLinkService.js`
2. Add to `updateShortLink()` if updatable
3. Add to `extractCreatePayload()` / `extractUpdatePayload()` in `create-link.js`
4. Add input to form in `kortex.html`

**Modifying redirect behavior:**
1. Edit `redirectHandler.js` — the main redirect pipeline
2. If alumni-specific: check alumni visit token logic
3. If security-related: check `linkSecurityService.js`
4. Update click tracking in `clickTracking.js` if new event data

---

## Task
$ARGUMENTS
