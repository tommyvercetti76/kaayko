/**
 * pages/cart.js — the bag and the checkout (/cart), on one screen.
 *
 * Moved out of cart.html on 12 Sep 2026. Money is integer cents end to end: the
 * bag stores priceCents, the server answers in cents, and money() is the only
 * place a figure becomes a string. The Stripe publishable key comes from
 * prod-config.js; prices are never sent — the server re-derives them from the
 * catalogue (kaayko-api/functions/api/checkout/pricing.js).
 *
 * One screen since 25 Oct 2026: the bag, contact, delivery and payment are all
 * here from the start. It used to be a bag screen whose "Continue" re-drew a
 * near-identical page with the payment form in it.
 */
import { cartManager } from '/js/cartManager.js';
import { savedPromo, clearPromo, checkPromo, savePromo } from '/js/services/promo.js';
import { esc, money } from '/js/kit.js';
// Prices may SHOW in ₹ (currency.js); the charge is always US dollars, so Pay and the
// "You pay" line use money(), and every figure stays US cents underneath.
import { price, priceSpan, paint, label, repaint, mountCurrencySwitch, indiaShopper } from '/js/services/currency.js';
import { createPaymentIntent, calculateTax as requestTax, updateContact } from '/js/services/storeApi.js';
import { show as showToast } from '/js/components/Toast.js';

const STRIPE_KEY = window.KAAYKO_STRIPE_PK;

// Must say the same thing as /legal/shipping — that page is the promise,
// this is the reminder.
const SHIP_TIME = 'Made to order · on its way within 10 business days';

/* ── Checkout state ──────────────────────────────────────────────
   The payment intent is made ONCE per bag: when the page opens with
   something in it, and again only when the bag or the code changes.
   (The old page minted one on every render, which a window resize
   triggered.) A reload of the same bag gets the same intent back:
   the server keys it on this tab's checkout nonce plus the bag.     */
const state = {
  pi: null,             // { clientSecret, paymentIntentId, totals }
  elements: null,
  stripe: null,
  parts: {},            // the mounted Stripe elements, to focus what is missing
  creating: false,
  prepError: null,      // why the intent could not be made, in the shopper's words
  cartSig: null,        // cart signature the current intent was priced for
  addressComplete: false,
  paymentComplete: false,
  emailValid: false,
  paying: false,
  email: '',            // from the Link email field (Stripe's, so not readable from the DOM)
  address: null,        // the last address typed: carried into a re-made form
  // Sales tax is computed server-side once the shipping address is
  // complete. Pay waits until it is known — a shopper must never be
  // charged an un-taxed total while tax is nominally on.
  taxState: 'idle',     // 'idle' | 'pending' | 'ok' | 'disabled' | 'error'
  taxKey: null,         // address the current tax figure was computed for
  taxTimer: null,
  // A promo code held from a maker's link or typed in. Held here only so the
  // field can be pre-filled; the API re-checks it and decides what it is worth.
  promo: savedPromo(),
  promoNote: null,      // why the last code was refused, in the shopper's words
  promoOpen: false      // the code field is behind a link until it is wanted
};

/* ── Helpers ─────────────────────────────────────────────────── */
// esc() and money() come from kit.js. Cart contents come from localStorage and
// product titles from Firestore, so nothing is interpolated into HTML unescaped.

/** The checkout speaks in errors unless told otherwise. */
const toast = (message, kind = 'error', action = null) => showToast(message, { kind, action });

// A stable fingerprint of what is in the bag. If this changes after
// an intent exists, the intent was priced for a different bag.
const signature = (items) => items
  .map(i => `${i.productId}|${i.size ?? ''}|${i.gender ?? ''}`)
  .sort()
  .join('~');

// `gender` is deliberately null for totes, magnets and other
// one-size goods (see js/animal.js) — the old page printed the
// literal string "null" next to the size.
const metaLine = (item) => {
  const parts = [];
  if (item.gender && item.gender !== 'null') parts.push(esc(item.gender));
  // A magnet's option is its shape (24 Oct 2026); everything else has a size.
  if (item.size) parts.push(`${/^(round|square)$/i.test(item.size) ? 'Shape' : 'Size'} ${esc(item.size)}`);
  return parts.join(' · ');
};

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// One nonce per bag: retries and reloads of the same bag reuse one
// PaymentIntent, and no other shopper can ever derive the same key.
const NONCE = 'kaayko_checkout_session';
function checkoutSessionNonce() {
  try {
    let n = sessionStorage.getItem(NONCE);
    if (!n) {
      n = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
        : 'cs-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem(NONCE, n);
    }
    return n;
  } catch (e) { return ''; }   // no storage: server issues a fresh intent per call
}

