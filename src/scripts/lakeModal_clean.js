/**
 * File: scripts/lakeModal.js
 * 
 * Lake Modal - Displays ML predictions, weather data, and lake information
 * SIMPLIFIED VERSION - No redundant methods, clean data flow
 */

class LakeModal {
  constructor() {
    this.modal = null;
    this.currentSpot = null;
    
    // Production kaaykostore configuration
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

  // Get cached data or fetch new data from API
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
      // Get forecast data for both heatmap AND current conditions
      console.log('📊 Fetching FORECAST data for all components');
      const forecastData = await this.getCachedPrediction(
        spot.location.latitude, 
        spot.location.longitude, 
        true // Get forecast data
      );
      
      console.log('✅ Forecast data received:', {
        success: forecastData?.success,
        forecastDays: forecastData?.forecast?.length
      });

      // Update modal with content
      contentDiv.innerHTML = this.createContent(spot, forecastData);
      
      // Initialize all components with forecast data
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
    // Extract location from forecast data
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
            <span>${new Date().toLocaleString()}</span>
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
            <span>${new Date().toLocaleString()}</span>
          </div>
          `}
        </div>

        <div class="update-timestamp">
          <small>📊 Last updated: ${new Date().toLocaleString()}</small>
        </div>
      </div>
    `;
  }

  // Initialize components (hero + heatmap)
  initializeComponents(mlData) {
    // Render hero and safety warnings
    this.renderHeroComponents(mlData);
    
    // Setup heatmap directly with forecast data
    this.setupSimpleHeatmap(mlData);
    
    // Add smart tooltip positioning
    this.initializeTooltips();
  }

  // Render hero and safety warning components
  renderHeroComponents(mlData) {
    console.log('🏆 RENDER COMPONENTS called with mlData:', mlData);
    
    // Get current conditions from the forecast data (today's current time period)
    const currentData = this.extractCurrentConditions(mlData);
    console.log('🏆 CURRENT CONDITIONS extracted:', currentData);

    if (!currentData) {
      console.error('❌ No current conditions available for components');
      return;
    }

    // Initialize components
    const ratingHero = new window.RatingHero();
    const safetyWarnings = new window.SafetyWarnings();

    // Render Rating Hero with current conditions
    const ratingContainer = document.getElementById('ratingHeroContainer');
    if (ratingContainer) {
      ratingContainer.innerHTML = ''; // Clear previous content
      const ratingElement = ratingHero.render(
        currentData.rating || currentData.apiRating || 2.5, 
        {
          skillLevel: 'EXPERIENCED ONLY',
          recommendation: 'Assess conditions carefully before paddling',
          details: 'Weather conditions require careful evaluation'
        },
        currentData // Pass the complete current conditions
      );
      ratingContainer.appendChild(ratingElement);
      console.log('✅ RatingHero rendered with rating:', currentData.rating || currentData.apiRating);
    }

    // Render Safety Warnings
    const warningsContainer = document.getElementById('safetyWarningsContainer');
    if (warningsContainer && currentData.warnings && currentData.warnings.length > 0) {
      warningsContainer.innerHTML = ''; // Clear previous content
      const warningsElement = safetyWarnings.render(currentData.warnings);
      if (warningsElement) {
        warningsContainer.appendChild(warningsElement);
        console.log('✅ SafetyWarnings rendered with', currentData.warnings.length, 'warnings');
      }
    } else {
      console.log('ℹ️ No warnings to display');
    }
  }

  // Simplified heatmap setup - use forecast data directly
  setupSimpleHeatmap(apiData) {
    const heatmapContainer = document.getElementById('heatmapContainer');
    if (!heatmapContainer || !apiData?.forecast) {
      console.error('❌ Missing heatmap container or forecast data');
      return;
    }

    try {
      console.log('🎯 Setting up heatmap with', apiData.forecast.length, 'days of data');
      
      // Transform forecast data to simple format for heatmap
      const heatmapData = this.transformToHeatmapFormat(apiData.forecast);
      
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
          <div class="error-message">
            <span>⚠️ Error loading forecast data</span>
          </div>
        </div>
      `;
    }
  }

  // Transform API forecast to simple heatmap format
  transformToHeatmapFormat(forecastDays) {
    return forecastDays.map(day => {
      const hourlyArray = [];
      const hours = ['8', '12', '18']; // Morning, Noon, Evening
      
      hours.forEach(hour => {
        const hourData = day.hourly?.[hour];
        if (hourData) {
          hourlyArray.push({
            time: `${String(hour).padStart(2, '0')}:00`,
            hour: parseInt(hour),
            rating: hourData.rating || hourData.apiRating || 2.5,
            paddleRating: hourData.rating || hourData.apiRating || 2.5,
            temperature: hourData.temperature || 20,
            windSpeed: hourData.windSpeed || 10,
            warnings: hourData.warnings || [],
            hasWarnings: hourData.hasWarnings || false
          });
        } else {
          // Fallback if hour data missing
          hourlyArray.push({
            time: `${String(hour).padStart(2, '0')}:00`,
            hour: parseInt(hour),
            rating: 2.5,
            paddleRating: 2.5,
            temperature: 20,
            windSpeed: 10,
            warnings: [],
            hasWarnings: false
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
    if (!mlData?.forecast || !Array.isArray(mlData.forecast) || mlData.forecast.length === 0) {
      console.error('❌ No forecast data available for current conditions');
      return null;
    }
    
    // Get today's data (first day in forecast)
    const today = mlData.forecast[0];
    if (!today?.hourly) {
      console.error('❌ No hourly data for today');
      return null;
    }
    
    // Determine current time period (morning=8, noon=12, evening=18)
    const currentHour = new Date().getHours();
    let timeKey = '8'; // Default to morning
    
    if (currentHour >= 16) timeKey = '18'; // Evening (4 PM - 11:59 PM)
    else if (currentHour >= 11) timeKey = '12'; // Noon (11 AM - 3:59 PM)
    // Morning (12 AM - 10:59 AM) = '8'
    
    const currentConditions = today.hourly[timeKey];
    if (!currentConditions) {
      console.error(`❌ No data for current time period: ${timeKey}`);
      return null;
    }
    
    console.log(`✅ Current conditions for hour ${timeKey}:`, currentConditions);
    return currentConditions;
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
