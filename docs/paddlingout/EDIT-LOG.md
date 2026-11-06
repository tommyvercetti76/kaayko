# Paddling Out: edit log

Newest first. What changed, why, the commit, whether it is live, and how it was checked.

---

## 2026-11-06 · The rules tour is a picture book, one Forge picture a rule

- **Why:** Rohan, on the first tour: "you are just cycling through the text". A visual tour needs a
  picture per rule, not the rule re-read.
- **Pictures:** ten subjects rendered with Forge's minimalist-tshirt engine (one seed each, mono
  settings, `~/Desktop/Kaayko_Derived/forge-scouts-rules-icons-2026-11-06-seed300`, sheets inside).
  Three came back as animals (name badge → antelope, key → moose, calendar → horse: the engine's
  animal prior) and the life jacket was fussy; re-rendered with plainer object words and an animal
  negative list. Keyed to the site gold on transparency (`scratchpad gold_mark.py`: luminance → alpha,
  square crop, 720 px webp) at `src/assets/scouts/rules/<rule>-v20261106.webp` (assets are immutable,
  so a redraw changes the date in the name).
- **Tour:** `js/pages/scouts-rules.js` is now a picture book: a centred chamfered card with the
  picture, the rule's name, one child's-words line, dots, Back/Next, ×, Esc, arrows; the next picture
  is preloaded. No spotlight, no mask. browser-check demands the first page's picture to have loaded.
- **Checked:** local no-store server at 375 and desktop, pages 1 and 5; production via browser-check
  after the deploy.

---

## 2026-11-06 · Settings apply after the back button; the rules get an "Explain me like I am a child" tour

- **The bug (Rohan: "ANY actions I take in settings DO NOT apply"):** reproduced on production. Grid
  page → Settings → choose List → the ‹ chevron: the grid came back from the back-forward cache
  (`performance.navigation.type === 'back_forward'`) with no script re-run, so the Layout choice never
  took. Units, boat and card style did apply (they listen for the relayed `storage` event). Fix:
  `js/po-view.js`, in the head of both list pages (`<html data-po-view="grid|hud">`), routes on load,
  on `pageshow` with `persisted`, and on `kaayko:listviewchange` (another tab, or prefs.js's bfcache
  re-broadcast). `?view=grid` / `?view=list` stay deliberate visits.
- **Rules page:** the "Plainly" lines are gone (Rohan: "What is this Plainly"). One button under the
  title, "Explain me like I am a child" (his words), opens a spotlight walkthrough of the ten rules,
  each in a child's words (`js/pages/scouts-rules.js`): dim mask with a cut-out and ring around the
  rule, a chamfered callout (bottom-pinned on phones, beside the rule on desktop), Next/Back/Skip,
  arrows, Enter, Esc, focus on the callout, body scroll locked, reduced-motion honoured.
- **browser-check:** the rules check presses the button and expects the tour open at "1 / 10".
- **Checked:** local no-store server at 375 and desktop: ten steps, Done and Esc close it, no overflow,
  no console errors. The bfcache route is checked on production after the deploy (see below).

---

## 2026-11-06 · Scouts: every approved spot earns a 20% code; the page and the rules rewritten

- **Why:** Rohan: the Scouts page was "BANAL", "We check it, then your name goes on it" was AI slop,
  the rules must be true and explain themselves, and "remove the 10 per month → whoever submits gets a
  discount code when approved".
- **The reward (kaayko-api):** `services/scoutRewards.js` mints `SCOUT-<8 Crockford>` once per approved
  new spot that has an email: a promo in `arcade_rewards`, 20% off one order of Kaayko's own pieces
  (`scope: 'cart'` already skips Kreator lines), one use (`maxUses: 1`, now honoured by
  `discounts.js`), 180 days. Kept on the submission as `scoutCode` so Kortex can show it and a lost one
  can be re-sent by hand. The "your spot is live" mail carries it. Percent and days are env-tunable
  (`SCOUT_CODE_PERCENT`, `SCOUT_CODE_DAYS`); 20 and 180 are my numbers, not Rohan's.
- **The picks, retired:** the details step ignores `mapmakerOptIn`; `picks-on/off` on kaay.link/m refuse
  (409); the finder page shows no picks button or chip; Scout emails no longer mention them; the add
  flow has no opt-in box. The claim machinery stays so a pick made before 6 Nov is honoured.
- **Scouts page:** "Put your spot on the map", a lede with a voice, "What makes the cut", "The deal".
  178 words, names no market. **Rules page:** ten rules, each ending in a "Plainly" line; effective
  6 Nov 2026. **Privacy:** the Monthly-picks item became "Your thank-you code".
