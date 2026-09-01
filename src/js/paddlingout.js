/**
 * paddlingout.js — the Paddling Out list & detail views.
 *
 * Cards are built by the shared window.PaddleCard component (js/components/PaddleCard.js),
 * so a lake looks and behaves identically here and on the About page. This file only:
 *   1) fetches spots (list vs single detail)
 *   2) orders favorites first + renders via PaddleCard in the user's chosen style
 *   3) re-renders instantly when the "Card style" preference changes (Settings)
 *   4) appends the "Add a lake" tile + inserts the footer year
 */

document.addEventListener("DOMContentLoaded", () => {
  const params    = new URLSearchParams(window.location.search);
  const spotId    = params.get("id");                 // present → detail view
  const container = document.getElementById("cardsContainer");
  if (!container) return;

  let lastSpots = null;                               // cache → re-render on style change, no refetch
  const Prefs = () => window.KaaykoPrefs;
  const variant = () => (Prefs() && Prefs().getCardStyle) ? Prefs().getCardStyle() : 'full';

  function endpoint() {
    if (window.FORCE_PRODUCTION_MODE && window.PRODUCTION_API_BASE) return window.PRODUCTION_API_BASE;
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return window.location.origin + '/api';
    return "https://api-vwcc5j4qda-uc.a.run.app";     // Production Functions v2
  }

  if (spotId) fetchSingle(spotId);
  else        fetchAll();

  //──────────────────────────────────────────────────────────────────────────────
  // List view
  //──────────────────────────────────────────────────────────────────────────────
  function fetchAll() {
    // Abort a cold/hung Cloud Function instead of shimmering skeletons forever.
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; if (ctrl) ctrl.abort(); }, 10000);
    fetch(`${endpoint()}/paddlingOut`, ctrl ? { signal: ctrl.signal } : undefined)
      .then(r => r.json())
      .then(data => {
        clearTimeout(timer);
        lastSpots = Array.isArray(data) ? data : (data.data || data.spots || []);
        renderList(lastSpots);
      })
      .catch(() => { clearTimeout(timer); showError(timedOut ? "timeout" : "error"); });
  }

  function renderList(spots) {
    if (!window.PaddleCard) { showError("Error loading spots."); return; }
    container.innerHTML = "";
    container.classList.remove("single-card");
    const v = variant();
    container.classList.toggle('minimal-list', v === 'minimal');

    let ordered = spots.slice();
    if (Prefs()) ordered = Prefs().sortFavoritesFirst(ordered);

    ordered.forEach((spot, i) => {
      const card = window.PaddleCard.create(spot, {
        variant: v,
        linkTo: v === 'minimal' ? 'forecast' : 'detail'
      });
      card.classList.add("card-enter");
      card.style.animationDelay = `${Math.min(i, 12) * 45}ms`;
      container.append(card);
    });
    container.append(renderSubmitEntryCard(v));

    // Signal the first-launch walkthrough that REAL cards are on screen (never fires on skeletons).
    try { window.dispatchEvent(new CustomEvent('kaayko:cardsrendered', { detail: { count: ordered.length } })); } catch (e) {}
  }

  //──────────────────────────────────────────────────────────────────────────────
  // Detail view (single spot) — always the full, detailed card
  //──────────────────────────────────────────────────────────────────────────────
  function fetchSingle(id) {
    fetch(`${endpoint()}/paddlingOut/${encodeURIComponent(id)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(spot => {
        if (!window.PaddleCard) { showError("Spot not found."); return; }
        container.innerHTML = "";
        container.classList.add("single-card");
        container.classList.remove("minimal-list");
        container.append(window.PaddleCard.create(spot, { variant: 'full', linkTo: 'detail' }));
      })
      .catch(() => showError("Spot not found."));
  }

  // Live re-render when the user flips Card style in Settings (no refetch needed).
  window.addEventListener('kaayko:cardstylechange', () => { if (lastSpots) renderList(lastSpots); });

  //──────────────────────────────────────────────────────────────────────────────
  // "Add a lake" tile — matches whichever card style is active
  //──────────────────────────────────────────────────────────────────────────────
  function renderSubmitEntryCard(v) {
    const openSubmitPage = () => { window.location.href = "/paddlingout/submitentry"; };

    if (v === 'minimal') {
      const tile = document.createElement("div");
      tile.className = "pcard-submit";
      tile.tabIndex = 0;
      tile.setAttribute("role", "link");
      tile.setAttribute("aria-label", "Add a new lake to Paddling Out");
      tile.innerHTML =
        '<span class="plus" aria-hidden="true">+</span>' +
        '<span class="t">Add a lake</span>' +
        '<span class="s">Anonymous is fine</span>';
      tile.addEventListener("click", openSubmitPage);
      tile.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSubmitPage(); }
      });
      return tile;
    }

    const card = document.createElement("article");
    card.className = "card submit-entry-card";
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", "Add a new lake to Paddling Out");
    card.innerHTML = `
      <div class="submit-entry-plus" aria-hidden="true">+</div>
      <div class="submit-entry-copy">
        <span class="submit-entry-kicker">Community entry</span>
        <h2>Add a new lake</h2>
        <p>Tell us the water, the launch hint, and a few basics. Anonymous is fine.</p>
        <span class="submit-entry-action">Submit entry</span>
      </div>
    `;
    card.addEventListener("click", openSubmitPage);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSubmitPage(); }
    });
    return card;
  }

  //──────────────────────────────────────────────────────────────────────────────
  // Inline error — honest copy + a real retry (no "list below" lie: that grid is
  // <noscript>-only and invisible here).
  //──────────────────────────────────────────────────────────────────────────────
  function showError(kind) {
    container.innerHTML = "";
    container.classList.remove('minimal-list');
    const notice = document.createElement("div");
    notice.className = "po-error";
    notice.setAttribute("role", "status");
    const line = kind === 'timeout'
      ? "Live scores are taking too long to load right now."
      : "We couldn’t load live scores right now.";
    const msg = document.createElement('p');
    msg.className = 'po-error-msg';
    msg.textContent = line;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'po-error-retry';
    retry.textContent = 'Try again';
    retry.addEventListener('click', function () {
      container.classList.add('minimal-list');
      container.innerHTML = '';
      for (var k = 0; k < 8; k++) { var s = document.createElement('div'); s.className = 'pcard-skeleton'; s.setAttribute('aria-hidden', 'true'); container.appendChild(s); }
      fetchAll();
    });
    notice.appendChild(msg); notice.appendChild(retry);
    container.appendChild(notice);
  }

  const yEl = document.getElementById("year");
  if (yEl) yEl.textContent = new Date().getFullYear();
});
