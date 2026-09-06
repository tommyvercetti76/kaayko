# Kaayko Plus Kaay Store Cross-Product Audit

Date: 2026-09-05
Lens: one person who may want to use both Paddling Out and kaay.store.

## Executive Verdict

The combined product idea is coherent: Paddling Out earns trust by helping
someone decide where and when to paddle; kaay.store can then sell the goods
around that lifestyle. The strongest product surfaces are Paddling Out Forecast
and the Store checkout/fulfillment backend.

The first audit pass found trust breaks in the exact places where a user needs
confidence: rating a lake, adding a lake, entering the store, and knowing payment
will create a receipt and shippable order. The current working tree resolves the
main UI/API mismatches:

- public Rate now uses `/paddlingout/rate`, not the partial trainer app;
- Add Lake copy now says admin review, not automatic 2-day publication;
- Search can run repeatedly without staying locked;
- Rate only shows success after the backend accepts the rating;
- store gate copy is neutral;
- checkout blocks payment if buyer contact details cannot be saved;
- admin delay notices read the backend response correctly;
- Kortex Orders shows mail queue health.

The remaining launch blockers are not cosmetic. Live commerce still requires
owner-verified legal details, Stripe live-mode config, SMTP config, support
mailbox choice, mail redrive/resend handling, and an actual end-to-end Stripe
test-mode purchase/receipt/fulfillment run.

## Current Cross-Product Journey

Expected journey after the working-tree fixes:

1. User visits Paddling Out to check a lake.
2. Forecast gives a clear condition score and polished place context.
3. User can rate today's paddle through `/paddlingout/rate?id=<spotId>`.
4. User can submit a lake and is told it will be reviewed before it appears.
5. User can visit kaay.store through invite/access UX that no longer insults them.
6. If they shop, product browse/detail/cart/checkout are connected to backend APIs.
7. In test mode, the backend path can create payment intent records, webhook-created orders, buyer/admin mail docs, and Kortex fulfillment state.

The products now send a more consistent signal:

- Paddling Out says "careful, useful, safety-aware."
- Add Lake says "we value your contribution and review it."
- Store checkout says "serious payment system."
- Store operations says "mail and fulfillment need to be observed."

## Shared Trust Findings

### P0 - Live Money Requires Owner Gating

Do not switch Store to live Stripe until all of this is true:

- frontend publishable key, backend secret key, webhook secret, webhook
  destination, and Stripe Tax mode are all in the same live environment;
- Terms contain real operator, mailing address, governing law, notice, and support details;
- `MAIL_SMTP_URL` and owner notification secrets are verified in Firebase;
- buyer support mailbox is chosen and monitored;
- stale `RETRY`/`ERROR` mail docs can be redriven or resent;
- one full test-mode purchase proves buyer receipt, admin receipt, Kortex order,
  mark-shipped, and shipping email.

Until then, Paddling Out can remain public, and Store should remain test-mode,
invite-only, noindex, or otherwise clearly non-live.

### P1 - Trainer Is Still Not A Public Feature

Public Rate has been separated from trainer. That resolves the user-facing route
break, but trainer itself remains partial:

- backend implements tourist lakes, tourist weather, and rating POST;
- trainer frontend still references admin/model endpoints that do not exist.

Decision needed: either rebuild trainer behind admin auth with all endpoints, or
retire/remove it from the public product. Do not route normal users there.

### P1 - Add Lake Needs End-To-End Proof

The copy and backend now agree on review-before-publication. The feature is not
fully accepted until someone runs the real flow:

- submit a lake with image;
- verify Kortex submissions receives it;
- approve and confirm it appears publicly;
- open its Forecast page;
- reject a second test and confirm Storage image cleanup.

### P1 - Store Operations Need Mail Recovery

Kortex now exposes mail health without leaking PII, which is a big operational
step. It still needs a recovery path for failed/stale mail: scheduled redrive,
manual resend controls, or both.

## UX Continuity Recommendations

### Forecast And Rate

Forecast remains the visual standard. Rate now uses the same dark/gold language,
shows the model call before asking the user to judge conditions, and makes GPS
verification opt-in. A fuller visual rebuild is optional, but any future Rate
work should preserve those truths.

### Paddling Out And Store

Do not force commerce into safety decisions. If cross-links are added, keep them
quiet and contextual:

- Forecast page: after conditions, a restrained "Paddle goods" link or footer module.
- Order success page: after payment success, a return path such as "Check tomorrow's paddle conditions."
- Store product pages: no safety claims unless the item is actually safety gear.

### Admin Operations

Kortex is the shared operations console:

- Orders tab handles fulfillment.
- Products tab handles pricing/availability.
- Submissions tab handles lakes.
- Orders now includes mail health.

Next useful shared health strip:

- unpaid/failed payments;
- orders missing address;
- failed/stale mail docs with resend/redrive action;
- pending lake submissions;
- rejected/validated lake counts;
- trainer API health if trainer remains installed.

## Launch Scorecard

| Area | Status | Why |
|---|---|---|
| Paddling Out directory | Ready-ish | Live public spots and scores available. |
| Paddling Out forecast | Strong | Best frontend surface; API connected. |
| Paddling Out search | Fixed in working tree | Search cleanup now runs after success/no-result/error paths. |
| Add Lake | Functionally ready, needs smoke | Copy matches admin review; real submit/approve/reject flow still needs proof. |
| Public Rate | Connected in working tree | Card CTA lands on API-backed rate page; failures remain honest. |
| Trainer | Not public-ready | Missing admin/model endpoints remain. |
| Store browse | Functional | Products API live with 30 products in audit sample. |
| Store checkout | Architecturally strong, launch-blocked | Test Stripe key, legal/mail/owner config and smoke purchase remain. |
| Store admin fulfillment | Stronger, needs smoke | Order status/shipping path exists; mail health now visible. |
| Cross-product trust | Improved, still needs owner decisions | Tone and promises are fixed; live money and trainer decisions remain. |

## Shared No-Leak Summary

Good:

- Store order/payment/mail collections are blocked from direct client reads.
- Store admin APIs require platform admin auth.
- Checkout origin guard blocks unknown origins.
- Paddling admin submission API requires auth/admin.
- Paddling public list does not return submitter contact emails.
- New public paddle rating labels store a hashed caller key instead of raw IP.
- Admin mail health returns counts and ids only, not recipients, addresses, subjects, or bodies.

Needs work:

- Store product votes still use spoofable first `x-forwarded-for`.
- Store mail queue contains buyer PII until retention removes it; deployment status and redrive path must be verified.
- Store invite codes are client-side and should never be described as security.
- Weather/scoring endpoints need rate limiting before high-volume public traffic.

## Combined Acceptance Plan

1. Finish Store P0s: legal placeholders, live/test Stripe decision, SMTP secret verification, support mailbox decision.
2. Add mail recovery: scheduled redrive, manual resend, or both.
3. Run a full test-mode purchase:
   - buyer payment;
   - customer receipt;
   - admin receipt;
   - Kortex order appears;
   - admin marks shipped;
   - shipping email sends;
   - refund/dispute behavior checked.
4. Run a full Add Lake submission:
   - submit with image;
   - admin sees submission;
   - approve;
   - lake appears publicly;
   - forecast resolves;
   - reject path deletes images.
5. Decide trainer fate: build missing endpoints behind admin auth or retire it.
6. Decide store exposure: public storefront, invite-only, or noindex/canonicalized companion shop.
