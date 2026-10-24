/**
 * services/promo.js — promo codes in the browser.
 *
 * A promo is a code the owner or a maker hands out on purpose (a friends' rate on
 * a maker's card: kaay.store/s/<slug>?promo=CODE). It is held in localStorage so it
 * survives the walk from the shelf to the bag; that copy is a convenience only.
 * The API decides what a code is worth, twice: when it is applied (GET /promo/:code)
 * and again, from scratch, when the payment intent is priced.
 *
 * Replaced js/arcade/reward.js on 24 Oct 2026, when the store's games — which also
 * minted codes — were deleted.
 */

import { request } from "/js/services/storeApi.js";

const KEY = "kaayko.promo";
// Where a promo was held before 24 Oct 2026, beside the games' state. Read once, moved.
const OLD_KEY = "kaayko.arcade.reward";
const OLD_TOKEN_KEY = "kaayko.arcade.token";
// A held code is for the visit it came from. Kept forever, it auto-applied to a
// bag weeks later and the cart refused a code the shopper never typed (24 Oct 2026).
const HOLD_MS = 24 * 60 * 60 * 1000;

/** @param {{code:string, percent:number, scope?:string, label?:string|null}} p */
export function savePromo(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      code: String(p.code).toUpperCase(), percent: p.percent,
      scope: p.scope || "store", label: p.label || null, savedAt: Date.now(),
    }));
  } catch (_) { /* private browsing: the shopper can type it again */ }
}

/** The held promo, or null. */
export function savedPromo() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || "null");
    if (p?.code) {
      if (typeof p.savedAt === "number" && Date.now() - p.savedAt < HOLD_MS) return p;
      clearPromo();                       // stale, or from before codes carried a time
      return null;
    }
    const old = JSON.parse(localStorage.getItem(OLD_KEY) || "null");
    localStorage.removeItem(OLD_KEY);
    localStorage.removeItem(OLD_TOKEN_KEY);
    if (old?.code && old.kind === "promo") { savePromo(old); return savedPromo(); }
    return null;
  } catch (_) { return null; }
}

export function clearPromo() {
  try { localStorage.removeItem(KEY); } catch (_) {}
}

/**
 * Ask the server what a code is worth. Never throws: a dead, slow or unreachable
 * API is { success:false, code:'OFFLINE' }.
 */
export async function checkPromo(code) {
  const r = await request(`/promo/${encodeURIComponent(String(code).trim().toUpperCase())}`);
  if (r.offline || r.timeout || r.data == null) return { success: false, code: "OFFLINE" };
  return r.data;
}
