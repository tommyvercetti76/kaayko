# Kaayko Paddling Out — Engineering Identity & Search Rebuild Plan

_12 Sep 2026. Source of truth for how we build the frontend and API from here on.
Every claim below points at a file, so it can be defended line by line._

## 1. The constraint that defines us

**Static HTML + vanilla JS, no build step, one Express function behind it.**

We chose this on purpose. View-source is the debugger, deploy is a file copy, a
phone on a lake with one bar of signal loads 70 KB of JS. The price is that a
bundler will never enforce boundaries for us. Boundaries are conventions, and
conventions only hold if they are written down and checked. This document is that.

## 2. Layers (frontend)

```
css/po-tokens.css          colour · type · cut          (design tokens; loaded last, wins)
js/components/*            DOM factories + own CSS      (PaddleCard, PoHeader, KonditionsHeatmap, PinPicker)
js/services/*              network, no DOM              (apiClient, geo, dataTransformer)
js/prefs.js                user state + event bus       (units, craft, favourites, my-area, API base)
js/pages/*                 page controllers             (state → render; glue only)
*.html                     structure                    (a mount point per component; no logic > 30 lines inline)
```

Rule of dependency: a layer may import from the layers above it, never below.
A component never fetches. A service never touches the DOM. A page never
draws a card by hand.

## 3. One source per concern

| Concern | Single source | Everyone else |
|---|---|---|
| API base URL | `prefs.js → kaaykoApiBase()` | must call it (10 files still declare `API_BASE`; to remove) |
| Score colour + verdict label | `prefs.js → paddleScoreColor()`, `scoreMeta()` (to add) | PaddleCard, heatmap, search, methodology |
| Units + formatting | `prefs.js → fmtTemp/fmtWind/fmtDist/fmtArea` | all pages |
| Favourites + my area | `prefs.js` + `kaayko:favchange` event | cards, forecast hero, settings, search |
| Geocode (forward, reverse, suggest) | `js/services/geo.js` (to build) | search, add-a-lake |
| Map + pin | `js/components/PinPicker.js` (to build) | search, add-a-lake |
| A lake on screen | `PaddleCard.create()` (minimal · full · row) | list, about, search results |
| Page header | `PoHeader.js` | all seven paddling pages |
| Tiny helpers (`escapeHtml`, `debounce`, `haversineKm`) | `js/util.js` (to build) | currently copied per page |
| Design tokens | `css/po-tokens.css` | page CSS may add, never redefine |

## 4. Patterns we actually use (and where)

| Pattern | Where | Why it earns its place |
|---|---|---|
| Revealing module (IIFE → one global) | `prefs.js` → `KaaykoPrefs`, `PaddleCard.js`, `PoHeader.js` | Private state, explicit API, works without a bundler |
| Factory | `PaddleCard.create(spot, opts)` returns a DOM node | One place decides what a lake looks like; variants by option, not by copy |
| Observer / event bus | `kaayko:favchange`, `kaayko:cardsrendered`, `registerFavPainter` | Cards, hero and settings stay in sync without knowing each other |
| Facade | `apiClient.js`, admin `apiFetch` | Timeouts, auth headers and base URL in one wrapper |
| Adapter | `dataTransformer.js`, `PaddleCard.normalize()` | API shape changes stop at the edge |
| Strategy | `craftAdjustments.applyCraftAdjustment(score, craft)`; craft profiles in `paddleTips.js` | Kayak / canoe / SUP change the rule, not the pipeline |
| Cache-aside + scheduled warm | `paddle_score_cache`, `warmPaddleScoreCache` (15 min), `warmScoreNow()` on publish/move | Reads never compute; writes that change visibility warm immediately |
| Stale-while-revalidate | list cache in `localStorage` (30 min); `Cache-Control: public, stale-while-revalidate` | A cold function is invisible to a returning visitor |
| Chain of responsibility (middleware) | `adminGuard = [optionalAuthForAdmin, requireAdmin, requirePlatformAdmin]` | Fail closed; self-serve `admin` can never publish |
| Pure domain functions | `getPreparationTips`, `isPublicPaddlingSpot`, `fileBelongsToSpot`, `normalizeTags`, `stripImageMetadata` | Unit-tested without Firestore; the tips bug was a one-line test |
| Allow-lists at every write | `SUBMISSION_FIELDS`, `SPOT_EDITABLE`, `SPOT_TAGS`, `ALLOWED_IMAGE_TYPES` + magic bytes | Unknown fields cannot reach the database |
| Single writer / single authority | `pricing.js` prices; Stripe webhook writes `orders`; `PaddleScoreCache` writes scores | No two code paths disagree about money or a score |
| Transactional reservation | `reserveSubmissionSlot` (rate limit + dedupe in one `runTransaction`) | Two clicks cannot both win |
| Append-only audit | `paddling_spot_audit`, `product_audit` | Every admin edit answers who / what / before / after |
| Guard clauses + explicit state | `parseCoord('') → null`, `num(null) → NaN` | `Number('')` and `Number(null)` are 0; absent must stay absent |
| Design tokens | `css/po-tokens.css`, `--kc-*` chamfer variables | Colour and cut change in one file |
| Progressive enhancement | skeletons, `AbortController` timeouts, `<noscript>` grid | Slow network degrades to something usable, never to a spinner forever |

