#!/usr/bin/env python3
"""
build_priority_data.py
======================
Discovers lakes similar to Paddling Out production spots using HydroLAKES,
fetches historical weather from Open-Meteo (free, ERA5 reanalysis),
and writes monthly CSVs to data_lake_monthly/.

Usage:
  python3 build_priority_data.py                    # discover + fetch all
  python3 build_priority_data.py --discover-only     # just find lakes, print plan
  python3 build_priority_data.py --years 3           # last 3 years (default 5)
  python3 build_priority_data.py --max-lakes 50      # limit total lakes
  python3 build_priority_data.py --spot whiterock    # only lakes near this spot
"""

import argparse
import json
import math
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
import requests

# ── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent  # kaayko_v6/kaayko/paddle-trainer/scripts → kaayko_v6
CATALOG_FILE = PROJECT_ROOT / "paddle-llm-private" / "catalog" / "us-lakes.jsonl"
DATA_LAKE_ROOT = Path(os.environ.get("KAAYKO_PADDLE_DATA_ROOT", "/Users/Rohan/data_lake_monthly"))
PRIORITY_FILE = SCRIPT_DIR.parent / "priority-lakes.json"

# ── Open-Meteo ───────────────────────────────────────────────────────────────
WEATHER_URL = "https://archive-api.open-meteo.com/v1/archive"
WEATHER_VARS = ",".join([
    "temperature_2m", "apparent_temperature", "dew_point_2m",
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
    "precipitation", "snowfall", "cloud_cover",
    "relative_humidity_2m", "pressure_msl", "visibility",
    "uv_index", "is_day", "weather_code",
])
DELAY_BETWEEN_CALLS = 0.2
RETRY_DELAYS = [5, 15, 60]

# ── Production Paddling Out spots ────────────────────────────────────────────
PRODUCTION_SPOTS = [
    {"id": "ambazari",   "title": "Ambazari Lake",          "lat": 21.129713, "lng": 79.045547,   "region": "India_Maharashtra",  "type": "lake",      "climate": "tropical"},
    {"id": "antero",     "title": "Antero Reservoir",       "lat": 38.982687, "lng": -105.896563, "region": "USA_Colorado",       "type": "reservoir", "climate": "continental"},
    {"id": "colorado",   "title": "Colorado River",         "lat": 38.604813, "lng": -109.573563, "region": "USA_Utah",           "type": "river",     "climate": "arid"},
    {"id": "cottonwood", "title": "Cottonwood Lake",        "lat": 38.781063, "lng": -106.277812, "region": "USA_Colorado",       "type": "lake",      "climate": "continental"},
    {"id": "crescent",   "title": "Lake Crescent",          "lat": 48.052813, "lng": -123.870438, "region": "USA_Washington",     "type": "lake",      "climate": "temperate"},
    {"id": "diablo",     "title": "Diablo Lake",            "lat": 48.690938, "lng": -121.097188, "region": "USA_Washington",     "type": "lake",      "climate": "temperate"},
    {"id": "jackson",    "title": "Jackson Lake",           "lat": 43.845863, "lng": -110.600359, "region": "USA_Wyoming",        "type": "lake",      "climate": "continental"},
    {"id": "jenny",      "title": "Jenny Lake",             "lat": 43.749638, "lng": -110.729578, "region": "USA_Wyoming",        "type": "lake",      "climate": "continental"},
    {"id": "kens",       "title": "Kens Lake",              "lat": 38.479188, "lng": -109.428062, "region": "USA_Utah",           "type": "lake",      "climate": "arid"},
    {"id": "lewisville", "title": "Lewisville Lake",        "lat": 33.156487, "lng": -96.949953,  "region": "USA_Texas",          "type": "lake",      "climate": "temperate"},
    {"id": "mcdonald",   "title": "Lake McDonald",          "lat": 48.528380, "lng": -113.992351, "region": "USA_Montana",        "type": "lake",      "climate": "continental"},
    {"id": "merrimack",  "title": "Merrimack River",        "lat": 42.881410, "lng": -71.473420,  "region": "USA_NewHampshire",   "type": "river",     "climate": "continental"},
    {"id": "powell",     "title": "Lake Powell",            "lat": 37.015130, "lng": -111.536362, "region": "USA_Utah",           "type": "reservoir", "climate": "arid"},
    {"id": "taylorpark", "title": "Taylor Park Reservoir",  "lat": 38.823442, "lng": -106.579883, "region": "USA_Colorado",       "type": "reservoir", "climate": "continental"},
    {"id": "trinity",    "title": "Trinity River",          "lat": 32.881187, "lng": -96.929937,  "region": "USA_Texas",          "type": "river",     "climate": "temperate"},
    {"id": "union",      "title": "Lake Union",             "lat": 47.627413, "lng": -122.338984, "region": "USA_Washington",     "type": "lake",      "climate": "temperate"},
    {"id": "whiterock",  "title": "White Rock Lake",        "lat": 32.833188, "lng": -96.729687,  "region": "USA_Texas",          "type": "lake",      "climate": "temperate"},
]


