/**
 * store-satire.js — the storefront's editorial voice, as data.
 *
 * Two voices, deliberately:
 *
 *   'satire'  the t-shirts. Deadpan, mock-official, told straight. The
 *             catalogue already talks this way ("Supreme / Shit"), so the PDP
 *             finishes the joke instead of apologising for it.
 *
 *   'field'   the wildlife totes and magnets. No jokes. These carry real
 *             animals and a real IUCN status, and a punchline next to
 *             "Critically Endangered" would be the wrong kind of funny.
 *
 * Keyed by Firestore document id (stable; titles are not). Every entry keeps a
 * `title` for review only — nothing matches on it. A SKU with no entry falls
 * back to a theme-shaped default, so a new product is never blank on the page.
 *
 * IUCN statuses are from the Red List and should be re-checked yearly.
 */

/* ── T-shirts ─────────────────────────────────────────────── */

const SATIRE = Object.freeze({
  hYOk6UuqAoKChJ1dU9Tc: {
    title: "Broke",
    story: "Worn exclusively by people paying for a subscription they have never once used. The shirt will not fix your finances. It does put the diagnosis on your chest, which is cheaper than therapy and roughly as effective.",
    file: [["Alias", "The Diagnosis"], ["Known for", "Brunch someone else paid for"], ["Threat level", "Mostly to your own credibility"]]
  },
  Bnd9cEgnqrIn01jr0uL6: {
    title: "Supreme",
    story: "One word on the front and an honest correction underneath it. This is what happens when a word promises transcendence and arrives as cotton.",
    file: [["Alias", "The Correction"], ["Known for", "Setting expectations, then lowering them"], ["Threat level", "Purely rhetorical"]]
  },
  u1y09H1U1ozUasNKwOrU: {
    title: "Freedom",
    story: "Priced accordingly. We did consider giving it away, and then remembered that the printer charges us either way.",
    file: [["Alias", "The Invoice"], ["Known for", "Being invoked loudly, funded quietly"], ["Threat level", "Depends who is asking"]]
  },
  "48NMICFJI5p0JeHDfzqA": {
    title: "HTMLK",
    story: "For the person who has explained what a div is at a party. Semantically correct. Socially ruinous.",
    file: [["Alias", "The Closing Tag"], ["Known for", "Unsolicited markup opinions"], ["Threat level", "Nested, unclosed"]]
  },
  "3uIpQlJEnvR1sDqaBLj5": {
    title: "Straight Outta Sabarmati",
    story: "The original nonviolent menace. Spun his own cloth, which makes him the only figure in this catalogue with a legitimate opinion about our supply chain.",
    file: [["Alias", "The Walkout"], ["Known for", "Out-stubborning an empire"], ["Threat level", "Unarmed and undefeated"]]
  },
  qCI4Eiyxdt6SI9VT45qX: {
    title: "Abe",
    story: "Freed a nation, lost a hat, and still out-dressed every man in the room. The beard is optional. The stovepipe is not sold separately, or at all.",
    file: [["Alias", "The Tall One"], ["Known for", "Winning the argument permanently"], ["Threat level", "Historically decisive"]]
  },
  MHLoIviEod8xPRHoEwj4: {
    title: "Pt. Beethoven",
    story: "Wrote the four most famous notes in history and never heard the room stand up. Hold that next to your complaint about the office wifi.",
    file: [["Alias", "The Ninth"], ["Known for", "Not hearing a word of it"], ["Threat level", "Fortissimo"]]
  },
  ILCeSIYh1FI7K13Ur8ez: {
    title: "Queen",
    story: "Stated without evidence and requiring none. Some claims survive on delivery alone.",
    file: [["Alias", "The Standard"], ["Known for", "Ending the comparison"], ["Threat level", "Sovereign"]]
  },
  gFWf7rDGw8bNxxRz2yTf: {
    title: "Courage",
    story: "Bravery has never been this affordable. One size braver, machine washable, no follow-through required.",
    file: [["Alias", "The Bluff"], ["Known for", "Arriving after the danger"], ["Threat level", "All talk, good cotton"]]
  },
  XxOtSWqOLvFzLEVSSAwQ: {
    title: "Hurry Up and Live",
    story: "A reminder printed on a garment you will own for years and actually wear for eleven days of them. The irony is included at no extra charge.",
    file: [["Alias", "The Deadline"], ["Known for", "Being right at the worst moment"], ["Threat level", "Terminal, eventually"]]
  },
  y2ROcdW0AbjKCDDDV0bv: {
    title: "Life is opinion",
    story: "Marcus Aurelius ran an empire and still found time to write that everything is opinion. You have a group chat and a standing desk. No excuses.",
    file: [["Alias", "The Meditation"], ["Known for", "Ending arguments by conceding first"], ["Threat level", "Stoic"]]
  },
  wV77tYkmibVgOQqEezX4: {
    title: "Nagpur",
    story: "The geographic centre of India, a very good orange, and a quantity of unearned confidence. We are from here. We are not objective about it.",
    file: [["Alias", "Zero Mile"], ["Known for", "Being the middle of everything"], ["Threat level", "Regional pride"]]
  },
  LY46yu4JYwulIRmSAEg3: {
    title: "No running your..",
    story: "The rest of the sentence is doing fine where it is. Finish it however you were going to finish it.",
    file: [["Alias", "The Trailing Off"], ["Known for", "Implication"], ["Threat level", "Unfinished"]]
  },
  Pqtt6rIQVbTBtKj4TQYh: {
    title: "Self ain't body",
    story: "Five thousand years of philosophy compressed into three words and a cotton blend. The compression is lossy. So is everything else.",
    file: [["Alias", "The Compression"], ["Known for", "Losing very little in translation"], ["Threat level", "Immaterial"]]
  },
  "8PnFf6bH3fwiH1dTCkFR": {
    title: "Sandrokoptos",
    story: "What the Greeks called Chandragupta once they ran out of ways to lose to him. History remembers the empire. We remember the spelling.",
    file: [["Alias", "The Mauryan"], ["Known for", "Being renamed by the losing side"], ["Threat level", "Imperial"]]
  },
  xyVsWqTkPcVbaiOCX0vv: {
    title: "The Great Climb",
    story: "Mallory's entire justification, and still the best reason anyone has given for doing anything. It works for mountains. It works here.",
    file: [["Alias", "Because It's There"], ["Known for", "Three words, no rebuttal"], ["Threat level", "Above 8,000m"]]
  },
  fByEJnlvdwayXv4OhIER: {
    title: "Assault Bae",
    story: "No context is provided and none is coming. Some shirts explain themselves. This one just makes eye contact.",
    file: [["Alias", "The Stare"], ["Known for", "Declining to elaborate"], ["Threat level", "Ambiguous by design"]]
  },
  ceTDbeFfKG7UppCbUBM7: {
    title: "Pikachu",
    story: "Something small and yellow reached its final form. So did the electricity bill.",
    file: [["Alias", "The Upgrade"], ["Known for", "Skipping a stage"], ["Threat level", "Static"]]
  },
  UDVuBiY3orq8vX78lY7E: {
    title: "Acharya Chanakya",
    story: "Wrote the Arthashastra, invented realpolitik, and would have had extremely unwelcome opinions about your quarterly targets. Ruthless, and impeccably dressed about it.",
    file: [["Alias", "The Advisor"], ["Known for", "Winning before the meeting"], ["Threat level", "Strategic"]]
  },
  Nix2uwTOMOZZLQrebMIO: {
    title: "Hypothermia",
    story: "The condition, not the recommendation. Wear layers. This is one of them, and it is not the important one.",
    file: [["Alias", "The Warning"], ["Known for", "Setting in quietly"], ["Threat level", "Below 35°C, core"]]
  },
  oWwDw6QWmvltZtjUpRMU: {
    title: "Peace Out",
    story: "Two gestures on one garment and no follow-through required from either.",
    file: [["Alias", "The Exit"], ["Known for", "Leaving before the question"], ["Threat level", "Departing"]]
  },
  M3luh9SyT8r4jv7sPekH: {
    title: "Question It",
    story: "It does not have to make sense. Neither did most of what you agreed to this week.",
    file: [["Alias", "The Follow-Up"], ["Known for", "Asking once too often"], ["Threat level", "Socratic"]]
  },
  LCIEI25KiuleOTWUbtxq: {
    title: "Savage Samurai",
    story: "Bushido, for a person whose greatest daily discipline is an alarm they snooze twice.",
    file: [["Alias", "The Code"], ["Known for", "Discipline, in principle"], ["Threat level", "Sheathed"]]
  },
  HjSLG7O1ZYPjsOevYMnl: {
    title: "Shut up, sit down, relax",
    story: "The only product in this store that tells you exactly what to do, and means all four parts of it.",
    file: [["Alias", "The Instruction"], ["Known for", "Being obeyed immediately"], ["Threat level", "Horizontal"]]
  },
  UA9VJJhZ1EhK7ZRwrwYT: {
    title: "Snow Cat",
    story: "Twelve thousand feet up, in weather that would finish you inside an hour, doing precisely what your cat does on the sofa. Ignoring you.",
    file: [["Alias", "The Ghost"], ["Known for", "Being somewhere you are not"], ["Threat level", "Indifferent"]]
  },
  ANYtm2qPfhsgwb2oAuz6: {
    title: "Stay Hydrated",
    story: "The most annoying correct advice in existence, now wearable, so you can finally stop saying it out loud.",
    file: [["Alias", "The Reminder"], ["Known for", "Being right, constantly"], ["Threat level", "Two litres daily"]]
  }
});

