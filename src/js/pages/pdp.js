/**
 * pages/pdp.js — glue for both product detail pages.
 *
 *   <body data-pdp="product">  /store/p/:id  and  /p/:id   → js/product.js
 *   <body data-pdp="animal">   /animals/:slug                → js/animal.js
 *
 * The two pages used to carry the same 50-line inline script each. The id
 * comes from ?id= / ?slug= (local preview) or the last path segment
 * (production rewrites). The arcade mounts on product pages reached by path
 * on either host.
 */
import { cartManager } from "/js/cartManager.js";           // the bag exists before the header paints its badge
import "/js/sustainabilityAlert.js";                          // window.showSustainabilityAlert for the fit picker
import { setupModalCloseHandlers, openModal } from "/js/kaayko_ui.js";

void cartManager;

const kind = document.body.dataset.pdp === "animal" ? "animal" : "product";
const params = new URLSearchParams(location.search);
let id = params.get(kind === "animal" ? "slug" : "id") || "";
let fromPath = false;
if (!id) {
  const segments = location.pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "";
  id = last === kind ? "" : decodeURIComponent(last);
  fromPath = !!id;
}

setupModalCloseHandlers();

if (kind === "animal") {
  const { animalPageInit } = await import("/js/animal.js");
  animalPageInit(id, { openModal });
} else {
  const { productPageInit } = await import("/js/product.js");
  productPageInit(id, { openModal });
  if (fromPath) {
    const { mountArcade } = await import("/js/arcade-widget.js");
    mountArcade(document.getElementById("arcade-slot"), id);
  }
}
