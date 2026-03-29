You are working on the **Kreator module** of Kaayko (`/Users/Rohan/Kaayko_v6`).

Kreator is the influencer/creator program — application pipeline, onboarding, and dashboard.

## Scope — pages
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

## Scope — API files
- `kaayko-api/functions/api/kreators.js`

## APIs used
```
# Public (no auth)
POST /api/kreators/apply                           → submit application
     body: { name, email, bio, socialLinks, reason }
GET  /api/kreators/applications/{id}              → check status by application ID

# Magic link onboarding
POST /api/kreators/onboarding/verify              → verify magic link token
POST /api/kreators/onboarding/complete            → set password, activate account

# Authenticated kreator (kreator Firebase token)
GET  /api/kreators/me                             → own profile
PUT  /api/kreators/me                             → update (bio, social links, stats)
POST /api/kreators/auth/google/connect            → link Google account
POST /api/kreators/auth/google/disconnect         → unlink Google

# Admin (admin Firebase token)
GET  /api/kreators/admin/applications             → list all applications
GET  /api/kreators/admin/applications/{id}        → get application details
PUT  /api/kreators/admin/applications/{id}/approve
PUT  /api/kreators/admin/applications/{id}/reject
GET  /api/kreators/admin/list                     → all kreators
GET  /api/kreators/admin/stats                    → overall stats
```

## Firestore collections
- `kreatorApplications` — pending/approved/rejected applications
- `kreators` — active creator accounts (uid, bio, socialLinks, commissionRate, stats)
- `kreatorProducts` — creator-submitted products (pending review workflow)

## External services
- Google OAuth (kreator account linking)

## Auth pattern
- `kreator` Firebase custom claim required for dashboard/add-product
- `admin` Firebase custom claim required for `/kreator/admin`
- Magic link (time-limited token) for onboarding flow

## Task
$ARGUMENTS
