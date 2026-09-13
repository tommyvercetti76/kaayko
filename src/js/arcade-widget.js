/**
 * arcade-widget.js — the one game on a product page: the Beggathon.
 *
 * Since 13 Sep 2026 there is one game in the shop. The two machines (Franking Rush and
 * Mail Run) were retired: their files stay under js/arcade/ unreferenced by any page,
 * and the API answers /arcade/challenge with `playable:false, reason:"RETIRED"` so an
 * old tab cannot mint a machine code.
 *
 * The Beggathon is offered on every product, premium or not. Argue for sixty seconds;
 * win it and up to 10% comes off the WHOLE bag, this piece included. The plea is graded
 * server-side (api/arcade/begScore.js); the browser decides nothing. Codes expire ONE
 * HOUR after they are minted, used or not — the winning screen says so and counts down.
 *
 * beggathon.js draws its own panel and winning screen (the man's arithmetic — four
 * axes, their weights, a line each). This file only puts the card around it.
 */

export { savedReward } from "/js/arcade/reward.js";

/**
 * @param {HTMLElement} host
 * @param {string} productId Firestore doc id (unused by the plea itself; kept so the
 *   call site reads the same as before and a future per-product rule has it).
 */
export async function mountArcade(host, productId) {
  if (!host || !productId) return;

  host.innerHTML = `
    <div class="arcade-card">
      <p class="arcade-eyebrow">The Beggathon &middot; up to 10% off the bag</p>
      <h3 class="arcade-title">A cat toy for your entertainment</h3>
      <div class="arcade-panel" id="apanel"></div>
      <p class="arcade-fine">Argue for sixty seconds. Win it and up to 10% comes off the whole
        bag, this piece included. Most pleas earn three or four. The code lasts an hour,
        used or not.</p>
    </div>`;

  const panel = host.querySelector("#apanel");
  const eyebrowEl = host.querySelector(".arcade-eyebrow");

  const { mountBeggathon } = await import("/js/arcade/beggathon.js");
  await mountBeggathon(panel, {
    bare: true,
    onWin: (reward) => {
      if (reward.forgiven) {
        // Atonement: a paste penalty came down a percent; no code is minted.
        const s = reward.surchargePercent || 0;
        eyebrowEl.textContent = s > 0
          ? `Locked · +${s}% for pasting`
          : "Settled · back to the ordinary price";
        return;
      }
      eyebrowEl.textContent = `${reward.percent}% off the whole bag · in your cart`;
    }
  });
}
