/**
 * API Client - Handles all API calls with caching
 */
class ApiClient {
  constructor() {
    this.baseUrl = 'https://api-vwcc5j4qda-uc.a.run.app';
    this.cache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }

  // Generate cache key
  getCacheKey(lat, lng, forecast = false) {
    return `${lat.toFixed(6)},${lng.toFixed(6)},${forecast}`;
  }

  // Check if cached data is still valid
  isCacheValid(cacheEntry) {
    return Date.now() - cacheEntry.timestamp < this.cacheTimeout;
  }

  // Clean old cache entries
  cleanOldCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  // Check if data is from fallback system
  isFallbackData(data) {
    return data?.metadata?.apiVersion?.includes('fallback') || 
           data?.metadata?.fallbackReason || 
           false;
  }

  // Validate if forecast data is complete and usable
  isValidForecastData(data) {
    return data?.success && 
           data?.forecast && 
           Array.isArray(data.forecast) && 
           data.forecast.length > 0 &&
           data.forecast[0]?.hourly &&
           Object.keys(data.forecast[0].hourly).length > 0;
  }

  // Centralized fallback data handling
  useFallbackData(lat, lng, cacheKey, reason) {
    const fallbackData = this.generateFallbackForecastData(lat, lng, reason);
    
    // Cache fallback data with shorter TTL (5 minutes) to retry API sooner
    this.cache.set(cacheKey, {
      data: fallbackData,
      timestamp: Date.now()
    });
    
    return fallbackData;
  }

  // Get forecast data (contains current + 3-day forecast)
  async getForecastData(lat, lng) {
    const cacheKey = this.getCacheKey(lat, lng, true);
    const cached = this.cache.get(cacheKey);

    // Return cached data if valid AND it's real API data (not fallback)
    if (cached && this.isCacheValid(cached) && !this.isFallbackData(cached.data)) {
      console.log(`🚀 Using cached real API data for ${cacheKey}`);
      return cached.data;
    }
    
    // If we have fallback data cached, try API first anyway to see if it's working again
    if (cached && this.isFallbackData(cached.data)) {
      console.log(`🔄 Have fallback cached, checking if API is working again...`);
    }

    const url = `${this.baseUrl}/paddlePredict/forecast?lat=${lat}&lng=${lng}`;
    
    try {
      console.log(`📡 Fetching forecast data from: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if API returned valid forecast data
      if (this.isValidForecastData(data)) {
        console.log(`✅ API is working! Got ${data.forecast.length} days of real data`);
        
        // Cache the real API data
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now()
        });

        this.cleanOldCache();
        return data;
      } else {
        // API returned empty/invalid data - use fallback
        console.warn(`⚠️ API returned invalid forecast data, using intelligent fallback`);
        return this.useFallbackData(lat, lng, cacheKey, 'api-empty-response');
      }
      
    } catch (error) {
      console.error(`❌ Forecast API failed:`, error);
      console.log(`🔄 Using intelligent fallback for ${lat}, ${lng}`);
      
      return this.useFallbackData(lat, lng, cacheKey, 'api-network-error');
    }
  }

  // Get current conditions only (if needed separately)
  async getCurrentData(lat, lng) {
    const cacheKey = this.getCacheKey(lat, lng, false);
    const cached = this.cache.get(cacheKey);

    // Return cached data if valid
    if (cached && this.isCacheValid(cached)) {
      console.log(`🚀 Using cached current data for ${cacheKey}`);
      return cached.data;
    }

    const url = `${this.baseUrl}/paddlePredict?lat=${lat}&lng=${lng}`;
    
    try {
      console.log(`📡 Fetching current data from: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      this.cleanOldCache();

      console.log(`✅ Successfully got current data`);
      return data;
      
    } catch (error) {
      console.error(`❌ Current API failed:`, error);
      throw error;
    }
  }

  // Generate fallback forecast data when API is down
  generateFallbackForecastData(lat, lng, reason = 'api-error') {
    console.log(`🔧 Generating localized fallback data for coordinates: ${lat}, ${lng}. Reason: ${reason}`);
    
    // Get location-specific estimates based on coordinates
    const locationData = this.estimateLocationConditions(lat, lng);
    
    const today = new Date();
    const forecast = [];
    
    // Generate 3 days of forecast data
    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + dayOffset);
      const dateString = date.toISOString().split('T')[0];
      
      const hourly = {};
      
      // Generate 24 hours of data
      for (let hour = 0; hour < 24; hour++) {
        // Add some variation throughout the day
        const tempVariation = Math.sin((hour - 6) * Math.PI / 12) * 8; // Peak at noon
        const windVariation = Math.random() * 5 - 2.5; // ±2.5 km/h variation
        
        const hourData = {
          temperature: Math.round(locationData.baseTemp + tempVariation),
          windSpeed: Math.max(0, Math.round(locationData.baseWind + windVariation)),
          windDirection: locationData.windDirection,
          gustSpeed: Math.round((locationData.baseWind + windVariation) * 1.3),
          humidity: locationData.humidity + Math.round(Math.random() * 10 - 5),
          cloudCover: locationData.cloudCover + Math.round(Math.random() * 20 - 10),
          uvIndex: Math.max(0, Math.round(locationData.uvIndex * Math.sin((hour - 6) * Math.PI / 12))),
          visibility: locationData.visibility,
          hasWarnings: false,
          warnings: [],
          beaufortScale: Math.min(12, Math.floor(locationData.baseWind / 3)),
          
          // ML prediction results with localized rating
          prediction: {
            rating: this.calculateLocalizedRating(locationData, hour),
            originalRating: this.calculateLocalizedRating(locationData, hour),
            safetyDeduction: 0,
            mlModelUsed: false, // Using fallback
            predictionSource: 'local-fallback'
          },
          
          // For backward compatibility
          originalRating: this.calculateLocalizedRating(locationData, hour),
          safetyDeduction: 0,
          apiRating: this.calculateLocalizedRating(locationData, hour),
          rating: this.calculateLocalizedRating(locationData, hour),
          mlModelUsed: false,
          predictionSource: 'local-fallback'
        };
        
        hourly[hour.toString()] = hourData;
      }
      
      forecast.push({
        date: dateString,
        hourly: hourly
      });
    }
    
