# KORTEX — Product Strategy Probe

Questions for the product agent. Goal: identify the fastest path to revenue and the highest-leverage features to double down on.

---

## A. Market Positioning & ICP

1. Who is the day-one paying customer — a university alumni office, a nonprofit fundraising team, a SaaS marketing team, or an agency managing links for multiple clients? Which one has budget approval authority with the fewest stakeholders?

2. What's the switching cost from Bitly/Rebrandly/Short.io for a mid-market team running 500+ links? What can Kortex offer in the first 30 seconds that those tools can't?

3. Is the multi-tenant architecture the moat or the complexity tax? Should we ship single-tenant simplicity first and layer tenancy as an enterprise upgrade?

4. The landing page promises "private beta" — what's the conversion mechanic from beta signup to first paid month? What's the activation event that predicts retention?

---

## B. Revenue Architecture

5. The billing tiers are Starter (25 links free) → Pro (500/$?) → Business (2500/$?) → Enterprise (custom). What are the actual price points? What does willingness-to-pay research say for each segment?

6. Is the primary revenue model seat-based, usage-based (links + API calls), or outcome-based (clicks, conversions)? Which model aligns incentives best with the ICP's budget cycle?

7. The Public API is written but not mounted. If we ship it tomorrow, who pays for it and how much? Is API access a Pro feature or a separate developer plan?

8. What's the expansion motion — does a customer start with campaigns and graduate to tenant-level isolation, or do they arrive already needing multi-tenancy?

---

## C. Feature Prioritization (Ship vs Kill vs Hold)

9. A/B split testing is promised on the landing page but not built. Is this a top-3 differentiator that closes deals, or marketing fluff we should remove until it exists?

10. The alumni/philanthropy intent system (V2 links with `donation_checkout`, `philanthropy_campaign`, etc.) — is this the wedge vertical or a distraction from horizontal link management?

11. QR codes are generated client-side via a free third-party API. Should QR be a premium value-add (branded QR, dynamic QR, scan analytics) or stay a free table-stakes feature?

12. Webhooks + attribution together form a real-time data pipeline. Is anyone asking for this? Would a Zapier/Make integration get us to the same outcome faster with less maintenance?

13. Campaign management adds significant surface area. Is the typical customer managing 1 campaign or 20? If most run 1-3, should we simplify the campaign UX and gate the full system behind Business tier?

---

## D. Go-to-Market Mechanics

14. What's the acquisition channel — product-led (free links → upgrade), sales-led (demo → contract), or partner-led (integration marketplace)? Where does the first $10k MRR come from?

15. The tenant self-registration form exists. What's the expected volume? Should this be a high-touch onboarding (sales call) or fully self-serve?

16. The platform serves `kaayko.com/l/` links today. When a tenant wants their own domain (`links.theirschool.edu`), what's the operational cost of custom domain provisioning? Is this an Enterprise-only feature?

17. What's the referral/viral loop? Does a click on a Kortex link expose the platform to the end recipient? Should there be a "Powered by Kortex" badge on free-tier redirects?

---

## E. Retention & Engagement Signals

18. What's the daily active behavior for a healthy tenant — creating links, checking analytics, or managing campaigns? Which usage pattern predicts churn vs expansion?

19. The dashboard was rebuilt to be "campaign-first." Did this increase time-to-first-action? What metric validates this was the right call?

20. Analytics currently shows trends but no alerts. Would "your top link dropped 40% this week" type notifications drive re-engagement? Is this a Pro feature?

---

## F. Competitive Differentiation

21. Bitly charges $35/mo for 500 branded links. Rebrandly charges $89/mo for team features. Where does Kortex sit — cheaper, same price with more features, or premium with vertical specialization?

22. The alumni/education vertical is baked into V2 link intents. Is this a vertical SaaS play (Kortex for Higher Ed) or a horizontal tool that happens to have one good vertical? Vertical wins on willingness-to-pay but loses on TAM.

23. Multi-tenancy + white-label + API is an agency play. Are agencies a viable early adopter (they need this now) or a distraction (long sales cycles, low NPS, high support)?

24. What's defensible — the data (click graphs, attribution chains), the network (tenant ecosystem), or the workflow (campaign-first UX)? Where do we invest engineering to widen the moat?

---

## G. Technical Leverage & Cost

25. Firestore is the database. At what link/click volume does this become a cost problem? What's the monthly infrastructure cost per 1,000 links managed?

26. Rate limiting is Firestore-based (one doc write per rate check). At scale, does this need to move to Redis/Memorystore? What's the threshold?

27. The redirect handler does a Firestore read on every click. At 10k clicks/day vs 1M clicks/day, what's the latency and cost difference? Should we add a CDN/edge cache layer?

28. The webhook service retries with exponential backoff. If a tenant's endpoint is down for 24h, how many retries queue up? Is there a dead letter queue?

---

## H. Monetization Quick Wins

29. What's the fastest feature to gate behind Pro that free users are already bumping into? (Link limit? Analytics depth? Campaign count? API access?)

30. Can we sell QR code branding (logo in center, custom colors) as an add-on without building much? What would a customer pay for this?

31. Is there a "Kortex for Fundraising" package — links + donation tracking + campaign reports — that commands a 3-5x premium over generic link management?

32. The CSV export exists. Would a real-time analytics API (webhook-style push to their dashboard) be worth $50-100/mo to a data-driven marketing team?

---

## I. Risk & Blockers

33. The public API is not mounted. Is this a security readiness concern, a business readiness concern, or both? What gates the decision to ship it?

34. Custom domains are referenced but not operational. Is DNS provisioning (Let's Encrypt, Cloudflare) a 2-week project or a 2-month project? Is it blocking any deals?

35. A/B testing is promised. If a customer signs up expecting it, what's the trust cost of it not existing? Should we remove it from the landing page until shipped?

36. What happens if a tenant churns — are their links still live? Do redirects break? What's the data retention policy?

---

## Action Items for Product Agent

After answering these questions, produce:

1. **One-page positioning statement** — who we serve, what we do, why us, why now
2. **Pricing recommendation** with 3 scenarios (aggressive, market-rate, premium)
3. **90-day roadmap** — what ships, what's killed, what's held for later
4. **First 10 customers list** — specific types of orgs, how to reach them, what they'd pay
