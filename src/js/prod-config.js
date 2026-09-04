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
window.KAAYKO_STRIPE_PK = "pk_test_51Sb3SXK1xkNVIdc56q3mvEy0TSv5Jr7iUOpZRucl6oAzO3Dgl0PI6b2WDz2kW4LmgSgPHKlCkIyHUmUB3jhRo1ra00ZPcK4faX";
