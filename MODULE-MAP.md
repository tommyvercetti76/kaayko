# Module Map — Kaayko

**How to use:** When given a task, identify the module, then read only the files listed for that module.
**Cross-project:** CoolSchools module map → `/Users/Rohan/coolschools-web/MODULE-MAP.md`

---

## Infrastructure

| Thing | Value |
|-------|-------|
| Frontend | Static HTML + vanilla JS (`kaayko/src/`) |
| React app | Vite + React (`kaayko/kutz/src/`) — Kutz only |
| Backend | Firebase Cloud Functions — Express.js (`kaayko-api/functions/api/`) |
| Hosting | Firebase Hosting — `/api/**`, `/l/**`, `/resolve`, `/health` → Cloud Function `api`; `/a/**` and `/login` → KORTEX tenant shell |
| Database | Firestore |
| Auth | Firebase Auth (Google OAuth, email/password) |
| Storage | Firebase Cloud Storage |

**Key shared files:**
- `kaayko/src/js/services/apiClient.js` — base API client (fetch wrapper with caching + fallback)
- `kaayko/src/js/kaayko_apiClient.js` — store/product API client (separate from apiClient.js)
- `kaayko/src/js/header.js` — shared header component (used across all pages)
- `kaayko/src/js/main.js` — main bootstrap
- `kaayko/src/js/kaayko-main.js` — main app init
- `kaayko-api/functions/api/index.js` — Express app root
- `kaayko/firebase.json` — hosting rewrites (all `/api/**` → function)

⚠️ **Note:** There are 3 separate API clients (`apiClient.js`, `kaayko_apiClient.js`, `kreator-api.js`) with inconsistent error handling patterns.

---

## ⚠️ Security Notes

**MEDIUM:**
1. Fitbit OAuth (`/api/kutz/fitbit/initiate` → `/callback`) — no CSRF state validation visible
2. `cameras` vs `Kameras` Firestore collection name inconsistency in karma module — verify actual Firestore name before querying
3. `short_links` (actual Firestore name in code) vs `smartlinks` (old docs) — always use `short_links`

**Notes on previously flagged items (resolved/non-issues):**
- `testRoutes.js` — gated by `FUNCTIONS_EMULATOR === 'true'` both at mount (`kreatorRoutes.js:53`) and inside each handler; not live in production
- Magic link expiry — already implemented in `kreatorService.js`; `expiresAt` is stored and checked on every validation
- `tooltip-test.html` — deleted
- `reset-environment.html` — only sets visitor's own `localStorage` to `'production'`; no cross-user effect

---

## Module: `core`
> Paddle forecast app + static marketing pages.

**Pages:**
| URL | File |
|-----|------|
| `/` | `kaayko/src/index.html` (split Kaayko landing: Karma / Store, then Paddle Out / Alumni OS) |
| `/paddlingout` | `kaayko/src/paddlingout.html` |
| `/about` | `kaayko/src/about.html` |
| `/reads` | `kaayko/src/reads.html` |
| `/testimonials` | `kaayko/src/testimonials.html` |
| `/privacy` | `kaayko/src/privacy.html` |
| `/valentine` | `kaayko/src/valentine.html` (seasonal campaign) |
| `/redirect` | `kaayko/src/redirect.html` (spinner UI for smart link flow) |
| `/404` | `kaayko/src/404.html` |

**JS files (paddlingout):**
- `kaayko/src/js/paddlingout.js` — main logic, card rendering, carousel
- `kaayko/src/js/services/apiClient.js` — fetch wrapper with fallback generation + caching
- `kaayko/src/js/components/RatingHero.js` — paddle score display
- `kaayko/src/js/components/WeatherStats.js` — weather data
- `kaayko/src/js/components/SafetyWarnings.js` — safety alerts
- `kaayko/src/js/customLocation.js` — custom location search
- `kaayko/src/js/advancedModal.js` — spot detail modal

