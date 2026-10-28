/**
 * store-satire.js — the storefront's editorial voice, as data.
 *
 * Two voices, deliberately:
 *
 *   'satire'  the t-shirts. Deadpan, mock-official, told straight. The
 *             catalogue already talks this way ("Supreme / Shit"), so the PDP
 *             finishes the joke instead of apologising for it.
 *
 *   'field'   the wildlife pieces — totes, magnets, mugs. "What inspired this
 *             piece" (Rohan, 24 Oct 2026): the animal, the park the piece names,
 *             its IUCN status, and one line about it. The line is about the
 *             animal and never about its decline: a joke next to "Critically
 *             Endangered" would still be the wrong kind of funny.
 *
 * The t-shirts are keyed by Firestore document id (stable; titles are not; each
 * entry's `title` is for review only). The wildlife notes are keyed by ANIMAL, so a
 * tote, a magnet and a mug of one design read the same: animalFor() maps a product
 * id onto one. A product with neither falls back to a theme-shaped default, so a new
 * product is never blank on the page.
 *
 * IUCN statuses are from the Red List and should be re-checked yearly. Checked
 * 24 Oct 2026: the Asiatic lion was moved to Vulnerable in 2024 (this file said
 * Endangered); the Masai giraffe's last published assessment is Endangered (2019),
 * and IUCN has published none since its 2025 recognition as a species.
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
 * One entry per animal: the species, its IUCN Red List status, the park its piece
 * names (the word printed on the magnet or mug), and a line about it.
 */
