/**
 * arcade/beg.js — The Beggar's Reach.
 *
 * It is a typing race. It was drawn as a gauge — an "arm" reaching a percentage
 * of the way into a man's pocket — and the numbers were honest but nobody could
 * tell what they were being asked to do, because reaching into a pocket is not
 * something you do by typing.
 *
 * So the progress is a letter. You write at the window; every key you actually
 * press carries the letter further across the street towards the postbox. Reach
 * the slot and you may post it. Run out of the minute first and the wind takes
 * it. The letter then burns or opens, which is the answer.
 *
 * The whole state of the run is three numbers, a letter in the air, and a line:
 *   seconds left, words a minute, words written
 *   how far across the street the letter has got
 *   one sentence saying what he is doing about it
 *
 * That last line is the performance. It is not on a timer and it is not tied to speed
 * alone — it reacts to what you actually wrote, the moment you write it. Giving a
 * reason, naming the thing you want, finishing a sentence, stopping dead, shouting,
 * running out of minute: each has its own line, and the ones that are reactions to
 * something you just did take precedence over the ambient ones. See `reactionFor`.
 *
 * The letter is still the anti-cheat: it advances per keystroke, not per character
 * present in the box, so pasting a model's plea moves it not one pixel. The run also
 * carries its inter-key intervals to the server, which throws out anything typed on a
 * metronome. Grading is in kaayko-api/functions/api/arcade/begScore.js.
 */

import { letterScene } from "./letterScene.js";

const WINDOW_MS = 60000;
const NEEDED_KEYS = 180;      // keystrokes to carry the letter the whole way (~36 wpm for a minute)
const WPM_WINDOW_MS = 6000;   // how far back "how fast am I typing" looks
const NOTICE_MS = 2600;       // how long a reaction to something you just did holds

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── what he is doing about it ────────────────────────────────────────────── */

/** Things you can do that he reacts to, in the order they are worth noticing. */
export const TELLS = [
  { key: "swore",    test: (t) => /\b(fuck|shit|bitch|bastard|cunt|damn|crap|arse|ass)\w*\b/i.test(t),
    line: "He will not open that one. You are swearing at a man with money." },
  { key: "shouting", test: (t) => t.length > 40 && (t.match(/[A-Z]/g) || []).length / t.replace(/[^a-z]/gi, "").length > 0.55,
    line: "All in capitals. He is across a street, not across a field." },
  { key: "named",    test: (t) => /\b(bottle|magnet|tote|shirt|stamp|postage|tiger|everest|railway|philately|kaayko)\b/i.test(t),
    line: "You named the thing. He reads the ones that do." },
  { key: "reason",   test: (t) => /\b(because|since|so that|which is why|therefore|given that)\b/i.test(t),
    line: "A reason. Most letters he gets have none." },
  { key: "number",   test: (t) => /\b\d{2,}\b/.test(t),
    line: "A number. He trusts numbers more than he trusts you." },
  { key: "stop",     test: (t) => /[.!?]/.test(t),
    line: "A full stop. He can follow a sentence." },
  { key: "forty",    test: (t) => (t.match(/\S+/g) || []).length >= 40,
    line: "Forty words, and the letter is heavy enough to carry them." }
];

/**
 * The ambient line — what he is doing when you have not just done anything.
 * @param {{reach:number, wpm:number, idleMs:number, left:number, words:number}} s
 */
export function ambient(s) {
  if (s.reach >= 1) return "It is at the slot. Post it, or keep writing and post it better.";
  if (s.idleMs > 4200) return "The letter is hanging in the wind. So are you.";
  if (s.idleMs > 2000) return "You have stopped, and so has it.";
  if (s.left < 8000 && s.reach < 0.6) return "It will not make the far kerb at this rate.";
  if (s.left < 15000 && s.reach < 0.85) return "The minute is going faster than the letter.";
  if (s.words === 0) return "Nothing written yet, so nothing has left your hand.";
  if (s.reach < 0.20) return "It is off the sill and over the gutter.";
  if (s.reach < 0.45) return s.wpm > 45 ? "Moving. The wind has got under it." : "Halfway to the middle of the road.";
  if (s.reach < 0.70) return "Over the white line. He can see it coming.";
  if (s.reach < 0.92) return "Nearly at the far kerb.";
  return "One more line and it is at the box.";
}

/**
 * The line under the scene. A reaction to something just done beats the ambient
 * state, which is what makes it feel like he is reading rather than counting.
 */
export function reactionFor(state, notice) {
  if (notice && Date.now() - notice.at < NOTICE_MS) return notice.line;
  return ambient(state);
}

/* ── the game ─────────────────────────────────────────────────────────────── */

/**
 * @param {HTMLElement} host
 * @param {{onWin?:(run:object, ui:object)=>void, rewardPercentMax?:number}} opts
 */
