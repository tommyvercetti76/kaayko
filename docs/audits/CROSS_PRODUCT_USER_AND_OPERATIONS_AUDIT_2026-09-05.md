# Kaayko Plus Kaay Store Cross-Product Audit

Date: 2026-09-05
Lens: one person who may want to use both Paddling Out and kaay.store.

## Executive Verdict

The combined idea is coherent: Paddling Out earns trust by helping someone decide where and when to paddle; kaay.store can then sell the gear/artifacts around that lifestyle. But the current experience does not yet feel like one product family.

Paddling Out Forecast is the strongest visual and trust anchor. kaay.store checkout is the strongest backend/operations surface. The weak points are the exact places where a user most needs confidence: rating a lake, adding their own lake, getting through the store gate, and knowing a real purchase will produce a receipt and shippable order.

## Cross-Product Journey

Current likely journey:

1. User visits Paddling Out to check a lake.
2. Forecast gives a clear condition score and feels polished.
3. User sees "Rate" on a lake card and lands in trainer, where some nested API-backed features are missing.
4. User may try Add Lake and is told the lake will go live in 2 days, but backend requires admin validation.
5. User goes to kaay.store and meets an invite gate with client-side invite codes and hostile failure copy.
6. If they pass the gate, product browse/detail/cart/checkout are functionally connected.
7. If they buy in test mode, the backend path is designed to create payment, receipt, admin notification, order records, and fulfillment actions.

The products can work together, but they currently send mixed signals:

- Paddling Out Forecast says "careful, useful, safety-aware".
- Rate/trainer says "unfinished nested feature".
- Add Lake copy says "automatic public submission", while backend says "admin review".
- Store checkout says "serious payment system".
- Store gate failure copy says "inside joke before trust".

## Shared Trust Findings

### P0 - Do Not Combine Public Launch With Real Money Until Store P0s Are Fixed

The store has a sound backend design, but live real-money launch requires:

- live Stripe config across frontend key, backend secret, webhook secret, tax mode, and dashboard webhook destination;
- legal placeholders removed;
- SMTP secret verified;
- one full purchase/receipt/admin/fulfillment smoke run.

Until then, Paddling Out can continue as a public utility, but store purchase should remain test/sandbox or invite-only.

### P0/P1 - "Rate" Must Become One Clear Product

Right now there are two rating surfaces:

- `/paddlingout/rate?id=...` is legacy but posts to `/paddleScore/publicRating`.
- `/paddlingout/trainer?lake=...` is the main card CTA, but its frontend calls endpoints not implemented by the current backend.

For a combined user, "Rate" should be a lightweight, beautiful public contribution flow. Model-training/admin tools should be separate and authenticated.

Recommended product split:

- Public: "Rate today's paddle" -> forecast-style page -> 1-5 rating, condition chips, optional notes, optional location verification.
- Admin/model: "Trainer" -> authenticated or clearly internal -> scenarios, export, reset, model diagnostics.

### P1 - "Add Your Own Lake" Needs A Trustworthy Contract

A user who contributes a lake is doing unpaid work for the product. The app must tell the exact truth:

- If admin review is required, say "We review it before it goes live."
- If a 2-day publication promise exists, backend must actually set and honor `goLiveAt`.

The current backend is safer than the copy. Keep the backend model and fix the promise.

### P1 - Store Gate Tone Should Match The Paddling Product

The Paddling pages are helpful and careful. The store access failure state is sarcastic and can feel hostile to a legitimate buyer.

Recommended tone:

- precise;
- confident;
- short;
- no insults;
- one request-access path.

Example: "That code did not open the store. Check the spelling or request access."

## UX Continuity Recommendations

### Forecast And Rate

Use Forecast as the source of truth for Rate aesthetics:

- same full dark surface and gold highlight;
- same lake image and location identity;
- same score language;
- same data density and spacing;
- mobile-first rating controls;
- explicit, opt-in GPS.

### Paddling Out And Store

Do not force commerce into safety decisions. Use light, contextual bridges:

- Forecast page: after the safety/conditions content, show a quiet "Paddle goods" link or footer module.
- Order success page: after payment success, offer a soft return path such as "Check tomorrow's paddle conditions".
- Store product pages: avoid claiming paddling safety benefits unless the product is actually safety gear.

### Admin Operations

Kortex is becoming the shared operations console:

- Orders tab handles fulfillment.
- Products tab handles pricing/availability.
- Submissions tab handles lakes.

That is good. The next step is an operations health strip:

- unpaid/failed payments;
- orders missing address;
- mail docs in `ERROR` or stale `RETRY`;
- pending lake submissions;
- rejected/validated counts;
- trainer API health if trainer remains public.

