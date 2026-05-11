#!/usr/bin/env python3
"""
fetch_weatherapi.py
===================
Fetches historical weather from WeatherAPI.com (paid, accurate) for Paddling Out
priority lakes. Reads API key from kaayko-api/functions/.env.

Uses parallel fetching (ThreadPoolExecutor) for speed on M1 Max.
Tries marine endpoint first for real water_temp/wave data, falls back to
derived estimates for lakes where marine data isn't available.

Usage:
  python3 scripts/fetch_weatherapi.py                          # all priority lakes, 12 months
  python3 scripts/fetch_weatherapi.py --months 6               # last 6 months
  python3 scripts/fetch_weatherapi.py --spot whiterock          # single production spot + its similar lakes
  python3 scripts/fetch_weatherapi.py --production-only         # only the 17 production spots
  python3 scripts/fetch_weatherapi.py --resume                  # skip lakes that already have data
  python3 scripts/fetch_weatherapi.py --workers 16              # control parallelism (default: 10)
"""

import argparse
import json
import math
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path
from threading import Lock

import pandas as pd
import requests

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
KAAYKO_ROOT = PROJECT_ROOT.parent.parent  # kaayko_v6
ENV_FILE = KAAYKO_ROOT / "kaayko-api" / "functions" / ".env"
DATA_ROOT = Path(os.environ.get("KAAYKO_PADDLE_DATA_ROOT", "/Users/Rohan/data_lake_monthly"))
PRIORITY_FILE = PROJECT_ROOT / "priority-lakes.json"
PROGRESS_FILE = SCRIPT_DIR / ".fetch-progress.json"
DATA_DIR = PROJECT_ROOT / "data"
MANIFEST_FILE = DATA_DIR / "fetch-manifest.json"

BASE_URL = "https://api.weatherapi.com/v1"
RETRY_DELAYS = [3, 10, 30]

progress_lock = Lock()


# ── Load API key from .env ───────────────────────────────────────────────────

def load_api_key():
    if os.environ.get("WEATHER_API_KEY"):
        return os.environ["WEATHER_API_KEY"]
    if not ENV_FILE.exists():
        print(f"ERROR: .env not found at {ENV_FILE}")
        sys.exit(1)
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line.startswith("WEATHER_API_KEY="):
            val = line.split("=", 1)[1].strip().strip('"').strip("'")
            if val:
                return val
    print("ERROR: WEATHER_API_KEY not found in .env")
    sys.exit(1)


# ── Geo helpers ──────────────────────────────────────────────────────────────

def compass_dir(degrees):
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = round(degrees / 22.5) % 16
    return dirs[idx]


def get_season(month, lat):
    northern = lat >= 0
    if northern:
        if month in (12, 1, 2): return "winter"
        if month in (3, 4, 5): return "spring"
        if month in (6, 7, 8): return "summer"
        return "autumn"
    else:
        if month in (12, 1, 2): return "summer"
        if month in (3, 4, 5): return "autumn"
        if month in (6, 7, 8): return "winter"
        return "spring"


def get_season_intensity(month):
    return {1: "deep", 2: "deep", 3: "early", 4: "mid", 5: "late",
            6: "early", 7: "mid", 8: "late", 9: "early", 10: "mid",
            11: "late", 12: "early"}.get(month, "mid")


def estimate_wave_height(wind_kph, area_km2):
    fetch_m = math.sqrt(max(area_km2, 0.1)) * 1000
    wind_ms = wind_kph / 3.6
    if wind_ms < 0.5:
        return 0.0
    h = 0.0016 * math.sqrt(fetch_m) * wind_ms
    return round(max(0.0, min(h, 3.0)), 3)


def estimate_water_temp_from_air(air_temps, idx, lat):
    window = min(idx + 1, 168)
    recent = air_temps[max(0, idx - window + 1):idx + 1]
    avg = sum(recent) / len(recent) if recent else air_temps[idx]
    base = avg * 0.65 + 5.0
    if abs(lat) > 45:
        base -= 2.0
    return round(max(0.5, min(base, 35.0)), 1)


# ── WeatherAPI fetch ─────────────────────────────────────────────────────────