const FIELD = Object.freeze({
  "barasingha":            { species: "Barasingha", latin: "Rucervus duvaucelii", status: "Vulnerable", park: "Kanha National Park, Madhya Pradesh", line: "Its name means twelve tines. Most stags take that as a target." },
  "blackbuck":             { species: "Blackbuck", latin: "Antilope cervicapra", status: "Least Concern", park: "Velavadar Blackbuck National Park, Gujarat", line: "Only the males go black, and their horns keep spiralling as they age." },
  "crocodile":             { species: "Mugger crocodile", latin: "Crocodylus palustris", status: "Vulnerable", park: "Ranganathittu Bird Sanctuary, Karnataka", line: "Has been seen balancing sticks on its snout in nesting season — bait, it seems, for birds out shopping for nest material." },
  "fishingcat":            { species: "Fishing cat", latin: "Prionailurus viverrinus", status: "Vulnerable", park: "Sundarbans National Park, West Bengal", line: "A cat that dives in after its dinner, which most cats would call a breach of contract." },
  "florican":              { species: "Bengal florican", latin: "Houbaropsis bengalensis", status: "Critically Endangered", park: "Manas National Park, Assam", line: "The male leaps straight up out of the tall grass to be noticed. Every leap counts." },
  "gaur":                  { species: "Indian gaur", latin: "Bos gaurus", status: "Vulnerable", park: "Pench Tiger Reserve, Madhya Pradesh", line: "The largest wild cattle on earth; a bull can pass a tonne without trying." },
  "asiatic-lion":          { species: "Asiatic lion", latin: "Panthera leo leo", status: "Vulnerable", park: "Gir National Park, Gujarat", line: "Down to a few dozen a century ago. Gujarat now counts close to nine hundred." },
  "langur":                { species: "Hanuman langur", latin: "Semnopithecus entellus", status: "Least Concern", park: "Ranthambore National Park, Rajasthan", line: "Treated as sacred, which it reads as permission to raid the fruit stall." },
  "peacock":               { species: "Indian peafowl", latin: "Pavo cristatus", status: "Least Concern", park: "Keoladeo National Park, Rajasthan", line: "India's national bird, and fully aware of it." },
  "pitta":                 { species: "Indian pitta", latin: "Pitta brachyura", status: "Least Concern", park: "Tadoba-Andhari Tiger Reserve, Maharashtra", line: "Called navrang, nine colours, and it wears every one of them." },
  "raccoon":               { species: "Common raccoon", latin: "Procyon lotor", status: "Least Concern", park: "", line: "Washes its food, or at least puts on a convincing performance of it." },
  "snow-leopard":          { species: "Snow leopard", latin: "Panthera uncia", status: "Vulnerable", park: "Hemis National Park, Ladakh", line: "Sleeps with its tail wrapped round its face: a scarf it never has to look for." },
  "cheetah":               { species: "Cheetah", latin: "Acinonyx jubatus", status: "Vulnerable", park: "Kgalagadi Transfrontier Park, Botswana and South Africa", line: "Nought to sixty in about three seconds, then a long sit-down in the shade." },
  "kuno-cheetah":          { species: "Cheetah", latin: "Acinonyx jubatus", status: "Vulnerable", park: "Kuno National Park, Madhya Pradesh", line: "Declared extinct in India in 1952, back at Kuno since 2022. Seventy years is a long wait for the fastest animal on land." },
  "secretary-bird":        { species: "Secretary bird", latin: "Sagittarius serpentarius", status: "Endangered", park: "Tsavo National Park, Kenya", line: "A bird of prey that hunts on foot, and settles matters with snakes by stamping on them." },
  "plains-zebra":          { species: "Plains zebra", latin: "Equus quagga", status: "Near Threatened", park: "Etosha National Park, Namibia", line: "No two stripe patterns alike, and the stripes may keep the biting flies off too." },
  "hippo":                 { species: "Hippopotamus", latin: "Hippopotamus amphibius", status: "Vulnerable", park: "Chobe National Park, Botswana", line: "Doesn't really swim: it walks, or bounces, along the riverbed." },
  "african-elephant":      { species: "African savanna elephant", latin: "Loxodonta africana", status: "Endangered", park: "Amboseli National Park, Kenya", line: "Amboseli's elephants have been followed by researchers since 1972. They have earned some privacy." },
  "giraffe":               { species: "Masai giraffe", latin: "Giraffa tippelskirchi", status: "Endangered (2019 assessment)", park: "Tarangire National Park, Tanzania", line: "Sleeps in bouts of a few minutes, often standing. With that neck, lying down is a project." },
  "grey-crowned-crane":    { species: "Grey crowned crane", latin: "Balearica regulorum", status: "Endangered", park: "Akagera National Park, Rwanda", line: "One of only two cranes that roost in trees, and it dances for no obvious reason." },
  "lion":                  { species: "Lion", latin: "Panthera leo", status: "Vulnerable", park: "Serengeti National Park, Tanzania", line: "Rests up to twenty hours a day and still runs the place." },
  "african-fish-eagle":    { species: "African fish eagle", latin: "Haliaeetus vocifer", status: "Least Concern", park: "Murchison Falls National Park, Uganda", line: "Its call is so much a part of the river that it is known as the voice of Africa." },
  "white-rhino":           { species: "White rhinoceros", latin: "Ceratotherium simum", status: "Near Threatened", park: "Kruger National Park, South Africa", line: "'White' is said to be a mishearing of 'wide', for its mouth. It is grey." },
  "red-panda":             { species: "Red panda", latin: "Ailurus fulgens", status: "Endangered", park: "Namdapha National Park, Arunachal Pradesh", line: "It had the name 'panda' first. The black-and-white one borrowed it." },
  "chinkara":              { species: "Chinkara", latin: "Gazella bennettii", status: "Least Concern", park: "Gir National Park, Gujarat", line: "Can go long stretches without drinking, taking its water from plants and dew." },
  "sarus-crane":           { species: "Sarus crane", latin: "Antigone antigone", status: "Vulnerable", park: "Keoladeo National Park, Rajasthan", line: "The tallest flying bird in the world, and famous for pairing for life." },
  "sloth-bear":            { species: "Sloth bear", latin: "Melursus ursinus", status: "Vulnerable", park: "Bandhavgarh National Park, Madhya Pradesh", line: "Not a sloth, and not slow: it vacuums up termites through a gap where two front teeth should be." },
  "indian-pangolin":       { species: "Indian pangolin", latin: "Manis crassicaudata", status: "Endangered", park: "Tadoba-Andhari Tiger Reserve, Maharashtra", line: "The only mammal in a coat of scales, and when in doubt it simply rolls up." },
  "indian-giant-squirrel": { species: "Indian giant squirrel", latin: "Ratufa indica", status: "Least Concern", park: "Anamalai Tiger Reserve, Tamil Nadu", line: "About a metre from nose to tail, much of it tail, and it rarely bothers coming down." },
  "indian-skimmer":        { species: "Indian skimmer", latin: "Rynchops albicollis", status: "Endangered", park: "Marine National Park, Gulf of Kutch, Gujarat", line: "Flies low with its longer lower bill slicing the water, and snaps shut on whatever it meets." },
  "golden-langur":         { species: "Golden langur", latin: "Trachypithecus geei", status: "Endangered", park: "Manas National Park, Assam", line: "Cream in summer, gold in winter, and found almost nowhere but western Assam and Bhutan." },
  // 25 Oct 2026. The masked finfoot was moved to Critically Endangered in 2022 (BirdLife: 108-304 mature birds).
  "canyon-wren":           { species: "Canyon wren", latin: "Catherpes mexicanus", status: "Least Concern", park: "Zion National Park, Utah", line: "Sings a cascade of notes that tumbles down the canyon walls, then creeps up the rock after it." },
  "himalayan-marmot":      { species: "Himalayan marmot", latin: "Marmota himalayana", status: "Least Concern", park: "Hemis National Park, Ladakh", line: "Sleeps through most of the Himalayan winter in a family burrow — one way to handle four thousand metres." },
  "masked-finfoot":        { species: "Masked finfoot", latin: "Heliopais personatus", status: "Critically Endangered", park: "Sundarbans National Park, West Bengal", line: "Swims low like a cormorant, walks like a rail, and is among the hardest birds in Asia to see." },
  "small-clawed-otter":    { species: "Asian small-clawed otter", latin: "Aonyx cinereus", status: "Vulnerable", park: "Sundarbans National Park, West Bengal", line: "The smallest otter in the world, finding its food by touch with nimble, nearly clawless fingers." },
  "bobcat":                { species: "Bobcat", latin: "Lynx rufus", status: "Least Concern", park: "Big Bend National Park, Texas", line: "Named for its short, bobbed tail, and about twice the size of a house cat." }
});

