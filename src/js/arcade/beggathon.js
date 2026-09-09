/**
 * arcade/beggathon.js — the cart-level plea.
 *
 * One machine, one place: the bag. Not on product pages, because you are not begging
 * for a magnet, you are begging for the order. Up to 10% off the WHOLE cart, premium
 * lines included — the only discount in the shop that touches a tote or a shirt.
 *
 * Everything that decides the number happens on the server (api/arcade/begScore.js).
 * This file collects the plea, the keystroke intervals and the elapsed time, sends
 * them, and then shows exactly how the man arrived at his figure — four axes, their
 * weights, and a line each you are welcome to disagree with. A refusal is reported the
 * same way: profanity and mashed keys earn nothing and are told why.
 *
 * The code that comes back lasts ONE HOUR from the moment it is minted, used or not.
 */

import { api, esc, saveReward, countdown, savedReward } from "./reward.js";

const AXIS_ORDER = ["grovel", "originality", "legibility", "haste"];
const AXIS_NAME = {
  grovel: "The case you made",
  originality: "Whether he had heard it before",
  legibility: "Whether it read like a person",
  haste: "How long you kept him standing"
};

function statsMarkup(res) {
  const rows = AXIS_ORDER.filter((k) => res.axes?.[k]).map((k) => {
    const a = res.axes[k];
    const pct = Math.round(Math.max(0, Math.min(1, a.score)) * 100);
    return `
      <li class="beg-axis">
        <span class="beg-axis-name">${esc(AXIS_NAME[k])}</span>
        <span class="beg-axis-weight">${esc(a.weight)} of it</span>
        <span class="beg-axis-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
        <span class="beg-axis-score">${pct}</span>
        <span class="beg-axis-note">${esc(a.note)}</span>
      </li>`;
  }).join("");

  return `
    <p class="beg-verdict">${esc(res.verdict || "")}</p>
    <ul class="beg-axes">${rows}</ul>
    <p class="beg-tally">${res.words} words in ${res.seconds} seconds, which he weighed at
      <b>${res.forgiven ? `+${res.percent}% still owed` : `${res.percent}% off everything in the bag`}</b>.</p>`;
}

const refusalMarkup = (res) => `
  <div class="beg-refused${res.penalty ? " is-charged" : ""}">
    <p class="beg-verdict">${res.penalty ? "He charged you for that." : "He turned away."}</p>
    <p class="beg-refuse-why">${esc(res.message || "That was not a plea.")}</p>
    <p class="beg-fine">${
      res.penalty
        ? `Now carrying +${res.penalty.surchargePercent}% of ${res.penalty.max}%. Beg it back down.`
        : res.attemptsLeft > 0
          ? `Refused at gate ${res.gate}. ${res.attemptsLeft} more ${res.attemptsLeft === 1 ? "attempt" : "attempts"}.`
          : "No more attempts."}</p>
  </div>`;

/**
 * Mount the Beggathon into the cart.
 *
 * @param {HTMLElement} host
 * @param {{onWin?:(reward:{code:string,percent:number})=>void}} opts
 */
export async function mountBeggathon(host, opts = {}) {
  if (!host) return;

  // A code already won is not something to win again.
  const held = savedReward();
  if (held?.scope === "cart") {
    host.innerHTML = `
      <div class="beg-card is-won${opts.bare ? " is-bare" : ""}">
        <p class="beg-eyebrow">Already argued</p>
        <h3 class="beg-head">${held.percent}% is on this bag.</h3>
        <p class="beg-code"><code>${esc(held.code)}</code></p>
        <p class="beg-fine" data-clock></p>
      </div>`;
    countdown(host.querySelector("[data-clock]"), held, () => { host.innerHTML = ""; });
    return;
  }

  const maxPct = 10;

  // Two shapes. In a tab it is already the thing you chose, so it opens straight
  // away; anywhere else it is an offer you have to accept before it starts.
  host.innerHTML = opts.bare
    ? `<div class="beg-card is-bare"><div class="beg-body"><p class="beg-fine">Setting up…</p></div></div>`
    : `<details class="beg-card" id="beg-card">
         <summary class="beg-summary">
           <span class="beg-eyebrow">Optional</span>
           <span class="beg-head">Ask him for up to ${maxPct}% off the whole bag</span>
           <span class="beg-fine">Sixty seconds, typed by hand. Everything counts, including the spelling.</span>
         </summary>
         <div class="beg-body"><p class="beg-fine">Setting up…</p></div>
       </details>`;

  const card = host.querySelector(".beg-card");
  const body = host.querySelector(".beg-body");
  let started = false;

  async function begin() {
    if (started) return;
    started = true;

    const ch = await api("/arcade/beg/start", {});
    if (!ch?.success) {
      body.innerHTML = `<p class="beg-fine">He is not taking callers right now. Try again in a moment.</p>`;
      started = false;
      return;
    }
    if (card) card.dataset.ready = "1";

    const ttl = ch.rewardExpiresInMinutes ?? 60;
    const atoning = ch.mode === "atonement";
    body.innerHTML = `
      ${atoning ? `<p class="beg-penalty">You are carrying <b>+${ch.surchargePercent}%</b> on this order for
        pasting. A plea he accepts takes one percent off that and nothing more — there is no
        discount at the end of this, only the ordinary price. No other game in the shop pays out
        until it is gone.</p>` : ""}
      <p class="beg-rules">He is hard to move. He wants a real reason, about something in particular,
        in words he has not heard before, and he does not want to be kept standing. Swearing ends it.
        So does mashing, looping, shouting, and pasting. Most people get three or four percent.
        ${atoning ? "" : `What he grants lasts ${ttl} minutes, used or not.`}</p>
      <div class="beg-slot"></div>`;

    const { mountBeg } = await import("./beg.js");
    mountBeg(body.querySelector(".beg-slot"), {
      rewardPercentMax: ch.rewardPercentMax ?? maxPct,
      async onWin(run, ui) {
        ui.say("He is reading it…");
        const res = await api("/arcade/beg/solve", { challengeId: ch.challengeId, ...run });

        // Atonement: accepted, a percent came off the surcharge, and no code is minted.
        if (res?.correct && res.forgiven) {
          ui.say("");
          body.innerHTML = `
            <div class="beg-won">
              <p class="beg-eyebrow">${res.cleared ? "Settled" : "One percent lighter"}</p>
              <h4 class="beg-head">${esc(res.message)}</h4>
              ${statsMarkup({ ...res, percent: res.surchargePercent })}
            </div>`;
          opts.onWin?.({ percent: 0, scope: "cart", forgiven: true, surchargePercent: res.surchargePercent });
          return;
        }
        if (!res?.correct || !res.code) {
          ui.say("");
          body.insertAdjacentHTML("beforeend", refusalMarkup(res || {}));
          return;
        }

        saveReward({ ...res, expiresInMinutes: res.expiresInMinutes ?? ttl });
        card.open = true;
        body.innerHTML = `
          <div class="beg-won">
            <p class="beg-eyebrow">He paid</p>
            <h4 class="beg-head">${res.percent}% off the whole bag.</h4>
            ${statsMarkup(res)}
            <p class="beg-code"><code>${esc(res.code)}</code></p>
            <p class="beg-fine" data-clock></p>
          </div>`;
        countdown(body.querySelector("[data-clock]"),
          { expiresAt: Date.now() + (res.expiresInMinutes ?? ttl) * 60000 });
        opts.onWin?.({ code: res.code, percent: res.percent, scope: "cart" });
      }
    });
  }

  if (opts.bare) begin();
  else card.addEventListener("toggle", () => { if (card.open) begin(); });
}
