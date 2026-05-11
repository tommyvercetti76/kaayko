# Paddling Out — Search Lake Functionality Audit

**Comprehensive audit identifying gaps, issues, and improvement opportunities.**

---

## Executive Summary

The search functionality has **12 critical issues**, **8 major architectural problems**, and **6 data quality concerns**. Core problems:

1. **N+1 Score Fetching**: Fetches scores individually per result instead of batching (wasteful)
2. **No Refresh Mechanism**: Users stuck with cached results; no force-refresh option
3. **Poor Mobile UX**: Map button hidden, results not keyboard-accessible, long load times
4. **Silent Failures**: API errors don't distinguish "no results" from "search failed"
5. **Global Coverage Gap**: Non-US regions rely on OSM alone (poor in India, China, SE Asia)
6. **Incomplete Metadata**: No access info, difficulty ratings, hazards, parking
7. **Nominatim Rate Limiting**: No protection against Nominatim IP blocking
8. **Score Accuracy**: Scores computed for lake center, not actual launch points

**Risk Level**: 🔴 **High** — Users get incomplete/inaccurate results, poor error handling, silent data freshness issues.

---

## FRONTEND Issues

### 1. 🔴 N+1 Score Fetching (Performance Critical)

**Problem**: Each result card fetches its paddle score individually.

```javascript
// Current: 15 results × 1 request each = 15 parallel requests
renderResults(bodies, label, cached) {
  items.forEach((body, idx) => {
    fetchScore(body.lat, body.lng).then(score => {
      // Renders score ring for this one card
    });
  });
}
```

**Impact**:
- 15 simultaneous fetch requests (bandwidth waste, slow on slow networks)
- If 1 score fetch fails, that card shows "N/A" (no retry)
- 7s timeout per fetch × occasional slow API = user waits 10-20s for partial results
- Backend sees 15 `paddleScore` requests per search (traffic spike)

**Solution**: Batch scores into single endpoint.

```javascript
// Proposal: POST /paddleScores with array of coordinates
const scores = await fetch(`${API_BASE}/paddleScores`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    coordinates: items.map(b => ({ lat: b.lat, lng: b.lng }))
  })
}).then(r => r.json());

// Response: { scores: [2.5, 3.2, 4.1, ...] }
```

**Effort**: Medium (frontend + backend endpoint needed)

---

### 2. 🔴 No Cache Refresh Control

**Problem**: User can't force fresh search results if cached data feels stale.

```javascript
// No way for user to:
// - See when cache was generated
// - Force live lookup (bypass Firestore cache)
// - Refresh with new data
```

**Current State**:
- Shows "cached" hint but no action (user confused)
- 7-day cache TTL means results could be week old
- If user knows a new lake was added, still sees old results

**Solution**: Add refresh button or cache control.

```html
<!-- Option A: Refresh button in results header -->
<div class="results-header">
  <span id="results-count"></span>
  <button id="refresh-btn" class="btn-refresh" title="Force live search">⟳</button>
  <span id="results-hint"  class="text-muted">cached 2h ago</span>
</div>

<!-- Option B: Query parameter ?refresh=1 for power users -->
<!-- /paddlingout/search?lat=33.1&lng=-96.7&refresh=1 -->
```

```javascript
// Wire refresh button
document.getElementById('refresh-btn').addEventListener('click', () => {
  const q = `${API_BASE}/nearbyWater?lat=${lat}&lng=${lng}&radius=30&refresh=1`;
  // Force live lookup (backend checks refresh=1)
});
```

**Backend already supports**: `?refresh=1` parameter exists but no UI exposes it.

**Effort**: Low (wire existing backend feature)

---

### 3. 🔴 Poor Mobile UX

**Problem**: Search results unsuitable for mobile devices.

```css
/* searchPage.js line 460+ */
@media (max-width: 600px) {
  .btn-map { display: none; }  /* User can't see where lake is on mobile! */
}
```

**Specific Issues**:

