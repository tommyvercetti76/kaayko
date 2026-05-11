# Paddling Out — UI/UX Design Principles

**Design system codification for Paddling Out.** Every visual, interactive, and responsive element follows these rules. This is the single source of truth for design decisions.

---

## Design Philosophy

**Core Principle**: Paddling Out is a dark-themed, water-focused experience. No light mode, no exceptions. Design for the ocean, the water, the athlete.

**Visual Hierarchy**:
1. **Hero Content** — Paddling spot name, score, hero image (largest, most prominent)
2. **Score Badge** — Paddle score (1–5) with color coding (smallest highlight)
3. **Conditions** — Wind, waves, temperature (secondary info)
4. **Interactive Elements** — Buttons, links, carousel controls (discoverable but not intrusive)
5. **Metadata** — Timestamps, source attribution (smallest text)

**Design Constraints**:
- ✅ Dark theme only (#080808 background, #ede8df text)
- ✅ Responsive first (mobile 360px → tablet 768px → desktop 1025px+)
- ✅ Accessibility mandatory (WCAG AA minimum, keyboard nav)
- ✅ Performance critical (images lazy-loaded, CSS minimal, fonts preconnected)
- ❌ No framework components (no shadcn, no MUI, no Bootstrap)
- ❌ No animations unless they reduce cognitive load
- ❌ No light mode CSS or theme toggle

---

## Brand System

### Color Tokens (CSS Custom Properties)

All colors defined in `src/css/paddlingout.css`:

```css
:root {
  /* Base palette */
  --bg: #080808;              /* Page background */
  --bg-secondary: #1a1a1a;    /* Card backgrounds, overlays */
  --fg: #ede8df;              /* Primary text */
  --fg-secondary: #a89e8f;    /* Secondary text, captions */
  --border: #2a2a2a;          /* Card borders, dividers */

  /* Brand accent (gold) */
  --gold: #b5935a;            /* Primary accent buttons */
  --gold-bright: #d4b896;     /* Hover state */
  --gold-dark: #8a6a3a;       /* Active/pressed state */

  /* Score colors (Paddle Score 1–5) */
  --score-critical: #c53030;  /* 1–1.5: Red (don't paddle) */
  --score-warning: #ed8936;   /* 1.5–2.5: Orange (marginal) */
  --score-moderate: #ecc94b;  /* 2.5–3.5: Yellow (okay) */
  --score-good: #48bb78;      /* 3.5–4.5: Green (good) */
  --score-excellent: #38a169; /* 4.5–5: Dark green (excellent) */

  /* Utility colors */
  --success: #48bb78;
  --error: #c53030;
  --info: #3182ce;
  --warning: #ed8936;

  /* Semantic */
  --temperature-cold: #3182ce;  /* Cold water */
  --temperature-warm: #ed8936;  /* Warm water */
  --wind-calm: #48bb78;         /* Low wind */
  --wind-strong: #c53030;       /* High wind */
}

/* Dark theme enforced (no light mode) */
body {
  background: var(--bg);
  color: var(--fg);
}

body.light-mode {
  /* This must never apply. Block it. */
  display: none !important;
}
```

### Typography

```css
/* Font stack (system + Google Fonts fallback) */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
               'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans',
               'Droid Sans', 'Helvetica Neue', sans-serif;
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Headings: bold, high contrast */
h1 {
  font-size: 2.5rem;     /* 40px */
  font-weight: 700;
  line-height: 1.2;
  color: var(--fg);
  margin: 1.5rem 0 1rem 0;
}

h2 {
  font-size: 1.875rem;   /* 30px */
  font-weight: 600;
  line-height: 1.3;
  color: var(--fg);
  margin: 1.25rem 0 0.75rem 0;
}

h3 {
  font-size: 1.25rem;    /* 20px */
  font-weight: 600;
  color: var(--fg);
}

/* Body text */
p {
  font-size: 1rem;       /* 16px */
  line-height: 1.6;
  color: var(--fg);
}

/* Secondary text (captions, timestamps) */
.caption {
  font-size: 0.875rem;   /* 14px */
  color: var(--fg-secondary);
  line-height: 1.4;
}

.tiny {
  font-size: 0.75rem;    /* 12px */
  color: var(--fg-secondary);
}

/* Monospace for values */
.value, code {
  font-family: 'Courier New', monospace;
  font-size: 0.95rem;
  background: var(--bg-secondary);
  padding: 0.25rem 0.5rem;
  border-radius: 2px;
}
```

### Spacing Scale

```css
/* Consistent spacing based on 8px grid */
:root {
  --sp-xs: 0.25rem;   /* 4px — tight spacing */
  --sp-sm: 0.5rem;    /* 8px — small gap */
  --sp-md: 1rem;      /* 16px — default gap */
  --sp-lg: 1.5rem;    /* 24px — loose gap */
  --sp-xl: 2rem;      /* 32px — large gap */
  --sp-2xl: 3rem;     /* 48px — extra large */
}

/* Usage */
.card { padding: var(--sp-lg); }       /* 24px padding */
.section { margin: var(--sp-2xl) 0; }  /* 48px top/bottom */
```

### Shadows & Elevation

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.6);
}

