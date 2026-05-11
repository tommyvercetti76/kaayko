import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const configDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDir, '../..');
const paddleDataRoot = process.env.KAAYKO_PADDLE_DATA_ROOT || '/Users/Rohan/data_lake_monthly';
const ratingsDir = path.join(workspaceRoot, 'paddle-llm-private', 'human-ratings');
const ratingsFile = path.join(ratingsDir, 'ratings.jsonl');
const lakeCatalogFile = path.join(workspaceRoot, 'paddle-llm-private', 'catalog', 'us-lakes.jsonl');

let lakeIndexCache = null;
let lakeIndexCacheTime = 0;
let lakeCatalogCache = null;
let priorityLakesCache = null;
const adminPrefsFile = path.join(configDir, 'admin-lake-prefs.json');

function loadPriorityLakes() {
  if (priorityLakesCache) return priorityLakesCache;
  const priorityFile = path.join(configDir, 'priority-lakes.json');
  if (!fs.existsSync(priorityFile)) {
    priorityLakesCache = { lakes: {}, assignments: {}, production_spots: [] };
    return priorityLakesCache;
  }
  priorityLakesCache = JSON.parse(fs.readFileSync(priorityFile, 'utf8'));
  return priorityLakesCache;
}

function loadAdminPrefs() {
  if (!fs.existsSync(adminPrefsFile)) return { rejected: [], watchlist: [], visits: [] };
  return JSON.parse(fs.readFileSync(adminPrefsFile, 'utf8'));
}

function saveAdminPrefs(prefs) {
  fs.writeFileSync(adminPrefsFile, JSON.stringify(prefs, null, 2));
}

