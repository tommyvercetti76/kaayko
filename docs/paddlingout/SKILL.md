# Paddling Out — Specialized SKILL Instructions

**Tactical playbook for Paddling Out development.** Use this when working on features, optimizations, bug fixes, or new pages within the Paddling Out product.

---

## When to Use This Skill

Invoke this skill when you:
- Add a feature to any Paddling Out page (list, forecast, rate, search)
- Optimize load time, carousel performance, or API response handling
- Fix bugs in card rendering, forecast heatmap, or carousel navigation
- Create a new Paddling Out page or component
- Refactor API client or data fetching logic
- Update styling, colors, or responsive breakpoints

Do NOT use when:
- Working on non-Paddling Out pages (STORE, KORTEX, KAMERA_QUEST, etc.)
- Changing global layout or header/footer styles
- Modifying Firebase security rules or Cloud Functions unrelated to paddle APIs

---

## Pre-Work Checklist

Before starting ANY task:

1. **Understand current state**: Run `git log --oneline -5 -- "src/paddlingout*" "src/css/paddlingout.css" "src/js/paddlingout.js"` → see recent commits
2. **Test baseline**: Open `/paddlingout.html` locally; confirm list loads, carousel works, forecast links work
3. **Check error console**: `F12 → Console` → note any existing errors (API fails, missing images, script errors)
4. **Identify scope**: Is this frontend-only, API-only, or both? (Affects testing strategy)

---

## Frontend Development Workflow

### Pattern 1: Add a New Page (e.g., new analysis page)

```bash
# 1. Create HTML file
cp src/paddlingout/forecast.html src/paddlingout/analysis.html

# 2. Edit HTML structure, meta tags, script refs
# 3. Create dedicated CSS file
cp src/css/forecast.css src/css/analysis.css

# 4. Create JS logic file
touch src/js/paddlingoutAnalysis.js

# 5. Link in HTML:
# <script type="module" src="/js/paddlingoutAnalysis.js"></script>

# 6. Test locally:
npm run dev
# Visit: http://localhost:3000/paddlingout/analysis.html

# 7. Commit
git add -A
git commit -m "feat(paddlingout): add analysis page for trends"
```

**Critical template elements to keep:**
- Dark theme meta tags + `<script>document.documentElement.classList.add('dark-theme');</script>`
- Favicon link: `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">`
- Fonts preconnect: `<link rel="preconnect" href="https://fonts.googleapis.com">`
- API client script before page logic: `<script src="/js/services/apiClient.js"></script>`
- Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `referrer`

### Pattern 2: Add a Feature to Existing Page

```javascript
// Example: Add "export as PDF" button to forecast page

// 1. HTML: add button to template
<button id="exportPdfBtn" class="forecast-action">📄 Export PDF</button>

// 2. CSS: style it (use brand colors)
.forecast-action {
  background: var(--gold);
  color: var(--bg);
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s var(--ease);
}
.forecast-action:hover { background: var(--gold-bright); }

// 3. JS: wire the handler (in forecast.html <script type="module">)
document.getElementById('exportPdfBtn').addEventListener('click', async () => {
  const canvas = await html2canvas(document.querySelector('.forecast-content'));
  const pdf = new jsPDF();
  // ... pdf.save(...) ...
});

// 4. Test: click button, confirm PDF downloads
// 5. Commit
git add src/paddlingout/forecast.html src/css/forecast.css
git commit -m "feat(paddlingout): add PDF export to forecast"
```

### Pattern 3: Optimize API Call

```javascript
// BEFORE: Sequential fetches (slow)
const spot = await fetch(`/paddlingOut/${id}`).then(r => r.json());
const score = await fetch(`/paddleScore?spotId=${id}`).then(r => r.json());
const forecast = await fetch(`/fastForecast?lat=${spot.location.latitude}&lng=${spot.location.longitude}`).then(r => r.json());

// AFTER: Parallel fetches (faster)
const [spot, score, forecast] = await Promise.all([
  fetch(`/paddlingOut/${id}`).then(r => r.json()),
  fetch(`/paddleScore?spotId=${id}`).then(r => r.json()),
  fetch(`/fastForecast?lat=${spot.location.latitude}&lng=${spot.location.longitude}`).then(r => r.json())
]);
```

**Measure impact:**
```javascript
const start = performance.now();
// ... fetch code ...
console.log(`⏱ Data fetched in ${performance.now() - start}ms`);
```

### Pattern 4: Add Component Reuse

```javascript
// If carousel logic is duplicated across pages:

// 1. Extract to component
// src/js/components/ImageCarousel.js
export class ImageCarousel {
  constructor(container, images) {
    this.container = container;
    this.images = images;
    this.currentIndex = 0;
    this.render();
    this.wireEvents();
  }

  render() {
    // ... image + dot + arrow rendering ...
  }

  wireEvents() {
    // ... carousel nav event listeners ...
  }

  next() { /* ... */ }
  prev() { /* ... */ }
}

// 2. Use in page
import { ImageCarousel } from '/js/components/ImageCarousel.js';

const carousel = new ImageCarousel(
  document.querySelector('.img-container'),
  spot.imgSrc
);
```

