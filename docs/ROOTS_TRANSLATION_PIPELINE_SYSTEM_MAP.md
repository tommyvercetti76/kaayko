# ROOTS Translation Pipeline - System Map

## Purpose
This document captures what has been built for the ROOTS local translation pipeline, including:
- Full end-to-end behavior
- Complete file map (UI + API + storage touchpoints)
- Dependency loops (runtime and code-level)
- Operational constraints and environment requirements

Scope here is the translation workflow used by:
- Individual translation/review
- Batch translation (max 25)
- Review queue and approvals
- Local Ollama runtime diagnostics

---

## AI Models In Use (May 10, 2026)

- Translation runtime provider:
  - Ollama at `http://127.0.0.1:11434`
- Primary translation model:
  - Config key: `ROOTS_TRANSLATION_MODEL`
  - Current observed value in persisted translation metadata:
    - `hf.co/mradermacher/sarvam-translate-GGUF:Q4_K_M`
  - Service fallback if env is unset:
    - `aya-expanse:8b`
- Cleanup model (optional second pass):
  - Config key: `ROOTS_TRANSLATION_CLEANUP_MODEL`
  - Current observed usage in local records:
    - none (disabled)
- API review/automation model (separate from translation):
  - `qwen2.5-coder:14b` (from `coolschools-web/automation/config/runtime.json`)

---

## What Is Built (Current State)

### 1) Translation UI (local-first admin)
- Static admin page with tabs:
  - Individual
  - Batch
  - Review Queue
- Local mode support:
  - API override via `?api=http://localhost:8081`
  - Dev auth bypass via `?dev=1` (token=`Bearer dev`)
- Runtime diagnostics panel:
  - shows model/base URL/reachability
- Center-panel readability mode:
  - Source + translated question summary in center
  - Full editable translated fields in right panel

### 2) Translation API
- Translation endpoints under `.../api/v1/roots/prototype-admin`
- Runtime status endpoint
- Single question translate endpoint
- Review/save endpoint
- Batch create + progress/list endpoints

### 3) Translation service
- Source question retrieval by source type (`parent`, `teacher`, `child`, `generated`)
- Local model field-by-field translation strategy
- Optional second-stage cleanup pass (another LLM)
- Translation persistence in Firestore
- Tag memory persistence for consistency

### 4) Batch processing
- Max 25 questions per batch
- Max 2 concurrent active batches
- In-service loop translation with progress updates
- UI batch list with polling + result drilldown

---

## Runtime Topology

```text
Browser (localhost:8090)
  -> Static UI page (Kaayko_v6 HTML)
  -> Calls API (localhost:8081)
      -> ROOTS route /prototype-admin
          -> question-translation.service
              -> Ollama local endpoint (127.0.0.1:11434)
              -> Firestore (coolschools-72426)
```

Notes:
- Local browser page is served via simple local HTTP server to avoid HTTPS->HTTP mixed-content restrictions.
- API CORS allows `http://localhost:8090` in dev.

---

## End-to-End Dependency Loops

## Loop A: Individual Translate
1. UI selects source+locale+question.
2. UI calls `GET /translations/questions/:source/:questionId`.
3. API loads source question + existing translations.
4. User clicks Translate.
5. UI calls `GET /translations/runtime-status`.
6. UI calls `POST /translations/questions/:source/:questionId/translate`.
7. Service translates fields via Ollama (`/api/generate`).
8. Optional cleanup pass via second model (`/api/chat`) if configured.
9. Service writes translation document to Firestore.
10. UI reloads question bundle and renders translated output.

## Loop B: Review/Save
1. User edits translated fields in right panel.
2. UI calls `POST /translations/questions/:source/:questionId/review` with status.
3. Service validates answer count and writes reviewed translation.
4. Service updates tag memory.
5. UI updates list badges and center compare panel.

