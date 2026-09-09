/**
 * arcade/beg.js — The Beggar's Reach.
 *
 * It is a typing race, so it is drawn as an instrument rather than a cartoon. The
 * previous version put two crude figures on a stage and they looked cheap next to
 * everything else in the shop; a gauge, set in the same faces as the rest of the store,
 * says the same thing and does not embarrass the page it sits on.
 *
 * The whole state of the run is three numbers and a line of type:
 *   seconds left, words a minute, words written
 *   a rule crossing the panel, filled as far as the arm has reached
 *   one sentence saying what he is doing about it
 *
 * That last line is the performance. It is not on a timer and it is not tied to speed
 * alone — it reacts to what you actually wrote, the moment you write it. Giving a
 * reason, naming the thing you want, finishing a sentence, stopping dead, shouting,
 * running out of minute: each has its own line, and the ones that are reactions to
 * something you just did take precedence over the ambient ones. See `reactionFor`.
 *
 * The arm is still the anti-cheat: it advances per keydown, not per character present
 * in the box, so pasting a language model's plea moves it not one pixel. The run also
 * carries its inter-key intervals to the server, which throws out anything typed on a
 * metronome. Grading is in kaayko-api/functions/api/arcade/begScore.js.
 */

const WINDOW_MS = 60000;
const NEEDED_KEYS = 180;      // keystrokes to fully extend the arm (~36 wpm for a minute)
const WPM_WINDOW_MS = 6000;   // how far back "how fast am I typing" looks
const NOTICE_MS = 2600;       // how long a reaction to something you just did holds

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── what he is doing about it ────────────────────────────────────────────── */

/** Things you can do that he reacts to, in the order they are worth noticing. */
export const TELLS = [
  { key: "swore",    test: (t) => /\b(fuck|shit|bitch|bastard|cunt|damn|crap|arse|ass)\w*\b/i.test(t),
    line: "He has stopped listening. You are swearing at a man with money." },
  { key: "shouting", test: (t) => t.length > 40 && (t.match(/[A-Z]/g) || []).length / t.replace(/[^a-z]/gi, "").length > 0.55,
    line: "You are shouting. He is standing four feet away." },
  { key: "named",    test: (t) => /\b(bottle|magnet|tote|shirt|stamp|postage|tiger|everest|railway|philately|kaayko)\b/i.test(t),
    line: "You named the thing. That is rarer than you would think." },
  { key: "reason",   test: (t) => /\b(because|since|so that|which is why|therefore|given that)\b/i.test(t),
    line: "A reason. He did not expect one of those." },
  { key: "number",   test: (t) => /\b\d{2,}\b/.test(t),
    line: "A number. He trusts numbers more than he trusts you." },
  { key: "stop",     test: (t) => /[.!?]/.test(t),
    line: "A full stop. He can follow a sentence." },
  { key: "forty",    test: (t) => (t.match(/\S+/g) || []).length >= 40,
    line: "Forty words and he has not walked off." }
];

/**
 * The ambient line — what he is doing when you have not just done anything.
 * @param {{reach:number, wpm:number, idleMs:number, left:number, words:number}} s
 */
export function ambient(s) {
  if (s.reach >= 1) return "He has it out of his pocket. Finish the sentence.";
  if (s.idleMs > 4200) return "He has looked at his watch twice now.";
  if (s.idleMs > 2000) return "You have stopped. So has he.";
  if (s.left < 8000 && s.reach < 0.6) return "He is putting his gloves back on.";
  if (s.left < 15000 && s.reach < 0.85) return "He has somewhere to be.";
  if (s.words === 0) return "He has not looked over.";
  if (s.reach < 0.20) return "He is pretending not to have heard.";
  if (s.reach < 0.45) return s.wpm > 45 ? "He noticed the noise, at least." : "He has half turned.";
  if (s.reach < 0.70) return "He is listening. He is not happy about it.";
  if (s.reach < 0.92) return "His hand has gone to his coat.";
  return "Almost. Keep going.";
}

