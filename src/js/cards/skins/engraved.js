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
  stories:     Object.freeze({ name: "Subtle off-white", hex: "#F4EEE1", note: "tasteful thickness" }),
  forge:       Object.freeze({ name: "Pale Nimbus", hex: "#F3F1E8", note: "raised lettering" }),
  kortex:      Object.freeze({ name: "White",       hex: "#F5F0E9", note: "flat printed" }),
  alumni:      Object.freeze({ name: "Off-white",   hex: "#F3F0E5", note: "watermarked" }),
});

/**
 * Six jobs, four stocks and two halves of one compliment. Since 23 Oct 2026
 * the jobs differ in paper and die only; the type is one spec (NAME, HOOK).
 *
 * Every stock and every lettering name above is one the scene actually says:
 * bone, eggshell, pale nimbus, white, off-white, Silian Rail, Romalian type,
 * and the subtle off-white and tasteful thickness of Paul Allen's card, which
 * Stories took when the watermark had gone to Alumni. Six cards, none twice.
 *
 * Kortex is the flat one. Somebody always orders the cheap job, and the whole
 * point is that you have to look twice to notice.
 *
 * `deboss` is the die: `blur` is how soft its edge is, `scale` how deep it
 * went (the slope of the relief, so how hard the light catches it), `tone`
 * the faint tint left in the impression whatever the light does. There is no
 * direction in here any more — which way the relief throws its shadow is the
 * lamp's business, see embossParams and cards/emboss.js.
 */
const VARIATION = Object.freeze({
  kaayko: Object.freeze({ relief: "raise" }),
  // The die went deeper here: a longer shadow off the artwork.
  paddlingout: Object.freeze({ relief: "raise", deboss: { blur: 1.35, scale: 1.9, tone: ".14" } }),
  // Paul Allen's card, the half the watermark did not take: the subtle
  // off-white, and the tasteful thickness of it. The die goes in deeper than
  // anywhere but Paddling Out, because thickness is the whole compliment.
  stories: Object.freeze({ relief: "raise", deboss: { blur: 1.25, scale: 1.75, tone: ".12" } }),
  forge: Object.freeze({ relief: "raise" }),
  // Flat. No die, no relief, no shoulder on a single letter. The saving is
  // real and so is the difference, once you have the other four beside it.
  kortex: Object.freeze({ relief: "none", deboss: { blur: 1.1, scale: .9, tone: ".07" } }),
  // The lightest hand of the six, and the animal pushed up into a watermark
  // rather than held down as an impression.
  alumni: Object.freeze({ relief: "raise", ghost: ".62", deboss: { blur: .95, scale: 1.4, tone: ".10" } }),
});

const DEBOSS_DEFAULT = Object.freeze({ blur: 1.1, scale: 1.5, tone: ".11" });

/**
 * One type spec for every card (23 Oct 2026). Each card used to set its own
 * name (46–62, Forge alone in lower case) and a hook about half that size —
 * the joke of six slightly different jobs. On a screen it read as a mistake,
 * the card changing size under your thumb. The paper still differs card to
 * card (STOCKS), which is where the joke always lived. Sizes are for the
 * screen card: "PADDLING OUT" at 56 tracked 6 ends at 1004 of 1010, and a
 * hook at 40 wraps at 26 characters into two rows that end above the QR.
 */
const NAME = Object.freeze({ size: 56, weight: 500, y: 204, track: 6, caps: true });
// The hook was 34 at weight 300: a hairline italic in a muted ink, and on a
// phone it was not readable. 40 at 400 is (23 Oct 2026).
const HOOK = Object.freeze({ size: 40, weight: 400, y: 284, step: 50, wrap: 26, track: .4, italic: true });

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
 * The relief.
 *
 * NOTHING IN HERE MOVES, and almost nothing in here is a filter. That is the
 * whole design, and both halves were measured on an iPhone.
 *
 * The relief used to be lit by a lamp inside an SVG filter — a feDistantLight
 * whose azimuth was rewritten as the card turned. Every rewrite re-ran a blur
 * and a specular pass over the face, and that was the stutter in the
 * engraved set. So the relief became four still pictures per face — the
 * emboss lit from the right, the left, below, above — and the one lamp in
 * cards/lamp.js only sets how much of each shows. A Lambert emboss is linear
 * in the light: the brightness a bump adds or takes away under a light L is
 * −(L.x·hx + L.y·hy) for a height field h; the x term is one picture scaled
 * by L.x, the y term another scaled by L.y, split by sign because a picture
 * cannot be shown at a negative opacity.
 *
 * Then the stills themselves stopped being filters. Fourteen primitives per
 * still cost 267ms to lay on iOS, and cost the same at half the resolution:
 * WebKit pays per primitive, not per pixel. The animal's stills are now
 * computed once in cards/emboss.js — the same height field, blur and
 * difference, in a typed array — and laid as plain canvases. The params
 * below are what that computation takes. Only the raised lettering is still
 * a filter, and it is two primitives, not eleven.
 */

