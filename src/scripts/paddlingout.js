/**
 * scripts/paddlingout.js
 *
 * • Selects a random hero video from /assets
 * • GET /paddlingOut         → list all spots
 * • GET /paddlingOut/:id     → single spot
 * • Renders an in-card carousel; clicking a card → detail view
 */

const API_BASE   = "https://us-central1-kaayko-api-dev.cloudfunctions.net/api";
const VIDEOS_DIR = "/assets"; // put your MP4s here
const HERO_VIDEOS = [
  "paddle2.mp4"
];

document.addEventListener("DOMContentLoaded", () => {
  const params      = new URLSearchParams(location.search);
  const spotId      = params.get("id");
  const heroVideoEl = document.getElementById("previewVideo");
  const heroWrapper = document.querySelector(".hero-video");

  /**
   * Hide the entire hero-video wrapper on single-spot detail pages.
   */
  if (spotId && heroWrapper) {
    heroWrapper.style.display = "none";
  }

  /**
   * Select and assign a random hero video when not on a detail page.
   */
  if (!spotId && heroVideoEl) {
    const choice = HERO_VIDEOS[Math.floor(Math.random() * HERO_VIDEOS.length)];
    heroVideoEl.src = `${VIDEOS_DIR}/${choice}`;
  }

  const container = document.getElementById("cardsContainer");

  if (spotId) fetchSingleSpot(spotId);
  else       fetchAllSpots();

  /**
   * fetchAllSpots
   *
   * Fetches list of all paddling spots from the API
   * and renders a card for each spot.
   */
  function fetchAllSpots() {
    fetch(`${API_BASE}/paddlingOut`)
      .then(r => r.json())
      .then(spots => {
        container.innerHTML = "";
        spots.forEach(spot => {
          container.insertAdjacentHTML("beforeend", renderCard(spot));
        });
        wireUpCarousels();
      })
      .catch(() => showError("Error loading spots."));
  }

  /**
   * fetchSingleSpot
   *
   * Fetches details for a single spot by ID
   * and renders its card.
   *
   * @param {string} id - the spot identifier
   */
  function fetchSingleSpot(id) {
    fetch(`${API_BASE}/paddlingOut/${encodeURIComponent(id)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(spot => {
        container.innerHTML = renderCard(spot);
        wireUpCarousels();
      })
      .catch(() => showError("Spot not found."));
  }

  /**
   * renderCard
   *
   * Builds the HTML string for a spot card, including
   * its carousel images, indicators, and footer icons.
   *
   * @param {object} spot - the spot data object
   * @returns {string} HTML for the spot card
   */
  function renderCard(spot) {
    let imgs = `<div class="img-container">`;
    spot.imgSrc.forEach((url, i) =>
      imgs += `<img src="${url}" data-index="${i}" class="carousel-image${i===0?" active":""}">`
    );
    imgs += `</div>`;

    let dots = `<div class="image-indicator">`;
    spot.imgSrc.forEach((_, i) =>
      dots += `<span class="indicator-dot${i===0?" active":""}" data-index="${i}" onclick="event.stopPropagation()"></span>`
    );
    dots += `</div>`;

    return `
      <div class="card" onclick="location.href='paddlingout.html?id=${spot.id}'">
        ${imgs}${dots}
        <div class="card-content">
          <h2 class="card-title">${spot.title}</h2>
          <p class="card-subtitle">${spot.subtitle}</p>
          <p class="card-description">${spot.text}</p>
        </div>
        <div class="card-footer">
          <span class="icon parking-icon"    title="Parking Available" onclick="event.stopPropagation()"></span>
          <span class="icon toilet-icon"     title="Toilets Available" onclick="event.stopPropagation()"></span>
          <span class="icon youtube-icon"    title="Video" onclick="event.stopPropagation(); openYoutube('${spot.youtubeURL}')"></span>
          <span class="icon location-icon"   title="Take me there" onclick="event.stopPropagation(); openLocation(${spot.location.latitude},${spot.location.longitude})"></span>
        </div>
      </div>`;
  }

  /**
   * wireUpCarousels
   *
   * Attaches click and swipe handlers to each card's
   * images and indicator dots to enable carousel behavior.
   */
  function wireUpCarousels() {
    container.querySelectorAll(".card").forEach(card => {
      const imgs = card.querySelectorAll(".carousel-image");
      const dots = card.querySelectorAll(".indicator-dot");
      let idx = 0;
      const show = i => {
        idx = (i + imgs.length) % imgs.length;
        imgs.forEach((img, j) => img.classList.toggle("active", j===idx));
        dots.forEach((d, j)   => d.classList.toggle("active", j===idx));
      };

      dots.forEach(dot => dot.addEventListener("click", () => show(+dot.dataset.index)));

      let startX = 0;
      const pic = card.querySelector(".img-container");
      pic.addEventListener("pointerdown", e => startX = e.clientX);
      pic.addEventListener("pointerup",   e => {
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 40) show(dx < 0 ? idx+1 : idx-1);
      });
      pic.addEventListener("touchstart", e => startX = e.touches[0].clientX, {passive:true});
      pic.addEventListener("touchend",   e => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) show(dx < 0 ? idx+1 : idx-1);
      });
    });
  }

  /**
   * showError
   *
   * Displays an error message in the container.
   *
   * @param {string} msg - the message to display
   */
  function showError(msg) {
    container.innerHTML = `<div class="error">${msg}</div>`;
  }

  // Expose utility functions globally
  window.openYoutube  = url => window.open(url, "_blank");
  window.openLocation = (lat, lon) => window.open(`https://maps.google.com?q=${lat},${lon}`, "_blank");
});