/**
 * Rating Hero Component
 * Displays the main paddle score and description
 */
class RatingHero {
  constructor() {
    this.element = null;
    // Get saved unit preference or default to metric
    this.useMetric = localStorage.getItem('kaayko_units') !== 'imperial';
    // Store the last render data for unit switching
    this.lastRenderData = null;
    // Store raw values for unit conversion
    this.rawValues = {};
    // Feedback state
    this._feedbackSpotId = null;
    this._feedbackPredictedScore = null;
    this._feedbackSubmitted = false;
  }

  render(rating, interpretation, weather = {}, forecastData = null, spotId = null) {
    // Store render data for unit switching
    this.lastRenderData = { rating, interpretation, weather };
    // Store feedback context
    this._feedbackSpotId = spotId;
    this._feedbackPredictedScore = rating;
    this._feedbackSubmitted = false;
    
    console.log('🏆 RatingHero render called with:', { rating, weather, interpretation });
    
    // Extract skill level information with more meaningful defaults
    const skillLevel = interpretation.skillLevel || 'EXPERIENCED ONLY';
    const skillRecommendation = interpretation.recommendation || 'Assess conditions carefully before paddling';
    const skillDetails = interpretation.skillDetails || interpretation.details || 'Weather conditions require careful evaluation';
    
    // Extract penalty information for transparency (GOLD STANDARD compatibility)
    const penalties = weather?.penaltiesApplied || interpretation?.penalties || [];
    const originalRating = weather?.originalRating || interpretation?.originalRating || rating;
    const totalPenalty = weather?.totalPenalty || interpretation?.totalPenalty || 0;
    
    // GOLD STANDARD v3 ML model provides direct ratings without additional penalties
    const isGoldStandard = weather?.isGoldStandard || weather?.v3ModelUsed;
    if (isGoldStandard) {
      console.log('🏆 Using GOLD STANDARD v3 ML model rating - no additional penalties applied');
    }
    
    // Get professional skill level information based on rating
    const skillInfo = this.getSkillInfo(rating, weather, forecastData);
    
    // Extract weather data from API structure - direct from forecast endpoint
    const temp = weather?.temperature || '--';
    const wind = weather?.windSpeed || '--';
    const windDirection = weather?.windDirection || 'N'; // Use actual wind direction from API
    const visibility = weather?.visibility || '--';
    const humidity = weather?.humidity || '--';
    const uvIndex = weather?.uvIndex || '--';
    const cloudCover = weather?.cloudCover || '--';
    
    // Calculate water temperature estimate (air temp - 3°C for lakes)
    const waterTemp = (temp !== '--' && !isNaN(parseFloat(temp))) ? (parseFloat(temp) - 3) : '--';

    console.log('🏆 RatingHero extracted values:', {
      temp, wind, windDirection, visibility, humidity, uvIndex, cloudCover, waterTemp
    });

    // Store raw values for unit conversion
    this.rawValues = {
      temp: (temp !== '--' && !isNaN(parseFloat(temp))) ? parseFloat(temp) : null,
      waterTemp: (waterTemp !== '--' && !isNaN(parseFloat(waterTemp))) ? parseFloat(waterTemp) : null,
      wind: (wind !== '--' && !isNaN(parseFloat(wind))) ? parseFloat(wind) : null,
      windDirection,
      uvIndex: (uvIndex !== '--' && !isNaN(parseFloat(uvIndex))) ? parseFloat(uvIndex) : null,
      cloudCover: (cloudCover !== '--' && !isNaN(parseFloat(cloudCover))) ? parseFloat(cloudCover) : null
    };

    // Convert units based on user preference
    const displayTemp = this.useMetric ? temp : this.celsiusToFahrenheit(temp);
    const tempUnit = this.useMetric ? '°C' : '°F';
    
    const displayWaterTemp = this.useMetric ? waterTemp : this.celsiusToFahrenheit(waterTemp);
    
    const displayWind = this.useMetric ? wind : this.kphToMph(wind);
    const windUnit = this.useMetric ? 'km/h' : 'mph';
    
    const heroHTML = `
      <div class="skill-level-section">
        <div class="header-content">
          <div class="rating-section">
            <div class="paddle-score-label">Paddle Score</div>
            <div class="rating-circle" data-rating="${rating}">
              <div class="rating-number">${rating}</div>
            </div>
            <div class="now-indicator">NOW</div>
          </div>
          <div class="skill-info">
            <div class="core-weather-inline">
              <div class="weather-stat">
                <div class="weather-icon">🌡️</div>
                <div class="weather-data">
                  <span class="weather-value">${displayTemp}${tempUnit}</span>
                  <span class="weather-label">Air Temp</span>
                </div>
              </div>
              <div class="weather-stat">
                <div class="weather-icon">💨</div>
                <div class="weather-data">
                  <span class="weather-value">${displayWind} ${windUnit}</span>
                  <span class="weather-label">Wind Speed</span>
                </div>
              </div>
              <div class="weather-stat">
                <div class="weather-icon">🧭</div>
                <div class="weather-data">
                  <span class="weather-value">${windDirection}</span>
                  <span class="weather-label">Wind Dir</span>
                </div>
              </div>
              <div class="weather-stat">
                <div class="weather-icon">🌊</div>
                <div class="weather-data">
                  <span class="weather-value">${typeof displayWaterTemp === 'number' ? displayWaterTemp.toFixed(1) : displayWaterTemp}${tempUnit}</span>
                  <span class="weather-label">Water Temp</span>
                </div>
              </div>
              <div class="weather-stat">
                <div class="weather-icon">☀️</div>
                <div class="weather-data">
                  <span class="weather-value">${uvIndex}</span>
                  <span class="weather-label">UV Index</span>
                </div>
              </div>
              <div class="weather-stat">
                <div class="weather-icon">☁️</div>
                <div class="weather-data">
                  <span class="weather-value">${cloudCover}%</span>
                  <span class="weather-label">Cloud Cover</span>
                </div>
              </div>
            </div>
            <div class="units-toggle">
              <button class="units-btn ${this.useMetric ? 'active' : ''}" data-unit="metric">°C / km/h</button>
              <button class="units-btn ${!this.useMetric ? 'active' : ''}" data-unit="imperial">°F / mph</button>
            </div>
          </div>
        </div>
        <div class="skill-recommendation-modern ${skillInfo.className}">
          <div class="skill-level-display">
            <div class="skill-level-header">
              <span class="skill-icon">${skillInfo.icon}</span>
              <div class="skill-level-text">
                <div class="skill-level-badge-modern ${skillInfo.className}">${skillInfo.level}</div>
              </div>
            </div>
            <div class="skill-description">
              <div class="conditions-list">
                ${skillInfo.description.map(condition => {
                  const isDangerous = condition.includes('DANGEROUS') || 
                                    condition.includes('LIFE THREATENING') || 
                                    condition.includes('HYPOTHERMIA') || 
                                    condition.includes('EXTREME') || 
                                    condition.includes('MULTIPLE HAZARDS');
                  const dangerClass = isDangerous ? ' dangerous-condition' : '';
                  return `<div class="condition-item${dangerClass}">${condition}</div>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="paddle-feedback" data-submitted="false">
        <span class="feedback-prompt">Was this score accurate?</span>
        <div class="feedback-buttons">
          <button class="feedback-btn" data-vote="5"   title="Way better than predicted">👍👍</button>
          <button class="feedback-btn" data-vote="up"  title="Better than predicted">👍</button>
          <button class="feedback-btn" data-vote="ok"  title="About right">👌</button>
          <button class="feedback-btn" data-vote="down" title="Worse than predicted">👎</button>
          <button class="feedback-btn" data-vote="1"   title="Way worse than predicted">👎👎</button>
        </div>
        <span class="feedback-thanks" style="display:none">Thanks for the feedback!</span>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = heroHTML;
    this.element = container.firstElementChild;

    // Set rating circle color based on score
    const ratingCircle = this.element.querySelector('.rating-circle');
    if (ratingCircle) {
      const colors = this.getRatingColors(rating);
      ratingCircle.style.setProperty('background-color', colors.backgroundColor, 'important');
      ratingCircle.style.setProperty('border-color', colors.borderColor, 'important');
      ratingCircle.style.setProperty('color', colors.textColor, 'important');
      ratingCircle.style.setProperty('background', colors.backgroundColor, 'important'); // Override gradients
      
      // Also set the rating number text color
      const ratingNumber = ratingCircle.querySelector('.rating-number');
      if (ratingNumber) {
        ratingNumber.style.setProperty('color', colors.textColor, 'important');
      }
      
      console.log(`🎨 Rating circle colored for ${rating}:`, colors);
    }
    
    // Add event listeners for unit toggle
    this.setupUnitToggle();
    // Add feedback listeners
    this.setupFeedback();

    return this.element;
  }