# ── Geo helpers ──────────────────────────────────────────────────────────────

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def compass_dir(degrees):
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    idx = round(degrees / 22.5) % 16
    return dirs[idx]


def wmo_condition(code):
    WMO = {
        0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
        45: "Fog", 48: "Depositing rime fog",
        51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
        61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
        71: "Slight Snow", 73: "Moderate Snow", 75: "Heavy Snow",
        77: "Snow grains", 80: "Slight Rain showers", 81: "Moderate Rain showers",
        82: "Violent Rain showers", 85: "Slight Snow showers", 86: "Heavy Snow showers",
        95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
    }
    return WMO.get(code, "Unknown")


def estimate_water_temp(air_temps, index, lat):
    window = min(index + 1, 168)  # 7 days of hourly data
    recent = air_temps[max(0, index - window + 1):index + 1]
    avg_air = sum(recent) / len(recent) if recent else air_temps[index]
    # Thermal inertia: water lags air by ~40% and is biased warm in summer, cool in winter
    base = avg_air * 0.65 + 5.0
    # High-altitude/latitude adjustment
    if abs(lat) > 45:
        base -= 2.0
    elif abs(lat) > 55:
        base -= 4.0
    return round(max(0.5, min(base, 35.0)), 1)


def estimate_wave_height(wind_kph, area_km2):
    fetch_km = math.sqrt(max(area_km2, 0.1))
    fetch_m = fetch_km * 1000
    wind_ms = wind_kph / 3.6
    if wind_ms < 0.5:
        return 0.0
    # Simplified SMB: H_s ≈ 0.0016 * sqrt(fetch) * U
    h = 0.0016 * math.sqrt(fetch_m) * wind_ms
    return round(max(0.0, min(h, 3.0)), 3)


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
    intensities = {
        1: "deep", 2: "deep", 3: "early", 4: "mid", 5: "late",
        6: "early", 7: "mid", 8: "late", 9: "early", 10: "mid",
        11: "late", 12: "early",
    }
    return intensities.get(month, "mid")


def get_hemisphere(lat):
    return "northern" if lat >= 0 else "southern"


def get_climate_zone(lat):
    abs_lat = abs(lat)
    if abs_lat < 23.5: return "tropical"
    if abs_lat < 35: return "arid"
    if abs_lat < 50: return "temperate"
    if abs_lat < 66.5: return "continental"
    return "polar"


# ── Lake Discovery ───────────────────────────────────────────────────────────

def load_hydrolakes():
    if not CATALOG_FILE.exists():
        print(f"  WARN: HydroLAKES catalog not found at {CATALOG_FILE}")
        return []
    lakes = []
    for line in CATALOG_FILE.read_text().splitlines():
        if not line.strip():
            continue
        try:
            lakes.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return lakes


