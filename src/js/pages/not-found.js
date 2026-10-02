/**
 * pages/not-found.js — the 404 deals the deck.
 *
 * The cards are the ones /card shows and the print sheet prints: the same copy
 * from the same API (falling back to the same static index), drawn by the same
 * renderer in the printed colourway, with a real QR made from each card's URL.
 * Nothing about a card is restated here, so a card edited in the admin panel
 * is edited here too.
 *
 * Each card is a link to the thing it advertises. It turns over to show its
 * back (one sentence, three facts) when pointed at or focused; where there is
 * no hover, a small button beside it turns it instead, so a tap still goes
 * where the card says.
 *
 * Until this runs, the page already holds a plain list of the same places, so
 * a reader without scripts, or with a network that drops the module, still
 * gets out.
 */
import { front, back, PRINT } from '/js/cards/render.js?v=d5ff872';
import { esc, apiBase } from '/js/kit.js?v=d5ff872';

const hand = document.getElementById('hand');
const pathEl = document.getElementById('nf-path');

// Show what they asked for, so the joke has a subject. Text only, never markup.
if (pathEl) {
  let asked = location.pathname;
  try { asked = decodeURI(asked); } catch (_) { /* a malformed escape: show it as typed */ }
  asked = asked.replace(/\/+$/, '') || '/';
  pathEl.textContent = asked.length > 48 ? `${asked.slice(0, 47)}…` : asked;
}

function qrFor(url) {
  try {
    const q = window.qrcode(0, 'M');
    q.addData(url);
    q.make();
    return q;
  } catch (_) { return null; }
}

async function deck() {
  try {
    const r = await fetch(`${apiBase()}/cards`, { cache: 'no-cache' });
    if (!r.ok) throw new Error(String(r.status));
    const idx = await r.json();
    return { cards: idx.cards || [], brand: idx.brand || {} };
  } catch (_) {
    const r = await fetch('/assets/cards/index.json', { cache: 'no-cache' });
    const idx = await r.json();
    return { cards: idx.cards || [], brand: { label: idx.label || 'KAAYKO' } };
  }
}

/** What a screen reader hears for a card: everything printed on both sides. */
function spoken(c) {
  return [c.name, c.hook, c.line, ...(c.facts || []), c.host || c.url].filter(Boolean).join('. ');
}

function deal({ cards, brand }) {
  const n = cards.length;
  hand.style.setProperty('--n', String(n));
  hand.innerHTML = cards.map((c, i) => {
    const art = `/assets/cards/art/${c.art || c.slug}.png`;
    const off = i - (n - 1) / 2;   // a hand: fanned about its middle, the outer cards lower
    return `<li class="mini" style="--i:${i};--off:${off.toFixed(2)}">
  <a class="mini-card" href="${esc(c.url)}" aria-label="${esc(spoken(c))}">
    <span class="mini-turn">
      <span class="mini-face mini-front">${front(c, { qr: qrFor(c.url), artHref: art, skin: PRINT })}</span>
      <span class="mini-face mini-back">${back(c, brand, { index: i + 1, total: n, artHref: art, skin: PRINT })}</span>
    </span>
  </a>
  <button class="mini-flip" type="button" aria-pressed="false" aria-label="Turn ${esc(c.name)} over"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M15.5 7.5A6 6 0 1 0 16 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16.5 3.5v4.4h-4.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
</li>`;
  }).join('');
  hand.classList.add('dealt');
}

hand.addEventListener('click', (e) => {
  const b = e.target.closest('.mini-flip');
  if (!b) return;
  const on = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', String(on));
  b.closest('.mini').classList.toggle('is-turned', on);
});

deck().then(deal).catch(() => { /* the plain list in the page stays */ });