/* ── Promo codes ─────────────────────────────────────────────────
   A code handed out on purpose — a maker's friends' rate. The
   discount itself is computed by the server when the payment intent
   is created; nothing here takes a cent off on its own.            */
const PROMO_REFUSALS = {
  NO_SUCH_CODE:     'No such code.',
  EXPIRED:          'That code has run out.',
  NO_ELIGIBLE_ITEMS:'That code does not cover anything in this bag.',
  PROMO_INACTIVE:   'That code is no longer on offer.',
  USED_UP:          'That code has been used as many times as it can be.',
  EMPTY_CART:       'Nothing in the bag to discount.'
};

function promoFieldMarkup() {
  const r = state.promo;
  if (!r && !state.promoOpen && !state.promoNote) {
    return `<div class="co-promo" id="co-promo">
      <button type="button" class="co-promo-toggle" id="co-promo-toggle" aria-expanded="false">Have a discount code?</button>
    </div>`;
  }
  return `
    <div class="co-promo" id="co-promo">
      <label class="co-field-label" for="co-promo-input">Discount code</label>
      <div class="co-promo-row">
        <input class="co-input" id="co-promo-input" type="text" inputmode="text"
               autocomplete="off" spellcheck="false" placeholder="CODE"
               value="${esc(r?.code || '')}" aria-describedby="co-promo-note" />
        <button type="button" class="co-promo-btn" id="co-promo-apply">${r ? 'Remove' : 'Apply'}</button>
      </div>
      <p class="co-promo-note" id="co-promo-note" role="status" aria-live="polite">${
        state.promoNote ? esc(state.promoNote)
        : r && r.scope === 'cart' ? `${r.percent}% off the whole bag — already in your total.`
        : r ? `${r.percent}% off${r.label ? ` ${esc(r.label)}` : ' the pieces on that shelf'}. Taken off when you pay.`
        : ''
      }</p>
    </div>`;
}

/* Stripe's raw messages range from decent to opaque ("card_declined"),
   and a shopper who cannot tell whether to retry, fix something, or use
   another card simply leaves. Say what happened and what to do next. */
const DECLINE_COPY = {
  insufficient_funds: 'That card was declined for insufficient funds. Try another card.',
  lost_card:          'That card was declined. Please use a different card.',
  stolen_card:        'That card was declined. Please use a different card.',
  expired_card:       'That card has expired. Check the expiry date, or try another card.',
  incorrect_cvc:      'That security code did not match. Check the CVC and try again.',
  incorrect_number:   'That card number is not right. Check it and try again.',
  processing_error:   'The card network had a problem. Wait a moment and try again.',
  card_velocity_exceeded: 'That card has hit its limit. Try another card.',
  generic_decline:    'Your bank declined the payment. They can tell you why — or try another card.'
};

function friendlyPaymentError(error) {
  if (!error) return 'Something went wrong. Please try again.';
  if (error.type === 'validation_error') return error.message;
  const byDecline = DECLINE_COPY[error.decline_code] || DECLINE_COPY[error.code];
  if (byDecline) return byDecline;
  if (error.code === 'payment_intent_authentication_failure') {
    return 'Your bank could not verify that payment. Try again, or use another card.';
  }
  return error.message || 'That payment could not be completed. Please try again.';
}

/* Many cards issued in India come with international online payments switched off
   (a Reserve Bank of India rule since 2020), and this store charges in US dollars:
   for a shopper in India, a decline says what to switch on (audit, 26 Oct 2026). */
const INDIA_CARD_TIP = 'If your card was issued in India, switch on international online payments in your bank’s app, then try again.';
function declineCopy(error) {
  const text = friendlyPaymentError(error);
  const declined = error && (error.type === 'card_error' || error.decline_code);
  const fixable = !error || !['incorrect_cvc', 'incorrect_number', 'expired_card'].includes(error.decline_code || error.code);
  return declined && fixable && indiaShopper() ? `${text} ${INDIA_CARD_TIP}` : text;
}

/* A total's parts, so its ₹ figure is the sum of the ₹ lines above it (each part is
   converted and rounded, then added). Only when the parts truly add up to the dollar
   figure — a server-priced bag whose prices moved shows the plain conversion. */
function moneyParts(t, items) {
  const lines = items.map((i) => (i.priceCents || 0) * (i.quantity || 1));
  if (lines.reduce((a, b) => a + b, 0) !== t.subtotal) return { subtotal: undefined, total: undefined };
  const total = [...lines];
  if (t.discount > 0) total.push(-t.discount);
  if (t.taxKnown && t.tax > 0) total.push(t.tax);
  return { subtotal: lines, total: total.reduce((a, b) => a + b, 0) === t.total ? total : undefined };
}

/* ── Totals (integer cents) ───────────────────────────────────────
   Once the server has priced the bag it is the authority: the API
   resolves every price from Firestore rather than trusting what the
   client sends. Until then we show the catalogue price the shopper
   already saw on the product page (priceCents, from priceMap.js).  */