**APIs used:**
```
GET  /api/paddlingOut                          → all paddle spots with ML scores + weather
GET  /api/paddlingOut/{id}                    → single spot detail
GET  /api/paddleScore?location={lat},{lon}    → ML score for custom location
GET  /api/fastForecast?location=...           → cached weather (free)
GET  /api/forecast?location=...               → premium on-demand weather
GET  /api/nearbyWater?lat=&lon=               → find nearby lakes/rivers
GET  /api/valentine                            → valentine campaign data
GET  /api/health                               → API health check
GET  /api/docs                                 → API spec (spec.yaml / spec.json)
```

**API files (all under `kaayko-api/functions/api/weather/`):**
- `kaayko-api/functions/api/weather/paddlingout.js` — paddle spots route
- `kaayko-api/functions/api/weather/paddleScore.js` — ML scoring model
- `kaayko-api/functions/api/weather/fastForecast.js` — cached weather
- `kaayko-api/functions/api/weather/forecast.js` — premium on-demand
- `kaayko-api/functions/api/weather/nearbyWater.js` — nearby water search
- `kaayko-api/functions/api/core/` — health check, docs endpoints

**Firestore collections:** `paddlingSpots`, `forecast_cache`, `current_conditions_cache`
**External services:** Open-Meteo API (free, no auth), Marine API
**Auth required:** No

---

## Module: `store`
> E-commerce: product catalog, voting, cart, Stripe checkout.

**Pages:**
| URL | File |
|-----|------|
| `/store` | `kaayko/src/store.html` |
| `/cart` | `kaayko/src/cart.html` |
| `/order-success` | `kaayko/src/order-success.html` |

**JS files:**
- `kaayko/src/js/kaayko_apiClient.js` — product API client (getAllProducts, getProductByID, voteOnProduct)
- `kaayko/src/js/secretStore.js` — voting system
- `kaayko/src/js/kaaykoFilterModal.js` — filter/search UI
- `kaayko/src/js/cartManager.js` — cart (localStorage)

**APIs used:**
```
# Products
GET  /api/products                     → all products
GET  /api/products/{id}               → single product
POST /api/products/{id}/vote          → vote  body: { voteChange: 1 | -1 }
GET  /api/images                       → product images from Storage

# Checkout
POST /api/createPaymentIntent          → create Stripe payment intent
     body: { items, totalAmount, customerEmail, shippingAddress,
             customerName, customerPhone, dataRetentionConsent }
POST /api/createPaymentIntent/updateEmail  → update email on intent
POST /api/createPaymentIntent/webhook  → Stripe webhook (no auth, raw body)
```

**API files:**
- `kaayko-api/functions/api/products.js`
- `kaayko-api/functions/api/checkout.js`

**Firestore collections:** `kaaykoproducts`, `orders`, `payment_intents`
**Firebase Storage:** `kaaykoStoreTShirtImages/{productID}/`
**External services:** Stripe
**Auth required:** No (browsing + checkout); admin order ops require auth

---

## Module: `kortex`
> Multi-tenant smart link manager, tenant alias router, campaign links, and admin portal.

Canonical architecture doc: `kaayko/docs/products/KORTEX_TENANT_ARCHITECTURE_PLAN.md`
Delivery plan and DoD: `kaayko/docs/products/KORTEX_DELIVERY_PLAN_AND_DOD.md`

**Pages:**
| URL | File |
|-----|------|
| `/kortex` | `kaayko/src/admin/kortex.html` |
| `/login` | `kaayko/src/tenant.html` |
| `/a/:code` | `kaayko/src/tenant.html` |
| `/a/:tenantSlug/admin` | `kaayko/src/tenant.html` |
| `/a/:tenantSlug/register` | `kaayko/src/tenant.html` |
| `/a/:tenantSlug/campaigns/:campaignSlug` | `kaayko/src/tenant.html` |
| `/admin/login` | `kaayko/src/admin/login.html` (→ /kortex) |
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
| ~~`/admin/reset-environment`~~ | `kaayko/src/admin/reset-environment.html` ⚠️ NO AUTH |
| ~~`/admin/views/create-link/tooltip-test`~~ | `kaayko/src/admin/views/create-link/tooltip-test.html` ⚠️ test artifact |