def discover_priority_lakes(spots, catalog, per_spot=6, radius_km=300):
    """Find similar lakes near each production spot using HydroLAKES."""
    all_found = {}
    spot_assignments = {}

    for spot in spots:
        nearby = []
        for lake in catalog:
            dist = haversine_km(spot["lat"], spot["lng"], lake["latitude"], lake["longitude"])
            if dist <= radius_km and dist > 1:  # skip self-matches
                nearby.append({
                    "lake_id": lake["lake_id"],
                    "name": lake["name"],
                    "lat": lake["latitude"],
                    "lng": lake["longitude"],
                    "area_km2": lake.get("area_km2", 0),
                    "distance_km": round(dist, 1),
                    "source_spot": spot["id"],
                    "source_spot_title": spot["title"],
                    "country": lake.get("country", ""),
                    "lake_type_code": lake.get("lake_type_code", ""),
                })
        # Sort by distance, take closest per_spot
        nearby.sort(key=lambda x: x["distance_km"])
        selected = nearby[:per_spot]
        spot_assignments[spot["id"]] = [l["lake_id"] for l in selected]
        for lake in selected:
            lid = lake["lake_id"]
            if lid not in all_found or lake["distance_km"] < all_found[lid]["distance_km"]:
                all_found[lid] = lake

    # Also add the production spots themselves as priority lakes
    for spot in spots:
        key = f"paddlingout_{spot['id']}"
        all_found[key] = {
            "lake_id": key,
            "name": spot["title"],
            "lat": spot["lat"],
            "lng": spot["lng"],
            "area_km2": 0,
            "distance_km": 0,
            "source_spot": spot["id"],
            "source_spot_title": spot["title"],
            "country": "USA" if "USA" in spot.get("region", "") else spot.get("region", "").split("_")[0],
            "is_production_spot": True,
            "region": spot.get("region", ""),
            "type": spot.get("type", "lake"),
            "climate": spot.get("climate", "temperate"),
        }

    return all_found, spot_assignments


def check_existing_data(lakes, data_root):
    """Check which lakes already have CSV data."""
    existing = set()
    if not data_root.exists():
        return existing

    dir_names = {d.name.lower(): d.name for d in data_root.iterdir() if d.is_dir()}

    for lid, lake in lakes.items():
        name = lake["name"]
        # Try various directory name formats
        candidates = [
            name.replace(" ", "_"),
            name.replace(" ", "_").replace("'", ""),
            lid,
        ]
        for c in candidates:
            if c.lower() in dir_names:
                actual = dir_names[c.lower()]
                csv_count = len(list((data_root / actual).glob("*.csv")))
                if csv_count > 0:
                    existing.add(lid)
                    lake["existing_dir"] = actual
                    lake["existing_csvs"] = csv_count
                    break

    return existing


# ── Weather Fetch ────────────────────────────────────────────────────────────

def fetch_weather_year(lat, lng, start_date, end_date):
    """Fetch one year of hourly weather from Open-Meteo."""
    params = {
        "latitude": lat,
        "longitude": lng,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": WEATHER_VARS,
        "timezone": "auto",
        "wind_speed_unit": "kmh",
        "temperature_unit": "celsius",
        "precipitation_unit": "mm",
    }
    for attempt, delay in enumerate([0] + RETRY_DELAYS):
        if delay:
            print(f"      Retry {attempt} in {delay}s …")
            time.sleep(delay)
        try:
            resp = requests.get(WEATHER_URL, params=params, timeout=60)
            if resp.status_code == 429:
                print(f"      Rate limited (429)")
                continue
            resp.raise_for_status()
            data = resp.json()
            hourly = data.get("hourly", {})
            if not hourly or "time" not in hourly:
                return None
            return hourly
        except requests.exceptions.RequestException as e:
            print(f"      Error: {e}")
            if attempt == len(RETRY_DELAYS):
                return None
    return None


