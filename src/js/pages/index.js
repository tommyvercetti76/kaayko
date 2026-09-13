/**
 * pages/index.js — the kaayko.com landing page: three panels, one seam engine,
 * the scramble, the cursor glow, and the store-access modal hand-off.
 * Moved out of index.html on 12 Sep 2026 unchanged. Reads the KaaykoStoreAccess
 * and KaaykoFeatures globals published by the two classic scripts before it.
 */
import '/js/kit.js';   // stamps the footer year

const POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const home = document.getElementById("pg-home");
const forgePanel = document.getElementById("panel-forge");
const storePanel = document.getElementById("panel-store");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Feature gate (js/site-features.js). A disabled panel must leave the DOM
// entirely — the seam engine and flex weights count panels, so a merely
// hidden one would still skew the layout math.
const storeOn = window.KaaykoFeatures ? KaaykoFeatures.isOn("store") : true;
home.querySelectorAll(":scope > .choice[data-feature]").forEach(panel => {
  if (window.KaaykoFeatures && !KaaykoFeatures.isOn(panel.dataset.feature)) panel.remove();
});
const menus = [forgePanel, storePanel].filter(panel => panel.isConnected);

// Access modal lives in js/storeAccess.js — shared with /about
const modalIsOpen = () => KaaykoStoreAccess.isOpen();

// ── N-panel seam engine ───────────────────────────────────────────────
// Each panel has flex weight 1; an expanded panel gets PANEL_EXPAND_WEIGHT.
// Seam positions are derived mathematically so N panels (up to 4) always
// produce symmetric, proportional splits regardless of which panel opens.
// Weight 2 against 1 and 1 gives the highlighted section half the axis
// and a quarter to each of the others. Keep in sync with .choice--wide.
const PANEL_EXPAND_WEIGHT = 2;

function getSeamPositions(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  const positions = [];
  let cum = 0;
  for (let i = 0; i < weights.length - 1; i++) {
    cum += weights[i];
    positions.push((cum / total) * 100);
  }
  return positions;
}

function updateSeam(page, expandedIndex) {
  const panels = Array.from(page.querySelectorAll(":scope > .choice"));
  const n = panels.length;
  if (n < 2) return;

  const isDesktop = window.innerWidth >= 720;
  const seams = Array.from(page.querySelectorAll(":scope > .seam"));
  const marks = Array.from(page.querySelectorAll(":scope > .mark"));

  const weights = panels.map((_, i) => i === expandedIndex ? PANEL_EXPAND_WEIGHT : 1);
  const positions = getSeamPositions(weights);

  const axis  = isDesktop ? "left" : "top";
  const reset = isDesktop ? "top"  : "left";

  // Every divider gets a seam and a wordmark, and they ride together
  seams.forEach((seam, i) => {
    seam.style[axis]  = (positions[i] ?? (i + 1) / n * 100) + "%";
    seam.style[reset] = "";
  });

  marks.forEach((mark, i) => {
    mark.style[axis]  = (positions[i] ?? 50) + "%";
    mark.style[reset] = "";
  });
}

function initPages() {
  document.querySelectorAll(".page").forEach(page => {
    const panels = Array.from(page.querySelectorAll(":scope > .choice"));
    const n = panels.length;
    page.dataset.panels = n;

    // Auto-generate a seam + wordmark per division, so a page with three
    // panels reads the same on both dividers as a page with two
    const template = page.querySelector(":scope > .mark");
    for (let i = page.querySelectorAll(":scope > .seam").length; i < n - 1; i++) {
      const seam = document.createElement("div");
      seam.className = "seam";
      page.insertBefore(seam, panels[0]);
    }
    for (let i = page.querySelectorAll(":scope > .mark").length; i < n - 1; i++) {
      page.insertBefore(template.cloneNode(true), panels[0]);
    }

    updateSeam(page, -1);
  });
}

// ── Section expand / collapse ─────────────────────────────────────────
// One rule for all three sections: highlighting one widens it to half the
// axis and squeezes the other two to a quarter each. Sections that carry
// a menu also reveal their CTA row.
const choices = Array.from(home.querySelectorAll(":scope > .choice"));

function wideIndex() {
  const wide = home.querySelector(".choice--wide");
  return wide ? choices.indexOf(wide) : -1;
}

function collapse(choice) {
  if (!choice.classList.contains("choice--wide")) return;
  choice.classList.remove("choice--wide", "panel--open");
  updateSeam(home, wideIndex());
}

function expand(choice) {
  choices.forEach(other => { if (other !== choice) collapse(other); });
  if (choice.classList.contains("choice--wide")) return;
  choice.classList.add("choice--wide");
  updateSeam(home, choices.indexOf(choice));
}

function openMenu(panel) {
  expand(panel);
  panel.classList.add("panel--open");
}

window.addEventListener("resize", () => updateSeam(home, wideIndex()));

// ── scramble ──────────────────────────────────────────────────────────
function wrapLabel(label) {
  const text = label.dataset.text || label.textContent.trim();
  const choice = label.closest(".choice");
  if (choice) choice.setAttribute("aria-label", text);
  label.dataset.text = text;
  label.textContent  = text;
}

