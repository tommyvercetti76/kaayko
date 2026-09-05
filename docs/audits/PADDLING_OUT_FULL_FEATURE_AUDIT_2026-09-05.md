# Paddling Out Full Feature Audit

Date: 2026-09-05
Audited surfaces: `https://kaayko.com/paddlingout`, all nested Paddling Out pages, public APIs, admin submission APIs, and relevant frontend source.

## Executive Verdict

Paddling Out is useful and mostly connected for the core public journey: directory -> lake card -> forecast -> search -> submit a lake -> admin review. The live public API returned 17 public/scored spots, and the deployed Paddling Out pages were current as of `Last-Modified: Sat, 05 Sep 2026 14:46:03 GMT`.

Do not call the full feature set complete yet. The main product has three important gaps:

1. The "Rate" experience is split between a polished Forecast page, a legacy `rate.html` page, and a trainer React app whose admin/training endpoints are not implemented in the current backend.
2. "Add your own lake" frontend copy promises a 2-day auto-go-live flow, while the backend now intentionally keeps submissions hidden until admin validation.
3. The Search page can lock itself after a successful/no-result search because `isSearching` is not reset on early returns.

The submission backend itself is in much better shape than the old public copy suggests: image validation, size limits, storage cleanup on rejection, admin review, and public visibility gating are present. The product promise just needs to match the backend model.

## Live Evidence

Live pages checked:

- `https://kaayko.com/paddlingout` -> 200.
- `https://kaayko.com/paddlingout/search.html` -> 301 to `/paddlingout/search`, then 200.
- `https://kaayko.com/paddlingout/submitentry.html` -> 301 to `/paddlingout/submitentry`, then 200.
- `https://kaayko.com/paddlingout/rate.html` -> 301 to `/paddlingout/rate`, then 200.

Live APIs checked:

- `GET https://kaayko.com/api/paddlingOut` -> success, 17 public spots, 17 with `paddleScore`, 0 community spots currently public.
- `GET https://kaayko.com/api/paddlingOut/ambazari` -> success, spot detail and cached score available.
- `GET https://kaayko.com/api/paddleScore?spotId=ambazari` -> success, rating returned.
- `GET https://kaayko.com/api/fastForecast?spotId=ambazari` -> success, 3 forecast entries.
- `GET https://kaayko.com/api/fastForecast?lat=33.1508449&lng=-97.0034892` -> success, custom coordinate forecast works.
- `GET https://kaayko.com/api/paddlingOut/geocode?q=Lewisville%20Lake&limit=1` -> success, server-side Nominatim proxy works.
- `GET https://kaayko.com/api/nearbyWater?lat=33.07&lng=-96.99&radius=20&q=Lewisville` -> success, found Lewisville Lake from `hydrolakes`.
- `GET https://kaayko.com/api/paddle-trainer/tourist-lakes` -> success, 17 lakes.
- `GET https://kaayko.com/api/paddle-trainer/status`, `/ratings`, `/scenarios?count=3` -> 404 HTML "Campaign Not Found | Kaayko". These routes are called by the deployed trainer frontend but are not implemented in the current backend router.
- `GET https://kaayko.com/api/paddlingOut/admin/submissions` without auth -> `AUTH_TOKEN_MISSING`, no public admin queue leak observed.

Backend verification:

- `npm run test:paddlingout` passed after allowing the local test server to bind.
- `weather-paddle-score.test.js` passed: 36 tests passed.

## Feature Inventory And Connectivity

