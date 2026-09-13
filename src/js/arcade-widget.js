/**
 * arcade-widget.js — the one game on a product page: the Beggathon.
 *
 * Since 13 Sep 2026 there is one game in the shop. The two machines (Franking Rush and
 * Mail Run) were retired: their files stay under js/arcade/ unreferenced by any page,
 * and the API answers /arcade/challenge with `playable:false, reason:"RETIRED"` so an
 * old tab cannot mint a machine code.
 *
 * THE GAME IS A TOGGLE. A won discount comes out of the seller's pocket, so the seller
 * decides: `kaaykoproducts/{id}.gamesEnabled`, or for a kreator's whole shelf
 * `kreators/{uid}.features.games` (off unless they turn it on). The server is the
 * authority (api/arcade/eligibility.js); this file only asks GET /arcade/games first so
 * a product whose seller opted out shows nothing at all, not a game that refuses.
 *
 * The plea is graded server-side (api/arcade/begScore.js); the browser decides nothing.
 * Codes expire ONE HOUR after they are minted, used or not, are worth at most 10% and
 * never more than $25, and losing never costs anything — nobody is ever charged above
 * the list price because of a game. The rules are at /legal/games.
 */

import { api } from "/js/arcade/reward.js";
export { savedReward } from "/js/arcade/reward.js";

/**
 * @param {HTMLElement} host
 * @param {string} productId Firestore doc id — the seller's switch is read against it.
 */
export async function mountArcade(host, productId) {
  if (!host || !productId) return;

  const gate = await api(`/arcade/games?productId=${encodeURIComponent(productId)}`);
  if (!gate?.success || gate.games !== true) { host.hidden = true; host.innerHTML = ""; return; }

  host.hidden = false;
  host.innerHTML = `
    <div class="arcade-card">
      <p class="arcade-eyebrow">The Beggathon &middot; up to 10% off the bag</p>
      <h3 class="arcade-title">Sixty seconds to talk him into it</h3>
      <div class="arcade-panel" id="apanel"></div>
      <p class="arcade-fine">A game of skill, not chance. Win it and up to 10% comes off the whole
        bag, this piece included; most pleas earn three or four. The code lasts an hour, used or
        not. Losing costs nothing &mdash; your price never goes up. <a href="/legal/games">The rules.</a></p>
    </div>`;

  const panel = host.querySelector("#apanel");
  const eyebrowEl = host.querySelector(".arcade-eyebrow");

  const { mountBeggathon } = await import("/js/arcade/beggathon.js");
  await mountBeggathon(panel, {
    bare: true,
    productId,
    onWin: (reward) => {
      if (reward.forgiven) {
        // Atonement: one accepted plea took a strike off the lock; no code is minted.
        const s = reward.surchargePercent || 0;
        eyebrowEl.textContent = s > 0
          ? `Locked · ${s} more accepted ${s === 1 ? "plea" : "pleas"} to unlock`
          : "Unlocked · discounts are open to you again";
        return;
      }
      eyebrowEl.textContent = `${reward.percent}% off the whole bag · in your cart`;
    }
  });
}
