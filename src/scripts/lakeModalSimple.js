/**
 * Simplified Lake Modal - Coordinates components using services
 */
class LakeModal {
  constructor() {
    this.modal = null;
    this.currentSpot = null;
  }

  // Main entry point
  async open(spot) {
    this.loadRequiredCSS();
    this.modal = this.createModal(spot);
    document.body.appendChild(this.modal);
    this.addMobileEnhancements();
    await this.showLakeInfo(spot);
  }

  // Load required CSS
  loadRequiredCSS() {
    const cssId = 'rating-hero-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = '/scripts/components/RatingHero.css';
      document.head.appendChild(link);
    }
  }

  // Load and display data
  async showLakeInfo(spot) {
    this.currentSpot = spot;
    const contentDiv = this.modal.querySelector('.chat-content');
    contentDiv.innerHTML = this.createLoadingState();
    
    try {
      // Get forecast data using API client
      const forecastData = await window.apiClient.getForecastData(
        spot.location.latitude, 
        spot.location.longitude
      );
      
      console.log('✅ Forecast data received:', {
        success: forecastData?.success,
        forecastDays: forecastData?.forecast?.length
      });
      
      // Create content and initialize components
      contentDiv.innerHTML = this.createContent(spot, forecastData);
      this.initializeComponents(forecastData);
      
    } catch (error) {
      console.error('Modal data loading failed:', error);
      contentDiv.innerHTML = this.createErrorContent(spot, error.message);
    }
  }

  // Initialize all components
  initializeComponents(forecastData) {
    this.renderHero(forecastData);
    this.renderWarnings(forecastData);
    this.renderHeatmap(forecastData);
  }

  // Render hero component
  renderHero(forecastData) {
    const heroData = window.dataTransformer.prepareHeroData(forecastData);
    if (!heroData) return;

    const ratingHero = new window.RatingHero();
    const container = document.getElementById('ratingHeroContainer');
    if (container) {
      container.innerHTML = '';
      const element = ratingHero.render(
        heroData.rating,
        heroData.interpretation,
        heroData.weather
      );
      container.appendChild(element);
      console.log('✅ RatingHero rendered');
    }
  }

  // Render warnings component
  renderWarnings(forecastData) {
    const warnings = window.dataTransformer.prepareWarningsData(forecastData);
    if (!warnings.length) return;

    const safetyWarnings = new window.SafetyWarnings();
    const container = document.getElementById('safetyWarningsContainer');
    if (container) {
      container.innerHTML = '';
      const element = safetyWarnings.render(warnings);
      if (element) {
        container.appendChild(element);
        console.log('✅ SafetyWarnings rendered');
      }
    }
  }

  // Render heatmap component
  renderHeatmap(forecastData) {
    const heatmapData = window.dataTransformer.prepareHeatmapData(forecastData.forecast);
    if (!heatmapData.length) return;

    const heatmap = new window.Heatmap();
    const container = document.getElementById('heatmapContainer');
    if (container) {
      container.innerHTML = '';
      const element = heatmap.render(heatmapData);
      container.appendChild(element);
      console.log('✅ Heatmap rendered');
    }
  }

  // Create modal structure
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

  // Create loading state
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

  // Create main content
  createContent(spot, forecastData) {
    const location = forecastData.location;
    const mlIcon = window.dataTransformer.getMLStatusIcon(forecastData);
    
    // Update modal title with API location name if available
    this.updateModalTitle(spot, location);
    
    return `
      <div class="modal-content-grid">
        <!-- Component containers -->
        <div class="rating-hero-wrapper">
          <div id="ratingHeroContainer"></div>
          <div id="safetyWarningsContainer" class="safety-warnings-overlay"></div>
        </div>
        <div id="heatmapContainer"></div>

        <!-- Location Info -->
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
          <small>${mlIcon} Last updated: ${new Date().toLocaleString()}</small>
        </div>
      </div>
    `;
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

  // Close modal
  close() {
    if (this.modal) {
      this.removeMobileEnhancements();
      this.modal.remove();
      this.modal = null;
    }
  }

  // Mobile enhancements
  addMobileEnhancements() {
    if (!this.modal) return;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  }

  removeMobileEnhancements() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  }

  // Update modal title with location name
  updateModalTitle(spot, location) {
    const title = this.modal.querySelector('h2');
    if (title) {
      // For custom locations (coordinates), use reverse geocoded name
      if (spot.isCustom) {
        const locationName = location?.name || 
                            (spot?.customName ? `Custom: ${spot.customName}` : '') ||
                            `Location ${spot.location.latitude.toFixed(4)}, ${spot.location.longitude.toFixed(4)}`;
        title.textContent = locationName;
      }
      // For regular paddling spots, keep the original spot name
      // Don't update the title - keep what was set in createModal()
    }
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
}

// Global instance
window.lakeModal = new LakeModal();

// Event listeners
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
