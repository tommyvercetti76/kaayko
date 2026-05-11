# Fetch Log

Chronological record of weather data fetch operations.

## 2026-05-09 — Initial Production + Similar Lakes Fetch

- **Script:** `scripts/fetch_weatherapi.py --production-only --months 12 --workers 10`
- **Source:** WeatherAPI.com (paid historical API)
- **Date range:** 2025-05-12 → 2026-05-07 (361 days)
- **Marine probe:** Enabled — auto-detects per lake (historical dates fall back to history endpoint)

### Run 1: Production lakes (sequential, 0.18s delay)
- **Started:** 2026-05-09 ~10:52 AM PT
- **Lakes:** 17 production spots
- **Result:** 6/17 completed before kill (Ambazari → Jackson)
- **Time:** ~10 min (killed to upgrade script)

### Run 2: Production lakes (parallel × 10, resume)
- **Started:** 2026-05-09 ~11:07 AM PT
- **Completed:** 2026-05-09 ~11:13 AM PT
- **Lakes:** 17/17 — 6 cached from run 1, 11 freshly fetched
- **CSVs written:** 139
- **Time:** 6.2 min

### Run 3: All priority lakes (parallel × 10)
- **Started:** 2026-05-09 ~11:20 AM PT
- **Completed:** 2026-05-09 ~11:52 AM PT
- **Lakes:** 72/72 — 17 production cached, 55 similar freshly fetched
- **CSVs written:** 676
- **Time:** 32.2 min
- **Marine source:** All lakes probed successfully
