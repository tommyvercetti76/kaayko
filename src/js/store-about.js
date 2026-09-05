/**
 * store-about.js — the store's About page: the collection index and the
 * "Wild Guess" game, both built from one catalogue fetch.
 *
 * Everything on this page is real data. The game asks about taglines that are
 * actually printed on the shirts, and the index links to the same PDPs the
 * grid links to, so neither can drift from the shop.
 */

import { priceText } from "/js/priceMap.js";

const API_BASE = window.FORCE_PRODUCTION_MODE
  ? window.PRODUCTION_API_BASE
  : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? `${window.location.origin}/api`
      : "https://api-vwcc5j4qda-uc.a.run.app");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Same PDP routing the grid uses — animal SKUs get the animal page. */
function pdpUrl(p) {
  return p.animalSlug
    ? `/animals/${encodeURIComponent(p.animalSlug)}`
    : `/store/p/${encodeURIComponent(p.id)}`;
}

/* ==========================================================================
   The collection index
   ========================================================================== */

const GROUPS = [
  { type: "tshirt", label: "T-Shirts", note: "Jokes, told straight, printed large." },
  { type: "tote",   label: "Totes",    note: "Hand-drawn animals, on something you actually carry." },
  { type: "magnet", label: "Magnets",  note: "The smallest thing we make." }
];

function renderCollection(products) {
  const host = document.getElementById("collection");
  if (!host) return;

  const sections = GROUPS.map((g) => {
    const items = products.filter((p) => String(p.productType || "").toLowerCase() === g.type);
    if (!items.length) return "";
    const rows = items.map((p) => `
      <li>
        <a class="col-item" href="${esc(pdpUrl(p))}">
          <span class="col-name">${esc(p.title)}</span>
          ${p.description ? `<span class="col-line">${esc(p.description)}</span>` : ""}
          <span class="col-price">${esc(priceText(p))}</span>
        </a>
      </li>`).join("");
    return `
      <section class="col-group">
        <h3>${esc(g.label)} <span class="col-count">${items.length}</span></h3>
        <p class="col-note">${esc(g.note)}</p>
        <ul class="col-list">${rows}</ul>
      </section>`;
  }).join("");

  host.innerHTML = sections || `<p class="col-empty">The shop is being restocked. <a href="/store">Try the store</a>.</p>`;
}

/* ==========================================================================
   Wild Guess — five taglines, three names each
   ========================================================================== */

const ROUNDS = 5;
const CHOICES = 3;

/** Fisher–Yates, on a copy. */
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildRounds(products) {
  // Only SKUs whose tagline is a real line rather than a description of the
  // artwork — that is what makes the question a question.
  const playable = products.filter((p) => {
    const d = String(p.description || "").trim();
    return d.length > 0 && d.length <= 60;
  });
  if (playable.length < CHOICES + 1) return [];

  return shuffled(playable).slice(0, ROUNDS).map((answer) => {
    const decoys = shuffled(playable.filter((p) => p.id !== answer.id)).slice(0, CHOICES - 1);
    return { answer, options: shuffled([answer, ...decoys]) };
  });
}

function startGame(products) {
  const host = document.getElementById("game");
  if (!host) return;

  const rounds = buildRounds(products);
  if (!rounds.length) {
    host.innerHTML = `<p class="game-empty">The game needs the catalogue, and the catalogue is not answering. <a href="/store">Go shopping instead</a>.</p>`;
    return;
  }

  let i = 0;
  let score = 0;
  let locked = false;

  function paint() {
    const r = rounds[i];
    host.innerHTML = `
      <div class="game-head">
        <span class="game-progress">Round ${i + 1} of ${rounds.length}</span>
        <span class="game-score">Score ${score}</span>
      </div>
      <p class="game-prompt">Which one says<br><strong>&ldquo;${esc(r.answer.description)}&rdquo;</strong>?</p>
      <div class="game-options">
        ${r.options.map((o) => `<button type="button" class="game-option" data-id="${esc(o.id)}">${esc(o.title)}</button>`).join("")}
      </div>
      <p class="game-feedback" role="status" aria-live="polite"></p>
    `;
    locked = false;
    host.querySelectorAll(".game-option").forEach((b) => b.addEventListener("click", () => answer(b)));
  }

  function answer(btn) {
    if (locked) return;
    locked = true;
    const r = rounds[i];
    const correct = btn.dataset.id === r.answer.id;
    if (correct) score++;

    host.querySelectorAll(".game-option").forEach((b) => {
      b.disabled = true;
      if (b.dataset.id === r.answer.id) b.classList.add("is-right");
      else if (b === btn) b.classList.add("is-wrong");
    });

    const feedback = host.querySelector(".game-feedback");
    feedback.innerHTML = correct
      ? `Correct. <a href="${esc(pdpUrl(r.answer))}">See ${esc(r.answer.title)}</a>.`
      : `It was <a href="${esc(pdpUrl(r.answer))}">${esc(r.answer.title)}</a>.`;

    const next = document.createElement("button");
    next.type = "button";
    next.className = "game-next";
    next.textContent = i + 1 < rounds.length ? "Next" : "See score";
    next.addEventListener("click", () => { i++; i < rounds.length ? paint() : finish(); });
    feedback.after(next);
    next.focus();
  }

  function finish() {
    const verdict = score === rounds.length ? "You have read every shirt in the shop. Concerning."
      : score >= rounds.length - 1 ? "Close enough to be suspicious."
      : score >= 2 ? "A respectable showing for someone with a life."
      : "You are new here. Welcome.";
    host.innerHTML = `
      <div class="game-done">
        <p class="game-final">${score} / ${rounds.length}</p>
        <p class="game-verdict">${esc(verdict)}</p>
        <button type="button" class="game-again">Play again</button>
      </div>`;
    const again = host.querySelector(".game-again");
    again.addEventListener("click", () => startGame(products));
    again.focus();
  }

  paint();
}

/* ==========================================================================
   Boot
   ========================================================================== */

export async function storeAboutInit() {
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error(res.statusText);
    const payload = await res.json();
    // Same filter the grid applies: unpublished SKUs are not for sale and must
    // not appear in the index or the game.
    const products = (payload.products || []).filter((p) => p.isAvailable === true);
    renderCollection(products);
    startGame(products);
  } catch (err) {
    console.error("about: catalogue fetch failed:", err);
    const host = document.getElementById("collection");
    if (host) host.innerHTML = `<p class="col-empty">Couldn't load the collection. <a href="/store">Try the store</a>.</p>`;
    const game = document.getElementById("game");
    if (game) game.innerHTML = `<p class="game-empty">The game needs the catalogue, and the catalogue is not answering.</p>`;
  }
}