/* ── Wildlife pieces ──────────────────────────────────────── */

/**
 * Species behind each wildlife SKU, with its IUCN Red List status. No jokes
 * here on purpose — see the file header.
 */
const FIELD = Object.freeze({
  kaayko_gaur_magnet:        { species: "Indian gaur", latin: "Bos gaurus", status: "Vulnerable", range: "Forests of the Western Ghats and central India" },
  kaayko_gir_magnet:         { species: "Asiatic lion", latin: "Panthera leo persica", status: "Endangered", range: "Gir, Gujarat — the last wild population on earth" },
  kaayko_barahsingha_tote:   { species: "Barasingha", latin: "Rucervus duvaucelii", status: "Vulnerable", range: "Kanha and Dudhwa grasslands" },
  kaayko_blackbuck_tote:     { species: "Blackbuck", latin: "Antilope cervicapra", status: "Least Concern", range: "Open grassland and scrub across India" },
  kaayko_blackbuck2_tote:    { species: "Blackbuck", latin: "Antilope cervicapra", status: "Least Concern", range: "Open grassland and scrub across India" },
  kaayko_croc_tote:          { species: "Mugger crocodile", latin: "Crocodylus palustris", status: "Vulnerable", range: "Rivers, lakes and marshes of the subcontinent" },
  kaayko_fishingcat_tote:    { species: "Fishing cat", latin: "Prionailurus viverrinus", status: "Vulnerable", range: "Sundarbans and the wetlands of eastern India" },
  kaayko_florican_tote:      { species: "Bengal florican", latin: "Houbaropsis bengalensis", status: "Critically Endangered", range: "A few hundred birds left in the Terai grasslands" },
  kaayko_pitta_tote:         { species: "Indian pitta", latin: "Pitta brachyura", status: "Least Concern", range: "Deciduous forest, heard far more often than seen" },
  kaayko_langur_tote:        { species: "Hanuman langur", latin: "Semnopithecus entellus", status: "Least Concern", range: "From city rooftops to Himalayan treeline" },
  kaayko_peacock_tote:       { species: "Indian peafowl", latin: "Pavo cristatus", status: "Least Concern", range: "The whole subcontinent, unmissably" },
  kaayko_racoon_tote:        { species: "Common raccoon", latin: "Procyon lotor", status: "Least Concern", range: "North America, and increasingly wherever it likes" },
  "kaayko_snow-leopard_tote": { species: "Snow leopard", latin: "Panthera uncia", status: "Vulnerable", range: "Himalaya and Central Asian highlands, 3,000–5,000m" }
});

