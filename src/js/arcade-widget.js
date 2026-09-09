/**
 * arcade-widget.js — all three games on a product page, in one tab menu.
 *
 *   Franking Rush   2%     strike the lit band          magnets and bottles
 *   Mail Run        2%     hold to climb                magnets and bottles
 *   The Beggathon   3-10%  argue for sixty seconds      the WHOLE cart, premium included
 *
 * The two machines are refused on premium products: the API answers
 * `playable:false, reason:"PREMIUM"` and those two tabs render disabled. The Beggathon
 * is offered on every product, because arguing for a discount on a tote is the only way
 * anybody is ever getting one.
 *
 * The browser decides nothing. It is handed a seed, plays the run, and posts back the
 * inputs it recorded; the server replays them against the same rules
 * (arcade/gameRules.js, mirrored on both sides) and only then mints a code. The plea is
 * graded server-side too (api/arcade/begScore.js).
 *
 * Codes expire ONE HOUR after they are minted, whether or not they are used. It says so
 * on the winning screen, and the line counts down while it sits there.
 */

import { api, esc, saveReward, countdown } from "/js/arcade/reward.js";
import { MACHINES } from "/js/arcade/cabinet.js";

export { savedReward } from "/js/arcade/reward.js";

const TABS = [
  { id: "franking", label: "Franking Rush", hint: "strike",  kind: "machine" },
  { id: "mailrun",  label: "Mail Run",      hint: "hold",    kind: "machine" },
  { id: "beg",      label: "The Beggathon", hint: "type",    kind: "beg" }
];

/**
 * @param {HTMLElement} host
 * @param {string} productId Firestore doc id.
 */
