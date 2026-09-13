/**
 * pages/shipping.js — Kaayko Shipping, the endless delivery game (/shipping, /fly).
 * Moved out of shipping.html on 12 Sep 2026 unchanged apart from the shared esc().
 */
import { shipping, stageAt, phaseFor, PHASES } from '/js/arcade/shipping.js';
import { rows, post, clear } from '/js/arcade/board.js';
import { esc } from '/js/kit.js';

const $ = (id) => document.getElementById(id);
const cv = $('cv'), menu = $('menu'), opts = $('m-opts'), extra = $('m-extra');
const key = $('key'), drop = $('drop'), keys = $('keys');
const scoreEl = $('score'), missedEl = $('missed'), bestEl = $('best');
const stageEl = $('stage'), phaseEl = $('phase');

const BEST_KEY = 'kaayko.shipping.best';
let best = 0;
try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) {}
bestEl.textContent = best;

/* A finished run mints this. board.js will not accept a score without it, so a
   name cannot be added to the board except by playing. */
let runToken = null, lastRun = null;

/* Every menu hides the release button, so coming back from one has to ask the
   game whether a parcel is still in hand. Without this, pausing while carrying
   left you holding a parcel you could never let go of. */
function showDrop(on) {
  drop.hidden = !on;
  keys.classList.toggle('has-parcel', on);
  if (!on) drop.classList.remove('is-down');
}