- **Checked:** jest (api) green; local no-store server at 375 and desktop; browser-check updated
  (section names; every rule needs its plain line).

---

## 2026-11-06 · Scouts binoculars drawn with Forge

- **Why:** Rohan: "Binocular image is SHIT, draw using FORGE."
- **How:** `forge engine render minimalist-tshirt` (FLUX.1-dev, fp16, 14 steps, 1024²), eight seeds
  twice. Batch 1 (seed 100+, `~/Desktop/Kaayko_Derived/forge-binoculars-icon-2026-11-06-seed100`)
  came back as coloured folk binoculars: the engine's folk ink wins over `production.ink=one-ink-black`,
  and `species_iconography` is not a `--config` knob. Batch 2 (seed 200+, `…-mono-seed200`) with
  `style.tradition=modern-minimal` and a colour/pattern negative list gave grey silhouettes; seed05
  (seed 205) is the pick. Keyed at luminance 170, cropped square, downsampled to 128px, traced with
  vtracer (binary, spline) into one filled path, 4 KB, `fill="currentColor"`; the pick is saved as
  `PICK-seed05-icon.svg` beside its render. Both sheets (`SHEET.png`) went to Rohan to grade.
- **Result:** `PoHeader.ICONS.scouts` is that path. A filled mark at 20px carries the same visual weight
  as the 2px-stroke Search and Settings icons.
- **Checked:** local no-store server at 320, 375 and desktop on the grid, Scouts and Settings pages:
  20×20 icon in 44×44 targets, no console errors, no sideways overflow.

---

## 2026-11-06 · Header: quiet links, "Search", binoculars, layout choice in Settings only

- **Why:** Rohan, on the grid page: the gold "Find or Add" block read as a preselected choice and the
  name "looks crap"; Scouts needs binoculars, not a star; the List/Grid option belongs in Settings,
  not the header; everything must be clear and sleek on phones too.
- **PoHeader (every Paddling Out page):** three actions, all the same weight: Search, Scouts, Settings.
  No filled button; the current page keeps the hairline. Scouts icon is binoculars. The List action
  (`data-view-switch`) is gone; `.po-btn--primary` is gone from the CSS.
- **List page:** the Grid link left the date line; Settings → Layout is the one place to switch
  (the `kaayko_po_view` pref and `?view=grid` bypass are unchanged).
- **Grid page:** the tour step is titled "Search any water".
- **browser-check:** the grid check now fails on any filled header action or labels other than
  Search, Scouts, Settings.
- **Checked:** local no-store server at 320, 375 and desktop on the grid, Search, Scouts and
  Settings pages: 44×44 targets, zero filled actions, no sideways overflow, no console errors.

---

## 2026-11-03 · The photo grid is /paddlingout again; the HUD list is /paddlingout/list

- **Why:** Rohan: "Make grid default." The pages swap rather than redirect, so the default costs no hop
  and the canonical, indexed page is the one visitors land on.
- **/paddlingout** = `src/paddlingout.html`, the 29 Oct page (commit 4c06b50) with absolute paths, the
  List switch in the header, and a before-paint send to `/paddlingout/list` when `kaayko_po_view` is
  `hud` (`?view=grid` bypasses). Title, robots and structured data as before 30 Oct.
- **/paddlingout/list** = `src/paddlingout/list.html`, the HUD list, noindex, canonical `/paddlingout`,
  no structured data; its Grid link goes to `/paddlingout?view=grid`. `/paddlingout/grid` (live for about
  an hour) 301s to `/paddlingout` in firebase.json.
- **Default:** `KaaykoPrefs.getListView()` returns `grid` unless `hud` was chosen. Settings → Layout
  lists Grid first. browser-check: "paddlingout" is the grid, "paddlingout list" the HUD.
- **Checked:** local no-store server on a phone viewport: grid renders 24 cards, indexable, one
  structured-data block, List action present, default pref grid; the list page is noindex with the
  canonical, 16 cards, Grid link sets the pref; the redirect fired when the pref was `hud`.

---

## 2026-11-03 · The photo grid is back as a choice: /paddlingout/grid

- **Why:** Rohan saw the legibility pass live and still disliked the HUD look ("looks shit"); he asked
  for the old mode as an option. The HUD list stays the default; the grid is one tap away and the
  choice is remembered.
