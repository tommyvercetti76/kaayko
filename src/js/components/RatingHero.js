/**
 * Rating Hero Component
 * Displays the main paddle score and description
 */
class RatingHero {
  constructor() {
    this.element = null;
    // Get saved unit preference or default to metric
    this.useMetric = localStorage.getItem('kaayko_units') !== 'imperial';
    // Store the last render data for unit switching
    this.lastRenderData = null;
    // Store raw values for unit conversion
    this.rawValues = {};
  }

  render(rating, interpretation, weather = {}) {
    // Store render data for unit switching
    this.lastRenderData = { rating, interpretation, weather };
    
    console.log('🏆 RatingHero render called with:', { rating, weather });
    
    // Extract skill level information with more meaningful defaults
    const skillLevel = interpretation.skillLevel || 'EXPERIENCED ONLY';
    const skillRecommendation = interpretation.recommendation || 'Assess conditions carefully before paddling';
    const skillDetails = interpretation.skillDetails || interpretation.details || 'Weather conditions require careful evaluation';
    
    // Get professional skill level icon and display name
    const skillDisplayName = this.getSkillDisplayName(skillLevel);
    
    // Extract weather data from API structure - direct from forecast endpoint
    const temp = weather?.temperature || '--';
    const wind = weather?.windSpeed || '--';
    const windDirection = weather?.windDirection || 'N'; // Use actual wind direction from API
    const visibility = weather?.visibility || '--';
    const humidity = weather?.humidity || '--';
    const uvIndex = weather?.uvIndex || '--';
    const cloudCover = weather?.cloudCover || '--';
    
    // Calculate water temperature estimate (air temp - 3°C for lakes)
    const waterTemp = (temp !== '--' && !isNaN(parseFloat(temp))) ? (parseFloat(temp) - 3) : '--';

    console.log('🏆 RatingHero extracted values:', {
      temp, wind, windDirection, visibility, humidity, uvIndex, cloudCover, waterTemp
    });

    // Store raw values for unit conversion
    this.rawValues = {
      temp: (temp !== '--' && !isNaN(parseFloat(temp))) ? parseFloat(temp) : null,
      waterTemp: (waterTemp !== '--' && !isNaN(parseFloat(waterTemp))) ? parseFloat(waterTemp) : null,
      wind: (wind !== '--' && !isNaN(parseFloat(wind))) ? parseFloat(wind) : null,
      windDirection,
      uvIndex: (uvIndex !== '--' && !isNaN(parseFloat(uvIndex))) ? parseFloat(uvIndex) : null,
      cloudCover: (cloudCover !== '--' && !isNaN(parseFloat(cloudCover))) ? parseFloat(cloudCover) : null
    };

    // Convert units based on user preference
    const displayTemp = this.useMetric ? temp : this.celsiusToFahrenheit(temp);
    const tempUnit = this.useMetric ? '°C' : '°F';
    
    const displayWaterTemp = this.useMetric ? waterTemp : this.celsiusToFahrenheit(waterTemp);
    
    const displayWind = this.useMetric ? wind : this.kphToMph(wind);
    const windUnit = this.useMetric ? 'km/h' : 'mph';
    
    const heroHTML = `
      <div class="skill-level-section">
        <div class="header-content">
          <div class="rating-section">
            <div class="paddle-score-label">Paddle Score</div>
            <div class="rating-circle" data-rating="${rating}">
              <div class="rating-number">${rating}</div>
            </div>
            <div class="now-indicator">NOW</div>
          </div>
          <div class="skill-info">
            <div class="core-weather-inline">
              <div class="weather-stat">
                <div class="weather-icon">🌡️</div>
                <div class="weather-data">
                  <span class="weather-value">${displayTemp}${tempUnit}</span>
                  <span class="weather-label">Air Temp</span>
                </div>
              </div>
              <div class="weather-stat">
                <div class="weather-icon">💨</div>
                <div class="weather-data">
                  <span class="weather-value">${displayWind} ${windUnit}</span>
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
                  <span class="weather-value">${typeof displayWaterTemp === 'number' ? displayWaterTemp.toFixed(1) : displayWaterTemp}${tempUnit}</span>
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
        <div class="skill-recommendation ${this.getSkillLevelClass(skillLevel)}">
          <div class="skill-level-badge ${this.getSkillLevelClass(skillLevel)}">${skillDisplayName}</div>
          <span class="recommendation-text">${skillRecommendation}</span>
        </div>
      </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = heroHTML;
    this.element = container.firstElementChild;
    
    // Add event listeners for unit toggle
    this.setupUnitToggle();
    
    return this.element;
  }

  setupUnitToggle() {
    const unitButtons = this.element.querySelectorAll('.units-btn');
    unitButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const unit = e.target.dataset.unit;
        this.useMetric = unit === 'metric';
        
        // Save preference
        localStorage.setItem('kaayko_units', unit);
        
        // Update button states
        unitButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Re-render with new units
        this.updateDisplayUnits();
      });
    });
  }

  updateDisplayUnits() {
    // Update weather values directly without re-rendering
    if (!this.element) return;
    
    const weatherStats = this.element.querySelectorAll('.weather-stat');
    const tempUnit = this.useMetric ? '°C' : '°F';
    const windUnit = this.useMetric ? 'km/h' : 'mph';
    
    // Update Air Temperature (stat 0)
    if (weatherStats[0] && this.rawValues.temp !== null) {
      const tempValue = this.useMetric ? 
        this.rawValues.temp.toFixed(1) : 
        this.celsiusToFahrenheit(this.rawValues.temp);
      weatherStats[0].querySelector('.weather-value').textContent = `${tempValue}${tempUnit}`;
    }
    
    // Update Wind Speed (stat 1)
    if (weatherStats[1] && this.rawValues.wind !== null) {
      const windValue = this.useMetric ? 
        this.rawValues.wind.toFixed(1) : 
        this.kphToMph(this.rawValues.wind);
      weatherStats[1].querySelector('.weather-value').textContent = `${windValue} ${windUnit}`;
    }
    
    // Update Water Temperature (stat 3)
    if (weatherStats[3] && this.rawValues.waterTemp !== null) {
      const waterTempValue = this.useMetric ? 
        this.rawValues.waterTemp.toFixed(1) : 
        this.celsiusToFahrenheit(this.rawValues.waterTemp);
      weatherStats[3].querySelector('.weather-value').textContent = `${waterTempValue}${tempUnit}`;
    }
    
    console.log('Units updated successfully!', { 
      useMetric: this.useMetric, 
      rawValues: this.rawValues 
    });
  }

  getSkillLevelClass(skillLevel) {
    if (skillLevel.includes('BEGINNERS')) return 'skill-beginner';
    if (skillLevel.includes('MODERATE')) return 'skill-moderate';
    if (skillLevel.includes('EXPERIENCED')) return 'skill-experienced';
    if (skillLevel.includes('EXPERT')) return 'skill-expert';
    if (skillLevel.includes('NOT RECOMMENDED')) return 'skill-danger';
    return 'skill-experienced'; // Default to experienced for safety
  }

  getSkillDisplayName(skillLevel) {
    if (skillLevel.includes('BEGINNERS')) return 'Beginner-Friendly';
    if (skillLevel.includes('MODERATE')) return 'Intermediate+';
    if (skillLevel.includes('EXPERIENCED')) return 'Experienced Only';
    if (skillLevel.includes('EXPERT')) return 'Expert Level';
    if (skillLevel.includes('NOT RECOMMENDED')) return 'Not Recommended';
    return 'Experienced Only';
  }

  getRatingClass(rating) {
    const numRating = parseFloat(rating);
    if (numRating >= 4.0) return 'excellent';
    if (numRating >= 3.0) return 'good';
    if (numRating >= 2.0) return 'fair';
    return 'poor';
  }

  calculateBuoyancy(tempCelsius) {
    const waterDensity = 1000 - (tempCelsius - 4) * 0.2;
    const buoyancyForce = waterDensity / 1000;
    
    if (buoyancyForce > 0.999) return { rating: 'Excellent', description: 'Optimal density' };
    if (buoyancyForce > 0.995) return { rating: 'Very Good', description: 'High density' };
    if (buoyancyForce > 0.990) return { rating: 'Good', description: 'Normal density' };
    if (buoyancyForce > 0.985) return { rating: 'Fair', description: 'Lower density' };
    return { rating: 'Poor', description: 'Low density' };
  }

  // Unit conversion methods
  celsiusToFahrenheit(celsius) {
    if (celsius === '--' || celsius === undefined || celsius === null || isNaN(parseFloat(celsius))) return '--';
    return ((parseFloat(celsius) * 9/5) + 32).toFixed(1);
  }

  kphToMph(kph) {
    if (kph === '--' || kph === undefined || kph === null || isNaN(parseFloat(kph))) return '--';
    return (parseFloat(kph) * 0.621371).toFixed(1);
  }

  metersToFeet(meters) {
    if (meters === '--' || meters === undefined || meters === null || isNaN(parseFloat(meters))) return '--';
    return (parseFloat(meters) * 3.28084).toFixed(1);
  }
}

// Export for use in main modal
window.RatingHero = RatingHero;
