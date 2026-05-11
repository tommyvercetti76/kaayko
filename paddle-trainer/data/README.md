# Paddle Trainer — Weather Data Pipeline

## Overview

Historical hourly weather data for Paddling Out production lakes and similar nearby lakes,
fetched from [WeatherAPI.com](https://www.weatherapi.com/) (paid, accurate).

Used to train the paddle score ML model via expert-rated scenarios in the Paddle Trainer UI.

## Data Location

- **Raw CSV storage:** `/Users/Rohan/data_lake_monthly/{Lake_Name}/YYYY-MM.csv`
- **Priority lakes manifest:** `priority-lakes.json` (72 lakes — 17 production + 55 similar)
- **Fetch progress:** `scripts/.fetch-progress.json` (resume support)
- **Admin preferences:** `admin-lake-prefs.json` (reject/watchlist/visit flags)

## Lake Coverage

| Category | Count | Source |
|----------|-------|--------|
| Production spots | 17 | Paddling Out live spots |
| Similar lakes | 55 | HydroLAKES catalog — proximity + size match |
| **Total** | **72** | |

### Production Spots (17)

| Spot | Lake | Region | Lat/Lng |
|------|------|--------|---------|
| ambazari | Ambazari Lake | India_Maharashtra | 21.13, 79.05 |
| antero | Antero Reservoir | USA_Colorado | 38.98, -105.90 |
| colorado | Colorado River | USA_Utah | 38.60, -109.57 |
| cottonwood | Cottonwood Lake | USA_Colorado | 38.78, -106.28 |
| crescent | Lake Crescent | USA_Washington | 48.05, -123.87 |
| diablo | Diablo Lake | USA_Washington | 48.69, -121.10 |
| jackson | Jackson Lake | USA_Wyoming | 43.85, -110.60 |
| jenny | Jenny Lake | USA_Wyoming | 43.75, -110.73 |
| kens | Kens Lake | USA_Utah | 38.48, -109.43 |
| lewisville | Lewisville Lake | USA_Texas | 33.16, -96.95 |
| mcdonald | Lake McDonald | USA_Montana | 48.53, -113.99 |
| merrimack | Merrimack River | USA_NewHampshire | 42.88, -71.47 |
| powell | Lake Powell | USA_Utah | 37.02, -111.54 |
| taylorpark | Taylor Park Reservoir | USA_Colorado | 38.82, -106.58 |
| trinity | Trinity River | USA_Texas | 32.88, -96.93 |
| union | Lake Union | USA_Washington | 47.63, -122.34 |
| whiterock | White Rock Lake | USA_Texas | 32.83, -96.73 |

### Similar Lakes (55)

Discovered via HydroLAKES US catalog — up to 6 lakes within 300km of each production spot,
matched by proximity and water body size. See `priority-lakes.json` for full list with
`source_spot` assignments.

## CSV Schema (39 columns)

| Column | Type | Source | Description |
|--------|------|--------|-------------|
| lake | str | meta | Lake name |
| datetime | str | API | `YYYY-MM-DD HH:00` |
| temp_c | float | API | Air temperature (C) |
| wind_kph | float | API | Wind speed (km/h) |
| wind_dir | str | derived | 16-point compass (N, NNE, NE, ...) |
| humidity | int | API | Relative humidity (%) |
| cloud | int | API | Cloud cover (%) |
| uv | float | API | UV index |
| precip_mm | float | API | Precipitation (mm) |
| condition | str | API | Weather condition text |
| pressure_mb | float | API | Atmospheric pressure (mbar) |
| dew_point_c | float | API | Dew point (C) |
| feelslike_c | float | API | Feels-like temperature (C) |
| gust_kph | float | API | Wind gust speed (km/h) |
| is_day | int | API | 1 = daytime, 0 = night |
| will_it_rain | int | API | Rain flag |
| will_it_snow | int | API | Snow flag |
| vis_km | float | API | Visibility (km) |
| estimated_water_temp_c | float | derived/marine | Water temperature — real if marine available, else 7-day thermal model |
| estimated_wave_height_m | float | derived/marine | Wave height — real if marine available, else SMB fetch model |
| swell_height_m | float | marine | Swell height (m) — marine API only, blank if unavailable |
| swell_dir | str | marine | Swell direction — marine API only |
| swell_period_s | float | marine | Swell period (s) — marine API only |
| water_data_source | str | meta | `marine` or `history` — indicates data provenance |
| paddle_score | str | trainer | Expert-assigned score (filled during training) |
| skill_level | str | default | Default: "Advanced" |
| season | str | derived | winter/spring/summer/autumn (hemisphere-aware) |
| season_intensity | str | derived | deep/early/mid/late |
| hemisphere | str | derived | northern/southern |
| climate_zone | str | meta | temperate/continental/arid/etc |
| region | str | meta | e.g. USA_Colorado |
| regional_pattern | str | default | "varied" |
| latitude | float | meta | Lake latitude |
| longitude | float | meta | Lake longitude |
| month | int | derived | 1-12 |
| day_of_year | int | derived | 1-366 |
| lake_region | str | meta | Same as region |
| lake_type | str | meta | Lake/Reservoir/River |
| base_lake_name | str | meta | Canonical lake name |

## Derived Field Models

**Water temperature** (when marine data unavailable):
- 7-day rolling average of air temp x 0.65 + 5.0 C
- Latitude adjustment: -2.0 C for |lat| > 45
- Clamped to [0.5, 35.0] C

**Wave height** (when marine data unavailable):
- Sverdrup-Munk-Bretschneider model: `H = 0.0016 * sqrt(fetch_m) * wind_m/s`
- Fetch estimated from lake area: `fetch = sqrt(area_km2) * 1000`
- Clamped to [0.0, 3.0] m

## Scripts

### `scripts/build_priority_data.py`
Discovers similar lakes from HydroLAKES catalog and generates `priority-lakes.json`.
```bash
python3 scripts/build_priority_data.py --discover-only    # just find lakes
python3 scripts/build_priority_data.py --per-spot 6       # 6 similar per production spot
```

### `scripts/fetch_weatherapi.py`
Fetches historical weather from WeatherAPI.com with parallel workers.
```bash
python3 scripts/fetch_weatherapi.py --production-only --months 12   # 17 production spots
python3 scripts/fetch_weatherapi.py --months 12 --workers 10        # all 72 lakes
python3 scripts/fetch_weatherapi.py --resume                        # skip completed
python3 scripts/fetch_weatherapi.py --dry-run                       # preview plan
```

## Data Pipeline Flow

```
HydroLAKES catalog ──► build_priority_data.py ──► priority-lakes.json
                                                        │
WeatherAPI.com ◄── fetch_weatherapi.py ◄────────────────┘
     │
     ▼
data_lake_monthly/{Lake}/YYYY-MM.csv
     │
     ▼
Paddle Trainer UI (vite dev server)
     │  expert rates scenarios with notes
     ▼
ratings.json ──► paddleTrainerModel.js ──► trained model weights
```
