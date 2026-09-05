# Paddling Out Agent Guide

Last reviewed: 2026-09-05

Use this guide for Paddling Out frontend work in `kaayko`. For backend/API work, use `kaayko-api/docs/products/PADDLING_OUT.md`.

## Source Of Truth

Read these before changing Paddling Out:

- `docs/audits/PADDLING_OUT_FULL_FEATURE_AUDIT_2026-09-05.md`
- `docs/audits/CROSS_PRODUCT_USER_AND_OPERATIONS_AUDIT_2026-09-05.md`
- `docs/products/PADDLING_OUT.md`
- `docs/paddlingout/UI-UX-DESIGN-PRINCIPLES.md`

Deleted stale references:

- `docs/paddlingout/SEARCH-AUDIT.md` was superseded by the full September audit.
- `docs/paddlingout/SKILL.md` had outdated route counts and implementation advice.

## Current Product Shape

Paddling Out is a public, no-signup paddle-conditions product. It helps a user:

- browse public paddling spots;
- inspect a 3-day forecast;
- search nearby water;
- submit a new lake for admin review;
- rate an actual paddle session;
- set device-local preferences.

Live state from the September audit:

- Public list returned 17 public spots.
- All 17 public spots had a Paddle Score.
- No community submissions were public at audit time.
- Forecast and search APIs were live.
- Trainer tourist APIs were only partly implemented.

## Frontend Surfaces

| Surface | File | Purpose | Backend dependency |
|---|---|---|---|
| Directory | `src/paddlingout.html`, `src/js/paddlingout.js`, `src/js/components/PaddleCard.js` | Public lake grid, favorites-first sorting, forecast/rate/add-lake CTAs | `GET /api/paddlingOut` |
| Forecast | `src/paddlingout/forecast.html`, `src/css/forecast.css`, `src/js/services/apiClient.js` | Main lake forecast, score context, heatmap, custom coordinate support | `GET /api/paddlingOut/:id`, `GET /api/fastForecast`, `GET /api/paddleScore` |
| Search | `src/paddlingout/search.html`, `src/js/searchPage.js` | City/GPS/search-result flow for nearby water | `GET /api/paddlingOut/geocode`, `GET /api/nearbyWater`, `POST /api/paddleScore/batch` |
| Add lake | `src/paddlingout/submitentry.html` | Public community submission form | `POST /api/paddlingOut/submitEntry` |
| Rate | `src/paddlingout/rate.html` | Public no-auth rating form | `POST /api/paddleScore/publicRating` |
| Trainer | `src/paddlingout/trainer/index.html` | React model/tourist trainer bundle | `/api/paddle-trainer/*`, partial backend only |
| Settings | `src/paddlingout/settings.html`, `src/js/paddlingPrefs.js` | Device-local units, craft, saved areas, favorites | local storage |

## Non-Negotiable Product Truths

- Add Lake currently uses admin-review-before-publication. Do not promise automatic 2-day go-live unless backend `goLiveAt` behavior is reintroduced and tested.
- Forecast is the visual quality baseline for Rate and Search.
- Public Rate must be a complete user flow. Do not send ordinary users to trainer panels that call missing endpoints.
- Location permission must be opt-in. Do not prompt GPS automatically on page load.
- Public APIs must not expose submitter emails, admin-only fields, orders, payment records, or mail queue data.
- Never trust client-side price, score, identity, or admin state.

## Design Expectations

- Keep the first viewport useful. No marketing-only hero screens.
- Use the Forecast page visual language for Paddling Out: dark surface, gold accents, clear lake identity, score-first hierarchy, dense but readable condition panels.
- Make all states clear: loading, no results, API failure, validation error, submitted, already rated/updated.
- Keep controls mobile-first and tappable.
- Avoid UI copy that over-promises safety. Paddle Score is guidance, not clearance.

## Verification For Paddling Out Changes

Minimum local checks:

- Directory loads and cards render.
- Forecast opens for `?id=ambazari`.
- Search can run more than once in the same page session.
- Add Lake copy matches admin-review backend behavior.
- Rate submit shows real success only after API success.
- Admin submission APIs still reject unauthenticated requests.

Backend tests to coordinate with `kaayko-api`:

- `npm run test:paddlingout`
- `weather-paddle-score.test.js`

Update `docs/audits/PADDLING_OUT_FULL_FEATURE_AUDIT_2026-09-05.md` with a `Resolution Notes` section whenever P0/P1 items are addressed.