function totals(items) {
  const server = state.pi?.totals;
  if (server && typeof server.totalCents === 'number') {
    const taxKnown = state.taxState === 'ok' || state.taxState === 'disabled';
    return {
      subtotal: server.subtotalCents ?? server.totalCents,
      tax: server.taxCents || 0,
      discount: server.discountCents || 0,
      discountPercent: server.discountPercent || 0,
      taxKnown,
      total: server.totalCents,
      authoritative: true
    };
  }
  const subtotal = items.reduce((sum, i) => sum + (i.priceCents || 0) * (i.quantity || 1), 0);
  // A whole-bag code is a flat percent of the bag, so the bag can show it before
  // checkout prices it — same rounding and 50% cap as discounts.js. The server
  // still decides (a per-order ceiling or a better patron deal can change it);
  // once it answers, the branch above shows its figure.
  const p = state.promo;
  const percent = p && p.scope === 'cart' ? Math.max(0, Math.min(Number(p.percent) || 0, 50)) : 0;
  const discount = Math.floor((subtotal * percent) / 100);
  return { subtotal, tax: 0, discount, discountPercent: discount > 0 ? percent : 0,
           taxKnown: false, total: subtotal - discount, authoritative: false };
}

/* ── Render ──────────────────────────────────────────────────────
   Drawn once per bag. A cart notification that changes nothing (another
   tab, a badge refresh) only updates figures: re-drawing would tear the
   Stripe fields out from under a shopper who is typing in them.      */

function render() {
  const root = document.getElementById('co-content');
  const items = cartManager.getItems();
  const sticky = document.getElementById('co-sticky');

  document.getElementById('co-count').textContent = items.length;
  document.title = items.length ? 'Checkout — Kaayko' : 'Your bag — Kaayko';

  if (items.length === 0) {
    root.innerHTML = `
      <div class="co-empty">
        <h1>Your bag is empty</h1>
        <p>Nothing here yet. Have a look at what is in the shop.</p>
        <a href="store"><span class="material-icons" style="font-size:18px">arrow_back</span> Back to store</a>
      </div>`;
    sticky.classList.remove('is-active');
    watchPay(null);
    dropIntent();
    return;
  }

  const sig = signature(items);
  if (state.pi && state.cartSig === sig && document.getElementById('co-payment-element')) {
    updateMoney();
    return;
  }
  // The bag changed underneath an intent priced for a different bag: price it again.
  if (state.pi && state.cartSig !== sig) dropIntent();

  const t = totals(items);
  const parts = moneyParts(t, items);

  root.innerHTML = `
    <div class="co-masthead">
      <h1>Checkout</h1>
      <p>${items.length} ${items.length === 1 ? 'piece' : 'pieces'} · Free US shipping · 30-day returns</p>
    </div>
    <div class="co-layout">
      <section class="co-details" aria-label="Your details">
        <h2 class="co-label">Contact</h2>
        <!-- Stripe's Link email field: it labels and checks itself, the payment
             form's "save my info" box reuses it instead of asking again, and a
             returning Link shopper gets address + card filled. -->
        <div class="co-field" id="co-email-element"></div>

        <h2 class="co-label">Delivery</h2>
        <p class="co-note">We deliver within the United States.</p>
        <div id="co-address-element"></div>

        <h2 class="co-label">Payment</h2>
        <p class="co-note" data-fx-india hidden>Paying with a card issued in India? Switch on international online payments in your bank’s app first: many come with them off.</p>
        <div id="co-payment-element">
          <div class="co-skeleton"><i></i><i></i><i></i></div>
        </div>
      </section>

      <aside class="co-aside">
        <section class="co-bag" aria-labelledby="co-bag-head">
          <h2 class="co-label" id="co-bag-head">Your bag</h2>
          ${items.map(itemMarkup).join('')}
          <p class="co-bag-note">${SHIP_TIME}.</p>
        </section>

        <div class="co-card co-summary">
          <div class="co-money">
            <div class="co-money-row"><span>Subtotal</span>${priceSpan(t.subtotal, '', parts.subtotal).replace('<span class="px"', '<span class="px" id="co-subtotal"')}</div>
            <div class="co-money-row is-discount" id="co-discount-row" ${t.discount > 0 ? '' : 'hidden'}>
              <span>Discount${t.discountPercent ? ` · ${t.discountPercent}%` : ''}</span>
              ${priceSpan(-t.discount).replace('<span class="px"', '<span class="px" id="co-discount"')}
            </div>
            <div class="co-money-row"><span>Shipping</span><span>Free</span></div>
            <div class="co-money-row ${t.taxKnown ? '' : 'is-pending'}" id="co-tax-row"><span>Sales tax</span>${t.taxKnown ? priceSpan(t.tax).replace('<span class="px"', '<span class="px" id="co-tax"') : '<span id="co-tax">From your address</span>'}</div>
            <div class="co-money-row is-total"><span>Total</span>${priceSpan(t.total, '', parts.total).replace('<span class="px"', '<span class="px" id="co-total"')}</div>
            <p class="co-charge" id="co-charge" data-charge-cents="${t.total}" hidden></p>
          </div>

          ${promoFieldMarkup()}

          <button id="co-primary" class="co-btn" type="button" aria-describedby="co-ready-hint">Pay ${money(t.total)}</button>
          <p class="co-ready-hint" id="co-ready-hint" aria-live="polite"></p>
          <p class="co-legal"><span class="material-icons" aria-hidden="true">lock</span> Paid securely through Stripe; card details never reach Kaayko.
            By paying you agree to our <a href="/legal/terms">Terms of Sale</a>, <a href="/legal/returns">Returns</a> and
            <a href="/legal/shipping">Shipping</a> policies. Your address is used to ship this order and kept only as our
            <a href="/store/privacy">Privacy Policy</a> says.</p>
        </div>
      </aside>
    </div>`;

  // A slip of the thumb should not cost the piece: Remove offers it back.
  repaint(root);                 // the "You pay $… in US dollars" line under the total, in ₹

  root.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const gone = cartManager.getItem(btn.dataset.remove);
      cartManager.removeItem(btn.dataset.remove);
      if (gone) toast(`${gone.title} removed.`, 'notice', { label: 'Undo', onClick: () => cartManager.addItem(gone) });
    });
  });
  wirePromoField();

  const primary = document.getElementById('co-primary');
  const stickyBtn = document.getElementById('co-sticky-btn');
  stickyBtn.textContent = `Pay ${money(t.total)}`;
  stickyNote(t, parts.total);
  primary.addEventListener('click', pay);
  stickyBtn.onclick = pay;
  watchPay(primary);

  if (state.pi) mountStripe();
  else if (state.prepError) showPrepFailure();
  else prepare();
  refreshReady();
}