| Feature | Frontend entry | Backend/API | Current state | Notes |
|---|---|---|---|---|
| Public lake directory | `src/paddlingout.html`, `src/js/paddlingout.js` | `GET /api/paddlingOut` | Connected | Live list returned 17 public/scored spots. Favorites, card rendering, and Add Lake tile are present. |
| Lake card forecast CTA | `src/js/components/PaddleCard.js:381` | `/paddlingout/forecast?id=...`, `GET /paddlingOut/:id`, `GET /fastForecast` | Connected | Strongest UX surface. |
| Lake card rate CTA | `src/js/components/PaddleCard.js:382` | `/paddlingout/trainer?lake=...`, `/api/paddle-trainer/*` | Partly broken | CTA opens trainer, but several trainer endpoints return 404 live. Legacy `/paddlingout/rate` exists separately. |
| Forecast page | `src/paddlingout/forecast.html`, `src/css/forecast.css`, `src/js/services/apiClient.js` | `GET /paddlingOut/:id`, `GET /fastForecast`, score APIs | Connected | Best visual system. Custom lat/lng forecast works. Needs small data guards and escaping hardening. |
| Nearby search | `src/paddlingout/search.html`, `src/js/searchPage.js` | `GET /paddlingOut/geocode`, `GET /nearbyWater`, `POST /paddleScore/batch` | Mostly connected | Live APIs work. Search can lock because `isSearching` is not reset on early returns. |
| Add your own lake | `src/paddlingout/submitentry.html` | `POST /paddlingOut/submitEntry`, admin validate/reject | Backend connected, promise mismatch | Upload validation, admin queue, and publication gate exist. Frontend still promises auto-go-live within 2 days. |
| Settings | `src/paddlingout/settings.html`, `src/js/paddlingPrefs.js` | local storage only | Connected | Device-local preferences are reasonable: units, boat type, card style, saved areas/favorites. |
| Legacy rate page | `src/paddlingout/rate.html` | `GET /paddlingOut/:id`, `GET /paddleScore`, `POST /paddleScore/publicRating` | Connected with quality gaps | Submits feedback but treats failed API calls as success. Also asks GPS automatically. |
| Trainer | `src/paddlingout/trainer/index.html`, `paddle-llm/paddle-trainer/src/components/PaddleTrainer.jsx` | `GET /paddle-trainer/tourist-lakes`, `GET /tourist-weather`, `POST /ratings` implemented only | Partly broken | Frontend calls `/status`, `/ratings` GET, `/priority-lakes`, `/lakes`, `/weather`, `/scenarios`, `/admin-prefs`, `/reset-training`, DELETE `/ratings/:id`; these are absent. |
| Admin submissions | `src/admin/kortex.html`, `src/admin/views/submissions/submissions.js` | `GET/POST /paddlingOut/admin/submissions...` | Connected and protected | Queue lists pending submissions, validates/rejects, escapes untrusted text and image URLs. |

## P0/P1 Findings

### P0 - "Add Your Own Lake" Promise Does Not Match Publication Logic

Frontend copy says admin gets 2 days, then complete entries go live automatically:

- `src/paddlingout/submitentry.html:460`
- `src/paddlingout/submitentry.html:465`
- `src/paddlingout/submitentry.html:1137`
- `src/paddlingout/submitentry.html:1138`

Backend behavior is now approve-to-publish:

- `functions/api/weather/paddlingout.js:576-583` sets `submissionStatus: 'pending'` and `goLiveAt: null`.
- `functions/api/weather/communitySpotVisibility.js:12-21` hides pending spots unless `submissionStatus` is `validated`/`live` or `goLiveAt` is in the past.
- `functions/api/weather/paddlingout.js:703-786` validates submissions and then makes them public.
- `functions/api/weather/paddlingout.js:791-852` rejects submissions and deletes public image references by default.

Impact: This is a user-trust and moderation promise bug. A user adding a lake is told it will go live in 2 days, but it will not go live without admin action.

Decision needed:

- Safer launch model: keep approve-to-publish, change all frontend copy and success text to "reviewed before publication".
- More automated model: restore a real `goLiveAt` timestamp, add a scheduled publication/moderation job, and keep admin rejection before publication.

Recommendation: keep approve-to-publish until there is a real moderation SLA. Update copy immediately.

### P0/P1 - Main "Rate" CTA Opens A Trainer App With Missing APIs

The primary card rate CTA sends users to trainer:

- `src/js/components/PaddleCard.js:382`

The trainer frontend calls these endpoints:

- `paddle-llm/paddle-trainer/src/components/PaddleTrainer.jsx:971-972` -> `/status`, `/ratings`, `/priority-lakes`
- `paddle-llm/paddle-trainer/src/components/PaddleTrainer.jsx:998` -> `/lakes`
- `paddle-llm/paddle-trainer/src/components/PaddleTrainer.jsx:1095` -> `/weather`
- `paddle-llm/paddle-trainer/src/components/PaddleTrainer.jsx:1127` -> `/scenarios`
- `paddle-llm/paddle-trainer/src/components/PaddleTrainer.jsx:1149` -> `/admin-prefs`
- `paddle-llm/paddle-trainer/src/components/PaddleTrainer.jsx:1173` and `:1303` -> `POST /ratings`
- `paddle-llm/paddle-trainer/src/components/PaddleTrainer.jsx:1204` -> `DELETE /ratings/:id`
- `paddle-llm/paddle-trainer/src/components/PaddleTrainer.jsx:1209` -> `/reset-training`
- `paddle-llm/paddle-trainer/src/components/PaddleTrainer.jsx:1243` -> `/tourist-lakes`
- `paddle-llm/paddle-trainer/src/components/PaddleTrainer.jsx:1278` -> `/tourist-weather`

