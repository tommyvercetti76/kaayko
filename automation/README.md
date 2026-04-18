# Local Model Automation Loop

This is the local control-plane for Kaayko coding, code review, dashboards, and dataset export. It is designed to be conservative, file-based, and easy to schedule, so the loop stays trustworthy without becoming another brittle platform to maintain.

Use the shorter launcher:

```bash
cd /Users/Rohan/Kaayko_v6/kaayko
./automation/kaayko console
```

That is the operator entrypoint.

## What changed

You no longer have to hand-edit the run files for normal operation.

The automation now supports:

- one-shot autopilot execution with `pipeline`
- a queue + worker model for many ideas at once
- auto-generated review notes and structured review JSON
- dashboard generation after every pipeline or worker run
- JSONL dataset exports for local-model training
- explicit separation between `failed` and `blocked-by-environment` gates

## Core rule

Do not train local models on raw coding history.

Only use the gold dataset when a run is:

1. reviewed,
2. quality-gated,
3. above the configured score thresholds, and
4. explicitly approved for training by the automation policy.

Runs that are useful but not clean enough still remain available in the reviewed dataset for later filtering.

## Directory layout

```text
automation/
├── config/portfolio-loop.json
├── templates/
├── scripts/portfolio-loop.js
├── run-local-loop.sh
├── runs/                 # ignored runtime artifacts
├── queue/                # ignored queue state
├── dashboard/            # ignored generated dashboard
└── datasets/             # ignored generated JSONL exports
```

## The two operating modes

### 1. One-shot autopilot

Use this when you want one command to create the run, execute the gates, generate the review, refresh the dashboard, and export datasets.

Example:

```bash
cd /Users/Rohan/Kaayko_v6/kaayko
./automation/kaayko pipeline \
  --track kortex \
  --idea tenant-isolation-hardening \
  --title "Harden tenant isolation review" \
  --goal "Make tenant-boundary behavior explicit and capture training-quality evidence."
```

What it does:

1. creates a run folder
2. snapshots git state across the owned repos
3. runs the configured quality gates
4. auto-generates `review.md` and `review.json`
5. computes training eligibility conservatively
6. publishes if review is no longer pending
7. refreshes the dashboard
8. refreshes dataset exports

### 2. Queue + worker autopilot

Use this when you want to batch many ideas and let a scheduled worker process them.

Queue a task:

```bash
./automation/kaayko enqueue \
  --track shared \
  --idea api-base-url-hardening \
  --title "Audit hardcoded API base URLs" \
  --goal "Find and reduce production-only API URL drift."
```

Run the worker:

```bash
./automation/kaayko worker --limit 5
```

Queue flow:

1. task JSON lands in `automation/queue/pending/`
2. worker moves it into `processing/`
3. worker runs the same autopilot pipeline
4. completed task moves to `done/`
5. failed task moves to `failed/`
6. dashboard and dataset exports refresh at the end

This is the mode to schedule if you want a proper local loop with minimal manual handling.

## Dashboard outputs

Generate or refresh directly:

```bash
./automation/kaayko dashboard
```

Artifacts:

- `automation/dashboard/index.html`
- `automation/dashboard/summary.json`
- `automation/dashboard/runs.json`
- `automation/dashboard/latest.md`

The dashboard tracks:

- run counts
- approval counts
- gold-training counts
- explicit suggestion counts
- explicit vulnerability counts
- rejected unsafe rewrite counts
- model-by-model signal summaries
- coached product coverage
- queue state
- per-track health
- per-gate reliability
- recent runs
- open findings

## Dataset outputs

Refresh directly:

```bash
./automation/kaayko export
```

## Model selection

The selected local model lives in:

- [`config/runtime.json`](./config/runtime.json)
- product coaching lives in [`config/agent-coaching.json`](./config/agent-coaching.json)

Inspect the current runtime:

```bash
./automation/kaayko model
```

Enable real local-model execution:

```bash
./automation/kaayko model mode ollama
```

Set Qwen as the selected local model:

```bash
./automation/kaayko model use qwen2.5-coder:14b
```

That updates the runtime config and makes the selected provider/model obvious in the CLI.

See all current settings:

```bash
./automation/kaayko settings
```

Run the local health check:

```bash
./automation/kaayko doctor
```

Open the retro operator console:

```bash
./automation/kaayko console
```

Show where the latest outputs landed:

```bash
./automation/kaayko results
```

Run a higher-level mission without thinking about `track` and `idea`:

```bash
./automation/kaayko mission --area frontend --goal "Analyse frontend and reduce drift."
```

Use the operator-friendly alias:

```bash
./automation/kaayko agent --area frontend --goal "Analyse frontend and reduce drift."
```

The agent now consumes a portfolio coaching briefing built from local product docs, route ownership, and validation rules before selecting files.