export async function mountArcade(host, productId) {
  if (!host || !productId) return;
  host.innerHTML = `<p class="arcade-loading">Warming up the machines…</p>`;

  // One probe tells us whether this product is premium; the answer applies to both
  // machines, and the Beggathon does not care either way.
  let ch = await api(`/arcade/challenge?productId=${encodeURIComponent(productId)}&game=franking`);
  if (!ch?.success) { host.innerHTML = ""; return; }

  const premium = !ch.playable;
  const gamePct = ch.rewardPercent ?? 2;
  const ttl = ch.rewardExpiresInMinutes ?? 60;
  // A paste penalty on this browser changes what every tab is offering, so it has to
  // reach the copy — otherwise the footer promises a discount the banner has just
  // said is not coming.
  let locked = !!ch.locked;
  let surcharge = ch.surchargePercent || 0;
  let attemptsLeft = ch.attemptsAllowed ?? 5;
  let pick = premium || locked ? "beg" : "franking";
  let stopClock = null;
  let live = null;                       // the mounted machine, so it can be stopped
  let swapping = false;                  // one tab change at a time

  const runsLine = () => `${attemptsLeft} ${attemptsLeft === 1 ? "run" : "runs"} left`;

  const eyebrow = () => locked
    ? `Locked &middot; +${surcharge}% for pasting`
    : premium
      ? `Premium &middot; one way in`
      : `Three games &middot; ${gamePct}% or up to 10% &middot; ${runsLine()}`;

  const fine = () => locked
    ? `Nothing in the shop pays out while you are carrying +${surcharge}% for pasting.
       The Beggathon is the only way to work it off, one percent a time. Clearing this
       browser's stored data also clears it.`
    : pick === "beg"
      ? `Win it and up to 10% comes off the whole bag, this piece included.
         Most pleas earn three or four. The code lasts ${ttl} minutes, used or not.`
      : `Clear it and ${gamePct}% comes off the magnets and bottles in your order.
         The code lasts ${ttl} minutes from the moment you win it, used or not.`;

  const tabDisabled = (t) => t.kind === "machine" && (premium || locked);

  function shell() {
    return `
      <div class="arcade-card">
        <p class="arcade-eyebrow">${eyebrow()}</p>
        <h3 class="arcade-title">A cat toy for your entertainment</h3>
        <div class="arcade-tabs" role="tablist" aria-label="Pick a game">
          ${TABS.map((t) => `
            <button type="button" role="tab" class="arcade-tab" id="atab-${t.id}"
              data-pick="${t.id}" aria-controls="apanel"
              aria-selected="${pick === t.id}" tabindex="${pick === t.id ? 0 : -1}"
              ${tabDisabled(t) ? `disabled aria-disabled="true" title="${locked ? "Locked while you are carrying a paste penalty" : "Premium piece — no machines on this one"}"` : ""}>
              <span class="arcade-tab-name">${esc(t.label)}</span>
              <span class="arcade-tab-hint">${tabDisabled(t) ? (locked ? "locked" : "premium") : esc(t.hint)}</span>
            </button>`).join("")}
        </div>
        <div class="arcade-panel" id="apanel" role="tabpanel" aria-labelledby="atab-${pick}"></div>
        <p class="arcade-feedback" role="status" aria-live="polite"></p>
        <p class="arcade-fine">${fine()}</p>
      </div>`;
  }

  function wonCard(res) {
    const cart = res.scope === "cart";
    return `
      <div class="arcade-card is-won">
        <p class="arcade-eyebrow">${cart ? "He paid" : "Cleared"}</p>
        <h3 class="arcade-title">${res.percent}% off. Earned, not given.</h3>
        <p class="arcade-copy">It is already in your bag — the cart will offer it at checkout.
          Keep the code if you would rather type it yourself.</p>
        <p class="arcade-code"><code>${esc(res.code)}</code></p>
        <p class="arcade-fine" data-clock>Expires in ${ttl} minutes, used or not.</p>
        <button type="button" class="arcade-btn" data-act="copy">Copy code</button>
        <p class="arcade-fine">${cart
          ? "Applies to everything in the bag, premium included."
          : "Applies to magnets and bottles. Totes and shirts stay premium."}</p>
      </div>`;
  }

  function showWin(res) {
    live?.stop?.(); live = null;
    stopClock?.();
    saveReward({ ...res, expiresInMinutes: res.expiresInMinutes ?? ttl });
    host.innerHTML = wonCard(res);
    stopClock = countdown(host.querySelector("[data-clock]"),
      { expiresAt: Date.now() + (res.expiresInMinutes ?? ttl) * 60000 });
    host.querySelector('[data-act="copy"]').addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(res.code); e.target.textContent = "Copied"; }
      catch (_) { e.target.textContent = "Select it by hand"; }
    });
  }

  /**
   * Switch tabs WITHOUT rebuilding the card.
   *
   * The old version re-rendered the whole widget on every tab click. Between tearing
   * the card down and the new challenge arriving, the panel had no content and no
   * height, so the page collapsed and snapped back — that was the glitch. Now the shell
   * is built once, the panel keeps its height while the next game loads, and only the
   * inside of the panel changes.
   */
  async function choose(next) {
    const tab = TABS.find((t) => t.id === next);
    if (!tab || pick === next || tabDisabled(tab) || swapping) return;
    swapping = true;

    const panel = host.querySelector("#apanel");
    const tabs = [...host.querySelectorAll(".arcade-tab")];

    // Hold the height the panel already has, so nothing under it moves while we load.
    panel.style.minHeight = `${Math.ceil(panel.getBoundingClientRect().height)}px`;

    live?.stop?.(); live = null;
    pick = next;

    // The selection moves immediately: waiting for the network to answer before the
    // button lights up is what made it feel like the click had missed.
    tabs.forEach((b) => {
      const on = b.dataset.pick === pick;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", `atab-${pick}`);
    panel.classList.add("is-loading");

    if (pick !== "beg") {
      // A machine is a fresh challenge: a seed for one is meaningless to the other.
      ch = await api(`/arcade/challenge?productId=${encodeURIComponent(productId)}&game=${pick}`);
      attemptsLeft = ch?.attemptsAllowed ?? attemptsLeft;
      locked = !!ch?.locked; surcharge = ch?.surchargePercent || surcharge;
    }

    await fillPanel(panel);
    panel.classList.remove("is-loading");
    // Let it size itself again now there is something in it.
    requestAnimationFrame(() => { panel.style.minHeight = ""; });
    host.querySelector(".arcade-eyebrow").textContent = eyebrow().replace(/&middot;/g, "·");
    host.querySelector(".arcade-fine").textContent = fine().replace(/\s+/g, " ").trim();
    swapping = false;
  }

  /** Put the chosen game inside the panel. Everything around it is already there. */
  async function fillPanel(panel) {
    panel.innerHTML = "";
    const feedback = host.querySelector(".arcade-feedback");
    const eyebrowEl = host.querySelector(".arcade-eyebrow");
    feedback.textContent = "";

    if (pick === "beg") {
      // The Beggathon draws its own winning screen, because the whole point of it is
      // showing the man's arithmetic — four axes, their weights and a line each. A
      // generic "you won" card would throw that away. It saves the code itself.
      const { mountBeggathon } = await import("/js/arcade/beggathon.js");
      await mountBeggathon(panel, {
        bare: true,
        onWin: (reward) => {
          if (reward.forgiven) {
            surcharge = reward.surchargePercent || 0;
            locked = surcharge > 0;
            eyebrowEl.textContent = locked
              ? `Locked · +${surcharge}% for pasting`
              : "Settled · back to the ordinary price";
            return;
          }
          eyebrowEl.textContent = `${reward.percent}% off the whole bag · in your cart`;
        }
      });
      return;
    }

    const { mountMachine } = await import("/js/arcade/cabinet.js");
    live = mountMachine(panel, {
      id: pick, seed: ch.seed, height: 210,
      async onResult(r, ui) {
        if (!r.won) {
          const why = r.misfire > 0 && r.misfire >= (r.missed || 0)
            ? `${r.score} of ${r.target}, and ${r.misfire} stamps on bare desk.`
            : `${r.score} of ${r.target}. The machine keeps the coin.`;
          ui.say(`${why} Go again.`);
          return;
        }
        ui.say("Checking the run…");
        const res = await api("/arcade/solve", {
          challengeId: ch.challengeId, taps: r.taps, events: r.events
        });
        if (res?.correct && res.code) return showWin(res);

        attemptsLeft = res?.attemptsLeft ?? Math.max(0, attemptsLeft - 1);
        eyebrowEl.textContent = eyebrow().replace(/&middot;/g, "·");
        feedback.textContent = attemptsLeft <= 0
          ? "Out of runs on this machine. Try another tab."
          : (res?.message || "That run did not check out. Have another go.");
      }
    });
  }

  async function render() {
    host.innerHTML = shell();
    const tabs = [...host.querySelectorAll(".arcade-tab")];

    tabs.forEach((b) => {
      b.addEventListener("click", () => choose(b.dataset.pick));
      // A tablist is driven with the arrow keys, so it must actually be.
      b.addEventListener("keydown", (e) => {
        const usable = tabs.filter((t) => !t.disabled);
        const i = usable.indexOf(b);
        if (i < 0) return;
        let next = null;
        if (e.key === "ArrowRight") next = usable[(i + 1) % usable.length];
        else if (e.key === "ArrowLeft") next = usable[(i - 1 + usable.length) % usable.length];
        else if (e.key === "Home") next = usable[0];
        else if (e.key === "End") next = usable[usable.length - 1];
        if (!next) return;
        e.preventDefault();
        next.focus();
        choose(next.dataset.pick);
      });
    });

    await fillPanel(host.querySelector("#apanel"));
  }

  render();
}
