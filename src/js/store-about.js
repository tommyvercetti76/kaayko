/**
 * store-about.js — the store's About page.
 *
 * Exhibits — a handful of real products with real buy links. Not an inventory dump;
 * the store page already does that better.
 */

import { priceText } from "/js/priceMap.js";
import { getAllProducts } from "/js/services/storeApi.js";
import { esc } from "/js/kit.js";

/** Same PDP routing the grid uses — animal SKUs get the animal page. */
function pdpUrl(p) {
  return p.animalSlug
    ? `/store/p/${encodeURIComponent(p.id)}`
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
   Boot
   ========================================================================== */

export async function storeAboutInit() {
  let products = [];
  try {
    products = (await getAllProducts()).filter((p) => p.isAvailable === true);
    renderExhibits(products);
  } catch (err) {
    console.error("about: catalogue fetch failed:", err);
    const host = document.getElementById("exhibits");
    if (host) host.innerHTML = `<p class="col-empty">The catalogue is not answering. <a href="/store">Try the store</a>.</p>`;
  }
}
