// File: js/sustainabilityAlert.js
/**
 * "Five to a bag" — shown when a sixth piece is added.
 *
 * Rebuilt 24 Oct 2026 when the limit went from two to five. The old modal was a
 * leaf icon, a gold gradient button and "2-design limit reached" — a different
 * shop's voice. This one is the store's: paper, ink, Cormorant for the line that
 * matters, Josefin for the rest, and the five pieces already in the bag so the
 * shopper can see what to take out. A native <dialog>, so focus is trapped,
 * Escape closes it and focus returns to the button that opened it.
 *
 * The name stays (window.showSustainabilityAlert): fitPicker.js and the page
 * modules call it.
 */
import { cartManager, MAX_DISTINCT } from '/js/cartManager.js';
import { esc } from '/js/kit.js';

let dialog = null;

function build() {
  dialog = document.createElement('dialog');
  dialog.id = 'bag-full';
  dialog.className = 'bag-full';
  dialog.setAttribute('aria-labelledby', 'bag-full-title');
  dialog.setAttribute('aria-describedby', 'bag-full-copy');
  dialog.innerHTML = `
    <form method="dialog" class="bag-full-sheet">
      <p class="bag-full-eyebrow">Your bag</p>
      <h2 class="bag-full-title" id="bag-full-title">Five to a bag.</h2>
      <p class="bag-full-copy" id="bag-full-copy"></p>
      <ul class="bag-full-pieces" aria-label="In your bag"></ul>
      <p class="bag-full-why">Every piece is printed when you order it, so a bag stays small.</p>
      <div class="bag-full-actions">
        <a class="bag-full-primary" href="/cart">Review bag</a>
        <button class="bag-full-secondary" value="close">Keep browsing</button>
      </div>
    </form>`;
  // A click on the backdrop (the dialog itself, outside the sheet) closes it.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  document.body.appendChild(dialog);
}

export function showSustainabilityAlert(context = {}) {
  if (!dialog || !dialog.isConnected) build();
  const attempted = context?.attemptedProduct || null;
  dialog.querySelector('#bag-full-copy').textContent = attempted
    ? `Your bag already holds ${MAX_DISTINCT} pieces. To add the ${attempted}, take one out first.`
    : `Your bag already holds ${MAX_DISTINCT} pieces. Take one out to add another.`;
  dialog.querySelector('.bag-full-pieces').innerHTML = cartManager.getItems().map((i) => `
      <li>${i.imgSrc ? `<img src="${esc(i.imgSrc)}" alt="" loading="lazy" decoding="async">` : ''}<span>${esc(i.title || '')}</span></li>`).join('');
  if (!dialog.open) dialog.showModal();
}

// Make globally available
window.showSustainabilityAlert = showSustainabilityAlert;