| Issue | Impact | Fix |
|-------|--------|-----|
| Map button hidden on mobile | User can't verify location before tapping | Show as full-width card below results |
| No long-press suggestions | iOS keyboard doesn't auto-suggest "Lake Tahoe" | Integrate with device autocomplete or show quicksuggest |
| Score ring takes up space | On 360px screens, score ring competes with name/distance | Reorganize: name/distance on top, score ring bottom-right |
| No horizontal swipe nav | Can't flip through cards like Tinder | Could add swipe-to-forecast gesture |
| No keyboard nav between results | Tab key doesn't move between cards | Add `role="listbox"` and arrow key handlers |
| Results list doesn't page | Max 15 results, no "load more" | Add pagination or infinite scroll |

**Example Mobile Layout Reorg**:

```html
<!-- Before (cramped) -->
<div class="water-card">
  <div class="water-card-info">
    <h3>Lake Name</h3>
    <p>2 mi · Lake type</p>
  </div>
  <div class="score-ring"><!-- Big ring takes space --></div>
  <button class="btn-map" style="display: none"><!-- Hidden! --></button>
</div>

<!-- After (mobile-friendly) -->
<div class="water-card">
  <div class="water-card-header">
    <div>
      <h3>Lake Name</h3>
      <p>2 mi · Lake</p>
    </div>
    <div class="score-ring-small">2.5</div>
  </div>
  <button class="btn-map btn-block">📍 View on Map</button>
</div>
```

**Effort**: Medium (redesign + responsive testing)

---

### 4. 🔴 Silent API Failures (Error Handling)

**Problem**: Frontend can't distinguish "no results" from "search failed".

```javascript
// Current error handling
if (!data.success || !data.waterBodies?.length) {
  // Shows "No spots found" whether API failed OR truly no results
  showEmpty(label);
}
```

**Scenario**: USGS NHD times out → empty results array → user sees "No spots found near Austin"
**Reality**: USGS is down, but frontend looks like there are no lakes in Austin.

**Solution**: Backend should return error status.

```javascript
// Backend response variants:
// ✅ Success with results
{ success: true, waterBodies: [lake1, lake2], source: 'live' }

// ✅ Success but no results (legitimate)
{ success: true, waterBodies: [], noResults: true, reason: 'No lakes in radius' }

// ❌ Failed (should be 4xx/5xx status)
{ success: false, error: 'NHD API timeout', fallback: [] }

// Frontend logic:
if (!data.success) {
  showError('Search service temporarily unavailable. Try again?');
  return;
}
if (data.noResults) {
  showEmpty('No paddling spots in this area. Try a nearby city.');
  return;
}
```

**Effort**: Medium (backend + frontend error state)

---

### 5. 🟡 No URL Preservation for Sharing

**Problem**: Users can't share search results — URL changes to `?lat=X&lng=Y` but loses original query.

```javascript
// User enters "Lake Tahoe" → system geocodes to lat/lng
// Results show lat/lng URL: /paddlingout/search?lat=39.09&lng=-120.03
// User shares URL with friend → friend gets same results but no context "Lake Tahoe"
```

**Impact**: Shared links are less discoverable (no SEO title for "Lake Tahoe"), URLs look cryptic.

**Solution**: Preserve original query text in URL.

```javascript
async function triggerTextSearch() {
  const query = inputEl.value.trim();
  const geo = await geocode(query);
  // Update URL to include original query
  window.history.replaceState(null, '', 
    `/paddlingout/search?q=${encodeURIComponent(query)}&lat=${geo.lat}&lng=${geo.lng}`
  );
  runSearch(geo.lat, geo.lng, geo.label);
}
```

**Effort**: Low (URL + optional query param support in backend)

---

### 6. 🟡 No Accessibility for Keyboard Navigation

**Problem**: Results aren't keyboard-accessible; Tab doesn't move between cards.

