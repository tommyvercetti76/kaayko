You are working on the **Core module** of Kaayko (`/Users/Rohan/Kaayko_v6`).

Core covers the paddle forecast app and static marketing pages.

## Scope — pages
| URL | File |
|-----|------|
| `/paddlingout` | `kaayko/src/paddlingout.html` — main paddle forecast (ML-scored conditions) |
| `/about` | `kaayko/src/about.html` — static |
| `/reads` | `kaayko/src/reads.html` — blog/articles |
| `/testimonials` | `kaayko/src/testimonials.html` — static |
| `/privacy` | `kaayko/src/privacy.html` — static |
| `/valentine` | `kaayko/src/valentine.html` — campaign/seasonal |

## Scope — JS files (paddlingout only)
- `kaayko/src/js/paddlingout.js` — main logic, card rendering, carousel
- `kaayko/src/js/services/apiClient.js` — fetch wrapper
- `kaayko/src/js/components/RatingHero.js` — paddle score display
- `kaayko/src/js/components/WeatherStats.js` — weather data
- `kaayko/src/js/components/SafetyWarnings.js` — safety alerts
- `kaayko/src/js/customLocation.js` — custom location search
- `kaayko/src/js/advancedModal.js` — spot detail modal

## Scope — API files
- `kaayko-api/functions/api/paddlingout.js`
- `kaayko-api/functions/api/weather.js`
- `kaayko-api/functions/api/paddleScore.js` — ML model

## APIs used
```
# Paddle forecast (public, no auth)
GET  /api/paddlingOut                         → all spots with ML scores + weather
GET  /api/paddlingOut/{id}                   → single spot detail
GET  /api/paddleScore?location={lat},{lon}   → ML score for custom location
GET  /api/fastForecast?location=...          → cached weather (free tier)
GET  /api/forecast?location=...             → premium on-demand weather
GET  /api/nearbyWater?lat=&lon=             → find nearby water bodies
```

## Paddle spot data shape
```js
{
  id, title, subtitle, text,
  location: { latitude, longitude },
  imgSrc: [...],
  parkingAvl: boolean, restroomsAvl: boolean,
  youtubeURL,
  paddleScore: { rating: 0-5 },
  // ...weather data appended at runtime
}
```

## Firestore collections
- `paddlingSpots` — spot definitions (cached, enriched with live weather at request time)

## External services
- **Open-Meteo API** (free, no auth) — weather data
- **Marine API** — wave/marine conditions (where available)

## Auth pattern
All pages and API endpoints are public, no auth required.

## Task
$ARGUMENTS
