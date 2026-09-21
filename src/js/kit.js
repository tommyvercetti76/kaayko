/**
 * kit.js — the ES-module face of util.js.
 *
 * Store scripts are modules; util.js is a classic script that publishes
 * window.KaaykoUtil. Importing it here as a module runs its IIFE (idempotent),
 * so the global exists before the exports below are read. One implementation,
 * two entry points: classic pages read window.KaaykoUtil, modules import kit.js.
 *
 * Money helpers come from priceMap.js, the client's one price authority.
 */
import '/js/util.js?v=f604359';
export { money, priceCents, priceText } from '/js/priceMap.js?v=f604359';

const U = window.KaaykoUtil;

export const esc       = U.escapeHtml;
export const debounce  = U.debounce;
export const clamp     = U.clamp;
export const num       = U.num;
export const fetchJson = U.fetchJson;
export const apiBase   = U.apiBase;
export const stampYear = U.stampYear;
