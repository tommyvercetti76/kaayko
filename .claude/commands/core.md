You are working on the **Core module** of Kaayko (`/Users/Rohan/Kaayko_v6/kaayko`).

Core covers the paddle forecast app and static marketing pages.

## Pages
| URL | File |
|-----|------|
| `/paddlingout` | `kaayko/src/paddlingout.html` — main paddle forecast (ML-scored conditions) |
| `/about` | `kaayko/src/about.html` — static |
| `/reads` | `kaayko/src/reads.html` — blog/articles |
| `/testimonials` | `kaayko/src/testimonials.html` — static |
| `/privacy` | `kaayko/src/privacy.html` — static |
| `/valentine` | `kaayko/src/valentine.html` — seasonal campaign (uses `/api/valentine` endpoint) |
| `/redirect` | `kaayko/src/redirect.html` — redirect loader (spinner UI, used by smart link flow) |
| `/` | `kaayko/src/index.html` — redirects → /paddlingout |
| `/404` | `kaayko/src/404.html` — Firebase default error page |

## JS files (paddlingout)
- `kaayko/src/js/paddlingout.js` — main logic, card rendering, carousel
- `kaayko/src/js/services/apiClient.js` — fetch wrapper with fallback generation + caching
- `kaayko/src/js/components/RatingHero.js` — paddle score display
- `kaayko/src/js/components/WeatherStats.js` — weather data
- `kaayko/src/js/components/SafetyWarnings.js` — safety alerts
- `kaayko/src/js/customLocation.js` — custom location search
- `kaayko/src/js/advancedModal.js` — spot detail modal
- `kaayko/src/js/header.js` — shared header (used across all pages)
- `kaayko/src/js/main.js` — main bootstrap
- `kaayko/src/js/kaayko-main.js` — main app init

## API files (correct paths — note `weather/` subdirectory)
- `kaayko-api/functions/api/weather/paddlingout.js` — paddle spots route
- `kaayko-api/functions/api/weather/paddleScore.js` — ML scoring model
- `kaayko-api/functions/api/weather/fastForecast.js` — cached weather
- `kaayko-api/functions/api/weather/forecast.js` — premium on-demand
- `kaayko-api/functions/api/weather/nearbyWater.js` — nearby water search
- `kaayko-api/functions/api/core/` — health check, docs endpoints

## APIs used
```
# Paddle forecast (public, no auth)
GET  /api/paddlingOut                          → all spots with ML scores + weather
GET  /api/paddlingOut/{id}                    → single spot detail
GET  /api/paddleScore?location={lat},{lon}    → ML score for custom location
GET  /api/fastForecast?location=...           → cached weather (free)
GET  /api/forecast?location=...              → premium on-demand weather
GET  /api/nearbyWater?lat=&lon=              → nearby water bodies

# Health / docs
GET  /api/health                              → API health check
GET  /api/docs                                → API spec (spec.yaml / spec.json)
```

## Firestore collections
- `paddlingSpots` — spot definitions (location, imgSrc, parkingAvl, restroomsAvl, paddleScore)
- `forecast_cache` — cached weather data (TTL-based)
- `current_conditions_cache` — cached current conditions

## External services
- **Open-Meteo API** (free, no auth) — weather data
- **Marine API** — wave/marine conditions

## Auth
All public. No auth required.

## Task
$ARGUMENTS
