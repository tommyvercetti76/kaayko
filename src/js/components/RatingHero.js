/**
 * Rating Hero Component
 * Displays a donut-ring score + paddler's briefing with real condition analysis
 */
class RatingHero {
  constructor() {
    this.element = null;
    this.useMetric = localStorage.getItem('kaayko_units') !== 'imperial';
    this.lastRenderData = null;
    this.rawValues = {};
    this._feedbackSpotId = null;
    this._feedbackPredictedScore = null;
    this._feedbackSubmitted = false;
  }

  render(rating, interpretation, weather = {}, forecastData = null, spotId = null) {
    this.lastRenderData = { rating, interpretation, weather };
    this._feedbackSpotId = spotId;
    this._feedbackPredictedScore = rating;
    this._feedbackSubmitted = false;

    // Extract weather values
    const temp          = weather?.temperature ?? '--';
    const wind          = weather?.windSpeed   ?? '--';
    const windDirection = weather?.windDirection || 'N';
    const uvIndex       = weather?.uvIndex     !== undefined ? weather.uvIndex   : '--';
    const cloudCover    = weather?.cloudCover  !== undefined ? weather.cloudCover : '--';

    // Real water temp from API; fallback: air - 3°C
    const rawWt = weather?.waterTemp;
    const waterTemp = (rawWt !== undefined && rawWt !== null && !isNaN(parseFloat(rawWt)))
      ? parseFloat(rawWt)
      : (temp !== '--' ? parseFloat(temp) - 3 : '--');

    // Store raw values for unit switching
    this.rawValues = {
      temp:      temp !== '--' ? parseFloat(temp)  : null,
      waterTemp: waterTemp !== '--' ? parseFloat(waterTemp) : null,
      wind:      wind !== '--' ? parseFloat(wind)  : null,
      windDirection,
      uvIndex:   uvIndex !== '--' ? parseFloat(uvIndex)     : null,
      cloudCover: cloudCover !== '--' ? parseFloat(cloudCover) : null
    };

    // Unit conversion
    const tempUnit  = this.useMetric ? '°C' : '°F';
    const windUnit  = this.useMetric ? 'km/h' : 'mph';
    const dispTemp      = this.useMetric ? temp      : this.celsiusToFahrenheit(temp);
    const dispWaterTemp = this.useMetric ? waterTemp : this.celsiusToFahrenheit(waterTemp);
    const dispWind      = this.useMetric ? wind      : this.kphToMph(wind);

    const heroHTML = `
      <div class="skill-level-section">
        <div class="header-content">

          <!-- ── Score Ring ── -->
          <div class="rating-section">
            <div class="paddle-score-label">Paddle Score</div>
            ${this.buildScoreRing(rating)}
            <div class="now-indicator">NOW</div>
          </div>

          <!-- ── Weather stats + unit toggle ── -->
          <div class="skill-info">
            <div class="core-weather-inline">
              <div class="weather-stat">
                <div class="weather-icon">🌡️</div>
                <div class="weather-data">
                  <span class="weather-value">${dispTemp}${tempUnit}</span>
                  <span class="weather-label">Air Temp</span>
                </div>
              </div>
              <div class="weather-stat">
                <div class="weather-icon">💨</div>
                <div class="weather-data">
                  <span class="weather-value">${dispWind} ${windUnit}</span>
                  <span class="weather-label">Wind Speed</span>
                </div>
              </div>
              <div class="weather-stat">
                <div class="weather-icon">🧭</div>
                <div class="weather-data">
                  <span class="weather-value">${windDirection}</span>
                  <span class="weather-label">Wind Dir</span>
                </div>
              </div>
              <div class="weather-stat">
                <div class="weather-icon">🌊</div>
                <div class="weather-data">
                  <span class="weather-value">${typeof dispWaterTemp === 'number' ? dispWaterTemp.toFixed(1) : dispWaterTemp}${tempUnit}</span>
                  <span class="weather-label">Water Temp</span>
                </div>
              </div>
              <div class="weather-stat">
                <div class="weather-icon">☀️</div>
                <div class="weather-data">
                  <span class="weather-value">${uvIndex}</span>
                  <span class="weather-label">UV Index</span>
                </div>
              </div>
              <div class="weather-stat">
                <div class="weather-icon">☁️</div>
                <div class="weather-data">
                  <span class="weather-value">${cloudCover}%</span>
                  <span class="weather-label">Cloud Cover</span>
                </div>
              </div>
            </div>
            <div class="units-toggle">
              <button class="units-btn ${this.useMetric ? 'active' : ''}" data-unit="metric">°C / km/h</button>
              <button class="units-btn ${!this.useMetric ? 'active' : ''}" data-unit="imperial">°F / mph</button>
            </div>
          </div>
        </div>

        <!-- ── Paddler's Briefing ── -->
        ${this.buildPaddlerBriefing(rating, weather, forecastData)}
      </div>

      <!-- ── Feedback widget ── -->
      <div class="paddle-feedback" data-submitted="false">
        <span class="feedback-prompt">Was this score accurate?</span>
        <div class="feedback-buttons">
          <button class="feedback-btn" data-vote="5"    title="Way better than predicted">👍👍</button>
          <button class="feedback-btn" data-vote="up"   title="Better than predicted">👍</button>
          <button class="feedback-btn" data-vote="ok"   title="About right">👌</button>
          <button class="feedback-btn" data-vote="down" title="Worse than predicted">👎</button>
          <button class="feedback-btn" data-vote="1"    title="Way worse than predicted">👎👎</button>
        </div>
        <span class="feedback-thanks" style="display:none">Thanks for the feedback!</span>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = heroHTML;
    this.element = container.firstElementChild;

    // Animate the ring after a tick (CSS transition from 0 → target)
    requestAnimationFrame(() => {
      const ring = this.element?.querySelector('.ring-progress');
      if (ring) {
        const fill  = ring.dataset.fill;
        const total = ring.dataset.total;
        ring.style.strokeDasharray = `${fill} ${total}`;
      }
    });

    this.setupUnitToggle();
    this.setupFeedback();
    return this.element;
  }

  // ── SVG Donut Ring ────────────────────────────────────────────────────────

  buildScoreRing(rating) {
    const r   = 46, cx = 60, cy = 60;
    const circ = +(2 * Math.PI * r).toFixed(1); // ~289.0
    const pct  = Math.max(0, Math.min(1, parseFloat(rating) / 5));
    const fill = +(pct * circ).toFixed(1);
    const offset = +(-circ / 4).toFixed(1); // start at 12 o'clock
    const color  = this.getRingColor(rating);
    const label  = this.getScoreLabel(rating);
    const pctStr = Math.round(pct * 100) + '%';

    return `
      <div class="score-ring-wrapper">
        <svg class="score-ring" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          <circle class="ring-track" cx="${cx}" cy="${cy}" r="${r}"/>
          <circle class="ring-progress"
            cx="${cx}" cy="${cy}" r="${r}"
            stroke="${color}"
            stroke-dasharray="0 ${circ}"
            stroke-dashoffset="${offset}"
            data-fill="${fill}"
            data-total="${circ}"/>
        </svg>
        <div class="ring-overlay">
          <div class="ring-number">${rating}</div>
          <div class="ring-denom">/ 5</div>
        </div>
      </div>
      <div class="ring-label" style="color:${color}">${label}</div>
    `;
  }

  getRingColor(rating) {
    const r = parseFloat(rating);
    if (r >= 4.5) return '#22C55E';
    if (r >= 4.0) return '#4ADE80';
    if (r >= 3.5) return '#CD853F';
    if (r >= 3.0) return '#E36414';
    if (r >= 2.5) return '#C0392B';
    if (r >= 2.0) return '#A01010';
    if (r >= 1.5) return '#8B1212';
    return '#A82020';          // visible burgundy even at 20%
  }

  getScoreLabel(rating) {
    const r = parseFloat(rating);
    if (r >= 4.5) return 'EXCELLENT';
    if (r >= 4.0) return 'GREAT';
    if (r >= 3.5) return 'GOOD';
    if (r >= 3.0) return 'FAIR';
    if (r >= 2.5) return 'RISKY';
    if (r >= 2.0) return 'POOR';
    if (r >= 1.5) return 'DANGER';
    return 'CRITICAL';
  }

  // ── Paddler's Briefing ────────────────────────────────────────────────────

  buildPaddlerBriefing(rating, weather, forecastData) {
    const verdict    = this.getVerdict(rating);
    const conditions = this.analyzeConditions(weather, rating);
    const suggestion = this.getForecastSuggestion(rating, forecastData);

    return `
      <div class="paddler-briefing ${verdict.className}">

        <!-- Verdict header -->
        <div class="briefing-verdict">
          <div class="verdict-icon">${verdict.icon}</div>
          <div class="verdict-text">
            <div class="verdict-title">${verdict.title}</div>
            <div class="verdict-subtitle">${verdict.subtitle}</div>
          </div>
        </div>

        <!-- Condition rows -->
        ${conditions.length ? `
        <div class="briefing-conditions">
          ${conditions.map(item => `
            <div class="condition-row row-${item.severity}">
              <span class="cr-icon">${item.icon}</span>
              <div class="cr-body">
                <div class="cr-label">${item.label}</div>
                <div class="cr-detail">${item.detail}</div>
              </div>
            </div>
          `).join('')}
        </div>` : ''}

        <!-- Forecast suggestion -->
        ${suggestion ? `
        <div class="briefing-suggestion">
          <span class="suggestion-icon">📅</span>
          <div class="suggestion-text">${suggestion}</div>
        </div>` : ''}

      </div>
    `;
  }

  getVerdict(rating) {
    const r = parseFloat(rating);
    if (r >= 4.5) return { icon: '🎯', title: 'Excellent Conditions',    subtitle: 'Perfect for all skill levels — go paddle!',                         className: 'verdict-excellent' };
    if (r >= 4.0) return { icon: '✅', title: 'Great Conditions',        subtitle: 'Recommended for most paddlers',                                      className: 'verdict-great'    };
    if (r >= 3.5) return { icon: '👍', title: 'Good Conditions',         subtitle: 'Intermediate paddlers and above',                                    className: 'verdict-good'     };
    if (r >= 3.0) return { icon: '⚠️', title: 'Fair Conditions',         subtitle: 'Experienced paddlers — assess carefully before going',               className: 'verdict-fair'     };
    if (r >= 2.5) return { icon: '🔶', title: 'Challenging Conditions',  subtitle: 'Expert paddlers only — serious difficulty',                          className: 'verdict-risky'    };
    if (r >= 2.0) return { icon: '🚫', title: 'Poor Conditions',         subtitle: 'Not recommended — multiple risk factors present',                    className: 'verdict-poor'     };
    return              { icon: '⛔', title: 'Dangerous Conditions',     subtitle: 'Not recommended for any skill level — stay off the water',           className: 'verdict-danger'   };
  }

  analyzeConditions(weather, rating) {
    const items = [];
    const w     = weather || {};
    const r     = parseFloat(rating) || 3;

    // ── Phase 1: Applied penalties explain WHY score was reduced ─────────────
    // These are the actual reasons the ML pipeline docked points.
    const penaltyStrings = (w.penalties || []).filter(p => typeof p === 'string');
    let penaltyTotal = 0;
    penaltyStrings.forEach(p => {
      const m = p.match(/^(.+?):\s*([-+]?\d+\.?\d*)/);
      if (!m) return;
      const amount = parseFloat(m[2]);
      if (amount > -0.1) return;
      penaltyTotal += amount;
      const abs = Math.abs(amount);
      const sev = abs >= 1.5 ? 'severe' : abs >= 1.0 ? 'danger' : abs >= 0.5 ? 'warning' : 'caution';
      const icon = sev === 'severe' ? '⛔' : sev === 'danger' ? '⚠️' : '▲';
      items.push({
        icon,
        label: m[1].trim(),
        detail: `Score impact: ${amount.toFixed(1)} pts`,
        severity: sev,
        priority: abs >= 1.5 ? 0 : abs >= 1.0 ? 1 : abs >= 0.5 ? 3 : 5
      });
    });

    // ── Phase 2: Observable hazard conditions ────────────────────────────────
    const windKph = parseFloat(w.windSpeed);
    if (!isNaN(windKph)) {
      const dir     = w.windDirection ? ` ${w.windDirection}` : '';
      const gustKph = parseFloat(w.gustSpeed) || 0;
      const gustStr = gustKph > windKph * 1.2 ? ` · gusts ${gustKph.toFixed(0)} km/h` : '';
      const B       = this.getBeaufortFromKph(windKph);
      if (windKph >= 50) {
        items.push({ icon: '🌪️', label: `Storm-force Wind — ${windKph.toFixed(0)} km/h${dir} (B${B})${gustStr}`, detail: 'No paddling under any circumstances', severity: 'severe', priority: 0 });
      } else if (windKph >= 39) {
        items.push({ icon: '⛔',  label: `Gale Wind — ${windKph.toFixed(0)} km/h${dir} (B${B})${gustStr}`,        detail: 'Impossible to paddle — capsize very likely', severity: 'severe', priority: 0 });
      } else if (windKph >= 29) {
        items.push({ icon: '💨',  label: `Strong Wind — ${windKph.toFixed(0)} km/h${dir} (B${B})${gustStr}`,      detail: 'Whitecaps forming — expert paddlers only', severity: 'danger', priority: 1 });
      } else if (windKph >= 20) {
        items.push({ icon: '🌬️', label: `Moderate Wind — ${windKph.toFixed(0)} km/h${dir} (B${B})${gustStr}`,    detail: 'Increased resistance — experienced paddlers', severity: 'warning', priority: 4 });
      }
      // calm/light wind only shown if score is good (Phase 3)
    }

    const wt = parseFloat(w.waterTemp);
    if (!isNaN(wt)) {
      if (wt < 10) {
        items.push({ icon: '🧊', label: `Extreme Cold Water — ${wt.toFixed(1)}°C`, detail: 'Hypothermia within minutes — drysuit + PFD essential', severity: 'severe', priority: 1 });
      } else if (wt < 15) {
        items.push({ icon: '❄️', label: `Cold Water — ${wt.toFixed(1)}°C`,         detail: 'Cold shock risk on immersion — wetsuit mandatory', severity: 'danger', priority: 2 });
      }
      // comfortable/warm water only shown if score is good (Phase 3)
    }

    const precip = parseFloat(w.precipMm);
    if (!isNaN(precip) && precip >= 0.1) {
      if (precip >= 5) {
        items.push({ icon: '🌧️', label: `Heavy Rain — ${precip.toFixed(1)} mm`,  detail: 'Lightning hazard — seek shelter immediately', severity: 'severe', priority: 0 });
      } else if (precip >= 1) {
        items.push({ icon: '🌦️', label: `Rain — ${precip.toFixed(1)} mm`,        detail: 'Reduced visibility — monitor storm development', severity: 'danger', priority: 2 });
      } else {
        items.push({ icon: '🌂', label: `Light Rain — ${precip.toFixed(1)} mm`,  detail: 'Watch for developing storms', severity: 'warning', priority: 5 });
      }
    }

    const vis = parseFloat(w.visibility);
    if (!isNaN(vis) && vis < 9) {
      if (vis < 3) {
        items.push({ icon: '🌫️', label: `Very Poor Visibility — ${vis.toFixed(1)} km`, detail: 'Navigation hazard — stay near shore', severity: 'severe', priority: 1 });
      } else if (vis < 6) {
        items.push({ icon: '🌫️', label: `Poor Visibility — ${vis.toFixed(1)} km`,      detail: 'Mark your position — stay aware of other vessels', severity: 'danger', priority: 3 });
      } else {
        items.push({ icon: '🌁', label: `Reduced Visibility — ${vis.toFixed(1)} km`,   detail: 'Limit distance from shore', severity: 'warning', priority: 6 });
      }
    }

    const cloud = parseFloat(w.cloudCover);
    if (!isNaN(cloud) && cloud >= 90) {
      items.push({ icon: '☁️', label: `Overcast — ${cloud.toFixed(0)}%`, detail: 'Active storm system possible — monitor for lightning', severity: 'warning', priority: 6 });
    }

    const uv = parseFloat(w.uvIndex);
    if (!isNaN(uv) && uv >= 6) {
      const sev = uv >= 10 ? 'danger' : uv >= 8 ? 'warning' : 'caution';
      const tag = uv >= 10 ? 'Extreme' : uv >= 8 ? 'Very High' : 'High';
      items.push({ icon: '☀️', label: `${tag} UV — Index ${uv.toFixed(0)}`, detail: 'SPF 50+ sunscreen — reapply every 90 min', severity: sev, priority: 8 });
    }

    // ── Phase 3: Score is good — show favorable conditions as context ─────────
    if (r >= 3.0 && items.filter(i => i.severity !== 'good').length === 0) {
      if (!isNaN(windKph) && windKph < 20) {
        const dir   = w.windDirection ? ` ${w.windDirection}` : '';
        const label = windKph < 2 ? 'Glassy Calm' : windKph < 12 ? 'Light Breeze' : 'Gentle Breeze';
        items.push({ icon: '≈', label: `${label} — ${windKph.toFixed(0)} km/h${dir} (B${this.getBeaufortFromKph(windKph)})`, detail: 'Ideal paddling conditions', severity: 'good', priority: 9 });
      }
      if (!isNaN(wt)) {
        if (wt >= 20 && wt < 27) {
          items.push({ icon: '💧', label: `Comfortable Water — ${wt.toFixed(1)}°C`,  detail: 'Ideal paddling and swimming temperature', severity: 'good', priority: 9 });
        } else if (wt >= 15 && wt < 20) {
          items.push({ icon: '🌊', label: `Cool Water — ${wt.toFixed(1)}°C`,         detail: 'Wetsuit recommended for extended sessions', severity: 'caution', priority: 7 });
        } else if (wt >= 27) {
          items.push({ icon: '🌡️', label: `Warm Water — ${wt.toFixed(1)}°C`,         detail: 'Stay hydrated — algae possible in summer', severity: 'caution', priority: 8 });
        }
      }
    }

    // ── Phase 4: Score is poor but nothing specific explains it ──────────────
    if (r < 3.0 && items.length === 0) {
      items.push({ icon: '📊', label: 'Adverse conditions detected', detail: 'ML model identified unfavorable multi-factor pattern', severity: 'warning', priority: 0 });
    }

    if (items.length === 0) {
      items.push({ icon: '✓', label: 'Conditions look favorable', detail: 'No significant hazards detected', severity: 'good', priority: 10 });
    }

    return items.sort((a, b) => a.priority - b.priority).slice(0, 4);
  }

  getForecastSuggestion(currentRating, forecastData) {
    try {
      const forecast = forecastData?.forecast;
      if (!Array.isArray(forecast)) return null;

      const current = parseFloat(currentRating);
      const currentHour = new Date().getHours();

      for (let dayIdx = 0; dayIdx < forecast.length; dayIdx++) {
        const hourly = forecast[dayIdx]?.hourly || {};
        const hours  = Object.keys(hourly).map(Number).sort((a, b) => a - b);

        for (const h of hours) {
          if (dayIdx === 0 && h <= currentHour) continue;
          const hData = hourly[h];
          const r = parseFloat(hData?.rating ?? hData?.prediction?.rating);
          if (!isNaN(r) && r >= current + 1.0 && r >= 3.0) {
            const dayLabel = dayIdx === 0 ? 'Later today' : dayIdx === 1 ? 'Tomorrow' : (forecast[dayIdx].date?.slice(5) || 'Day 3');
            return `Better window: <strong>${dayLabel} at ${this.formatHourDisplay(h)}</strong> — Score ${r.toFixed(1)} (${this.getScoreLabel(r)})`;
          }
        }
      }
    } catch { /* non-fatal */ }
    return null;
  }

  formatHourDisplay(hour) {
    const h = parseInt(hour);
    if (h === 0)  return '12:00 AM';
    if (h < 12)   return `${h}:00 AM`;
    if (h === 12) return '12:00 PM';
    return `${h - 12}:00 PM`;
  }

  getBeaufortFromKph(kph) {
    const k = parseFloat(kph);
    if (k < 2)   return 0;
    if (k < 6)   return 1;
    if (k < 12)  return 2;
    if (k < 20)  return 3;
    if (k < 29)  return 4;
    if (k < 39)  return 5;
    if (k < 50)  return 6;
    if (k < 62)  return 7;
    if (k < 75)  return 8;
    if (k < 89)  return 9;
    if (k < 103) return 10;
    if (k < 118) return 11;
    return 12;
  }

  // ── Unit toggle ───────────────────────────────────────────────────────────

  setupUnitToggle() {
    const buttons = this.element.querySelectorAll('.units-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const unit = e.target.dataset.unit;
        this.useMetric = unit === 'metric';
        localStorage.setItem('kaayko_units', unit);
        buttons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.updateDisplayUnits();
      });
    });
  }

  updateDisplayUnits() {
    if (!this.element) return;
    const stats   = this.element.querySelectorAll('.weather-stat');
    const tempUnit = this.useMetric ? '°C' : '°F';
    const windUnit = this.useMetric ? 'km/h' : 'mph';

    if (stats[0] && this.rawValues.temp !== null) {
      const v = this.useMetric ? this.rawValues.temp.toFixed(1) : this.celsiusToFahrenheit(this.rawValues.temp);
      stats[0].querySelector('.weather-value').textContent = `${v}${tempUnit}`;
    }
    if (stats[1] && this.rawValues.wind !== null) {
      const v = this.useMetric ? this.rawValues.wind.toFixed(1) : this.kphToMph(this.rawValues.wind);
      stats[1].querySelector('.weather-value').textContent = `${v} ${windUnit}`;
    }
    if (stats[3] && this.rawValues.waterTemp !== null) {
      const v = this.useMetric ? this.rawValues.waterTemp.toFixed(1) : this.celsiusToFahrenheit(this.rawValues.waterTemp);
      stats[3].querySelector('.weather-value').textContent = `${v}${tempUnit}`;
    }
  }

  // ── Feedback ──────────────────────────────────────────────────────────────

  setupFeedback() {
    if (!this.element) return;
    const feedbackEl = this.element.querySelector('.paddle-feedback');
    if (!feedbackEl) return;

    feedbackEl.querySelectorAll('.feedback-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (this._feedbackSubmitted) return;
        this._feedbackSubmitted = true;

        const vote      = e.currentTarget.dataset.vote;
        const predicted = parseFloat(this._feedbackPredictedScore) || 3;
        const actualScore = {
          '5':    Math.min(5, predicted + 1.5),
          'up':   Math.min(5, predicted + 0.5),
          'ok':   predicted,
          'down': Math.max(1, predicted - 0.5),
          '1':    Math.max(1, predicted - 1.5)
        }[vote] ?? predicted;

        feedbackEl.setAttribute('data-submitted', 'true');
        feedbackEl.querySelector('.feedback-buttons').style.display = 'none';
        feedbackEl.querySelector('.feedback-prompt').style.display  = 'none';
        feedbackEl.querySelector('.feedback-thanks').style.display  = 'inline';

        if (window.apiClient && this._feedbackSpotId) {
          window.apiClient.submitFeedback(
            this._feedbackSpotId, predicted, actualScore,
            { ...(this.rawValues || {}) }
          ).catch(() => {});
        }
      });
    });
  }

  // ── Conversions ───────────────────────────────────────────────────────────

  celsiusToFahrenheit(c) {
    if (c === '--' || c === undefined || c === null || isNaN(parseFloat(c))) return '--';
    return ((parseFloat(c) * 9 / 5) + 32).toFixed(1);
  }

  kphToMph(kph) {
    if (kph === '--' || kph === undefined || kph === null || isNaN(parseFloat(kph))) return '--';
    return (parseFloat(kph) * 0.621371).toFixed(1);
  }

  metersToFeet(m) {
    if (m === '--' || m === undefined || m === null || isNaN(parseFloat(m))) return '--';
    return (parseFloat(m) * 3.28084).toFixed(1);
  }

  // kept for backward compat
  getRatingColors(rating) {
    const r = parseFloat(rating);
    const color = this.getRingColor(rating);
    return { backgroundColor: color, textColor: '#FFFFFF', borderColor: color };
  }
}

window.RatingHero = RatingHero;
