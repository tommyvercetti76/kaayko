#!/usr/bin/env node
/**
 * check-shipping.js — the gates on Kaayko Shipping, checked.
 *
 * Three things this asserts, because all three were got wrong by hand at least
 * once while building the game:
 *
 *   1  CONTRAST. Every colour a player has to see, against the colour behind it,
 *      in all four sky phases. Night towers were invisible against the night sky
 *      and a white plane vanished into a daylight sky; both were found here.
 *   2  PLAYABILITY. A released parcel must be able to reach a pad that is still
 *      on screen when you let go — otherwise the game asks for a blind throw.
 *   3  THE BOARD. Every name gate, and every rule about who may post.
 *
 * Run: node scripts/check-shipping.js
 */
import { PHASES, phaseFor, stageAt } from "../src/js/arcade/shipping.js";

/* localStorage shim — board.js is browser code and expects one to exist. */
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k)
};
const { checkName, post, rows, clear } = await import("../src/js/arcade/board.js");

let fails = 0;
const ok = (cond, what) => {
  if (!cond) { fails++; console.log(`  FAIL  ${what}`); }
  else console.log(`  ok    ${what}`);
};

/* ── 1. contrast ─────────────────────────────────────────────────────────── */
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const L = (h) => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => {
  const x = L(a), y = L(b), hi = Math.max(x, y), lo = Math.min(x, y);
  return (hi + 0.05) / (lo + 0.05);
};

// The floor on the gap marker against open sky is low on purpose: no single
// colour clears both a dark tower and a pale sky, so the marker is drawn with a
// dark rim in shipping.js and reads by outline where luminance alone would not.
const PAIRS = (p) => [
  ["tower vs sky-low", p.tower, p.sky[2], 1.8],
  ["tower vs sky-mid", p.tower, p.sky[1], 1.8],
  ["gap marker vs tower", p.edge, p.tower, 4.5],
  ["gap marker vs sky-mid", p.edge, p.sky[1], 1.25],
  ["parcel vs sky-mid", p.parcel, p.sky[1], 2.0],
  ["parcel vs sky-top", p.parcel, p.sky[0], 2.0],
  ["parcel seam vs parcel", p.parcelEdge, p.parcel, 3.0],
  ["live pad vs ground", p.padLit, p.near, 3.0],
  ["used pad vs ground", p.pad, p.near, 2.0],
  ["plane vs sky-mid", p.plane, p.sky[1], 2.5],
  ["plane vs sky-low", p.plane, p.sky[2], 2.0],
  ["near band vs far band", p.near, p.far, 1.25],
  ["far band vs ridge", p.far, p.hill, 1.12],
  ["cloud vs sky-top", p.cloud, p.sky[0], 1.2]
];

console.log("\nCONTRAST");
for (const [, p] of Object.entries(PHASES)) {
  let worst = Infinity, worstWhat = "";
  for (const [what, a, b, floor] of PAIRS(p)) {
    const r = ratio(a, b);
    if (r < floor) { fails++; console.log(`  FAIL  ${p.label}: ${what} ${r.toFixed(2)} < ${floor}`); }
    if (r / floor < worst) { worst = r / floor; worstWhat = `${what} ${r.toFixed(2)}`; }
  }
  console.log(`  ok    ${p.label.padEnd(6)} 14 pairs clear; tightest is ${worstWhat}`);
}

/* ── 2. the clock and the ramp ───────────────────────────────────────────── */
console.log("\nCLOCK AND RAMP");
const seen = new Set();
for (let h = 0; h < 24; h++) {
  const k = phaseFor(new Date(2026, 0, 1, h, 30));
  if (!PHASES[k]) { fails++; console.log(`  FAIL  hour ${h} names no palette`); }
  seen.add(k);
}
ok(seen.size === 4, `all four skies are reachable in a day (${[...seen].join(", ")})`);

let lastSpeed = 0, lastGap = 1;
for (let s = 0; s <= 60; s++) {
  const st = stageAt(s);
  if (st.speed < lastSpeed || st.gap > lastGap) { fails++; console.log(`  FAIL  ramp reverses at ${s}`); }
  lastSpeed = st.speed; lastGap = st.gap;
}
ok(true, "speed never falls and the gap never widens as the score climbs");
const top = stageAt(1000);
ok(top.speed <= 0.62 && top.gap >= 0.24, `the ramp stops: ${top.speed.toFixed(2)} speed, ${top.gap.toFixed(3)} gap`);

