# Kaayko Frontend

Static frontend for the Kaayko product portfolio. The `main` branch hosts commerce, paddling intelligence, KORTEX, Kreator, Kamera Quest, and a small set of adjacent experiences from Firebase Hosting under the `kaaykostore` site.

## Product experience map

| Product | Primary entrypoints | Backend dependency | Product guide |
| --- | --- | --- | --- |
| Store / Commerce | `src/index.html`, `src/store.html`, `src/cart.html`, `src/order-success.html` | `kaayko-api` commerce routes | [`docs/products/STORE.md`](./docs/products/STORE.md) |
| Paddling Out | `src/paddlingout.html` | `kaayko-api` weather and location routes | [`docs/products/PADDLING_OUT.md`](./docs/products/PADDLING_OUT.md) |
| KORTEX | `src/kortex.html`, `src/create-kortex-link.html`, `src/admin/*`, `src/redirect.html` | `kaayko-api` smart links, deep links, billing, auth | [`docs/products/KORTEX.md`](./docs/products/KORTEX.md) |
| Kreator | `src/kreator/*` | `kaayko-api` kreator routes | [`docs/products/KREATOR.md`](./docs/products/KREATOR.md) |
| Kamera Quest | `src/karma.html`, `src/karma/kameras/*` | `kaayko-api` cameras, lenses, presets | [`docs/products/KAMERA_QUEST.md`](./docs/products/KAMERA_QUEST.md) |
| Knowledge / External surfaces | `src/knowledge/index.html`, `src/admin/views/roots/index.html`, `src/reads.html` | External `cool-schools` API and content surfaces | [`docs/products/KNOWLEDGE_EXTERNALS.md`](./docs/products/KNOWLEDGE_EXTERNALS.md) |

## Architecture

- Hosting: Firebase Hosting site `kaaykostore` configured in [`firebase.json`](./firebase.json).
- App style: static HTML, CSS, and browser JavaScript modules. There is no build pipeline or package manifest on `main`.
- API connectivity: most product pages call the live backend directly at `https://api-vwcc5j4qda-uc.a.run.app`.
- Hosting rewrites:
  - `/api/**`, `/l/**`, `/resolve`, and `/health` route to the backend function.
  - `/karma/schools/somalwar/**` routes to an external Cloud Run service.
- Security headers are applied centrally from [`firebase.json`](./firebase.json), including HSTS, `X-Frame-Options`, `X-Content-Type-Options`, and a restrictive `Permissions-Policy`.

## Repository layout

```text
kaayko/
├── src/
│   ├── index.html, store.html, cart.html, order-success.html
│   ├── paddlingout.html
│   ├── kortex.html, create-kortex-link.html, redirect.html
│   ├── kreator/
│   ├── karma/
│   ├── admin/
│   ├── js/
│   └── css/
├── docs/
│   ├── products/
│   ├── learnings/
│   └── PRODUCT_AUTOMATION_PLAN.md
├── firebase.json
└── README.md
```

## Local preview and deploy

The repo is a static Firebase Hosting site.

Preview locally:

```bash
firebase emulators:start --only hosting
```

Deploy hosting:

```bash
firebase deploy --only hosting
```

Use the emulator when you need Hosting rewrites and header behavior. Opening files directly from disk is not equivalent to production.

## Quality reality on `main`

- There is no checked-in frontend test runner, linter, or package-based build in this repository.
- API access is duplicated across multiple page-level clients instead of flowing through one shared typed contract.
- Production API URLs are hardcoded in many files, which increases drift risk whenever the backend surface changes.
- A few frontend surfaces currently describe or call backend routes that are not mounted from `kaayko-api/main`. The most important one is Kreator product management.

## Recommended operating discipline

- Treat each product as a paired surface: backend routes plus frontend pages.
- Before deploys, verify both route health and the actual page that consumes those routes.
- Keep learnings and follow-up work in the product-specific notes under [`docs/learnings`](./docs/learnings/README.md).

## Documentation map

- Product index: [`docs/products/README.md`](./docs/products/README.md)
- Automation blueprint: [`docs/PRODUCT_AUTOMATION_PLAN.md`](./docs/PRODUCT_AUTOMATION_PLAN.md)
- Learnings convention: [`docs/learnings/README.md`](./docs/learnings/README.md)
