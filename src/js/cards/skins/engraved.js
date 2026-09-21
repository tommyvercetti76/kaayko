/**
 * cards/skins/engraved.js — the same five cards, printed by an engraver.
 *
 * WHAT THIS IS
 * ------------
 * An opt-in skin for the web page only. The printed card is untouched: this
 * module never mutates render.js, it passes it a second set of values, and
 * tests/cardRender.test.mjs pins the bytes the default skin still emits.
 *
 * THE IDEA
 * --------
 * Kaayko's cards are loud — five accent colours, five illustrated animals, a
 * gold foil that moves with the light. An engraver's card is the opposite: one
 * ink, no colour, nothing drawn that does not have to be there, and the only
 * thing separating one card from the next is a paper stock you cannot name at
 * arm's length. The skin is therefore an act of subtraction, and the joke only
 * lands if the five become ALMOST the same. Almost is a measurement, not a
 * feeling — see STOCKS.
 *
 * WHAT SURVIVES, AND WHY
 * ----------------------
 * The animals stay. They are the one thing that makes a card recognisably its
 * own, and deleting them would leave five blank rectangles that are merely
 * empty rather than expensive. Instead the ink comes off them: #deboss turns
 * the artwork into a height map and lights it, so the animal is present at full
 * detail and carries no colour at all — a blind emboss, which is the single
 * most expensive thing a real stationer can do to a sheet of paper.
 */

/**
 * Five off-whites, measured rather than chosen.
 *
 * Every pair sits between dE00 0.91 and 3.32 (CIEDE2000). Below about 1.0 a
 * pair is indistinguishable to a normal-vision reader; by 3.3 a pair is clearly
 * two different papers. So: two pairs here nobody can separate, none obviously
 * different, and the whole set reads as one sheet until you lay them side by
 * side. That band IS the gag, and it is the reason these hexes are not a matter
 * of taste.
 *
 * The stock carries no meaning. Every card still says its own name in words,
 * because a reader who cannot see the difference between Bone and Antique —
 * which is most readers, which is the point — must lose nothing.
 */
export const STOCKS = Object.freeze({
  kaayko:      Object.freeze({ name: "Bone",        hex: "#F7EEE1", note: "Silian Rail" }),
  paddlingout: Object.freeze({ name: "Eggshell",    hex: "#F6EFE3", note: "Romalian type" }),
  forge:       Object.freeze({ name: "Pale Nimbus", hex: "#F3F1E8", note: "raised lettering" }),
  kortex:      Object.freeze({ name: "White",       hex: "#F5F0E9", note: "flat printed" }),
  alumni:      Object.freeze({ name: "Off-white",   hex: "#F3F0E5", note: "watermarked" }),
});

/**
 * Five jobs, four stocks.
 *
 * Every stock and every lettering name above is one the scene actually says:
 * bone, eggshell, pale nimbus, white, off-white, Silian Rail, Romalian type.
 * Five names, five cards, and none of them used twice.
 *
 * Kortex is the flat one. Somebody always orders the cheap job, and the whole
 * point is that you have to look twice to notice.
 *
 * `deboss` is the die: `blur` is how soft its edge is, `scale` how deep it
 * went (the slope of the relief, so how hard the light catches it), `tone`
 * the faint tint left in the impression whatever the light does. There is no
 * direction in here any more — which way the relief throws its shadow is the
 * lamp's business, see reliefArt below.
 */
const VARIATION = Object.freeze({
  // Widest tracking of the five, and the only one whose hook is tracked too.
  kaayko: Object.freeze({
    relief: "raise",
    type: { name: { size: 50, weight: 500, y: 188, track: 11, caps: true },
            hook: { size: 26, weight: 300, y: 252, step: 36, wrap: 40, track: 1.6, italic: false } },
  }),
  // The die went deeper here: a longer shadow off the artwork, and the type
  // set a shade smaller so the impression has room around it.
  paddlingout: Object.freeze({
    relief: "raise",
    deboss: { blur: 1.35, scale: 1.9, tone: ".14" },
    type: { name: { size: 46, weight: 500, y: 186, track: 7, caps: true },
            hook: { size: 25, weight: 300, y: 248, step: 34, wrap: 42, track: .8, italic: true } },
  }),
  // The one that refuses to uppercase. Heavier, tighter, and the only card in
  // the set whose name is still set the way a book would set it.
  forge: Object.freeze({
    relief: "raise",
    type: { name: { size: 62, weight: 500, y: 196, track: 1.5, caps: false },
            hook: { size: 25, weight: 300, y: 254, step: 34, wrap: 42, track: .6, italic: true } },
  }),
  // Flat. No die, no relief, no shoulder on a single letter. The saving is
  // real and so is the difference, once you have the other four beside it.
  kortex: Object.freeze({
    relief: "none",
    deboss: { blur: 1.1, scale: .9, tone: ".07" },
    type: { name: { size: 48, weight: 400, y: 188, track: 9, caps: true },
            hook: { size: 26, weight: 300, y: 250, step: 35, wrap: 40, track: 1, italic: false } },
  }),
  // The lightest hand of the five, and the animal pushed up into a watermark
  // rather than held down as an impression.
  alumni: Object.freeze({
    relief: "raise",
    ghost: ".62",
    deboss: { blur: .95, scale: 1.4, tone: ".10" },
    type: { name: { size: 47, weight: 400, y: 187, track: 10, caps: true },
            hook: { size: 25, weight: 300, y: 250, step: 34, wrap: 42, track: 1.2, italic: false } },
  }),
});

