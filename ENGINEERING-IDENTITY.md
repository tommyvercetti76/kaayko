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
| API base URL | `prefs.js → kaaykoApiBase()` via `KaaykoUtil.apiBase()` | every paddling page calls it; store-side files still declare their own (open) |
| Score colour + verdict label | `prefs.js → paddleScoreColor()`, `scoreMeta()` | PaddleCard, heatmap, search, methodology |
| Units + formatting | `prefs.js → fmtTemp/fmtWind/fmtDist/fmtArea` | all pages |
| Favourites + my area | `prefs.js` + `kaayko:favchange` event | cards, forecast hero, settings, search |
| Geocode (forward, reverse, suggest) | `js/services/geo.js` | search, add-a-lake |
| Map + pin | `js/components/PinPicker.js` | search, add-a-lake |
| A lake on screen | `PaddleCard.create()` (minimal · full · row) | list, about, search results |
| Page header | `PoHeader.js` | all seven paddling pages |
| Tiny helpers (`escapeHtml`, `debounce`, `haversineKm`) | `js/util.js` | search, add-a-lake, rate import it |
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

Closed 12 Sep 2026: add-a-lake and rate are page modules (`js/pages/submitentry.js`, `js/pages/rate.js`) with their CSS in `css/` · helpers and API base now come from `util.js`/`prefs.js` on every paddling page · one Leaflet wrapper (`PinPicker`) · one geocode client (`geo.js`) · search results use the shared card (`row` variant) · search logic lives in `js/pages/search.js` · `nearbyWater` and the geocode proxies are tested.