  setupFeedback() {
    if (!this.element) return;
    const feedbackEl = this.element.querySelector('.paddle-feedback');
    if (!feedbackEl) return;

    feedbackEl.querySelectorAll('.feedback-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (this._feedbackSubmitted) return;
        this._feedbackSubmitted = true;

        const vote = e.currentTarget.dataset.vote;
        const predicted = parseFloat(this._feedbackPredictedScore) || 3;

        // Map vote tokens to actual scores
        const actualScore = {
          '5':    Math.min(5, predicted + 1.5),
          'up':   Math.min(5, predicted + 0.5),
          'ok':   predicted,
          'down': Math.max(1, predicted - 0.5),
          '1':    Math.max(1, predicted - 1.5),
        }[vote] ?? predicted;

        // Visual feedback immediately
        feedbackEl.setAttribute('data-submitted', 'true');
        feedbackEl.querySelector('.feedback-buttons').style.display = 'none';
        feedbackEl.querySelector('.feedback-prompt').style.display = 'none';
        feedbackEl.querySelector('.feedback-thanks').style.display = 'inline';

        // Fire-and-forget API call
        if (window.apiClient && this._feedbackSpotId) {
          window.apiClient.submitFeedback(
            this._feedbackSpotId,
            predicted,
            actualScore,
            { ...(this.rawValues || {}) }
          ).catch(() => {}); // swallow network errors silently
        }
      });
    });
  }

  setupUnitToggle() {
    const unitButtons = this.element.querySelectorAll('.units-btn');
    unitButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const unit = e.target.dataset.unit;
        this.useMetric = unit === 'metric';
        
        // Save preference
        localStorage.setItem('kaayko_units', unit);
        
        // Update button states
        unitButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Re-render with new units
        this.updateDisplayUnits();
      });
    });
  }

  updateDisplayUnits() {
    // Update weather values directly without re-rendering
    if (!this.element) return;
    
    const weatherStats = this.element.querySelectorAll('.weather-stat');
    const tempUnit = this.useMetric ? '°C' : '°F';
    const windUnit = this.useMetric ? 'km/h' : 'mph';
    
    // Update Air Temperature (stat 0)
    if (weatherStats[0] && this.rawValues.temp !== null) {
      const tempValue = this.useMetric ? 
        this.rawValues.temp.toFixed(1) : 
        this.celsiusToFahrenheit(this.rawValues.temp);
      weatherStats[0].querySelector('.weather-value').textContent = `${tempValue}${tempUnit}`;
    }
    
    // Update Wind Speed (stat 1)
    if (weatherStats[1] && this.rawValues.wind !== null) {
      const windValue = this.useMetric ? 
        this.rawValues.wind.toFixed(1) : 
        this.kphToMph(this.rawValues.wind);
      weatherStats[1].querySelector('.weather-value').textContent = `${windValue} ${windUnit}`;
    }
    
    // Update Water Temperature (stat 3)
    if (weatherStats[3] && this.rawValues.waterTemp !== null) {
      const waterTempValue = this.useMetric ? 
        this.rawValues.waterTemp.toFixed(1) : 
        this.celsiusToFahrenheit(this.rawValues.waterTemp);
      weatherStats[3].querySelector('.weather-value').textContent = `${waterTempValue}${tempUnit}`;
    }
    
    console.log('Units updated successfully!', { 
      useMetric: this.useMetric, 
      rawValues: this.rawValues 
    });
  }

  getSkillLevelClass(skillLevel) {
    if (skillLevel.includes('BEGINNERS')) return 'skill-beginner';
    if (skillLevel.includes('MODERATE')) return 'skill-moderate';
    if (skillLevel.includes('EXPERIENCED')) return 'skill-experienced';
    if (skillLevel.includes('EXPERT')) return 'skill-expert';
    if (skillLevel.includes('NOT RECOMMENDED')) return 'skill-danger';
    return 'skill-experienced'; // Default to experienced for safety
  }

  getSkillDisplayName(skillLevel) {
    if (skillLevel.includes('BEGINNERS')) return 'Beginner Friendly';
    if (skillLevel.includes('MODERATE')) return 'Intermediate+';
    if (skillLevel.includes('EXPERIENCED')) return 'Experienced';
    if (skillLevel.includes('EXPERT')) return 'Expert Level';
    if (skillLevel.includes('NOT RECOMMENDED')) return 'Not Recommended';
    return 'Experienced';
  }

  renderPenaltyInfo(penalties, originalRating, totalPenalty, finalRating, isGoldStandard = false) {
    if (isGoldStandard) {
      return '<div class="penalty-info-gold"><span class="penalty-icon">🏆</span> GOLD STANDARD v3 ML Model - Pure rating without additional penalties</div>';
    }
    
    if (!penalties || penalties.length === 0 || totalPenalty === 0) {
      return '<div class="penalty-info-none"><span class="penalty-icon">✨</span> No paddle penalties - ideal conditions!</div>';
    }

    const penaltyHTML = `
      <div class="penalty-info">
        <div class="penalty-header">
          <span class="penalty-icon">⚖️</span>
          <span class="penalty-title">Paddle Penalties Applied</span>
          <span class="penalty-impact">-${totalPenalty} points</span>
        </div>
        <div class="penalty-calculation">
          <span class="original-score">${originalRating}</span>
          <span class="penalty-arrow">→</span>
          <span class="final-score">${finalRating}</span>
        </div>
        <div class="penalty-list">
          ${penalties.map(penalty => `<div class="penalty-item">• ${penalty}</div>`).join('')}
        </div>
      </div>
    `;

    return penaltyHTML;
  }

  getSkillInfo(rating, conditions = null, forecastData = null) {
    const numRating = parseFloat(rating);
    
    // Analyze forecast for improvement suggestions
    const getForecastSuggestion = () => {
      if (!forecastData || !forecastData.forecastHours) return '';
      
      const currentRating = numRating;
      const hours = forecastData.forecastHours;
      
      // Look for better conditions in next 48 hours
      for (let i = 1; i < Math.min(hours.length, 48); i++) {
        const futureHour = hours[i];
        if (futureHour.rating > currentRating + 0.5) {
          const hoursAhead = i;
          if (hoursAhead <= 6) {
            return `⏰ Conditions improve in ${hoursAhead}h`;
          } else if (hoursAhead <= 24) {
            const hoursFromNow = hoursAhead;
            const futureTime = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
            const timeString = futureTime.getHours().toString().padStart(2, '0') + ':00';
            return `⏰ Better conditions at ${timeString}`;
          } else {
            return `⏰ Conditions improve tomorrow`;
          }
        }
      }
      
      // Check if conditions are deteriorating
      let betterEarlier = false;
      for (let i = 1; i < Math.min(hours.length, 12); i++) {
        if (hours[i].rating < currentRating - 0.5) {
          betterEarlier = true;
          break;
        }
      }
      
      if (betterEarlier) {
        return `⚡ Best window is now`;
      }
      
      return '';
    };
    
    // Generate dynamic description based on actual conditions
    const getConditionDetails = () => {
      if (!conditions) return ['Conditions analysis unavailable'];
      
      const details = [];
      
      // GOLD STANDARD v3 model handling
      if (conditions.isGoldStandard || conditions.v3ModelUsed) {
        console.log('🏆 GOLD STANDARD conditions - using v3 ML model analysis');
        details.push('🏆 GOLD STANDARD v3 ML Model rating');
        details.push('✨ Advanced 57-feature analysis applied');
        details.push('🧠 Real-time weather & marine data integrated');
        
        // Add standard condition analysis for GOLD STANDARD
        if (conditions.beaufortScale !== undefined) {
          const beaufortDescriptions = {
            0: "🏄 Calm waters (B0)",
            1: "🍃 Light air (B1)", 
            2: "💨 Light breeze (B2)",
            3: "🌬️ Gentle breeze (B3)",
            4: "💨 Moderate breeze (B4)",
            5: "🌪️ Fresh breeze (B5)",
            6: "⚠️ Strong breeze (B6)",
            7: "🚨 High winds (B7)",
            8: "⛈️ Gale force (B8)"
          };
          details.push(beaufortDescriptions[conditions.beaufortScale] || `⚠️ B${conditions.beaufortScale} winds`);
        }
        
        return details;
      }
      
      // LEGACY penalty system handling (for backward compatibility)
      // SAFETY FIRST: If penalties exist, show them ALL clearly
      if (conditions.hasPenalties && conditions.penalties && conditions.penalties.length > 0) {
        console.log('🚨 SAFETY ANALYSIS - Processing penalties:', conditions.penalties);
        
        conditions.penalties.forEach(penalty => {
          console.log('🔍 Analyzing penalty:', penalty);
          
          // Parse penalty strings with comprehensive analysis
          const penaltyLower = penalty.toLowerCase();
          
          if (penaltyLower.includes('strong winds') || penaltyLower.includes('high winds')) {
            const windMatch = penalty.match(/(\d+\.?\d*)\s*mph/);
            const beaufortMatch = penalty.match(/b(\d+)/i);
            const windSpeed = windMatch ? windMatch[1] : 'high';
            const beaufort = beaufortMatch ? beaufortMatch[1] : '';
            details.push(`⚠️ STRONG WINDS ${windSpeed} mph (B${beaufort}) - DANGEROUS`);
          } else if (penaltyLower.includes('light winds')) {
            const windMatch = penalty.match(/(\d+\.?\d*)\s*mph/);
            const windSpeed = windMatch ? windMatch[1] : '';
            details.push(`💨 Light winds ${windSpeed} mph - Reduced paddling efficiency`);
          } else if (penaltyLower.includes('moderate winds')) {
            const windMatch = penalty.match(/(\d+\.?\d*)\s*mph/);
            const windSpeed = windMatch ? windMatch[1] : '';
            details.push(`🌬️ Moderate winds ${windSpeed} mph - Increased difficulty`);
          }
          
          else if (penaltyLower.includes('moderate waves')) {
            const waveMatch = penalty.match(/(\d+\.?\d*)\s*m/);
            const waveHeight = waveMatch ? waveMatch[1] : '';
            details.push(`🌊 MODERATE WAVES ${waveHeight}m - Challenging conditions`);
          } else if (penaltyLower.includes('large waves') || penaltyLower.includes('high waves')) {
            const waveMatch = penalty.match(/(\d+\.?\d*)\s*m/);
            const waveHeight = waveMatch ? waveMatch[1] : '';
            details.push(`⚠️ LARGE WAVES ${waveHeight}m - VERY DANGEROUS`);
          } else if (penaltyLower.includes('wave')) {
            details.push(`🌊 Wave conditions - Exercise caution`);
          }
          
          else if (penaltyLower.includes('cool water') || penaltyLower.includes('cold water')) {
            const tempMatch = penalty.match(/(\d+\.?\d*)°?c/i);
            const temp = tempMatch ? tempMatch[1] : '';
            if (temp && parseFloat(temp) < 15) {
              details.push(`🧊 HYPOTHERMIA RISK ${temp}°C - LIFE THREATENING`);
            } else {
              details.push(`❄️ Cool water ${temp}°C - Wetsuit recommended`);
            }
          } else if (penaltyLower.includes('warm water') || penaltyLower.includes('hot water')) {
            const tempMatch = penalty.match(/(\d+\.?\d*)°?c/i);
            const temp = tempMatch ? tempMatch[1] : '';
            details.push(`🌡️ Warm water ${temp}°C - Dehydration risk`);
          }
          
          else if (penaltyLower.includes('extreme heat')) {
            details.push(`🔥 EXTREME HEAT - Heat stroke risk`);
          } else if (penaltyLower.includes('high heat')) {
            details.push(`🌡️ High heat index - Stay hydrated`);
          }
          
          else if (penaltyLower.includes('poor visibility')) {
            details.push(`🌫️ POOR VISIBILITY - Navigation hazard`);
          } else if (penaltyLower.includes('reduced visibility')) {
            details.push(`👁️ Reduced visibility - Use caution`);
          }
          
          else if (penaltyLower.includes('uv') || penaltyLower.includes('sun')) {
            details.push(`☀️ High UV exposure - Sun protection needed`);
          }
          
          else {
            // Fallback for unrecognized penalties - still show them!
            details.push(`⚠️ ${penalty.split(':')[0]} - Safety concern`);
          }
        });
        
        // Add critical safety summary for severe conditions
        const totalPenalty = conditions.totalPenalty || 0;
        if (totalPenalty >= 2.0) {
          details.push(`🚨 MULTIPLE HAZARDS PRESENT - EXTREME CAUTION REQUIRED`);
        }
        
      } else {
        // Standard condition analysis when no penalties
        if (conditions.beaufortScale !== undefined) {
          const beaufortDescriptions = {
            0: "🏄 Calm waters (B0)",
            1: "🍃 Light air (B1)",
            2: "💨 Light breeze (B2)", 
            3: "🌬️ Gentle breeze (B3)",
            4: "💨 Moderate breeze (B4)",
            5: "🌪️ Fresh breeze (B5)",
            6: "⚠️ Strong breeze (B6)",
            7: "🚨 High winds (B7)",
            8: "⛈️ Gale force (B8)"
          };
          details.push(beaufortDescriptions[conditions.beaufortScale] || `⚠️ B${conditions.beaufortScale} winds`);
        }
        
        if (conditions.marine?.rawMarineHour?.heatindex_c) {
          const heatIndex = conditions.marine.rawMarineHour.heatindex_c;
          if (heatIndex > 40) details.push("🔥 Extreme heat");
          else if (heatIndex > 32) details.push("🌡️ High heat index");
          else if (heatIndex < 15) details.push("🧊 Cold conditions");
        }
        
        if (conditions.visibility !== undefined) {
          if (conditions.visibility < 2) details.push("🌫️ Poor visibility");
          else if (conditions.visibility < 5) details.push("👁️ Reduced visibility");
          else if (conditions.visibility > 15) details.push("✨ Excellent visibility");
        }
        
        if (conditions.waveHeight !== undefined) {
          if (conditions.waveHeight > 2) details.push("🌊 Large waves");
          else if (conditions.waveHeight > 1) details.push("〰️ Moderate waves");
          else if (conditions.waveHeight < 0.3) details.push("🏄 Calm waters");
        }
      }
      
      // Add forecast improvement timing
      const forecastSuggestion = getForecastSuggestion();
      if (forecastSuggestion) {
        details.push(forecastSuggestion);
      }
      
      console.log('🔍 Final condition details:', details);
      return details;
    };
    
    if (numRating >= 4.5) {
      return {
        level: 'Beginner Friendly',
        icon: '🔰',
        description: getConditionDetails(),
        className: 'skill-beginner'
      };
    } else if (numRating >= 3.5) {
      return {
        level: 'Intermediate+',
        icon: '⚓',
        description: getConditionDetails(),
        className: 'skill-intermediate'
      };
    } else if (numRating >= 2.5) {
      return {
        level: 'Experienced',
        icon: '🌊',
        description: getConditionDetails(),
        className: 'skill-experienced'
      };
    } else if (numRating >= 1.5) {
      return {
        level: 'Expert Level',
        icon: '⚡',
        description: getConditionDetails(),
        className: 'skill-expert'
      };
    } else {
      return {
        level: 'Not Recommended', 
        icon: '⚠️',
        description: getConditionDetails(),
        className: 'skill-danger'
      };
    }
  }

  getRatingClass(rating) {
    const numRating = parseFloat(rating);
    if (numRating >= 4.0) return 'excellent';
    if (numRating >= 3.0) return 'good';
    if (numRating >= 2.0) return 'fair';
    return 'poor';
  }

  getRatingColors(rating) {
    const numRating = parseFloat(rating);
    
    // Unified gradient-based color scheme used across ALL components
    if (numRating >= 4.5) {
      return {
        backgroundColor: '#1B4332', // 0% - Excellent
        textColor: '#FFFFFF',
        borderColor: '#1B4332'
      };
    } else if (numRating >= 4.0) {
      return {
        backgroundColor: '#2D5A32', // 15% - Good
        textColor: '#FFFFFF',
        borderColor: '#2D5A32'
      };
    } else if (numRating >= 3.5) {
      return {
        backgroundColor: '#CD853F', // 30% - Fair
        textColor: '#FFFFFF',
        borderColor: '#CD853F'
      };
    } else if (numRating >= 3.0) {
      return {
        backgroundColor: '#E36414', // 45% - Caution
        textColor: '#FFFFFF',
        borderColor: '#E36414'
      };
    } else if (numRating >= 2.5) {
      return {
        backgroundColor: '#C0392B', // 60% - Risky
        textColor: '#FFFFFF',
        borderColor: '#C0392B'
      };
    } else if (numRating >= 2.0) {
      return {
        backgroundColor: '#8E0E00', // 75% - Poor
        textColor: '#FFFFFF',
        borderColor: '#8E0E00'
      };
    } else if (numRating >= 1.5) {
      return {
        backgroundColor: '#5B0000', // 85% - Dangerous
        textColor: '#FFFFFF',
        borderColor: '#5B0000'
      };
    } else if (numRating >= 1.0) {
      return {
        backgroundColor: '#2B1815', // 95% - Critical
        textColor: '#FFFFFF',
        borderColor: '#2B1815'
      };
    } else {
      return {
        backgroundColor: '#000000', // 100% - Extreme
        textColor: '#FFFFFF',
        borderColor: '#000000'
      };
    }
  }

  calculateBuoyancy(tempCelsius) {
    const waterDensity = 1000 - (tempCelsius - 4) * 0.2;
    const buoyancyForce = waterDensity / 1000;
    
    if (buoyancyForce > 0.999) return { rating: 'Excellent', description: 'Optimal density' };
    if (buoyancyForce > 0.995) return { rating: 'Very Good', description: 'High density' };
    if (buoyancyForce > 0.990) return { rating: 'Good', description: 'Normal density' };
    if (buoyancyForce > 0.985) return { rating: 'Fair', description: 'Lower density' };
    return { rating: 'Poor', description: 'Low density' };
  }

  // Unit conversion methods
  celsiusToFahrenheit(celsius) {
    if (celsius === '--' || celsius === undefined || celsius === null || isNaN(parseFloat(celsius))) return '--';
    return ((parseFloat(celsius) * 9/5) + 32).toFixed(1);
  }

  kphToMph(kph) {
    if (kph === '--' || kph === undefined || kph === null || isNaN(parseFloat(kph))) return '--';
    return (parseFloat(kph) * 0.621371).toFixed(1);
  }

  metersToFeet(meters) {
    if (meters === '--' || meters === undefined || meters === null || isNaN(parseFloat(meters))) return '--';
    return (parseFloat(meters) * 3.28084).toFixed(1);
  }
}

// Export for use in main modal
window.RatingHero = RatingHero;