### Pattern 5: Responsive Design Audit

```bash
# 1. Test on real devices or Chrome DevTools
# Ctrl+Shift+M or Cmd+Shift+M to toggle device toolbar

# 2. Check breakpoints: 360px, 768px, 1025px+
# 3. Verify:
#   - Text is readable (not tiny)
#   - Buttons are tappable (>44px tall)
#   - Images scale correctly
#   - No horizontal scroll

# 4. Common issues & fixes:
# Issue: Text too small on mobile
# Fix: @media (max-width: 768px) { h1 { font-size: 1.5rem; } }

# Issue: Images overflow on narrow screens
# Fix: img { max-width: 100%; height: auto; }

# Issue: Card grid too cramped
# Fix: @media (max-width: 767px) { .container { grid-template-columns: 1fr; } }
```

---

## API Development Workflow (Backend)

### Pattern 1: Add a New Endpoint (kaayko-api)

```javascript
// functions/api/weather/paddleNewFeature.js

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

// GET /paddleNewFeature?spotId=X&param=Y
router.get('/', async (req, res) => {
  const { spotId, param } = req.query;

  // Validate inputs
  if (!spotId) return res.status(400).json({ error: 'spotId required' });

  try {
    // Fetch data
    const doc = await db.collection('paddlingSpots').doc(spotId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Spot not found' });

    const spot = doc.data();

    // Compute result
    const result = {
      success: true,
      spotId,
      feature: computeFeature(spot, param)
    };

    // Cache result if appropriate (7-day TTL)
    // await cacheService.set(`feature_${spotId}`, result, 7 * 24 * 60 * 60);

    return res.json(result);
  } catch (error) {
    console.error('paddleNewFeature error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

### Pattern 2: Mount New Endpoint

```javascript
// functions/index.js

// Add to main API app:
const paddleNewFeature = require('./api/weather/paddleNewFeature');
apiApp.use('/paddleNewFeature', paddleNewFeature);

// Now accessible at: /paddleNewFeature?spotId=X
```

### Pattern 3: Update API Response Contract

```javascript
// BEFORE
res.json({ success: true, data: result });

// AFTER (aligned with Paddling Out contract)
res.json({
  success: true,
  spotId,
  result,
  metadata: {
    timestamp: new Date().toISOString(),
    source: 'paddleScore'
  }
});
```

### Pattern 4: Test Endpoint Locally

```bash
# 1. Start Firebase Emulator
firebase emulators:start

# 2. Test endpoint
curl 'http://localhost:5001/kaaykostore/us-central1/api/paddleScore?spotId=ambazari'

# 3. Check response format, error handling, latency
# 4. Update function if needed
# 5. Re-test
```

---

## Performance Checklist

### Frontend Performance

```bash
# 1. Measure first contentful paint
# Chrome DevTools → Network tab → (load page) → check DOMContentLoaded time

# Target: <1.5s for list, <2.5s for forecast (including data fetch)

# 2. Lazy-load images
# <img src="..." loading="lazy" alt="...">

# 3. Minimize CSS
# Only include used styles; remove `.old-class`, commented-out rules

# 4. Minimize JS
# Avoid large libraries; use native APIs (Fetch, Intl, etc.)

# 5. Check bundle size
# npm run build → check dist/ folder size
# Goal: <500KB for main bundle (uncompressed)
```

### API Performance

```bash
# 1. Log endpoint latency
console.time('paddleScore');
const result = await computePaddleScore(spotId);
console.timeEnd('paddleScore');

# 2. Set cache TTLs appropriately
#   - Paddle Score: 15 min (changes as weather updates)
#   - Forecast: 1 hour (WeatherAPI updates hourly)
#   - Spot metadata: 7 days (rarely changes)

# 3. Use Firestore indexes for common queries
# firestore.indexes.json should have entries for:
#   - paddlingSpots (tenantId, status, createdAt)
#   - paddle_score_cache (tenantId, expiresAt)
```

---

## Debugging Workflow

### Common Issues & Solutions

**Issue**: Carousel doesn't advance
```javascript
// Check:
// 1. wireUpCarousels() called after renderCard()?
// 2. .carousel-image and .carousel-dot classes exist?
// 3. Event listeners wired? Check DevTools → Elements → event listeners

// Debug:
document.querySelector('.carousel-image.active').dataset.index; // Should show current
console.log('Carousel items:', document.querySelectorAll('.carousel-image').length);
```

**Issue**: API returns 404
```javascript
// Check:
// 1. Endpoint mounted in functions/index.js?
apiApp.use('/paddleNewFeature', require('./api/weather/paddleNewFeature'));

// 2. URL correct? /paddleNewFeature not /paddleNewFeatures
// 3. Firebase Functions deployed? gcloud functions list

// Test:
curl -i 'http://localhost:5001/kaaykostore/us-central1/api/paddleNewFeature?spotId=test'
```

**Issue**: Images not loading
```javascript
// Check:
// 1. Firebase Storage signed URLs correct?
// 2. Network tab → check image request URLs
// 3. CORS headers? (should be fine if same-origin)