def convert_to_csv_rows(hourly, lake):
    """Convert Open-Meteo hourly dict to CSV rows matching data_lake_monthly format."""
    times = hourly["time"]
    rows = []
    air_temps = [float(t) if t is not None else 15.0 for t in hourly.get("temperature_2m", [])]
    area = float(lake.get("area_km2", 1) or 1)
    lat = lake["lat"]
    lng = lake["lng"]
    name = lake["name"]
    lake_type = lake.get("type", "lake")
    region = lake.get("region", "")
    climate = lake.get("climate", get_climate_zone(lat))

    if not region:
        if lat > 20 and lat < 50 and lng < -60 and lng > -130:
            region = "North_America_South"
        elif lat >= 50:
            region = "North_America_North"
        else:
            region = "Other"

    for i, t in enumerate(times):
        temp_c = air_temps[i]
        wind_kph = float(hourly["wind_speed_10m"][i] or 0)
        wind_deg = float(hourly["wind_direction_10m"][i] or 0)
        gust_kph = float(hourly["wind_gusts_10m"][i] or wind_kph * 1.3)
        humidity = float(hourly["relative_humidity_2m"][i] or 50)
        cloud = float(hourly["cloud_cover"][i] or 0)
        uv = float(hourly["uv_index"][i] or 0) if hourly["uv_index"][i] is not None else 0.0
        precip = float(hourly["precipitation"][i] or 0)
        snowfall = float(hourly["snowfall"][i] or 0)
        pressure = float(hourly["pressure_msl"][i] or 1013)
        dew_point = float(hourly["dew_point_2m"][i] or 0) if hourly["dew_point_2m"][i] is not None else 0.0
        feelslike = float(hourly["apparent_temperature"][i] or temp_c) if hourly["apparent_temperature"][i] is not None else temp_c
        vis_m = float(hourly["visibility"][i] or 10000) if hourly["visibility"][i] is not None else 10000.0
        is_day = int(hourly["is_day"][i] or 0)
        wmo_code = int(hourly["weather_code"][i] or 0) if hourly["weather_code"][i] is not None else 0

        dt_str = t.replace("T", " ")
        dt_month = int(dt_str[5:7])
        dt_day_str = dt_str[:10]

        water_temp = estimate_water_temp(air_temps, i, lat)
        wave_height = estimate_wave_height(wind_kph, area)

        row = {
            "lake": name,
            "datetime": dt_str,
            "temp_c": round(temp_c, 1),
            "wind_kph": round(wind_kph, 1),
            "wind_dir": compass_dir(wind_deg),
            "humidity": round(humidity),
            "cloud": round(cloud),
            "uv": round(uv, 1),
            "precip_mm": round(precip, 2),
            "condition": wmo_condition(wmo_code),
            "pressure_mb": round(pressure, 1),
            "dew_point_c": round(dew_point, 1),
            "feelslike_c": round(feelslike, 1),
            "gust_kph": round(gust_kph, 1),
            "is_day": is_day,
            "will_it_rain": 1 if precip > 0.1 else 0,
            "will_it_snow": 1 if snowfall > 0 else 0,
            "vis_km": round(vis_m / 1000, 1),
            "estimated_water_temp_c": water_temp,
            "estimated_wave_height_m": wave_height,
            "paddle_score": "",
            "skill_level": "Advanced",
            "season": get_season(dt_month, lat),
            "season_intensity": get_season_intensity(dt_month),
            "hemisphere": get_hemisphere(lat),
            "climate_zone": climate,
            "region": region,
            "regional_pattern": "varied",
            "latitude": lat,
            "longitude": lng,
            "month": dt_month,
            "day_of_year": pd.Timestamp(dt_day_str).day_of_year,
            "lake_region": region,
            "lake_type": lake_type.capitalize(),
            "base_lake_name": name,
        }
        rows.append(row)

    return rows


