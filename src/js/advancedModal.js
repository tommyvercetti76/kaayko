/**
 * Advanced Lake Modal - Clean, efficient modal with core components
 * Components: Header, Rating Hero, Safety Warnings, Heatmap
 */
class AdvancedLakeModal {
  constructor() {
    this.modal = null;
    this.currentSpot = null;
    this.isLoading = false;
    
    // Bind methods
    this.handleApiModeChange = this.handleApiModeChange.bind(this);
    this.close = this.close.bind(this);
    
    // Listen for API mode changes
    document.addEventListener('apiModeChanged', this.handleApiModeChange);
  }

  // Handle API mode changes
  async handleApiModeChange(event) {
    if (this.modal && this.currentSpot && !this.isLoading) {
      console.log('🔄 API mode changed, refreshing modal data...', event.detail);
      await this.loadSpotData(this.currentSpot);
    }
  }

  // Main entry point - open modal for a spot
  async open(spot) {
    if (this.isLoading) return;
    
    this.loadRequiredCSS();
    this.createModal(spot);
    this.addToDOM();
    this.enableMobileOptimizations();
    
    await this.loadSpotData(spot);
  }

  // Load required CSS files
  loadRequiredCSS() {
    const cssFiles = [
      { id: 'rating-hero-css', href: '/js/components/RatingHero.css' },
      { id: 'safety-warnings-css', href: '/js/components/SafetyWarnings.css' },
      { id: 'heatmap-css', href: '/js/components/Heatmap.css' }
    ];

    cssFiles.forEach(({ id, href }) => {
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      }
    });
  }

  // Create modal structure
  createModal(spot) {
    this.modal = document.createElement('div');
    this.modal.className = 'advanced-modal';
    
    // Check if this was opened from custom location search
    const hasSearchContext = spot.searchContext;
    
    this.modal.innerHTML = `
      <div class="advanced-overlay">
        <div class="advanced-container">
          <div class="advanced-header">
            <div class="advanced-title">
              ${hasSearchContext ? '<button class="advanced-back" aria-label="Back to search results">←</button>' : ''}
              <div class="title-content">
                <h2>${spot.title}</h2>
                <p class="advanced-subtitle">${spot.subtitle || ''}</p>
              </div>
            </div>
            <button class="advanced-close">&times;</button>
          </div>
          <div class="advanced-body">
            <div class="advanced-content">
              <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading conditions...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    this.modal.querySelector('.advanced-close').addEventListener('click', this.close);
    this.modal.querySelector('.advanced-overlay').addEventListener('click', (e) => {
      if (e.target.classList.contains('advanced-overlay')) {
        this.close();
      }
    });

    // Add back button listener if it exists
    const backBtn = this.modal.querySelector('.advanced-back');
    if (backBtn && hasSearchContext) {
      backBtn.addEventListener('click', () => {
        this.handleBackToSearch(spot.searchContext);
      });
    }
  }

  // Add modal to DOM
  addToDOM() {
    document.body.appendChild(this.modal);
  }

  // Load and display spot data
  async loadSpotData(spot) {
    this.currentSpot = spot;
    this.isLoading = true;
    
    const contentDiv = this.modal.querySelector('.advanced-content');
    
    try {
      // Get both current conditions (paddleScore) and forecast data (fastForecast)
      const [currentData, forecastData] = await Promise.all([
        window.apiClient.getCurrentData(spot.location.latitude, spot.location.longitude),
        window.apiClient.getFastForecast(spot.location.latitude, spot.location.longitude)
      ]);
      
      console.log('✅ Data received:', {
        currentSuccess: currentData?.success,
        forecastSuccess: forecastData?.success,
        currentResponseTime: currentData?.metadata?.responseTime,
        forecastResponseTime: forecastData?.metadata?.responseTime,
        mode: window.apiClient?.getMode()
      });
      
      // Create content and render components
      contentDiv.innerHTML = this.createContent(spot, forecastData, currentData);
      this.renderComponents(forecastData, currentData);
      
    } catch (error) {
      console.error('❌ Failed to load spot data:', error);
      contentDiv.innerHTML = this.createErrorContent(spot, error.message);
    } finally {
      this.isLoading = false;
    }
  }

  // Create main content structure
  createContent(spot, forecastData, currentData) {
    const location = forecastData.location;
    
    // Update modal title with API location name if available
    this.updateModalTitle(spot, location);
    
    return `
      <div class="rating-hero-wrapper">
        <div id="ratingHeroContainer"></div>
        <div id="safetyWarningsContainer" class="safety-warnings-overlay"></div>
      </div>
      <div id="heatmapContainer"></div>
      <div class="location-info">
        ${this.createLocationInfo(location, spot)}
      </div>
      <div class="api-status">
        <small>
          ${this.createAPIStatusInfo(forecastData)}
        </small>
      </div>
    `;
  }

  // Create location info section
  createLocationInfo(location, spot) {
    if (!location) return '';
    
    return `
      <div class="location-item">
        <span class="location-label">Region:</span>
        <span>${location.region || 'Unknown'}, ${location.country || 'Unknown'}</span>
      </div>
      <div class="location-item">
        <span class="location-label">Local Time:</span>
        <span>${this.formatLocalTime(location, spot)}</span>
      </div>
      <div class="location-item">
        <span class="location-label">Coordinates:</span>
        <span>${this.formatCoordinates(location, spot)}</span>
      </div>
    `;
  }

  // Create API status info
  createAPIStatusInfo(forecastData) {
    const mlIcon = window.dataTransformer?.getMLStatusIcon?.(forecastData) || '🤖';
    const version = forecastData.mlVersion || 'v2.0';
    const responseTime = forecastData.metadata?.responseTime || 'N/A';
    
    return `
      ${mlIcon} Powered by Kaayko ML ${version} | Response: ${responseTime}
    `;
  }

  // Render all components
  renderComponents(forecastData, currentData) {
    this.renderHero(currentData, forecastData);
    this.renderSafetyWarnings(forecastData);
    this.renderHeatmap(forecastData);
  }

    // Render Rating Hero component
  renderHero(currentData, forecastData) {
    console.log('🏆 renderHero called with:', currentData);
    
    if (!currentData?.paddleScore) {
      console.warn('⚠️ No paddleScore data for hero:', currentData);
      return;
    }

    const container = document.getElementById('ratingHeroContainer');
    if (!container) {
      console.error('❌ No ratingHeroContainer found');
      return;
    }

    try {
      const ratingHero = new window.RatingHero();
      container.innerHTML = '';
      
      // Extract data from paddleScore API response
      const rating = currentData.paddleScore.rating;
      const interpretation = {
        skillLevel: this.getSkillLevelFromRating(rating),
        recommendation: currentData.paddleScore.interpretation,
        details: `Confidence: ${currentData.paddleScore.confidence} | ML Model: ${currentData.paddleScore.mlModelUsed}`,
        penalties: currentData.paddleScore.penalties || [],
        originalRating: currentData.paddleScore.originalRating || rating,
        totalPenalty: currentData.paddleScore.totalPenalty || 0
      };
      
      // Merge conditions with penalty information for safety analysis
      const weather = {
        ...currentData.conditions,
        penalties: currentData.paddleScore.penalties || [],
        originalRating: currentData.paddleScore.originalRating || rating,
        totalPenalty: currentData.paddleScore.totalPenalty || 0,
        hasPenalties: currentData.paddleScore.penalties && currentData.paddleScore.penalties.length > 0
      };
      
      console.log('🏆 RatingHero data prepared:', { rating, interpretation, weather, forecastData });
      console.log('⚠️ SAFETY CHECK - Penalties:', weather.penalties);
      
      const element = ratingHero.render(rating, interpretation, weather, forecastData);
      container.appendChild(element);
      console.log('✅ RatingHero rendered with paddleScore rating:', rating);
    } catch (error) {
      console.error('❌ Failed to render RatingHero:', error);
    }
  }

  // Get appropriate skill level based on rating
  getSkillLevelFromRating(rating) {
    if (rating >= 4.5) return 'BEGINNERS WELCOME';
    if (rating >= 4.0) return 'BEGINNERS WITH GUIDANCE';
    if (rating >= 3.5) return 'MODERATE SKILL REQUIRED';
    if (rating >= 3.0) return 'EXPERIENCED ONLY';
    if (rating >= 2.5) return 'EXPERT LEVEL';
    return 'NOT RECOMMENDED';
  }

  // Render Safety Warnings component
  renderSafetyWarnings(forecastData) {
    const warnings = window.dataTransformer?.prepareWarningsData?.(forecastData) || [];
    
    if (!warnings.length) return;

    const container = document.getElementById('safetyWarningsContainer');
    if (!container) return;

    try {
      const safetyWarnings = new window.SafetyWarnings();
      container.innerHTML = '';
      const element = safetyWarnings.render(warnings);
      if (element) {
        container.appendChild(element);
        console.log('✅ SafetyWarnings rendered with', warnings.length, 'warnings');
      }
    } catch (error) {
      console.error('❌ Failed to render SafetyWarnings:', error);
    }
  }

  // Render Heatmap component
  renderHeatmap(forecastData) {
    const heatmapData = window.dataTransformer?.prepareHeatmapData?.(forecastData.forecast);
    if (!heatmapData?.length) return;

    const container = document.getElementById('heatmapContainer');
    if (!container) return;

    try {
      const heatmap = new window.Heatmap();
      container.innerHTML = '';
      // Pass location data for timezone calculations
      const element = heatmap.render(heatmapData, forecastData.location);
      container.appendChild(element);
      console.log('✅ Heatmap rendered with location timezone support');
    } catch (error) {
      console.error('❌ Failed to render Heatmap:', error);
    }
  }

  // Create error content
  createErrorContent(spot, errorMessage) {
    return `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h3>Unable to Load Conditions</h3>
        <p>We couldn't fetch the latest data for this location.</p>
        <div class="error-details">
          <code>Error: ${errorMessage}</code>
        </div>
        <button onclick="window.advancedModal.loadSpotData(window.advancedModal.currentSpot)" class="retry-btn">
          Try Again
        </button>
      </div>
    `;
  }

  // Update modal title with location name
  updateModalTitle(spot, location) {
    const title = this.modal.querySelector('h2');
    if (!title) return;

    if (spot.isCustom && location?.name) {
      title.textContent = location.name;
    }
  }

  // Format local time
  formatLocalTime(location, spot) {
    try {
      // Try timezone from API first
      let timezone = location.timeZone || location.timezone;
      
      // Get coordinates from location or spot
      const lat = location.coordinates?.latitude || spot?.location?.latitude;
      const lng = location.coordinates?.longitude || spot?.location?.longitude;
      
      // If no timezone from API, estimate based on coordinates
      if (!timezone && lat && lng) {
        timezone = this.estimateTimezone(lat, lng);
      }
      
      // If we have a specific local time from API, use that
      if (timezone && location.localTime) {
        const lakeTime = new Date(location.localTime);
        if (!isNaN(lakeTime.getTime())) {
          return lakeTime.toLocaleString('en-US', {
            timeZone: timezone,
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        }
      }

      // Fall back to current time in estimated timezone
      if (timezone) {
        return new Date().toLocaleString('en-US', {
          timeZone: timezone,
          weekday: 'short',
          month: 'short',
          day: 'numeric', 
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      return 'Local time unavailable';
    } catch (error) {
      console.warn('Error formatting time:', error);
      return 'Local time unavailable';
    }
  }

  // Estimate timezone based on coordinates
  estimateTimezone(lat, lng) {
    // Simple timezone estimation based on longitude
    // This is a basic approximation - real apps would use a timezone API
    const utcOffset = Math.round(lng / 15);
    
    // Common US timezones based on coordinates
    if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -66) {
      if (lng >= -125 && lng <= -114) return 'America/Los_Angeles';      // Pacific
      if (lng >= -114 && lng <= -104) return 'America/Denver';           // Mountain  
      if (lng >= -104 && lng <= -87) return 'America/Chicago';           // Central
      if (lng >= -87 && lng <= -66) return 'America/New_York';           // Eastern
    }
    
    // For Utah coordinates (around -109.5)
    if (lat >= 37 && lat <= 42 && lng >= -114 && lng <= -109) {
      return 'America/Denver'; // Mountain Time
    }
    
    // Default UTC offset calculation
    if (utcOffset >= -12 && utcOffset <= 12) {
      return `Etc/GMT${utcOffset <= 0 ? '+' : '-'}${Math.abs(utcOffset)}`;
    }
    
    return null;
  }

  // Format coordinates
  formatCoordinates(location, spot) {
    const lat = location.coordinates?.latitude || spot.location.latitude;
    const lng = location.coordinates?.longitude || spot.location.longitude;
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  // Enable mobile optimizations
  enableMobileOptimizations() {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  }

  // Disable mobile optimizations
  disableMobileOptimizations() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }

  // Close modal
  close() {
    if (this.modal) {
      this.disableMobileOptimizations();
      this.modal.remove();
      this.modal = null;
      this.currentSpot = null;
      this.isLoading = false;
    }
  }

  // Handle back to search functionality
  handleBackToSearch(searchContext) {
    console.log('🔙 Navigating back to search results:', searchContext);
    
    // Close this modal first
    this.close();
    
    // Restore search results in custom location modal
    if (window.customLocationModal && searchContext) {
      window.customLocationModal.restoreSearchResults(searchContext);
    }
  }

  // Cleanup
  destroy() {
    this.close();
    document.removeEventListener('apiModeChanged', this.handleApiModeChange);
  }
}

// Global instance
window.advancedModal = new AdvancedLakeModal();

// Global event listeners
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && window.advancedModal) {
    window.advancedModal.close();
  }
});
