You are working on the **Kreator module** of Kaayko (`/Users/Rohan/Kaayko_v6/kaayko`).

Kreator is the influencer/creator program — application pipeline, onboarding, and dashboard.

## Pages
| URL | File | Auth |
|-----|------|------|
| `/kreator` | `kaayko/src/kreator/index.html` | public |
| `/kreator/kreator-login` | `kaayko/src/kreator/kreator-login.html` | public |
| `/kreator/apply` | `kaayko/src/kreator/apply.html` | public |
| `/kreator/check-status` | `kaayko/src/kreator/check-status.html` | public (email lookup) |
| `/kreator/onboarding` | `kaayko/src/kreator/onboarding.html` | magic link |
| `/kreator/dashboard` | `kaayko/src/kreator/dashboard.html` | kreator token |
| `/kreator/add-product` | `kaayko/src/kreator/add-product.html` | kreator token |
| `/kreator/forgot-password` | `kaayko/src/kreator/forgot-password.html` | public |
| `/kreator/admin` | `kaayko/src/kreator/admin/index.html` | admin token |
| ~~`/kreator/apply-old-social`~~ | `kaayko/src/kreator/apply-old-social.html` | **legacy — do not edit** |
| ~~`/kreator/dashboard-old-influencer`~~ | `kaayko/src/kreator/dashboard-old-influencer.html` | **legacy — do not edit** |

## API files (actual paths)
- `kaayko-api/functions/api/kreators/kreatorRoutes.js` — main routes
- `kaayko-api/functions/api/kreators/testRoutes.js` — ⚠️ test routes mounted in production

## APIs used
```
# Public
POST /api/kreators/apply                           → submit application (rate: 5/hr/IP)
GET  /api/kreators/applications/{id}              → check status (rate: 10/min)
POST /api/kreators/auth/google/signin             → Google OAuth signin
GET  /api/kreators/health

# Magic link onboarding
POST /api/kreators/onboarding/verify              → verify magic link (rate: 20/min)
POST /api/kreators/onboarding/complete            → set password, activate

# Authenticated kreator
GET  /api/kreators/me
PUT  /api/kreators/me
POST /api/kreators/auth/google/connect
POST /api/kreators/auth/google/disconnect
GET  /api/kreators/debug                          → debug (optionalKreatorAuth)

# Admin
GET  /api/kreators/admin/applications
GET  /api/kreators/admin/applications/{id}
PUT  /api/kreators/admin/applications/{id}/approve
PUT  /api/kreators/admin/applications/{id}/reject
POST /api/kreators/admin/{uid}/resend-link
GET  /api/kreators/admin/list
GET  /api/kreators/admin/stats
```

## Firestore collections
- `kreatorApplications` — applications (status: pending/approved/rejected)
- `kreators` — active creators (uid, bio, socialLinks, commissionRate, stats)
- `kreatorProducts` — creator-submitted products
- `admin_users` — admin records (shared with Kortex)
- `admin_audit_logs` — activity log (shared with Kortex)

## Auth
- `kreator` Firebase custom claim: dashboard, add-product
- `admin` Firebase custom claim: /kreator/admin
- Magic link token (stored in `short_links` collection): onboarding

## Notes
- `testRoutes.js` is properly gated — only mounts when `FUNCTIONS_EMULATOR === 'true'` (line 53 of kreatorRoutes.js); each handler also self-checks. Not live in production.
- Magic link expiry IS implemented in `kreatorService.js` — `MAGIC_LINK_EXPIRY_HOURS` constant, stored as `expiresAt` in `short_links`, validated on every call.
- Password strength not validated server-side on `/onboarding/complete` — only client-side.

## Task
$ARGUMENTS
