/**
 * Weather Stats Component
 * Displays weather metrics in a grid of stat cards
 */
class WeatherStats {
  constructor() {
    this.element = null;
  }

  render(weather) {
    if (!weather) return null;

    const beaufortScale = this.getBeaufortScale(weather.wind?.speedKPH || 0);
    const buoyancy = this.calculateBuoyancy(weather.temperature?.celsius || 20);
    const heatIndex = this.calculateHeatIndex(weather.temperature?.celsius || 20, weather.humidity || 50);
    const visibility = weather.conditions?.visibility || 0;
    const uvIndex = weather.conditions?.uvIndex || 0;
    const temperature = weather.temperature?.celsius || 20;
    
    // Calculate precise paddle score using our rule-based system
    const paddleScore = this.calculatePrecisePaddleScore(weather, {
      beaufortScale: beaufortScale.scale,
      heatIndex,
      uvIndex,
      cloudCover: weather.conditions?.cloudCover || 0,
      visibility,
      humidity: weather.humidity || 0,
      waterTemp: temperature,
      buoyancy: buoyancy.rating
    });
    
    const statsHTML = `
      <div class="weather-stats-container">
        <div class="weather-stats-header">
          <h3 class="weather-stats-title">Current Conditions</h3>
          <div class="paddle-score-display">
            <span class="score-label">Paddle Score:</span>
            <span class="score-value" data-score="${paddleScore}">${paddleScore.toFixed(1)}/5.0</span>
          </div>
        </div>
        <div class="stats-grid">
          <!-- Core Conditions (Required for 5.0 score) -->
          <div class="stat-card heat-index core ${this.isHeatIndexFavorable(heatIndex) ? 'favorable' : 'unfavorable'}">
            <div class="stat-icon">�️</div>
            <div class="stat-value">${heatIndex}°C</div>
            <div class="stat-label">Heat Index</div>
            <div class="stat-sublabel">Core • ${this.isHeatIndexFavorable(heatIndex) ? 'Favorable' : 'Unfavorable'}</div>
          </div>
          <div class="stat-card cloud-cover core ${this.isCloudCoverFavorable(weather.conditions?.cloudCover || 0) ? 'favorable' : 'unfavorable'}">
            <div class="stat-icon">☁️</div>
            <div class="stat-value">${weather.conditions?.cloudCover || 0}%</div>
            <div class="stat-label">Cloud Cover</div>
            <div class="stat-sublabel">Core • ${this.isCloudCoverFavorable(weather.conditions?.cloudCover || 0) ? 'Favorable' : 'Unfavorable'}</div>
          </div>
          <div class="stat-card wind-beaufort core ${this.isWindFavorable(beaufortScale.scale) ? 'favorable' : 'unfavorable'}">
            <div class="stat-icon">🌬️</div>
            <div class="stat-value">${beaufortScale.scale}</div>
            <div class="stat-label">${beaufortScale.description}</div>
            <div class="stat-sublabel">Core • ${weather.wind?.speedKPH || 0} km/h</div>
          </div>
          <div class="stat-card uv core ${this.isUVFavorable(uvIndex) ? 'favorable' : 'unfavorable'}">
            <div class="stat-icon">☀️</div>
            <div class="stat-value">${uvIndex}</div>
            <div class="stat-label">UV Index</div>
            <div class="stat-sublabel">Core • ${this.getUVDescription(uvIndex)}</div>
          </div>
          
          <!-- Supplementary Conditions -->
          <div class="stat-card visibility supplementary ${this.isVisibilityFavorable(visibility) ? 'favorable' : 'unfavorable'}">
            <div class="stat-icon">👁️</div>
            <div class="stat-value">${visibility} km</div>
            <div class="stat-label">Visibility</div>
            <div class="stat-sublabel">Supplementary</div>
          </div>
          <div class="stat-card humidity supplementary ${this.isHumidityFavorable(weather.humidity || 0) ? 'favorable' : 'unfavorable'}">
            <div class="stat-icon">💧</div>
            <div class="stat-value">${weather.humidity || 0}%</div>
            <div class="stat-label">Humidity</div>
            <div class="stat-sublabel">Supplementary • ${this.getHumidityDescription(weather.humidity || 0)}</div>
          </div>
          <div class="stat-card water-temp supplementary ${this.isWaterTempFavorable(temperature) ? 'favorable' : 'unfavorable'}">
            <div class="stat-icon">🌊</div>
            <div class="stat-value">${temperature}°C</div>
            <div class="stat-label">Water Temperature</div>
            <div class="stat-sublabel">Supplementary • ${this.getWaterTempDescription(temperature)}</div>
          </div>
          <div class="stat-card buoyancy supplementary ${this.isBuoyancyFavorable(buoyancy.rating) ? 'favorable' : 'unfavorable'}">
            <div class="stat-icon">🏊</div>
            <div class="stat-value">${buoyancy.rating}</div>
            <div class="stat-label">Water Buoyancy</div>
            <div class="stat-sublabel">Supplementary • ${buoyancy.description}</div>
          </div>
        </div>
      </div>
    `;
    
    const container = document.createElement('div');
    container.innerHTML = statsHTML;
    this.element = container.firstElementChild;
    
    return this.element;
  }

