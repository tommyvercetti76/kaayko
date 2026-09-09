/**
 * cards/render.js — the Kaayko property card, drawn from data.
 *
 * The cards used to be five pre-baked SVG files with the copy welded into them,
 * generated offline. Changing a single word meant re-running a script on a
 * laptop. This module is the layout on its own, so the same record renders the
 * card on the site, in the admin preview, and on the print sheet — and the copy
 * lives in Firestore where it can be edited.
 *
 * Geometry is in the print grid and nothing here is responsive: 1050 × 600 units
 * IS 3.5 × 2 inches, so 300 units to the inch, and 6pt is the smallest type that
 * survives a real printer. Do not "improve" these numbers on the evidence of a
 * screen — the card is a physical object first.
 */

const SERIF = "'Cormorant Garamond','EB Garamond',Georgia,'Times New Roman',serif";
const SANS = "'Josefin Sans',Futura,'Century Gothic',Avenir,sans-serif";

const W = 1050, H = 600;
const AW = 401;            // 1050 / phi — the art column
const TX = AW + 56;        // where the words start
const INK = "#1E1810", MUTE = "#6E5C40", PAPER = "#F5EFE1", CREAM = "#FCFBEA";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Two lines, no more. A third line would collide with the rule under the hook. */
export function wrap(text, width = 26, max = 2) {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, max);
}

/** The host as people say it, not as a URL parser says it. */
export function hostOf(card) {
  if (card.host) return card.host;
  try { return new URL(card.url).host.replace(/^www\./, "") + new URL(card.url).pathname.replace(/\/$/, ""); }
  catch (_) { return String(card.url || ""); }
}

/**
 * A QR as SVG rects. Passed a `qr` from the vendored qrcode-generator (already
 * made and encoded by the caller), because this module stays free of globals.
 */
export function qrRects(qr, x, y, size, fill = "#1E1810") {
  const n = qr.getModuleCount();
  const cell = size / n;
  let out = "";
  for (let r = 0; r < n; r++) {
    // run-length the row: one rect per run of dark modules, not one per module
    let c = 0;
    while (c < n) {
      if (!qr.isDark(r, c)) { c++; continue; }
      let end = c;
      while (end + 1 < n && qr.isDark(r, end + 1)) end++;
      const rx = x + c * cell, ry = y + r * cell, rw = (end - c + 1) * cell;
      out += `<rect x="${rx.toFixed(2)}" y="${ry.toFixed(2)}" width="${rw.toFixed(2)}" ` +
             `height="${(cell + 0.35).toFixed(2)}" fill="${fill}"/>`;
      c = end + 1;
    }
  }
  return out;
}

/**
 * @param {object} card   {slug, name, hook, url, host, accent, art}
 * @param {object} opts   {qr, artHref, total, index}
 */
export function front(card, { qr, artHref, } = {}) {
  const accent = card.accent || "#8A5A2B";
  const lines = wrap(card.hook);
  const hook = lines.map((line, i) =>
    `<text x="${TX}" y="${278 + i * 48}" style="font:400 40px ${SERIF};font-style:italic;fill:${accent}">${esc(line)}</text>`
  ).join("");

  const art = artHref
    ? `<image href="${esc(artHref)}" x="0" y="100" width="${AW}" height="${AW}" preserveAspectRatio="xMidYMid meet"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="3.5in" height="2in"
     viewBox="0 0 ${W} ${H}" data-property="${esc(card.slug)}">
<rect width="${W}" height="${H}" fill="${PAPER}"/>
<rect x="0" y="0" width="${AW}" height="${H}" fill="${CREAM}"/>
${art}
<rect x="${AW}" y="0" width="6" height="${H}" fill="${accent}"/>
<text x="${TX}" y="200" style="font:300 86px ${SERIF};fill:${INK}">${esc(card.name)}</text>
${hook}
<path d="M${TX} 380 H980" stroke="${MUTE}" stroke-width="0.9" opacity=".32"/>
<text x="${TX}" y="434" style="font:400 30px ${SERIF};fill:${MUTE}">${esc(hostOf(card))}</text>
<rect x="858" y="358" width="122" height="122" rx="4" fill="#FBF7EB" stroke="${MUTE}" stroke-width="1"/>
${qr ? qrRects(qr, 867, 367, 104) : ""}
<text x="919" y="518" text-anchor="middle"
      style="font:300 26px ${SANS};fill:${MUTE};letter-spacing:7px">KAAYKO</text>
</svg>`;
}

/** @param {object} brand {label, tagline, properties, contact} */
export function back(card, brand = {}, { index = 1, total = 5 } = {}) {
  const accent = card.accent || "#8A5A2B";
  const label = brand.label || "KAAYKO";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="3.5in" height="2in"
     viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#E4D9C0"/>
<rect x="16" y="16" width="1018" height="568" fill="${PAPER}"/>
<rect x="16" y="16" width="11" height="568" fill="${accent}"/>
<text x="525" y="206" text-anchor="middle" style="font:400 58px ${SERIF};fill:${INK};letter-spacing:20px">${esc(label)}</text>
<path d="M320 236 H730" stroke="${accent}" stroke-width="1.1" opacity=".7"/>
<text x="525" y="272" text-anchor="middle" style="font:300 11px ${SANS};fill:${MUTE};letter-spacing:8px">${esc(brand.tagline || "")}</text>
<text x="525" y="352" text-anchor="middle" style="font:400 24px ${SERIF};fill:${INK}">${esc(brand.properties || "")}</text>
<text x="525" y="412" text-anchor="middle" style="font:400 23px ${SERIF};fill:${MUTE}">${esc(brand.contact || "")}</text>
<text x="525" y="542" text-anchor="middle"
      style="font:300 11px ${SANS};fill:${MUTE};letter-spacing:5px">${esc((card.name || "").toUpperCase())} &#183; CARD ${index} OF ${total}</text>
</svg>`;
}

export const dataUri = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