/* Under the sticky Pay on a phone, when prices show in ₹: the ₹ total and that the
   charge is in dollars. "Pay $19.98" under a page of ₹ figures, with the reason off
   screen, read as a mistake (audit, 26 Oct 2026). */
function stickyNote(t, parts) {
  const note = document.getElementById('co-sticky-note');
  if (!note) return;
  paint(note.querySelector('.px'), t.total, parts);
  repaint(note.parentElement);
}

/* The bar at the foot of a phone carries Pay only until the real button is on
   screen. It used to stay put, so at the end of the page the site footer sat
   between the order and the button that pays for it. */
let payWatch = null;
function watchPay(button) {
  if (payWatch) { payWatch.disconnect(); payWatch = null; }
  const sticky = document.getElementById('co-sticky');
  if (!button || !('IntersectionObserver' in window)) return;
  payWatch = new IntersectionObserver(([e]) => {
    sticky.classList.toggle('is-active', !e.isIntersecting && e.boundingClientRect.top > 0);
  });
  payWatch.observe(button);
}

function itemMarkup(item, index = 0) {
  const meta = metaLine(item);
  // the piece's own page, to look again before paying
  const href = `/store/p/${encodeURIComponent(item.productId)}`;
  const qty = item.quantity || 1;
  return `
    <article class="co-item" style="--co-i:${index}">
      <a class="co-item-link" href="${href}" tabindex="-1" aria-hidden="true">
        <img class="co-item-image" src="${esc(item.imgSrc)}" alt=""
             onerror="this.classList.add('is-broken')" />
      </a>
      <div class="co-item-body">
        <h3 class="co-item-title"><a href="${href}">${esc(item.title)}</a></h3>
        <p class="co-item-meta">${meta}${meta && qty > 1 ? ' · ' : ''}${qty > 1 ? `Quantity ${qty}` : ''}</p>
      </div>
      <div class="co-item-side">
        <span class="co-item-price">${priceSpan((item.priceCents || 0) * qty)}</span>
        <button class="co-item-remove" data-remove="${esc(item.productId)}"
                aria-label="Remove ${esc(item.title)}">Remove</button>
      </div>
    </article>`;
}

