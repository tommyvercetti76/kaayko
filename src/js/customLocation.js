/* Custom Location Feature - Sleek coordinate input with water body validation */

class CustomLocationModal {
  constructor() {
    this.modal = null;
    this.isValidating = false;
    
    // Professional error messages for different scenarios
    this.errorMessages = {
      invalidCoords: {
        title: "Invalid Coordinates",
        message: "Please enter valid coordinates:\n• Latitude: -90 to 90\n• Longitude: -180 to 180"
      },
      notWater: {
        title: "Location Not Suitable for Paddling",
        messages: [
          "This location appears to be on land. Please select coordinates over a water body.",
          "The selected coordinates are not over a lake, river, or ocean suitable for paddling.",
          "This location doesn't appear to be a suitable water body for paddling activities.",
          "Please select coordinates that are over water for accurate paddling predictions.",
          "The location appears to be terrestrial. Water body coordinates are required.",
          "This doesn't appear to be a paddleable water body. Please try different coordinates.",
          "Selected location is not over water. Please choose coordinates over a lake or river.",
          "Unable to provide paddling conditions for non-water locations.",
          "This location is not suitable for water sports activities.",
          "Please select coordinates over a water body for paddling condition analysis."
        ]
      },
      networkError: {
        title: "Connection Error",
        message: "Unable to validate location. Please check your internet connection and try again."
      },
      unknownError: {
        title: "Validation Error",
        message: "Unable to validate the location. Please try again in a moment."
      }
    };
  }

  // Initialize the custom location feature
  init() {
    this.loadCSS();
    this.addEventListeners();
  }

