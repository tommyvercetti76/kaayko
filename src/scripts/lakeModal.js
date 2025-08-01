/**
 * File: scripts/lakeModal.js
 * 
 * Lake Modal - Displays ML predictions, weather data, and lake information
 * with interactive heatmap and professional UI components
 */

class LakeModal {
  constructor() {
    this.modal = null;
    this.chartInstances = [];
    this.currentSpot = null;
    
    // Production kaaykostore configuration with images and database
    this.apiBaseUrl = 'https://api-vwcc5j4qda-uc.a.run.app'; // Production Firebase Functions
    
    // API Response Cache - cache for 10 minutes
    this.apiCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes in milliseconds
  }

  // Cache key generator
  getCacheKey(lat, lng, forecast = false) {
    return `${lat.toFixed(6)},${lng.toFixed(6)},${forecast}`;
  }

  // Check if cached data is still valid
  isCacheValid(cacheEntry) {
    return Date.now() - cacheEntry.timestamp < this.cacheTimeout;
  }

  // Get cached data or fetch new data from appropriate API
  async getCachedPrediction(lat, lng, forecast = false) {
    const cacheKey = this.getCacheKey(lat, lng, forecast);
    const cached = this.apiCache.get(cacheKey);

    // Return cached data if valid
    if (cached && this.isCacheValid(cached)) {
      console.log(`🚀 Using cached prediction data for ${cacheKey}`);
      return cached.data;
    }

    // Use unified API for ML predictions
    const url = forecast 
      ? `${this.apiBaseUrl}/paddlePredict/forecast?lat=${lat}&lng=${lng}`
      : `${this.apiBaseUrl}/paddlePredict?lat=${lat}&lng=${lng}`;
    
    try {
      console.log(`📡 Fetching ML prediction data from: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // Cache the result
      this.apiCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      // Clean old cache entries (keep cache size manageable)
      this.cleanOldCache();

      console.log(`✅ Successfully got prediction data from unified API`);
      return data;
      
    } catch (error) {
      console.error(`❌ Unified API failed:`, error);
      throw error;
    }
  }

  // Remove expired cache entries
  cleanOldCache() {
    const now = Date.now();
    for (const [key, entry] of this.apiCache.entries()) {
      if (now - entry.timestamp >= this.cacheTimeout) {
        this.apiCache.delete(key);
      }
    }
  }

  // Main entry point - creates modal and loads data
  async open(spot) {
    // Load RatingHero CSS dynamically to ensure it's available
    this.loadRatingHeroCSS();
    
    // Create and show modal
    this.modal = this.createModal(spot);
    document.body.appendChild(this.modal);
    
    // Add mobile-specific enhancements
    this.addMobileEnhancements();
    
    // Use the optimized showLakeInfo method
    await this.showLakeInfo(spot);
  }

  // Load RatingHero CSS dynamically
  loadRatingHeroCSS() {
    const cssId = 'rating-hero-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = '/scripts/components/RatingHero.css';
      document.head.appendChild(link);
      console.log('RatingHero CSS loaded dynamically');
    }
  }

  async showLakeInfo(spot) {
    this.currentSpot = spot;
    
    // If modal doesn't exist, this is called standalone - create it
    if (!this.modal) {
      this.loadRatingHeroCSS();
      this.modal = this.createModal(spot);
      document.body.appendChild(this.modal);
      this.addMobileEnhancements();
    }
    
    // Show loading state
    const contentDiv = this.modal.querySelector('.chat-content');
    contentDiv.innerHTML = this.createLoadingState();
    
    try {
      // Get FORECAST data - it contains everything (current + 3-day forecast)
      console.log('📊 Fetching FORECAST data (contains current + future)');
      const forecastData = await this.getCachedPrediction(
        spot.location.latitude, 
        spot.location.longitude, 
        true // Get forecast data (contains current conditions too)
      );
      
      console.log('✅ Forecast data received:', {
        success: forecastData?.success,
        forecastDays: forecastData?.forecast?.length
      });
      
      // Update modal content with forecast data (contains everything)
      contentDiv.innerHTML = this.createContent(spot, forecastData);
      
      // Initialize components with forecast data
      this.initializeComponents(forecastData);
      
    } catch (error) {
      console.error('Modal data loading failed:', error);
      contentDiv.innerHTML = this.createErrorContent(spot, error.message);
    }
  }

  createModal(spot) {
    const modal = document.createElement('div');
    modal.className = 'lake-modal';
    
    modal.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-container">
          <div class="modal-header">
            <div class="modal-title">
              <h2>${spot.title}</h2>
              <p class="modal-subtitle">${spot.subtitle}</p>
            </div>
            <button class="modal-close" onclick="lakeModal.close()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="chat-content">
              <!-- Content populated by API call -->
            </div>
          </div>
        </div>
      </div>
    `;
    return modal;
  }

  createLoadingState() {
    return `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Analyzing current lake conditions...</p>
        <div class="loading-details">
          <span>• Gathering weather data</span>
          <span>• Running ML predictions</span>
          <span>• Processing safety conditions</span>
        </div>
      </div>
    `;
  }

  createContent(spot, forecastData) {
    // Extract current conditions from forecast data for display
    const currentData = this.extractCurrentConditions(forecastData);
    const rating = currentData?.rating || 'N/A';
    const location = forecastData.location;
    
    // Store current spot for components to use
    this.currentSpot = spot;
    
    return `
      <div class="modal-content-grid">
        <!-- Component containers in priority order -->
        <div class="rating-hero-wrapper">
          <div id="ratingHeroContainer"></div>
          <div id="safetyWarningsContainer" class="safety-warnings-overlay"></div>
        </div>
        <div id="heatmapContainer"></div>

        <!-- Location & Time Info - ALWAYS SHOW -->
        <div class="location-info">
          ${location ? `
          <div class="location-item">
            <span class="location-label">Region:</span>
            <span>${location.region || 'Unknown'}, ${location.country || 'Unknown'}</span>
          </div>
          <div class="location-item">
            <span class="location-label">Local Time:</span>
            <span>${this.formatLakeLocalTime(location)}</span>
          </div>
          <div class="location-item">
            <span class="location-label">Coordinates:</span>
            <span>${location.coordinates?.latitude?.toFixed(4) || spot.location.latitude.toFixed(4)}, ${location.coordinates?.longitude?.toFixed(4) || spot.location.longitude.toFixed(4)}</span>
          </div>
          ` : `
          <div class="location-item">
            <span class="location-label">Location:</span>
            <span>${spot.title}</span>
          </div>
          <div class="location-item">
            <span class="location-label">Coordinates:</span>
            <span>${spot.location.latitude.toFixed(4)}, ${spot.location.longitude.toFixed(4)}</span>
          </div>
          <div class="location-item">
            <span class="location-label">Local Time:</span>
            <span>${this.estimateLakeLocalTime(spot.location.latitude, spot.location.longitude)}</span>
          </div>
          `}
        </div>

        <div class="update-timestamp">
          <small>${this.getMLStatusIcon(forecastData)} Last updated: ${this.formatUpdateTime(forecastData?.location)}</small>
        </div>
      </div>
    `;
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

    // Initialize all components with forecast data
  initializeComponents(mlData) {
    this.renderComponents(mlData);
    this.setupHeatmap(mlData);
    this.initializeTooltips();
  }

  // Render hero and safety components
  renderComponents(forecastData) {
    console.log('🏆 Rendering components with forecast data');
    
    const currentData = this.extractCurrentConditions(forecastData);
    if (!currentData) {
      console.error('❌ No current conditions available');
      return;
    }

    // Initialize and render RatingHero
    const ratingHero = new window.RatingHero();
    const ratingContainer = document.getElementById('ratingHeroContainer');
    if (ratingContainer) {
      ratingContainer.innerHTML = '';
      const ratingElement = ratingHero.render(
        currentData.rating || 2.5, 
        currentData.interpretation || {}, 
        currentData
      );
      ratingContainer.appendChild(ratingElement);
      console.log('✅ RatingHero rendered with rating:', currentData.rating);
    }

    // Initialize and render SafetyWarnings
    const safetyWarnings = new window.SafetyWarnings();
    const warningsContainer = document.getElementById('safetyWarningsContainer');
    if (warningsContainer && currentData.warnings?.length > 0) {
      warningsContainer.innerHTML = '';
      const warningsElement = safetyWarnings.render(currentData.warnings);
      if (warningsElement) {
        warningsContainer.appendChild(warningsElement);
        console.log('✅ SafetyWarnings rendered with', currentData.warnings.length, 'warnings');
      }
    } else {
      console.log('ℹ️ No warnings to display');
    }
  }

  // Setup heatmap component 
  setupHeatmap(apiData) {
    const heatmapContainer = document.getElementById('heatmapContainer');
    if (!heatmapContainer || !apiData?.forecast) {
      console.error('❌ Missing heatmap container or forecast data');
      return;
    }

    try {
      console.log('🎯 Setting up heatmap with forecast data');
      
      // Simple data transformation for heatmap
      const heatmapData = this.prepareHeatmapData(apiData.forecast);
      
      // Render heatmap component
      const heatmap = new window.Heatmap();
      heatmapContainer.innerHTML = '';
      const heatmapElement = heatmap.render(heatmapData);
      heatmapContainer.appendChild(heatmapElement);
      
      console.log('✅ Heatmap rendered successfully');
      
    } catch (error) {
      console.error('❌ Failed to setup heatmap:', error);
      heatmapContainer.innerHTML = `
        <div class="heatmap-error">
          <span>⚠️ Error loading forecast data</span>
        </div>
      `;
    }
  }

  // Simple data preparation for heatmap component
  prepareHeatmapData(forecastDays) {
    if (!Array.isArray(forecastDays)) {
      return [];
    }

    return forecastDays.map(day => {
      const hourlyArray = [];
      const hours = ['8', '12', '18']; // Morning, Noon, Evening
      
      hours.forEach(hour => {
        const hourData = day.hourly?.[hour];
        if (hourData) {
          hourlyArray.push({
            time: `${String(hour).padStart(2, '0')}:00`,
            hour: parseInt(hour),
            rating: hourData.rating || 2.5,
            temperature: hourData.temperature || 20,
            windSpeed: hourData.windSpeed || 10,
            warnings: hourData.warnings || [],
            hasWarnings: hourData.hasWarnings || false
          });
        }
      });
      
      return {
        date: day.date,
        hourly: hourlyArray
      };
    });
  }

  // Extract current conditions from forecast data  
  extractCurrentConditions(mlData) {
    if (!mlData?.forecast?.[0]?.hourly) {
      console.error('❌ No forecast data available');
      return null;
    }
    
    // Get current time period (8=morning, 12=noon, 18=evening)
    const currentHour = new Date().getHours();
    let timeKey = '8'; // Default to morning
    if (currentHour >= 16) timeKey = '18';
    else if (currentHour >= 11) timeKey = '12';
    
    const currentConditions = mlData.forecast[0].hourly[timeKey];
    if (!currentConditions) {
      console.error(`❌ No data for time period: ${timeKey}`);
      return null;
    }
    
    return currentConditions;
  }

  // Generate realistic hourly weather variations for forecast
  generateHourlyVariation(baseWeather, day, hour) {
    // Apply realistic variations to create diverse forecast data
    const windVariation = 1 + (Math.sin(hour * Math.PI / 12) * 0.3) + (Math.random() * 0.4 - 0.2);
    const tempVariation = 1 + (Math.sin((hour - 6) * Math.PI / 12) * 0.15) + (day * 0.05);
    const humidityVariation = 1 + (Math.sin(hour * Math.PI / 8) * 0.2) + (Math.random() * 0.3 - 0.15);
    const cloudVariation = Math.max(0, Math.min(100, 
      (baseWeather.conditions?.cloudCover || 50) + (hour % 8) * 5 + (Math.random() * 30 - 15)
    ));
    const uvVariation = Math.max(0, Math.min(12, 
      (baseWeather.conditions?.uvIndex || 5) * Math.max(0, Math.sin((hour - 6) * Math.PI / 12))
    ));

    return {
      wind: {
        speedKPH: Math.max(0, (baseWeather.wind?.speedKPH || 10) * windVariation),
        direction: baseWeather.wind?.direction || 'N',
        gustKPH: Math.max(0, (baseWeather.wind?.gustKPH || 15) * windVariation * 1.2)
      },
      temperature: {
        celsius: Math.max(-10, Math.min(45, (baseWeather.temperature?.celsius || 20) * tempVariation)),
        fahrenheit: null // Will be calculated if needed
      },
      humidity: Math.max(0, Math.min(100, (baseWeather.humidity || 50) * humidityVariation)),
      conditions: {
        visibility: Math.max(1, Math.min(50, (baseWeather.conditions?.visibility || 10) + (Math.random() * 6 - 3))),
        cloudCover: cloudVariation,
        uvIndex: uvVariation,
        description: this.getConditionDescription(cloudVariation, uvVariation)
      }
    };
  }

  // Helper to get condition description based on cloud cover and UV
  getConditionDescription(cloudCover, uvIndex) {
    if (cloudCover < 25) return 'Clear';
    if (cloudCover < 50) return 'Partly Cloudy';
    if (cloudCover < 75) return 'Mostly Cloudy';
    return 'Overcast';
  }

  // Add toggle method back for advanced section
  toggleAdvanced(event) {
    event.stopPropagation();
    const header = event.currentTarget;
    const content = header.nextElementSibling;
    const icon = header.querySelector('.expand-icon');
    
    if (content.style.display === 'none' || !content.style.display) {
      content.style.display = 'block';
      icon.textContent = '▲';
      header.classList.add('expanded');
    } else {
      content.style.display = 'none';
      icon.textContent = '▼';
      header.classList.remove('expanded');
    }
  }

  // Create error content
  createErrorContent(spot, errorMessage) {
    return `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Unable to Load Current Conditions</h3>
        <p>We couldn't fetch the latest weather and predictions for this location.</p>
        <div class="error-details">
          <code>Error: ${errorMessage}</code>
        </div>
      </div>
    `;
  }

  initializeTooltips() {
    // Add event listeners for smart tooltip positioning
    const statCards = document.querySelectorAll('.stat-card');
    
    statCards.forEach((card, index) => {
      const tooltip = card.querySelector('.stat-tooltip');
      if (!tooltip) return;
      
      card.addEventListener('mouseenter', () => {
        // Calculate position to prevent off-screen tooltips
        const cardRect = card.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Reset classes
        tooltip.classList.remove('tooltip-left', 'tooltip-right', 'tooltip-bottom');
        
        // Check if tooltip would go off right edge
        if (cardRect.left + tooltipRect.width / 2 > viewportWidth - 20) {
          tooltip.classList.add('tooltip-left');
        }
        // Check if tooltip would go off left edge
        else if (cardRect.left - tooltipRect.width / 2 < 20) {
          tooltip.classList.add('tooltip-right');
        }
        
        // Check if tooltip would go off top edge (for cards in top rows)
        if (cardRect.top - tooltipRect.height < 20) {
          tooltip.classList.add('tooltip-bottom');
        }
      });
    });
  }

  close() {
    if (this.modal) {
      // Clean up factor tooltip
      const factorTooltip = document.querySelector('.factor-tooltip');
      if (factorTooltip) {
        factorTooltip.remove();
      }
      
      // Clean up heatmap tooltip
      if (this.heatmapTooltip) {
        this.heatmapTooltip.style.display = 'none';
      }
      
      // Remove heatmap event listeners
      if (this.heatmapMouseMove) {
        const canvas = document.getElementById('heatmapChart');
        if (canvas) {
          canvas.removeEventListener('mousemove', this.heatmapMouseMove);
          canvas.removeEventListener('mouseleave', this.heatmapMouseLeave);
        }
      }
      
      // Clean up components
      this.chartInstances.forEach(chart => {
        if (chart && chart.destroy) chart.destroy();
      });
      this.chartInstances = [];
      
      // Remove mobile enhancements
      this.removeMobileEnhancements();
      
      // Remove modal
      this.modal.remove();
      this.modal = null;
    }
  }

  addMobileEnhancements() {
    if (!this.modal) return;

    // Prevent body scroll when modal is open (iOS fix)
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    // Add touch-friendly close behavior
    const overlay = this.modal.querySelector('.modal-overlay');
    overlay.addEventListener('touchstart', (e) => {
      if (e.target === overlay) {
        e.preventDefault();
      }
    });

    // Smooth scrolling for modal content on mobile
    const modalBody = this.modal.querySelector('.modal-body');
    if (modalBody) {
      modalBody.style.webkitOverflowScrolling = 'touch';
      modalBody.style.overflowScrolling = 'touch';
    }

    // Enhanced touch interactions for stat cards
    const statCards = this.modal.querySelectorAll('.stat-card');
    statCards.forEach(card => {
      let touchTimeout;
      
      card.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchTimeout = setTimeout(() => {
          const tooltip = card.querySelector('.stat-tooltip');
          if (tooltip) {
            tooltip.style.opacity = '1';
            tooltip.style.visibility = 'visible';
            tooltip.style.transform = 'translateY(-8px)';
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
              tooltip.style.opacity = '0';
              tooltip.style.visibility = 'hidden';
              tooltip.style.transform = 'translateY(0)';
            }, 3000);
          }
        }, 500); // Long press for tooltip
      });
      
      card.addEventListener('touchend', () => {
        clearTimeout(touchTimeout);
      });
      
      card.addEventListener('touchmove', () => {
        clearTimeout(touchTimeout);
      });
    });

