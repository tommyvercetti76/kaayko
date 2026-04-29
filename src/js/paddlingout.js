/**
 * File: scripts/paddlingout.js
 *
 * Responsibilities:
 *   1) Hide hero banner on detail pages
 *   2) Autoplay a random hero video once on list pages
 *   3) Fetch and render paddling spots (list & detail views)
 *   4) Build cards with in‐card image carousel (dots + swipe)
 *   5) Inject conditions badge + forecast button
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
    const dots  = card.querySelector(".carousel-dots");

    // 5a) Populate images & carousel dots
    spot.imgSrc.forEach((url, i) => {
      const img = document.createElement("img");
      img.src = url;
      img.className = `carousel-image${i===0 ? " active" : ""}`;
      img.dataset.index = i;
      imgs.appendChild(img);

      const dot = document.createElement("span");
      dot.className = `carousel-dot${i===0 ? " active" : ""}`;
      dot.dataset.index = i;
      dot.addEventListener("click", e => {
        e.stopPropagation();
        showImage(card, i);
      });
      dots.appendChild(dot);
    });

    // 5a-2) Wire up carousel arrows
    const prevBtn = imgs.querySelector('.prev');
    const nextBtn = imgs.querySelector('.next');

    if (prevBtn && nextBtn) {
      const getActiveIndex = () => {
        const activeImg = card.querySelector('.carousel-image.active');
        return activeImg ? parseInt(activeImg.dataset.index, 10) : 0;
      };

      prevBtn.addEventListener('click', e => {
        e.stopPropagation();
        const total = spot.imgSrc.length;
        showImage(card, (getActiveIndex() - 1 + total) % total);
      });

      nextBtn.addEventListener('click', e => {
        e.stopPropagation();
        const total = spot.imgSrc.length;
        showImage(card, (getActiveIndex() + 1) % total);
      });

      if (spot.imgSrc.length <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
      }
    }

    // 5b) Populate text fields
    card.querySelector(".lake-name").textContent  = spot.title;
    card.querySelector(".location").textContent   = spot.subtitle;
    card.querySelector(".description").textContent = spot.text;

    // 5c) Conditions badge — inject into img-container
    const badge = createConditionsBadge(spot);
    imgs.appendChild(badge);

    // Score class on card drives colored left border in list view
    if (spot.paddleScore?.rating != null) {
      card.classList.add(`score-${getScoreSeverity(spot.paddleScore.rating)}`);
    }

    // 5d) Forecast button → navigate to forecast page
    const forecastBtn = card.querySelector(".forecast-button");
    forecastBtn.addEventListener("click", e => {
      e.stopPropagation();
      window.location.href = `/paddlingout/forecast?id=${encodeURIComponent(spot.id)}`;
    });

    // 5e) Card click → navigate to detail page
    card.addEventListener("click", () => {
      window.location.href = `paddlingout.html?id=${spot.id}`;
    });

    return card;
  }

  function getScoreSeverity(score) {
    if (score <= 2.0) return 'critical';
    if (score <= 3.5) return 'moderate';
    return 'good';
  }

  function createConditionsBadge(spot) {
    const badge = document.createElement("div");
    badge.classList.add("conditions-badge");

    if (spot.paddleScore?.rating != null) {
      const score    = spot.paddleScore.rating;
      const severity = getScoreSeverity(score);
      const label    = severity === 'critical' ? 'Critical'
                     : severity === 'moderate' ? 'Fair' : 'Good';
      if (severity !== 'good') badge.classList.add(severity);
      badge.innerHTML = `
        <span class="badge-dot"></span>
        <span class="badge-score">${score}</span>
        <span class="badge-status">${label}</span>
      `;
    } else {
      badge.innerHTML = `
        <span class="badge-dot"></span>
        <span class="badge-score">—</span>
        <span class="badge-status">N/A</span>
      `;
    }

    badge.addEventListener("click", e => {
      e.stopPropagation();
      window.location.href = `/paddlingout/forecast?id=${encodeURIComponent(spot.id)}`;
    });

    return badge;
  }

  //──────────────────────────────────────────────────────────────────────────────
  // Section 6: showImage(card, idx) → Switches active image & dot
  //──────────────────────────────────────────────────────────────────────────────
  function showImage(card, idx) {
    const images = card.querySelectorAll(".carousel-image");
    const dots   = card.querySelectorAll(".carousel-dot");
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