  // Load CSS dynamically
  loadCSS() {
    const cssId = 'custom-location-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = '/css/customLocation.css';
      document.head.appendChild(link);
      console.log('Custom Location CSS loaded');
    }
  }

  // Add event listeners
  addEventListeners() {
    const customLocationBtn = document.querySelector('.custom-location-btn');
    if (customLocationBtn) {
      customLocationBtn.addEventListener('click', () => this.open());
    }

    // Keyboard shortcut: Ctrl/Cmd + L
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        this.open();
      }
    });
  }

  // Open the custom location modal
  open() {
    if (this.modal) return; // Already open

    this.modal = this.createModal();
    document.body.appendChild(this.modal);

    // Add event listeners
    this.addModalEventListeners();

    // Show modal with animation
    requestAnimationFrame(() => {
      this.modal.classList.add('show');
      this.focusLatitudeInput();
    });
  }

  // Create the modal HTML
  createModal() {
    const modal = document.createElement('div');
    modal.className = 'custom-location-overlay';
    modal.innerHTML = `
      <div class="custom-location-modal">
        <div class="modal-header">
          <h2>Custom Location</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="input-group">
            <div class="location-options">
              <button class="btn btn-location" id="use-current-location">
                <span class="material-icons">my_location</span>
                Current Location
              </button>
              <button class="btn-refresh" id="refresh-fields" title="Clear fields">
                <span class="material-icons">refresh</span>
              </button>
            </div>
            <div class="input-row">
              <input 
                type="number" 
                class="coord-input" 
                id="latitude-input"
                placeholder="Latitude"
                step="any"
                min="-90"
                max="90"
              >
              <input 
                type="number" 
                class="coord-input" 
                id="longitude-input"
                placeholder="Longitude"
                step="any"
                min="-180"
                max="180"
              >
            </div>
          </div>
          
          <div class="error-message" id="error-message">
            <div class="error-title"></div>
            <div class="error-content"></div>
          </div>

          <div class="modal-actions">
            <button class="btn btn-cancel" id="cancel-btn">Cancel</button>
            <button class="btn btn-submit" id="submit-btn">
              <span class="btn-text">Get Conditions</span>
              <span class="btn-loader"></span>
            </button>
          </div>
        </div>
      </div>
    `;

    return modal;
  }

    // Add modal event listeners
  addModalEventListeners() {
    const closeBtn = this.modal.querySelector('.modal-close');
    const cancelBtn = this.modal.querySelector('#cancel-btn');
    const submitBtn = this.modal.querySelector('#submit-btn');
    const locationBtn = this.modal.querySelector('#use-current-location');
    const refreshBtn = this.modal.querySelector('#refresh-fields');
    const latInput = this.modal.querySelector('#latitude-input');
    const lngInput = this.modal.querySelector('#longitude-input');

    // Close handlers
    closeBtn.addEventListener('click', () => this.close());
    cancelBtn.addEventListener('click', () => this.close());
    
    // Submit handler
    submitBtn.addEventListener('click', () => this.handleSubmit());
    
    // Location handler
    locationBtn.addEventListener('click', () => this.getCurrentLocation());
    
    // Refresh handler
    refreshBtn.addEventListener('click', () => this.refreshFields());
    
    // Input validation
    latInput.addEventListener('input', () => this.validateInput(latInput, 'latitude'));
    lngInput.addEventListener('input', () => this.validateInput(lngInput, 'longitude'));
    
    // Enter key handler
    [latInput, lngInput].forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleSubmit();
        }
      });
    });
    
    // Overlay click to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }

  // Validate input in real-time
  validateInput(input, type) {
    const value = parseFloat(input.value);
    const isValid = type === 'latitude' 
      ? !isNaN(value) && value >= -90 && value <= 90
      : !isNaN(value) && value >= -180 && value <= 180;

    input.classList.remove('valid', 'invalid');
    if (input.value && !isValid) {
      input.classList.add('invalid');
    } else if (input.value && isValid) {
      input.classList.add('valid');
    }

    this.hideError();
    this.updateSubmitButton();
  }

  // Update submit button state
  updateSubmitButton() {
    const submitBtn = this.modal.querySelector('#submit-btn');
    const latInput = this.modal.querySelector('#latitude-input');
    const lngInput = this.modal.querySelector('#longitude-input');

    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);
    
    const isValidLat = !isNaN(lat) && lat >= -90 && lat <= 90;
    const isValidLng = !isNaN(lng) && lng >= -180 && lng <= 180;
    const isReady = isValidLat && isValidLng && !this.isValidating;

    submitBtn.disabled = !isReady;
  }

  // Refresh/clear all fields
  refreshFields() {
    const latInput = this.modal.querySelector('#latitude-input');
    const lngInput = this.modal.querySelector('#longitude-input');
    const errorMessage = this.modal.querySelector('#error-message');
    const submitBtn = this.modal.querySelector('#submit-btn');
    
    // Clear inputs
    latInput.value = '';
    lngInput.value = '';
    
    // Hide error message
    errorMessage.classList.remove('show');
    
    // Reset button state
    submitBtn.disabled = true;
    submitBtn.classList.remove('loading');
    
    // Reset input validation states
    latInput.classList.remove('error', 'valid');
    lngInput.classList.remove('error', 'valid');
    
    // Focus on latitude input
    latInput.focus();
    
    console.log('🔄 Fields refreshed');
  }

  // Get current location using browser geolocation
  async getCurrentLocation() {
    const locationBtn = this.modal.querySelector('#use-current-location');
    const latInput = this.modal.querySelector('#latitude-input');
    const lngInput = this.modal.querySelector('#longitude-input');

    if (!navigator.geolocation) {
      this.showError({
        title: "Geolocation Not Supported",
        message: "Your browser doesn't support location services. Please enter coordinates manually."
      });
      return;
    }

    // Update button state
    locationBtn.disabled = true;
    const originalText = locationBtn.innerHTML;
    locationBtn.innerHTML = `
      <span class="material-icons">hourglass_empty</span>
      Getting Location...
    `;

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      });

      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);

      // Fill in the coordinates
      latInput.value = lat;
      lngInput.value = lng;

      // Trigger validation
      this.validateInput(latInput, 'latitude');
      this.validateInput(lngInput, 'longitude');

      // Success feedback
      locationBtn.innerHTML = `
        <span class="material-icons">check_circle</span>
        Location Found!
      `;
      
      // Auto-proceed with validation and submission after a brief delay
      setTimeout(async () => {
        locationBtn.innerHTML = originalText;
        locationBtn.disabled = false;
        
        // Automatically proceed with the location
        console.log('🚀 Auto-proceeding with current location');
        await this.handleSubmit();
      }, 1000);

    } catch (error) {
      let errorMessage = "Unable to get your location. ";
      
      if (error.code === error.PERMISSION_DENIED) {
        errorMessage += "Please allow location access and try again.";
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        errorMessage += "Location information is unavailable.";
      } else if (error.code === error.TIMEOUT) {
        errorMessage += "Location request timed out.";
      } else {
        errorMessage += "Please enter coordinates manually.";
      }

      this.showError({
        title: "Location Error",
        message: errorMessage
      });

      locationBtn.innerHTML = originalText;
      locationBtn.disabled = false;
    }
  }

  // Handle form submission
  async handleSubmit() {
    if (this.isValidating) return;

    const latInput = this.modal.querySelector('#latitude-input');
    const lngInput = this.modal.querySelector('#longitude-input');
    const submitBtn = this.modal.querySelector('#submit-btn');

    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);

    // Validate coordinates
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      this.showError(this.errorMessages.invalidCoords);
      return;
    }

    // Show loading state
    this.setLoadingState(true);

    try {
      // First get the location name via reverse geocoding
      const locationName = await this.reverseGeocode(lat, lng);
      
      // Validate if location is a water body (with improved validation)
      const isWaterBody = await this.validateWaterBody(lat, lng, locationName);
      
      if (!isWaterBody) {
        const randomMessage = this.errorMessages.notWater.messages[
          Math.floor(Math.random() * this.errorMessages.notWater.messages.length)
        ];
        this.showError({
          title: this.errorMessages.notWater.title,
          message: randomMessage
        });
        return;
      }

      // Valid water body - create spot object with proper name and open lake modal
      const spot = {
        title: locationName || `Location ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        subtitle: `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`,
        location: { latitude: lat, longitude: lng },
        isCustom: true,
        customName: locationName
      };

      // Close this modal
      this.close();

      // Open advanced modal with custom location
      if (window.advancedModal) {
        await window.advancedModal.open(spot);
      } else {
        console.error('Advanced modal not available');
      }

    } catch (error) {
      console.error('Error validating location:', error);
      
      if (error.message.includes('network') || error.message.includes('fetch')) {
        this.showError(this.errorMessages.networkError);
      } else {
        this.showError(this.errorMessages.unknownError);
      }
    } finally {
      this.setLoadingState(false);
    }
  }

  // Reverse geocode coordinates to get location name
  async reverseGeocode(lat, lng) {
    try {
      // Use OpenStreetMap Nominatim for reverse geocoding (free, no API key required)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Kaayko-Paddling-App'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();
      
      if (data && data.display_name) {
        // Extract meaningful location name
        const address = data.address || {};
        
        // Priority order for water body names
        const locationName = 
          address.water || 
          address.lake || 
          address.river || 
          address.bay || 
          address.ocean || 
          address.sea ||
          address.reservoir ||
          address.natural ||
          address.suburb ||
          address.village ||
          address.town ||
          address.city ||
          address.county ||
          address.state ||
          data.display_name.split(',')[0];

        console.log('🗺️ Reverse geocoded location:', locationName);
        return locationName;
      }
      
      return null;
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      return null;
    }
  }

  // Validate if coordinates are over a water body
  async validateWaterBody(lat, lng, locationName) {
    try {
      console.log('🌊 Validating water body for:', locationName || `${lat}, ${lng}`);
      
      // Use Nominatim (OpenStreetMap) for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Kaayko-Paddling-App'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }
      
      const data = await response.json();
      
      // Check if location is over water
      const waterTypes = ['water', 'natural', 'waterway', 'bay', 'strait', 'fjord', 'sound'];
      const isWater = waterTypes.some(type => 
        data.category === type || 
        data.type === type ||
        (data.address && Object.values(data.address).some(addr => 
          typeof addr === 'string' && 
          (addr.toLowerCase().includes('lake') || 
           addr.toLowerCase().includes('river') || 
           addr.toLowerCase().includes('ocean') ||
           addr.toLowerCase().includes('sea') ||
           addr.toLowerCase().includes('bay') ||
           addr.toLowerCase().includes('pond'))
        ))
      );
      
      // Additional check for water-related features
      const display_name = data.display_name || '';
      const hasWaterKeywords = display_name.toLowerCase().includes('lake') ||
                              display_name.toLowerCase().includes('river') ||
                              display_name.toLowerCase().includes('ocean') ||
                              display_name.toLowerCase().includes('sea') ||
                              display_name.toLowerCase().includes('bay') ||
                              display_name.toLowerCase().includes('pond') ||
                              display_name.toLowerCase().includes('water');
      
      const isValidWater = isWater || hasWaterKeywords;
      
      if (isValidWater) {
        console.log('✅ Valid water body confirmed');
      } else {
        console.log('❌ Location appears to be on land');
      }
      
      return isValidWater;
      
    } catch (error) {
      console.warn('⚠️ Could not validate water body:', error);
      // If validation fails, allow the user to proceed (fallback)
      return true;
    }
  }

  // Check for obviously land-based coordinates (cities, landmarks, etc.)
  isObviouslyLand(lat, lng) {
    // Known land coordinates that should be rejected
    const landLocations = [
      // New York City area
      { lat: 40.7128, lng: -74.0060, radius: 0.5 },
      // Los Angeles area  
      { lat: 34.0522, lng: -118.2437, radius: 0.5 },
      // London area
      { lat: 51.5074, lng: -0.1278, radius: 0.3 },
      // Tokyo area
      { lat: 35.6762, lng: 139.6503, radius: 0.5 },
      // Empire State Building (specific)
      { lat: 40.7484, lng: -73.9857, radius: 0.01 },
    ];

    return landLocations.some(location => {
      const distance = this.calculateDistance(lat, lng, location.lat, location.lng);
      return distance < location.radius;
    });
  }

  // Calculate distance between two coordinates (rough approximation)
  calculateDistance(lat1, lng1, lat2, lng2) {
    const dLat = Math.abs(lat1 - lat2);
    const dLng = Math.abs(lng1 - lng2);
    return Math.sqrt(dLat * dLat + dLng * dLng);
  }

  // Set loading state
  setLoadingState(loading) {
    this.isValidating = loading;
    const submitBtn = this.modal.querySelector('#submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');

    if (loading) {
      submitBtn.disabled = true;
      btnText.innerHTML = '<span class="loading-spinner"></span>Validating...';
    } else {
      btnText.textContent = 'Get Conditions';
      this.updateSubmitButton();
    }
  }

  // Show error message
  showError(error) {
    const errorEl = this.modal.querySelector('#error-message');
    const titleEl = errorEl.querySelector('.error-title');
    const contentEl = errorEl.querySelector('.error-content');

    titleEl.textContent = error.title;
    contentEl.textContent = error.message;
    
    errorEl.classList.add('show');
    
    // Shake the modal for attention
    const modal = this.modal.querySelector('.custom-location-modal');
    modal.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
      modal.style.animation = '';
    }, 500);
  }

  // Hide error message
  hideError() {
    const errorEl = this.modal.querySelector('#error-message');
    errorEl.classList.remove('show');
  }

  // Focus latitude input
  focusLatitudeInput() {
    const latInput = this.modal.querySelector('#latitude-input');
    setTimeout(() => latInput.focus(), 100);
  }

  // Close modal
  close() {
    if (!this.modal) return;

    this.modal.classList.remove('show');
    
    // Remove escape key listener
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
    }

    setTimeout(() => {
      if (this.modal && this.modal.parentNode) {
        this.modal.parentNode.removeChild(this.modal);
      }
      this.modal = null;
    }, 300);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.customLocationModal = new CustomLocationModal();
  window.customLocationModal.init();
  console.log('🎯 Custom Location feature initialized');
});

// Export for global access (available if needed)
window.CustomLocationModal = CustomLocationModal;
