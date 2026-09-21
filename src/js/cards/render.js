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
    // The back's column is 392px (88→480) so the picture can have the rest.
    // "Paddling Out" measures 359px at 68; a 62-character line wraps to two
    // rows at 28. Both are checked by the test suite against BACK.
    backName: Object.freeze({ weight: 300, size: 68, y: 178, track: 0, caps: false }),
    backLine: Object.freeze({ weight: 400, size: 28, y: 236, track: 0 }),
  }),
  /** The blind impression an engraving die leaves in the sheet. Inkless. */
  plate: null,
  /** Emitted immediately inside <svg>. A skin puts its <defs> here. */
  defs: "",
  /** A filter attribute value applied to every line of type, or "". */
  textFilter: "",
});

import { esc } from "/js/kit.js?v=639e44c";
export { esc };

/**
 * The name gets one line in a fixed column — TX (457) to the rule at 980, so
 * 523px. "Paddling Out" measures 454px at 86px and fits. "School of the Future"
 * measured 679px and did not; it would have run 156px past the rule, straight
 * through the QR box. That name is gone (the card now reads "GuruCool", 339px,
 * comfortably inside) but the escape hatch stays, because the next long one
 * will not announce itself.
 *
 * It shrinks rather than wraps: the hook sits 78px below the name, so a second
 * line has nowhere to go. A compositor handed a long name and a fixed plate
 * does exactly this.
 *
 * The ratio is NOT derivable from character count — measured in Cormorant
 * Garamond at 86px the per-character advance runs from 0.395 ("School of the
 * Future") to 0.499 ("Alumni"), so an estimate would be wrong by a third. A
 * card that needs a smaller name states it, measured, as `nameSize`.
 */
function nameSize(card, fallback) {
  const n = Number(card && card.nameSize);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

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
  // `max` is a cap, and a cap that silently discards the third line is how
  // "School of the Future, connecting past and present." printed without its
  // last word. The cap stays — the geometry below it is fixed — but the test
  // suite asserts every card fits inside it, so a copy change that needs a
  // third line fails the build instead of shipping a sentence with no end.
  return lines.slice(0, max);
}

/**
 * The back has one hard rule: the words and the animal never touch.
 *
 * The ghost used to be bled off the right edge, 520px wide and the full height
 * of the card, and the line of type ran across it on every card — at 9% on the
 * printed stock it read as a watermark; on the engraved stock, at 50–62%, the
 * line sat on top of the bird. So the picture has a box and the type has a
 * column, and they do not share an inch of paper.
 *
 * The box is the full height of the card inside a 40px margin. The art files
 * carry their own cream margin — they were cut for the front, where `slice`
 * crops it away — so shown whole they read as a stamp in a field of paper.
 * The back instead frames each animal at its measured extent (ART_EXTENT) and
 * fits THAT to the box: the portrait ones fill the height, the wide ones fill
 * the width, and none is clipped. Everything typed lives in the column; the
 * three facts stack at its foot and the index sits under the picture.
 */
export const BACK = Object.freeze({
  textRight: 480,             // the type column ends here …
  pad: 40,                    // … and the picture keeps this much paper on three sides
  ghostX: 520,                // 40px of paper between the column and the picture
  ghostY: 40, ghostH: 520,    // the full height, inside the padding: 600 − 2·40
  ghostW: 490,                // to the right-hand margin: 1050 − 40 − 520
  factsY: 448, factStep: 36,  // the three facts, bottom-anchored in the column
  indexY: 584,                // "N OF 5", bottom-right, under the picture
  lineStep: 1.25,             // line height as a multiple of the type size
  // Widest realistic advance per character for the serif at these sizes,
  // measured in Cormorant Garamond: sentence text runs 0.38–0.44em per
  // character; 0.44 is the ceiling used to turn a pixel budget into a wrap.
  em: 0.44,
});

/**
 * Where the animal actually is inside each art file, in file pixels (802x1200).
 * Measured: every pixel that is not the cream ground, bounding box. The front
 * never needs this — `slice` covers its column — but the back frames the
 * animal, not the file. Re-measure with `node scripts/measure-art.js` when an
 * art file changes; the test suite does not read PNGs.
 */
export const ART_EXTENT = Object.freeze({
  paddlingout: Object.freeze({ x:  49, y: 270, w: 703, h:  634 }),
  forge:       Object.freeze({ x:  80, y: 190, w: 641, h:  795 }),
  kortex:      Object.freeze({ x:  80, y: 282, w: 642, h:  611 }),
  kaayko:      Object.freeze({ x:  82, y: 363, w: 639, h:  451 }),
  alumni:      Object.freeze({ x:  30, y: 302, w: 742, h:  571 }),
});