  // Precise Paddle Score Calculation (0-5 in 0.5 increments)
  calculatePrecisePaddleScore(weather, conditions) {
    const {
      beaufortScale,
      heatIndex,
      uvIndex,
      cloudCover,
      visibility,
      humidity,
      waterTemp,
      buoyancy
    } = conditions;

    // Core conditions (all 4 must be favorable for 5.0)
    const coreConditions = [
      this.isHeatIndexFavorable(heatIndex),
      this.isCloudCoverFavorable(cloudCover),
      this.isWindFavorable(beaufortScale),
      this.isUVFavorable(uvIndex)
    ];

    // Supplementary conditions (need at least 2 for 5.0)
    const supplementaryConditions = [
      this.isVisibilityFavorable(visibility),
      this.isHumidityFavorable(humidity),
      this.isWaterTempFavorable(waterTemp),
      this.isBuoyancyFavorable(buoyancy)
    ];

    const favorableCoreCount = coreConditions.filter(Boolean).length;
    const favorableSupplementaryCount = supplementaryConditions.filter(Boolean).length;

    // Calculate score based on rules
    let baseScore = 0;

    // Core conditions scoring (3.0 points max)
    baseScore += (favorableCoreCount / 4) * 3.0;

    // Supplementary conditions scoring (2.0 points max)
    baseScore += (favorableSupplementaryCount / 4) * 2.0;

    // Apply premium for perfect conditions
    if (favorableCoreCount === 4 && favorableSupplementaryCount >= 2) {
      baseScore = 5.0; // Perfect score
    }

    // Round to nearest 0.5
    return Math.round(baseScore * 2) / 2;
  }

