# KORTEX — Complete Feature Audit

Last audited: 2026-05-06

---

## Platform Summary

Kortex is Kaayko's smart-link infrastructure product. It provides branded short links, multi-tenant link management, campaign orchestration, real-time analytics, subscription billing, and a developer API surface. The platform serves both internal Kaayko operations and external tenants (institutions, alumni networks, fundraising orgs).

---

## Feature Inventory

### 1. Smart Link CRUD

| Aspect | Detail |
|--------|--------|
| Create | `POST /kortex` — generates `lkXXXX` short code |
| Read | `GET /kortex` (list), `GET /kortex/:code` (single) |
| Update | `PUT /kortex/:code` — destination, metadata, enabled state |
| Delete | `DELETE /kortex/:code` — soft delete with audit |
| Public URL | `kaayko.com/l/<code>` |
| Backend | `functions/api/kortex/smartLinks.js`, `smartLinkService.js` |
| Frontend | Admin > Create Link, Admin > All Links |

### 2. Platform-Aware Redirect Engine

| Aspect | Detail |
|--------|--------|
| Route | `GET /kortex/r/:code`, `GET /l/:id` |
| Routing | iOS / Android / Web detection via user-agent |
| Fallback | Web destination if platform-specific not set |
| Expiration | Checks `expiresAt` — returns expiry notice if past |
| Enable/Disable | Respects `enabled` flag per link |
| UTM passthrough | Preserves utm_source, utm_medium, utm_campaign, utm_term, utm_content |
| Backend | `functions/api/kortex/redirectHandler.js` |

### 3. Click Analytics & Tracking

| Aspect | Detail |
|--------|--------|
| Click ID | Unique `c_<16hex>` per click event |
| Data captured | IP (hashed), user-agent, referrer, UTM params, timestamp, geo (from IP) |
| Storage | `smartLinkClicks` Firestore collection |
| Aggregation | Real-time click counts on link documents |
| Backend | `functions/api/kortex/clickTracking.js` |
| Frontend | Admin > Analytics (7d / 30d / 90d / all ranges) |

### 4. Portfolio Analytics Dashboard

| Aspect | Detail |
|--------|--------|
| Metrics | Total clicks, engaged links, active campaigns, dormancy |
| Trends | Period-over-period comparison across all time ranges |
| Ranking | Campaign performance by clicks, link count, share |
| Engagement windows | 24h, 7d, 30d activity summaries |
| Link creation trend | Bar visualization over time |
| Campaign momentum | Scoring based on recent activity |
| CSV export | Full data export with campaign assignment column |
| Frontend | Admin > Analytics view (`views/analytics/analytics.js`) |

### 5. Click-to-Install Attribution

| Aspect | Detail |
|--------|--------|
| Flow | Click → redirect → install → first open → attribution |
| Resolution | Mobile app calls `/resolve` with clickId after install |
| Deferred deep linking | Context preserved across app store install |
| Metrics | Install count, conversion rate, time-to-install |
| Backend | `functions/api/kortex/attributionService.js` |

### 6. Campaign Management

| Aspect | Detail |
|--------|--------|
| CRUD | Create, list, get, update campaigns |
| Lifecycle | Active → Paused → Resumed → Archived |
| Members | Add/remove campaign members with roles |
| Permissions | `campaign:read`, `campaign:update` granular checks |
| Tenant-scoped | Campaigns belong to tenants, isolated data |
| Backend | `functions/api/campaigns/campaignRoutes.js`, `campaignService.js` |
| Frontend | Admin > Campaigns view |

### 7. Campaign Link Management

| Aspect | Detail |
|--------|--------|
| Attach links | `POST /campaigns/:id/links` |
| List links | `GET /campaigns/:id/links` |
| Update link | `PUT /campaigns/:id/links/:code` |
| Pause/Resume | Per-link lifecycle within campaign |
| Delete | `DELETE /campaigns/:id/links/:code` |
| Backend | `functions/api/campaigns/campaignLinkService.js` |

### 8. Campaign Namespace Resolver

| Aspect | Detail |
|--------|--------|
| Route | `GET /:campaignSlug/:code` |
| Purpose | Human-readable campaign-scoped URLs |
| Example | `kaayko.com/spring-drive/abc123` |
| Backend | `functions/api/campaigns/campaignPublicResolver.js` |

