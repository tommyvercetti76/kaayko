/**
 * arcade/reward.js — the one place that knows about reward codes in the browser.
 *
 * A code is won at the Beggathon — on a product page or at the cart (up to 10% off the
 * whole bag) — and has to survive the walk between them, so it is kept in
 * localStorage. That store is a convenience only — the code is re-checked by the API
 * at checkout, and an expired or reused one takes nothing off however it got there.
 *
 * EXPIRY. Every code dies ONE HOUR after it is minted, claimed or not. That is the
 * server's rule (arcade/arcade.js, REWARD_TTL_MS) and this file only mirrors it so the
 * page can stop offering a code that is already dead.
 */

import { request } from "/js/services/storeApi.js";
export { esc } from "/js/kit.js";

const KEY = "kaayko.arcade.reward";
const TOKEN_KEY = "kaayko.arcade.token";
export const TTL_MS = 60 * 60 * 1000;

/**
 * The client token every arcade call carries. It is what the penalty rules hang off:
 * paste strikes, the win cooldown, the attempt budget and this shopper's own plea
 * history are all keyed to it.
 *
 * Clearing site data throws it away and issues a clean one — that is the "cookie
 * refresh" the lockout copy refers to, and it is deliberately the way out. It buys a
 * clean discount slate and nothing else: the two-orders-a-month cap is keyed to the
 * checkout email, so rotating this does not buy a single extra order.
 */
export function clientToken() {
  try {
    let t = localStorage.getItem(TOKEN_KEY);
    if (!t) {
      t = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/-/g, "").slice(0, 32);
      localStorage.setItem(TOKEN_KEY, t);
    }
    return t;
  } catch (_) {
    // Private browsing: no token, so no penalties and no cooldowns either. The server
    // treats a tokenless caller as brand new every time, which is the safe direction.
    return null;
  }
}

/**
 * POST when a body is given, GET otherwise. Never throws: a dead, slow or
 * unreachable API is a false result with code OFFLINE, and the game copes.
 */
export async function api(path, body) {
  const token = clientToken();
  // GETs carry it in the query, POSTs in the body. Every route wants it.
  const url = body || !token ? path
    : `${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  const r = body
    ? await request(url, { method: "POST", body: { ...body, token } })
    : await request(url);
  if (r.offline || r.timeout || r.data == null) return { success: false, code: "OFFLINE" };
  return r.data;
}

/**
 * @param {{code:string, percent:number, scope?:string, game?:string, expiresInMinutes?:number}} r
 */
export function saveReward(r) {
  const ttl = (Number(r.expiresInMinutes) || 60) * 60000;
  try {
    localStorage.setItem(KEY, JSON.stringify({
      code: r.code, percent: r.percent, scope: r.scope || "eligible",
      game: r.game || null, mintedAt: Date.now(), expiresAt: Date.now() + ttl
    }));
  } catch (_) { /* private browsing: the code is still on screen to copy */ }
}

/**
 * A handed-out promo (a maker's friends' rate, printed on a card). Kept until
 * the shopper removes it or the server says no; there is no hour on it.
 * @param {{code:string, percent:number, scope?:string, label?:string|null}} r
 */
export function savePromo(r) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      code: String(r.code).toUpperCase(), percent: r.percent, scope: r.scope || "store",
      kind: "promo", label: r.label || null, mintedAt: Date.now(), expiresAt: null
    }));
  } catch (_) {}
}

/** The stored code, or null if there is none or it has run out. */
export function savedReward() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!r?.code) return null;
    if (r.expiresAt && r.expiresAt < Date.now()) { clearReward(); return null; }
    return r;
  } catch (_) { return null; }
}

export function clearReward() {
  try { localStorage.removeItem(KEY); } catch (_) {}
}

/** Whole minutes left on a stored reward, floored at zero. */
export const minutesLeft = (r) =>
  !r?.expiresAt ? 0 : Math.max(0, Math.ceil((r.expiresAt - Date.now()) / 60000));

/** Ask the server what it thinks of a code. The browser's copy is never the authority. */
export const checkCode = (code) => api(`/arcade/reward/${encodeURIComponent(String(code).toUpperCase())}`);

/**
 * A live "expires in N minutes" line. Calls back once a minute and once at zero.
 * @returns {Function} stop
 */
export function countdown(el, reward, onDead) {
  const tick = () => {
    const m = minutesLeft(reward);
    if (m <= 0) { el.textContent = "This code has expired."; onDead?.(); return stop(); }
    el.textContent = `Expires in ${m} minute${m === 1 ? "" : "s"}, used or not.`;
  };
  const id = setInterval(tick, 30000);
  const stop = () => clearInterval(id);
  tick();
  return stop;
}
