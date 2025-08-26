/* Custom Location Feature - Sleek coordinate input with water body validation */

class CustomLocationModal {
  constructor() {
    this.modal = null;
    this.isValidating = false;
    
    // Cache for nearby water bodies to avoid repeated API calls
    this.nearbyCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes cache
    
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
          <h2><span class="search-icon">🔍</span> Search Water Bodies</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="input-group">
            <div class="location-options">
              <button class="btn btn-location" id="use-current-location">
                <span class="material-icons">my_location</span>
                Use Current Location
              </button>
              <button class="btn-refresh" id="refresh-fields" title="Clear fields">
                <span class="material-icons">refresh</span>
              </button>
            </div>
            
            <!-- Divider between current location and manual entry -->
            <div class="location-divider">
              <span class="divider-line"></span>
              <span class="divider-text">or enter coordinates</span>
              <span class="divider-line"></span>
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
          
          <div class="progress-container" id="progress-container">
            <div class="progress-header">
              <span class="progress-icon">🔍</span>
              <span class="progress-text" id="progress-text">Ready to search</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" id="progress-fill"></div>
            </div>
            <div class="progress-steps" id="progress-steps">
              <div class="step" data-step="1">Validating coordinates</div>
              <div class="step" data-step="2">Searching water bodies</div>
              <div class="step" data-step="3">Getting paddle scores</div>
              <div class="step" data-step="4">Displaying results</div>
            </div>
          </div>
          
          <div class="error-message" id="error-message">
            <div class="error-title"></div>
            <div class="error-content"></div>
          </div>
          
          <!-- Results container for displaying water bodies -->
          <div class="results-container" id="results-container">
            <!-- Results will be populated here -->
          </div>

          <div class="modal-actions">
            <button class="btn btn-cancel" id="cancel-btn">Cancel</button>
            <button class="btn btn-submit" id="submit-btn">
              <span class="btn-text">Search Water Bodies</span>
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
    const resultsContainer = this.modal.querySelector('#results-container');
    const progressContainer = this.modal.querySelector('#progress-container');
    const submitBtn = this.modal.querySelector('#submit-btn');
    
    // Clear inputs
    latInput.value = '';
    lngInput.value = '';
    
    // Hide all message containers
    errorMessage.classList.remove('show');
    progressContainer.classList.remove('show');
    if (resultsContainer) {
      resultsContainer.classList.remove('show');
    }
    
    // Reset button state
    submitBtn.disabled = true;
    submitBtn.classList.remove('loading');
    
    // Reset input validation states
    latInput.classList.remove('error', 'valid', 'invalid');
    lngInput.classList.remove('error', 'valid', 'invalid');
    
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

  // Handle form submission with detailed progress tracking
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

    // Show loading state with progress
    this.setLoadingState(true);
    this.showProgress();

    try {
      // Step 1: Validate coordinates
      this.updateProgress(1, "Validating coordinates...", 25);
      await this.delay(500); // Small delay for UX

      // Step 2: Search for water bodies in the area
      this.updateProgress(2, "Searching nearby water bodies...", 50);
      const waterBodiesData = await this.searchNearbyWaterBodies(lat, lng);
      
      if (!waterBodiesData || !waterBodiesData.waterBodies || waterBodiesData.waterBodies.length === 0) {
        // No water bodies found - show error with suggestions
        this.updateProgress(3, "No water bodies found, searching alternatives...", 75);
        const nearbyLakes = await this.findNearbyLakes(lat, lng);
        
        const randomMessage = this.errorMessages.notWater.messages[
          Math.floor(Math.random() * this.errorMessages.notWater.messages.length)
        ];
        
        this.showErrorWithSuggestions({
          title: "No Water Bodies Found",
          message: randomMessage,
          suggestions: nearbyLakes
        });
        return;
      }

      // Step 3: Get location name and process paddle scores
      this.updateProgress(3, "Getting location name and paddle scores...", 75);
      
      // Get location name asynchronously (don't wait for it)
      const locationNamePromise = this.getLocationDisplayName(lat, lng);
      
      // Process paddle scores
      const waterBodiesWithScores = await this.addPaddleScoresToWaterBodies(waterBodiesData.waterBodies);
      
      // Wait for location name to complete
      const locationName = await locationNamePromise;
      
      // Step 4: Display results
      this.updateProgress(4, "Displaying results...", 100);
      await this.delay(300);

      // Update location data with display name
      const enhancedLocation = {
        ...waterBodiesData.location,
        displayName: locationName
      };

      // Display water bodies results
      this.displayWaterBodiesResults(enhancedLocation, waterBodiesWithScores);

    } catch (error) {
      console.error('Error searching location:', error);
      
      if (error.message.includes('network') || error.message.includes('fetch')) {
        this.showError(this.errorMessages.networkError);
      } else {
        this.showError(this.errorMessages.unknownError);
      }
    } finally {
      this.setLoadingState(false);
      this.hideProgress();
    }
  }

