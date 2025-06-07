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

const API_BASE    = "https://us-central1-kaayko-api-dev.cloudfunctions.net/api";
const VIDEOS_DIR  = "/src/assets";
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
    fetch(`${API_BASE}/paddlingOut`)
      .then(r => r.json())
      .then(spots => {
        container.innerHTML = "";
        container.classList.remove("single-card");
        spots.forEach(spot => container.append(renderCard(spot)));
        wireUpCarousels();
      })
      .catch(() => showError("Error loading spots."));
  }

  function fetchSingle(id) {
    fetch(`${API_BASE}/paddlingOut/${encodeURIComponent(id)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(spot => {
        container.innerHTML = "";
        container.classList.add("single-card");
        container.append(renderCard(spot));
        wireUpCarousels();
      })
      .catch(() => showError("Spot not found."));
  }

  //──────────────────────────────────────────────────────────────────────────────
  // Section 5: renderCard(spot) → Clones template & populates a .card element
  //──────────────────────────────────────────────────────────────────────────────
  function renderCard(spot) {
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

    // 5b) Populate text fields
    card.querySelector(".card-title").textContent       = spot.title;
    card.querySelector(".card-subtitle").textContent    = spot.subtitle;
    card.querySelector(".card-description").textContent = spot.text;

    // 5c) Footer icons
    if (spot.parkingAvl)   foot.append(icon("parking-icon",   "Parking Available"));
    if (spot.restroomsAvl) foot.append(icon("toilet-icon",    "Restrooms Available"));
    if (spot.youtubeURL)   foot.append(icon("youtube-icon",   "Video", () => openYoutube(spot.youtubeURL)));
    foot.append(icon("location-icon", "Take me there", () =>
      openLocation(spot.location.latitude, spot.location.longitude)
    ));

    // 5d) Card click → navigate to detail page
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
  // Section 7: wireUpCarousels() → Attaches swipe logic to each card
  //──────────────────────────────────────────────────────────────────────────────
  function wireUpCarousels() {
    container.querySelectorAll(".card").forEach(card => {
      let startX = 0;
      const imgs = card.querySelectorAll(".carousel-image");

      const onEnd = dx => {
        if (Math.abs(dx) < 40) return;
        const curr = [...imgs].findIndex(i => i.classList.contains("active"));
        showImage(card, dx < 0 ? curr + 1 : curr - 1);
      };

      const box = card.querySelector(".img-container");
      box.addEventListener("pointerdown", e => startX = e.clientX);
      box.addEventListener("pointerup",   e => onEnd(e.clientX - startX));
      box.addEventListener("touchstart",  e => startX = e.touches[0].clientX, { passive: true });
      box.addEventListener("touchend",    e => onEnd(e.changedTouches[0].clientX - startX));
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