export function mountBeg(host, opts = {}) {
  const maxPct = opts.rewardPercentMax || 10;

  host.innerHTML = `
    <div class="beg">
      <div class="beg-scene">
        <canvas class="beg-canvas" data-scene
          aria-label="Your letter crossing the street to the postbox."></canvas>
        <div class="beg-hud" aria-hidden="true">
          <span><b data-clock>60.0</b> left</span>
          <span><b data-wpm>0</b> wpm</span>
          <span><b data-words>0</b> words</span>
          <span class="beg-hud-reach"><b data-reach>0%</b> across</span>
        </div>
        <div class="beg-open" data-open hidden></div>
      </div>
      <p class="beg-react" data-react>He is across the street, and he has not looked over.</p>
      <label class="beg-label" for="beg-input">Write your case. Every letter you type carries it further across.</label>
      <textarea id="beg-input" class="beg-input" rows="4" spellcheck="false"
        autocomplete="off" autocorrect="off" autocapitalize="off"
        placeholder="Sixty seconds. Say why, and say it in your own words."></textarea>
      <div class="beg-actions">
        <button type="button" class="beg-start">Start writing</button>
        <button type="button" class="beg-post" disabled>Post it</button>
        <p class="beg-note" role="status" aria-live="polite">Up to ${maxPct}% &mdash; the case you make, whether he has heard it before, whether it reads like a person, and how long you keep him standing. Most people get three or four.</p>
      </div>
    </div>`;

  const $ = (sel) => host.querySelector(sel);
  const input = $(".beg-input");
  const startBtn = $(".beg-start");
  const postBtn = $(".beg-post");
  const note = $(".beg-note");
  const clockEl = $("[data-clock]"), wpmEl = $("[data-wpm]"), wordsEl = $("[data-words]");
  const reachEl = $("[data-reach]"), reactEl = $("[data-react]");
  const openEl = $("[data-open]");
  const scene = letterScene($("[data-scene]"));
  const stage = $(".beg-scene");

  let raf = 0, running = false, startedAt = 0, finished = false;
  let keystrokes = 0, lastKey = 0, gaps = [], pasted = false, dropped = false, swipes = 0;
  let stamps = [];                     // keydown times, for the live rate
  let seen = new Set();                // tells already reacted to
  let notice = null;

  const reachNow = () => Math.min(1, keystrokes / NEEDED_KEYS);
  const wordCount = () => (input.value.trim().match(/\S+/g) || []).length;

  /** Words a minute over the last few seconds, the standard five-characters-a-word. */
  function wpmNow(now) {
    const since = now - WPM_WINDOW_MS;
    while (stamps.length && stamps[0] < since) stamps.shift();
    if (stamps.length < 2) return 0;
    const span = Math.max(1000, now - stamps[0]);
    return Math.round((stamps.length / 5) / (span / 60000));
  }

  /** Fire at most one new reaction per frame, so they do not stack up unread. */
  function checkTells(text) {
    for (const tell of TELLS) {
      if (seen.has(tell.key)) continue;
      if (!tell.test(text)) continue;
      seen.add(tell.key);
      notice = { line: tell.line, at: Date.now() };
      stage.classList.toggle("is-warned", tell.key === "swore" || tell.key === "shouting");
      return;
    }
  }

  function paint(reach, wpm, words, left, idleMs) {
    const pct = Math.round(reach * 100);
    clockEl.textContent = (left / 1000).toFixed(1);
    wpmEl.textContent = String(wpm);
    wordsEl.textContent = String(words);
    reachEl.textContent = `${pct}%`;
    scene.reach = reach;
    stage.classList.toggle("is-hot", wpm >= 45);
    stage.classList.toggle("is-stalled", idleMs > 2000 && running);
    // The letter is at the slot: it is now the player's call when to post.
    postBtn.disabled = !(running && reach >= 1);
    reactEl.textContent = reactionFor({ reach, wpm, words, left, idleMs }, notice);
  }

  function frame(now) {
    if (!running) return;
    const elapsed = now - startedAt;
    const left = Math.max(0, WINDOW_MS - elapsed);
    const idleMs = lastKey ? now - lastKey : elapsed;
    checkTells(input.value);
    paint(reachNow(), wpmNow(now), wordCount(), left, idleMs);
    // Reaching the slot no longer ends the run. It unlocks the button, and the
    // player decides when to post — keep writing to make the case better, at the
    // cost of the one axis that counts how long he was kept standing.
    if (left <= 0) return finish(WINDOW_MS, reachNow() >= 1);
    raf = requestAnimationFrame(frame);
  }

  function finish(durationMs, reached) {
    if (finished) return;
    finished = true; running = false;
    cancelAnimationFrame(raf);
    input.disabled = true;
    startBtn.disabled = false;
    startBtn.textContent = "Beg again";
    stage.classList.remove("is-hot", "is-stalled");

    postBtn.disabled = true;

    if (!reached) {
      scene.blowAway();
      reactEl.textContent = "The wind took it. It never crossed.";
      note.textContent = `It got ${Math.round(reachNow() * 100)}% of the way over. He never saw it.`;
      return;
    }
    scene.post();
    reactEl.textContent = "Posted. He is reading it.";
    note.textContent = "In the box. He is reading it…";
    opts.onWin?.({
      text: input.value,
      gaps: gaps.slice(0, 1200),
      durationMs: Math.round(durationMs),
      keystrokes,
      pasted,
      dropped,
      swipes
    }, {
      say: (msg) => { note.textContent = msg; },
      /** Refused: the letter comes back out of the slot and burns. */
      burn: (html) => scene.burn(() => {
        openEl.innerHTML = html;
        openEl.hidden = false;
        openEl.classList.add("is-ash");
      }),
      /** Accepted: it comes back out and opens, with the answer written inside.
          `after` receives the opened panel — the caller must not go looking for
          its own elements with a page-wide query, because the running game has
          a clock of its own sitting right above it. */
      open: (html, after) => scene.deliver(() => {
        openEl.innerHTML = html;
        openEl.hidden = false;
        openEl.classList.remove("is-ash");
        after?.(openEl);
      }),
      replace: (html) => { host.innerHTML = html; }
    });
  }

  function start() {
    finished = false; keystrokes = 0; gaps = []; stamps = []; lastKey = 0;
    pasted = false; dropped = false; swipes = 0; seen = new Set(); notice = null;
    input.value = ""; input.disabled = false; input.focus();
    startBtn.disabled = true;
    postBtn.disabled = true;
    openEl.hidden = true; openEl.innerHTML = "";
    scene.reset();
    stage.classList.remove("is-warned");
    note.textContent = "Go.";
    running = true; startedAt = performance.now();
    paint(0, 0, 0, WINDOW_MS, 0);
    raf = requestAnimationFrame(frame);
  }

  /* ── counting keystrokes ────────────────────────────────────────────────
     `keydown` alone does not work on a phone. Android's keyboard reports every
     software key as `Unidentified` with keyCode 229, so a keydown-only counter
     never moves and the game is unplayable on most phones in the world. So the
     count comes from `beforeinput`, which every modern browser fires per edit
     and which also names WHAT the edit was — and that is what lets us tell one
     typed letter from a whole word arriving at once.                          */
  const HAS_BEFOREINPUT = typeof HTMLTextAreaElement !== "undefined"
    && "onbeforeinput" in HTMLTextAreaElement.prototype;

  function countKey() {
    const now = performance.now();
    if (lastKey) gaps.push(Math.round(now - lastKey));
    lastKey = now;
    keystrokes += 1;
    stamps.push(now);
  }

  /** Glide typing, autocomplete, and dictation: whole words, no keystrokes. */
  function countSwipe(kind) {
    swipes += 1;
    notice = { line: "Whole words are arriving at once. Only keys carry the letter.", at: Date.now() };
    stage.classList.add("is-warned");
    note.textContent = kind === "dictate"
      ? "Dictation does not carry the letter. He wants it in your hand."
      : "Swipe typing does not carry the letter. Tap the keys.";
  }

  function markPaste() {
    pasted = true;
    notice = { line: "He watched you paste that into the envelope.", at: Date.now() };
    stage.classList.add("is-warned");
    note.textContent = "Pasting is not begging, and it now costs you.";
  }

  if (HAS_BEFOREINPUT) {
    input.addEventListener("beforeinput", (e) => {
      if (!running) return;
      const t = e.inputType || "";
      const d = e.data || "";

      if (t === "insertFromPaste" || t === "insertFromPasteAsQuotation") { e.preventDefault(); markPaste(); return; }
      if (t === "insertFromDrop") { e.preventDefault(); dropped = true; return; }

      // One letter at a time is a person. Anything longer arrived some other way.
      if (t === "insertText" || t === "insertCompositionText" || t === "insertReplacementText") {
        if (t === "insertText" && d.length === 1) return countKey();
        if (d.length > 1 || t !== "insertText") return countSwipe(d.length > 12 ? "dictate" : "swipe");
        return;                                   // insertText with no data: ignore
      }
      if (t.startsWith("delete")) return countKey();
      if (t === "insertLineBreak" || t === "insertParagraph") return countKey();
    });
  } else {
    // Older browsers: fall back to the original key events.
    input.addEventListener("keydown", (e) => {
      if (!running) return;
      if (e.key.length !== 1 && e.key !== "Backspace" && e.key !== " ") return;
      countKey();
    });
  }

  input.addEventListener("paste", (e) => { e.preventDefault(); markPaste(); });
  input.addEventListener("drop", (e) => { e.preventDefault(); dropped = true; });

  startBtn.addEventListener("click", start);
  // Posting is a press, and only possible once the letter is at the slot.
  postBtn.addEventListener("click", () => {
    if (!running || reachNow() < 1) return;
    finish(performance.now() - startedAt, true);
  });
  paint(0, 0, 0, WINDOW_MS, 0);

  return { start, stop: () => { running = false; cancelAnimationFrame(raf); scene.stop(); } };
}
