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

  // Single source of truth: KaaykoPrefs.kaaykoApiBase (prefs.js loads first),
  // which itself reads window.KAAYKO_API_BASE from prod-config.js.
  function endpoint() {
    return (Prefs() && Prefs().kaaykoApiBase) ? Prefs().kaaykoApiBase() : window.KAAYKO_API_BASE;
  }

  if (spotId) fetchSingle(spotId);
  else        fetchAll();

  //──────────────────────────────────────────────────────────────────────────────
  // List view
  //──────────────────────────────────────────────────────────────────────────────
  // Stale-while-revalidate for the list: the API is a scale-to-zero function
  // and more than half of its requests were cold starts (1–5 s of skeletons).
  // A returning visitor gets last visit's cards instantly; the live response
  // replaces them the moment it lands. Scores refresh every 15 min server-side,
  // so anything under 30 min old is worth painting.
  const LIST_CACHE_KEY = 'kaayko_po_list_v1';
  const LIST_CACHE_MAX_AGE_MS = 30 * 60 * 1000;
  function readListCache(url) {
    try {
      const raw = localStorage.getItem(LIST_CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || c.url !== url || !Array.isArray(c.spots) || !c.spots.length) return null;
      if (Date.now() - (c.at || 0) > LIST_CACHE_MAX_AGE_MS) return null;
      return c.spots;
    } catch (e) { return null; }
  }
  function writeListCache(url, spots) {
    try { localStorage.setItem(LIST_CACHE_KEY, JSON.stringify({ url, at: Date.now(), spots })); } catch (e) { /* quota / private mode */ }
  }

  function fetchAll() {
    const listUrl = Prefs() && Prefs().withCraft ? Prefs().withCraft(`${endpoint()}/paddlingOut`) : `${endpoint()}/paddlingOut`;
    const cached = readListCache(listUrl);
    if (cached) { lastSpots = cached; renderList(cached); }

    // Abort a cold/hung Cloud Function instead of shimmering skeletons forever.
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; if (ctrl) ctrl.abort(); }, cached ? 20000 : 10000);
    fetch(listUrl, ctrl ? { signal: ctrl.signal } : undefined)
      .then(r => r.json())
      .then(data => {
        clearTimeout(timer);
        const spots = Array.isArray(data) ? data : (data.data || data.spots || []);
        if (!spots.length && cached) return;          // keep the cached cards over an empty answer
        lastSpots = spots;
        writeListCache(listUrl, spots);
        // Same ids and same scores → nothing to repaint; avoids a flash for warm visitors.
        if (cached && JSON.stringify(cached.map(s => [s.id, s.paddleScore && s.paddleScore.rating])) ===
                      JSON.stringify(spots.map(s => [s.id, s.paddleScore && s.paddleScore.rating]))) return;
        renderList(spots);
      })
      .catch(() => { clearTimeout(timer); if (!cached) showError(timedOut ? "timeout" : "error"); });
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
        linkTo: v === 'minimal' ? 'forecast' : 'detail',
        // First two covers are the LCP candidates: fetch them at high priority.
        eager: i < 2
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
    const detailUrl = `${endpoint()}/paddlingOut/${encodeURIComponent(id)}`;
    fetch(Prefs() && Prefs().withCraft ? Prefs().withCraft(detailUrl) : detailUrl)
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
  // Boat type changes the scores themselves — refetch with the new craft param.
  window.addEventListener('kaayko:boattypechange', () => { if (spotId) fetchSingle(spotId); else fetchAll(); });

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