// Fallback:
if (error in image load) {
  img.src = '/assets/generic-lake-placeholder.png';
}
```

**Issue**: Forecast heatmap shows no data
```javascript
// Check:
// 1. getFastForecast() returning valid response?
console.log('Forecast data:', forecast);

// 2. Hourly slots populated?
Object.keys(forecast.forecast[0].hourly).length > 0

// 3. CSS grid rendered?
document.querySelector('.forecast-heatmap').innerHTML !== ''
```

---

## Testing Strategies

### Manual Testing Checklist

- [ ] List page loads; all 100+ spots render
- [ ] Carousel: dots clickable, arrows work, keyboard nav (← →) optional
- [ ] Forecast: loads within 2.5s, heatmap shows 3 days, safety warnings appear
- [ ] Rate: form submits, success message shows, rate limiting works (5 per day)
- [ ] Search: geolocation works or manual entry works, results sorted by distance
- [ ] Responsive: works on 360px (mobile), 768px (tablet), 1025px+ (desktop)
- [ ] Dark theme: enforced; no light mode leaks
- [ ] Errors: API fail → fallback shown; geolocation denied → text input prompted

### Automated Testing (if setup exists)

```bash
# Run existing tests
npm test

# Example test structure:
// test/paddlingout.test.js
describe('Paddling Out', () => {
  it('loads list of spots', async () => {
    const response = await fetch('/api/paddlingOut');
    expect(response.ok).toBe(true);
    const { spots } = await response.json();
    expect(spots.length).toBeGreaterThan(0);
  });

  it('renders carousel', () => {
    const carousel = document.querySelector('.carousel-dots');
    expect(carousel.children.length).toBeGreaterThan(1);
  });
});
```

---

## Commit Message Template

```
feat(paddlingout): [page] — [what changed]

[description of change, why it was needed]

- [implementation detail 1]
- [implementation detail 2]
- [performance impact or testing notes]

Closes #[issue_number]
```

### Examples

```
feat(paddlingout): forecast — add safety warning system

Added inline alert component for dangerous conditions:
- Hypothermia warning (water <40°F)
- Heat alert (air >85°F)
- Storm warning (precip >60%)

- SafetyWarnings component imported + styled
- Warnings injected into forecast-hero section
- Tested on 5 lakes with varying conditions

Performance: +0ms (no API impact)
```

```
fix(paddlingout): search — parallel geocode + nearby fetch

Changed sequential fetch to Promise.all() for geolocation + nearby water.

- Before: ~3.5s total latency
- After: ~1.8s total latency (51% faster)

Tested with cities: San Francisco, Austin, NYC, Denver
```

---

## Git Workflow (Paddling Out Specific)

```bash
# 1. Create feature branch
git checkout -b feat/paddlingout-feature-name

# 2. Make changes
# (follow patterns above)

# 3. Test locally
npm run dev
# [manual testing]
npm test (if tests exist)

# 4. Commit
git add src/paddlingout* src/css/paddlingout* src/js/paddlingout*
git commit -m "feat(paddlingout): ..."

# 5. Push
git push origin feat/paddlingout-feature-name

# 6. Create PR
# (link to issue, describe changes, note performance impact)

# 7. After review: merge to main
# (use squash-and-merge if multiple small commits)

# 8. Verify production
# Push to main triggers deploy; check https://kaayko.com/paddlingout
```

---

## When to Escalate

Don't try to solve these alone; escalate to primary backend/infra team:

1. **API endpoints changing endpoint signature** → API contract impact
2. **Database schema changes** (new collections, Firestore rules) → consistency impact
3. **Cache strategy changes** (TTL, invalidation) → stale data risk
4. **Rate limiting logic changes** → spam/abuse risk
5. **Deployment/infra changes** → production reliability risk

---

## Quick Reference: File Map

| File | Purpose |
|------|---------|
| `src/paddlingout.html` | List page entry; card grid |
| `src/paddlingout/forecast.html` | Forecast detail; heatmap |
| `src/paddlingout/rate.html` | Public rating form |
| `src/paddlingout/search.html` | Geo-search by location |
| `src/css/paddlingout.css` | Shared styling (colors, tokens, grid) |
| `src/css/forecast.css` | Forecast page layout + heatmap |
| `src/js/paddlingout.js` | List page logic; card rendering |
| `src/js/services/apiClient.js` | Centralized API client (prod/emulator) |
| `src/js/components/RatingHero.js` | Score badge component |
| `src/js/components/SafetyWarnings.js` | Alert component |
| `src/js/components/Heatmap.js` | Forecast heatmap grid |
| `kaayko-api/functions/api/weather/paddleScore.js` | GET/POST paddle score endpoints |
| `kaayko-api/functions/api/weather/paddlingout.js` | GET spot list + single spot |
| `kaayko-api/functions/api/weather/nearbyWater.js` | Geo-search endpoint |
| `kaayko-api/functions/api/weather/fastForecast.js` | Cached forecast endpoint |

---

## Last Updated

May 11, 2026 — after phase 2-3 optimization and production deploy.