function getPriorityLakeIds() {
  const manifest = loadPriorityLakes();
  const prefs = loadAdminPrefs();
  const rejected = new Set(prefs.rejected || []);
  const ids = new Set();
  for (const [, lake] of Object.entries(manifest.lakes || {})) {
    const dirName = lake.name?.replace(/ /g, '_')?.replace(/'/g, '');
    if (dirName && !rejected.has(dirName)) ids.add(dirName);
  }
  return ids;
}

function getProductionLakeIds() {
  const manifest = loadPriorityLakes();
  const ids = new Set();
  for (const [, lake] of Object.entries(manifest.lakes || {})) {
    if (lake.is_production_spot) {
      const dirName = lake.name?.replace(/ /g, '_')?.replace(/'/g, '');
      if (dirName) ids.add(dirName);
    }
  }
  return ids;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function normalizeLakeName(name) {
  return String(name || '').replaceAll('_', ' ');
}

function lakeLookupKey(name) {
  const compact = String(name || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(lake|pond|reservoir|res|lagoon|bayou|canal|water|waters)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return compact;
}

function ensureInside(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (!resolvedCandidate.startsWith(resolvedRoot + path.sep) && resolvedCandidate !== resolvedRoot) {
    throw new Error('Invalid path');
  }
  return resolvedCandidate;
}

function getLakeCatalog() {
  if (lakeCatalogCache) return lakeCatalogCache;
  const byName = new Map();
  const rows = [];
  if (!fs.existsSync(lakeCatalogFile)) {
    lakeCatalogCache = { rows, byName };
    return lakeCatalogCache;
  }

  for (const line of fs.readFileSync(lakeCatalogFile, 'utf8').split(/\r?\n/).filter(Boolean)) {
    try {
      const item = JSON.parse(line);
      rows.push(item);
      const keys = new Set([
        lakeLookupKey(item.name),
        lakeLookupKey(item.slug),
      ].filter(Boolean));
      for (const key of keys) {
        const list = byName.get(key) || [];
        list.push(item);
        byName.set(key, list);
      }
    } catch {
      // Ignore malformed catalog rows.
    }
  }

  lakeCatalogCache = { rows, byName };
  return lakeCatalogCache;
}

function distanceKm(aLat, aLon, bLat, bLon) {
  const toRad = (value) => (value * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function lakeSizeClass(areaKm2) {
  const area = Number(areaKm2);
  if (!Number.isFinite(area)) return 'unknown';
  if (area < 1) return 'tiny';
  if (area < 10) return 'small';
  if (area < 50) return 'medium';
  if (area < 200) return 'large';
  return 'very large';
}

function waterbodyClass(row) {
  const text = `${row.lake || ''} ${row.base_lake_name || ''} ${row.lake_type || ''}`.toLowerCase();
  if (text.includes('river') || text.includes('stream') || text.includes('creek')) return 'river/stream';
  if (text.includes('canal')) return 'canal';
  if (text.includes('bayou')) return 'bayou';
  if (text.includes('lagoon')) return 'lagoon';
  if (text.includes('reservoir') || /\bres\b/.test(text)) return 'reservoir';
  if (text.includes('pond')) return 'pond';
  return 'lake';
}

function findLakeContext(row) {
  const catalog = getLakeCatalog();
  const keys = [
    lakeLookupKey(row.base_lake_name),
    lakeLookupKey(row.lake),
  ].filter(Boolean);
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);

  for (const key of keys) {
    const candidates = catalog.byName.get(key);
    if (!candidates?.length) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { ...candidates[0], matchDistanceKm: null };
    return candidates
      .map((item) => ({
        ...item,
        matchDistanceKm: distanceKm(lat, lon, Number(item.latitude), Number(item.longitude)),
      }))
      .sort((a, b) => a.matchDistanceKm - b.matchDistanceKm)[0];
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const nearest = catalog.rows
    .map((item) => ({
      ...item,
      matchDistanceKm: distanceKm(lat, lon, Number(item.latitude), Number(item.longitude)),
    }))
    .sort((a, b) => a.matchDistanceKm - b.matchDistanceKm)[0];
  return nearest?.matchDistanceKm <= 3 ? nearest : null;
}

function enrichWeatherRow(row) {
  const context = findLakeContext(row);
  const area = Number(context?.area_km2);
  return {
    ...row,
    waterbody_class: waterbodyClass(row),
    lake_area_km2: Number.isFinite(area) ? area : '',
    lake_size_class: lakeSizeClass(area),
    lake_context_source: context ? 'hydrolakes' : 'none',
    matched_lake_name: context?.name || '',
    lake_catalog_id: context?.lake_id || '',
    lake_type_code: context?.lake_type_code ?? '',
    lake_context_distance_km: Number.isFinite(context?.matchDistanceKm) ? Number(context.matchDistanceKm.toFixed(2)) : '',
  };
}

function getLakeIndex() {
  if (lakeIndexCache && Date.now() - lakeIndexCacheTime < 30_000) return lakeIndexCache;
  if (!fs.existsSync(paddleDataRoot)) {
    lakeIndexCache = { exists: false, lakes: [], monthlyCsvFiles: 0 };
    return lakeIndexCache;
  }

  const lakes = fs.readdirSync(paddleDataRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = ensureInside(paddleDataRoot, path.join(paddleDataRoot, entry.name));
      let files = 0;
      try {
        files = fs.readdirSync(dir).filter((file) => /^\d{4}-\d{2}\.csv$/.test(file)).length;
      } catch {
        files = 0;
      }
      return {
        id: entry.name,
        name: normalizeLakeName(entry.name),
        files,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  lakeIndexCache = {
    exists: true,
    lakes,
    lakeDirectories: lakes.length,
    monthlyCsvFiles: lakes.reduce((sum, lake) => sum + lake.files, 0),
  };
  lakeIndexCacheTime = Date.now();
  return lakeIndexCache;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() || '');
  return lines.map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      const raw = values[index] ?? '';
      const num = Number(raw);
      row[header] = raw !== '' && Number.isFinite(num) ? num : raw;
    });
    return row;
  });
}

function parseCsvSample(text, sampleSize = 120) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() || '');
  const indexed = lines.map((line, index) => ({ line, rowNumber: index + 2 }));
  const selected = shuffle(indexed).slice(0, Math.min(sampleSize, indexed.length));
  return selected.map(({ line, rowNumber }) => {
    const values = parseCsvLine(line);
    const row = { __sourceRowNumber: rowNumber };
    headers.forEach((header, index) => {
      const raw = values[index] ?? '';
      const num = Number(raw);
      row[header] = raw !== '' && Number.isFinite(num) ? num : raw;
    });
    return row;
  });
}

function findWeatherRow({ lake, date, time }) {
  if (!lake || !date || !time) throw new Error('lake, date, and time are required');
  const month = String(date).slice(0, 7);
  const lakeDir = ensureInside(paddleDataRoot, path.join(paddleDataRoot, lake));
  const csvPath = ensureInside(lakeDir, path.join(lakeDir, `${month}.csv`));
  if (!fs.existsSync(csvPath)) {
    throw new Error(`No CSV for ${lake} ${month}`);
  }
  const hour = String(time).slice(0, 2).padStart(2, '0');
  const wanted = `${date} ${hour}:00`;
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const exact = rows.find((row) => String(row.datetime || '').startsWith(wanted));
  if (exact) return exact;

  const sameDay = rows.filter((row) => String(row.datetime || '').startsWith(date));
  if (!sameDay.length) throw new Error(`No rows for ${date}`);
  const targetHour = Number(hour);
  return sameDay
    .map((row) => ({
      row,
      distance: Math.abs(Number(String(row.datetime).slice(11, 13)) - targetHour),
    }))
    .sort((a, b) => a.distance - b.distance)[0].row;
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function weatherBucket(row) {
  const wind = Number(row.wind_kph || 0);
  const temp = Number(row.temp_c || 0);
  const precip = Number(row.precip_mm || 0);
  const wave = Number(row.estimated_wave_height_m || 0);
  if (wind >= 28 || wave >= 0.35) return 'high-wind/wave';
  if (precip > 2) return 'rain';
  if (temp <= 5 || Number(row.estimated_water_temp_c || 0) <= 5) return 'cold';
  if (temp >= 30) return 'hot';
  if (wind <= 8 && precip === 0) return 'calm';
  return 'normal';
}

function rowDate(row) {
  const datetime = String(row.datetime || '');
  const parsed = new Date(datetime.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rowSeason(row) {
  const explicit = String(row.season || '').toLowerCase();
  if (['winter', 'spring', 'summer', 'autumn', 'fall'].includes(explicit)) {
    return explicit === 'fall' ? 'autumn' : explicit;
  }
  const date = rowDate(row);
  if (!date) return 'unknown';
  const month = date.getMonth() + 1;
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

function rowTimeOfDay(row) {
  const datetime = String(row.datetime || '');
  const hour = Number(datetime.slice(11, 13));
  if (!Number.isFinite(hour)) return 'unknown';
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 15) return 'midday';
  if (hour >= 15 && hour < 19) return 'afternoon';
  if (hour >= 19 && hour < 23) return 'evening';
  return 'night';
}

function isUsScenarioRow(row) {
  const region = String(row.lake_region || row.region || '').toLowerCase();
  if (region.startsWith('usa_') || region.includes('united_states')) return true;
  if (region) return false;
  const lat = Number(row.latitude);
  const lon = Number(row.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 24 && lat <= 49.5 && lon >= -125 && lon <= -66;
}

function matchesScenarioFilters(row, filters) {
  const datetime = String(row.datetime || '');
  const hour = Number(datetime.slice(11, 13));
  if (Number.isFinite(hour) && (hour >= 21 || hour < 5)) return false;

  const season = String(filters.season || 'any').toLowerCase();
  const timeOfDay = String(filters.timeOfDay || 'any').toLowerCase();
  const bucket = String(filters.bucket || 'balanced').toLowerCase();

  if (season !== 'any' && rowSeason(row) !== season) return false;
  if (timeOfDay !== 'any' && rowTimeOfDay(row) !== timeOfDay) return false;
  if (bucket !== 'balanced' && bucket !== 'any' && weatherBucket(row) !== bucket) return false;
  if (filters._precomputedSize !== undefined && filters._precomputedSize !== null) {
    if (filters._precomputedSize !== String(filters.lakeSize).toLowerCase()) return false;
  }
  return true;
}

function sampleScenarios({ count = 20, region = 'USA', season = 'any', timeOfDay = 'any', bucket = 'balanced', lakeSource = 'all', lakeSize = 'any', gaps = '' }) {
  const index = getLakeIndex();
  if (!index.exists) throw new Error(`Data root missing: ${paddleDataRoot}`);

  const desired = Math.max(1, Math.min(Number(count) || 20, 100));
  const candidates = [];
  const seenLakes = new Set();
  const answeredScenarioIds = new Set(readRatings().map((record) => record.scenarioId).filter(Boolean));

  const gapSet = new Set(String(gaps || '').split(',').filter(Boolean));

  let allowedIds = null;
  if (lakeSource === 'priority') allowedIds = getPriorityLakeIds();
  else if (lakeSource === 'production') allowedIds = getProductionLakeIds();

  const candidateLakes = shuffle(index.lakes.filter((lake) => lake.files > 0 && (!allowedIds || allowedIds.has(lake.id))));
  const hasNarrowFilter = season !== 'any' || timeOfDay !== 'any' || !['balanced', 'any'].includes(String(bucket).toLowerCase()) || lakeSize !== 'any';
  const maxCandidates = Math.max(desired * (hasNarrowFilter ? 5 : 2), hasNarrowFilter ? 80 : 30);
  const maxLakeScans = hasNarrowFilter ? Math.min(candidateLakes.length, Math.max(desired * 8, 80)) : Math.min(candidateLakes.length, Math.max(desired * 4, 120));
  let scannedLakes = 0;

  for (const lake of candidateLakes) {
    if (candidates.length >= maxCandidates) break;
    if (scannedLakes >= maxLakeScans) break;
    scannedLakes += 1;
    if (seenLakes.has(lake.id)) continue;

    const lakeDir = ensureInside(paddleDataRoot, path.join(paddleDataRoot, lake.id));
    let monthFiles = [];
    try {
      monthFiles = fs.readdirSync(lakeDir).filter((file) => /^\d{4}-\d{2}\.csv$/.test(file));
    } catch {
      continue;
    }

    let precomputedSize = undefined;
    if (lakeSize !== 'any') {
      const sampleFile = monthFiles[0];
      if (!sampleFile) continue;
      try {
        const samplePath = ensureInside(lakeDir, path.join(lakeDir, sampleFile));
        const sampleRows = parseCsvSample(fs.readFileSync(samplePath, 'utf8'), 1);
        if (sampleRows.length) {
          const enriched = enrichWeatherRow(sampleRows[0]);
          precomputedSize = enriched.lake_size_class || 'unknown';
          if (precomputedSize !== lakeSize) continue;
        }
      } catch { continue; }
    }

    const seasonFiles = season === 'any'
      ? monthFiles
      : monthFiles.filter((file) => rowSeason({ datetime: `${file.slice(0, 7)}-15 12:00` }) === season);
    const fileLimit = hasNarrowFilter ? Math.min(seasonFiles.length, 3) : 2;
    for (const file of shuffle(seasonFiles).slice(0, fileLimit)) {
      try {
        const csvPath = ensureInside(lakeDir, path.join(lakeDir, file));
        const filterOpts = { season, timeOfDay, bucket, lakeSize, _precomputedSize: precomputedSize };
        const rows = parseCsvSample(fs.readFileSync(csvPath, 'utf8'), hasNarrowFilter ? 160 : 80)
          .filter((row) => row.datetime && (region !== 'USA' || isUsScenarioRow(row)) && matchesScenarioFilters(row, filterOpts));
        if (!rows.length) continue;
        const row = shuffle(rows)[0];
        const datetime = String(row.datetime);
        const id = `${lake.id}:${datetime}`;
        if (answeredScenarioIds.has(id)) continue;
        const date = datetime.slice(0, 10);
        const time = datetime.slice(11, 16);
        const enriched = enrichWeatherRow(row);
        candidates.push({
          id,
          lake: lake.id,
          lakeDisplayName: normalizeLakeName(lake.id),
          date,
          time,
          bucket: weatherBucket(row),
          season: rowSeason(row),
          timeOfDay: rowTimeOfDay(row),
          sizeClass: enriched.lake_size_class || 'unknown',
          sourceCsv: csvPath,
          sourceRowNumber: row.__sourceRowNumber,
          sourceKind: 'real_csv_weather_row',
          weather: enriched,
        });
        seenLakes.add(lake.id);
        break;
      } catch {
        // Try another month file for this lake.
      }
    }
  }

  const bucketOrder = ['calm', 'normal', 'cold', 'hot', 'rain', 'high-wind/wave'];
  if (!['balanced', 'any'].includes(String(bucket).toLowerCase())) {
    return shuffle(candidates).slice(0, desired);
  }

  if (gapSet.size > 0) {
    const gapMatches = [];
    const rest = [];
    for (const s of shuffle(candidates)) {
      const key = `${s.season}|${s.bucket}|${s.sizeClass}`;
      if (gapSet.has(key)) gapMatches.push(s);
      else rest.push(s);
    }
    const result = [...shuffle(gapMatches).slice(0, Math.ceil(desired * 0.6)), ...shuffle(rest)];
    return result.slice(0, desired);
  }

  const byBucket = new Map(bucketOrder.map((bucket) => [bucket, []]));
  for (const scenario of shuffle(candidates)) {
    if (!byBucket.has(scenario.bucket)) byBucket.set(scenario.bucket, []);
    byBucket.get(scenario.bucket).push(scenario);
  }

  const scenarios = [];
  while (scenarios.length < desired) {
    let added = false;
    for (const bucket of bucketOrder) {
      const list = byBucket.get(bucket) || [];
      if (list.length && scenarios.length < desired) {
        scenarios.push(list.shift());
        added = true;
      }
    }
    if (!added) break;
  }

  return scenarios;
}

function readRatings() {
  if (!fs.existsSync(ratingsFile)) return [];
  return fs.readFileSync(ratingsFile, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

function writeRatings(records) {
  fs.mkdirSync(ratingsDir, { recursive: true });
  fs.writeFileSync(ratingsFile, `${records.map((record) => JSON.stringify(record)).join('\n')}${records.length ? '\n' : ''}`);
}

function paddleTrainerApi() {
  return {
    name: 'paddle-trainer-api',
    configureServer(server) {
      server.middlewares.use('/paddle-trainer/api', async (req, res) => {
        try {
          const url = new URL(req.url || '/', 'http://localhost');

          if (req.method === 'GET' && url.pathname === '/status') {
            const index = getLakeIndex();
            const catalog = getLakeCatalog();
            return sendJson(res, 200, {
              apiAvailable: true,
              dataRoot: paddleDataRoot,
              ratingsFile,
              stats: {
                lakeDirectories: index.lakeDirectories || 0,
                monthlyCsvFiles: index.monthlyCsvFiles || 0,
                hydroLakeCatalogRows: catalog.rows.length,
              },
            });
          }

          if (req.method === 'GET' && url.pathname === '/lakes') {
            const q = String(url.searchParams.get('q') || '').toLowerCase();
            const index = getLakeIndex();
            const lakes = index.lakes
              .filter((lake) => !q || lake.name.toLowerCase().includes(q) || lake.id.toLowerCase().includes(q))
              .slice(0, 40);
            return sendJson(res, 200, { lakes });
          }

          if (req.method === 'GET' && url.pathname === '/weather') {
            const weather = findWeatherRow({
              lake: url.searchParams.get('lake'),
              date: url.searchParams.get('date'),
              time: url.searchParams.get('time'),
            });
            return sendJson(res, 200, { weather: enrichWeatherRow(weather) });
          }

          if (req.method === 'GET' && url.pathname === '/scenarios') {
            const scenarios = sampleScenarios({
              count: url.searchParams.get('count') || 20,
              region: url.searchParams.get('region') || 'USA',
              season: url.searchParams.get('season') || 'any',
              timeOfDay: url.searchParams.get('timeOfDay') || 'any',
              bucket: url.searchParams.get('bucket') || 'balanced',
              lakeSource: url.searchParams.get('lakeSource') || 'all',
              lakeSize: url.searchParams.get('lakeSize') || 'any',
              gaps: url.searchParams.get('gaps') || '',
            });
            return sendJson(res, 200, { scenarios });
          }

          if (req.method === 'GET' && url.pathname === '/tourist-lakes') {
            const manifest = loadPriorityLakes();
            const lakes = Object.values(manifest.lakes || {})
              .filter((l) => l.is_production_spot)
              .map((l) => ({
                id: l.name?.replace(/ /g, '_')?.replace(/'/g, ''),
                name: l.name,
                region: l.region,
                lat: l.latitude,
                lng: l.longitude,
              }))
              .sort((a, b) => a.name.localeCompare(b.name));
            return sendJson(res, 200, { lakes });
          }

          if (req.method === 'GET' && url.pathname === '/tourist-weather') {
            const lakeId = url.searchParams.get('lake');
            const requestDate = url.searchParams.get('date');
            if (!lakeId) return sendJson(res, 400, { error: 'lake param required' });
            const lakeDir = ensureInside(paddleDataRoot, path.join(paddleDataRoot, lakeId));
            if (!fs.existsSync(lakeDir)) return sendJson(res, 404, { error: 'Lake data not found' });

            const csvFiles = fs.readdirSync(lakeDir)
              .filter((f) => /^\d{4}-\d{2}\.csv$/.test(f))
              .sort()
              .reverse();
            if (!csvFiles.length) return sendJson(res, 404, { error: 'No weather data available' });

            let targetCsv = csvFiles[0];
            if (requestDate) {
              const monthKey = requestDate.slice(0, 7);
              const exact = csvFiles.find((f) => f.startsWith(monthKey));
              if (exact) targetCsv = exact;
              else {
                const sorted = [...csvFiles].sort();
                const nearest = sorted.find((f) => f >= monthKey + '.csv') || sorted[sorted.length - 1];
                if (nearest) targetCsv = nearest;
              }
            }
            const csvPath = ensureInside(lakeDir, path.join(lakeDir, targetCsv));
            const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
            if (!rows.length) return sendJson(res, 404, { error: 'No rows in data' });

            let bestRow = rows[rows.length - 1];
            if (requestDate) {
              const target = new Date(requestDate + 'T12:00');
              let minDiff = Infinity;
              for (const r of rows) {
                const d = new Date(String(r.datetime || '').replace(' ', 'T'));
                if (!Number.isNaN(d.getTime())) {
                  const diff = Math.abs(d.getTime() - target.getTime());
                  if (diff < minDiff) { minDiff = diff; bestRow = r; }
                }
              }
            }

            const weather = enrichWeatherRow(bestRow);
            return sendJson(res, 200, { weather, source: csvFiles[0], date: bestRow.datetime });
          }

          if (req.method === 'GET' && url.pathname === '/priority-lakes') {
            const manifest = loadPriorityLakes();
            const prefs = loadAdminPrefs();
            return sendJson(res, 200, { manifest, prefs });
          }

          if (req.method === 'POST' && url.pathname === '/admin-prefs') {
            const body = await parseBody(req);
            const prefs = loadAdminPrefs();
            const { action, lakeId } = body;
            if (!lakeId) return sendJson(res, 400, { error: 'lakeId required' });
            const lists = ['rejected', 'watchlist', 'visits'];
            for (const list of lists) {
              if (!prefs[list]) prefs[list] = [];
            }
            if (action === 'reject') {
              if (!prefs.rejected.includes(lakeId)) prefs.rejected.push(lakeId);
              prefs.watchlist = prefs.watchlist.filter((id) => id !== lakeId);
              prefs.visits = prefs.visits.filter((id) => id !== lakeId);
            } else if (action === 'unreject') {
              prefs.rejected = prefs.rejected.filter((id) => id !== lakeId);
            } else if (action === 'watchlist') {
              if (!prefs.watchlist.includes(lakeId)) prefs.watchlist.push(lakeId);
            } else if (action === 'unwatchlist') {
              prefs.watchlist = prefs.watchlist.filter((id) => id !== lakeId);
            } else if (action === 'visit') {
              if (!prefs.visits.includes(lakeId)) prefs.visits.push(lakeId);
            } else if (action === 'unvisit') {
              prefs.visits = prefs.visits.filter((id) => id !== lakeId);
            }
            saveAdminPrefs(prefs);
            return sendJson(res, 200, { prefs });
          }

          if (req.method === 'GET' && url.pathname === '/ratings') {
            return sendJson(res, 200, { records: readRatings(), ratingsFile });
          }

          if (req.method === 'POST' && url.pathname === '/ratings') {
            const body = await parseBody(req);
            const record = {
              ...body,
              id: body.id || randomUUID(),
              createdAt: body.createdAt || new Date().toISOString(),
            };
            const records = [record, ...readRatings().filter((item) => item.id !== record.id)];
            writeRatings(records);
            return sendJson(res, 200, { record, ratingsFile });
          }

          const deleteMatch = url.pathname.match(/^\/ratings\/([^/]+)$/);
          if (req.method === 'DELETE' && deleteMatch) {
            const id = decodeURIComponent(deleteMatch[1]);
            const records = readRatings().filter((record) => record.id !== id);
            writeRatings(records);
            return sendJson(res, 200, { ok: true, ratingsFile });
          }

          if (req.method === 'POST' && url.pathname === '/reset-training') {
            const body = await parseBody(req);
            if (body.confirm !== 'RESET') {
              return sendJson(res, 400, { error: 'Send { confirm: "RESET" } to confirm' });
            }
            const backup = `${ratingsFile}.backup-${Date.now()}`;
            if (fs.existsSync(ratingsFile)) {
              fs.copyFileSync(ratingsFile, backup);
              fs.writeFileSync(ratingsFile, '');
            }
            return sendJson(res, 200, { ok: true, backup, message: 'Training data reset. Backup saved.' });
          }

          return sendJson(res, 404, { error: 'Not found' });
        } catch (error) {
          return sendJson(res, 500, { error: error.message || 'Local API error' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [paddleTrainerApi(), react()],
  base: '/paddlingout/trainer/',
  build: {
    outDir: '../src/paddlingout/trainer',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 5176,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001/kaaykostore/us-central1/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