def save_monthly_csvs(rows, lake_dir_name, data_root):
    """Save rows as monthly CSV files in data_lake_monthly/{lake_dir}/."""
    if not rows:
        return 0

    df = pd.DataFrame(rows)
    df["month_key"] = df["datetime"].str[:7]
    lake_dir = data_root / lake_dir_name
    lake_dir.mkdir(parents=True, exist_ok=True)

    saved = 0
    for month_key, month_df in df.groupby("month_key"):
        csv_path = lake_dir / f"{month_key}.csv"
        month_df.drop(columns=["month_key"]).to_csv(csv_path, index=False)
        saved += 1

    return saved


def fetch_and_save_lake(lake, years, data_root):
    """Fetch weather data for a lake and save as monthly CSVs."""
    dir_name = lake["name"].replace(" ", "_").replace("'", "")
    end = date.today() - timedelta(days=7)
    start = date(end.year - years, end.month, end.day)

    all_rows = []
    current_start = start

    while current_start < end:
        # Open-Meteo allows max ~1 year per request
        chunk_end = min(current_start.replace(year=current_start.year + 1) - timedelta(days=1), end)
        print(f"    Fetching {current_start} → {chunk_end} …")

        hourly = fetch_weather_year(lake["lat"], lake["lng"], str(current_start), str(chunk_end))
        time.sleep(DELAY_BETWEEN_CALLS)

        if hourly is None:
            print(f"    ✗ No data returned for {current_start} → {chunk_end}")
            current_start = chunk_end + timedelta(days=1)
            continue

        rows = convert_to_csv_rows(hourly, lake)
        all_rows.extend(rows)
        print(f"    ✓ {len(rows):,} hourly rows")
        current_start = chunk_end + timedelta(days=1)

    if not all_rows:
        return 0

    saved = save_monthly_csvs(all_rows, dir_name, data_root)
    print(f"    → Saved {saved} monthly CSVs to {dir_name}/")
    return saved


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Build priority lake training data")
    parser.add_argument("--discover-only", action="store_true", help="Only discover lakes, don't fetch weather")
    parser.add_argument("--years", type=int, default=5, help="Years of historical data (default: 5)")
    parser.add_argument("--max-lakes", type=int, default=120, help="Max total lakes to discover (default: 120)")
    parser.add_argument("--per-spot", type=int, default=6, help="Similar lakes per production spot (default: 6)")
    parser.add_argument("--radius", type=int, default=300, help="Search radius in km (default: 300)")
    parser.add_argument("--spot", default=None, help="Only process this production spot ID")
    parser.add_argument("--fetch-production", action="store_true", help="Also fetch weather for production spots themselves")
    args = parser.parse_args()

    print(f"\n{'='*60}")
    print(f"  PADDLING OUT — PRIORITY LAKE DATA BUILDER")
    print(f"{'='*60}")

    # Step 1: Load HydroLAKES catalog
    print(f"\n1. Loading HydroLAKES catalog …")
    catalog = load_hydrolakes()
    print(f"   {len(catalog)} lakes in catalog")

    # Filter spots if requested
    spots = PRODUCTION_SPOTS
    if args.spot:
        spots = [s for s in spots if s["id"] == args.spot]
        if not spots:
            print(f"   ERROR: spot '{args.spot}' not found")
            sys.exit(1)

    # Step 2: Discover similar lakes
    print(f"\n2. Discovering similar lakes ({args.per_spot} per spot, {args.radius}km radius) …")
    all_lakes, assignments = discover_priority_lakes(spots, catalog, per_spot=args.per_spot, radius_km=args.radius)

    # Limit total
    non_production = {k: v for k, v in all_lakes.items() if not v.get("is_production_spot")}
    production = {k: v for k, v in all_lakes.items() if v.get("is_production_spot")}

    if len(non_production) > args.max_lakes:
        # Keep the closest ones
        sorted_lakes = sorted(non_production.items(), key=lambda x: x[1]["distance_km"])
        non_production = dict(sorted_lakes[:args.max_lakes])

    all_lakes = {**production, **non_production}

    print(f"   Found {len(non_production)} similar lakes + {len(production)} production spots")
    print(f"\n   Per production spot:")
    for spot in spots:
        assigned = assignments.get(spot["id"], [])
        print(f"     {spot['id']:15s} ({spot['title']:30s}) → {len(assigned)} nearby lakes")

    # Step 3: Check existing data
    print(f"\n3. Checking existing data in {DATA_LAKE_ROOT} …")
    existing = check_existing_data(all_lakes, DATA_LAKE_ROOT)
    need_fetch = {k: v for k, v in all_lakes.items() if k not in existing}

    # Separate production spots
    need_fetch_production = {k: v for k, v in need_fetch.items() if v.get("is_production_spot")}
    need_fetch_similar = {k: v for k, v in need_fetch.items() if not v.get("is_production_spot")}

    print(f"   Already have data: {len(existing)}")
    print(f"   Need to fetch (production): {len(need_fetch_production)}")
    print(f"   Need to fetch (similar):    {len(need_fetch_similar)}")

    # Save priority lakes manifest
    manifest = {
        "generated": date.today().isoformat(),
        "production_spots": [s["id"] for s in spots],
        "total_lakes": len(all_lakes),
        "lakes": {k: {**v, "has_data": k in existing or k not in need_fetch} for k, v in all_lakes.items()},
        "assignments": assignments,
    }
    PRIORITY_FILE.write_text(json.dumps(manifest, indent=2))
    print(f"\n   Saved manifest → {PRIORITY_FILE}")

    if args.discover_only:
        print(f"\n   Discovery complete. Run without --discover-only to fetch weather data.")
        print(f"\n   Lakes to fetch:")
        for lid, lake in sorted(need_fetch.items(), key=lambda x: x[1]["name"]):
            tag = " [PRODUCTION]" if lake.get("is_production_spot") else ""
            print(f"     {lake['name']:40s}  ({lake['lat']:.4f}, {lake['lng']:.4f})  {lake.get('area_km2', '?')} km²{tag}")
        return

    # Step 4: Fetch weather data
    to_fetch = {}
    if args.fetch_production:
        to_fetch.update(need_fetch_production)
    to_fetch.update(need_fetch_similar)

    if not to_fetch:
        print(f"\n4. All lakes already have data!")
        return

    print(f"\n4. Fetching {args.years} years of hourly weather for {len(to_fetch)} lakes …")
    print(f"   Source: Open-Meteo ERA5 reanalysis (free, scientifically accurate)")
    print(f"   Estimated time: ~{len(to_fetch) * args.years * 2}s")
    print(f"   Data output: {DATA_LAKE_ROOT}/")
    print()

    success = 0
    failed = 0
    for i, (lid, lake) in enumerate(sorted(to_fetch.items(), key=lambda x: x[1]["name"]), 1):
        tag = " [PRODUCTION]" if lake.get("is_production_spot") else ""
        print(f"  [{i}/{len(to_fetch)}] {lake['name']}{tag}")
        print(f"    Location: {lake['lat']:.4f}, {lake['lng']:.4f}  |  Area: {lake.get('area_km2', '?')} km²")

        try:
            csvs = fetch_and_save_lake(lake, args.years, DATA_LAKE_ROOT)
            if csvs > 0:
                success += 1
            else:
                failed += 1
        except KeyboardInterrupt:
            print(f"\n  Interrupted after {success} lakes. Re-run to continue (existing data is kept).")
            break
        except Exception as e:
            print(f"    ✗ Error: {e}")
            failed += 1

    print(f"\n{'='*60}")
    print(f"  COMPLETE: {success} fetched, {failed} failed, {len(existing)} already had data")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
