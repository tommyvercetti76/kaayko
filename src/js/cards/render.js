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

/**
 * The card as it prints. Every visual decision the card makes is a field here,
 * and nothing below reads a constant directly — so a second skin can restyle
 * the web page without the printed card moving, which it must not, because a
 * card already in someone's pocket cannot be redeployed.
 *
 * Geometry is deliberately absent. W, H, AW and TX are 3.5 x 2 inches at 300
 * units to the inch; they are the object, not a style, and a skin may not
 * touch them.
 *
 * `defs` and `textFilter` are the only additive fields: both are empty here, so
 * this skin emits the markup it always emitted, to the byte. tests/cardRender
 * pins that.
 */
export const PRINT = Object.freeze({
  serif: SERIF,
  sans: SANS,
  ink: INK,
  mute: MUTE,
  paper: PAPER,
  cream: CREAM,
  qrPaper: "#FBF7EB",
  /** The code itself. Separate from `ink` so a skin can quiet it and still scan. */
  qrInk: INK,
  /** The quiet-zone box. A proof too small to scan should not draw one. */
  qrBox: true,
  /** The card's own colour. A skin may return one colour for all five. */
  accentOf: (card) => card.accent || "#8A5A2B",
  /** The animal: filling the front column, ghosted on the back. */
  art: true,
  /** A filter applied to the animal, or "". A skin can deboss it into the stock. */
  artFilter: "",
  /** The coloured edge, 6 units on the front and 8 on the back. */
  spine: true,
  /** How far the animal is pushed under the words on the back. */
  ghostOpacity: ".09",
  /** The hook, set in the accent. Italic is the house voice, not a rule. */
  hookItalic: true,
  /**
   * The ten places type is set. Sizes are print units, not pixels: 86 here is
   * 86/300 of an inch. `wrap` is a character count, not a measurement —
   * wrap() knows nothing about the font — so a skin that changes `size` must
   * move `wrap` with it or the hook will break in the wrong place.
   */
  type: Object.freeze({
    name:     Object.freeze({ weight: 300, size: 86, y: 200, track: 0, caps: false }),
    hook:     Object.freeze({ weight: 400, size: 40, y: 278, step: 48, wrap: 26, track: 0, italic: true }),
    backName: Object.freeze({ weight: 300, size: 78, y: 182, track: 0, caps: false }),
    backLine: Object.freeze({ weight: 400, size: 32, y: 244, track: 0 }),
  }),
  /** The blind impression an engraving die leaves in the sheet. Inkless. */
  plate: null,
  /** Emitted immediately inside <svg>. A skin puts its <defs> here. */
  defs: "",
  /** A filter attribute value applied to every line of type, or "". */
  textFilter: "",
});

import { esc } from "/js/kit.js";
export { esc };

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

/** A letter-spacing declaration, or nothing at all when a skin does not track. */
const track = (px) => (px ? `letter-spacing:${px}px;` : "");

/** Uppercasing is a skin's decision, not the copy's: the admin types "Store". */
const cased = (text, caps) => (caps ? String(text ?? "").toUpperCase() : text);

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
export function front(card, { qr, artHref, skin = PRINT } = {}) {
  const accent = skin.accentOf(card);
  const F = skin.textFilter ? ` filter="${skin.textFilter}"` : "";
  const T = skin.type;
  const lines = wrap(card.hook, T.hook.wrap);
  const hook = lines.map((line, i) =>
    `<text x="${TX}" y="${T.hook.y + i * T.hook.step}"${F} style="font:${T.hook.weight} ${T.hook.size}px ${skin.serif};${T.hook.italic ? "font-style:italic;" : ""}${track(T.hook.track)}fill:${accent}">${esc(line)}</text>`
  ).join("");

  // The art fills the whole column. It used to be a square dropped at y=100 in a
  // 600-tall column, leaving 199px of flat CREAM above and below — and because
  // each art file carried its own near-cream background, those bands were a
  // visibly different colour from the picture. The art files are now cut to this
  // column's shape and painted on this exact CREAM, so the seam disappears.
  const img = artHref && skin.art
    ? `<image href="${esc(artHref)}" x="0" y="0" width="${AW}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
    : "";
  const art = img && skin.artFilter ? `<g filter="${skin.artFilter}">${img}</g>` : img;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="3.5in" height="2in"
     viewBox="0 0 ${W} ${H}" data-property="${esc(card.slug)}">
${skin.defs}<rect width="${W}" height="${H}" fill="${skin.paper}"/>
<rect x="0" y="0" width="${AW}" height="${H}" fill="${skin.cream}"/>
${art}
${skin.spine ? `<rect x="${AW}" y="0" width="6" height="${H}" fill="${accent}"/>` : ""}${skin.plate || ""}
<text x="${TX}" y="${T.name.y}"${F} style="font:${T.name.weight} ${T.name.size}px ${skin.serif};${track(T.name.track)}fill:${skin.ink}">${esc(cased(card.name, T.name.caps))}</text>
${hook}
<!-- The rule used to sit at y=380 while the QR box started at y=358, so the
     line ran straight through the code. Everything below the rule now starts
     below it: the address on the left, the code on the right, the mark beneath. -->
<path d="M${TX} 380 H980" stroke="${skin.mute}" stroke-width="0.9" opacity=".32"/>
<text x="${TX}" y="432"${F} style="font:400 30px ${skin.serif};fill:${skin.mute}">${esc(hostOf(card))}</text>
${skin.qrBox ? `<rect x="858" y="406" width="122" height="122" rx="4" fill="${skin.qrPaper}" stroke="${skin.mute}" stroke-width="1"/>` : ""}
${qr ? qrRects(qr, 867, 415, 104, skin.qrInk) : ""}
<text x="919" y="566" text-anchor="middle"${F}
      style="font:300 24px ${skin.sans};fill:${skin.mute};letter-spacing:7px">KAAYKO</text>
</svg>`;
}