Patterns we deliberately do **not** use: a client framework, a global store, a
CSS-in-JS runtime, an ORM. Each would cost more than it returns at this size.

## 5. Conventions

- **Naming.** Globals are `Kaayko*` / `Po*`. Paddling CSS classes are `po-*`; component classes carry the component prefix (`pcard-`, `khm-`, `se-`). Behaviour hooks are `data-action` / `data-*`, never `onclick`.
- **Events, not lookups.** A component that changes shared state dispatches an event; it does not reach into another component's DOM.
- **Delegation.** One listener per list, dispatch on `data-action`.
- **Every fetch has a timeout and a next step.** Abort at 8–10 s; the error copy says what to do ("Tap the map to place the pin").
- **Mobile is the first viewport.** 375 px, no horizontal scroll, labels may drop to icons, hit targets ≥ 36 px, `env(safe-area-inset-*)`.
- **Accessibility floor.** Every control has a name; current page has `aria-current`; `:focus-visible` is drawn; `prefers-reduced-motion` respected; body text ≥ 4.5:1.
- **No curves; chamfers where they earn it.** Panels, fields and primary buttons are cut. Chips, close buttons, icons and dots are plain.
- **Backend.** Router per domain; guard arrays; pure logic in its own module; allow-list every write; audit admin writes; never trust a client number.
- **Tests.** jest + supertest on the firebase-admin mock. Every new route: one happy path, one refusal. Every pure function: its edge cases. Frontend: `node --check`, console clean, the 375 px pass.
- **Definition of done.** Tests green → deployed → both `kaayko.com` and `kaay.store` checked, including a page the change did not touch → no console errors → `MODULE-MAP.md` and the agent file updated → commit message says why.

## 6. Known debt (so nobody rediscovers it)

`API_BASE` declared in 10 files · `escapeHtml`/`debounce`/`haversine` copied per page · two Leaflet inits · three geocode clients · four card designs · 600–1300-line inline scripts on search, add-a-lake and rate · no tests on `nearbyWater` or the geocode proxies · no light theme (pages force dark).

## 7. Search rebuild — the plan

Goal: **the map is the input.** Tap it, type into it, or locate yourself; results follow the map and the map follows results. Same code on a phone and a desktop.

| Step | Build | Done when |
|---|---|---|
| 0 | `js/util.js`; `js/services/geo.js` (forward, reverse, suggest, memo cache, abort) | search + add-a-lake import them; per-page copies deleted |
| 1 | `js/components/PinPicker.js` + `.css` — `create(el, {center, zoom, pickable, draggable, onPick})`, `setPin`, `flyTo`, `setResults(pins)`, `invalidate` | add-a-lake uses it for the draggable pin + reverse fill; no Leaflet code left in either page |
| 2 | `css/search.css` (extracted) — mobile: search field pinned, map 45 vh, results sheet scrolls beneath; desktop ≥ 900 px: map left, results right, both full height | 375 px and 1280 px screenshots; no overflow; map never below the fold |
| 3 | `js/pages/search.js` — one `state` `{mode: idle·locating·searching·results·empty·error, center, radiusKm, query, bodies, covered, scores}` and one `render(state)`; custom suggestion list (no `<datalist>`); tap-to-search; typing flies the map | every path reachable by keyboard; 429 from batch scoring shows a message; fallback capped at 6 single calls |
| 4 | `PaddleCard` `variant: 'row'` for generic water bodies (name, type, distance, score ring) | search results are the shared card; `water-card` deleted |
| 5 | Tests: `nearbyWater` (radius clamp, cache hit, no-results), `geocode` + `reverse-geocode` (validation, cache, 429), `geo.js` cache | `npm run test:paddlingout` green |
| 6 | Deploy both sites, verify list · forecast · search · add-a-lake at 375 and desktop; update `MODULE-MAP.md` + agent file | links in the report |

Budget: no sub-agents for the build; at most 3 for test writing if used at all.

## 8. How to talk about it (interview lines)

- **"Why no framework?"** — The product is seven pages and a card. A framework buys us component boundaries; we get those from factories and a token sheet, and we keep view-source debugging and a 70 KB payload. We would reach for one at the point where state sharing across views outgrows an event bus.
- **"How do you keep vanilla JS from rotting?"** — One source per concern (table in §3), a dependency rule between layers, and a definition of done that includes the pages the change did not touch. The rot we had was exactly the concerns that had two sources.
- **"Where is the domain logic?"** — In pure functions with tests: scoring tips, visibility, tag normalisation, image metadata stripping. The HTTP layer validates and delegates.
- **"How do you make an anonymous upload safe?"** — Allow-listed fields, magic-byte type checks, metadata stripping, honeypot, a transactional rate limit and dedupe, and nothing is public until a platform admin approves it with coordinates and photos present.
- **"What did the last performance fix teach you?"** — Measure first. The slow part was not our code: cold starts, uncacheable images and 84 eager image fetches. Fixes were a keep-warm schedule, cache headers, and loading only the visible slide.
- **"What would you change?"** — Extract the three big inline scripts into page modules, finish the one-source table, add a light theme through tokens, and put min-instances on the API when traffic justifies the cost.