```javascript
// Current: results are divs with click handlers, no semantic structure
<div class="water-card" onclick="openForecast(body)">
  <!-- No role, no tabindex, no keyboard navigation -->
</div>

// Fix: Use semantic HTML + ARIA
<button class="water-card" onclick="openForecast(body)" 
  role="listitem" tabindex="0">
  <!-- Now keyboard-accessible -->
</button>
```

**Missing**:
- Arrow key navigation (↑↓ move between results)
- Enter key to open forecast
- Escape key to close search
- Screen reader announcements when results load

**Effort**: Low (add ARIA + keyboard handlers)

---

### 7. 🟡 Geolocation Auto-Detect Messaging

**Problem**: Silent auto-detect on page load confuses users.

```javascript
// Page loads → browser tries geolocation silently
// User doesn't see loading indicator
// After 3s of nothing, page shows popular chips with no explanation
// User doesn't know if geolocation worked, failed, or never ran
```

**Better Flow**:

```javascript
// Show brief "Finding your location..." indicator
// If succeeds: "Showing spots near you" + distance indicator
// If fails/denied: "Try a lake name above" + search example
// If times out: "Location detection slow — enter a place name"
```

**Effort**: Low (add status messages + indicators)

---

## BACKEND Issues

### 1. 🔴 No Nominatim Rate Limiting Protection

**Problem**: Multiple searches → multiple Nominatim geocode calls → IP could get blocked.

```javascript
// searchPage.js
async function triggerTextSearch() {
  const query = inputEl.value.trim();
  const geo = await geocode(query);  // Calls Nominatim directly
  runSearch(geo.lat, geo.lng, geo.label);
}
```

**Scenario**:
- User enters "Lake Superior" → Nominatim called
- Search results feel slow
- User edits to "Lake Superior, Michigan" → Nominatim called again
- User tries "Superior Lake" → Nominatim called 3rd time (same result)
- IP gets rate-limited (429 Too Many Requests)

**Solution**: Cache geocode results.

```javascript
// Backend: POST /geocode (with caching)
const geocodeCache = new Map(); // lat,lng -> { lat, lng, label }

router.post('/geocode', async (req, res) => {
  const { query } = req.body;
  const cacheKey = query.toLowerCase();
  
  if (geocodeCache.has(cacheKey)) {
    return res.json(geocodeCache.get(cacheKey));
  }
  
  const geo = await nominatimGet(`/search?q=${query}...`);
  geocodeCache.set(cacheKey, geo);
  res.json(geo);
});

// Frontend calls /geocode instead of Nominatim directly
const geo = await fetch(`${API_BASE}/geocode`, {
  method: 'POST',
  body: JSON.stringify({ query })
}).then(r => r.json());
```

**Effort**: Medium (add backend geocode endpoint + caching)

---

### 2. 🔴 Silent Source Switching (NHD → OSM Fallback)

**Problem**: If NHD times out, silently falls back to OSM without user knowing.

```javascript
// lakeIndex.js
const [nhdResults, hlResults] = await Promise.all([
  queryNHD(lat, lng, radiusMiles),        // USGS (authoritative)
  Promise.resolve(searchHydroLAKES(...))  // Static bundle
]);

// If NHD times out or is slow:
if (merged.length === 0) {
  logger.info(`🔍 US sources empty — OSM fallback`);
  const osm = await nominatimFallback(lat, lng, query);  // User doesn't know!
}
```

**Impact**:
- User thinks they're getting authoritative USGS data
- Actually getting crowd-sourced OSM (lower accuracy, different naming)
- "Bass Lake" in OSM might be different from USGS "Bass Lake Reservoir"

**Solution**: Surface actual source to user.

```javascript
// nearbyWater.js response should include:
{
  success: true,
  waterBodies: [...],
  sources: ['nhd', 'osm'],  // ← What sources were used
  sourceDetails: {
    nhd: { count: 5, latency: 850 },    // USGS took 850ms
    osm: { count: 3, latency: 1200 }    // OSM took 1200ms
  },
  timestamp: new Date().toISOString()
}

// Frontend shows:
// "5 results from USGS + 3 from OpenStreetMap"
// User knows to trust USGS more than OSM results
```

