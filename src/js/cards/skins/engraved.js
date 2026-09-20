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
 * plate, one ink, no colour, and the only thing separating one card from the
 * next is a paper stock you cannot name at arm's length. The skin is therefore
 * an act of subtraction, and the joke only lands if the five become ALMOST the
 * same. Almost is a measurement, not a feeling — see STOCKS.
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
  kaayko:      Object.freeze({ name: "Bone",     hex: "#F6EFE3", note: "raised lettering" }),
  paddlingout: Object.freeze({ name: "Oyster",   hex: "#F3F1E8", note: "deep impression" }),
  forge:       Object.freeze({ name: "Antique",  hex: "#F7EEE1", note: "Romalian type" }),
  kortex:      Object.freeze({ name: "Cloud",    hex: "#F5F0E9", note: "flat printed" }),
  alumni:      Object.freeze({ name: "Eggshell", hex: "#F3F0E5", note: "watermarked" }),
});

/**
 * Five jobs off five different plates.
 *
 * The stock alone is not the gag. In the scene the cards differ in stock AND
 * in the lettering AND in how deep the die went, and every man is certain his
 * combination is the better one. So each card here gets its own treatment, and
 * the treatments are chosen to be describable in three words and almost
 * impossible to rank.
 *
 * Kortex is the one with no relief at all. Somebody always orders the cheap
 * job, and the whole point is that you have to look twice to notice.
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
    deboss: { blur: 1.35, scale: 4.4, dx: 1.5, dy: 1.8, shade: ".52" },
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
    deboss: { blur: 1.1, scale: 1.5, dx: .5, dy: .6, shade: ".24" },
    type: { name: { size: 48, weight: 400, y: 188, track: 9, caps: true },
            hook: { size: 26, weight: 300, y: 250, step: 35, wrap: 40, track: 1, italic: false } },
  }),
  // The lightest hand of the five, and the animal pushed up into a watermark
  // rather than held down as an impression.
  alumni: Object.freeze({
    relief: "raise",
    ghost: ".62",
    deboss: { blur: .95, scale: 2.6, dx: .9, dy: 1.1, shade: ".34" },
    type: { name: { size: 47, weight: 400, y: 187, track: 10, caps: true },
            hook: { size: 25, weight: 300, y: 250, step: 34, wrap: 42, track: 1.2, italic: false } },
  }),
});

const DEBOSS_DEFAULT = Object.freeze({ blur: 1.1, scale: 3.2, dx: 1.1, dy: 1.3, shade: ".42" });

const FALLBACK = Object.freeze({ name: "Bone", hex: "#F6EFE3", note: "raised lettering" });

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
 * Filters are defined per card, because five cards share one document in the
 * set view and an id is document-wide: `url(#deboss)` would resolve to
 * whichever card rendered first.
 */
const defs = (id, d, relief) => `<defs>
<filter id="${id}-deboss" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
  <!-- alpha = source alpha - luminance. Subtracting luminance alone would give
       the transparent area OUTSIDE the artwork a height of 1, and the filter
       region would emboss as a rectangle. The dark animal becomes the raised
       form; everything bright becomes flat stock. -->
  <feColorMatrix type="matrix" result="h" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.2126 -0.7152 -0.0722 1 0"/>
  <!-- The art is painted on a near-white ground, which still carries a little
       height. Clamp it to none, or the edge of the image prints as a panel. -->
  <feComponentTransfer in="h" result="hc"><feFuncA type="linear" slope="1.9" intercept="-0.17"/></feComponentTransfer>
  <feGaussianBlur in="hc" stdDeviation="${d.blur}" result="hb"/>
  <feSpecularLighting in="hb" surfaceScale="${d.scale}" specularConstant="1" specularExponent="18" lighting-color="#ffffff" result="lit">
    <feDistantLight azimuth="228" elevation="58"/>
  </feSpecularLighting>
  <feComposite in="lit" in2="hb" operator="in" result="litin"/>
  <feOffset in="hb" dx="${d.dx}" dy="${d.dy}" result="sh"/>
  <feFlood flood-color="#8C8375" flood-opacity="${d.shade}" result="shc"/>
  <feComposite in="shc" in2="sh" operator="in" result="shadow"/>
  <feMerge><feMergeNode in="shadow"/><feMergeNode in="litin"/></feMerge>
</filter>
${relief === "none" ? "" : `<!-- Raised lettering. One unit of relief, which is what an engraver's die
     actually gives you: felt with a thumb, barely seen. Anything more reads as
     a 2009 web emboss. The flat job omits this filter rather than weakening
     it, because a plate that was never made leaves nothing at all. -->