  // Utility methods
  getBeaufortScale(windSpeedKPH) {
    const windSpeedKnots = windSpeedKPH * 0.539957;
    if (windSpeedKnots < 1) return { scale: 0, description: 'Calm' };
    if (windSpeedKnots < 4) return { scale: 1, description: 'Light Air' };
    if (windSpeedKnots < 7) return { scale: 2, description: 'Light Breeze' };
    if (windSpeedKnots < 11) return { scale: 3, description: 'Gentle Breeze' };
    if (windSpeedKnots < 16) return { scale: 4, description: 'Moderate Breeze' };
    if (windSpeedKnots < 22) return { scale: 5, description: 'Fresh Breeze' };
    if (windSpeedKnots < 28) return { scale: 6, description: 'Strong Breeze' };
    if (windSpeedKnots < 34) return { scale: 7, description: 'High Wind' };
    if (windSpeedKnots < 41) return { scale: 8, description: 'Gale' };
    if (windSpeedKnots < 48) return { scale: 9, description: 'Strong Gale' };
    if (windSpeedKnots < 56) return { scale: 10, description: 'Storm' };
    if (windSpeedKnots < 64) return { scale: 11, description: 'Violent Storm' };
    return { scale: 12, description: 'Hurricane' };
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

  calculateHeatIndex(tempCelsius, humidity) {
    const tempF = (tempCelsius * 9/5) + 32;
    if (tempF < 80) return tempCelsius;
    
    const c1 = -42.379, c2 = 2.04901523, c3 = 10.14333127;
    const c4 = -0.22475541, c5 = -0.00683783, c6 = -0.05481717;
    const c7 = 0.00122874, c8 = 0.00085282, c9 = -0.00000199;
    
    const heatIndexF = c1 + c2*tempF + c3*humidity + c4*tempF*humidity + 
                      c5*tempF*tempF + c6*humidity*humidity + c7*tempF*tempF*humidity + 
                      c8*tempF*humidity*humidity + c9*tempF*tempF*humidity*humidity;
    
    return Math.round((heatIndexF - 32) * 5/9);
  }

  getUVDescription(uvIndex) {
    if (uvIndex <= 2) return 'Low';
    if (uvIndex <= 5) return 'Moderate';
    if (uvIndex <= 7) return 'High';
    if (uvIndex <= 10) return 'Very High';
    return 'Extreme';
  }

  getHumidityDescription(humidity) {
    if (humidity < 30) return 'Very Dry';
    if (humidity < 50) return 'Dry';
    if (humidity < 70) return 'Comfortable';
    if (humidity < 85) return 'Humid';
    return 'Very Humid';
  }

  getCloudDescription(cloudCover) {
    if (cloudCover < 10) return 'Clear';
    if (cloudCover < 25) return 'Mostly Clear';
    if (cloudCover < 50) return 'Partly Cloudy';
    if (cloudCover < 75) return 'Mostly Cloudy';
    return 'Overcast';
  }

  getWaterTempDescription(temp) {
    if (temp < 10) return 'Very Cold';
    if (temp < 15) return 'Cold';
    if (temp < 20) return 'Cool';
    if (temp < 25) return 'Comfortable';
    return 'Warm';
  }

  // New creative utility methods
  generateVisibilityBars(visibility) {
    const bars = 8;
    const activeThreshold = (visibility / 25) * bars; 
    let result = '';
    for (let i = 0; i < bars; i++) {
      const isActive = i < activeThreshold;
      result += `<div class="vis-bar ${isActive ? 'active' : ''}"></div>`;
    }
    return result;
  }

  generateUVScale(uvIndex) {
    const colors = ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#F44336', '#9C27B0', '#673AB7', '#3F51B5'];
    let result = '';
    for (let i = 0; i <= 10; i++) {
      const isActive = i <= uvIndex;
      result += `<div class="uv-segment ${isActive ? 'active' : ''}" style="--segment-color: ${colors[i]}"></div>`;
    }
    return result;
  }

  generateBuoyancyDots(rating) {
    const ratings = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    const currentIndex = ratings.indexOf(rating);
    let result = '';
    for (let i = 0; i < 5; i++) {
      result += `<div class="buoyancy-dot ${i <= currentIndex ? 'active' : ''}"></div>`;
    }
    return result;
  }

  getTempPercent(temp) {
    return Math.min(Math.max(((temp + 10) / 50) * 100, 0), 100);
  }

  getWindImpact(scale) {
    if (scale <= 2) return 'good';
    if (scale <= 4) return 'moderate';
    return 'high';
  }

  getWindImpactText(scale) {
    if (scale <= 2) return 'Perfect for paddling';
    if (scale <= 4) return 'Manageable conditions';
    return 'Challenging winds';
  }

  getVisibilityImpact(visibility) {
    if (visibility >= 15) return 'good';
    if (visibility >= 8) return 'moderate';
    return 'high';
  }

  getVisibilityImpactText(visibility) {
    if (visibility >= 15) return 'Excellent visibility';
    if (visibility >= 8) return 'Good visibility';
    return 'Limited visibility';
  }

  getUVImpact(uvIndex) {
    if (uvIndex <= 2) return 'good';
    if (uvIndex <= 7) return 'moderate';
    return 'high';
  }

  getUVImpactText(uvIndex) {
    if (uvIndex <= 2) return 'Minimal sun risk';
    if (uvIndex <= 7) return 'Use sun protection';
    return 'High sun exposure';
  }

  getTempImpact(temp) {
    if (temp >= 18 && temp <= 26) return 'good';
    if (temp >= 15 && temp <= 30) return 'moderate';
    return 'high';
  }

  // Core condition evaluators
  isHeatIndexFavorable(heatIndex) {
    return heatIndex >= 10 && heatIndex <= 30; // 10-30°C comfortable range
  }

  isCloudCoverFavorable(cloudCover) {
    return cloudCover >= 20 && cloudCover <= 70; // Partial clouds ideal
  }

  isWindFavorable(beaufortScale) {
    return beaufortScale >= 1 && beaufortScale <= 3; // Light to gentle breeze
  }

  isUVFavorable(uvIndex) {
    return uvIndex >= 3 && uvIndex <= 6; // Moderate UV, good for paddling
  }

  // Supplementary condition evaluators
  isVisibilityFavorable(visibility) {
    return visibility >= 10; // 10km+ good visibility
  }

  isHumidityFavorable(humidity) {
    return humidity >= 40 && humidity <= 70; // Comfortable humidity
  }

  isWaterTempFavorable(waterTemp) {
    return waterTemp >= 15 && waterTemp <= 25; // Good water temperature
  }

  isBuoyancyFavorable(buoyancyRating) {
    return buoyancyRating === "Good" || buoyancyRating === "Very Good" || buoyancyRating === "Excellent";
  }
}

// Export for use in main modal
window.WeatherStats = WeatherStats;
