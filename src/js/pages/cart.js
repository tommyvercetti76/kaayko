/**
 * pages/cart.js — the bag and the checkout (/cart).
 *
 * Moved out of cart.html on 12 Sep 2026. Money is integer cents end to end: the
 * bag stores priceCents, the server answers in cents, and money() is the only
 * place a figure becomes a string. The Stripe publishable key comes from
 * prod-config.js; prices are never sent — the server re-derives them from the
 * catalogue (kaayko-api/functions/api/checkout/pricing.js).
 */
import { cartManager } from '/js/cartManager.js';
import { savedReward, clearReward, checkCode, minutesLeft, clientToken, savePromo } from '/js/arcade/reward.js';
import { esc, money } from '/js/kit.js';
import { createPaymentIntent, calculateTax as requestTax, updateContact } from '/js/services/storeApi.js';
import { show as showToast } from '/js/components/Toast.js';

const STRIPE_KEY = window.KAAYKO_STRIPE_PK;

/* ── Checkout state ──────────────────────────────────────────────
   The payment intent is created ONCE, when the shopper actively
   continues to checkout — not on every render. The old page called
   initPayment() from renderCart(), which was itself wired to a
   cart subscription and a debounced resize handler, so a stray
   window resize minted a fresh Stripe PaymentIntent and a
   Firestore document.                                             */
// Must say the same thing as /legal/shipping — that page is the promise,
// this is the reminder.
const SHIP_TIME = 'Made to order · on its way within 10 business days';

const state = {
  step: 'bag',          // 'bag' | 'checkout'
  pi: null,             // { clientSecret, paymentIntentId, totals }
  elements: null,
  stripe: null,
  creating: false,
  cartSig: null,        // cart signature the current intent was priced for
  addressComplete: false,
  paymentComplete: false,
  emailValid: false,
  // Sales tax is computed server-side once the shipping address is
  // complete. Pay stays disabled until it is known — a shopper must never
  // be charged an un-taxed total while tax is nominally on.
  taxState: 'idle',     // 'idle' | 'pending' | 'ok' | 'disabled' | 'error'
  taxKey: null,         // address the current tax figure was computed for
  taxTimer: null,
  // A reward code won at a machine or at the Beggathon. Held here only so the
  // field can be pre-filled; the API re-checks it and decides what it is worth.
  reward: savedReward(),
  rewardNote: null      // why the last code was refused, in the shopper's words
};

/* ── Helpers ─────────────────────────────────────────────────── */
// esc() and money() come from kit.js. Cart contents come from localStorage and
// product titles from Firestore, so nothing is interpolated into HTML unescaped.

/** The checkout speaks in errors unless told otherwise. */
const toast = (message, kind = 'error') => showToast(message, { kind });

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
  if (item.size) parts.push(`Size ${esc(item.size)}`);
  return parts.join(' · ');
};

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/* ── Reward codes ────────────────────────────────────────────────
   Won at the Beggathon — on a product page or below the bag — for up
   to 10% off everything. (The machines and their 2% codes were retired
   on 13 Sep 2026; the 'eligible' scope below only outlives them by an
   hour, which is how long any code lasts.) Every
   code dies one hour after it is minted, used or not — that is the
   API's rule and the field below only reports it. The discount
   itself is computed by the server when the payment intent is
   created; nothing here takes a cent off on its own.               */
const REWARD_REFUSALS = {
  NO_SUCH_CODE:     'No such code.',
  ALREADY_REDEEMED: 'That code has already been used.',
  EXPIRED:          'That code has expired. They only last an hour.',
  WRONG_OWNER:      'That code was won under a different email.',
  NO_ELIGIBLE_ITEMS:'That code does not cover anything in this bag.',
  PROMO_INACTIVE:   'That code is no longer on offer.',
  EMPTY_CART:       'Nothing in the bag to discount.',
  LOCKED:           'No discount applies while you are carrying a paste penalty. Beg it off on any product page.',
  VOIDED:           'That code was won before you pasted. Pasting cancelled it.'
};