<filter id="${id}-raise" x="-5%" y="-16%" width="110%" height="132%" color-interpolation-filters="sRGB">
  <feDropShadow dx="0.8" dy="1" stdDeviation="0.3" flood-color="#FFFFFF" flood-opacity=".8"/>
  <feDropShadow dx="-0.4" dy="-0.5" stdDeviation="0.25" flood-color="#000000" flood-opacity=".14"/>
</filter>`}
</defs>
`;

/**
 * The plate mark: the blind rectangular bruise an engraving die leaves in the
 * sheet, 30 units inside the trim. No ink — a light edge where the paper is
 * pushed down and a darker one where it comes back up. It is identical on all
 * five cards, which is the other half of the joke.
 */
const PLATE = `
<rect x="30.8" y="30.8" width="988.4" height="538.4" fill="none" stroke="#BDB49F" stroke-width="1" opacity=".42"/>
<rect x="30" y="30" width="990" height="540" fill="none" stroke="#FFFFFF" stroke-width="1.1" opacity=".55"/>`;

/**
 * The skin for one card. Built per card because the stock and the filter ids
 * both depend on which card it is.
 *
 * @param {object} card   a card record; only `slug` is read
 * @param {object} PRINT  the default skin, which this one starts from
 */
export function engravedFor(card, PRINT, face = "f") {
  const slug = String(card?.slug || "card").replace(/[^a-z0-9-]/gi, "") || "card";
  const stock = STOCKS[slug] || FALLBACK;
  const v = VARIATION[slug] || VARIATION.kaayko;
  const d = { ...DEBOSS_DEFAULT, ...(v.deboss || {}) };
  // Per card AND per face. An id is document-wide, and the admin preview
  // concatenates a front and a back into one string, so `kx-kaayko-deboss`
  // alone would be defined twice and every reference would resolve to the
  // first one. The set view makes the same mistake five times over.
  const id = `kx-${slug}-${face === "b" ? "b" : "f"}`;

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
    plate: PLATE,
    art: true,
    artFilter: `url(#${id}-deboss)`,
    // The animal is already inkless; it does not also need to be faint.
    ghostOpacity: v.ghost || ".5",
    defs: defs(id, d, v.relief),
    // The flat job gets no filter reference at all, not a weaker one.
    textFilter: v.relief === "none" ? "" : `url(#${id}-raise)`,
    type: Object.freeze({
      // Caps, size and tracking are the variation's, not the skin's: this is
      // where one card stops being the same job as the one beside it.
      name:     Object.freeze({ ...PRINT.type.name, ...v.type.name }),
      // wrap() counts characters and knows nothing about the font, so a hook
      // set smaller must be allowed more of them or it breaks early.
      hook:     Object.freeze({ ...PRINT.type.hook, ...v.type.hook }),
      backName: Object.freeze({ ...PRINT.type.backName, weight: v.type.name.weight, size: Math.round(v.type.name.size * .88), y: 178, track: Math.max(0, v.type.name.track - 1), caps: v.type.name.caps }),
      backLine: Object.freeze({ ...PRINT.type.backLine, size: 26, y: 234, track: .6 }),
    }),
  };
}

/** The stock a card is printed on, for the caption under it in the set view. */
export const stockOf = (card) => STOCKS[card?.slug] || FALLBACK;
