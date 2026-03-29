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
| Hosting | Firebase Hosting — all `/api/**` → Cloud Function `api` |
| Database | Firestore |
| Auth | Firebase Auth (Google OAuth, email/password) |
| Storage | Firebase Cloud Storage |

**Key shared files:**
- `kaayko/src/js/services/apiClient.js` — base API client (fetch wrapper)
- `kaayko-api/functions/api/index.js` — Express app root
- `kaayko/firebase.json` — hosting rewrites (all `/api/**` → function)

---

## Module: `core`
> Paddle forecast app + static marketing pages.

**Pages:**
| URL | File |
|-----|------|
| `/` | `kaayko/src/index.html` (redirects → /paddlingout) |
| `/paddlingout` | `kaayko/src/paddlingout.html` |
| `/about` | `kaayko/src/about.html` |
| `/reads` | `kaayko/src/reads.html` |
| `/testimonials` | `kaayko/src/testimonials.html` |
| `/privacy` | `kaayko/src/privacy.html` |

**JS files (paddlingout):**
- `kaayko/src/js/paddlingout.js` — main logic, card rendering
- `kaayko/src/js/components/RatingHero.js` — paddle score display
- `kaayko/src/js/components/WeatherStats.js` — weather data
- `kaayko/src/js/components/SafetyWarnings.js` — safety alerts
- `kaayko/src/js/customLocation.js` — location search
- `kaayko/src/js/advancedModal.js` — spot detail modal

**APIs used:**
```
GET  /api/paddlingOut                   → all paddle spots with ML scores + weather
GET  /api/paddlingOut/{id}             → single spot detail
GET  /api/paddleScore?location={lat},{lon}  → ML score for custom location
GET  /api/fastForecast?location=...    → cached weather (free)
GET  /api/forecast?location=...        → premium on-demand weather
GET  /api/nearbyWater?lat=&lon=        → find nearby lakes/rivers
```

**API files:**
- `kaayko-api/functions/api/paddlingout.js`
- `kaayko-api/functions/api/weather.js`
- `kaayko-api/functions/api/paddleScore.js` — ML model

**Firestore collections:** `paddlingSpots`
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
GET  /api/products                     → all products (reads kaaykoproducts Firestore)
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

**Firestore collections:** `kaaykoproducts`, `orders`
**Firebase Storage:** `kaaykoStoreTShirtImages/{productID}/`
**External services:** Stripe
**Auth required:** No (browsing + checkout); admin order ops require auth

---

## Module: `kortex`
> Multi-tenant smart link manager + admin portal.

**Pages:**
| URL | File |
|-----|------|
| `/kortex` | `kaayko/src/admin/kortex.html` |
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

**APIs used:**
```
# Smart links
POST   /api/smartlinks               → create link
GET    /api/smartlinks               → list links
GET    /api/smartlinks/{id}          → get link
PUT    /api/smartlinks/{id}          → update link (routing rules, A/B tests)
DELETE /api/smartlinks/{id}          → delete link
GET    /api/smartlinks/{id}/stats    → click analytics
POST   /api/smartlinks/{id}/click   → record click + redirect
GET    /api/smartlinks/redirect/{slug} → follow link (device routing)

# Admin orders
GET  /api/admin/getOrder?id={id}    → fetch order (admin auth)
GET  /api/admin/listOrders          → list all orders (admin auth)
POST /api/admin/updateOrderStatus   → update order status (admin auth)
     body: { orderId, status, notes }

# Billing
GET    /api/billing/subscriptions
POST   /api/billing/subscriptions
GET    /api/billing/subscriptions/{id}
PUT    /api/billing/subscriptions/{id}
DELETE /api/billing/subscriptions/{id}
```

**API files:**
- `kaayko-api/functions/api/smartlinks.js`
- `kaayko-api/functions/api/admin.js`
- `kaayko-api/functions/api/billing.js`

