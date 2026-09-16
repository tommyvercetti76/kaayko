/**
 * pages/store.js — the store grid page (/store on kaayko.com, / on kaay.store).
 *
 * Glue only: fetch the catalogue through the one API service, hand it to the
 * grid and the filter modal, honour ?productID= / ?id= deep links and ?store=
 * slugs. Everything drawn on the page comes from kaayko_ui.js.
 */
import { cartManager } from "/js/cartManager.js";           // the bag exists before the header paints its badge
import "/js/sustainabilityAlert.js";                          // window.showSustainabilityAlert for the fit picker
import { getCatalogue, friendlyMessage } from "/js/services/storeApi.js";
import { setProductTypes } from "/js/productTypes.js";
import { populateCarousel, setupModalCloseHandlers } from "/js/kaayko_ui.js";
import { storeOriginalProducts } from "/js/kaaykoFilterModal.js";
import { esc } from "/js/kit.js";
import { checkCode, savePromo, savedReward } from "/js/arcade/reward.js";
import { show as showToast } from "/js/components/Toast.js";

void cartManager;

function renderFailure(message) {
  const carousel = document.getElementById("carousel");
  if (!carousel) return;
  carousel.innerHTML = `
    <div class="store-empty store-failure" role="alert">
      <h2>Couldn't load products</h2>
      <p>${esc(message)}</p>
      <button type="button" class="store-back-link store-retry" data-action="retry">Try again</button>
    </div>`;
  carousel.querySelector('[data-action="retry"]').addEventListener("click", () => location.reload());
}

/**
 * Check a promo code from the address and keep it if the server honours it.
 * @returns {Promise<{code:string, percent:number, label:string|null}|null>}
 */
async function holdPromo(raw) {
  const code = String(raw || "").trim().toUpperCase().slice(0, 32);
  if (!code) return null;
  const held = savedReward();
  if (held?.kind === "promo" && held.code === code) return { code, percent: held.percent, label: held.label || null };
  const res = await checkCode(code);
  if (!res?.success || res.kind !== "promo" || !res.valid) return null;
  savePromo({ code, percent: res.percent, scope: res.scope, label: res.label });
  showToast(`${res.percent}% off is held for your bag.`, { kind: "good" });
  return { code, percent: res.percent, label: res.label || null };
}

document.addEventListener("DOMContentLoaded", async () => {
  // The catalogue's images are the product; the context menu is not a download button.
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  setupModalCloseHandlers();

  let products;
  try {
    const catalogue = await getCatalogue();
    products = catalogue.products;
    setProductTypes(catalogue.productTypes);   // labels, section order, the coming-soon line
  } catch (err) {
    console.error("Failed to load products:", err);
    renderFailure(friendlyMessage(err, "The catalogue is not answering. Please try again."));
    return;
  }

  // The filter modal keeps the unfiltered list; Apply/Reset re-render from it.
  storeOriginalProducts(products);

  const params = new URLSearchParams(location.search);
  const pid = params.get("productID") || params.get("id");
  // A maker's shelf: /store?store=<slug> or the short form kaay.store/s/<slug>.
  const pathSegs = location.pathname.split("/").filter(Boolean);
  const pathSlug = pathSegs[0] === "s" && pathSegs[1] ? decodeURIComponent(pathSegs[1]) : "";
  const storeSlug = params.get("store") || pathSlug;
  // A maker's card can carry her friends' rate: kaay.store/s/<slug>?promo=CODE.
  // The server says what the code is worth; this only holds it for the bag.
  const promoHeld = await holdPromo(params.get("promo"));

  if (pid) {
    const match = products.find((p) => p.productID === pid);
    if (match) {
      populateCarousel([match]);
      document.getElementById("carousel")?.classList.add("single-card");
    } else {
      populateCarousel(products);
    }
    return;
  }

  if (storeSlug) {
    const storeProducts = products.filter((p) => p.storeSlug === storeSlug);
    const carousel = document.getElementById("carousel");
    if (!storeProducts.length) {
      if (carousel) carousel.innerHTML = `
        <div class="store-empty">
          <h2>No products found</h2>
          <p>This store doesn't have any products yet.</p>
          <a href="/store" class="store-back-link">Browse All Products</a>
        </div>`;
      return;
    }
    const storeName = storeProducts[0].storeName || storeSlug;
    document.title = `${storeName} - Kaayko Store`;
    if (carousel) {
      const banner = document.createElement("div");
      banner.className = "store-banner";
      banner.innerHTML = `
        <div class="store-banner-content">
          <h2 class="store-banner-name">${esc(storeName)}</h2>
          <p class="store-banner-count">${storeProducts.length} piece${storeProducts.length !== 1 ? "s" : ""}, printed to order</p>
          ${promoHeld ? `<p class="store-banner-promo">${esc(promoHeld.percent)}% off for friends is held for your bag. Code ${esc(promoHeld.code)}.</p>` : ""}
          <a href="/" class="store-banner-link">All pieces</a>
        </div>`;
      carousel.parentNode.insertBefore(banner, carousel);
    }
    populateCarousel(storeProducts);
    return;
  }

  populateCarousel(products);
});
