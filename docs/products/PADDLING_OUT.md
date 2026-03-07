# Paddling Out Frontend

## Scope

Paddling Out is the weather-first experience for location discovery, current conditions, and forecast exploration.

## Primary entrypoints

- `src/paddlingout.html`

Supporting files:

- `src/js/paddlingout.js`
- `src/js/services/apiClient.js`
- `src/js/advancedModal.js`
- `src/js/customLocation.js`
- `src/js/components/WeatherStats.js`
- `src/js/components/SafetyWarnings.js`
- `src/js/components/Heatmap.js`
- `src/js/components/RatingHero.js`
- `src/css/paddlingout.css`
- `src/css/advancedModal.css`
- `src/css/customLocation.css`

Related usage elsewhere:

- `src/js/about-dynamic.js` also consumes paddling location data.

## Backend routes consumed

- `GET /paddlingOut`
- `GET /paddlingOut/:id`
- `GET /paddleScore`
- `GET /fastForecast`
- `GET /forecast`
- `GET /nearbyWater`

## UX responsibilities

- Spot directory and spot detail navigation
- Current condition scoring
- Forecast modal rendering
- Custom-location lookup using nearby water discovery
- Safety messaging and rating presentation

## Quality notes

- The weather experience mixes a shared API client with page-specific fetch logic.
- Production and emulator toggles exist in the same codebase; verify mode selection before maintenance changes.
- A professional automation should click through spot list, spot details, current score, forecast modal, and custom location search against real backend responses.