def fetch_day(api_key, lat, lng, day_str, try_marine=True):
    params = {
        "key": api_key,
        "q": f"{lat},{lng}",
        "dt": day_str,
    }

    # Try marine endpoint first for real water temp + wave data
    if try_marine:
        marine_data = _api_call(f"{BASE_URL}/marine.json", params)
        if marine_data:
            forecast_days = marine_data.get("forecast", {}).get("forecastday", [])
            if forecast_days and forecast_days[0].get("hour"):
                hours = forecast_days[0]["hour"]
                if any(h.get("water_temp_c") for h in hours):
                    return marine_data, "marine"

    # Fall back to history endpoint
    params["aqi"] = "no"
    history_data = _api_call(f"{BASE_URL}/history.json", params)
    return history_data, "history"


def _api_call(url, params):
    for attempt, delay in enumerate([0] + RETRY_DELAYS):
        if delay:
            time.sleep(delay)
        try:
            resp = requests.get(url, params=params, timeout=30)
            if resp.status_code == 429:
                wait = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                time.sleep(wait)
                continue
            if resp.status_code == 400:
                return None
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.RequestException:
            if attempt == len(RETRY_DELAYS):
                return None
    return None


def convert_day_to_rows(payload, lake_meta, source="history"):
    if not payload:
        return []

    forecast_days = payload.get("forecast", {}).get("forecastday", [])
    lat = lake_meta["lat"]
    lng = lake_meta["lng"]
    name = lake_meta["name"]
    area = float(lake_meta.get("area_km2", 1) or 1)
    lake_type = lake_meta.get("type", "lake")
    region = lake_meta.get("region", "")
    climate = lake_meta.get("climate", "temperate")
    rows = []

    for day_data in forecast_days:
        hours = day_data.get("hour", [])
        air_temps = [float(h.get("temp_c", 15)) for h in hours]

        for i, hour in enumerate(hours):
            dt_str = hour.get("time", "").replace("T", " ")
            temp_c = float(hour.get("temp_c", 0))
            wind_kph = float(hour.get("wind_kph", 0))
            wind_deg = float(hour.get("wind_degree", 0))
            gust_kph = float(hour.get("gust_kph", wind_kph * 1.3))
            humidity = float(hour.get("humidity", 50))
            cloud = float(hour.get("cloud", 0))
            uv = float(hour.get("uv", 0))
            precip = float(hour.get("precip_mm", 0))
            pressure = float(hour.get("pressure_mb", 1013))
            dew_point = float(hour.get("dewpoint_c", 0))
            feelslike = float(hour.get("feelslike_c", temp_c))
            vis_km = float(hour.get("vis_km", 10))
            is_day = int(hour.get("is_day", 0))
            will_rain = int(hour.get("will_it_rain", 0))
            will_snow = int(hour.get("will_it_snow", 0))
            condition = hour.get("condition", {}).get("text", "")
            chance_rain = float(hour.get("chance_of_rain", 0))
            chance_snow = float(hour.get("chance_of_snow", 0))

            month = int(dt_str[5:7]) if len(dt_str) >= 7 else 1

            # Use real marine data if available, otherwise estimate
            if source == "marine" and hour.get("water_temp_c") is not None:
                water_temp = round(float(hour["water_temp_c"]), 1)
            else:
                water_temp = estimate_water_temp_from_air(air_temps, i, lat)

            if source == "marine" and hour.get("sig_ht_mt") is not None:
                wave_height = round(float(hour["sig_ht_mt"]), 3)
            else:
                wave_height = estimate_wave_height(wind_kph, area)

            # Extra marine fields
            swell_ht = ""
            swell_dir = ""
            swell_period = ""
            if source == "marine":
                swell_ht = round(float(hour.get("swell_ht_mt", 0)), 2) if hour.get("swell_ht_mt") else ""
                swell_dir = hour.get("swell_dir_16_point", "")
                swell_period = round(float(hour.get("swell_period_secs", 0)), 1) if hour.get("swell_period_secs") else ""

            rows.append({
                "lake": name,
                "datetime": dt_str,
                "temp_c": round(temp_c, 1),
                "wind_kph": round(wind_kph, 1),
                "wind_dir": compass_dir(wind_deg),
                "humidity": round(humidity),
                "cloud": round(cloud),
                "uv": round(uv, 1),
                "precip_mm": round(precip, 2),
                "condition": condition,
                "pressure_mb": round(pressure, 1),
                "dew_point_c": round(dew_point, 1),
                "feelslike_c": round(feelslike, 1),
                "gust_kph": round(gust_kph, 1),
                "is_day": is_day,
                "will_it_rain": will_rain or (1 if precip > 0.1 else 0),
                "will_it_snow": will_snow,
                "vis_km": round(vis_km, 1),
                "estimated_water_temp_c": water_temp,
                "estimated_wave_height_m": wave_height,
                "swell_height_m": swell_ht,
                "swell_dir": swell_dir,
                "swell_period_s": swell_period,
                "water_data_source": source,
                "paddle_score": "",
                "skill_level": "Advanced",
                "season": get_season(month, lat),
                "season_intensity": get_season_intensity(month),
                "hemisphere": "northern" if lat >= 0 else "southern",
                "climate_zone": climate,
                "region": region,
                "regional_pattern": "varied",
                "latitude": lat,
                "longitude": lng,
                "month": month,
                "day_of_year": pd.Timestamp(dt_str[:10]).day_of_year if len(dt_str) >= 10 else 1,
                "lake_region": region,
                "lake_type": lake_type.capitalize() if lake_type else "Lake",
                "base_lake_name": name,
            })

    return rows