const DEBOSS_DEFAULT = Object.freeze({ blur: 1.1, scale: 1.5, tone: ".11" });

const FALLBACK = Object.freeze({ name: "Bone", hex: "#F7EEE1", note: "Silian Rail" });

/** The house face, which is Cormorant in caps and a lie, exactly as intended. */
export const FACE = "Kaayko Engravers Roman";

// One ink for all five. #1E1810 is render.js's own INK, so the engraved card is
// printed in the colour the loud one already used — it just stops being the
// only thing on the page that is not coloured.
const INK = "#1E1810";
// Every stock here is light enough that this clears 6.6:1 at worst. Checked,
// not assumed: the darkest stock is Antique #F7EEE1.
const MUTE = "#5E5240";
// The hook and the fact rules, one step above MUTE so the card still has three
// weights of voice without having three colours.
const QUIET = "#46402F";

/**
 * Filters are defined per card and per face, because an id is document-wide and
 * the admin preview concatenates both faces into one string.
 *
 * NOTHING IN HERE MOVES. That is the whole design.
 *
 * The relief used to be lit by a lamp inside the filter — a feDistantLight
 * whose azimuth was rewritten as the card turned. Every rewrite re-ran a blur
 * and a specular pass over the face, on the main thread's schedule, and that
 * was the stutter in the engraved set: the card's TURN was waiting on the
 * relief's RASTER. So the relief is now four still pictures per face — the
 * emboss lit from the right, from the left, from below, from above — and the
 * one lamp in cards/lamp.js only sets how much of each shows. An opacity is
 * the compositor's to change; a filter is not.
 *
 * It works because a Lambert emboss is linear in the light. The brightness a
 * bump adds or takes away under a light L is −(L.x·hx + L.y·hy) for a height
 * field h: the x term is one picture scaled by L.x, the y term another scaled
 * by L.y, and a picture cannot be shown at a negative opacity, so each axis
 * is split by sign. Four pictures, four opacities, and the emboss turns under
 * the lamp exactly as the sheen does, because it is the same L.
 */
const HEIGHT = (blur) => `<!-- alpha = source alpha - luminance. Subtracting luminance alone would give
       the transparent area OUTSIDE the artwork a height of 1, and the filter
       region would emboss as a rectangle. The dark animal becomes the raised
       form; everything bright becomes flat stock. -->
  <feColorMatrix in="SourceGraphic" type="matrix" result="h" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.2126 -0.7152 -0.0722 1 0"/>
  <!-- The art is painted on a near-white ground, which still carries a little
       height. Clamp it to none, or the edge of the image prints as a panel. -->
  <feComponentTransfer in="h" result="hc"><feFuncA type="linear" slope="1.9" intercept="-0.17"/></feComponentTransfer>
  <feGaussianBlur in="hc" stdDeviation="${blur}" result="hb"/>`;

/** The impression itself, under no light in particular: a faint tint where the die bit. */
const impress = (id, d) => `<filter id="${id}-impress" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
  ${HEIGHT(d.blur)}
  <feFlood flood-color="#8C8375" flood-opacity="${d.tone}" result="c"/>
  <feComposite in="c" in2="hb" operator="in"/>
</filter>`;

/** Where each still's light comes from, in the face's own frame: x right, y down. */
export const DIRS = Object.freeze({ xp: [1, 0], xn: [-1, 0], yp: [0, 1], yn: [0, -1] });