Current backend implements only:

- `functions/api/weather/paddleTrainer.js:11-30` -> `GET /tourist-lakes`
- `functions/api/weather/paddleTrainer.js:35-125` -> `GET /tourist-weather`
- `functions/api/weather/paddleTrainer.js:130-167` -> `POST /ratings`

Live check confirmed `/tourist-lakes` works, while `/status`, `/ratings` GET, and `/scenarios` return 404 HTML. Because the card CTA uses trainer, this is not just hidden admin debt; a normal user can hit it.

Recommendation:

- If the product goal is public lake rating, send card CTA to a redesigned `/paddlingout/rate?id=...` or rebuild trainer tourist mode around only implemented endpoints.
- If the product goal is model training/admin, implement the missing trainer endpoints and hide/admin-gate the admin controls.
- Rename CTA precisely: "Rate today's paddle" for public feedback, "Train model" for admin/trainer mode.

### P1 - Search Can Lock After A Successful Or Empty Search

`src/js/searchPage.js:579-643` sets `isSearching = true`, then returns early for success/no-results/unknown branches before the cleanup at `:643`.

Impact: After one search, the page can ignore later searches in the same session because `isSearching` remains true.

Recommendation: wrap `runSearch` in `try/finally`, reset `isSearching` and transient status in `finally`, and avoid early returns before cleanup.

### P1 - Legacy Rate Page Shows Success Even When Backend Submit Fails

`src/paddlingout/rate.html:1191` posts to `/paddleScore/publicRating`, but the catch path still stores the rating locally and shows the thank-you state.

Impact: A user believes they helped the model, but no server-side label may exist. This is especially risky if Rate is positioned as an ML feedback loop.

Recommendation:

- If offline/local-only is intended, show "Saved on this device, not yet synced" and add a retry queue.
- If the model depends on the label, show a recoverable error and keep the form open.

### P1 - Public Rating Integrity And Privacy Gaps

`functions/api/weather/paddleScore.js` has good validation basics, but public rating/feedback endpoints still need hardening:

- `paddleScore.js:239`, `:364`, and `:583` use the first `x-forwarded-for` value, which is caller-spoofable behind many proxies.
- `paddleScore.js:388-408` stores a public rating document with raw `ip`.
- `paddleScore.js:374-378` verifies spot existence only when GPS is supplied, so non-GPS public ratings can be written for typo or fake spot IDs.
- `paddleScore.js:398` stores `predictedScore` only if it is already a number; the rate page can send non-number values.

Recommendation:

- Use the shared hardened client-IP helper everywhere, hash the IP before storage, and store only the hash.
- Verify `spotId` exists and is public before accepting any public rating.
- Coerce and validate `predictedScore` server-side.

### P1 - Submit Page Bypasses Existing Server Geocode Proxy

Search uses the backend geocode proxy, and live checks confirmed it works. Submit still calls Nominatim directly from the browser:

- `src/paddlingout/submitentry.html:906`

Impact: Inconsistent privacy, rate-limit, and reliability behavior.

Recommendation: switch Submit to `/api/paddlingOut/geocode` and reuse the same result-shaping approach as Search.

## P2 Findings

### Forecast Page Data Guards

`src/paddlingout/forecast.html:211` uses `lat.toFixed(4)` and `lng.toFixed(4)` in `formatCoordinates`. Most flows pass valid data, but `renderLocationInfo` can call it from a no-coordinate branch. Guard finite coordinates and return `Coordinates unavailable` when absent.

`src/paddlingout/forecast.html:724` builds part of the location card HTML from API data. Current values are mostly trusted product/API fields, but community lakes and custom locations make consistent HTML escaping worth doing.

### Validation Email Link

The backend validation email says the entry is live and links to:

- `https://kaayko.com/paddlingout/?id=<spotId>`

That extra slash still probably resolves, but the cleaner product destination should be one of:

- `https://kaayko.com/paddlingout?id=<spotId>`
- `https://kaayko.com/paddlingout/forecast?id=<spotId>`
- a generated static spot page, if community slugs are generated later.

### Nearby Water Radius Validation

`nearbyWater` caps radius at 60, but the API should also lower-bound and reject NaN/negative radius values. The frontend clamps values, but public APIs should not rely on frontend constraints.

## Forecast Vs Rate UX Gap

Forecast is the visual standard: full dark surface, strong place identity, large score context, clear condition panels, and a designed hierarchy.

Rate is still a functional older page: it is card-heavy, visually lighter, and less connected to the place/forecast context. It also automatically asks for location, which feels heavier than Search/Submit where location is opt-in.

Recommended design direction:

- Make Rate visually inherit the Forecast page shell: same dark/gold color language, same lake hero image, same title/location/scored status treatment.
- Put the model's current score and conditions at the top, then ask for the user's lived rating as the primary action.
- Replace wide textual controls with segmented controls, chips, and icon-backed choices where appropriate.
- Do not auto-prompt for GPS. Offer explicit "Use my location to verify I was near the water".
- After submit, show a concise result: "Your rating changed the training set by X context", link back to Forecast, and let users rate another lake.
- If trainer remains the destination, make tourist mode the only public default and hide/admin-gate the data/export/training tools.

## No-Leak Review

Good:

- Admin submissions endpoint rejected unauthenticated live access.
- Community submissions are hidden from public reads until validation or a real `goLiveAt`.
- Rejected submissions clear public image fields and delete Storage media by default.
- Public Paddling Out list returns public fields only, not contact emails.

Risks:

- Public rating stores raw IP and uses spoofable `x-forwarded-for`.
- Submit page direct geocoding exposes browser requests to Nominatim instead of using the server proxy.
- Trainer missing endpoints return a generic HTML app page, not structured API errors. This is not a PII leak, but it is confusing and hard to observe.

## "Add Your Own Lake" Completion Checklist

Before calling the feature complete:

1. Choose and document the publication model: admin-review-only or 2-day auto-go-live.
2. Update all submit page copy and success states to match that model.
3. Keep the current backend upload protections: 1-3 images, JPEG/PNG/WebP only, content signature validation, 5 MB/image, 15 MB total.
4. Switch browser geocoding to `/paddlingOut/geocode`.
5. Add a submission confirmation email if the user provided email, or explicitly state that only validation/rejection emails are sent.
6. In Kortex submissions, verify approve and reject from the admin UI after a real test upload.
7. After validation, verify the new lake appears in `GET /paddlingOut`, its Forecast page resolves, and the image URLs load.
8. After rejection, verify the lake does not appear publicly and Storage image fields are empty.

## Agent Task Queue

P0:

- Align Add Lake frontend copy with the backend approve-to-publish model.
- Decide Rate destination and either route card CTA to redesigned `rate.html` or implement all trainer endpoints.

P1:

- Fix Search `runSearch` cleanup with `finally`.
- Stop treating failed public rating posts as successful model contributions.
- Harden public rating IP handling and spot validation.
- Move Submit geocode to the backend proxy.

P2:

- Escape dynamic Forecast location HTML consistently.
- Guard Forecast coordinate formatting.
- Normalize validation email links.
- Lower-bound and validate `nearbyWater` radius server-side.


---

# Resolution Notes — 5 September 2026

Implemented and deployed. Tests: `paddlingout-submit` + `weather-paddle-score` = 40 passed.
Live smoke re-run after deploy; results inline below.

## Completed

**P0 — Add Lake promise now matches approve-to-publish.** All auto-go-live copy is
gone. The lede, the "3. Goes live" tour step and both success variants (email and
anonymous) now say the entry is queued for review and appears publicly only after
a person approves it. The anonymous variant additionally says the user will not
hear back, because no email was given. Verified live: `grep '2 days'` on the
deployed page returns 0.
*Files:* `src/paddlingout/submitentry.html`

**P0/P1 — Rate CTA no longer opens the trainer.** The lake-card CTA now goes to
`/paddlingout/rate?id=<spotId>`. Trainer's nine missing endpoints are unchanged
and remain unimplemented, but no public entry point reaches them; trainer already
carries `noindex, follow`. Verified live: `grep 'paddlingout/trainer'` on the
deployed `PaddleCard.js` returns 0.
*Files:* `src/js/components/PaddleCard.js`