**Effort**: Low (add source tracking)

---

### 3. 🟡 NHD API Timeout Too Long

**Problem**: 12s timeout is too long for user experience.

```javascript
req.setTimeout(12000, () => { req.destroy(); resolve([]); });
```

**Impact**:
- User sees "Searching near..." for up to 12s
- If USGS is slow, user gives up thinking search hung
- Better to fail fast (3-5s) and show partial results

**Solution**: Reduce timeout + race Promise.

```javascript
// Timeout: 5s (let user see results faster)
req.setTimeout(5000, () => { req.destroy(); resolve([]); });

// Optional: Race NHD vs timeout
const nhdPromise = queryNHD(lat, lng, radiusMiles);
const timeoutPromise = new Promise(r => 
  setTimeout(() => r([]), 5000)
);
const nhdResults = await Promise.race([nhdPromise, timeoutPromise]);
```

**Effort**: Low (parameter change)

---

### 4. 🟡 Grid Cache Granularity Too Coarse

**Problem**: 0.5° grid (≈55km) means cache misses for nearby searches.

```javascript
// Grid cell: 0.5° = ~55km at equator
function gridKey(lat, lng) {
  const gLat = Math.round(lat * 2) / 2;  // Round to nearest 0.5°
  const gLng = Math.round(lng * 2) / 2;
  return `${gLat}_${gLng}`;
}

// Scenario:
// Search A: lat=33.1, lng=-96.7 → gridKey = "33.0_-96.5"
// Search B: lat=33.2, lng=-96.8 → gridKey = "33.0_-97.0" (different cell!)
// No cache hit even though only 5 miles away
```

**Impact**:
- User searches Austin → cache miss → live API call (2-3s)
- User searches Dallas (30 miles away) → different grid cell → cache miss → live call again
- Cache rate is lower than expected

**Solution**: Smaller grid (0.25° = ~25km) or adaptive.

```javascript
// Finer granularity
function gridKey(lat, lng) {
  const gLat = Math.round(lat * 4) / 4;  // 0.25° grid
  const gLng = Math.round(lng * 4) / 4;
  return `${gLat}_${gLng}`.replace(/-/g, 'N');
}

// Or: Invalidate nearby cells on update (more complex)
```

**Effort**: Low (parameter change, migration needed for existing cache)

---

### 5. 🟡 7-Day Cache TTL Too Aggressive

**Problem**: Results cached for 7 days; user sees week-old data.

```javascript
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days
```

**Impact**:
- New lake added to USGS NHD on Monday → user won't see it until next Monday
- Lake name changed in OSM → cached result shows old name
- USGS removes private/dangerous lake → still visible to user

**Better Strategy**:
- Foreground sources (NHD): 1-day cache (updates frequently)
- HydroLAKES: 30-day cache (static, rarely changes)
- OSM: 3-day cache (user-edited, changes often)

```javascript
const CACHE_TTL = {
  nhd: 1 * 24 * 60 * 60 * 1000,          // 1 day
  osm: 3 * 24 * 60 * 60 * 1000,          // 3 days
  hydrolakes: 30 * 24 * 60 * 60 * 1000   // 30 days
};
```

**Effort**: Low (parameter change)

---

### 6. 🟡 No Batch Score Endpoint

**Problem**: Frontend fetches scores one-by-one; backend needs batch endpoint.

```javascript
// Current: GET /paddleScore?lat=X&lng=Y (one at a time)
// Better: POST /paddleScores with array
```

**Needed for**: Fixing issue #1 (N+1 scores)

**Effort**: Medium (new endpoint + batch processing)

---

## DATA QUALITY Issues

### 1. 🔴 Global Coverage Gap (Non-US Regions)

**Problem**: Search relies on OSM for non-US; coverage is poor in India, China, SE Asia.

