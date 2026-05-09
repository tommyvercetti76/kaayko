# Knowledge / External Surfaces

## Scope

These pages exist inside the Kaayko frontend repository, but they are not backed by the `kaayko-api/main` branch.

## External or adjacent entrypoints

- `src/knowledge/index.html`
- `src/admin/views/roots/index.html`
- `src/admin/views/roots-v2/index.html`
- `src/reads.html`

## Backend dependency reality

- `src/knowledge/index.html` calls `https://cool-schools-api-420407869747.us-central1.run.app/api/v1/roots`.
- `src/admin/views/roots/index.html` also targets that external `cool-schools` API.
- `src/admin/views/roots-v2/index.html` is the parallel v2 ROOTS ops UI. It keeps the classic page intact, targets the same external ROOTS API by default, and opens respondent assessments on `https://roots.kaayko.com/{parent|teacher}-assessment?invite=CODE`.
- Firebase Hosting rewrites `/karma/schools/somalwar/**` to the external `cool-schools` Cloud Run service.

## Why this matters

- Do not document these pages as Kaayko API features.
- Do not include them in Kaayko API deploy validation.
- If you automate them, treat them as a separate product line with separate security and uptime ownership.
