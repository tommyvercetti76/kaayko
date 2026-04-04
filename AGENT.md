# Kaayko Frontend — Agent Deployment Guide

## What This Project Is

Static HTML/CSS/JS site for **kaayko.com** — the main Kaayko marketing and product site.
No build step. Files in `src/` are deployed directly.

---

## Architecture

```
kaayko.com  (and subpaths)
      │
      ▼
Firebase Hosting site: "kaaykostore"    (GCP: kaaykostore)
      │
      ├── /api/**              → Firebase Function: api  (kaaykostore)
      ├── /karma/schools/somalwar/**  → Cloud Run: cool-schools  (kaaykostore)
      ├── /karma/kameras/**    → static SPA  (karma/kameras/index.html)
      └── /**                  → static  (src/index.html fallback)
```

**Important:** `kaayko.com/karma/schools/somalwar/**` routes to the **CoolSchools frontend**
Cloud Run service (`cool-schools` in `kaaykostore`). If the CoolSchools UI changes, deploy
from `/Users/Rohan/coolschools-web` — not here.

---

## GCP Project

| Component | GCP Project | Firebase Site |
|---|---|---|
| Static hosting | `kaaykostore` | `kaaykostore` |

---

## Deploy Command — The Only Command

```bash
# From /Users/Rohan/Kaayko_v6/kaayko

bash deployment/deploy-hosting-safe.sh
```

That script:
1. Runs `node scripts/check-static-asset-refs.js` — validates all asset references exist
2. `firebase deploy --config firebase.json --only hosting` — deploys `src/` to Firebase Hosting

**No build step.** Edit files in `src/`, run the deploy script.

---

## Key Files

| File | Purpose |
|---|---|
| `src/` | All static site files — HTML, CSS, JS, assets |
| `firebase.json` | Firebase Hosting config — headers, rewrites, redirects |
| `.firebaserc` | Firebase project: `kaaykostore` |
| `deployment/deploy-hosting-safe.sh` | Canonical deploy script |
| `scripts/check-static-asset-refs.js` | Pre-deploy asset validation |

---

## firebase.json — Critical Rewrites

```json
{ "source": "/karma/schools/somalwar/**",
  "run": { "serviceId": "cool-schools", "region": "us-central1" } }
```
This proxies the CoolSchools alumni portal. **Do not remove or change this rewrite.**

```json
{ "source": "/api/**", "function": "api" }
```
Routes API calls to the kaayko Firebase Function (deployed from `kaayko-api`).

---

## Cache Headers

| Path | Cache |
|---|---|
| `/assets/**` | `public, max-age=31536000, immutable` (1 year) |
| `/karma/schools/somalwar/**` | `no-cache, no-store, must-revalidate` |
| All others | default |

---

## Redirects

| From | To | Code |
|---|---|---|
| `/admin/login` | `/kortex` | 301 |
| `/admin/login.html` | `/kortex` | 301 |

---

## When Things Go Wrong

### "Changes not showing on kaayko.com"
- Firebase Hosting CDN caches aggressively. Wait 2-3 min or use a different browser
- Check `firebase hosting:channel:list --project kaaykostore` to see live release

### "Asset ref check fails"
- `scripts/check-static-asset-refs.js` found a broken reference in HTML/JS
- Fix the broken path in `src/` before deploying

### "Somalwar alumni portal broken from kaayko.com"
- This is the CoolSchools Cloud Run service, NOT this project
- Deploy from `/Users/Rohan/coolschools-web`:
  `bash deployment/deploy-coolschools.sh frontend`

---

## What NOT to Do

- Do not run `firebase deploy` without the `--config firebase.json` flag — it may pick up the wrong config
- Do not edit the `/karma/schools/somalwar` rewrite unless coordinating a CoolSchools base-path change
- Do not add a build step — this is intentionally a static site
