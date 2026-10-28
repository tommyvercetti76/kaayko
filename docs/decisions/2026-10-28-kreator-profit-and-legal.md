# Kreator lessons and pieces: where we bleed money or court legal trouble

**Date:** 28 Oct 2026 · **Asked by:** Rohan ("critique it as a profit-making marketer … EXECUTE, record each decision")
**Launch case:** Rohan's own shop *Psycho Inc*, 30-minute one-to-one online "life lessons", $30.
**Shipped in:** kaayko-api and kaayko, 28 Oct 2026 (commits named at the end). Terms version **2026-10-28**.

Money figures use Stripe's published US list prices (card 2.9% + 30¢; Stripe Tax 0.5%; Connect
Express about $2 per active account per month plus 0.25% + 25¢ per payout). Check the real rates in
the Stripe account; the direction of every conclusion holds for any rates near these.

## What one $30 lesson earns Kaayko

| | |
|---|---|
| Commission (15%) | $4.50 |
| Card fee (2.9% + 30¢) | −$1.17 |
| Stripe Tax (0.5%) | −$0.15 |
| Payout fee on the $25.50 (0.25%) | −$0.06 |
| **Per sale** | **≈ $3.12** |
| Per Kreator per paid month (account $2 + 25¢ per payout) | −$2.25 |

A Kreator who sells one lesson a month earns Kaayko about 87¢. Volume per Kreator is the business;
everything below is about not losing that margin.

---

## Decisions

### 1. Kaayko's discount codes paid Kreators more than Kaayko took — FIXED
**Issue.** House codes (5, 10, 20 and 50%), store-wide promos and patron percents came off every line in
the bag, Kreator lines included, while the Kreator still earned 85% of the *full* price (Terms 3).
On a $30 lesson: a 50% code → buyer pays $15, card fee $0.74, Kreator $25.50 → **Kaayko loses $11.24**;
20% → loses $2.50; 10% → keeps 42¢. (`discounts.js` houseDiscount / promoDiscount / applyPatronPricing,
`createPaymentIntent.js` discountShares.)
**Decision.** Kaayko pays for its own discounts on its own pieces only (`discounts.housePiece`). House
codes, store-wide promos and patron prices skip Kreator lines; a bag of only Kreator lines gets
"That code does not cover anything in this bag". A promo the owner deliberately puts on one maker's
shop (`scope: 'store'`) still applies there, paid by Kaayko or by the maker (`fundedBy`). Seller Terms §3
now says so.
**Room.** If Kaayko wants to promote lessons, do it per shop with a capped store promo, or have the maker
fund it; never a whole-bag code. Revisit if a "Kaayko pays half" co-funded promo is ever wanted.

### 2. A listing could be priced at $1 — FIXED
**Issue.** The Kreator form and API accepted $1–$500 (the house editor's rule). Below about **$2.65** a sale
loses money after the card, tax and payout fees (15% − 2.9% − 0.5% − 0.25% of the price must cover the 30¢).
**Decision.** Kreator listings start at **$5** (`kreatorTerms.MIN_LISTING_CENTS`, enforced in
`kreatorProductRoutes`, shown on the form, Terms §3).
**Room.** Raise to $10 if refunds or support time per sale prove costly; Kaayko's own catalogue is untouched.

### 3. Small statements cost more to send than they earn — FIXED
**Issue.** Statements were drafted for any positive total. A $3 statement makes the Kreator a Stripe
"active account" that month ($2) plus 25¢ + 0.25%: Kaayko pays ~$2.26 to send $3.
**Decision.** A statement under **$25** carries to the next month while the shop is open; a closed or
suspended shop is paid whatever it is owed (`kreatorTerms.MIN_PAYOUT_CENTS`, `buildStatements`, Terms §4).
**Room.** Quarterly payouts for very small sellers would cut account fees further; not needed yet.

### 4. Kaayko's own shop called itself "independent" — FIXED
**Issue.** Psycho Inc is run by Kaayko's owner, but every listing, the shop banner and the bag said
"an independent maker/teacher". Telling buyers a seller is independent when it is the platform itself is
a misleading claim (FTC Act §5), and it undercuts every rating that shop gets.
**Decision.** A Kreator whose account is Kaayko platform staff (super-admin, or admin with platform scope;
never the self-serve Kortex admin) is labelled **"run by the Kaayko team"** everywhere (`products.js`
`sellerTeam`, `js/seller.js` `sellerNote`). Teachers are now "an independent teacher", not "maker".
Seller Terms §2 says team shops are labelled.
**Room.** If staff ever sell under someone else's name, add an explicit `affiliated` flag in Kortex.

### 5. The privacy policy said things that are no longer true — FIXED
**Issue.** `store-privacy.html` said "We print and pack every order ourselves" and that its recipient list
"is the complete list". Makers now see a buyer's name and address until they ship; teachers see first
names; buyers get lesson reminders and rating emails; ratings are kept. An inaccurate privacy policy is
a deceptive practice in its own right.
**Decision.** The policy now names independent makers and teachers and what each sees, the reminder and
rating emails, and how ratings are kept (answers stay with Kaayko; a one-way code counts people).
**Room.** Ratings and rating tokens still have no retention limit (GAPS: TTL open). Add one, then state it
under "How long we keep it".

### 6. "Life lessons" can drift into unlicensed counselling — FIXED (terms and buyer notice)
**Issue.** A listing that promises to help "those who are lost in life" invites people in distress.
Counselling and therapy are licensed in every state; Kaayko is the seller of record, so a lesson
presented as therapy is Kaayko selling unlicensed therapy.
**Decision.** Seller Terms §6: lessons are teaching; never offered or described as therapy, counselling,
medical, legal or financial advice; no claims to diagnose or treat; point people to professionals.
Every lesson page and the Lessons section of Returns tell buyers this, with **988** (and 911).
Listing review in Kortex should refuse wording that promises to treat anything.
**Room.** Professional-liability insurance for Kaayko as seller of record of lessons (owner decision).
A per-listing "wellbeing" tag could add a stronger notice only where it fits.

### 7. Online one-to-one lessons with children — FIXED
**Issue.** An adult stranger alone on video with a minor, with nobody able to confirm a guardian is in the
room, is the highest-severity risk in the catalogue; a background-check *agreement* does not mitigate it.
**Decision.** **Online lessons are adults-only**, for now (`lessons.validateLesson`; the form disables the
under-18 choice online; Terms §6). In person, the existing guardian-present + background-check rule stays.
**Room.** Reopen with a real background-check provider (Checkr or similar) and a guardian-presence check.

### 8. Recording sessions without consent — FIXED (terms)
**Issue.** Several states require every party's consent to record a call (California, Florida, Illinois,
Washington among them). Teachers recording Zoom sessions by default would put Kaayko, as seller, in it.
**Decision.** Seller Terms §6: never record a session, video or audio, unless everyone agrees at the start.
**Room.** None needed now.