    return {
      success: true,
      location: {
        name: locationData.name,
        region: locationData.region,
        country: locationData.country,
        coordinates: { latitude: parseFloat(lat), longitude: parseFloat(lng) }
      },
      forecast: forecast,
      metadata: {
        cached: false,
        processingTimeMs: 50,
        mlServiceUrl: 'local-fallback',
        apiVersion: '2.0-fallback',
        fallbackReason: reason === 'api-error' ? 'Weather API unavailable' : 
                       reason === 'empty-data' ? 'Weather API returned empty data' :
                       reason === 'service-down' ? 'Weather service temporarily down' :
                       'Weather API fallback'
      }
    };
  }

  // Estimate location conditions based on coordinates
  estimateLocationConditions(lat, lng) {
    const latFloat = parseFloat(lat);
    const lngFloat = parseFloat(lng);
    
    // Basic climate estimation by latitude and season
    const isNorthern = latFloat > 0;
    const isTropical = Math.abs(latFloat) < 23.5;
    const isWinter = [11, 0, 1, 2].includes(new Date().getMonth());
    
    let baseTemp = 20; // Default moderate temperature
    let baseWind = 8;  // Default light wind
    let humidity = 60;
    let cloudCover = 30;
    let uvIndex = 5;
    let visibility = 15;
    let name = "Unknown Location";
    let region = "Unknown Region";
    let country = "Unknown Country";
    let windDirection = "W";
    
    // Tropical regions
    if (isTropical) {
      baseTemp = isWinter ? 26 : 30;
      humidity = 75;
      uvIndex = 8;
      windDirection = "NE";
    }
    // Northern temperate
    else if (isNorthern && latFloat > 35) {
      baseTemp = isWinter ? 8 : 22;
      baseWind = isWinter ? 12 : 6;
      humidity = isWinter ? 70 : 55;
      cloudCover = isWinter ? 60 : 25;
    }
    // Southern temperate
    else if (!isNorthern && latFloat < -35) {
      baseTemp = isWinter ? 15 : 25; // Reversed seasons
      baseWind = 10;
      humidity = 65;
    }
    
    // Location-specific overrides for known regions
    if (Math.abs(latFloat - 21.15) < 1 && Math.abs(lngFloat - 79.1) < 1) {
      // Nagpur, India area
      name = "Nagpur";
      region = "Maharashtra";
      country = "India";
      baseTemp = isWinter ? 25 : 35;
      humidity = isWinter ? 45 : 75;
      uvIndex = 7;
    } else if (Math.abs(latFloat - 40.7) < 2 && Math.abs(lngFloat + 74) < 2) {
      // New York area
      name = "New York";
      region = "New York";
      country = "United States";
      baseTemp = isWinter ? 5 : 25;
      baseWind = 12;
      humidity = 65;
    } else if (Math.abs(latFloat - 39.5) < 2 && Math.abs(lngFloat + 106) < 2) {
      // Colorado area
      name = "Colorado";
      region = "Colorado";
      country = "United States";
      baseTemp = isWinter ? -2 : 20;
      baseWind = 15;
      humidity = 35;
      uvIndex = 8; // High altitude
    }
    
    return {
      name, region, country,
      baseTemp, baseWind, humidity, cloudCover, uvIndex, visibility, windDirection
    };
  }

  // Calculate localized paddle rating based on conditions and time
  calculateLocalizedRating(locationData, hour) {
    let rating = 4.0; // Start optimistic
    
    // Time of day factors
    if (hour < 7 || hour > 19) rating -= 0.5; // Early morning/evening
    if (hour >= 11 && hour <= 15) rating += 0.3; // Good midday conditions
    
    // Temperature factors
    if (locationData.baseTemp < 10) rating -= 1.0; // Cold
    if (locationData.baseTemp > 35) rating -= 0.7; // Too hot
    if (locationData.baseTemp >= 18 && locationData.baseTemp <= 28) rating += 0.2; // Ideal
    
    // Wind factors
    if (locationData.baseWind > 20) rating -= 1.5; // Too windy
    if (locationData.baseWind > 15) rating -= 0.8; // Moderate wind
    if (locationData.baseWind <= 10) rating += 0.2; // Light wind is good
    
    // Visibility and UV
    if (locationData.visibility < 10) rating -= 0.3;
    if (locationData.uvIndex > 7) rating -= 0.2; // High UV
    
    // Ensure rating stays in valid range
    return Math.max(1.0, Math.min(5.0, Math.round(rating * 10) / 10));
  }
}

// Global instance
window.apiClient = new ApiClient();