.card { box-shadow: var(--shadow-md); }
.modal { box-shadow: var(--shadow-xl); }
.button:hover { box-shadow: var(--shadow-lg); }
```

### Border & Radius

```css
:root {
  --radius-sm: 2px;      /* Minimal rounding */
  --radius-md: 4px;      /* Default rounding */
  --radius-lg: 8px;      /* Card/panel rounding */
  --radius-xl: 12px;     /* Large components */
  --radius-full: 9999px; /* Pills, circles */
}

.card { border-radius: var(--radius-lg); }
.button { border-radius: var(--radius-md); }
.button.pill { border-radius: var(--radius-full); }
.badge { border-radius: var(--radius-sm); }
```

---

## Component Patterns

### Card (Base Container)

```html
<div class="card">
  <h2 class="card-title">Spot Name</h2>
  <p class="card-subtitle">Distance, difficulty</p>
  <img src="..." alt="..." class="card-image" loading="lazy">
  <div class="card-content">
    <p>Description text</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-lg);
  box-shadow: var(--shadow-md);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.card-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--fg);
  margin: 0 0 0.25rem 0;
}

.card-subtitle {
  font-size: 0.875rem;
  color: var(--fg-secondary);
  margin: 0;
}

.card-image {
  width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  margin: var(--sp-md) 0;
  object-fit: cover;
}

.card-content { margin: var(--sp-md) 0; }
.card-footer { margin-top: var(--sp-lg); }
```

### Button (Action Element)

```html
<!-- Primary action -->
<button class="btn btn-primary">Explore Spot</button>

<!-- Secondary action -->
<button class="btn btn-secondary">Learn More</button>

<!-- Text-only link -->
<a href="#" class="btn-link">View Details →</a>

<!-- Icon button (carousel nav) -->
<button class="btn-icon" aria-label="Next image">
  <svg><!-- arrow icon --></svg>
</button>
```

```css
.btn {
  font-size: 1rem;
  font-weight: 600;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.3s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-sm);
}

.btn-primary {
  background: var(--gold);
  color: var(--bg);
}
.btn-primary:hover { background: var(--gold-bright); }
.btn-primary:active { background: var(--gold-dark); }
.btn-primary:disabled {
  background: var(--fg-secondary);
  color: var(--bg-secondary);
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-secondary {
  background: transparent;
  color: var(--gold);
  border: 2px solid var(--gold);
}
.btn-secondary:hover {
  background: var(--gold);
  color: var(--bg);
}

.btn-link {
  background: none;
  border: none;
  color: var(--gold);
  cursor: pointer;
  font-weight: 600;
  text-decoration: none;
  padding: 0;
}
.btn-link:hover { text-decoration: underline; }

.btn-icon {
  background: transparent;
  border: none;
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--radius-full);
  transition: background 0.3s ease;
}
.btn-icon:hover { background: var(--bg-secondary); }

