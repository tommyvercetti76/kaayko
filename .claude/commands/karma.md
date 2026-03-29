You are working on the **Karma module** of Kaayko (`/Users/Rohan/Kaayko_v6`).

Karma covers community/school photography & media education programs.

## Scope — pages
| URL | File | Notes |
|-----|------|-------|
| `/karma` | `kaayko/src/karma.html` | Program landing page |
| `/karma/kameras/**` | `kaayko/src/karma/kameras/index.html` | Camera education SPA (rewrite → index.html) |
| `/karma/mp3/**` | `kaayko/src/karma/mp3/index.html` | Audio/MP3 content (rewrite → index.html) |
| `/karma/schools/somalwar/**` | Cloud Run `cool-schools` service | **No local file — dynamic, served by external service** |

Note: `/karma/schools/somalwar` routes to the CoolSchools Cloud Run service, not to a local file. If you need to change that page, work in `/Users/Rohan/coolschools-web` instead.

## Scope — API files
- `kaayko-api/functions/api/cameras.js`
- `kaayko-api/functions/api/lenses.js`
- `kaayko-api/functions/api/presets.js`

## APIs used
```
# Camera & photography reference (public)
GET  /api/cameras                   → all cameras with specs
GET  /api/cameras/{id}             → camera detail
GET  /api/lenses                    → all lenses
GET  /api/lenses/{id}              → lens detail
GET  /api/presets                   → photography presets
GET  /api/presets/{id}             → preset detail
GET  /api/presets/smart            → smart recommendations (EV calculation)

# Create preset (auth required)
POST /api/presets                   → create new preset (Firebase token required)
```

## Firestore collections
- `cameras` — camera specs (name, brand, tags, calibrationData)
- `lenses` — lens specs
- `presets` — photography presets

## External services
None.

## Auth pattern
- All read endpoints: public
- `POST /api/presets`: Firebase token required

## Firebase routing note
`/karma/kameras/**` and `/karma/mp3/**` are SPA rewrites in `firebase.json` — both resolve to their respective `index.html`. URL params are handled client-side.

## Task
$ARGUMENTS
