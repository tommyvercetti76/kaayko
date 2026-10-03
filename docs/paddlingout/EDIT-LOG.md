# Paddling Out: edit log

Newest first. What changed, why, the commit, whether it is live, and how it was checked.

---

## 2026-10-03 15:55 CDT · The lake's clock, typed API contracts, start/stop for the map picker and the card, and a standing browser check

- **Commits:** kaayko `this entry's commit` (`git log -1 -- docs/paddlingout/EDIT-LOG.md`), kaayko-api `e88749d`
- **Live:** API (`functions:api`) and hosting (kaayko.com + kaay.store) at 15:55 CDT, after preview channel `lake-clock`.
- **Source:** `AUDIT-2026-10-03-paddle-score.md` F1 and F7, plus the four items kept from the React analysis.

### The forecast runs on the lake's clock (F1)
- **Before:** every "now" on the forecast came from the viewer's browser clock. At 1:33 am in
  Nagpur, seen from Dallas, Ambazari Lake said "Today, Oct 3" for India's 4 Oct, drew THIS HOUR
  at 3 PM, and said the next daylight window was "later today at 4 PM".
- **After:** `js/services/spotTime.js` (`KaaykoSpotTime`) gives the lake's date and hour from
  the IANA zone the API now sends (`location.timeZone` in `/fastForecast`). Day labels come from
  each forecast day's own `date`. Heatmap, hero, night gate and the data transformer all use it.
- **Why the API's zone and not an estimate:** WeatherAPI resolves Lake Powell (Lone Rock) to
  `America/Phoenix` and keys its hourly data in that zone. The old longitude estimate said
  `America/Denver`, an hour off from the data during daylight saving.
- **API:** `fastForecast.js` sends `location.timeZone`, and treats a cached forecast without it
  as stale, so the change took effect without waiting out the 3.5 h cache.

### Forecast page logic out of the HTML
- Both inline scripts in `paddlingout/forecast.html` (≈820 lines) moved to
  `js/pages/forecast.js`. The page's own copy of `estimateTimezone` is gone (one copy, in spotTime).

### Water type is required (F7)
- **API:** publishing a submitted lake with no `waterType` is refused (422).
- **Data:** the four live community spots that had `waterType: null` (Lake Arlington, Lake
  Sammamish, String Lake, Turquoise Lake) were set to `lake`, matching every other still-water
  spot, reservoirs included. Single-field Firestore writes; the other 24 fields untouched.

### Typed contracts
- `js/contracts/paddling.js`: JSDoc typedefs for `/paddlingOut`, `/paddleScore`, `/fastForecast`
  (editors read them) and `KaaykoContracts.checkContract`, which tests and the browser check run
  against live responses. Against production before this deploy it reported exactly the two
  known breaks: no `timeZone`, four spots with no `waterType`.

### Start and stop
- `PinPicker`: `destroy()` removes every listener, timer and the Leaflet map; calls after it are no-ops.
- `/card` (`js/pages/card.js`): the whole engine is inside `mount()`, which returns its stop.
  `window.KaaykoCard.start()` / `.stop()`. Every listener uses one AbortController; timers and
  frames are tracked and cancelled; the fetches abort; `morph.cancel()` ends a dissolve mid-way.
  Card module stamps moved `01cba65` → `3526885` so phones fetch the new modules.

### Standing browser check: `npm run browser-check`
- `scripts/browser-check.mjs`, from the homepage recorder. Headless Chrome, phone (touch) and
  desktop, fresh profile per run, screenshots to a new folder each run. Checks: API contracts;
  no script errors or failed requests; layout shift ≤ 0.1 with the elements that moved; homepage
  headline size and transitions from the first frame; the forecast's labels and THIS HOUR against
  the lake's clock; `/card` drawn on a real touch pointer and intact after stop/start; Stories; kaay.store.
- `BASE=<preview url>` checks a preview channel; `ONLY=forecast` checks a subset; `CLS_MAX=0.03`
  shows smaller shifts.
- Live before this deploy: 9/20. After: 20/20.

### Found by the check, and fixed
- `/paddlingout`, desktop: **0.799 layout shift**. 8 placeholder tiles, then 21 cards pushed the
  About section down four rows. Now 21 placeholders → 0.016.
- Every Paddling Out page, desktop: the shared header rendered on DOMContentLoaded, after first
  paint, and pushed the page down 108 px (0.075). Now `PoHeader.mount()` runs inline after the
  placeholder on all seven pages → 0.002.

### Found and left
- The first-visit walkthrough popover animates `top`/`left`, which counts as a 0.083 shift on
  phone. Intended, once per visitor, under 0.1.

### Undo
- API: `git revert` the kaayko-api commit, then `firebase deploy --only functions:api`.
- Frontend: `git revert` this commit, `npm run stamp`, then
  `firebase deploy --only hosting:kaaykostore,hosting:kaay-store`.