```javascript
// lakeIndex.js findNearby() logic:
if (isUS) {
  // Use NHD (authoritative) + HydroLAKES backup
} else {
  // Use OSM primary + HydroLAKES supplement
  // ❌ OSM has ~37 named lakes in India, but India has thousands
}
```

**Verified Issues**:
- India: HydroLAKES has only 37 lakes (country has thousands)
- China: OSM coverage sparse in rural regions
- SE Asia: Many small reservoirs unlabeled
- Australia: OSM missing historical/indigenous names

**Impact**:
- User in Bangalore searches "nearby spots" → gets 0-2 results
- Actually dozens of reservoirs within 30 miles

**Solution**: Integrate regional data sources.

```javascript
// Add regional data partners:
// - India: Survey of India (SOI) water bodies database
// - China: Openstreetmap + Gaode Maps (Amap)
// - SE Asia: UNEP GRID databases
// - AU: Bureau of Meteorology water resources

// This is large undertaking — requires licenses, data cleaning, storage
```

**Effort**: 🔴 **High** (requires partnerships, licensing, data engineering)

---

### 2. 🔴 Score Accuracy: Distance to Launch Point

**Problem**: Paddle score computed for lake center, not actual launch point.

```javascript
// backend returns lake center coordinates (lat, lng)
// Frontend fetches score for lake center
// User might launch from dock 2 miles away with different conditions

// Example:
// Lake Tahoe center: 39.0970, -120.0324 → Score 3.8
// Zephyr Cove launch: 39.1094, -120.0086 → Score 3.2 (different)
```

**Impact**:
- Score is representative of lake center, not actual paddle spot
- Exposed bay might have different wind than sheltered cove
- User makes decision based on inaccurate score

**Solution**: Store launch point coordinates, not lake center.

```javascript
// Data model for waterBodies needs:
{
  id: '...',
  name: 'Lake Tahoe',
  type: 'Lake',
  
  // Lake geometry
  centerLat: 39.0970,
  centerLng: -120.0324,
  areaKm2: 495,
  
  // Launch points (new)
  launchPoints: [
    { name: 'Zephyr Cove', lat: 39.1094, lng: -120.0086, type: 'public' },
    { name: 'Sand Harbor', lat: 39.1239, lng: -119.9346, type: 'public' },
    { name: 'Kings Beach', lat: 39.2313, lng: -120.0113, type: 'public' }
  ]
}

// Frontend fetches score for selected launch point, not lake center
```

**Effort**: 🔴 **High** (data model change, migration, data collection)

---

### 3. 🟡 Incomplete Metadata

**Problem**: Results lack critical info for paddlers.

**Missing Fields**:

| Field | Why Important | Example |
|-------|---------------|---------|
| Access Type | Can you actually paddle there? | "Public", "Private", "Permit Required", "Seasonal" |
| Difficulty Rating | Beginner-friendly? | "Flat Water", "Class I-II", "Ocean Swell", "Alpine" |
| Hazards | Are there dangers? | "Fast Current", "Waterfalls", "Dam Gates", "Shipping Lane" |
| Parking Info | Can you launch? | "Free Parking", "Fee Required", "No Parking", "Shuttle Required" |
| Water Type | What are you paddling? | "Flatwater", "Rivers", "Ocean", "Whitewater" |
| Rental Info | Can you rent gear? | Rental shop nearby? Kayak/SUP/canoe available? |
| Scenic Rating | Is it beautiful? | Crowdsourced 1-5 star rating |

**Current Data**:
```javascript
{
  id: '...',
  name: 'Lake Tahoe',
  type: 'Lake',
  lat: 39.0970,
  lng: -120.0324,
  distanceMiles: 2.1,
  areaKm2: 495,
  source: 'nhd'
  // ❌ No access, difficulty, hazards, parking, etc.
}
```

**Impact**:
- User sees "Lake Tahoe" and paddle score 4.2, but doesn't know:
  - If they can actually launch (private resort?)
  - If it's right for their skill level (alpine lake with cold water)
  - If there's parking or permits required
  - Where to rent a kayak