## Loop C: Batch Translate
1. User selects up to 25 IDs in Batch tab.
2. UI calls `POST /translations/batches`.
3. Service creates batch doc (`processing`) and loops question IDs.
4. Each ID calls same `translateSingle` path as individual translation.
5. Batch doc increments success/failed counters.
6. Batch doc ends as `completed` or `completed_with_errors`.
7. UI polls `GET /translations/batches` until done.
8. User clicks View Results -> Review Queue filtered to source/locale/status.

## Loop D: Runtime Diagnostics
1. UI calls `GET /translations/runtime-status`.
2. Service pings Ollama `/api/tags`.
3. Service checks primary model and cleanup model presence.
4. UI prints diagnostics in process log.

---

## Complete File Map (Everything Involved)

## A) Frontend (static translation admin)

### Main UI
- `Kaayko_v6/kaayko/src/admin/views/roots/translations/index.html`
  - Entire translation UI (tabs, auth/dev mode, API calls, rendering, batch/review UX)
  - Key client flow functions:
    - `loadBank`, `selectQuestion`, `runTranslate`, `saveTranslation`
    - `runBatch`, `loadBatches`, `viewBatchResults`, `loadReviewQueue`
    - `checkRuntimeStatus`, `renderSrcPanel`, `renderEditPanel`

### Local static hosting for this page
- `Kaayko_v6/kaayko/deployment/deploy-hosting-safe.sh`
  - Deploys static HTML to hosting

## B) API entrypoints and routing

### API server bootstrap
- `coolschools-web/api/src/index.ts`
  - Express app, CORS, timeout middleware, route mounting
  - Translation-specific timeout relaxation for `/translate` and batch POST

### ROOTS module router
- `coolschools-web/api/src/roots/index.ts`
  - Mounts `prototype-admin` routes under `/api/v1/roots/prototype-admin`

### Translation routes (HTTP contract)
- `coolschools-web/api/src/roots/routes/prototype-admin.ts`
  - Endpoints:
    - `GET /question-bank-full`
    - `GET /translations`
    - `GET /translations/questions/:source/:questionId`
    - `GET /translations/runtime-status`
    - `POST /translations/questions/:source/:questionId/translate`
    - `POST /translations/questions/:source/:questionId/review`
    - `POST /translations/batches`
    - `GET /translations/batches`
    - `GET /translations/batches/:batchId`

## C) Auth and access gates

### ROOTS auth middleware
- `coolschools-web/api/src/roots/middleware/roots-auth.ts`
  - Production path: Firebase ID token verification
  - Local dev bypass path: `Authorization: Bearer dev` when non-production
  - role-based guards via route middleware composition

## D) Translation business logic

### Core service
- `coolschools-web/api/src/roots/services/question-translation.service.ts`
  - Source loading (parent/teacher/child/generated)
  - `translateText` (field-by-field generation against Ollama)
  - Optional cleanup pass (`ROOTS_TRANSLATION_CLEANUP_MODEL`)
  - Runtime diagnostics (`getRuntimeStatus`)
  - Translation persistence and review save
  - Batch lifecycle management

### Source question dependencies (imported by service)
- `coolschools-web/api/src/roots/services/parent-assessment.service.ts`
- `coolschools-web/api/src/roots/services/teacher-assessment.service.ts`
- `coolschools-web/api/src/roots/data/parent-questions-bank.js`
- `coolschools-web/api/src/roots/data/teacher-questions-bank.js`

## E) Firestore access layer

### Firebase admin init
- `coolschools-web/api/src/config/firebase.ts`
  - `db` and `auth` clients

### ROOTS collection helpers
- `coolschools-web/api/src/roots/config/roots-collections.ts`
  - Shared ROOTS collection refs used by source lookup

### Firestore collections written by translation flow
- `roots_question_translations`
- `roots_translation_batches`
- `roots_translation_memory`

## F) Runtime/deployment touchpoints

