You are working on the **Kutz module** of Kaayko (`/Users/Rohan/Kaayko_v6`).

Kutz (KaleKutz) is a Vite React nutrition tracker SPA — the only React app in the Kaayko project.

## Scope — React app files
```
kaayko/kutz/src/
├── App.jsx                          ← root component, TodayView (inline), tab routing
├── components/
│   ├── WeekView.jsx                 ← week overview tab
│   ├── TrendsView.jsx               ← trends & analytics tab
│   └── SettingsView.jsx             ← settings & profile tab
```

Entry: `kaayko/kutz/index.html` → `kaayko/kutz/src/main.jsx` (or similar)

## Scope — API files
- `kaayko-api/functions/api/kutz.js`

## APIs used
```
# Food parsing (require Firebase auth token)
POST /api/kutz/parseFoods         → text description → macro breakdown
     body: { text, meal: 'breakfast'|'lunch'|'dinner'|'snacks', date: 'YYYY-MM-DD' }
POST /api/kutz/parsePhoto         → base64 image → food items list
     body: { base64Image, date, meal }
GET  /api/kutz/searchFoods?q=     → CORS proxy to Open Food Facts
POST /api/kutz/suggest            → meal suggestions
     body: { dateKey, preferences: [...], constraints: {...} }
POST /api/kutz/weeklyReport       → nutrition summary
     body: { startDate, endDate, format: 'json'|'pdf' }

# Fitbit integration (require Firebase auth token)
GET  /api/kutz/fitbit/initiate    → get Fitbit OAuth URL
GET  /api/kutz/fitbit/callback    → handle OAuth callback
POST /api/kutz/fitbit/sync        → pull steps + calories from Fitbit
GET  /api/kutz/fitbit/status      → check connection status
POST /api/kutz/fitbit/disconnect  → revoke Fitbit access

# Direct client-side (no proxy)
GET  https://world.openfoodfacts.org/api/v0/product/{barcode}.json  → barcode lookup
```

## Firestore schema (all under `users/{uid}/`)
```
kutzProfile/data         → { BMR, targets:{calories,protein,carbs,fat}, height, weight, age, gender, activity, autoEntries }
kutzDays/{YYYY-MM-DD}   → { totals:{calories,protein,carbs,fat,fiber}, locked, steps, fitbitCalories }
  └─ foods/{id}          → { name, quantity, calories, protein, carbs, fat, fiber, source, meal, auto, createdAt }
kutzFrequentFoods/{key}  → { name, macros, useCount, defaultQuantity }
kutzWeightLog/{date}     → { weight, date }
kutzRecipes/{id}         → { name, servings, ingredients, macrosPerServing }
kutzProductDB/{key}      → { name, macros, customBrand: true }
kutzDays/{date}/exercises/{id} → { type, durationMin, caloriesBurned, notes }
```

## External services
- **Claude API (Anthropic)** — food parsing from text/photo, meal suggestions
- **Open Food Facts** — food database + barcode lookup
- **Fitbit API** — step and calorie sync
- **Firebase Auth** — Google OAuth or email/password

## Auth pattern
Firebase ID token required for all `/api/kutz/*` endpoints.
Fitbit tokens stored in Firestore at `users/{uid}/integrations/fitbit`.

## Dev commands
```bash
cd kaayko/kutz
npm run dev    # Vite dev server
npm run build  # production build
```

## Important: isolation
Kutz is the ONLY React/Vite app in Kaayko. Do not copy React patterns into other static HTML pages. Do not add a build step to any other page.

## Task
$ARGUMENTS
