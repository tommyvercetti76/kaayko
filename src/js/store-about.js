/**
 * store-about.js — the store's About page.
 *
 * Two jobs:
 *   1. Exhibits — a handful of real products with real buy links. Not an inventory dump;
 *      the store page already does that better.
 *   2. The Arcade — three fake machines that refuse to sell you anything. They are jokes,
 *      but each one ends on a real product link, because a joke that sells nothing is
 *      just a website.
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

const pick = (products, fn) => products.find(fn);

/* ==========================================================================
   Exhibits — four things, and the case against each one
   ========================================================================== */

const EXHIBIT_CASES = [
  { match: (p) => p.productType === "bottle",
    caption: "A stamp from before your parents met, engraved by a man who signed his work, now holding your water." },
  { match: (p) => p.productType === "tote",
    caption: "An animal with no press office and no quarterly targets, on a bag you will actually carry." },
  { match: (p) => p.productType === "tshirt" && /philately/.test((p.tags || []).join()),
    caption: "Somebody cut this into a metal plate by hand. It has outlived three currencies. Now it is a shirt." },
  { match: (p) => p.productType === "magnet",
    caption: "The smallest thing we make. Cheaper than the coffee you are drinking while reading this about coffee." }
];

function renderExhibits(products) {
  const host = document.getElementById("exhibits");
  if (!host) return;

  const chosen = [];
  for (const c of EXHIBIT_CASES) {
    const p = pick(products, (x) => c.match(x) && !chosen.some((y) => y.p.id === x.id));
    if (p) chosen.push({ p, caption: c.caption });
  }
  if (!chosen.length) {
    host.innerHTML = `<p class="col-empty">The catalogue is not answering. <a href="/store">Go and look for yourself</a>.</p>`;
    return;
  }

  host.innerHTML = `
    <ul class="exhibit-grid">
      ${chosen.map(({ p, caption }, i) => `
        <li class="exhibit">
          <a class="exhibit-link" href="${esc(pdpUrl(p))}">
            <span class="exhibit-no">Exhibit ${String.fromCharCode(65 + i)}</span>
            ${p.imgSrc?.[0] ? `<img class="exhibit-img" src="${esc(p.imgSrc[0])}" alt="${esc(p.title)}" loading="lazy">` : ""}
            <span class="exhibit-title">${esc(p.title)}</span>
            <span class="exhibit-price">${esc(priceText(p))}</span>
          </a>
          <p class="exhibit-caption">${esc(caption)}</p>
          <a class="exhibit-buy" href="${esc(pdpUrl(p))}">Buy it anyway &rarr;</a>
        </li>
      `).join("")}
    </ul>`;
}

/* ==========================================================================
   Machine 1 — Purchase Approval Terminal. It never approves anything.
   ========================================================================== */

const DENIALS = [
  "Application received. Application denied. Reason: you already have two.",
  "Appeal logged. Appeal denied. Reason: the appeal was itself a third item.",
  "Escalated to a manager. The manager owns two things and is extremely happy.",
  "Form 2B rejected. Field marked 'why' contained the word 'because'.",
  "Referred to committee. Committee adjourned and went outside.",
  "Denied. We looked in your cupboard. You know what we found. More cupboard."
];

function initApproval(products) {
  const host = document.getElementById("game-approval");
  if (!host) return;
  const closer = pick(products, (p) => p.productType === "magnet") || products[0];
  let step = 0;

  const paint = () => {
    if (step >= DENIALS.length) {
      host.innerHTML = `
        <p class="machine-out">Application closed. You are cleared for <strong>two</strong> items,
        the same as everybody else, permanently.</p>
        ${closer ? `<a class="machine-cta" href="${esc(pdpUrl(closer))}">Start with the cheapest one &rarr;</a>` : ""}`;
      return;
    }
    host.innerHTML = `
      <p class="machine-out" role="status" aria-live="polite">${esc(DENIALS[step])}</p>
      <div class="machine-actions">
        <button type="button" class="machine-btn" data-act="appeal">${step === 0 ? "Submit application" : "Appeal"}</button>
        <button type="button" class="machine-btn ghost" data-act="quit">Withdraw with dignity</button>
      </div>`;
    host.querySelector('[data-act="appeal"]').addEventListener("click", () => { step += 1; paint(); });
    host.querySelector('[data-act="quit"]').addEventListener("click", () => { step = DENIALS.length; paint(); });
  };
  paint();
}

/* ==========================================================================
   Machine 2 — Nostalgia Meter. Drag the year, watch the standards collapse.
   ========================================================================== */

const ERAS = [
  { year: 1953, craft: "Engraved by hand at the India Security Press.", life: "Still sharp enlarged four times.", who: "The engraver signed it." },
  { year: 1969, craft: "Drawn, proofed and printed by people who could be named.", life: "Survived a monsoon in an album.", who: "The printer signed it." },
  { year: 1988, craft: "Offset, but somebody still checked the colour by eye.", life: "Fading, honestly.", who: "A department signed it." },
  { year: 2004, craft: "Designed on a machine that beeped a great deal.", life: "Lost when the drive died.", who: "Nobody signed it." },
  { year: 2026, craft: "Rendered by committee, approved by a dashboard.", life: "Expires Tuesday.", who: "Nobody will admit to it." }
];

