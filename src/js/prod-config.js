/**
 * Production Configuration Override
 * Force frontend to use production APIs even when running locally
 */

// Override the API_BASE constant to force production mode
window.FORCE_PRODUCTION_MODE = true;

// Set the correct production API URL
window.PRODUCTION_API_BASE = "https://api-vwcc5j4qda-uc.a.run.app";

console.log("🚀 PRODUCTION MODE FORCED - Using:", window.PRODUCTION_API_BASE);

/**
 * Stripe publishable key — safe to expose, it is client-side by design.
 *
 * Belongs to the "Kaayko Store sandbox" (acct_1Sb3SXK1xkNVIdc5). A
 * publishable key embeds its own account id after the `51`, so this must
 * come from the SAME Stripe environment as the STRIPE_SECRET_KEY and
 * STRIPE_WEBHOOK_SECRET held in Secret Manager. Mixing environments
 * fails at confirm time with a client-secret mismatch that reads like a
 * code bug. Change all three together or none.
 */
/* ─────────────────────────────────────────────────────────────────────────
   LIVE PURCHASES ARE BLOCKED. This is a TEST-mode publishable key, so the
   storefront cannot take real money, by design.

   Going live is FIVE changes that must happen TOGETHER. A live publishable key
   with a test secret (or a test webhook secret) fails at confirm time with a
   client-secret mismatch that reads like a code bug and is not one:

     1. window.KAAYKO_STRIPE_PK below            -> live pk_live_...
     2. STRIPE_SECRET_KEY (Secret Manager)        -> live sk_live_...
     3. STRIPE_WEBHOOK_SECRET (Secret Manager)    -> the LIVE endpoint's whsec_...
     4. Stripe dashboard webhook destination      -> pointed at the live endpoint,
        subscribed to payment_intent.succeeded, charge.refunded,
        charge.dispute.created, charge.dispute.closed
     5. Stripe Tax mode + home-state registration -> or STRIPE_TAX_ENABLED stays off

   All five belong to the SAME Stripe account. Do not flip one and test.

   Also still open before real money (see docs/audits/): Terms carry legal
   placeholders, and MAIL_SMTP_URL must exist or every receipt lands in ERROR.
   ───────────────────────────────────────────────────────────────────────── */
window.KAAYKO_STRIPE_PK = "pk_test_51Sb3SXK1xkNVIdc56q3mvEy0TSv5Jr7iUOpZRucl6oAzO3Dgl0PI6b2WDz2kW4LmgSgPHKlCkIyHUmUB3jhRo1ra00ZPcK4faX";
