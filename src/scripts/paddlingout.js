/**
 * scripts/paddlingout.js
 *
 * • GET /paddlingOut         → list all spots
 * • GET /paddlingOut/:id     → single spot
 * • Renders an in-card carousel; clicking a card → detail view
 * • All interactive elements stop propagation so icons & dots
 *   don’t trigger a card click (navigation).
 */

const API_BASE = "https://us-central1-kaayko-api-dev.cloudfunctions.net/api";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("cardsContainer");
  const params    = new URLSearchParams(window.location.search);
  const spotId    = params.get("id");

  // 1) Fetch list or single
  if (spotId) fetchSingleSpot(spotId);
  else        fetchAllSpots();

  /** GET /paddlingOut → list all spots */
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

  /** GET /paddlingOut/:id → single spot */
  function fetchSingleSpot(id) {
    fetch(`${API_BASE}/paddlingOut/${encodeURIComponent(id)}`)
      .then(r => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(spot => {
        container.innerHTML = renderCard(spot);
        wireUpCarousels();
      })
      .catch(() => showError("Spot not found."));
  }

  /**
   * Build one card’s HTML, including its carousel & dots.
   */
  function renderCard(spot) {
    // carousel images
    let imgs = `<div class="img-container" onclick="event.stopPropagation()">`;
    spot.imgSrc.forEach((url,i) => {
      imgs += `<img src="${url}" data-index="${i}"
                     class="carousel-image${i===0?" active":""}">`;
    });
    imgs += `</div>`;

    // indicator dots
    let dots = `<div class="image-indicator" onclick="event.stopPropagation()">`;
    spot.imgSrc.forEach((_,i) => {
      dots += `<span class="indicator-dot${i===0?" active":""}"
                    data-index="${i}"></span>`;
    });
    dots += `</div>`;

    // card markup
    return `
      <div class="card"
           onclick="location.href='paddlingout.html?id=${spot.id}'">
        ${imgs}
        ${dots}
        <div class="card-content">
          <h2 class="card-title">${spot.title}</h2>
          <p class="card-subtitle">${spot.subtitle}</p>
          <p class="card-description">${spot.text}</p>
        </div>
        <div class="card-footer">
          <span class="icon parking-icon"   title="Parking Available"></span>
          <span class="icon toilet-icon"    title="Toilets Available"></span>
          <span class="icon youtube-icon"   title="Video"
                onclick="event.stopPropagation();openYoutube('${spot.youtubeURL}')"></span>
          <span class="icon location-icon"  title="Take me there"
                onclick="event.stopPropagation();openLocation(${spot.location.latitude},${spot.location.longitude})"></span>
        </div>
      </div>
    `;
  }

  /**
   * After DOM insertion, wire up each carousel:
   * – dot clicks
   * – pointer/touch swipes
   */
  function wireUpCarousels() {
    container.querySelectorAll(".card").forEach(card => {
      const imgs = card.querySelectorAll(".carousel-image");
      const dots = card.querySelectorAll(".indicator-dot");
      let idx = 0;

      function show(i) {
        idx = (i + imgs.length) % imgs.length;
        imgs.forEach((img,j) => img.classList.toggle("active", j===idx));
        dots.forEach((d,j)  => d.classList.toggle("active", j===idx));
      }

      // dot clicks
      dots.forEach(dot => {
        dot.addEventListener("click", () => show(+dot.dataset.index));
      });

      // swipe handling
      let startX = 0;
      const cont = card.querySelector(".img-container");
      cont.addEventListener("pointerdown", e => startX = e.clientX);
      cont.addEventListener("pointerup",   e => {
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 30) show(dx < 0 ? idx+1 : idx-1);
      });
      cont.addEventListener("touchstart",  e => startX = e.touches[0].clientX, {passive:true});
      cont.addEventListener("touchend",    e => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 30) show(dx < 0 ? idx+1 : idx-1);
      });
    });
  }

  /** Open YouTube in new tab */
  window.openYoutube   = url => window.open(url, "_blank");
  /** Open Google Maps */
  window.openLocation  = (lat,lon) =>
    window.open(`https://maps.google.com?q=${lat},${lon}`, "_blank");

  /** Show error if fetch fails */
  function showError(msg) {
    container.innerHTML = `<div class="error">${msg}</div>`;
  }
});