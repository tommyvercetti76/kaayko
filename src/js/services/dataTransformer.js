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
    
    // Get current time period (8=morning, 12=noon, 18=evening)
    const currentHour = new Date().getHours();
    let timeKey = '8'; // Default to morning
    if (currentHour >= 16) timeKey = '18';
    else if (currentHour >= 11) timeKey = '12';
    
    const currentConditions = forecastData.forecast[0].hourly[timeKey];
    if (!currentConditions) {
      console.error(`❌ No data for time period: ${timeKey}`);
      return null;
    }
    
    console.log(`✅ Current conditions for hour ${timeKey}:`, currentConditions);
    return currentConditions;
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
