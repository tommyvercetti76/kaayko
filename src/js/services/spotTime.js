/**
 * services/spotTime.js — the LAKE's clock.
 *
 * Every "now" on a forecast is the lake's now: which hour is "this hour", which
 * forecast day is "today", whether a window is still ahead, what "tomorrow"
 * means. These used to read the viewer's browser clock (new Date().getHours()),
 * so a visitor in Dallas looking at Ambazari Lake at 1:30 am Nagpur time was
 * told its next daylight window was "later today at 4 PM", and saw India's
 * 4 Oct labelled "Today, Oct 3" (AUDIT-2026-10-03 F1).
 *
 * The zone comes from the forecast response (`location.timeZone`, the IANA zone
 * WeatherAPI reports). Without it, a coarse estimate from longitude stands in,
 * and `estimated: true` says so. Forecast days are compared by their own
 * `date` strings ("YYYY-MM-DD", already lake-local), never by array position.
 *
 * Classic script: sets window.KaaykoSpotTime. Also exports for Node tests.
 */
(function (root) {
  'use strict';

  /** Coarse IANA zone from coordinates, for when the API sent none. */
  function estimateTimezone(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -66) {
      if (lng <= -114) return 'America/Los_Angeles';
      if (lng <= -104) return 'America/Denver';
      if (lng <= -87) return 'America/Chicago';
      return 'America/New_York';
    }
    if (lat >= 6 && lat <= 36 && lng >= 68 && lng <= 98) return 'Asia/Kolkata';
    const off = Math.round(lng / 15);
    if (off >= -12 && off <= 12) return `Etc/GMT${off <= 0 ? '+' : '-'}${Math.abs(off)}`;
    return null;
  }

  function validZone(tz) {
    if (!tz || typeof tz !== 'string') return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (_) { return false; }
  }

  /** The lake's IANA zone: the API's, else an estimate from its coordinates. */
  function zoneOf(location, spot) {
    const given = location && (location.timeZone || location.timezone);
    if (validZone(given)) return { zone: given, estimated: false };
    const c = (location && location.coordinates) || (spot && spot.location) || {};
    const lat = Number(c.latitude ?? c.lat), lng = Number(c.longitude ?? c.lng);
    const guess = estimateTimezone(lat, lng);
    return validZone(guess) ? { zone: guess, estimated: true } : { zone: null, estimated: true };
  }

  /** Wall-clock parts of an instant in a zone: { date: "YYYY-MM-DD", hour, minute }. */
  function partsIn(zone, at) {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
    const p = {};
    for (const x of f.formatToParts(at)) p[x.type] = x.value;
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, minute: Number(p.minute) };
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  /**
   * The lake's "now": { date, hour, minute, zone, estimated }.
   * @param {{timeZone?:string, coordinates?:{latitude:number, longitude:number}}} [location]
   * @param {{location?:{latitude:number, longitude:number}}} [spot]
   * @param {Date} [at]  the instant (defaults to now; tests pass their own)
   */
  function nowAt(location, spot, at) {
    const when = at instanceof Date ? at : new Date();
    const { zone, estimated } = zoneOf(location, spot);
    if (zone) return Object.assign(partsIn(zone, when), { zone, estimated });
    // Last resort: the viewer's clock, flagged.
    return {
      date: `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`,
      hour: when.getHours(), minute: when.getMinutes(), zone: null, estimated: true
    };
  }

  /** Is hour `hour` of forecast day `day` still ahead of the lake's `now`? */
  function isAhead(day, hour, now, dayIndex) {
    if (day && day.date) {
      if (day.date > now.date) return true;
      if (day.date < now.date) return false;
      return hour > now.hour;
    }
    return dayIndex > 0 || hour > now.hour;   // no date on the day: old behaviour
  }

  /** Is forecast day `day` the lake's today? */
  function isToday(day, now, dayIndex) {
    return day && day.date ? day.date === now.date : dayIndex === 0;
  }

  /** Days from the lake's today to `dateStr` (0 today, 1 tomorrow, -1 yesterday). */
  function dayOffset(dateStr, now) {
    const a = Date.parse(`${dateStr}T12:00:00Z`), b = Date.parse(`${now.date}T12:00:00Z`);
    return Number.isFinite(a) && Number.isFinite(b) ? Math.round((a - b) / 86400000) : null;
  }

  /** Labels for a forecast day: { primary: "Today" | "Tomorrow" | "Mon", secondary: "Oct 4" }. */
  function dayLabels(dateStr, now) {
    const at = new Date(`${dateStr}T12:00:00Z`);
    if (!dateStr || isNaN(at.getTime())) return null;
    const off = dayOffset(dateStr, now);
    const weekday = at.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const primary = off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : off === -1 ? 'Yesterday' : weekday;
    return { primary, secondary: at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) };
  }

  /** "Later today" / "Tomorrow" / "Mon": how to refer to a forecast day from the lake's now. */
  function relativeDay(dateStr, now) {
    const off = dayOffset(dateStr, now);
    if (off === 0) return 'Later today';
    if (off === 1) return 'Tomorrow';
    const at = new Date(`${dateStr}T12:00:00Z`);
    return isNaN(at.getTime()) ? 'Later' : at.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  }

  /* ── night at the lake: ONE rule for every surface ──────────────────────
   * Kaayko scores daylight paddling only, so at night no surface shows a live
   * score: not the list card, not search, not a spot page, not the forecast
   * hero. Whether it is night is decided at the moment of rendering from the
   * lake's sunrise and sunset (`daylight`, UTC instants from the API), so a
   * copy fetched 40 minutes ago and one fetched now agree, and the viewer's
   * own clock and timezone never enter into it. Without those instants (a copy
   * cached before they existed) the API's own flag decides.
   */
  function ms(v) { const t = Date.parse(v); return Number.isFinite(t) ? t : null; }

  /**
   * @param {{night?:{isNight:boolean}, daylight?:{sunrise:string,sunset:string,nextSunrise:string}, conditions?:{isDay:boolean}}} score
   * @param {Date} [at]
   * @returns {boolean}
   */
  function isNightAt(score, at) {
    if (!score || typeof score !== 'object') return false;
    const t = (at instanceof Date ? at : new Date()).getTime();
    const d = score.daylight || {};
    const rise = ms(d.sunrise), set = ms(d.sunset), next = ms(d.nextSunrise);
    if (rise != null && set != null) {
      if (t >= rise && t < set) return false;
      if (t < rise) return true;                       // before dawn, same lake day
      if (next != null && t < next) return true;       // after dusk, before tomorrow's dawn
      // past the window this copy describes: fall through to its flag
    }
    return (score.night && score.night.isNight === true) || (score.conditions && score.conditions.isDay === false) || false;
  }

  /** When daylight returns at the lake, as lake-local text ("6 AM"), or null. */
  function daylightReturns(score, at) {
    if (!score || typeof score !== 'object') return null;
    const t = (at instanceof Date ? at : new Date()).getTime();
    const d = score.daylight || {};
    const rise = ms(d.sunrise), next = ms(d.nextSunrise);
    const when = rise != null && t < rise ? rise : (next != null && t < next ? next : null);
    if (when != null && validZone(d.zone)) {
      return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: d.zone })
        .format(new Date(when)).replace(':00', '');
    }
    const h = score.night && score.night.nextDaylight && Number(score.night.nextDaylight.hour);
    if (Number.isFinite(h) && h >= 0 && h <= 23) return ((h % 12) || 12) + (h < 12 ? ' AM' : ' PM');
    return null;
  }

  /** "6 AM", "12 PM": the one hour format on every surface (lake-local hour in). */
  function hourLabel(hour) {
    const h = parseInt(hour, 10);
    if (!Number.isFinite(h) || h < 0 || h > 23) return '';
    return ((h % 12) || 12) + (h < 12 ? ' AM' : ' PM');
  }

  /**
   * Is forecast hour `hd` (lake-local hour `h`) in daylight? The API's own
   * per-hour flag (WeatherAPI is_day for that hour at the lake); a civil
   * 7 AM-6 PM only for a payload too old to carry it. The heatmap, the best
   * window, "better later" and the night gate all ask this, so none of them
   * can offer an hour the others call night.
   */
  function isDaylightHour(hd, h) {
    if (hd && typeof hd.isDay === 'boolean') return hd.isDay;
    return h >= 7 && h <= 18;
  }

  const api = { estimateTimezone, zoneOf, nowAt, isAhead, isToday, dayOffset, dayLabels, relativeDay, isNightAt, daylightReturns, hourLabel, isDaylightHour };
  root.KaaykoSpotTime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
