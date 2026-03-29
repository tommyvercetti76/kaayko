You are working on the **Kaayko API** — the Firebase Cloud Functions Express backend at `/Users/Rohan/Kaayko_v6/kaayko-api/`.

Read `kaayko-api/CLAUDE.md` for the full module structure before making changes.

## Entry point
`kaayko-api/functions/api/index.js` — Express app that mounts all routers.
All `/api/**` requests from Firebase Hosting route here (defined in `kaayko/firebase.json`).

## Module → file mapping
| Route prefix | File |
|-------------|------|
| `/api/products`, `/api/images` | `functions/api/products/` |
| `/api/createPaymentIntent` | `functions/api/checkout/` |
| `/api/paddlingOut`, `/api/paddleScore`, `/api/forecast`, `/api/nearbyWater` | `functions/api/weather/` |
| `/api/kutz/*` | `functions/api/kutz/` |
| `/api/smartlinks/*` | `functions/api/smartLinks/` |
| `/api/kreators/*` | `functions/api/kreators/` |
| `/api/admin/*` | `functions/api/admin/` |
| `/api/billing/*` | `functions/api/billing/` |
| `/api/cameras`, `/api/lenses`, `/api/presets` | `functions/api/cameras/` |
| `/api/auth/*` | `functions/api/auth/` |
| `/api/gptActions` | `functions/api/ai/` |

## Dev & deploy
```bash
cd kaayko-api
firebase emulators:start --only functions   # local
firebase deploy --only functions             # deploy
```

## Auth check (used in protected routes)
```js
const token = req.headers.authorization?.split('Bearer ')[1]
const decoded = await admin.auth().verifyIdToken(token)
// decoded.admin === true  → admin routes
// decoded.kreator === true → kreator routes
```

## Task
$ARGUMENTS