function wirePromoField() {
  const toggle = document.getElementById('co-promo-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      state.promoOpen = true;
      redrawPromo();
      document.getElementById('co-promo-input')?.focus();
    });
    return;
  }
  const input = document.getElementById('co-promo-input');
  const btn = document.getElementById('co-promo-apply');
  const note = document.getElementById('co-promo-note');
  if (!input || !btn) return;

  const apply = async () => {
    if (state.promo) {                        // the button reads Remove
      clearPromo();
      state.promo = null;
      state.promoNote = null;
      dropIntent();                           // it was priced with the code
      render();
      return;
    }
    const code = input.value.trim().toUpperCase();
    if (!code) return;
    btn.disabled = true;
    note.textContent = 'Checking…';
    const res = await checkPromo(code);
    btn.disabled = false;

    if (res?.code === 'OFFLINE') { note.textContent = 'We could not check that code. Try again in a moment.'; return; }
    if (!res?.success) { note.textContent = PROMO_REFUSALS.NO_SUCH_CODE; return; }
    if (!res.valid) { note.textContent = res.expired ? PROMO_REFUSALS.EXPIRED : PROMO_REFUSALS.PROMO_INACTIVE; return; }
    state.promo = { code, percent: res.percent, scope: res.scope, label: res.label || null };
    savePromo(state.promo);
    state.promoNote = null;
    dropIntent();
    render();
  };

  btn.addEventListener('click', apply);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
}

function redrawPromo() {
  const block = document.getElementById('co-promo');
  if (!block) return;
  block.outerHTML = promoFieldMarkup();
  wirePromoField();
}

/* ── The intent ─────────────────────────────────────────────────
   A new bag or a new code gets a new intent, under a new nonce: the
   server's idempotency key is nonce + bag, and Stripe refuses a key
   reused with a different amount — which a code applied after the
   intent existed used to hit.                                       */
function dropIntent() {
  try { sessionStorage.removeItem(NONCE); } catch (e) {}
  state.pi = null;
  state.elements = null;
  state.parts = {};
  state.cartSig = null;
  state.prepError = null;
  state.addressComplete = state.paymentComplete = false;
  state.taxState = 'idle';
  state.taxKey = null;
}

async function prepare() {
  if (state.creating) return;
  const items = cartManager.getItems();
  if (!items.length) return;
  const sig = signature(items);
  const code = state.promo?.code || null;

  state.creating = true;
  let again = false;
  try {
    // Only identifiers and quantities are sent. Prices are resolved
    // server-side from the product catalogue — the client does not
    // get a say in what it is charged.
    const res = await createPaymentIntent({
      checkoutSession: checkoutSessionNonce(),
      promoCode: code,
      items: items.map(i => ({
        productId: i.productId,
        size: i.size ?? null,
        gender: i.gender ?? null,
        quantity: i.quantity || 1
      }))
    });

    // The bag or the code changed while we waited: that answer prices
    // something nobody is buying any more. Ask again for what is there.
    if (signature(cartManager.getItems()) !== sig || (state.promo?.code || null) !== code) {
      dropIntent();             // that nonce has an intent now; the next one needs its own
      again = true;
      return;
    }

    const data = res.data || {};
    if (!res.ok || !data.clientSecret) {
      // Offline or a timeout means the request never got an answer — say so.
      // A 4xx is something the shopper can act on ("that piece just sold
      // out"), so pass it through. A 5xx is ours to apologise for — never
      // show the shopper a raw server message.
      throw new Error(
        res.offline ? 'We could not reach checkout. Check your connection and try again.'
        : res.timeout ? 'Checkout is taking too long to answer. Please try again.'
        : (res.status < 500 && typeof data.error === 'string') ? data.error
        : 'Checkout is briefly unavailable. Please try again in a moment.'
      );
    }

    // The API answers with its own view of the bag (amount,
    // subtotalCents, items). From here on that is what we display —
    // it is what the card will actually be charged.
    const priced = typeof data.amount === 'number'
      ? {
          subtotalCents: data.subtotalCents ?? data.amount,
          totalCents: data.amount,
          discountCents: data.discountCents || 0,
          discountPercent: data.discountPercent || 0
        }
      : null;

    // A code the server would not honour is worth saying out loud once, here,
    // rather than leaving a shopper to wonder where their discount went.
    if (data.promoReason) {
      state.promoNote = PROMO_REFUSALS[data.promoReason] || 'That code was not accepted.';
      if (data.promoReason !== 'NO_ELIGIBLE_ITEMS' && data.promoReason !== 'EMPTY_CART') {
        clearPromo();
        state.promo = null;
      }
      toast(state.promoNote, 'notice');
      redrawPromo();
    } else if (data.discountCents > 0) {
      state.promoNote = null;
    }

    const before = totals(items);
    state.pi = { clientSecret: data.clientSecret, paymentIntentId: data.paymentIntentId, totals: priced };
    const after = totals(items);

    // Both subtotals come from the same catalogue, so a mismatch means a price
    // moved while the bag was open. Never quietly charge a different number than
    // the one the shopper was looking at. A discount the bag already showed is
    // not news: it used to toast "Prices updated" for the shopper's own code
    // (24 Oct 2026). Only a total that went UP past the bag's figure is said.
    if (priced && before.subtotal !== after.subtotal) {
      toast(`Prices updated — your total is now ${price(after.total, moneyParts(after, items).total)}.`, 'notice');
    } else if (priced && after.total > before.total) {
      toast(`Your discount came to ${price(after.discount)} — your total is ${price(after.total, moneyParts(after, items).total)}.`, 'notice');
    }
    state.cartSig = sig;
    updateMoney();
    mountStripe();
  } catch (err) {
    console.error('checkout init failed:', err);
    state.prepError = err.message || 'Could not start checkout. Please try again.';
    showPrepFailure();
  } finally {
    state.creating = false;
    refreshReady();
    if (again) render();
  }
}