/** How many characters of the back line fit in the type column at this size. */
export const backWrap = (size) => Math.floor((BACK.textRight - 88) / (size * BACK.em));

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
<text x="${TX}" y="${T.name.y}"${F} style="font:${T.name.weight} ${nameSize(card, T.name.size)}px ${skin.serif};${track(T.name.track)}fill:${skin.ink}">${esc(cased(card.name, T.name.caps))}</text>
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

  const L = 88;                      // the type column's left edge; its right is BACK.textRight

  // In its own box, right of the type column and between the label row and
  // the facts row. `meet`, not `slice`: the whole animal, smaller, rather than
  // a crop of it — a watermark is a picture you can name at arm's length.
  // A nested <svg> whose viewBox is the animal's extent: the file is drawn at
  // its natural size inside it, and only that window is fitted to the box.
  const ex = ART_EXTENT[card.art || card.slug] || { x: 0, y: 0, w: 802, h: 1200 };
  const ghost = artHref && skin.art
    ? `<g opacity="${skin.ghostOpacity}"${skin.artFilter ? ` filter="${skin.artFilter}"` : ""}><svg x="${BACK.ghostX}" y="${BACK.ghostY}" width="${BACK.ghostW}" height="${BACK.ghostH}" viewBox="${ex.x} ${ex.y} ${ex.w} ${ex.h}" preserveAspectRatio="xMidYMid meet"><image href="${esc(artHref)}" x="0" y="0" width="802" height="1200"/></svg></g>`
    : "";

  // The line wraps inside the column instead of running under the picture,
  // and the rule and the address move down with it when it takes two lines.
  // Up to three rows. Two was the cap, and a sentence that needed a third
  // simply lost its last words — "…before you make the drive" printed without
  // the drive. The rule and the address move down with it; the facts are
  // anchored to the foot, and the test suite checks the address clears them.
  const lineSize = T.backLine.size;
  const lineRows = wrap(line, backWrap(lineSize), 3);
  const lineStep = Math.round(lineSize * BACK.lineStep);
  const lineSvg = lineRows.map((row, i) =>
    `<text x="${L}" y="${T.backLine.y + i * lineStep}"${F} style="font:${T.backLine.weight} ${lineSize}px ${skin.serif};${track(T.backLine.track)}fill:${skin.mute}">${esc(row)}</text>`
  ).join("\n");
  const ruleY = T.backLine.y + (lineRows.length - 1) * lineStep + 56;
  const hostY = ruleY + 40;

  // Three facts, stacked at the foot of the column, each behind a short accent
  // tick. They used to sit in three cells across the whole card, which put the
  // third one under the animal; the longest of them measures 302px at this
  // size, in a column 524 wide. Anchored to the bottom, so a sentence that takes
  // two lines above moves nothing below.
  const factRow = facts.map((f, k) => {
    const y = BACK.factsY + k * BACK.factStep;
    return `<path d="M${L} ${y - 5} H${L + 22}" stroke="${accent}" stroke-width="1.4" opacity=".85"/>
<text x="${L + 36}" y="${y}"${F} style="font:300 15px ${skin.sans};fill:${skin.ink};letter-spacing:3px">${esc(String(f).toUpperCase())}</text>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="3.5in" height="2in"
     viewBox="0 0 ${W} ${H}" data-property="${esc(card.slug || "")}">
${skin.defs}<rect width="${W}" height="${H}" fill="${skin.paper}"/>
<!-- The same animal as the front, ghosted, in a box of its own. It is the one
     thing that makes a card recognisably its own at arm's length — and nothing
     is printed over it, at any opacity, on any stock. -->
${ghost}
${skin.spine ? `<rect x="0" y="0" width="8" height="${H}" fill="${accent}"/>` : ""}${skin.plate || ""}

<text x="${L}" y="86"${F} style="font:300 22px ${skin.sans};fill:${skin.mute};letter-spacing:9px">${esc(label)}</text>
<text x="${L}" y="${T.backName.y}"${F} style="font:${T.backName.weight} ${nameSize(card, T.backName.size)}px ${skin.serif};${track(T.backName.track)}fill:${skin.ink}">${esc(cased(card.name || "", T.backName.caps))}</text>
${lineSvg}

<!-- Stops at the type column's edge, so it never runs across the animal. The
     address sits directly under it, at the size of a caption rather than a
     headline. Both drop a line when the sentence above them takes two. -->
<path d="M${L} ${ruleY} H${L + (BACK.textRight - L) / 2}" stroke="${skin.mute}" stroke-width="0.9" opacity=".28"/>
<text x="${L}" y="${hostY}"${F} style="font:400 24px ${skin.serif};fill:${skin.mute}">${esc(hostOf(card))}</text>
${factRow}

<text x="${W - BACK.pad}" y="${BACK.indexY}" text-anchor="end"${F}
      style="font:300 12px ${skin.sans};fill:${skin.mute};letter-spacing:5px">${index} OF ${total}</text>
</svg>`;
}

export const dataUri = (svg) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
