# Paddling Out — Agent Development Rules

**Lock-down document for all Paddling Out feature work.** Prevents drift from core product vision and establishes non-negotiable patterns for pages, APIs, and component behavior.

Read this before any Paddling Out task. Every page, feature, and API change must align with these rules.

---

## Core Product Identity

### What Paddling Out Is

Paddling Out is a **free, real-time, AI-powered paddle conditions platform** that gives paddlers a single number (1-5 Paddle Score) to decide if conditions are safe before they get on the water.

**Tagline:** "Know Before You Go"

**Value Props:**
- 1-5 Paddle Score: ML-powered safety rating
- Real-time conditions: wind speed, water temp, UV index, cloud cover, precip probability
- 3-day hourly forecast heatmap with visual confidence bands
- 100+ curated kayaking, canoeing, paddleboarding destinations across North America
- Zero signup required; completely free
- Mobile-first dark theme; fast load (~1.2s first contentful paint)

---

## Architecture Non-Negotiables

### Pages & Their Responsibilities

| Page | Purpose | Load Behavior | SEO Status |
|------|---------|---------------|-----------|
| [paddlingout.html](../paddlingout.html) | Grid list of all 100+ spots with live scores | Loads all spots; renders parallel cards | `index, follow` |
| [paddlingout/forecast.html?id=spotId](../paddlingout/forecast.html) | 3-day hourly forecast heatmap + conditions hero for one spot | Lazy-loads on demand; dynamic title/OG tags | `noindex, follow` (parameterized) |
| [paddlingout/search.html](../paddlingout/search.html) | Geo-search by city/state/zip; returns nearby spots | Geo-queries via `/nearbyWater`; live results | `index, follow` |
| [paddlingout/rate.html?id=spotId](../paddlingout/rate.html) | Public rating form; public non-auth user can submit paddle experience | Direct single-spot fetch; rate limiting via IP | `noindex, follow` |

### Data Flow Pattern (Sacred)

1. **Page loads** → Router detects URL params (`?id=spotId`)
2. **API Client decides mode** → production (real-time) or emulator (cached)
3. **Fetch phase**:
   - List page: `GET /paddlingOut` (all spots with pre-warmed scores)
   - Detail page: `GET /paddlingOut/:id` (single spot)
   - Forecast page: `POST /paddleScore?spotId=X` (live score) + `GET /fastForecast?lat&lng` (weather)
   - Search page: `POST /nearbyWater?lat&lng` (geo-grid search)
4. **Render phase** → Clone templates, inject data, wire event listeners
5. **Interactive phase** → Carousel, buttons, forecasts are live

**Never:**
- Fetch from multiple endpoints in series (use `Promise.all()` for parallel)
- Trust client-side location data for ratings (require device GPS + ~5km proximity to spot)
- Cache paddle score longer than 15 minutes on frontend (backend caches for 7 days in geo-grid)
- Use hardcoded spot lists (data lives in Firestore, fetched at runtime)

---

## Page Rules: List (paddlingout.html)

### Responsibilities
- Display grid of 100+ kayaking/canoeing/paddleboarding spots
- Show live Paddle Score (1-5) for each spot via colored left border + conditions badge
- Provide in-card image carousel (dots + arrow nav)
- Links to forecast detail page and rate page
- Auto-hide hero video after first play

### Structure