### 9. QR Code Generation

| Aspect | Detail |
|--------|--------|
| Method | Client-side via `api.qrserver.com` (400x400px) |
| URL format | Always `kaayko.com/l/<code>` |
| Gallery | Grid view of all link QR codes |
| Download | Individual QR code download |
| Frontend | Admin > QR Codes view (`views/qr-codes/qr-codes.js`) |

### 10. Multi-Tenant Architecture

| Aspect | Detail |
|--------|--------|
| Tenant resolution | Header > user profile > API key > default |
| Header | `X-Kaayko-Tenant-Id` from admin shell |
| Super-admin | Cross-tenant access for `role: super-admin` |
| Isolation | All queries scoped to tenant by default |
| Default tenant | `kaayko-default` for backward compatibility |
| Backend | `functions/api/kortex/tenantContext.js` |

### 11. Tenant Onboarding Wizard

| Aspect | Detail |
|--------|--------|
| Steps | 6-step wizard |
| Step 1 | Tenant name, ID, domain, path prefix, branding |
| Step 2 | Admin user creation (email, display name) |
| Step 3 | API key generation (production + analytics) |
| Step 4 | Webhook configuration (URL, secret, events) |
| Step 5 | DNS verification |
| Step 6 | Confirmation and go-live |
| Frontend | Admin > Tenant Onboarding (`views/tenant-onboarding/tenant-onboarding.js`) |

### 12. V2 Tenant Links (Intent-Based Aliases)

| Aspect | Detail |
|--------|--------|
| Route | `POST /kortex/tenant-links` |
| Fields | destination type, namespace, tenant slug, alumni domain, audience, intent, source, auth requirement |
| Destination types | `tenant_admin_login`, `tenant_alumni_login`, `tenant_registration`, `tenant_public_page`, `tenant_dashboard`, `campaign_landing`, `campaign_member_view`, `philanthropy_campaign`, `donation_checkout`, `campaign_report`, `external_url` |
| Audiences | admin, alumni, donor, public, invited |
| Intents | login, register, view, donate, report, share |
| Sources | qr, email, sms, social, manual, print |
| Public alias | `kaayko.com/a/<code>` instead of `/l/<code>` |
| Backend | `functions/api/kortex/v2LinkIntents.js` |

### 13. Tenant Portal Shell

| Aspect | Detail |
|--------|--------|
| Route | `kaayko.com/a/<tenantSlug>/...` |
| Bootstrap | `GET /kortex/tenants/:slug/bootstrap` |
| Alias resolution | `GET /kortex/links/:code/resolve` |
| Event recording | `POST /kortex/events` |
| Event types | `link_clicked`, `redirect_completed`, `login_started`, `login_completed`, `registration_started`, `registration_submitted`, `campaign_viewed`, `campaign_cta_clicked`, `donation_started`, `donation_completed`, `report_opened`, `qr_scanned` |
| Frontend | `src/tenant.html`, `src/js/tenant-portal.js` |

### 14. HMAC-Signed Webhooks

| Aspect | Detail |
|--------|--------|
| Events | `link.created`, `link.updated`, `link.deleted`, `link.clicked`, `app.installed`, `custom.event` |
| Security | HMAC SHA-256 signature in header |
| Retry | Exponential backoff on delivery failure |
| Per-tenant | Each tenant configures own webhook subscriptions |
| Backend | `functions/api/kortex/webhookService.js` |

### 15. Subscription Billing (Stripe)

| Aspect | Detail |
|--------|--------|
| Plans | Starter (free), Pro, Business, Enterprise |
| Starter limits | 25 links, 0 API calls |
| Pro limits | 500 links, 5,000 API calls/mo |
| Business limits | 2,500 links, 25,000 API calls/mo |
| Enterprise | Unlimited |
| Routes | `/billing/config`, `/billing/subscription`, `/billing/create-checkout`, `/billing/downgrade`, `/billing/webhook`, `/billing/usage` |
| Frontend | Admin > Billing view |
| Backend | `functions/api/billing/router.js` |

### 16. Admin Authentication

