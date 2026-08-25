/* -------------------------------------------
 * Kaayko Konditions — blended hourly heatmap (khm-*)
 * The one true heatmap. Extracted verbatim from forecast.html so the
 * forecast page, the /paddlingout spot modal and /paddlingout/methodology
 * all render the identical component. Styles: KonditionsHeatmap.css.
 *
 *   KonditionsHeatmap.render(container, forecastData, currentData?)
 *     container    — element the heatmap mounts into
 *     forecastData — { forecast: [ { date, hourly: {6..20} } ], ... }
 *     currentData  — current-conditions payload (best-window + NOW marker);
 *                    optional, pass null when unavailable
 *
 * Also exports the helpers the heatmap is built on:
 *   .findBestWindow(currentData, forecastData)
 *   .formatHourDisplay(hour)   .scoreLabel(score)
 * ------------------------------------------- */
(function (global) {
  'use strict';

  function scoreLabel(score) {
    const r = parseFloat(score);
    if (r >= 3.7) return 'WORTH IT';
    if (r >= 2.7) return 'CAREFUL';
    return 'HARD PASS';
  }

  function formatHourDisplay(hour) {
    const h = parseInt(hour, 10);
    if (h === 0) return '12:00 AM';
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return '12:00 PM';
    return `${h - 12}:00 PM`;
  }

  function findBestWindow(currentData, forecastData) {
    const forecast = forecastData?.forecast;
    if (!Array.isArray(forecast)) return null;

    const currentRating = parseFloat(currentData?.paddleScore?.rating ?? 0);
    const currentHour = new Date().getHours();
    let best = null;

    forecast.slice(0, 3).forEach((day, dayIndex) => {
      const hourly = day?.hourly || {};
      Object.keys(hourly).map(Number).sort((a, b) => a - b).forEach(hour => {
        if (dayIndex === 0 && hour <= currentHour) return;
        const hourData = hourly[String(hour)] || hourly[hour];
        const rating = parseFloat(hourData?.mlPrediction?.rating ?? hourData?.prediction?.rating ?? hourData?.rating);
        if (isNaN(rating)) return;
        if (!best || rating > best.score) {
          best = { dayIndex, hour, score: rating, date: day?.date || null };
        }
      });
    });

    if (!best || (best.score < 3 && best.score < currentRating + 0.5)) return null;
    const dayLabel = best.dayIndex === 0 ? 'Later today' : best.dayIndex === 1 ? 'Tomorrow' : 'Day 3';
    return {
      ...best,
      dayLabel,
      timeLabel: `${dayLabel} at ${formatHourDisplay(best.hour)}`,
      label: scoreLabel(best.score)
    };
  }

  const KHM_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const KHM_SPAN = KHM_HOURS[KHM_HOURS.length - 1] - KHM_HOURS[0]; // 14

  function khmSeverity(score) {
    const r = parseFloat(score);
    if (r >= 3.7) return 'good';
    if (r >= 2.7) return 'moderate';
    return 'critical';
  }
  function khmColor(sev) {
    // Canonical tier colors (Careful = amber #c59a61, matching KaaykoPrefs.paddleScoreColor)
    return sev === 'good' ? '#316d43' : sev === 'moderate' ? '#c59a61' : '#bd3b2b';
  }
  function khmRating(h) {
    const r = parseFloat(h?.mlPrediction?.rating ?? h?.prediction?.rating ?? h?.rating);
    return isNaN(r) ? null : Math.round(r);
  }
  function khmPct(hour) {
    return ((hour - KHM_HOURS[0]) / KHM_SPAN * 100).toFixed(2);
  }
  function khmMacros(hd) {
    // Defensive fallback: never throw if KaaykoPrefs (unit formatters) isn't loaded
    // on the host page — degrade to plain metric rather than breaking the panel.
    const P = window.KaaykoPrefs || {
      fmtWind:   v => `${Math.round(parseFloat(v))} km/h`,
      fmtTemp:   v => `${Math.round(parseFloat(v))}°C`,
      fmtHeight: v => `${parseFloat(v).toFixed(1)} m`,
      fmtDist:   v => `${parseFloat(v).toFixed(1)} km`
    };
    const wind  = parseFloat(hd?.windSpeed);
    const dir   = parseFloat(hd?.windDirection);
    const water = parseFloat(hd?.waterTemp);
    const air   = parseFloat(hd?.airTemp ?? hd?.temperature);
    const uv    = parseFloat(hd?.uvIndex ?? hd?.uv);
    const humid = parseFloat(hd?.humidity);
    const vis   = parseFloat(hd?.visibility);
    const wave  = parseFloat(hd?.waveHeight ?? hd?.swellHeight);
    const dirs  = ['N','NE','E','SE','S','SW','W','NW'];
    const dl    = !isNaN(dir) ? ' ' + dirs[Math.round(dir/45)%8] : '';
    const out   = [];
    if (!isNaN(wind))  out.push({ icon:'wind',        label:'Wind',       value: P.fmtWind(wind) + dl });
    if (!isNaN(uv))    out.push({ icon:'sun',         label:'UV Index',   value: uv.toFixed(0) });
    if (!isNaN(water)) out.push({ icon:'water-temp',  label:'Water Temp', value: P.fmtTemp(water) });
    if (!isNaN(air))   out.push({ icon:'thermometer', label:'Air Temp',   value: P.fmtTemp(air) });
    if (!isNaN(wave))  out.push({ icon:'wave',        label:'Wave Ht',    value: P.fmtHeight(wave) });
    if (!isNaN(humid)) out.push({ icon:'humidity',    label:'Humidity',   value:`${Math.round(humid)}%` });
    if (!isNaN(vis))   out.push({ icon:'eye',         label:'Visibility', value: P.fmtDist(vis) });
    return out;
  }

  function render(container, forecastData, currentData = null) {
    if (!container) return;
    const forecast = forecastData?.forecast;
    if (!Array.isArray(forecast) || !forecast.length) return;

    const best        = findBestWindow(currentData, forecastData);
    const currentHour = new Date().getHours();

    // Build a CSS linear-gradient string from hourly scores
    function buildGradient(day) {
      const stops = KHM_HOURS.map(h => {
        const hd    = day.hourly?.[String(h)] ?? day.hourly?.[h];
        const score = hd ? khmRating(hd) : null;
        const col   = score !== null ? khmColor(khmSeverity(score)) : '#1e150a';
        return `${col} ${khmPct(h)}%`;
      });
      return `linear-gradient(to right, ${stops.join(', ')})`;
    }

    // Tick marks at fixed hours
    const TICKS = [6, 9, 12, 15, 18, 20];
    const TICK_LABELS = { 6:'6 AM', 9:'9 AM', 12:'12 PM', 15:'3 PM', 18:'6 PM', 20:'8 PM' };

    const daysHTML = forecast.slice(0, 3).map((day, di) => {
      const d = new Date(); d.setDate(d.getDate() + di);
      const primary   = di === 0 ? 'Today' : di === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US',{weekday:'short'});
      const secondary = d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
      const gradient  = buildGradient(day);

      // Best-window flag for this day
      const bestHour = (best?.dayIndex === di) ? best.hour : null;
      const bestPct  = bestHour !== null ? khmPct(bestHour) : null;

      // "Now" marker — only today, only within range
      const nowPct = (di === 0 && currentHour >= KHM_HOURS[0] && currentHour <= KHM_HOURS[KHM_HOURS.length-1])
        ? khmPct(currentHour) : null;

      // Invisible hit-zones, one per hour
      const hits = KHM_HOURS.map(h => {
        const hd  = day.hourly?.[String(h)] ?? day.hourly?.[h];
        const w   = (1 / KHM_SPAN * 100).toFixed(2);
        const l   = Math.max(0, parseFloat(khmPct(h)) - parseFloat(w)/2).toFixed(2);
        return `<button class="khm-hit" data-day="${di}" data-hour="${h}"
          style="left:${l}%;width:${w}%"
          aria-label="${formatHourDisplay(h)}"${!hd?' disabled':''}></button>`;
      }).join('');

      const ticksHTML = TICKS.map(h => {
        const isFirst = h === TICKS[0], isLast = h === TICKS[TICKS.length-1];
        return `<span class="khm-tick${isFirst?' khm-tick--first':isLast?' khm-tick--last':''}"
          style="left:${khmPct(h)}%">${TICK_LABELS[h]}</span>`;
      }).join('');

      return `
        <div class="khm-day" data-day="${di}">
          <div class="khm-day-label">
            <strong>${primary}</strong><span>${secondary}</span>
          </div>
          <div class="khm-bar-shell">
            <div class="khm-bar" data-day="${di}" style="background:${gradient}">
              <div class="khm-gloss" aria-hidden="true"></div>
              ${nowPct !== null ? `<div class="khm-now" style="left:${nowPct}%" aria-label="Now"><span>NOW</span></div>` : ''}
              <div class="khm-cursor" aria-hidden="true"></div>
              ${hits}
            </div>
            <div class="khm-ticks" aria-hidden="true">${ticksHTML}</div>
          </div>
          <div class="khm-panel" id="khm-p${di}" hidden></div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="khm-wrap">
        <div class="khm-head">
          <div>
            <span class="khm-eyebrow">3-day outlook</span>
          </div>
          <div class="khm-legend">
            <span><i class="khm-dot" style="background:#bd3b2b"></i>Hard pass</span>
            <span><i class="khm-dot" style="background:#eb8127"></i>Careful</span>
            <span><i class="khm-dot" style="background:#316d43"></i>Worth it</span>
          </div>
        </div>
        ${daysHTML}
      </div>`;

    // ── Interactions ────────────────────────────────────────────────────
    container.querySelectorAll('.khm-hit:not([disabled])').forEach(hit => {
      hit.addEventListener('click', () => {
        const di    = parseInt(hit.dataset.day, 10);
        const hour  = parseInt(hit.dataset.hour, 10);
        const bar   = container.querySelector(`.khm-bar[data-day="${di}"]`);
        const cursor = bar?.querySelector('.khm-cursor');
        const panel = container.querySelector(`#khm-p${di}`);
        const wasActive = hit.classList.contains('is-active');

        // Close other days
        forecast.forEach((_, idx) => {
          if (idx === di) return;
          container.querySelectorAll(`.khm-hit[data-day="${idx}"]`).forEach(h => h.classList.remove('is-active'));
          const ob = container.querySelector(`.khm-bar[data-day="${idx}"]`);
          if (ob) ob.classList.remove('has-sel');
          ob?.querySelector('.khm-cursor')?.classList.remove('visible');
          const op = container.querySelector(`#khm-p${idx}`);
          if (op) op.hidden = true;
        });

        // Clear this day's hits
        container.querySelectorAll(`.khm-hit[data-day="${di}"]`).forEach(h => h.classList.remove('is-active'));

        if (wasActive) {
          bar?.classList.remove('has-sel');
          cursor?.classList.remove('visible');
          if (panel) panel.hidden = true;
          return;
        }

        hit.classList.add('is-active');
        bar?.classList.add('has-sel');

        // Snap cursor
        if (cursor) {
          cursor.style.left = `${khmPct(hour)}%`;
          cursor.classList.add('visible');
        }

        // Build panel
        const hd = forecast[di]?.hourly?.[String(hour)] ?? forecast[di]?.hourly?.[hour];
        if (!hd || !panel) return;
        const score  = khmRating(hd);
        const sev    = score !== null ? khmSeverity(score) : 'critical';
        const col    = khmColor(sev);
        const label  = { good:'WORTH IT', moderate:'CAREFUL', critical:'HARD PASS' }[sev];
        const macros = khmMacros(hd);

        panel.hidden = false;
        panel.innerHTML = `
          <div class="khm-panel-inner" style="--pc:${col}">
            <div class="khm-panel-hdr">
              <div class="khm-panel-left">
                <span class="khm-panel-time">${formatHourDisplay(hour)}</span>
                <span class="khm-panel-verdict" style="color:${col}">${label}</span>
              </div>
              <div class="khm-panel-score" style="color:${col}">${score ?? '—'}<sub>/5</sub></div>
            </div>
            <div class="khm-macros">
              ${macros.map(m=>`
                <div class="khm-macro">
                  <span class="khm-macro-icon" style="color:${col}">${window.KaaykoIcons ? window.KaaykoIcons.get(m.icon) : ''}</span>
                  <div class="khm-macro-body">
                    <span class="khm-macro-label">${m.label}</span>
                    <span class="khm-macro-value">${m.value}</span>
                  </div>
                </div>`).join('')}
            </div>
          </div>`;
      });
    });
  }

  global.KonditionsHeatmap = { render, findBestWindow, formatHourDisplay, scoreLabel };
})(window);