**APIs used:**
```
# KORTEX — canonical
GET    /api/kortex/health
GET    /api/kortex/tenants/resolve
GET    /api/kortex/tenants/:tenantSlug/bootstrap
GET    /api/kortex/links/:code/resolve
POST   /api/kortex/events
POST   /api/kortex/tenant-links
GET    /api/kortex/tenants/:tenantId/analytics
POST   /api/kortex/tenant-registration
POST   /api/kortex
GET    /api/kortex
GET    /api/kortex/:code
PUT    /api/kortex/:code
DELETE /api/kortex/:code
GET    /api/kortex/r/:code

# KORTEX compatibility
/api/smartlinks/* → same router as /api/kortex/*

# Campaigns
GET/POST/PUT/DELETE /api/campaigns...
GET    /:campaignSlug/:code                  → public campaign namespace resolver

# Public short links
GET    /l/:id                                → universal short link redirect

# Admin orders
GET  /api/admin/getOrder?id={id}
GET  /api/admin/listOrders
POST /api/admin/updateOrderStatus   body: { orderId, status, notes }

# Billing
GET/POST/PUT/DELETE /api/billing/subscriptions
```

**API files:**
- `kaayko-api/functions/api/kortex/smartLinks.js` — canonical KORTEX router
- `kaayko-api/functions/api/kortex/v2LinkIntents.js` — tenant aliases, destination types, event ledger, tenant bootstrap
- `kaayko-api/functions/api/kortex/smartLinkService.js` — short link CRUD and V2 field storage
- `kaayko-api/functions/api/kortex/redirectHandler.js` — device-aware and intent-aware redirect logic
- `kaayko-api/functions/api/kortex/clickTracking.js` — click event recording
- `kaayko-api/functions/api/campaigns/*` — campaign management and public namespace resolver
- `kaayko-api/functions/api/deepLinks/deeplinkRoutes.js` — `/l/:id` and legacy universal link handling
- `kaayko-api/functions/api/admin/` — order management
- `kaayko-api/functions/api/billing/` — subscriptions

**Smart link data shape:**
```js
{
  code,
  publicCode,
  shortUrl,
  tenantId,
  campaignId,
  destinationType,
  requiresAuth,
  audience,
  source,
  intent,
  conversionGoal,
  destinations: { web, ios, android },
  metadata,
  utm,
  clickCount,
  enabled
}
```

**Firestore collections:**
- `short_links` — smart link definitions (⚠️ actual name in code; old docs say `smartlinks`)
- `link_analytics` — analytics events
- `click_events` — click records
- `install_events` — app install tracking
- `custom_events` — custom event logging
- `webhook_subscriptions` — webhook config
- `webhook_deliveries` — delivery log
- `pending_tenant_registrations` — tenant signup queue
- `kortex_events` — V2 event ledger for tenant links, registration, campaigns, and philanthropy
- `admin_users` — admin profiles (shared with kreator module)
- `admin_audit_logs` — admin activity log
- `orders` — e-commerce orders
- `subscriptions` — billing

**External services:** None
**Auth required:** Admin ops: Firebase `admin` custom claim. Public API: `requireApiKey(['create:links'])`. Redirect + click: public.

---

## Module: `kreator`
> Influencer/creator program — application, onboarding, dashboard.

**Pages:**
| URL | File |
|-----|------|
| `/kreator` | `kaayko/src/kreator/index.html` |
| `/kreator/kreator-login` | `kaayko/src/kreator/kreator-login.html` |
| `/kreator/apply` | `kaayko/src/kreator/apply.html` |
| `/kreator/check-status` | `kaayko/src/kreator/check-status.html` |
| `/kreator/onboarding` | `kaayko/src/kreator/onboarding.html` |
| `/kreator/dashboard` | `kaayko/src/kreator/dashboard.html` |
| `/kreator/add-product` | `kaayko/src/kreator/add-product.html` |
| `/kreator/forgot-password` | `kaayko/src/kreator/forgot-password.html` |
| `/kreator/admin` | `kaayko/src/kreator/admin/index.html` |
| ~~`/kreator/apply-old-social`~~ | `kaayko/src/kreator/apply-old-social.html` (legacy) |
| ~~`/kreator/dashboard-old-influencer`~~ | `kaayko/src/kreator/dashboard-old-influencer.html` (legacy) |

