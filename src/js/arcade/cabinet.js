/**
 * arcade/cabinet.js — the machine, as a piece of furniture.
 *
 * Two of them exist and no more: Franking Rush and Mail Run. Both are played with one
 * finger, both take under a minute, and both are replayed on the server before anything
 * is worth money (see play.js and gameRules.js).
 *
 * Callers:
 *   mountMachine()   one cabinet, optionally wired to a reward
 *   mountArcadeRow() the About page pair, played for nothing at all
 */

import { play, attract, SKIN } from "./play.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const MACHINES = [
  {
    id: "franking",
    name: "Franking Rush",
    how: "Strike inside the lit band. Three keys below.",
    blurb: "Three channels, one hand, and a very short window. The post office of 1974 in a box.",
    verb: "Tap"
  },
  {
    id: "mailrun",
    name: "Mail Run",
    how: "Hold the key below to climb. Let go to fall.",
    blurb: "An airmail sheet over a city that does not know it is being crossed.",
    verb: "Hold"
  }
];

export const byId = (id) => MACHINES.find((m) => m.id === id) || MACHINES[0];

const PRM = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {HTMLElement} host
 * @param {object} spec { id, seed, height, onResult }
 * @returns {{start:Function, stop:Function}}
 */
export function mountMachine(host, spec = {}) {
  const def = byId(spec.id);
  const seed = spec.seed || 1;
  const height = spec.height || 200;
  const skin = SKIN[def.id];

  host.innerHTML = `
    <div class="cab" data-machine="${esc(def.id)}" style="--machine:${skin.deep};--machine-lit:${skin.key};--machine-key:${skin.key}">
      <div class="cab-marquee">
        <h4 class="cab-name">${esc(def.name)}</h4>
        <span class="cab-lamps" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>
      <div class="cab-body">
        <div class="cab-stage" style="--cab-h:${height}px">
          <canvas class="cab-canvas" tabindex="0" aria-label="${esc(def.name)}. ${esc(def.how)}"></canvas>
          <div class="cab-scanlines" aria-hidden="true"></div>
          <div class="cab-overlay">
            <p class="cab-how">${esc(def.how)}</p>
            <button type="button" class="cab-play">Insert coin</button>
          </div>
        </div>
        <div class="cab-controls" role="group" aria-label="${esc(def.name)} controls">
          ${def.id === "franking"
            ? `<button type="button" class="cab-key" data-lane="0"><span>Top</span></button>
               <button type="button" class="cab-key" data-lane="1"><span>Middle</span></button>
               <button type="button" class="cab-key" data-lane="2"><span>Bottom</span></button>`
            : `<button type="button" class="cab-key is-hold" data-hold="1"><span>Hold to climb</span></button>`}
        </div>
        <div class="cab-panel">
          <img class="cab-art" src="/assets/arcade/cab-${esc(def.id)}.webp" alt="" aria-hidden="true" loading="lazy">
          <span class="cab-slot" aria-hidden="true"></span>
          <p class="cab-blurb">${esc(def.blurb)}</p>
        </div>
      </div>
      <p class="cab-result" role="status" aria-live="polite"></p>
    </div>`;

  const canvas = host.querySelector(".cab-canvas");
  const overlay = host.querySelector(".cab-overlay");
  const playBtn = overlay.querySelector(".cab-play");
  const result = host.querySelector(".cab-result");
  const keys = [...host.querySelectorAll(".cab-key")];

  let session = null;

  /* ── the physical controls ───────────────────────────────────────────────
     Real buttons rather than "tap the picture": on a phone a long press on a
     canvas starts a text selection and pops the callout menu, which makes a
     hold-to-climb game unplayable. These swallow every gesture the browser
     would otherwise interpret, and they hold as long as the finger is down —
     pointer capture keeps the hold alive even if the finger slides off.      */
  const setKeysLive = (live) => keys.forEach((b) => { b.disabled = !live; });
  setKeysLive(false);

  for (const key of keys) {
    const lane = key.dataset.lane;
    const isHold = key.dataset.hold === "1";

    const down = (e) => {
      if (key.disabled || !session) return;
      e.preventDefault();
      key.setPointerCapture?.(e.pointerId);
      key.classList.add("is-down");
      if (isHold) session.hold(true); else session.press(Number(lane));
    };
    const up = (e) => {
      key.classList.remove("is-down");
      if (!session) return;
      if (isHold) session.hold(false);
      if (e) e.preventDefault();
    };

    key.addEventListener("pointerdown", down);
    key.addEventListener("pointerup", up);
    key.addEventListener("pointercancel", up);
    key.addEventListener("pointerleave", (e) => { if (!key.hasPointerCapture?.(e.pointerId)) up(e); });
    key.addEventListener("contextmenu", (e) => e.preventDefault());
    // Keyboard: the button is a button, so Space and Enter must work as a hold too.
    key.addEventListener("keydown", (e) => {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      if (e.repeat) return;
      if (!session) return;
      key.classList.add("is-down");
      if (isHold) session.hold(true); else session.press(Number(lane));
    });
    key.addEventListener("keyup", (e) => {
      if (e.key !== " " && e.key !== "Enter") return;
      key.classList.remove("is-down");
      if (session && isHold) session.hold(false);
    });
  }
  // The machine plays itself, badly, until somebody drops a coin in.
  let demo = attract(canvas, def.id, seed + 991);

  const start = () => {
    demo?.stop(); demo = null;
    overlay.hidden = true;
    result.textContent = "";
    setKeysLive(true);
    session = play(canvas, def.id, seed, (r) => {
      session = null;
      setKeysLive(false);
      keys.forEach((b) => b.classList.remove("is-down"));
      overlay.hidden = false;
      playBtn.textContent = r.won ? "Play again" : "Another go";
      demo = attract(canvas, def.id, seed + 991);
      const line = r.won
        ? `Cleared, all ${r.target}.`
        : `${r.score} of ${r.target}. Close.`;
      if (spec.onResult) spec.onResult(r, { line, say: (t) => { result.textContent = t; } });
      else result.textContent = line;
    });
    canvas.focus({ preventScroll: true });
  };

  playBtn.addEventListener("click", start);
  if (PRM()) host.querySelector(".cab-how").textContent += " (this one moves)";

  return { start, stop: () => { session?.stop(); demo?.stop(); setKeysLive(false); } };
}

/** The About page: both machines, no stakes, nothing to claim. */
export function mountArcadeRow(host) {
  if (!host) return;
  host.innerHTML = "";
  MACHINES.forEach((m, i) => {
    const cell = document.createElement("div");
    cell.className = "cab-cell";
    host.appendChild(cell);
    mountMachine(cell, { id: m.id, seed: 1000 + i * 7, height: 200 });
  });
}

// The old name, kept so nothing that still imports it breaks mid-deploy.
export { mountMachine as mountGame };
