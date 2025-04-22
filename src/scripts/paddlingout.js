/**
 * scripts/paddlingout.js
 *
 * Client for the “Paddling Out” REST API.
 * • GET /paddlingOut          → list all spots
 * • GET /paddlingOut/:id      → single spot + images
 * • Renders a grid of cards, with a modal gallery on click
 *
 * Query string:
 *   • ?id=<lakeName>  → show only that spot
 */

const API_BASE = "https://us-central1-kaayko-api-dev.cloudfunctions.net/api";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("cardsContainer");
  const modal     = document.getElementById("myModal");
  const gallery   = document.querySelector(".modal-content .gallery");
  const params    = new URLSearchParams(window.location.search);
  const spotId    = params.get("id");

  // Kick off the right fetch
  if (spotId) {
    fetchSingleSpot(spotId);
  } else {
    fetchAllSpots();
  }

  /**
   * GET /paddlingOut → list all spots
   */
  function fetchAllSpots() {
    fetch(`${API_BASE}/paddlingOut`)
      .then(res => res.json())
      .then(spots => {
        container.innerHTML = "";
        spots.forEach(spot => {
          container.insertAdjacentHTML("beforeend", renderCard(spot));
        });
      })
      .catch(() => showError("Error loading spots."));
  }

  /**
   * GET /paddlingOut/:id → single spot
   * @param {string} id
   */
  function fetchSingleSpot(id) {
    fetch(`${API_BASE}/paddlingOut/${encodeURIComponent(id)}`)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(spot => {
        container.innerHTML = renderCard(spot);
      })
      .catch(() => showError("Spot not found."));
  }

  /**
   * Build one card’s HTML
   * @param {object} spot
   */
  function renderCard(spot) {
    const thumb = spot.imgSrc[0] || "/images/placeholder.png";
    return `
      <div class="card" data-id="${spot.id}"
           onclick="fetchAndOpenModal('${spot.id}')">
        <img class="card-image"
             src="${thumb}"
             alt="${spot.title}"
             loading="lazy" />
        <div class="card-content">
          <h2 class="card-title">${spot.title}</h2>
          <p class="card-subtitle">${spot.subtitle}</p>
          <p class="card-description">${spot.text}</p>
        </div>
        <div class="card-footer" onclick="event.stopPropagation()">
          <div class="footer-message"></div>
          ${
            spot.parkingAvl === "Y"
              ? `<span class="icon parking-icon"
                        title="Parking"
                        onclick="showMessage(this,'Parking Available')"></span>`
              : ``
          }
          ${
            spot.restroomsAvl === "Y"
              ? `<span class="icon toilet-icon"
                        title="Toilets"
                        onclick="showMessage(this,'Toilet Available')"></span>`
              : ``
          }
          <span class="icon youtube-icon"
                title="Video"
                onclick="openYoutube('${spot.youtubeURL}')"></span>
          <span class="icon location-icon"
                title="Take me there"
                onclick="openLocation(${spot.location.latitude},
                                      ${spot.location.longitude})"></span>
        </div>
      </div>
    `;
  }

  /**
   * Fetch images for one spot, then open modal gallery
   * @param {string} id
   */
  window.fetchAndOpenModal = id => {
    fetch(`${API_BASE}/paddlingOut/${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(spot => openModal(spot.imgSrc))
      .catch(() => console.error("Gallery load failed"));
  };

  /**
   * Fill modal with <img> elements & show it
   * @param {string[]} urls
   */
  window.openModal = urls => {
    gallery.innerHTML = "";
    urls.forEach(u => {
      const img = document.createElement("img");
      img.src = u;
      gallery.appendChild(img);
    });
    modal.style.display = "block";
    setTimeout(() => modal.classList.add("open"), 10);
  };

  /** Close the modal */
  window.closeModal = () => {
    modal.classList.remove("open");
    setTimeout(() => (modal.style.display = "none"), 300);
  };
  window.onclick = e => { if (e.target === modal) closeModal(); };

  /** Open YouTube link */
  window.openYoutube   = url => window.open(url, "_blank");
  /** Open Google Maps at coords */
  window.openLocation  = (lat, lon) => window.open(`https://maps.google.com?q=${lat},${lon}`, "_blank");

  /**
   * Show a temporary footer message on a card
   * @param {Element} el
   * @param {string} msg
   */
  window.showMessage = (el, msg) => {
    const msgEl = el.parentElement.querySelector(".footer-message");
    msgEl.textContent = msg;
    setTimeout(() => (msgEl.textContent = ""), 2000);
  };

  /** Display an error message in the grid */
  function showError(text) {
    container.innerHTML = `<div class="error">${text}</div>`;
  }
});