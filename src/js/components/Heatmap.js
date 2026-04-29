/* -------------------------------------------
 * Kaayko Konditions
 * Fixed 3-day condition bands with tappable time windows.
 * ------------------------------------------- */
class Heatmap {
  constructor() {
    this.element = null;
    this.toastTimer = null;
    this.segmentWindows = [
      { start: 6, end: 8, label: '6-8 AM' },
      { start: 8, end: 10, label: '8-10 AM' },
      { start: 10, end: 12, label: '10-Noon' },
      { start: 12, end: 14, label: 'Noon-2 PM' },
      { start: 14, end: 16, label: '2-4 PM' },
      { start: 16, end: 18, label: '4-6 PM' },
      { start: 18, end: 20, label: '6-8 PM' }
    ];
  }

  render(forecastData, locationData = null, options = {}) {
    if (!forecastData || !Array.isArray(forecastData) || forecastData.length === 0) {
      return this.renderError();
    }

    this.locationData = locationData;
    this.bestWindow = options.bestWindow || null;
    const rows = forecastData.slice(0, 3).map((dayData, day) => this.buildDay(dayData, day));
    const globalBest = rows.reduce((best, row) => {
      if (!best || row.bestSegment.score > best.segment.score) {
        return { row, segment: row.bestSegment };
      }
      return best;
    }, null);

    const heatmapHTML = `
      <section class="heatmap-new-container" aria-label="Three day paddling forecast">
        <div class="heatmap-header">
          <div>
            <span class="heatmap-eyebrow">3-day outlook</span>
            <h3 class="heatmap-title">Kaayko™ Konditions</h3>
          </div>
          ${globalBest ? `
            <button class="heatmap-best-chip" type="button" data-day="${globalBest.row.dayIndex}" data-hour="${globalBest.segment.start}">
              <span>Best window</span>
              <strong>${globalBest.row.label.primary} ${globalBest.segment.label}</strong>
              <em>${globalBest.segment.score.toFixed(1)} / 5</em>
            </button>
          ` : ''}
        </div>
        <div class="heatmap-legend" aria-hidden="true">
          <span><i class="legend-dot poor"></i>Hard pass</span>
          <span><i class="legend-dot fair"></i>Careful</span>
          <span><i class="legend-dot good"></i>Worth it</span>
        </div>
        <div class="heatmap-grid">
          ${rows.map(row => this.renderRow(row)).join('')}
          <div class="heatmap-time-axis" aria-hidden="true">
            <span>6 AM</span><span>10 AM</span><span>2 PM</span><span>6 PM</span><span>8 PM</span>
          </div>
        </div>
      </section>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = heatmapHTML;
    this.element = wrapper.firstElementChild;
    this.addInteractions();
    return this.element;
  }

  buildDay(dayData, dayIndex) {
    const segments = this.segmentWindows.map((windowDef) => {
      const samples = [];
      for (let hour = windowDef.start; hour < windowDef.end; hour++) {
        const hourData = this.getHourData(dayData, hour);
        if (hourData) samples.push(hourData);
      }

      const ratings = samples
        .map(sample => parseFloat(sample?.mlPrediction?.rating ?? sample?.prediction?.rating ?? sample?.rating))
        .filter(value => !isNaN(value));
      const score = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 2.5;

      return {
        ...windowDef,
        score,
        band: this.getBand(score),
        color: this.getRatingColor(score),
        summary: this.describeSegment(samples, score)
      };
    });

    const bestSegment = segments.reduce((best, segment) => segment.score > best.score ? segment : best, segments[0]);

    return {
      dayIndex,
      label: this.getDateLabel(dayIndex),
      bestSegment,
      segments
    };
  }

  renderRow(row) {
    return `
      <article class="heatmap-day" data-day="${row.dayIndex}">
        <div class="day-label">
          <strong>${row.label.primary}</strong>
          <span>${row.label.secondary}</span>
        </div>
        <div class="heatmap-bar" role="list" aria-label="${row.label.primary} ${row.label.secondary} paddling scores">
          ${row.segments.map(segment => `
            <button class="heatmap-segment band-${segment.band}" type="button" role="listitem"
              style="--segment-color:${segment.color}"
              data-day="${row.dayIndex}"
              data-hour="${segment.start}"
              data-label="${segment.label}"
              data-score="${segment.score.toFixed(1)}"
              data-summary="${segment.summary}"
              aria-label="${row.label.primary}, ${segment.label}, score ${segment.score.toFixed(1)} out of 5. ${segment.summary}">
              <span class="segment-fill"></span>
              <span class="segment-score">${segment.score.toFixed(1)}</span>
            </button>
          `).join('')}
          <div class="heatmap-popover" role="status" aria-live="polite"></div>
        </div>
      </article>
    `;
  }

  getHourData(dayData, hour) {
    return dayData?.hourly?.[String(hour)] || dayData?.hourly?.[hour] || null;
  }

  describeSegment(samples, score) {
    const wind = samples
      .map(sample => parseFloat(sample?.windSpeed))
      .filter(value => !isNaN(value));
    const water = samples
      .map(sample => parseFloat(sample?.waterTemp))
      .filter(value => !isNaN(value));
    const avgWind = wind.length ? wind.reduce((sum, value) => sum + value, 0) / wind.length : null;
    const avgWater = water.length ? water.reduce((sum, value) => sum + value, 0) / water.length : null;
    const mood = score >= 4 ? 'Best conditions' : score >= 3 ? 'Usable conditions' : 'Caution conditions';
    const detail = [];
    if (avgWind !== null) detail.push(`${Math.round(avgWind * 0.621371)} mph wind`);
    if (avgWater !== null) detail.push(`${Math.round((avgWater * 9 / 5) + 32)}°F water`);
    return detail.length ? `${mood}, ${detail.join(', ')}` : mood;
  }

  addInteractions() {
    if (!this.element) return;

    this.element.querySelectorAll('.heatmap-segment').forEach(segment => {
      segment.addEventListener('mouseenter', () => this.previewSegment(segment));
      segment.addEventListener('focus', () => this.previewSegment(segment));
      segment.addEventListener('click', () => this.selectSegment(segment));
    });

    const bestChip = this.element.querySelector('.heatmap-best-chip');
    bestChip?.addEventListener('click', () => {
      this.highlightWindow(Number(bestChip.dataset.day), Number(bestChip.dataset.hour));
    });

    window.addEventListener('kaayko:highlightForecastWindow', event => {
      const { day, hour } = event.detail || {};
      this.highlightWindow(day, hour);
    });
  }

  showTooltip(segment) {
    this.previewSegment(segment);
  }

  hideTooltip(segment) {
    if (!segment.classList.contains('is-selected')) {
      segment.closest('.heatmap-day')?.classList.remove('is-previewing');
    }
  }

  previewSegment(segment) {
    const day = segment.closest('.heatmap-day');
    if (!day || day.classList.contains('has-selection')) return;
    this.positionPopover(segment, false);
  }

  selectSegment(segment) {
    const day = segment.closest('.heatmap-day');
    if (!day) return;
    day.querySelectorAll('.heatmap-segment').forEach(item => item.classList.remove('is-selected'));
    segment.classList.add('is-selected');
    day.classList.add('has-selection');
    this.positionPopover(segment, true);
  }

  positionPopover(segment, persist) {
    const day = segment.closest('.heatmap-day');
    const bar = segment.closest('.heatmap-bar');
    const popover = bar?.querySelector('.heatmap-popover');
    if (!day || !bar || !popover) return;

    const label = segment.dataset.label;
    const score = segment.dataset.score;
    const summary = segment.dataset.summary;
    const rawLeftPct = ((parseInt(segment.dataset.hour, 10) - 6 + 1) / 14) * 100;
    const barRect = bar.getBoundingClientRect();
    const mobileCenter = barRect.width
      ? ((window.innerWidth / 2) - barRect.left) / barRect.width * 100
      : 50;
    const leftPct = window.matchMedia('(max-width: 720px)').matches
      ? Math.max(18, Math.min(82, mobileCenter))
      : Math.max(18, Math.min(82, rawLeftPct));

    popover.innerHTML = `
      <span>${label}</span>
      <strong>${score} / 5</strong>
      <em>${summary}</em>
    `;
    popover.style.left = `${leftPct}%`;
    day.classList.add('is-previewing');
    day.classList.toggle('has-selection', persist);
  }

  highlightWindow(day, hour) {
    if (day === undefined || hour === undefined || !this.element) return;
    const matchingWindow = this.segmentWindows.find(windowDef => hour >= windowDef.start && hour < windowDef.end);
    const segmentHour = matchingWindow ? matchingWindow.start : hour;
    const segment = this.element.querySelector(`.heatmap-segment[data-day="${day}"][data-hour="${segmentHour}"]`);
    if (!segment) return;
    segment.classList.add('is-highlighted');
    segment.focus({ preventScroll: true });
    this.selectSegment(segment);
    setTimeout(() => segment.classList.remove('is-highlighted'), 2200);
  }

  getBand(score) {
    const r = parseFloat(score);
    if (r >= 3.7) return 'good';
    if (r >= 2.7) return 'fair';
    return 'poor';
  }

  getRatingColor(rating) {
    const r = parseFloat(rating);
    if (r >= 4.5) return '#255a3a';
    if (r >= 4.0) return '#316d43';
    if (r >= 3.5) return '#c59a61';
    if (r >= 3.0) return '#eb8127';
    if (r >= 2.5) return '#bd3b2b';
    if (r >= 2.0) return '#86170f';
    return '#4a0a08';
  }

  getDateLabel(dayOffset) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    const secondary = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const primary = dayOffset === 0
      ? 'Today'
      : dayOffset === 1
        ? 'Tomorrow'
        : date.toLocaleDateString('en-US', { weekday: 'short' });
    return { primary, secondary };
  }

  renderError() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'heatmap-error';
    errorDiv.innerHTML = `
      <div class="error-message">
        <span>Forecast timing is unavailable right now.</span>
      </div>
    `;
    return errorDiv;
  }
}

window.Heatmap = Heatmap;