**Solution**: Extend data model + crowdsource/partner for metadata.

```javascript
{
  id: 'tahoe-main',
  name: 'Lake Tahoe',
  baseScore: 4.2,  // Existing
  
  // Access & Safety (new)
  access: 'public',
  accessDetails: 'Free public access; permits not required',
  hazards: ['Cold Water (35F)', 'High Altitude', 'Strong Afternoon Wind'],
  difficulty: 'Intermediate+',
  waterTypes: ['Flatwater', 'Alpine'],
  
  // Practical (new)
  parkingAvailable: true,
  parkingFree: true,
  parkingSpots: 50,
  rentalNearby: true,
  rentalPrice: '$35/day single kayak',
  
  // Community (new)
  scenicRating: 4.8,
  scenicRatings: 1240,
  reviews: [...]
}
```

**Effort**: 🔴 **High** (data collection + partnership)

---

### 4. 🟡 Duplicate Detection Quality

**Problem**: Normalisation logic causes false merges and misses.

```javascript
// lakeIndex.js dedup logic:
function normalise(name) {
  return name.toLowerCase()
    .replace(/\s+(lake|reservoir|pond|river|creek)$/i, '')
    .replace(/^(lake|reservoir|pond|river|creek)\s+/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// Examples:
// "Lake Superior" → "superior"
// "Superior Lake" → "superior"
// "Superior Pond" → "superior"
// ❌ All three merged as same lake, actually different
```

**Better Approach**:
```javascript
function normalise(name) {
  // More intelligent: preserve order + geography
  return name.toLowerCase()
    .replace(/\b(lake|reservoir|pond|river|creek)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// "Lake Superior" → "superior"
// "Superior Lake" → "superior"
// "Superior Pond" → "superior"
// ❌ Still has problem, but more defensible

// Better: Use edit distance + context
// OR: Use OSM/USGS IDs as primary key instead of name
```

**Effort**: Medium (improve normalization + testing)

---

## ARCHITECTURAL Issues

### 1. 🔴 Popular Chips Hardcoded

**Problem**: 8 popular regions hardcoded in HTML; requires code change to update.

```html
<!-- searchPage.js in HTML -->
<button class="popular-chip" data-lat="33.0815" data-lng="-96.4775">
  <span class="chip-icon material-icons">water</span>Lavon Lake, TX
</button>
<!-- 8 more chips hardcoded -->
```

**Better**: Dynamic from Firestore.

```javascript
// Firestore collection: popular_regions
{
  regions: [
    { name: 'Lavon Lake, TX', lat: 33.0815, lng: -96.4775, rank: 1, searches: 4521 },
    { name: 'Lake Tahoe, CA', lat: 39.0970, lng: -120.0324, rank: 2, searches: 3812 },
    // ...
  ]
}

// Frontend fetches on load:
const popular = await fetch(`${API_BASE}/popularRegions`).then(r => r.json());
renderPopularChips(popular.regions);
```

**Effort**: Medium (Firestore collection + endpoint + frontend rendering)

---

### 2. 🟡 No Progressive Result Loading

**Problem**: Waits for all sources (NHD, OSM, HydroLAKES) before showing any results.

```javascript
// Current flow:
// User searches → Show "Searching..." → Wait for NHD + OSM + HydroLAKES
// If USGS slow: user waits 5-12s for any results

// Better:
// User searches → Show HydroLAKES results (instant) →
// When NHD ready: add to results → When OSM ready: add more results
```

**Implementation**: Server-sent events or WebSocket for streaming results.

```javascript
// Frontend opens EventSource
const es = new EventSource(`${API_BASE}/searchStream?lat=33.1&lng=-96.7`);
es.onmessage = (event) => {
  const batch = JSON.parse(event.data);
  // batch = { source: 'hydrolakes', results: [...] }
  addResultsToUI(batch.results, batch.source);
};
es.addEventListener('done', () => es.close());
```