```html
<header class="header"><!-- shared nav --></header>

<main class="po-page-header">
  <a class="po-brand" href="/">
    <span class="po-eyebrow">Kaayko</span>
    <h1 class="po-title">Paddling Out</h1>
  </a>
  <button class="po-search-btn" onclick="window.location.href='/paddlingout/search.html'">
    <svg><!-- location pin --></svg>
    <span class="po-search-label">Search</span>
  </button>
</main>

<main>
  <!-- Static SEO grid (prerendered) — replaced by JS on load -->
  <section class="container" id="cardsContainer">
    <div class="seo-grid">
      <a href="/paddlingout/forecast?id=ambazari">Ambazari Lake</a>
      <!-- ... hardcoded for crawlers ... -->
    </div>
  </section>
</main>

<template id="card-template">
  <div class="card">
    <div class="img-container">
      <button class="prev">←</button>
      <img class="carousel-image active" src="" alt="">
      <!-- ... more images ... -->
      <button class="next">→</button>
      <div class="carousel-dots"><!-- dots injected via JS --></div>
      <div class="conditions-badge"><!-- score + wind + temp injected --></div>
    </div>
    <div class="card-content">
      <h2 class="lake-name"></h2>
      <p class="location"></p>
      <p class="description"></p>
      <div class="card-actions">
        <button class="forecast-button">Forecast →</button>
        <button class="rate-button">Rate</button>
      </div>
    </div>
  </div>
</template>

<footer><!-- nav + copyright --></footer>
```

### Critical Behaviors