/** Product-id slugs that are not the animal's own key (older ids, spellings, second designs). */
const ANIMAL_ALIAS = Object.freeze({
  barahsingha: "barasingha", croc: "crocodile", racoon: "raccoon", gir: "asiatic-lion", blackbuck2: "blackbuck"
});

/** The animal behind a product, from its id: kaayko_<slug>_<tote|magnet|mug>. */
export function animalFor(product) {
  const m = /^kaayko_(.+)_(tote|magnet|mug)$/.exec(String(product?.id || ""));
  if (!m) return null;
  const key = ANIMAL_ALIAS[m[1]] || m[1];
  return FIELD[key] ? key : null;
}

/** Statuses that deserve visual weight on the page. */
const AT_RISK = new Set(["Vulnerable", "Endangered", "Critically Endangered"]);
const atRisk = (status) => AT_RISK.has(String(status).replace(/\s*\(.*\)$/, ""));

/** The rows every wildlife piece shows: the animal, the park, the status (Rohan, 24 Oct 2026). */
function fieldRows(field, product) {
  const park = String(product?.nationalPark || "").trim() || field.park;
  // the row says what the place is: a reserve or a sanctuary is not a national park,
  // and the raccoon tote's "North America" is a range
  const label = /national park|transfrontier park/i.test(park) ? "National park"
    : /reserve|sanctuary/i.test(park) ? "Protected area" : "Range";
  return [
    ["Animal", field.species],
    ["Latin name", field.latin],
    ...(park ? [[label, park]] : []),
    ["IUCN status", field.status]
  ];
}

/* ── What inspired the stamp pieces ───────────────────────────
   The bottles and the stamp t-shirts carry copy written in Kortex, and it was the same
   paragraph sixteen times ("a real stamp, reproduced from a high-resolution scan…"),
   with nothing about what the stamp is FOR (Rohan, 25 Oct 2026). Each gets the story
   of its stamp first, and the wildlife ones their animal and IUCN status; the Kortex
   copy follows unchanged. Keyed by Firestore document id. Every fact here was checked
   25 Oct 2026 (issue dates against stamp catalogues and Wikipedia's lists of Indian
   stamps); what could not be checked (the Chandragupta stamp's year) is not claimed. */