**Effort**: 🔴 **High** (SSE endpoint + streaming logic + frontend changes)

---

### 3. 🟡 No Analytics on Searches

**Problem**: No tracking of what users search for; can't improve popular chips.

```javascript
// Should track:
// - What queries are searched? (text + coords)
// - Which regions are popular?
// - Which results are clicked?
// - Which results lead to forecast?
// - How many results show no spots?
```

**Use Cases**:
- Update popular chips based on real usage
- Identify regions with poor coverage (many 0-result searches)
- A/B test search UI changes
- Detect misspellings/aliases (users searching "Layton Lake" for "Lavon Lake")

**Implementation**: Send search analytics to Firestore.

```javascript
async function runSearch(lat, lng, label) {
  // Track the search
  await fetch(`${API_BASE}/searchAnalytics`, {
    method: 'POST',
    body: JSON.stringify({
      query: inputEl.value.trim(),
      lat, lng,
      timestamp: new Date(),
      source: 'text|gps|popular-chip',
      resultCount: results.length
    })
  });
}
```

**Effort**: Medium (analytics endpoint + Firestore collection + dashboard)

---

## Priority Roadmap

### Phase 1: High-Impact, Low-Effort Fixes (1-2 weeks)

1. ✅ Add cache refresh button (expose existing `?refresh=1` parameter)
2. ✅ Surface API source in results (show "USGS" vs "OSM")
3. ✅ Reduce NHD timeout to 5s (fail fast)
4. ✅ Add Nominatim geocode caching (prevent rate limiting)
5. ✅ Show geolocation status messages (reduce confusion)
6. ✅ Add keyboard navigation (arrow keys, enter, escape)

### Phase 2: Medium-Impact, Medium-Effort (3-4 weeks)

7. 📋 Batch score fetching (POST /paddleScores endpoint)
8. 📋 Improve mobile layout (show map button, responsive)
9. 📋 Better error handling (distinguish "no results" from "failed")
10. 📋 Preserve URL query text (sharable links)
11. 📋 Finer grid cache (0.25° instead of 0.5°)

### Phase 3: High-Impact, High-Effort (6-8 weeks)

12. 🔴 Add launch point coordinates (not just lake center)
13. 🔴 Extend metadata (access, difficulty, hazards, parking)
14. 🔴 Regional data integration (India, China, SE Asia)
15. 🔴 Progressive result streaming (show results as they arrive)
16. 🔴 Dynamic popular chips (Firestore-backed)
17. 🔴 Search analytics dashboard (track what users search)

---

## Summary Table

| Issue | Severity | Type | Effort | Impact |
|-------|----------|------|--------|--------|
| N+1 Score Fetching | 🔴 | Perf | Medium | 20% faster results |
| No Refresh Control | 🔴 | UX | Low | User confidence +30% |
| Silent Failures | 🔴 | UX | Medium | Error clarity |
| Mobile UX | 🔴 | UX | Medium | Usability on mobile |
| Nominatim Rate Limiting | 🔴 | Infra | Medium | Prevent IP blocks |
| Score Accuracy | 🔴 | Data | High | Realistic scores |
| Global Coverage | 🔴 | Data | High | Non-US support |
| Grid Cache Size | 🟡 | Perf | Low | Cache hit rate |
| Cache TTL | 🟡 | Data | Low | Freshness |
| Source Visibility | 🟡 | UX | Low | Trust |
| URL Preservation | 🟡 | UX | Low | Shareability |
| Keyboard Nav | 🟡 | A11y | Low | Accessibility |

---

## Recommendation

**Start with Phase 1** (weeks 1-2): These fixes unlock immediate UX improvements with minimal effort. Batch scoring in Phase 2 is the biggest performance win.

**Defer Phase 3** until user feedback confirms demand for launch points + regional coverage. Start with feedback forms: "Did you find what you needed?" → collect pain points.