- **Grid page:** `src/paddlingout/grid.html` is the 29 Oct page (commit 4c06b50) with absolute paths,
  `noindex` + canonical `/paddlingout`, no structured data, and the header's new List action
  (`PoHeader` `data-view-switch="list"`). Same scripts as then: paddlingout.js, PaddleCard, the tour.
- **Preference:** `KaaykoPrefs.getListView()/setListView()` on `kaayko_po_view` ('hud' | 'grid').
  `/paddlingout` sends a `grid` visitor to `/paddlingout/grid` before paint; `?view=list` is the way
  back. Switches: the HUD date line's Grid link, the grid header's List action, Settings → Layout.
  On phones the date line drops " · ±0.6" to make room.
- **Checked:** local no-store server, phone and desktop: grid renders 24 cards with no relative
  script paths and no console errors; each switch sets the pref; Settings toggle paints and sets it;
  the HUD redirect condition is true only when the pref is grid and `?view=list` is absent.
  browser-check gained a "paddlingout grid" page.

---

## 2026-11-03 · HUD list: readable readouts, a chip row that says it scrolls, Add a spot at the top

- **Why:** Rohan felt the list had regressed. The live page was byte-identical to the 30 Oct HUD build;
  the complaints that held up were the 11 px readouts ("3 /6", "Tmrw 2p-5p"), a filter row cut off at
  the phone's edge with no hint it scrolls, header targets at 40 px (the 21 Oct rule is 44), and Add a
  spot only in one line at the bottom. The card shape, the verdict chip and the one-CTA rule are unchanged.
- **Readouts:** 0.78 rem; window "2–5 pm" / "11 am–2 pm" where there is room, "2p–5p" under 520 px;
  wind "3–6 mph" (wind to gusts; just the wind when no higher gust is known); at 320 px the units hide
  and the thumbnail is 64 px so nothing clips.
- **Filter chips:** the chip row is its own scroller with a right-edge fade while more chips are off
  screen (`#pn-chips.is-more`, cleared at the end of the row); at ≥760 px the row wraps so every chip
  is on view and the page never scrolls sideways.
- **Date line:** "Today, Tue Nov 3" / "Tomorrow, Wed Nov 4" / "Today & tomorrow" (was "Scores for
  <date>", which named a day half the cards did not show). Right of it, a 44 px "Add a spot" link
  ("+ Add" on phones). Header icons 44 px; the sticky bar offset follows the header height.
- **Checked:** local no-store server at 320×568, 375×812 and desktop: no horizontal overflow, no
  clipped readout, fade on/off at both ends of the row, opened card and its one link intact, no console
  errors. One review agent read the diff; its medium finding (the fade masked the sticky bar's own
  background) is what moved the mask onto the chip row.

---

## 2026-10-21 · Add a lake rebuilt; Suggest an edit; phone audit; one set of numbers

- **Commits:** kaayko-api `08a8e7c` → `df08ae8` (nearbyWater degraded flag, /locate, server-filled place,
  details-after-submit, suggest-an-edit, edits hidden from old Kortex cards, OSM water filter);
  kaayko `7594e5e` → this entry's commit.
- **Live:** API and hosting (kaayko.com + kaay.store), shipped 21 Oct 2026 on the owner's word
  ("do not serve old forms"): the old submitentry.js/css return 404 on kaayko.com, /paddlingout/submitentry
  301s to the new Add tab with its query. browser-check on production: 48/48 (both sites, phone, desktop,
  320×568, landscape). Share card URL versioned (?v=20261021) because /assets/** is cached immutable.
- **Add a lake:** four screens (photos → "Where do you put in?" on a cross map → "Which water is this?"
  from USGS → sent, then note / parking / restrooms / email). One photo minimum (owner decision).
  Town, county, state and country come from the pin (Census TIGERweb; OSM outside the US).
- **Suggest an edit:** `/paddlingout/search?mode=add&edit=<spotId>`, linked from every forecast page.
  Reviewed in Kortex → Submissions with a tick per change.
- **Phone audit** at 320×568, 360×740, 390×844, 430×932, 844×390, 768×1024: tour unreachable on small
  and landscape phones, pinned map took 57–83% of short screens, Add map hidden behind its button in
  landscape, 24–36 px targets. All fixed; browser-check gained 320×568 and landscape passes.
- **Numbers:** "22 hand-picked" was two errors (17 are curated; 7 more were added by paddlers). Pages and
  the share card now say 17 hand-picked; no page states the total, which grows with each approval.
  `check-spot-count.js` compares "hand-picked" with curated spots only.
- **Header:** every Paddling Out header button is a 44 px target (was 36–39), header height unchanged.

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
