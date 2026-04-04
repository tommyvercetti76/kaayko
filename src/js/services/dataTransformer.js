/**
 * Data Transformer - Transforms API data for components
 */
class DataTransformer {
  
  // Extract current conditions from forecast data
  extractCurrentConditions(forecastData) {
    if (!forecastData?.forecast?.[0]?.hourly) {
      console.error('❌ No forecast data available');
      return null;
    }

    const hourly = forecastData.forecast[0].hourly;
    const currentHour = new Date().getHours();

    // Try current hour first, then scan nearby hours (within ±3h), then fallback to 8/12/18
    const candidates = [
      currentHour,
      currentHour - 1, currentHour + 1,
      currentHour - 2, currentHour + 2,
      currentHour - 3, currentHour + 3,
      8, 12, 18
    ];

    for (const h of candidates) {
      const key = String(h);
      if (hourly[key]) {
        console.log(`✅ Current conditions for hour ${key} (requested ${currentHour}):`, hourly[key]);
        return hourly[key];
      }
    }

    // Last resort: first available hour
    const firstKey = Object.keys(hourly).sort((a, b) => +a - +b)[0];
    if (firstKey) {
      console.warn(`⚠️ Using first available hour ${firstKey} (wanted ${currentHour})`);
      return hourly[firstKey];
    }

    console.error('❌ No hourly data found');
    return null;
  }

  // Prepare data for heatmap component (expanded hourly structure)
  prepareHeatmapData(forecastDays) {
    if (!Array.isArray(forecastDays)) {
      return [];
    }

    return forecastDays.map(day => {
      // Pass through the full hourly data structure from API
      return {
        date: day.date,
        hourly: day.hourly || {} // Keep the original hour-keyed structure (e.g., "8", "12", "18")
      };
    });
  }

  // Get ML status icon from forecast data
  getMLStatusIcon(forecastData) {
    const currentData = this.extractCurrentConditions(forecastData);
    const mlModelUsed = currentData?.mlModelUsed;
    const predictionSource = currentData?.predictionSource;
    
    // Show robot if ML model is actually used, chart for fallback
    const isMLPowered = mlModelUsed === true && predictionSource === 'ml-model';
    return isMLPowered ? '🤖' : '📊';
  }

  // Prepare data for RatingHero component
  prepareHeroData(forecastData) {
    const currentData = this.extractCurrentConditions(forecastData);
    if (!currentData) return null;

    return {
      rating: currentData.rating || 2.5,
      interpretation: currentData.interpretation || {},
      weather: currentData
    };
  }

  // Prepare data for SafetyWarnings component
  prepareWarningsData(forecastData) {
    const currentData = this.extractCurrentConditions(forecastData);
    return currentData?.warnings || [];
  }
}

// Global instance
window.dataTransformer = new DataTransformer();