const INSPIRED = Object.freeze({
  "2GlQkjNqJH1NyOIUmQ0J": { title: "India Postage Bottle", line: "Issued in 1954 for a hundred years of Indian postage stamps. Its plane and its pigeon are the two speeds the post has always run at." },
  "5tAMxZe9eHJmwIjp9nJL": { title: "K2 Bottle", line: "K2 is the second-highest mountain on earth, the one climbers call the Savage Mountain. It sat for India Post's 1988 Himalayan Peaks set without complaint." },
  "BeL1gqbF5Y6kWWJWeHFc": { title: "First Aerial Post Bottle", line: "Fifty years after the world's first official airmail flew from Allahabad to Naini on 18 February 1911 — a route of about six miles, which is still the hardest part of any delivery." },
  "L0ZawQe4EOrDrk3EvG16": { title: "River Dolphin Bottle", line: "The Ganges river dolphin is nearly blind and finds its way through the silt by sound. It is India's national aquatic animal.", animal: { species: "Ganges river dolphin", latin: "Platanista gangetica", status: "Endangered" } },
  "QKF9TpsYM6bCl8De4M9n": { title: "Blue Magpie Bottle", line: "From India Post's 1968 set of four Indian birds. The red-billed blue magpie trails a tail longer than the rest of it.", animal: { species: "Red-billed blue magpie", latin: "Urocissa erythroryncha", status: "Least Concern" } },
  "RWVJFJK0Q6tGeLawtRuY": { title: "Conquest of Everest Bottle", line: "The date on the stamp, 29.5.53, is the morning Tenzing Norgay and Edmund Hillary stood on top of Everest." },
  "Z1vamuFaTPvjkWHFJhle": { title: "Bengal Tiger Bottle", line: "A tiger walking out of the grass on a 50 naye paise stamp, from the years when India's tigers were still being counted down, not up.", animal: { species: "Bengal tiger", latin: "Panthera tigris tigris", status: "Endangered" } },
  "kGg8Q8df5bbcN8tLFx6Z": { title: "Tiger Conservation Bottle", line: "Issued in 1969, when the International Union for Conservation of Nature met in New Delhi. Four years later India launched Project Tiger.", animal: { species: "Bengal tiger", latin: "Panthera tigris tigris", status: "Endangered" } },
  "mydE423HVE2f3rrpxcM6": { title: "Indian Railways Bottle", line: "A hundred years of Indian railways: the first passenger train ran from Bombay to Thane on 16 April 1853. The stamp parks the old engine beside the new." },
  "yzCMEUlvYkoAdDInOgEE": { title: "Woodpecker Bottle", line: "The 50 paise bird in India Post's 1968 set: the brown-fronted woodpecker of the western Himalaya, captioned simply \"Woodpecker\".", animal: { species: "Brown-fronted woodpecker", latin: "Dendrocoptes auriceps", status: "Least Concern" } },
  "8PnFf6bH3fwiH1dTCkFR": { title: "Sandrokoptos", line: "Sandrokottos is what the Greeks called Chandragupta Maurya, who built India's first great empire around 321 BCE — and, the story goes, gave it all up to become a Jain monk.", rows: [["Stamp", "Chandragupta Maurya, ₹4"]] },
  "ILCeSIYh1FI7K13Ur8ez": { title: "Queen", line: "Ahilyabai Holkar ruled Malwa from Maheshwar for nearly thirty years and rebuilt temples across India, Kashi Vishwanath among them. This stamp marked 200 years since her death, in 1996.", rows: [["Stamp", "Ahilyabai Holkar, ₹2"], ["Issued", "25 August 1996"]] },
  "MHLoIviEod8xPRHoEwj4": { title: "Pt. Beethoven", line: "India Post marked Beethoven's 200th birthday on 16 December 1970 with this stamp. The \"Pandit\" is our addition; we think he earned it.", rows: [["Stamp", "Beethoven, 20 paise"], ["Issued", "16 December 1970"]] },
  "qCI4Eiyxdt6SI9VT45qX": { title: "Abe", line: "India issued this stamp on 15 April 1965, a hundred years to the day after Lincoln died. Abe, to his friends.", rows: [["Stamp", "Abraham Lincoln, 15 paise"], ["Issued", "15 April 1965"]] },
  "u1y09H1U1ozUasNKwOrU": { title: "Freedom", line: "India's 1976 airmail for the American Revolution Bicentennial carries Archibald Willard's painting The Spirit of '76: two drummers and a fifer, still marching.", rows: [["Stamp", "American Revolution Bicentennial airmail, ₹2.80"], ["Issued", "29 May 1976"]] },
  "xyVsWqTkPcVbaiOCX0vv": { title: "The Great Climb", line: "In May 1965 nine climbers of the Indian Everest Expedition reached the summit, a record that stood for years. This stamp followed on Independence Day.", rows: [["Stamp", "Indian Mt Everest Expedition, 15 paise"], ["Issued", "15 August 1965"]] }
});

