// File: scripts/paddlingout.js
//
// • Selects a random hero video from /assets (on demand only)
// • Handles dark-mode toggle + menu (desktop & mobile) via kaayko_ui.js
// • Falls back to manual mobile-menu wiring in case kaayko_ui fails
// • GET /paddlingOut         → list all spots
// • GET /paddlingOut/:id     → detail view (single-spot page)
// • Renders in-card carousel with swipe + dots
// • Shows parking & restroom icons only if available
// • Shows YouTube icon if URL provided
// • Autoplay the hero video exactly once, then rely on translucent button

import { runPageInit, populateMenu, setupMobileMenu } from "./kaayko_ui.js";

const API_BASE    = "https://us-central1-kaayko-api-dev.cloudfunctions.net/api";
const VIDEOS_DIR  = "/src/assets";    // where your MP4 lives
const HERO_VIDEOS = ["paddle2.mp4"];  // possible hero filenames

document.addEventListener("DOMContentLoaded", () => {
  // ────────────────────────────────────────────────────────────────────────────
  // STEP 1: Wire up dark-mode + desktop & mobile menu
  // ────────────────────────────────────────────────────────────────────────────
  runPageInit();
  populateMenu();
  setupMobileMenu();

  // Fallback if kaayko_ui.js failed to attach mobile-menu toggle
  const fab     = document.querySelector(".fab-menu");
  const overlay = document.querySelector(".mobile-menu-overlay");
  if (fab && overlay) {
    fab.addEventListener("click", () => {
      overlay.classList.toggle("active");
    });
    overlay.addEventListener("click", e => {
      if (e.target === overlay || e.target.tagName === "A") {
        overlay.classList.remove("active");
      }
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 2: Detect “list” vs “detail” page
  // ────────────────────────────────────────────────────────────────────────────
  const params      = new URLSearchParams(window.location.search);
  const spotId      = params.get("id");                         // if present → detail
  const heroVideoEl = document.getElementById("previewVideo");  // <video> element
  const heroBanner  = document.querySelector(".hero-banner");   // wrapper for video
  const container   = document.getElementById("cardsContainer");// where cards go

  // On detail pages, hide the banner entirely
  if (spotId && heroBanner) {
    heroBanner.style.display = "none";
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 3: Pick random hero video and autoplay exactly once (list only)
  // ────────────────────────────────────────────────────────────────────────────
  let chosenVideo = null;
  if (!spotId && heroVideoEl) {
    chosenVideo = HERO_VIDEOS[Math.floor(Math.random() * HERO_VIDEOS.length)];
    // Autoplay once on load:
    heroVideoEl.src = `${VIDEOS_DIR}/${chosenVideo}`;
    heroVideoEl
      .play()
      .catch(() => {
        // If autoplay is blocked, user can tap the translucent button.
      });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 4: Fetch all spots or a single spot
  // ────────────────────────────────────────────────────────────────────────────
  if (spotId) {
    fetchSingleSpot(spotId);
  } else {
    fetchAllSpots();
  }

  function fetchAllSpots() {
    fetch(`${API_BASE}/paddlingOut`)
      .then(resp => resp.json())
      .then(spots => {
        container.innerHTML = "";
        container.classList.remove("single-card");
        spots.forEach(spot => {
          const cardNode = renderCard(spot);
          container.appendChild(cardNode);
        });
        wireUpCarousels();
      })
      .catch(() => showError("Error loading spots."));
  }

  function fetchSingleSpot(id) {
    fetch(`${API_BASE}/paddlingOut/${encodeURIComponent(id)}`)
      .then(resp => {
        if (!resp.ok) throw new Error("Not found");
        return resp.json();
      })
      .then(spot => {
        container.innerHTML = "";
        container.classList.add("single-card"); // center this one card
        const cardNode = renderCard(spot);
        container.appendChild(cardNode);
        wireUpCarousels();
      })
      .catch(() => showError("Spot not found."));
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 5: Build one “card” from the <template id="card-template">
  // ────────────────────────────────────────────────────────────────────────────
  function renderCard(spot) {
    // Clone <template> to create a new card element:
    const template = document.getElementById("card-template");
    const clone    = template.content.cloneNode(true);
    const card     = clone.querySelector(".card");

    // 5a) Populate images in .img-container
    const imgContainer = card.querySelector(".img-container");
    spot.imgSrc.forEach((url, i) => {
      const img = document.createElement("img");
      img.src = url;
      img.dataset.index = i;
      img.classList.add("carousel-image");
      if (i === 0) img.classList.add("active");
      imgContainer.appendChild(img);
    });

    // 5b) Populate dots in .image-indicator
    const dotContainer = card.querySelector(".image-indicator");
    spot.imgSrc.forEach((_, i) => {
      const dot = document.createElement("span");
      dot.classList.add("indicator-dot");
      if (i === 0) dot.classList.add("active");
      dot.dataset.index = i;
      dot.addEventListener("click", e => {
        e.stopPropagation();
        showImageInThisCard(card, i);
      });
      dotContainer.appendChild(dot);
    });

    // 5c) Fill in title/subtitle/description
    card.querySelector(".card-title").textContent       = spot.title;
    card.querySelector(".card-subtitle").textContent    = spot.subtitle;
    card.querySelector(".card-description").textContent = spot.text;

    // 5d) Footer icons
    const footer = card.querySelector(".card-footer");
    if (spot.parkingAvl === true) {
      const el = document.createElement("span");
      el.className = "icon parking-icon";
      el.title = "Parking Available";
      el.addEventListener("click", e => e.stopPropagation());
      footer.appendChild(el);
    }
    if (spot.restroomsAvl === true) {
      const el = document.createElement("span");
      el.className = "icon toilet-icon";
      el.title = "Restrooms Available";
      el.addEventListener("click", e => e.stopPropagation());
      footer.appendChild(el);
    }
    if (spot.youtubeURL && spot.youtubeURL.trim() !== "") {
      const el = document.createElement("span");
      el.className = "icon youtube-icon";
      el.title = "Video";
      el.addEventListener("click", e => {
        e.stopPropagation();
        openYoutube(spot.youtubeURL);
      });
      footer.appendChild(el);
    }
    // Always show location icon
    {
      const el = document.createElement("span");
      el.className = "icon location-icon";
      el.title = "Take me there";
      el.addEventListener("click", e => {
        e.stopPropagation();
        openLocation(spot.location.latitude, spot.location.longitude);
      });
      footer.appendChild(el);
    }

    // 5e) Clicking the card (except icons) navigates to detail
    card.addEventListener("click", () => {
      window.location.href = `paddlingout.html?id=${spot.id}`;
    });

    return card;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 6: Helper to show “image index” in the given card
  // ────────────────────────────────────────────────────────────────────────────
  function showImageInThisCard(card, index) {
    const imgs = card.querySelectorAll(".carousel-image");
    const dots = card.querySelectorAll(".indicator-dot");
    let curr = 0;
    imgs.forEach((img, i) => {
      if (img.classList.contains("active")) curr = i;
    });
    const newIndex = (index + imgs.length) % imgs.length;
    imgs.forEach((img, i) => {
      img.classList.toggle("active", i === newIndex);
    });
    dots.forEach((d, i) => {
      d.classList.toggle("active", i === newIndex);
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 7: Attach swipe logic to all cards in container
  // ────────────────────────────────────────────────────────────────────────────
  function wireUpCarousels() {
    container.querySelectorAll(".card").forEach(card => {
      const imgs = card.querySelectorAll(".carousel-image");
      let startX = 0;

      const onPointerDown = e => {
        startX = e.clientX;
      };
      const onPointerUp = e => {
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 40) {
          let curr = 0;
          imgs.forEach((img, i) => {
            if (img.classList.contains("active")) curr = i;
          });
          const newIndex = dx < 0 ? curr + 1 : curr - 1;
          showImageInThisCard(card, newIndex);
        }
      };

      const pic = card.querySelector(".img-container");
      pic.addEventListener("pointerdown", onPointerDown);
      pic.addEventListener("pointerup", onPointerUp);
      pic.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
      }, { passive: true });
      pic.addEventListener("touchend", e => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) {
          let curr = 0;
          imgs.forEach((img, i) => {
            if (img.classList.contains("active")) curr = i;
          });
          const newIndex = dx < 0 ? curr + 1 : curr - 1;
          showImageInThisCard(card, newIndex);
        }
      });
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 8: Simple error-message helper
  // ────────────────────────────────────────────────────────────────────────────
  function showError(msg) {
    container.innerHTML = `<div class="error">${msg}</div>`;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 9: Expose global helpers (onclick attributes in icons)
  // ────────────────────────────────────────────────────────────────────────────
  window.openYoutube = url => window.open(url, "_blank");
  window.openLocation = (lat, lon) =>
    window.open(`https://maps.google.com?q=${lat},${lon}`, "_blank");

  // ────────────────────────────────────────────────────────────────────────────
  // STEP 10: Insert current year into the footer
  // ────────────────────────────────────────────────────────────────────────────
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CARET TOGGLE: show/hide the .hero-banner when clicked
  // ────────────────────────────────────────────────────────────────────────────
  const videoToggle = document.getElementById("videoToggle");
  if (videoToggle && heroBanner) {
    function updateToggleIcon() {
      const iconEl = videoToggle.querySelector(".material-icons");
      if (document.querySelector(".header").classList.contains("collapsed")) {
        iconEl.textContent = "expand_more"; // down‐caret
      } else {
        iconEl.textContent = "expand_less"; // up‐caret
      }
    }

    // Initialize on load (no “collapsed” → up‐caret)
    updateToggleIcon();

    videoToggle.addEventListener("click", () => {
      document.querySelector(".header").classList.toggle("collapsed");
      updateToggleIcon();
    });
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PLAY/PAUSE/REPLAY BUTTON (semi-transparent circle over video)
  // ────────────────────────────────────────────────────────────────────────────
  const videoControlBtn  = document.getElementById("videoControlButton");
  const videoControlIcon = videoControlBtn.querySelector(".material-icons");
  const videoElem        = document.getElementById("previewVideo");

  if (videoControlBtn && videoElem) {
    function setControlIcon(name) {
      videoControlIcon.textContent = name;
    }

    videoControlBtn.addEventListener("click", () => {
      // If never started or ended, rewind & play
      if ((!videoElem.src || videoElem.currentTime >= videoElem.duration) && chosenVideo) {
        videoElem.currentTime = 0;
        videoElem.play();
        return;
      }
      // If paused, play; if playing, pause
      if (videoElem.paused) {
        videoElem.play();
      } else {
        videoElem.pause();
      }
    });

    videoElem.addEventListener("play", () => {
      setControlIcon("pause");
    });
    videoElem.addEventListener("pause", () => {
      if (videoElem.currentTime < videoElem.duration) {
        setControlIcon("play_arrow");
      }
    });
    videoElem.addEventListener("ended", () => {
      setControlIcon("replay");
    });

    // Initialize the correct icon: if autoplay failed, videoElem.paused is true → show ▶
    if (videoElem.paused) {
      setControlIcon("play_arrow");
    } else {
      setControlIcon("pause");
    }
  }
});