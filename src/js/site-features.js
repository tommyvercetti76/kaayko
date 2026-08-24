/**
 * Kaayko site feature flags — one switch per product surface.
 *
 * Flip a flag to false and every element tagged data-feature="<name>" is
 * hidden before first paint, site-wide. Pages with JS-built UI (the landing
 * panels, the About showcase) also read these flags and skip building the
 * disabled sections, so layout math never sees them.
 *
 * Load this synchronously in <head>, before any page markup:
 *   <script src="/js/site-features.js"></script>
 *
 * store: false hides every UI trace of the store, but the store itself stays
 * reachable for people given a direct link or QR:
 *   - /store?bypass=kortex&ref=<link>  (Kortex smart-link QR flow)
 *   - /store with previously granted access (localStorage)
 *   - /#store still opens the invite-code modal for anyone bounced off /store
 */
window.KAAYKO_FEATURES = {
  paddlingout: true,
  forge: true,
  youtube: true,
  store: false
};

(function () {
  "use strict";

  var flags = window.KAAYKO_FEATURES;
  var off = Object.keys(flags).filter(function (k) { return !flags[k]; });

  window.KaaykoFeatures = {
    isOn: function (name) { return flags[name] !== false; },
    /** Array helper — keep items whose `feature` key is on (or absent). */
    filterOn: function (items) {
      return items.filter(function (item) {
        return !item.feature || flags[item.feature] !== false;
      });
    }
  };

  // data-feature="x"     → shown only while feature x is ON
  // data-feature-off="x"  → shown only while feature x is OFF
  // (lets copy swap in place, e.g. "three products" vs "two products")
  var rules = [];
  Object.keys(flags).forEach(function (k) {
    if (flags[k]) rules.push('[data-feature-off="' + k + '"]{display:none !important;}');
    else rules.push('[data-feature="' + k + '"]{display:none !important;}');
  });
  if (!rules.length) return;

  // Synchronous <style> so disabled features never flash into view
  var style = document.createElement("style");
  style.id = "kaayko-feature-css";
  style.textContent = rules.join("");
  document.head.appendChild(style);
})();