/* ── Fallbacks ────────────────────────────────────────────── */

const THEME_STORY = Object.freeze({
  Wildlife: "Printed small, and sold to people who would rather look at an animal than own one.",
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

  const field = FIELD[animalFor(product)];
  const inspired = INSPIRED[product?.id];
  const base = rows.length ? rows : (field ? fieldRows(field, product) : []);
  // a stamp's animal goes first, unless the Kortex rows already name it
  const animalRows = inspired?.animal && !base.some(([k]) => /^(animal|species)$/i.test(k))
    ? [["Animal", inspired.animal.species], ["Latin name", inspired.animal.latin], ["IUCN status", inspired.animal.status]]
    : [];
  // the stamp's own rows lead; Kortex's "Artwork: Original postage stamp" says less than they do
  const stampRows = inspired?.rows || [];
  const kept = stampRows.length ? base.filter(([k, v]) => !(k === "Artwork" && /^original postage stamp$/i.test(v))) : base;
  return {
    voice: field ? "field" : "satire",
    hook: String(product?.description || "").trim(),
    story: [inspired?.line, story || (field ? field.line : "")].filter(Boolean).join(" "),
    rows: [...stampRows, ...animalRows, ...kept],
    atRisk: (!!field && atRisk(field.status)) || (!!inspired?.animal && atRisk(inspired.animal.status))
  };
}

export function satireFor(product) {
  const hook = String(product?.description || "").trim();

  // A piece from an independent maker speaks in the maker's words, never the
  // house's satire ("Threat level: Undetermined" on someone's linocut).
  if (product?.byMaker) {
    const maker = String(product.storeName || "").trim() || "an independent maker";
    const options = Array.isArray(product.availableSizes) ? product.availableSizes.filter(Boolean) : [];
    // A lesson is taught, not made; its sessions are listed above with the time.
    const lesson = String(product.productType || "").toLowerCase() === "lesson";
    return {
      voice: "maker",
      hook,
      story: String(product.storyCopy || "").trim() || (lesson ? `Taught by ${maker}, an independent teacher on Kaayko.` : `Made by ${maker}, an independent maker selling on Kaayko.`),
      rows: lesson ? [["Taught by", maker]] : [["Made by", maker], ...(options.length ? [["Options", options.join(", ")]] : [])],
      atRisk: false
    };
  }

  // Copy edited in Kortex wins over anything shipped in this file. The maps
  // below stay as the default for every product nobody has edited yet, so
  // there is no migration and no blank panel.
  const edited = editorialFrom(product);
  if (edited) return edited;

  const field = FIELD[animalFor(product)];

  if (field) {
    return { voice: "field", hook, story: field.line, rows: fieldRows(field, product), atRisk: atRisk(field.status) };
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

/** T-shirt ids with hand-written copy; wildlife copy is keyed by animal (animalFor). */
export function curatedIds() {
  return Object.keys(SATIRE);
}

export { FIELD, AT_RISK };