/**
 * The back of one card.
 *
 * It used to be the same block on all five — the wordmark, the house tagline,
 * and the list "Kaayko · Paddling Out · Forge · Kortex · Alumni" — so whichever
 * card you turned over, it advertised the other four and said nothing about the
 * one in your hand. Everything sat centred in the middle of the card with the
 * corners empty.
 *
 * Now each back sells its own card: the name, one sentence saying what the thing
 * is, and three facts you can check on the page its QR opens. The facts sit in
 * the same three places on every card, so the series reads as a set when they are
 * laid out together.
 *
 * @param {object} card  {name, line, facts[], host, url, accent}
 * @param {object} brand {label, contact}
 */
export function back(card, brand = {}, { index = 1, total = 5, artHref, skin = PRINT } = {}) {
  const accent = skin.accentOf(card);
  const F = skin.textFilter ? ` filter="${skin.textFilter}"` : "";
  const label = brand.label || "KAAYKO";
  const line = card.line || card.hook || "";
  const facts = (Array.isArray(card.facts) ? card.facts : []).slice(0, 3);
  const T = skin.type;

  const L = 88, R = W - 88;          // the type column, same inset both sides
  const cell = (R - L) / 3;

  // Bled off the right edge so it reads as a watermark under the words rather
  // than a second picture competing with the front.
  const ghost = artHref && skin.art
    ? `<g opacity="${skin.ghostOpacity}"${skin.artFilter ? ` filter="${skin.artFilter}"` : ""}><image href="${esc(artHref)}" x="${W - 520}" y="0" width="520" height="${H}" preserveAspectRatio="xMidYMid slice"/></g>`
    : "";

  // Three facts, each under its own short accent rule. A rule that is the width
  // of its own label rather than the cell keeps the row from looking like a
  // table.
  const factRow = facts.map((f, k) => {
    const cx = L + cell * k + cell / 2;
    const tick = Math.min(cell - 28, 34 + String(f).length * 3.4);
    return `<path d="M${(cx - tick / 2).toFixed(1)} 470 H${(cx + tick / 2).toFixed(1)}" stroke="${accent}" stroke-width="1.4" opacity=".85"/>
<text x="${cx.toFixed(1)}" y="508" text-anchor="middle"${F} style="font:300 17px ${skin.sans};fill:${skin.ink};letter-spacing:4px">${esc(String(f).toUpperCase())}</text>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="3.5in" height="2in"
     viewBox="0 0 ${W} ${H}" data-property="${esc(card.slug || "")}">
${skin.defs}<rect width="${W}" height="${H}" fill="${skin.paper}"/>
<!-- The same animal as the front, ghosted. It is the one thing that makes a card
     recognisably its own at arm's length, and at 9% it is a watermark rather than
     a picture, so nothing printed over it loses contrast. -->
${ghost}
${skin.spine ? `<rect x="0" y="0" width="8" height="${H}" fill="${accent}"/>` : ""}${skin.plate || ""}

<text x="${L}" y="86"${F} style="font:300 22px ${skin.sans};fill:${skin.mute};letter-spacing:9px">${esc(label)}</text>
<text x="${L}" y="${T.backName.y}"${F} style="font:${T.backName.weight} ${T.backName.size}px ${skin.serif};${track(T.backName.track)}fill:${skin.ink}">${esc(cased(card.name || "", T.backName.caps))}</text>
<text x="${L}" y="${T.backLine.y}"${F} style="font:${T.backLine.weight} ${T.backLine.size}px ${skin.serif};${track(T.backLine.track)}fill:${skin.mute}">${esc(line)}</text>

<!-- Half the width, and stopping short of x=${W - 520} so it never runs across
     the ghosted animal. The address sits directly under it, at the size of a
     caption rather than a headline. -->
<path d="M${L} 300 H${L + (R - L) / 2}" stroke="${skin.mute}" stroke-width="0.9" opacity=".28"/>
<text x="${L}" y="${340}"${F} style="font:400 24px ${skin.serif};fill:${skin.mute}">${esc(hostOf(card))}</text>
${factRow}

<text x="${R}" y="${H - 44}" text-anchor="end"${F}
      style="font:300 12px ${skin.sans};fill:${skin.mute};letter-spacing:5px">${index} OF ${total}</text>
</svg>`;
}

export const dataUri = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
