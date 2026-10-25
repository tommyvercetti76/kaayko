/**
 * suggest.js — what "You may also like" shows under a product page (Rohan, 24 Oct 2026).
 *
 * Pure: a product and the catalogue in, an ordered list out; product.js draws it with
 * the store's own cards. The order is what a shopper would reach for next:
 *
 *   1. the same animal in its other forms — the sloth bear tote, magnet and mug;
 *   2. the same part of the world (Indian or African wildlife), or, for pieces with
 *      no animal (t-shirts, stamp bottles), the same theme;
 *   3. the same kind of thing (and, for a wildlife piece, any other wildlife);
 *   4. then what people love most (votes), then the newest.
 *
 * No more than half the list of one kind among the picks that are not the same animal
 * (capFor), so a mug page does not suggest a wall of mugs and a stamp bottle still
 * shows its neighbours; the cap is lifted only when nothing else is left. Sold-out pieces and the product itself are never suggested.
 */
import { animalFor, FIELD } from "/js/store-satire.js";

export const capFor = (n) => Math.max(2, Math.ceil(n / 2));
const AFRICA = /Kenya|Tanzania|Namibia|Botswana|South Africa|Uganda|Rwanda/;

/** "india" | "africa" | null — from the park the piece names. */
export function regionFor(product) {
  const a = animalFor(product);
  const park = a ? FIELD[a].park : "";
  if (!park) return null;
  return AFRICA.test(park) ? "africa" : "india";
}

const created = (p) => {
  const c = p?.createdAt;
  return Number(c?._seconds ?? c?.seconds ?? (typeof c === "string" ? Date.parse(c) / 1000 : 0)) || 0;
};
const type = (p) => String(p?.productType || "").toLowerCase();

/**
 * @param {object} product  the product on the page
 * @param {object[]} items  the catalogue (/products)
 * @param {number} [n]      how many
 * @returns {object[]}
 */
export function pickSuggestions(product, items, n = 8) {
  const animal = animalFor(product);
  const region = regionFor(product);
  const theme = String(product?.theme || "").trim().toLowerCase();
  const scored = (items || [])
    .filter((it) => it && it.id !== product?.id && it.isAvailable !== false && it.soldOut !== true && it.imgSrc?.length)
    .map((it) => {
      const sameAnimal = !!animal && animalFor(it) === animal;
      const near = region ? regionFor(it) === region
        : !!theme && String(it.theme || "").trim().toLowerCase() === theme;
      // a wildlife piece pulls other wildlife a little ahead of the t-shirts
      const kin = !!animal && !!animalFor(it);
      const score = (sameAnimal ? 8 : 0) + (near ? 3 : 0) + (type(it) === type(product) ? 2 : 0) + (kin ? 1 : 0);
      return { it, sameAnimal, score };
    })
    .sort((a, b) => (b.score - a.score)
      || ((Number(b.it.votes) || 0) - (Number(a.it.votes) || 0))
      || ((b.it.featured === true) - (a.it.featured === true))
      || (created(b.it) - created(a.it))
      || String(a.it.id).localeCompare(String(b.it.id)));

  const picks = [], held = [], perType = new Map(), cap = capFor(n);
  for (const s of scored) {
    if (picks.length >= n) break;
    const t = type(s.it);
    if (!s.sameAnimal && (perType.get(t) || 0) >= cap) { held.push(s); continue; }
    picks.push(s);
    if (!s.sameAnimal) perType.set(t, (perType.get(t) || 0) + 1);
  }
  for (const s of held) { if (picks.length >= n) break; picks.push(s); }
  return picks.map((s) => s.it);
}
