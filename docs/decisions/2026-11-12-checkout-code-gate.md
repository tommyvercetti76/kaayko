# 2026-11-12 · Checkout opens only with a code, until Stripe is live

**Decision (Rohan, 12 Nov 2026):** "Block on cart: make sure they enter a CODE to begin
checkout. This is temporary until I fix Stripe."

**Why.** The Kaayko Scouts thank-you (a one-use 20% code on approval) was proven end to end on
production the same morning, and Rohan wants to announce Scouts as live. The store still runs
on Stripe TEST keys (`pk_test` in `src/js/prod-config.js`), so a shopper off the street cannot
pay. Rather than show a payment form nobody can finish, the bag works and Pay stays shut until a
code applies: Scouts can see their 20% land; everyone else sees why checkout is closed.

**What it does.**
- Cart (`js/pages/cart.js`): while `checkoutNeedsCode` is on in `js/site-features.js` and no
  code is applied, the payment form's place shows "Checkout opens with a code for now. Kaayko
  Scouts get one when their spot goes live; type it under the total." with an *Enter my code*
  button, the code field is open, the hint under Pay says "Enter your code to pay.", and Pay
  leads to the field. No payment intent is requested. A valid code lifts the gate at once; Remove
  closes it again.
- API (`config/checkoutGate.js`, `createPaymentIntent`): with `CODE_REQUIRED` on, an order
  starts only when a code or a patron price actually took something off; otherwise 403
  `CODE_REQUIRED` with the same sentence. A Scout code on a bag of only a maker's pieces takes
  nothing off (cart scope), so it does not open checkout. Tested in
  `__tests__/checkout-code-gate.test.js`; every other suite runs with the gate off (`setup.js`).

**To end it (both halves):** `checkoutNeedsCode: false` in `site-features.js` + deploy hosting;
`CODE_REQUIRED` false in `checkoutGate.js` (or env `CHECKOUT_CODE_REQUIRED=false`) + deploy
`functions:api`. GAPS.md carries the owner row.

**Checked:** local no-store server at 375: gate shown, no `createPaymentIntent` request; the
real Scout code applied → 20% off and the payment form requested; Remove → gate back. API suite
98/98 (1535 tests). Production after the deploy: kaay.store/cart at phone width, both sites' home
and store pages, browser-check.
