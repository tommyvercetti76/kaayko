/**
 * pages/order-success.js — the page Stripe returns to after a payment.
 * Reads the amount and receipt address back from Stripe (never from the URL or the
 * bag), clears the bag unconditionally, and never lets Back reach a stale checkout.
 */
import { cartManager } from '/js/cartManager.js';
import { money } from '/js/kit.js';
import { lookupOrder } from '/js/services/storeApi.js';

const STRIPE_KEY = window.KAAYKO_STRIPE_PK;

const params = new URLSearchParams(location.search);
const paymentIntentId = params.get('payment_intent');
const clientSecret = params.get('payment_intent_client_secret');
const redirectStatus = params.get('redirect_status');

// Send the shopper back to the bag rather than stranding them here.
if (redirectStatus && redirectStatus !== 'succeeded') {
  location.replace('/cart');
  throw new Error('payment not successful');
}
if (!paymentIntentId || !clientSecret) {
  location.replace('/store');
  throw new Error('missing payment confirmation');
}

// Back should return to the store, never to a stale checkout.
history.replaceState(null, '', location.pathname);
addEventListener('popstate', () => location.replace('/store'));

const set = (id, value) => { document.getElementById(id).textContent = value; };

set('ok-ref', 'Assigning…');
set('ok-date', new Date().toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric'
}));

// The order number is minted by the webhook a moment after Stripe confirms, so
// ask for it a few times. The Stripe id is never shown: if the number has not
// arrived after the polling window, the receipt carries it.
(async () => {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const r = await lookupOrder({ paymentIntentId, clientSecret });
      if (r.orderNumber) {
        set('ok-ref', r.orderNumber);
        const link = document.getElementById('ok-status');
        if (link && r.statusPath) { link.href = r.statusPath; link.hidden = false; }
        return;
      }
    } catch (err) {
      console.warn('order lookup:', err);
    }
    await new Promise((res) => setTimeout(res, 2500));
  }
  set('ok-ref', 'On your receipt');
})();

// The amount and receipt address are read back from Stripe rather
// than from the cart or a query string: the cart is only ever what
// the browser believed, and putting a customer's email in the URL
// leaks it into history, referrers and server logs.
// Stripe.js can throw SYNCHRONOUSLY on a malformed client secret, which
// would skip both .catch and .finally — leaving the summary blank and,
// far worse, the bag uncleared after a completed payment. The order is
// already paid at this point, so clearing must never depend on this
// lookup succeeding.
(async () => {
  try {
    const { paymentIntent } = await Stripe(STRIPE_KEY).retrievePaymentIntent(clientSecret);
    if (!paymentIntent) throw new Error('no payment intent returned');
    set('ok-total', money(paymentIntent.amount));   // Stripe amounts are integer cents
    set('ok-email', paymentIntent.receipt_email || 'your email');
  } catch (err) {
    console.warn('could not retrieve payment intent:', err);
    set('ok-total', 'See your receipt');
    set('ok-email', 'your email');
  }
})();

// Unconditional, and first — the payment succeeded regardless of what
// the lookup above does.
try { cartManager.clear(); } catch (err) { console.warn('cart clear failed:', err); }