**Smart link data shape:**
```js
{
  slug, title, destination,
  routes: [{ device: 'iOS'|'Android'|'web', destination }],
  abTests: [{ variant, destination, weight }],
  webhooks: [urls],
  analytics: { totalClicks, byDevice, conversions }
}
```

**Firestore collections:** `smartlinks`, `smartLinkClicks`, `orders`, `subscriptions`
**External services:** None
**Auth required:** Yes — Firebase token with `admin` custom claim

---

## Module: `kreator`
> Influencer/creator program — application, onboarding, dashboard.

**Pages:**
| URL | File |
|-----|------|
| `/kreator` | `kaayko/src/kreator/index.html` |
| `/kreator/kreator-login` | `kaayko/src/kreator/kreator-login.html` |
| `/kreator/apply` | `kaayko/src/kreator/apply.html` |
| `/kreator/apply-old-social` | `kaayko/src/kreator/apply-old-social.html` (legacy) |
| `/kreator/check-status` | `kaayko/src/kreator/check-status.html` |
| `/kreator/onboarding` | `kaayko/src/kreator/onboarding.html` |
| `/kreator/dashboard` | `kaayko/src/kreator/dashboard.html` |
| `/kreator/dashboard-old-influencer` | `kaayko/src/kreator/dashboard-old-influencer.html` (legacy) |
| `/kreator/add-product` | `kaayko/src/kreator/add-product.html` |
| `/kreator/forgot-password` | `kaayko/src/kreator/forgot-password.html` |
| `/kreator/admin` | `kaayko/src/kreator/admin/index.html` |

**APIs used:**
```
# Public (no auth)
POST /api/kreators/apply                           → submit application
     body: { name, email, bio, socialLinks, reason }
GET  /api/kreators/applications/{id}              → check application status

# Onboarding (magic link)
POST /api/kreators/onboarding/verify              → verify magic link token
POST /api/kreators/onboarding/complete            → set password, activate account

# Authenticated kreator
GET  /api/kreators/me                             → get own profile
PUT  /api/kreators/me                             → update bio, links, stats
POST /api/kreators/auth/google/connect            → link Google account
POST /api/kreators/auth/google/disconnect         → unlink Google

# Admin
GET  /api/kreators/admin/applications             → list all applications
GET  /api/kreators/admin/applications/{id}        → get application
PUT  /api/kreators/admin/applications/{id}/approve
PUT  /api/kreators/admin/applications/{id}/reject
GET  /api/kreators/admin/list                     → list all kreators
GET  /api/kreators/admin/stats                    → overall stats
```

**API files:**
- `kaayko-api/functions/api/kreators.js`

**Firestore collections:** `kreatorApplications`, `kreators`, `kreatorProducts`
**External services:** Google OAuth
**Auth required:** Public: apply, check-status. Kreator token: dashboard, add-product. Admin: /kreator/admin

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

**Firestore collections:** `cameras`, `lenses`, `presets`
**External services:** None
**Auth required:** No (read); Firebase token (create presets)

---

## Firestore Collections Quick Reference

| Collection | Module | Description |
|------------|--------|-------------|
| `kaaykoproducts` | store | Product catalog |
| `orders` | store, kortex | Checkout orders |
| `paddlingSpots` | core | Paddle forecast spots |
| `smartlinks` | kortex | Smart link definitions |
| `smartLinkClicks` | kortex | Click event log |
| `subscriptions` | kortex | Kortex billing |
| `kreatorApplications` | kreator | Pending applications |
| `kreators` | kreator | Active creators |
| `kreatorProducts` | kreator | Creator-submitted products |
| `users/{uid}/kutz*` | kutz | All nutrition data |
| `cameras` | karma | Camera reference |
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
ANTHROPIC_API_KEY        # Claude — food parsing, meal suggestions
STRIPE_SECRET_KEY        # Stripe payments
STRIPE_WEBHOOK_SECRET    # Stripe webhook verification
FITBIT_CLIENT_ID
FITBIT_CLIENT_SECRET
```