.btn:disabled { opacity: 0.5; cursor: not-allowed; }
```

### Badge (Score Indicator)

```html
<!-- Paddle score badge -->
<div class="badge badge-score-good">
  <span class="badge-value">4.2</span>
  <span class="badge-label">Good</span>
</div>

<!-- Condition badge (wind, temperature) -->
<div class="badge badge-condition-wind">
  <span class="icon">🌬️</span>
  <span class="text">15 knots</span>
</div>
```

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-xs);
  padding: 0.5rem 1rem;
  border-radius: var(--radius-full);
  font-size: 0.875rem;
  font-weight: 600;
  backdrop-filter: blur(4px);
}

.badge-score-critical { background: var(--score-critical); color: white; }
.badge-score-warning { background: var(--score-warning); color: var(--bg); }
.badge-score-moderate { background: var(--score-moderate); color: var(--bg); }
.badge-score-good { background: var(--score-good); color: var(--bg); }
.badge-score-excellent { background: var(--score-excellent); color: white; }

.badge-condition-wind { background: rgba(72, 187, 120, 0.2); color: var(--wind-calm); }
.badge-condition-cold { background: rgba(49, 130, 206, 0.2); color: var(--temperature-cold); }

.badge-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.badge-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  opacity: 0.9;
}
```

### Image Carousel

```html
<div class="carousel">
  <div class="carousel-container">
    <img src="..." alt="..." class="carousel-image active" loading="lazy">
    <img src="..." alt="..." class="carousel-image" loading="lazy">
    <img src="..." alt="..." class="carousel-image" loading="lazy">
  </div>

  <div class="carousel-controls">
    <button class="carousel-arrow carousel-prev" aria-label="Previous">❮</button>
    <div class="carousel-dots">
      <button class="carousel-dot active" data-index="0"></button>
      <button class="carousel-dot" data-index="1"></button>
      <button class="carousel-dot" data-index="2"></button>
    </div>
    <button class="carousel-arrow carousel-next" aria-label="Next">❯</button>
  </div>
</div>
```

```css
.carousel {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-lg);
}

.carousel-container {
  position: relative;
  width: 100%;
  padding-bottom: 66.66%;  /* 3:2 aspect ratio */
}

.carousel-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.5s ease;
}

.carousel-image.active {
  opacity: 1;
}

.carousel-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-md);
  background: rgba(0, 0, 0, 0.5);
  position: absolute;
  bottom: 0;
  width: 100%;
}

.carousel-arrow {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: var(--fg);
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: var(--radius-md);
  transition: background 0.3s ease;
}

.carousel-arrow:hover {
  background: rgba(255, 255, 255, 0.2);
}

.carousel-dots {
  display: flex;
  gap: 0.5rem;
}

.carousel-dot {
  width: 8px;
  height: 8px;
  border: none;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  transition: background 0.3s ease;
}

.carousel-dot.active {
  background: var(--gold);
}
```

### Form Input

```html
<div class="form-group">
  <label for="location">Location</label>
  <input
    type="text"
    id="location"
    name="location"
    class="input"
    placeholder="City, state, or ZIP"
    required
  >
  <span class="input-error" role="alert">Invalid location</span>
</div>

<div class="form-group">
  <label for="rating">How was it?</label>
  <select id="rating" name="rating" class="select">
    <option value="">-- Select --</option>
    <option value="1">1: Didn't paddle</option>
    <option value="2">2: Challenging</option>
    <option value="3">3: Good</option>
    <option value="4">4: Excellent</option>
    <option value="5">5: Epic</option>
  </select>
</div>
```

```css
.form-group {
  margin-bottom: var(--sp-lg);
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 600;
  margin-bottom: var(--sp-sm);
  color: var(--fg);
}

.input, .select {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--fg);
  font-size: 1rem;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.input:focus, .select:focus {
  outline: none;
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(181, 147, 90, 0.1);
}

.input:disabled, .select:disabled {
  background: var(--bg);
  opacity: 0.5;
  cursor: not-allowed;
}

.input-error {
  color: var(--error);
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.input-error:empty {
  display: none;
}
```

---

## Responsive Patterns

### Mobile-First Grid

