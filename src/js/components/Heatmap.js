/* -------------------------------------------
 * Clean Heatmap Component - Seamless Blended Visualization
 * Simple 3-day forecast with horizontal gradient strips
 * ------------------------------------------- */
class Heatmap {
  constructor() {
    this.element = null;
  }

  render(forecastData, locationData = null) {
    if (!forecastData || !Array.isArray(forecastData) || forecastData.length === 0) {
      return this.renderError();
    }

    // Store location data for timezone calculations
    this.locationData = locationData;

    const heatmapHTML = `
      <div class="heatmap-new-container">
        <div class="heatmap-header">
          <h3 class="heatmap-title">Kaayko™ Konditions</h3>
          <p class="heatmap-subtitle">3-day paddle forecast with seamless condition blending</p>
        </div>
        <div class="heatmap-grid">
          ${this.generateHeatmapRows(forecastData)}
          <div class="heatmap-column-headers">
            <div class="column-spacer"></div>
            <div class="time-period-headers">
              <span class="time-period-header">Morning</span>
              <span class="time-period-header">Noon</span>
              <span class="time-period-header">Evening</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = heatmapHTML;
    this.element = wrapper.firstElementChild;

    // Add click handlers
    this.addClickHandlers();

    return this.element;
  }

  generateHeatmapRows(forecastData) {
    let rowsHTML = '';
    
    for (let day = 0; day < 3; day++) {
      const dayData = forecastData[day] || {};
      const dateLabel = this.getDateLabel(day);
      const gradientStrip = this.createDayGradient(dayData, day);
      
      rowsHTML += `
        <div class="heatmap-row" data-day="${day}">
          <div class="day-label">${dateLabel}</div>
          <div class="gradient-strip ${day === 0 ? 'current-day' : ''}" 
               style="background: ${gradientStrip.gradient}"
               data-day="${day}"
               data-hours='${JSON.stringify(gradientStrip.hourlyData)}'>
            ${day === 0 ? this.getCurrentHourIndicator() : ''}
            <div class="hover-tooltip" id="tooltip-${day}"></div>
          </div>
        </div>
      `;
    }
    
    return rowsHTML;
  }

  createDayGradient(dayData, day) {
    // Get all hours from 6 AM to 11 PM (18 hours total)
    const hours = ['6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'];
    
    // Extract colors and store hourly data for tooltips
    const colors = [];
    const hourlyData = [];
    
    hours.forEach(hour => {
      const hourData = dayData.hourly?.[hour];
      if (hourData) {
        const rating = hourData?.mlPrediction?.rating || hourData?.rating || 2.5;
        colors.push(this.getRatingColor(rating));
        hourlyData.push({
          hour: hour,
          rating: rating.toFixed(1),
          time: this.formatHour(hour)
        });
      } else {
        colors.push('#666666'); // Gray for missing data
        hourlyData.push({
          hour: hour,
          rating: '2.5',
          time: this.formatHour(hour)
        });
      }
    });
    
    // Create seamless horizontal gradient
    const gradient = `linear-gradient(to right, ${colors.join(', ')})`;
    
    return { gradient, colors, hourlyData };
  }

  getCurrentHourIndicator() {
    // Get current time in the target location's timezone
    const currentHour = this.getCurrentHourInLocationTimezone();
    
    // Only show indicator if within our forecast range (6 AM to 11 PM)
    if (currentHour < 6 || currentHour > 23) {
      return '';
    }
    
    // Calculate position as percentage across the 18-hour range (6 AM to 11 PM)
    const hourIndex = currentHour - 6; // 0-17 index
    const position = ((hourIndex + 0.5) / 18) * 100; // Center the dot on the hour
    
    return `<div class="current-hour-indicator" style="left: ${position}%"></div>`;
  }

  /**
   * Get current hour in the target location's timezone
   * Uses geographic coordinates to estimate timezone
   */
  getCurrentHourInLocationTimezone() {
    const now = new Date();
    
    // If no location data, fall back to browser timezone
    if (!this.locationData?.coordinates) {
      console.warn('⚠️ No location data for timezone calculation, using browser timezone');
      return now.getHours();
    }
    
    const { latitude, longitude } = this.locationData.coordinates;
    
    // Calculate rough timezone offset from longitude
    // Each 15 degrees of longitude ≈ 1 hour of time difference from GMT
    const roughTimezoneOffset = Math.round(longitude / 15);
    
    // Apply known timezone adjustments for major regions
    let actualOffset = roughTimezoneOffset;
    
    // India (IST): UTC+5:30
    if (latitude >= 6 && latitude <= 37 && longitude >= 68 && longitude <= 97) {
      actualOffset = 5.5; // IST is UTC+5:30
    }
    // China: UTC+8
    else if (latitude >= 18 && latitude <= 54 && longitude >= 73 && longitude <= 135) {
      actualOffset = 8;
    }
    // European regions
    else if (latitude >= 35 && latitude <= 71 && longitude >= -10 && longitude <= 40) {
      actualOffset = longitude > 7.5 ? 2 : 1; // CET/CEST
    }
    // US regions
    else if (latitude >= 25 && latitude <= 49 && longitude >= -125 && longitude <= -66) {
      if (longitude >= -90) actualOffset = -5; // EST
      else if (longitude >= -105) actualOffset = -6; // CST  
      else if (longitude >= -120) actualOffset = -7; // MST
      else actualOffset = -8; // PST
    }
    
    // Get UTC time and add offset
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const localTime = new Date(utcTime + (actualOffset * 3600000));
    
    console.log(`🌍 Timezone calculation: Lon ${longitude} → Offset UTC${actualOffset >= 0 ? '+' : ''}${actualOffset} → Local hour: ${localTime.getHours()}`);
    
    return localTime.getHours();
  }

  formatHour(hour) {
    const hourNum = parseInt(hour);
    if (hourNum === 0) return '12:00 AM';
    if (hourNum < 12) return `${hourNum}:00 AM`;
    if (hourNum === 12) return '12:00 PM';
    return `${hourNum - 12}:00 PM`;
  }

  getRatingColor(rating) {
    const numRating = parseFloat(rating);
    
    // Unified gradient-based color scheme used across ALL components
    if (numRating >= 4.5) {
      return '#1B4332'; // 0% - Excellent
    } else if (numRating >= 4.0) {
      return '#2D5A32'; // 15% - Good
    } else if (numRating >= 3.5) {
      return '#CD853F'; // 30% - Fair
    } else if (numRating >= 3.0) {
      return '#E36414'; // 45% - Caution
    } else if (numRating >= 2.5) {
      return '#C0392B'; // 60% - Risky
    } else if (numRating >= 2.0) {
      return '#8E0E00'; // 75% - Poor
    } else if (numRating >= 1.5) {
      return '#5B0000'; // 85% - Dangerous
    } else if (numRating >= 1.0) {
      return '#2B1815'; // 95% - Critical
    } else {
      return '#000000'; // 100% - Extreme
    }
  }

  getDateLabel(dayOffset) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    
    if (dayOffset === 0) {
      return `Today\n${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else if (dayOffset === 1) {
      return `Tomorrow\n${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    } else {
      return `${date.toLocaleDateString('en-US', { weekday: 'short' })}\n${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
  }

  addClickHandlers() {
    if (!this.element) return;
    
    const strips = this.element.querySelectorAll('.gradient-strip');
    strips.forEach((strip) => {
      this.addHoverEffects(strip);
      
      strip.addEventListener('click', () => {
        const day = strip.dataset.day;
        console.log(`Clicked on day ${day} heatmap strip`);
        // Add modal or detail view here if needed
      });
    });
  }

  addHoverEffects(strip) {
    const tooltip = strip.querySelector('.hover-tooltip');
    const hourlyData = JSON.parse(strip.dataset.hours || '[]');
    
    // Add haptic feedback support
    const supportsHaptic = 'vibrate' in navigator;
    
    strip.addEventListener('mousemove', (e) => {
      const rect = strip.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = x / rect.width;
      
      // Calculate which hour we're hovering over (18 hours total)
      const hourIndex = Math.floor(percentage * 18);
      const hourData = hourlyData[hourIndex];
      
      if (hourData) {
        // Show tooltip
        tooltip.innerHTML = `
          <div class="tooltip-content">
            <div class="tooltip-time">${hourData.time}</div>
            <div class="tooltip-rating">Score: ${hourData.rating}/5.0</div>
          </div>
        `;
        tooltip.style.left = `${x}px`;
        tooltip.style.display = 'block';
        
        // Add haptic feedback on desktop (if supported)
        if (supportsHaptic && e.type === 'mousemove') {
          // Light haptic feedback every time we move to a new hour
          const currentHour = strip.dataset.currentHour;
          if (currentHour !== hourData.hour) {
            navigator.vibrate(10); // Very light 10ms vibration
            strip.dataset.currentHour = hourData.hour;
          }
        }
      }
    });
    
    strip.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
      strip.dataset.currentHour = '';
    });
    
    strip.addEventListener('mouseenter', () => {
      // Light haptic feedback when entering the strip
      if (supportsHaptic) {
        navigator.vibrate(15);
      }
    });
  }

  renderError() {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'heatmap-error';
    errorDiv.innerHTML = `
      <div class="error-message">
        <span>⚠️ No forecast data available</span>
      </div>
    `;
    return errorDiv;
  }
}

// Export for use
window.Heatmap = Heatmap;