function initNostalgia(products) {
  const host = document.getElementById("game-nostalgia");
  if (!host) return;
  const stamp = pick(products, (p) => p.productType === "bottle") || products[0];

  host.innerHTML = `
    <label class="meter-label" for="meter">Drag it forward. Watch what happens.</label>
    <input id="meter" class="meter" type="range" min="0" max="${ERAS.length - 1}" step="1" value="0"
           aria-describedby="meter-out">
    <div class="meter-scale" aria-hidden="true">${ERAS.map((e) => `<span>${e.year}</span>`).join("")}</div>
    <dl id="meter-out" class="meter-out" role="status" aria-live="polite"></dl>
    ${stamp ? `<a class="machine-cta" href="${esc(pdpUrl(stamp))}">Buy the good year &rarr;</a>` : ""}`;

  const out = host.querySelector("#meter-out");
  const input = host.querySelector("#meter");
  const paint = () => {
    const e = ERAS[Number(input.value)];
    out.innerHTML = `
      <div><dt>Year</dt><dd>${e.year}</dd></div>
      <div><dt>Craft</dt><dd>${esc(e.craft)}</dd></div>
      <div><dt>Lifespan</dt><dd>${esc(e.life)}</dd></div>
      <div><dt>Accountability</dt><dd>${esc(e.who)}</dd></div>`;
  };
  input.addEventListener("input", paint);
  paint();
}

/* ==========================================================================
   Machine 3 — Consumer Compliance Test. Every answer is wrong.
   ========================================================================== */

const QUIZ = [
  {
    q: "The basket holds two items. You want three. Correct action?",
    a: [
      ["Buy two and leave.", "Right action, wrong instinct. You hesitated. We saw."],
      ["Open a second browser.", "Reported to nobody, because we do not know who you are."],
      ["Complain on the internet.", "The internet is full. Try a window."]
    ]
  },
  {
    q: "You are asked to create an account. You:",
    a: [
      ["Create one.", "There is no account. You typed into a picture of a form."],
      ["Use a throwaway email.", "Still no account. You have outwitted nothing."],
      ["Check out as a guest.", "There was never another option. This was not a test of you."]
    ]
  },
  {
    q: "Something you own breaks. You:",
    a: [
      ["Replace it immediately.", "The old one was fine. You were bored."],
      ["Repair it.", "Suspicious. Nobody does this. Are you from 1953?"],
      ["Buy two replacements.", "The basket holds two. This is not the loophole you think it is."]
    ]
  }
];

function initCompliance(products) {
  const host = document.getElementById("game-compliance");
  if (!host) return;
  const tee = pick(products, (p) => p.productType === "tshirt") || products[0];
  let i = 0;

  const paint = () => {
    if (i >= QUIZ.length) {
      host.innerHTML = `
        <p class="machine-score">0 / ${QUIZ.length}</p>
        <p class="machine-out">Certified Non-Compliant. No refunds on dignity. Shop accordingly.</p>
        ${tee ? `<a class="machine-cta" href="${esc(pdpUrl(tee))}">Accept the verdict &rarr;</a>` : ""}`;
      return;
    }
    const r = QUIZ[i];
    host.innerHTML = `
      <p class="machine-progress">Question ${i + 1} of ${QUIZ.length}</p>
      <p class="machine-q">${esc(r.q)}</p>
      <div class="machine-options">
        ${r.a.map(([label], n) => `<button type="button" class="machine-btn" data-n="${n}">${esc(label)}</button>`).join("")}
      </div>
      <p class="machine-verdict" role="status" aria-live="polite"></p>`;
    host.querySelectorAll(".machine-btn").forEach((b) => b.addEventListener("click", () => {
      const verdict = host.querySelector(".machine-verdict");
      verdict.textContent = r.a[Number(b.dataset.n)][1];
      host.querySelectorAll(".machine-options .machine-btn").forEach((x) => { x.disabled = true; });
      const next = document.createElement("button");
      next.type = "button";
      next.className = "machine-btn next";
      next.textContent = i === QUIZ.length - 1 ? "See verdict" : "Next question";
      next.addEventListener("click", () => { i += 1; paint(); });
      verdict.after(next);
      next.focus();
    }));
  };
  paint();
}

/* ==========================================================================
   Boot
   ========================================================================== */

export async function storeAboutInit() {
  let products = [];
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error(res.statusText);
    const payload = await res.json();
    products = (payload.products || []).filter((p) => p.isAvailable === true);
    renderExhibits(products);
  } catch (err) {
    console.error("about: catalogue fetch failed:", err);
    const host = document.getElementById("exhibits");
    if (host) host.innerHTML = `<p class="col-empty">The catalogue is not answering. <a href="/store">Try the store</a>.</p>`;
  }
  // The machines are jokes, not shopfronts: they still run without the catalogue,
  // minus their closing product link.
  initApproval(products);
  initNostalgia(products);
  initCompliance(products);
}