function showPrepFailure() {
  const host = document.getElementById('co-payment-element');
  if (!host) return;
  host.innerHTML = `
    <div class="co-failure">
      <span class="material-icons">error_outline</span>
      <p>${esc(state.prepError || 'We could not load the payment form.')}</p>
      <button type="button" id="co-retry">Try again</button>
    </div>`;
  document.getElementById('co-retry').addEventListener('click', () => {
    state.prepError = null;
    host.innerHTML = '<div class="co-skeleton"><i></i><i></i><i></i></div>';
    prepare();
  });
}

/* Stripe's fields wear the page's palette, read from the tokens, and change with
   it: switching the theme after the form appeared used to leave it in the old one. */
function appearance() {
  const dark = document.documentElement.classList.contains('dark-theme');
  const css = getComputedStyle(document.body);
  const token = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
  return {
    theme: dark ? 'night' : 'stripe',
    variables: {
      colorPrimary: token('--gold', '#8b6f3a'),
      colorBackground: token('--surface-2', dark ? '#141613' : '#ffffff'),
      colorText: token('--fg', dark ? '#f5efe2' : '#1a1815'),
      colorTextSecondary: token('--muted', '#4d4740'),
      colorDanger: token('--co-danger', '#a83826'),
      fontFamily: "'Josefin Sans', Arial, sans-serif",
      spacingUnit: '4px',
      borderRadius: '10px'
    },
    rules: {
      '.Label': { fontSize: '12px', fontWeight: '500', letterSpacing: '0.04em', marginBottom: '7px' },
      '.Input': { border: `1px solid ${token('--co-input-border', 'rgba(26,24,21,0.45)')}`, padding: '12px 14px' },
      '.Input:focus': {
        border: `1px solid ${token('--gold', '#8b6f3a')}`,
        boxShadow: `0 0 0 3px ${dark ? 'rgba(212,182,132,0.20)' : 'rgba(139,111,58,0.18)'}`
      },
      '.Tab': { border: `1px solid ${token('--line', 'rgba(26,24,21,0.12)')}` },
      '.Tab--selected': { borderColor: token('--gold', '#8b6f3a') }
    }
  };
}
new MutationObserver(() => { try { state.elements?.update({ appearance: appearance() }); } catch (_) {} })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

function mountStripe() {
  if (!state.pi || state.elements) return;

  const host = document.getElementById('co-payment-element');
  const addressHost = document.getElementById('co-address-element');
  const emailHost = document.getElementById('co-email-element');
  if (!host || !addressHost || !emailHost) return;

  try {
    state.stripe = state.stripe || Stripe(STRIPE_KEY);
    state.elements = state.stripe.elements({
      clientSecret: state.pi.clientSecret,
      appearance: appearance(),
      fields: { billingDetails: { address: 'auto' } }
    });

    // The phone rides with the address it belongs to, optional, instead of a
    // field of its own; a re-made form (new bag, new code) keeps what was typed.
    const kept = state.address;
    const addressElement = state.elements.create('address', {
      mode: 'shipping',
      allowedCountries: ['US'],
      fields: { phone: 'always' },
      validation: { phone: { required: 'never' } },
      ...(kept ? { defaultValues: { name: kept.name, phone: kept.phone, address: kept.address } } : {})
    });
    const paymentElement = state.elements.create('payment');
    // The email field is Stripe's Link one. Our own input used to sit here, and
    // Link's "save my info" box then asked for the same email again (24 Oct 2026).
    const linkAuth = state.elements.create('linkAuthentication',
      state.email ? { defaultValues: { email: state.email } } : {});

    host.innerHTML = '';
    linkAuth.mount(emailHost);
    addressElement.mount(addressHost);
    paymentElement.mount(host);
    state.parts = { email: linkAuth, address: addressElement, payment: paymentElement };

    addressElement.on('change', (e) => {
      state.addressComplete = e.complete;
      if (e.value) state.address = e.value;
      if (e.complete && e.value && e.value.address) scheduleTax(e.value.address);
      else if (state.taxState !== 'disabled') { state.taxState = 'idle'; setTaxRow(null); }
      refreshReady();
    });
    paymentElement.on('change', (e) => { state.paymentComplete = e.complete; refreshReady(); });
    linkAuth.on('change', (e) => {
      state.email = (e.value && e.value.email || '').trim();
      state.emailValid = !!e.complete && validEmail(state.email);
      refreshReady();
    });
  } catch (err) {
    console.error('stripe mount failed:', err);
    state.elements = null;
    host.innerHTML = `
      <div class="co-failure">
        <span class="material-icons">error_outline</span>
        <p>We could not load the payment form. Check your connection and try again.</p>
        <button type="button" onclick="location.reload()">Retry</button>
      </div>`;
  }
}