### 9. Changing the terms with less than 30 days' notice — DECIDED
**Issue.** Seller Terms §11 promises 30 days' email notice before the terms change. Items 1–4 and 6–8 change
them today.
**Decision.** New version **2026-10-28**, effective at once for new applicants (the apply page sends it; an
old open page is told to reload). The only existing Kreator is Kaayko's owner's own shop, and the owner
asked for these changes on 28 Oct 2026, which is his acceptance.
**Room.** Before any future change with real Kreators: a "terms are changing" email to every Kreator, sent
30 days ahead, recorded per Kreator. Not built yet.

### 10. Card fees on refunds and chargebacks — ACCEPTED
**Issue.** Stripe keeps its fee on a refund, so every lesson cancelled 48+ hours ahead or by the teacher
costs Kaayko ~$1.17; a lost dispute adds Stripe's dispute fee (about $15).
**Decision.** Accept for launch: full refunds build trust and volume is tiny.
**Room.** If teacher cancellations become common, charge the unrecoverable fee to the teacher's next
statement (needs a terms change with notice). For disputes about a maker's piece, pass the dispute fee on.

---

## Owner actions (not code)

1. **1099 reporting.** Kaayko pays US individuals for lessons (services). Turn on Stripe Connect's tax
   reporting (1099-NEC for teachers) once Connect is live; Stripe Express collects the TIN. The federal
   threshold changed in 2025 law (I believe to $2,000 for 2026 payments) — confirm with an accountant,
   along with how makers' goods should be reported.
2. **Sales tax.** As seller of record, Kaayko owes tax on lessons where a state taxes them. Lessons use
   Stripe Tax code `txcd_20030000` (general services); online live instruction may be treated differently.
   Confirm the code and the states Kaayko must register in.
3. **Insurance.** General and professional liability for Kaayko as seller of record of lessons.
4. **Stripe:** enable Connect Express, and set Kaayko's own payouts to manual or keep a float (GAPS).

## What changed, where

- `kaayko-api/functions/config/kreatorTerms.js` — version 2026-10-28, `MIN_LISTING_CENTS`, `MIN_PAYOUT_CENTS`
- `api/checkout/discounts.js`, `api/checkout/createPaymentIntent.js` — Kaayko-funded discounts on house pieces only
- `services/kreatorPayouts.js` — the $25 minimum
- `api/kreators/kreatorProductRoutes.js` — the $5 floor
- `services/lessons.js` — online lessons adults-only
- `api/products/products.js` — `sellerTeam`
- `kaayko/src/js/seller.js` (new), `product.js`, `store-satire.js`, `pages/cart.js`, `pages/store.js`, `cartManager.js`, `fitPicker.js` — seller labels; lesson-page advice and 988 line
- `kreator/add-product.html` — $5 floor, adults-only online; `kreator/apply.html` — terms version
- `legal/kreator-terms.html`, `legal/returns.html`, `store-privacy.html` — the policy text above

Tests: API 1375/1375 (unit tests for each rule), 40/40 end-to-end on the emulators (price floor,
team label, payout minimum, plus the earlier 37), frontend 188/188.
