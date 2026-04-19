# Kaayko Feature Knowledge Graph

> Auto-generated context for local model consumption.
> Rebuild: `./automation/kaayko knowledge build`
> Generated: 2026-04-18T19:57:39.262Z

## Portfolio Overview

Kaayko is a static Firebase-hosted frontend portfolio with multiple product lines sharing browser JavaScript, HTML pages, and backend routes mounted from kaayko-api. Safe agent work must preserve live route behavior, avoid inventing backend contracts, and prefer small, context-aware improvements over generic refactors.

## Architecture

- **Frontend:** Static Firebase-hosted HTML pages with vanilla JavaScript
- **Backend:** Express API mounted on Firebase Cloud Functions
- **Hosting:** Firebase Hosting with static file serving
- **Database:** Firestore document database
- **Auth:** Firebase Auth with custom tenant isolation

## Conventions

- Static HTML pages — no frontend build system or bundler
- Shared JS in src/js/ is loaded via <script> tags, not ES module imports
- Backend routes are mounted in functions/index.js
- All persistent state lives in Firestore collections
- Assets served from src/ via Firebase Hosting
- No frontend test runner — quality gates use backend tests and static analysis
- Tenant isolation is enforced in backend middleware, not frontend
- Product-specific CSS lives alongside product HTML pages
- Window exports (window.X = ...) are the public API for shared JS modules
- API client in kaayko_apiClient.js is the single entry point for all backend calls

## Products

### Shared Frontend Craft

**Purpose:** Own shared frontend quality, reuse, consistency, and debt reduction without destabilizing live product logic.
**Keywords:** frontend, shared, duplication, drift, refactor, ui, header, styles

**Entry points:**
  - paddlingout: `kaayko:src/paddlingout.html`
  - store: `kaayko:src/store.html`
  - kortex: `kaayko:src/kortex.html`
  - karma: `kaayko:src/karma.html`

**Features:**
  - **clear cache** (`kaayko:src/admin/clear-cache.html`)
  - **kortex** (`kaayko:src/admin/kortex.html`) → kortex-core.js
  - **login** (`kaayko:src/admin/login.html`)
  - **reset environment** (`kaayko:src/admin/reset-environment.html`)
  - **tenant registration** (`kaayko:src/admin/tenant-registration.html`)
  - **all links** (`kaayko:src/admin/views/all-links/all-links.html`) → all-links.js
  - **analytics** (`kaayko:src/admin/views/analytics/analytics.html`) → analytics.js
  - **billing** (`kaayko:src/admin/views/billing/billing.html`) → billing.js
  - **create link** (`kaayko:src/admin/views/create-link/create-link.html`) → create-link.js
  - **dashboard** (`kaayko:src/admin/views/dashboard/dashboard.html`) → dashboard.js
  - **qr codes** (`kaayko:src/admin/views/qr-codes/qr-codes.html`) → qr-codes.js
  - **tenant onboarding** (`kaayko:src/admin/views/tenant-onboarding/tenant-onboarding.html`) → tenant-onboarding.js
  - **add product** (`kaayko:src/kreator/add-product.html`)
  - **index** (`kaayko:src/kreator/admin/index.html`)
  - **apply old social** (`kaayko:src/kreator/apply-old-social.html`)
  - **apply** (`kaayko:src/kreator/apply.html`)
  - **check status** (`kaayko:src/kreator/check-status.html`)
  - **dashboard old influencer** (`kaayko:src/kreator/dashboard-old-influencer.html`) → dashboard.js
  - **dashboard** (`kaayko:src/kreator/dashboard.html`) → dashboard.js
  - **forgot password** (`kaayko:src/kreator/forgot-password.html`)
  - **index** (`kaayko:src/kreator/index.html`)
  - **kreator login** (`kaayko:src/kreator/kreator-login.html`)
  - **onboarding** (`kaayko:src/kreator/onboarding.html`) → tenant-onboarding.js
  - **paddlingout** (`kaayko:src/paddlingout.html`) → paddlingout.js
  - **store** (`kaayko:src/store.html`) → secretStore.js
  - **kortex** (`kaayko:src/kortex.html`) → kortex-core.js
  - **karma** (`kaayko:src/karma.html`)