# ── Progress tracking (thread-safe) ─────────────────────────────────────────

def load_progress():
    if PROGRESS_FILE.exists():
        return json.loads(PROGRESS_FILE.read_text())
    return {}


def save_progress(progress):
    with progress_lock:
        PROGRESS_FILE.write_text(json.dumps(progress, indent=2))


# ── Parallel day fetcher ────────────────────────────────────────────────────

def fetch_days_parallel(api_key, lake_meta, days_to_fetch, max_workers, marine_supported):
    results = {}

    def _fetch_one(day_str):
        payload, source = fetch_day(api_key, lake_meta["lat"], lake_meta["lng"], day_str, try_marine=marine_supported)
        return day_str, payload, source

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_fetch_one, d): d for d in days_to_fetch}
        for future in as_completed(futures):
            day_str = futures[future]
            try:
                d, payload, source = future.result()
                results[d] = (payload, source)
            except Exception:
                results[day_str] = (None, "error")

    return results


def probe_marine(api_key, lat, lng):
    """Quick check if marine endpoint returns data for this location."""
    today = date.today().isoformat()
    params = {"key": api_key, "q": f"{lat},{lng}", "dt": today}
    try:
        resp = requests.get(f"{BASE_URL}/marine.json", params=params, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            days = data.get("forecast", {}).get("forecastday", [])
            if days and days[0].get("hour"):
                hours = days[0]["hour"]
                if any(h.get("water_temp_c") for h in hours):
                    return True
    except Exception:
        pass
    return False


# ── Main collection ─────────────────────────────────────────────────────────

def collect_lake(api_key, lake_meta, start_date, end_date, progress, max_workers):
    dir_name = lake_meta["name"].replace(" ", "_").replace("'", "")
    lake_dir = DATA_ROOT / dir_name
    lake_dir.mkdir(parents=True, exist_ok=True)

    progress_key = dir_name
    with progress_lock:
        done_days = set(progress.get(progress_key, []))

    # Build list of days to fetch
    days_to_fetch = []
    current = start_date
    while current <= end_date:
        day_str = current.isoformat()
        if day_str not in done_days:
            days_to_fetch.append(day_str)
        current += timedelta(days=1)

    skipped = (end_date - start_date).days + 1 - len(days_to_fetch)

    if not days_to_fetch:
        return 0, 0, skipped, "cached"

    # Probe marine support once per lake
    marine_ok = probe_marine(api_key, lake_meta["lat"], lake_meta["lng"])
    source_tag = "marine" if marine_ok else "history"

    # Fetch all days in parallel
    results = fetch_days_parallel(api_key, lake_meta, days_to_fetch, max_workers, marine_ok)

    all_rows = []
    fetched = 0
    for day_str, (payload, source) in sorted(results.items()):
        if payload:
            rows = convert_day_to_rows(payload, lake_meta, source)
            all_rows.extend(rows)
            done_days.add(day_str)
        fetched += 1

    # Save progress
    with progress_lock:
        progress[progress_key] = sorted(done_days)
    save_progress(progress)

    if not all_rows:
        return 0, fetched, skipped, source_tag

    # Write monthly CSVs
    df = pd.DataFrame(all_rows)
    df["month_key"] = df["datetime"].str[:7]
    saved = 0
    for month_key, month_df in df.groupby("month_key"):
        csv_path = lake_dir / f"{month_key}.csv"
        if csv_path.exists():
            existing = pd.read_csv(csv_path)
            combined = pd.concat([existing, month_df.drop(columns=["month_key"])], ignore_index=True)
            combined.drop_duplicates(subset=["datetime"], keep="last", inplace=True)
            combined.sort_values("datetime", inplace=True)
            combined.to_csv(csv_path, index=False)
        else:
            month_df.drop(columns=["month_key"]).to_csv(csv_path, index=False)
        saved += 1

    return saved, fetched, skipped, source_tag


def main():
    parser = argparse.ArgumentParser(description="Fetch weather from WeatherAPI.com")
    parser.add_argument("--months", type=int, default=12, help="Months of history (default: 12)")
    parser.add_argument("--spot", default=None, help="Only this production spot + similar lakes")
    parser.add_argument("--production-only", action="store_true", help="Only 17 production spots")
    parser.add_argument("--resume", action="store_true", help="Skip lakes that already have data")
    parser.add_argument("--dry-run", action="store_true", help="Show plan without fetching")
    parser.add_argument("--workers", type=int, default=10, help="Parallel API workers (default: 10)")
    args = parser.parse_args()

    api_key = load_api_key()
    print(f"  API key loaded: {api_key[:4]}...{api_key[-4:]}")

    if not PRIORITY_FILE.exists():
        print(f"ERROR: Run build_priority_data.py --discover-only first")
        sys.exit(1)

    manifest = json.loads(PRIORITY_FILE.read_text())
    lakes = manifest.get("lakes", {})

    if args.spot:
        lakes = {k: v for k, v in lakes.items()
                 if v.get("source_spot") == args.spot or (v.get("is_production_spot") and k == f"paddlingout_{args.spot}")}
    elif args.production_only:
        lakes = {k: v for k, v in lakes.items() if v.get("is_production_spot")}

    if args.resume:
        to_remove = []
        for lid, lake in lakes.items():
            dir_name = lake["name"].replace(" ", "_").replace("'", "")
            lake_dir = DATA_ROOT / dir_name
            if lake_dir.exists():
                csv_count = len(list(lake_dir.glob("*.csv")))
                if csv_count >= args.months:
                    to_remove.append(lid)
                    print(f"  SKIP {lake['name']} — already has {csv_count} CSVs")
        for lid in to_remove:
            del lakes[lid]

    end = date.today() - timedelta(days=2)
    start = end - timedelta(days=args.months * 30)

    total_days = (end - start).days + 1
    total_calls = len(lakes) * total_days

    print(f"\n{'='*60}")
    print(f"  WEATHERAPI HISTORICAL FETCH (parallel × {args.workers})")
    print(f"{'='*60}")
    print(f"  Lakes:      {len(lakes)}")
    print(f"  Date range: {start} → {end} ({total_days} days)")
    print(f"  API calls:  ~{total_calls:,} (max, skips cached)")
    print(f"  Workers:    {args.workers} parallel threads")
    print(f"  Marine:     auto-probe per lake")
    print(f"  Output:     {DATA_ROOT}/")
    print(f"{'='*60}\n")

    if args.dry_run:
        print("  DRY RUN — lakes to fetch:")
        for lid, lake in sorted(lakes.items(), key=lambda x: x[1]["name"]):
            tag = " [PRODUCTION]" if lake.get("is_production_spot") else ""
            print(f"    {lake['name']:40s}  ({lake['lat']:.4f}, {lake['lng']:.4f}){tag}")
        return

    progress = load_progress()
    success = 0
    total_csvs = 0
    t_start = time.time()

    for i, (lid, lake) in enumerate(sorted(lakes.items(), key=lambda x: x[1]["name"]), 1):
        tag = " [PROD]" if lake.get("is_production_spot") else ""
        print(f"  [{i}/{len(lakes)}] {lake['name']}{tag}")
        print(f"    {lake['lat']:.4f}, {lake['lng']:.4f}  |  area: {lake.get('area_km2', '?')} km²")

        lake_start = time.time()
        try:
            csvs, fetched, skipped, source = collect_lake(api_key, lake, start, end, progress, args.workers)
            elapsed = time.time() - lake_start
            if csvs > 0:
                print(f"    ✓ {csvs} CSVs written ({fetched} fetched, {skipped} cached) [{source}] — {elapsed:.1f}s")
                success += 1
                total_csvs += csvs
            elif skipped > 0:
                print(f"    ✓ All {skipped} days already cached — {elapsed:.1f}s")
                success += 1
            else:
                print(f"    ✗ No data returned — {elapsed:.1f}s")
        except KeyboardInterrupt:
            print(f"\n  Interrupted. Progress saved — re-run with --resume to continue.")
            save_progress(progress)
            break
        except Exception as e:
            print(f"    ✗ Error: {e}")

    total_elapsed = time.time() - t_start
    print(f"\n{'='*60}")
    print(f"  DONE: {success}/{len(lakes)} lakes, {total_csvs} CSVs written")
    print(f"  Total time: {total_elapsed:.0f}s ({total_elapsed/60:.1f} min)")
    print(f"{'='*60}\n")

    write_manifest(progress)


def write_manifest(progress=None):
    if progress is None:
        progress = load_progress()

    if not PRIORITY_FILE.exists():
        return

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    priority = json.loads(PRIORITY_FILE.read_text())
    lakes = priority.get("lakes", {})
    from datetime import datetime

    total_rows = 0
    lake_entries = {}
    for lid, lake in sorted(lakes.items(), key=lambda x: x[1]["name"]):
        dir_name = lake["name"].replace(" ", "_").replace("'", "")
        lake_dir = DATA_ROOT / dir_name
        csvs = sorted(lake_dir.glob("*.csv")) if lake_dir.exists() else []
        days = progress.get(dir_name, [])
        row_count = 0
        for c in csvs:
            row_count += sum(1 for _ in open(c)) - 1

        total_rows += row_count
        lake_entries[lid] = {
            "name": lake["name"],
            "lat": lake["lat"],
            "lng": lake["lng"],
            "region": lake.get("region", ""),
            "is_production": bool(lake.get("is_production_spot")),
            "source_spot": lake.get("source_spot", ""),
            "csv_count": len(csvs),
            "row_count": row_count,
            "days_fetched": len(days),
            "date_range": [days[0], days[-1]] if days else [],
            "months": [c.stem for c in csvs],
        }

    manifest = {
        "generated": datetime.now().isoformat(),
        "data_source": "WeatherAPI.com (paid historical + marine probe)",
        "fetch_tool": "scripts/fetch_weatherapi.py",
        "storage": str(DATA_ROOT),
        "total_lakes": len(lakes),
        "production_spots": sum(1 for l in lake_entries.values() if l["is_production"]),
        "similar_lakes": sum(1 for l in lake_entries.values() if not l["is_production"]),
        "lakes_with_data": sum(1 for l in lake_entries.values() if l["csv_count"] > 0),
        "total_csvs": sum(l["csv_count"] for l in lake_entries.values()),
        "total_rows": total_rows,
        "lakes": lake_entries,
    }

    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2))
    print(f"  Manifest written: {MANIFEST_FILE}")
    print(f"  {manifest['lakes_with_data']} lakes, {manifest['total_csvs']} CSVs, {total_rows:,} rows")


if __name__ == "__main__":
    main()
