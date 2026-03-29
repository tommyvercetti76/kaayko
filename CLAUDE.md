# Kaayko

Multi-product platform: paddle forecast app, e-commerce store, nutrition tracker, creator program, smart link manager.

## Stack
- **Frontend:** Static HTML + vanilla JS (`kaayko/src/`)
- **React app:** Vite + React — Kutz only (`kaayko/kutz/src/`)
- **Backend:** Firebase Cloud Functions — Express.js (`kaayko-api/functions/api/`)
- **Database:** Firestore
- **Auth:** Firebase Auth (Google OAuth, email/password)
- **Hosting:** Firebase Hosting — all `/api/**` → Cloud Function `api`
- **Payments:** Stripe

## Commands
```bash
# Frontend dev (static pages)
cd kaayko && firebase serve

# Kutz React app
cd kaayko/kutz && npm run dev

# API (Cloud Functions emulator)
cd kaayko-api && firebase emulators:start --only functions

# Deploy
firebase deploy
```

## Navigation
- **Page → file map:** `PAGE-MAP.md`
- **Module map (pages + APIs + Firestore + services):** `MODULE-MAP.md`
- **Slash commands:** `.claude/commands/` — type `/store`, `/kutz`, `/kortex`, etc.

## Architecture rules
- All `/api/**` requests are handled by the Express app at `kaayko-api/functions/api/index.js` — check `firebase.json` for routing
- Frontend pages are plain HTML with vanilla JS — do not introduce a build step for existing pages
- Kutz (`/kutz`) is the only React app — keep it isolated in `kaayko/kutz/`
- Firestore auth: custom claims `admin` (boolean) and `kreator` (boolean) control access
- Rate limiting is on product voting — don't remove it

## What NOT to do
- Do not mix Kutz React patterns into static HTML pages
- Do not create new Firestore collections without updating `MODULE-MAP.md`
- Do not expose Stripe/Anthropic/Fitbit API keys to the client
- Do not edit `kaayko/src/kreator/apply-old-social.html` or `dashboard-old-influencer.html` — these are legacy/deprecated
