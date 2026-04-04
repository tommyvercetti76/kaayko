/**
 * File: scripts/paddlingout.js
 *
 * Responsibilities:
 *   1) Hide hero banner on detail pages
 *   2) Autoplay a random hero video once on list pages
 *   3) Fetch and render paddling spots (list & detail views)
 *   4) Build cards with in‐card image carousel (dots + swipe)
 *   5) Attach footer icons (parking, restrooms, YouTube, location)
 *   6) Expose global helpers for YouTube & map links
 *   7) Insert the current year into the footer
 */

// API Configuration - Dynamic based on API client mode
// const API_BASE = "https://api-vwcc5j4qda-uc.a.run.app"; // Production Functions URL
// Now using dynamic API client instead
const VIDEOS_DIR = "/assets";
const HERO_VIDEOS = ["paddle2.mp4"];

document.addEventListener("DOMContentLoaded", () => {

  //──────────────────────────────────────────────────────────────────────────────
  // Section 1: Query Parameters & DOM Elements
  //──────────────────────────────────────────────────────────────────────────────
  const params     = new URLSearchParams(window.location.search);
  const spotId     = params.get("id");                         // if present → detail
  const heroVideo  = document.getElementById("previewVideo");  // <video> element
  const heroBanner = document.querySelector(".hero-banner");   // video wrapper
  const container  = document.getElementById("cardsContainer");// cards container

  //──────────────────────────────────────────────────────────────────────────────
  // Section 2: Hide Hero Banner on Detail Pages
  //──────────────────────────────────────────────────────────────────────────────
  if (spotId && heroBanner) {
    heroBanner.style.display = "none";
  }

  //──────────────────────────────────────────────────────────────────────────────
  // Section 3: Autoplay Random Hero Video (List View Only)
  //──────────────────────────────────────────────────────────────────────────────
  if (!spotId && heroVideo) {
    const choice = HERO_VIDEOS[Math.floor(Math.random() * HERO_VIDEOS.length)];
    heroVideo.src = `${VIDEOS_DIR}/${choice}`;
    heroVideo.play().catch(() => {
      // Autoplay blocked by browser → user can manually click play
    });
  }

  //──────────────────────────────────────────────────────────────────────────────
  // Section 4: Fetch & Render Spots (List vs Detail)
  //──────────────────────────────────────────────────────────────────────────────
  if (spotId) fetchSingle(spotId);
  else        fetchAll();

  function fetchAll() {
    // Dynamic API endpoint - with production override support
    const spotEndpoint = window.FORCE_PRODUCTION_MODE 
      ? window.PRODUCTION_API_BASE  // Force production mode
      : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? `${window.location.origin}/api`  // Local Firebase emulator
        : "https://api-vwcc5j4qda-uc.a.run.app";  // Production Functions v2 URL
    
    const currentMode = window.FORCE_PRODUCTION_MODE ? 'production' : (window.apiClient?.getMode() || 'local');
    
    console.log(`📍 Fetching paddle spots from ${spotEndpoint} (${currentMode} mode)`);
    
    fetch(`${spotEndpoint}/paddlingOut`)
      .then(r => r.json())
      .then(async spots => {
        container.innerHTML = "";
        container.classList.remove("single-card");
        
        // Process cards in parallel for better performance
        const cardPromises = spots.map(spot => renderCard(spot));
        const cards = await Promise.all(cardPromises);
        cards.forEach(card => container.append(card));
        
        wireUpCarousels();
      })
      .catch(() => showError("Error loading spots."));
  }

  function fetchSingle(id) {
    // Dynamic API endpoint - with production override support
    const spotEndpoint = window.FORCE_PRODUCTION_MODE 
      ? window.PRODUCTION_API_BASE  // Force production mode
      : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? `${window.location.origin}/api`  // Local Firebase emulator
        : "https://api-vwcc5j4qda-uc.a.run.app";  // Production Functions v2 URL
    
    const currentMode = window.FORCE_PRODUCTION_MODE ? 'production' : (window.apiClient?.getMode() || 'local');
    
    console.log(`📍 Fetching single spot from ${spotEndpoint} (${currentMode} mode)`);
    
    fetch(`${spotEndpoint}/paddlingOut/${encodeURIComponent(id)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(async spot => {
        container.innerHTML = "";
        container.classList.add("single-card");
        const card = await renderCard(spot);
        container.append(card);
        wireUpCarousels();
      })
      .catch(() => showError("Spot not found."));
  }

  //──────────────────────────────────────────────────────────────────────────────
  // Section 5: renderCard(spot) → Clones template & populates a .card element
  //──────────────────────────────────────────────────────────────────────────────
  async function renderCard(spot) {
    const tpl   = document.getElementById("card-template");
    const clone = tpl.content.cloneNode(true);
    const card  = clone.querySelector(".card");
    const imgs  = card.querySelector(".img-container");
    const dots  = card.querySelector(".image-indicator");
    const foot  = card.querySelector(".card-footer");

    // 5a) Populate images & indicator dots
    spot.imgSrc.forEach((url, i) => {
      // Image
      const img = document.createElement("img");
      img.src = url;
      img.className = `carousel-image${i===0 ? " active" : ""}`;
      img.dataset.index = i;
      imgs.appendChild(img);

      // Dot
      const dot = document.createElement("span");
      dot.className = `indicator-dot${i===0 ? " active" : ""}`;
      dot.dataset.index = i;
      dot.addEventListener("click", e => {
        e.stopPropagation();
        showImage(card, i);
      });
      dots.appendChild(dot);
    });

    // 5a-2) Wire up carousel arrows
    const prevBtn = imgs.querySelector('.carousel-prev');
    const nextBtn = imgs.querySelector('.carousel-next');
    
    if (prevBtn && nextBtn) {
      const getActiveIndex = () => {
        const activeImg = card.querySelector('.carousel-image.active');
        return activeImg ? parseInt(activeImg.dataset.index, 10) : 0;
      };
      
      prevBtn.addEventListener('click', e => {
        e.stopPropagation();
        const totalImages = spot.imgSrc.length;
        const currentIdx = getActiveIndex();
        const prevIdx = (currentIdx - 1 + totalImages) % totalImages;
        showImage(card, prevIdx);
      });
      
      nextBtn.addEventListener('click', e => {
        e.stopPropagation();
        const totalImages = spot.imgSrc.length;
        const currentIdx = getActiveIndex();
        const nextIdx = (currentIdx + 1) % totalImages;
        showImage(card, nextIdx);
      });
      
      // Hide arrows if only one image
      if (spot.imgSrc.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      }
    }

    // 5b) Populate text fields
    card.querySelector(".card-title").textContent       = spot.title;
    card.querySelector(".card-subtitle").textContent    = spot.subtitle;
    card.querySelector(".card-description").textContent = spot.text;

    // 5c) Footer icons
    if (spot.parkingAvl)   foot.append(icon("parking-icon",   "Parking Available"));
    if (spot.restroomsAvl) foot.append(icon("toilet-icon",    "Restrooms Available"));
    if (spot.youtubeURL)   foot.append(icon("youtube-icon",   "Video", () => openYoutube(spot.youtubeURL)));
    
    // Use smart paddle score icon instead of generic robot
    const paddleScoreIcon = await createPaddleScoreIcon(spot);
    foot.append(paddleScoreIcon);
    
    foot.append(icon("location-icon", "Take me there", () =>
      openLocation(spot.location.latitude, spot.location.longitude)
    ));

    // 5d) Card click → ALWAYS navigate to detail page
    card.addEventListener("click", () => {
      window.location.href = `paddlingout.html?id=${spot.id}`;
    });

    return card;
  }

  /**
   * Helper: create a footer icon element
   * @param {string} cls    CSS class for the icon
   * @param {string} title  Tooltip text
   * @param {Function} [onClick] Optional click handler
   */
  /**
   * Create a color-coded paddle score icon that shows the included score
   */
  async function createPaddleScoreIcon(spot) {
    const wrap = document.createElement("div");
    wrap.className = "icon paddle-score-icon mini-ring-wrap";

    wrap.addEventListener("click", e => {
      e.stopPropagation();
      if (window.advancedModal) advancedModal.open(spot);
    });

    if (spot.paddleScore && typeof spot.paddleScore.rating === 'number') {
      const score = spot.paddleScore.rating;
      const { description } = getPaddleScoreDisplay(score);
      const strokeColor = getRingStrokeColor(score);
      wrap.title = `${description} — Score ${score} (click for details)`;

      // Mini SVG ring — rotate(-90) starts arc at 12 o'clock, no dashoffset bug
      const r    = 16, cx = 20, cy = 20;
      const circ = 2 * Math.PI * r;
      const pct  = Math.max(0, Math.min(1, score / 5));
      const fill = (pct * circ).toFixed(2);
      const gap  = ((1 - pct) * circ).toFixed(2);

      wrap.innerHTML = `
        <svg class="mini-ring-svg" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <circle class="mini-ring-track" cx="${cx}" cy="${cy}" r="${r}"/>
          <circle class="mini-ring-fill"
            cx="${cx}" cy="${cy}" r="${r}"
            stroke="${strokeColor}"
            stroke-dasharray="${fill} ${gap}"
            transform="rotate(-90 ${cx} ${cy})"/>
        </svg>
        <div class="mini-ring-label" style="color:#fff">${score}</div>
      `;
    } else {
      wrap.title = "Score unavailable — click for details";
      wrap.innerHTML = `
        <svg class="mini-ring-svg" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
          <circle class="mini-ring-track" cx="20" cy="20" r="16"
            stroke-dasharray="4 6" stroke-linecap="round"/>
        </svg>
        <div class="mini-ring-label mini-ring-label-na">–</div>
      `;
    }

    return wrap;
  }

  /**
   * Vibrant SVG stroke colors — visible on BOTH dark and light card backgrounds.
   * Separate from getPaddleScoreDisplay() which uses dark solid-circle colors.
   */
  function getRingStrokeColor(score) {
    const s = parseFloat(score);
    if (s >= 4.5) return '#22C55E'; // vivid green
    if (s >= 4.0) return '#4ADE80'; // light green
    if (s >= 3.5) return '#D97706'; // amber
    if (s >= 3.0) return '#F97316'; // orange
    if (s >= 2.5) return '#EF4444'; // vivid red
    if (s >= 2.0) return '#DC2626'; // medium red
    if (s >= 1.5) return '#EF4444'; // vivid red (matches 2.5 — low scores need maximum visibility)
    return '#FF2D20';               // alarm red
  }

  /**
   * Get display properties for paddle score using ADA-compliant color system
   * with high contrast ratios and attractive shadows
   */
  function getPaddleScoreDisplay(score) {
    // Score is already properly formatted by API (rounded to 0.5 increments)
    
    // ADA-COMPLIANT color grading with proper contrast ratios (4.5:1 minimum)
    let backgroundColor, textColor, boxShadow;
    
    if (score >= 4.5) {
      // Excellent+ - 0% gradient position
      backgroundColor = "#1B4332";
      textColor = "#FFFFFF";
      boxShadow = "0 4px 12px rgba(27, 67, 50, 0.4), 0 2px 4px rgba(0,0,0,0.3)";
    } else if (score >= 4.0) {
      // Excellent - 15% gradient position
      backgroundColor = "#2D5A32";
      textColor = "#FFFFFF";
      boxShadow = "0 4px 12px rgba(45, 90, 50, 0.4), 0 2px 4px rgba(0,0,0,0.3)";
    } else if (score >= 3.5) {
      // Good - 30% gradient position
      backgroundColor = "#CD853F";
      textColor = "#FFFFFF";
      boxShadow = "0 4px 12px rgba(205, 133, 63, 0.4), 0 2px 4px rgba(0,0,0,0.3)";
    } else if (score >= 3.0) {
      // Fair - 45% gradient position
      backgroundColor = "#E36414";
      textColor = "#FFFFFF";
      boxShadow = "0 4px 12px rgba(227, 100, 20, 0.4), 0 2px 4px rgba(0,0,0,0.3)";
    } else if (score >= 2.5) {
      // Poor - 60% gradient position
      backgroundColor = "#C0392B";
      textColor = "#FFFFFF";
      boxShadow = "0 4px 12px rgba(192, 57, 43, 0.4), 0 2px 4px rgba(0,0,0,0.3)";
    } else if (score >= 2.0) {
      // Dangerous - 75% gradient position
      backgroundColor = "#8E0E00";
      textColor = "#FFFFFF";
      boxShadow = "0 4px 12px rgba(142, 14, 0, 0.5), 0 2px 4px rgba(0,0,0,0.4)";
    } else if (score >= 1.5) {
      // Very Dangerous - 85% gradient position
      backgroundColor = "#5B0000";
      textColor = "#FFFFFF";
      boxShadow = "0 4px 12px rgba(91, 0, 0, 0.6), 0 2px 4px rgba(0,0,0,0.4)";
    } else if (score >= 1.0) {
      // Critical - 95% gradient position
      backgroundColor = "#2B1815";
      textColor = "#FFFFFF";
      boxShadow = "0 4px 12px rgba(43, 24, 21, 0.7), 0 2px 4px rgba(0,0,0,0.5)";
    } else {
      // Extremely Critical - 100% gradient position
      backgroundColor = "#000000";
      textColor = "#FFFFFF";
      boxShadow = "0 4px 12px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(255, 0, 0, 0.3)";
    }
    
    // Get description based on user-specified score ranges
    let description;
    if (score >= 4.5) {
      description = "Excellent conditions";
    } else if (score >= 4.0) {
      description = "Good conditions";
    } else if (score >= 3.5) {
      description = "Good conditions - Heat caution advised";
    } else if (score >= 3.0) {
      description = "Challenging conditions";
    } else {
      description = "Difficult conditions";
    }
    
    return {
      icon: score,
      backgroundColor,
      textColor,
      boxShadow,
      description
    };
  }

  function icon(cls, title, onClick) {
    const el = document.createElement("span");
    el.className = `icon ${cls}`;
    el.title = title;
    el.addEventListener("click", e => {
      e.stopPropagation();
      onClick?.();
    });
    return el;
  }

  //──────────────────────────────────────────────────────────────────────────────
  // Section 6: showImage(card, idx) → Switches active image & dot
  //──────────────────────────────────────────────────────────────────────────────
  function showImage(card, idx) {
    const images = card.querySelectorAll(".carousel-image");
    const dots   = card.querySelectorAll(".indicator-dot");
    const next   = (idx + images.length) % images.length;

    images.forEach((img, i) => img.classList.toggle("active", i === next));
    dots  .forEach((d,   i) => d.classList.toggle("active", i === next));
  }

  //──────────────────────────────────────────────────────────────────────────────
  // Section 7: wireUpCarousels() → Attaches enhanced swipe logic to each card
  //──────────────────────────────────────────────────────────────────────────────
  function wireUpCarousels() {
    container.querySelectorAll(".card").forEach(card => {
      let startX = 0;
      let isDragging = false;
      let hasSwiped = false;
      const imgs = card.querySelectorAll(".carousel-image");

      const onEnd = dx => {
        console.log(`🏞️ Paddling swipe detected: dx=${dx}, threshold=40`);
        if (Math.abs(dx) < 40) {
          console.log(`⚠️ Paddling swipe too small, ignoring`);
          return false;
        }
        
        hasSwiped = true;
        const curr = [...imgs].findIndex(i => i.classList.contains("active"));
        const next = dx < 0 ? curr + 1 : curr - 1;
        console.log(`🏞️ Paddling image: ${curr} → ${next}`);
        showImage(card, next);
        return true;
      };

      const box = card.querySelector(".img-container");
      
      // Add styling for better touch interaction
      box.style.touchAction = 'pan-y pinch-zoom';
      box.style.userSelect = 'none';
      box.style.cursor = 'grab';

      // Prevent modal/navigation interference
      box.addEventListener('click', (e) => {
        if (hasSwiped) {
          console.log(`🚫 Preventing navigation due to paddling swipe`);
          e.stopPropagation();
          e.preventDefault();
          hasSwiped = false;
        }
      }, true);

      if (window.PointerEvent) {
        console.log(`🏞️ Using pointer events for paddling swipe`);
        box.addEventListener("pointerdown", e => {
          startX = e.clientX;
          isDragging = true;
          hasSwiped = false;
          box.style.cursor = 'grabbing';
          console.log(`👇 Paddling pointer down at ${startX}`);
          e.preventDefault();
        });
        
        box.addEventListener("pointermove", e => {
          if (isDragging) {
            const dx = e.clientX - startX;
            if (Math.abs(dx) > 10) {
              hasSwiped = true;
            }
          }
        });
        
        box.addEventListener("pointerup", e => {
          if (isDragging) {
            const dx = e.clientX - startX;
            console.log(`👆 Paddling pointer up at ${e.clientX}, dx=${dx}`);
            onEnd(dx);
            isDragging = false;
            box.style.cursor = 'grab';
          }
        });
      } else {
        console.log(`🏞️ Using touch events for paddling swipe`);
        box.addEventListener("touchstart", e => {
          startX = e.touches[0].clientX;
          isDragging = true;
          hasSwiped = false;
          console.log(`👇 Paddling touch start at ${startX}`);
        }, { passive: false });
        
        box.addEventListener("touchmove", e => {
          if (isDragging) {
            const dx = e.touches[0].clientX - startX;
            if (Math.abs(dx) > 10) {
              hasSwiped = true;
              e.preventDefault(); // Prevent scrolling
            }
          }
        }, { passive: false });
        
        box.addEventListener("touchend", e => {
          if (isDragging) {
            const dx = e.changedTouches[0].clientX - startX;
            console.log(`👆 Paddling touch end, dx=${dx}`);
            onEnd(dx);
            isDragging = false;
          }
        });

        // Add mouse events for desktop
        box.addEventListener("mousedown", e => {
          startX = e.clientX;
          isDragging = true;
          hasSwiped = false;
          box.style.cursor = 'grabbing';
          console.log(`🖱️ Paddling mouse down at ${startX}`);
          e.preventDefault();
        });
        
        box.addEventListener("mousemove", e => {
          if (isDragging) {
            const dx = e.clientX - startX;
            if (Math.abs(dx) > 10) {
              hasSwiped = true;
            }
          }
        });
        
        box.addEventListener("mouseup", e => {
          if (isDragging) {
            const dx = e.clientX - startX;
            console.log(`🖱️ Paddling mouse up at ${e.clientX}, dx=${dx}`);
            onEnd(dx);
            isDragging = false;
            box.style.cursor = 'grab';
          }
        });
        
        // Prevent mouse leave from breaking the interaction
        box.addEventListener("mouseleave", e => {
          if (isDragging) {
            isDragging = false;
            box.style.cursor = 'grab';
          }
        });
      }
    });
  }

  //──────────────────────────────────────────────────────────────────────────────
  // Section 8: showError(msg) → Displays a simple error message
  //──────────────────────────────────────────────────────────────────────────────
  function showError(msg) {
    container.innerHTML = `<div class="error">${msg}</div>`;
  }

  //──────────────────────────────────────────────────────────────────────────────
  // Section 9: Global Helpers → window.openYoutube & window.openLocation
  //──────────────────────────────────────────────────────────────────────────────
  window.openYoutube  = url => window.open(url, "_blank");
  window.openLocation = (lat, lon) =>
    window.open(`https://maps.google.com?q=${lat},${lon}`, "_blank");



  //──────────────────────────────────────────────────────────────────────────────
  // Section 10: Insert Current Year into Footer
  //──────────────────────────────────────────────────────────────────────────────
  const yEl = document.getElementById("year");
  if (yEl) yEl.textContent = new Date().getFullYear();

});