/* ── Ready, and what is still missing ────────────────────────────
   Pay never greys out. A grey button says "no" without saying why;
   pressed early it marks Stripe's own fields and takes the shopper to
   the first thing left to fill in.                                   */
function missing() {
  const m = [];
  if (!state.emailValid) m.push('email');
  if (!state.addressComplete) m.push('address');
  if (!state.paymentComplete) m.push('payment');
  return m;
}
const taxSettled = () => state.taxState === 'ok' || state.taxState === 'disabled';
const isReady = () => !!state.elements && !missing().length && taxSettled();

function refreshReady() {
  const ready = isReady();
  for (const b of [document.getElementById('co-primary'), document.getElementById('co-sticky-btn')]) {
    if (!b) continue;
    b.classList.toggle('is-waiting', !ready);
    b.disabled = state.paying;
  }

  const hint = document.getElementById('co-ready-hint');
  if (!hint) return;
  const words = { email: 'your email', address: 'a delivery address', payment: 'card details' };
  const m = missing().map(k => words[k]);
  let text = '';
  if (!state.elements) text = state.prepError ? '' : 'Getting secure payment ready…';
  else if (m.length) text = `Add ${m.join(', ').replace(/, ([^,]*)$/, ' and $1')} to pay.`;
  else if (state.taxState === 'pending') text = 'Working out sales tax…';
  else if (state.taxState === 'error') text = 'Sales tax could not be worked out for that address.';
  hint.textContent = text;
}

async function pay() {
  if (state.paying) return;
  if (isReady()) return submitPayment();
  if (!state.elements) {
    if (state.prepError) { state.prepError = null; render(); }
    return;
  }
  // Stripe draws its own "incomplete" messages on its fields; then go there.
  try { await state.elements.submit(); } catch (_) {}
  const first = missing()[0] || (state.taxState === 'error' ? 'address' : null);
  if (!first) return;          // only the tax figure is outstanding; the hint says so
  const host = document.getElementById({ email: 'co-email-element', address: 'co-address-element', payment: 'co-payment-element' }[first]);
  host?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  try { state.parts[first]?.focus(); } catch (_) {}
}

/* ── Sales tax ────────────────────────────────────────────────────
   Computed by the server from the shipping address, which is only
   known once the Address Element is complete; the intent's amount is
   updated there too. Debounced, and stale responses are discarded.   */
function scheduleTax(address) {
  clearTimeout(state.taxTimer);
  state.taxTimer = setTimeout(() => calculateTax(address), 350);
}

/** The tax cell holds words ("Calculating…") or an amount in US cents (a number). */
function setTaxRow(value, pending = false) {
  const row = document.getElementById('co-tax-row');
  const cell = document.getElementById('co-tax');
  if (!row || !cell) return;
  row.classList.toggle('is-pending', !!pending || value == null);
  if (typeof value === 'number') paint(cell, value);
  else label(cell, value == null ? 'From your address' : value);
}

function updateMoney() {
  const t = totals(cartManager.getItems());
  const parts = moneyParts(t, cartManager.getItems());
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  paint(document.getElementById('co-subtotal'), t.subtotal, parts.subtotal);
  paint(document.getElementById('co-total'), t.total, parts.total);
  const charge = document.getElementById('co-charge');
  if (charge) { charge.dataset.chargeCents = String(t.total); repaint(charge.parentElement); }
  stickyNote(t, parts.total);
  const dRow = document.getElementById('co-discount-row');
  if (dRow) {
    dRow.hidden = !(t.discount > 0);
    paint(document.getElementById('co-discount'), -t.discount);
    dRow.firstElementChild.textContent = t.discountPercent ? `Discount · ${t.discountPercent}%` : 'Discount';
  }
  if (t.taxKnown) setTaxRow(t.tax > 0 ? t.tax : 'None for this address');
  if (!state.paying) {
    set('co-primary', `Pay ${money(t.total)}`);
    set('co-sticky-btn', `Pay ${money(t.total)}`);
  }
}