/* ── 3. can a dropped parcel actually be aimed? ──────────────────────────── */
console.log("\nPLAYABILITY");
const GROUND = 0.895, FALL = 2.1, DRAG = 0.85, TAU = 1 / DRAG;
const PLANE_X = 0.22, PLANE_R = 0.034, VMAX = 0.64;
const fallTime = (y, v) => (-v + Math.sqrt(v * v + 2 * FALL * (GROUND - y))) / FALL;
// Horizontal travel under drag: the parcel leaves at the plane's speed and the
// air takes it back exponentially.  x(t) = v0·τ·(1 − e^(−t/τ))
const travel = (speed, t) => speed * TAU * (1 - Math.exp(-t / TAU));
const shot = (y, v, speed) => {
  const t = fallTime(y, v * 0.6);
  return { t, lead: travel(speed, t), landsAt: PLANE_X + travel(speed, t) };
};

const slow = stageAt(0), fast = top;
const high = shot(PLANE_R, -VMAX * 0.6, fast.speed);
const mid = shot(0.5, 0, slow.speed);
ok(high.landsAt < 0.97, `the hardest throw lands at screen x=${high.landsAt.toFixed(2)} — the pad is still in view when you let go`);
ok(mid.lead > 0.08, `an ordinary throw leads the pad by ${mid.lead.toFixed(2)} screens, so leading it IS the game`);
ok(FALL > VMAX * 2, "a released parcel outruns the plane, so it can never be caught back");

// How wrong may the press be and still land? Pad half-width divided by how fast
// the aim point sweeps past it. Under about a tenth of a second is not a window
// a hand can hit.
const slack = (st) => (st.narrowPad ? 0.075 : 0.105) / 2 / st.speed;
ok(slack(slow) > 0.15, `at the start you have ${(slack(slow) * 1000) | 0}ms of slack on the press`);
ok(slack(fast) > 0.05, `at the hardest stage you still have ${(slack(fast) * 1000) | 0}ms`);
ok(slack(slow) > slack(fast), "and the window narrows as it should, never the reverse");

/* ── 4. the name gates ───────────────────────────────────────────────────── */
console.log("\nNAME GATES");
const CASES = [
  ["", "EMPTY"], [" ", "EMPTY"], ["R", "SHORT"],
  ["Bartholomew Ridge", "LONG"], ["Ro<han", "CHARSET"],
  ["Jo Al Ki Ra", "WORDY"], ["aaaaaa", "MASHED"], ["Ro#han", "CHARSET"],
  ["12 34", "NOLETTER"], ["R12345", "DIGITS"], ["Brrr", "NOVOWEL"],
  ["Ashtrkln", "UNSAYABLE"],
  ["f4ck", "FOUL"], ["FUCK", "FOUL"], ["sh1t", "FOUL"],
  ["kaayko", "TAKEN"], ["Admin", "TAKEN"], ["buy.com", "LINK"]
];
for (const [input, expect] of CASES) {
  const r = checkName(input);
  ok(!r.ok && r.code === expect, `${JSON.stringify(input).padEnd(21)} -> ${expect}${r.ok ? " (PASSED, should not have)" : r.code === expect ? "" : ` (got ${r.code})`}`);
}
for (const good of ["Rohan", "Ro", "Meera K", "Jean-Luc", "O'Neill", "Ravi 7", "पवन"]) {
  const r = checkName(good);
  ok(r.ok, `${JSON.stringify(good).padEnd(21)} -> allowed${r.ok ? "" : ` (blocked by gate ${r.gate} ${r.code})`}`);
}

/* ── 5. the board rules ──────────────────────────────────────────────────── */
console.log("\nBOARD RULES");
clear();
const T = "token-1";
ok(!post({ name: "Rohan", score: 5, token: null }, T).ok, "A  no token, no entry");
ok(!post({ name: "Rohan", score: 5, token: "forged" }, T).ok, "A  a forged token is refused");
ok(!post({ name: "Rohan", score: 0, token: T }, T).ok, "B  a score of zero is not a score");
ok(post({ name: "Rohan", score: 5, token: T }, T).ok, "   a real run posts");
ok(!post({ name: "rohan", score: 3, token: T }, T).ok, "C  a worse run does not overwrite a better one");
ok(post({ name: "ROHAN", score: 9, token: T }, T).ok, "C  a better run does");
ok(rows().length === 1, "C  and the name still holds exactly one row");
for (let i = 0; i < 12; i++) post({ name: `Pilot ${i}`, score: i + 1, token: T }, T);
ok(rows().length === 8, "D  eight places, no more");
ok(rows()[0].score >= rows()[7].score, "D  ranked by deliveries");
mem.set("kaayko.shipping.board", JSON.stringify({ day: "2001-01-01", rows: rows() }));
ok(rows().length === 0, "E  yesterday's board is gone");

console.log(fails ? `\n${fails} FAILED\n` : "\nall clear\n");
process.exit(fails ? 1 : 0);
