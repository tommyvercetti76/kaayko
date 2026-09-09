/**
 * arcade/board.js — the temporary board for Kaayko Shipping.
 *
 * Temporary means what it says: the board is stamped with the local date and
 * anything from another day is dropped on read. Nobody's name is sent anywhere;
 * this lives in the browser that typed it.
 *
 * ── Rules of the board ─────────────────────────────────────────────────────
 *   A  only a finished run can post — you cannot enter a score by hand
 *   B  a score of zero is not a score
 *   C  one entry per name per day; a better run replaces the earlier one
 *   D  eight places, ranked by deliveries, earliest run wins a tie
 *   E  the board resets when the date changes, and can be cleared by hand
 *
 * ── Gates on the name ──────────────────────────────────────────────────────
 * Thirteen of them, in order, and the first that fails is the one reported. They
 * exist because an unfiltered name field is an invitation, and because a board
 * full of "aaaaaa" and "xxxxx" is not a board.
 */

const KEY = "kaayko.shipping.board";
const PLACES = 8;
const MAXLEN = 14;

/** Local date, not UTC — the board should turn over at the player's midnight. */
export function today(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Leet is normalised before any of the word gates run, so "5h1t" is checked as
   "shit". The list is short on purpose: it catches the obvious, and the shape
   gates below catch the rest of the noise. */
const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };
const flatten = (s) => s.toLowerCase().replace(/[013457@$!]/g, (c) => LEET[c] || "");

const FOUL = ["fuck", "shit", "cunt", "bitch", "dick", "cock", "pussy", "whore",
  "slut", "nigg", "fag", "rape", "nazi", "hitler", "penis", "vagina", "wank", "twat",
  "bastard", "asshole", "arsehole", "bollock", "retard", "kys"];
const RESERVED = ["kaayko", "admin", "moderator", "owner", "official", "staff",
  "root", "system", "null", "undefined"];

/* Leet substitution alone is not enough: "f4ck" normalises to "fack", which is
   in no list. So each word is matched with its vowels opened up to any vowel —
   f[aeiouy]+ck — which catches the whole family without collapsing consonant
   skeletons, the trick that turns "Ashton" into a false positive for "shit". */
const FOUL_RE = FOUL.map((w) => new RegExp(w.replace(/[aeiou]/g, "[aeiouy]+")));

const VOWEL = /[aeiouy]/;

/**
 * @returns {{ok:true, name:string} | {ok:false, gate:number, code:string, why:string}}
 */
export function checkName(raw) {
  const fail = (gate, code, why) => ({ ok: false, gate, code, why });
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  const flat = flatten(name);

  if (!name) return fail(1, "EMPTY", "A name, please.");
  if (name.length < 2) return fail(2, "SHORT", "Two letters at least.");
  if (name.length > MAXLEN) return fail(3, "LONG", `Fourteen characters, no more. That is ${name.length}.`);
  if (!/^[\p{L}\p{N} '._-]+$/u.test(name))
    return fail(4, "CHARSET", "Letters, numbers, and the odd hyphen. Nothing else.");
  if (name.split(" ").length > 3) return fail(5, "WORDY", "Three words is plenty.");
  if (/(.)\1{3,}/.test(name)) return fail(6, "MASHED", "That is a key held down, not a name.");
  if (!/\p{L}/u.test(name)) return fail(7, "NOLETTER", "At least one actual letter.");
  if ((name.match(/\p{N}/gu) || []).length > name.length / 2)
    return fail(8, "DIGITS", "Fewer numbers.");
  if (name.length > 3 && !VOWEL.test(flat)) return fail(9, "NOVOWEL", "No vowels, no entry.");
  if (/[^aeiouy\p{N} '._-]{5,}/u.test(flat)) return fail(10, "UNSAYABLE", "Try one somebody could say aloud.");
  if (FOUL_RE.some((re) => re.test(flat))) return fail(11, "FOUL", "Not on the board, it will not be.");
  if (RESERVED.some((w) => flat.replace(/[^a-z]/g, "") === w))
    return fail(12, "TAKEN", "That name is spoken for.");
  if (/https?:|www\.|\.(com|net|org|io|co|xyz)\b/i.test(name))
    return fail(13, "LINK", "This is a board, not a billboard.");

  return { ok: true, name };
}

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || raw.day !== today()) return { day: today(), rows: [] };   // rule E
    return { day: raw.day, rows: Array.isArray(raw.rows) ? raw.rows : [] };
  } catch (_) { return { day: today(), rows: [] }; }
}

function write(board) {
  try { localStorage.setItem(KEY, JSON.stringify(board)); } catch (_) {}
}

export const rows = () => read().rows;

/**
 * Rules A–D. `token` is handed out by a finished run and consumed here, so a
 * score can only be posted by the run that actually earned it.
 * @returns {{ok:true, rows:Array, place:number} | {ok:false, code:string, why:string, gate?:number}}
 */
export function post({ name, score, token }, live) {
  if (!token || token !== live) return { ok: false, code: "NORUN", why: "Finish a run first." };
  if (!Number.isInteger(score) || score < 1)
    return { ok: false, code: "ZERO", why: "Deliver something, then sign it." };

  const checked = checkName(name);
  if (!checked.ok) return { ok: false, code: checked.code, why: checked.why, gate: checked.gate };

  const board = read();
  const key = checked.name.toLowerCase();
  const at = board.rows.findIndex((r) => r.name.toLowerCase() === key);
  if (at >= 0) {
    if (board.rows[at].score >= score)
      return { ok: false, code: "BEATEN", why: `${checked.name} already has ${board.rows[at].score} today.` };
    board.rows[at] = { name: checked.name, score, at: Date.now() };        // rule C
  } else {
    board.rows.push({ name: checked.name, score, at: Date.now() });
  }
  board.rows.sort((a, b) => b.score - a.score || a.at - b.at);             // rule D
  board.rows = board.rows.slice(0, PLACES);
  write(board);

  const place = board.rows.findIndex((r) => r.name.toLowerCase() === key);
  return { ok: true, rows: board.rows, place: place < 0 ? -1 : place + 1 };
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch (_) {}
  return [];
}