**APIs used:**
```
# Public (rate: 5/hr/IP for apply, 10/min for status)
POST /api/kreators/apply                           → submit application
GET  /api/kreators/applications/{id}              → check application status
POST /api/kreators/auth/google/signin             → Google OAuth signin
GET  /api/kreators/health

# Magic link onboarding (rate: 20/min)
POST /api/kreators/onboarding/verify              → verify magic link token
POST /api/kreators/onboarding/complete            → set password, activate account

# Authenticated kreator
GET  /api/kreators/me                             → get own profile
PUT  /api/kreators/me                             → update bio, links, stats
POST /api/kreators/auth/google/connect            → link Google account
POST /api/kreators/auth/google/disconnect         → unlink Google
GET  /api/kreators/debug                          → debug (optionalKreatorAuth)

# Admin
GET  /api/kreators/admin/applications             → list all applications
GET  /api/kreators/admin/applications/{id}        → get application
PUT  /api/kreators/admin/applications/{id}/approve
PUT  /api/kreators/admin/applications/{id}/reject
POST /api/kreators/admin/{uid}/resend-link
GET  /api/kreators/admin/list                     → list all kreators
GET  /api/kreators/admin/stats                    → overall stats
```

**API files:**
- `kaayko-api/functions/api/kreators/kreatorRoutes.js` — main routes
- `kaayko-api/functions/api/kreators/testRoutes.js` — ⚠️ CRITICAL: test routes mounted in production, NO auth

**Firestore collections:** `kreatorApplications`, `kreators`, `kreatorProducts`, `admin_users`, `admin_audit_logs`
**External services:** Google OAuth
**Auth required:** Public: apply, check-status. Magic link: onboarding. `kreator` claim: dashboard, add-product. `admin` claim: /kreator/admin

---

## Module: `kutz`
> KaleKutz — Vite React nutrition tracker SPA.

**Pages / tabs:**
| URL | File |
|-----|------|
| `/kutz` | `kaayko/kutz/src/App.jsx` |
| Today tab | `kaayko/kutz/src/App.jsx` (inline `TodayView`) |
| Week tab | `kaayko/kutz/src/components/WeekView.jsx` |
| Trends tab | `kaayko/kutz/src/components/TrendsView.jsx` |
| Settings tab | `kaayko/kutz/src/components/SettingsView.jsx` |

**APIs used:**
```
# Food parsing & suggestions (Claude AI on backend)
POST /api/kutz/parseFoods              → text → macro breakdown
     body: { text, meal, date }
POST /api/kutz/parsePhoto              → image → food items (Vision API)
     body: { base64Image, date, meal }
GET  /api/kutz/searchFoods?q=query    → search Open Food Facts (CORS proxy)
POST /api/kutz/suggest                 → meal suggestions
     body: { dateKey, preferences, constraints }
POST /api/kutz/weeklyReport            → nutrition summary
     body: { startDate, endDate, format: 'json'|'pdf' }

# Fitbit integration
GET  /api/kutz/fitbit/initiate         → get OAuth URL
GET  /api/kutz/fitbit/callback         → OAuth callback
POST /api/kutz/fitbit/sync             → sync steps/calories
GET  /api/kutz/fitbit/status           → connection status
POST /api/kutz/fitbit/disconnect       → remove authorization
```

**Direct external (client-side):**
```
GET  https://world.openfoodfacts.org/api/v0/product/{barcode}.json  → barcode lookup
```

**API files:**
- `kaayko-api/functions/api/kutz.js`