/** Statuses that deserve visual weight on the page. */
const AT_RISK = new Set(["Vulnerable", "Endangered", "Critically Endangered"]);

/* ── Fallbacks ────────────────────────────────────────────── */

const THEME_STORY = Object.freeze({
  Wildlife: "Drawn by hand, printed small, and sold to people who would rather look at an animal than own one.",
  Heritage: "A person who did something permanent, reduced to one image on a shirt. They would probably have allowed it.",
  Rebel: "Says the quiet part on the front, at chest height, in a size everybody can read from across the room.",
  Philosophy: "A complete worldview, abbreviated until it fits on a garment. Most of them started shorter than you think.",
  Originals: "Ours. Drawn here, printed here, explained to nobody.",
  Nostalgia: "Aimed squarely at a specific year you remember better than last week."
});

/**
 * The editorial content for a product.
 *
 * @param {object} product catalogue product
 * @returns {{voice: 'satire'|'field', hook: string, story: string,
 *            rows: Array<[string, string]>, atRisk: boolean}}
 */
/**
 * Editorial copy stored on the product document, written by the Kortex
 * Products view. Returns null when the product carries none, so the built-in
 * maps below remain the fallback.
 *
 * @param {object} product
 * @returns {{voice: string, hook: string, story: string,
 *            rows: Array<[string, string]>, atRisk: boolean}|null}
 */