```css
/* Default: mobile (360px+) — single column */
.card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--sp-lg);
  padding: var(--sp-lg);
}

/* Tablet (768px+) — 2 columns */
@media (min-width: 768px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop (1025px+) — 3+ columns */
@media (min-width: 1025px) {
  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    max-width: 1400px;
    margin: 0 auto;
  }
}
```

### Touch-Friendly Layout

```css
/* Mobile: larger touch targets */
@media (max-width: 767px) {
  .btn {
    min-height: 44px;        /* Min touch target */
    min-width: 44px;
  }

  .carousel-dot {
    width: 10px;             /* Larger dots */
    height: 10px;
  }

  h1 {
    font-size: 1.75rem;      /* Smaller on mobile */
  }

  /* Full-width forms on mobile */
  .form-group {
    width: 100%;
  }
}

/* Desktop: normal sizing */
@media (min-width: 768px) {
  .btn {
    min-height: auto;
  }

  .carousel-dot {
    width: 8px;
    height: 8px;
  }

  h1 {
    font-size: 2.5rem;
  }
}
```

### Landscape vs Portrait

```css
/* Portrait (tall) — stack sections vertically */
@media (orientation: portrait) {
  .forecast-layout {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xl);
  }
}

/* Landscape (wide) — side-by-side */
@media (orientation: landscape) {
  .forecast-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-xl);
  }
}
```

---

## Accessibility Patterns

### Color Contrast

All text must meet WCAG AA minimum (4.5:1 for body, 3:1 for large text).

```css
/* ✅ GOOD: 8.5:1 contrast */
color: var(--fg);           /* #ede8df on #080808 */
background: var(--bg);

/* ✅ GOOD: 3.8:1 contrast (large text) */
color: var(--gold);         /* #b5935a on #080808 */
font-size: 1.5rem;

/* ❌ BAD: 2.1:1 contrast (fails) */
color: var(--fg-secondary); /* #a89e8f on #080808 */
font-size: 0.875rem;        /* Small text + low contrast */
```

### Keyboard Navigation

All interactive elements must be keyboard-accessible:

```html
<!-- Use semantic HTML -->
<button>Click me</button>        <!-- Good: native focus -->
<a href="#section">Link</a>      <!-- Good: native focus -->
<input type="text">              <!-- Good: native focus -->

<!-- If using div: add role + tabindex -->
<div role="button" tabindex="0" onclick="handler()">
  <!-- This is a fallback; prefer semantic HTML -->
</div>
```

```css
/* Focus states visible on ALL interactive elements */
button:focus, a:focus, input:focus {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}

/* Remove default outline ONLY if replacing with custom */
button:focus {
  outline: 2px solid var(--gold);
}
```

### ARIA Labels

```html
<!-- Button with icon only: add aria-label -->
<button class="btn-icon" aria-label="Next image">
  ❯
</button>

<!-- Carousel: add ARIA live region -->
<div class="carousel" role="region" aria-label="Spot images carousel">
  <!-- ... carousel content ... -->
</div>

<!-- Loading state: announce to screen readers -->
<div aria-live="polite" aria-busy="true">
  Loading forecast data...
</div>

<!-- Error message: link to form field -->
<input id="email" type="email">
<span id="email-error" role="alert">Invalid email</span>
```

### Screen Reader Hints

```css
/* Hide from sighted users but visible to screen readers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Usage */
<button>
  <span aria-hidden="true">❤️</span>
  <span class="sr-only">Like this spot</span>
</button>
```

---

## Performance Patterns

### Image Optimization

```html
<!-- Lazy loading: defer offscreen images -->
<img
  src="..."
  alt="Spot name"
  loading="lazy"
  width="600"
  height="400"
>

<!-- Responsive images: serve correct size -->
<img
  src="small.jpg"
  srcset="small.jpg 480w, medium.jpg 768w, large.jpg 1200w"
  sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 33vw"
  alt="Spot name"
  loading="lazy"
>

<!-- WebP fallback for old browsers -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Spot name" loading="lazy">
</picture>
```

### CSS Performance

