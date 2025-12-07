/* Clean Custom Location Modal - 300 lines max */

class CustomLocationModal {
  constructor() {
    this.modal = null;
    this.isSearching = false;
    this.lastSearchResults = null; // Store last search for back navigation
    this.waveLoader = null; // Wave loader elements
    this.init();
  }

  init() {
    // Add event listener to header button
    document.querySelector('.custom-location-btn')?.addEventListener('click', () => this.open());
    
    // Keyboard shortcut: Ctrl/Cmd + L
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        this.open();
      }
    });
  }

  open() {
    if (this.modal) return;
    
    this.modal = this.createModal();
    document.body.appendChild(this.modal);
    this.attachEvents();
    
    requestAnimationFrame(() => {
      this.modal.classList.add('show');
      this.modal.querySelector('#latitude-input')?.focus();
    });
  }

  close() {
    if (!this.modal) return;
    
    // Cancel any active searches
    this.isSearching = false;
    
    // Clean up wave loader
    if (this.waveLoaderFillInterval) {
      clearInterval(this.waveLoaderFillInterval);
      this.waveLoaderFillInterval = null;
    }
    
    // Hide and reset loader if it exists
    const loader = this.modal.querySelector('#search-bar-loader');
    if (loader) {
      loader.style.display = 'none';
    }
    
    // Clear wave loader references
    this.waveLoader = null;
    
    this.modal.classList.remove('show');
    setTimeout(() => {
      this.modal?.remove();
      this.modal = null;
    }, 300);
  }

  createModal() {
    const div = document.createElement('div');
    div.className = 'custom-location-overlay';
    div.innerHTML = `
      <div class="custom-location-modal">
        <button class="modal-close">&times;</button>
        
        <div class="modal-header">
          <div class="header-icon"><span class="material-icons">explore</span></div>
          <h2>Discover Water Bodies</h2>
          <p>Find paddle-worthy lakes, rivers, and reservoirs</p>
        </div>
        
        <div class="modal-body">
          <button class="btn-current-location" id="current-location-btn">
            <span class="material-icons">my_location</span>
            Use My Current Location
          </button>
          
          <div class="divider"><span>or enter coordinates</span></div>
          
          <div class="coords-grid">
            <div>
              <label><span class="material-icons">north</span> Latitude</label>
              <input type="number" id="latitude-input" placeholder="33.1486" step="any" min="-90" max="90">
            </div>
            <div>
              <label><span class="material-icons">east</span> Longitude</label>
              <input type="number" id="longitude-input" placeholder="-96.7004" step="any" min="-180" max="180">
            </div>
          </div>
          
        <div id="search-bar-loader" class="search-bar-loader" style="display:none;">
          <div class="search-bar-inner">
            <svg class="wave-svg" viewBox="0 0 1000 100" preserveAspectRatio="none">
              <defs>
                <!-- Outer pill shape clip -->
                <clipPath id="bar-clip">
                  <rect x="0" y="0" width="1000" height="100" rx="50" ry="50" />
                </clipPath>

                <!-- Horizontal progress clip (width will be driven by JS) -->
                <clipPath id="progress-clip">
                  <rect id="progress-rect" x="0" y="0" width="0" height="100" />
                </clipPath>
              </defs>

              <!-- We first clip everything to the pill bar -->
              <g clip-path="url(#bar-clip)">
                <!-- Optional dark water background so "empty" area looks like glass -->
                <rect x="0" y="0" width="1000" height="100"
                      fill="rgba(10,20,30,0.9)" />

                <!-- Actual liquid lives inside progress-clip, so it fills left→right -->
                <g clip-path="url(#progress-clip)" class="wave-group">
                  <path class="wave wave-back" d=""></path>
                  <path class="wave wave-front" d=""></path>
                </g>
              </g>
            </svg>

            <div class="search-bar-label">Searching...</div>
          </div>
        </div>          <div class="error-msg" id="error-msg" style="display:none;"></div>
          <div class="results" id="results"></div>
          
          <div class="actions">
            <button class="btn-secondary" id="cancel-btn">Cancel</button>
            <button class="btn-primary" id="search-btn">
              <span class="material-icons">search</span>
              Search
            </button>
          </div>
        </div>
      </div>
    `;
    return div;
  }

  attachEvents() {
    // Use event delegation for all clicks
    this.modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-close')) {
        this.close();
      } else if (e.target.id === 'cancel-btn') {
        this.close();
      } else if (e.target.id === 'search-btn' || e.target.closest('#search-btn')) {
        this.search();
      } else if (e.target.id === 'current-location-btn' || e.target.closest('#current-location-btn')) {
        this.useCurrentLocation();
      } else if (e.target.classList.contains('custom-location-overlay')) {
        this.close();
      }
    });
    
    // Enter key to search
    this.modal.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && (e.target.id === 'latitude-input' || e.target.id === 'longitude-input')) {
        this.search();
      }
    });
  }

  async useCurrentLocation() {
    const btn = this.modal.querySelector('#current-location-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons spin">autorenew</span> Getting location...';
    
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      
      this.modal.querySelector('#latitude-input').value = lat;
      this.modal.querySelector('#longitude-input').value = lng;
      
      // Auto-search
      setTimeout(() => this.search(), 500);
    } catch (err) {
      this.showError('Unable to get your location. Please enter coordinates manually.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span class="material-icons">my_location</span> Use My Current Location';
    }
  }

  async search() {
    if (this.isSearching) return;
    
    const lat = parseFloat(this.modal.querySelector('#latitude-input').value);
    const lng = parseFloat(this.modal.querySelector('#longitude-input').value);
    
    if (!this.validateCoords(lat, lng)) return;
    
    this.isSearching = true;
    this.showProgress();
    this.hideError();
    
    try {
      const response = await fetch(
        `https://api-vwcc5j4qda-uc.a.run.app/nearbyWater?lat=${lat}&lng=${lng}&radius=50`
      );
      
      if (!response.ok) throw new Error('API request failed');
      
      const data = await response.json();
      
      if (!data.success || !data.waterBodies?.length) {
        this.showError('No water bodies found nearby. Try different coordinates.');
        return;
      }
      
      await this.displayResults(data.waterBodies, lat, lng);
    } catch (err) {
      this.showError('Failed to search. Please try again.');
      console.error('Search error:', err);
    } finally {
      this.isSearching = false;
      this.hideProgress();
    }
  }

  validateCoords(lat, lng) {
    if (isNaN(lat) || lat < -90 || lat > 90) {
      this.showError('Latitude must be between -90 and 90');
      return false;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      this.showError('Longitude must be between -180 and 180');
      return false;
    }
    return true;
  }

  async displayResults(bodies, searchLat, searchLng) {
    const results = this.modal.querySelector('#results');
    results.innerHTML = `
      <div class="results-header">
        <span class="material-icons">water</span>
        Found ${bodies.length} water bodies near ${searchLat.toFixed(2)}, ${searchLng.toFixed(2)}
      </div>
    `;
    
    // Get paddle scores in parallel
    const withScores = await Promise.all(
      bodies.slice(0, 10).map(async (body) => {
        const score = await this.getPaddleScore(body.lat, body.lng);
        return { ...body, score };
      })
    );
    
    // Store search results for back navigation
    this.lastSearchResults = {
      bodies: withScores,
      searchLat,
      searchLng
    };
    
    withScores.forEach(body => {
      const card = document.createElement('div');
      card.className = 'water-body-card';
      card.innerHTML = `
        <div class="body-info">
          <h3>${body.name}</h3>
          <p>${body.type} • ${body.distanceMiles} mi away</p>
        </div>
        <div class="body-score ${this.getScoreClass(body.score)}" title="Paddle Score (1-5)">
          ${body.score || '—'}
        </div>
        <div class="body-actions">
          <button class="btn-icon btn-map" data-lat="${body.lat}" data-lng="${body.lng}" title="Open in Maps">
            <span class="material-icons">place</span>
          </button>
          <button class="btn-icon btn-forecast" data-lat="${body.lat}" data-lng="${body.lng}" title="View Forecast">
            <span class="material-icons">visibility</span>
          </button>
        </div>
      `;
      
      // Map button - open in Google Maps
      card.querySelector('.btn-map').onclick = (e) => {
        e.stopPropagation();
        window.open(`https://www.google.com/maps/search/?api=1&query=${body.lat},${body.lng}`, '_blank');
      };
      
      // Forecast button
      card.querySelector('.btn-forecast').onclick = (e) => {
        e.stopPropagation();
        this.openForecast(body);
      };
      
      // Click anywhere on card to open forecast
      card.onclick = () => this.openForecast(body);
      
      results.appendChild(card);
    });
  }

  async getPaddleScore(lat, lng) {
    try {
      const res = await fetch(
        `https://us-central1-kaaykostore.cloudfunctions.net/api/paddleScore?lat=${lat}&lng=${lng}`,
        { timeout: 5000 }
      );
      if (!res.ok) {
        console.warn(`Paddle score API returned ${res.status} for ${lat},${lng}`);
        return null;
      }
      const data = await res.json();
      
      // Extract score from the correct path
      const score = data.paddleScore?.rating || data.paddleScore || data.data?.paddleScore?.rating || data.score;
      
      if (score === null || score === undefined || isNaN(score)) {
        console.warn(`❌ No valid score for ${lat},${lng}`);
        return null;
      }
      
      const numScore = Number(score);
      console.log(`✅ Paddle score for ${lat},${lng}: ${numScore.toFixed(1)}`);
      return numScore.toFixed(1);
    } catch (err) {
      console.warn(`Failed to get paddle score for ${lat},${lng}:`, err.message);
      return null;
    }
  }

  getScoreClass(score) {
    if (!score || score === 'null' || score === '...') return 'score-unknown';
    const numScore = parseFloat(score);
    if (numScore >= 4) return 'score-good';
    if (numScore >= 2.5) return 'score-ok';
    return 'score-bad';
  }

  openForecast(body) {
    // Use existing advancedModal to show forecast with correct data structure
    if (window.advancedModal) {
      window.advancedModal.open({
        title: body.name,
        subtitle: `${body.type} • ${body.distanceMiles} mi away`,
        location: {
          latitude: parseFloat(body.lat),
          longitude: parseFloat(body.lng)
        },
        searchContext: this.lastSearchResults // Pass search context for back button
      });
      this.close();
    } else {
      console.error('advancedModal not found - is advancedModal.js loaded?');
      this.showError('Unable to open forecast. Please try again.');
    }
  }

  restoreSearchResults(searchContext) {
    // Reopen modal with previous search results
    if (!searchContext || !searchContext.bodies) {
      console.warn('No search context to restore');
      return;
    }
    
    this.open();
    
    // Wait for modal to be added to DOM
    setTimeout(() => {
      const results = this.modal.querySelector('#results');
      if (!results) return;
      
      results.innerHTML = `
        <div class="results-header">
          <span class="material-icons">water</span>
          Found ${searchContext.bodies.length} water bodies near ${searchContext.searchLat.toFixed(2)}, ${searchContext.searchLng.toFixed(2)}
        </div>
      `;
      
      // Restore each card
      searchContext.bodies.forEach(body => {
        const card = document.createElement('div');
        card.className = 'water-body-card';
        card.innerHTML = `
          <div class="body-info">
            <h3>${body.name}</h3>
            <p>${body.type} • ${body.distanceMiles} mi away</p>
          </div>
          <div class="body-score ${this.getScoreClass(body.score)}" title="Paddle Score (1-5)">
            ${body.score || '—'}
          </div>
          <div class="body-actions">
            <button class="btn-icon btn-map" data-lat="${body.lat}" data-lng="${body.lng}" title="Open in Maps">
              <span class="material-icons">place</span>
            </button>
            <button class="btn-icon btn-forecast" data-lat="${body.lat}" data-lng="${body.lng}" title="View Forecast">
              <span class="material-icons">visibility</span>
            </button>
          </div>
        `;
        
        // Map button
        card.querySelector('.btn-map').onclick = (e) => {
          e.stopPropagation();
          window.open(`https://www.google.com/maps/search/?api=1&query=${body.lat},${body.lng}`, '_blank');
        };
        
        // Forecast button
        card.querySelector('.btn-forecast').onclick = (e) => {
          e.stopPropagation();
          this.openForecast(body);
        };
        
        // Click anywhere on card
        card.onclick = () => this.openForecast(body);
        
        results.appendChild(card);
      });
      
      // Restore the stored search context
      this.lastSearchResults = searchContext;
    }, 100);
  }

  initWaveLoader() {
    const loader = this.modal.querySelector('#search-bar-loader');
    if (!loader) {
      console.error('initWaveLoader: #search-bar-loader not found');
      return;
    }

    // Check if we already have a valid loader pointing to current DOM
    if (this.waveLoader && this.waveLoader.loader === loader) {
      console.log('Wave loader already initialized for current modal');
      return;
    }

    const svg = loader.querySelector('.wave-svg');
    const waveGroup = loader.querySelector('.wave-group');
    const waveFront = loader.querySelector('.wave-front');
    const waveBack = loader.querySelector('.wave-back');
    const progressRect = loader.querySelector('#progress-rect');

    console.log('Wave elements:', { svg: !!svg, waveGroup: !!waveGroup, waveFront: !!waveFront, waveBack: !!waveBack, progressRect: !!progressRect });

    if (!svg || !waveGroup || !waveFront || !waveBack || !progressRect) {
      console.error('initWaveLoader: Missing required elements');
      return;
    }

    // Store references for later
    this.waveLoader = {
      svg,
      waveGroup,
      waveFront,
      waveBack,
      progressRect,
      loader,
      currentProgress: 0
    };

    // Generate wave paths once, based on the viewBox (1000 x 100)
    const viewWidth = 1000;
    const viewHeight = 100;

    const backPath = this.generateWavePath(viewWidth * 2, viewHeight, 2.5, 10);
    const frontPath = this.generateWavePath(viewWidth * 2, viewHeight, 3.5, 16);

    waveBack.setAttribute('d', backPath);
    waveFront.setAttribute('d', frontPath);

    // Ensure starting state is empty (width 0)
    this.setWaveProgress(0);
  }

  generateWavePath(width, height, frequency, amplitude) {
    const points = [];
    const step = 10;

    // Place the wave line closer to the top so it looks like a liquid surface,
    // and fill the shape downwards to the bottom.
    const baseLine = height * 0.3; // 30% down from the top

    for (let x = 0; x <= width; x += step) {
      const theta = (x / width) * Math.PI * frequency;
      const y = baseLine + Math.sin(theta) * amplitude;
      points.push(`${x},${y}`);
    }

    // Build a closed path: left bottom → up to wave → across → right bottom → close
    const first = points[0].split(',');
    const startY = first[1];

    return [
      `M 0,${height}`,                   // start at bottom-left
      `L 0,${startY}`,                  // up to first wave point
      points.map(p => `L ${p}`).join(' '), // wave line
      `L ${width},${height}`,           // down to bottom-right
      'Z'
    ].join(' ');
  }

  setWaveProgress(percent) {
    if (!this.waveLoader) {
      console.warn('setWaveProgress called but waveLoader not initialized');
      return;
    }

    // Clamp 0–100
    const progress = Math.max(0, Math.min(100, percent));

    const { progressRect } = this.waveLoader;
    const maxWidth = 1000; // matches viewBox width

    // Map progress to horizontal width of the clip rect
    // 0% => width 0 (no water visible)
    // 100% => width 1000 (full bar filled)
    const width = (progress / 100) * maxWidth;
    progressRect.setAttribute('width', width);

    this.waveLoader.currentProgress = progress;
    console.log(`Wave progress: ${progress}% (width: ${width}px)`);
  }

  showProgress() {
    const loader = this.modal.querySelector('#search-bar-loader');
    if (!loader) {
      console.error('Wave loader element not found!');
      return;
    }

    loader.style.display = 'block';

    // Clear any existing interval from previous runs
    if (this.waveLoaderFillInterval) {
      clearInterval(this.waveLoaderFillInterval);
      this.waveLoaderFillInterval = null;
    }

    // Initialize wave loader - wait a tick for DOM to be ready
    setTimeout(() => {
      // Check if modal was closed during setTimeout
      if (!this.modal) return;

      // Initialize or re-initialize if needed (handles re-open case)
      this.initWaveLoader();

      // Verify initialization worked
      if (!this.waveLoader) {
        console.error('Wave loader failed to initialize!');
        return;
      }

      // Ensure label shows correct text
      const label = loader.querySelector('.search-bar-label');
      if (label) label.textContent = 'Searching...';

      // Start from 0
      this.setWaveProgress(0);

      // Fake a smooth horizontal fill from 0 → 80% while we wait for real API
      let p = 0;
      const target = 80;
      const step = 2;

      this.waveLoaderFillInterval = setInterval(() => {
        // Stop if modal closed or search cancelled
        if (!this.modal || !this.waveLoader || !this.isSearching) {
          clearInterval(this.waveLoaderFillInterval);
          this.waveLoaderFillInterval = null;
          return;
        }

        if (p >= target) {
          clearInterval(this.waveLoaderFillInterval);
          this.waveLoaderFillInterval = null;
          return;
        }

        p += step;
        this.setWaveProgress(p);
      }, 80);
    }, 50);
  }

  hideProgress() {
    const loader = this.modal?.querySelector('#search-bar-loader');
    if (!loader) return;

    // Stop any ongoing fake progress
    if (this.waveLoaderFillInterval) {
      clearInterval(this.waveLoaderFillInterval);
      this.waveLoaderFillInterval = null;
    }

    // If wave loader isn't ready yet (race condition), just hide immediately
    if (!this.waveLoader) {
      loader.style.display = 'none';
      return;
    }

    // Smoothly fill to 100% and then hide
    const start = this.waveLoader.currentProgress || 0;
    const end = 100;
    const duration = 600; // ms
    const startTime = performance.now();

    const animate = (now) => {
      // Check if modal was closed during animation
      if (!this.modal || !this.waveLoader) {
        if (loader && loader.parentElement) {
          loader.style.display = 'none';
        }
        return;
      }

      const t = Math.min(1, (now - startTime) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const value = start + (end - start) * eased;

      this.setWaveProgress(value);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        // Small delay so user sees it "full", then hide & reset
        setTimeout(() => {
          if (loader && loader.parentElement) {
            loader.style.display = 'none';
          }
          if (this.waveLoader) {
            this.setWaveProgress(0);
          }
        }, 300);
      }
    };

    requestAnimationFrame(animate);
  }

  showError(msg) {
    const err = this.modal.querySelector('#error-msg');
    err.textContent = msg;
    err.style.display = 'block';
  }

  hideError() {
    this.modal.querySelector('#error-msg').style.display = 'none';
  }
}

// Initialize
window.customLocationModal = new CustomLocationModal();