const game = shipping(cv, {
  onScore(n) { scoreEl.textContent = n; stageEl.textContent = game.stageName; },
  onMiss(n) { missedEl.textContent = n; },
  onCarry(on) { showDrop(on); },
  onEnd(r) {
    if (r.score > best) {
      best = r.score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (_) {}
      bestEl.textContent = best;
    }
    runToken = `run-${r.score}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    lastRun = r;
    show('over', r);
  }
});
phaseEl.textContent = game.phaseLabel;

/* ── menus ───────────────────────────────────────────────────────────────────
   Every state has one, and every one lists the ways out. Nothing here can trap
   you behind an overlay with no button.                                       */
const boardList = (highlight) => {
  const r = rows();
  if (!r.length) return '<p class="cap">Nobody has signed it yet today.</p>';
  return '<ol class="board">' + r.map((row, i) =>
    `<li class="${row.name === highlight ? 'is-you' : ''}"><i>${i + 1}</i>` +
    `<span>${esc(row.name)}</span><b>${row.score}</b></li>`).join('') + '</ol>';
};

const SCREENS = {
  start: () => ({
    kicker: 'Kaayko &middot; endless',
    title: 'Kaayko Shipping',
    body: 'Hold to climb, let go to fall. Fly through a parcel to pick it up, then ' +
          'release it over a green pad. It falls faster than you do, so let go early.',
    opts: [['Start flying', () => begin(), true],
           ['How it works', () => show('how')],
           ['Today’s board', () => show('board')],
           ['Back to the cards', () => { location.href = '/card'; }]]
  }),
  how: () => ({
    kicker: 'How it works',
    title: 'Lead the pad',
    body: 'A released parcel keeps your speed and then drops at twice your weight. ' +
          'Aim where the pad will be, not where it is. Miss and you lose the parcel, ' +
          'nothing else. Weather turns at 5, towers move at 10, pads narrow at 15. ' +
          'The sky follows your clock — right now it is ' + game.phaseLabel.toLowerCase() + '.',
    opts: [['Start flying', () => begin(), true],
           ['Back', () => show('start')]]
  }),
  board: () => ({
    kicker: 'Temporary board',
    title: 'Today only',
    body: 'It lives in this browser and clears itself at midnight. Eight places.',
    html: boardList(),
    opts: [['Start flying', () => begin(), true],
           ['Clear the board', () => { clear(); show('board'); }],
           ['Back', () => show('start')]]
  }),
  paused: () => ({
    kicker: 'Paused',
    title: `${game.score} delivered`,
    body: 'Nothing is lost. Pick one.',
    opts: [['Resume', () => { hide(); game.resume(); key.disabled = false; showDrop(game.carrying); }, true],
           ['Start again', () => begin()],
           ['How it works', () => show('how')],
           ['Back to the cards', () => { location.href = '/card'; }]]
  }),
  over: (r) => ({
    kicker: r.score >= best && r.score > 0 ? 'A new best' : 'Down',
    title: `${r.score} delivered`,
    body: r.score === 0
      ? (r.missed ? 'Parcels are not deliveries. Release earlier — it falls faster than you.'
                  : 'Nothing shipped. Fly through a parcel first, then find a green pad.')
      : `Down in ${r.stage.toLowerCase()}, ${r.missed} dropped. Best today is ${best}.`,
    sign: r.score > 0,
    opts: [['Fly again', () => begin(), true],
           ['Today’s board', () => show('board')],
           ['How it works', () => show('how')],
           ['Back to the cards', () => { location.href = '/card'; }]]
  })
};

function show(which, arg) {
  const s = SCREENS[which](arg);
  $('m-kicker').innerHTML = s.kicker;
  $('m-title').textContent = s.title;
  $('m-body').innerHTML = s.body;
  extra.innerHTML = s.html || '';
  if (s.sign) signForm();
  opts.innerHTML = '';
  for (const [label, fn, primary] of s.opts) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt' + (primary ? ' is-primary' : '');
    b.textContent = label;
    b.addEventListener('click', fn);
    opts.appendChild(b);
  }
  menu.hidden = false;
  key.disabled = true;
  showDrop(false);
  opts.querySelector('.opt')?.focus({ preventScroll: true });
}
const hide = () => { menu.hidden = true; };

/* Signing the board. Every rejection says which gate said no and why, so this
   is a door with a sign on it rather than a field that silently refuses. */
function signForm() {
  const box = document.createElement('div');
  box.className = 'sign';
  box.innerHTML = '<input id="who" maxlength="14" autocomplete="off" ' +
    'spellcheck="false" placeholder="Sign the board" aria-label="Your name for the board">' +
    '<button type="button" class="opt" id="signit">Add</button>';
  const said = document.createElement('p');
  said.className = 'said';
  extra.append(box, said);

  const go = () => {
    const name = box.querySelector('#who').value;
    const r = post({ name, score: lastRun.score, token: runToken }, runToken);
    if (!r.ok) { said.className = 'said is-bad'; said.textContent = r.why; return; }
    runToken = null;                                     // one post per run
    said.className = 'said';
    said.textContent = r.place === 1 ? 'Top of the board.' : `Number ${r.place}.`;
    box.remove();
    const list = document.createElement('div');
    list.innerHTML = boardList(name.replace(/\s+/g, ' ').trim());
    extra.appendChild(list);
  };
  box.querySelector('#signit').addEventListener('click', go);
  box.querySelector('#who').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); go(); }
    e.stopPropagation();                                 // Enter here is not a release
  });
}

function begin() {
  hide();
  runToken = null;
  scoreEl.textContent = '0';
  missedEl.textContent = '0';
  stageEl.textContent = stageAt(0).name;
  phaseEl.textContent = PHASES[phaseFor()].label;
  key.disabled = false;
  showDrop(false);
  game.start();
}

/* ── the two controls ────────────────────────────────────────────────────────
   Climb is a hold. Release is a press, and only exists while you are carrying. */
const live = () => !key.disabled && menu.hidden;
const holdOn = (e) => {
  if (!live()) return;
  e.preventDefault();
  key.classList.add('is-down');
  game.hold(true);
};
const holdOff = () => { key.classList.remove('is-down'); game.hold(false); };

for (const el of [key, cv]) {
  el.addEventListener('pointerdown', (e) => {
    // Capture first, but never let it take the flight down with it: this throws
    // NotFoundError when the pointer is already gone, and it used to run BEFORE
    // holdOn, so one throw here left the plane with no controls at all.
    try { el.setPointerCapture?.(e.pointerId); } catch (_) {}
    holdOn(e);
  });
  el.addEventListener('pointerup', holdOff);
  el.addEventListener('pointercancel', holdOff);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
window.addEventListener('pointerup', holdOff);

function release() {
  if (!live()) return;
  if (!game.release()) return;
  drop.classList.add('is-down');
  setTimeout(() => drop.classList.remove('is-down'), 110);
}
drop.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); release(); });
drop.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    if (menu.hidden && game.pause()) show('paused');
    return;
  }
  if (!menu.hidden) return;
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault(); if (!e.repeat) { key.classList.add('is-down'); game.hold(true); }
  } else if (e.code === 'Enter' || e.code === 'ArrowDown' || e.key === 'r' || e.key === 'R') {
    e.preventDefault(); if (!e.repeat) release();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') holdOff();
});
// Losing the window mid-flight pauses rather than quietly killing the run.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && menu.hidden && game.pause()) show('paused');
});

show('start');