```css
/* ✅ Minimal CSS: only needed rules */
.card {
  padding: var(--sp-lg);
  border-radius: var(--radius-lg);
}

/* ❌ Over-specified: unused rules */
.card {
  padding: var(--sp-lg);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
  transform: translateZ(0);      /* Force GPU: not needed */
  will-change: transform;        /* Not animating: remove */
}

/* ✅ Use CSS variables for DRY colors */
:root { --gold: #b5935a; }
button { background: var(--gold); }

/* ❌ Hardcoded colors everywhere */
button { background: #b5935a; }
link { color: #b5935a; }
badge { border: 2px solid #b5935a; }
```

### Font Loading

```html
<!-- Preconnect to Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Load fonts with font-display: swap (show fallback immediately) -->
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
  rel="stylesheet"
>

<!-- Reduce by not using custom fonts if system fonts suffice -->
<!-- Paddling Out uses system fonts only (no Google Fonts load) -->
```

---

## Animation Guidelines

Use animations sparingly and only when they reduce cognitive load.

```css
/* ✅ GOOD: hover feedback (user expects it) */
.btn:hover {
  background: var(--gold-bright);
  transition: background 0.3s ease;  /* Noticeable but not jarring */
}

/* ✅ GOOD: loading indicator (communicates async action) */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.loader {
  animation: spin 1s linear infinite;
}

/* ❌ BAD: entrance animation (distracting, slows perception) */
.card {
  animation: slideInLeft 0.8s ease-out;  /* Don't do this */
}

/* ❌ BAD: pointless animation (wastes CPU) */
.title {
  animation: pulse 2s infinite;          /* User doesn't care */
}

/* Animation timing: keep it fast (300-500ms) */
.element {
  transition: all 0.3s ease;  /* Good */
  transition: all 2s ease;    /* Too slow; feels laggy */
}
```

---

## Dark Theme Enforcement

Paddling Out is dark-only. No light mode.

```css
/* ✅ Enforce dark background */
body {
  background: var(--bg);     /* #080808 */
  color: var(--fg);          /* #ede8df */
}

/* ✅ Prevent light mode from ever applying */
@media (prefers-color-scheme: light) {
  body {
    background: var(--bg) !important;
    color: var(--fg) !important;
  }
}

/* ❌ NEVER: add light mode styles */
body.light-mode {
  background: #ffffff;       /* DON'T DO THIS */
}

/* ❌ NEVER: add theme toggle */
<button id="theme-toggle">Toggle Dark/Light</button>  <!-- DON'T DO THIS -->
```

---

## Design QA Checklist

Before shipping any change:

- [ ] **Contrast**: All text passes WCAG AA (use WebAIM contrast checker)
- [ ] **Responsive**: Works on 360px (mobile), 768px (tablet), 1025px+ (desktop)
- [ ] **Touch**: Buttons ≥44px tall, spacing ≥8px between touch targets
- [ ] **Dark theme**: Only dark colors used (no light mode leaks)
- [ ] **Images**: Lazy-loaded (loading="lazy"), alt text present
- [ ] **Animations**: None that distract (only hover/loading feedback)
- [ ] **Performance**: <2.5s load time for detail pages, <1.5s for list
- [ ] **Keyboard**: Tab navigates all interactive elements
- [ ] **Mobile**: No horizontal scroll, font scales well
- [ ] **Brand tokens**: Only CSS variables used (no hardcoded colors)

---

## File Organization

```
src/
  ├── paddlingout.html              # List page
  ├── paddlingout/
  │   ├── forecast.html             # Forecast detail
  │   ├── rate.html                 # Rating form
  │   └── search.html               # Geo search
  ├── css/
  │   ├── paddlingout.css           # Brand tokens + shared styles
  │   └── forecast.css              # Forecast page overrides
  ├── js/
  │   ├── paddlingout.js            # List logic
  │   ├── services/
  │   │   └── apiClient.js          # API client
  │   └── components/
  │       ├── RatingHero.js         # Score badge
  │       ├── SafetyWarnings.js     # Alert system
  │       └── Heatmap.js            # Forecast grid
```

---

## Last Updated

May 11, 2026 — locked down after production optimization.