async function calculateTax(address) {
  if (!state.pi) return;
  const key = JSON.stringify(address);
  if (key === state.taxKey && (state.taxState === 'ok' || state.taxState === 'disabled')) return;
  state.taxKey = key;
  state.taxState = 'pending';
  setTaxRow('Calculating…', true);
  refreshReady();

  try {
    const res = await requestTax({ paymentIntentId: state.pi.paymentIntentId, address });
    const data = res.data || {};
    if (key !== state.taxKey || !state.pi) return;        // address or bag changed meanwhile
    if (res.offline || res.timeout) {
      throw new Error(res.offline
        ? 'We could not reach the tax service. Check your connection and try again.'
        : 'The tax service is taking too long to answer. Please try again.');
    }

    // No such route yet = tax feature not deployed. Treat as off rather
    // than stranding the shopper on a button that can never enable.
    if (res.status === 404 || data.enabled === false) {
      state.taxState = 'disabled';
      state.pi.totals = { ...state.pi.totals, taxCents: 0,
        totalCents: typeof data.totalCents === 'number' ? data.totalCents : state.pi.totals.totalCents };
      // (The server's total already has any discount taken off; the discount
      // line itself stays as checkout first priced it.)
      updateMoney();
      refreshReady();
      return;
    }
    if (!res.ok) {
      throw new Error('We could not calculate sales tax for that address. Please check it and try again.');
    }
    state.taxState = 'ok';
    // Keep the discount line: the tax answer adds tax to the discounted total, it
    // does not replace the pricing. Replacing it hid the discount row (24 Oct 2026).
    state.pi.totals = { ...state.pi.totals, subtotalCents: data.subtotalCents, taxCents: data.taxCents, totalCents: data.totalCents,
      discountCents: typeof data.discountCents === 'number' ? data.discountCents : state.pi.totals.discountCents };
    updateMoney();
    // The server changed the PaymentIntent's amount. Elements caches it,
    // so without this the payment form keeps showing (and some wallet
    // buttons keep offering) the pre-tax figure.
    try { await state.elements.fetchUpdates(); } catch (e) { console.warn('fetchUpdates:', e); }
  } catch (err) {
    if (key !== state.taxKey) return;
    console.error('tax calculation failed:', err);
    state.taxState = 'error';
    setTaxRow('Unavailable');
    toast(err.message || 'We could not calculate sales tax for that address. Please check it and try again.', 'error');
  }
  refreshReady();
}

/* ── Confirm ─────────────────────────────────────────────────── */

async function submitPayment() {
  if (!state.stripe || !state.elements || !isReady()) return;

  const customerEmail = state.email;
  const phone = (state.address && state.address.phone || '').trim() || null;
  const setButtons = (label) => {
    for (const id of ['co-primary', 'co-sticky-btn']) {
      const b = document.getElementById(id);
      if (b) { b.disabled = state.paying; b.textContent = label; }
    }
  };
  const restore = () => {
    state.paying = false;
    setButtons(`Pay ${money(totals(cartManager.getItems()).total)}`);
    refreshReady();
  };

  state.paying = true;
  setButtons('Processing…');

  // Contact details are recorded here — when the shopper has actually
  // typed them, not at render time. There is no consent checkbox: the
  // address is needed to ship the order, so it was never a real choice,
  // and the privacy policy now says exactly what is kept and for how long.
  // This must succeed BEFORE we take the money. The webhook writes the
  // order from the payment intent, and that is where the address and phone
  // used to pack and ship it come from. Previously a non-OK response was
  // ignored entirely — only a thrown fetch was caught — so a rejected or
  // 500'd contact update still went on to charge the card, leaving an order
  // nobody could ship. Stripe's receipt_email is a fallback for the receipt,
  // not a substitute for fulfilment details.
  try {
    const contactRes = await updateContact({
      paymentIntentId: state.pi.paymentIntentId,
      email: customerEmail,
      phone
    });
    if (!contactRes.ok) {
      const body = contactRes.data || {};
      throw new Error(body.message || body.error || `Contact update failed (${contactRes.status || 'no response'})`);
    }
  } catch (err) {
    console.error('could not attach contact details:', err);
    toast('We could not save your contact details, so we have not taken payment. Check your email address and try again.', 'error');
    restore();
    return;
  }

  const { error } = await state.stripe.confirmPayment({
    elements: state.elements,
    confirmParams: {
      return_url: `${location.origin}/order-success`,
      receipt_email: customerEmail,
      payment_method_data: {
        billing_details: {
          email: customerEmail,
          phone: phone || undefined
        }
      }
    }
  });

  if (error) {
    console.error('payment error:', error);
    toast(declineCopy(error), 'error');
    restore();
  }
}

/* ── Boot ────────────────────────────────────────────────────────
   Subscribed to cart changes only. The old page also re-rendered on
   a debounced window resize, and rendering created a payment
   intent — so resizing the window spent Stripe objects.           */
mountCurrencySwitch(document.querySelector('.site-footer'), 'is-footer');
cartManager.subscribe(render);
render();