function rewardFieldMarkup() {
  const r = state.reward;
  const left = r ? minutesLeft(r) : 0;
  return `
    <div class="co-reward" id="co-reward">
      <label class="co-field-label" for="co-reward-input">Discount code <span class="co-opt">(optional)</span></label>
      <div class="co-reward-row">
        <input class="co-input" id="co-reward-input" type="text" inputmode="text"
               autocomplete="off" spellcheck="false" placeholder="KAY-XXXXX-XXXXX"
               value="${esc(r?.code || '')}" aria-describedby="co-reward-note" />
        <button type="button" class="co-reward-btn" id="co-reward-apply">${r ? 'Remove' : 'Apply'}</button>
      </div>
      <p class="co-reward-note" id="co-reward-note" role="status" aria-live="polite">${
        state.rewardNote ? esc(state.rewardNote)
        : r?.kind === 'promo' ? `${r.percent}% off${r.label ? ` ${esc(r.label)}` : r.scope === 'cart' ? ' the whole bag' : ' the pieces on that shelf'}. Taken off when you pay.`
        : r ? `${r.percent}% held${r.scope === 'cart' ? ' against the whole bag' : ' against the eligible items'}. ${
            left > 0 ? `Expires in ${left} minute${left === 1 ? '' : 's'}.` : 'Expired.'}`
        : 'Won one on a product page? Put it in. Codes last an hour.'
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
      surcharge: server.surchargeCents || 0,
      surchargePercent: server.surchargePercent || 0,
      taxKnown,
      total: server.totalCents,
      authoritative: true
    };
  }
  const subtotal = items.reduce((sum, i) => sum + (i.priceCents || 0) * (i.quantity || 1), 0);
  return { subtotal, tax: 0, discount: 0, discountPercent: 0, surcharge: 0, surchargePercent: 0,
           taxKnown: false, total: subtotal, authoritative: false };
}

/* ── Render ──────────────────────────────────────────────────── */

function render() {
  const root = document.getElementById('co-content');
  const items = cartManager.getItems();
  const sticky = document.getElementById('co-sticky');

  document.getElementById('co-count').textContent = items.length;

  if (items.length === 0) {
    root.innerHTML = `
      <div class="co-empty">
        <h2>Your bag is empty</h2>
        <p>Nothing here yet. Have a look at what is in the shop.</p>
        <a href="store"><span class="material-icons" style="font-size:18px">arrow_back</span> Back to store</a>
      </div>`;
    sticky.classList.remove('is-active');
    state.step = 'bag';
    state.pi = null;
    return;
  }

  // The bag changed underneath an intent priced for a different
  // bag — drop back to review so a correctly priced one is made.
  if (state.pi && state.cartSig !== signature(items)) {
    state.pi = null;
    state.elements = null;
    state.step = 'bag';
  }

  const t = totals(items);

  root.innerHTML = `
    <div class="co-masthead">
      <h1>Your bag</h1>
      <p>${items.length} ${items.length === 1 ? 'piece' : 'pieces'}, chosen well.</p>
    </div>
    <div class="co-layout">
      <section class="co-bag">
        <h2 class="co-label">Items</h2>
        ${items.map(itemMarkup).join('')}
        <p class="co-bag-note">A bag holds up to two pieces. ${SHIP_TIME}. Free US shipping, and 30 days to change your mind.</p>
      </section>

      <aside class="co-aside">
        <div class="co-card">
          <h2 class="co-label">Summary</h2>
          <div class="co-money">
            <div class="co-money-row"><span>Subtotal</span><span id="co-subtotal">${money(t.subtotal)}</span></div>
            <div class="co-money-row is-discount" id="co-discount-row" ${t.discount > 0 ? '' : 'hidden'}>
              <span>Discount${t.discountPercent ? ` · ${t.discountPercent}%` : ''}</span>
              <span id="co-discount">&minus;${money(t.discount)}</span>
            </div>
            <div class="co-money-row is-surcharge" id="co-surcharge-row" ${t.surcharge > 0 ? '' : 'hidden'}>
              <span>Paste penalty${t.surchargePercent ? ` &middot; ${t.surchargePercent}%` : ''}</span>
              <span id="co-surcharge">+${money(t.surcharge)}</span>
            </div>
            <div class="co-money-row"><span>Shipping</span><span>Free</span></div>
            <div class="co-money-row ${t.taxKnown ? '' : 'is-pending'}" id="co-tax-row"><span>Sales tax</span><span id="co-tax">${t.taxKnown ? money(t.tax) : 'Calculated from your address'}</span></div>
            <div class="co-money-row is-total"><span>Total</span><span id="co-total">${money(t.total)}</span></div>
          </div>

          ${rewardFieldMarkup()}

          <div class="co-step ${state.step === 'checkout' ? 'is-open' : ''}" id="co-step">
            <hr class="co-divider" />
            <h2 class="co-label">Contact</h2>
            <div class="co-fieldset">
              <div class="co-field">
                <label class="co-field-label" for="co-email">Email <span class="co-req">*</span></label>
                <input class="co-input" type="email" id="co-email" autocomplete="email"
                       inputmode="email" placeholder="you@example.com" required
                       aria-describedby="co-email-error" aria-invalid="false" />
                <div class="co-error" id="co-email-error" role="alert">Please enter a valid email</div>
              </div>
              <div class="co-field">
                <label class="co-field-label" for="co-phone">Phone <span class="co-opt">(optional)</span></label>
                <input class="co-input" type="tel" id="co-phone" autocomplete="tel"
                       placeholder="+1 (555) 123-4567" />
              </div>
            </div>

            <p class="co-legal" style="text-align:left;margin:0 0 4px">Your address and contact details are used to ship this order and are kept only as long as our <a href="/store/privacy">Privacy Policy</a> says.</p>

            <hr class="co-divider" />
            <h2 class="co-label">Shipping &amp; payment</h2>
            <div id="co-address-element"></div>
            <div id="co-payment-element">
              <div class="co-skeleton"><i></i><i></i><i></i></div>
              <p class="co-loading-note">Preparing secure payment…</p>
            </div>
          </div>

          <button id="co-primary" class="co-btn" ${state.step === 'checkout' ? 'aria-describedby="co-ready-hint"' : ''}>
            ${state.step === 'checkout' ? `Pay ${money(t.total)}` : `Continue · ${money(t.total)}`}
          </button>
          ${state.step === 'checkout' ? `
          <p class="co-ready-hint" id="co-ready-hint" aria-live="polite">Enter your email, shipping address and card details to pay.</p>
          <p class="co-legal">By placing this order you agree to our
            <a href="/legal/terms">Terms of Sale</a>,
            <a href="/legal/returns">Returns Policy</a> and
            <a href="/legal/shipping">Shipping Policy</a>.</p>` : ''}
          <p class="co-reassure">
            ${state.step === 'checkout'
              ? 'Payments are handled by Stripe. Card details never touch Kaayko servers.'
              : `${SHIP_TIME} · Free US shipping · 30-day returns`}
          </p>
        </div>
      </aside>
    </div>`;

  root.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => cartManager.removeItem(btn.dataset.remove));
  });

  wireRewardField();

  const primary = document.getElementById('co-primary');
  const stickyBtn = document.getElementById('co-sticky-btn');

  sticky.classList.add('is-active');
  stickyBtn.textContent = state.step === 'checkout' ? `Pay ${money(t.total)}` : `Continue · ${money(t.total)}`;
  const stickyMeta = document.getElementById('co-sticky-meta');
  if (stickyMeta) stickyMeta.innerHTML = state.step === 'checkout'
    ? 'By paying you agree to our <a href="/legal/terms">Terms</a>, <a href="/legal/returns">Returns</a> and <a href="/legal/shipping">Shipping</a> policies.'
    : 'Free US shipping · 30-day returns';

  if (state.step === 'bag') {
    primary.disabled = false;
    stickyBtn.disabled = false;
    primary.addEventListener('click', openCheckout);
    stickyBtn.onclick = openCheckout;
  } else {
    primary.disabled = true;
    stickyBtn.disabled = true;
    primary.addEventListener('click', submitPayment);
    stickyBtn.onclick = () => {
      document.getElementById('co-payment-element')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      submitPayment();
    };
    mountStripe();
  }
}

function itemMarkup(item, index = 0) {
  const meta = metaLine(item);
  const qty = item.quantity || 1;
  return `
    <article class="co-item" style="--co-i:${index}">
      <img class="co-item-image" src="${esc(item.imgSrc)}" alt="${esc(item.title)}"
           onerror="this.classList.add('is-broken')" />
      <div class="co-item-body">
        <h3 class="co-item-title">${esc(item.title)}</h3>
        <p class="co-item-meta">${meta}${meta ? '<br>' : ''}Quantity ${qty}</p>
      </div>
      <div class="co-item-side">
        <span class="co-item-price">${money((item.priceCents || 0) * qty)}</span>
        <button class="co-item-remove" data-remove="${esc(item.productId)}"
                aria-label="Remove ${esc(item.title)}">Remove</button>
      </div>
    </article>`;
}

function wireRewardField() {
  const input = document.getElementById('co-reward-input');
  const btn = document.getElementById('co-reward-apply');
  const note = document.getElementById('co-reward-note');
  if (!input || !btn) return;

  const apply = async () => {
    if (state.reward) {                       // the button reads Remove
      clearReward();
      state.reward = null;
      state.rewardNote = null;
      state.pi = null;                        // it was priced with the code
      state.step = 'bag';
      render();
      return;
    }
    const code = input.value.trim().toUpperCase();
    if (!code) return;
    btn.disabled = true;
    note.textContent = 'Checking…';
    const res = await checkCode(code);
    btn.disabled = false;

    if (!res?.success) { note.textContent = 'No such code.'; return; }
    if (res.kind === 'promo') {
      if (!res.valid) { note.textContent = res.expired ? 'That code has run out.' : REWARD_REFUSALS.PROMO_INACTIVE; return; }
      state.reward = { code, percent: res.percent, scope: res.scope, kind: 'promo', label: res.label || null, expiresAt: null };
      savePromo(state.reward);
      state.rewardNote = null; state.pi = null; state.step = 'bag';
      render();
      return;
    }
    if (res.expired)   { note.textContent = 'That code has expired. They only last an hour.'; return; }
    if (res.redeemed)  { note.textContent = 'That code has already been used.'; return; }
    if (res.voided)    { note.textContent = 'That code was won before you pasted. Pasting cancelled it.'; return; }
    if (res.locked)    { note.textContent = REWARD_REFUSALS.LOCKED; return; }

    state.reward = {
      code, percent: res.percent, scope: res.scope, game: res.game,
      expiresAt: Date.now() + (res.minutesLeft || 0) * 60000
    };
    try { localStorage.setItem('kaayko.arcade.reward', JSON.stringify(state.reward)); } catch (_) {}
    state.rewardNote = null;
    state.pi = null;
    state.step = 'bag';
    render();
  };

  btn.addEventListener('click', apply);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
}

/* ── Step 2: create the intent, then mount Stripe ─────────────── */

async function openCheckout() {
  if (state.creating) return;
  const items = cartManager.getItems();
  if (!items.length) return;

  state.creating = true;
  const primary = document.getElementById('co-primary');
  const stickyBtn = document.getElementById('co-sticky-btn');
  if (primary) { primary.disabled = true; primary.textContent = 'Preparing…'; }
  if (stickyBtn) { stickyBtn.disabled = true; stickyBtn.textContent = 'Preparing…'; }

  try {
    // Only identifiers and quantities are sent. Prices are resolved
    // server-side from the product catalogue — the client does not
    // get a say in what it is charged.
    function checkoutSessionNonce() {
      try {
        let n = sessionStorage.getItem('kaayko_checkout_session');
        if (!n) {
          n = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
            : 'cs-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
          sessionStorage.setItem('kaayko_checkout_session', n);
        }
        return n;
      } catch (e) { return ''; }   // no storage: server issues a fresh intent per call
    }
    const res = await createPaymentIntent({
      // One nonce per bag session: retries reuse the same PaymentIntent,
      // and no other shopper can ever derive the same key.
      checkoutSession: checkoutSessionNonce(),
      rewardCode: state.reward?.code || null,
      // The arcade token. The server reads its standing: a paste surcharge is
      // added here, and a code won before a strike stops counting.
      arcadeToken: clientToken(),
      items: items.map(i => ({
        productId: i.productId,
        size: i.size ?? null,
        gender: i.gender ?? null,
        quantity: i.quantity || 1
      }))
    });

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
          discountPercent: data.discountPercent || 0,
          surchargeCents: data.surchargeCents || 0,
          surchargePercent: data.surchargePercent || 0
        }
      : null;

    // A code the server would not honour is worth saying out loud once, here,
    // rather than leaving a shopper to wonder where their discount went.
    if (data.rewardReason) {
      state.rewardNote = REWARD_REFUSALS[data.rewardReason] || 'That code was not accepted.';
      if (data.rewardReason !== 'NO_ELIGIBLE_ITEMS' && data.rewardReason !== 'EMPTY_CART') {
        clearReward();
        state.reward = null;
      }
      toast(state.rewardNote, 'notice');
    } else if (data.discountCents > 0) {
      state.rewardNote = null;
    }

    const before = totals(items).total;
    state.pi = {
      clientSecret: data.clientSecret,
      paymentIntentId: data.paymentIntentId,
      totals: priced
    };
    const after = totals(items).total;

    // Both numbers come from the same catalogue, so a mismatch means
    // a price moved while the bag was open. Never quietly charge a
    // different number than the one the shopper was looking at.
    if (priced && before !== after) {
      toast(`Prices updated — your total is now ${money(after)}.`, 'notice');
    }
    state.cartSig = signature(items);
    state.step = 'checkout';
    state.addressComplete = state.paymentComplete = state.emailValid = false;
    state.taxState = 'idle'; state.taxKey = null;
    render();
    document.getElementById('co-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error('checkout init failed:', err);
    toast(err.message || 'Could not start checkout. Please try again.');
    state.step = 'bag';
    render();
  } finally {
    state.creating = false;
  }
}

function mountStripe() {
  if (!state.pi || state.elements) return;

  const host = document.getElementById('co-payment-element');
  const addressHost = document.getElementById('co-address-element');

  try {
    const dark = document.documentElement.classList.contains('dark-theme');
    const css = getComputedStyle(document.body);
    const token = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);

    state.stripe = Stripe(STRIPE_KEY);
    state.elements = state.stripe.elements({
      clientSecret: state.pi.clientSecret,
      appearance: {
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
      },
      fields: { billingDetails: { address: 'auto' } }
    });

    const addressElement = state.elements.create('address', {
      mode: 'shipping',
      allowedCountries: ['US']
    });
    const paymentElement = state.elements.create('payment');

    host.innerHTML = '';
    addressElement.mount(addressHost);
    paymentElement.mount(host);

    addressElement.on('change', (e) => {
      state.addressComplete = e.complete;
      if (e.complete && e.value && e.value.address) scheduleTax(e.value.address);
      else if (state.taxState !== 'disabled') { state.taxState = 'idle'; setTaxRow(null); }
      refreshReady();
    });
    paymentElement.on('change', (e) => { state.paymentComplete = e.complete; refreshReady(); });

    const email = document.getElementById('co-email');
    const emailError = document.getElementById('co-email-error');
    email.addEventListener('input', () => {
      const v = email.value.trim();
      state.emailValid = validEmail(v);
      const bad = v.length > 0 && !state.emailValid;
      email.classList.toggle('is-invalid', bad);
      email.setAttribute('aria-invalid', bad ? 'true' : 'false');
      emailError.classList.toggle('is-shown', bad);
      refreshReady();
    });
    email.focus();
  } catch (err) {
    console.error('stripe mount failed:', err);
    host.innerHTML = `
      <div class="co-failure">
        <span class="material-icons">error_outline</span>
        <p>We could not load the payment form. Check your connection and try again.</p>
        <button type="button" onclick="location.reload()">Retry</button>
      </div>`;
  }
}

function refreshReady() {
  const taxSettled = state.taxState === 'ok' || state.taxState === 'disabled';
  const ready = state.addressComplete && state.paymentComplete && state.emailValid && taxSettled;
  const primary = document.getElementById('co-primary');
  const stickyBtn = document.getElementById('co-sticky-btn');
  if (primary) primary.disabled = !ready;
  if (stickyBtn) stickyBtn.disabled = !ready;

  // Say what is still missing, in words, where a screen reader hears it.
  const hint = document.getElementById('co-ready-hint');
  if (hint) {
    const missing = [];
    if (!state.emailValid) missing.push('your email');
    if (!state.addressComplete) missing.push('a shipping address');
    if (!state.paymentComplete) missing.push('card details');
    let text = '';
    if (missing.length) text = `Enter ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')} to pay.`;
    else if (state.taxState === 'pending') text = 'Calculating sales tax…';
    else if (state.taxState === 'error') text = 'Sales tax could not be calculated for that address.';
    hint.textContent = text;
  }
}

