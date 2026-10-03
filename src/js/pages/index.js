/**
 * pages/index.js — the kaayko.com landing page's behaviour: hover and focus
 * widen a section, the menus, the cursor glow, and the store-access modal
 * hand-off. The layout (panel count, dividers, wordmarks) and the entrance
 * (dividers drawing in, the scramble) are set before the first paint by
 * js/pages/home-entrance.js; this moves the dividers through KaaykoHome.place().
 * Reads the KaaykoStoreAccess, KaaykoFeatures and KaaykoHome globals.
 */
import '/js/kit.js';   // stamps the footer year

const home = document.getElementById("pg-home");
const forgePanel = document.getElementById("panel-forge");
const storePanel = document.getElementById("panel-store");
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// Disabled panels were already removed by home-entrance.js, before the first paint.
const storeOn = window.KaaykoFeatures ? KaaykoFeatures.isOn("store") : true;
const menus = [forgePanel, storePanel].filter(panel => panel && panel.isConnected);   // a disabled panel is already gone (null)

// Access modal lives in js/storeAccess.js — shared with /about
const modalIsOpen = () => KaaykoStoreAccess.isOpen();

// ── Dividers ──────────────────────────────────────────────────────────
// home-entrance.js owns the divider math; a highlighted section has weight 2.
function updateSeam(page, expandedIndex) {
  if (window.KaaykoHome) window.KaaykoHome.place(expandedIndex);
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
