// MARK: - File: scripts/paddlingout.js

/**
 * scripts/paddlingout.js
 *
 * • Selects a random hero video from /assets
 * • GET /paddlingOut         → list all spots
 * • GET /paddlingOut/:id     → single spot
 * • Renders an in-card carousel; clicking a card → detail view
 * • Shows parking & restroom icons only if available (boolean)
 * • Shows YouTube icon only if a URL is provided
 */

const API_BASE    = "https://us-central1-kaayko-api-dev.cloudfunctions.net/api";
const VIDEOS_DIR  = "/assets"; // put your MP4s here
const HERO_VIDEOS = [ "paddle2.mp4" ];

document.addEventListener("DOMContentLoaded", () => {
  const params      = new URLSearchParams(location.search);
  const spotId      = params.get("id");
  const heroVideoEl = document.getElementById("previewVideo");
  const heroWrapper = document.querySelector(".hero-video");
  const container   = document.getElementById("cardsContainer");

  // Hide hero video on detail pages
  if (spotId && heroWrapper) {
    heroWrapper.style.display = "none";
  }

  // Pick random hero video on list page
  if (!spotId && heroVideoEl) {
    const choice = HERO_VIDEOS[Math.floor(Math.random() * HERO_VIDEOS.length)];
    heroVideoEl.src = `${VIDEOS_DIR}/${choice}`;
  }

  if (spotId) fetchSingleSpot(spotId);
  else       fetchAllSpots();

  function fetchAllSpots() {
    fetch(`${API_BASE}/paddlingOut`)
      .then(r => r.json())
      .then(spots => {
        container.innerHTML = "";
        container.classList.remove("single-card");
        spots.forEach(spot => {
          container.insertAdjacentHTML("beforeend", renderCard(spot));
        });
        wireUpCarousels();
      })
      .catch(() => showError("Error loading spots."));
  }

  function fetchSingleSpot(id) {
    fetch(`${API_BASE}/paddlingOut/${encodeURIComponent(id)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(spot => {
        container.innerHTML = renderCard(spot);
        container.classList.add("single-card");
        wireUpCarousels();
      })
      .catch(() => showError("Spot not found."));
  }

  function renderCard(spot) {
    // build the image carousel
    let imgs = `<div class="img-container">`;
    spot.imgSrc.forEach((url, i) =>
      imgs += `<img src="${url}" data-index="${i}" class="carousel-image${i===0?" active":""}">`
    );
    imgs += `</div>`;

    // build the page‐indicator dots
    let dots = `<div class="image-indicator">`;
    spot.imgSrc.forEach((_, i) =>
      dots += `<span class="indicator-dot${i===0?" active":""}" data-index="${i}" onclick="event.stopPropagation()"></span>`
    );
    dots += `</div>`;

    // footer icons (conditionally rendered)
    const hasParking   = spot.parkingAvl === true;
    const hasRestroom = spot.restroomsAvl === true;
    const hasVideo     = spot.youtubeURL && spot.youtubeURL.trim() !== "";

    let footer = "";
    if (hasParking) {
      footer += `<span class="icon parking-icon" title="Parking Available" onclick="event.stopPropagation()"></span>`;
    }
    if (hasRestroom) {
      footer += `<span class="icon toilet-icon" title="Toilets Available" onclick="event.stopPropagation()"></span>`;
    }
    if (hasVideo) {
      footer += `<span class="icon youtube-icon" title="Video" onclick="event.stopPropagation(); openYoutube('${spot.youtubeURL}')"></span>`;
    }
    // always show location icon
    footer += `<span class="icon location-icon" title="Take me there" onclick="event.stopPropagation(); openLocation(${spot.location.latitude},${spot.location.longitude})"></span>`;

    return `
      <div class="card" onclick="location.href='paddlingout.html?id=${spot.id}'">
        ${imgs}
        ${dots}
        <div class="card-content">
          <h2 class="card-title">${spot.title}</h2>
          <p class="card-subtitle">${spot.subtitle}</p>
          <p class="card-description">${spot.text}</p>
        </div>
        <div class="card-footer">
          ${footer}
        </div>
      </div>`;
  }

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

  function showError(msg) {
    container.innerHTML = `<div class="error">${msg}</div>`;
  }

  // expose globals
  window.openYoutube  = url => window.open(url, "_blank");
  window.openLocation = (lat, lon) => window.open(`https://maps.google.com?q=${lat},${lon}`, "_blank");
});