**Firestore collections (all under `users/{uid}/`):**
```
kutzProfile/data         → BMR, targets, height/weight/age, activity level
kutzDays/{YYYY-MM-DD}   → daily totals, locked state, Fitbit sync
  └─ foods/{id}          → individual food entries per day
kutzFrequentFoods/{key}  → quick-add frequent foods
kutzWeightLog/{date}     → weight entries
kutzRecipes/{id}         → user recipes with macros
kutzProductDB/{key}      → custom product/brand overrides
kutzDays/{date}/exercises/{id}  → exercise log
```

**External services:** Claude API (Anthropic), Open Food Facts, Fitbit API
**Auth required:** Yes — Firebase token (Google OAuth or email/password)

---

## Module: `karma`
> Community/school programs — photography and media education.

**Pages:**
| URL | File |
|-----|------|
| `/karma` | `kaayko/src/karma.html` |
| `/karma/kameras/**` | `kaayko/src/karma/kameras/index.html` |
| `/karma/mp3/**` | `kaayko/src/karma/mp3/index.html` |
| `/karma/schools/somalwar/**` | → Cloud Run `cool-schools` service (no local file) |

**APIs used:**
```
GET  /api/cameras                      → camera list with specs
GET  /api/cameras/{id}                → camera detail
GET  /api/lenses                       → lens list
GET  /api/lenses/{id}                 → lens detail
GET  /api/presets                      → photography presets
GET  /api/presets/{id}                → preset detail
GET  /api/presets/smart               → smart preset recommendations (EV calc)
POST /api/presets                      → create preset (auth required)
```

**API files:**
- `kaayko-api/functions/api/cameras.js`
- `kaayko-api/functions/api/lenses.js`
- `kaayko-api/functions/api/presets.js`

**Firestore collections:** `cameras` (⚠️ may be `Kameras` — casing inconsistency in code), `lenses`, `presets`
**External services:** None
**Auth required:** No (read); Firebase token (create presets)

---

## Firestore Collections Quick Reference

| Collection | Module | Description |
|------------|--------|-------------|
| `kaaykoproducts` | store | Product catalog |
| `orders` | store, kortex | Checkout orders |
| `payment_intents` | store | Stripe payment intents |
| `paddlingSpots` | core | Paddle forecast spots |
| `forecast_cache` | core | Cached weather data (TTL-based) |
| `current_conditions_cache` | core | Cached current conditions |
| `short_links` | kortex | Smart link definitions (code uses `short_links`, NOT `smartlinks`) |
| `link_analytics` | kortex | Analytics events |
| `click_events` | kortex | Click records |
| `install_events` | kortex | App install tracking |
| `custom_events` | kortex | Custom event logging |
| `webhook_subscriptions` | kortex | Webhook config |
| `webhook_deliveries` | kortex | Delivery log |
| `pending_tenant_registrations` | kortex | Tenant signup queue |
| `subscriptions` | kortex | Kortex billing |
| `kreatorApplications` | kreator | Pending applications |
| `kreators` | kreator | Active creators |
| `kreatorProducts` | kreator | Creator-submitted products |
| `admin_users` | kortex, kreator | Admin profiles (shared) |
| `admin_audit_logs` | kortex, kreator | Admin activity log (shared) |
| `users/{uid}/kutz*` | kutz | All nutrition data |
| `cameras` | karma | Camera reference (⚠️ may be `Kameras`) |
| `lenses` | karma | Lens reference |
| `presets` | karma | Photography presets |

---

## Environment Variables Quick Reference

```bash
# Firebase (client)
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET

# External APIs (server/functions)
ANTHROPIC_API_KEY        # Claude — food parsing, meal suggestions (kutz)
STRIPE_SECRET_KEY        # Stripe payments (store)
STRIPE_WEBHOOK_SECRET    # Stripe webhook verification (store)
FITBIT_CLIENT_ID         # Fitbit OAuth (kutz)
FITBIT_CLIENT_SECRET     # Fitbit OAuth (kutz)
```
