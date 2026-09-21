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

  // (heatmap data prep removed — KonditionsHeatmap consumes the API
  // forecast shape directly)

  /**
   * What produced this number, as one decision.
   *
   * The API emits four values for predictionSource — 'ml-model' (the remote
   * Cloud Run service), 'local-model' (the trained tree ensemble that runs
   * in-process), 'paddle-llm', and 'fallback-rules'. This knew about one of
   * them, so the in-process model — which IS the model — was being reported
   * as a fallback.
   *
   * Icon and label came from two expressions that disagreed: the icon required
   * mlModelUsed AND source === 'ml-model', the label accepted either. In
   * production (mlModelUsed true, source 'local-model') that rendered the
   * chart glyph, meaning "not ML", beside the words "ML forecast". One
   * function now returns both so they cannot drift apart again.
   */
  getPredictionProvenance(forecastData) {
    const current = this.extractCurrentConditions(forecastData);
    const source = current?.predictionSource;
    if (source === 'ml-model')    return { icon: '🤖', label: 'ML forecast', ml: true };
    if (source === 'local-model') return { icon: '🤖', label: 'ML forecast', ml: true };
    if (source === 'paddle-llm')  return { icon: '🤖', label: 'ML forecast', ml: true };
    if (source === 'fallback-rules') return { icon: '📊', label: 'Estimated forecast', ml: false };
    // Unknown or absent: say so rather than claim either.
    return { icon: '📊', label: current?.mlModelUsed === true ? 'ML forecast' : 'Estimated forecast',
             ml: current?.mlModelUsed === true };
  }

  // Kept for callers that only want the glyph.
  getMLStatusIcon(forecastData) {
    return this.getPredictionProvenance(forecastData).icon;
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
