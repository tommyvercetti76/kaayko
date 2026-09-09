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

## Current Status And Remaining Work

See the full audit for details:

- `docs/audits/PADDLING_OUT_FULL_FEATURE_AUDIT_2026-09-05.md`

Resolved in the current working tree:

- Add Lake copy matches admin-review backend behavior.
- Search resets `isSearching` after success/no-result/error paths.
- Public Rate is the card CTA destination and uses existing API-backed endpoints.
- Public Rate keeps failed submissions visible as failures instead of fake local success.
- Rating APIs avoid raw IP storage for new labels and verify public spot IDs.
- Submit geocoding goes through the backend proxy.

Remaining:

- Run a real Add Lake smoke: submit with image, approve in Kortex, verify public/forecast, reject a second submission and verify image cleanup.
- Decide whether trainer is rebuilt behind admin auth or retired from the public product.
- Decide whether submitters with email should receive an immediate "we got it" confirmation; validation/rejection mail already exists.
- Add weather endpoint rate limits before high-volume public traffic.
- Run visual QA for Rate on mobile and desktop if the page gets a fuller aesthetic rebuild.

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
