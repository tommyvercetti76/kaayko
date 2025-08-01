/* -------------------------------------------
 * Heatmap Component - 3-Day Forecast Visualization
 * Clean 3x3 Grid Layout (No Canvas, No Popover)
 * ------------------------------------------- */
class Heatmap {
  constructor() {
    this.element = null;
  }

  render(forecastData) {
    if (!forecastData || !Array.isArray(forecastData) || forecastData.length === 0) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'heatmap-error';
      errorDiv.innerHTML = `
        <div class="error-message">
          <span>⚠️ No forecast data available for next 3 days</span>
        </div>
      `;
      return errorDiv;
    }

    // Generate clean 3x3 grid with rectangular rating tiles
    const heatmapHTML = `
      <div class="heatmap-container">
        <div class="chart-header">
          <h3 class="chart-title">Kaayko™ Konditions</h3>
          <p class="chart-description">Tailored paddle ratings to paddle with Konfidence.</p>
          <div class="current-highlight">
            <span class="current-indicator">⏰ Current conditions highlighted • 3-day ML forecast</span>
          </div>
        </div>
        <div class="heatmap-grid-layout">
          ${this.generateGridHTML(forecastData)}
        </div>
      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = heatmapHTML;
    this.element = wrapper.firstElementChild;

    // Add click handlers for period tiles to open submodal
    this.addPeriodClickHandlers(forecastData);

    return this.element;
  }

  generateGridHTML(forecastData) {
    const periods = ['Morning', 'Noon', 'Evening'];
    const periodHours = [8, 14, 20]; // 8 AM, 2 PM, 8 PM
    
    let gridHTML = '<div class="grid-wrapper expanded-hourly">';
    
    // Header row with day labels
    gridHTML += '<div class="grid-header">';
    gridHTML += '<div class="period-label-header"></div>'; // Empty corner
    for (let day = 0; day < 3; day++) {
      const dateStr = this.getDateString(day);
      gridHTML += `<div class="day-header">${dateStr}</div>`;
    }
    gridHTML += '</div>';
    
    // Grid rows (Morning, Noon, Evening) with hourly sub-tiles
    for (let periodIndex = 0; periodIndex < 3; periodIndex++) {
      const period = periods[periodIndex];
      
      gridHTML += '<div class="grid-row expanded-period">';
      gridHTML += `<div class="period-label">${period}</div>`;
      
      // Expanded hourly tiles for each day
      for (let day = 0; day < 3; day++) {
        const dayData = forecastData[day] || {};
        
        // Get all available hourly data for this period
        const hourlyTiles = this.getHourlyTilesForPeriod(dayData, periodIndex, day);
        
        gridHTML += `
          <div class="day-period-container">
            <div class="hourly-tiles-grid">
              ${hourlyTiles}
            </div>
          </div>
        `;
      }
      
      gridHTML += '</div>';
    }
    
    gridHTML += '</div>';
    return gridHTML;
  }

  // Generate hourly tiles within a period (morning/noon/evening)
  getHourlyTilesForPeriod(dayData, periodIndex, day) {
    const periodMappings = {
      0: { name: 'Morning', hours: ['6', '7', '8', '9', '10', '11'] },
      1: { name: 'Noon', hours: ['12', '13', '14', '15', '16', '17'] },
      2: { name: 'Evening', hours: ['18', '19', '20', '21', '22', '23'] }
    };
    
    const periodConfig = periodMappings[periodIndex];
    if (!periodConfig) return '';
    
    // Collect all hourly data for this period
    const hourlyData = [];
    const targetHours = periodConfig.hours;
    
    targetHours.forEach(hour => {
      const hourData = dayData.hourly?.[hour];
      
      if (hourData) {
        hourlyData.push({ hour, data: hourData, isReal: true });
      } else {
        // Interpolate missing data
        const mainHour = periodIndex === 0 ? '8' : periodIndex === 1 ? '12' : '18';
        const mainHourData = dayData.hourly?.[mainHour];
        
        if (mainHourData) {
          const interpolatedData = this.interpolateHourData(mainHourData, hour, mainHour);
          hourlyData.push({ hour, data: interpolatedData, isReal: false });
        } else {
          // Create fallback data with default rating
          const fallbackData = {
            mlPrediction: { rating: 2.5, warnings: [] },
            rating: 2.5,
            weather: { temperature: 70, windSpeed: 5 },
            temperature: 70,
            windSpeed: 5,
            warnings: []
          };
          hourlyData.push({ hour, data: fallbackData, isReal: false });
        }
      }
    });
    
    // Generate blended mobile view and individual desktop tiles
    return `
      <div class="hourly-period-grid">
        ${this.generateDesktopHourlyTiles(hourlyData, day, periodIndex)}
        ${this.generateMobileBlendedTile(hourlyData, periodIndex, day)}
      </div>
    `;
  }

  // Generate individual tiles for desktop
  generateDesktopHourlyTiles(hourlyData, day, periodIndex) {
    let tilesHTML = '';
    
    hourlyData.forEach(({ hour, data, isReal }) => {
      if (data) {
        tilesHTML += this.generateHourlyTile(data, hour, day, periodIndex, isReal);
      } else {
        tilesHTML += this.generateEmptyHourlyTile(hour);
      }
    });
    
    return `<div class="desktop-hourly-tiles">${tilesHTML}</div>`;
  }

  // Generate blended tile for mobile
  generateMobileBlendedTile(hourlyData, periodIndex, day) {
    // Extract colors from all hours in this period
    const colors = hourlyData.map(({ data }) => {
      if (!data) return '#666666'; // Gray for missing data
      const rating = data?.mlPrediction?.rating || data?.rating || 2.5; // Default to 2.5 if no rating
      return this.getPaddleRatingColor(rating);
    });

    // Create CSS gradient from all hourly colors (ensure we have colors)
    const validColors = colors.filter(color => color !== '#666666');
    const gradient = validColors.length > 0 ? 
      `linear-gradient(to bottom, ${colors.join(', ')})` : 
      'linear-gradient(to bottom, #666666, #666666)'; // Fallback gray gradient
    
    // Create summary tooltip for the blended period
    const periodNames = ['Morning', 'Noon', 'Evening'];
    const periodName = periodNames[periodIndex];
    const avgRating = this.calculateAverageRating(hourlyData);
    const tooltip = this.generatePeriodTooltip(hourlyData, periodName);
    
    // Debug logging
    console.log(`🎨 Mobile tile for ${periodName} day ${day}:`, {
      hourlyDataCount: hourlyData.length,
      colors: colors,
      gradient: gradient,
      avgRating: avgRating
    });
    
    return `
      <div class="mobile-blended-tile" 
           data-period="${periodIndex}" 
           data-day="${day}"
           data-avg-rating="${avgRating}"
           title="${tooltip}"
           style="background: ${gradient};">
      </div>
    `;
  }

  // Calculate average rating for a period
  calculateAverageRating(hourlyData) {
    const validRatings = hourlyData
      .filter(({ data }) => data)
      .map(({ data }) => data?.mlPrediction?.rating || data?.rating || 2.5); // Default to 2.5
    
    if (validRatings.length === 0) {
      // If no valid data, return a default rating of 2.5
      return "2.5";
    }
    
    const sum = validRatings.reduce((acc, rating) => acc + rating, 0);
    return (sum / validRatings.length).toFixed(1);
  }

  // Generate tooltip for blended period
  generatePeriodTooltip(hourlyData, periodName) {
    const avgRating = this.calculateAverageRating(hourlyData);
    const validHours = hourlyData.filter(({ data }) => data).length;
    
    let tooltip = `${periodName}\nAverage Rating: ${avgRating}/5.0\n${validHours}/6 hours with data`;
    
    // Add range of conditions
    const ratings = hourlyData
      .filter(({ data }) => data)
      .map(({ data }) => data?.mlPrediction?.rating || data?.rating || 0);
    
    if (ratings.length > 0) {
      const minRating = Math.min(...ratings);
      const maxRating = Math.max(...ratings);
      
      if (minRating !== maxRating) {
        tooltip += `\nRange: ${minRating.toFixed(1)} - ${maxRating.toFixed(1)}`;
      }
    }
    
    return tooltip;
  }

  // Generate individual hourly tile
  generateHourlyTile(hourData, hour, day, periodIndex, isRealData) {
    const rating = hourData?.mlPrediction?.rating || hourData?.rating || 0;
    
    // Get current hour for highlighting
    const now = new Date();
    const currentHour = now.getHours();
    const isCurrentHour = parseInt(hour) === currentHour && day === 0;
    
    // Get rating color based on rating value
    const backgroundColor = this.getPaddleRatingColor(rating);
    
    // Create tooltip with hour data
    const tooltip = this.generateHourTooltip(hourData, hour, isRealData);
    
    return `
      <div class="hourly-tile ${isCurrentHour ? 'current-hour' : ''}" 
           data-hour="${hour}" 
           data-rating="${rating}"
           title="${tooltip}"
           style="background-color: ${backgroundColor};">
      </div>
    `;
  }

  // Generate tooltip for individual hour
  generateHourTooltip(hourData, hour, isRealData) {
    const hourDisplay = hour === '0' ? '12 AM' : 
                       hour === '12' ? '12 PM' : 
                       parseInt(hour) < 12 ? `${parseInt(hour)} AM` : 
                       `${parseInt(hour) - 12} PM`;
    
    if (!hourData) {
      return `${hourDisplay}\nNo data available`;
    }
    
    const rating = hourData?.mlPrediction?.rating || hourData?.rating || 0;
    const temp = hourData?.weather?.temperature || hourData?.temperature || 0;
    const windSpeed = hourData?.weather?.windSpeed || hourData?.windSpeed || 0;
    const warnings = hourData?.mlPrediction?.warnings || hourData?.warnings || [];
    
    let tooltip = `${hourDisplay}${isRealData ? '' : ' (estimated)'}\nRating: ${rating.toFixed(1)}/5.0`;
    
    if (temp) tooltip += `\nTemp: ${Math.round(temp)}°F`;
    if (windSpeed) tooltip += `\nWind: ${Math.round(windSpeed)} mph`;
    
    if (warnings.length > 0) {
      tooltip += `\n\n⚠️ Warnings:\n${warnings.join('\n')}`;
    }
    
    return tooltip;
  }

  // Generate empty hourly tile for missing data
  generateEmptyHourlyTile(hour) {
    const hourDisplay = hour === '0' ? '12 AM' : 
                       hour === '12' ? '12 PM' : 
                       parseInt(hour) < 12 ? `${parseInt(hour)} AM` : 
                       `${parseInt(hour) - 12} PM`;
    
    return `
      <div class="hourly-tile empty-data" 
           data-hour="${hour}" 
           title="${hourDisplay}\nNo data available"
           style="background-color: #333; opacity: 0.3;">
      </div>
    `;
  }

  // Update tooltip to show data source
  generateTooltipData(hourData, contributingFactors, hour, isRealData) {
    if (!hourData) return `${hour}:00 - No data available`;
    
    const time = `${hour}:00`;
    const rating = this.calculatePaddleRating(hourData);
    const factors = contributingFactors.factors.join(', ') || 'Standard conditions';
    const dataSource = isRealData ? 'API Data' : 'Estimated';
    
    let tooltip = `${time} (${dataSource})\nRating: ${rating.toFixed(1)}/5.0\nFactors: ${factors}`;
    
    // Add safety warnings to tooltip
    if (hourData.warnings && hourData.warnings.length > 0) {
      tooltip += `\n\n🚨 SAFETY WARNINGS:\n${hourData.warnings.join('\n')}`;
    }
    
    // Add weather details
    const wind = hourData.windSpeed || 0;
    const gust = hourData.gustSpeed || 0;
    const temp = hourData.temperature || 20;
    const vis = hourData.visibility || 10;
    const uv = hourData.uvIndex || 0;
    
    tooltip += `\n\nConditions:\nWind: ${wind.toFixed(1)} km/h${gust > 0 ? ` (gusts ${gust.toFixed(1)})` : ''}\nTemp: ${temp.toFixed(1)}°C\nVisibility: ${vis.toFixed(1)} km\nUV Index: ${uv.toFixed(1)}`;
    
    if (!isRealData) {
      tooltip += `\n\n~ Estimated from nearby hour data`;
    }
    
    return tooltip;
  }

  // Interpolate hour data from main hour (temporary until API provides all hours)
  interpolateHourData(baseData, targetHour, baseHour) {
    if (!baseData) return { rating: 2.5, temperature: 20, windSpeed: 10, warnings: [] };
    
    const hourDiff = Math.abs(parseInt(targetHour) - parseInt(baseHour));
    const variation = (Math.random() - 0.5) * 0.3; // ±0.15 variation (reduced for safety)
    
    return {
      ...baseData,
      rating: Math.max(1.0, Math.min(5.0, (baseData.rating || 2.5) + variation)),
      temperature: (baseData.temperature || 20) + (Math.random() - 0.5) * 2, // ±1°C variation
      windSpeed: Math.max(0, (baseData.windSpeed || 10) + (Math.random() - 0.5) * 3), // ±1.5 km/h variation
      warnings: hourDiff > 3 ? [] : baseData.warnings, // Reduce warnings for distant hours
      interpolated: true
    };
  }

  // Check if specific hour is current
  isCurrentHour(day, hour) {
    if (day !== 0) return false;
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour === hour;
  }

  getDateString(dayOffset) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  calculatePaddleRating(weather) {
    // Use the ACTUAL ML API paddle rating from forecast endpoint
    let baseRating = weather.paddleRating || 
                     weather.prediction?.rating || 
                     weather.apiRating || 
                     weather.rating || 
                     2.5;
    
    // CRITICAL SAFETY ADJUSTMENTS for life-saving app
    let finalRating = baseRating;
    
    // Apply additional safety deductions based on warnings
    if (weather.warnings && Array.isArray(weather.warnings)) {
      const criticalWarnings = weather.warnings.filter(w => w.includes('DANGER'));
      const majorWarnings = weather.warnings.filter(w => w.includes('WARNING'));
      const minorWarnings = weather.warnings.filter(w => w.includes('CAUTION'));
      
      // DANGER warnings: -1.0 each (life threatening)
      finalRating -= criticalWarnings.length * 1.0;
      
      // WARNING: -0.5 each (serious safety concern)
      finalRating -= majorWarnings.length * 0.5;
      
      // CAUTION: -0.25 each (moderate concern)
      finalRating -= minorWarnings.length * 0.25;
      
      console.log(`� Safety deductions: DANGER(-${criticalWarnings.length}), WARNING(-${majorWarnings.length * 0.5}), CAUTION(-${minorWarnings.length * 0.25})`);
    }
    
    // Additional conservative deductions based on raw weather data
    const windSpeed = weather.windSpeed || weather.wind?.speedKPH || 0;
    const gustSpeed = weather.gustSpeed || 0;
    const visibility = weather.visibility || weather.conditions?.visibility || 10;
    const uvIndex = weather.uvIndex || weather.conditions?.uvIndex || 0;
    const temperature = weather.temperature || weather.temperature?.celsius || 20;
    
    // WIND SAFETY: Most critical for paddling
    if (windSpeed > 30 || gustSpeed > 40) {
      finalRating = Math.min(finalRating, 1.0); // Cap at 1.0 for dangerous winds
    } else if (windSpeed > 25 || gustSpeed > 35) {
      finalRating = Math.min(finalRating, 2.0); // Cap at 2.0 for very high winds
    }
    
    // WATER/AIR TEMPERATURE SAFETY
    if (temperature < 10) {
      finalRating = Math.min(finalRating, 1.5); // Cap for hypothermia risk
    }
    
    // VISIBILITY SAFETY
    if (visibility < 3) {
      finalRating = Math.min(finalRating, 1.0); // Cap for poor visibility
    }
    
    // Ensure minimum rating of 1.0 (never go below)
    finalRating = Math.max(1.0, finalRating);
    
    // ULTRA-CONSERVATIVE ROUNDING FOR SAFETY
    // Always round DOWN to nearest 0.5 for paddle safety
    const roundedRating = Math.floor(finalRating * 2) / 2;
    
    return roundedRating;
  }

  getPaddleRatingColor(rating) {
    // Enhanced color system with subtle gradients for every 0.5 increment
    if (rating >= 4.5) return '#2E7D32'; // Excellent+ - Darker green
    if (rating >= 4.0) return '#4CAF50'; // Excellent - Same green as RatingHero
    if (rating >= 3.5) return '#66BB6A'; // Good+ - Light green
    if (rating >= 3.0) return '#8BC34A'; // Good - Same light green as RatingHero
    if (rating >= 2.5) return '#9CCC65'; // Fair+ - Yellow-green
    if (rating >= 2.0) return '#FFC107'; // Fair - Same yellow as RatingHero
    if (rating >= 1.5) return '#FF9800'; // Poor+ - Orange
    if (rating >= 1.0) return '#F44336'; // Poor - Same red as RatingHero
    return '#D32F2F'; // Very Poor - Darker red
  }

  getRatingText(rating) {
    // Text labels matching the legend
    if (rating >= 4.0) return 'Excellent';
    if (rating >= 3.0) return 'Good';
    if (rating >= 2.0) return 'Fair';
    return 'Poor';
  }

    // Check if this time slot represents current conditions
  isCurrentTimeSlot(day, periodIndex) {
    if (day !== 0) return false; // Only today can be current
    const now = new Date();
    const currentHour = now.getHours();
    
    // Map period indices to hour ranges
    const periodRanges = [
      { start: 6, end: 10 },   // Morning (index 0)
      { start: 11, end: 15 },  // Noon (index 1)  
      { start: 16, end: 20 }   // Evening (index 2)
    ];
    
    const range = periodRanges[periodIndex];
    if (!range) return false;
    
    // Check if current hour falls within this period range
    return currentHour >= range.start && currentHour <= range.end;
  }

  // Analyze contributing factors to the paddle rating
  getContributingFactors(hourData) {
    if (!hourData) return { indicator: null, factors: [] };
    
    const factors = [];
    
    // Extract weather data from the correct API structure
    const temp = hourData.weather?.temperature?.celsius || 
                 hourData.temperature?.celsius || 20;
    
    const wind = hourData.weather?.wind?.speedKPH || 
                 hourData.wind?.speedKPH || 10;
    
    const visibility = hourData.weather?.conditions?.visibility || 
                      hourData.conditions?.visibility || 10;
    
    const humidity = hourData.weather?.conditions?.humidity || 
                    hourData.conditions?.humidity || 50;
    
    const uvIndex = hourData.weather?.conditions?.uvIndex || 
                   hourData.conditions?.uvIndex || 3;
    
    const cloudCover = hourData.weather?.conditions?.cloudCover || 
                      hourData.conditions?.cloudCover || 0;
    
    // Analyze what's driving the score
    if (wind > 25) factors.push('High winds');
    else if (wind < 10) factors.push('Calm winds');
    else factors.push('Moderate winds');
    
    if (temp < 15) factors.push('Cold temperature');
    else if (temp > 30) factors.push('Hot temperature');
    else factors.push('Good temperature');
    
    if (visibility < 5) factors.push('Poor visibility');
    else if (visibility > 15) factors.push('Clear visibility');
    else factors.push('Fair visibility');
    
    if (humidity > 80) factors.push('High humidity');
    if (uvIndex > 7) factors.push('High UV');
    
    // Add cloud cover analysis
    if (cloudCover > 80) factors.push('Overcast skies');
    else if (cloudCover > 50) factors.push('Partly cloudy');
    else if (cloudCover < 20) factors.push('Clear skies');
    else factors.push('Some clouds');
    
    // Determine primary indicator based on most impactful factor
    let indicator = null;
    if (wind > 25) indicator = '💨'; // High wind (most dangerous)
    else if (temp < 10) indicator = '🧊'; // Very cold
    else if (temp > 35) indicator = '🔥'; // Very hot
    else if (visibility < 3) indicator = '🌫️'; // Poor visibility
    else if (humidity > 85) indicator = '💧'; // High humidity
    else if (uvIndex > 8) indicator = '☀️'; // High UV
    else if (cloudCover > 85) indicator = '☁️'; // Overcast
    else if (cloudCover < 15 && temp > 18 && temp < 28 && wind < 15) indicator = '✨'; // Ideal conditions
    
    return { indicator, factors };
  }

  // Generate tooltip data for hover information with safety warnings
  generateTooltipData(hourData, contributingFactors) {
    if (!hourData || !hourData.time) return 'No data available';
    
    const time = hourData.time || 'Unknown time';
    const rating = this.calculatePaddleRating(hourData);
    const factors = contributingFactors.factors.join(', ') || 'Standard conditions';
    
    let tooltip = `${time}\nRating: ${rating.toFixed(1)}/5.0\nFactors: ${factors}`;
    
    // Add safety warnings to tooltip
    if (hourData.warnings && hourData.warnings.length > 0) {
      tooltip += `\n\n🚨 SAFETY WARNINGS:\n${hourData.warnings.join('\n')}`;
    }
    
    // Add weather details
    const wind = hourData.windSpeed || 0;
    const gust = hourData.gustSpeed || 0;
    const temp = hourData.temperature || 20;
    const vis = hourData.visibility || 10;
    const uv = hourData.uvIndex || 0;
    
    tooltip += `\n\nConditions:\nWind: ${wind.toFixed(1)} km/h${gust > 0 ? ` (gusts ${gust.toFixed(1)})` : ''}\nTemp: ${temp.toFixed(1)}°C\nVisibility: ${vis.toFixed(1)} km\nUV Index: ${uv.toFixed(1)}`;
    
    return tooltip;
  }

  // Generate warning indicator based on severity
  getWarningIndicator(warningCount, warnings) {
    if (!warnings || warnings.length === 0) return '';
    
    // Check for critical warnings
    const hasDanger = warnings.some(w => w.includes('DANGER'));
    const hasWarning = warnings.some(w => w.includes('WARNING'));
    
    if (hasDanger) {
      return `🚨${warningCount}`;
    } else if (hasWarning) {
      return `⚠️${warningCount}`;
    } else {
      return `⚡${warningCount}`;
    }
  }

  // Add click handlers for period tiles to open detailed hourly submodal
  addPeriodClickHandlers(forecastData) {
    if (!this.element) return;

    console.log('🔧 Adding click handlers to period tiles...');

    // Add click handlers to period containers (both mobile and desktop)
    const periodContainers = this.element.querySelectorAll('.day-period-container');
    console.log(`📋 Found ${periodContainers.length} period containers`);
    
    periodContainers.forEach((container, index) => {
      const periodIndex = Math.floor(index / 3); // Which row (Morning=0, Noon=1, Evening=2)
      const dayIndex = index % 3; // Which day (0, 1, 2)
      
      console.log(`🎯 Container ${index}: Period=${periodIndex}, Day=${dayIndex}`);
      
      container.style.cursor = 'pointer';
      container.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`🖱️ Clicked: Period ${periodIndex}, Day ${dayIndex}`);
        this.openPeriodSubmodal(forecastData, dayIndex, periodIndex);
      });
    });

    // Also add click handlers to mobile blended tiles
    const blendedTiles = this.element.querySelectorAll('.mobile-blended-tile');
    console.log(`📱 Found ${blendedTiles.length} mobile blended tiles`);
    
    blendedTiles.forEach((tile, index) => {
      const periodIndex = Math.floor(index / 3); // Which row (Morning=0, Noon=1, Evening=2)
      const dayIndex = index % 3; // Which day (0, 1, 2)
      
      tile.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`📱 Mobile tile clicked: Period ${periodIndex}, Day ${dayIndex}`);
        this.openPeriodSubmodal(forecastData, dayIndex, periodIndex);
      });
    });
  }

  // Open submodal showing detailed hourly grid for selected period
  openPeriodSubmodal(forecastData, dayIndex, periodIndex) {
    console.log(`🔥 Opening submodal for Day ${dayIndex}, Period ${periodIndex}`);
    
    const periods = ['Morning', 'Noon', 'Evening'];
    const periodName = periods[periodIndex];
    const dateStr = this.getDateString(dayIndex);
    
    console.log(`📅 Submodal: ${periodName} on ${dateStr}`);
    
    // Create submodal overlay
    const submodal = document.createElement('div');
    submodal.className = 'period-submodal-overlay';
    submodal.innerHTML = `
      <div class="period-submodal">
        <div class="submodal-header">
          <h3>${periodName} Details</h3>
          <p>${dateStr}</p>
          <button class="submodal-close" aria-label="Close">&times;</button>
        </div>
        <div class="submodal-content">
          ${this.generateHourlySubgrid(forecastData, dayIndex, periodIndex)}
        </div>
      </div>
    `;

    // Add to document
    document.body.appendChild(submodal);

    // Add close handlers
    const closeBtn = submodal.querySelector('.submodal-close');
    closeBtn.addEventListener('click', () => this.closeSubmodal(submodal));
    
    submodal.addEventListener('click', (e) => {
      if (e.target === submodal) {
        this.closeSubmodal(submodal);
      }
    });

    // Add escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.closeSubmodal(submodal);
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Animate in
    requestAnimationFrame(() => {
      submodal.classList.add('show');
    });
  }

  // Generate detailed hourly grid for submodal
  generateHourlySubgrid(forecastData, dayIndex, periodIndex) {
    const periodMappings = {
      0: { name: 'Morning', hours: ['6', '7', '8', '9', '10', '11'] },
      1: { name: 'Noon', hours: ['12', '13', '14', '15', '16', '17'] },
      2: { name: 'Evening', hours: ['18', '19', '20', '21', '22', '23'] }
    };
    
    const periodConfig = periodMappings[periodIndex];
    const dayData = forecastData[dayIndex] || {};
    
    let gridHTML = '<div class="hourly-subgrid">';
    
    periodConfig.hours.forEach(hour => {
      const hourData = dayData.hourly?.[hour];
      const displayHour = this.formatHour(hour);
      
      if (hourData) {
        const rating = hourData.mlPrediction?.rating || hourData.rating || 0;
        const ratingColor = this.getPaddleRatingColor(rating);
        const ratingText = this.getRatingText(rating);
        const isCurrentHour = this.isCurrentHour(dayIndex, parseInt(hour));
        
        gridHTML += `
          <div class="subgrid-tile ${isCurrentHour ? 'current-hour' : ''}" 
               style="background: ${ratingColor};">
            <div class="subgrid-hour">${displayHour}</div>
            <div class="subgrid-rating">${rating.toFixed(1)}</div>
            <div class="subgrid-text">${ratingText}</div>
            <div class="subgrid-details">
              <span>🌡️ ${hourData.temperature || hourData.weather?.temperature || 'N/A'}°</span>
              <span>💨 ${hourData.windSpeed || hourData.weather?.windSpeed || 'N/A'} mph</span>
            </div>
          </div>
        `;
      } else {
        // Show empty/interpolated data
        gridHTML += `
          <div class="subgrid-tile empty">
            <div class="subgrid-hour">${displayHour}</div>
            <div class="subgrid-rating">--</div>
            <div class="subgrid-text">No Data</div>
          </div>
        `;
      }
    });
    
    gridHTML += '</div>';
    return gridHTML;
  }

  // Close submodal with animation
  closeSubmodal(submodal) {
    submodal.classList.remove('show');
    submodal.classList.add('hide');
    
    setTimeout(() => {
      if (submodal.parentNode) {
        submodal.parentNode.removeChild(submodal);
      }
    }, 300);
  }

  // Helper to format hour for display
  formatHour(hour) {
    const hourNum = parseInt(hour);
    if (hourNum === 0) return '12 AM';
    if (hourNum === 12) return '12 PM';
    if (hourNum < 12) return `${hourNum} AM`;
    return `${hourNum - 12} PM`;
  }
}

window.Heatmap = Heatmap;