**Backend routes:**
  - /api/**
  - /l/**
  - /resolve
  - /health

**Critical files:**
  - `kaayko:src/js/about-dynamic.js`
  - `kaayko:src/js/advancedModal.js`
  - `kaayko:src/js/cartManager.js`
  - `kaayko:src/js/components/Heatmap.js`
  - `kaayko:src/js/components/RatingHero.js`
  - `kaayko:src/js/components/SafetyWarnings.js`
  - `kaayko:src/js/header.js`
  - `kaayko:src/js/kaayko-main.js`
  - `kaayko:src/js/kaaykoFilterModal.js`
  - `kaayko:src/js/kaayko_apiClient.js`
  - `kaayko:src/js/kaayko_ui.js`
  - `kaayko:src/js/main.js`

**Validation focus:**
  - Preserve existing route behavior and page entrypoints.
  - Do not invent a build system or new packaging assumptions.
  - Prefer extracting repeated literals or helper logic over broad rewrites.

**Risks:**
  - Hardcoded production API URLs drift across pages.
  - There is no frontend test runner in this repository.
  - Shared improvements must not erase product-specific behavior.

**Tests:**
  - Frontend static asset refs: `node scripts/check-static-asset-refs.js`
  - Backend smoke tests: `npm run test:smoke`

---

### Store / Commerce

**Purpose:** Protect the browsing, cart, checkout, and order-success funnel as one paired frontend/backend flow.
**Keywords:** store, commerce, checkout, cart, payment, stripe, product, order

**Entry points:**
  - index: `kaayko:src/index.html`
  - store: `kaayko:src/store.html`
  - cart: `kaayko:src/cart.html`
  - order-success: `kaayko:src/order-success.html`

**Features:**
  - **index** (`kaayko:src/index.html`)
  - **store** (`kaayko:src/store.html`)
  - **cart** (`kaayko:src/cart.html`) → cartManager.js
  - **order success** (`kaayko:src/order-success.html`)

**Backend routes:**
  - GET /products
  - GET /products/:id
  - POST /products/:id/vote
  - GET /images/:productId/:fileName
  - POST /createPaymentIntent
  - POST /createPaymentIntent/updateEmail

**Critical files:**
  - `kaayko:src/index.html`
  - `kaayko:src/store.html`
  - `kaayko:src/cart.html`
  - `kaayko:src/order-success.html`
  - `kaayko:src/js/kaayko_apiClient.js`
  - `kaayko:src/js/kaayko_ui.js`
  - `kaayko:src/js/cartManager.js`
  - `kaayko:src/js/main.js`
  - `kaayko:src/js/header.js`

**Validation focus:**
  - Validate product fetch, image load, cart mutation, and checkout intent as one flow.
  - Keep cart and order-success behavior aligned with Stripe redirect assumptions.
  - Treat inline scripts and shared JS clients as one contract surface.

**Risks:**
  - Commerce logic is split between page-inline scripts and shared JS files.
  - Checkout does not have a browser test suite in this repo.
  - Do not break image or payment-intent routes while deduplicating client code.

**Tests:**
  - Frontend static asset refs: `node scripts/check-static-asset-refs.js`
  - Store API tests: `npm run test:store`

---

### Paddling Out

**Purpose:** Maintain the weather-first experience for spot browsing, current conditions, forecast modal flows, and custom location discovery.
**Keywords:** paddling, paddle, forecast, weather, spot, surf, safety, heatmap

**Entry points:**
  - paddlingout: `kaayko:src/paddlingout.html`

**Features:**
  - **paddlingout** (`kaayko:src/paddlingout.html`) → paddlingout.js

**Backend routes:**
  - GET /paddlingOut
  - GET /paddlingOut/:id
  - GET /paddleScore
  - GET /fastForecast
  - GET /forecast
  - GET /nearbyWater

**Critical files:**
  - `kaayko:src/paddlingout.html`
  - `kaayko:src/js/paddlingout.js`
  - `kaayko:src/js/about-dynamic.js`
  - `kaayko:src/js/advancedModal.js`
  - `kaayko:src/js/components/SafetyWarnings.js`
  - `kaayko:src/js/components/Heatmap.js`
  - `kaayko:src/js/components/RatingHero.js`

**Validation focus:**
  - Verify spot list, spot detail, score rendering, forecast modal, and custom-location search together.
  - Preserve production versus emulator mode selection behavior.
  - Maintain weather component rendering for real backend response shapes.

**Risks:**
  - Weather logic mixes shared and page-specific fetch paths.
  - Forecast and safety components are visually rich and easy to break with broad rewrites.
  - Reliability matters as much as correctness for this product.

**Tests:**
  - Frontend static asset refs: `node scripts/check-static-asset-refs.js`
  - Paddling Out weather tests: `node ./node_modules/jest/bin/jest.js --runInBand __tests__/weather-paddle-score.test.js --forceExit --detectOpenHandles`

---

### KORTEX Platform

**Purpose:** Protect smart-link creation, admin workflows, redirect handling, analytics, QR flows, and billing visibility as a single platform surface.
**Keywords:** kortex, smartlink, redirect, analytics, billing, tenant, auth, qr, admin

**Entry points:**
  - kortex: `kaayko:src/admin/kortex.html`
  - create-kortex-link: `kaayko:src/create-kortex-link.html`
  - redirect: `kaayko:src/redirect.html`
  - login: `kaayko:src/admin/login.html`
  - tenant-registration: `kaayko:src/admin/tenant-registration.html`

**Features:**
  - **kortex** (`kaayko:src/kortex.html`) → kortex-core.js
  - **create kortex link** (`kaayko:src/create-kortex-link.html`)
  - **redirect** (`kaayko:src/redirect.html`)
  - **kortex** (`kaayko:src/admin/kortex.html`) → kortex-core.js
  - **login** (`kaayko:src/admin/login.html`)
  - **tenant registration** (`kaayko:src/admin/tenant-registration.html`)
  - **all links** (`kaayko:src/admin/views/all-links/all-links.html`) → all-links.js
  - **analytics** (`kaayko:src/admin/views/analytics/analytics.html`) → analytics.js
  - **billing** (`kaayko:src/admin/views/billing/billing.html`) → billing.js
  - **create link** (`kaayko:src/admin/views/create-link/create-link.html`) → create-link.js
  - **dashboard** (`kaayko:src/admin/views/dashboard/dashboard.html`) → dashboard.js
  - **qr codes** (`kaayko:src/admin/views/qr-codes/qr-codes.html`) → qr-codes.js
  - **tenant onboarding** (`kaayko:src/admin/views/tenant-onboarding/tenant-onboarding.html`) → tenant-onboarding.js

**Backend routes:**
  - /smartlinks/*
  - /auth/*
  - /billing/*
  - /l/:id
  - /resolve

**Critical files:**
  - `kaayko:src/kortex.html`
  - `kaayko:src/create-kortex-link.html`
  - `kaayko:src/redirect.html`
  - `kaayko:src/admin/kortex.html`
  - `kaayko:src/admin/login.html`
  - `kaayko:src/admin/tenant-registration.html`
  - `kaayko:src/admin/js/config.js`
  - `kaayko:src/admin/js/kortex-core.js`
  - `kaayko:src/admin/js/ui.js`
  - `kaayko:src/admin/js/utils.js`
  - `kaayko:src/admin/views/all-links/all-links.html`
  - `kaayko:src/admin/views/all-links/all-links.js`

**Validation focus:**
  - Validate login, tenant discovery, link CRUD, redirect behavior, analytics visibility, and billing screen availability together.
  - Keep public KORTEX pages separate from admin-only workflows.
  - Treat old markdown references to unmounted paths as history, not live contract.

**Risks:**
  - KORTEX is the highest-risk surface for tenant isolation and auth drift.
  - Admin config/auth code is separate from public pages.
  - Redirect and billing behavior must remain correct while refactoring UI logic.

**Tests:**
  - Frontend static asset refs: `node scripts/check-static-asset-refs.js`
  - KORTEX API tests: `npm run test:kortex`

---

### Kreator

**Purpose:** Maintain creator application, onboarding, login, dashboard, and admin review flows without assuming unmounted backend product APIs are live.
**Keywords:** kreator, creator, onboarding, dashboard, apply, application, review

**Entry points:**
  - index: `kaayko:src/kreator/index.html`
  - apply: `kaayko:src/kreator/apply.html`
  - check-status: `kaayko:src/kreator/check-status.html`
  - onboarding: `kaayko:src/kreator/onboarding.html`
  - kreator-login: `kaayko:src/kreator/kreator-login.html`
  - dashboard: `kaayko:src/kreator/dashboard.html`
  - add-product: `kaayko:src/kreator/add-product.html`

**Features:**
  - **index** (`kaayko:src/kreator/index.html`)
  - **apply** (`kaayko:src/kreator/apply.html`)
  - **check status** (`kaayko:src/kreator/check-status.html`)
  - **onboarding** (`kaayko:src/kreator/onboarding.html`)
  - **kreator login** (`kaayko:src/kreator/kreator-login.html`)
  - **dashboard** (`kaayko:src/kreator/dashboard.html`)
  - **add product** (`kaayko:src/kreator/add-product.html`)
  - **index** (`kaayko:src/kreator/admin/index.html`)

**Backend routes:**
  - /kreators/apply
  - /kreators/applications/:id/status
  - /kreators/onboarding/verify
  - /kreators/onboarding/complete
  - /kreators/auth/google/*
  - /kreators/me
  - /kreators/admin/*
  - /kreators/products

**Critical files:**
  - `kaayko:src/kreator/index.html`
  - `kaayko:src/kreator/apply.html`
  - `kaayko:src/kreator/check-status.html`
  - `kaayko:src/kreator/onboarding.html`
  - `kaayko:src/kreator/kreator-login.html`
  - `kaayko:src/kreator/dashboard.html`
  - `kaayko:src/kreator/add-product.html`
  - `kaayko:src/kreator/admin/index.html`
  - `kaayko:src/kreator/js/kreator-api.js`

**Validation focus:**
  - Treat dashboard/account flows separately from product-management flows.
  - Flag `/kreators/products` as a likely contract mismatch unless the backend mount is confirmed.
  - Protect onboarding friction and account-state messaging.

**Risks:**
  - The product-management UI is ahead of the deployed backend contract on `main`.
  - Store and Kreator share the monetization funnel.
  - Do not present unmounted backend routes as stable product behavior.

**Tests:**
  - Frontend static asset refs: `node scripts/check-static-asset-refs.js`
  - Kreator API tests: `npm run test:kreator`

---

### Kamera Quest

**Purpose:** Keep camera selection, preset generation, and skill-level-aware rendering aligned with the structured backend output.
**Keywords:** kamera, camera, preset, lens, brand, model, skill

**Entry points:**
  - karma: `kaayko:src/karma.html`

**Features:**
  - **karma** (`kaayko:src/karma.html`)
  - **index** (`kaayko:src/karma/kameras/index.html`)

**Backend routes:**
  - GET /presets/meta
  - GET /cameras/:brand
  - GET /cameras/:brand/:modelName/lenses
  - POST /presets/classic
  - POST /presets/smart

**Critical files:**
  - `kaayko:src/karma.html`
  - `kaayko:src/karma/kameras/assets/kamera-enhancer.js`
  - `kaayko:src/karma/kameras/assets/kamera-evf.js`
  - `kaayko:src/karma/kameras/index.html`

**Validation focus:**
  - Check apprentice, enthusiast, and professional result shapes before claiming a safe UI change.
  - Preserve result rendering clarity and metadata contracts.
  - Treat this surface as contract-driven rather than purely visual.

**Risks:**
  - Frontend output depends heavily on structured backend payloads by skill level.
  - This is a good candidate for snapshots, but only if output shape remains stable.
  - Do not simplify result rendering in ways that erase skill-level nuance.

**Tests:**
  - Frontend static asset refs: `node scripts/check-static-asset-refs.js`
  - Kamera predeploy check: `npm run predeploy:check`

---

### Kutz Nutrition

**Purpose:** Maintain the React-based nutrition tracking app including food search, meal logging, barcode scanning, Fitbit integration, recipe building, and daily macro dashboards.
**Keywords:** kutz, nutrition, food, meal, fitbit, recipe, macro, barcode, voice, tracker

**Entry points:**
  - None

**Features:**
  - No features derived

**Backend routes:**
  - GET /kutz/foods/search
  - POST /kutz/meals
  - GET /kutz/meals
  - GET /kutz/fitbit/auth
  - GET /kutz/fitbit/callback
  - POST /kutz/fitbit/refresh

**Critical files:**
  - `kaayko:kutz/src/hooks/useAllDays.js`
  - `kaayko:kutz/src/hooks/useAuth.js`
  - `kaayko:kutz/src/hooks/useDay.js`
  - `kaayko:kutz/src/hooks/useFoods.js`
  - `kaayko:kutz/src/hooks/useStreak.js`
  - `kaayko:kutz/src/hooks/useVoice.js`
  - `kaayko:kutz/src/lib/calculations.js`
  - `kaayko:kutz/src/lib/claude.js`
  - `kaayko:kutz/src/lib/constants.js`
  - `kaayko:kutz/src/lib/firebase.js`
  - `kaayko:kutz/src/lib/firestore.js`
  - `kaayko:kutz/src/lib/openFoodFacts.js`

**Validation focus:**
  - Preserve React component hierarchy and context/hook patterns.
  - Keep Fitbit OAuth and food API integrations working after UI changes.
  - Treat nutrition calculation logic in lib/calculations.js as business-critical.
  - Verify barcode scanning and voice input remain functional.

**Risks:**
  - Kutz is a Vite/React app — different build system from the rest of the portfolio.
  - Food parsing and macro calculations must handle null/missing nutritional data.
  - Fitbit OAuth tokens are sensitive credentials stored in Firestore.
  - Claude AI integration in lib/claude.js must not leak API keys client-side.

**Tests:**
  - None

## Shared Modules

- **`kaayko:src/js/about-dynamic.js`** — used by shared, paddling-out
- **`kaayko:src/js/advancedModal.js`** — used by shared, paddling-out (exports: advancedModal)
- **`kaayko:src/js/cartManager.js`** — used by shared, store
- **`kaayko:src/js/components/Heatmap.js`** — used by shared, paddling-out (exports: Heatmap)
- **`kaayko:src/js/components/RatingHero.js`** — used by shared, paddling-out (exports: RatingHero)
- **`kaayko:src/js/components/SafetyWarnings.js`** — used by shared, paddling-out (exports: SafetyWarnings)
- **`kaayko:src/js/header.js`** — used by shared, store
- **`kaayko:src/js/kaayko_apiClient.js`** — used by shared, store
- **`kaayko:src/js/kaayko_ui.js`** — used by shared, store
- **`kaayko:src/js/main.js`** — used by shared, store (exports: lakeModal)
- **`kaayko:src/js/paddlingout.js`** — used by shared, paddling-out (exports: openYoutube, openLocation)
- **`kaayko:src/css/advancedModal.css`** — used by shared, paddling-out
- **`kaayko:src/css/paddlingout.css`** — used by shared, paddling-out
- **`kaayko:src/css/secretStore.css`** — used by shared, store
- **`kaayko:src/css/storestyle.css`** — used by shared, store
- **`kaayko:src/admin/js/config.js`** — used by shared, kortex
- **`kaayko:src/admin/js/kortex-core.js`** — used by shared, kortex (exports: syncToProduction)
- **`kaayko:src/admin/js/ui.js`** — used by shared, kortex
- **`kaayko:src/admin/js/utils.js`** — used by shared, kortex
- **`kaayko:src/admin/kortex.html`** — used by shared, kortex
- **`kaayko:src/admin/login.html`** — used by shared, kortex
- **`kaayko:src/admin/tenant-registration.html`** — used by shared, kortex
- **`kaayko:src/admin/views/all-links/all-links.css`** — used by shared, kortex
- **`kaayko:src/admin/views/all-links/all-links.html`** — used by shared, kortex
- **`kaayko:src/admin/views/all-links/all-links.js`** — used by shared, kortex (exports: toggleLink, editLink, copyLink, deleteLink, showQRSidebar)
- **`kaayko:src/admin/views/analytics/analytics.css`** — used by shared, kortex
- **`kaayko:src/admin/views/analytics/analytics.html`** — used by shared, kortex
- **`kaayko:src/admin/views/analytics/analytics.js`** — used by shared, kortex (exports: exportAnalyticsCSV)
- **`kaayko:src/admin/views/billing/billing.css`** — used by shared, kortex
- **`kaayko:src/admin/views/billing/billing.html`** — used by shared, kortex
- **`kaayko:src/admin/views/billing/billing.js`** — used by shared, kortex
- **`kaayko:src/admin/views/create-link/create-link.css`** — used by shared, kortex
- **`kaayko:src/admin/views/create-link/create-link.html`** — used by shared, kortex
- **`kaayko:src/admin/views/create-link/create-link.js`** — used by shared, kortex
- **`kaayko:src/admin/views/dashboard/dashboard.css`** — used by shared, kortex
- **`kaayko:src/admin/views/dashboard/dashboard.html`** — used by shared, kortex
- **`kaayko:src/admin/views/dashboard/dashboard.js`** — used by shared, kortex (exports: toggleLink, editLink, copyLink, deleteLink, showQRSidebar)
- **`kaayko:src/admin/views/qr-codes/qr-codes.css`** — used by shared, kortex
- **`kaayko:src/admin/views/qr-codes/qr-codes.html`** — used by shared, kortex
- **`kaayko:src/admin/views/qr-codes/qr-codes.js`** — used by shared, kortex (exports: showQRSidebar, closeQRSidebar, downloadQRCode, copyLink)
- **`kaayko:src/admin/views/tenant-onboarding/tenant-onboarding.css`** — used by shared, kortex
- **`kaayko:src/admin/views/tenant-onboarding/tenant-onboarding.html`** — used by shared, kortex
- **`kaayko:src/admin/views/tenant-onboarding/tenant-onboarding.js`** — used by shared, kortex
- **`kaayko:src/kreator/add-product.html`** — used by shared, kreator
- **`kaayko:src/kreator/admin/index.html`** — used by shared, kreator
- **`kaayko:src/kreator/apply.html`** — used by shared, kreator
- **`kaayko:src/kreator/check-status.html`** — used by shared, kreator
- **`kaayko:src/kreator/dashboard.html`** — used by shared, kreator
- **`kaayko:src/kreator/index.html`** — used by shared, kreator
- **`kaayko:src/kreator/js/kreator-api.js`** — used by shared, kreator
- **`kaayko:src/kreator/kreator-login.html`** — used by shared, kreator
- **`kaayko:src/kreator/onboarding.html`** — used by shared, kreator
- **`kaayko:src/paddlingout.html`** — used by shared, paddling-out
- **`kaayko:src/store.html`** — used by shared, store
- **`kaayko:src/kortex.html`** — used by shared, kortex
- **`kaayko:src/karma.html`** — used by shared, kamera-quest

## Route Index

- `/api/**` → Shared Frontend Craft
- `/l/**` → Shared Frontend Craft
- `/resolve` → KORTEX Platform
- `/health` → Shared Frontend Craft
- `GET /products` → Store / Commerce
- `GET /products/:id` → Store / Commerce
- `POST /products/:id/vote` → Store / Commerce
- `GET /images/:productId/:fileName` → Store / Commerce
- `POST /createPaymentIntent` → Store / Commerce
- `POST /createPaymentIntent/updateEmail` → Store / Commerce
- `GET /paddlingOut` → Paddling Out
- `GET /paddlingOut/:id` → Paddling Out
- `GET /paddleScore` → Paddling Out
- `GET /fastForecast` → Paddling Out
- `GET /forecast` → Paddling Out
- `GET /nearbyWater` → Paddling Out
- `/smartlinks/*` → KORTEX Platform
- `/auth/*` → KORTEX Platform
- `/billing/*` → KORTEX Platform
- `/l/:id` → KORTEX Platform
- `/kreators/apply` → Kreator
- `/kreators/applications/:id/status` → Kreator
- `/kreators/onboarding/verify` → Kreator
- `/kreators/onboarding/complete` → Kreator
- `/kreators/auth/google/*` → Kreator
- `/kreators/me` → Kreator
- `/kreators/admin/*` → Kreator
- `/kreators/products` → Kreator
- `GET /presets/meta` → Kamera Quest
- `GET /cameras/:brand` → Kamera Quest
- `GET /cameras/:brand/:modelName/lenses` → Kamera Quest
- `POST /presets/classic` → Kamera Quest
- `POST /presets/smart` → Kamera Quest
- `GET /kutz/foods/search` → Kutz Nutrition
- `POST /kutz/meals` → Kutz Nutrition
- `GET /kutz/meals` → Kutz Nutrition
- `GET /kutz/fitbit/auth` → Kutz Nutrition
- `GET /kutz/fitbit/callback` → Kutz Nutrition
- `POST /kutz/fitbit/refresh` → Kutz Nutrition

## Statistics

- Total indexed files: 169
- Shared modules: 56
- Products: 7
- Routes: 39