| Aspect | Detail |
|--------|--------|
| Provider | Firebase Auth (Google OAuth, email/password) |
| Routes | `POST /auth/verify`, `GET /auth/me`, `POST /auth/logout` |
| Claims | `admin: true` for admin ops |
| Middleware | `requireAuth`, `requireAdmin`, `optionalAuth` |
| Frontend | `src/admin/login.html` |

### 17. Rate Limiting

| Aspect | Detail |
|--------|--------|
| Strategies | IP-based, user-based, API-key-based, global |
| Storage | Time-bucketed counters in Firestore |
| Default | 60s windows, configurable per endpoint |
| Tenant API limit | 1,000 requests/min/tenant |
| Backend | `functions/api/kortex/rateLimitService.js` |

### 18. Bot Protection & Security

| Aspect | Detail |
|--------|--------|
| CSP | Strict Content-Security-Policy on all pages |
| Honeypots | `/admin/api-key`, `/admin/bulk-import`, `/export-all-data` |
| Bot detection | User-agent filtering via `botProtection` middleware |
| Headers | `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection` |
| Referrer | `strict-origin-when-cross-origin` |
| Backend | `securityMiddleware.js` |

### 19. Social Crawler / OG Metadata

| Aspect | Detail |
|--------|--------|
| Detection | Facebook, Twitter, WhatsApp, Telegram, Discord, Slack, LinkedIn, Apple bots |
| Behavior | Serves OG meta HTML instead of redirect for crawlers |
| Fields | og:title, og:description, og:image, twitter:card |
| Backend | `redirectHandler.js` → `isSocialCrawler()` |

### 20. Public Developer API (Not Yet Shipped)

| Aspect | Detail |
|--------|--------|
| Status | Written, NOT mounted — returns 404 |
| Auth | API key via `x-api-key` header with scoped permissions |
| Endpoints | `POST /api/public/smartlinks`, batch create, stats, attribution |
| Rate limit | 1,000 req/min/tenant |
| Backend | `functions/api/kortex/publicApiRouter.js` |

### 21. Tenant Self-Registration

| Aspect | Detail |
|--------|--------|
| Route | `POST /kortex/tenant-registration` |
| Frontend | `src/admin/tenant-registration.html` |
| Purpose | Public intake for new institutional tenants |

### 22. Admin Dashboard (Campaign-First)

| Aspect | Detail |
|--------|--------|
| Model | Campaign shortcuts and quick actions |
| Removed | Legacy stat cards, sparklines, recent-links table |
| Focus | Time-to-action optimization for operators |
| Frontend | `views/dashboard/dashboard.js` |

### 23. Link Expiration & Scheduling

| Aspect | Detail |
|--------|--------|
| Field | `expiresAt` on link document |
| Behavior | Redirect handler checks expiry before forwarding |
| UX | Expired links show expiry notice |

### 24. Link Enable/Disable

| Aspect | Detail |
|--------|--------|
| Field | `enabled` boolean on link document |
| Behavior | Disabled links don't redirect |
| UX | Toggle in All Links view and campaign link views |

---

## Unmounted / Future Features

| Feature | File | Status |
|---------|------|--------|
| External Public API | `publicApiRouter.js` | Written, not mounted |
| A/B split testing | Referenced in landing page schema | Not implemented in code |
| Custom domains | Referenced in tenant onboarding | DNS step exists, routing TBD |
| Scoped developer API keys | Referenced in landing page | Key generation exists, API not mounted |

---

## Test Coverage

| Test file | Scope |
|-----------|-------|
| `kortex-api.test.js` | Core CRUD, redirect, tenant scoping |
| `kortex-campaigns.test.js` | Campaign lifecycle, members, links |
| `kortex-campaign-resolver.test.js` | Campaign namespace resolution |
| `kortex-hardening.test.js` | Security, validation, edge cases |

---

## Firestore Collections (Kortex)

| Collection | Purpose |
|------------|---------|
| `smartlinks` | Link documents (all tenants) |
| `smartLinkClicks` | Click event log |
| `tenants` | Tenant configuration |
| `subscriptions` | Stripe subscription state |
| `rate_limits` | Rate limit counters |
| `kortex_events` | V2 tenant event log |
| `campaigns` | Campaign documents |
| `campaign_links` | Campaign-link associations |
| `campaign_members` | Campaign membership |