## Launch Scorecard

| Area | Status | Why |
|---|---|---|
| Paddling Out directory | Ready-ish | Live 17 spots, scores available. |
| Paddling Out forecast | Strong | Best frontend surface; API connected. |
| Paddling Out search | Needs fix | API connected, but `isSearching` can lock the UI. |
| Add Lake | Backend ready, copy not ready | Upload/admin flow exists; user promise mismatches. |
| Public Rate | Not ready | CTA goes to trainer, legacy rate has submit/trust gaps. |
| Trainer | Not ready as public nested feature | Multiple frontend-called endpoints missing. |
| Store browse | Functional | Products API live with 30 products. |
| Store checkout | Architecturally strong, launch-blocked | Test Stripe key, legal/mail ops need final verification. |
| Store admin fulfillment | Strong with one UI bug | Order status/shipping path exists; delay notice UI response mismatch. |
| Cross-product trust | Needs polish | Tone, promises, and aesthetics differ too much. |

## Shared No-Leak Summary

Good:

- Store order/payment/mail collections are blocked from direct client reads.
- Store admin APIs require platform admin auth.
- Checkout origin guard blocks unknown origins.
- Paddling admin submission API requires auth/admin.
- Paddling public list does not return submitter contact emails.

Needs work:

- Public paddle rating stores raw IP.
- Public rating/batch endpoints use spoofable `x-forwarded-for`.
- Store invite codes are client-side and should not be described as security.
- Mail queue contains buyer PII and needs retention/deployment verification.

## Combined Acceptance Plan

1. Fix Store P0s: legal placeholders, Stripe mode decision, SMTP verification.
2. Fix Add Lake copy to match admin-review-only publication.
3. Fix Search `isSearching` cleanup.
4. Fix or reroute Rate so the public CTA lands on a complete API-backed page.
5. Replace store gate failure copy and normalize support emails.
6. Run a complete test-mode purchase:
   - buyer payment;
   - customer receipt;
   - admin receipt;
   - Kortex order appears;
   - admin marks shipped;
   - shipping email sends;
   - refund/dispute behavior checked.
7. Run a complete lake submission:
   - submit with image;
   - admin sees submission;
   - approve;
   - lake appears publicly;
   - forecast resolves;
   - reject path deletes images.
8. Only then decide whether to expose kaay.store publicly, keep it invite-only, or link it from Paddling Out.


---

# Resolution Notes — 5 September 2026

See the per-product audits in this folder for the full change lists. Cross-cutting
outcomes only here.

## Completed

**"Rate" is now one product.** The lake-card CTA goes to `/paddlingout/rate`, a
page that only calls endpoints that exist. Trainer keeps its unimplemented
endpoints but has no public entry point and is `noindex`. The split surface the
audit describes is resolved in favour of the public flow.

**Add Lake tells the truth.** All auto-go-live copy is gone; both success variants
say the entry is queued for human review. The backend model did not change — the
promise did.

**Store gate tone now matches the paddling product.** Fourteen insults across two
files replaced with three neutral hints and one request-access path.

**Trust states are honest across both products.** Rate no longer shows a
thank-you when the server rejected the rating; checkout no longer charges when the
contact update failed. In both cases the user is told what happened and can retry.

**Operations console gained the missing signal.** Kortex Orders now shows mail in
`ERROR`/stale `RETRY`, which was the one fulfilment failure invisible from the
order list — an order reads "shipped" whether or not the confirmation arrived.

## Deliberately not done

**No commerce was pushed into safety surfaces.** The audit's optional "light
bridges" (a Paddle goods link on Forecast, a conditions link on order-success)
were not added. They are additive marketing, the primary task on each page is
unfinished business elsewhere, and adding them now would trade trust for a link.
Available whenever wanted.

**Rate was not visually rebuilt.** It already uses `forecast.css`'s exact tokens —
the design language was aligned before this pass. The real gaps (auto-GPS, no
score context, dishonest failure) are closed. See the Paddling Out notes.

## Combined acceptance plan — status

| Step | Status |
|---|---|
| 1. Store P0s: legal, Stripe mode, SMTP | **Owner-required.** Documented, not guessed. |
| 2. Add Lake copy matches approve-to-publish | Done |
| 3. Search `isSearching` cleanup | Done |
| 4. Rate CTA lands on a complete API-backed page | Done |
| 5. Gate copy + support email normalised | Done (address value owner-confirmed) |
| 6. Full test-mode purchase run | **Not run.** Needs a real card session. |
| 7. Full lake submission run | **Not run.** Needs a real upload. |
| 8. Decide kaay.store public vs invite-only | **Owner decision.** Currently noindex + canonical to kaayko.com/store. |
