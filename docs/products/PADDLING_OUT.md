# Paddling Out Frontend Product Map

Last reviewed: 2026-09-05

Paddling Out is the public paddle-conditions experience on `kaayko.com/paddlingout`.

## Current Entrypoints

| Route | Source | Role |
|---|---|---|
| `/paddlingout` | `src/paddlingout.html`, `src/js/paddlingout.js` | Main public lake directory. |
| `/paddlingout/forecast?id=<spotId>` | `src/paddlingout/forecast.html` | Primary score and forecast page. |
| `/paddlingout/search` | `src/paddlingout/search.html`, `src/js/searchPage.js` | Nearby water search by text, saved area, or GPS. |
| `/paddlingout/submitentry` | `src/paddlingout/submitentry.html` | "Add your own lake" community submission form. |
| `/paddlingout/rate?id=<spotId>` | `src/paddlingout/rate.html` | Public rating form for actual paddle feedback. |
| `/paddlingout/trainer` | `src/paddlingout/trainer/index.html` | React trainer/tourist bundle; backend coverage is partial. |
| `/paddlingout/settings` | `src/paddlingout/settings.html` | Device-local preferences. |

## Backend APIs Consumed

- `GET /api/paddlingOut`
- `GET /api/paddlingOut/:id`
- `GET /api/paddlingOut/geocode`
- `POST /api/paddlingOut/submitEntry`
- `GET /api/nearbyWater`
- `GET /api/paddleScore`
- `POST /api/paddleScore/batch`
- `POST /api/paddleScore/publicRating`
- `GET /api/fastForecast`
- `GET /api/paddle-trainer/tourist-lakes`
- `GET /api/paddle-trainer/tourist-weather`
- `POST /api/paddle-trainer/ratings`

Trainer frontend still calls additional endpoints that are not implemented in the current backend. Do not route normal public CTAs there unless those gaps are resolved.

## UX Responsibilities

- Present the lake list and public spot cards.
- Make Forecast the highest-confidence, highest-polish weather surface.
- Let users search nearby water and open a forecast for custom or covered locations.
- Let users submit new lakes honestly as an admin-reviewed flow.
- Let users rate a paddle session without signup.
- Keep settings local to the browser.

## Current Launch Blockers

See the full audit for details:

- `docs/audits/PADDLING_OUT_FULL_FEATURE_AUDIT_2026-09-05.md`

Blocking issues as of this review:

- Add Lake copy must match admin-review backend behavior.
- Search must reset `isSearching` after success/no-result/error paths.
- Public Rate must be complete and visually aligned with Forecast.
- Trainer must either get the missing APIs or stop being the public Rate destination.
- Rating APIs should stop storing raw IP and verify public spot IDs.

## Verification

Frontend smoke:

- `/paddlingout`
- `/paddlingout/forecast?id=ambazari`
- `/paddlingout/search`
- `/paddlingout/submitentry`
- `/paddlingout/rate?id=ambazari`

Backend tests:

- `cd ../kaayko-api/functions && npm run test:paddlingout`
- `cd ../kaayko-api/functions && node ./node_modules/jest/bin/jest.js --runInBand __tests__/weather-paddle-score.test.js --forceExit --detectOpenHandles`