function editorialFrom(product) {
  const story = typeof product?.storyCopy === "string" ? product.storyCopy.trim() : "";
  const rawRows = Array.isArray(product?.fileRows) ? product.fileRows : [];
  const rows = rawRows
    .filter((r) => r && typeof r.label === "string" && typeof r.value === "string" && r.label.trim() && r.value.trim())
    .map((r) => [r.label.trim(), r.value.trim()]);

  if (!story && !rows.length) return null;

  const field = FIELD[product?.id];
  return {
    voice: field ? "field" : "satire",
    hook: String(product?.description || "").trim(),
    story: story || (field ? `${field.species} — ${field.range}.` : ""),
    rows: rows.length ? rows : (field ? [["Species", field.species], ["IUCN status", field.status]] : []),
    atRisk: !!field && AT_RISK.has(field.status)
  };
}

export function satireFor(product) {
  const hook = String(product?.description || "").trim();

  // Copy edited in Kortex wins over anything shipped in this file. The maps
  // below stay as the default for every product nobody has edited yet, so
  // there is no migration and no blank panel.
  const edited = editorialFrom(product);
  if (edited) return edited;

  const field = FIELD[product?.id];

  if (field) {
    return {
      voice: "field",
      hook,
      story: `${field.species} — ${field.range}. Illustrated by hand for this print run; no photograph, no stock art.`,
      rows: [["Species", field.species], ["Latin", field.latin], ["IUCN status", field.status], ["Range", field.range]],
      atRisk: AT_RISK.has(field.status)
    };
  }

  const entry = SATIRE[product?.id];
  if (entry) {
    return { voice: "satire", hook, story: entry.story, rows: entry.file, atRisk: false };
  }

  // Unknown SKU: still gets a voice, never an empty panel.
  const theme = String(product?.theme || "").trim();
  return {
    voice: "satire",
    hook,
    story: THEME_STORY[theme] || "Printed in a small run because a large one would have required a meeting.",
    rows: [
      ["Alias", product?.title || "Unfiled"],
      ["Known for", theme || "Refusing to be categorised"],
      ["Threat level", "Undetermined"]
    ],
    atRisk: false
  };
}

/** Product ids that carry hand-written copy — used by the About page. */
export function curatedIds() {
  return [...Object.keys(SATIRE), ...Object.keys(FIELD)];
}

export { FIELD, AT_RISK };