**P1 — Search no longer locks.** `runSearch` cleanup moved into a `finally`. Three
branches (`!data.success`, `no_results`, `found`) returned before the old cleanup,
so the lock survived every ordinary search. `clearTransientStatus()` already
no-ops on an error status, so it cannot wipe an error message.
*Files:* `src/js/searchPage.js`

**P1 — Rate no longer claims success on a failed submit.** The post is now the
source of truth: non-OK responses keep the form open, re-enable the button as
"Try again", and show a specific recoverable message (409 locked / 429 daily cap /
404 unknown spot / offline). No local fallback is written unless the server
accepted it, so nothing is silently "saved" that does not exist server-side.
*Files:* `src/paddlingout/rate.html`

**P1 — Public rating integrity and privacy.** Raw IPs are no longer stored. All
three `x-forwarded-for.split(',')[0]` reads are replaced by a shared `callerKey()`
built on `api/kortex/clientIp.js`, which resolves the chain right-to-left and
returns an HMAC under a server-side salt. `spotId` is now verified to exist *and*
be publicly visible (`isPublicPaddlingSpot`) before any rating is accepted — this
previously only happened when GPS was supplied. `predictedScore` is coerced and
bounded 0–5 via `coerceScore()`, which also rejects `null`/`''` rather than
recording them as a genuine zero. Verified live: a rating for a non-existent spot
returns `{"success":false,"error":"Unknown spot"}`.
*Files:* `functions/api/weather/paddleScore.js`

**P1 — Submit uses the server geocode proxy.** Direct browser calls to Nominatim
replaced with `/api/paddlingOut/geocode`, the same path Search uses. Verified live:
`grep 'nominatim'` on the deployed page returns 0.
*Files:* `src/paddlingout/submitentry.html`

**P2 — Forecast guards.** `formatCoordinates` returns `Coordinates unavailable`
for missing/non-finite values instead of throwing on `undefined.toFixed(4)`.
Region/country are escaped through the page's existing `esc()` before reaching
`innerHTML`.
*Files:* `src/paddlingout/forecast.html`

**P2 — Validation email link.** Now `/paddlingout/forecast?id=<spotId>`, the page
that actually renders a single spot.
*Files:* `functions/api/weather/paddlingout.js`

**P2 — nearbyWater radius.** Bounded at both ends server-side. Verified live:
`radius=-5` → 1, `radius=abc` → 30, `radius=999` → 60.
*Files:* `functions/api/weather/nearbyWater.js`

## Rate page — what changed, and what did not

The audit describes `rate.html` as a legacy page needing a redesign into the
Forecast language. **It already uses forecast.css's exact tokens** — its own style
block is commented "matching forecast.css exactly" — so the colour, type and
surface language were already aligned. Rather than rewrite 1,292 lines, the real
gaps were closed:

- GPS is now opt-in. `requestGPS()` was called unconditionally from `init()`,
  firing the browser permission prompt on page load. The badge is now a button:
  "Use my location to verify I was here".
- The model's current call is shown *before* the user rates. `predictedScore` was
  already fetched but only revealed in the thank-you state, so the page asked for
  a verdict without showing its own. It now renders as a Forecast-style score plus
  the canonical label (Worth it / Careful / Hard pass).
- Failure states are honest (above).

A fuller visual rebuild remains available but is no longer blocking: the page is
truthful, opt-in, and carries score context.

## Remaining owner-required

- **Trainer's nine endpoints** (`/status`, GET `/ratings`, `/priority-lakes`,
  `/lakes`, `/weather`, `/scenarios`, `/admin-prefs`, DELETE `/ratings/:id`,
  `/reset-training`) are still unimplemented. Decision needed: build them behind
  admin auth, or retire the trainer frontend. No user can reach it today.
- **Submission confirmation email** — the checklist asks for one on submit, or an
  explicit statement that only validation/rejection mail is sent. The copy now
  states this for the anonymous case; a confirmation email for the email case is
  not implemented.
- **End-to-end submission run** (submit → Kortex approve → appears publicly →
  forecast resolves → reject path clears Storage) has not been executed; it needs
  a real upload.

## Remaining P2 / non-blocking

- Client-supplied fingerprint is still the dedupe key for paddle feedback, so an
  anonymous caller can still shift a spot's rating by rotating fingerprints.
  Hardened IP handling limits but does not eliminate this.
- Weather endpoints still have no rate limiting and can force unbounded paid
  third-party calls.