/** Where each still's light comes from, in the face's own frame: x right, y down. */
export const DIRS = Object.freeze({ xp: [1, 0], xn: [-1, 0], yp: [0, 1], yn: [0, -1] });

const idFor = (card, face) => {
  const slug = String(card?.slug || "card").replace(/[^a-z0-9-]/gi, "") || "card";
  return { slug, id: `kx-${slug}-${face === "b" ? "b" : "f"}` };
};

/**
 * What the die did to this card's animal, for cards/emboss.js: the softness
 * of its edge, how hard the light catches a slope, the tint it leaves in
 * the impression, and how far the back's watermark is pushed under the words.
 */
export function embossParams(card) {
  const { slug } = idFor(card, "f");
  const v = VARIATION[slug] || VARIATION.kaayko;
  const d = { ...DEBOSS_DEFAULT, ...(v.deboss || {}) };
  return { blur: d.blur, gain: 1.6 * d.scale, tone: Number(d.tone), ghost: Number(v.ghost || ".5") };
}

/**
 * Raised lettering, lit from one side: a warm shadow thrown away from the
 * light and a white shoulder toward it, under the glyph, which the still
 * draws again in ink over the face's own. Two primitives: feDropShadow is
 * blur, offset, flood and composite in one, and the second takes the first's
 * result. A real die gives about one unit of relief, and at one unit of
 * 1050 across a phone this was invisible — technically faithful and
 * practically absent — so it is drawn at the scale the screen can resolve.
 * The flat job omits this rather than weakening it, because a plate that
 * was never made leaves nothing at all.
 */
function typeFilter(id, dir) {
  const [ax, ay] = DIRS[dir];
  // 23 Oct 2026: crisper and deeper. The shadow was 2.6 units with a 1.1 blur
  // — 0.8px of haze on a phone, so the letters read as flat ink beside an
  // animal that plainly stands up. A raised letter is read from a hard edge:
  // a tight dark one away from the light and a bright one toward it, about a
  // device pixel each at phone size.
  return `<filter id="${id}" x="-8%" y="-22%" width="116%" height="144%" color-interpolation-filters="sRGB">
  <feDropShadow dx="${(-3.4 * ax).toFixed(2)}" dy="${(-3.4 * ay).toFixed(2)}" stdDeviation=".5" flood-color="#4A4130" flood-opacity=".8"/>
  <feDropShadow dx="${(2.4 * ax).toFixed(2)}" dy="${(2.4 * ay).toFixed(2)}" stdDeviation=".35" flood-color="#FFFFFF" flood-opacity="1"/>
</filter>`;
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
 * @param {object} PRINT  the skin this one starts from: render.js's PRINT, or the
 *                        web card's SCREEN (no address, rule or back edge)
 */
export function engravedFor(card, PRINT, face = "f") {
  // The filter ids the page builds from this are per card AND per face: an
  // id is document-wide, and both faces live in the same document.
  const { slug } = idFor(card, face);
  const stock = STOCKS[slug] || FALLBACK;
  const v = VARIATION[slug] || VARIATION.kaayko;
  const name = NAME, hook = HOOK;

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
    // No animal in the base at all, and no filter. The animal is the relief,
    // laid over the face by the page from cards/emboss.js: the impression's
    // tint, and four stills under the lamp. The base is plain paper and type,
    // which is why switching to this set costs the page nothing it can feel.
    art: false,
    artFilter: "",
    ghostOpacity: v.ghost || ".5",
    defs: "",
    // Flat in the base on every job; the raised jobs get their shadow and
    // shoulder from reliefType, over the top, under the lamp.
    textFilter: "",
    type: Object.freeze({
      // One spec for all six (NAME, HOOK above): the cards differ in paper, not type.
      name:     Object.freeze({ ...PRINT.type.name, ...name }),
      // wrap() counts characters and knows nothing about the font, so a hook
      // set smaller must be allowed more of them or it breaks early.
      hook:     Object.freeze({ ...PRINT.type.hook, ...hook }),
      // The back's column is 392px and the name is set in caps with wide
      // tracking, which is what made "PADDLING OUT" 445px at the old size.
      // Smaller and tighter here than on the front; the test suite measures
      // it against BACK.textRight.
      backName: Object.freeze({ ...PRINT.type.backName, weight: name.weight, size: Math.round(name.size * .74), y: 176, track: Math.max(0, name.track - 4), caps: name.caps }),
      backLine: Object.freeze({ ...PRINT.type.backLine, size: 30, y: 238, track: .5 }),
    }),
  };
}

/** The stock a card is printed on, for the caption under it in the set view. */
export const stockOf = (card) => STOCKS[card?.slug] || FALLBACK;