function scramble(page) {
  if (prefersReducedMotion) return;

  const TICK = 38;
  const NOISE_TICKS = 5;
  const LOCK_STEP   = 42;

  page.querySelectorAll(".choice-label").forEach((label) => {
    const target = label.dataset.text || label.textContent.trim();
    const chars  = Array.from(target);
    const locked = chars.map(c => c === " ");

    chars.forEach((char, i) => {
      if (char === " ") return;
      window.setTimeout(() => { locked[i] = true; }, NOISE_TICKS * TICK + i * LOCK_STEP);
    });

    const interval = window.setInterval(() => {
      label.textContent = chars.map((char, i) =>
        locked[i] ? char : POOL[Math.floor(Math.random() * POOL.length)]
      ).join("");

      if (locked.every(Boolean)) {
        window.clearInterval(interval);
        label.textContent = target;
      }
    }, TICK);
  });
}

// ── cursor glow ───────────────────────────────────────────────────────
function attachCursorGlow(choice) {
  const glow  = document.createElement("span");
  const state = { x: 0, y: 0, tx: 0, ty: 0, frame: 0 };
  glow.className = "choice-glow";
  glow.setAttribute("aria-hidden", "true");
  choice.prepend(glow);

  const render = () => {
    state.x += (state.tx - state.x) * 0.18;
    state.y += (state.ty - state.y) * 0.18;
    glow.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) translate(-50%, -50%)`;
    if (choice.classList.contains("is-hot")) {
      state.frame = window.requestAnimationFrame(render);
      return;
    }
    state.frame = 0;
  };

  const updateTarget = (e) => {
    const r = choice.getBoundingClientRect();
    state.tx = e.clientX - r.left;
    state.ty = e.clientY - r.top;
  };

  choice.addEventListener("pointerenter", (e) => {
    updateTarget(e);
    state.x = state.tx;
    state.y = state.ty;
    choice.classList.add("is-hot");
    if (!state.frame) state.frame = window.requestAnimationFrame(render);
  });
  choice.addEventListener("pointermove", updateTarget);
  choice.addEventListener("pointerleave", () => choice.classList.remove("is-hot"));
}

// ── wire up ───────────────────────────────────────────────────────────
document.querySelectorAll(".choice-label").forEach(wrapLabel);
document.querySelectorAll(".choice").forEach(attachCursorGlow);

// Read hash before it is stripped from the address bar
const initialHash = window.location.hash;
window.history.replaceState(null, "", window.location.href.split("#")[0]);

choices.forEach(choice => {
  const hasMenu = menus.includes(choice);
  const reveal = () => {
    if (hasMenu) openMenu(choice);
    else expand(choice);
  };

  // Hover is the primary affordance where it exists; a click would only
  // fight the pointerenter that just opened the section.
  if (canHover) {
    choice.addEventListener("pointerenter", reveal);
    choice.addEventListener("pointerleave", () => {
      if (modalIsOpen()) return;
      collapse(choice);
    });
  } else if (hasMenu) {
    choice.addEventListener("click", (event) => {
      if (event.target.closest(".cta")) return;          // CTAs speak for themselves
      if (choice.classList.contains("panel--open")) collapse(choice);
      else openMenu(choice);
    });
  }

  // Keyboard reaches the same states as the pointer
  choice.addEventListener("focusin", reveal);

  choice.addEventListener("keydown", (event) => {
    if (event.target !== choice) return;
    if (!hasMenu || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    if (choice.classList.contains("panel--open")) collapse(choice);
    else openMenu(choice);
  });

  choice.addEventListener("focusout", (event) => {
    if (modalIsOpen()) return;
    if (!choice.contains(event.relatedTarget)) collapse(choice);
  });
});

// Tap/click outside a section → collapse it (covers touch before focus lands)
document.addEventListener("pointerdown", (event) => {
  if (modalIsOpen()) return;
  choices.forEach(choice => {
    if (!choice.contains(event.target)) collapse(choice);
  });
});

const accessCta  = document.getElementById("cta-access");
const requestCta = document.getElementById("cta-request");

if (accessCta) accessCta.addEventListener("click", (event) => {
  event.stopPropagation();
  KaaykoStoreAccess.open("access", { returnFocus: accessCta });
});

if (requestCta) requestCta.addEventListener("click", (event) => {
  event.stopPropagation();
  KaaykoStoreAccess.open("request", { returnFocus: requestCta });
});

document.addEventListener("keydown", (event) => {
  // storeAccess.js closes itself on Escape; leave the panels alone until it has
  if (event.key !== "Escape" || modalIsOpen()) return;
  choices.forEach(choice => collapse(choice));
  if (document.activeElement && document.activeElement.blur) {
    document.activeElement.blur();
  }
});

initPages();
scramble(home);

// Deep link: secretStore.js bounces uninvited visitors to /#store —
// land them straight on the invite-code card. With the store feature off
// the panel is gone, but invite-code holders still get the modal, so a
// shared QR or direct link keeps working with no visible UI trace.
if (initialHash === "#store") {
  if (storeOn) {
    openMenu(storePanel);
    KaaykoStoreAccess.open("access", { returnFocus: accessCta });
  } else {
    KaaykoStoreAccess.open("access", {});
  }
}