Also closed 12 Sep 2026: every page reads `window.KAAYKO_API_BASE` from `prod-config.js` (Kortex's `tenant-portal.js` / `kortex-report.js` keep their environment switch by design) · Stripe idempotency keys no longer derive from the client IP · revoked admin tokens are rejected · submitters are emailed on rejection.

On a branch, awaiting review: the light theme (`light-theme` branch, Firebase preview channel). Default stays dark.

## 7. Search rebuild — the plan

Goal: **the map is the input.** Tap it, type into it, or locate yourself; results follow the map and the map follows results. Same code on a phone and a desktop.

| Step | Build | Done when |
|---|---|---|
| 0 ✅ | `js/util.js`; `js/services/geo.js` (forward, reverse, suggest, memo cache, abort) | search + add-a-lake import them; per-page copies deleted |
| 1 ✅ | `js/components/PinPicker.js` + `.css` — `create(el, {center, zoom, pickable, draggable, onPick})`, `setPin`, `flyTo`, `setResults(pins)`, `invalidate` | add-a-lake uses it for the draggable pin + reverse fill; no Leaflet code left in either page |
| 2 ✅ | `css/search.css` (extracted) — mobile: search field pinned, map 45 vh, results sheet scrolls beneath; desktop ≥ 900 px: map left, results right, both full height | 375 px and 1280 px screenshots; no overflow; map never below the fold |
| 3 ✅ | `js/pages/search.js` — one `state` `{mode: idle·locating·searching·results·empty·error, center, radiusKm, query, bodies, covered, scores}` and one `render(state)`; custom suggestion list (no `<datalist>`); tap-to-search; typing flies the map | every path reachable by keyboard; 429 from batch scoring shows a message; fallback capped at 6 single calls |
| 4 ✅ | `PaddleCard` `variant: 'row'` for generic water bodies (name, type, distance, score ring) | search results are the shared card; `water-card` deleted |
| 5 ✅ | Tests: `nearbyWater` (radius clamp, cache hit, no-results), `geocode` + `reverse-geocode` (validation, cache, 429), `geo.js` cache | `npm run test:paddlingout` green |
| 6 ✅ | Deploy both sites, verify list · forecast · search · add-a-lake at 375 and desktop; update `MODULE-MAP.md` + agent file | links in the report |

Budget: no sub-agents for the build; at most 3 for test writing if used at all.

## 8. How to talk about it (interview lines)

- **"Why no framework?"** — The product is seven pages and a card. A framework buys us component boundaries; we get those from factories and a token sheet, and we keep view-source debugging and a 70 KB payload. We would reach for one at the point where state sharing across views outgrows an event bus.
- **"How do you keep vanilla JS from rotting?"** — One source per concern (table in §3), a dependency rule between layers, and a definition of done that includes the pages the change did not touch. The rot we had was exactly the concerns that had two sources.
- **"Where is the domain logic?"** — In pure functions with tests: scoring tips, visibility, tag normalisation, image metadata stripping. The HTTP layer validates and delegates.
- **"How do you make an anonymous upload safe?"** — Allow-listed fields, magic-byte type checks, metadata stripping, honeypot, a transactional rate limit and dedupe, and nothing is public until a platform admin approves it with coordinates and photos present.
- **"What did the last performance fix teach you?"** — Measure first. The slow part was not our code: cold starts, uncacheable images and 84 eager image fetches. Fixes were a keep-warm schedule, cache headers, and loading only the visible slide.
- **"What would you change?"** — Extract the three big inline scripts into page modules, finish the one-source table, add a light theme through tokens, and put min-instances on the API when traffic justifies the cost.

## 9. Store rebuild — the plan (kaayko.com/store · kaay.store)

_Surveyed 12 Sep 2026. Same method as §7: one source per concern, page modules,
nothing inline over 30 lines. The store is the money path, so the order below
is cheapest-and-safest first and the cart is extracted verbatim before it is
touched._

**What the survey found** (all measured, `grep` reproducible):

| Concern | Copies today | Where |
|---|---|---|
| HTML-escaping `esc()` | 8 + `util.js` | `animal.js`, `fitPicker.js`, `product.js`, `store-about.js`, `arcade/{beg,cabinet,reward}.js`, `cart.html` |
| API base | 1 stray + 2 image bases | `cart.html` computes its own `API_URL`; `kaayko_ui.js` and `testimonials.js` hard-code `/images` |
| API client | 2 | `js/kaayko_apiClient.js` (store) and `js/services/apiClient.js` (forecast only) |
| Dollar formatting / parsing | 4 | `cart.html` `money`/`parsePrice`, `cartManager.getTotal()` re-parses a display string, `order-success.html`, `priceMap.priceText()` |
| Cart badge in the header | 2 verbatim | inline in `store.html` and `product.html`; `header.js` does not own it |
| Footer year stamp | 17 pages | every store/marketing page; `util.js` already does it for paddling |
| Toast / modal | 3 | `cart.html` toast, `kaayko_ui.js` modal, `secretStore.js` modal |
| Fetch timeout | 0 of 12 fetches | no `AbortController` anywhere on the store surface; a cold start is a spinner forever |
| Design tokens | 2 palettes, opposite | `storestyle.css` declares light (#f9f9f9, orange #ff8c00) then `header.css` overrides to dark (#080808, #b5935a); `po-tokens.css` names the same colours differently |
| Inline page logic | 1 400 lines | `cart.html` 802, `index.html` 353, `shipping.html` 233, `store.html` 91, `order-success.html` 57, `product.html` 54 |

**Steps**

| Step | Build | Done when |
|---|---|---|
| 0 | `js/store/kit.js` — an ES-module facade over `window.KaaykoUtil` (`esc`, `money`, `fetchJson`, `apiBase`) so modules import instead of redefining; `util.js` stamps `#year` everywhere | 8 `esc` copies and 17 year stamps deleted; `cart.html` reads `apiBase()` |
| 1 | `header.js` owns the cart badge (subscribes to `cartManager`) | both inline copies deleted; badge correct on store, product, cart |
| 2 | `js/services/storeApi.js` — products, product, vote, images base, arcade reward, tax, payment intent; every call through `fetchJson` with a 9 s timeout and an error the page can act on | `kaayko_apiClient.js` deleted; `/images` base has one definition; the store shows "Try again", never an infinite spinner |
| 3 | Page modules: `js/pages/cart.js` (extracted verbatim first, exactly as `rate.js` was), `js/pages/store.js`, `js/pages/product.js` glue, `js/pages/index.js`, `js/pages/shipping.js` | every store HTML file ≤ 30 inline lines; checkout smoke test passes on a preview channel before deploy |
| 4 | Money as numbers: `cartManager` stores `priceCents` from `priceMap.priceCents(product)`; one `money(cents)`; cart totals, order-success and the idempotency fingerprint read cents | `parsePrice` and the `getTotal()` string parse deleted; server `pricing.js` remains the only authority — this is display only |
| 5 | One token sheet: `css/tokens.css` shared with paddling; `storestyle.css` light palette removed; `--color-brand-gold` etc. become aliases of `--gold` for one release, then go | no colour literal in store CSS that `tokens.css` already names; light theme on the store becomes a branch, not a rewrite |
| 6 | `js/components/Toast.js`; cart, product and store use it | one toast, ARIA live region, reduced-motion respected |
| 7 | Tests + deploy: `node --check` on every module, jest for `priceCents`/`money`; preview channel; kaayko.com **and** kaay.store; 375 px pass; live checkout smoke | links in the report; `MODULE-MAP.md` and the store agent file updated |

Budget: no sub-agents for the build; at most 2 for tests. The cart (step 3) is
the only step with money risk, and it is mitigated by extracting first and
changing second, with the Stripe smoke test run on the channel both times.

Known nuance for step 4: the cart stores `price` as a display string today. A
tier symbol (`"$$"`) reaching the cart parses to `0`, so the bag would show a
zero subtotal while Stripe charges the real price. Cents end that class of bug.
