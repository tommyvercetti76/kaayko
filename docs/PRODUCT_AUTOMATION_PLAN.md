# Product Automation Plan

This is the revised automation architecture for Kaayko. The earlier one-guard-per-product model is too shallow for the current portfolio. The right model is a coordinated set of guards that share evidence, emit structured outputs, and feed a central learnings loop.

## Design rules

Every automation must:

1. Treat backend and frontend as one paired product surface.
2. Pull the latest `main` state in both repos before evaluating.
3. Preserve current mechanisms unless there is a clear reason to refactor.
4. Emit both a human-readable markdown note and a machine-readable summary.
5. Hand its output to `Learnings of Kaayko`, which aggregates cross-product findings and next actions.

## Shared artifact contract

Each automation should write both:

```text
docs/learnings/<product>/<YYYY-MM-DD>-summary.md
docs/learnings/<product>/latest.json
```

`latest.json` should contain at least:

- `automation`
- `timestamp`
- `status`
- `files_changed`
- `backend_routes_checked`
- `frontend_surfaces_checked`
- `tests_run`
- `security_findings`
- `debt_findings`
- `ux_findings`
- `next_actions`

This is how the guards "talk" to each other without being coupled to one implementation.

## Conflict-avoidance rules

Every automation must also obey these operating rules:

1. Only write inside its own learnings directory unless it is `Learnings of Kaayko`.
2. Never overwrite another guard's markdown note for the same day. Create a new dated note instead.
3. Only update its own `latest.json`.
4. If a guard depends on another guard's output and the upstream output is stale or missing, it must report that condition instead of guessing.
5. Frontend improvement work must preserve existing route behavior and product-specific mechanisms unless a documented fix requires otherwise.
6. Guards may read all product learnings outputs, but they may only mutate code and docs inside their owned scope.
7. Any code changes must be accompanied by validation notes and explicit residual risks.

## Interval cadence

To keep the portfolio active without collisions:

- Each automation runs every 8 hours.
- Automations are split across alternating day groups.
- Group A runs on Monday, Wednesday, Friday, and Sunday.
- Group B runs on Tuesday, Thursday, and Saturday.
- `Learnings of Kaayko` runs after the product guards so it aggregates completed outputs instead of racing them.

Recommended day groups:

- Group A: Kamera Research Guard, Kamera Evidence Guard, KORTEX Platform Guard, Paddling Out Reliability Guard
- Group B: Kamera Catalog Sync Guard, KORTEX Research and Benchmark Guard, Commerce + Kreator Guard, Shared Frontend Craft Guard
- Learnings of Kaayko: daily aggregation window after the other guards have had time to complete

## Recommended automation set

| Automation | Purpose | Why it exists |
| --- | --- | --- |
| Kamera Research Guard | Research official camera and lens catalogs for major brands, 2016 onward | Coverage and accuracy for Kamera Quest cannot rely on ad hoc manual updates |
| Kamera Catalog Sync Guard | Normalize validated camera/lens data and sync it into Firebase and source-controlled catalogs | Research is useless unless it becomes trustworthy product data |
| Kamera Evidence Guard | Mature the recommendation engine using research-backed rules and output validation | The recommendation layer needs evidence, not only more records |
| KORTEX Platform Guard | Test smart links, multi-tenancy, billing, authz, analytics, and redirect correctness | KORTEX is the highest-risk product for security and contract drift |
| Commerce + Kreator Guard | Validate creator onboarding, product publishing, store exposure, checkout, and ops | Kreator and Store share the monetization funnel and must be maintained together |
| Paddling Out Reliability Guard | Verify weather/location APIs, cache health, UI reliability, and performance | This product is data-heavy and operationally sensitive |
| Shared Frontend Craft Guard | Improve design quality, reduce debt, and maximize reuse across shared frontend assets | Product guards should not silently diverge the frontend architecture |
| Learnings of Kaayko | Aggregate all guard outputs into product-specific and portfolio-level learnings | Continuous improvement requires memory, not just repeated checks |

## Detailed guard scopes

## Kamera Research Guard

Scope:

- Cover major camera companies with 2016+ models only.
- Research cameras, lenses, mounts, capabilities, and official product status.
- Prioritize official manufacturer sources first, then reputable secondary sources only for gap analysis.
- Maintain a verified list of supported brands, models, and lens families.

Minimum brand set:

- Canon
- Sony
- Nikon
- Fujifilm
- Panasonic Lumix
- OM System / Olympus
- Leica

Expected outputs:

- Coverage delta
- New or retired models
- Missing capability fields
- Source provenance table

## Kamera Catalog Sync Guard

Scope:

- Convert verified research into normalized camera and lens records.
- Sync those records into source-controlled catalog files and Firebase collections.
- Preserve provenance, verification tier, and update timestamps.
- Refuse to promote unverified or contradictory records.

Expected outputs:

- Records added or updated
- Firebase sync result
- Validation failures
- Schema drift warnings

## Kamera Evidence Guard

Scope:

- Review academic papers, official technical references, and validated field notes.
- Convert evidence into recommendation rules only when the evidence quality is explicit.
- Re-run catalog audits, smoke tests, and representative preset samples across skill levels.
- Track whether the engine is becoming more useful, more concise, and more truthful.

Expected outputs:

- Rules added, updated, or retired
- Accuracy and confidence notes
- Output-shape changes by skill level
- Frontend rendering impacts

## KORTEX Platform Guard

Scope:

- Exercise the full smart-link lifecycle: create, read, update, delete, redirect, analytics, QR, and billing surfaces.
- Verify multi-tenant isolation, authn, authz, token handling, webhook safety, and public-vs-admin boundary correctness.
- Research competitive parity against products like Branch and short-link SaaS platforms where helpful.
- Maintain or generate performance and reliability dashboard artifacts for key operations.

Minimum checks:

- Tenant registration
- Tenant-scoped admin access
- Link CRUD
- Redirect matrix
- Event tracking
- Billing config, usage, and downgrade flows
- Unauthorized and cross-tenant access attempts

Expected outputs:

- Security findings
- Tenant isolation findings
- Performance metrics
- Dashboard or scoreboard update

## Commerce + Kreator Guard

Scope:

- Treat Kreator onboarding and Store monetization as one funnel.
- Verify application, onboarding, login, profile, product publishing, product surfacing, cart flow, checkout, and order follow-through.
- Reduce friction for new Kreators while preserving auth and approval controls.
- Flag contract mismatches immediately, especially around `/kreators/products`.

Expected outputs:

- Funnel blockers
- Onboarding friction notes
- Contract mismatch notes
- Store-to-Kreator integration health

## Paddling Out Reliability Guard

Scope:

- Check spot browsing, spot details, nearby water, paddle score, cached forecast, and full forecast flows.
- Monitor cache-health behavior, input normalization, and UI reliability.
- Track latency and failure patterns, not only correctness.

Expected outputs:

- Reliability note
- Latency changes
- Cache health summary
- UX regression summary

## Shared Frontend Craft Guard

Scope:

- Own only shared frontend quality: design refinement, debt reduction, reuse improvements, and consistency across products.
- Preserve live mechanisms and route behavior while removing duplication and shallow UI decisions.
- Improve desktop and mobile UX quality without destabilizing product logic.

Expected outputs:

- Reuse opportunities
- Debt reduction summary
- Visual/UX delta summary
- Paths that should migrate into shared utilities

## Learnings of Kaayko

Scope:

- Read every product guard's markdown note and `latest.json`.
- Produce per-product learnings plus a portfolio-level synthesis.
- Track whether repeated findings are shrinking or compounding.
- Recommend the next highest-leverage actions for each product.

Expected outputs:

- Product learnings notes
- Portfolio summary
- Recurring-problem scoreboard
- Ranked next-action list

## Current debt that automation should watch explicitly

- There is no frontend test runner in `kaayko/main`.
- Backend automated coverage on `main` is strongest for Kamera Quest and weak elsewhere.
- Production API base URLs are hardcoded in many frontend files.
- Kreator product-management pages depend on backend routes that are not mounted on `main`.
- KORTEX frontend materials still reference some historical or unmounted paths.
- Dashboarding for performance and product health is not standardized across the portfolio.
