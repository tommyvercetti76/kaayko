/**
 * scripts/paddlingout.js
 *
 * • GET  /paddlingOut          → list all spots
 * • GET  /paddlingOut/:id      → single spot
 * • Renders an in-card carousel; clicking a card navigates
 *   to detail view (same page with ?id=<lakeName>).
 * • All icon & dot clicks use event.stopPropagation()
 * • Swipe left/right moves carousel sequentially
 */

const API_BASE = "https://us-central1-kaayko-api-dev.cloudfunctions.net/api";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("cardsContainer");
  const params    = new URLSearchParams(location.search);
  const spotId    = params.get("id");

  // 1) fetch list or single
  if (spotId) fetchSingleSpot(spotId);
  else        fetchAllSpots();

  /** GET all spots */
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

  /** GET one spot detail */
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
   * Build HTML for one spot card,
   * including in-card carousel images & dots.
   */
  function renderCard(spot) {
    // images
    let imgs = `<div class="img-container">`;
    spot.imgSrc.forEach((url, i) => {
      imgs += `<img src="${url}"
                    data-index="${i}"
                    class="carousel-image${i===0?" active":""}">`;
    });
    imgs += `</div>`;

    // dots
    let dots = `<div class="image-indicator">`;
    spot.imgSrc.forEach((_,i) => {
      dots += `<span class="indicator-dot${i===0?" active":""}"
                    data-index="${i}"
                    onclick="event.stopPropagation()"></span>`;
    });
    dots += `</div>`;

    // icons: add tabindex for mobile/tooltips
    const stop   = "onclick=\"event.stopPropagation()\"";
    const tab = "tabindex=\"0\"";
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
          <span class="icon parking-icon" title="Parking Available" ${tab} ${stop}></span>
          <span class="icon toilet-icon" title="Toilets Available" ${tab} ${stop}></span>
          <span class="icon youtube-icon"
                title="Video" ${tab}
                ${stop}; openYoutube('${spot.youtubeURL}')\"></span>
          <span class="icon location-icon"
                title="Take me there" ${tab}
                ${stop}; openLocation(${spot.location.latitude},${spot.location.longitude})\"></span>
        </div>
      </div>
    `;
  }

  /**
   * Wire up every card’s carousel:
   *  • dot clicks → show that slide
   *  • pointer/touch swipe → prev/next
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
      dots.forEach(dot => dot.addEventListener("click", () => {
        show(+dot.dataset.index);
      }));

      // swipe
      let startX = 0;
      const cont = card.querySelector(".img-container");
      cont.addEventListener("pointerdown", e => startX = e.clientX);
      cont.addEventListener("pointerup", e => {
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 40) show(dx < 0 ? idx+1 : idx-1);
      });
      cont.addEventListener("touchstart", e => startX = e.touches[0].clientX, {passive:true});
      cont.addEventListener("touchend", e => {
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) show(dx < 0 ? idx+1 : idx-1);
      });
    });
  }

  /** Open YouTube in new tab */
  window.openYoutube = url => window.open(url,"_blank");
  /** Open Google Maps */
  window.openLocation = (lat,lon) =>
    window.open(`https://maps.google.com?q=${lat},${lon}`,"_blank");

  /** show an error message in the grid */
  function showError(msg) {
    container.innerHTML = `<div class="error">${msg}</div>`;
  }
});