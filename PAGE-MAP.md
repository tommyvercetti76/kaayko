# Page Map

Cross-project reference: every URL → its source file.
**For APIs + module groupings → read `MODULE-MAP.md` in this directory.**
Agents: identify the page here, then look up the module in MODULE-MAP.md for full context.

---

## CoolSchools — 32 Pages

**Project root:** `/Users/Rohan/coolschools-web/src/app/`
**Stack:** Next.js App Router, `[locale]` dynamic segment + `(standalone)` route group

### Standalone (4 — no locale prefix)

| URL | File |
|-----|------|
| `/` | `(standalone)/page.tsx` |
| `/onboarding` | `(standalone)/onboarding/page.tsx` |
| `/qa-dashboard` | `(standalone)/qa-dashboard/page.tsx` |
| `/spatial-showcase` | `(standalone)/spatial-showcase/page.tsx` |

### Core (5 — pattern `/:locale/...`)

| URL | File |
|-----|------|
| `/:locale` | `[locale]/page.tsx` |
| `/:locale/about` | `[locale]/about/page.tsx` |
| `/:locale/academics` | `[locale]/academics/page.tsx` |
| `/:locale/achievements` | `[locale]/achievements/page.tsx` |
| `/:locale/sports` | `[locale]/sports/page.tsx` |

### Special Programs (6)

| URL | File |
|-----|------|
| `/:locale/centenary` | `[locale]/centenary/page.tsx` |
| `/:locale/atl` | `[locale]/atl/page.tsx` |
| `/:locale/ncc` | `[locale]/ncc/page.tsx` |
| `/:locale/nasa` | `[locale]/nasa/page.tsx` |
| `/:locale/panache` | `[locale]/panache/page.tsx` |
| `/:locale/nurturing` | `[locale]/nurturing/page.tsx` |

### Branches (1 dynamic)

| URL | File |
|-----|------|
| `/:locale/branches/:slug` | `[locale]/branches/[slug]/page.tsx` |

### Alumni Portal (7)

| URL | File |
|-----|------|
| `/:locale/alumni` | `[locale]/alumni/page.tsx` |
| `/:locale/alumni/login` | `[locale]/alumni/login/page.tsx` |
| `/:locale/alumni/register` | `[locale]/alumni/register/page.tsx` |
| `/:locale/alumni/dashboard` | `[locale]/alumni/dashboard/page.tsx` |
| `/:locale/alumni/directory` | `[locale]/alumni/directory/page.tsx` |
| `/:locale/alumni/directory/:slug` | `[locale]/alumni/directory/[slug]/page.tsx` |
| `/:locale/admin/alumni` | `[locale]/admin/alumni/page.tsx` |

### Donations (3)

| URL | File |
|-----|------|
| `/:locale/alumni/donate` | `[locale]/alumni/donate/page.tsx` |
| `/:locale/alumni/donate/:need` | `[locale]/alumni/donate/[need]/page.tsx` |
| `/:locale/alumni/donate/item/:slug` | `[locale]/alumni/donate/item/[slug]/page.tsx` |

### ROOTS Assessment (6)

| URL | File |
|-----|------|
| `/:locale/roots/parent-assessment` | `[locale]/roots/parent-assessment/page.tsx` |
| `/:locale/roots/parent-assessment/:sessionId` | `[locale]/roots/parent-assessment/[sessionId]/page.tsx` |
| `/:locale/roots/parent-assessment/:sessionId/results` | `[locale]/roots/parent-assessment/[sessionId]/results/page.tsx` |
| `/:locale/roots/teacher-assessment` | `[locale]/roots/teacher-assessment/page.tsx` |
| `/:locale/roots/teacher-assessment/:sessionId` | `[locale]/roots/teacher-assessment/[sessionId]/page.tsx` |
| `/:locale/roots/teacher-assessment/:sessionId/results` | `[locale]/roots/teacher-assessment/[sessionId]/results/page.tsx` |

---

## Kaayko — ~40 Pages

**Project root:** `/Users/Rohan/Kaayko_v6/kaayko/src/`
**Stack:** Static HTML + Firebase Hosting + Vite React SPA (Kutz)

### Main Site (11)

| URL | File |
|-----|------|
| `/` | `src/index.html` (redirects → /paddlingout) |
| `/paddlingout` | `src/paddlingout.html` |
| `/about` | `src/about.html` |
| `/store` | `src/store.html` |
| `/cart` | `src/cart.html` |
| `/privacy` | `src/privacy.html` |
| `/reads` | `src/reads.html` |
| `/testimonials` | `src/testimonials.html` |
| `/valentine` | `src/valentine.html` |
| `/order-success` | `src/order-success.html` |
| `/404` | `src/404.html` |

### Kortex Admin Portal (12)

| URL | File |
|-----|------|
| `/kortex` | `src/admin/kortex.html` |
| `/admin/login` | `src/admin/login.html` (redirects → /kortex) |
| `/admin/clear-cache` | `src/admin/clear-cache.html` |
| `/admin/tenant-registration` | `src/admin/tenant-registration.html` |
| `/admin/views/dashboard` | `src/admin/views/dashboard/dashboard.html` |
| `/admin/views/create-link` | `src/admin/views/create-link/create-link.html` |
| `/admin/views/all-links` | `src/admin/views/all-links/all-links.html` |
| `/admin/views/qr-codes` | `src/admin/views/qr-codes/qr-codes.html` |
| `/admin/views/analytics` | `src/admin/views/analytics/analytics.html` |
| `/admin/views/billing` | `src/admin/views/billing/billing.html` |
| `/admin/views/tenant-onboarding` | `src/admin/views/tenant-onboarding/tenant-onboarding.html` |
| `/admin/views/roots` | `src/admin/views/roots/index.html` |

### Kreator Platform (11)

| URL | File |
|-----|------|
| `/kreator` | `src/kreator/index.html` |
| `/kreator/kreator-login` | `src/kreator/kreator-login.html` |
| `/kreator/apply` | `src/kreator/apply.html` |
| `/kreator/apply-old-social` | `src/kreator/apply-old-social.html` (legacy) |
| `/kreator/check-status` | `src/kreator/check-status.html` |
| `/kreator/onboarding` | `src/kreator/onboarding.html` |
| `/kreator/dashboard` | `src/kreator/dashboard.html` |
| `/kreator/dashboard-old-influencer` | `src/kreator/dashboard-old-influencer.html` (legacy) |
| `/kreator/add-product` | `src/kreator/add-product.html` |
| `/kreator/forgot-password` | `src/kreator/forgot-password.html` |
| `/kreator/admin` | `src/kreator/admin/index.html` |

### Karma (4)

| URL | File |
|-----|------|
| `/karma` | `src/karma.html` |
| `/karma/kameras/**` | `src/karma/kameras/index.html` |
| `/karma/mp3/**` | `src/karma/mp3/index.html` |
| `/karma/schools/somalwar/**` | Cloud Run `cool-schools` service (dynamic, no local file) |

### Kutz — Vite React SPA (1 app, 4 tabs)

| URL | File |
|-----|------|
| `/kutz` | `kutz/src/App.jsx` |
| `/kutz` → Today tab | `kutz/src/App.jsx` (inline `TodayView`) |
| `/kutz` → Week tab | `kutz/src/components/WeekView.jsx` |
| `/kutz` → Trends tab | `kutz/src/components/TrendsView.jsx` |
| `/kutz` → Settings tab | `kutz/src/components/SettingsView.jsx` |

### Misc (1)

| URL | File |
|-----|------|
| `/create-kortex-link` | `src/create-kortex-link.html` |