Product-aware examples:

```bash
./automation/kaayko agent --area store --goal "Reduce checkout duplication safely"
./automation/kaayko agent --area paddling-out --goal "Harden forecast UI without breaking weather flows"
./automation/kaayko agent --area kortex --goal "Audit tenant isolation and billing UI drift"
```

Those commands focus the agent on the matching product docs, frontend paths, backend routes, and validation risks before it chooses files.

Queue the same mission instead of running immediately:

```bash
./automation/kaayko mission --mode queue --area frontend --goal "Analyse frontend and reduce drift."
```

Artifacts:

- `automation/datasets/trajectories.jsonl`
- `automation/datasets/approved-trajectories.jsonl`
- `automation/datasets/review-findings.jsonl`
- `automation/datasets/dataset-manifest.json`

Recommended usage:

- use `approved-trajectories.jsonl` as the gold local-model input
- use `trajectories.jsonl` for analysis, filtering, and error mining
- use `review-findings.jsonl` to train failure detection or review assistants

## Track configuration

All repo ownership, quality gates, and risk checks live in:

- [`config/portfolio-loop.json`](./config/portfolio-loop.json)
- [`config/agent-coaching.json`](./config/agent-coaching.json)

Local model transport, timeout, and prompt-budget settings live in:

- [`config/runtime.json`](./config/runtime.json)

That is the scaling surface. When a new idea family appears, add a new track instead of adding one-off scripts.

Important runtime defaults:

- `review_engine.mode=ollama` enables real model-backed runs
- `local_model_runtime.allow_cli_fallback=false` keeps the agent on the stable HTTP daemon path instead of falling back to the crashing local CLI
- `local_model_runtime.analysis_max_file_chars=7000` trims large files before analysis so KORTEX/admin runs stay within a practical local-model budget

## Step-by-step execution

### Fast path: one idea, no manual bookkeeping

1. Run `pipeline`.
2. Inspect `automation/dashboard/index.html`.
3. If the run is gold-eligible, the export is already ready.
4. If it is only reviewed or blocked, use the findings and rerun after fixes.

### Portfolio path: many ideas, scheduled locally

1. `enqueue` each idea.
2. Schedule `worker` on a cadence.
3. Review `automation/dashboard/latest.md` or `index.html`.
4. Retrain only from the fresh gold export.

## How the auto-review stays conservative

The review engine uses:

- configured quality gates
- git change breadth
- git churn
- track ownership
- explicit risk-check context

It intentionally does not auto-promote everything to gold.

Important behavior:

- gate failures reduce scores sharply
- environment-blocked gates are labeled `blocked`, not `failed`
- large diffs reduce maintainability and confidence
- gold approval is withheld when the run is too broad or under-verified

## Industry-grade guardrails

- Append-only run folders preserve evidence.
- Config owns the policy, not ad hoc shell usage.
- Review is a separate artifact from implementation.
- Dashboarding is generated from run evidence, not hand-maintained notes.
- Gold training data is stricter than “looks okay.”
- Queue state is explicit, so automation is observable and recoverable.

## Recommended local schedule

If you want this to feel hands-off, schedule the worker on an hourly or two-hour cadence.

Suggested pattern:

1. enqueue ideas as they appear
2. run `worker --limit 3` every hour
3. run `dashboard` and `export` after the worker
4. retrain nightly or weekly from `approved-trajectories.jsonl`

Because `worker` already refreshes dashboard and export by default, the scheduled command can simply be:

```bash
cd /Users/Rohan/Kaayko_v6/kaayko
./automation/kaayko worker --limit 3
```

## Practical command set

```bash
# one-shot
./automation/kaayko pipeline --track shared --idea debt-audit --goal "Reduce shared frontend drift."

# high-level operator command
./automation/kaayko mission --area frontend --goal "Analyse frontend and improve it."

# queue work
./automation/kaayko enqueue --track kortex --idea billing-audit --goal "Audit billing correctness and isolation."

# process queue
./automation/kaayko worker --limit 5

# inspect status
./automation/kaayko status

# refresh dashboard only
./automation/kaayko dashboard

# reconcile old auto-reviewed runs with the latest heuristics
./automation/kaayko reconcile --all

# refresh datasets only
./automation/kaayko export
```

## Current smoke-test reality

In this Codex sandbox, backend smoke tests that try to bind to `0.0.0.0` are classified as `blocked` by environment restrictions instead of code failures. That distinction is deliberate and should remain in place, because it protects the dataset from false negatives caused by the execution environment rather than the code itself.

If you improve the review heuristics later, run:

```bash
cd /Users/Rohan/Kaayko_v6/kaayko
./automation/kaayko reconcile --all
```

That updates older auto-reviewed runs and refreshes the dashboard/export outputs so stale findings do not linger.