/**
 * The emboss lit from one side. A slope that faces the light is lit white; a
 * slope that faces away is in shadow. h(p + s·a) − h(p − s·a) is the rise of
 * the surface TOWARD the light: positive means the surface climbs toward it,
 * which is the far side of a bump, in shadow; negative is the near side, lit.
 */
function reliefFilter(id, dir, d) {
  const [ax, ay] = DIRS[dir];
  const step = 1.5;
  const gain = (1.6 * d.scale).toFixed(2);
  return `<filter id="${id}" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
  ${HEIGHT(d.blur)}
  <feOffset in="hb" dx="${(-step * ax).toFixed(2)}" dy="${(-step * ay).toFixed(2)}" result="fwd"/>
  <feOffset in="hb" dx="${(step * ax).toFixed(2)}" dy="${(step * ay).toFixed(2)}" result="bwd"/>
  <feComposite in="fwd" in2="bwd" operator="arithmetic" k2="1" k3="-1" result="rise"/>
  <feComposite in="bwd" in2="fwd" operator="arithmetic" k2="1" k3="-1" result="fall"/>
  <feComponentTransfer in="rise" result="riseg"><feFuncA type="linear" slope="${gain}"/></feComponentTransfer>
  <feComponentTransfer in="fall" result="fallg"><feFuncA type="linear" slope="${gain}"/></feComponentTransfer>
  <feFlood flood-color="#FFFFFF" result="w"/>
  <feFlood flood-color="#4A4034" result="k"/>
  <feComposite in="w" in2="fallg" operator="in" result="lit"/>
  <feComposite in="k" in2="riseg" operator="in" result="dark"/>
  <feMerge><feMergeNode in="dark"/><feMergeNode in="lit"/></feMerge>
</filter>`;
}

/**
 * Raised lettering, lit from one side: a warm shadow thrown away from the
 * light and a white shoulder toward it, both cut away under the glyph itself
 * since the ink is drawn by the face beneath. A real die gives about one
 * unit of relief, and at one unit of 1050 across a phone this was invisible
 * — technically faithful and practically absent — so it is drawn at the
 * scale the screen can resolve. The flat job omits this rather than
 * weakening it, because a plate that was never made leaves nothing at all.
 */
function typeFilter(id, dir) {
  const [ax, ay] = DIRS[dir];
  return `<filter id="${id}" x="-8%" y="-22%" width="116%" height="144%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="sb"/>
  <feOffset in="sb" dx="${(-2.6 * ax).toFixed(2)}" dy="${(-2.6 * ay).toFixed(2)}" result="so"/>
  <feFlood flood-color="#8A8064" flood-opacity=".9" result="sc"/>
  <feComposite in="sc" in2="so" operator="in" result="s1"/>
  <feComposite in="s1" in2="SourceAlpha" operator="out" result="shadow"/>
  <feGaussianBlur in="SourceAlpha" stdDeviation=".7" result="hb"/>
  <feOffset in="hb" dx="${(1.7 * ax).toFixed(2)}" dy="${(1.7 * ay).toFixed(2)}" result="ho"/>
  <feFlood flood-color="#FFFFFF" result="hc"/>
  <feComposite in="hc" in2="ho" operator="in" result="h1"/>
  <feComposite in="h1" in2="SourceAlpha" operator="out" result="shoulder"/>
  <feMerge><feMergeNode in="shadow"/><feMergeNode in="shoulder"/></feMerge>
</filter>`;
}

const defs = (id, d) => `<defs>
${impress(id, d)}
</defs>
`;

const idFor = (card, face) => {
  const slug = String(card?.slug || "card").replace(/[^a-z0-9-]/gi, "") || "card";
  return { slug, id: `kx-${slug}-${face === "b" ? "b" : "f"}` };
};

/**
 * The four stills of the animal for one face, as SVG strings the page lays
 * over the drawn card. Each is the art exactly where render.js puts it —
 * the front's column, or the back's boxed window on the animal's extent —
 * so the relief lands on the animal and not beside it.
 *
 * @returns {{xp:string, xn:string, yp:string, yn:string}}
 */