/* ── Sales tax ────────────────────────────────────────────────────
   Computed by the server from the shipping address, which is only
   known once the Address Element is complete; the intent's amount is
   updated there too. Debounced, and stale responses are discarded.   */
function scheduleTax(address) {
  clearTimeout(state.taxTimer);
  state.taxTimer = setTimeout(() => calculateTax(address), 350);
}

function setTaxRow(label, pending = false) {
  const row = document.getElementById('co-tax-row');
  const cell = document.getElementById('co-tax');
  if (!row || !cell) return;
  row.classList.toggle('is-pending', !!pending);
  cell.textContent = label == null ? 'Calculated from your address' : label;
}

function updateMoney() {
  const t = totals(cartManager.getItems());
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('co-subtotal', money(t.subtotal));
  set('co-total', money(t.total));
  const dRow = document.getElementById('co-discount-row');
  if (dRow) {
    dRow.hidden = !(t.discount > 0);
    set('co-discount', `\u2212${money(t.discount)}`);
    dRow.firstElementChild.textContent = t.discountPercent ? `Discount \u00b7 ${t.discountPercent}%` : 'Discount';
  }
  const sRow = document.getElementById('co-surcharge-row');
  if (sRow) {
    sRow.hidden = !(t.surcharge > 0);
    set('co-surcharge', `+${money(t.surcharge)}`);
    sRow.firstElementChild.textContent = t.surchargePercent
      ? `Paste penalty \u00b7 ${t.surchargePercent}%` : 'Paste penalty';
  }
  if (t.taxKnown) setTaxRow(t.tax > 0 ? money(t.tax) : 'None for this address');
  const label = `Pay ${money(t.total)}`;
  const primary = document.getElementById('co-primary');
  const stickyBtn = document.getElementById('co-sticky-btn');
  if (primary && state.step === 'checkout' && !/Processing/.test(primary.textContent)) primary.textContent = label;
  if (stickyBtn && state.step === 'checkout' && !/Processing/.test(stickyBtn.textContent)) stickyBtn.textContent = label;
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
    if (key !== state.taxKey) return;                     // address changed meanwhile
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
      updateMoney();
      refreshReady();
      return;
    }
    if (!res.ok) {
      throw new Error('We could not calculate sales tax for that address. Please check it and try again.');
    }
    state.taxState = 'ok';
    state.pi.totals = { subtotalCents: data.subtotalCents, taxCents: data.taxCents, totalCents: data.totalCents };
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
  if (!state.stripe || !state.elements) return;

  const email = document.getElementById('co-email');
  const phone = document.getElementById('co-phone');
  const emailError = document.getElementById('co-email-error');
  const customerEmail = email.value.trim();

  if (!validEmail(customerEmail)) {
    email.classList.add('is-invalid');
    emailError.classList.add('is-shown');
    email.focus();
    return;
  }

  const primary = document.getElementById('co-primary');
  const stickyBtn = document.getElementById('co-sticky-btn');
  const restore = () => {
    const t = totals(cartManager.getItems());
    if (primary) { primary.disabled = false; primary.textContent = `Pay ${money(t.total)}`; }
    if (stickyBtn) { stickyBtn.disabled = false; stickyBtn.textContent = `Pay ${money(t.total)}`; }
  };

  if (primary) { primary.disabled = true; primary.textContent = 'Processing…'; }
  if (stickyBtn) { stickyBtn.disabled = true; stickyBtn.textContent = 'Processing…'; }

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
      phone: phone.value.trim() || null
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
          phone: phone.value.trim() || undefined
        }
      }
    }
  });

  if (error) {
    console.error('payment error:', error);
    toast(friendlyPaymentError(error), 'error');
    restore();
  }
}

/* ── Boot ────────────────────────────────────────────────────────
   Subscribed to cart changes only. The old page also re-rendered on
   a debounced window resize, and rendering created a payment
   intent — so resizing the window spent Stripe objects.           */
cartManager.subscribe(render);
render();
