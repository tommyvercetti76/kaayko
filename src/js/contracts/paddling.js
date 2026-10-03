/**
 * contracts/paddling.js — what the Paddling Out API promises the pages.
 *
 * Two halves of one thing:
 *  1. JSDoc typedefs, so an editor (VS Code checks JSDoc'd JavaScript) knows the
 *     shape of /paddlingOut, /paddleScore, /paddleScore/batch and /fastForecast.
 *  2. A runtime contract (`checkContract`) that tests and scripts/browser-check.mjs
 *     run against the LIVE responses.
 *
 * Why both: the forecast page read `location.timeZone` for months while the
 * API never sent it, and four community spots shipped without `waterType`.
 * A typedef documents a field; only a check against real responses notices
 * when the field is not there (AUDIT-2026-10-03 F1, F7).
 *
 * Classic script (window.KaaykoContracts) that also exports for Node.
 */

/**
 * @typedef {'Worth it'|'Careful'|'Hard pass'} Verdict
 * @typedef {'lake'|'reservoir'|'river'|'coastal'|'bay'|'canal'} WaterType   (the API's SPOT_EDITABLE list)
 *
 * @typedef {Object} ScoreSummary
 * @property {number} rating            snapped to 0.5, 1–5
 * @property {number} [ratingPrecise]
 * @property {Verdict} interpretation    derived from the snapped rating
 * @property {string} [computedAt]
 *
 * @typedef {Object} Spot                one row of GET /paddlingOut
 * @property {string} id
 * @property {string} title
 * @property {WaterType} waterType       REQUIRED: drives "Lake/River alerts" and river handling
 * @property {{latitude:number, longitude:number}} location
 * @property {ScoreSummary} paddleScore
 * @property {string[]} [imgSrc]
 * @property {string[]} [tags]
 *
 * @typedef {Object} PaddleScoreResponse GET /paddleScore?spotId= | ?location=lat,lng
 * @property {true} success
 * @property {{name:string, coordinates:{latitude:number, longitude:number}}} location
 * @property {ScoreSummary & {penaltiesApplied?:string[], totalPenalty?:number, confidence?:string}} paddleScore
 * @property {{temperature:number, windSpeed:number, waterTemp:(number|null)}} conditions
 * @property {{source:string, cached:boolean}} metadata
 *
 * @typedef {Object} ForecastHour
 * @property {number} rating
 * @property {Verdict} interpretation
 * @property {boolean} isDay
 * @property {number} temperature
 * @property {number} windSpeed
 *
 * @typedef {Object} ForecastDay
 * @property {string} date               "YYYY-MM-DD", LAKE-local
 * @property {Object<string, ForecastHour>} hourly   keyed by lake-local hour "0".."23"
 *
 * @typedef {Object} FastForecastResponse GET /fastForecast?lat=&lng=
 * @property {true} success
 * @property {{name:string, timeZone:string, coordinates:{latitude:number, longitude:number}}} location
 *           timeZone is the lake's IANA zone; every "now" on the page uses it
 * @property {ForecastDay[]} forecast
 * @property {{algorithmVersion:string, cached:boolean, cacheAge:number}} metadata
 */

(function (root) {
  'use strict';

  const VERDICTS = ['Worth it', 'Careful', 'Hard pass'];
  const WATER_TYPES = ['lake', 'reservoir', 'river', 'coastal', 'bay', 'canal'];   // = SPOT_EDITABLE.waterType in kaayko-api paddlingout.js
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const isStr = (v) => typeof v === 'string' && v.length > 0;
  const isZone = (v) => {
    if (!isStr(v)) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: v }); return true; } catch (_) { return false; }
  };
  const inRange = (lo, hi) => (v) => isNum(v) && v >= lo && v <= hi;
  const oneOf = (list) => (v) => list.includes(v);
  const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

  /**
   * Each contract: [path, test, what it means]. A path segment ending in []
   * applies the rest of the path to every element of that array.
   */
  const CONTRACTS = {
    spot: [
      ['id', isStr, 'spot id'],
      ['title', isStr, 'spot title'],
      ['waterType', oneOf(WATER_TYPES), `waterType is one of ${WATER_TYPES.join('/')}`],
      ['location.latitude', inRange(-90, 90), 'latitude'],
      ['location.longitude', inRange(-180, 180), 'longitude'],
      ['paddleScore.rating', inRange(1, 5), 'a score from 1 to 5'],
      ['paddleScore.interpretation', oneOf(VERDICTS), 'a canonical verdict'],
    ],
    paddleScore: [
      ['success', (v) => v === true, 'success'],
      ['paddleScore.rating', inRange(1, 5), 'a score from 1 to 5'],
      ['paddleScore.interpretation', oneOf(VERDICTS), 'a canonical verdict'],
      ['conditions.windSpeed', isNum, 'wind speed'],
      ['conditions.temperature', isNum, 'air temperature'],
      ['metadata.source', isStr, 'where the score came from'],
    ],
    fastForecast: [
      ['success', (v) => v === true, 'success'],
      ['location.timeZone', isZone, "the lake's IANA timezone"],
      ['location.coordinates.latitude', inRange(-90, 90), 'latitude'],
      ['forecast', (v) => Array.isArray(v) && v.length >= 1, 'at least one forecast day'],
      ['forecast[].date', isDate, 'each day has a lake-local YYYY-MM-DD date'],
      ['forecast[].hourly', (v) => v && typeof v === 'object' && Object.keys(v).length > 0, 'each day has hours'],
      ['metadata.algorithmVersion', isStr, 'algorithm version'],
    ],
  };

  function values(obj, path) {
    const [head, ...rest] = path.split('.');
    if (head === undefined) return [obj];
    if (head.endsWith('[]')) {
      const arr = obj == null ? undefined : obj[head.slice(0, -2)];
      if (!Array.isArray(arr)) return [undefined];
      return rest.length ? arr.flatMap((el) => values(el, rest.join('.'))) : arr;
    }
    const next = obj == null ? undefined : obj[head];
    return rest.length ? values(next, rest.join('.')) : [next];
  }

  /**
   * Check a payload against a named contract.
   * @param {'spot'|'paddleScore'|'fastForecast'} name
   * @param {*} payload
   * @returns {string[]} one line per broken promise; empty when the payload keeps the contract
   */
  function checkContract(name, payload) {
    const rules = CONTRACTS[name];
    if (!rules) throw new Error(`no contract named ${name}`);
    const problems = [];
    for (const [path, ok, meaning] of rules) {
      const vals = values(payload, path);
      const bad = vals.filter((v) => !ok(v)).length;
      if (bad) problems.push(`${name}.${path}: expected ${meaning}${vals.length > 1 ? ` (${bad} of ${vals.length} wrong)` : ` (got ${JSON.stringify(vals[0])})`}`);
    }
    return problems;
  }

  const api = { CONTRACTS, checkContract, WATER_TYPES, VERDICTS };
  root.KaaykoContracts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