/**
 * The line under the gauge. A reaction to something just done beats the ambient
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
      <div class="beg-gauge" aria-hidden="true">
        <div class="beg-readout">
          <div class="beg-cell"><b data-clock>60.0</b><span>seconds left</span></div>
          <div class="beg-cell is-mid"><b data-wpm>0</b><span>words a minute</span></div>
          <div class="beg-cell"><b data-words>0</b><span>words so far</span></div>
        </div>
        <div class="beg-track">
          <i class="beg-track-fill" data-fill></i>
          <i class="beg-track-mark" data-mark></i>
          <i class="beg-track-end" data-end></i>
        </div>
        <div class="beg-ends"><span>your hand</span><span data-reach>0%</span><span>his pocket</span></div>
        <p class="beg-react" data-react>He has not looked over.</p>
      </div>
      <label class="beg-label" for="beg-input">Make your case. The arm moves only when you type.</label>
      <textarea id="beg-input" class="beg-input" rows="4" spellcheck="false"
        autocomplete="off" autocorrect="off" autocapitalize="off"
        placeholder="Sixty seconds. Convince him."></textarea>
      <div class="beg-actions">
        <button type="button" class="beg-start">Start begging</button>
        <p class="beg-note" role="status" aria-live="polite">Up to ${maxPct}% &mdash; the case you make, whether he has heard it, whether it is spelled like a person, and how long you keep him standing. Most people get three or four.</p>
      </div>
    </div>`;

  const $ = (sel) => host.querySelector(sel);
  const input = $(".beg-input");
  const startBtn = $(".beg-start");
  const note = $(".beg-note");
  const clockEl = $("[data-clock]"), wpmEl = $("[data-wpm]"), wordsEl = $("[data-words]");
  const fillEl = $("[data-fill]"), markEl = $("[data-mark]"), endEl = $("[data-end]");
  const reachEl = $("[data-reach]"), reactEl = $("[data-react]");
  const gauge = $(".beg-gauge");

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
      gauge.classList.toggle("is-warned", tell.key === "swore" || tell.key === "shouting");
      return;
    }
  }

  function paint(reach, wpm, words, left, idleMs) {
    const pct = Math.round(reach * 100);
    clockEl.textContent = (left / 1000).toFixed(1);
    wpmEl.textContent = String(wpm);
    wordsEl.textContent = String(words);
    reachEl.textContent = `${pct}%`;
    fillEl.style.width = `${pct}%`;
    markEl.style.left = `${pct}%`;
    endEl.classList.toggle("is-lit", reach >= 1);
    gauge.classList.toggle("is-hot", wpm >= 45);
    gauge.classList.toggle("is-stalled", idleMs > 2000 && running);
    reactEl.textContent = reactionFor({ reach, wpm, words, left, idleMs }, notice);
  }

  function frame(now) {
    if (!running) return;
    const elapsed = now - startedAt;
    const left = Math.max(0, WINDOW_MS - elapsed);
    const idleMs = lastKey ? now - lastKey : elapsed;
    checkTells(input.value);
    paint(reachNow(), wpmNow(now), wordCount(), left, idleMs);
    if (reachNow() >= 1) return finish(elapsed, true);
    if (left <= 0) return finish(WINDOW_MS, false);
    raf = requestAnimationFrame(frame);
  }

  function finish(durationMs, reached) {
    if (finished) return;
    finished = true; running = false;
    cancelAnimationFrame(raf);
    input.disabled = true;
    startBtn.disabled = false;
    startBtn.textContent = "Beg again";
    gauge.classList.remove("is-hot", "is-stalled");

    if (!reached) {
      reactEl.textContent = "He walked off. The arm never got there.";
      note.textContent = `The arm fell short at ${Math.round(reachNow() * 100)}%. He did not even look up.`;
      return;
    }
    reactEl.textContent = "He is reading it.";
    note.textContent = "Reached him. He is reading it…";
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
      replace: (html) => { host.innerHTML = html; }
    });
  }

  function start() {
    finished = false; keystrokes = 0; gaps = []; stamps = []; lastKey = 0;
    pasted = false; dropped = false; swipes = 0; seen = new Set(); notice = null;
    input.value = ""; input.disabled = false; input.focus();
    startBtn.disabled = true;
    gauge.classList.remove("is-warned");
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
    notice = { line: "Whole words are arriving at once. The arm only moves for keys.", at: Date.now() };
    gauge.classList.add("is-warned");
    note.textContent = kind === "dictate"
      ? "Dictation does not move the arm. He wants to watch you type it."
      : "Swipe typing does not move the arm. Tap the letters.";
  }

  function markPaste() {
    pasted = true;
    notice = { line: "He watched you paste that.", at: Date.now() };
    gauge.classList.add("is-warned");
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
  paint(0, 0, 0, WINDOW_MS, 0);

  return { start, stop: () => { running = false; cancelAnimationFrame(raf); } };
}