    // Viewport height fix for mobile browsers
    const setVH = () => {
      let vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);
  }

  removeMobileEnhancements() {
    // Restore body scroll
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    
    // Remove viewport height property
    document.documentElement.style.removeProperty('--vh');
  }

  // Format lake's local time using timezone information from API
  formatLakeLocalTime(location) {
    try {
      // If we have timezone and localTime from the API, use it
      if (location.timeZone && location.localTime) {
        // Parse the API's localTime and format it properly
        const lakeTime = new Date(location.localTime);
        if (!isNaN(lakeTime.getTime())) {
          return lakeTime.toLocaleString('en-US', {
            timeZone: location.timeZone,
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        }
      }

      // If we have just the timezone, show current time in that timezone
      if (location.timeZone) {
        return new Date().toLocaleString('en-US', {
          timeZone: location.timeZone,
          weekday: 'short',
          month: 'short',
          day: 'numeric', 
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }

      // Fallback to coordinates-based estimation
      return this.estimateLakeLocalTime(
        location.coordinates?.latitude, 
        location.coordinates?.longitude
      );
      
    } catch (error) {
      console.warn('Error formatting lake local time:', error);
      return this.estimateLakeLocalTime(
        location.coordinates?.latitude, 
        location.coordinates?.longitude
      );
    }
  }

  // Estimate local time based on coordinates (fallback method)
  estimateLakeLocalTime(latitude, longitude) {
    try {
      if (!latitude || !longitude) {
        return new Date().toLocaleString();
      }

      // Rough timezone estimation based on longitude
      // 15 degrees of longitude ≈ 1 hour time difference
      const timeZoneOffset = Math.round(longitude / 15);
      const utcTime = new Date();
      const localTime = new Date(utcTime.getTime() + (timeZoneOffset * 60 * 60 * 1000));
      
      return localTime.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      }) + ` (GMT${timeZoneOffset >= 0 ? '+' : ''}${timeZoneOffset})`;
      
    } catch (error) {
      console.warn('Error estimating lake local time:', error);
      return new Date().toLocaleString() + ' (Local)';
    }
  }

  // Format update timestamp in lake's timezone 
  formatUpdateTime(location) {
    try {
      const now = new Date();
      
      // If we have timezone info, show update time in lake's timezone
      if (location?.timeZone) {
        return now.toLocaleString('en-US', {
          timeZone: location.timeZone,
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      // Fallback to user's local time
      return now.toLocaleString('en-US', {
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
    } catch (error) {
      console.warn('Error formatting update time:', error);
      return new Date().toLocaleString();
    }
  }
}

// Global instance
window.lakeModal = new LakeModal();

// Event listeners for modal
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    lakeModal.close();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    lakeModal.close();
  }
});
