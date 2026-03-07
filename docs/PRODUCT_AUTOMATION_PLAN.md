# Product Automation Plan

This is the recommended automation split for Kaayko as of `main`. Each automation should treat backend and frontend as one paired surface, not as isolated repos.

## Product-by-product automations

| Automation | Repos / workspaces | Primary checks | Output |
| --- | --- | --- | --- |
| Store Guard | `kaayko-api`, `kaayko` | Product catalog fetch, image fetch, cart flow, payment-intent creation, admin order authz | Issue list, fixed regressions, deploy readiness note |
| Paddling Out Guard | `kaayko-api`, `kaayko` | Spot list, spot detail, nearby water lookup, paddle score, fast forecast, forecast modal rendering | Reliability note, latency/regression summary |
| KORTEX Guard | `kaayko-api`, `kaayko` | Auth, tenant context, link CRUD, stats, redirect, billing config, billing usage | Security findings, product health note |
| Kreator Guard | `kaayko-api`, `kaayko` | Application flow, status flow, onboarding, login, dashboard, admin review; separately detect `/kreators/products` mismatch | Contract-drift report, prioritized fixes |
| Kamera Quest Guard | `kaayko-api`, `kaayko` | Catalog scripts, camera API smoke tests, `/presets/meta`, classic and smart preset shapes for multiple skill levels, UI contract rendering | Accuracy and UX delta report |
| Learnings of Kaayko | `kaayko-api`, `kaayko` | Summarize what changed, what remains weak, and what should be built next per product | Markdown learning notes under `docs/learnings/` |

## Cross-product quality gates

Every product automation should, at minimum:

1. Pull the latest `main` state in both repos before evaluating.
2. Run the product-specific backend checks that already exist.
3. Validate the frontend entrypoints that consume those routes.
4. Report security drift, test debt, and contract mismatches separately.
5. Refuse to claim green status if the paired frontend and backend are out of sync.

## Current debt that automation should watch explicitly

- There is no frontend test runner in `kaayko/main`.
- Backend automated coverage on `main` is strongest for Kamera Quest and weak elsewhere.
- Production API base URLs are hardcoded in many frontend files.
- Kreator product-management pages depend on backend routes that are not mounted on `main`.
- KORTEX docs in the frontend still reference some historical paths that are not mounted now.

## Learnings note convention

The `Learnings of Kaayko` automation should write product-specific notes under:

```text
docs/learnings/<product>/<YYYY-MM-DD>-summary.md
```

Each note should include:

1. What changed
2. What was validated
3. What failed or remains weak
4. Security or debt observations
5. Recommended next moves