### Local API run
- `coolschools-web/api/package.json` (dev script via tsx watch)

### Static local page run
- Local command used: `python3 -m http.server 8090` in translation page directory

---

## Dependency Graph (Code-Level)

```text
index.html (UI)
  -> HTTP -> prototype-admin routes
      -> question-translation.service
          -> roots-collections + question banks + parent/teacher services
          -> firebase db/auth
          -> Ollama (/api/generate primary, /api/chat cleanup, /api/tags diagnostics)
```

```text
api/src/index.ts
  -> roots/index.ts
      -> routes/prototype-admin.ts
          -> middleware/roots-auth.ts
          -> services/question-translation.service.ts
              -> config/firebase.ts
              -> config/roots-collections.ts
              -> data + assessment service banks
```

---

## Environment Variables (Translation-Relevant)

### Primary translation
- `ROOTS_TRANSLATION_MODEL`
- `ROOTS_TRANSLATION_OLLAMA_URL` (default `http://127.0.0.1:11434`)

Current local active value observed in translation records:
- `ROOTS_TRANSLATION_MODEL=hf.co/mradermacher/sarvam-translate-GGUF:Q4_K_M`

### Optional cleanup stage (second LLM)
- `ROOTS_TRANSLATION_CLEANUP_MODEL`
- `ROOTS_TRANSLATION_CLEANUP_OLLAMA_URL` (falls back to primary ollama URL)

Current local state observed in translation records:
- `ROOTS_TRANSLATION_CLEANUP_MODEL` not set (cleanup pass disabled)

### API runtime
- `NODE_ENV`
- `PORT` (default `8081`)

---

## Constraints and Guardrails
- Batch size hard limit: 25
- Parallel active batches: 2
- API default timeout: 15s
- Translation endpoints timeout: 180s
- Review save validates translated answer count equals source answer count
- Batch status outcomes:
  - `processing`
  - `completed`
  - `completed_with_errors`

---

## Data Contract (Translation Record)

Top-level fields persisted include:
- `source`, `questionId`, `locale`, `status`
- `sourceHash`, `sourceSnapshot`
- `translation`:
  - `question`
  - `answers[]` (grade + text)
  - `tags[]`
  - `domainLabel`
  - `rationale`
- `metadata`:
  - `model`
  - `cleanupModel`
  - `cleanupApplied`
  - `cleanupError`
  - `batchId`
  - `translatedBy`
- `reviewedBy`, `reviewedAt`, `createdAt`, `updatedAt`

---

## Current Maturity Assessment

### Strong
- End-to-end local run works (UI -> API -> Ollama -> Firestore)
- Operational diagnostics are exposed in UI
- Batch and review flows are in place
- Guardrails for batch size and concurrency are active
- Optional two-stage LLM path (translate + cleanup) implemented

### Medium-risk / Next hardening steps
- Add automated quality scoring (script/language leakage, length ratio, punctuation sanity)
- Add glossary lock/term constraints per locale
- Add retry/backoff policy around Ollama calls
- Add dashboard-level counters for cleanup pass efficacy and failure rates
- Add tests for translation route contracts and batch edge cases

---

## Quick Operational Checklist

1. Start API locally (`coolschools-web/api`) on 8081.
2. Start local static server (`Kaayko_v6/.../translations`) on 8090.
3. Open UI: `http://localhost:8090/?api=http://localhost:8081&dev=1`.
4. Run Runtime Status and confirm model checks.
5. Run individual translate, then batch, then review save.

---

## Ownership Boundaries
- UI and local admin experience: `Kaayko_v6/kaayko/src/admin/views/roots/translations/index.html`
- Backend route contract + auth: `coolschools-web/api/src/roots/routes/prototype-admin.ts` and middleware
- Translation logic + batch + cleanup strategy: `coolschools-web/api/src/roots/services/question-translation.service.ts`
- Storage and infrastructure adapters: firebase config + roots collection refs
