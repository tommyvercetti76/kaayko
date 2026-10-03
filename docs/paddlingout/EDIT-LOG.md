# Paddling Out: edit log

Newest first. What changed, why, the commit, whether it is live, and how it was checked.

---

## 2026-10-03 18:50 CDT · The pages say what runs; FAQ removed; one look for lakes with no score

- **Live:** hosting + API; browser-check 42/42 on production.
- **Methodology (audit F2):** now states: water temperature measured-or-nothing and no spot has a sensor
  (the cold-water rule cannot fire); river flow not checked (no gauge); calibration can only lower a score;
  no lake has an offset; crowd calibration not live (0 ratings); night = the lake's sun on every surface;
  new "Frozen and Closed Water" section. Model facts verified against the artifact: 400 trees, 19 features,
  monotone in wind/gusts/waves/rain/visibility, trained on 187 human ratings across 93 lakes, MAE 0.60.
- **17 spot pages:** every "cold-water rule caps the score here" passage rewritten in the page's own voice:
  the cold water is real and the score cannot see it. All 68 description strings drop "water temperature".
- **/paddlingout:** the six-question FAQ and its FAQPage schema removed. Google stopped showing FAQ rich
  results for sites like this in Aug 2023, it repeated the intro, and four answers were stale. To restore:
  `git show HEAD~1:src/paddlingout.html` for the section and schema.
- **Paused lakes:** one calm colour; Antero reads "Closed for 2026" (status.until 2026-12-31), then the
  freeze season. Re-check Denver Water before 15 May 2027.

---

## 2026-10-03 18:25 CDT · Every freezing lake resumes May 15

- **Commit:** kaayko-api (off-season.json) · **Live:** yes (status is computed per request).
- **Owner decision:** all seven freezing lakes get ratings back on **15 May**, not late April:
  Cottonwood, Taylor Park, Antero (were 25 Apr), Turquoise (was 1 May), Jackson, Jenny, String.
  Reason: high lakes can still be iced after late April (Teton ice "commonly persists from
  November to May"; Taylor Park boating is June–October per a non-official source).
- Unchanged: Lake McDonald (not a freezing lake; closed by Glacier rule 1 Nov → second Sunday in
  May). Kens Lake stays rated (brief midwinter freeze, no dates in any source).

---

## 2026-10-03 18:10 CDT · Only lakes that freeze; paused lakes last and greyed

- **Commits:** kaayko `9864539`, `2ffbc6b`; kaayko-api `259df70`
- **Live:** API + hosting (kaayko.com, kaay.store); browser-check 42/42 on production.
- **Owner rule:** only lakes that FREEZE lose their rating in winter, decided on sourced evidence
  (`kaayko-api/functions/data/spot-freeze.json`, 15 spots, quotes from the pages; re-check each autumn).

  | Lake | Evidence | No rating | Back |
  |---|---|---|---|
  | Cottonwood | USFS lists ice fishing | 1 Oct | 25 Apr |
  | Taylor Park | CPW: "Activities: Fishing, Ice Fishing" | 1 Oct | 25 Apr |
  | Turquoise | USFS: closed for ice and snow, ice fishing | 1 Oct | 1 May (ramp) |
  | Antero | Denver Water: no vehicles on the ice (and closed all 2026) | 1 Oct | 25 Apr |
  | Jackson | NPS: ice fishing on its frozen surface; ice-out early to mid May | 1 Oct | 15 May |
  | Jenny | NPS-hosted study: ice Nov–May; boating opens 15 May, ice permitting | 1 Oct | 15 May |
  | String | drains into Jenny; ice-free only by 8 May 2025 (local news) | 1 Oct | 15 May |
  | Lake McDonald | rarely freezes (NPS: last mostly frozen 2007) → rated | closed by rule 1 Nov | 2nd Sunday in May |

  Rated all winter: Diablo (rarely freezes), Merrimack and Crescent (no evidence either way),
  Colorado River, Sammamish, Union (do not freeze). **Kens Lake**: freezes briefly (non-official
  sources, no dates); left rated pending the owner.
- **List:** rated lakes first (saved on top), then "Out of season & closed · N", greyed, soonest back
  first, closures last, with a remembered Hide/Show. Same order in search; About never draws one.
---

## 2026-10-03 17:40 CDT · No rating for closed or cold lakes out of season; Know before you go; Add a lake rebuilt

- **Commits:** kaayko-api `4e42a29`, `5d11be8`; kaayko `1a5dbbd`, `1a36aa6`, `89178c3`
- **Live:** API and hosting (kaayko.com + kaay.store); browser-check 42/42 on production.

### One night rule, one "now", on the lake's clock (`1a5dbbd`, `4e42a29`)
- Every surface decides night at the lake from its sunrise/sunset (`KaaykoSpotTime.isNightAt`):
  list cards, search rows and pins, the 17 spot pages, the forecast hero. The list used to print
  "4.0 Worth it" at 2 am in Nagpur while the forecast said "daylight only".
- Heatmap: night hours carry no score; the current hour shows the observed score (audit F5).
- Server warnings and the trainer read the lake's clock, not UTC (F9).

### Find and Add a lake are one page (`1a36aa6`, `89178c3`)
- `/paddlingout/search` has Find / Add tabs; "Add this lake" on a result opens the form filled.
  `/paddlingout/submitentry` 301s there with its query. Header: "Find or add" + Settings.
- The form, rebuilt with every check unchanged: photos → name (picking it drops the pin and fills
  the place, folded to one line) → map; coordinates and optional questions folded; fine print by the
  button; sticky "what's left" bar on phones. Parking defaults to "Not sure" (it claimed "Available").

### No rating when the water is closed or out of season (`5d11be8`)
- **Owner decision, 3 Oct 2026:** cold-weather lakes get no rating from 1 October until late April
  (25 April), or the official opening where later. The API sends no rating at all.

  | Lake | Ratings resume | Why that date |
  |---|---|---|
  | Cottonwood, Taylor Park | 25 Apr | owner rule |
  | Antero | 25 Apr (and closed all of 2026) | owner rule; Denver Water closure |
  | Turquoise | 1 May | USFS: 2026 ramp opened May 1 |
  | Jackson, String | 1 May | NPS: Teton Park Road opens May 1 |
  | Jenny | 15 May | NPS: Jenny Lake boating opens May 15, ice permitting |
  | Lake McDonald | second Sunday in May | NPS: no launching before then |
- Edit: `kaayko-api/functions/data/off-season.json` → Firestore `paddlingSpots/{id}.offSeason`, or the
  admin spot editor. Closures: `status` in the same editor.

### Know before you go (`5d11be8`, `89178c3`)
- Fees, permits and invasive-species inspections, put-in, motor boats, season, rentals, dogs, parking,
  hazards for all 21 spots, each with an official source, a quote and the date checked. Researched
  3 Oct 2026; `kaayko-api/functions/data/spot-facts.json`. Facts change: re-check before each season.

### Removed
- A "best time to paddle" built on NASA POWER weather was built and pulled the same hour: it put a
  second weather source beside WeatherAPI. Never shipped to a page. Nothing scores from it.
- A lake-local weekday sent to the remote model was reverted: no model input changed today.
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