  // Search for nearby water bodies using the API with caching
  async searchNearbyWaterBodies(lat, lng) {
    try {
      // Create cache key based on rounded coordinates (0.01 degree precision ~1km)
      const cacheKey = `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}`;
      
      // Check cache first
      const cached = this.nearbyCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log('🎯 Using cached water bodies data for:', cacheKey);
        return cached.data;
      }
      
      console.log('🔍 Searching for water bodies near:', lat, lng);
      
      const response = await fetch(
        `https://api-vwcc5j4qda-uc.a.run.app/nearbyWater?lat=${lat}&lng=${lng}&radius=80`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 15000
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || !data.success) {
        console.error('❌ Water bodies search failed:', data?.error || 'Unknown error');
        return null;
      }

      // Cache the successful result
      this.nearbyCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
      });
      
      // Clean up old cache entries (keep only last 20)
      if (this.nearbyCache.size > 20) {
        const oldestKey = this.nearbyCache.keys().next().value;
        this.nearbyCache.delete(oldestKey);
      }

      console.log('✅ Found and cached water bodies:', data.waterBodies?.length || 0);
      return data;
      
    } catch (error) {
      console.error('❌ Error searching water bodies:', error);
      throw error;
    }
  }

  // Add paddle scores to water bodies
  async addPaddleScoresToWaterBodies(waterBodies) {
    console.log('🎯 Adding paddle scores to', waterBodies.length, 'water bodies');
    
    const waterBodiesWithScores = await Promise.all(
      waterBodies.map(async (body) => {
        try {
          const paddleScore = await this.getPaddleScoreForLocation(body.lat, body.lng);
          return {
            ...body,
            paddleScore: paddleScore
          };
        } catch (error) {
          console.error(`❌ Error getting paddle score for ${body.name}:`, error);
          return {
            ...body,
            paddleScore: {
              rating: 'ERROR',
              confidence: 0,
              riskLevel: 'unknown',
              error: 'Failed to load'
            }
          };
        }
      })
    );

    console.log('✅ Added paddle scores to all water bodies');
    return waterBodiesWithScores;
  }

  // Display water bodies search results
  displayWaterBodiesResults(location, waterBodies) {
    // Store current search context for potential back navigation
    this.currentSearchLocation = location;
    this.currentWaterBodies = waterBodies;
    
    const progressContainer = this.modal.querySelector('#progress-container');
    const errorContainer = this.modal.querySelector('#error-message');
    
    // Hide progress and error
    progressContainer.classList.remove('show');
    errorContainer.classList.remove('show');
    
    // Create results container
    const resultsContainer = this.modal.querySelector('#results-container') || this.createResultsContainer();
    
    // Set results content
    resultsContainer.innerHTML = this.createResultsHTML(location, waterBodies);
    
    // Show results with staggered animation
    resultsContainer.classList.add('show');
    
    // Add staggered animation to result cards
    setTimeout(() => {
      const resultCards = resultsContainer.querySelectorAll('.result-card');
      resultCards.forEach((card, index) => {
        setTimeout(() => {
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px) scale(0.9)';
          card.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
          
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0) scale(1)';
          }, 50);
        }, index * 100); // Stagger by 100ms
      });
    }, 100);
    
    // Add event listeners to result items
    this.addResultsEventListeners();
    
    console.log('✅ Displayed', waterBodies.length, 'water bodies results with animations');
  }

  // Create results container if it doesn't exist
  createResultsContainer() {
    const modalBody = this.modal.querySelector('.modal-body');
    
    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'results-container';
    resultsContainer.className = 'results-container';
    
    modalBody.appendChild(resultsContainer);
    
    return resultsContainer;
  }

  // Create HTML for results display
  createResultsHTML(location, waterBodies) {
    const locationName = this.formatLocationName(location);
    
    const resultsHeader = `
      <div class="results-header">
        <div class="results-title">
          <span class="results-icon">🏞️</span>
          Water Bodies Near ${locationName}
        </div>
        <div class="results-subtitle">
          Found ${waterBodies.length} water bod${waterBodies.length === 1 ? 'y' : 'ies'} within 50 mile radius
        </div>
      </div>
    `;
    
    const resultsList = waterBodies.map(body => this.createWaterBodyCard(body)).join('');
    
    return `
      ${resultsHeader}
      <div class="results-list">
        ${resultsList}
      </div>
      <div class="results-actions">
        <button class="btn btn-new-search" id="new-search-btn" title="New Search">
          <span class="material-icons">search</span>
          <span class="btn-ripple"></span>
        </button>
      </div>
    `;
  }

  // Format location name for better display
  formatLocationName(location) {
    if (!location) {
      return 'Your Location';
    }
    
    // Use display name if available
    if (location.displayName) {
      return location.displayName;
    }
    
    // Use lat/lng as fallback, but format nicely
    const lat = typeof location.lat === 'number' ? location.lat.toFixed(3) : location.lat;
    const lng = typeof location.lng === 'number' ? location.lng.toFixed(3) : location.lng;
    
    return `${lat}°, ${lng}°`;
  }

  // Enhanced reverse geocoding for better location names
  async getLocationDisplayName(lat, lng) {
    try {
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
      
      if (data && data.display_name && data.address) {
        const address = data.address;
        
        // Construct city, state format
        const city = address.city || address.town || address.village || address.hamlet;
        const state = address.state;
        const country = address.country;
        
        if (city && state && country === 'United States') {
          return `${city}, ${state}`;
        } else if (city && state) {
          return `${city}, ${state}`;
        } else if (city) {
          return city;
        } else if (state) {
          return state;
        }
      }
      
      // Fallback to coordinates
      return `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`;
      
    } catch (error) {
      console.warn('Location name geocoding failed:', error);
      return `${lat.toFixed(3)}°, ${lng.toFixed(3)}°`;
    }
  }

  // Create individual water body card HTML
  createWaterBodyCard(body) {
    const paddleScore = body.paddleScore || {};
    const rating = paddleScore.rating || 'N/A';
    const riskLevel = paddleScore.riskLevel || 'unknown';
    
    // Get paddle score display
    const scoreDisplay = this.getPaddleScoreDisplay(rating);
    const scoreClass = this.getPaddleScoreClass(rating);
    
    // Format distance
    const distance = body.distanceMiles ? `${body.distanceMiles.toFixed(1)} mi` : 'Unknown distance';
    
    return `
      <div class="result-card" data-lat="${body.lat}" data-lng="${body.lng}" data-name="${body.name}">
        <div class="result-main">
          <div class="result-info">
            <div class="result-name">${body.name}</div>
            <div class="result-details">
              <span class="result-type">${body.type}</span>
              <span class="result-distance">${distance}</span>
            </div>
          </div>
          <div class="result-actions">
            <div class="paddle-score-display ${scoreClass}" title="Click for detailed forecast">
              ${scoreDisplay}
            </div>
            <button class="location-btn" data-lat="${body.lat}" data-lng="${body.lng}" title="Open in maps">
              <span class="material-icons">place</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Get paddle score display text
  getPaddleScoreDisplay(rating) {
    if (!rating || rating === null || rating === undefined) {
      return 'N/A';
    }

    // Handle error cases
    if (typeof rating === 'string' && rating !== 'N/A') {
      switch (rating) {
        case 'ERROR':
        case 'API_ERROR':
        case 'NO_DATA':
        case 'API_FAILURE':
        case 'NO_SCORE':
        case 'INVALID_RATING':
        case 'INVALID_RANGE':
          return 'Error';
        default:
          break;
      }
    }

    // Parse numeric rating
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) {
      return 'N/A';
    }

    return numRating.toFixed(1);
  }

  // Get CSS class for paddle score
  getPaddleScoreClass(rating) {
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) {
      return 'score-unknown';
    }

    if (numRating >= 4.5) return 'score-excellent';
    if (numRating >= 4.0) return 'score-great';
    if (numRating >= 3.5) return 'score-good';
    if (numRating >= 3.0) return 'score-moderate';
    if (numRating >= 2.0) return 'score-poor';
    return 'score-dangerous';
  }

  // Add event listeners to results
  addResultsEventListeners() {
    // New search button with enhanced animation
    const newSearchBtn = this.modal.querySelector('#new-search-btn');
    if (newSearchBtn) {
      newSearchBtn.addEventListener('click', (e) => {
        // Add ripple effect
        const ripple = newSearchBtn.querySelector('.btn-ripple');
        ripple.style.animation = 'none';
        ripple.offsetHeight; // Trigger reflow
        ripple.style.animation = null;
        
        // Add button press animation
        newSearchBtn.style.transform = 'translateY(-1px) scale(0.98)';
        setTimeout(() => {
          newSearchBtn.style.transform = '';
        }, 150);
        
        // Execute action after animation
        setTimeout(() => {
          this.hideResults();
          this.refreshFields();
          this.focusLatitudeInput();
        }, 100);
        
        console.log('🔄 Starting new search');
      });
    }

    // Result cards - click to open detailed forecast
    const resultCards = this.modal.querySelectorAll('.result-card');
    resultCards.forEach(card => {
      card.addEventListener('click', async (e) => {
        // Don't trigger if clicking on location button
        if (e.target.closest('.location-btn')) return;
        
        const lat = parseFloat(card.dataset.lat);
        const lng = parseFloat(card.dataset.lng);
        const name = card.dataset.name;
        
        // Store the current search context for back navigation
        const searchContext = {
          location: this.currentSearchLocation,
          waterBodies: this.currentWaterBodies,
          timestamp: Date.now()
        };
        
        // Close current modal
        this.close();
        
        // Open advanced modal with selected water body
        const spot = {
          title: name,
          subtitle: `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`,
          location: { latitude: lat, longitude: lng },
          isCustom: true,
          customName: name,
          searchContext: searchContext // Pass context for back navigation
        };

        if (window.advancedModal) {
          await window.advancedModal.open(spot);
        } else {
          console.error('Advanced modal not available');
        }
      });
    });

    // Location buttons - open in maps
    const locationBtns = this.modal.querySelectorAll('.location-btn');
    locationBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        
        // Open in default maps app
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        window.open(mapsUrl, '_blank');
        
        console.log('📍 Opened maps for:', lat, lng);
      });
    });
  }

  // Hide results container
  hideResults() {
    const resultsContainer = this.modal.querySelector('#results-container');
    if (resultsContainer) {
      resultsContainer.classList.remove('show');
    }
  }

  // Restore previous search results (for back navigation)
  restoreSearchResults(searchContext) {
    if (!searchContext || !searchContext.location || !searchContext.waterBodies) {
      console.warn('Invalid search context for restoration');
      return false;
    }
    
    // Check if context is not too old (within 30 minutes)
    const maxAge = 30 * 60 * 1000; // 30 minutes
    if (Date.now() - searchContext.timestamp > maxAge) {
      console.warn('Search context too old, not restoring');
      return false;
    }
    
    console.log('🔙 Restoring previous search results');
    
    // Open the modal first
    this.open();
    
    // Wait for modal to be ready, then restore input values and display results
    setTimeout(() => {
      // Restore input values if available
      if (searchContext.location.coordinates) {
        const latInput = this.modal.querySelector('#latitude-input');
        const lngInput = this.modal.querySelector('#longitude-input');
        if (latInput && lngInput) {
          latInput.value = searchContext.location.coordinates.latitude.toFixed(6);
          lngInput.value = searchContext.location.coordinates.longitude.toFixed(6);
          // Trigger validation
          this.validateInput(latInput, 'latitude');
          this.validateInput(lngInput, 'longitude');
        }
      }
      
      // Restore cached search location and water bodies
      this.currentSearchLocation = searchContext.location;
      this.currentWaterBodies = searchContext.waterBodies;
      
      // Display the results
      this.displayWaterBodiesResults(searchContext.location, searchContext.waterBodies);
    }, 100);
    
    return true;
  }

  // Show progress container
  showProgress() {
    const progressContainer = this.modal.querySelector('#progress-container');
    const errorMessage = this.modal.querySelector('#error-message');
    
    progressContainer.classList.add('show');
    errorMessage.classList.remove('show');
    
    // Reset progress
    this.updateProgress(0, "Starting search...", 0);
  }

  // Hide progress container
  hideProgress() {
    const progressContainer = this.modal.querySelector('#progress-container');
    progressContainer.classList.remove('show');
  }

  // Update progress indicator
  updateProgress(step, message, percentage) {
    const progressText = this.modal.querySelector('#progress-text');
    const progressFill = this.modal.querySelector('#progress-fill');
    const steps = this.modal.querySelectorAll('.step');
    
    // Update progress text
    progressText.textContent = message;
    
    // Update progress bar
    progressFill.style.width = `${percentage}%`;
    
    // Update step indicators
    steps.forEach((stepEl, index) => {
      stepEl.classList.remove('active', 'completed');
      
      if (index + 1 < step) {
        stepEl.classList.add('completed');
      } else if (index + 1 === step) {
        stepEl.classList.add('active');
      }
    });
  }

  // Utility delay function
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

  // Find nearby lakes for suggestions when location is not suitable - ENHANCED DATA QUALITY
  async findNearbyLakes(lat, lng) {
    try {
      console.log('🔍 Finding HIGH-QUALITY nearby lakes for:', lat, lng);
      
      // Validate input coordinates
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.error('❌ Invalid coordinates provided:', lat, lng);
        return [];
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.error('❌ Coordinates out of valid range:', lat, lng);
        return [];
      }
      
      // Use our backend API to find nearby water bodies with extended radius for better results
      const response = await fetch(
        `https://api-vwcc5j4qda-uc.a.run.app/nearbyWater?lat=${lat}&lng=${lng}&radius=80`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 15000 // 15 second timeout for this important call
        }
      );

      if (!response.ok) {
        console.error(`❌ Nearby water API failed: ${response.status} ${response.statusText}`);
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Enhanced data validation
      if (!data) {
        console.error('❌ Empty response from nearby water API');
        return [];
      }

      if (!data.success) {
        console.error('❌ Nearby water API returned failure:', data.error || 'Unknown error');
        return [];
      }

      if (!data.waterBodies || !Array.isArray(data.waterBodies) || data.waterBodies.length === 0) {
        console.log('ℹ️ No nearby water bodies found in API response');
        return [];
      }

      // Filter and validate water bodies data quality
      const validWaterBodies = data.waterBodies.filter(body => {
        // Ensure required fields exist and are valid
        if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
          console.warn('⚠️ Skipping water body with invalid name:', body);
          return false;
        }

        if (!body.type || typeof body.type !== 'string' || body.type.trim() === '') {
          console.warn('⚠️ Skipping water body with invalid type:', body);
          return false;
        }

        if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
          console.warn('⚠️ Skipping water body with invalid coordinates:', body);
          return false;
        }

        if (body.lat < -90 || body.lat > 90 || body.lng < -180 || body.lng > 180) {
          console.warn('⚠️ Skipping water body with coordinates out of range:', body);
          return false;
        }

        if (typeof body.distanceMiles !== 'number' || body.distanceMiles < 0 || body.distanceMiles > 1000) {
          console.warn('⚠️ Skipping water body with invalid distance:', body);
          return false;
        }

        return true;
      });

      console.log(`✅ Found ${validWaterBodies.length} valid water bodies out of ${data.waterBodies.length} total`);

      // Sort by distance and take top 5 only
      const sortedBodies = validWaterBodies
        .sort((a, b) => a.distanceMiles - b.distanceMiles)
        .slice(0, 5);

      console.log('🎯 Processing top 5 water bodies for paddle scores...');

      // Get paddle scores with enhanced error handling and quality validation
      const nearbyWaterBodies = await Promise.all(
        sortedBodies.map(async (body, index) => {
          console.log(`📊 Processing ${index + 1}/5: ${body.name}...`);
          
          try {
            // Get paddle score for each lake with timeout protection
            const paddleScorePromise = this.getPaddleScoreForLocation(body.lat, body.lng);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Paddle score timeout')), 8000)
            );
            
            const paddleScore = await Promise.race([paddleScorePromise, timeoutPromise]);
            
            const waterBodyData = {
              name: body.name.trim(),
              type: body.type.trim(),
              distance: Math.round(body.distanceMiles * 100) / 100, // Round to 2 decimal places
              lat: Math.round(body.lat * 1000000) / 1000000, // Round to 6 decimal places
              lng: Math.round(body.lng * 1000000) / 1000000,
              paddleScore: paddleScore,
              subtitle: `${body.type.trim()} • ${Math.round(body.distanceMiles)} miles away`,
              coordinates: `${body.lat.toFixed(4)}°, ${body.lng.toFixed(4)}°`,
              dataQuality: paddleScore?.dataQuality || 'UNKNOWN'
            };

            // Log paddle score quality
            if (paddleScore?.rating && !paddleScore.error) {
              const quality = paddleScore.mlModelUsed ? 'ML-POWERED' : 'STANDARD';
              console.log(`✅ ${body.name}: Score ${paddleScore.rating} (${quality})`);
            } else {
              console.warn(`⚠️ ${body.name}: Score error - ${paddleScore?.error || 'Unknown'}`);
            }

            return waterBodyData;

          } catch (error) {
            console.error(`❌ Error processing ${body.name}:`, error);
            
            // Return partial data even if paddle score fails
            return {
              name: body.name.trim(),
              type: body.type.trim(),
              distance: Math.round(body.distanceMiles * 100) / 100,
              lat: Math.round(body.lat * 1000000) / 1000000,
              lng: Math.round(body.lng * 1000000) / 1000000,
              paddleScore: {
                rating: 'ERROR',
                confidence: 0,
                riskLevel: 'unknown',
                error: error.message || 'Processing failed',
                dataQuality: 'FAILED'
              },
              subtitle: `${body.type.trim()} • ${Math.round(body.distanceMiles)} miles away`,
              coordinates: `${body.lat.toFixed(4)}°, ${body.lng.toFixed(4)}°`,
              dataQuality: 'PARTIAL'
            };
          }
        })
      );

      // Final data quality report
      const highQualityCount = nearbyWaterBodies.filter(w => w.dataQuality === 'HIGH').length;
      const partialQualityCount = nearbyWaterBodies.filter(w => w.dataQuality === 'PARTIAL').length;
      const failedCount = nearbyWaterBodies.filter(w => w.dataQuality === 'FAILED').length;

      console.log(`📈 DATA QUALITY REPORT: ${highQualityCount} HIGH, ${partialQualityCount} PARTIAL, ${failedCount} FAILED`);
      
      return nearbyWaterBodies;
      
    } catch (error) {
      console.error('❌ CRITICAL ERROR in findNearbyLakes:', error);
      return [];
    }
  }

  // Get paddle score for a specific location with enhanced data quality validation
  async getPaddleScoreForLocation(lat, lng) {
    try {
      // Validate coordinates first
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.error('Invalid coordinates provided for paddle score:', lat, lng);
        return null;
      }

      // Ensure coordinates are within valid ranges
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.error('Coordinates out of valid range:', lat, lng);
        return null;
      }

      console.log(`🎯 Fetching high-quality paddle score for: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      
      const response = await fetch(
        `https://us-central1-kaaykostore.cloudfunctions.net/api/paddleScore?lat=${lat}&lng=${lng}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          timeout: 10000 // 10 second timeout
        }
      );

      if (!response.ok) {
        console.error(`❌ Paddle score API failed for ${lat}, ${lng}: ${response.status} ${response.statusText}`);
        return {
          rating: 'API_ERROR',
          confidence: 0,
          riskLevel: 'unknown',
          error: `API Error: ${response.status}`
        };
      }

      const data = await response.json();
      
      // Enhanced data validation
      if (!data) {
        console.error('❌ Empty response from paddle score API');
        return {
          rating: 'NO_DATA',
          confidence: 0,
          riskLevel: 'unknown',
          error: 'Empty response'
        };
      }

      if (!data.success) {
        console.error('❌ API returned failure:', data.error || 'Unknown error');
        return {
          rating: 'API_FAILURE',
          confidence: 0,
          riskLevel: 'unknown',
          error: data.error || 'API returned failure'
        };
      }

      if (!data.paddleScore) {
        console.error('❌ No paddle score data in response');
        return {
          rating: 'NO_SCORE',
          confidence: 0,
          riskLevel: 'unknown',
          error: 'No paddle score in response'
        };
      }

      const paddleScore = data.paddleScore;
      
      // Validate paddle score data quality
      if (!paddleScore.rating || paddleScore.rating === null || paddleScore.rating === undefined) {
        console.error('❌ Invalid rating in paddle score:', paddleScore);
        return {
          rating: 'INVALID_RATING',
          confidence: paddleScore.confidence || 0,
          riskLevel: 'unknown',
          error: 'Invalid rating data'
        };
      }

      // Ensure rating is a valid number between 0-10
      const numericRating = parseFloat(paddleScore.rating);
      if (isNaN(numericRating) || numericRating < 0 || numericRating > 10) {
        console.error('❌ Rating out of valid range (0-10):', paddleScore.rating);
        return {
          rating: 'INVALID_RANGE',
          confidence: paddleScore.confidence || 0,
          riskLevel: 'unknown',
          error: 'Rating out of valid range'
        };
      }

      // Validate confidence score
      const confidence = paddleScore.confidence || 0;
      if (confidence < 0 || confidence > 1) {
        console.warn('⚠️ Confidence score out of range (0-1):', confidence);
      }

      // Validate risk level
      const validRiskLevels = ['excellent', 'good', 'moderate', 'poor', 'risky'];
      const riskLevel = paddleScore.riskLevel || 'unknown';
      if (!validRiskLevels.includes(riskLevel) && riskLevel !== 'unknown') {
        console.warn('⚠️ Invalid risk level:', riskLevel);
      }

      // Check if ML model was used for higher quality data
      const mlModelUsed = data.mlModelUsed || false;
      
      console.log(`✅ High-quality paddle score obtained:`, {
        rating: numericRating,
        confidence: confidence,
        riskLevel: riskLevel,
        mlModelUsed: mlModelUsed
      });

      return {
        rating: numericRating.toString(),
        confidence: confidence,
        riskLevel: riskLevel,
        mlModelUsed: mlModelUsed,
        dataQuality: 'HIGH'
      };
      
    } catch (error) {
      console.error(`❌ Critical error getting paddle score for ${lat}, ${lng}:`, error);
      return {
        rating: 'ERROR',
        confidence: 0,
        riskLevel: 'unknown',
        error: error.message || 'Network error',
        dataQuality: 'FAILED'
      };
    }
  }

  // Calculate distance in miles between two coordinates (for backup/validation)
  calculateDistanceInMiles(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI/180);
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
      btnText.innerHTML = '<span class="loading-spinner"></span>Searching...';
    } else {
      btnText.textContent = 'Search Water Bodies';
      this.updateSubmitButton();
    }
  }

  // Show error message with nearby lake suggestions
  showErrorWithSuggestions(error) {
    const errorEl = this.modal.querySelector('#error-message');
    const titleEl = errorEl.querySelector('.error-title');
    const contentEl = errorEl.querySelector('.error-content');
    const progressContainer = this.modal.querySelector('#progress-container');

    // Hide progress and show error
    progressContainer.classList.remove('show');

    titleEl.textContent = error.title;
    
    // Create enhanced error content with interactive suggestions
    if (error.suggestions && error.suggestions.length > 0) {
      // Clear existing content
      contentEl.innerHTML = '';
      contentEl.style.whiteSpace = 'normal';
      
      // Create message text
      const messageText = document.createElement('div');
      messageText.className = 'error-main-message';
      messageText.textContent = error.message;
      contentEl.appendChild(messageText);
      
      // Create suggestions header
      const suggestionsHeader = document.createElement('div');
      suggestionsHeader.className = 'suggestions-header';
      suggestionsHeader.innerHTML = '🏞️ Try these nearby water bodies instead:';
      contentEl.appendChild(suggestionsHeader);
      
      // Create suggestions list
      const suggestionsList = document.createElement('div');
      suggestionsList.className = 'suggestions-list';
      
      error.suggestions.forEach((suggestion, index) => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        
        const distance = Math.round(suggestion.distance);
        const paddleScore = suggestion.paddleScore;
        
        // Enhanced paddle score display with data quality
        let paddleDisplay = 'Loading...';
        let riskLevel = 'unknown';
        let dataQualityIndicator = '';
        
        if (paddleScore) {
          if (paddleScore.error) {
            paddleDisplay = paddleScore.error;
            riskLevel = 'error';
          } else if (paddleScore.rating) {
            paddleDisplay = paddleScore.rating;
            riskLevel = paddleScore.riskLevel || 'unknown';
            
            // Add data quality indicator
            if (paddleScore.mlModelUsed) {
              dataQualityIndicator = ' 🤖'; // ML model used
            } else if (paddleScore.dataQuality === 'HIGH') {
              dataQualityIndicator = ' ✅'; // High quality
            } else if (paddleScore.dataQuality === 'PARTIAL') {
              dataQualityIndicator = ' ⚠️'; // Partial data
            } else if (paddleScore.dataQuality === 'FAILED') {
              dataQualityIndicator = ' ❌'; // Failed data
            }
          }
        }
        
        suggestionItem.innerHTML = `
          <div class="suggestion-content">
            <div class="suggestion-main">
              <span class="suggestion-name" data-lat="${suggestion.lat}" data-lng="${suggestion.lng}" data-name="${suggestion.name}">
                ${suggestion.name}
              </span>
              <button class="location-coordinates-btn" 
                      data-lat="${suggestion.lat}" 
                      data-lng="${suggestion.lng}"
                      title="Use these coordinates: ${suggestion.coordinates}">
                📍
              </button>
            </div>
            <div class="suggestion-details">
              <span class="suggestion-type">${suggestion.type}</span>
              <span class="suggestion-distance">${distance} miles away</span>
              <span class="paddle-score-indicator ${riskLevel}" title="Paddle Score: ${paddleDisplay}${dataQualityIndicator}">
                ${this.getPaddleScoreIcon(paddleDisplay)}${dataQualityIndicator}
              </span>
            </div>
          </div>
        `;
        
        suggestionsList.appendChild(suggestionItem);
      });
      
      contentEl.appendChild(suggestionsList);
      
      // Add click event listeners for suggestions and location buttons
      this.addSuggestionEventListeners();
      
    } else {
      contentEl.style.whiteSpace = 'pre-line';
      contentEl.textContent = error.message + '\n\nNo nearby water bodies found. Try coordinates closer to a lake or river.';
    }
    
    errorEl.classList.add('show');
    
    // Shake the modal for attention
    const modal = this.modal.querySelector('.custom-location-modal');
    modal.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
      modal.style.animation = '';
    }, 500);
  }

  // Get paddle score icon based on rating with data quality indicators
  getPaddleScoreIcon(rating) {
    if (!rating || rating === null || rating === undefined) {
      return '❓ N/A';
    }

    // Handle error cases
    if (typeof rating === 'string') {
      switch (rating) {
        case 'Loading...':
          return '⏳ Loading';
        case 'API_ERROR':
          return '⚠️ API Error';
        case 'NO_DATA':
          return '❌ No Data';
        case 'API_FAILURE':
          return '❌ Failed';
        case 'NO_SCORE':
          return '❓ No Score';
        case 'INVALID_RATING':
          return '⚠️ Invalid';
        case 'INVALID_RANGE':
          return '⚠️ Range Error';
        case 'ERROR':
          return '❌ Error';
        default:
          // Try to parse as number
          break;
      }
    }

    // Parse numeric rating
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) {
      return '❓ Invalid';
    }

    // Return appropriate icon based on rating with enhanced precision
    if (numRating >= 9) return '🟢 Excellent'; // 9-10
    if (numRating >= 7) return '� Great';     // 7-8.99
    if (numRating >= 6) return '🟡 Good';      // 6-6.99
    if (numRating >= 4) return '🟠 Moderate';  // 4-5.99
    if (numRating >= 2) return '🔴 Poor';      // 2-3.99
    return '🔴 Dangerous'; // 0-1.99
  }

  // Add event listeners for suggestion interactions
  addSuggestionEventListeners() {
    const suggestionNames = this.modal.querySelectorAll('.suggestion-name');
    const locationBtns = this.modal.querySelectorAll('.location-coordinates-btn');
    
    // Click on lake name to get conditions
    suggestionNames.forEach(nameEl => {
      nameEl.style.cursor = 'pointer';
      nameEl.style.textDecoration = 'underline';
      nameEl.style.color = '#66ccff';
      
      nameEl.addEventListener('click', async () => {
        const lat = parseFloat(nameEl.dataset.lat);
        const lng = parseFloat(nameEl.dataset.lng);
        const name = nameEl.dataset.name;
        
        // Close current modal
        this.close();
        
        // Open advanced modal with selected lake
        const spot = {
          title: name,
          subtitle: `${lat.toFixed(6)}°, ${lng.toFixed(6)}°`,
          location: { latitude: lat, longitude: lng },
          isCustom: true,
          customName: name
        };

        if (window.advancedModal) {
          await window.advancedModal.open(spot);
        } else {
          console.error('Advanced modal not available');
        }
      });
    });
    
    // Click on location button to use coordinates
    locationBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering name click
        
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        
        // Fill coordinates into input fields
        const latInput = this.modal.querySelector('#latitude-input');
        const lngInput = this.modal.querySelector('#longitude-input');
        
        latInput.value = lat.toFixed(6);
        lngInput.value = lng.toFixed(6);
        
        // Trigger validation
        this.validateInput(latInput, 'latitude');
        this.validateInput(lngInput, 'longitude');
        
        // Hide error and show success feedback
        this.hideError();
        
        // Show brief success message
        btn.textContent = '✓';
        btn.style.background = '#4CAF50';
        btn.style.color = 'white';
        
        setTimeout(() => {
          btn.textContent = '📍';
          btn.style.background = '';
          btn.style.color = '';
        }, 1000);
        
        console.log('📍 Coordinates filled:', lat.toFixed(6), lng.toFixed(6));
      });
    });
  }

  // Show error message (original method)
  showError(error) {
    const errorEl = this.modal.querySelector('#error-message');
    const titleEl = errorEl.querySelector('.error-title');
    const contentEl = errorEl.querySelector('.error-content');
    const progressContainer = this.modal.querySelector('#progress-container');

    // Hide progress and show error
    progressContainer.classList.remove('show');

    titleEl.textContent = error.title;
    contentEl.textContent = error.message;
    contentEl.style.whiteSpace = 'normal';
    
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