export function reliefArt(card, artHref, face, { W = 1050, H = 600, column, back, extent } = {}) {
  const { slug, id } = idFor(card, face);
  const v = VARIATION[slug] || VARIATION.kaayko;
  const d = { ...DEBOSS_DEFAULT, ...(v.deboss || {}) };
  const href = String(artHref).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const out = {};
  for (const dir of Object.keys(DIRS)) {
    const fid = `${id}-${dir}`;
    const art = face === "b"
      ? `<g opacity="${v.ghost || ".5"}" filter="url(#${fid})"><svg x="${back.ghostX}" y="${back.ghostY}" width="${back.ghostW}" height="${back.ghostH}" viewBox="${extent.x} ${extent.y} ${extent.w} ${extent.h}" preserveAspectRatio="xMidYMid meet"><image href="${href}" x="0" y="0" width="802" height="1200"/></svg></g>`
      : `<g filter="url(#${fid})"><image href="${href}" x="${column.x}" y="${column.y}" width="${column.w}" height="${column.h}" preserveAspectRatio="xMidYMid slice"/></g>`;
    out[dir] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>${reliefFilter(fid, dir, d)}</defs>${art}</svg>`;
  }
  return out;
}

/**
 * The four filters for the raised type on one face, or null for the flat
 * job. The page clones the face's own <text> elements under each, so the
 * lettering is never set twice and cannot drift from what the card says.
 *
 * @returns {{xp:{id,defs}, …}|null}
 */
export function reliefType(card, face) {
  const { slug, id } = idFor(card, face);
  const v = VARIATION[slug] || VARIATION.kaayko;
  if (v.relief === "none") return null;
  const out = {};
  for (const dir of Object.keys(DIRS)) {
    const fid = `${id}-t-${dir}`;
    out[dir] = { id: fid, defs: typeFilter(fid, dir) };
  }
  return out;
}

/**
 * The skin for one card. Built per card because the stock and the filter ids
 * both depend on which card it is.
 *
 * @param {object} card   a card record; only `slug` is read
 * @param {object} PRINT  the default skin, which this one starts from
 */
export function engravedFor(card, PRINT, face = "f") {
  // Per card AND per face. An id is document-wide, and the admin preview
  // concatenates a front and a back into one string, so `kx-kaayko-impress`
  // alone would be defined twice and every reference would resolve to the
  // first one. The set view makes the same mistake five times over.
  const { slug, id } = idFor(card, face);
  const stock = STOCKS[slug] || FALLBACK;
  const v = VARIATION[slug] || VARIATION.kaayko;
  const d = { ...DEBOSS_DEFAULT, ...(v.deboss || {}) };

  return {
    ...PRINT,
    // One sheet. The art column stops being a second colour, and the quiet zone
    // behind the QR stops being a fifth off-white nobody asked for.
    paper: stock.hex,
    cream: stock.hex,
    qrPaper: stock.hex,
    ink: INK,
    mute: MUTE,
    // A QR is a 1994 anachronism on an engraved card and cannot be helped, but
    // it can be asked to keep its voice down. MUTE on the lightest stock still
    // reads at 6.6:1, well above the ~40% luminance difference a scanner wants.
    qrInk: MUTE,
    // Five accents become one. This is the largest single subtraction.
    accentOf: () => QUIET,
    spine: false,
    art: true,
    // The base face carries only the impression's tint. The relief — lit
    // from wherever the lamp is — is laid over it by the page, see reliefArt.
    artFilter: `url(#${id}-impress)`,
    // The animal is already inkless; it does not also need to be faint.
    ghostOpacity: v.ghost || ".5",
    defs: defs(id, d),
    // Flat in the base on every job; the raised jobs get their shadow and
    // shoulder from reliefType, over the top, under the lamp.
    textFilter: "",
    type: Object.freeze({
      // Caps, size and tracking are the variation's, not the skin's: this is
      // where one card stops being the same job as the one beside it.
      name:     Object.freeze({ ...PRINT.type.name, ...v.type.name }),
      // wrap() counts characters and knows nothing about the font, so a hook
      // set smaller must be allowed more of them or it breaks early.
      hook:     Object.freeze({ ...PRINT.type.hook, ...v.type.hook }),
      // The back's column is 392px and the name is set in caps with wide
      // tracking, which is what made "PADDLING OUT" 445px at the old size.
      // Smaller and tighter here than on the front; the test suite measures
      // it against BACK.textRight.
      backName: Object.freeze({ ...PRINT.type.backName, weight: v.type.name.weight, size: Math.round(v.type.name.size * .74), y: 176, track: Math.max(0, v.type.name.track - 4), caps: v.type.name.caps }),
      backLine: Object.freeze({ ...PRINT.type.backLine, size: 24, y: 230, track: .5 }),
    }),
  };
}

/** The stock a card is printed on, for the caption under it in the set view. */
export const stockOf = (card) => STOCKS[card?.slug] || FALLBACK;