1. **Parallel card rendering**: Use `Promise.all(spots.map(spot => renderCard(spot)))` — don't render sequentially
2. **Carousel**: Dots + arrow buttons, keyboard nav (← →) optional, swipe on mobile
3. **Conditions badge**: Positioned absolute in `img-container`; shows Paddle Score, wind speed, water temp
4. **Colors**: Score colors apply to card left border (critical: #bd3b2b, moderate: #eb8127, good: #316d43)
5. **SEO grid**: Stays visible until JS runs; JS replaces with dynamic grid; falls back if JS fails

### Image Strategy

- Fetch from Firebase Storage (signed URLs in `spot.imgSrc` array)
- Lazy-load carousel images (only load active + next/prev)
- Fallback: if missing, show generic lake placeholder image
- Alt text: "Lake or river name"

---

## Page Rules: Forecast (paddlingout/forecast.html?id=spotId)

### Responsibilities
- Display 3-day hourly forecast heatmap for one spot
- Show live conditions hero (Paddle Score + wind + water temp + UV + cloud cover)
- Injected safety warnings (lightning, heat, cold water alerts)
- Dynamic title + OG meta tags based on lake name

### Data Dependencies

1. **Spot metadata**: `GET /paddlingOut/:id` → lake name, location, images
2. **Live paddle score**: `POST /paddleScore?spotId=X` → score + confidence + wind + water temp
3. **Forecast heatmap**: `GET /fastForecast?lat=&lng=` → 3 days × 24 hours of hourly data
4. **Safety warnings**: Derived from forecast (temp < 40°F, UV > 7, rain > 60%, etc.)

### Structure

```html
<header class="forecast-page-header">
  <a class="forecast-back-btn" href="/paddlingout">←</a>
  <div class="forecast-page-title">
    <h2 id="forecastLakeName">Loading…</h2>
    <p id="forecastLakeLocation"></p>
  </div>
</header>

<main class="forecast-main">
  <!-- Loading spinner (shown while fetching) -->
  <div class="forecast-loading" id="forecastLoading">…</div>

  <!-- Error state (shown if fetch fails) -->
  <div class="forecast-error" id="forecastError" style="display:none">
    <button id="retryBtn">Try Again</button>
  </div>

  <!-- Main content (hidden until data loads) -->
  <div class="forecast-content" id="forecastContent" style="display:none">
    <!-- LEFT: Hero + alerts -->
    <section class="forecast-hero">
      <div class="conditions-hero"><!-- Score badge --></div>
      <div id="safetyWarnings"><!-- injected --></div>
    </section>

    <!-- RIGHT: Heatmap -->
    <section class="forecast-heatmap" id="heatmapContainer"><!-- injected --></section>
  </div>
</main>
```

### Critical Behaviors

1. **Parallel fetch**: Use `Promise.all([getCurrentData(), getFastForecast()])` to fetch score + weather in parallel
2. **Dynamic meta tags**: Update `<title>`, `og:title`, `og:description` once lake data loads
3. **Fallback forecast**: If WeatherAPI fails, use `generateFallbackForecastData()` with synthetic hourly slots
4. **Safety warnings**: Check temp < 40°F (hypothermia) → inject warning; UV > 7 → inject; precip > 60% → inject
5. **Heatmap rendering**: CSS grid with hourly cells; color indicates conditions intensity (red = dangerous, green = great)
6. **Back button**: Returns to `/paddlingout.html`; no state persistence needed

### Heatmap Color Scheme

| Condition | Color | Score Contribution |
|-----------|-------|-------------------|
| Excellent (score 5) | Green (#316d43) | Wind <3 mph, temp 55-72°F, UV <3 |
| Good (score 4) | Light green | Wind 3-7 mph, temp 50-75°F, UV 3-5 |
| Moderate (score 3) | Yellow (#f0ad4e) | Wind 7-15 mph, temp 40-80°F, UV 5-7 |
| Difficult (score 2) | Orange (#eb8127) | Wind 15-25 mph, temp 35-85°F, UV 7+ |
| Dangerous (score 1) | Red (#bd3b2b) | Wind >25 mph, temp <35°F or >90°F, storms |

---

## Page Rules: Rate (paddlingout/rate.html?id=spotId)

### Responsibilities
- Public, no-auth form for paddlers to submit their actual paddle experience
- Collects: rating (1-5), conditions observed, date, device fingerprint, GPS coords
- Submits to `POST /paddleScore/publicRating`
- Prevents spam via IP rate limiting (5 ratings per day per IP) and device fingerprinting (2-hour dedup window)

### Data Dependencies

1. **Spot metadata**: `GET /paddlingOut/:id` → lake name, location (for title + confirmation)
2. **Submit endpoint**: `POST /paddleScore/publicRating` (requires spotId, rating, gps, device fingerprint)

### Structure

```html
<div class="rate-wrap">
  <a class="rate-back" href="/paddlingout">← Back to Paddling Out</a>

  <div class="lake-header">
    <span class="lake-eyebrow">Rate Your Paddle</span>
    <h2 class="lake-name" id="rateLakeName">Loading…</h2>
    <p class="location" id="rateLakeLocation"></p>
  </div>

  <form id="ratingForm" class="rate-form">
    <!-- Rating picker: 1-5 stars -->
    <fieldset>
      <legend>How were the conditions?</legend>
      <div class="star-picker" id="starPicker">
        <!-- 5 radio buttons rendered as stars -->
      </div>
    </fieldset>

    <!-- Observed conditions checkboxes -->
    <fieldset>
      <legend>What did you observe?</legend>
      <label><input type="checkbox" name="obs-wind"> Strong wind</label>
      <label><input type="checkbox" name="obs-cold"> Cold water</label>
      <label><input type="checkbox" name="obs-current"> Strong current</label>
      <!-- ... more options ... -->
    </fieldset>

    <!-- Date picker -->
    <fieldset>
      <legend>When did you paddle?</legend>
      <input type="date" id="paddleDate" required>
    </fieldset>

    <button type="submit" class="btn-primary">Submit Rating</button>
    <div id="successMsg" style="display:none">
      Thank you! Your rating helps paddle safely.
    </div>
  </form>
</div>
```

### Critical Behaviors

1. **Spot fetch**: `GET /paddlingOut/:id` to load lake name + location; update page title/OG tags
2. **GPS requirement**: Ask for device location (if available); store as `gps.lat, gps.lng` 
3. **Device fingerprint**: Generate via `navigator.userAgent + screen.width + localStorage.getItem('uuid')`
4. **Rate limiting checks**: Backend enforces 5 per IP per day + 2-hour dedup window per device
5. **Submit behavior**: 
   - POST to `https://api.kaayko.com/paddleScore/publicRating`
   - Include: `spotId`, `rating` (1-5), `observations` array, `paddleDate`, `gps`, `deviceFingerprint`
   - On success: show "Thank you!" message; disable form
   - On error (rate limited): show "You've already rated this spot today"
6. **No auth required**: Public endpoint; anyone can rate

---

## Page Rules: Search (paddlingout/search.html)

### Responsibilities
- Geo-search by city, state, zip, or "near me" (device GPS)
- Query `/nearbyWater?lat=&lng=` with geo-grid caching
- Return sorted list of nearby paddle spots
- Quick links to forecast pages for each result

### Data Dependencies

1. **Geo-search**: `POST /nearbyWater?lat=&lng=` → nearby spots sorted by distance
2. **Live scores**: Scores included in search results (pre-warmed, 7-day cache in geo-grid)

### Structure

```html
<div class="search-container">
  <header class="search-header">
    <h1>Find Paddle Spots</h1>
    <p>Search by city, state, zip — or use your location</p>
  </header>

  <form class="search-form" id="searchForm">
    <input type="text" id="searchInput" placeholder="City, state, or zip…" required>
    <button type="submit">Search</button>
    <button type="button" id="nearMeBtn" onclick="useMyLocation()">📍 Near Me</button>
  </form>

  <!-- Results list -->
  <div id="resultsContainer" class="results">
    <!-- Result cards injected here -->
  </div>
</div>
```

### Critical Behaviors

1. **Geocoding**: Use Nominatim (free, public) or browser `Geolocation API` to convert search term → lat/lng
2. **Nearby water search**: POST to `/nearbyWater?lat=X&lng=Y` → returns list of spots sorted by distance
3. **Score coloring**: Same as list page (left border color by Paddle Score)
4. **Result card**: Lake name, location, distance, Paddle Score, link to forecast
5. **Error handling**: If geocoding fails, show "City not found"; if no nearby spots, show "No paddle spots within 50 miles"

---

## API Contract Non-Negotiables

### Frontend → Backend Endpoints (Sacred Order)

**List:** `GET /paddlingOut`
- Response: `{ spots: [{ id, title, subtitle, text, imgSrc[], location: {lat, lng}, currentScore, scoreColor }] }`

**Single:** `GET /paddlingOut/:id`
- Response: `{ spot: { id, title, subtitle, text, imgSrc[], location, currentScore, scoreColor } }`

**Live Score:** `POST /paddleScore?spotId=X` or `?lat=&lng=`
- Response: `{ success, score: 1-5, wind, waterTemp, uvIndex, cloudCover, confidence }`

**Forecast:** `GET /fastForecast?lat=&lng=`
- Response: `{ success, forecast: [ { day: "Mon", hourly: { "00:00": {wind, temp, ...}, ... } }, ... ] }`

**Nearby:** `POST /nearbyWater?lat=&lng=`
- Response: `{ spots: [{ id, title, subtitle, distance, score }] }`

**Public Rating:** `POST /paddleScore/publicRating`
- Body: `{ spotId, rating, gps: {lat, lng}, deviceFingerprint, paddleDate, observations }`
- Response: `{ success, message: "Thank you" }` or `{ error: "Rate limited" }`

**Never:**
- Hardcode API URLs in page code (use `apiClient.baseUrl`)
- Parse API errors without providing user-friendly fallback messaging
- Send PII (phone, email, address) in rating submissions

---

## Component Reuse Rules

### RatingHero Component
- Used on: forecast.html
- Responsibility: Display Paddle Score (1-5) + wind, temp, UV in hero badge
- Props: `score`, `windSpeed`, `waterTemp`, `uvIndex`
- CSS: `js/components/RatingHero.css`

### SafetyWarnings Component
- Used on: forecast.html
- Responsibility: Inject inline warning alerts (hypothermia, heat, storms)
- Props: `conditions` (temp, wind, precip)
- CSS: `js/components/SafetyWarnings.css`

### Heatmap Component
- Used on: forecast.html
- Responsibility: Render 3-day hourly grid with color intensity
- Props: `forecast` (hourly data array)
- CSS: `js/components/Heatmap.css`

**Never duplicate these components.** If a new page needs RatingHero, import it; don't rebuild.

---

## CSS Non-Negotiables

### Dark Theme Only
- Paddling Out is dark-only (dark theme enforced in HTML + CSS)
- Color tokens live in `:root` (see `css/paddlingout.css`)
- Never use hardcoded colors; always reference `var(--gold)`, `var(--bg)`, etc.

### Responsive Strategy
- Mobile-first: design for 360px, then expand
- Breakpoints:
  - 360px–767px: single column, full-width cards
  - 768px–1024px: 2-column grid, side-by-side forecast/heatmap
  - 1025px+: 3-column grid + wider forecast panel

### Font Stack
- Serif (display): `'Cormorant Garamond'` — page titles, lake names
- Sans (labels): `'Josefin Sans'` — buttons, metadata, eyebrows

### Performance
- Lazy-load images (intersection observer)
- CSS-only animations (no JS animations unless necessary)
- Critical CSS inline (layout + above-fold); non-critical in separate sheet

---

## Error Handling

### HTTP Errors

| Code | User-Facing Message | Recovery |
|------|---------------------|----------|
| 404 | "Spot not found. Try searching." | Link to search.html |
| 500 | "We're having trouble loading data. Try again in a moment." | Retry button |
| 503 | "Weather service is temporarily down. Using cached forecasts." | Show stale data + timestamp |

### Fallback Strategies

1. **Paddle score fails**: Show "Score unavailable; try again later"
2. **Forecast fails**: Generate synthetic 3-day forecast using fallback logic (seasonal patterns)
3. **Images fail**: Show generic lake placeholder + alt text
4. **Geolocation denied**: Prompt to enter city manually

---

## Analytics & Logging (Optional)

Log to console in `dev` mode:
- `📍 Fetching paddle spots from [URL] (mode)`
- `✅ API is working! Got N days of real data`
- `⚠️ API returned invalid forecast data, using intelligent fallback`
- `🚀 Paddle Score: 4 (Good conditions)`

Never log:
- PII (email, phone, full IP, etc.)
- API keys or auth tokens
- Raw HTTP response bodies (too verbose)

---

## Definition of Done: Paddling Out Features

A feature is done when ALL of these are true:

1. ✅ Page loads in <1.5s (first contentful paint) on 4G
2. ✅ All API calls respect endpoint contract (no surprises)
3. ✅ Parallel fetches used for independent data (no waterfall delays)
4. ✅ Carousel, buttons, forms are keyboard navigable
5. ✅ Dark theme enforced; no light theme leaks through
6. ✅ Images are lazy-loaded; fallback placeholders exist
7. ✅ Responsive: tested on 360px (mobile), 768px (tablet), 1025px+ (desktop)
8. ✅ Error states handled: network fail, API fail, geolocation denied, rate limit
9. ✅ Fallback data generation works (forecast, spot list)
10. ✅ No hardcoded URLs or API keys (use `apiClient`, `window.FORCE_PRODUCTION_MODE`)
11. ✅ Meta tags (title, OG, schema.org) are dynamic or correct static
12. ✅ All components imported from `js/components/` (no duplication)
13. ✅ No console errors; optional warnings logged cleanly
14. ✅ Page tested on both local emulator and production API

---

## When You're Unsure

1. **How do I fetch data?** → Use `apiClient.getForecastData()` or `fetch()` + `apiClient.baseUrl`
2. **Should I add a new component?** → Only if 2+ pages reuse it; otherwise keep in page JS
3. **What color should this button be?** → Use `var(--gold)` for primary, `var(--muted)` for secondary
4. **Carousel isn't working?** → Check `wireUpCarousels()` is called after DOM render
5. **Images not loading?** → Ensure Firebase Storage signed URLs are correct; use fallback
6. **API returning error?** → Log the error + show user-friendly message; auto-retry if transient

**Read the code in `paddlingout.html`, `paddlingout.js`, `apiClient.js`, `forecast.html`.** They are the golden standard.

---

## Last Updated

May 11, 2026 — locked down after phase 2-3 optimization and production deploy.
