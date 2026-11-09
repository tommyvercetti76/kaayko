# Getting Google to know what Kaayko is — the steps only Rohan can do

Written 9 Nov 2026, the day Google's AI Overview for "kaayko" described a musician
with a near-identical name. kaayko.com ranks first for the name; Google just has no
entity record for Kaayko, so it borrows his. Markup on the site is done (home page
Organization graph: description, disambiguatingDescription, knowsAbout, founder,
sameAs). Everything below is off-site and needs your Google or company accounts.

Do them in this order. Each one makes the next one stick.

## 1. Search Console — today, 20 minutes

1. https://search.google.com/search-console → Add property → **Domain** (not URL prefix).
2. Add four: `kaayko.com`, `kaay.store`, `kaay.link`, `kaay.school`. Each gives a TXT
   record to put in the domain's DNS (Squarespace for the ones bought there). Wait for
   the green tick.
3. In `kaayko.com` → Sitemaps, submit `https://kaayko.com/sitemap.xml` and
   `https://kaayko.com/sitemap-products.xml`. In `kaay.school`, submit
   `https://kaay.school/sitemap.xml`. kaay.store and kaay.link need no sitemap; their
   canonicals point at kaayko.com and kaay.link's single page is already indexed.
4. URL Inspection → paste `https://kaayko.com/paddlingout`, click **Request indexing**.
   Same for `https://kaayko.com/store` and `https://kaayko.com/stories`. Three a day is
   plenty; the sitemaps do the rest.
5. Come back in a week: Pages report shows what got in and why anything was left out.

## 2. Google Business Profile — this week

https://business.google.com → create a profile for **Kaayko** as an online business
(no storefront; hide the address). Website `https://kaayko.com`. Category: Software
company. Description: paste the home page's one-paragraph description. Add the logo
(`/kaayko-logo-512.png`) and a cover (the store or a paddling photo). Verification is
usually by video or phone. This is the fastest route to a Knowledge Panel you own.

## 3. Two third-party profiles — this week

- **Crunchbase**: https://www.crunchbase.com → Add organization. Name Kaayko, founder
  Rohan Ramekar, website kaayko.com, founded year, short description, logo.
- **LinkedIn company page**: https://www.linkedin.com/company/setup/new/ — same facts,
  linked from your own LinkedIn profile under Experience.

Send me both URLs when they exist and I add them to `sameAs` on the home page and About.
These two are also the independent references that let a Wikidata item survive later.

## 4. Claim the Knowledge Panel — when one appears

Search "kaayko" signed in to the Google account that owns the Business Profile. When a
panel for Kaayko (not the musician) shows a "Claim this knowledge panel" link, follow
it. Then you can suggest edits and set the official website.

## 5. Wikidata — not yet

Do NOT create a Wikidata item until step 3 exists and ideally a trademark or business
registration can be cited. With only self-published sources it is deleted, and a
deleted item is worse than none. When ready, the item spec is in the session memory
(`kaayko_seo_entity.md`): one neutral Organization item, never aliased to the musician.

## What not to do

- Never mention the musician anywhere on the site, in copy or markup. It strengthens
  the association instead of breaking it.
- Do not pay an agency that emails about "page 1". The gaps were a noindex tag and a
  missing sitemap; both are fixed, and the rest is the five steps above.
