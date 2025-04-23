/**
 * scripts/paddlingout.js
 *
 * Client for the “Paddling Out” REST API.
 * • GET  /paddlingOut          → list all spots
 * • GET  /paddlingOut/:id      → single spot + images
 * • Renders a grid of cards; clicking a card navigates
 *   to detail view (same page with ?id=<lakeName>).
 * • Each card shows an image carousel with indicator dots
 *   below the image, above the title.
 *
 * Query string:
 *   • ?id=<lakeName>  → show only that spot
 */

const API_BASE = "https://us-central1-kaayko-api-dev.cloudfunctions.net/api";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("cardsContainer");
  const params    = new URLSearchParams(window.location.search);
  const spotId    = params.get("id");

  // 1) Decide list vs detail
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
        wireUpCardInteractions();
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
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(spot => {
        container.innerHTML = renderCard(spot);
        wireUpCardInteractions();
      })
      .catch(() => showError("Spot not found."));
  }

  /**
   * Build one card’s HTML, with data-attributes for carousel
   * @param {object} spot
   */
  function renderCard(spot) {
    // join URLs with pipe to store in data-imgsrc
    const imgs = spot.imgSrc;
    const dataImgs = imgs.join("|");
    const thumb = imgs[0] || "/images/placeholder.png";

    // build indicator dots
    let dotsHtml = `<div class="image-indicator">`;
    imgs.forEach((_, i) => {
      dotsHtml += `<span class="indicator-dot${i === 0 ? " active" : ""}" data-index="${i}"></span>`;
    });
    dotsHtml += `</div>`;

    return `
      <div
        class="card"
        data-id="${spot.id}"
        data-imgsrc="${dataImgs}"
        data-current="0"
        onclick="window.location='paddlingout.html?id=${spot.id}'"
      >
        <img
          class="card-image"
          src="${thumb}"
          alt="${spot.title}"
          loading="lazy"
        />
        ${dotsHtml}
        <div class="card-content">
          <h2 class="card-title">${spot.title}</h2>
          <p class="card-subtitle">${spot.subtitle}</p>
          <p class="card-description">${spot.text}</p>
        </div>
        <div class="card-footer">
          <span class="icon parking-icon"   title="Parking Available"></span>
          <span class="icon toilet-icon"    title="Toilets Available"></span>
          <span class="icon youtube-icon"   title="Video"
                onclick="openYoutube('${spot.youtubeURL}');event.stopPropagation()"></span>
          <span class="icon location-icon"  title="Take me there"
                onclick="openLocation(${spot.location.latitude},${spot.location.longitude});event.stopPropagation()"></span>
        </div>
      </div>`;
  }

  /**
   * After cards are in DOM, wire up each carousel & dots
   */
  function wireUpCardInteractions() {
    document.querySelectorAll(".card").forEach(card => {
      const imgEl = card.querySelector(".card-image");
      const dots  = card.querySelectorAll(".indicator-dot");
      const imgs  = card.dataset.imgsrc.split("|");
      let current  = 0;

      // dot-click changes image
      dots.forEach(dot => {
        dot.addEventListener("click", e => {
          e.stopPropagation();
          const idx = Number(dot.dataset.index);
          imgEl.src = imgs[idx];
          dots.forEach(d => d.classList.toggle("active", Number(d.dataset.index) === idx));
          card.dataset.current = idx;
          current = idx;
        });
      });

      // swipe/drag on image to change slide
      let startX = 0;
      imgEl.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
      imgEl.addEventListener("touchend", e => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) {
          const nextIdx = (current + (dx < 0 ? 1 : -1) + imgs.length) % imgs.length;
          imgEl.src = imgs[nextIdx];
          dots.forEach(d => d.classList.toggle("active", Number(d.dataset.index) === nextIdx));
          card.dataset.current = nextIdx;
          current = nextIdx;
        }
      });
      // desktop drag
      imgEl.addEventListener("pointerdown", e => { startX = e.clientX; });
      imgEl.addEventListener("pointerup",   e => {
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 50) {
          const nextIdx = (current + (dx < 0 ? 1 : -1) + imgs.length) % imgs.length;
          imgEl.src = imgs[nextIdx];
          dots.forEach(d => d.classList.toggle("active", Number(d.dataset.index) === nextIdx));
          card.dataset.current = nextIdx;
          current = nextIdx;
        }
      });
    });
  }

  /** Helper: open YouTube in new tab */
  window.openYoutube   = url => window.open(url, "_blank");
  /** Helper: open Google Maps */
  window.openLocation  = (lat, lon) => window.open(`https://maps.google.com?q=${lat},${lon}`, "_blank");

  /** Show an error if fetch fails */
  function showError(text) {
    container.innerHTML = `<div class="error">${text}</div>`;
  }
});